/**
 * IndexedDBStore Integration Test
 *
 * Tests full persistence workflow:
 * 1. Create store
 * 2. Store data (simulating IAB classification)
 * 3. Close store (simulate browser restart)
 * 4. Reopen store
 * 5. Verify data persistence
 *
 * Uses fake-indexeddb to test IndexedDB in Node.js environment
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBStore } from '../../browser/store/IndexedDBStore';

describe('IndexedDBStore Integration', () => {
  let store: IndexedDBStore;
  const testDbName = 'test-ownyou-store';
  const testUserId = 'test-user-123';

  beforeEach(() => {
    // Create fresh store for each test
    store = new IndexedDBStore(testDbName);
  });

  afterEach(async () => {
    // Clean up after each test
    if (store) {
      store.stop();
    }

    // Delete test database
    const deleteRequest = indexedDB.deleteDatabase(testDbName);
    await new Promise((resolve, reject) => {
      deleteRequest.onsuccess = () => resolve(undefined);
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  });

  describe('Basic CRUD Operations', () => {
    it('should store and retrieve a single item', async () => {
      // Store an IAB classification
      const namespace = [testUserId, 'iab_classifications'];
      const key = 'taxonomy_25';
      const value = {
        category: 'Shopping',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      };

      await store.put(namespace, key, value);

      // Retrieve the classification
      const item = await store.get(namespace, key);

      expect(item).not.toBeNull();
      expect(item?.value).toEqual(value);
      expect(item?.key).toBe(key);
      expect(item?.namespace).toEqual(namespace);
      expect(item?.createdAt).toBeInstanceOf(Date);
      expect(item?.updatedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent items', async () => {
      const item = await store.get([testUserId, 'iab_classifications'], 'non-existent');
      expect(item).toBeNull();
    });

    it('should update existing items', async () => {
      const namespace = [testUserId, 'iab_classifications'];
      const key = 'taxonomy_25';

      // Initial value
      await store.put(namespace, key, { confidence: 0.80 });
      const initial = await store.get(namespace, key);

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Updated value
      await store.put(namespace, key, { confidence: 0.95 });
      const updated = await store.get(namespace, key);

      expect(updated?.value.confidence).toBe(0.95);
      expect(updated?.createdAt).toEqual(initial?.createdAt);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(initial?.updatedAt.getTime() || 0);
    });

    it('should delete items', async () => {
      const namespace = [testUserId, 'iab_classifications'];
      const key = 'taxonomy_25';

      await store.put(namespace, key, { category: 'Shopping' });
      let item = await store.get(namespace, key);
      expect(item).not.toBeNull();

      await store.delete(namespace, key);
      item = await store.get(namespace, key);
      expect(item).toBeNull();
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Create multiple items for search testing
      const namespace = [testUserId, 'iab_classifications'];

      await store.put(namespace, 'taxonomy_25', {
        category: 'Shopping',
        confidence: 0.95,
        score: 100,
      });

      await store.put(namespace, 'taxonomy_42', {
        category: 'Technology',
        confidence: 0.88,
        score: 85,
      });

      await store.put(namespace, 'taxonomy_100', {
        category: 'Travel',
        confidence: 0.92,
        score: 90,
      });
    });

    it('should search by namespace prefix', async () => {
      const items = await store.search([testUserId, 'iab_classifications']);

      expect(items).toHaveLength(3);
      expect(items.map(i => i.key)).toContain('taxonomy_25');
      expect(items.map(i => i.key)).toContain('taxonomy_42');
      expect(items.map(i => i.key)).toContain('taxonomy_100');
    });

    it('should filter search results with exact match', async () => {
      const items = await store.search([testUserId, 'iab_classifications'], {
        filter: { category: 'Shopping' },
      });

      expect(items).toHaveLength(1);
      expect(items[0].value.category).toBe('Shopping');
    });

    it('should filter with comparison operators', async () => {
      // Greater than
      const highConfidence = await store.search([testUserId, 'iab_classifications'], {
        filter: { confidence: { $gt: 0.90 } },
      });
      expect(highConfidence).toHaveLength(2); // Shopping (0.95), Travel (0.92)

      // Less than or equal
      const lowScore = await store.search([testUserId, 'iab_classifications'], {
        filter: { score: { $lte: 90 } },
      });
      expect(lowScore).toHaveLength(2); // Technology (85), Travel (90)
    });

    it('should apply limit and offset', async () => {
      const firstTwo = await store.search([testUserId, 'iab_classifications'], {
        limit: 2,
      });
      expect(firstTwo).toHaveLength(2);

      const skippedFirst = await store.search([testUserId, 'iab_classifications'], {
        offset: 1,
        limit: 2,
      });
      expect(skippedFirst).toHaveLength(2);
      expect(skippedFirst.map(i => i.key)).not.toContain(firstTwo[0].key);
    });
  });

  describe('Batch Operations', () => {
    it('should execute multiple operations in a batch', async () => {
      const namespace = [testUserId, 'iab_classifications'];

      const results = await store.batch([
        // Put operations
        { namespace, key: 'item1', value: { data: 'value1' } },
        { namespace, key: 'item2', value: { data: 'value2' } },
        // Get operation
        { namespace, key: 'item1' },
        // Search operation
        { namespacePrefix: namespace, limit: 10, offset: 0 },
      ]);

      // First two operations are puts (return undefined)
      expect(results[0]).toBeUndefined();
      expect(results[1]).toBeUndefined();

      // Third is a get
      expect(results[2]).not.toBeNull();
      expect((results[2] as any).value.data).toBe('value1');

      // Fourth is a search
      expect(Array.isArray(results[3])).toBe(true);
      expect((results[3] as any[]).length).toBe(2);
    });
  });

  describe('Namespace Management', () => {
    beforeEach(async () => {
      await store.put([testUserId, 'iab_classifications'], 'item1', { data: 1 });
      await store.put([testUserId, 'mission_cards'], 'item2', { data: 2 });
      await store.put(['another_user', 'iab_classifications'], 'item3', { data: 3 });
    });

    it('should list all unique namespaces', async () => {
      const namespaces = await store.listNamespaces();

      expect(namespaces).toHaveLength(3);
      expect(namespaces).toContainEqual([testUserId, 'iab_classifications']);
      expect(namespaces).toContainEqual([testUserId, 'mission_cards']);
      expect(namespaces).toContainEqual(['another_user', 'iab_classifications']);
    });

    it('should isolate data by namespace', async () => {
      const userItems = await store.search([testUserId]);
      const otherUserItems = await store.search(['another_user']);

      expect(userItems).toHaveLength(2);
      expect(otherUserItems).toHaveLength(1);
    });
  });

  describe('Persistence Across Store Restarts (CRITICAL TEST)', () => {
    it('should persist data across store close/reopen', async () => {
      // Phase 1: Store data
      const namespace = [testUserId, 'iab_classifications'];
      const classification = {
        category: 'Shopping',
        confidence: 0.95,
        evidence: ['amazon purchase', 'product search'],
        timestamp: new Date().toISOString(),
      };

      await store.put(namespace, 'taxonomy_25', classification);

      // Verify data exists
      const beforeClose = await store.get(namespace, 'taxonomy_25');
      expect(beforeClose).not.toBeNull();
      expect(beforeClose?.value).toEqual(classification);

      // Phase 2: Close store (simulate browser restart)
      store.stop();

      // Phase 3: Reopen store
      const store2 = new IndexedDBStore(testDbName);

      // Phase 4: Verify persistence
      const afterReopen = await store2.get(namespace, 'taxonomy_25');

      expect(afterReopen).not.toBeNull();
      expect(afterReopen?.value).toEqual(classification);
      expect(afterReopen?.key).toBe('taxonomy_25');
      expect(afterReopen?.namespace).toEqual(namespace);

      // Clean up
      store2.stop();
    });

    it('should persist multiple classifications across restart', async () => {
      const namespace = [testUserId, 'iab_classifications'];

      // Store multiple classifications
      await store.put(namespace, 'shopping', { category: 'Shopping', confidence: 0.95 });
      await store.put(namespace, 'travel', { category: 'Travel', confidence: 0.88 });
      await store.put(namespace, 'tech', { category: 'Technology', confidence: 0.92 });

      // Close and reopen
      store.stop();
      const store2 = new IndexedDBStore(testDbName);

      // Verify all data persisted
      const items = await store2.search(namespace);

      expect(items).toHaveLength(3);
      expect(items.map(i => i.key)).toContain('shopping');
      expect(items.map(i => i.key)).toContain('travel');
      expect(items.map(i => i.key)).toContain('tech');

      store2.stop();
    });
  });

  describe('Async/Await Patterns (Edge Cases)', () => {
    it('should handle concurrent operations correctly', async () => {
      const namespace = [testUserId, 'test'];

      // Execute multiple operations concurrently
      const operations = [
        store.put(namespace, 'item1', { id: 1 }),
        store.put(namespace, 'item2', { id: 2 }),
        store.put(namespace, 'item3', { id: 3 }),
      ];

      await Promise.all(operations);

      // Verify all operations completed
      const items = await store.search(namespace);
      expect(items).toHaveLength(3);
    });

    it('should handle transaction errors gracefully', async () => {
      const namespace = [testUserId, 'test'];

      // Try to store invalid data (null value should be skipped in batch)
      const results = await store.batch([
        { namespace, key: 'valid', value: { data: 'valid' } },
        { namespace, key: 'null', value: null }, // Should be skipped
      ]);

      // Both operations should return undefined (batch API behavior)
      expect(results[0]).toBeUndefined();
      expect(results[1]).toBeUndefined();

      // Only valid item should exist
      const valid = await store.get(namespace, 'valid');
      const nullItem = await store.get(namespace, 'null');

      expect(valid).not.toBeNull();
      expect(nullItem).toBeNull();
    });
  });
});
