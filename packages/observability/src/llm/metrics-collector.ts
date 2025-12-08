/**
 * LLMMetricsCollector - v13 Section 10.4
 *
 * Collects and aggregates LLM usage metrics for cost tracking and budgeting.
 */

import type {
  LLMMetrics,
  LLMMetricsConfig,
  LLMUsageRecord,
  ThrottleState,
  Alert,
  AlertType,
  AggregatedMetrics,
  DailyUsage,
  RecommendationType,
} from './types';

/**
 * LLMMetricsCollector - Tracks LLM usage and costs
 */
export class LLMMetricsCollector {
  private userId: string;
  private config: LLMMetricsConfig;
  private records: LLMUsageRecord[] = [];
  private alerts: Alert[] = [];
  private periodStart: number;

  // Alert state tracking
  private warningAlertSent = false;
  private throttledAlertSent = false;
  private exceededAlertSent = false;

  constructor(userId: string, config: LLMMetricsConfig) {
    this.userId = userId;
    this.config = config;
    this.periodStart = this.getMonthStart();
  }

  /**
   * Get start of current month
   */
  private getMonthStart(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }

  /**
   * Get current day of month
   */
  private getDayOfMonth(): number {
    return new Date().getDate();
  }

  /**
   * Get days in current month
   */
  private getDaysInMonth(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  /**
   * Record a single LLM usage
   */
  recordUsage(record: LLMUsageRecord): void {
    const recordWithTimestamp: LLMUsageRecord = {
      ...record,
      timestamp: record.timestamp ?? Date.now(),
    };

    this.records.push(recordWithTimestamp);

    // Check for alert conditions
    this.checkAlerts();
  }

  /**
   * Check and create alerts based on current usage
   */
  private checkAlerts(): void {
    const totalCost = this.getTotalCost();
    const usedPercent = totalCost / this.config.monthlyBudgetUsd;

    // Warning at 50%
    if (usedPercent >= this.config.alertThresholds.warning && !this.warningAlertSent) {
      this.alerts.push({
        timestamp: Date.now(),
        type: 'warning',
        message: `LLM budget at ${Math.round(usedPercent * 100)}% - consider reducing usage`,
        acknowledged: false,
      });
      this.warningAlertSent = true;
    }

    // Throttled at 80%
    if (usedPercent >= this.config.alertThresholds.reduced && !this.throttledAlertSent) {
      this.alerts.push({
        timestamp: Date.now(),
        type: 'throttled',
        message: `LLM usage throttled at ${Math.round(usedPercent * 100)}% - using cheaper models`,
        acknowledged: false,
      });
      this.throttledAlertSent = true;
    }

    // Budget exceeded at 100%
    if (usedPercent >= this.config.alertThresholds.localOnly && !this.exceededAlertSent) {
      this.alerts.push({
        timestamp: Date.now(),
        type: 'budget_exceeded',
        message: `Monthly LLM budget exceeded - switching to local-only mode`,
        acknowledged: false,
      });
      this.exceededAlertSent = true;
    }
  }

  /**
   * Get total cost for current period
   */
  private getTotalCost(): number {
    return this.records.reduce((sum, r) => sum + r.costUsd, 0);
  }

  /**
   * Determine throttle state based on usage
   */
  private getThrottleState(): ThrottleState {
    const usedPercent = this.getTotalCost() / this.config.monthlyBudgetUsd;

    if (usedPercent >= this.config.alertThresholds.localOnly) {
      return 'local_only';
    }
    if (usedPercent >= this.config.alertThresholds.deferred) {
      return 'deferred';
    }
    if (usedPercent >= this.config.alertThresholds.reduced) {
      return 'reduced';
    }
    if (usedPercent >= this.config.alertThresholds.warning) {
      return 'warning';
    }
    return 'normal';
  }

  /**
   * Aggregate metrics by dimension
   */
  private aggregateBy(
    dimension: 'agentType' | 'operation' | 'model'
  ): Record<string, AggregatedMetrics> {
    const aggregated: Record<string, AggregatedMetrics> = {};

    for (const record of this.records) {
      const key = dimension === 'agentType' ? record.agentType :
                  dimension === 'operation' ? record.operation :
                  record.model;

      if (!aggregated[key]) {
        aggregated[key] = {
          tokens: 0,
          costUsd: 0,
          calls: 0,
          avgLatencyMs: 0,
        };
      }

      aggregated[key].tokens += record.tokens.input + record.tokens.output;
      aggregated[key].costUsd += record.costUsd;
      aggregated[key].calls += 1;

      // Running average for latency
      const newCount = aggregated[key].calls;
      const oldAvg = aggregated[key].avgLatencyMs;
      aggregated[key].avgLatencyMs = oldAvg + (record.latencyMs - oldAvg) / newCount;
    }

    return aggregated;
  }

  /**
   * Aggregate by day
   */
  private aggregateByDay(): DailyUsage[] {
    const dailyMap: Record<string, DailyUsage> = {};

    for (const record of this.records) {
      const date = new Date(record.timestamp!).toISOString().split('T')[0];

      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          costUsd: 0,
          calls: 0,
        };
      }

      dailyMap[date].costUsd += record.costUsd;
      dailyMap[date].calls += 1;
    }

    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate projections
   */
  private getProjections(): { projectedMonthlyCost: number; daysUntilBudgetExceeded: number | null; recommendation: RecommendationType } {
    const totalCost = this.getTotalCost();
    const dayOfMonth = this.getDayOfMonth();
    const daysInMonth = this.getDaysInMonth();

    // Calculate daily average and project
    const dailyAverage = totalCost / dayOfMonth;
    const projectedMonthlyCost = dailyAverage * daysInMonth;

    // Calculate days until budget exceeded
    const remaining = this.config.monthlyBudgetUsd - totalCost;
    const daysUntilBudgetExceeded = dailyAverage > 0 && remaining > 0
      ? remaining / dailyAverage
      : null;

    // Determine recommendation
    let recommendation: RecommendationType = 'on_track';

    if (projectedMonthlyCost > this.config.monthlyBudgetUsd * 1.5) {
      recommendation = 'critical';
    } else if (projectedMonthlyCost > this.config.monthlyBudgetUsd) {
      recommendation = 'reduce_usage';
    }

    return {
      projectedMonthlyCost,
      daysUntilBudgetExceeded,
      recommendation,
    };
  }

  /**
   * Get full metrics
   */
  getMetrics(): LLMMetrics {
    const totalCost = this.getTotalCost();
    const budgetRemaining = Math.max(0, this.config.monthlyBudgetUsd - totalCost);
    const budgetUsedPercent = (totalCost / this.config.monthlyBudgetUsd) * 100;

    return {
      currentPeriod: {
        periodType: 'monthly',
        periodStart: this.periodStart,
        totalCostUsd: totalCost,
        budgetLimitUsd: this.config.monthlyBudgetUsd,
        budgetRemainingUsd: budgetRemaining,
        budgetUsedPercent,
        throttleState: this.getThrottleState(),
      },
      byAgent: this.aggregateBy('agentType'),
      byOperation: this.aggregateBy('operation'),
      byModel: this.aggregateBy('model'),
      byDay: this.aggregateByDay(),
      projections: this.getProjections(),
      alerts: [...this.alerts],
    };
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(timestamp: number): void {
    const alert = this.alerts.find((a) => a.timestamp === timestamp);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Reset metrics (for new period or testing)
   */
  reset(): void {
    this.records = [];
    this.alerts = [];
    this.periodStart = this.getMonthStart();
    this.warningAlertSent = false;
    this.throttledAlertSent = false;
    this.exceededAlertSent = false;
  }
}
