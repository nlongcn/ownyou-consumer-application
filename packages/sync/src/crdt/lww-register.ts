/**
 * LWW-Register CRDT (Last-Write-Wins Register)
 *
 * A register that resolves conflicts by keeping the value with the latest timestamp.
 * Ties are broken by device ID comparison.
 *
 * Perfect for:
 * - User preferences
 * - Profile settings
 * - Any atomic field where "latest wins" is appropriate
 *
 * @see https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type#LWW-Register
 */

import type { LWWRegisterState, CRDTMergeResult } from '../types.js';

/**
 * Create a new LWW-Register state
 *
 * @param value - Initial value
 * @param deviceId - Device creating the register
 */
export function createLWWRegister<T>(value: T, deviceId: string): LWWRegisterState<T> {
  return {
    value,
    timestamp: Date.now(),
    deviceId,
  };
}

/**
 * Set a new value in the register
 *
 * @param state - Current register state
 * @param value - New value
 * @param deviceId - Device performing the write
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns New register state
 */
export function set<T>(
  state: LWWRegisterState<T>,
  value: T,
  deviceId: string,
  timestamp?: number
): LWWRegisterState<T> {
  const ts = timestamp ?? Date.now();

  // Only update if this write is newer
  if (isNewer(ts, deviceId, state.timestamp, state.deviceId)) {
    return { value, timestamp: ts, deviceId };
  }

  return state;
}

/**
 * Get the current value
 */
export function getValue<T>(state: LWWRegisterState<T>): T {
  return state.value;
}

/**
 * Get metadata about the current value
 */
export function getMetadata<T>(
  state: LWWRegisterState<T>
): { timestamp: number; deviceId: string } {
  return {
    timestamp: state.timestamp,
    deviceId: state.deviceId,
  };
}

/**
 * Check if (ts1, device1) is newer than (ts2, device2)
 *
 * Timestamps are compared first. If equal, device IDs are
 * compared lexicographically for deterministic tie-breaking.
 */
function isNewer(
  ts1: number,
  device1: string,
  ts2: number,
  device2: string
): boolean {
  if (ts1 !== ts2) {
    return ts1 > ts2;
  }
  // Tie-breaker: lexicographic comparison of device IDs
  return device1 > device2;
}

/**
 * Merge two LWW-Register states
 *
 * The value with the latest timestamp wins.
 * Ties are broken by device ID.
 *
 * @param local - Local register state
 * @param remote - Remote register state
 * @returns Merged result
 */
export function merge<T>(
  local: LWWRegisterState<T>,
  remote: LWWRegisterState<T>
): CRDTMergeResult<LWWRegisterState<T>> {
  const hadConflict = local.timestamp === remote.timestamp && local.deviceId !== remote.deviceId;

  if (isNewer(remote.timestamp, remote.deviceId, local.timestamp, local.deviceId)) {
    return {
      value: remote,
      hadConflict,
      winningDeviceId: remote.deviceId,
    };
  }

  return {
    value: local,
    hadConflict,
    winningDeviceId: hadConflict ? local.deviceId : undefined,
  };
}

/**
 * Compare two LWW-Register states
 *
 * @returns -1 if a < b (older), 0 if equal, 1 if a > b (newer)
 */
export function compare<T>(
  a: LWWRegisterState<T>,
  b: LWWRegisterState<T>
): -1 | 0 | 1 {
  if (a.timestamp === b.timestamp && a.deviceId === b.deviceId) {
    return 0;
  }

  if (isNewer(a.timestamp, a.deviceId, b.timestamp, b.deviceId)) {
    return 1;
  }

  return -1;
}

/**
 * Serialize LWW-Register state for storage/transmission
 */
export function serialize<T>(state: LWWRegisterState<T>): string {
  return JSON.stringify(state);
}

/**
 * Deserialize LWW-Register state
 */
export function deserialize<T>(data: string): LWWRegisterState<T> {
  const parsed = JSON.parse(data);

  if (
    typeof parsed.timestamp !== 'number' ||
    typeof parsed.deviceId !== 'string' ||
    !('value' in parsed)
  ) {
    throw new Error('Invalid LWW-Register state');
  }

  return parsed as LWWRegisterState<T>;
}

/**
 * Clone an LWW-Register state (immutable operation helper)
 */
export function clone<T>(state: LWWRegisterState<T>): LWWRegisterState<T> {
  return {
    value: structuredClone(state.value),
    timestamp: state.timestamp,
    deviceId: state.deviceId,
  };
}

/**
 * Check if register has been updated since a given timestamp
 */
export function isUpdatedSince<T>(
  state: LWWRegisterState<T>,
  timestamp: number
): boolean {
  return state.timestamp > timestamp;
}
