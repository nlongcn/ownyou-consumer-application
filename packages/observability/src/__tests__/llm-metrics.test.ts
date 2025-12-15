/**
 * LLM Metrics Tests - v13 Section 10.4
 *
 * Tests for LLM cost metering and budget management.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  LLMMetricsCollector,
  type LLMMetrics,
  type LLMMetricsConfig,
  type LLMUsageRecord,
  type ThrottleState,
} from '../llm';

describe('LLMMetricsCollector (v13 Section 10.4)', () => {
  let collector: LLMMetricsCollector;
  const userId = 'user_123';
  const defaultConfig: LLMMetricsConfig = {
    monthlyBudgetUsd: 10.0,
    alertThresholds: {
      warning: 0.5,
      reduced: 0.8,
      deferred: 0.95,
      localOnly: 1.0,
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    collector = new LLMMetricsCollector(userId, defaultConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Usage Recording', () => {
    it('should record LLM usage', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 0.001,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.totalCostUsd).toBe(0.001);
    });

    it('should track by agent type', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 0.001,
        latencyMs: 500,
      });

      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'travel',
        operation: 'plan',
        tokens: { input: 200, output: 100 },
        costUsd: 0.002,
        latencyMs: 800,
      });

      const metrics = collector.getMetrics();
      expect(metrics.byAgent['shopping'].costUsd).toBe(0.001);
      expect(metrics.byAgent['travel'].costUsd).toBe(0.002);
      expect(metrics.byAgent['shopping'].calls).toBe(1);
      expect(metrics.byAgent['travel'].calls).toBe(1);
    });

    it('should track by operation', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 0.001,
        latencyMs: 500,
      });

      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'restaurant',
        operation: 'classify',
        tokens: { input: 150, output: 75 },
        costUsd: 0.0015,
        latencyMs: 600,
      });

      const metrics = collector.getMetrics();
      expect(metrics.byOperation['classify'].costUsd).toBe(0.0025);
      expect(metrics.byOperation['classify'].calls).toBe(2);
    });

    it('should track by model', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 0.001,
        latencyMs: 500,
      });

      collector.recordUsage({
        model: 'gpt-4o',
        agentType: 'travel',
        operation: 'plan',
        tokens: { input: 200, output: 100 },
        costUsd: 0.01,
        latencyMs: 1000,
      });

      const metrics = collector.getMetrics();
      expect(metrics.byModel['gpt-4o-mini'].costUsd).toBe(0.001);
      expect(metrics.byModel['gpt-4o'].costUsd).toBe(0.01);
    });

    it('should calculate average latency', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 0.001,
        latencyMs: 400,
      });

      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 0.001,
        latencyMs: 600,
      });

      const metrics = collector.getMetrics();
      expect(metrics.byAgent['shopping'].avgLatencyMs).toBe(500);
    });
  });

  describe('Budget Tracking', () => {
    it('should calculate budget remaining', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 3.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.budgetLimitUsd).toBe(10.0);
      expect(metrics.currentPeriod.budgetRemainingUsd).toBe(7.0);
      expect(metrics.currentPeriod.budgetUsedPercent).toBe(30);
    });

    it('should not allow negative remaining budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 15.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.budgetRemainingUsd).toBe(0);
      expect(metrics.currentPeriod.budgetUsedPercent).toBe(150);
    });
  });

  describe('Throttle State', () => {
    it('should be normal when under warning threshold', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 4.0, // 40% of budget
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.throttleState).toBe('normal');
    });

    it('should be warning at 50% budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 5.0, // 50% of budget
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.throttleState).toBe('warning');
    });

    it('should be reduced at 80% budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 8.0, // 80% of budget
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.throttleState).toBe('reduced');
    });

    it('should be deferred at 95% budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 9.5, // 95% of budget
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.throttleState).toBe('deferred');
    });

    it('should be local_only at 100% budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 10.0, // 100% of budget
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.throttleState).toBe('local_only');
    });
  });

  describe('Projections', () => {
    it('should project monthly cost based on daily average', () => {
      // Day 15 of month, spent $3
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 3.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      // $3 spent in 15 days = $0.20/day, projected = $0.20 * 31 = $6.20
      expect(metrics.projections.projectedMonthlyCost).toBeCloseTo(6.2, 1);
    });

    it('should calculate days until budget exceeded', () => {
      // Day 15, spent $6 - way over pace
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 6.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      // $6 in 15 days = $0.40/day, $4 remaining = 10 days
      expect(metrics.projections.daysUntilBudgetExceeded).toBeCloseTo(10, 0);
    });

    it('should calculate days until budget exceeded even when under pace', () => {
      // Day 15, spent $1 - well under pace, $9 remaining, $0.067/day = 135 days
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 1.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      // $1 in 15 days = $0.067/day, $9 remaining = ~135 days
      expect(metrics.projections.daysUntilBudgetExceeded).toBeGreaterThan(100);
    });

    it('should provide on_track recommendation when safe', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 1.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.projections.recommendation).toBe('on_track');
    });

    it('should provide reduce_usage recommendation when over pace', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 6.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.projections.recommendation).toBe('reduce_usage');
    });

    it('should provide critical recommendation when severely over budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 9.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      expect(metrics.projections.recommendation).toBe('critical');
    });
  });

  describe('Alerts', () => {
    it('should create warning alert at 50% budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 5.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      const warningAlert = metrics.alerts.find((a) => a.type === 'warning');
      expect(warningAlert).toBeDefined();
      expect(warningAlert?.acknowledged).toBe(false);
    });

    it('should create throttled alert at 80% budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 8.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      const throttledAlert = metrics.alerts.find((a) => a.type === 'throttled');
      expect(throttledAlert).toBeDefined();
    });

    it('should create budget_exceeded alert at 100% budget', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 10.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      const exceededAlert = metrics.alerts.find((a) => a.type === 'budget_exceeded');
      expect(exceededAlert).toBeDefined();
    });

    it('should allow acknowledging alerts', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 5.0,
        latencyMs: 500,
      });

      const metrics = collector.getMetrics();
      const alertId = metrics.alerts[0].timestamp;

      collector.acknowledgeAlert(alertId);

      const updatedMetrics = collector.getMetrics();
      expect(updatedMetrics.alerts[0].acknowledged).toBe(true);
    });
  });

  describe('Daily Tracking', () => {
    it('should track usage by day', () => {
      // Day 1
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 1.0,
        latencyMs: 500,
      });

      // Day 2
      vi.setSystemTime(new Date('2024-01-16T12:00:00Z'));
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'travel',
        operation: 'plan',
        tokens: { input: 200, output: 100 },
        costUsd: 2.0,
        latencyMs: 800,
      });

      const metrics = collector.getMetrics();
      expect(metrics.byDay.length).toBeGreaterThanOrEqual(2);

      const day1 = metrics.byDay.find((d) => d.date === '2024-01-15');
      const day2 = metrics.byDay.find((d) => d.date === '2024-01-16');

      expect(day1?.costUsd).toBe(1.0);
      expect(day2?.costUsd).toBe(2.0);
    });
  });

  describe('Period Type', () => {
    it('should support monthly period type', () => {
      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.periodType).toBe('monthly');
    });
  });

  describe('Reset', () => {
    it('should reset metrics', () => {
      collector.recordUsage({
        model: 'gpt-4o-mini',
        agentType: 'shopping',
        operation: 'classify',
        tokens: { input: 100, output: 50 },
        costUsd: 5.0,
        latencyMs: 500,
      });

      collector.reset();

      const metrics = collector.getMetrics();
      expect(metrics.currentPeriod.totalCostUsd).toBe(0);
      expect(Object.keys(metrics.byAgent).length).toBe(0);
      expect(metrics.alerts.length).toBe(0);
    });
  });
});
