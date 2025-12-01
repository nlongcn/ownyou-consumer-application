/**
 * Semantic Search - v13 Section 8.7
 *
 * Vector similarity search using cosine similarity.
 * Works with any embedding model that produces normalized vectors.
 *
 * @see docs/architecture/extracts/memory-types-8.4.md
 */

import type { Memory } from '@ownyou/shared-types';

/**
 * Search result with score
 */
export interface SearchResult<T> {
  item: T;
  score: number;
}

/**
 * SemanticSearch - Cosine similarity search over embeddings
 */
export class SemanticSearch {
  /**
   * Search memories by embedding similarity
   * @param memories Array of memories to search
   * @param queryEmbedding Query vector (normalized)
   * @param limit Maximum results to return
   * @returns Ranked results with similarity scores
   */
  search(memories: Memory[], queryEmbedding: number[], limit: number): SearchResult<Memory>[] {
    const results: SearchResult<Memory>[] = [];

    for (const memory of memories) {
      // Skip items without embeddings
      if (!memory.embedding || memory.embedding.length === 0) {
        continue;
      }

      const score = this.cosineSimilarity(queryEmbedding, memory.embedding);
      results.push({ item: memory, score });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Compute cosine similarity between two vectors
   * Assumes vectors are normalized (unit length)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }

    return dotProduct;
  }
}
