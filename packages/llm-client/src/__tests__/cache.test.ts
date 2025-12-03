/**
 * LLM Cache Tests - v13 Section 6.11.3
 *
 * Tests for response caching with TTL and LRU eviction
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LLMCache,
  InMemoryCacheStore,
  generateCacheKey,
  TTL_BY_OPERATION,
  type CacheEntry,
} from '../cache';
import type { LLMRequest, LLMResponse, OperationType } from '../providers/types';

describe('LLMCache', () => {
  let cache: LLMCache;
  let store: InMemoryCacheStore;
  const userId = 'test-user-123';

  beforeEach(() => {
    store = new InMemoryCacheStore();
    cache = new LLMCache(store);
  });

  describe('generateCacheKey', () => {
    it('should generate consistent keys for same requests', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        operation: 'iab_classification',
      };

      const key1 = await generateCacheKey(request);
      const key2 = await generateCacheKey(request);

      expect(key1).toBe(key2);
      expect(key1.length).toBe(64); // SHA-256 hex string
    });

    it('should generate different keys for different messages', async () => {
      const request1: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
      };
      const request2: LLMRequest = {
        messages: [{ role: 'user', content: 'Goodbye' }],
        model: 'gpt-4o-mini',
      };

      const key1 = await generateCacheKey(request1);
      const key2 = await generateCacheKey(request2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different models', async () => {
      const request1: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
      };
      const request2: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
      };

      const key1 = await generateCacheKey(request1);
      const key2 = await generateCacheKey(request2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different operations', async () => {
      const request1: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        operation: 'iab_classification',
      };
      const request2: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
        operation: 'mission_agent',
      };

      const key1 = await generateCacheKey(request1);
      const key2 = await generateCacheKey(request2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('get/set', () => {
    it('should return cached response on hit', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test message' }],
        model: 'gpt-4o-mini',
        operation: 'iab_classification',
        temperature: 0, // Low temp to allow caching
      };

      const response: LLMResponse = {
        content: 'Test response',
        model: 'gpt-4o-mini',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          costUsd: 0.001,
        },
      };

      // Cache the response
      await cache.set(userId, request, response);

      // Retrieve it
      const cached = await cache.get(userId, request);

      expect(cached).not.toBeNull();
      expect(cached?.content).toBe('Test response');
      expect(cached?.model).toBe('gpt-4o-mini');
    });

    it('should return null on cache miss', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Not cached' }],
        model: 'gpt-4o-mini',
      };

      const result = await cache.get(userId, request);

      expect(result).toBeNull();
    });

    it('should expire entries based on TTL', async () => {
      // Use 'test' operation which has 5 minute TTL
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4o-mini',
        operation: 'test',
        temperature: 0,
      };

      const response: LLMResponse = {
        content: 'Test response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      // Cache the response
      await cache.set(userId, request, response);

      // Verify it's cached
      let cached = await cache.get(userId, request);
      expect(cached).not.toBeNull();

      // Manually expire by modifying store directly using the correct namespace
      const key = await generateCacheKey(request);
      // NS.llmCache returns ['ownyou.llm_cache', userId]
      const namespace = ['ownyou.llm_cache', userId] as [string, string];
      const entry = await store.get(namespace, key);
      expect(entry).not.toBeNull();
      if (entry) {
        const expiredEntry = { ...entry.value, expiresAt: Date.now() - 1000 };
        await store.put(namespace, key, expiredEntry);
      }

      // Should be expired now
      cached = await cache.get(userId, request);
      expect(cached).toBeNull();
    });

    it('should not cache high-temperature responses', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Creative task' }],
        model: 'gpt-4o-mini',
        temperature: 0.9, // High temperature
      };

      const response: LLMResponse = {
        content: 'Creative response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      // Try to cache
      await cache.set(userId, request, response);

      // Should not be cached
      const cached = await cache.get(userId, request);
      expect(cached).toBeNull();
    });

    it('should not cache error responses', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4o-mini',
        temperature: 0,
      };

      const response: LLMResponse = {
        content: '',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
        error: 'API error',
      };

      await cache.set(userId, request, response);

      const cached = await cache.get(userId, request);
      expect(cached).toBeNull();
    });

    it('should use different keys for different operations', async () => {
      const baseRequest = {
        messages: [{ role: 'user' as const, content: 'Same message' }],
        model: 'gpt-4o-mini',
        temperature: 0,
      };

      const response1: LLMResponse = {
        content: 'IAB response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      const response2: LLMResponse = {
        content: 'Mission response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      // Cache with different operations
      await cache.set(userId, { ...baseRequest, operation: 'iab_classification' }, response1);
      await cache.set(userId, { ...baseRequest, operation: 'mission_agent' }, response2);

      // Retrieve separately
      const cached1 = await cache.get(userId, { ...baseRequest, operation: 'iab_classification' });
      const cached2 = await cache.get(userId, { ...baseRequest, operation: 'mission_agent' });

      expect(cached1?.content).toBe('IAB response');
      expect(cached2?.content).toBe('Mission response');
    });
  });

  describe('LRU eviction', () => {
    it('should evict LRU entries when cache exceeds limit', async () => {
      // Create cache with small limit (maxEntries: 2)
      const smallStore = new InMemoryCacheStore();
      const smallCache = new LLMCache(smallStore, { maxEntries: 2, maxSizeMB: 50 });

      const createRequest = (id: number): LLMRequest => ({
        messages: [{ role: 'user', content: `Message ${id}` }],
        model: 'gpt-4o-mini',
        operation: 'test',
        temperature: 0,
      });

      const createResponse = (id: number): LLMResponse => ({
        content: `Response ${id}`,
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      });

      // Add 2 entries (at limit)
      await smallCache.set(userId, createRequest(1), createResponse(1));
      await smallCache.set(userId, createRequest(2), createResponse(2));

      // Access entry 2 to make it more recently used
      await smallCache.get(userId, createRequest(2));

      // Add a 3rd entry (should evict entry 1, the least recently used)
      await smallCache.set(userId, createRequest(3), createResponse(3));

      // Entry 1 should be evicted (was LRU)
      const cached1 = await smallCache.get(userId, createRequest(1));
      expect(cached1).toBeNull();

      // Entry 2 should still exist (was accessed, so not LRU)
      const cached2 = await smallCache.get(userId, createRequest(2));
      expect(cached2).not.toBeNull();

      // Entry 3 should exist
      const cached3 = await smallCache.get(userId, createRequest(3));
      expect(cached3).not.toBeNull();
    });
  });

  describe('TTL by operation', () => {
    it('should have correct TTLs per operation type', () => {
      expect(TTL_BY_OPERATION.iab_classification).toBe(30 * 24 * 60 * 60 * 1000); // 30 days
      expect(TTL_BY_OPERATION.mission_agent).toBe(60 * 60 * 1000); // 1 hour
      expect(TTL_BY_OPERATION.ikigai_inference).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
      expect(TTL_BY_OPERATION.reflection_node).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(TTL_BY_OPERATION.embedding_generation).toBe(90 * 24 * 60 * 60 * 1000); // 90 days
      expect(TTL_BY_OPERATION.test).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should return TTL for operation type', () => {
      const ttl = cache.getTTL('iab_classification');
      expect(ttl).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe('cache statistics', () => {
    it('should track hit and miss counts', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4o-mini',
        temperature: 0,
      };

      const response: LLMResponse = {
        content: 'Test response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      // Miss
      await cache.get(userId, request);

      // Cache and hit
      await cache.set(userId, request, response);
      await cache.get(userId, request);
      await cache.get(userId, request);

      const stats = await cache.getStats(userId);
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(1);
    });

    it('should track total entries and size', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4o-mini',
        temperature: 0,
      };

      const response: LLMResponse = {
        content: 'Test response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      await cache.set(userId, request, response);

      const stats = await cache.getStats(userId);
      expect(stats.totalEntries).toBe(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('clearUserCache', () => {
    it('should clear all cache for a user', async () => {
      const createRequest = (id: number): LLMRequest => ({
        messages: [{ role: 'user', content: `Message ${id}` }],
        model: 'gpt-4o-mini',
        temperature: 0,
      });

      const response: LLMResponse = {
        content: 'Response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      // Add multiple entries
      await cache.set(userId, createRequest(1), response);
      await cache.set(userId, createRequest(2), response);
      await cache.set(userId, createRequest(3), response);

      // Clear
      const cleared = await cache.clearUserCache(userId);
      expect(cleared).toBe(3);

      // All should be gone
      const stats = await cache.getStats(userId);
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('clearOperationCache', () => {
    it('should clear cache for specific operation type', async () => {
      const iabRequest: LLMRequest = {
        messages: [{ role: 'user', content: 'IAB request' }],
        model: 'gpt-4o-mini',
        operation: 'iab_classification',
        temperature: 0,
      };

      const missionRequest: LLMRequest = {
        messages: [{ role: 'user', content: 'Mission request' }],
        model: 'gpt-4o-mini',
        operation: 'mission_agent',
        temperature: 0,
      };

      const response: LLMResponse = {
        content: 'Response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      await cache.set(userId, iabRequest, response);
      await cache.set(userId, missionRequest, response);

      // Clear only IAB cache
      const cleared = await cache.clearOperationCache(userId, 'iab_classification');
      expect(cleared).toBe(1);

      // IAB should be gone
      const iabCached = await cache.get(userId, iabRequest);
      expect(iabCached).toBeNull();

      // Mission should still be there
      const missionCached = await cache.get(userId, missionRequest);
      expect(missionCached).not.toBeNull();
    });
  });

  describe('has', () => {
    it('should check if request is cached without counting as hit', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4o-mini',
        temperature: 0,
      };

      const response: LLMResponse = {
        content: 'Test response',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.001 },
      };

      // Not cached yet
      expect(await cache.has(userId, request)).toBe(false);

      // Cache it
      await cache.set(userId, request, response);

      // Now cached
      expect(await cache.has(userId, request)).toBe(true);
    });
  });

  describe('InMemoryCacheStore', () => {
    it('should store and retrieve entries', async () => {
      const namespace = ['test', 'ns'] as const;
      const key = 'test-key';
      const entry: CacheEntry = {
        key,
        response: {
          content: 'Test',
          model: 'gpt-4o-mini',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0.001 },
        },
        operation: 'test',
        model: 'gpt-4o-mini',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 100,
      };

      await store.put(namespace, key, entry);
      const result = await store.get(namespace, key);

      expect(result).not.toBeNull();
      expect(result?.value.response.content).toBe('Test');
    });

    it('should delete entries', async () => {
      const namespace = ['test', 'ns'] as const;
      const key = 'test-key';
      const entry: CacheEntry = {
        key,
        response: {
          content: 'Test',
          model: 'gpt-4o-mini',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0.001 },
        },
        operation: 'test',
        model: 'gpt-4o-mini',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 100,
      };

      await store.put(namespace, key, entry);
      await store.delete(namespace, key);
      const result = await store.get(namespace, key);

      expect(result).toBeNull();
    });

    it('should search entries in namespace', async () => {
      const namespace = ['test', 'ns'] as const;

      const entry1: CacheEntry = {
        key: 'key1',
        response: { content: 'A', model: 'm', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } },
        operation: 'test',
        model: 'm',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 10,
      };

      const entry2: CacheEntry = {
        key: 'key2',
        response: { content: 'B', model: 'm', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } },
        operation: 'test',
        model: 'm',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 10,
      };

      await store.put(namespace, 'key1', entry1);
      await store.put(namespace, 'key2', entry2);

      const results = await store.search(namespace);
      expect(results.length).toBe(2);
    });

    it('should clear all data', async () => {
      const namespace = ['test', 'ns'] as const;
      const entry: CacheEntry = {
        key: 'key',
        response: { content: 'X', model: 'm', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } },
        operation: 'test',
        model: 'm',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 10,
      };

      await store.put(namespace, 'key', entry);
      store.clear();

      const result = await store.get(namespace, 'key');
      expect(result).toBeNull();
    });
  });
});
