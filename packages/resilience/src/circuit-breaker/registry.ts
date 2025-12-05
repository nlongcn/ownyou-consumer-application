/**
 * Circuit Breaker Registry - v13 Section 6.11.2
 *
 * Global registry for managing circuit breakers across all external APIs.
 */

import { CircuitBreaker, type CircuitBreakerStats } from '@ownyou/llm-client';
import type { ApiConfig } from '../types';
import { API_CONFIGS } from './config';

/**
 * Utility to add timeout to a promise
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]);
}

/**
 * CircuitBreakerRegistry - Global registry for all external API circuit breakers
 *
 * Provides a centralized way to manage circuit breakers for external services,
 * with configurable failure thresholds, timeouts, and fallback handling.
 *
 * @example
 * ```typescript
 * import { circuitBreakers } from '@ownyou/resilience';
 *
 * // Execute with circuit breaker protection
 * const result = await circuitBreakers.execute('serpapi', async () => {
 *   return await fetch('https://serpapi.com/search');
 * }, () => {
 *   // Fallback when circuit is open
 *   return { cached: true, results: [] };
 * });
 * ```
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private configs: Map<string, ApiConfig> = new Map();

  constructor(configs: Record<string, ApiConfig> = API_CONFIGS) {
    for (const [name, config] of Object.entries(configs)) {
      this.register(name, config);
    }
  }

  /**
   * Register a new API with its circuit breaker configuration
   */
  register(name: string, config: ApiConfig): void {
    this.configs.set(name, config);
    this.breakers.set(name, new CircuitBreaker({
      failureThreshold: config.failureThreshold,
      resetTimeoutMs: config.resetTimeoutMs,
      halfOpenRequests: config.halfOpenRequests,
    }));
  }

  /**
   * Unregister an API
   */
  unregister(name: string): boolean {
    this.configs.delete(name);
    return this.breakers.delete(name);
  }

  /**
   * Execute an operation with circuit breaker protection
   *
   * @param apiName - Name of the API (must be registered)
   * @param operation - The async operation to execute
   * @param fallback - Optional fallback function when circuit is open
   * @returns Result from operation or fallback
   */
  async execute<T>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const breaker = this.breakers.get(apiName);
    const config = this.configs.get(apiName);

    if (!breaker || !config) {
      // No breaker configured, execute directly
      return operation();
    }

    try {
      return await breaker.execute(async () => {
        return withTimeout(operation(), config.timeoutMs);
      });
    } catch (error) {
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Execute with automatic retry
   *
   * @param apiName - Name of the API
   * @param operation - The async operation to execute
   * @param fallback - Optional fallback function
   * @returns Result from operation, retry, or fallback
   */
  async executeWithRetry<T>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const config = this.configs.get(apiName);
    const retries = config?.retries ?? 1;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.execute(apiName, operation);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry if circuit is open
        if (lastError.message === 'Circuit breaker is open') {
          break;
        }

        // Exponential backoff for retries
        if (attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    if (fallback) {
      return fallback();
    }

    throw lastError ?? new Error('Operation failed');
  }

  /**
   * Check if an API's circuit is open
   */
  isOpen(apiName: string): boolean {
    const breaker = this.breakers.get(apiName);
    return breaker ? !breaker.canRequest() : false;
  }

  /**
   * Check if an API is critical
   */
  isCritical(apiName: string): boolean {
    return this.configs.get(apiName)?.critical ?? false;
  }

  /**
   * Get statistics for an API
   */
  getStats(apiName: string): CircuitBreakerStats | undefined {
    return this.breakers.get(apiName)?.getStats();
  }

  /**
   * Get statistics for all APIs
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Get configuration for an API
   */
  getConfig(apiName: string): ApiConfig | undefined {
    return this.configs.get(apiName);
  }

  /**
   * Get all registered API names
   */
  getRegisteredApis(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Reset a specific API's circuit breaker
   */
  reset(apiName: string): void {
    this.breakers.get(apiName)?.reset();
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global singleton instance
 */
export const circuitBreakers = new CircuitBreakerRegistry();
