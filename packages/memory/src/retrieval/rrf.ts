/**
 * Reciprocal Rank Fusion (RRF) - v13 Section 8.7.2
 *
 * Combines ranked lists from different retrieval methods.
 * Formula: RRF_score(d) = SUM( 1 / (k + rank_i(d)) )
 *
 * Benefits:
 * - No score normalization needed across methods
 * - Rewards documents appearing in multiple lists
 * - Dampens volatility of being #1 vs #2
 */

import type { Memory } from '@ownyou/shared-types';
import type { SearchResult, RRFResult } from '../types';

/**
 * Default RRF k constant (dampening factor)
 * Higher k = more emphasis on overall appearances vs raw rank
 */
export const DEFAULT_RRF_K = 60;

/**
 * Combine ranked lists using Reciprocal Rank Fusion
 *
 * @param resultLists - Arrays of search results from different methods
 * @param k - Dampening constant (default: 60)
 */
export function reciprocalRankFusion(
  resultLists: SearchResult[][],
  k: number = DEFAULT_RRF_K
): RRFResult[] {
  const scores = new Map<
    string,
    { memory: Memory; rrfScore: number; appearances: number; sources: string[] }
  >();

  for (const results of resultLists) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const memoryId = result.memory.id;

      const existing = scores.get(memoryId);
      const rrfContribution = 1 / (k + rank + 1);

      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.appearances += 1;
        if (!existing.sources.includes(result.source)) {
          existing.sources.push(result.source);
        }
      } else {
        scores.set(memoryId, {
          memory: result.memory,
          rrfScore: rrfContribution,
          appearances: 1,
          sources: [result.source],
        });
      }
    }
  }

  // Sort by RRF score descending
  return Array.from(scores.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Get the maximum possible RRF score for a document
 * (appears at rank 1 in all result lists)
 */
export function maxRRFScore(numLists: number, k: number = DEFAULT_RRF_K): number {
  return numLists / (k + 1);
}

/**
 * Normalize RRF scores to 0-1 range
 */
export function normalizeRRFScores(
  results: RRFResult[],
  numLists: number,
  k: number = DEFAULT_RRF_K
): RRFResult[] {
  const maxScore = maxRRFScore(numLists, k);

  return results.map((r) => ({
    ...r,
    rrfScore: r.rrfScore / maxScore,
  }));
}
