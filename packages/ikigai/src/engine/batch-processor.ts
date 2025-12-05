/**
 * Batch Processor - Manage inference batch windows
 *
 * Responsibilities:
 * 1. Track when inference was last run
 * 2. Determine if new data warrants re-inference
 * 3. Support configurable batch windows (daily/weekly)
 * 4. Aggregate data changes for efficient processing
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.5
 */

import type { IkigaiInferenceConfig, UserDataBundle } from '../types';

/**
 * Batch state stored in memory store
 */
export interface BatchState {
  userId: string;
  lastInferenceAt: number;
  nextScheduledAt: number;
  pendingItems: number;
  status: 'idle' | 'pending' | 'processing';
}

/**
 * Result of batch readiness check
 */
export interface BatchReadiness {
  ready: boolean;
  reason: 'scheduled' | 'threshold' | 'manual' | 'not_ready';
  pendingItems: number;
  lastInferenceAt: number;
  nextScheduledAt: number;
}

/**
 * Batch Processor - Manages inference scheduling
 */
export class BatchProcessor {
  private config: IkigaiInferenceConfig;
  private batchStates: Map<string, BatchState>;

  constructor(config: Partial<IkigaiInferenceConfig> = {}) {
    this.config = {
      batchWindow: config.batchWindow ?? 'daily',
      minItemsThreshold: config.minItemsThreshold ?? 10,
      parallelInference: config.parallelInference ?? true,
      dataWindowDays: config.dataWindowDays ?? 90,
      modelTier: config.modelTier ?? 'standard',
    };
    this.batchStates = new Map();
  }

  /**
   * Check if batch is ready to process
   */
  checkBatchReadiness(userId: string, data: UserDataBundle): BatchReadiness {
    const state = this.getOrCreateState(userId);
    const now = Date.now();
    const pendingItems = this.countNewItems(data, state.lastInferenceAt);

    // Update pending count
    state.pendingItems = pendingItems;
    this.batchStates.set(userId, state);

    // Check if scheduled time has passed
    if (now >= state.nextScheduledAt && state.lastInferenceAt > 0) {
      return {
        ready: true,
        reason: 'scheduled',
        pendingItems,
        lastInferenceAt: state.lastInferenceAt,
        nextScheduledAt: state.nextScheduledAt,
      };
    }

    // Check if threshold is met
    if (pendingItems >= this.config.minItemsThreshold) {
      return {
        ready: true,
        reason: 'threshold',
        pendingItems,
        lastInferenceAt: state.lastInferenceAt,
        nextScheduledAt: state.nextScheduledAt,
      };
    }

    // First inference (no previous state)
    if (state.lastInferenceAt === 0 && pendingItems > 0) {
      return {
        ready: true,
        reason: 'threshold',
        pendingItems,
        lastInferenceAt: state.lastInferenceAt,
        nextScheduledAt: state.nextScheduledAt,
      };
    }

    return {
      ready: false,
      reason: 'not_ready',
      pendingItems,
      lastInferenceAt: state.lastInferenceAt,
      nextScheduledAt: state.nextScheduledAt,
    };
  }

  /**
   * Force batch to be ready (manual trigger)
   */
  forceReady(userId: string): BatchReadiness {
    const state = this.getOrCreateState(userId);

    return {
      ready: true,
      reason: 'manual',
      pendingItems: state.pendingItems,
      lastInferenceAt: state.lastInferenceAt,
      nextScheduledAt: state.nextScheduledAt,
    };
  }

  /**
   * Mark batch as started (processing)
   */
  markProcessing(userId: string): void {
    const state = this.getOrCreateState(userId);
    state.status = 'processing';
    this.batchStates.set(userId, state);
  }

  /**
   * Mark batch as completed
   */
  markCompleted(userId: string): void {
    const now = Date.now();
    const state = this.getOrCreateState(userId);

    state.lastInferenceAt = now;
    state.nextScheduledAt = this.calculateNextSchedule(now);
    state.pendingItems = 0;
    state.status = 'idle';

    this.batchStates.set(userId, state);
  }

  /**
   * Mark batch as failed (allows retry)
   */
  markFailed(userId: string): void {
    const state = this.getOrCreateState(userId);
    state.status = 'pending';
    this.batchStates.set(userId, state);
  }

  /**
   * Get current batch state
   */
  getState(userId: string): BatchState | undefined {
    return this.batchStates.get(userId);
  }

  /**
   * Reset state (for testing or manual reset)
   */
  resetState(userId: string): void {
    this.batchStates.delete(userId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IkigaiInferenceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get or create batch state for user
   */
  private getOrCreateState(userId: string): BatchState {
    let state = this.batchStates.get(userId);

    if (!state) {
      const now = Date.now();
      state = {
        userId,
        lastInferenceAt: 0,
        nextScheduledAt: this.calculateNextSchedule(now),
        pendingItems: 0,
        status: 'idle',
      };
      this.batchStates.set(userId, state);
    }

    return state;
  }

  /**
   * Calculate next scheduled inference time
   */
  private calculateNextSchedule(fromTime: number): number {
    const date = new Date(fromTime);

    switch (this.config.batchWindow) {
      case 'daily':
        // Next day at 3:00 AM (low activity time)
        date.setDate(date.getDate() + 1);
        date.setHours(3, 0, 0, 0);
        return date.getTime();

      case 'weekly':
        // Next Sunday at 3:00 AM
        const daysUntilSunday = (7 - date.getDay()) % 7 || 7;
        date.setDate(date.getDate() + daysUntilSunday);
        date.setHours(3, 0, 0, 0);
        return date.getTime();

      default:
        // Default to daily
        date.setDate(date.getDate() + 1);
        date.setHours(3, 0, 0, 0);
        return date.getTime();
    }
  }

  /**
   * Count new items since last inference
   */
  private countNewItems(data: UserDataBundle, since: number): number {
    let count = 0;

    // Count IAB classifications
    count += this.countItemsSince(data.iabClassifications, since);

    // Count emails
    count += this.countItemsSince(data.emails, since);

    // Count financial items
    if (data.financial) {
      count += this.countItemsSince(data.financial, since);
    }

    // Count calendar items
    if (data.calendar) {
      count += this.countItemsSince(data.calendar, since);
    }

    return count;
  }

  /**
   * Count items newer than a timestamp
   */
  private countItemsSince(
    items: Array<{ key: string; value: unknown }>,
    since: number
  ): number {
    if (since === 0) {
      return items.length;
    }

    return items.filter((item) => {
      const val = item.value as Record<string, unknown>;
      const dateValue =
        val.date || val.created_at || val.timestamp || val.received_at;

      if (!dateValue) {
        return true; // Include items without dates
      }

      const timestamp =
        typeof dateValue === 'number'
          ? dateValue
          : new Date(String(dateValue)).getTime();

      return timestamp > since;
    }).length;
  }
}

/**
 * Create a batch processor with default configuration
 */
export function createBatchProcessor(
  config?: Partial<IkigaiInferenceConfig>
): BatchProcessor {
  return new BatchProcessor(config);
}
