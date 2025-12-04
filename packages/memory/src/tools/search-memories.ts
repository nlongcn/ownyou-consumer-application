/**
 * Search Memories Tool - v13 Section 8.8.1
 *
 * Finds relevant memories using hybrid retrieval:
 * - Semantic search (cosine similarity on embeddings)
 * - Keyword search (BM25 full-text)
 * - Entity lookup
 * - Combined via Reciprocal Rank Fusion (RRF)
 */

import { retrieveMemories } from '../retrieval/hybrid-retrieval';
import type {
  SearchMemoriesParams,
  SearchMemoriesContext,
  ScoredMemory,
} from '../types';

/**
 * Search memories using hybrid retrieval
 */
export async function searchMemories(
  params: SearchMemoriesParams,
  context: SearchMemoriesContext
): Promise<ScoredMemory[]> {
  const { query, context: domain, limit = 10, includeArchived = false } = params;
  const { userId, store, requestingAgent } = context;

  const results = await retrieveMemories({
    query,
    userId,
    store,
    options: {
      limit,
      context: domain,
      includeArchived,
      requestingAgent,
    },
  });

  return results;
}

/**
 * Search memories with privacy tier filtering
 *
 * Enforces access control based on requesting agent and memory privacy tier.
 */
export async function searchMemoriesWithPrivacy(
  params: SearchMemoriesParams,
  context: SearchMemoriesContext
): Promise<ScoredMemory[]> {
  const results = await searchMemories(params, context);

  // If no requesting agent, return all (system call)
  if (!context.requestingAgent) {
    return results;
  }

  // Filter by privacy tier
  // - public: all agents can access
  // - sensitive: only same agent type or with justification
  // - private: no cross-agent access
  return results.filter((memory) => {
    if (memory.privacyTier === 'public') {
      return true;
    }

    if (memory.privacyTier === 'sensitive') {
      // For now, allow sensitive access (will add justification check later)
      return true;
    }

    // Private memories - check if source agent matches
    // (simplified - real implementation would check provenance)
    return false;
  });
}

/**
 * Get memories by context/domain
 */
export async function getMemoriesByContext(
  context: string,
  userId: string,
  store: SearchMemoriesContext['store'],
  limit: number = 20
): Promise<ScoredMemory[]> {
  return searchMemories(
    { query: context, context, limit },
    { userId, store }
  );
}

/**
 * Get strongest memories (highest strength score)
 */
export async function getStrongestMemories(
  userId: string,
  store: SearchMemoriesContext['store'],
  limit: number = 10
): Promise<ScoredMemory[]> {
  const results = await searchMemories(
    { query: '*', limit: limit * 3 }, // Get more to sort
    { userId, store }
  );

  // Sort by strength
  return results
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}

/**
 * Get most recent memories
 */
export async function getRecentMemories(
  userId: string,
  store: SearchMemoriesContext['store'],
  limit: number = 10
): Promise<ScoredMemory[]> {
  const results = await searchMemories(
    { query: '*', limit: limit * 3 },
    { userId, store }
  );

  // Sort by creation time
  return results
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
