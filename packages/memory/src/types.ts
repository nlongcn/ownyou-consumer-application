/**
 * Memory Package Types - v13 Section 8.8
 *
 * Types for memory tools, embeddings, retrieval, and lifecycle.
 */

import type { Memory, PrivacyTier, AgentType } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';

// =============================================================================
// Tool Types
// =============================================================================

/**
 * Parameters for save observation tool
 */
export interface SaveObservationParams {
  /** Natural language observation */
  content: string;
  /** Domain: travel, shopping, dining, etc. */
  context: string;
  /** 0.0-1.0 confidence */
  confidence: number;
  /** When fact became true (default: now) */
  validAt?: number;
  /** Privacy tier (default: public) */
  privacyTier?: PrivacyTier;
}

/**
 * Context for save observation tool
 */
export interface SaveObservationContext {
  userId: string;
  /** Link to triggering episode */
  episodeId?: string;
  store: MemoryStore;
}

/**
 * Result of save observation
 */
export interface SaveObservationResult {
  memoryId: string;
  action: 'created' | 'consolidated';
}

/**
 * Parameters for save episode tool
 */
export interface SaveEpisodeParams {
  /** What the user was trying to do */
  situation: string;
  /** How the agent approached it */
  reasoning: string;
  /** What solution was provided */
  action: string;
  /** What happened */
  outcome: 'success' | 'failure' | 'partial' | 'pending';
  /** Explicit feedback or inferred satisfaction */
  userFeedback?: 'love' | 'like' | 'meh';
}

/**
 * Context for save episode tool
 */
export interface SaveEpisodeContext {
  userId: string;
  agentType: AgentType;
  missionId: string;
  store: MemoryStore;
}

/**
 * Result of save episode
 */
export interface SaveEpisodeResult {
  episodeId: string;
}

/**
 * Parameters for search memories tool
 */
export interface SearchMemoriesParams {
  /** What to search for */
  query: string;
  /** Optional domain filter */
  context?: string;
  /** Max results (default: 10) */
  limit?: number;
  /** Include archived memories */
  includeArchived?: boolean;
}

/**
 * Context for search memories tool
 */
export interface SearchMemoriesContext {
  userId: string;
  store: MemoryStore;
  /** For privacy enforcement */
  requestingAgent?: AgentType;
}

/**
 * Memory with final score from retrieval
 */
export interface ScoredMemory extends Memory {
  finalScore: number;
  matchType: 'semantic' | 'keyword' | 'entity' | 'combined';
}

/**
 * Parameters for invalidate memory tool
 */
export interface InvalidateMemoryParams {
  memoryId: string;
  /** Why this is no longer true */
  reason: string;
}

/**
 * Context for invalidate memory tool
 */
export interface InvalidateMemoryContext {
  userId: string;
  store: MemoryStore;
}

// =============================================================================
// Embedding Types
// =============================================================================

/**
 * Embedding configuration
 */
export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

/**
 * Embedding queue item
 */
export interface EmbeddingQueueItem {
  memoryId: string;
  userId: string;
  content: string;
  addedAt: number;
}

/**
 * Embedding queue configuration
 */
export interface EmbeddingQueueConfig {
  maxQueueSize: number;
  /** Processing interval in ms */
  processInterval: number;
  batchSize: number;
}

/**
 * Embedding queue status
 */
export interface EmbeddingQueueStatus {
  size: number;
  maxSize: number;
  processing: boolean;
}

// =============================================================================
// Retrieval Types
// =============================================================================

/**
 * Search result from a single retrieval method
 */
export interface SearchResult {
  memory: Memory;
  /** Raw score from search method */
  score: number;
  /** Cosine similarity (semantic only) */
  similarity?: number;
  /** Position in result list */
  rank: number;
  source: 'semantic' | 'keyword' | 'entity';
}

/**
 * Result after RRF fusion
 */
export interface RRFResult {
  memory: Memory;
  rrfScore: number;
  /** How many lists this appeared in */
  appearances: number;
  sources: string[];
}

/**
 * Retrieval options
 */
export interface RetrievalOptions {
  limit?: number;
  /** Domain filter */
  context?: string;
  includeArchived?: boolean;
  /** For privacy enforcement */
  requestingAgent?: AgentType;
}

// =============================================================================
// Lifecycle Types
// =============================================================================

/**
 * Decay configuration
 */
export interface DecayConfig {
  /** Decay rate per week (default: 0.95 = 5% decay) */
  rate: number;
  /** Threshold below which memories are archived (default: 0.1) */
  pruneThreshold: number;
}

/**
 * Memory lifecycle result
 */
export interface LifecycleResult {
  /** Memories decayed */
  decayed: number;
  /** Memories archived */
  archived: number;
  /** Memories consolidated */
  consolidated: number;
}

/**
 * Consolidation params
 */
export interface ConsolidationParams {
  existing: Memory;
  newContent: string;
  newConfidence: number;
  userId: string;
  store: MemoryStore;
}
