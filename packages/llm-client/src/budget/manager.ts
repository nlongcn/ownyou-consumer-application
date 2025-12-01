/**
 * Budget Manager - v13 Section 6.10
 *
 * Manages LLM usage tracking and budget enforcement.
 */

import type { ModelTier } from '../providers/types';
import { MODEL_TIERS } from '../providers/types';
import type {
  BudgetConfig,
  UsageRecord,
  UsageSummary,
  ThrottleDecision,
  ThrottleAction,
} from './types';
import { DEFAULT_BUDGET_CONFIG } from './types';

/**
 * BudgetManager - Tracks and enforces LLM budget
 */
export class BudgetManager {
  private config: BudgetConfig;
  private usage: Map<string, UsageSummary> = new Map();

  constructor(config?: Partial<BudgetConfig>) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
  }

  /**
   * Track usage for a user
   */
  async trackUsage(userId: string, record: UsageRecord): Promise<void> {
    let summary = this.usage.get(userId);

    if (!summary) {
      summary = this.createEmptySummary();
      this.usage.set(userId, summary);
    }

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
  }

  /**
   * Get current usage summary
   */
  async getCurrentUsage(userId: string): Promise<UsageSummary> {
    return this.usage.get(userId) ?? this.createEmptySummary();
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
    this.usage.set(userId, this.createEmptySummary());
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
