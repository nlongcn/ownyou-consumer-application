/**
 * AgentScheduler - v13 Section 3.6
 *
 * Runs agents on schedule or on-demand.
 * Lives in separate package to avoid circular dependencies.
 */

import { ShoppingAgent } from '@ownyou/agents-shopping';
import { BaseAgent, type AgentContext, type AgentResult, type AgentStore } from '@ownyou/agents-base';
import type { LLMClient } from '@ownyou/llm-client';
import type { AgentType } from '@ownyou/shared-types';
import type {
  ScheduledTask,
  TaskSchedule,
  TaskResult,
  SchedulerStatus,
} from './types';

/**
 * Configuration for the scheduler
 */
export interface SchedulerConfig {
  /** Store for agent memory operations */
  store: AgentStore;

  /** LLM client for agent intelligence */
  llm?: LLMClient;

  /** User ID for namespacing */
  userId: string;

  /** Maximum results to keep in history */
  maxResultHistory?: number;
}

/**
 * Default scheduler configuration
 */
const DEFAULT_CONFIG = {
  maxResultHistory: 100,
};

/**
 * AgentScheduler - Runs agents on schedule or on-demand
 *
 * @example
 * ```typescript
 * const scheduler = new AgentScheduler({
 *   store: memoryStore,
 *   llm: llmClient,
 *   userId: 'user_123',
 * });
 *
 * // Start automatic scheduling
 * scheduler.start();
 *
 * // Or run immediately
 * const result = await scheduler.runNow('shopping');
 *
 * // Stop scheduler
 * scheduler.stop();
 * ```
 */
export class AgentScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private results: TaskResult[] = [];
  private config: Required<SchedulerConfig>;
  private running = false;
  private totalExecutions = 0;

  constructor(config: SchedulerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.initializeDefaultTasks();
  }

  /**
   * Initialize default agent tasks
   */
  private initializeDefaultTasks(): void {
    // Shopping Agent: Run every 4 hours
    this.registerTask({
      id: 'shopping',
      agentType: 'shopping',
      schedule: { type: 'interval', intervalMs: 4 * 60 * 60 * 1000 },
      enabled: true,
      nextRun: Date.now() + 60 * 1000, // First run in 1 minute
    });

    // Additional agents can be added here as they're created
  }

  /**
   * Register a new scheduled task
   */
  registerTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task);
    if (this.running && task.enabled) {
      this.scheduleTask(task);
    }
  }

  /**
   * Unregister a task
   */
  unregisterTask(taskId: string): boolean {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }
    return this.tasks.delete(taskId);
  }

  /**
   * Enable or disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.enabled = enabled;

    if (enabled && this.running) {
      this.scheduleTask(task);
    } else if (!enabled) {
      const timer = this.timers.get(taskId);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(taskId);
      }
    }

    return true;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) {
      console.warn('[AgentScheduler] Already running');
      return;
    }

    this.running = true;
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
    console.log('[AgentScheduler] Started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.running) {
      console.warn('[AgentScheduler] Already stopped');
      return;
    }

    this.running = false;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    console.log('[AgentScheduler] Stopped');
  }

  /**
   * Schedule a task for execution
   */
  private scheduleTask(task: ScheduledTask): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(task.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delay = Math.max(0, task.nextRun - Date.now());

    const timer = setTimeout(async () => {
      await this.runTask(task);
    }, delay);

    this.timers.set(task.id, timer);
  }

  /**
   * Run a task
   */
  private async runTask(task: ScheduledTask): Promise<TaskResult> {
    const startTime = Date.now();
    console.log(`[AgentScheduler] Running agent: ${task.agentType}`);

    let result: TaskResult;

    try {
      const agent = this.createAgent(task.agentType);
      if (!agent) {
        throw new Error(`Unknown agent type: ${task.agentType}`);
      }

      const context: AgentContext = {
        userId: this.config.userId,
        store: this.config.store,
        llm: this.config.llm,
        tools: [],
        triggerData: {
          type: 'scheduled',
          taskId: task.id,
          scheduledAt: task.nextRun,
        },
      };

      const agentResult = await agent.run(context);
      const durationMs = Date.now() - startTime;

      result = {
        taskId: task.id,
        success: agentResult.success,
        executedAt: startTime,
        durationMs,
        error: agentResult.error,
        agentResult: {
          missionCreated: !!agentResult.missionCard,
          missionId: agentResult.missionCard?.id,
          episodeId: agentResult.episode?.id,
        },
      };

      // Update task timing
      task.lastRun = startTime;
      task.nextRun = this.calculateNextRun(task.schedule);

      console.log(`[AgentScheduler] Agent ${task.agentType} completed in ${durationMs}ms`);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      result = {
        taskId: task.id,
        success: false,
        executedAt: startTime,
        durationMs,
        error: errorMessage,
      };

      console.error(`[AgentScheduler] Agent ${task.agentType} failed:`, error);

      // Retry in 5 minutes on failure
      task.nextRun = Date.now() + 5 * 60 * 1000;
    }

    // Record result
    this.recordResult(result);
    this.totalExecutions++;

    // Reschedule if still running
    if (this.running && task.enabled) {
      this.scheduleTask(task);
    }

    return result;
  }

  /**
   * Create an agent instance by type
   */
  private createAgent(agentType: AgentType): BaseAgent | null {
    switch (agentType) {
      case 'shopping':
        return new ShoppingAgent();
      // Add more agents here as they're created:
      // case 'travel':
      //   return new TravelAgent();
      // case 'productivity':
      //   return new ProductivityAgent();
      default:
        console.warn(`[AgentScheduler] Unknown agent type: ${agentType}`);
        return null;
    }
  }

  /**
   * Calculate the next run time based on schedule
   */
  private calculateNextRun(schedule: TaskSchedule): number {
    if (schedule.type === 'interval') {
      return Date.now() + schedule.intervalMs;
    }

    if (schedule.type === 'daily') {
      const now = new Date();
      const next = new Date(now);
      next.setHours(schedule.hour, schedule.minute ?? 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }

    // Default: 1 hour
    return Date.now() + 60 * 60 * 1000;
  }

  /**
   * Record a task result
   */
  private recordResult(result: TaskResult): void {
    this.results.push(result);

    // Trim history if needed
    while (this.results.length > this.config.maxResultHistory) {
      this.results.shift();
    }
  }

  /**
   * Run an agent immediately (manual trigger)
   *
   * @param agentType - Type of agent to run
   * @param triggerData - Optional trigger data
   * @returns Agent result or null if agent not found
   */
  async runNow(
    agentType: AgentType,
    triggerData?: unknown
  ): Promise<AgentResult | null> {
    const agent = this.createAgent(agentType);
    if (!agent) {
      return null;
    }

    const context: AgentContext = {
      userId: this.config.userId,
      store: this.config.store,
      llm: this.config.llm,
      tools: [],
      triggerData: triggerData ?? { type: 'manual' },
    };

    return agent.run(context);
  }

  /**
   * Get the current scheduler status
   */
  getStatus(): SchedulerStatus {
    return {
      running: this.running,
      tasks: Array.from(this.tasks.values()),
      recentResults: [...this.results].slice(-10),
      totalExecutions: this.totalExecutions,
    };
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get recent task results
   */
  getResults(limit?: number): TaskResult[] {
    const results = [...this.results];
    return limit ? results.slice(-limit) : results;
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
