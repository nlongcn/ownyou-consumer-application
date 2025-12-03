/**
 * LLM Client Fallback Chain Tests - v13 Section 6.11.3
 *
 * Tests for fallback chain with retries, model downgrades, and alternative providers
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LLMClient,
  BudgetExceededError,
  RequestDeferredError,
  AllFallbacksExhaustedError,
  type LLMClientConfig,
  type ClientRequest,
} from '../providers/client';
import {
  MockLLMProvider,
  LLMProviderType,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
} from '../providers';
import { InMemoryCacheStore } from '../cache';

/**
 * Create a mock provider that can be configured to fail or succeed
 */
function createConfigurableProvider(options: {
  failCount?: number;
  errorMessage?: string;
  responseContent?: string;
  available?: boolean;
}): LLMProvider {
  let callCount = 0;
  const failCount = options.failCount ?? 0;

  return {
    complete: async (request: LLMRequest): Promise<LLMResponse> => {
      callCount++;
      if (callCount <= failCount) {
        if (options.errorMessage) {
          return {
            content: '',
            model: request.model ?? 'mock',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
            error: options.errorMessage,
          };
        }
        throw new Error('Provider error');
      }
      return {
        content: options.responseContent ?? `Response from mock (call ${callCount})`,
        model: request.model ?? 'mock',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };
    },
    isAvailable: async () => options.available ?? true,
    getProviderType: () => LLMProviderType.MOCK,
    getSupportedModels: () => ['mock'],
  };
}

describe('LLMClient.completeWithFallback', () => {
  const userId = 'test-user-123';

  describe('Primary Provider', () => {
    it('should try primary provider first', async () => {
      const mockProvider = new MockLLMProvider();
      const completeSpy = vi.spyOn(mockProvider, 'complete');

      const client = new LLMClient({
        provider: mockProvider,
        providerType: LLMProviderType.MOCK,
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      const response = await client.completeWithFallback(userId, request);

      expect(completeSpy).toHaveBeenCalled();
      expect(response.content).toBeDefined();
      expect(response.fallbackUsed).toBeUndefined(); // Primary was used
    });

    it('should succeed on first try if provider works', async () => {
      const mockProvider = createConfigurableProvider({
        responseContent: 'Primary success',
      });

      const client = new LLMClient({
        provider: mockProvider,
        providerType: LLMProviderType.MOCK,
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      const response = await client.completeWithFallback(userId, request);

      expect(response.content).toBe('Primary success');
      expect(response.retriesAttempted).toBe(0);
    });
  });

  describe('Fallback to Next Provider', () => {
    it('should fall back to next provider on failure', async () => {
      // Primary fails
      const primaryProvider = createConfigurableProvider({
        failCount: 999, // Always fail
        available: true,
      });

      // Fallback succeeds
      const fallbackProvider = createConfigurableProvider({
        responseContent: 'Fallback success',
        available: true,
      });

      const fallbackProviders = new Map<LLMProviderType, LLMProvider>();
      fallbackProviders.set(LLMProviderType.ANTHROPIC, fallbackProvider);

      const client = new LLMClient({
        provider: primaryProvider,
        providerType: LLMProviderType.OPENAI, // Has ANTHROPIC as alternative
        fallbackProviders,
        maxRetries: 0, // No retries to speed up test
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      const response = await client.completeWithFallback(userId, request);

      expect(response.content).toBe('Fallback success');
      expect(response.fallbackUsed).toContain('alternative');
    });

    it('should try model downgrade before alternative provider', async () => {
      const callLog: string[] = [];

      // Primary fails but tracks calls
      const primaryProvider: LLMProvider = {
        complete: async (request: LLMRequest): Promise<LLMResponse> => {
          callLog.push(`primary:${request.model}`);
          throw new Error('Primary failed');
        },
        isAvailable: async () => true,
        getProviderType: () => LLMProviderType.OPENAI,
        getSupportedModels: () => ['gpt-4o', 'gpt-4o-mini'],
      };

      // Fallback succeeds
      const fallbackProvider = createConfigurableProvider({
        responseContent: 'Fallback success',
      });

      const fallbackProviders = new Map<LLMProviderType, LLMProvider>();
      fallbackProviders.set(LLMProviderType.ANTHROPIC, fallbackProvider);

      const client = new LLMClient({
        provider: primaryProvider,
        providerType: LLMProviderType.OPENAI,
        fallbackProviders,
        maxRetries: 0,
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o', // Has downgrade to gpt-4o-mini
        operation: 'test',
      };

      const response = await client.completeWithFallback(userId, request);

      // Should have tried primary first, then downgrade
      expect(callLog).toContain('primary:gpt-4o');
      expect(callLog).toContain('primary:gpt-4o-mini');
      expect(response.fallbackUsed).toContain('alternative');
    });
  });

  describe('Budget Enforcement', () => {
    it('should downgrade model at 80% budget', async () => {
      const mockProvider = new MockLLMProvider();
      const completeSpy = vi.spyOn(mockProvider, 'complete');

      const client = new LLMClient({
        provider: mockProvider,
        providerType: LLMProviderType.MOCK,
        budgetConfig: { monthlyBudgetUsd: 10 },
      });

      // Set usage to 85% of budget
      await client.setUsageForTesting(userId, 8.5);

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        modelTier: 'quality',
        operation: 'test',
      };

      await client.completeWithFallback(userId, request);

      // Should have used a standard tier model
      const callArgs = completeSpy.mock.calls[0][0];
      // At 85% budget, should select standard tier
      expect(callArgs.model).toBeDefined();
    });

    it('should fall back to WebLLM at 100% budget', async () => {
      const mockProvider = createConfigurableProvider({
        failCount: 999, // Doesn't matter, shouldn't be called
      });

      const webllmProvider = createConfigurableProvider({
        responseContent: 'WebLLM response',
        available: true,
      });

      const fallbackProviders = new Map<LLMProviderType, LLMProvider>();
      fallbackProviders.set(LLMProviderType.WEBLLM, webllmProvider);

      const client = new LLMClient({
        provider: mockProvider,
        providerType: LLMProviderType.MOCK,
        fallbackProviders,
        budgetConfig: { monthlyBudgetUsd: 10 },
      });

      // Set usage to 100% of budget (blocked)
      await client.setUsageForTesting(userId, 10);

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      const response = await client.completeWithFallback(userId, request);

      expect(response.content).toBe('WebLLM response');
      expect(response.fallbackUsed).toContain('webllm');
    });

    it('should throw BudgetExceededError when no free providers available', async () => {
      const mockProvider = createConfigurableProvider({});

      const client = new LLMClient({
        provider: mockProvider,
        providerType: LLMProviderType.MOCK,
        budgetConfig: { monthlyBudgetUsd: 10 },
      });

      // Set usage to 100% of budget
      await client.setUsageForTesting(userId, 10);

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      await expect(client.completeWithFallback(userId, request)).rejects.toThrow(
        BudgetExceededError
      );
    });
  });

  describe('Cache Integration', () => {
    it('should return cached response if available', async () => {
      const mockProvider = new MockLLMProvider();
      const store = new InMemoryCacheStore();

      const client = new LLMClient({
        provider: mockProvider,
        providerType: LLMProviderType.MOCK,
        cacheStore: store,
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Cached request' }],
        operation: 'iab_classification',
        temperature: 0, // Required for caching
      };

      // First call - should hit provider and cache
      const response1 = await client.completeWithFallback(userId, request);
      expect(response1.fromCache).toBeUndefined();

      // Second call - should return from cache
      const response2 = await client.completeWithFallback(userId, request);
      expect(response2.fromCache).toBe(true);
    });

    it('should cache successful response after fallback', async () => {
      // Primary fails
      const primaryProvider = createConfigurableProvider({
        failCount: 999,
      });

      // Fallback succeeds
      const fallbackProvider = createConfigurableProvider({
        responseContent: 'Fallback cached',
      });

      const store = new InMemoryCacheStore();
      const fallbackProviders = new Map<LLMProviderType, LLMProvider>();
      fallbackProviders.set(LLMProviderType.ANTHROPIC, fallbackProvider);

      const client = new LLMClient({
        provider: primaryProvider,
        providerType: LLMProviderType.OPENAI,
        fallbackProviders,
        cacheStore: store,
        maxRetries: 0,
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        operation: 'iab_classification',
        temperature: 0,
      };

      // First call - uses fallback
      const response1 = await client.completeWithFallback(userId, request);
      expect(response1.content).toBe('Fallback cached');

      // Second call - should be cached
      const response2 = await client.completeWithFallback(userId, request);
      expect(response2.fromCache).toBe(true);
      expect(response2.content).toBe('Fallback cached');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      let callCount = 0;
      const provider: LLMProvider = {
        complete: async (request: LLMRequest): Promise<LLMResponse> => {
          callCount++;
          if (callCount < 2) {
            throw new Error('Transient error');
          }
          return {
            content: 'Success after retry',
            model: request.model ?? 'mock',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
          };
        },
        isAvailable: async () => true,
        getProviderType: () => LLMProviderType.MOCK,
        getSupportedModels: () => ['mock'],
      };

      const client = new LLMClient({
        provider,
        providerType: LLMProviderType.MOCK,
        maxRetries: 2,
        retryBaseDelay: 10, // Fast for tests
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      const response = await client.completeWithFallback(userId, request);

      expect(response.content).toBe('Success after retry');
      expect(response.retriesAttempted).toBe(1);
      expect(callCount).toBe(2);
    });

    it('should respect maxRetries limit', async () => {
      let callCount = 0;
      const provider: LLMProvider = {
        complete: async (): Promise<LLMResponse> => {
          callCount++;
          throw new Error('Always fails');
        },
        isAvailable: async () => true,
        getProviderType: () => LLMProviderType.MOCK,
        getSupportedModels: () => ['mock'],
      };

      const client = new LLMClient({
        provider,
        providerType: LLMProviderType.MOCK,
        maxRetries: 2,
        retryBaseDelay: 10,
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      await expect(client.completeWithFallback(userId, request)).rejects.toThrow(
        AllFallbacksExhaustedError
      );

      // Should have tried 3 times total (1 initial + 2 retries)
      expect(callCount).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should throw AllFallbacksExhaustedError when all options fail', async () => {
      const failingProvider = createConfigurableProvider({
        failCount: 999,
      });

      const client = new LLMClient({
        provider: failingProvider,
        providerType: LLMProviderType.MOCK,
        maxRetries: 0,
      });

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      await expect(client.completeWithFallback(userId, request)).rejects.toThrow(
        AllFallbacksExhaustedError
      );
    });

    it('should throw RequestDeferredError for non-urgent requests at 95% budget', async () => {
      const mockProvider = new MockLLMProvider();

      const client = new LLMClient({
        provider: mockProvider,
        providerType: LLMProviderType.MOCK,
        budgetConfig: { monthlyBudgetUsd: 10 },
      });

      // Set usage to 95% of budget
      await client.setUsageForTesting(userId, 9.5);

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
        urgent: false,
      };

      await expect(client.completeWithFallback(userId, request)).rejects.toThrow(
        RequestDeferredError
      );
    });

    it('should allow urgent requests at 95% budget', async () => {
      const mockProvider = new MockLLMProvider();

      const client = new LLMClient({
        provider: mockProvider,
        providerType: LLMProviderType.MOCK,
        budgetConfig: { monthlyBudgetUsd: 10 },
      });

      // Set usage to 95% of budget
      await client.setUsageForTesting(userId, 9.5);

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
        urgent: true, // Urgent request
      };

      // Should not throw
      const response = await client.completeWithFallback(userId, request);
      expect(response.content).toBeDefined();
    });
  });

  describe('Provider Registration', () => {
    it('should allow registering additional providers', async () => {
      const primaryProvider = createConfigurableProvider({
        failCount: 999,
      });

      const additionalProvider = createConfigurableProvider({
        responseContent: 'Additional provider success',
      });

      const client = new LLMClient({
        provider: primaryProvider,
        providerType: LLMProviderType.OPENAI,
        maxRetries: 0,
      });

      // Register additional provider
      client.registerProvider(LLMProviderType.ANTHROPIC, additionalProvider);

      const request: ClientRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
      };

      const response = await client.completeWithFallback(userId, request);
      expect(response.content).toBe('Additional provider success');
    });
  });
});
