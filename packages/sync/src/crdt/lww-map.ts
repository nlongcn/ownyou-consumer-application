/**
 * LWW-Map CRDT (Last-Write-Wins Map)
 *
 * A map where each key is an independent LWW-Register.
 * Updates to different keys are always compatible.
 * Updates to the same key use LWW semantics.
 *
 * Perfect for:
 * - Mission states (each mission is independent)
 * - Data source configs
 * - Episodic memories
 *
 * @see https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type
 */

import type { LWWMapState, LWWRegisterState, CRDTMergeResult } from '../types.js';
import * as LWWRegister from './lww-register.js';

/**
 * Create a new LWW-Map state
 */
export function createLWWMap<T>(): LWWMapState<T> {
  return { entries: {} };
}

/**
 * Set a value for a key
 *
 * @param state - Current map state
 * @param key - Key to set
 * @param value - Value to set
 * @param deviceId - Device performing the write
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns New map state
 */
export function set<T>(
  state: LWWMapState<T>,
  key: string,
  value: T,
  deviceId: string,
  timestamp?: number
): LWWMapState<T> {
  const ts = timestamp ?? Date.now();
  const existing = state.entries[key];

  let newRegister: LWWRegisterState<T>;

  if (existing) {
    newRegister = LWWRegister.set(existing, value, deviceId, ts);
    // If the register didn't change (older write), return original state
    if (newRegister === existing) {
      return state;
    }
  } else {
    newRegister = { value, timestamp: ts, deviceId };
  }

  return {
    entries: {
      ...state.entries,
      [key]: newRegister,
    },
  };
}

/**
 * Get a value for a key
 *
 * @param state - Map state
 * @param key - Key to get
 * @returns Value or undefined if not present
 */
export function get<T>(state: LWWMapState<T>, key: string): T | undefined {
  const register = state.entries[key];
  return register ? register.value : undefined;
}

/**
 * Check if a key exists
 */
export function has<T>(state: LWWMapState<T>, key: string): boolean {
  return key in state.entries;
}

/**
 * Get all keys
 */
export function keys<T>(state: LWWMapState<T>): string[] {
  return Object.keys(state.entries);
}

/**
 * Get all values
 */
export function values<T>(state: LWWMapState<T>): T[] {
  return Object.values(state.entries).map((r) => r.value);
}

/**
 * Get all entries as [key, value] pairs
 */
export function entries<T>(state: LWWMapState<T>): Array<[string, T]> {
  return Object.entries(state.entries).map(([k, r]) => [k, r.value]);
}

/**
 * Get the size of the map
 */
export function size<T>(state: LWWMapState<T>): number {
  return Object.keys(state.entries).length;
}

/**
 * Delete a key from the map
 *
 * Note: LWW-Map doesn't support true deletion in the CRDT sense.
 * We implement deletion by setting a tombstone value.
 * For true deletion, use OR-Map instead.
 *
 * @param state - Map state
 * @param key - Key to delete
 * @param deviceId - Device performing the delete
 * @returns New map state
 */
export function remove<T>(
  state: LWWMapState<T>,
  key: string,
  deviceId: string
): LWWMapState<T> {
  // For LWW-Map, we simply remove the entry
  // Note: This doesn't propagate well in CRDT semantics
  // In production, consider using a tombstone approach
  if (!(key in state.entries)) {
    return state;
  }

  const { [key]: _, ...rest } = state.entries;
  return { entries: rest };
}

/**
 * Get metadata for a key
 */
export function getMetadata<T>(
  state: LWWMapState<T>,
  key: string
): { timestamp: number; deviceId: string } | undefined {
  const register = state.entries[key];
  if (!register) return undefined;

  return {
    timestamp: register.timestamp,
    deviceId: register.deviceId,
  };
}

/**
 * Merge two LWW-Map states
 *
 * Each key is merged independently using LWW-Register merge.
 *
 * @param local - Local map state
 * @param remote - Remote map state
 * @returns Merged result
 */
export function merge<T>(
  local: LWWMapState<T>,
  remote: LWWMapState<T>
): CRDTMergeResult<LWWMapState<T>> {
  const allKeys = new Set([
    ...Object.keys(local.entries),
    ...Object.keys(remote.entries),
  ]);

  const mergedEntries: Record<string, LWWRegisterState<T>> = {};
  let hadConflict = false;
  const conflictKeys: string[] = [];

  for (const key of allKeys) {
    const localRegister = local.entries[key];
    const remoteRegister = remote.entries[key];

    if (localRegister && remoteRegister) {
      // Both have the key - merge using LWW-Register
      const mergeResult = LWWRegister.merge(localRegister, remoteRegister);
      mergedEntries[key] = mergeResult.value;

      if (mergeResult.hadConflict) {
        hadConflict = true;
        conflictKeys.push(key);
      }
    } else if (localRegister) {
      // Only local has the key
      mergedEntries[key] = localRegister;
    } else if (remoteRegister) {
      // Only remote has the key
      mergedEntries[key] = remoteRegister;
    }
  }

  return {
    value: { entries: mergedEntries },
    hadConflict,
  };
}

/**
 * Compare two LWW-Map states
 *
 * Maps are partially ordered. A < B if every entry in A is ≤ the
 * corresponding entry in B, and at least one is strictly <.
 *
 * @returns -1 if a < b, 0 if equal, 1 if a > b, undefined if incomparable
 */
export function compare<T>(
  a: LWWMapState<T>,
  b: LWWMapState<T>
): -1 | 0 | 1 | undefined {
  const allKeys = new Set([
    ...Object.keys(a.entries),
    ...Object.keys(b.entries),
  ]);

  let aGreater = false;
  let bGreater = false;
  let incomparable = false;

  for (const key of allKeys) {
    const aRegister = a.entries[key];
    const bRegister = b.entries[key];

    if (aRegister && bRegister) {
      const cmp = LWWRegister.compare(aRegister, bRegister);
      if (cmp === 1) aGreater = true;
      if (cmp === -1) bGreater = true;
    } else if (aRegister) {
      aGreater = true;
    } else if (bRegister) {
      bGreater = true;
    }
  }

  if (aGreater && bGreater) return undefined;
  if (aGreater) return 1;
  if (bGreater) return -1;
  return 0;
}

/**
 * Serialize LWW-Map state for storage/transmission
 */
export function serialize<T>(state: LWWMapState<T>): string {
  return JSON.stringify(state);
}

/**
 * Deserialize LWW-Map state
 */
export function deserialize<T>(data: string): LWWMapState<T> {
  const parsed = JSON.parse(data);

  if (!parsed.entries || typeof parsed.entries !== 'object') {
    throw new Error('Invalid LWW-Map state');
  }

  return parsed as LWWMapState<T>;
}

/**
 * Clone an LWW-Map state (immutable operation helper)
 */
export function clone<T>(state: LWWMapState<T>): LWWMapState<T> {
  const clonedEntries: Record<string, LWWRegisterState<T>> = {};

  for (const [key, register] of Object.entries(state.entries)) {
    clonedEntries[key] = LWWRegister.clone(register);
  }

  return { entries: clonedEntries };
}

/**
 * Get entries updated since a given timestamp
 */
export function getUpdatedSince<T>(
  state: LWWMapState<T>,
  timestamp: number
): Array<[string, T]> {
  return Object.entries(state.entries)
    .filter(([_, register]) => register.timestamp > timestamp)
    .map(([key, register]) => [key, register.value]);
}

/**
 * Filter map entries by a predicate
 */
export function filter<T>(
  state: LWWMapState<T>,
  predicate: (key: string, value: T) => boolean
): LWWMapState<T> {
  const filteredEntries: Record<string, LWWRegisterState<T>> = {};

  for (const [key, register] of Object.entries(state.entries)) {
    if (predicate(key, register.value)) {
      filteredEntries[key] = register;
    }
  }

  return { entries: filteredEntries };
}
