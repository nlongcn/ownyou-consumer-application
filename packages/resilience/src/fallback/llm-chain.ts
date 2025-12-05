/**
 * LLM Fallback Chain - v13 Section 6.11.3
 *
 * Implements 7-level fallback chain for LLM resilience:
 * 1. Original request
 * 2. Retry same model (transient failure)
 * 3. Downgrade to cheaper model
 * 4. Try alternative provider
 * 5. Check cache for similar query
 * 6. Use local LLM (WebLLM)
 * 7. Graceful degradation
 */

import type { LLMRequest, LLMResponse, LLMProvider, LLMCache } from '@ownyou/llm-client';
import type { FallbackLevel, FallbackResult } from '../types';

/**
 * Configuration for the fallback chain
 */
export interface FallbackChainConfig {
  /** Primary LLM provider */
  provider: LLMProvider;
  /** Response cache */
  cache?: LLMCache;
  /** User ID for cache lookups */
  userId?: string;
  /** Alternative LLM provider (different from primary) */
  alternativeProvider?: LLMProvider;
  /** Local LLM provider (WebLLM) */
  localProvider?: LLMProvider;
  /** Maximum retry attempts for same model */
  maxRetries: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Base delay in milliseconds for exponential backoff (defaults to 1000) */
  baseRetryDelayMs?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_FALLBACK_CONFIG: Partial<FallbackChainConfig> = {
  maxRetries: 3,
  timeoutMs: 30000,
  baseRetryDelayMs: 1000,
};

/**
 * Context summary constants for graceful degradation
 *
 * When LLM fallback exhausts all options, we show a summary of the user's
 * context. These control the minimum content length to bother summarizing,
 * and the maximum summary length to display.
 */
const MIN_CONTEXT_LENGTH_FOR_SUMMARY = 50;
const MAX_CONTEXT_SUMMARY_LENGTH = 200;

/**
 * Alternative provider mapping (v13 Section 6.11.3)
 *
 * When the primary provider fails, automatically select an alternative.
 * This enables automatic provider switching in the fallback chain.
 */
export const ALTERNATIVE_PROVIDERS: Record<string, string> = {
  openai: 'anthropic',
  anthropic: 'openai',
  google: 'groq',
  groq: 'deepinfra',
  deepinfra: 'groq',
};

/**
 * Get the alternative provider for a given provider name
 *
 * @param providerName - Name of the current provider (e.g., 'openai')
 * @returns Alternative provider name, or undefined if none configured
 *
 * @example
 * ```typescript
 * const alt = getAlternativeProvider('openai');
 * // alt === 'anthropic'
 * ```
 */
export function getAlternativeProvider(providerName: string): string | undefined {
  return ALTERNATIVE_PROVIDERS[providerName.toLowerCase()];
}

/**
 * Model downgrade mapping
 */
const MODEL_DOWNGRADES: Record<string, string> = {
  'gpt-4o': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4o-mini',
  'gpt-4': 'gpt-3.5-turbo',
  'claude-3-opus': 'claude-3-haiku',
  'claude-3-sonnet': 'claude-3-haiku',
  'claude-3-5-sonnet': 'claude-3-haiku',
  'gemini-1.5-pro': 'gemini-1.5-flash',
  'gemini-pro': 'gemini-flash',
};

/**
 * Get downgraded model for a given model
 */
export function getDowngradedModel(model: string): string | undefined {
  // Direct lookup
  if (MODEL_DOWNGRADES[model]) {
    return MODEL_DOWNGRADES[model];
  }

  // Partial match (e.g., gpt-4o-2024-05-13 -> gpt-4o-mini)
  for (const [pattern, downgrade] of Object.entries(MODEL_DOWNGRADES)) {
    if (model.startsWith(pattern)) {
      return downgrade;
    }
  }

  return undefined;
}

/**
 * Utility to add timeout to a promise
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]);
}

/**
 * Delay utility for exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log fallback attempt
 */
function logFallbackAttempt(level: FallbackLevel, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[LLM Fallback] ${level} failed: ${message}`);
}

/**
 * Execute LLM request with 7-level fallback chain
 *
 * @param request - The LLM request
 * @param config - Fallback chain configuration
 * @returns Fallback result with response and metadata
 *
 * @example
 * ```typescript
 * const result = await llmInferenceWithFallback(
 *   { messages: [{ role: 'user', content: 'Hello' }] },
 *   { provider: myProvider, maxRetries: 3, timeoutMs: 30000 }
 * );
 *
 * if (result.level === 'degraded') {
 *   console.log('Using degraded response');
 * }
 * ```
 */
export async function llmInferenceWithFallback(
  request: LLMRequest,
  config: FallbackChainConfig
): Promise<FallbackResult> {
  const { provider, cache, userId, alternativeProvider, localProvider, maxRetries, timeoutMs, baseRetryDelayMs } = {
    ...DEFAULT_FALLBACK_CONFIG,
    ...config,
  };
  let attempts = 0;

  // Level 1: Original request
  attempts++;
  try {
    const response = await withTimeout(provider.complete(request), timeoutMs);
    if (!response.error) {
      return { response, level: 'original', attempts };
    }
    logFallbackAttempt('original', new Error(response.error));
  } catch (error) {
    logFallbackAttempt('original', error);
  }

  // Level 2: Retry same model (transient failure)
  for (let i = 0; i < maxRetries - 1; i++) {
    attempts++;
    try {
      const baseDelay = baseRetryDelayMs ?? 1000;
      await delay(baseDelay * Math.pow(2, i)); // Exponential backoff
      const response = await withTimeout(provider.complete(request), timeoutMs);
      if (!response.error) {
        return { response, level: 'retry', attempts };
      }
      logFallbackAttempt('retry', new Error(response.error));
    } catch (error) {
      logFallbackAttempt('retry', error);
    }
  }

  // Level 3: Downgrade to cheaper model
  const downgradedModel = request.model ? getDowngradedModel(request.model) : undefined;
  if (downgradedModel) {
    attempts++;
    try {
      const response = await withTimeout(
        provider.complete({ ...request, model: downgradedModel }),
        timeoutMs
      );
      if (!response.error) {
        return { response, level: 'downgrade', attempts };
      }
      logFallbackAttempt('downgrade', new Error(response.error));
    } catch (error) {
      logFallbackAttempt('downgrade', error);
    }
  }

  // Level 4: Try alternative provider
  if (alternativeProvider) {
    attempts++;
    try {
      const isAvailable = await alternativeProvider.isAvailable();
      if (isAvailable) {
        const response = await withTimeout(
          alternativeProvider.complete(request),
          timeoutMs
        );
        if (!response.error) {
          return { response, level: 'alternative', attempts };
        }
        logFallbackAttempt('alternative', new Error(response.error));
      }
    } catch (error) {
      logFallbackAttempt('alternative', error);
    }
  }

  // Level 5: Check cache for similar query
  if (cache && userId) {
    attempts++;
    try {
      const cachedResponse = await cache.get(userId, request);
      if (cachedResponse) {
        return {
          response: { ...cachedResponse, throttled: true },
          level: 'cache',
          attempts,
        };
      }
    } catch (error) {
      logFallbackAttempt('cache', error);
    }
  }

  // Level 6: Use local LLM (WebLLM)
  if (localProvider) {
    attempts++;
    try {
      const isAvailable = await localProvider.isAvailable();
      if (isAvailable) {
        const response = await localProvider.complete(request);
        if (!response.error) {
          return { response, level: 'local', attempts };
        }
        logFallbackAttempt('local', new Error(response.error));
      }
    } catch (error) {
      logFallbackAttempt('local', error);
    }
  }

  // Level 7: Graceful degradation
  attempts++;
  return {
    response: gracefulDegradation(request),
    level: 'degraded',
    attempts,
  };
}

/**
 * Generate graceful degradation response
 *
 * Per v13 6.11.3: Uses memory context to provide partial response
 * when all LLM fallbacks fail.
 */
export function gracefulDegradation(request: LLMRequest): LLMResponse {
  // Extract any context from the request messages
  const contextSummary = extractContextSummary(request);

  const content = contextSummary
    ? `I'm having trouble processing this right now. ` +
      `Here's what I can tell you from your saved data:\n\n${contextSummary}`
    : `I'm having trouble processing this right now. ` +
      `Please try again in a few minutes.`;

  return {
    content,
    model: 'degraded',
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    },
    error: 'All fallback levels exhausted',
    finishReason: 'stop',
  };
}

/**
 * Extract summary from request context/messages
 */
function extractContextSummary(request: LLMRequest): string | undefined {
  // Look for context in system message
  const systemMessage = request.messages.find(m => m.role === 'system');
  if (systemMessage && systemMessage.content.length > MIN_CONTEXT_LENGTH_FOR_SUMMARY) {
    return systemMessage.content.slice(0, MAX_CONTEXT_SUMMARY_LENGTH) + '...';
  }

  // Look for context in user messages
  const userMessages = request.messages.filter(m => m.role === 'user');
  if (userMessages.length > 0) {
    const combined = userMessages.map(m => m.content).join(' ');
    if (combined.length > MIN_CONTEXT_LENGTH_FOR_SUMMARY) {
      return combined.slice(0, MAX_CONTEXT_SUMMARY_LENGTH) + '...';
    }
  }

  return undefined;
}
