/**
 * Budget Manager - v13 Section 6.10
 *
 * Manages LLM usage tracking and budget enforcement.
 *
 * PERSISTENCE:
 * - When a StorageBackend is provided, budget data persists across page refreshes
 * - Uses NAMESPACES.LLM_BUDGET namespace for storage
 * - Budget syncs across devices (sync_scope: 'full')
 * - Falls back to in-memory storage if no backend provided
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import { NAMESPACES } from '@ownyou/shared-types';
import type { ModelTier } from '../providers/types';
import { MODEL_TIERS } from '../providers/registry';
import type {
  BudgetConfig,
  UsageRecord,
  UsageSummary,
  ThrottleDecision,
  ThrottleAction,
} from './types';
import { DEFAULT_BUDGET_CONFIG } from './types';

/**
 * Storage backend interface (matches @ownyou/memory-store)
 * Using minimal interface to avoid circular dependency
 */
interface BudgetStorageBackend {
  put<T>(namespace: string, userId: string, key: string, value: T): Promise<void>;
  get<T>(namespace: string, userId: string, key: string): Promise<T | null>;
}

/**
 * Budget manager configuration
 */
export interface BudgetManagerConfig extends Partial<BudgetConfig> {
  /** Optional storage backend for persistence */
  store?: BudgetStorageBackend;
}

const BUDGET_KEY = 'current_period';

/**
 * BudgetManager - Tracks and enforces LLM budget
 */
export class BudgetManager {
  private config: BudgetConfig;
  private store?: BudgetStorageBackend;
  private usage: Map<string, UsageSummary> = new Map();
  private loadPromises: Map<string, Promise<UsageSummary>> = new Map();

  constructor(config?: BudgetManagerConfig) {
    const { store, ...budgetConfig } = config ?? {};
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...budgetConfig };
    this.store = store;
  }

  /**
   * Track usage for a user
   */
  async trackUsage(userId: string, record: UsageRecord): Promise<void> {
    let summary = await this.loadUsage(userId);

    // Update totals
    summary.totalCostUsd += record.costUsd;
    summary.totalInputTokens += record.inputTokens;
    summary.totalOutputTokens += record.outputTokens;

    // Update operation counts
    const op = record.operation;
    summary.operationCounts[op] = (summary.operationCounts[op] ?? 0) + 1;

    // Update tokens by model
    if (!summary.tokensByModel[record.model]) {
      summary.tokensByModel[record.model] = { input: 0, output: 0 };
    }
    summary.tokensByModel[record.model].input += record.inputTokens;
    summary.tokensByModel[record.model].output += record.outputTokens;

    // Update in-memory cache
    this.usage.set(userId, summary);

    // Persist if store available
    await this.saveUsage(userId, summary);
  }

  /**
   * Load usage from store (with caching)
   */
  private async loadUsage(userId: string): Promise<UsageSummary> {
    // Check in-memory cache first
    const cached = this.usage.get(userId);
    if (cached) {
      // Check if period has expired
      if (cached.periodEnd > Date.now()) {
        return cached;
      }
      // Period expired, create new one
    }

    // Prevent concurrent loads for same user
    const existingPromise = this.loadPromises.get(userId);
    if (existingPromise) {
      return existingPromise;
    }

    const loadPromise = this.doLoadUsage(userId);
    this.loadPromises.set(userId, loadPromise);

    try {
      const summary = await loadPromise;
      this.usage.set(userId, summary);
      return summary;
    } finally {
      this.loadPromises.delete(userId);
    }
  }

  /**
   * Actual load from store
   */
  private async doLoadUsage(userId: string): Promise<UsageSummary> {
    if (this.store) {
      const stored = await this.store.get<UsageSummary>(
        NAMESPACES.LLM_BUDGET,
        userId,
        BUDGET_KEY
      );

      if (stored && stored.periodEnd > Date.now()) {
        return stored;
      }
    }

    // No stored data or expired, create new
    return this.createEmptySummary();
  }

  /**
   * Save usage to store
   */
  private async saveUsage(userId: string, summary: UsageSummary): Promise<void> {
    if (this.store) {
      await this.store.put(NAMESPACES.LLM_BUDGET, userId, BUDGET_KEY, summary);
    }
  }

  /**
   * Get current usage summary
   */
  async getCurrentUsage(userId: string): Promise<UsageSummary> {
    return this.loadUsage(userId);
  }

  /**
   * Get budget percentage used
   */
  async getBudgetPercentage(userId: string): Promise<number> {
    const summary = await this.getCurrentUsage(userId);
    return (summary.totalCostUsd / this.config.monthlyBudgetUsd) * 100;
  }

  /**
   * Get throttle decision based on current usage
   */
  async getThrottleDecision(userId: string): Promise<ThrottleDecision> {
    const percent = await this.getBudgetPercentage(userId);
    const { throttling } = this.config;

    let action: ThrottleAction;
    let message: string | undefined;

    if (percent >= throttling.blockAt) {
      action = 'block';
      message = 'Budget exceeded. Requests blocked.';
    } else if (percent >= throttling.deferAt) {
      action = 'defer';
      message = 'Budget nearly exhausted. Non-urgent requests deferred.';
    } else if (percent >= throttling.downgradeAt) {
      action = 'downgrade';
      message = 'Budget high. Downgrading to cheaper models.';
    } else if (percent >= throttling.warnAt) {
      action = 'warn';
      message = 'Budget at 50%. Consider reducing usage.';
    } else {
      action = 'ok';
    }

    return { action, budgetPercent: percent, message };
  }

  /**
   * Select model based on tier and budget
   */
  selectModel(requestedTier: ModelTier, budgetPercent: number): string {
    const { throttling } = this.config;

    // Over 100% - local only
    if (budgetPercent >= throttling.blockAt) {
      return 'local';
    }

    // Over 80% - downgrade
    if (budgetPercent >= throttling.downgradeAt) {
      const downgradedTier = this.downgradeModelTier(requestedTier);
      return MODEL_TIERS[downgradedTier].models[0];
    }

    // Under 80% - use requested tier
    return MODEL_TIERS[requestedTier].models[0];
  }

  /**
   * Downgrade model tier
   */
  private downgradeModelTier(tier: ModelTier): ModelTier {
    switch (tier) {
      case 'quality':
        return 'standard';
      case 'standard':
        return 'fast';
      case 'fast':
        return 'fast';
      case 'local':
        return 'local';
    }
  }

  /**
   * Reset monthly usage
   */
  async resetMonthlyUsage(userId: string): Promise<void> {
    const summary = this.createEmptySummary();
    this.usage.set(userId, summary);
    await this.saveUsage(userId, summary);
  }

  /**
   * Set usage for testing
   */
  async setUsageForTesting(userId: string, costUsd: number): Promise<void> {
    const summary = this.createEmptySummary();
    summary.totalCostUsd = costUsd;
    this.usage.set(userId, summary);
  }

  /**
   * Create empty usage summary
   */
  private createEmptySummary(): UsageSummary {
    const now = Date.now();
    return {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      operationCounts: {},
      tokensByModel: {},
      periodStart: now,
      periodEnd: now + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
  }
}
