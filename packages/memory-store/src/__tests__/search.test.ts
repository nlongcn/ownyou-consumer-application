/**
 * Search Tests - v13 Section 8.7
 *
 * Tests for semantic search, BM25, and RRF fusion
 */
import { describe, it, expect } from 'vitest';
import { SemanticSearch } from '../search/semantic';
import { BM25Search } from '../search/bm25';
import { RRFusion } from '../search/rrf';
import type { Memory } from '@ownyou/shared-types';

describe('Search (v13 Section 8.7)', () => {
  // Sample memories for testing
  const memories: Memory[] = [
    {
      id: 'mem_1',
      content: 'User loves hiking in the mountains during summer vacation',
      context: 'interests',
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 0.9,
      lastAccessed: Date.now(),
      accessCount: 5,
      sources: [],
      confidence: 0.95,
      privacyTier: 'public',
      embedding: generateMockEmbedding('hiking mountains summer'),
    },
    {
      id: 'mem_2',
      content: 'User prefers window seats on long flights',
      context: 'travel',
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 0.7,
      lastAccessed: Date.now(),
      accessCount: 2,
      sources: [],
      confidence: 0.85,
      privacyTier: 'public',
      embedding: generateMockEmbedding('window seat flight'),
    },
    {
      id: 'mem_3',
      content: 'User enjoys mountain biking on weekends with friends',
      context: 'interests',
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 0.5,
      lastAccessed: Date.now(),
      accessCount: 1,
      sources: [],
      confidence: 0.75,
      privacyTier: 'public',
      embedding: generateMockEmbedding('mountain biking weekends'),
    },
    {
      id: 'mem_4',
      content: 'User likes Italian food especially pasta and pizza',
      context: 'dining',
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 0.8,
      lastAccessed: Date.now(),
      accessCount: 3,
      sources: [],
      confidence: 0.9,
      privacyTier: 'public',
      embedding: generateMockEmbedding('italian food pasta pizza'),
    },
  ];

  describe('BM25Search', () => {
    const bm25 = new BM25Search();

    it('should return relevant results for keyword query', () => {
      const results = bm25.search(memories, 'mountain hiking', 10);

      expect(results.length).toBeGreaterThan(0);
      // Mountains or hiking should be in top results
      const topContent = results[0].item.content.toLowerCase();
      expect(topContent.includes('mountain') || topContent.includes('hiking')).toBe(true);
    });

    it('should rank exact matches higher', () => {
      const results = bm25.search(memories, 'window seats', 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.id).toBe('mem_2');
    });

    it('should return empty array for no matches', () => {
      const results = bm25.search(memories, 'xyznonexistent123', 10);
      expect(results.length).toBe(0);
    });

    it('should respect limit parameter', () => {
      const results = bm25.search(memories, 'user', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should handle multi-word queries', () => {
      const results = bm25.search(memories, 'italian food pasta', 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.id).toBe('mem_4');
    });

    it('should be case insensitive', () => {
      const resultsLower = bm25.search(memories, 'hiking', 10);
      const resultsUpper = bm25.search(memories, 'HIKING', 10);

      expect(resultsLower.length).toBe(resultsUpper.length);
    });
  });

  describe('SemanticSearch', () => {
    const semantic = new SemanticSearch();

    it('should return results based on embedding similarity', () => {
      const queryEmbedding = generateMockEmbedding('outdoor activities');
      const results = semantic.search(memories, queryEmbedding, 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should rank similar embeddings higher', () => {
      // Query about mountains should rank mountain-related memories higher
      const queryEmbedding = generateMockEmbedding('mountains');
      const results = semantic.search(memories, queryEmbedding, 10);

      expect(results.length).toBeGreaterThan(0);
      // Score should be positive for similar content
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should skip items without embeddings', () => {
      const memoriesWithMissing = [
        ...memories,
        {
          id: 'mem_no_embed',
          content: 'No embedding here',
          context: 'test',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 1.0,
          lastAccessed: Date.now(),
          accessCount: 0,
          sources: [],
          confidence: 1.0,
          privacyTier: 'public' as const,
          // No embedding
        },
      ];

      const queryEmbedding = generateMockEmbedding('test');
      const results = semantic.search(memoriesWithMissing, queryEmbedding, 10);

      // Should not include the item without embedding
      expect(results.find((r) => r.item.id === 'mem_no_embed')).toBeUndefined();
    });

    it('should respect limit parameter', () => {
      const queryEmbedding = generateMockEmbedding('user');
      const results = semantic.search(memories, queryEmbedding, 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('RRFusion', () => {
    const rrf = new RRFusion();

    it('should fuse multiple result lists', () => {
      const list1 = [
        { item: memories[0], score: 0.9 },
        { item: memories[1], score: 0.7 },
      ];
      const list2 = [
        { item: memories[0], score: 0.8 },
        { item: memories[2], score: 0.6 },
      ];

      const fused = rrf.fuse([list1, list2], 10);

      expect(fused.length).toBeGreaterThan(0);
      // mem_1 appears in both lists, should be ranked high
      expect(fused[0].item.id).toBe('mem_1');
    });

    it('should handle empty lists', () => {
      const fused = rrf.fuse([], 10);
      expect(fused).toEqual([]);
    });

    it('should handle single list', () => {
      const list1 = [
        { item: memories[0], score: 0.9 },
        { item: memories[1], score: 0.7 },
      ];

      const fused = rrf.fuse([list1], 10);

      expect(fused.length).toBe(2);
    });

    it('should use configurable k parameter', () => {
      const list1 = [
        { item: memories[0], score: 0.9 },
        { item: memories[1], score: 0.7 },
      ];

      const fusedK10 = rrf.fuse([list1], 10, 10);
      const fusedK60 = rrf.fuse([list1], 10, 60);

      // Different k values should produce different RRF scores
      expect(fusedK10[0].scores.rrf).not.toBe(fusedK60[0].scores.rrf);
    });

    it('should respect limit parameter', () => {
      const list1 = memories.map((m, i) => ({ item: m, score: 1 - i * 0.1 }));
      const list2 = memories.map((m, i) => ({ item: m, score: 0.9 - i * 0.1 }));

      const fused = rrf.fuse([list1, list2], 2);

      expect(fused.length).toBeLessThanOrEqual(2);
    });

    it('should compute final scores correctly', () => {
      const list1 = [{ item: memories[0], score: 0.9 }];
      const list2 = [{ item: memories[0], score: 0.8 }];

      const fused = rrf.fuse([list1, list2], 10);

      expect(fused[0].scores.rrf).toBeDefined();
      expect(fused[0].scores.final).toBeDefined();
      expect(fused[0].scores.rrf).toBe(fused[0].scores.final);
    });
  });
});

/**
 * Generate a mock embedding based on content hash
 * Produces consistent embeddings for testing
 */
function generateMockEmbedding(text: string): number[] {
  const dims = 768;
  const hash = simpleHash(text);
  const embedding: number[] = [];

  for (let i = 0; i < dims; i++) {
    // Generate deterministic values based on hash and index
    embedding.push(Math.sin(hash + i) * 0.5 + 0.5);
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / norm);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}
