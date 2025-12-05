/**
 * LLM Response Cache - v13 Section 6.11.3 (Fallback Chain Step 5)
 *
 * Implements response caching with:
 * - SHA-256 hash-based cache keys
 * - TTL by operation type
 * - LRU eviction policy
 * - Size limits (1,000 entries, 50MB)
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import type { LLMRequest, LLMResponse, OperationType } from './providers/types';
import { NS, type NamespaceTuple } from '@ownyou/shared-types';

/**
 * TTL by operation type (milliseconds)
 */
export const TTL_BY_OPERATION: Record<OperationType, number> = {
  iab_classification: 30 * 24 * 60 * 60 * 1000, // 30 days - stable mappings
  mission_agent: 60 * 60 * 1000, // 1 hour - context-dependent
  ikigai_inference: 7 * 24 * 60 * 60 * 1000, // 7 days - slow changing
  reflection_node: 24 * 60 * 60 * 1000, // 24 hours - daily refresh
  embedding_generation: 90 * 24 * 60 * 60 * 1000, // 90 days - deterministic
  shopping_intent_detection: 60 * 60 * 1000, // 1 hour - context-dependent
  test: 5 * 60 * 1000, // 5 minutes - for testing
};

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxEntries: number; // Default: 1000
  maxSizeMB: number; // Default: 50
  evictionPolicy: 'LRU';
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 1000,
  maxSizeMB: 50,
  evictionPolicy: 'LRU',
};

/**
 * Cache entry stored in LangGraph Store
 */
export interface CacheEntry {
  key: string;
  response: LLMResponse;
  operation: OperationType;
  model: string;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  hitCount: number;
  sizeBytes: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * Store interface (matches LangGraph Store API)
 */
export interface CacheStore {
  get(namespace: NamespaceTuple, key: string): Promise<{ value: CacheEntry } | null>;
  put(namespace: NamespaceTuple, key: string, value: CacheEntry): Promise<void>;
  delete(namespace: NamespaceTuple, key: string): Promise<void>;
  search(namespace: NamespaceTuple): Promise<Array<{ key: string; value: CacheEntry }>>;
}

/**
 * Generate SHA-256 cache key from request
 */
export async function generateCacheKey(request: LLMRequest): Promise<string> {
  const payload = JSON.stringify({
    operation: request.operation ?? 'test',
    model: request.model ?? 'default',
    messages: request.messages,
    temperature: request.temperature ?? 0,
  });

  // Use SubtleCrypto for SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  // Browser environment
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(payload).digest('hex');
  } catch {
    // Last resort: simple hash function
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/**
 * LLM Response Cache with TTL and LRU eviction
 */
export class LLMCache {
  private store: CacheStore;
  private config: CacheConfig;
  private stats: CacheStats;

  constructor(store: CacheStore, config?: Partial<CacheConfig>) {
    this.store = store;
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.stats = {
      totalEntries: 0,
      totalSizeBytes: 0,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  /**
   * Get namespace for user's cache
   */
  private getNamespace(userId: string): NamespaceTuple {
    return NS.llmCache(userId);
  }

  /**
   * Get cached response if available and not expired
   */
  async get(userId: string, request: LLMRequest): Promise<LLMResponse | null> {
    const key = await generateCacheKey(request);
    const namespace = this.getNamespace(userId);

    try {
      const result = await this.store.get(namespace, key);

      if (!result) {
        this.stats.missCount++;
        return null;
      }

      const entry = result.value;

      // Check expiration
      if (entry.expiresAt < Date.now()) {
        await this.delete(userId, key);
        this.stats.missCount++;
        return null;
      }

      // Update access time and hit count
      entry.lastAccessedAt = Date.now();
      entry.hitCount++;
      await this.store.put(namespace, key, entry);

      this.stats.hitCount++;
      return entry.response;
    } catch (error) {
      this.stats.missCount++;
      return null;
    }
  }

  /**
   * Cache a response
   */
  async set(userId: string, request: LLMRequest, response: LLMResponse): Promise<void> {
    // Skip caching high-temperature responses (non-deterministic)
    if ((request.temperature ?? 0) > 0.5) {
      return;
    }

    // Skip caching error responses
    if (response.error) {
      return;
    }

    const key = await generateCacheKey(request);
    const operation = request.operation ?? 'test';
    const ttl = TTL_BY_OPERATION[operation];
    const namespace = this.getNamespace(userId);

    // Enforce size limits before adding
    await this.enforceSize(userId);

    const now = Date.now();
    const sizeBytes = JSON.stringify(response).length;

    const entry: CacheEntry = {
      key,
      response,
      operation,
      model: request.model ?? response.model,
      createdAt: now,
      expiresAt: now + ttl,
      lastAccessedAt: now,
      hitCount: 0,
      sizeBytes,
    };

    await this.store.put(namespace, key, entry);
  }

  /**
   * Delete a cache entry
   */
  async delete(userId: string, key: string): Promise<void> {
    const namespace = this.getNamespace(userId);
    await this.store.delete(namespace, key);
  }

  /**
   * Clear all cache for a user
   */
  async clearUserCache(userId: string): Promise<number> {
    const namespace = this.getNamespace(userId);
    const entries = await this.store.search(namespace);
    let count = 0;

    for (const entry of entries) {
      await this.store.delete(namespace, entry.key);
      count++;
    }

    return count;
  }

  /**
   * Clear cache for specific operation type
   */
  async clearOperationCache(userId: string, operation: OperationType): Promise<number> {
    const namespace = this.getNamespace(userId);
    const entries = await this.store.search(namespace);
    let count = 0;

    for (const entry of entries) {
      if (entry.value.operation === operation) {
        await this.store.delete(namespace, entry.key);
        count++;
      }
    }

    return count;
  }

  /**
   * Prune expired entries
   */
  async pruneExpired(userId: string): Promise<number> {
    const namespace = this.getNamespace(userId);
    const entries = await this.store.search(namespace);
    const now = Date.now();
    let count = 0;

    for (const entry of entries) {
      if (entry.value.expiresAt < now) {
        await this.store.delete(namespace, entry.key);
        count++;
      }
    }

    return count;
  }

  /**
   * Enforce cache size limits using LRU eviction
   */
  private async enforceSize(userId: string): Promise<void> {
    const namespace = this.getNamespace(userId);
    const entries = await this.store.search(namespace);

    // Calculate current totals
    let totalEntries = entries.length;
    let totalSizeBytes = entries.reduce((sum, e) => sum + e.value.sizeBytes, 0);
    const maxSizeBytes = this.config.maxSizeMB * 1024 * 1024;

    // Check if we need to evict
    if (totalEntries < this.config.maxEntries && totalSizeBytes < maxSizeBytes) {
      return;
    }

    // Sort by lastAccessedAt (oldest first) for LRU
    const sortedEntries = entries.sort(
      (a, b) => a.value.lastAccessedAt - b.value.lastAccessedAt
    );

    // Evict until under limits
    for (const entry of sortedEntries) {
      if (totalEntries < this.config.maxEntries && totalSizeBytes < maxSizeBytes) {
        break;
      }

      await this.store.delete(namespace, entry.key);
      totalEntries--;
      totalSizeBytes -= entry.value.sizeBytes;
      this.stats.evictionCount++;
    }
  }

  /**
   * Get cache statistics for a user
   */
  async getStats(userId: string): Promise<CacheStats> {
    const namespace = this.getNamespace(userId);
    const entries = await this.store.search(namespace);

    const stats: CacheStats = {
      totalEntries: entries.length,
      totalSizeBytes: entries.reduce((sum, e) => sum + e.value.sizeBytes, 0),
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      evictionCount: this.stats.evictionCount,
      oldestEntry: null,
      newestEntry: null,
    };

    if (entries.length > 0) {
      const sorted = entries.sort((a, b) => a.value.createdAt - b.value.createdAt);
      stats.oldestEntry = sorted[0].value.createdAt;
      stats.newestEntry = sorted[sorted.length - 1].value.createdAt;
    }

    return stats;
  }

  /**
   * Check if a request is cached (without counting as hit)
   */
  async has(userId: string, request: LLMRequest): Promise<boolean> {
    const key = await generateCacheKey(request);
    const namespace = this.getNamespace(userId);

    try {
      const result = await this.store.get(namespace, key);
      if (!result) return false;
      return result.value.expiresAt >= Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Get TTL for an operation type
   */
  getTTL(operation: OperationType): number {
    return TTL_BY_OPERATION[operation];
  }

  /**
   * Get the cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }
}

/**
 * In-memory cache store for testing
 */
export class InMemoryCacheStore implements CacheStore {
  private data: Map<string, Map<string, CacheEntry>> = new Map();

  private getNamespaceKey(namespace: NamespaceTuple): string {
    return namespace.join(':');
  }

  async get(namespace: NamespaceTuple, key: string): Promise<{ value: CacheEntry } | null> {
    const nsKey = this.getNamespaceKey(namespace);
    const ns = this.data.get(nsKey);
    if (!ns) return null;
    const entry = ns.get(key);
    if (!entry) return null;
    return { value: entry };
  }

  async put(namespace: NamespaceTuple, key: string, value: CacheEntry): Promise<void> {
    const nsKey = this.getNamespaceKey(namespace);
    if (!this.data.has(nsKey)) {
      this.data.set(nsKey, new Map());
    }
    this.data.get(nsKey)!.set(key, value);
  }

  async delete(namespace: NamespaceTuple, key: string): Promise<void> {
    const nsKey = this.getNamespaceKey(namespace);
    const ns = this.data.get(nsKey);
    if (ns) {
      ns.delete(key);
    }
  }

  async search(namespace: NamespaceTuple): Promise<Array<{ key: string; value: CacheEntry }>> {
    const nsKey = this.getNamespaceKey(namespace);
    const ns = this.data.get(nsKey);
    if (!ns) return [];
    return Array.from(ns.entries()).map(([key, value]) => ({ key, value }));
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.data.clear();
  }
}
