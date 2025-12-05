/**
 * Partial Data Policies - v13 Section 6.11.4
 *
 * Per-source coverage policies for handling incomplete data.
 */

import type { PartialDataPolicy, PartialDataResult } from '../types';

/**
 * Default policies per v13 Section 6.11.4 - matches v13 data_sources config
 */
export const DEFAULT_PARTIAL_DATA_POLICIES: Record<string, PartialDataPolicy> = {
  email: {
    minCoverage: 0.8,           // v13: min_success_rate: 0.8
    showWarning: true,
    proceedWithPartial: true,   // v13: partial_success: true
    confidencePenalty: 0.2,
    staleThresholdHours: 24,    // v13: stale_threshold_hours: 24
  },
  financial: {
    minCoverage: 0.9,           // v13: All or nothing for financial accuracy
    showWarning: true,
    proceedWithPartial: false,  // v13: partial_success: false
    confidencePenalty: 0,
    promptRetry: true,          // v13: reauth_prompt: true
  },
  calendar: {
    minCoverage: 0.7,           // v13: min_success_rate: 0.7
    showWarning: true,
    proceedWithPartial: true,
    confidencePenalty: 0.15,
    staleThresholdHours: 12,    // v13: stale_threshold_hours: 12
  },
  browser: {
    minCoverage: 0.3,
    showWarning: false,
    proceedWithPartial: true,
    confidencePenalty: 0.1,
  },
  contacts: {
    minCoverage: 0.6,
    showWarning: true,
    proceedWithPartial: true,
    confidencePenalty: 0.15,
    staleThresholdHours: 168,   // 7 days
  },
  location: {
    minCoverage: 0.4,
    showWarning: false,
    proceedWithPartial: true,
    confidencePenalty: 0.1,
    staleThresholdHours: 1,     // Location data stales quickly
  },
};

/**
 * Active policy overrides (merged with defaults)
 */
let policyOverrides: Record<string, Partial<PartialDataPolicy>> = {};

/**
 * Get current active policies (defaults + overrides)
 */
export function getActivePolicies(): Record<string, PartialDataPolicy> {
  const result: Record<string, PartialDataPolicy> = { ...DEFAULT_PARTIAL_DATA_POLICIES };

  for (const [source, overrides] of Object.entries(policyOverrides)) {
    if (result[source]) {
      result[source] = { ...result[source], ...overrides };
    } else {
      // Add new policy from overrides (all fields required)
      result[source] = overrides as PartialDataPolicy;
    }
  }

  return result;
}

/**
 * Configure partial data policy overrides
 *
 * Allows customizing policies per data source without modifying defaults.
 * Overrides are merged with defaults, so you only need to specify changed fields.
 *
 * @param overrides - Partial policy overrides by data source
 *
 * @example
 * ```typescript
 * // Increase email minCoverage to v13-compliant 0.8
 * configurePartialDataPolicies({
 *   email: { minCoverage: 0.8 },
 * });
 *
 * // Add a custom data source
 * configurePartialDataPolicies({
 *   custom: { minCoverage: 0.7, showWarning: true, proceedWithPartial: true, confidencePenalty: 0.1 },
 * });
 * ```
 */
export function configurePartialDataPolicies(
  overrides: Record<string, Partial<PartialDataPolicy>>
): void {
  // Deep merge: merge each source's overrides with existing overrides
  for (const [source, sourceOverrides] of Object.entries(overrides)) {
    policyOverrides[source] = {
      ...policyOverrides[source],
      ...sourceOverrides,
    };
  }
}

/**
 * Reset policies to defaults (clear all overrides)
 */
export function resetPartialDataPolicies(): void {
  policyOverrides = {};
}

/**
 * Get the policy for a data source (with overrides applied)
 */
export function getPolicy(dataSource: string): PartialDataPolicy | undefined {
  const policies = getActivePolicies();
  return policies[dataSource];
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getActivePolicies() instead
 */
export const PARTIAL_DATA_POLICIES = DEFAULT_PARTIAL_DATA_POLICIES;

/**
 * Handle partial data scenario
 *
 * @param dataSource - The data source (email, financial, calendar, etc.)
 * @param fetchedCount - Number of items successfully fetched
 * @param expectedCount - Expected total number of items
 * @returns PartialDataResult with proceed/warning flags
 *
 * @example
 * ```typescript
 * const result = handlePartialData('email', 45, 100);
 * if (!result.proceed) {
 *   throw new Error(result.message);
 * }
 * if (result.warning) {
 *   showToast(result.message);
 * }
 * // Apply confidence penalty to results
 * score *= result.confidenceMultiplier;
 * ```
 */
export function handlePartialData(
  dataSource: string,
  fetchedCount: number,
  expectedCount: number
): PartialDataResult {
  const policy = getPolicy(dataSource);

  // No policy defined - allow all
  if (!policy) {
    return { proceed: true, warning: false, confidenceMultiplier: 1 };
  }

  // Calculate coverage (handle negative counts as 0)
  const safeFetchedCount = Math.max(0, fetchedCount);
  const safeExpectedCount = Math.max(0, expectedCount);
  const coverage = safeExpectedCount > 0 ? safeFetchedCount / safeExpectedCount : 1;

  // Complete data - no issues
  if (coverage >= 1) {
    return { proceed: true, warning: false, confidenceMultiplier: 1 };
  }

  // Below minimum coverage
  if (coverage < policy.minCoverage) {
    if (!policy.proceedWithPartial) {
      return {
        proceed: false,
        warning: true,
        confidenceMultiplier: 0,
        message: `Insufficient ${dataSource} data: ${Math.round(coverage * 100)}% available, ` +
                 `${Math.round(policy.minCoverage * 100)}% required`,
      };
    }
  }

  // Partial data within acceptable range
  return {
    proceed: true,
    warning: policy.showWarning && coverage < 1,
    confidenceMultiplier: coverage < 1 ? (1 - policy.confidencePenalty) : 1,
    message: coverage < 1
      ? `Using ${Math.round(coverage * 100)}% of available ${dataSource} data`
      : undefined,
  };
}

/**
 * Check if data is stale based on policy
 *
 * @param dataSource - The data source
 * @param lastFetchedAt - Timestamp of last fetch
 * @returns True if data should be re-fetched
 */
export function isStale(dataSource: string, lastFetchedAt: number): boolean {
  const policy = getPolicy(dataSource);
  if (!policy?.staleThresholdHours) {
    return false;
  }

  const thresholdMs = policy.staleThresholdHours * 60 * 60 * 1000;
  return Date.now() - lastFetchedAt > thresholdMs;
}

/**
 * Calculate adjusted confidence score
 *
 * @param baseConfidence - Original confidence score (0-1)
 * @param dataSource - The data source
 * @param coverage - Data coverage ratio (0-1)
 * @returns Adjusted confidence score
 */
export function adjustConfidence(
  baseConfidence: number,
  dataSource: string,
  coverage: number
): number {
  const policy = getPolicy(dataSource);
  if (!policy || coverage >= 1) {
    return baseConfidence;
  }

  const multiplier = 1 - policy.confidencePenalty;
  return baseConfidence * multiplier;
}
