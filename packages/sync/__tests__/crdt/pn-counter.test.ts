/**
 * PN-Counter CRDT Tests
 *
 * Tests for the Positive-Negative Counter, which supports both
 * increment and decrement operations.
 */

import { describe, it, expect } from 'vitest';
import * as PNCounter from '../../src/crdt/pn-counter.js';

describe('PN-Counter', () => {
  describe('createPNCounter', () => {
    it('should create an empty counter', () => {
      const counter = PNCounter.createPNCounter();
      expect(counter.positive).toEqual({});
      expect(counter.negative).toEqual({});
      expect(PNCounter.getValue(counter)).toBe(0);
    });
  });

  describe('increment', () => {
    it('should increment by 1 by default', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1');

      expect(counter.positive['device-1']).toBe(1);
      expect(PNCounter.getValue(counter)).toBe(1);
    });

    it('should increment by specified amount', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 5);

      expect(counter.positive['device-1']).toBe(5);
      expect(PNCounter.getValue(counter)).toBe(5);
    });

    it('should accumulate increments from same device', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 3);
      counter = PNCounter.increment(counter, 'device-1', 2);

      expect(counter.positive['device-1']).toBe(5);
      expect(PNCounter.getValue(counter)).toBe(5);
    });

    it('should track increments from multiple devices', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 3);
      counter = PNCounter.increment(counter, 'device-2', 7);

      expect(counter.positive['device-1']).toBe(3);
      expect(counter.positive['device-2']).toBe(7);
      expect(PNCounter.getValue(counter)).toBe(10);
    });

    it('should throw on negative increment', () => {
      const counter = PNCounter.createPNCounter();
      expect(() => PNCounter.increment(counter, 'device-1', -1)).toThrow(
        'Increment amount must be positive'
      );
    });

    it('should return same state for zero increment', () => {
      const counter = PNCounter.createPNCounter();
      const result = PNCounter.increment(counter, 'device-1', 0);
      expect(result).toBe(counter);
    });
  });

  describe('decrement', () => {
    it('should decrement by 1 by default', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.decrement(counter, 'device-1');

      expect(counter.negative['device-1']).toBe(1);
      expect(PNCounter.getValue(counter)).toBe(-1);
    });

    it('should decrement by specified amount', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.decrement(counter, 'device-1', 5);

      expect(counter.negative['device-1']).toBe(5);
      expect(PNCounter.getValue(counter)).toBe(-5);
    });

    it('should accumulate decrements from same device', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.decrement(counter, 'device-1', 3);
      counter = PNCounter.decrement(counter, 'device-1', 2);

      expect(counter.negative['device-1']).toBe(5);
      expect(PNCounter.getValue(counter)).toBe(-5);
    });

    it('should track decrements from multiple devices', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.decrement(counter, 'device-1', 3);
      counter = PNCounter.decrement(counter, 'device-2', 7);

      expect(counter.negative['device-1']).toBe(3);
      expect(counter.negative['device-2']).toBe(7);
      expect(PNCounter.getValue(counter)).toBe(-10);
    });

    it('should throw on negative decrement', () => {
      const counter = PNCounter.createPNCounter();
      expect(() => PNCounter.decrement(counter, 'device-1', -1)).toThrow(
        'Decrement amount must be positive'
      );
    });

    it('should return same state for zero decrement', () => {
      const counter = PNCounter.createPNCounter();
      const result = PNCounter.decrement(counter, 'device-1', 0);
      expect(result).toBe(counter);
    });
  });

  describe('combined increment and decrement', () => {
    it('should calculate net value correctly', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 10);
      counter = PNCounter.decrement(counter, 'device-1', 3);

      expect(PNCounter.getValue(counter)).toBe(7);
    });

    it('should handle multiple devices with increments and decrements', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 10);
      counter = PNCounter.decrement(counter, 'device-2', 3);
      counter = PNCounter.increment(counter, 'device-2', 5);
      counter = PNCounter.decrement(counter, 'device-1', 2);

      // Net: (10-2) + (5-3) = 8 + 2 = 10
      expect(PNCounter.getValue(counter)).toBe(10);
    });

    it('should allow value to go negative', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 5);
      counter = PNCounter.decrement(counter, 'device-2', 10);

      expect(PNCounter.getValue(counter)).toBe(-5);
    });
  });

  describe('getPositiveCount / getNegativeCount', () => {
    it('should return 0 for unknown device', () => {
      const counter = PNCounter.createPNCounter();
      expect(PNCounter.getPositiveCount(counter, 'unknown')).toBe(0);
      expect(PNCounter.getNegativeCount(counter, 'unknown')).toBe(0);
    });

    it('should return correct counts for known device', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 5);
      counter = PNCounter.decrement(counter, 'device-1', 3);

      expect(PNCounter.getPositiveCount(counter, 'device-1')).toBe(5);
      expect(PNCounter.getNegativeCount(counter, 'device-1')).toBe(3);
    });
  });

  describe('merge', () => {
    it('should merge two empty counters', () => {
      const a = PNCounter.createPNCounter();
      const b = PNCounter.createPNCounter();
      const result = PNCounter.merge(a, b);

      expect(result.value.positive).toEqual({});
      expect(result.value.negative).toEqual({});
      expect(result.hadConflict).toBe(false);
    });

    it('should take max for each device in positive counter', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 3);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-1', 7);

      const result = PNCounter.merge(a, b);

      expect(result.value.positive['device-1']).toBe(7);
    });

    it('should take max for each device in negative counter', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.decrement(a, 'device-1', 3);

      let b = PNCounter.createPNCounter();
      b = PNCounter.decrement(b, 'device-1', 7);

      const result = PNCounter.merge(a, b);

      expect(result.value.negative['device-1']).toBe(7);
    });

    it('should merge both positive and negative independently', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 10);
      a = PNCounter.decrement(a, 'device-1', 2);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-1', 5);
      b = PNCounter.decrement(b, 'device-1', 7);

      const result = PNCounter.merge(a, b);

      // Should take max of each: positive=max(10,5)=10, negative=max(2,7)=7
      expect(result.value.positive['device-1']).toBe(10);
      expect(result.value.negative['device-1']).toBe(7);
      expect(PNCounter.getValue(result.value)).toBe(3);
    });

    it('should combine updates from different devices', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 5);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-2', 3);
      b = PNCounter.decrement(b, 'device-3', 2);

      const result = PNCounter.merge(a, b);

      expect(result.value.positive['device-1']).toBe(5);
      expect(result.value.positive['device-2']).toBe(3);
      expect(result.value.negative['device-3']).toBe(2);
      expect(PNCounter.getValue(result.value)).toBe(6);
    });

    it('should detect conflicts when same device has different positive values', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 3);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-1', 5);

      const result = PNCounter.merge(a, b);

      expect(result.hadConflict).toBe(true);
      expect(result.value.positive['device-1']).toBe(5);
    });

    it('should detect conflicts when same device has different negative values', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.decrement(a, 'device-1', 3);

      let b = PNCounter.createPNCounter();
      b = PNCounter.decrement(b, 'device-1', 5);

      const result = PNCounter.merge(a, b);

      expect(result.hadConflict).toBe(true);
      expect(result.value.negative['device-1']).toBe(5);
    });

    it('should be commutative', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 3);
      a = PNCounter.decrement(a, 'device-1', 1);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-2', 5);
      b = PNCounter.decrement(b, 'device-2', 2);

      const result1 = PNCounter.merge(a, b);
      const result2 = PNCounter.merge(b, a);

      expect(result1.value.positive).toEqual(result2.value.positive);
      expect(result1.value.negative).toEqual(result2.value.negative);
    });

    it('should be associative', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 1);

      let b = PNCounter.createPNCounter();
      b = PNCounter.decrement(b, 'device-2', 2);

      let c = PNCounter.createPNCounter();
      c = PNCounter.increment(c, 'device-3', 3);

      const result1 = PNCounter.merge(PNCounter.merge(a, b).value, c);
      const result2 = PNCounter.merge(a, PNCounter.merge(b, c).value);

      expect(result1.value.positive).toEqual(result2.value.positive);
      expect(result1.value.negative).toEqual(result2.value.negative);
    });

    it('should be idempotent', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 5);
      counter = PNCounter.decrement(counter, 'device-1', 2);

      const result = PNCounter.merge(counter, counter);

      expect(result.value.positive).toEqual(counter.positive);
      expect(result.value.negative).toEqual(counter.negative);
    });
  });

  describe('compare', () => {
    it('should return 0 for equal counters', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 5);
      a = PNCounter.decrement(a, 'device-1', 2);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-1', 5);
      b = PNCounter.decrement(b, 'device-1', 2);

      expect(PNCounter.compare(a, b)).toBe(0);
    });

    it('should return 1 when a has greater positive count', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 5);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-1', 3);

      expect(PNCounter.compare(a, b)).toBe(1);
    });

    it('should return -1 when a has lesser positive count', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 3);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-1', 5);

      expect(PNCounter.compare(a, b)).toBe(-1);
    });

    it('should return 1 when a has greater negative count (more decrements)', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.decrement(a, 'device-1', 5);

      let b = PNCounter.createPNCounter();
      b = PNCounter.decrement(b, 'device-1', 3);

      expect(PNCounter.compare(a, b)).toBe(1);
    });

    it('should return undefined for concurrent positive updates', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 5);
      a = PNCounter.increment(a, 'device-2', 3);

      let b = PNCounter.createPNCounter();
      b = PNCounter.increment(b, 'device-1', 3);
      b = PNCounter.increment(b, 'device-2', 7);

      expect(PNCounter.compare(a, b)).toBeUndefined();
    });

    it('should return undefined for concurrent negative updates', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.decrement(a, 'device-1', 5);
      a = PNCounter.decrement(a, 'device-2', 3);

      let b = PNCounter.createPNCounter();
      b = PNCounter.decrement(b, 'device-1', 3);
      b = PNCounter.decrement(b, 'device-2', 7);

      expect(PNCounter.compare(a, b)).toBeUndefined();
    });

    it('should return undefined when positive and negative conflict', () => {
      let a = PNCounter.createPNCounter();
      a = PNCounter.increment(a, 'device-1', 5);

      let b = PNCounter.createPNCounter();
      b = PNCounter.decrement(b, 'device-1', 5);

      expect(PNCounter.compare(a, b)).toBeUndefined();
    });
  });

  describe('serialize/deserialize', () => {
    it('should round-trip counter state', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 5);
      counter = PNCounter.decrement(counter, 'device-2', 3);

      const serialized = PNCounter.serialize(counter);
      const deserialized = PNCounter.deserialize(serialized);

      expect(deserialized.positive).toEqual(counter.positive);
      expect(deserialized.negative).toEqual(counter.negative);
    });

    it('should throw on invalid data - missing positive', () => {
      expect(() => PNCounter.deserialize('{"negative": {}}')).toThrow('Invalid PN-Counter state');
    });

    it('should throw on invalid data - missing negative', () => {
      expect(() => PNCounter.deserialize('{"positive": {}}')).toThrow('Invalid PN-Counter state');
    });

    it('should throw on invalid data - null values', () => {
      expect(() => PNCounter.deserialize('{"positive": null, "negative": {}}')).toThrow(
        'Invalid PN-Counter state'
      );
    });
  });

  describe('clone', () => {
    it('should create independent copy of positive', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.increment(counter, 'device-1', 5);

      const cloned = PNCounter.clone(counter);
      cloned.positive['device-1'] = 100;

      expect(counter.positive['device-1']).toBe(5);
    });

    it('should create independent copy of negative', () => {
      let counter = PNCounter.createPNCounter();
      counter = PNCounter.decrement(counter, 'device-1', 5);

      const cloned = PNCounter.clone(counter);
      cloned.negative['device-1'] = 100;

      expect(counter.negative['device-1']).toBe(5);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle token balance tracking', () => {
      // Simulating token balance across devices
      let balance = PNCounter.createPNCounter();

      // Device 1: Receives 100 tokens
      balance = PNCounter.increment(balance, 'device-1', 100);
      expect(PNCounter.getValue(balance)).toBe(100);

      // Device 2: Spends 30 tokens
      balance = PNCounter.decrement(balance, 'device-2', 30);
      expect(PNCounter.getValue(balance)).toBe(70);

      // Device 1: Receives another 50 tokens
      balance = PNCounter.increment(balance, 'device-1', 50);
      expect(PNCounter.getValue(balance)).toBe(120);

      // Device 2: Spends 20 more tokens
      balance = PNCounter.decrement(balance, 'device-2', 20);
      expect(PNCounter.getValue(balance)).toBe(100);
    });

    it('should handle concurrent device updates with merge', () => {
      // Device 1 working offline
      let device1 = PNCounter.createPNCounter();
      device1 = PNCounter.increment(device1, 'device-1', 50);
      device1 = PNCounter.decrement(device1, 'device-1', 10);

      // Device 2 working offline
      let device2 = PNCounter.createPNCounter();
      device2 = PNCounter.increment(device2, 'device-2', 30);
      device2 = PNCounter.decrement(device2, 'device-2', 5);

      // Sync: merge both states
      const synced = PNCounter.merge(device1, device2);

      // Combined: (50-10) + (30-5) = 40 + 25 = 65
      expect(PNCounter.getValue(synced.value)).toBe(65);
      expect(synced.hadConflict).toBe(false);
    });

    it('should handle inventory count scenario', () => {
      let inventory = PNCounter.createPNCounter();

      // Warehouse adds 1000 items
      inventory = PNCounter.increment(inventory, 'warehouse', 1000);

      // Store A sells 50
      inventory = PNCounter.decrement(inventory, 'store-a', 50);

      // Store B sells 75
      inventory = PNCounter.decrement(inventory, 'store-b', 75);

      // Warehouse adds 200 more
      inventory = PNCounter.increment(inventory, 'warehouse', 200);

      expect(PNCounter.getValue(inventory)).toBe(1075);
    });
  });
});
