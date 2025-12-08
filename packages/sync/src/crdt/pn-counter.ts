/**
 * PN-Counter CRDT (Positive-Negative Counter)
 *
 * A counter that can be both incremented and decremented.
 * Implemented as two G-Counters: one for increments, one for decrements.
 *
 * Perfect for:
 * - Token balances
 * - Inventory counts
 * - Any value that can go up and down
 *
 * @see https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type#PN-Counter
 */

import type { PNCounterState, CRDTMergeResult } from '../types.js';

/**
 * Create a new PN-Counter state
 */
export function createPNCounter(): PNCounterState {
  return {
    positive: {},
    negative: {},
  };
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
  state: PNCounterState,
  deviceId: string,
  amount: number = 1
): PNCounterState {
  if (amount < 0) {
    throw new Error('Increment amount must be positive. Use decrement() for negative values.');
  }

  if (amount === 0) {
    return state;
  }

  const currentCount = state.positive[deviceId] ?? 0;
  return {
    positive: {
      ...state.positive,
      [deviceId]: currentCount + amount,
    },
    negative: { ...state.negative },
  };
}

/**
 * Decrement the counter for a specific device
 *
 * @param state - Current counter state
 * @param deviceId - Device performing the decrement
 * @param amount - Amount to decrement (must be positive)
 * @returns New counter state
 */
export function decrement(
  state: PNCounterState,
  deviceId: string,
  amount: number = 1
): PNCounterState {
  if (amount < 0) {
    throw new Error('Decrement amount must be positive');
  }

  if (amount === 0) {
    return state;
  }

  const currentCount = state.negative[deviceId] ?? 0;
  return {
    positive: { ...state.positive },
    negative: {
      ...state.negative,
      [deviceId]: currentCount + amount,
    },
  };
}

/**
 * Get the total value of the counter (positive - negative)
 *
 * @param state - Counter state
 * @returns Net count across all devices
 */
export function getValue(state: PNCounterState): number {
  const positiveSum = Object.values(state.positive).reduce((sum, count) => sum + count, 0);
  const negativeSum = Object.values(state.negative).reduce((sum, count) => sum + count, 0);
  return positiveSum - negativeSum;
}

/**
 * Get the positive count for a specific device
 */
export function getPositiveCount(state: PNCounterState, deviceId: string): number {
  return state.positive[deviceId] ?? 0;
}

/**
 * Get the negative count for a specific device
 */
export function getNegativeCount(state: PNCounterState, deviceId: string): number {
  return state.negative[deviceId] ?? 0;
}

/**
 * Merge two PN-Counter states
 *
 * Merges both positive and negative G-Counters independently,
 * taking the maximum for each device in each counter.
 *
 * @param local - Local counter state
 * @param remote - Remote counter state
 * @returns Merged result
 */
export function merge(
  local: PNCounterState,
  remote: PNCounterState
): CRDTMergeResult<PNCounterState> {
  const allPositiveDevices = new Set([
    ...Object.keys(local.positive),
    ...Object.keys(remote.positive),
  ]);

  const allNegativeDevices = new Set([
    ...Object.keys(local.negative),
    ...Object.keys(remote.negative),
  ]);

  const mergedPositive: Record<string, number> = {};
  const mergedNegative: Record<string, number> = {};
  let hadConflict = false;

  // Merge positive counts
  for (const deviceId of allPositiveDevices) {
    const localCount = local.positive[deviceId] ?? 0;
    const remoteCount = remote.positive[deviceId] ?? 0;
    mergedPositive[deviceId] = Math.max(localCount, remoteCount);

    if (localCount > 0 && remoteCount > 0 && localCount !== remoteCount) {
      hadConflict = true;
    }
  }

  // Merge negative counts
  for (const deviceId of allNegativeDevices) {
    const localCount = local.negative[deviceId] ?? 0;
    const remoteCount = remote.negative[deviceId] ?? 0;
    mergedNegative[deviceId] = Math.max(localCount, remoteCount);

    if (localCount > 0 && remoteCount > 0 && localCount !== remoteCount) {
      hadConflict = true;
    }
  }

  return {
    value: {
      positive: mergedPositive,
      negative: mergedNegative,
    },
    hadConflict,
  };
}

/**
 * Compare two PN-Counter states
 *
 * Note: PN-Counters can be incomparable when concurrent updates
 * affect both positive and negative counters differently.
 *
 * @param a - First state
 * @param b - Second state
 * @returns -1 if a < b, 0 if equal, 1 if a > b, undefined if incomparable
 */
export function compare(
  a: PNCounterState,
  b: PNCounterState
): -1 | 0 | 1 | undefined {
  const allDevices = new Set([
    ...Object.keys(a.positive),
    ...Object.keys(a.negative),
    ...Object.keys(b.positive),
    ...Object.keys(b.negative),
  ]);

  let aGreaterPositive = false;
  let bGreaterPositive = false;
  let aGreaterNegative = false;
  let bGreaterNegative = false;

  for (const deviceId of allDevices) {
    const aPos = a.positive[deviceId] ?? 0;
    const bPos = b.positive[deviceId] ?? 0;
    const aNeg = a.negative[deviceId] ?? 0;
    const bNeg = b.negative[deviceId] ?? 0;

    if (aPos > bPos) aGreaterPositive = true;
    if (bPos > aPos) bGreaterPositive = true;
    if (aNeg > bNeg) aGreaterNegative = true;
    if (bNeg > aNeg) bGreaterNegative = true;
  }

  // If any counter is incomparable, the whole state is incomparable
  if ((aGreaterPositive && bGreaterPositive) || (aGreaterNegative && bGreaterNegative)) {
    return undefined;
  }

  // If positive is greater but negative is less (or vice versa), incomparable
  if ((aGreaterPositive || aGreaterNegative) && (bGreaterPositive || bGreaterNegative)) {
    return undefined;
  }

  const aGreater = aGreaterPositive || aGreaterNegative;
  const bGreater = bGreaterPositive || bGreaterNegative;

  if (aGreater && !bGreater) return 1;
  if (bGreater && !aGreater) return -1;
  return 0;
}

/**
 * Serialize PN-Counter state for storage/transmission
 */
export function serialize(state: PNCounterState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize PN-Counter state
 */
export function deserialize(data: string): PNCounterState {
  const parsed = JSON.parse(data);
  if (
    !parsed.positive ||
    !parsed.negative ||
    typeof parsed.positive !== 'object' ||
    typeof parsed.negative !== 'object'
  ) {
    throw new Error('Invalid PN-Counter state');
  }
  return parsed as PNCounterState;
}

/**
 * Clone a PN-Counter state (immutable operation helper)
 */
export function clone(state: PNCounterState): PNCounterState {
  return {
    positive: { ...state.positive },
    negative: { ...state.negative },
  };
}
