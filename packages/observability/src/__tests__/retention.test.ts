/**
 * Retention Tests - v13 Section 10
 *
 * Tests for auto-cleanup by retention policy.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RetentionManager,
  DEFAULT_RETENTION_POLICIES,
  type RetentionPolicy,
} from '../retention';

describe('RetentionManager (v13 Section 10)', () => {
  let manager: RetentionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    manager = new RetentionManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Default Retention Policies', () => {
    it('should have policy for debug traces', () => {
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.traces']).toBeDefined();
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.traces'].retentionDays).toBe(7);
    });

    it('should have policy for debug sync logs', () => {
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.sync']).toBeDefined();
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.sync'].retentionDays).toBe(30);
    });

    it('should have policy for debug LLM metrics', () => {
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.llm']).toBeDefined();
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.llm'].retentionDays).toBe(90);
    });

    it('should have policy for debug errors', () => {
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.errors']).toBeDefined();
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.errors'].retentionDays).toBe(30);
    });

    it('should have policy for debug audit', () => {
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.audit']).toBeDefined();
      expect(DEFAULT_RETENTION_POLICIES['ownyou.debug.audit'].retentionDays).toBe(365);
    });
  });

  describe('isExpired Check', () => {
    it('should return true for records older than retention period', () => {
      const policy: RetentionPolicy = { retentionDays: 7, namespace: 'test' };
      const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago

      expect(manager.isExpired(oldTimestamp, policy)).toBe(true);
    });

    it('should return false for records within retention period', () => {
      const policy: RetentionPolicy = { retentionDays: 7, namespace: 'test' };
      const recentTimestamp = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago

      expect(manager.isExpired(recentTimestamp, policy)).toBe(false);
    });

    it('should return false for exact boundary', () => {
      const policy: RetentionPolicy = { retentionDays: 7, namespace: 'test' };
      const exactBoundary = Date.now() - 7 * 24 * 60 * 60 * 1000; // Exactly 7 days ago

      // Edge case: exactly at boundary should NOT be expired
      expect(manager.isExpired(exactBoundary, policy)).toBe(false);
    });
  });

  describe('getExpirationDate', () => {
    it('should calculate correct expiration date', () => {
      const policy: RetentionPolicy = { retentionDays: 30, namespace: 'test' };
      const timestamp = Date.now();

      const expiration = manager.getExpirationDate(timestamp, policy);
      const expected = timestamp + 30 * 24 * 60 * 60 * 1000;

      expect(expiration).toBe(expected);
    });
  });

  describe('getDaysUntilExpiration', () => {
    it('should calculate days remaining', () => {
      const policy: RetentionPolicy = { retentionDays: 30, namespace: 'test' };
      const timestamp = Date.now() - 20 * 24 * 60 * 60 * 1000; // 20 days ago

      const daysRemaining = manager.getDaysUntilExpiration(timestamp, policy);

      expect(daysRemaining).toBe(10);
    });

    it('should return negative for expired records', () => {
      const policy: RetentionPolicy = { retentionDays: 7, namespace: 'test' };
      const timestamp = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      const daysRemaining = manager.getDaysUntilExpiration(timestamp, policy);

      expect(daysRemaining).toBe(-3);
    });
  });

  describe('filterExpiredRecords', () => {
    it('should filter out expired records', () => {
      const policy: RetentionPolicy = { retentionDays: 7, namespace: 'test' };
      const records = [
        { id: '1', timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, data: 'recent' },
        { id: '2', timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, data: 'old' },
        { id: '3', timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, data: 'medium' },
        { id: '4', timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, data: 'very old' },
      ];

      const valid = manager.filterExpiredRecords(records, policy, (r) => r.timestamp);

      expect(valid.length).toBe(2);
      expect(valid.map((r) => r.id)).toEqual(['1', '3']);
    });

    it('should handle empty array', () => {
      const policy: RetentionPolicy = { retentionDays: 7, namespace: 'test' };
      const records: { id: string; timestamp: number }[] = [];

      const valid = manager.filterExpiredRecords(records, policy, (r) => r.timestamp);

      expect(valid.length).toBe(0);
    });
  });

  describe('getExpiredRecords', () => {
    it('should return only expired records', () => {
      const policy: RetentionPolicy = { retentionDays: 7, namespace: 'test' };
      const records = [
        { id: '1', timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, data: 'recent' },
        { id: '2', timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, data: 'old' },
        { id: '3', timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, data: 'very old' },
      ];

      const expired = manager.getExpiredRecords(records, policy, (r) => r.timestamp);

      expect(expired.length).toBe(2);
      expect(expired.map((r) => r.id)).toEqual(['2', '3']);
    });
  });

  describe('getPolicy', () => {
    it('should return policy for known namespace', () => {
      const policy = manager.getPolicy('ownyou.debug.traces');

      expect(policy).toBeDefined();
      expect(policy?.retentionDays).toBe(7);
    });

    it('should return undefined for unknown namespace', () => {
      const policy = manager.getPolicy('unknown.namespace');

      expect(policy).toBeUndefined();
    });
  });

  describe('setPolicy', () => {
    it('should allow setting custom policy', () => {
      manager.setPolicy('custom.namespace', { retentionDays: 14, namespace: 'custom.namespace' });

      const policy = manager.getPolicy('custom.namespace');

      expect(policy).toBeDefined();
      expect(policy?.retentionDays).toBe(14);
    });

    it('should override existing policy', () => {
      manager.setPolicy('ownyou.debug.traces', { retentionDays: 14, namespace: 'ownyou.debug.traces' });

      const policy = manager.getPolicy('ownyou.debug.traces');

      expect(policy?.retentionDays).toBe(14);
    });
  });

  describe('getAllPolicies', () => {
    it('should return all policies', () => {
      const policies = manager.getAllPolicies();

      expect(Object.keys(policies).length).toBeGreaterThanOrEqual(5);
      expect(policies['ownyou.debug.traces']).toBeDefined();
    });
  });
});
