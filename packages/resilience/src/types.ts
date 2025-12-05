/**
 * Resilience Types - v13 Section 6.11
 *
 * Type definitions for resilience patterns.
 */

import type { CircuitBreakerConfig } from '@ownyou/llm-client';
import type { LLMResponse } from '@ownyou/llm-client';

/**
 * Extended API configuration for circuit breaker
 */
export interface ApiConfig extends CircuitBreakerConfig {
  /** API name identifier */
  name: string;
  /** If true, failure blocks the operation */
  critical: boolean;
  /** Number of retry attempts */
  retries: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Fallback level in the LLM fallback chain
 */
export type FallbackLevel =
  | 'original'
  | 'retry'
  | 'downgrade'
  | 'alternative'
  | 'cache'
  | 'local'
  | 'degraded';

/**
 * Result from the fallback chain
 */
export interface FallbackResult {
  /** The LLM response */
  response: LLMResponse;
  /** Which fallback level was used */
  level: FallbackLevel;
  /** Number of attempts made */
  attempts: number;
}

/**
 * Error state types for UI display
 */
export type ErrorStateType = 'temporary' | 'action_required' | 'degraded' | 'offline';

/**
 * User-facing error state
 */
export interface UserErrorState {
  /** Error type */
  type: ErrorStateType;
  /** User-friendly message */
  message: string;
  /** Seconds until automatic retry (for temporary errors) */
  retryInSeconds?: number;
  /** Action the user can take */
  action?: {
    label: string;
    actionType: string;
  };
  /** Capabilities affected by this error */
  capabilitiesAffected?: string[];
  /** Features available while offline */
  availableOffline?: string[];
}

/**
 * Partial data handling result
 */
export interface PartialDataResult {
  /** Whether to proceed with partial data */
  proceed: boolean;
  /** Whether to show a warning */
  warning: boolean;
  /** Multiplier for confidence scores */
  confidenceMultiplier: number;
  /** Optional message for user */
  message?: string;
}

/**
 * Partial data policy configuration
 */
export interface PartialDataPolicy {
  /** Minimum acceptable coverage (0-1) */
  minCoverage: number;
  /** Show warning to user */
  showWarning: boolean;
  /** Continue with partial data */
  proceedWithPartial: boolean;
  /** Penalty to apply to confidence scores */
  confidencePenalty: number;
  /** Prompt user to retry */
  promptRetry?: boolean;
  /** Re-fetch if older than N hours */
  staleThresholdHours?: number;
}
