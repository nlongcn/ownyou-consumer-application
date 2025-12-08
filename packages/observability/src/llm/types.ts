/**
 * LLM Metrics Types - v13 Section 10.4
 *
 * Type definitions for LLM cost metering and budget management.
 */

/**
 * Throttle state based on budget usage
 */
export type ThrottleState = 'normal' | 'warning' | 'reduced' | 'deferred' | 'local_only';

/**
 * Alert type
 */
export type AlertType = 'info' | 'warning' | 'throttled' | 'budget_exceeded';

/**
 * Recommendation type
 */
export type RecommendationType = 'on_track' | 'reduce_usage' | 'critical';

/**
 * LLM usage record - a single LLM call
 */
export interface LLMUsageRecord {
  model: string;
  agentType: string;
  operation: string;
  tokens: {
    input: number;
    output: number;
  };
  costUsd: number;
  latencyMs: number;
  timestamp?: number;
}

/**
 * Current period metrics
 */
export interface CurrentPeriodMetrics {
  periodType: 'daily' | 'monthly';
  periodStart: number;
  totalCostUsd: number;
  budgetLimitUsd: number;
  budgetRemainingUsd: number;
  budgetUsedPercent: number;
  throttleState: ThrottleState;
}

/**
 * Aggregated metrics by dimension
 */
export interface AggregatedMetrics {
  tokens: number;
  costUsd: number;
  calls: number;
  avgLatencyMs: number;
}

/**
 * Daily usage record
 */
export interface DailyUsage {
  date: string;
  costUsd: number;
  calls: number;
}

/**
 * Projections based on current usage
 */
export interface UsageProjections {
  projectedMonthlyCost: number;
  daysUntilBudgetExceeded: number | null;
  recommendation: RecommendationType;
}

/**
 * Alert record
 */
export interface Alert {
  timestamp: number;
  type: AlertType;
  message: string;
  acknowledged: boolean;
}

/**
 * Full LLM metrics - v13 Section 10.4
 */
export interface LLMMetrics {
  currentPeriod: CurrentPeriodMetrics;
  byAgent: Record<string, AggregatedMetrics>;
  byOperation: Record<string, AggregatedMetrics>;
  byModel: Record<string, AggregatedMetrics>;
  byDay: DailyUsage[];
  projections: UsageProjections;
  alerts: Alert[];
}

/**
 * LLM Metrics config
 */
export interface LLMMetricsConfig {
  monthlyBudgetUsd: number;
  alertThresholds: {
    warning: number;      // 0.5 = 50%
    reduced: number;      // 0.8 = 80%
    deferred: number;     // 0.95 = 95%
    localOnly: number;    // 1.0 = 100%
  };
}
