/**
 * MemoryStore - v13 Section 8.7
 *
 * LangGraph Store-compatible interface for memory operations.
 * Provides put, get, delete, list, and search operations with
 * hybrid search (semantic + BM25 + RRF fusion).
 *
 * @see docs/architecture/extracts/memory-types-8.4.md
 */

import type { Memory, NamespaceTuple } from '@ownyou/shared-types';
import type { StorageBackend } from './backends/types';
import type { EmbeddingService } from './search/embeddings';
import { SemanticSearch, type SearchResult } from './search/semantic';
import { BM25Search } from './search/bm25';
import { RRFusion } from './search/rrf';

/**
 * Store configuration
 */
export interface MemoryStoreConfig {
  /** Storage backend (IndexedDB, SQLite, etc.) */
  backend: StorageBackend;
  /** Embedding service for semantic search (optional) */
  embeddingService?: EmbeddingService;
  /** Event callback for observability */
  onEvent?: (event: StoreEvent) => void;
}

/**
 * Store event for observability
 */
export interface StoreEvent {
  type: 'put' | 'get' | 'delete' | 'list' | 'search';
  namespace: NamespaceTuple;
  key?: string;
  timestamp: number;
  durationMs?: number;
}

/**
 * List operation options
 */
export interface ListOptions {
  /** Maximum items to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by field values */
  filter?: Record<string, unknown>;
}

/**
 * List operation result
 */
export interface ListResult<T> {
  items: T[];
  hasMore: boolean;
}

/**
 * Search query options
 */
export interface SearchQuery {
  /** Namespace to search in */
  namespace: NamespaceTuple;
  /** Search query text */
  query: string;
  /** Search modes to use */
  modes: ('semantic' | 'bm25')[];
  /** Maximum results */
  limit?: number;
  /** Scoring weights */
  weights?: {
    rrf?: number;
    strength?: number;
    recency?: number;
  };
  /** Filter by field values */
  filter?: Record<string, unknown>;
}

/**
 * Search result with scores
 */
export interface ScoredResult<T> {
  item: T;
  scores: {
    semantic?: number;
    bm25?: number;
    rrf?: number;
    strength?: number;
    recency?: number;
    final: number;
  };
}

/**
 * MemoryStore - LangGraph Store-compatible memory management
 */
export class MemoryStore {
  private backend: StorageBackend;
  private embeddingService?: EmbeddingService;
  private onEvent?: (event: StoreEvent) => void;

  private semanticSearch: SemanticSearch;
  private bm25Search: BM25Search;
  private rrfFusion: RRFusion;

  constructor(config: MemoryStoreConfig) {
    this.backend = config.backend;
    this.embeddingService = config.embeddingService;
    this.onEvent = config.onEvent;

    this.semanticSearch = new SemanticSearch();
    this.bm25Search = new BM25Search();
    this.rrfFusion = new RRFusion();
  }

  /**
   * Store an item
   * @param namespace Namespace tuple [namespace, userId] or [namespace, userId, subkey]
   * @param key Item key
   * @param value Item value
   */
  async put<T>(namespace: NamespaceTuple, key: string, value: T): Promise<void> {
    const startTime = Date.now();

    // Auto-generate embedding if embeddingService is available and value has content
    let storedValue = value;
    const valueWithContent = value as { content?: string; embedding?: number[] };
    if (this.embeddingService && valueWithContent.content && !valueWithContent.embedding) {
      const embedding = await this.embeddingService.embed(valueWithContent.content);
      storedValue = { ...value, embedding };
    }

    const [ns, userId] = namespace;
    await this.backend.put(ns, userId, key, storedValue);

    this.emitEvent({
      type: 'put',
      namespace,
      key,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    });
  }

  /**
   * Retrieve an item
   * @param namespace Namespace tuple
   * @param key Item key
   * @returns Item or null if not found
   */
  async get<T>(namespace: NamespaceTuple, key: string): Promise<T | null> {
    const startTime = Date.now();
    const [ns, userId] = namespace;

    const value = await this.backend.get<T>(ns, userId, key);

    if (value) {
      // Update access tracking (only for items with accessCount - typically Memory types)
      let result: T = value;
      const valueAsRecord = value as Record<string, unknown>;
      if (
        typeof valueAsRecord === 'object' &&
        valueAsRecord !== null &&
        'accessCount' in valueAsRecord
      ) {
        const updated = {
          ...valueAsRecord,
          lastAccessed: Date.now(),
          accessCount: ((valueAsRecord.accessCount as number) ?? 0) + 1,
        };
        await this.backend.put(ns, userId, key, updated);
        result = updated as unknown as T;
      }

      this.emitEvent({
        type: 'get',
        namespace,
        key,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      });

      return result;
    }

    this.emitEvent({
      type: 'get',
      namespace,
      key,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    });

    return null;
  }

  /**
   * Delete an item
   * @param namespace Namespace tuple
   * @param key Item key
   * @returns true if deleted, false if not found
   */
  async delete(namespace: NamespaceTuple, key: string): Promise<boolean> {
    const startTime = Date.now();
    const [ns, userId] = namespace;

    const deleted = await this.backend.delete(ns, userId, key);

    this.emitEvent({
      type: 'delete',
      namespace,
      key,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    });

    return deleted;
  }

  /**
   * List items in a namespace
   * @param namespace Namespace tuple
   * @param options List options (limit, offset, filter)
   * @returns List result with items and hasMore flag
   */
  async list<T>(namespace: NamespaceTuple, options?: ListOptions): Promise<ListResult<T>> {
    const startTime = Date.now();
    const [ns, userId] = namespace;

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    // Get one extra to check if there are more
    let items = await this.backend.list<T>(ns, userId, limit + 1, offset);

    // Apply filter if provided
    if (options?.filter) {
      items = items.filter((item) => this.matchesFilter(item, options.filter!));
    }

    const hasMore = items.length > limit;
    if (hasMore) {
      items = items.slice(0, limit);
    }

    this.emitEvent({
      type: 'list',
      namespace,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    });

    return { items, hasMore };
  }

  /**
   * Search items with hybrid search
   * @param query Search query options
   * @returns Scored search results
   */
  async search<T extends Memory>(query: SearchQuery): Promise<ScoredResult<T>[]> {
    const startTime = Date.now();
    const [ns, userId] = query.namespace;

    // Load all items from namespace
    let items = await this.backend.list<T>(ns, userId, 10000, 0);

    // Apply filter if provided
    if (query.filter) {
      items = items.filter((item) => this.matchesFilter(item, query.filter!));
    }

    const limit = query.limit ?? 10;
    const resultLists: SearchResult<Memory>[][] = [];

    // BM25 search
    if (query.modes.includes('bm25')) {
      const bm25Results = this.bm25Search.search(items as Memory[], query.query, limit * 2);
      resultLists.push(bm25Results);
    }

    // Semantic search
    if (query.modes.includes('semantic') && this.embeddingService) {
      const queryEmbedding = await this.embeddingService.embed(query.query);
      const semanticResults = this.semanticSearch.search(items as Memory[], queryEmbedding, limit * 2);
      resultLists.push(semanticResults);
    }

    // Fuse results if we have multiple lists
    let results: ScoredResult<T>[];

    if (resultLists.length === 0) {
      results = [];
    } else if (resultLists.length === 1) {
      // Single mode - use raw scores
      const single = resultLists[0];
      results = single.map((r) => ({
        item: r.item as T,
        scores: {
          ...(query.modes.includes('bm25') ? { bm25: r.score } : {}),
          ...(query.modes.includes('semantic') ? { semantic: r.score } : {}),
          final: r.score,
        },
      }));
    } else {
      // Hybrid - fuse with RRF
      const fused = this.rrfFusion.fuse(resultLists, limit);
      results = fused.map((r) => ({
        item: r.item as T,
        scores: {
          rrf: r.scores.rrf,
          final: r.scores.final,
        },
      }));
    }

    // Apply additional scoring if weights provided
    if (query.weights) {
      results = this.applyWeightedScoring(results, query.weights);
    }

    // Sort by final score
    results.sort((a, b) => b.scores.final - a.scores.final);

    this.emitEvent({
      type: 'search',
      namespace: query.namespace,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    });

    return results.slice(0, limit);
  }

  /**
   * Check if an item matches the filter criteria
   */
  private matchesFilter(item: unknown, filter: Record<string, unknown>): boolean {
    if (!item || typeof item !== 'object') return false;

    for (const [key, value] of Object.entries(filter)) {
      if ((item as Record<string, unknown>)[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply weighted scoring for strength and recency
   */
  private applyWeightedScoring<T extends Memory>(
    results: ScoredResult<T>[],
    weights: { rrf?: number; strength?: number; recency?: number }
  ): ScoredResult<T>[] {
    const now = Date.now();
    const oneDay = 86400000;

    return results.map((result) => {
      const memory = result.item;

      // Compute strength score (already 0-1)
      const strengthScore = memory.strength ?? 1.0;

      // Compute recency score (exponential decay)
      const age = now - (memory.createdAt ?? now);
      const recencyScore = Math.exp(-age / (7 * oneDay)); // Half-life of ~5 days

      // Compute weighted final score
      const rrfWeight = weights.rrf ?? 0.5;
      const strengthWeight = weights.strength ?? 0.3;
      const recencyWeight = weights.recency ?? 0.2;

      const baseScore = result.scores.rrf ?? result.scores.bm25 ?? result.scores.semantic ?? 0;
      const weightedFinal =
        baseScore * rrfWeight + strengthScore * strengthWeight + recencyScore * recencyWeight;

      return {
        ...result,
        scores: {
          ...result.scores,
          strength: strengthScore,
          recency: recencyScore,
          final: weightedFinal,
        },
      };
    });
  }

  /**
   * Emit a store event
   */
  private emitEvent(event: StoreEvent): void {
    if (this.onEvent) {
      this.onEvent(event);
    }
  }

  /**
   * Close the store and backend
   */
  async close(): Promise<void> {
    if (this.backend.close) {
      await this.backend.close();
    }
  }
}
