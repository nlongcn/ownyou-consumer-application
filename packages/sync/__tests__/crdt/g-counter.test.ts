/**
 * G-Counter CRDT Tests
 */

import { describe, it, expect } from 'vitest';
import * as GCounter from '../../src/crdt/g-counter.js';

describe('G-Counter', () => {
  describe('createGCounter', () => {
    it('should create an empty counter', () => {
      const counter = GCounter.createGCounter();
      expect(counter.counts).toEqual({});
      expect(GCounter.getValue(counter)).toBe(0);
    });
  });

  describe('increment', () => {
    it('should increment by 1 by default', () => {
      let counter = GCounter.createGCounter();
      counter = GCounter.increment(counter, 'device-1');

      expect(counter.counts['device-1']).toBe(1);
      expect(GCounter.getValue(counter)).toBe(1);
    });

    it('should increment by specified amount', () => {
      let counter = GCounter.createGCounter();
      counter = GCounter.increment(counter, 'device-1', 5);

      expect(counter.counts['device-1']).toBe(5);
      expect(GCounter.getValue(counter)).toBe(5);
    });

    it('should accumulate increments from same device', () => {
      let counter = GCounter.createGCounter();
      counter = GCounter.increment(counter, 'device-1', 3);
      counter = GCounter.increment(counter, 'device-1', 2);

      expect(counter.counts['device-1']).toBe(5);
      expect(GCounter.getValue(counter)).toBe(5);
    });

    it('should track increments from multiple devices', () => {
      let counter = GCounter.createGCounter();
      counter = GCounter.increment(counter, 'device-1', 3);
      counter = GCounter.increment(counter, 'device-2', 7);

      expect(counter.counts['device-1']).toBe(3);
      expect(counter.counts['device-2']).toBe(7);
      expect(GCounter.getValue(counter)).toBe(10);
    });

    it('should throw on negative increment', () => {
      const counter = GCounter.createGCounter();
      expect(() => GCounter.increment(counter, 'device-1', -1)).toThrow();
    });

    it('should return same state for zero increment', () => {
      const counter = GCounter.createGCounter();
      const result = GCounter.increment(counter, 'device-1', 0);
      expect(result).toBe(counter);
    });
  });

  describe('getDeviceCount', () => {
    it('should return 0 for unknown device', () => {
      const counter = GCounter.createGCounter();
      expect(GCounter.getDeviceCount(counter, 'unknown')).toBe(0);
    });

    it('should return correct count for known device', () => {
      let counter = GCounter.createGCounter();
      counter = GCounter.increment(counter, 'device-1', 5);

      expect(GCounter.getDeviceCount(counter, 'device-1')).toBe(5);
    });
  });

  describe('merge', () => {
    it('should merge two empty counters', () => {
      const a = GCounter.createGCounter();
      const b = GCounter.createGCounter();
      const result = GCounter.merge(a, b);

      expect(result.value.counts).toEqual({});
      expect(result.hadConflict).toBe(false);
    });

    it('should take max for each device', () => {
      let a = GCounter.createGCounter();
      a = GCounter.increment(a, 'device-1', 3);
      a = GCounter.increment(a, 'device-2', 5);

      let b = GCounter.createGCounter();
      b = GCounter.increment(b, 'device-1', 7);
      b = GCounter.increment(b, 'device-3', 2);

      const result = GCounter.merge(a, b);

      expect(result.value.counts['device-1']).toBe(7);
      expect(result.value.counts['device-2']).toBe(5);
      expect(result.value.counts['device-3']).toBe(2);
      expect(GCounter.getValue(result.value)).toBe(14);
    });

    it('should detect conflicts when same device has different values', () => {
      let a = GCounter.createGCounter();
      a = GCounter.increment(a, 'device-1', 3);

      let b = GCounter.createGCounter();
      b = GCounter.increment(b, 'device-1', 5);

      const result = GCounter.merge(a, b);

      expect(result.hadConflict).toBe(true);
      expect(result.value.counts['device-1']).toBe(5);
    });

    it('should be commutative', () => {
      let a = GCounter.createGCounter();
      a = GCounter.increment(a, 'device-1', 3);

      let b = GCounter.createGCounter();
      b = GCounter.increment(b, 'device-2', 5);

      const result1 = GCounter.merge(a, b);
      const result2 = GCounter.merge(b, a);

      expect(result1.value.counts).toEqual(result2.value.counts);
    });

    it('should be associative', () => {
      let a = GCounter.createGCounter();
      a = GCounter.increment(a, 'device-1', 1);

      let b = GCounter.createGCounter();
      b = GCounter.increment(b, 'device-2', 2);

      let c = GCounter.createGCounter();
      c = GCounter.increment(c, 'device-3', 3);

      const result1 = GCounter.merge(GCounter.merge(a, b).value, c);
      const result2 = GCounter.merge(a, GCounter.merge(b, c).value);

      expect(result1.value.counts).toEqual(result2.value.counts);
    });

    it('should be idempotent', () => {
      let counter = GCounter.createGCounter();
      counter = GCounter.increment(counter, 'device-1', 5);

      const result = GCounter.merge(counter, counter);

      expect(result.value.counts).toEqual(counter.counts);
    });
  });

  describe('compare', () => {
    it('should return 0 for equal counters', () => {
      let a = GCounter.createGCounter();
      a = GCounter.increment(a, 'device-1', 5);

      let b = GCounter.createGCounter();
      b = GCounter.increment(b, 'device-1', 5);

      expect(GCounter.compare(a, b)).toBe(0);
    });

    it('should return 1 when a > b', () => {
      let a = GCounter.createGCounter();
      a = GCounter.increment(a, 'device-1', 5);

      let b = GCounter.createGCounter();
      b = GCounter.increment(b, 'device-1', 3);

      expect(GCounter.compare(a, b)).toBe(1);
    });

    it('should return -1 when a < b', () => {
      let a = GCounter.createGCounter();
      a = GCounter.increment(a, 'device-1', 3);

      let b = GCounter.createGCounter();
      b = GCounter.increment(b, 'device-1', 5);

      expect(GCounter.compare(a, b)).toBe(-1);
    });

    it('should return undefined for concurrent updates', () => {
      let a = GCounter.createGCounter();
      a = GCounter.increment(a, 'device-1', 5);
      a = GCounter.increment(a, 'device-2', 3);

      let b = GCounter.createGCounter();
      b = GCounter.increment(b, 'device-1', 3);
      b = GCounter.increment(b, 'device-2', 7);

      expect(GCounter.compare(a, b)).toBeUndefined();
    });
  });

  describe('serialize/deserialize', () => {
    it('should round-trip counter state', () => {
      let counter = GCounter.createGCounter();
      counter = GCounter.increment(counter, 'device-1', 5);
      counter = GCounter.increment(counter, 'device-2', 3);

      const serialized = GCounter.serialize(counter);
      const deserialized = GCounter.deserialize(serialized);

      expect(deserialized.counts).toEqual(counter.counts);
    });

    it('should throw on invalid data', () => {
      expect(() => GCounter.deserialize('{}')).toThrow();
      expect(() => GCounter.deserialize('{"counts": null}')).toThrow();
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      let counter = GCounter.createGCounter();
      counter = GCounter.increment(counter, 'device-1', 5);

      const cloned = GCounter.clone(counter);
      cloned.counts['device-1'] = 100;

      expect(counter.counts['device-1']).toBe(5);
    });
  });
});
