/**
 * ResilienceContext - Provides circuit breakers and LLM fallback
 *
 * Sprint 11a: Wires @ownyou/resilience to consumer app
 * v13 Section 6.11 - Production-grade resilience patterns
 *
 * ACTUAL EXPORTS from @ownyou/resilience (verified from source):
 * - circuitBreakers (CircuitBreakerRegistry singleton)
 * - llmInferenceWithFallback(request: LLMRequest, config: FallbackChainConfig)
 * - getErrorState(errorCode) -> UserErrorState | undefined
 * - handlePartialData(sourceType, received, expected) -> PartialDataResult
 *
 * CircuitBreakerStats from @ownyou/llm-client:
 * { totalRequests, successCount, failureCount, state, lastFailureTime?, lastSuccessTime? }
 */

import { createContext, useContext, useCallback, type ReactNode } from 'react';
import {
  circuitBreakers,
  llmInferenceWithFallback,
  getErrorState,
  handlePartialData,
  type FallbackChainConfig,
  type FallbackResult,
  type UserErrorState,
  type PartialDataResult,
} from '@ownyou/resilience';

/**
 * Circuit breaker stats type
 * Matches CircuitBreakerStats from @ownyou/llm-client
 */
interface CircuitBreakerStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  state: 'closed' | 'open' | 'half-open';
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

/**
 * LLM request type
 * Minimal interface for LLM inference requests
 */
interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ResilienceContextValue {
  /**
   * Execute API call with circuit breaker protection
   * Uses the global circuitBreakers singleton
   */
  executeWithBreaker: <T>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ) => Promise<T>;

  /**
   * Execute with retry and circuit breaker
   * Retries up to 3 times before opening circuit
   */
  executeWithRetry: <T>(
    apiName: string,
    operation: () => Promise<T>,
    maxRetries?: number,
    fallback?: () => T | Promise<T>
  ) => Promise<T>;

  /**
   * Get circuit breaker stats for all APIs
   * Useful for debugging and monitoring
   */
  getStats: () => Record<string, CircuitBreakerStats>;

  /**
   * Check if an API circuit is open (failing)
   */
  isCircuitOpen: (apiName: string) => boolean;

  /**
   * LLM inference with 7-level fallback chain
   * config = { provider, cache?, userId?, alternativeProvider?, localProvider?, maxRetries, timeoutMs }
   */
  llmWithFallback: (
    request: LLMRequest,
    config: FallbackChainConfig
  ) => Promise<FallbackResult>;

  /**
   * Get user-friendly error state for display
   * Returns undefined if error code not found
   */
  getErrorForUser: (errorCode: string) => UserErrorState | undefined;

  /**
   * Handle partial data from external sources
   * Returns policy decision based on data completeness
   */
  handlePartial: (sourceType: string, received: number, expected: number) => PartialDataResult;
}

const ResilienceContext = createContext<ResilienceContextValue | null>(null);

interface ResilienceProviderProps {
  children: ReactNode;
}

export function ResilienceProvider({ children }: ResilienceProviderProps) {
  /**
   * Execute with circuit breaker protection
   * If circuit is open, executes fallback immediately
   */
  const executeWithBreaker = useCallback(async <T,>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> => {
    return circuitBreakers.execute(apiName, operation, fallback);
  }, []);

  /**
   * Execute with retry logic before failing to circuit breaker
   */
  const executeWithRetry = useCallback(async <T,>(
    apiName: string,
    operation: () => Promise<T>,
    maxRetries = 3,
    fallback?: () => T | Promise<T>
  ): Promise<T> => {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await circuitBreakers.execute(apiName, operation, undefined);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If circuit is open, don't retry
        if (circuitBreakers.isOpen(apiName)) {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }

    // All retries failed, try fallback
    if (fallback) {
      return await fallback();
    }

    throw lastError ?? new Error(`${apiName} failed after ${maxRetries} retries`);
  }, []);

  /**
   * Get stats for all registered circuit breakers
   */
  const getStats = useCallback((): Record<string, CircuitBreakerStats> => {
    return circuitBreakers.getAllStats() as Record<string, CircuitBreakerStats>;
  }, []);

  /**
   * Check if a specific API's circuit breaker is open
   */
  const isCircuitOpen = useCallback((apiName: string): boolean => {
    return circuitBreakers.isOpen(apiName);
  }, []);

  /**
   * LLM inference with 7-level fallback chain
   */
  const llmWithFallback = useCallback(async (
    request: LLMRequest,
    config: FallbackChainConfig
  ): Promise<FallbackResult> => {
    return llmInferenceWithFallback(request as unknown as Parameters<typeof llmInferenceWithFallback>[0], config);
  }, []);

  /**
   * Get user-friendly error state for UI display
   * Actual API returns UserErrorState | undefined
   */
  const getErrorForUser = useCallback((errorCode: string): UserErrorState | undefined => {
    return getErrorState(errorCode);
  }, []);

  /**
   * Handle partial data from external sources
   * Applies policy based on source type (email, calendar, financial)
   */
  const handlePartial = useCallback((
    sourceType: string,
    received: number,
    expected: number
  ): PartialDataResult => {
    return handlePartialData(sourceType, received, expected);
  }, []);

  const value: ResilienceContextValue = {
    executeWithBreaker,
    executeWithRetry,
    getStats,
    isCircuitOpen,
    llmWithFallback,
    getErrorForUser,
    handlePartial,
  };

  return (
    <ResilienceContext.Provider value={value}>
      {children}
    </ResilienceContext.Provider>
  );
}

export function useResilience() {
  const context = useContext(ResilienceContext);
  if (!context) {
    throw new Error('useResilience must be used within a ResilienceProvider');
  }
  return context;
}

/**
 * Hook for circuit breaker stats monitoring
 * Useful for debug panels and observability
 */
export function useCircuitBreakerStats() {
  const { getStats, isCircuitOpen } = useResilience();

  return {
    stats: getStats(),
    isOpen: isCircuitOpen,
  };
}
