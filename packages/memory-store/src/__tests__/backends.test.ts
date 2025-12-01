/**
 * Storage Backend Tests - v13 Section 8.13
 *
 * Tests for InMemoryBackend and IndexedDBBackend
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryBackend } from '../backends/memory';
import { IndexedDBBackend } from '../backends/indexeddb';
import type { StorageBackend, StoreStats } from '../backends/types';

// Test suite that runs against any backend implementation
function testBackend(name: string, createBackend: () => StorageBackend) {
  describe(`${name} Backend`, () => {
    let backend: StorageBackend;
    const namespace = 'ownyou.semantic';
    const userId = 'user_123';

    beforeEach(async () => {
      backend = createBackend();
      await backend.clear();
    });

    describe('put()', () => {
      it('should store a value', async () => {
        await backend.put(namespace, userId, 'key1', { data: 'test' });
        const result = await backend.get(namespace, userId, 'key1');
        expect(result).toEqual({ data: 'test' });
      });

      it('should overwrite existing value', async () => {
        await backend.put(namespace, userId, 'key1', { data: 'original' });
        await backend.put(namespace, userId, 'key1', { data: 'updated' });
        const result = await backend.get(namespace, userId, 'key1');
        expect(result).toEqual({ data: 'updated' });
      });

      it('should store complex objects', async () => {
        const complex = {
          id: 'mem_123',
          content: 'Test memory',
          nested: { a: 1, b: [1, 2, 3] },
          array: ['a', 'b', 'c'],
        };
        await backend.put(namespace, userId, 'complex', complex);
        const result = await backend.get(namespace, userId, 'complex');
        expect(result).toEqual(complex);
      });
    });

    describe('get()', () => {
      it('should return null for non-existent key', async () => {
        const result = await backend.get(namespace, userId, 'nonexistent');
        expect(result).toBeNull();
      });

      it('should isolate by namespace', async () => {
        await backend.put(namespace, userId, 'key1', { data: 'semantic' });
        await backend.put('ownyou.episodic', userId, 'key1', { data: 'episodic' });

        const semantic = await backend.get(namespace, userId, 'key1');
        const episodic = await backend.get('ownyou.episodic', userId, 'key1');

        expect(semantic).toEqual({ data: 'semantic' });
        expect(episodic).toEqual({ data: 'episodic' });
      });

      it('should isolate by userId', async () => {
        await backend.put(namespace, 'user_1', 'key1', { data: 'user1' });
        await backend.put(namespace, 'user_2', 'key1', { data: 'user2' });

        const user1 = await backend.get(namespace, 'user_1', 'key1');
        const user2 = await backend.get(namespace, 'user_2', 'key1');

        expect(user1).toEqual({ data: 'user1' });
        expect(user2).toEqual({ data: 'user2' });
      });
    });

    describe('delete()', () => {
      it('should remove existing item', async () => {
        await backend.put(namespace, userId, 'key1', { data: 'test' });
        const deleted = await backend.delete(namespace, userId, 'key1');

        expect(deleted).toBe(true);
        expect(await backend.get(namespace, userId, 'key1')).toBeNull();
      });

      it('should return false for non-existent key', async () => {
        const deleted = await backend.delete(namespace, userId, 'nonexistent');
        expect(deleted).toBe(false);
      });
    });

    describe('list()', () => {
      beforeEach(async () => {
        for (let i = 1; i <= 10; i++) {
          await backend.put(namespace, userId, `key_${i}`, { index: i });
        }
      });

      it('should list all items', async () => {
        const items = await backend.list(namespace, userId, 100, 0);
        expect(items.length).toBe(10);
      });

      it('should respect limit', async () => {
        const items = await backend.list(namespace, userId, 5, 0);
        expect(items.length).toBe(5);
      });

      it('should respect offset', async () => {
        const items = await backend.list(namespace, userId, 5, 5);
        expect(items.length).toBe(5);
      });

      it('should return empty array for empty namespace', async () => {
        const items = await backend.list('ownyou.empty', userId, 100, 0);
        expect(items).toEqual([]);
      });
    });

    describe('exists()', () => {
      it('should return true for existing key', async () => {
        await backend.put(namespace, userId, 'key1', { data: 'test' });
        expect(await backend.exists(namespace, userId, 'key1')).toBe(true);
      });

      it('should return false for non-existent key', async () => {
        expect(await backend.exists(namespace, userId, 'nonexistent')).toBe(false);
      });
    });

    describe('getStats()', () => {
      it('should return stats for namespace', async () => {
        await backend.put(namespace, userId, 'key1', { data: 'test' });
        await backend.put(namespace, userId, 'key2', { data: 'test' });

        const stats: StoreStats = await backend.getStats(namespace, userId);

        expect(stats.namespace).toBe(namespace);
        expect(stats.count).toBe(2);
      });
    });

    describe('clear()', () => {
      it('should clear all data', async () => {
        await backend.put(namespace, userId, 'key1', { data: 'test' });
        await backend.put('ownyou.episodic', userId, 'key2', { data: 'test' });

        await backend.clear();

        expect(await backend.get(namespace, userId, 'key1')).toBeNull();
        expect(await backend.get('ownyou.episodic', userId, 'key2')).toBeNull();
      });

      it('should clear by namespace and userId', async () => {
        await backend.put(namespace, userId, 'key1', { data: 'test' });
        await backend.put(namespace, 'other_user', 'key2', { data: 'test' });

        await backend.clear(namespace, userId);

        expect(await backend.get(namespace, userId, 'key1')).toBeNull();
        expect(await backend.get(namespace, 'other_user', 'key2')).not.toBeNull();
      });
    });
  });
}

// Run tests for InMemoryBackend
testBackend('InMemory', () => new InMemoryBackend());

// Run tests for IndexedDBBackend
testBackend('IndexedDB', () => new IndexedDBBackend({ dbName: `test_db_${Date.now()}` }));
