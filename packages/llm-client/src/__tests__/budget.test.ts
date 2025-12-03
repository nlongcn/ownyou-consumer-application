/**
 * Budget Management Tests - v13 Section 6.10
 *
 * Tests for LLM budget tracking and throttling
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BudgetManager, type BudgetConfig, type UsageRecord } from '../budget';

describe('BudgetManager (v13 Section 6.10)', () => {
  let budgetManager: BudgetManager;
  const userId = 'user_123';

  const defaultConfig: BudgetConfig = {
    monthlyBudgetUsd: 10,
    throttling: {
      warnAt: 50,
      downgradeAt: 80,
      deferAt: 95,
      blockAt: 100,
    },
  };

  beforeEach(() => {
    budgetManager = new BudgetManager(defaultConfig);
  });

  describe('Usage Tracking', () => {
    it('should track LLM usage costs', async () => {
      const usage: UsageRecord = {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0005,
        operation: 'iab_classification',
        timestamp: Date.now(),
      };

      await budgetManager.trackUsage(userId, usage);
      const current = await budgetManager.getCurrentUsage(userId);

      expect(current.totalCostUsd).toBe(0.0005);
      expect(current.operationCounts.iab_classification).toBe(1);
    });

    it('should accumulate costs over multiple requests', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0005,
        operation: 'iab_classification',
        timestamp: Date.now(),
      });

      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 2000,
        outputTokens: 1000,
        costUsd: 0.001,
        operation: 'mission_agent',
        timestamp: Date.now(),
      });

      const current = await budgetManager.getCurrentUsage(userId);

      expect(current.totalCostUsd).toBe(0.0015);
      expect(current.operationCounts.iab_classification).toBe(1);
      expect(current.operationCounts.mission_agent).toBe(1);
    });

    it('should track token counts by model', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0005,
        operation: 'iab_classification',
        timestamp: Date.now(),
      });

      const current = await budgetManager.getCurrentUsage(userId);

      expect(current.tokensByModel['gpt-4o-mini'].input).toBe(1000);
      expect(current.tokensByModel['gpt-4o-mini'].output).toBe(500);
    });
  });

  describe('Budget Percentage Calculation', () => {
    it('should calculate budget percentage correctly', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 5.0, // 50% of $10 budget
        operation: 'test',
        timestamp: Date.now(),
      });

      const percentage = await budgetManager.getBudgetPercentage(userId);
      expect(percentage).toBe(50);
    });

    it('should return 0% for no usage', async () => {
      const percentage = await budgetManager.getBudgetPercentage(userId);
      expect(percentage).toBe(0);
    });
  });

  describe('Throttling Decisions', () => {
    it('should return "ok" when under 50%', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 4.0, // 40%
        operation: 'test',
        timestamp: Date.now(),
      });

      const decision = await budgetManager.getThrottleDecision(userId);
      expect(decision.action).toBe('ok');
    });

    it('should return "warn" at 50-80%', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 6.0, // 60%
        operation: 'test',
        timestamp: Date.now(),
      });

      const decision = await budgetManager.getThrottleDecision(userId);
      expect(decision.action).toBe('warn');
    });

    it('should return "downgrade" at 80-95%', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 8.5, // 85%
        operation: 'test',
        timestamp: Date.now(),
      });

      const decision = await budgetManager.getThrottleDecision(userId);
      expect(decision.action).toBe('downgrade');
    });

    it('should return "defer" at 95-100%', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 9.7, // 97%
        operation: 'test',
        timestamp: Date.now(),
      });

      const decision = await budgetManager.getThrottleDecision(userId);
      expect(decision.action).toBe('defer');
    });

    it('should return "block" at 100%+', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 11.0, // 110%
        operation: 'test',
        timestamp: Date.now(),
      });

      const decision = await budgetManager.getThrottleDecision(userId);
      expect(decision.action).toBe('block');
    });
  });

  describe('Model Tier Selection', () => {
    it('should select appropriate model for budget level', async () => {
      // Under 80% - use requested tier (model from standard tier)
      const modelNormal = budgetManager.selectModel('standard', 50);
      expect(modelNormal).toBeDefined();
      expect(modelNormal).not.toBe('local'); // Should be a real model

      // Over 80% - downgrade (model from fast tier, since quality->standard->fast)
      const modelDowngraded = budgetManager.selectModel('quality', 85);
      expect(modelDowngraded).toBeDefined();
      expect(modelDowngraded).not.toBe('local'); // Should be a cheaper model

      // Over 100% - local only
      const modelLocal = budgetManager.selectModel('standard', 105);
      expect(modelLocal).toBe('local');
    });
  });

  describe('Monthly Reset', () => {
    it('should reset usage at month boundary', async () => {
      await budgetManager.trackUsage(userId, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 5.0,
        operation: 'test',
        timestamp: Date.now(),
      });

      await budgetManager.resetMonthlyUsage(userId);

      const current = await budgetManager.getCurrentUsage(userId);
      expect(current.totalCostUsd).toBe(0);
    });
  });
});
