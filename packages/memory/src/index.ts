/**
 * @ownyou/memory - Memory Intelligence Package
 *
 * v13 Section 8: Memory tools, embeddings, retrieval, and lifecycle.
 *
 * This package provides:
 * - Memory tools (save_observation, save_episode, search_memories, invalidate_memory)
 * - Local embeddings via @xenova/transformers
 * - Hybrid retrieval (semantic + BM25 + RRF)
 * - Memory lifecycle (decay, consolidation, pruning)
 *
 * @example
 * ```typescript
 * import { saveObservation, searchMemories, pruneMemories } from '@ownyou/memory';
 * import { MemoryStore, InMemoryBackend } from '@ownyou/memory-store';
 *
 * const store = new MemoryStore({ backend: new InMemoryBackend() });
 *
 * // Save an observation
 * await saveObservation(
 *   { content: 'User prefers window seats', context: 'travel', confidence: 0.8 },
 *   { userId: 'user_1', store }
 * );
 *
 * // Search memories
 * const results = await searchMemories(
 *   { query: 'seat preferences' },
 *   { userId: 'user_1', store }
 * );
 *
 * // Run memory pruning
 * await pruneMemories('user_1', store);
 * ```
 */

// Types
export type {
  SaveObservationParams,
  SaveObservationContext,
  SaveObservationResult,
  SaveEpisodeParams,
  SaveEpisodeContext,
  SaveEpisodeResult,
  SearchMemoriesParams,
  SearchMemoriesContext,
  ScoredMemory,
  InvalidateMemoryParams,
  InvalidateMemoryContext,
  EmbeddingConfig,
  EmbeddingQueueConfig,
  EmbeddingQueueItem,
  EmbeddingQueueStatus,
  SearchResult,
  RRFResult,
  RetrievalOptions,
  DecayConfig,
  LifecycleResult,
  ConsolidationParams,
} from './types';

// Tools
export {
  saveObservation,
  saveObservations,
  saveEpisode,
  updateEpisodeWithFeedback,
  getEpisodesByAgent,
  getRecentNegativeEpisodes,
  countEpisodesSinceReflection,
  searchMemories,
  searchMemoriesWithPrivacy,
  getMemoriesByContext,
  getStrongestMemories,
  getRecentMemories,
  invalidateMemory,
  revalidateMemory,
  getInvalidatedMemories,
  isMemoryInvalidated,
  invalidateMemoriesContaining,
} from './tools';

// Embedding
export {
  computeLocalEmbedding,
  computeBatchEmbeddings,
  computeQueryEmbedding,
  cosineSimilarity,
  isEmbeddingAvailable,
  resetEmbedder,
  EMBEDDING_CONFIG,
  EmbeddingQueue,
  DEFAULT_QUEUE_CONFIG,
} from './embedding';

// Retrieval
export {
  reciprocalRankFusion,
  normalizeRRFScores,
  maxRRFScore,
  DEFAULT_RRF_K,
  retrieveMemories,
  findSimilarMemories,
} from './retrieval';

// Lifecycle
export {
  calculateEffectiveStrength,
  shouldPrune,
  daysUntilPrune,
  boostStrength,
  findMemoriesToPrune,
  calculateDecayStats,
  DECAY_RATE,
  PRUNE_THRESHOLD,
  consolidateMemory,
  findConsolidationCandidates,
  archiveMemory,
  unarchiveMemory,
  pruneMemories,
  getArchivedMemories,
  purgeOldArchives,
  checkQuotas,
  DEFAULT_QUOTAS,
  ARCHIVED_NAMESPACE,
  type MemoryQuotas,
} from './lifecycle';
