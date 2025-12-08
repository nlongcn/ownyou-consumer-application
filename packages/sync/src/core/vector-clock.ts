/**
 * Vector Clock Implementation
 *
 * Provides causal ordering for distributed operations.
 * Each device maintains a logical timestamp that increments on each operation.
 *
 * @see https://en.wikipedia.org/wiki/Vector_clock
 */

import type { VectorClock } from '../types.js';

/**
 * Create a new vector clock
 *
 * @param deviceId - Initial device ID
 * @returns New vector clock
 */
export function createVectorClock(deviceId?: string): VectorClock {
  if (deviceId) {
    return { [deviceId]: 0 };
  }
  return {};
}

/**
 * Increment the clock for a device
 *
 * @param clock - Current vector clock
 * @param deviceId - Device to increment
 * @returns New vector clock
 */
export function increment(clock: VectorClock, deviceId: string): VectorClock {
  return {
    ...clock,
    [deviceId]: (clock[deviceId] ?? 0) + 1,
  };
}

/**
 * Get the logical timestamp for a device
 */
export function getTimestamp(clock: VectorClock, deviceId: string): number {
  return clock[deviceId] ?? 0;
}

/**
 * Merge two vector clocks
 *
 * Takes the maximum timestamp for each device.
 *
 * @param a - First vector clock
 * @param b - Second vector clock
 * @returns Merged vector clock
 */
export function merge(a: VectorClock, b: VectorClock): VectorClock {
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
  const result: VectorClock = {};

  for (const deviceId of allDevices) {
    result[deviceId] = Math.max(a[deviceId] ?? 0, b[deviceId] ?? 0);
  }

  return result;
}

/**
 * Compare two vector clocks
 *
 * @returns 'before' if a happened-before b
 *          'after' if b happened-before a
 *          'concurrent' if neither happened-before the other
 *          'equal' if they are identical
 */
export function compare(
  a: VectorClock,
  b: VectorClock
): 'before' | 'after' | 'concurrent' | 'equal' {
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);

  let aLess = false;
  let bLess = false;

  for (const deviceId of allDevices) {
    const aTime = a[deviceId] ?? 0;
    const bTime = b[deviceId] ?? 0;

    if (aTime < bTime) aLess = true;
    if (bTime < aTime) bLess = true;
  }

  if (!aLess && !bLess) return 'equal';
  if (aLess && !bLess) return 'before';
  if (bLess && !aLess) return 'after';
  return 'concurrent';
}

/**
 * Check if clock a happened-before clock b
 */
export function happenedBefore(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === 'before';
}

/**
 * Check if clock a happened-after clock b
 */
export function happenedAfter(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === 'after';
}

/**
 * Check if two clocks are concurrent (neither happened-before)
 */
export function isConcurrent(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === 'concurrent';
}

/**
 * Check if two clocks are equal
 */
export function isEqual(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === 'equal';
}

/**
 * Check if clock a dominates clock b (a >= b for all entries)
 */
export function dominates(a: VectorClock, b: VectorClock): boolean {
  const result = compare(a, b);
  return result === 'after' || result === 'equal';
}

/**
 * Serialize a vector clock for storage/transmission
 */
export function serialize(clock: VectorClock): string {
  return JSON.stringify(clock);
}

/**
 * Deserialize a vector clock
 */
export function deserialize(data: string): VectorClock {
  const parsed = JSON.parse(data);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid vector clock');
  }
  return parsed as VectorClock;
}

/**
 * Clone a vector clock
 */
export function clone(clock: VectorClock): VectorClock {
  return { ...clock };
}

/**
 * Get the total count across all devices (for debugging)
 */
export function sum(clock: VectorClock): number {
  return Object.values(clock).reduce((acc, val) => acc + val, 0);
}

/**
 * Get all device IDs in the clock
 */
export function getDevices(clock: VectorClock): string[] {
  return Object.keys(clock);
}

/**
 * Check if clock has entries for a device
 */
export function hasDevice(clock: VectorClock, deviceId: string): boolean {
  return deviceId in clock;
}

/**
 * Remove a device from the clock (for garbage collection)
 */
export function removeDevice(clock: VectorClock, deviceId: string): VectorClock {
  const { [deviceId]: _, ...rest } = clock;
  return rest;
}
