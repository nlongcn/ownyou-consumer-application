/**
 * Offline Queue Tests (placeholder for device manager)
 */

import { describe, it, expect } from 'vitest';
import * as OfflineQueue from '../../src/core/offline-queue.js';
import * as VectorClock from '../../src/core/vector-clock.js';

describe('Offline Queue', () => {
  describe('createOfflineQueue', () => {
    it('should create an empty queue', () => {
      const queue = OfflineQueue.createOfflineQueue('device-1');

      expect(queue.entries).toEqual([]);
      expect(queue.deviceId).toBe('device-1');
      expect(OfflineQueue.getPendingCount(queue)).toBe(0);
    });

    it('should use default config values', () => {
      const queue = OfflineQueue.createOfflineQueue('device-1');

      expect(queue.maxEntries).toBe(1000);
    });

    it('should accept custom config', () => {
      const queue = OfflineQueue.createOfflineQueue('device-1', {
        offlineQueueLimit: 500,
      });

      expect(queue.maxEntries).toBe(500);
    });
  });

  describe('enqueuePut', () => {
    it('should add a put operation to the queue', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', { value: 'test' })!;

      expect(queue.entries).toHaveLength(1);
      expect(queue.entries[0].operation).toBe('put');
      expect(queue.entries[0].namespace).toBe('ownyou.semantic');
      expect(queue.entries[0].key).toBe('key-1');
      expect(queue.entries[0].value).toEqual({ value: 'test' });
      expect(queue.entries[0].synced).toBe(false);
    });

    it('should return null for non-syncable namespaces', () => {
      const queue = OfflineQueue.createOfflineQueue('device-1');
      const result = OfflineQueue.enqueuePut(queue, 'ownyou.debug.traces', 'key', 'value');

      expect(result).toBeNull();
    });

    it('should increment vector clock', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      const clockBefore = VectorClock.getTimestamp(queue.vectorClock, 'device-1');

      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key', 'value')!;
      const clockAfter = VectorClock.getTimestamp(queue.vectorClock, 'device-1');

      expect(clockAfter).toBe(clockBefore + 1);
    });

    it('should attach vector clock to entry', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key', 'value')!;

      expect(queue.entries[0].vectorClock).toBeDefined();
      expect(queue.entries[0].vectorClock['device-1']).toBe(1);
    });
  });

  describe('enqueueDelete', () => {
    it('should add a delete operation to the queue', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueueDelete(queue, 'ownyou.semantic', 'key-1')!;

      expect(queue.entries).toHaveLength(1);
      expect(queue.entries[0].operation).toBe('delete');
      expect(queue.entries[0].namespace).toBe('ownyou.semantic');
      expect(queue.entries[0].key).toBe('key-1');
    });

    it('should return null for non-syncable namespaces', () => {
      const queue = OfflineQueue.createOfflineQueue('device-1');
      const result = OfflineQueue.enqueueDelete(queue, 'ownyou.llm_cache', 'key');

      expect(result).toBeNull();
    });
  });

  describe('getPendingEntries', () => {
    it('should return only unsynced entries', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', 'value-1')!;
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-2', 'value-2')!;
      queue = OfflineQueue.markEntrySynced(queue, queue.entries[0].id);

      const pending = OfflineQueue.getPendingEntries(queue);

      expect(pending).toHaveLength(1);
      expect(pending[0].key).toBe('key-2');
    });
  });

  describe('markSynced', () => {
    it('should mark entries as synced', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', 'value')!;

      const entryId = queue.entries[0].id;
      queue = OfflineQueue.markSynced(queue, [entryId]);

      expect(queue.entries[0].synced).toBe(true);
    });

    it('should not affect other entries', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', 'value-1')!;
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-2', 'value-2')!;

      queue = OfflineQueue.markSynced(queue, [queue.entries[0].id]);

      expect(queue.entries[0].synced).toBe(true);
      expect(queue.entries[1].synced).toBe(false);
    });
  });

  describe('pruneSyncedEntries', () => {
    it('should remove old synced entries', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', 'value')!;
      queue = OfflineQueue.markEntrySynced(queue, queue.entries[0].id);

      // Manually set old timestamp
      queue.entries[0].timestamp = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago

      queue = OfflineQueue.pruneSyncedEntries(queue, 24 * 60 * 60 * 1000); // 24 hour threshold

      expect(queue.entries).toHaveLength(0);
    });

    it('should keep recent synced entries', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', 'value')!;
      queue = OfflineQueue.markEntrySynced(queue, queue.entries[0].id);

      queue = OfflineQueue.pruneSyncedEntries(queue, 24 * 60 * 60 * 1000);

      expect(queue.entries).toHaveLength(1);
    });

    it('should never remove unsynced entries', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', 'value')!;

      // Manually set old timestamp
      queue.entries[0].timestamp = Date.now() - 48 * 60 * 60 * 1000;

      queue = OfflineQueue.pruneSyncedEntries(queue, 24 * 60 * 60 * 1000);

      expect(queue.entries).toHaveLength(1);
    });
  });

  describe('mergeRemoteEntries', () => {
    it('should add new remote entries', () => {
      let local = OfflineQueue.createOfflineQueue('device-1');
      local = OfflineQueue.enqueuePut(local, 'ownyou.semantic', 'key-1', 'value-1')!;

      const remoteEntry: OfflineQueue.OfflineQueueState['entries'][0] = {
        id: 'remote-entry-1',
        operation: 'put',
        namespace: 'ownyou.semantic',
        key: 'key-2',
        value: 'value-2',
        timestamp: Date.now(),
        vectorClock: { 'device-2': 1 },
        synced: false,
      };

      const merged = OfflineQueue.mergeRemoteEntries(local, [remoteEntry]);

      expect(merged.entries).toHaveLength(2);
    });

    it('should not duplicate existing entries', () => {
      let local = OfflineQueue.createOfflineQueue('device-1');
      local = OfflineQueue.enqueuePut(local, 'ownyou.semantic', 'key-1', 'value-1')!;

      const existingId = local.entries[0].id;
      const duplicate = { ...local.entries[0] };

      const merged = OfflineQueue.mergeRemoteEntries(local, [duplicate]);

      expect(merged.entries).toHaveLength(1);
      expect(merged.entries[0].id).toBe(existingId);
    });

    it('should merge vector clocks', () => {
      let local = OfflineQueue.createOfflineQueue('device-1');
      local = OfflineQueue.enqueuePut(local, 'ownyou.semantic', 'key-1', 'value-1')!;

      const remoteEntry: OfflineQueue.OfflineQueueState['entries'][0] = {
        id: 'remote-entry-1',
        operation: 'put',
        namespace: 'ownyou.semantic',
        key: 'key-2',
        value: 'value-2',
        timestamp: Date.now(),
        vectorClock: { 'device-2': 5 },
        synced: false,
      };

      const merged = OfflineQueue.mergeRemoteEntries(local, [remoteEntry]);

      expect(merged.vectorClock['device-1']).toBe(1);
      expect(merged.vectorClock['device-2']).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', 'value')!;
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.iab', 'key-2', 'value')!;
      queue = OfflineQueue.markEntrySynced(queue, queue.entries[0].id);

      const stats = OfflineQueue.getStats(queue);

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.synced).toBe(1);
      expect(stats.byNamespace['ownyou.semantic']).toEqual({ pending: 0, synced: 1 });
      expect(stats.byNamespace['ownyou.iab']).toEqual({ pending: 1, synced: 0 });
    });
  });

  describe('serialize/deserialize', () => {
    it('should round-trip queue state', () => {
      let queue = OfflineQueue.createOfflineQueue('device-1');
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-1', { data: 'test' })!;
      queue = OfflineQueue.enqueuePut(queue, 'ownyou.semantic', 'key-2', 'value')!;

      const serialized = OfflineQueue.serialize(queue);
      const deserialized = OfflineQueue.deserialize(serialized);

      expect(deserialized.deviceId).toBe(queue.deviceId);
      expect(deserialized.entries).toHaveLength(queue.entries.length);
      expect(deserialized.vectorClock).toEqual(queue.vectorClock);
    });
  });
});

describe('Vector Clock', () => {
  describe('createVectorClock', () => {
    it('should create empty clock', () => {
      const clock = VectorClock.createVectorClock();
      expect(clock).toEqual({});
    });

    it('should create clock with initial device', () => {
      const clock = VectorClock.createVectorClock('device-1');
      expect(clock['device-1']).toBe(0);
    });
  });

  describe('increment', () => {
    it('should increment device timestamp', () => {
      let clock = VectorClock.createVectorClock('device-1');
      clock = VectorClock.increment(clock, 'device-1');

      expect(clock['device-1']).toBe(1);
    });

    it('should add new device with timestamp 1', () => {
      let clock = VectorClock.createVectorClock();
      clock = VectorClock.increment(clock, 'device-1');

      expect(clock['device-1']).toBe(1);
    });
  });

  describe('merge', () => {
    it('should take max for each device', () => {
      const a = { 'device-1': 3, 'device-2': 5 };
      const b = { 'device-1': 7, 'device-3': 2 };

      const merged = VectorClock.merge(a, b);

      expect(merged['device-1']).toBe(7);
      expect(merged['device-2']).toBe(5);
      expect(merged['device-3']).toBe(2);
    });
  });

  describe('compare', () => {
    it('should return equal for identical clocks', () => {
      const a = { 'device-1': 3 };
      const b = { 'device-1': 3 };

      expect(VectorClock.compare(a, b)).toBe('equal');
    });

    it('should return before when a < b', () => {
      const a = { 'device-1': 1 };
      const b = { 'device-1': 3 };

      expect(VectorClock.compare(a, b)).toBe('before');
    });

    it('should return after when a > b', () => {
      const a = { 'device-1': 5 };
      const b = { 'device-1': 2 };

      expect(VectorClock.compare(a, b)).toBe('after');
    });

    it('should return concurrent for incomparable clocks', () => {
      const a = { 'device-1': 3, 'device-2': 1 };
      const b = { 'device-1': 1, 'device-2': 3 };

      expect(VectorClock.compare(a, b)).toBe('concurrent');
    });
  });

  describe('happenedBefore/happenedAfter', () => {
    it('should correctly identify happened-before', () => {
      const a = { 'device-1': 1 };
      const b = { 'device-1': 3 };

      expect(VectorClock.happenedBefore(a, b)).toBe(true);
      expect(VectorClock.happenedAfter(a, b)).toBe(false);
    });
  });

  describe('isConcurrent', () => {
    it('should identify concurrent events', () => {
      const a = { 'device-1': 2, 'device-2': 1 };
      const b = { 'device-1': 1, 'device-2': 2 };

      expect(VectorClock.isConcurrent(a, b)).toBe(true);
    });

    it('should return false for ordered events', () => {
      const a = { 'device-1': 1 };
      const b = { 'device-1': 2 };

      expect(VectorClock.isConcurrent(a, b)).toBe(false);
    });
  });
});
