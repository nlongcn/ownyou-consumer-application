/**
 * RetentionManager - v13 Section 10
 *
 * Manages retention policies and record cleanup.
 */

import type { RetentionPolicy } from './types';

/**
 * Default retention policies per v13 architecture
 */
export const DEFAULT_RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  'ownyou.debug.traces': { namespace: 'ownyou.debug.traces', retentionDays: 7 },
  'ownyou.debug.sync': { namespace: 'ownyou.debug.sync', retentionDays: 30 },
  'ownyou.debug.llm': { namespace: 'ownyou.debug.llm', retentionDays: 90 },
  'ownyou.debug.errors': { namespace: 'ownyou.debug.errors', retentionDays: 30 },
  'ownyou.debug.audit': { namespace: 'ownyou.debug.audit', retentionDays: 365 },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * RetentionManager - Manages data retention and cleanup
 */
export class RetentionManager {
  private policies: Record<string, RetentionPolicy>;

  constructor(customPolicies?: Record<string, RetentionPolicy>) {
    this.policies = {
      ...DEFAULT_RETENTION_POLICIES,
      ...customPolicies,
    };
  }

  /**
   * Check if a record is expired based on its timestamp and policy
   */
  isExpired(timestamp: number, policy: RetentionPolicy): boolean {
    const expirationTime = timestamp + policy.retentionDays * MS_PER_DAY;
    return Date.now() > expirationTime;
  }

  /**
   * Get expiration date for a record
   */
  getExpirationDate(timestamp: number, policy: RetentionPolicy): number {
    return timestamp + policy.retentionDays * MS_PER_DAY;
  }

  /**
   * Get days until expiration (negative if already expired)
   */
  getDaysUntilExpiration(timestamp: number, policy: RetentionPolicy): number {
    const expirationTime = this.getExpirationDate(timestamp, policy);
    const msRemaining = expirationTime - Date.now();
    return Math.floor(msRemaining / MS_PER_DAY);
  }

  /**
   * Filter out expired records from an array
   */
  filterExpiredRecords<T>(
    records: T[],
    policy: RetentionPolicy,
    getTimestamp: (record: T) => number
  ): T[] {
    return records.filter((record) => !this.isExpired(getTimestamp(record), policy));
  }

  /**
   * Get expired records from an array
   */
  getExpiredRecords<T>(
    records: T[],
    policy: RetentionPolicy,
    getTimestamp: (record: T) => number
  ): T[] {
    return records.filter((record) => this.isExpired(getTimestamp(record), policy));
  }

  /**
   * Get policy for a namespace
   */
  getPolicy(namespace: string): RetentionPolicy | undefined {
    return this.policies[namespace];
  }

  /**
   * Set custom policy for a namespace
   */
  setPolicy(namespace: string, policy: RetentionPolicy): void {
    this.policies[namespace] = policy;
  }

  /**
   * Get all policies
   */
  getAllPolicies(): Record<string, RetentionPolicy> {
    return { ...this.policies };
  }
}
