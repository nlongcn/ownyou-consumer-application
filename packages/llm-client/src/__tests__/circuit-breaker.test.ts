/**
 * Circuit Breaker Tests - v13 Section 6.11
 *
 * Tests for circuit breaker pattern and fallback chains
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, type CircuitBreakerConfig, CircuitState } from '../budget/circuit-breaker';

describe('CircuitBreaker (v13 Section 6.11)', () => {
  let breaker: CircuitBreaker;

  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    resetTimeoutMs: 1000,
    halfOpenRequests: 1,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker(defaultConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should allow requests in closed state', () => {
      expect(breaker.canRequest()).toBe(true);
    });
  });

  describe('Failure Tracking', () => {
    it('should track failures', () => {
      breaker.recordFailure();
      expect(breaker.getFailureCount()).toBe(1);
    });

    it('should open circuit after threshold failures', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
      expect(breaker.canRequest()).toBe(false);
    });

    it('should reset failure count on success', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();

      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('State Transitions', () => {
    it('should transition to half-open after timeout', () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Advance time past reset timeout
      vi.advanceTimersByTime(1100);

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(breaker.canRequest()).toBe(true);
    });

    it('should close circuit on success in half-open state', () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for half-open
      vi.advanceTimersByTime(1100);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Success in half-open
      breaker.recordSuccess();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should re-open circuit on failure in half-open state', () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for half-open
      vi.advanceTimersByTime(1100);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Failure in half-open
      breaker.recordFailure();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Request Limiting in Half-Open', () => {
    it('should limit requests in half-open state', () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for half-open
      vi.advanceTimersByTime(1100);

      // First request allowed
      expect(breaker.canRequest()).toBe(true);
      breaker.startRequest();

      // Second request blocked (halfOpenRequests = 1)
      expect(breaker.canRequest()).toBe(false);
    });
  });

  describe('Execute with Circuit Breaker', () => {
    it('should execute function when circuit is closed', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should throw when circuit is open', async () => {
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      const fn = vi.fn().mockResolvedValue('success');

      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is open');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should track failures from rejected promises', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('API error'));

      await expect(breaker.execute(fn)).rejects.toThrow('API error');
      expect(breaker.getFailureCount()).toBe(1);
    });

    it('should track success from resolved promises', async () => {
      breaker.recordFailure(); // Add one failure first
      const fn = vi.fn().mockResolvedValue('success');

      await breaker.execute(fn);

      expect(breaker.getFailureCount()).toBe(0); // Reset on success
    });
  });

  describe('Statistics', () => {
    it('should track request statistics', async () => {
      const successFn = vi.fn().mockResolvedValue('success');
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));

      await breaker.execute(successFn);
      await breaker.execute(successFn);
      await expect(breaker.execute(failFn)).rejects.toThrow();

      const stats = breaker.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
    });
  });
});

describe('Fallback Chain', () => {
  const fallbackConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    resetTimeoutMs: 1000,
    halfOpenRequests: 1,
  };

  it('should try fallbacks in order', async () => {
    const breakers = {
      openai: new CircuitBreaker(fallbackConfig),
      anthropic: new CircuitBreaker(fallbackConfig),
      local: new CircuitBreaker(fallbackConfig),
    };

    // Open OpenAI circuit
    breakers.openai.recordFailure();
    breakers.openai.recordFailure();
    breakers.openai.recordFailure();

    const providers = ['openai', 'anthropic', 'local'] as const;
    let usedProvider: string | null = null;

    for (const provider of providers) {
      if (breakers[provider].canRequest()) {
        usedProvider = provider;
        break;
      }
    }

    expect(usedProvider).toBe('anthropic');
  });
});
