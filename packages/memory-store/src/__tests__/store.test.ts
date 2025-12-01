/**
 * MemoryStore Tests - v13 Section 8.7
 *
 * Tests the LangGraph Store-compatible interface:
 * put, get, delete, list, search
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../store';
import { InMemoryBackend } from '../backends/memory';
import { MockEmbeddingService } from '../search/embeddings';
import { NS } from '@ownyou/shared-types';
import type { Memory } from '@ownyou/shared-types';

describe('MemoryStore (v13 Section 8.7)', () => {
  let store: MemoryStore;
  const userId = 'user_123';

  beforeEach(() => {
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      embeddingService: new MockEmbeddingService(),
    });
  });

  describe('put()', () => {
    it('should store an item in the specified namespace', async () => {
      const memory: Memory = {
        id: 'mem_1',
        content: 'User prefers window seats',
        context: 'travel',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      await store.put(NS.semanticMemory(userId), memory.id, memory);

      const retrieved = await store.get<Memory>(NS.semanticMemory(userId), memory.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe('User prefers window seats');
    });

    it('should auto-generate embedding when embeddingService is provided', async () => {
      const memory: Memory = {
        id: 'mem_embed',
        content: 'User likes hiking in mountains',
        context: 'interests',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 0.85,
        privacyTier: 'public',
      };

      await store.put(NS.semanticMemory(userId), memory.id, memory);

      const retrieved = await store.get<Memory>(NS.semanticMemory(userId), memory.id);
      expect(retrieved!.embedding).toBeDefined();
      expect(retrieved!.embedding!.length).toBe(768); // Mock returns 768 dims
    });

    it('should overwrite existing item with same key', async () => {
      const memory1: Memory = {
        id: 'mem_update',
        content: 'Original content',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 0.5,
        privacyTier: 'public',
      };

      const memory2: Memory = {
        ...memory1,
        content: 'Updated content',
        confidence: 0.9,
      };

      await store.put(NS.semanticMemory(userId), memory1.id, memory1);
      await store.put(NS.semanticMemory(userId), memory2.id, memory2);

      const retrieved = await store.get<Memory>(NS.semanticMemory(userId), memory1.id);
      expect(retrieved!.content).toBe('Updated content');
      expect(retrieved!.confidence).toBe(0.9);
    });
  });

  describe('get()', () => {
    it('should return null for non-existent key', async () => {
      const result = await store.get(NS.semanticMemory(userId), 'nonexistent');
      expect(result).toBeNull();
    });

    it('should update lastAccessed and accessCount on retrieval', async () => {
      const memory: Memory = {
        id: 'mem_access',
        content: 'Track access',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now() - 10000,
        accessCount: 5,
        sources: [],
        confidence: 1.0,
        privacyTier: 'public',
      };

      await store.put(NS.semanticMemory(userId), memory.id, memory);

      const before = Date.now();
      const retrieved = await store.get<Memory>(NS.semanticMemory(userId), memory.id);

      expect(retrieved!.accessCount).toBe(6);
      expect(retrieved!.lastAccessed).toBeGreaterThanOrEqual(before);
    });

    it('should isolate data between namespaces', async () => {
      const memory: Memory = {
        id: 'mem_isolated',
        content: 'Isolated memory',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 1.0,
        privacyTier: 'public',
      };

      await store.put(NS.semanticMemory(userId), memory.id, memory);

      // Should not exist in different namespace
      const fromEpisodic = await store.get(NS.episodicMemory(userId), memory.id);
      expect(fromEpisodic).toBeNull();

      // Should not exist for different user
      const fromOtherUser = await store.get(NS.semanticMemory('other_user'), memory.id);
      expect(fromOtherUser).toBeNull();
    });
  });

  describe('delete()', () => {
    it('should remove an existing item', async () => {
      const memory: Memory = {
        id: 'mem_delete',
        content: 'To be deleted',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 1.0,
        privacyTier: 'public',
      };

      await store.put(NS.semanticMemory(userId), memory.id, memory);
      const deleted = await store.delete(NS.semanticMemory(userId), memory.id);

      expect(deleted).toBe(true);

      const retrieved = await store.get(NS.semanticMemory(userId), memory.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await store.delete(NS.semanticMemory(userId), 'nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('list()', () => {
    beforeEach(async () => {
      // Seed some memories
      for (let i = 1; i <= 5; i++) {
        const memory: Memory = {
          id: `mem_list_${i}`,
          content: `Memory ${i}`,
          context: i % 2 === 0 ? 'travel' : 'shopping',
          validAt: Date.now(),
          createdAt: Date.now() - i * 1000,
          strength: 1.0 - i * 0.1,
          lastAccessed: Date.now(),
          accessCount: 0,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
        };
        await store.put(NS.semanticMemory(userId), memory.id, memory);
      }
    });

    it('should list all items in namespace', async () => {
      const result = await store.list<Memory>(NS.semanticMemory(userId));

      expect(result.items.length).toBe(5);
      expect(result.hasMore).toBe(false);
    });

    it('should respect limit option', async () => {
      const result = await store.list<Memory>(NS.semanticMemory(userId), { limit: 2 });

      expect(result.items.length).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should respect offset option', async () => {
      const result = await store.list<Memory>(NS.semanticMemory(userId), {
        limit: 2,
        offset: 2,
      });

      expect(result.items.length).toBe(2);
    });

    it('should filter by context', async () => {
      const result = await store.list<Memory>(NS.semanticMemory(userId), {
        filter: { context: 'travel' },
      });

      expect(result.items.length).toBe(2);
      result.items.forEach((item) => {
        expect(item.context).toBe('travel');
      });
    });

    it('should return empty array for empty namespace', async () => {
      const result = await store.list(NS.episodicMemory(userId));

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('search()', () => {
    beforeEach(async () => {
      const memories: Memory[] = [
        {
          id: 'mem_search_1',
          content: 'User loves hiking in the mountains during summer',
          context: 'interests',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 0.9,
          lastAccessed: Date.now(),
          accessCount: 5,
          sources: [],
          confidence: 0.95,
          privacyTier: 'public',
        },
        {
          id: 'mem_search_2',
          content: 'User prefers window seats on flights',
          context: 'travel',
          validAt: Date.now(),
          createdAt: Date.now() - 86400000,
          strength: 0.7,
          lastAccessed: Date.now(),
          accessCount: 2,
          sources: [],
          confidence: 0.85,
          privacyTier: 'public',
        },
        {
          id: 'mem_search_3',
          content: 'User enjoys mountain biking on weekends',
          context: 'interests',
          validAt: Date.now(),
          createdAt: Date.now() - 172800000,
          strength: 0.5,
          lastAccessed: Date.now(),
          accessCount: 1,
          sources: [],
          confidence: 0.75,
          privacyTier: 'public',
        },
      ];

      for (const memory of memories) {
        await store.put(NS.semanticMemory(userId), memory.id, memory);
      }
    });

    it('should return results for BM25 search', async () => {
      const results = await store.search<Memory>({
        namespace: NS.semanticMemory(userId),
        query: 'mountain hiking',
        modes: ['bm25'],
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      // First result should mention mountains or hiking
      expect(
        results[0].item.content.toLowerCase().includes('mountain') ||
          results[0].item.content.toLowerCase().includes('hiking')
      ).toBe(true);
    });

    it('should return results for semantic search', async () => {
      const results = await store.search<Memory>({
        namespace: NS.semanticMemory(userId),
        query: 'outdoor activities',
        modes: ['semantic'],
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].scores.semantic).toBeDefined();
    });

    it('should return fused results for hybrid search', async () => {
      const results = await store.search<Memory>({
        namespace: NS.semanticMemory(userId),
        query: 'mountain activities',
        modes: ['semantic', 'bm25'],
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].scores.rrf).toBeDefined();
      expect(results[0].scores.final).toBeDefined();
    });

    it('should apply strength and recency scoring', async () => {
      const results = await store.search<Memory>({
        namespace: NS.semanticMemory(userId),
        query: 'hiking mountains',
        modes: ['bm25'],
        weights: {
          rrf: 0.5,
          strength: 0.3,
          recency: 0.2,
        },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].scores.strength).toBeDefined();
      expect(results[0].scores.recency).toBeDefined();
    });

    it('should filter by context', async () => {
      const results = await store.search<Memory>({
        namespace: NS.semanticMemory(userId),
        query: 'preferences',
        modes: ['bm25'],
        filter: { context: 'travel' },
      });

      results.forEach((result) => {
        expect(result.item.context).toBe('travel');
      });
    });

    it('should respect limit', async () => {
      const results = await store.search<Memory>({
        namespace: NS.semanticMemory(userId),
        query: 'user',
        modes: ['bm25'],
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('StoreEvent emission', () => {
    it('should emit events for operations', async () => {
      const events: any[] = [];
      const trackedStore = new MemoryStore({
        backend: new InMemoryBackend(),
        embeddingService: new MockEmbeddingService(),
        onEvent: (event) => events.push(event),
      });

      const memory: Memory = {
        id: 'mem_event',
        content: 'Event test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 1.0,
        privacyTier: 'public',
      };

      await trackedStore.put(NS.semanticMemory(userId), memory.id, memory);
      await trackedStore.get(NS.semanticMemory(userId), memory.id);
      await trackedStore.list(NS.semanticMemory(userId));
      await trackedStore.search({ namespace: NS.semanticMemory(userId), query: 'test', modes: ['bm25'] });
      await trackedStore.delete(NS.semanticMemory(userId), memory.id);

      expect(events.length).toBe(5);
      expect(events.map((e) => e.type)).toEqual(['put', 'get', 'list', 'search', 'delete']);
    });
  });
});
