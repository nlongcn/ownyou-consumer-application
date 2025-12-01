/**
 * Budget Types - v13 Section 6.10
 *
 * Type definitions for LLM budget management.
 */

import type { OperationType } from '../providers/types';

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Monthly budget in USD */
  monthlyBudgetUsd: number;

  /** Throttling thresholds (percentages) */
  throttling: {
    /** Log warning */
    warnAt: number;
    /** Downgrade model tier */
    downgradeAt: number;
    /** Defer non-urgent requests */
    deferAt: number;
    /** Block all requests */
    blockAt: number;
  };
}

/**
 * Usage record for tracking
 */
export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  operation: OperationType | string;
  timestamp: number;
}

/**
 * Current usage summary
 */
export interface UsageSummary {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  operationCounts: Record<string, number>;
  tokensByModel: Record<string, { input: number; output: number }>;
  periodStart: number;
  periodEnd: number;
}

/**
 * Throttle decision
 */
export type ThrottleAction = 'ok' | 'warn' | 'downgrade' | 'defer' | 'block';

export interface ThrottleDecision {
  action: ThrottleAction;
  budgetPercent: number;
  message?: string;
}

/**
 * Default budget config (v13 Section 6.10)
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  monthlyBudgetUsd: 10,
  throttling: {
    warnAt: 50,
    downgradeAt: 80,
    deferAt: 95,
    blockAt: 100,
  },
};
