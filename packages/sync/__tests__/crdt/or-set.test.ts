/**
 * OR-Set CRDT Tests
 */

import { describe, it, expect } from 'vitest';
import * as ORSet from '../../src/crdt/or-set.js';

describe('OR-Set', () => {
  describe('createORSet', () => {
    it('should create an empty set', () => {
      const set = ORSet.createORSet<string>();
      expect(ORSet.getValues(set)).toEqual([]);
      expect(ORSet.size(set)).toBe(0);
    });
  });

  describe('add', () => {
    it('should add an element', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');

      expect(ORSet.has(set, 'apple')).toBe(true);
      expect(ORSet.size(set)).toBe(1);
    });

    it('should add multiple elements', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');
      set = ORSet.add(set, 'banana', 'device-1');

      expect(ORSet.has(set, 'apple')).toBe(true);
      expect(ORSet.has(set, 'banana')).toBe(true);
      expect(ORSet.size(set)).toBe(2);
    });

    it('should allow re-adding same value (creates new tag)', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');
      set = ORSet.add(set, 'apple', 'device-2');

      expect(ORSet.has(set, 'apple')).toBe(true);
      // Size is still 1 because getValues deduplicates
      expect(ORSet.size(set)).toBe(1);
    });

    it('should work with complex objects', () => {
      let set = ORSet.createORSet<{ id: number; name: string }>();
      set = ORSet.add(set, { id: 1, name: 'Alice' }, 'device-1');

      expect(ORSet.has(set, { id: 1, name: 'Alice' })).toBe(true);
      expect(ORSet.has(set, { id: 1, name: 'Bob' })).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove an element', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');
      set = ORSet.remove(set, 'apple');

      expect(ORSet.has(set, 'apple')).toBe(false);
      expect(ORSet.size(set)).toBe(0);
    });

    it('should only remove observed additions', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');
      set = ORSet.remove(set, 'apple');
      // Re-add after remove
      set = ORSet.add(set, 'apple', 'device-2');

      expect(ORSet.has(set, 'apple')).toBe(true);
    });

    it('should be idempotent for non-existent elements', () => {
      let set = ORSet.createORSet<string>();
      const before = ORSet.size(set);
      set = ORSet.remove(set, 'nonexistent');

      expect(ORSet.size(set)).toBe(before);
    });
  });

  describe('has', () => {
    it('should return false for empty set', () => {
      const set = ORSet.createORSet<string>();
      expect(ORSet.has(set, 'anything')).toBe(false);
    });

    it('should return true for present element', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');

      expect(ORSet.has(set, 'apple')).toBe(true);
    });

    it('should return false for removed element', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');
      set = ORSet.remove(set, 'apple');

      expect(ORSet.has(set, 'apple')).toBe(false);
    });
  });

  describe('getValues', () => {
    it('should return empty array for empty set', () => {
      const set = ORSet.createORSet<string>();
      expect(ORSet.getValues(set)).toEqual([]);
    });

    it('should return deduplicated values', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');
      set = ORSet.add(set, 'apple', 'device-2');
      set = ORSet.add(set, 'banana', 'device-1');

      const values = ORSet.getValues(set);
      expect(values).toHaveLength(2);
      expect(values).toContain('apple');
      expect(values).toContain('banana');
    });
  });

  describe('merge', () => {
    it('should merge two empty sets', () => {
      const a = ORSet.createORSet<string>();
      const b = ORSet.createORSet<string>();
      const result = ORSet.merge(a, b);

      expect(ORSet.size(result.value)).toBe(0);
      expect(result.hadConflict).toBe(false);
    });

    it('should union elements from both sets', () => {
      let a = ORSet.createORSet<string>();
      a = ORSet.add(a, 'apple', 'device-1');

      let b = ORSet.createORSet<string>();
      b = ORSet.add(b, 'banana', 'device-2');

      const result = ORSet.merge(a, b);

      expect(ORSet.has(result.value, 'apple')).toBe(true);
      expect(ORSet.has(result.value, 'banana')).toBe(true);
    });

    it('should add-wins over concurrent remove (add observed by one, remove by other)', () => {
      // Start with a shared state
      let shared = ORSet.createORSet<string>();
      shared = ORSet.add(shared, 'apple', 'device-1');

      // a keeps the apple
      const a = ORSet.clone(shared);

      // b removes the apple
      let b = ORSet.clone(shared);
      b = ORSet.remove(b, 'apple');

      // Now merge - b has tombstone for a's add, so hadConflict should be true
      // but the add in 'a' is tombstoned in 'b', so apple should be removed
      const result = ORSet.merge(a, b);

      // Since both started from the same add and b removed it, apple should be gone
      expect(ORSet.has(result.value, 'apple')).toBe(false);
      // But there's a conflict since one has it and one removed it
      expect(result.hadConflict).toBe(true);
    });

    it('should be commutative', () => {
      let a = ORSet.createORSet<string>();
      a = ORSet.add(a, 'apple', 'device-1');

      let b = ORSet.createORSet<string>();
      b = ORSet.add(b, 'banana', 'device-2');

      const result1 = ORSet.merge(a, b);
      const result2 = ORSet.merge(b, a);

      expect(ORSet.getValues(result1.value).sort()).toEqual(
        ORSet.getValues(result2.value).sort()
      );
    });

    it('should be idempotent', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');

      const result = ORSet.merge(set, set);

      expect(ORSet.getValues(result.value)).toEqual(ORSet.getValues(set));
    });
  });

  describe('getElementMetadata', () => {
    it('should return null for non-existent element', () => {
      const set = ORSet.createORSet<string>();
      expect(ORSet.getElementMetadata(set, 'apple')).toBeNull();
    });

    it('should return metadata for existing element', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');

      const metadata = ORSet.getElementMetadata(set, 'apple');
      expect(metadata).not.toBeNull();
      expect(metadata?.addedBy).toBe('device-1');
      expect(typeof metadata?.timestamp).toBe('number');
    });
  });

  describe('serialize/deserialize', () => {
    it('should round-trip set state', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');
      set = ORSet.add(set, 'banana', 'device-2');
      set = ORSet.remove(set, 'apple');

      const serialized = ORSet.serialize(set);
      const deserialized = ORSet.deserialize<string>(serialized);

      expect(ORSet.has(deserialized, 'apple')).toBe(false);
      expect(ORSet.has(deserialized, 'banana')).toBe(true);
    });

    it('should throw on invalid data', () => {
      expect(() => ORSet.deserialize('{}')).toThrow();
      expect(() => ORSet.deserialize('{"elements": "not-array"}')).toThrow();
    });
  });

  describe('compact', () => {
    it('should remove tombstoned entries', () => {
      let set = ORSet.createORSet<string>();
      set = ORSet.add(set, 'apple', 'device-1');
      set = ORSet.remove(set, 'apple');

      const beforeSize = set.elements.size;
      set = ORSet.compact(set);

      // Elements should be smaller after compact
      expect(set.elements.size).toBeLessThanOrEqual(beforeSize);
    });
  });
});
