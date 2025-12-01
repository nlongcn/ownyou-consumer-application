/**
 * Reciprocal Rank Fusion - v13 Section 8.7
 *
 * Combines results from multiple ranking systems (semantic + BM25)
 * using the RRF algorithm for robust hybrid search.
 *
 * @see docs/architecture/extracts/memory-types-8.4.md
 */

import type { Memory } from '@ownyou/shared-types';
import type { SearchResult } from './semantic';

/**
 * Fused result with detailed scores
 */
export interface FusedResult<T> {
  item: T;
  scores: {
    /** Combined RRF score */
    rrf: number;
    /** Final score (may include boost factors) */
    final: number;
  };
}

/**
 * RRFusion - Reciprocal Rank Fusion for combining search results
 */
export class RRFusion {
  /**
   * Fuse multiple ranked lists using RRF
   * @param resultLists Array of ranked result lists
   * @param limit Maximum results to return
   * @param k RRF constant (default: 60)
   * @returns Fused results with combined scores
   */
  fuse(
    resultLists: SearchResult<Memory>[][],
    limit: number,
    k: number = 60
  ): FusedResult<Memory>[] {
    if (resultLists.length === 0) {
      return [];
    }

    // Map from item ID to accumulated RRF score
    const scoreMap = new Map<string, { item: Memory; rrfScore: number }>();

    for (const results of resultLists) {
      for (let rank = 0; rank < results.length; rank++) {
        const result = results[rank];
        const itemId = result.item.id;

        // RRF formula: 1 / (k + rank)
        const rrfContribution = 1 / (k + rank + 1); // +1 because rank is 0-indexed

        const existing = scoreMap.get(itemId);
        if (existing) {
          existing.rrfScore += rrfContribution;
        } else {
          scoreMap.set(itemId, {
            item: result.item,
            rrfScore: rrfContribution,
          });
        }
      }
    }

    // Convert to array and sort by RRF score
    const fused: FusedResult<Memory>[] = [];
    for (const { item, rrfScore } of scoreMap.values()) {
      fused.push({
        item,
        scores: {
          rrf: rrfScore,
          final: rrfScore, // Can be enhanced with boost factors
        },
      });
    }

    fused.sort((a, b) => b.scores.rrf - a.scores.rrf);

    return fused.slice(0, limit);
  }
}
