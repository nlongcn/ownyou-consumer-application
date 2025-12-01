/**
 * Circuit Breaker - v13 Section 6.11
 *
 * Implements circuit breaker pattern for LLM provider resilience.
 */

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before transitioning from open to half-open */
  resetTimeoutMs: number;
  /** Number of requests allowed in half-open state */
  halfOpenRequests: number;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  state: CircuitState;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

/**
 * Default circuit breaker config
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  halfOpenRequests: 2,
};

/**
 * CircuitBreaker - Protects against cascading failures
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private openedAt?: number;
  private halfOpenRequestsInFlight = 0;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Check if we should transition from open to half-open
    if (this.state === CircuitState.OPEN && this.openedAt) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenRequestsInFlight = 0;
      }
    }
    return this.state;
  }

  /**
   * Check if request is allowed
   */
  canRequest(): boolean {
    const state = this.getState();

    if (state === CircuitState.CLOSED) {
      return true;
    }

    if (state === CircuitState.HALF_OPEN) {
      return this.halfOpenRequestsInFlight < this.config.halfOpenRequests;
    }

    return false;
  }

  /**
   * Mark start of a request (for half-open limiting)
   */
  startRequest(): void {
    if (this.getState() === CircuitState.HALF_OPEN) {
      this.halfOpenRequestsInFlight++;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.totalRequests++;
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenRequestsInFlight = Math.max(0, this.halfOpenRequestsInFlight - 1);
    }

    // Close circuit on success in half-open
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.openedAt = undefined;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.totalRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenRequestsInFlight = Math.max(0, this.halfOpenRequestsInFlight - 1);
    }

    // Open circuit if threshold reached
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
    }

    // Re-open on failure in half-open
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
    }
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      failureCount: this.failureCount,
      state: this.getState(),
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canRequest()) {
      throw new Error('Circuit breaker is open');
    }

    this.startRequest();

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.openedAt = undefined;
    this.halfOpenRequestsInFlight = 0;
  }
}
