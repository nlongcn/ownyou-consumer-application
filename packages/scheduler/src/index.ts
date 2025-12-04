/**
 * @ownyou/scheduler - v13 Section 3.6
 *
 * Agent scheduling for OwnYou - runs agents on schedule or on-demand.
 *
 * This package exists separately from @ownyou/agents-* to avoid circular dependencies.
 * It imports agent implementations and orchestrates their execution.
 *
 * @example
 * ```typescript
 * import { AgentScheduler } from '@ownyou/scheduler';
 *
 * const scheduler = new AgentScheduler({
 *   store: memoryStore,
 *   llm: llmClient,
 *   userId: 'user_123',
 * });
 *
 * // Start automatic scheduling
 * scheduler.start();
 *
 * // Register a custom task
 * scheduler.registerTask({
 *   id: 'custom-shopping',
 *   agentType: 'shopping',
 *   schedule: { type: 'daily', hour: 9 },
 *   enabled: true,
 *   nextRun: Date.now(),
 * });
 *
 * // Run an agent immediately
 * const result = await scheduler.runNow('shopping');
 *
 * // Get scheduler status
 * const status = scheduler.getStatus();
 *
 * // Stop scheduler
 * scheduler.stop();
 * ```
 */

// Scheduler
export { AgentScheduler, type SchedulerConfig } from './agent-scheduler';

// Types
export type {
  ScheduledTask,
  TaskSchedule,
  IntervalSchedule,
  DailySchedule,
  TaskResult,
  SchedulerStatus,
} from './types';
