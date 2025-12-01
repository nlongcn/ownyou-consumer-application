/**
 * Sync Types Tests - v13 Section 8.14
 *
 * Tests that sync-related types are correctly defined per the v13
 * architecture specification.
 */
import { describe, it, expect } from 'vitest';
import type {
  SyncPayload,
  VectorClock,
  ConflictResolution,
} from '../sync';
import { CONFLICT_STRATEGIES } from '../sync';
import type { ConflictStrategy } from '../memory';

describe('Sync Types (v13 Section 8.14)', () => {
  describe('SyncPayload interface', () => {
    it('should have all required fields per v13 Section 8.14.3', () => {
      const payload: SyncPayload = {
        ciphertext: new Uint8Array([1, 2, 3, 4]),
        iv: new Uint8Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
        keyDerivationSalt: 'salt_abc123',
        namespace: 'ownyou.semantic',
        operation: 'put',
        timestamp: Date.now(),
        deviceId: 'device_123',
        vectorClock: { device_123: 1 },
      };

      expect(payload.ciphertext).toBeInstanceOf(Uint8Array);
      expect(payload.iv).toBeInstanceOf(Uint8Array);
      expect(payload.iv).toHaveLength(12); // AES-GCM IV length
      expect(payload.keyDerivationSalt).toBeDefined();
      expect(payload.namespace).toBe('ownyou.semantic');
      expect(payload.operation).toBe('put');
      expect(payload.deviceId).toBe('device_123');
      expect(payload.vectorClock).toBeDefined();
    });

    it('should support all operation types', () => {
      const operations: SyncPayload['operation'][] = ['put', 'update', 'delete'];
      expect(operations).toHaveLength(3);
    });
  });

  describe('VectorClock type', () => {
    it('should track multiple devices', () => {
      const clock: VectorClock = {
        device_1: 5,
        device_2: 3,
        device_3: 7,
      };

      expect(clock.device_1).toBe(5);
      expect(clock.device_2).toBe(3);
      expect(clock.device_3).toBe(7);
    });

    it('should allow incrementing device counts', () => {
      const clock: VectorClock = { device_1: 1 };
      clock.device_1++;
      expect(clock.device_1).toBe(2);
    });
  });

  describe('CONFLICT_STRATEGIES (v13 Section 8.14.4)', () => {
    it('should define strategy for semantic memory', () => {
      expect(CONFLICT_STRATEGIES['ownyou.semantic']).toBe('latest_wins');
    });

    it('should define strategy for episodic memory', () => {
      expect(CONFLICT_STRATEGIES['ownyou.episodic']).toBe('merge');
    });

    it('should define strategy for procedural memory', () => {
      expect(CONFLICT_STRATEGIES['ownyou.procedural']).toBe('flag_for_review');
    });

    it('should define strategy for entities', () => {
      expect(CONFLICT_STRATEGIES['ownyou.entities']).toBe('merge_properties');
    });

    it('should define strategy for relationships', () => {
      expect(CONFLICT_STRATEGIES['ownyou.relationships']).toBe('latest_wins');
    });

    it('should define strategy for missions', () => {
      expect(CONFLICT_STRATEGIES['ownyou.missions']).toBe('latest_wins');
    });

    it('should define strategy for earnings', () => {
      expect(CONFLICT_STRATEGIES['ownyou.earnings']).toBe('sum_reconcile');
    });
  });

  describe('ConflictResolution interface', () => {
    it('should define resolution function signature', () => {
      const resolution: ConflictResolution<{ value: number }> = {
        strategy: 'latest_wins',
        resolve: (local, remote, localClock, remoteClock) => {
          // Simple latest-wins based on vector clock sum
          const localSum = Object.values(localClock).reduce((a, b) => a + b, 0);
          const remoteSum = Object.values(remoteClock).reduce((a, b) => a + b, 0);
          return remoteSum > localSum ? remote : local;
        },
      };

      const local = { value: 10 };
      const remote = { value: 20 };
      const localClock = { device_1: 1 };
      const remoteClock = { device_1: 2 };

      const result = resolution.resolve(local, remote, localClock, remoteClock);
      expect(result.value).toBe(20);
    });

    it('should support sum_reconcile strategy', () => {
      const resolution: ConflictResolution<{ amount: number }> = {
        strategy: 'sum',
        resolve: (local, remote) => ({
          amount: local.amount + remote.amount,
        }),
      };

      const local = { amount: 100 };
      const remote = { amount: 50 };

      const result = resolution.resolve(local, remote, {}, {});
      expect(result.amount).toBe(150);
    });
  });
});
