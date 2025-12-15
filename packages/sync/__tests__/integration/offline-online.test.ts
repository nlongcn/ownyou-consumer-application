/**
 * Offline-Online Integration Tests
 *
 * Tests for offline queue management and flush verification:
 * - Queue operations while offline
 * - Flush behavior when coming online
 * - Queue persistence
 * - Entry prioritization and eviction
 *
 * @see packages/sync/src/core/offline-queue.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as OfflineQueue from '../../src/core/offline-queue.js';
import type { OfflineQueueEntry, VectorClock } from '../../src/types.js';

// Mock the sync-scope module
vi.mock('../../src/config/sync-scope.js', () => ({
  shouldSyncNamespace: vi.fn((ns: string) => {
    // Return true for test namespaces, false for excluded ones
    if (ns.startsWith('ownyou.local')) return false;
    if (ns.startsWith('ownyou.cache')) return false;
    return true;
  }),
}));

describe('Offline Queue Operations', () => {
  let queue: OfflineQueue.OfflineQueueState;
  const deviceId = 'device-test-001';

  beforeEach(() => {
    queue = OfflineQueue.createOfflineQueue(deviceId, {
      offlineQueueLimit: 100,
    });
  });

  describe('Queue Creation', () => {
    it('should create empty queue with device ID', () => {
      expect(queue.deviceId).toBe(deviceId);
      expect(queue.entries).toEqual([]);
      expect(queue.maxEntries).toBe(100);
    });

    it('should initialize vector clock for device', () => {
      expect(queue.vectorClock).toBeDefined();
      expect(queue.vectorClock[deviceId]).toBe(0);
    });

    it('should use default limit if not specified', () => {
      const defaultQueue = OfflineQueue.createOfflineQueue(deviceId);
      expect(defaultQueue.maxEntries).toBe(1000); // DEFAULT_SYNC_CONFIG.offlineQueueLimit
    });
  });

  describe('Put Operations', () => {
    it('should enqueue put operation', () => {
      const result = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', { data: 'value1' });

      expect(result).not.toBeNull();
      expect(result!.entries.length).toBe(1);
      expect(result!.entries[0].operation).toBe('put');
      expect(result!.entries[0].namespace).toBe('ownyou.test');
      expect(result!.entries[0].key).toBe('key1');
      expect(result!.entries[0].value).toEqual({ data: 'value1' });
    });

    it('should increment vector clock on put', () => {
      const result = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1');

      expect(result!.vectorClock[deviceId]).toBe(1);
    });

    it('should mark entry as not synced', () => {
      const result = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1');

      expect(result!.entries[0].synced).toBe(false);
    });

    it('should generate unique entry IDs', () => {
      let q = queue;
      q = OfflineQueue.enqueuePut(q, 'ownyou.test', 'key1', 'value1')!;
      q = OfflineQueue.enqueuePut(q, 'ownyou.test', 'key2', 'value2')!;

      expect(q.entries[0].id).not.toBe(q.entries[1].id);
    });

    it('should return null for non-syncable namespace', () => {
      const result = OfflineQueue.enqueuePut(queue, 'ownyou.local.cache', 'key1', 'value1');

      expect(result).toBeNull();
    });
  });

  describe('Delete Operations', () => {
    it('should enqueue delete operation', () => {
      const result = OfflineQueue.enqueueDelete(queue, 'ownyou.test', 'key1');

      expect(result).not.toBeNull();
      expect(result!.entries.length).toBe(1);
      expect(result!.entries[0].operation).toBe('delete');
      expect(result!.entries[0].value).toBeNull();
    });

    it('should increment vector clock on delete', () => {
      const result = OfflineQueue.enqueueDelete(queue, 'ownyou.test', 'key1');

      expect(result!.vectorClock[deviceId]).toBe(1);
    });

    it('should return null for non-syncable namespace', () => {
      const result = OfflineQueue.enqueueDelete(queue, 'ownyou.cache.temp', 'key1');

      expect(result).toBeNull();
    });
  });

  describe('Mixed Operations', () => {
    it('should maintain operation order', () => {
      let q = queue;
      q = OfflineQueue.enqueuePut(q, 'ownyou.test', 'key1', 'value1')!;
      q = OfflineQueue.enqueueDelete(q, 'ownyou.test', 'key2')!;
      q = OfflineQueue.enqueuePut(q, 'ownyou.test', 'key3', 'value3')!;

      expect(q.entries[0].operation).toBe('put');
      expect(q.entries[0].key).toBe('key1');
      expect(q.entries[1].operation).toBe('delete');
      expect(q.entries[1].key).toBe('key2');
      expect(q.entries[2].operation).toBe('put');
      expect(q.entries[2].key).toBe('key3');
    });

    it('should increment vector clock for each operation', () => {
      let q = queue;
      q = OfflineQueue.enqueuePut(q, 'ownyou.test', 'key1', 'value1')!;
      q = OfflineQueue.enqueueDelete(q, 'ownyou.test', 'key2')!;
      q = OfflineQueue.enqueuePut(q, 'ownyou.test', 'key3', 'value3')!;

      expect(q.vectorClock[deviceId]).toBe(3);
    });
  });
});

describe('Pending Entries', () => {
  let queue: OfflineQueue.OfflineQueueState;
  const deviceId = 'device-test-001';

  beforeEach(() => {
    queue = OfflineQueue.createOfflineQueue(deviceId);

    // Add some entries
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key3', 'value3')!;
  });

  it('should return all pending entries', () => {
    const pending = OfflineQueue.getPendingEntries(queue);

    expect(pending.length).toBe(3);
    expect(pending.every((e) => !e.synced)).toBe(true);
  });

  it('should return pending count', () => {
    expect(OfflineQueue.getPendingCount(queue)).toBe(3);
  });

  it('should filter by namespace', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.other', 'key4', 'value4')!;

    const testPending = OfflineQueue.getPendingEntriesForNamespace(queue, 'ownyou.test');
    const otherPending = OfflineQueue.getPendingEntriesForNamespace(queue, 'ownyou.other');

    expect(testPending.length).toBe(3);
    expect(otherPending.length).toBe(1);
  });

  it('should exclude synced entries from pending', () => {
    const ids = [queue.entries[0].id, queue.entries[1].id];
    queue = OfflineQueue.markSynced(queue, ids);

    const pending = OfflineQueue.getPendingEntries(queue);

    expect(pending.length).toBe(1);
    expect(pending[0].key).toBe('key3');
  });
});

describe('Marking Entries as Synced', () => {
  let queue: OfflineQueue.OfflineQueueState;
  const deviceId = 'device-test-001';

  beforeEach(() => {
    queue = OfflineQueue.createOfflineQueue(deviceId);
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key3', 'value3')!;
  });

  it('should mark single entry as synced', () => {
    const entryId = queue.entries[0].id;
    queue = OfflineQueue.markEntrySynced(queue, entryId);

    expect(queue.entries[0].synced).toBe(true);
    expect(queue.entries[1].synced).toBe(false);
    expect(queue.entries[2].synced).toBe(false);
  });

  it('should mark multiple entries as synced', () => {
    const ids = [queue.entries[0].id, queue.entries[2].id];
    queue = OfflineQueue.markSynced(queue, ids);

    expect(queue.entries[0].synced).toBe(true);
    expect(queue.entries[1].synced).toBe(false);
    expect(queue.entries[2].synced).toBe(true);
  });

  it('should update pending count after marking synced', () => {
    expect(OfflineQueue.getPendingCount(queue)).toBe(3);

    queue = OfflineQueue.markSynced(queue, [queue.entries[0].id]);

    expect(OfflineQueue.getPendingCount(queue)).toBe(2);
  });

  it('should handle marking non-existent ID', () => {
    queue = OfflineQueue.markSynced(queue, ['non-existent-id']);

    // Should not throw and all entries remain unsynced
    expect(queue.entries.every((e) => !e.synced)).toBe(true);
  });
});

describe('Queue Cleanup', () => {
  let queue: OfflineQueue.OfflineQueueState;
  const deviceId = 'device-test-001';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

    queue = OfflineQueue.createOfflineQueue(deviceId);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should prune old synced entries', () => {
    // Add entries at current time
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;

    // Mark as synced
    queue = OfflineQueue.markSynced(queue, [queue.entries[0].id]);

    // Advance time by 2 days
    vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);

    // Prune entries older than 1 day
    queue = OfflineQueue.pruneSyncedEntries(queue, 24 * 60 * 60 * 1000);

    expect(queue.entries.length).toBe(0);
  });

  it('should keep recent synced entries', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    queue = OfflineQueue.markSynced(queue, [queue.entries[0].id]);

    // Only advance 1 hour
    vi.advanceTimersByTime(60 * 60 * 1000);

    // Prune entries older than 1 day
    queue = OfflineQueue.pruneSyncedEntries(queue, 24 * 60 * 60 * 1000);

    expect(queue.entries.length).toBe(1);
  });

  it('should never prune unsynced entries', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;

    // Advance time by 30 days
    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000);

    queue = OfflineQueue.pruneSyncedEntries(queue, 24 * 60 * 60 * 1000);

    // Unsynced entry should remain
    expect(queue.entries.length).toBe(1);
    expect(queue.entries[0].synced).toBe(false);
  });

  it('should clear all synced entries', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;
    queue = OfflineQueue.markSynced(queue, [queue.entries[0].id]);

    queue = OfflineQueue.clearSyncedEntries(queue);

    expect(queue.entries.length).toBe(1);
    expect(queue.entries[0].key).toBe('key2');
  });

  it('should clear all entries', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;

    queue = OfflineQueue.clearAll(queue);

    expect(queue.entries.length).toBe(0);
  });
});

describe('Queue Capacity and Eviction', () => {
  const deviceId = 'device-test-001';

  it('should evict oldest synced entries when at capacity', () => {
    let queue = OfflineQueue.createOfflineQueue(deviceId, { offlineQueueLimit: 3 });

    // Add 3 entries
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key3', 'value3')!;

    // Mark first as synced
    queue = OfflineQueue.markSynced(queue, [queue.entries[0].id]);

    // Add 4th entry - should evict synced entry
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key4', 'value4')!;

    expect(queue.entries.length).toBe(3);
    expect(queue.entries.find((e) => e.key === 'key1')).toBeUndefined();
    expect(queue.entries.find((e) => e.key === 'key4')).toBeDefined();
  });

  it('should prioritize evicting synced over unsynced', () => {
    let queue = OfflineQueue.createOfflineQueue(deviceId, { offlineQueueLimit: 3 });

    // Add 3 entries
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key3', 'value3')!;

    // Mark middle entry as synced
    queue = OfflineQueue.markSynced(queue, [queue.entries[1].id]);

    // Add 4th entry
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key4', 'value4')!;

    // Synced entry (key2) should be evicted
    expect(queue.entries.find((e) => e.key === 'key2')).toBeUndefined();
    expect(queue.entries.find((e) => e.key === 'key1')).toBeDefined();
    expect(queue.entries.find((e) => e.key === 'key3')).toBeDefined();
    expect(queue.entries.find((e) => e.key === 'key4')).toBeDefined();
  });

  it('should evict oldest unsynced if no synced entries', () => {
    let queue = OfflineQueue.createOfflineQueue(deviceId, { offlineQueueLimit: 3 });

    // Add 3 entries
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;

    // Small delay to ensure different timestamps
    vi.useFakeTimers();
    vi.advanceTimersByTime(10);
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;

    vi.advanceTimersByTime(10);
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key3', 'value3')!;

    vi.advanceTimersByTime(10);
    // Add 4th entry - should evict oldest unsynced (key1)
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key4', 'value4')!;

    expect(queue.entries.length).toBe(3);
    // key1 should be evicted as it's oldest unsynced
    expect(queue.entries.find((e) => e.key === 'key1')).toBeUndefined();

    vi.useRealTimers();
  });
});

describe('Remote Entry Merging', () => {
  let queue: OfflineQueue.OfflineQueueState;
  const deviceId = 'device-local';

  beforeEach(() => {
    queue = OfflineQueue.createOfflineQueue(deviceId);
  });

  it('should merge remote entries', () => {
    // Add local entry
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'local-key', 'local-value')!;

    // Create remote entries
    const remoteEntries: OfflineQueueEntry[] = [
      {
        id: 'remote-001',
        operation: 'put',
        namespace: 'ownyou.test',
        key: 'remote-key',
        value: 'remote-value',
        timestamp: Date.now(),
        vectorClock: { 'device-remote': 1 },
        synced: false,
      },
    ];

    queue = OfflineQueue.mergeRemoteEntries(queue, remoteEntries);

    expect(queue.entries.length).toBe(2);
    expect(queue.entries.find((e) => e.key === 'local-key')).toBeDefined();
    expect(queue.entries.find((e) => e.key === 'remote-key')).toBeDefined();
  });

  it('should not duplicate existing entries', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;

    const existingId = queue.entries[0].id;

    // Try to merge same entry again
    const remoteEntries: OfflineQueueEntry[] = [{ ...queue.entries[0] }];

    queue = OfflineQueue.mergeRemoteEntries(queue, remoteEntries);

    expect(queue.entries.length).toBe(1);
    expect(queue.entries[0].id).toBe(existingId);
  });

  it('should merge vector clocks', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'local-key', 'local-value')!;

    const remoteEntries: OfflineQueueEntry[] = [
      {
        id: 'remote-001',
        operation: 'put',
        namespace: 'ownyou.test',
        key: 'remote-key',
        value: 'remote-value',
        timestamp: Date.now(),
        vectorClock: { 'device-remote': 5 },
        synced: false,
      },
    ];

    queue = OfflineQueue.mergeRemoteEntries(queue, remoteEntries);

    // Merged vector clock should have both devices
    expect(queue.vectorClock[deviceId]).toBeDefined();
    expect(queue.vectorClock['device-remote']).toBe(5);
  });

  it('should sort entries by vector clock', () => {
    // Create entries with specific vector clocks
    const remoteEntries: OfflineQueueEntry[] = [
      {
        id: 'remote-001',
        operation: 'put',
        namespace: 'ownyou.test',
        key: 'first',
        value: 'value1',
        timestamp: Date.now() - 100,
        vectorClock: { 'device-remote': 1 },
        synced: false,
      },
      {
        id: 'remote-002',
        operation: 'put',
        namespace: 'ownyou.test',
        key: 'second',
        value: 'value2',
        timestamp: Date.now(),
        vectorClock: { 'device-remote': 2 },
        synced: false,
      },
    ];

    queue = OfflineQueue.mergeRemoteEntries(queue, remoteEntries);

    // First entry should be before second (lower vector clock)
    const firstIndex = queue.entries.findIndex((e) => e.key === 'first');
    const secondIndex = queue.entries.findIndex((e) => e.key === 'second');

    expect(firstIndex).toBeLessThan(secondIndex);
  });
});

describe('Queue Serialization', () => {
  let queue: OfflineQueue.OfflineQueueState;
  const deviceId = 'device-test-001';

  beforeEach(() => {
    queue = OfflineQueue.createOfflineQueue(deviceId);
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', { nested: 'value1' })!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;
  });

  it('should serialize queue state', () => {
    const serialized = OfflineQueue.serialize(queue);

    expect(typeof serialized).toBe('string');
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it('should deserialize queue state', () => {
    const serialized = OfflineQueue.serialize(queue);
    const deserialized = OfflineQueue.deserialize(serialized);

    expect(deserialized.deviceId).toBe(queue.deviceId);
    expect(deserialized.entries.length).toBe(queue.entries.length);
    expect(deserialized.maxEntries).toBe(queue.maxEntries);
  });

  it('should preserve entry data through serialization', () => {
    const serialized = OfflineQueue.serialize(queue);
    const deserialized = OfflineQueue.deserialize(serialized);

    const original = queue.entries[0];
    const restored = deserialized.entries[0];

    expect(restored.id).toBe(original.id);
    expect(restored.operation).toBe(original.operation);
    expect(restored.namespace).toBe(original.namespace);
    expect(restored.key).toBe(original.key);
    expect(restored.value).toEqual(original.value);
    expect(restored.synced).toBe(original.synced);
  });

  it('should preserve vector clock through serialization', () => {
    const serialized = OfflineQueue.serialize(queue);
    const deserialized = OfflineQueue.deserialize(serialized);

    expect(deserialized.vectorClock).toEqual(queue.vectorClock);
  });

  it('should throw on invalid data', () => {
    expect(() => OfflineQueue.deserialize('{}')).toThrow('Invalid offline queue state');
    expect(() => OfflineQueue.deserialize('{"entries": "not-array"}')).toThrow();
    expect(() => OfflineQueue.deserialize('invalid json')).toThrow();
  });
});

describe('Queue Statistics', () => {
  let queue: OfflineQueue.OfflineQueueState;
  const deviceId = 'device-test-001';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

    queue = OfflineQueue.createOfflineQueue(deviceId);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should report correct statistics', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    vi.advanceTimersByTime(100);
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;
    vi.advanceTimersByTime(100);
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.other', 'key3', 'value3')!;

    queue = OfflineQueue.markSynced(queue, [queue.entries[0].id]);

    const stats = OfflineQueue.getStats(queue);

    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(2);
    expect(stats.synced).toBe(1);
    expect(stats.byNamespace['ownyou.test'].pending).toBe(1);
    expect(stats.byNamespace['ownyou.test'].synced).toBe(1);
    expect(stats.byNamespace['ownyou.other'].pending).toBe(1);
  });

  it('should track oldest and newest pending', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    const firstTime = Date.now();

    vi.advanceTimersByTime(1000);
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;

    vi.advanceTimersByTime(1000);
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key3', 'value3')!;
    const lastTime = Date.now();

    const stats = OfflineQueue.getStats(queue);

    expect(stats.oldestPending).toBe(firstTime);
    expect(stats.newestPending).toBe(lastTime);
  });

  it('should return null for oldest/newest when no pending', () => {
    const stats = OfflineQueue.getStats(queue);

    expect(stats.oldestPending).toBeNull();
    expect(stats.newestPending).toBeNull();
  });
});

describe('Vector Clock Integration', () => {
  let queue: OfflineQueue.OfflineQueueState;
  const deviceId = 'device-test-001';

  beforeEach(() => {
    queue = OfflineQueue.createOfflineQueue(deviceId);
  });

  it('should get entries after a given vector clock', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    const afterClock = { ...queue.vectorClock };

    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key2', 'value2')!;
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key3', 'value3')!;

    const entriesAfter = OfflineQueue.getEntriesAfter(queue, afterClock);

    // Should get key2 and key3, not key1
    expect(entriesAfter.length).toBe(2);
    expect(entriesAfter.find((e) => e.key === 'key1')).toBeUndefined();
    expect(entriesAfter.find((e) => e.key === 'key2')).toBeDefined();
    expect(entriesAfter.find((e) => e.key === 'key3')).toBeDefined();
  });

  it('should get concurrent entries', () => {
    queue = OfflineQueue.enqueuePut(queue, 'ownyou.test', 'key1', 'value1')!;
    const concurrentClock: VectorClock = { 'other-device': 1 };

    const concurrent = OfflineQueue.getConcurrentEntries(queue, concurrentClock);

    // Local entry should be concurrent with other device's clock
    expect(concurrent.length).toBe(1);
    expect(concurrent[0].key).toBe('key1');
  });
});
