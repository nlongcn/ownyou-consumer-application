/**
 * Offline Queue - v13 Section 5.2.1
 *
 * Captures mutations when offline and replays them on reconnection.
 * Uses vector clocks for causal ordering.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.1
 */

import type { OfflineQueueEntry, VectorClock, SyncConfig } from '../types.js';
import { DEFAULT_SYNC_CONFIG } from '../types.js';
import * as VClock from './vector-clock.js';
import { shouldSyncNamespace } from '../config/sync-scope.js';

/**
 * Offline queue state
 */
export interface OfflineQueueState {
  /** Pending entries */
  entries: OfflineQueueEntry[];
  /** Current vector clock */
  vectorClock: VectorClock;
  /** Device ID */
  deviceId: string;
  /** Queue capacity */
  maxEntries: number;
}

/**
 * Create a new offline queue
 *
 * @param deviceId - Device identifier
 * @param config - Optional sync config
 * @returns New queue state
 */
export function createOfflineQueue(
  deviceId: string,
  config?: Partial<SyncConfig>
): OfflineQueueState {
  return {
    entries: [],
    vectorClock: VClock.createVectorClock(deviceId),
    deviceId,
    maxEntries: config?.offlineQueueLimit ?? DEFAULT_SYNC_CONFIG.offlineQueueLimit,
  };
}

/**
 * Generate a unique entry ID
 */
function generateEntryId(deviceId: string, timestamp: number): string {
  return `${deviceId}-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Enqueue a put operation
 *
 * @param queue - Current queue state
 * @param namespace - Target namespace
 * @param key - Item key
 * @param value - Value to store
 * @returns Updated queue state (or null if namespace shouldn't sync)
 */
export function enqueuePut(
  queue: OfflineQueueState,
  namespace: string,
  key: string,
  value: unknown
): OfflineQueueState | null {
  // Check if namespace should sync
  if (!shouldSyncNamespace(namespace)) {
    return null;
  }

  const timestamp = Date.now();
  const newVectorClock = VClock.increment(queue.vectorClock, queue.deviceId);

  const entry: OfflineQueueEntry = {
    id: generateEntryId(queue.deviceId, timestamp),
    operation: 'put',
    namespace,
    key,
    value,
    timestamp,
    vectorClock: VClock.clone(newVectorClock),
    synced: false,
  };

  let entries = [...queue.entries, entry];

  // If queue is full, remove oldest synced entries first
  if (entries.length > queue.maxEntries) {
    entries = evictOldestEntries(entries, queue.maxEntries);
  }

  return {
    ...queue,
    entries,
    vectorClock: newVectorClock,
  };
}

/**
 * Enqueue a delete operation
 *
 * @param queue - Current queue state
 * @param namespace - Target namespace
 * @param key - Item key
 * @returns Updated queue state (or null if namespace shouldn't sync)
 */
export function enqueueDelete(
  queue: OfflineQueueState,
  namespace: string,
  key: string
): OfflineQueueState | null {
  // Check if namespace should sync
  if (!shouldSyncNamespace(namespace)) {
    return null;
  }

  const timestamp = Date.now();
  const newVectorClock = VClock.increment(queue.vectorClock, queue.deviceId);

  const entry: OfflineQueueEntry = {
    id: generateEntryId(queue.deviceId, timestamp),
    operation: 'delete',
    namespace,
    key,
    value: null,
    timestamp,
    vectorClock: VClock.clone(newVectorClock),
    synced: false,
  };

  let entries = [...queue.entries, entry];

  // If queue is full, remove oldest synced entries first
  if (entries.length > queue.maxEntries) {
    entries = evictOldestEntries(entries, queue.maxEntries);
  }

  return {
    ...queue,
    entries,
    vectorClock: newVectorClock,
  };
}

/**
 * Evict oldest entries to make room
 *
 * Prioritizes removing synced entries over unsynced.
 */
function evictOldestEntries(
  entries: OfflineQueueEntry[],
  maxEntries: number
): OfflineQueueEntry[] {
  if (entries.length <= maxEntries) {
    return entries;
  }

  // Sort by: synced (true first), then timestamp (oldest first)
  const sorted = [...entries].sort((a, b) => {
    if (a.synced !== b.synced) {
      return a.synced ? -1 : 1; // Synced entries first (to be evicted)
    }
    return a.timestamp - b.timestamp; // Oldest first
  });

  // Remove oldest synced entries first
  return sorted.slice(sorted.length - maxEntries);
}

/**
 * Get all pending (unsynced) entries
 */
export function getPendingEntries(queue: OfflineQueueState): OfflineQueueEntry[] {
  return queue.entries.filter((e) => !e.synced);
}

/**
 * Get pending entries for a specific namespace
 */
export function getPendingEntriesForNamespace(
  queue: OfflineQueueState,
  namespace: string
): OfflineQueueEntry[] {
  return queue.entries.filter((e) => !e.synced && e.namespace === namespace);
}

/**
 * Get the count of pending entries
 */
export function getPendingCount(queue: OfflineQueueState): number {
  return queue.entries.filter((e) => !e.synced).length;
}

/**
 * Mark entries as synced
 *
 * @param queue - Current queue state
 * @param entryIds - IDs of entries to mark as synced
 * @returns Updated queue state
 */
export function markSynced(
  queue: OfflineQueueState,
  entryIds: string[]
): OfflineQueueState {
  const idSet = new Set(entryIds);

  const entries = queue.entries.map((e) =>
    idSet.has(e.id) ? { ...e, synced: true } : e
  );

  return { ...queue, entries };
}

/**
 * Mark a single entry as synced
 */
export function markEntrySynced(
  queue: OfflineQueueState,
  entryId: string
): OfflineQueueState {
  return markSynced(queue, [entryId]);
}

/**
 * Remove synced entries older than a threshold
 *
 * @param queue - Current queue state
 * @param olderThanMs - Remove entries older than this (ms)
 * @returns Updated queue state
 */
export function pruneSyncedEntries(
  queue: OfflineQueueState,
  olderThanMs: number = 24 * 60 * 60 * 1000 // Default: 24 hours
): OfflineQueueState {
  const cutoff = Date.now() - olderThanMs;

  const entries = queue.entries.filter(
    (e) => !e.synced || e.timestamp > cutoff
  );

  return { ...queue, entries };
}

/**
 * Clear all synced entries
 */
export function clearSyncedEntries(queue: OfflineQueueState): OfflineQueueState {
  const entries = queue.entries.filter((e) => !e.synced);
  return { ...queue, entries };
}

/**
 * Clear all entries (use with caution)
 */
export function clearAll(queue: OfflineQueueState): OfflineQueueState {
  return { ...queue, entries: [] };
}

/**
 * Merge entries from a remote queue
 *
 * Uses vector clocks to determine causal ordering and avoid duplicates.
 *
 * @param queue - Local queue state
 * @param remoteEntries - Entries from remote device
 * @returns Updated queue state
 */
export function mergeRemoteEntries(
  queue: OfflineQueueState,
  remoteEntries: OfflineQueueEntry[]
): OfflineQueueState {
  // Filter out entries we've already seen
  const existingIds = new Set(queue.entries.map((e) => e.id));
  const newEntries = remoteEntries.filter((e) => !existingIds.has(e.id));

  if (newEntries.length === 0) {
    return queue;
  }

  // Merge vector clocks
  let mergedVectorClock = queue.vectorClock;
  for (const entry of newEntries) {
    mergedVectorClock = VClock.merge(mergedVectorClock, entry.vectorClock);
  }

  // Combine and sort by vector clock
  const allEntries = [...queue.entries, ...newEntries].sort((a, b) => {
    const cmp = VClock.compare(a.vectorClock, b.vectorClock);
    if (cmp === 'before') return -1;
    if (cmp === 'after') return 1;
    // If concurrent, use timestamp as tiebreaker
    return a.timestamp - b.timestamp;
  });

  // Trim if over capacity
  let entries = allEntries;
  if (entries.length > queue.maxEntries) {
    entries = evictOldestEntries(entries, queue.maxEntries);
  }

  return {
    ...queue,
    entries,
    vectorClock: mergedVectorClock,
  };
}

/**
 * Get entries that happened after a given vector clock
 *
 * Useful for incremental sync.
 */
export function getEntriesAfter(
  queue: OfflineQueueState,
  afterClock: VectorClock
): OfflineQueueEntry[] {
  return queue.entries.filter((e) =>
    VClock.happenedAfter(e.vectorClock, afterClock)
  );
}

/**
 * Get entries that are concurrent with a given vector clock
 */
export function getConcurrentEntries(
  queue: OfflineQueueState,
  clock: VectorClock
): OfflineQueueEntry[] {
  return queue.entries.filter((e) =>
    VClock.isConcurrent(e.vectorClock, clock)
  );
}

/**
 * Serialize queue state for persistence
 */
export function serialize(queue: OfflineQueueState): string {
  return JSON.stringify({
    entries: queue.entries,
    vectorClock: queue.vectorClock,
    deviceId: queue.deviceId,
    maxEntries: queue.maxEntries,
  });
}

/**
 * Deserialize queue state from persistence
 */
export function deserialize(data: string): OfflineQueueState {
  const parsed = JSON.parse(data);

  if (
    !Array.isArray(parsed.entries) ||
    typeof parsed.vectorClock !== 'object' ||
    typeof parsed.deviceId !== 'string'
  ) {
    throw new Error('Invalid offline queue state');
  }

  return {
    entries: parsed.entries,
    vectorClock: parsed.vectorClock,
    deviceId: parsed.deviceId,
    maxEntries: parsed.maxEntries ?? DEFAULT_SYNC_CONFIG.offlineQueueLimit,
  };
}

/**
 * Get queue statistics
 */
export function getStats(queue: OfflineQueueState): {
  total: number;
  pending: number;
  synced: number;
  byNamespace: Record<string, { pending: number; synced: number }>;
  oldestPending: number | null;
  newestPending: number | null;
} {
  const pending = queue.entries.filter((e) => !e.synced);
  const synced = queue.entries.filter((e) => e.synced);

  const byNamespace: Record<string, { pending: number; synced: number }> = {};

  for (const entry of queue.entries) {
    if (!byNamespace[entry.namespace]) {
      byNamespace[entry.namespace] = { pending: 0, synced: 0 };
    }
    if (entry.synced) {
      byNamespace[entry.namespace].synced++;
    } else {
      byNamespace[entry.namespace].pending++;
    }
  }

  const pendingTimestamps = pending.map((e) => e.timestamp);

  return {
    total: queue.entries.length,
    pending: pending.length,
    synced: synced.length,
    byNamespace,
    oldestPending: pendingTimestamps.length > 0 ? Math.min(...pendingTimestamps) : null,
    newestPending: pendingTimestamps.length > 0 ? Math.max(...pendingTimestamps) : null,
  };
}
