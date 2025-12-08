/**
 * Reflection Trigger Manager - v13 Section 8.10
 *
 * Manages when reflection should run:
 * - after_episodes: 5 - Run after every 5 episodes
 * - daily_idle: 03:00 - Run at 3 AM if app was used that day
 * - after_negative_feedback - Immediate on negative outcomes
 * - weekly_maintenance: SUN - Weekly cleanup
 */

import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { NS } from '@ownyou/shared-types';
import {
  runReflection,
  DEFAULT_REFLECTION_CONFIG,
  createNegativeFeedbackTrigger,
} from './reflection-node';
import type { ReflectionTrigger, ReflectionConfig, TriggerState, ReflectionResult } from './types';

const STATE_KEY = 'reflection_trigger_state';

/**
 * Reflection Trigger Manager
 *
 * Tracks state and manages when reflection runs.
 */
export class ReflectionTriggerManager {
  private state: TriggerState = {
    episodesSinceLastReflection: 0,
    lastReflectionTime: 0,
    lastDailyReflection: 0,
    lastWeeklyReflection: 0,
  };

  constructor(
    private userId: string,
    private store: MemoryStore,
    private llm: LLMClient,
    private config: ReflectionConfig = DEFAULT_REFLECTION_CONFIG
  ) {}

  /**
   * Load state from store
   */
  async loadState(): Promise<void> {
    const stored = await this.store.get<TriggerState>(
      NS.reflectionState(this.userId),
      STATE_KEY
    );

    if (stored) {
      this.state = stored;
    }
  }

  /**
   * Save state to store
   */
  private async saveState(): Promise<void> {
    await this.store.put(NS.reflectionState(this.userId), STATE_KEY, this.state);
  }

  /**
   * Record that an episode was saved
   *
   * May trigger reflection if threshold reached.
   */
  async onEpisodeSaved(): Promise<ReflectionResult | null> {
    this.state.episodesSinceLastReflection++;
    await this.saveState();

    // Check if we should run reflection
    if (this.state.episodesSinceLastReflection >= this.config.afterEpisodes) {
      return this.runAfterEpisodes();
    }

    return null;
  }

  /**
   * Record negative feedback - triggers immediate reflection
   */
  async onNegativeFeedback(episodeId: string): Promise<ReflectionResult> {
    const trigger = createNegativeFeedbackTrigger(episodeId);
    return this.run(trigger);
  }

  /**
   * Check and run scheduled reflection (daily/weekly)
   *
   * Call this periodically (e.g., every hour) to check for scheduled triggers.
   */
  async checkScheduledTriggers(): Promise<ReflectionResult | null> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const thisWeekStart = this.getWeekStart(now).getTime();

    // Check for weekly maintenance (runs on configured day at configured hour)
    if (
      now.getDay() === this.config.weeklyMaintenanceDay &&
      now.getHours() === this.config.dailyIdleHour &&
      this.state.lastWeeklyReflection < thisWeekStart
    ) {
      return this.runWeeklyMaintenance();
    }

    // Check for daily idle (runs at configured hour)
    if (
      now.getHours() === this.config.dailyIdleHour &&
      this.state.lastDailyReflection < today
    ) {
      return this.runDailyIdle();
    }

    return null;
  }

  /**
   * Run reflection after episode threshold
   */
  private async runAfterEpisodes(): Promise<ReflectionResult> {
    const trigger: ReflectionTrigger = {
      type: 'after_episodes',
      count: this.state.episodesSinceLastReflection,
    };

    const result = await this.run(trigger);

    // Reset episode counter
    this.state.episodesSinceLastReflection = 0;
    await this.saveState();

    return result;
  }

  /**
   * Run daily idle reflection
   */
  private async runDailyIdle(): Promise<ReflectionResult> {
    const trigger: ReflectionTrigger = { type: 'daily_idle' };
    const result = await this.run(trigger);

    this.state.lastDailyReflection = Date.now();
    await this.saveState();

    return result;
  }

  /**
   * Run weekly maintenance reflection
   */
  private async runWeeklyMaintenance(): Promise<ReflectionResult> {
    const trigger: ReflectionTrigger = { type: 'weekly_maintenance' };
    const result = await this.run(trigger);

    this.state.lastWeeklyReflection = Date.now();
    this.state.lastDailyReflection = Date.now(); // Also counts as daily
    await this.saveState();

    return result;
  }

  /**
   * Run reflection with given trigger
   */
  private async run(trigger: ReflectionTrigger): Promise<ReflectionResult> {
    const result = await runReflection(this.userId, trigger, this.store, this.llm);

    this.state.lastReflectionTime = Date.now();
    await this.saveState();

    return result;
  }

  /**
   * Get start of the week containing the given date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to get Sunday
    return new Date(d.getFullYear(), d.getMonth(), diff);
  }

  /**
   * Get current state for monitoring
   */
  getState(): TriggerState {
    return { ...this.state };
  }

  /**
   * Force reflection to run (for testing/debugging)
   */
  async forceRun(
    trigger: ReflectionTrigger = { type: 'after_episodes', count: 0 }
  ): Promise<ReflectionResult> {
    return this.run(trigger);
  }
}
