/**
 * Search Module - v13 Section 8.7
 *
 * Exports search implementations for hybrid retrieval.
 */

export { SemanticSearch, type SearchResult } from './semantic';
export { BM25Search } from './bm25';
export { RRFusion, type FusedResult } from './rrf';
export { MockEmbeddingService, type EmbeddingService } from './embeddings';
