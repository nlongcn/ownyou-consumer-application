/**
 * Partial Data Handling Tests - v13 Section 6.11.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  handlePartialData,
  getPolicy,
  getActivePolicies,
  configurePartialDataPolicies,
  resetPartialDataPolicies,
  isStale,
  adjustConfidence,
  PARTIAL_DATA_POLICIES,
  DEFAULT_PARTIAL_DATA_POLICIES,
} from '../partial-data';

describe('Partial Data Handling', () => {
  describe('PARTIAL_DATA_POLICIES', () => {
    it('should have policies for all data sources', () => {
      expect(PARTIAL_DATA_POLICIES.email).toBeDefined();
      expect(PARTIAL_DATA_POLICIES.financial).toBeDefined();
      expect(PARTIAL_DATA_POLICIES.calendar).toBeDefined();
      expect(PARTIAL_DATA_POLICIES.browser).toBeDefined();
    });

    it('should have correct policy values', () => {
      // Email policy - v13 compliant 0.8 minCoverage
      expect(PARTIAL_DATA_POLICIES.email.minCoverage).toBe(0.8);
      expect(PARTIAL_DATA_POLICIES.email.proceedWithPartial).toBe(true);

      // Financial policy (stricter)
      expect(PARTIAL_DATA_POLICIES.financial.minCoverage).toBe(0.9);
      expect(PARTIAL_DATA_POLICIES.financial.proceedWithPartial).toBe(false);
      expect(PARTIAL_DATA_POLICIES.financial.promptRetry).toBe(true);
    });
  });

  describe('getPolicy', () => {
    it('should return policy for known data sources', () => {
      expect(getPolicy('email')).toBe(PARTIAL_DATA_POLICIES.email);
      expect(getPolicy('financial')).toBe(PARTIAL_DATA_POLICIES.financial);
    });

    it('should return undefined for unknown data sources', () => {
      expect(getPolicy('unknown')).toBeUndefined();
    });
  });

  describe('handlePartialData', () => {
    describe('complete data', () => {
      it('should proceed with no warning for 100% coverage', () => {
        const result = handlePartialData('email', 100, 100);
        expect(result.proceed).toBe(true);
        expect(result.warning).toBe(false);
        expect(result.confidenceMultiplier).toBe(1);
        expect(result.message).toBeUndefined();
      });

      it('should proceed with no warning for > 100% coverage', () => {
        const result = handlePartialData('email', 120, 100);
        expect(result.proceed).toBe(true);
        expect(result.warning).toBe(false);
      });
    });

    describe('partial data within tolerance', () => {
      it('should proceed with warning for email at 60% coverage', () => {
        const result = handlePartialData('email', 60, 100);
        expect(result.proceed).toBe(true);
        expect(result.warning).toBe(true);
        expect(result.confidenceMultiplier).toBe(0.8); // 1 - 0.2 penalty
        expect(result.message).toContain('60%');
      });

      it('should proceed without warning for browser at 40% coverage', () => {
        const result = handlePartialData('browser', 40, 100);
        expect(result.proceed).toBe(true);
        expect(result.warning).toBe(false); // browser doesn't show warnings
        expect(result.confidenceMultiplier).toBe(0.9); // 1 - 0.1 penalty
      });
    });

    describe('partial data below minimum', () => {
      it('should not proceed for financial below 90%', () => {
        const result = handlePartialData('financial', 80, 100);
        expect(result.proceed).toBe(false);
        expect(result.warning).toBe(true);
        expect(result.confidenceMultiplier).toBe(0);
        expect(result.message).toContain('Insufficient financial data');
        expect(result.message).toContain('80%');
        expect(result.message).toContain('90% required');
      });

      it('should proceed but with penalty for email below 80%', () => {
        const result = handlePartialData('email', 70, 100);
        // Email has proceedWithPartial: true, so it proceeds even below min
        expect(result.proceed).toBe(true);
        expect(result.warning).toBe(true);
        expect(result.confidenceMultiplier).toBe(0.8);
      });
    });

    describe('unknown data sources', () => {
      it('should allow all for unknown sources', () => {
        const result = handlePartialData('unknown', 10, 100);
        expect(result.proceed).toBe(true);
        expect(result.warning).toBe(false);
        expect(result.confidenceMultiplier).toBe(1);
      });
    });

    describe('edge cases', () => {
      it('should handle zero expected count', () => {
        const result = handlePartialData('email', 0, 0);
        expect(result.proceed).toBe(true);
        expect(result.confidenceMultiplier).toBe(1);
      });

      it('should handle negative counts as 0', () => {
        // Use financial source which does NOT proceed with partial data
        const result = handlePartialData('financial', -5, 100);
        expect(result.proceed).toBe(false);
        expect(result.message).toContain('Insufficient');
      });
    });
  });

  describe('isStale', () => {
    it('should return true when data is stale', () => {
      const oneDayAgo = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      expect(isStale('email', oneDayAgo)).toBe(true); // Email threshold is 24h
    });

    it('should return false when data is fresh', () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago
      expect(isStale('email', oneHourAgo)).toBe(false);
    });

    it('should return false for sources without stale threshold', () => {
      const longTimeAgo = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      expect(isStale('browser', longTimeAgo)).toBe(false); // Browser has no threshold
    });

    it('should respect different thresholds per source', () => {
      const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
      expect(isStale('email', thirteenHoursAgo)).toBe(false); // Email: 24h
      expect(isStale('calendar', thirteenHoursAgo)).toBe(true); // Calendar: 12h
    });
  });

  describe('adjustConfidence', () => {
    it('should not adjust confidence for full coverage', () => {
      expect(adjustConfidence(0.9, 'email', 1.0)).toBe(0.9);
    });

    it('should apply penalty for partial coverage', () => {
      // Email has 0.2 penalty, so multiplier is 0.8
      expect(adjustConfidence(1.0, 'email', 0.5)).toBe(0.8);
      expect(adjustConfidence(0.9, 'email', 0.5)).toBeCloseTo(0.72);
    });

    it('should apply different penalties per source', () => {
      expect(adjustConfidence(1.0, 'browser', 0.5)).toBe(0.9); // 0.1 penalty
      expect(adjustConfidence(1.0, 'calendar', 0.5)).toBe(0.85); // 0.15 penalty
    });

    it('should not adjust for unknown sources', () => {
      expect(adjustConfidence(0.9, 'unknown', 0.5)).toBe(0.9);
    });
  });

  describe('configurable policies', () => {
    afterEach(() => {
      resetPartialDataPolicies();
    });

    it('should export DEFAULT_PARTIAL_DATA_POLICIES', () => {
      expect(DEFAULT_PARTIAL_DATA_POLICIES).toBeDefined();
      expect(DEFAULT_PARTIAL_DATA_POLICIES.email.minCoverage).toBe(0.8);
    });

    it('should allow configuring policy overrides', () => {
      // Email defaults to 0.8 minCoverage (v13 compliant)
      expect(getPolicy('email')?.minCoverage).toBe(0.8);

      // Override to stricter 0.9
      configurePartialDataPolicies({
        email: { minCoverage: 0.9 },
      });

      // Now should be 0.9
      expect(getPolicy('email')?.minCoverage).toBe(0.9);
      // Other fields should remain unchanged
      expect(getPolicy('email')?.proceedWithPartial).toBe(true);
      expect(getPolicy('email')?.confidencePenalty).toBe(0.2);
    });

    it('should merge multiple override calls', () => {
      configurePartialDataPolicies({
        email: { minCoverage: 0.9 },
      });
      configurePartialDataPolicies({
        email: { confidencePenalty: 0.3 },
      });

      // Both overrides should be applied
      expect(getPolicy('email')?.minCoverage).toBe(0.9);
      expect(getPolicy('email')?.confidencePenalty).toBe(0.3);
    });

    it('should allow adding new data sources via overrides', () => {
      configurePartialDataPolicies({
        custom: {
          minCoverage: 0.7,
          showWarning: true,
          proceedWithPartial: true,
          confidencePenalty: 0.1,
        },
      });

      const policy = getPolicy('custom');
      expect(policy).toBeDefined();
      expect(policy?.minCoverage).toBe(0.7);
    });

    it('should reset to defaults', () => {
      configurePartialDataPolicies({
        email: { minCoverage: 0.9 },
      });
      expect(getPolicy('email')?.minCoverage).toBe(0.9);

      resetPartialDataPolicies();
      expect(getPolicy('email')?.minCoverage).toBe(0.8);  // v13 default
    });

    it('should return all active policies including overrides', () => {
      configurePartialDataPolicies({
        email: { minCoverage: 0.9 },
      });

      const policies = getActivePolicies();
      expect(policies.email.minCoverage).toBe(0.9);
      expect(policies.financial.minCoverage).toBe(0.9); // Unchanged
    });

    it('should affect handlePartialData with overrides', () => {
      // Default: email has proceedWithPartial: true, so 40% proceeds
      expect(handlePartialData('email', 40, 100).proceed).toBe(true);

      // Set proceedWithPartial to false - now 40% should fail
      configurePartialDataPolicies({
        email: { proceedWithPartial: false },
      });

      // After override: email at 40% should fail
      const result = handlePartialData('email', 40, 100);
      expect(result.proceed).toBe(false);
      expect(result.message).toContain('Insufficient email data');
    });
  });
});
