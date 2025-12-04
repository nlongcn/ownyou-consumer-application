/**
 * Hybrid Retrieval - v13 Section 8.7
 *
 * Combines multiple retrieval methods:
 * 1. Semantic search (cosine similarity on embeddings)
 * 2. Keyword search (BM25 full-text matching)
 * 3. Entity lookup
 *
 * Results combined via Reciprocal Rank Fusion (RRF).
 * Final scoring adds strength and recency factors.
 */

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import { computeQueryEmbedding, cosineSimilarity } from '../embedding/local-embedder';
import { reciprocalRankFusion } from './rrf';
import type { SearchResult, RRFResult, ScoredMemory, RetrievalOptions } from '../types';

// Scoring weights
const DECAY_RATE = 0.95; // 5% per week
const RRF_WEIGHT = 0.5;
const STRENGTH_WEIGHT = 0.3;
const RECENCY_WEIGHT = 0.2;

/**
 * Retrieve memories using hybrid strategy - v13 Section 8.7
 */
export async function retrieveMemories(params: {
  query: string;
  userId: string;
  store: MemoryStore;
  options?: RetrievalOptions;
}): Promise<ScoredMemory[]> {
  const { query, userId, store, options = {} } = params;
  const { limit = 10, context, includeArchived = false } = options;

  // 1. Semantic search
  const semanticResults = await semanticSearch({
    query,
    userId,
    store,
    limit: limit * 2,
  });

  // 2. Keyword search (BM25) - use store's built-in search
  const keywordResults = await keywordSearch({
    query,
    userId,
    store,
    limit: limit * 2,
  });

  // 3. Entity lookup
  const entityResults = await entityLookup({
    query,
    userId,
    store,
    limit: 5,
  });

  // 4. Combine via RRF
  const rrfResults = reciprocalRankFusion([semanticResults, keywordResults, entityResults]);

  // 5. Calculate final scores
  const scored = rrfResults.map((result) => calculateFinalScore(result));

  // 6. Filter by context if provided
  const filtered = context
    ? scored.filter((m) => m.context === context || m.context === 'general')
    : scored;

  // 7. Filter archived if needed
  const archived = includeArchived
    ? filtered
    : filtered.filter((m) => !(m as Memory & { archived?: boolean }).archived);

  // 8. Filter invalid memories (bi-temporal)
  const valid = archived.filter((m) => !m.invalidAt);

  // 9. Return top results
  return valid.sort((a, b) => b.finalScore - a.finalScore).slice(0, limit);
}

/**
 * Semantic search using vector embeddings
 */
async function semanticSearch(params: {
  query: string;
  userId: string;
  store: MemoryStore;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, userId, store, limit } = params;

  try {
    // Compute query embedding
    const queryEmbedding = await computeQueryEmbedding(query);

    // Get all memories with embeddings
    const allMemories = await store.list<Memory>(NS.semanticMemory(userId));

    // Calculate similarities
    const withScores = allMemories.items
      .filter((m) => m.embedding && !(m as Memory & { archived?: boolean }).archived)
      .map((memory) => ({
        memory,
        score: cosineSimilarity(queryEmbedding, memory.embedding!),
        similarity: cosineSimilarity(queryEmbedding, memory.embedding!),
        rank: 0,
        source: 'semantic' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Assign ranks
    return withScores.map((item, i) => ({ ...item, rank: i + 1 }));
  } catch (error) {
    // Fall back to empty results if embedding fails
    console.warn('Semantic search failed:', error);
    return [];
  }
}

/**
 * Keyword search using BM25
 */
async function keywordSearch(params: {
  query: string;
  userId: string;
  store: MemoryStore;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, userId, store, limit } = params;

  try {
    // Use store's built-in BM25 search
    const results = await store.search<Memory>({
      namespace: NS.semanticMemory(userId),
      query,
      modes: ['bm25'],
      limit,
    });

    return results.map((r, i) => ({
      memory: r.item,
      score: r.scores.bm25 ?? r.scores.final,
      rank: i + 1,
      source: 'keyword' as const,
    }));
  } catch (error) {
    console.warn('Keyword search failed:', error);
    return [];
  }
}

/**
 * Entity lookup for mentioned entities
 */
async function entityLookup(params: {
  query: string;
  userId: string;
  store: MemoryStore;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, userId, store, limit } = params;

  // Extract potential entity names (capitalized words, quoted phrases)
  const entityNames = extractEntityNames(query);

  if (entityNames.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];

  try {
    // Get all memories and filter by entity mention
    const allMemories = await store.list<Memory>(NS.semanticMemory(userId));

    for (const name of entityNames) {
      const matching = allMemories.items
        .filter((m) => {
          const content = m.content.toLowerCase();
          return content.includes(name.toLowerCase());
        })
        .slice(0, limit);

      matching.forEach((memory, i) => {
        // Avoid duplicates
        if (!results.some((r) => r.memory.id === memory.id)) {
          results.push({
            memory,
            score: 1 / (i + 1),
            rank: results.length + 1,
            source: 'entity' as const,
          });
        }
      });
    }
  } catch (error) {
    console.warn('Entity lookup failed:', error);
  }

  return results.slice(0, limit);
}

/**
 * Extract potential entity names from query
 */
function extractEntityNames(query: string): string[] {
  // Capitalized words (potential proper nouns)
  const capitalized = query.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];

  // Quoted phrases
  const quoted = query.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) || [];

  return [...new Set([...capitalized, ...quoted])];
}

/**
 * Calculate final score with strength and recency - v13 Section 8.7.3
 */
function calculateFinalScore(result: RRFResult): ScoredMemory {
  const memory = result.memory;

  // Recency decay (~5% per week)
  const daysSinceAccess = (Date.now() - memory.lastAccessed) / (24 * 60 * 60 * 1000);
  const recencyScore = Math.pow(DECAY_RATE, daysSinceAccess / 7);

  // Normalize strength to 0-1 (strength can grow > 1)
  const normalizedStrength = Math.min(memory.strength / 5.0, 1.0);

  // Combined score
  const finalScore =
    result.rrfScore * RRF_WEIGHT + normalizedStrength * STRENGTH_WEIGHT + recencyScore * RECENCY_WEIGHT;

  // Determine match type
  const matchType =
    result.sources.length > 1
      ? 'combined'
      : (result.sources[0] as 'semantic' | 'keyword' | 'entity');

  return {
    ...memory,
    finalScore,
    matchType,
  };
}

/**
 * Find similar memories (for consolidation check)
 */
export async function findSimilarMemories(params: {
  query: string;
  queryEmbedding: number[];
  userId: string;
  store: MemoryStore;
  threshold: number;
  limit: number;
}): Promise<{ memory: Memory; similarity: number }[]> {
  const { queryEmbedding, userId, store, threshold, limit } = params;

  const allMemories = await store.list<Memory>(NS.semanticMemory(userId));

  return allMemories.items
    .filter((m) => m.embedding && !(m as Memory & { archived?: boolean }).archived && !m.invalidAt)
    .map((memory) => ({
      memory,
      similarity: cosineSimilarity(queryEmbedding, memory.embedding!),
    }))
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
