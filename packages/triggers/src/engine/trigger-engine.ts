/**
 * TriggerEngine - v13 Section 3.2
 *
 * Central orchestrator for all 4 trigger modes:
 * - Data-driven (Store watches)
 * - Scheduled (Cron-style)
 * - Event-driven (Calendar, location, webhooks)
 * - User-driven (Natural language requests)
 */

import type { AgentContext } from '@ownyou/agents-base';
import type { LLMClient } from '@ownyou/llm-client';
import type { MemoryStore } from '@ownyou/memory-store';
import type { Trigger, TriggerResult, EventTrigger } from '../types';
import { StoreWatcher, type StoreWatcherConfig } from '../data-driven/store-watcher';
import { CronScheduler } from '../scheduled/cron-scheduler';
import { AgentCoordinator, type AgentFactory, type AgentRegistryEntry } from '../coordinator';

/**
 * TriggerEngine configuration
 */
export interface TriggerEngineConfig {
  /** Memory store for data triggers and agent context */
  store: MemoryStore;
  /** LLM client for agent operations */
  llm?: LLMClient;
  /** User ID for namespacing */
  userId: string;
  /** Namespaces to watch for data triggers */
  watchNamespaces: string[];
  /** Schedule definitions (id -> cron expression) */
  schedules?: Record<string, string>;
  /** Agent factory to create agent instances */
  agentFactory: AgentFactory;
}

/**
 * TriggerEngine statistics
 */
export interface TriggerEngineStats {
  running: boolean;
  dataTriggersProcessed: number;
  scheduledTriggersProcessed: number;
  eventTriggersProcessed: number;
  userTriggersProcessed: number;
  totalTriggersProcessed: number;
  lastTriggerAt?: number;
  failedTriggers: number;
}

/**
 * TriggerEngine - Central orchestrator for all trigger modes
 *
 * @example
 * ```typescript
 * const engine = new TriggerEngine({
 *   store: memoryStore,
 *   llm: llmClient,
 *   userId: 'user_123',
 *   watchNamespaces: ['ownyou.iab', 'ownyou.semantic'],
 *   schedules: {
 *     daily_digest: '0 9 * * *',
 *     weekly_review: '0 10 * * 1',
 *   },
 *   agentFactory: (type) => {
 *     switch (type) {
 *       case 'shopping': return new ShoppingAgent();
 *       case 'content': return new ContentAgent();
 *       default: return null;
 *     }
 *   },
 * });
 *
 * // Register additional agents
 * engine.registerAgent({
 *   type: 'travel',
 *   namespaces: ['ownyou.semantic'],
 *   intents: ['travel', 'flight', 'hotel'],
 *   description: 'Travel Planner',
 *   enabled: true,
 * });
 *
 * // Start the engine
 * engine.start();
 *
 * // Handle user request
 * const result = await engine.handleUserRequest("Find me a good deal on headphones");
 *
 * // Stop the engine
 * engine.stop();
 * ```
 */
export class TriggerEngine {
  private config: TriggerEngineConfig;
  private storeWatcher: StoreWatcher;
  private scheduler: CronScheduler;
  private coordinator: AgentCoordinator;
  private running = false;
  private stats: TriggerEngineStats;

  constructor(config: TriggerEngineConfig) {
    this.config = config;

    // Initialize coordinator
    this.coordinator = new AgentCoordinator({
      agentFactory: config.agentFactory,
    });

    // Initialize data-driven triggers
    this.storeWatcher = new StoreWatcher({
      namespaces: config.watchNamespaces,
    });

    // Initialize scheduled triggers
    this.scheduler = new CronScheduler(config.schedules);

    // Initialize stats
    this.stats = {
      running: false,
      dataTriggersProcessed: 0,
      scheduledTriggersProcessed: 0,
      eventTriggersProcessed: 0,
      userTriggersProcessed: 0,
      totalTriggersProcessed: 0,
      failedTriggers: 0,
    };

    // Wire up callbacks
    this.wireCallbacks();
  }

  /**
   * Register an agent with the coordinator
   */
  registerAgent(entry: AgentRegistryEntry): void {
    this.coordinator.registerAgent(entry);
  }

  /**
   * Enable/disable an agent
   */
  setAgentEnabled(type: string, enabled: boolean): boolean {
    return this.coordinator.setAgentEnabled(type as any, enabled);
  }

  /**
   * Start the trigger engine
   */
  start(): void {
    if (this.running) {
      console.warn('[TriggerEngine] Already running');
      return;
    }
    this.running = true;
    this.stats.running = true;

    this.storeWatcher.start();
    this.scheduler.start();

    console.log('[TriggerEngine] Started');
    console.log(`  - Watching namespaces: ${this.config.watchNamespaces.join(', ')}`);
    console.log(`  - Active schedules: ${this.scheduler.getSchedules().length}`);
  }

  /**
   * Stop the trigger engine
   */
  stop(): void {
    if (!this.running) {
      console.warn('[TriggerEngine] Already stopped');
      return;
    }
    this.running = false;
    this.stats.running = false;

    this.storeWatcher.stop();
    this.scheduler.stop();

    console.log('[TriggerEngine] Stopped');
  }

  /**
   * Handle a user request (natural language)
   */
  async handleUserRequest(request: string): Promise<TriggerResult> {
    const context = this.getAgentContext();
    const result = await this.coordinator.routeUserRequest(request, context);

    this.stats.userTriggersProcessed++;
    this.stats.totalTriggersProcessed++;
    this.stats.lastTriggerAt = Date.now();

    if (result.skipped) {
      this.stats.failedTriggers++;
    }

    return result;
  }

  /**
   * Handle an external event trigger
   */
  async handleEvent(
    eventSource: string,
    eventType: string,
    eventData: unknown
  ): Promise<TriggerResult[]> {
    const trigger: EventTrigger = {
      id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mode: 'event',
      eventSource,
      eventType,
      eventData,
      createdAt: Date.now(),
    };

    const context = this.getAgentContext();
    const results = await this.coordinator.routeTrigger(trigger, context);

    this.stats.eventTriggersProcessed++;
    this.stats.totalTriggersProcessed++;
    this.stats.lastTriggerAt = Date.now();

    for (const result of results) {
      if (result.skipped) {
        this.stats.failedTriggers++;
      }
    }

    return results;
  }

  /**
   * Wire up internal callbacks
   */
  private wireCallbacks(): void {
    // Data-driven: Route store changes to coordinator
    for (const ns of this.config.watchNamespaces) {
      this.storeWatcher.onNamespaceChange(ns, async (trigger) => {
        const context = this.getAgentContext();
        const results = await this.coordinator.routeTrigger(trigger, context);

        this.stats.dataTriggersProcessed++;
        this.stats.totalTriggersProcessed++;
        this.stats.lastTriggerAt = Date.now();

        for (const result of results) {
          if (result.skipped) {
            this.stats.failedTriggers++;
          }
        }

        return results;
      });
    }

    // Scheduled: Route schedule triggers to coordinator
    this.scheduler.onTrigger(async (trigger) => {
      const context = this.getAgentContext();
      const results = await this.coordinator.routeTrigger(trigger, context);

      this.stats.scheduledTriggersProcessed++;
      this.stats.totalTriggersProcessed++;
      this.stats.lastTriggerAt = Date.now();

      for (const result of results) {
        if (result.skipped) {
          this.stats.failedTriggers++;
        }
      }

      return results;
    });
  }

  /**
   * Get agent context for trigger processing
   */
  private getAgentContext(): Omit<AgentContext, 'triggerData'> {
    return {
      userId: this.config.userId,
      store: this.config.store as any,
      llm: this.config.llm,
      tools: [],
    };
  }

  /**
   * Get the store watcher (for connecting to MemoryStore events)
   */
  getStoreWatcher(): StoreWatcher {
    return this.storeWatcher;
  }

  /**
   * Get the scheduler
   */
  getScheduler(): CronScheduler {
    return this.scheduler;
  }

  /**
   * Get the coordinator
   */
  getCoordinator(): AgentCoordinator {
    return this.coordinator;
  }

  /**
   * Get engine statistics
   */
  getStats(): TriggerEngineStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      running: this.running,
      dataTriggersProcessed: 0,
      scheduledTriggersProcessed: 0,
      eventTriggersProcessed: 0,
      userTriggersProcessed: 0,
      totalTriggersProcessed: 0,
      failedTriggers: 0,
    };
  }

  /**
   * Check if engine is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
