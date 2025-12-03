/**
 * @ownyou/llm-client - v13 Section 6.10-6.11
 *
 * LLM client with budget management and circuit breaker.
 *
 * @example
 * ```typescript
 * import { LLMClient, MockLLMProvider } from '@ownyou/llm-client';
 *
 * const client = new LLMClient({
 *   provider: new MockLLMProvider(),
 *   budgetConfig: { monthlyBudgetUsd: 10 },
 * });
 *
 * const response = await client.complete(userId, {
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   operation: 'mission_agent',
 * });
 * ```
 */

// Providers
export {
  LLMClient,
  MockLLMProvider,
  type LLMProvider,
  type LLMRequest,
  type LLMResponse,
  type ChatMessage,
  type TokenUsage,
  type ModelTier,
  type OperationType,
  MODEL_PRICING,
  MODEL_TIERS,
  OPERATION_LIMITS,
  calculateCost,
} from './providers';

// Budget
export {
  BudgetManager,
  type BudgetConfig,
  type UsageRecord,
  type UsageSummary,
  type ThrottleDecision,
  type ThrottleAction,
  DEFAULT_BUDGET_CONFIG,
  CircuitBreaker,
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './budget';

// Cache (v13 Section 6.11.3 - Fallback Chain Step 5)
export {
  LLMCache,
  InMemoryCacheStore,
  generateCacheKey,
  TTL_BY_OPERATION,
  DEFAULT_CACHE_CONFIG,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
  type CacheStore,
} from './cache';
