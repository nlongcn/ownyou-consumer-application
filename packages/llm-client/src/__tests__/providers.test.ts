/**
 * LLM Provider Tests - v13 Section 6.10-6.11
 *
 * Tests for LLM provider interface and implementations
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
  MockLLMProvider,
  LLMClient,
} from '../providers';
import { BudgetManager, type BudgetConfig } from '../budget';

describe('LLMProvider Interface', () => {
  describe('MockLLMProvider', () => {
    let provider: MockLLMProvider;

    beforeEach(() => {
      provider = new MockLLMProvider();
    });

    it('should return mock completion', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        maxTokens: 100,
      };

      const response = await provider.complete(request);

      expect(response.content).toBeDefined();
      expect(response.model).toBe('gpt-4o-mini');
      expect(response.usage.inputTokens).toBeGreaterThan(0);
      expect(response.usage.outputTokens).toBeGreaterThan(0);
    });

    it('should calculate cost based on token usage', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        maxTokens: 100,
      };

      const response = await provider.complete(request);

      expect(response.usage.costUsd).toBeGreaterThan(0);
    });

    it('should respect maxTokens limit', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        maxTokens: 50,
      };

      const response = await provider.complete(request);

      expect(response.usage.outputTokens).toBeLessThanOrEqual(50);
    });
  });
});

describe('LLMClient (with Budget Integration)', () => {
  let client: LLMClient;
  let mockProvider: MockLLMProvider;
  const userId = 'user_123';

  const budgetConfig: BudgetConfig = {
    monthlyBudgetUsd: 10,
    throttling: {
      warnAt: 50,
      downgradeAt: 80,
      deferAt: 95,
      blockAt: 100,
    },
  };

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    client = new LLMClient({
      provider: mockProvider,
      budgetConfig,
    });
  });

  describe('Basic Completion', () => {
    it('should complete requests through provider', async () => {
      const response = await client.complete(userId, {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        operation: 'test',
      });

      expect(response.content).toBeDefined();
      expect(response.model).toBe('gpt-4o-mini');
    });

    it('should track usage after completion', async () => {
      await client.complete(userId, {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        operation: 'test',
      });

      const usage = await client.getUsage(userId);
      expect(usage.totalCostUsd).toBeGreaterThan(0);
    });
  });

  describe('Budget Enforcement', () => {
    it('should block requests when budget exceeded', async () => {
      // Exhaust budget by setting high usage
      await client.setUsageForTesting(userId, 11.0); // Over $10 budget

      await expect(
        client.complete(userId, {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o-mini',
          operation: 'test',
        })
      ).rejects.toThrow('Budget exceeded');
    });

    it('should allow urgent requests even at 95%+', async () => {
      await client.setUsageForTesting(userId, 9.6); // 96%

      const response = await client.complete(userId, {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        operation: 'test',
        urgent: true,
      });

      expect(response.content).toBeDefined();
    });

    it('should defer non-urgent at 95%+', async () => {
      await client.setUsageForTesting(userId, 9.6); // 96%

      await expect(
        client.complete(userId, {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o-mini',
          operation: 'test',
          urgent: false,
        })
      ).rejects.toThrow('Request deferred');
    });

    it('should downgrade model at 80%+', async () => {
      await client.setUsageForTesting(userId, 8.5); // 85%

      const response = await client.complete(userId, {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o', // Request quality tier
        modelTier: 'quality',
        operation: 'test',
      });

      // Should be downgraded to cheaper model
      expect(response.model).toBe('gpt-4o-mini');
      expect(response.throttled).toBe(true);
    });
  });

  describe('Model Tier Selection', () => {
    it('should select model based on tier', async () => {
      const response = await client.complete(userId, {
        messages: [{ role: 'user', content: 'Hello' }],
        modelTier: 'fast',
        operation: 'iab_classification',
      });

      expect(response.model).toBe('gpt-4o-mini');
    });

    it('should use specified model when provided', async () => {
      const response = await client.complete(userId, {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-haiku-20240307',
        operation: 'test',
      });

      expect(response.model).toBe('claude-3-haiku-20240307');
    });
  });

  describe('Operation Limits', () => {
    it('should enforce operation-specific limits', async () => {
      // Try to exceed max tokens for operation
      const response = await client.complete(userId, {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        operation: 'iab_classification',
        maxTokens: 10000, // Over limit
      });

      // Should be capped to operation limit (500 for iab_classification)
      expect(response.usage.outputTokens).toBeLessThanOrEqual(500);
    });
  });
});
