/**
 * @ownyou/memory-store - v13 Section 8.7
 *
 * LangGraph Store-compatible memory management package.
 * Provides persistent storage with hybrid search capabilities.
 *
 * @example
 * ```typescript
 * import { MemoryStore, IndexedDBBackend, MockEmbeddingService, NS } from '@ownyou/memory-store';
 *
 * const store = new MemoryStore({
 *   backend: new IndexedDBBackend(),
 *   embeddingService: new MockEmbeddingService(),
 * });
 *
 * // Store a memory
 * await store.put(NS.semanticMemory(userId), 'mem_1', memory);
 *
 * // Search with hybrid ranking
 * const results = await store.search({
 *   namespace: NS.semanticMemory(userId),
 *   query: 'outdoor activities',
 *   modes: ['semantic', 'bm25'],
 * });
 * ```
 */

// Store
export {
  MemoryStore,
  type MemoryStoreConfig,
  type StoreEvent,
  type ListOptions,
  type ListResult,
  type SearchQuery,
  type ScoredResult,
} from './store';

// Backends
export { IndexedDBBackend } from './backends/indexeddb';
export { InMemoryBackend } from './backends/memory';
export type { StorageBackend, StoreStats, BackendConfig } from './backends/types';

// Search
export { SemanticSearch, type SearchResult } from './search/semantic';
export { BM25Search } from './search/bm25';
export { RRFusion, type FusedResult } from './search/rrf';
export { MockEmbeddingService, type EmbeddingService } from './search/embeddings';
