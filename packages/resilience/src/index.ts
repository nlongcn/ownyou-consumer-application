/**
 * @ownyou/resilience - v13 Section 6.11
 *
 * Production-grade resilience patterns for OwnYou.
 *
 * - Circuit breakers for external APIs
 * - 7-level LLM fallback chain
 * - Partial data handling policies
 * - User-facing error states
 *
 * @example
 * ```typescript
 * import {
 *   circuitBreakers,
 *   llmInferenceWithFallback,
 *   handlePartialData,
 *   getErrorState,
 * } from '@ownyou/resilience';
 *
 * // Execute with circuit breaker protection
 * const result = await circuitBreakers.execute('serpapi', async () => {
 *   return await fetch('https://serpapi.com/search');
 * });
 *
 * // LLM with fallback chain
 * const llmResult = await llmInferenceWithFallback(request, config);
 *
 * // Handle partial data
 * const dataResult = handlePartialData('email', 45, 100);
 *
 * // Get error state for UI
 * const errorState = getErrorState('llm_rate_limited');
 * ```
 */

// Types
export type {
  ApiConfig,
  FallbackLevel,
  FallbackResult,
  ErrorStateType,
  UserErrorState,
  PartialDataResult,
  PartialDataPolicy,
} from './types';

// Circuit Breaker
export {
  CircuitBreakerRegistry,
  circuitBreakers,
  API_CONFIGS,
} from './circuit-breaker';

// Fallback Chain
export {
  llmInferenceWithFallback,
  gracefulDegradation,
  getDowngradedModel,
  DEFAULT_FALLBACK_CONFIG,
  type FallbackChainConfig,
} from './fallback';

// Partial Data
export {
  PARTIAL_DATA_POLICIES,
  getPolicy,
  handlePartialData,
  isStale,
  adjustConfidence,
} from './partial-data';

// Error Recovery
export {
  ERROR_STATES,
  getErrorState,
  createErrorState,
  mapErrorToStateCode,
  isRetryable,
  requiresAction,
  getErrorCodesByType,
} from './error-recovery';
