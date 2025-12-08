/**
 * OR-Set CRDT (Observed-Remove Set)
 *
 * A set that supports both add and remove operations.
 * Uses unique tags to track additions, allowing proper removal semantics.
 *
 * Key property: Add wins over concurrent remove of the same element.
 *
 * Perfect for:
 * - IAB classifications
 * - Mission tags
 * - Trusted peers list
 * - Favorites/collections
 *
 * @see https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type#OR-Set
 */

import type { ORSetState, CRDTMergeResult } from '../types.js';

/**
 * Element entry with metadata
 */
interface ElementEntry<T> {
  value: T;
  addedBy: string;
  timestamp: number;
}

/**
 * Create a new OR-Set state
 */
export function createORSet<T>(): ORSetState<T> {
  return {
    elements: new Map(),
    tombstones: new Set(),
  };
}

/**
 * Generate a unique tag for an element addition
 */
function generateTag(deviceId: string, timestamp: number): string {
  return `${deviceId}:${timestamp}:${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add an element to the set
 *
 * @param state - Current set state
 * @param value - Value to add
 * @param deviceId - Device performing the add
 * @returns New set state
 */
export function add<T>(
  state: ORSetState<T>,
  value: T,
  deviceId: string
): ORSetState<T> {
  const timestamp = Date.now();
  const tag = generateTag(deviceId, timestamp);

  const newElements = new Map(state.elements);
  newElements.set(tag, { value, addedBy: deviceId, timestamp });

  return {
    elements: newElements,
    tombstones: new Set(state.tombstones),
  };
}

/**
 * Remove an element from the set
 *
 * Removes all instances of the value by adding their tags to tombstones.
 * Only removes locally observed additions - future adds will still work.
 *
 * @param state - Current set state
 * @param value - Value to remove
 * @returns New set state
 */
export function remove<T>(state: ORSetState<T>, value: T): ORSetState<T> {
  const newTombstones = new Set(state.tombstones);

  // Find all tags for this value and add to tombstones
  for (const [tag, entry] of state.elements) {
    if (deepEqual(entry.value, value)) {
      newTombstones.add(tag);
    }
  }

  return {
    elements: new Map(state.elements),
    tombstones: newTombstones,
  };
}

/**
 * Check if an element is in the set
 *
 * @param state - Set state
 * @param value - Value to check
 * @returns Whether the value is present
 */
export function has<T>(state: ORSetState<T>, value: T): boolean {
  for (const [tag, entry] of state.elements) {
    if (!state.tombstones.has(tag) && deepEqual(entry.value, value)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all values in the set (deduplicated)
 *
 * @param state - Set state
 * @returns Array of unique values
 */
export function getValues<T>(state: ORSetState<T>): T[] {
  const seen = new Set<string>();
  const values: T[] = [];

  for (const [tag, entry] of state.elements) {
    if (!state.tombstones.has(tag)) {
      const key = JSON.stringify(entry.value);
      if (!seen.has(key)) {
        seen.add(key);
        values.push(entry.value);
      }
    }
  }

  return values;
}

/**
 * Get the size of the set (unique values)
 */
export function size<T>(state: ORSetState<T>): number {
  return getValues(state).length;
}

/**
 * Merge two OR-Set states
 *
 * Union of all elements minus union of all tombstones.
 * Add wins over concurrent remove (if same element added and removed
 * concurrently, it remains in the set).
 *
 * @param local - Local set state
 * @param remote - Remote set state
 * @returns Merged result
 */
export function merge<T>(
  local: ORSetState<T>,
  remote: ORSetState<T>
): CRDTMergeResult<ORSetState<T>> {
  // Union of all elements
  const mergedElements = new Map<string, ElementEntry<T>>();

  for (const [tag, entry] of local.elements) {
    mergedElements.set(tag, entry);
  }

  for (const [tag, entry] of remote.elements) {
    if (!mergedElements.has(tag)) {
      mergedElements.set(tag, entry);
    }
  }

  // Union of all tombstones
  const mergedTombstones = new Set([...local.tombstones, ...remote.tombstones]);

  // Detect conflicts (same value added by different devices)
  const hadConflict = detectConflicts(local, remote);

  return {
    value: {
      elements: mergedElements,
      tombstones: mergedTombstones,
    },
    hadConflict,
  };
}

/**
 * Detect if there were concurrent conflicting operations
 */
function detectConflicts<T>(local: ORSetState<T>, remote: ORSetState<T>): boolean {
  // Check for value added in one and removed in the other
  for (const [localTag, localEntry] of local.elements) {
    if (remote.tombstones.has(localTag)) {
      // Local add, remote remove - this is a conflict (add wins)
      return true;
    }
  }

  for (const [remoteTag, remoteEntry] of remote.elements) {
    if (local.tombstones.has(remoteTag)) {
      // Remote add, local remove - this is a conflict (add wins)
      return true;
    }
  }

  return false;
}

/**
 * Compare two OR-Set states
 *
 * @returns -1 if a ⊂ b, 0 if equal, 1 if a ⊃ b, undefined if incomparable
 */
export function compare<T>(
  a: ORSetState<T>,
  b: ORSetState<T>
): -1 | 0 | 1 | undefined {
  const aValues = new Set(getValues(a).map((v) => JSON.stringify(v)));
  const bValues = new Set(getValues(b).map((v) => JSON.stringify(v)));

  let aHasExtra = false;
  let bHasExtra = false;

  for (const v of aValues) {
    if (!bValues.has(v)) aHasExtra = true;
  }

  for (const v of bValues) {
    if (!aValues.has(v)) bHasExtra = true;
  }

  if (aHasExtra && bHasExtra) return undefined; // Incomparable
  if (aHasExtra) return 1;
  if (bHasExtra) return -1;
  return 0;
}

/**
 * Serialize OR-Set state for storage/transmission
 */
export function serialize<T>(state: ORSetState<T>): string {
  return JSON.stringify({
    elements: Array.from(state.elements.entries()),
    tombstones: Array.from(state.tombstones),
  });
}

/**
 * Deserialize OR-Set state
 */
export function deserialize<T>(data: string): ORSetState<T> {
  const parsed = JSON.parse(data);

  if (!Array.isArray(parsed.elements) || !Array.isArray(parsed.tombstones)) {
    throw new Error('Invalid OR-Set state');
  }

  return {
    elements: new Map(parsed.elements),
    tombstones: new Set(parsed.tombstones),
  };
}

/**
 * Clone an OR-Set state (immutable operation helper)
 */
export function clone<T>(state: ORSetState<T>): ORSetState<T> {
  return {
    elements: new Map(state.elements),
    tombstones: new Set(state.tombstones),
  };
}

/**
 * Deep equality check for values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Get metadata about when an element was added
 */
export function getElementMetadata<T>(
  state: ORSetState<T>,
  value: T
): { addedBy: string; timestamp: number } | null {
  for (const [tag, entry] of state.elements) {
    if (!state.tombstones.has(tag) && deepEqual(entry.value, value)) {
      return { addedBy: entry.addedBy, timestamp: entry.timestamp };
    }
  }
  return null;
}

/**
 * Remove all tombstoned entries (garbage collection)
 *
 * Call this periodically to clean up removed entries.
 * Only safe when all replicas have seen the tombstones.
 */
export function compact<T>(state: ORSetState<T>): ORSetState<T> {
  const newElements = new Map<string, ElementEntry<T>>();

  for (const [tag, entry] of state.elements) {
    if (!state.tombstones.has(tag)) {
      newElements.set(tag, entry);
    }
  }

  // Keep tombstones - they're needed for future merges
  // In production, implement tombstone GC based on vector clocks
  return {
    elements: newElements,
    tombstones: state.tombstones,
  };
}
