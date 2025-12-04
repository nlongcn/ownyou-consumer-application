/**
 * Save Observation Tool - v13 Section 8.8.1
 *
 * Saves a fact or preference learned about the user.
 * Automatically checks for similar existing memories and consolidates if found.
 */

import type { Memory } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { computeLocalEmbedding } from '../embedding/local-embedder';
import { findSimilarMemories } from '../retrieval/hybrid-retrieval';
import { consolidateMemory } from '../lifecycle/consolidation';
import type {
  SaveObservationParams,
  SaveObservationContext,
  SaveObservationResult,
} from '../types';

/**
 * Save a new observation/memory
 *
 * If similar memory exists (>85% similarity), consolidates instead of creating new.
 */
export async function saveObservation(
  params: SaveObservationParams,
  context: SaveObservationContext
): Promise<SaveObservationResult> {
  const { content, context: domain, confidence, validAt, privacyTier } = params;
  const { userId, episodeId, store } = context;

  // 1. Compute embedding for similarity check
  let embedding: number[];
  try {
    embedding = await computeLocalEmbedding(content);
  } catch (error) {
    // If embedding fails, create memory without it (will be embedded later)
    console.warn('Embedding computation failed, creating memory without embedding:', error);
    embedding = [];
  }

  // 2. Check for similar existing memories (threshold: 0.85)
  if (embedding.length > 0) {
    try {
      const similar = await findSimilarMemories({
        query: content,
        queryEmbedding: embedding,
        userId,
        store,
        threshold: 0.85,
        limit: 3,
      });

      // 3. Consolidate if similar memory exists
      if (similar.length > 0) {
        const consolidated = await consolidateMemory({
          existing: similar[0].memory,
          newContent: content,
          newConfidence: confidence,
          userId,
          store,
        });
        return { memoryId: consolidated.id, action: 'consolidated' };
      }
    } catch (error) {
      console.warn('Similarity search failed, creating new memory:', error);
    }
  }

  // 4. Create new memory
  const memory: Memory = {
    id: crypto.randomUUID(),
    content,
    context: domain,

    // Bi-temporal
    validAt: validAt ?? Date.now(),
    createdAt: Date.now(),

    // Strength & decay
    strength: 1.0,
    lastAccessed: Date.now(),
    accessCount: 1,

    // Provenance
    sources: episodeId ? [episodeId] : [],
    confidence,

    // Privacy
    privacyTier: privacyTier ?? 'public',

    // Embedding (if computed)
    ...(embedding.length > 0 ? { embedding } : {}),
  };

  await store.put(NS.semanticMemory(userId), memory.id, memory);

  return { memoryId: memory.id, action: 'created' };
}

/**
 * Batch save multiple observations
 */
export async function saveObservations(
  observations: Array<{ params: SaveObservationParams; episodeId?: string }>,
  context: Omit<SaveObservationContext, 'episodeId'>
): Promise<SaveObservationResult[]> {
  const results: SaveObservationResult[] = [];

  for (const obs of observations) {
    const result = await saveObservation(obs.params, {
      ...context,
      episodeId: obs.episodeId,
    });
    results.push(result);
  }

  return results;
}
