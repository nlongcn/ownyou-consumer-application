/**
 * Embedding Module - v13 Section 8.5
 *
 * Local embeddings using @xenova/transformers.
 */

export {
  computeLocalEmbedding,
  computeBatchEmbeddings,
  computeQueryEmbedding,
  cosineSimilarity,
  isEmbeddingAvailable,
  resetEmbedder,
  EMBEDDING_CONFIG,
} from './local-embedder';

export { EmbeddingQueue, DEFAULT_QUEUE_CONFIG } from './embedding-queue';
