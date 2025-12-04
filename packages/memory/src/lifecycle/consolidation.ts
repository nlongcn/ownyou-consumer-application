/**
 * Memory Consolidation - v13 Section 8.9.1
 *
 * Merges similar memories to reduce redundancy and strengthen knowledge.
 */

import type { Memory } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { computeLocalEmbedding } from '../embedding/local-embedder';
import type { ConsolidationParams } from '../types';

/**
 * Consolidate a new memory with an existing similar one
 *
 * Strategy:
 * - Combine content (take newer or merge if complementary)
 * - Increase strength
 * - Update confidence based on agreement
 * - Add new source
 */
export async function consolidateMemory(
  params: ConsolidationParams
): Promise<Memory> {
  const { existing, newContent, newConfidence, userId, store } = params;

  // Decide how to merge content
  const mergedContent = mergeContent(existing.content, newContent);

  // Calculate new strength (boost for confirmation)
  const newStrength = Math.min(existing.strength + 0.2, 5.0);

  // Calculate new confidence (average with boost for agreement)
  const confidenceBoost = 0.05;
  const newConfidenceValue = Math.min(
    (existing.confidence + newConfidence) / 2 + confidenceBoost,
    1.0
  );

  // Compute new embedding if content changed
  let embedding = existing.embedding;
  if (mergedContent !== existing.content) {
    try {
      embedding = await computeLocalEmbedding(mergedContent);
    } catch (error) {
      // Keep existing embedding if new one fails
      console.warn('Failed to compute new embedding during consolidation:', error);
    }
  }

  // Create consolidated memory
  const consolidated: Memory = {
    ...existing,
    content: mergedContent,
    strength: newStrength,
    confidence: newConfidenceValue,
    lastAccessed: Date.now(),
    accessCount: existing.accessCount + 1,
    embedding,
  };

  // Update in store
  await store.put(NS.semanticMemory(userId), existing.id, consolidated);

  return consolidated;
}

/**
 * Merge two pieces of content intelligently
 */
function mergeContent(existing: string, newContent: string): string {
  // If contents are very similar (>90% overlap), keep the newer one
  const overlapRatio = calculateOverlap(existing, newContent);

  if (overlapRatio > 0.9) {
    // Very similar - prefer the newer, potentially more accurate content
    return newContent;
  }

  if (overlapRatio > 0.5) {
    // Somewhat similar - combine with separator if they add value
    // Check if new content adds information
    const existingWords = new Set(existing.toLowerCase().split(/\s+/));
    const newWords = newContent.toLowerCase().split(/\s+/);
    const newInfo = newWords.filter((w) => !existingWords.has(w) && w.length > 2);

    if (newInfo.length > 3) {
      // Significant new information - combine
      return `${existing}. Additionally: ${newContent}`;
    }

    // Not much new - keep existing
    return existing;
  }

  // Very different - they might be about different aspects
  // Keep the existing memory, new content should create separate memory
  return existing;
}

/**
 * Calculate word overlap ratio between two texts
 */
function calculateOverlap(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      overlap++;
    }
  }

  const maxSize = Math.max(words1.size, words2.size);
  return overlap / maxSize;
}

/**
 * Find consolidation candidates - memories that could be merged
 */
export async function findConsolidationCandidates(
  memories: Memory[],
  similarityThreshold: number = 0.85
): Promise<Array<{ a: Memory; b: Memory; similarity: number }>> {
  const candidates: Array<{ a: Memory; b: Memory; similarity: number }> = [];

  // Compare all pairs (expensive for large sets)
  for (let i = 0; i < memories.length; i++) {
    const a = memories[i];
    if (!a.embedding) continue;

    for (let j = i + 1; j < memories.length; j++) {
      const b = memories[j];
      if (!b.embedding) continue;

      // Calculate similarity
      const similarity = cosineSim(a.embedding, b.embedding);

      if (similarity >= similarityThreshold) {
        candidates.push({ a, b, similarity });
      }
    }
  }

  // Sort by similarity descending
  return candidates.sort((x, y) => y.similarity - x.similarity);
}

/**
 * Calculate cosine similarity
 */
function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
