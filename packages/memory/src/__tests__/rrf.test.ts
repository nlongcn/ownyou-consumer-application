/**
 * Reciprocal Rank Fusion Tests - v13 Section 8.7.2
 */

import { describe, it, expect } from 'vitest';
import type { Memory } from '@ownyou/shared-types';
import {
  reciprocalRankFusion,
  normalizeRRFScores,
  maxRRFScore,
  DEFAULT_RRF_K,
} from '../retrieval/rrf';
import type { SearchResult } from '../types';

// Helper to create test memories
function createMemory(id: string, content: string): Memory {
  return {
    id,
    content,
    context: 'test',
    validAt: Date.now(),
    createdAt: Date.now(),
    strength: 1.0,
    lastAccessed: Date.now(),
    accessCount: 1,
    sources: [],
    confidence: 0.9,
    privacyTier: 'public',
  };
}

// Helper to create search results
function createSearchResult(
  memory: Memory,
  score: number,
  rank: number,
  source: 'semantic' | 'keyword' | 'entity'
): SearchResult {
  return { memory, score, rank, source };
}

describe('Reciprocal Rank Fusion', () => {
  describe('reciprocalRankFusion', () => {
    it('should combine results from single list', () => {
      const mem1 = createMemory('1', 'First');
      const mem2 = createMemory('2', 'Second');
      const mem3 = createMemory('3', 'Third');

      const semanticResults: SearchResult[] = [
        createSearchResult(mem1, 0.9, 1, 'semantic'),
        createSearchResult(mem2, 0.7, 2, 'semantic'),
        createSearchResult(mem3, 0.5, 3, 'semantic'),
      ];

      const fused = reciprocalRankFusion([semanticResults]);

      expect(fused.length).toBe(3);
      expect(fused[0].memory.id).toBe('1'); // Highest RRF score
      expect(fused[0].sources).toContain('semantic');
      expect(fused[0].appearances).toBe(1);
    });

    it('should boost documents appearing in multiple lists', () => {
      const mem1 = createMemory('1', 'In both');
      const mem2 = createMemory('2', 'Only semantic');
      const mem3 = createMemory('3', 'Only keyword');

      const semanticResults: SearchResult[] = [
        createSearchResult(mem1, 0.9, 1, 'semantic'),
        createSearchResult(mem2, 0.7, 2, 'semantic'),
      ];

      const keywordResults: SearchResult[] = [
        createSearchResult(mem1, 0.8, 1, 'keyword'),
        createSearchResult(mem3, 0.6, 2, 'keyword'),
      ];

      const fused = reciprocalRankFusion([semanticResults, keywordResults]);

      // mem1 should be first (appears in both)
      expect(fused[0].memory.id).toBe('1');
      expect(fused[0].appearances).toBe(2);
      expect(fused[0].sources).toContain('semantic');
      expect(fused[0].sources).toContain('keyword');

      // mem1's score should be higher than others
      const mem1Score = fused.find((r) => r.memory.id === '1')!.rrfScore;
      const mem2Score = fused.find((r) => r.memory.id === '2')!.rrfScore;
      const mem3Score = fused.find((r) => r.memory.id === '3')!.rrfScore;

      expect(mem1Score).toBeGreaterThan(mem2Score);
      expect(mem1Score).toBeGreaterThan(mem3Score);
    });

    it('should use k constant for dampening', () => {
      const mem1 = createMemory('1', 'First');

      const results: SearchResult[] = [createSearchResult(mem1, 0.9, 1, 'semantic')];

      // Default k = 60
      const fused60 = reciprocalRankFusion([results], 60);
      // RRF score = 1 / (60 + 0 + 1) = 1/61
      expect(fused60[0].rrfScore).toBeCloseTo(1 / 61, 5);

      // Custom k = 10
      const fused10 = reciprocalRankFusion([results], 10);
      // RRF score = 1 / (10 + 0 + 1) = 1/11
      expect(fused10[0].rrfScore).toBeCloseTo(1 / 11, 5);
    });

    it('should handle empty result lists', () => {
      const fused = reciprocalRankFusion([[], []]);
      expect(fused).toEqual([]);
    });

    it('should handle single result', () => {
      const mem1 = createMemory('1', 'Only one');
      const results: SearchResult[] = [createSearchResult(mem1, 0.9, 1, 'entity')];

      const fused = reciprocalRankFusion([results]);

      expect(fused.length).toBe(1);
      expect(fused[0].memory.id).toBe('1');
    });

    it('should sort by RRF score descending', () => {
      const mem1 = createMemory('1', 'One');
      const mem2 = createMemory('2', 'Two');
      const mem3 = createMemory('3', 'Three');

      // mem3 at rank 1 in semantic, mem2 at rank 1 in keyword
      // mem1 at rank 2 in both
      const semanticResults: SearchResult[] = [
        createSearchResult(mem3, 0.9, 1, 'semantic'),
        createSearchResult(mem1, 0.7, 2, 'semantic'),
      ];

      const keywordResults: SearchResult[] = [
        createSearchResult(mem2, 0.8, 1, 'keyword'),
        createSearchResult(mem1, 0.6, 2, 'keyword'),
      ];

      const fused = reciprocalRankFusion([semanticResults, keywordResults]);

      // mem1 appears in both at rank 2: 2 * (1/(k+2)) = higher than mem2/mem3's single 1/(k+1)
      expect(fused[0].memory.id).toBe('1');

      // Verify descending order
      for (let i = 1; i < fused.length; i++) {
        expect(fused[i - 1].rrfScore).toBeGreaterThanOrEqual(fused[i].rrfScore);
      }
    });

    it('should handle three result lists', () => {
      const mem1 = createMemory('1', 'In all three');
      const mem2 = createMemory('2', 'In two');
      const mem3 = createMemory('3', 'In one');

      const semantic: SearchResult[] = [
        createSearchResult(mem1, 0.9, 1, 'semantic'),
        createSearchResult(mem2, 0.7, 2, 'semantic'),
      ];

      const keyword: SearchResult[] = [
        createSearchResult(mem1, 0.8, 1, 'keyword'),
        createSearchResult(mem2, 0.6, 2, 'keyword'),
      ];

      const entity: SearchResult[] = [
        createSearchResult(mem1, 0.7, 1, 'entity'),
        createSearchResult(mem3, 0.5, 2, 'entity'),
      ];

      const fused = reciprocalRankFusion([semantic, keyword, entity]);

      expect(fused[0].memory.id).toBe('1');
      expect(fused[0].appearances).toBe(3);
      expect(fused[0].sources.length).toBe(3);

      const mem2Result = fused.find((r) => r.memory.id === '2')!;
      expect(mem2Result.appearances).toBe(2);
    });
  });

  describe('maxRRFScore', () => {
    it('should calculate max score correctly', () => {
      // With 1 list, max = 1/(k+1)
      expect(maxRRFScore(1, 60)).toBeCloseTo(1 / 61, 5);

      // With 2 lists, max = 2/(k+1)
      expect(maxRRFScore(2, 60)).toBeCloseTo(2 / 61, 5);

      // With 3 lists, max = 3/(k+1)
      expect(maxRRFScore(3, 60)).toBeCloseTo(3 / 61, 5);
    });
  });

  describe('normalizeRRFScores', () => {
    it('should normalize scores to 0-1 range', () => {
      const mem1 = createMemory('1', 'Perfect');
      const mem2 = createMemory('2', 'Half');

      // Simulate results
      const results = [
        { memory: mem1, rrfScore: 2 / 61, appearances: 2, sources: ['semantic', 'keyword'] },
        { memory: mem2, rrfScore: 1 / 61, appearances: 1, sources: ['semantic'] },
      ];

      const normalized = normalizeRRFScores(results, 2, 60);

      // mem1 at rank 1 in both lists = max score = 1.0
      expect(normalized[0].rrfScore).toBeCloseTo(1.0, 5);
      // mem2 at rank 1 in one list = half of max = 0.5
      expect(normalized[1].rrfScore).toBeCloseTo(0.5, 5);
    });
  });

  describe('RRF properties', () => {
    it('should be robust to score differences', () => {
      // RRF doesn't care about raw scores, only ranks
      const mem1 = createMemory('1', 'High scores');
      const mem2 = createMemory('2', 'Low scores');

      // mem1 has much higher raw scores
      const list1: SearchResult[] = [
        createSearchResult(mem1, 0.99, 1, 'semantic'),
        createSearchResult(mem2, 0.01, 2, 'semantic'),
      ];

      // mem2 has much higher raw scores (reversed)
      const list2: SearchResult[] = [
        createSearchResult(mem2, 0.99, 1, 'keyword'),
        createSearchResult(mem1, 0.01, 2, 'keyword'),
      ];

      const fused = reciprocalRankFusion([list1, list2]);

      // Both should have same RRF score (each is rank 1 in one list, rank 2 in other)
      expect(fused[0].rrfScore).toBeCloseTo(fused[1].rrfScore, 5);
    });

    it('should prefer consensus', () => {
      const mem1 = createMemory('1', 'Consensus');
      const mem2 = createMemory('2', 'Top in one');

      // mem1 is rank 2 in both lists
      // mem2 is rank 1 in one list only
      const list1: SearchResult[] = [
        createSearchResult(mem2, 0.9, 1, 'semantic'),
        createSearchResult(mem1, 0.7, 2, 'semantic'),
      ];

      const list2: SearchResult[] = [createSearchResult(mem1, 0.8, 1, 'keyword')];

      const fused = reciprocalRankFusion([list1, list2]);

      // mem1 appears in both (rank 2 + rank 1), mem2 only in one (rank 1)
      // mem1: 1/(k+2) + 1/(k+1) = higher
      // mem2: 1/(k+1)
      const mem1Result = fused.find((r) => r.memory.id === '1')!;
      const mem2Result = fused.find((r) => r.memory.id === '2')!;

      expect(mem1Result.rrfScore).toBeGreaterThan(mem2Result.rrfScore);
    });
  });
});
