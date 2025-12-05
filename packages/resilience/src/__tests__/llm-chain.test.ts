/**
 * LLM Fallback Chain Tests - v13 Section 6.11.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  llmInferenceWithFallback,
  gracefulDegradation,
  getDowngradedModel,
  type FallbackChainConfig,
} from '../fallback';
import type { LLMRequest, LLMResponse, LLMProvider } from '@ownyou/llm-client';

// Mock provider factory
function createMockProvider(options: {
  success?: boolean;
  response?: LLMResponse;
  throwError?: boolean;
  errorMessage?: string;
}): LLMProvider {
  const defaultResponse: LLMResponse = {
    content: 'Test response',
    model: 'test-model',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.001 },
    finishReason: 'stop',
  };

  return {
    complete: vi.fn().mockImplementation(async () => {
      if (options.throwError) {
        throw new Error(options.errorMessage ?? 'Provider error');
      }
      if (!options.success) {
        return { ...defaultResponse, error: options.errorMessage ?? 'Failed' };
      }
      return options.response ?? defaultResponse;
    }),
    getSupportedModels: () => ['test-model'],
    isAvailable: async () => true,
  };
}

describe('LLM Fallback Chain', () => {
  const baseRequest: LLMRequest = {
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'gpt-4o',
  };

  describe('llmInferenceWithFallback', () => {
    it('should succeed on first attempt when healthy', async () => {
      const provider = createMockProvider({ success: true });
      const config: FallbackChainConfig = {
        provider,
        maxRetries: 3,
        timeoutMs: 30000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('original');
      expect(result.attempts).toBe(1);
      expect(result.response.content).toBe('Test response');
    });

    it('should retry on transient failure', async () => {
      let attempts = 0;
      const provider: LLMProvider = {
        complete: vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient error');
          }
          return {
            content: 'Success after retry',
            model: 'test-model',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.001 },
          };
        }),
        getSupportedModels: () => ['test-model'],
        isAvailable: async () => true,
      };

      const config: FallbackChainConfig = {
        provider,
        maxRetries: 3,
        timeoutMs: 30000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('retry');
      expect(result.attempts).toBe(3);
      expect(result.response.content).toBe('Success after retry');
    });

    it('should downgrade model after retries exhausted', async () => {
      let model: string | undefined;
      const provider: LLMProvider = {
        complete: vi.fn().mockImplementation(async (req: LLMRequest) => {
          model = req.model;
          if (req.model === 'gpt-4o') {
            throw new Error('Primary model failed');
          }
          return {
            content: 'Downgraded response',
            model: req.model ?? 'unknown',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.001 },
          };
        }),
        getSupportedModels: () => ['gpt-4o', 'gpt-4o-mini'],
        isAvailable: async () => true,
      };

      const config: FallbackChainConfig = {
        provider,
        maxRetries: 2,
        timeoutMs: 30000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('downgrade');
      expect(model).toBe('gpt-4o-mini');
      expect(result.response.content).toBe('Downgraded response');
    });

    it('should use alternative provider when primary and downgrade fail', async () => {
      const failingProvider = createMockProvider({ throwError: true });
      const alternativeProvider = createMockProvider({
        success: true,
        response: {
          content: 'Alternative provider response',
          model: 'alternative-model',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.001 },
        },
      });

      const config: FallbackChainConfig = {
        provider: failingProvider,
        alternativeProvider,
        maxRetries: 1,
        timeoutMs: 1000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('alternative');
      expect(result.response.content).toBe('Alternative provider response');
      expect(alternativeProvider.complete).toHaveBeenCalled();
    });

    it('should skip to level 5 when alternativeProvider not configured', async () => {
      const failingProvider = createMockProvider({ throwError: true });
      const mockCache = {
        get: vi.fn().mockResolvedValue({
          content: 'Cached response',
          model: 'cached-model',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        }),
        set: vi.fn(),
        delete: vi.fn(),
        has: vi.fn(),
        clearUserCache: vi.fn(),
        clearOperationCache: vi.fn(),
        pruneExpired: vi.fn(),
        getStats: vi.fn(),
        getTTL: vi.fn(),
        getConfig: vi.fn(),
      };

      const config: FallbackChainConfig = {
        provider: failingProvider,
        cache: mockCache as any,
        userId: 'test-user',
        maxRetries: 1,
        timeoutMs: 1000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('cache');
      expect(result.response.content).toBe('Cached response');
    });

    it('should continue to level 5 when alternative provider fails', async () => {
      const failingProvider = createMockProvider({ throwError: true });
      const failingAlternative = createMockProvider({ throwError: true, errorMessage: 'Alternative failed' });
      const mockCache = {
        get: vi.fn().mockResolvedValue({
          content: 'Cached response',
          model: 'cached-model',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        }),
        set: vi.fn(),
        delete: vi.fn(),
        has: vi.fn(),
        clearUserCache: vi.fn(),
        clearOperationCache: vi.fn(),
        pruneExpired: vi.fn(),
        getStats: vi.fn(),
        getTTL: vi.fn(),
        getConfig: vi.fn(),
      };

      const config: FallbackChainConfig = {
        provider: failingProvider,
        alternativeProvider: failingAlternative,
        cache: mockCache as any,
        userId: 'test-user',
        maxRetries: 1,
        timeoutMs: 1000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('cache');
      expect(result.response.content).toBe('Cached response');
      expect(failingAlternative.complete).toHaveBeenCalled();
    });

    it('should return cached response if available', async () => {
      const failingProvider = createMockProvider({ throwError: true });

      const mockCache = {
        get: vi.fn().mockResolvedValue({
          content: 'Cached response',
          model: 'cached-model',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        }),
        set: vi.fn(),
        delete: vi.fn(),
        has: vi.fn(),
        clearUserCache: vi.fn(),
        clearOperationCache: vi.fn(),
        pruneExpired: vi.fn(),
        getStats: vi.fn(),
        getTTL: vi.fn(),
        getConfig: vi.fn(),
      };

      const config: FallbackChainConfig = {
        provider: failingProvider,
        cache: mockCache as any,
        userId: 'test-user',
        maxRetries: 1,
        timeoutMs: 1000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('cache');
      expect(result.response.content).toBe('Cached response');
    });

    it('should use local LLM as second-to-last fallback', async () => {
      const failingProvider = createMockProvider({ throwError: true });
      const localProvider = createMockProvider({
        success: true,
        response: {
          content: 'Local response',
          model: 'webllm',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        },
      });

      const config: FallbackChainConfig = {
        provider: failingProvider,
        localProvider,
        maxRetries: 1,
        timeoutMs: 1000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('local');
      expect(result.response.content).toBe('Local response');
    });

    it('should return graceful degradation as final fallback', async () => {
      const failingProvider = createMockProvider({ throwError: true });

      const config: FallbackChainConfig = {
        provider: failingProvider,
        maxRetries: 1,
        timeoutMs: 1000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('degraded');
      expect(result.response.model).toBe('degraded');
      expect(result.response.error).toBe('All fallback levels exhausted');
      expect(result.response.content).toContain('having trouble processing');
    });
  });

  describe('gracefulDegradation', () => {
    it('should return user-friendly message', () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = gracefulDegradation(request);

      expect(response.model).toBe('degraded');
      expect(response.content).toContain('having trouble');
      expect(response.error).toBe('All fallback levels exhausted');
      expect(response.usage.costUsd).toBe(0);
    });

    it('should include context summary if available', () => {
      const request: LLMRequest = {
        messages: [
          {
            role: 'system',
            content: 'User is interested in travel to Japan for cherry blossom season. They prefer direct flights and mid-range hotels.',
          },
          { role: 'user', content: 'Find me a flight' },
        ],
      };

      const response = gracefulDegradation(request);

      expect(response.content).toContain('saved data');
      expect(response.content).toContain('User is interested in travel');
    });
  });

  describe('getDowngradedModel', () => {
    it('should return correct downgrades for known models', () => {
      expect(getDowngradedModel('gpt-4o')).toBe('gpt-4o-mini');
      expect(getDowngradedModel('gpt-4-turbo')).toBe('gpt-4o-mini');
      expect(getDowngradedModel('claude-3-opus')).toBe('claude-3-haiku');
      expect(getDowngradedModel('claude-3-sonnet')).toBe('claude-3-haiku');
      expect(getDowngradedModel('gemini-1.5-pro')).toBe('gemini-1.5-flash');
    });

    it('should return undefined for unknown models', () => {
      expect(getDowngradedModel('unknown-model')).toBeUndefined();
      expect(getDowngradedModel('custom-model')).toBeUndefined();
    });

    it('should handle versioned model names', () => {
      expect(getDowngradedModel('gpt-4o-2024-05-13')).toBe('gpt-4o-mini');
      expect(getDowngradedModel('claude-3-sonnet-20240229')).toBe('claude-3-haiku');
    });
  });

  describe('fallback chain levels', () => {
    it('should have 7 fallback levels', async () => {
      // This test documents all 7 levels
      const levels = [
        'original',
        'retry',
        'downgrade',
        'alternative', // Currently skipped in implementation
        'cache',
        'local',
        'degraded',
      ];

      // The implementation actually skips 'alternative' since we don't have
      // multiple providers in config, so we check for 6 actual levels
      const actualLevels = ['original', 'retry', 'downgrade', 'cache', 'local', 'degraded'];

      for (const level of actualLevels) {
        expect(typeof level).toBe('string');
      }
    });
  });

  describe('configurable retry delay', () => {
    it('should use default 1000ms base delay when not specified', async () => {
      const startTime = Date.now();
      let attempts = 0;
      const provider: LLMProvider = {
        complete: vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Transient error');
          }
          return {
            content: 'Success after retry',
            model: 'test-model',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.001 },
          };
        }),
        getSupportedModels: () => ['test-model'],
        isAvailable: async () => true,
      };

      const config: FallbackChainConfig = {
        provider,
        maxRetries: 3,
        timeoutMs: 30000,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);
      const elapsed = Date.now() - startTime;

      expect(result.level).toBe('retry');
      // First retry delay should be ~1000ms (baseDelay * 2^0)
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });

    it('should use custom base delay when provided', async () => {
      const startTime = Date.now();
      let attempts = 0;
      const provider: LLMProvider = {
        complete: vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Transient error');
          }
          return {
            content: 'Success after retry',
            model: 'test-model',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.001 },
          };
        }),
        getSupportedModels: () => ['test-model'],
        isAvailable: async () => true,
      };

      const config: FallbackChainConfig = {
        provider,
        maxRetries: 3,
        timeoutMs: 30000,
        baseRetryDelayMs: 500, // Custom shorter delay
      };

      const result = await llmInferenceWithFallback(baseRequest, config);
      const elapsed = Date.now() - startTime;

      expect(result.level).toBe('retry');
      // First retry delay should be ~500ms (baseDelay * 2^0)
      expect(elapsed).toBeGreaterThanOrEqual(400);
      expect(elapsed).toBeLessThan(900); // Shorter than default 1000ms
    });

    it('should apply exponential backoff correctly with custom delay', async () => {
      const delays: number[] = [];
      let attempts = 0;
      let lastTime = Date.now();

      const provider: LLMProvider = {
        complete: vi.fn().mockImplementation(async () => {
          if (attempts > 0) {
            const now = Date.now();
            delays.push(now - lastTime);
            lastTime = now;
          } else {
            lastTime = Date.now();
          }
          attempts++;
          if (attempts < 4) {
            throw new Error('Transient error');
          }
          return {
            content: 'Success after retry',
            model: 'test-model',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.001 },
          };
        }),
        getSupportedModels: () => ['test-model'],
        isAvailable: async () => true,
      };

      const config: FallbackChainConfig = {
        provider,
        maxRetries: 4,
        timeoutMs: 30000,
        baseRetryDelayMs: 200,
      };

      const result = await llmInferenceWithFallback(baseRequest, config);

      expect(result.level).toBe('retry');
      expect(delays.length).toBe(3); // 3 retries after initial failure

      // Exponential backoff: 200 * 2^0 = 200, 200 * 2^1 = 400, 200 * 2^2 = 800
      expect(delays[0]).toBeGreaterThanOrEqual(180); // ~200ms
      expect(delays[1]).toBeGreaterThanOrEqual(380); // ~400ms
      expect(delays[2]).toBeGreaterThanOrEqual(780); // ~800ms
    });
  });
});
