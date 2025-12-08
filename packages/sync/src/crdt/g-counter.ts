/**
 * G-Counter CRDT (Grow-only Counter)
 *
 * A counter that can only be incremented. Perfect for:
 * - Earnings tracking (never decrease)
 * - Points accumulation
 * - Completion counts
 *
 * @see https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type#G-Counter
 */

import type { GCounterState, CRDTMergeResult } from '../types.js';

/**
 * Create a new G-Counter state
 */
export function createGCounter(): GCounterState {
  return { counts: {} };
}

/**
 * Increment the counter for a specific device
 *
 * @param state - Current counter state
 * @param deviceId - Device performing the increment
 * @param amount - Amount to increment (must be positive)
 * @returns New counter state
 */
export function increment(
  state: GCounterState,
  deviceId: string,
  amount: number = 1
): GCounterState {
  if (amount < 0) {
    throw new Error('G-Counter can only be incremented with positive values');
  }

  if (amount === 0) {
    return state;
  }

  const currentCount = state.counts[deviceId] ?? 0;
  return {
    counts: {
      ...state.counts,
      [deviceId]: currentCount + amount,
    },
  };
}

/**
 * Get the total value of the counter
 *
 * @param state - Counter state
 * @returns Total count across all devices
 */
export function getValue(state: GCounterState): number {
  return Object.values(state.counts).reduce((sum, count) => sum + count, 0);
}

/**
 * Get the count for a specific device
 *
 * @param state - Counter state
 * @param deviceId - Device to query
 * @returns Count for that device
 */
export function getDeviceCount(state: GCounterState, deviceId: string): number {
  return state.counts[deviceId] ?? 0;
}

/**
 * Merge two G-Counter states
 *
 * For each device, we take the maximum count. This ensures:
 * - No increments are lost
 * - Duplicate messages don't double-count
 * - Order of operations doesn't matter
 *
 * @param local - Local counter state
 * @param remote - Remote counter state
 * @returns Merged result
 */
export function merge(
  local: GCounterState,
  remote: GCounterState
): CRDTMergeResult<GCounterState> {
  const allDevices = new Set([
    ...Object.keys(local.counts),
    ...Object.keys(remote.counts),
  ]);

  const mergedCounts: Record<string, number> = {};
  let hadConflict = false;

  for (const deviceId of allDevices) {
    const localCount = local.counts[deviceId] ?? 0;
    const remoteCount = remote.counts[deviceId] ?? 0;

    // Take the maximum for each device
    mergedCounts[deviceId] = Math.max(localCount, remoteCount);

    // Detect if there was a conflict (different non-zero values)
    if (localCount > 0 && remoteCount > 0 && localCount !== remoteCount) {
      hadConflict = true;
    }
  }

  return {
    value: { counts: mergedCounts },
    hadConflict,
  };
}

/**
 * Compare two G-Counter states
 *
 * @param a - First state
 * @param b - Second state
 * @returns -1 if a < b, 0 if equal, 1 if a > b, undefined if incomparable
 */
export function compare(
  a: GCounterState,
  b: GCounterState
): -1 | 0 | 1 | undefined {
  const allDevices = new Set([
    ...Object.keys(a.counts),
    ...Object.keys(b.counts),
  ]);

  let aGreater = false;
  let bGreater = false;

  for (const deviceId of allDevices) {
    const aCount = a.counts[deviceId] ?? 0;
    const bCount = b.counts[deviceId] ?? 0;

    if (aCount > bCount) aGreater = true;
    if (bCount > aCount) bGreater = true;
  }

  if (aGreater && bGreater) return undefined; // Incomparable (concurrent updates)
  if (aGreater) return 1;
  if (bGreater) return -1;
  return 0; // Equal
}

/**
 * Serialize G-Counter state for storage/transmission
 */
export function serialize(state: GCounterState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize G-Counter state
 */
export function deserialize(data: string): GCounterState {
  const parsed = JSON.parse(data);
  if (!parsed.counts || typeof parsed.counts !== 'object') {
    throw new Error('Invalid G-Counter state');
  }
  return parsed as GCounterState;
}

/**
 * Clone a G-Counter state (immutable operation helper)
 */
export function clone(state: GCounterState): GCounterState {
  return {
    counts: { ...state.counts },
  };
}
