/**
 * BM25 Search - v13 Section 8.7
 *
 * Keyword-based search using the BM25 ranking algorithm.
 * Provides term frequency / inverse document frequency scoring.
 *
 * @see docs/architecture/extracts/memory-types-8.4.md
 */

import type { Memory } from '@ownyou/shared-types';
import type { SearchResult } from './semantic';

/**
 * BM25 configuration parameters
 */
interface BM25Config {
  /** Term frequency saturation parameter (default: 1.2) */
  k1: number;
  /** Document length normalization (default: 0.75) */
  b: number;
}

/**
 * BM25Search - Keyword-based ranking
 */
export class BM25Search {
  private config: BM25Config;

  constructor(config?: Partial<BM25Config>) {
    this.config = {
      k1: config?.k1 ?? 1.2,
      b: config?.b ?? 0.75,
    };
  }

  /**
   * Search memories by keyword relevance
   * @param memories Array of memories to search
   * @param query Search query string
   * @param limit Maximum results to return
   * @returns Ranked results with BM25 scores
   */
  search(memories: Memory[], query: string, limit: number): SearchResult<Memory>[] {
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) {
      return [];
    }

    // Compute document frequencies
    const docFreq = this.computeDocumentFrequencies(memories, queryTerms);

    // Compute average document length
    const avgDocLen = this.computeAverageDocLength(memories);

    // Score each document
    const results: SearchResult<Memory>[] = [];

    for (const memory of memories) {
      const score = this.scoreBM25(memory, queryTerms, docFreq, avgDocLen, memories.length);
      if (score > 0) {
        results.push({ item: memory, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Tokenize text into lowercase terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length > 0);
  }

  /**
   * Compute document frequency for each query term
   */
  private computeDocumentFrequencies(
    memories: Memory[],
    queryTerms: string[]
  ): Map<string, number> {
    const docFreq = new Map<string, number>();

    for (const term of queryTerms) {
      let count = 0;
      for (const memory of memories) {
        const tokens = this.tokenize(memory.content);
        if (tokens.includes(term)) {
          count++;
        }
      }
      docFreq.set(term, count);
    }

    return docFreq;
  }

  /**
   * Compute average document length
   */
  private computeAverageDocLength(memories: Memory[]): number {
    if (memories.length === 0) return 0;

    let totalLength = 0;
    for (const memory of memories) {
      totalLength += this.tokenize(memory.content).length;
    }

    return totalLength / memories.length;
  }

  /**
   * Score a document using BM25
   */
  private scoreBM25(
    memory: Memory,
    queryTerms: string[],
    docFreq: Map<string, number>,
    avgDocLen: number,
    totalDocs: number
  ): number {
    const docTokens = this.tokenize(memory.content);
    const docLen = docTokens.length;

    // Count term frequencies in this document
    const termFreq = new Map<string, number>();
    for (const token of docTokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }

    let score = 0;
    const { k1, b } = this.config;

    for (const term of queryTerms) {
      const tf = termFreq.get(term) ?? 0;
      if (tf === 0) continue;

      const df = docFreq.get(term) ?? 0;
      if (df === 0) continue;

      // IDF component: log((N - df + 0.5) / (df + 0.5) + 1)
      const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);

      // TF component with length normalization
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * docLen) / avgDocLen));

      score += idf * tfNorm;
    }

    return score;
  }
}
