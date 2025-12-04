/**
 * Scheduler Types - v13 Section 3.6
 *
 * Types for agent scheduling and task management.
 */

import type { AgentType } from '@ownyou/shared-types';

/**
 * Schedule configuration for interval-based runs
 */
export interface IntervalSchedule {
  type: 'interval';
  /** Interval in milliseconds */
  intervalMs: number;
}

/**
 * Schedule configuration for daily runs
 */
export interface DailySchedule {
  type: 'daily';
  /** Hour of day (0-23) */
  hour: number;
  /** Minute (0-59, defaults to 0) */
  minute?: number;
}

/**
 * Schedule configuration for cron-like runs
 */
export interface CronSchedule {
  type: 'cron';
  /** Cron expression (e.g., "0 */4 * * *" for every 4 hours) */
  expression: string;
}

/**
 * Task schedule type
 */
export type TaskSchedule = IntervalSchedule | DailySchedule;

/**
 * Scheduled task configuration
 */
export interface ScheduledTask {
  /** Unique task identifier */
  id: string;

  /** Agent type to run */
  agentType: AgentType;

  /** Schedule configuration */
  schedule: TaskSchedule;

  /** Last execution timestamp */
  lastRun?: number;

  /** Next scheduled execution timestamp */
  nextRun: number;

  /** Whether task is enabled */
  enabled: boolean;

  /** Task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task execution result
 */
export interface TaskResult {
  /** Task ID */
  taskId: string;

  /** Whether execution succeeded */
  success: boolean;

  /** Execution timestamp */
  executedAt: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Error message if failed */
  error?: string;

  /** Agent result summary */
  agentResult?: {
    missionCreated: boolean;
    missionId?: string;
    episodeId?: string;
  };
}

/**
 * Scheduler status
 */
export interface SchedulerStatus {
  /** Whether scheduler is running */
  running: boolean;

  /** All registered tasks */
  tasks: ScheduledTask[];

  /** Recent execution results */
  recentResults: TaskResult[];

  /** Total executions since start */
  totalExecutions: number;
}
