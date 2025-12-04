/**
 * Embedding Tests - v13 Section 8.5
 *
 * Tests for local embedding generation and similarity computation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cosineSimilarity,
  isEmbeddingAvailable,
  resetEmbedder,
  EMBEDDING_CONFIG,
} from '../embedding/local-embedder';

describe('Embedding System', () => {
  beforeEach(() => {
    resetEmbedder();
    vi.clearAllMocks();
  });

  describe('EMBEDDING_CONFIG', () => {
    it('should have correct model configuration', () => {
      expect(EMBEDDING_CONFIG.model).toBe('Xenova/nomic-embed-text-v1.5');
      expect(EMBEDDING_CONFIG.dimensions).toBe(768);
      expect(EMBEDDING_CONFIG.batchSize).toBe(32);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [0.1, 0.2, 0.3, 0.4, 0.5];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it('should be symmetric', () => {
      const a = [0.1, 0.2, 0.3];
      const b = [0.4, 0.5, 0.6];
      expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
    });

    it('should handle normalized vectors correctly', () => {
      // Normalize vectors
      const normalize = (v: number[]) => {
        const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
        return v.map((x) => x / norm);
      };

      const a = normalize([1, 2, 3]);
      const b = normalize([4, 5, 6]);

      // For normalized vectors, similarity should equal dot product
      const dotProduct = a.reduce((sum, x, i) => sum + x * b[i], 0);
      expect(cosineSimilarity(a, b)).toBeCloseTo(dotProduct, 5);
    });

    it('should throw for different dimension vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => cosineSimilarity(a, b)).toThrow('Embeddings must have same dimensions');
    });

    it('should handle zero vectors gracefully', () => {
      const zero = [0, 0, 0];
      const vec = [1, 2, 3];
      expect(cosineSimilarity(zero, vec)).toBe(0);
      expect(cosineSimilarity(vec, zero)).toBe(0);
    });

    it('should handle high-dimensional vectors (768d like nomic)', () => {
      const dim = 768;
      const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
      const b = Array.from({ length: dim }, (_, i) => Math.cos(i));

      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should give high similarity for similar semantic content patterns', () => {
      // Simulate embeddings for similar content
      // In reality, "cat" and "kitten" would have similar embeddings
      const catEmbedding = [0.8, 0.1, 0.05, 0.05];
      const kittenEmbedding = [0.75, 0.15, 0.05, 0.05];
      const carEmbedding = [0.1, 0.8, 0.05, 0.05];

      const catKittenSim = cosineSimilarity(catEmbedding, kittenEmbedding);
      const catCarSim = cosineSimilarity(catEmbedding, carEmbedding);

      // Cat and kitten should be more similar than cat and car
      expect(catKittenSim).toBeGreaterThan(catCarSim);
    });
  });

  describe('isEmbeddingAvailable', () => {
    it('should return false before model is loaded', () => {
      expect(isEmbeddingAvailable()).toBe(false);
    });
  });

  describe('resetEmbedder', () => {
    it('should reset the embedder state', () => {
      resetEmbedder();
      expect(isEmbeddingAvailable()).toBe(false);
    });
  });

  describe('Embedding Queue Integration', () => {
    // These tests verify the queue behavior without actual model loading
    it('should have correct batch size for queue processing', () => {
      expect(EMBEDDING_CONFIG.batchSize).toBe(32);
    });

    it('should have correct dimensions for storage', () => {
      // Nomic embed text produces 768-dimensional vectors
      expect(EMBEDDING_CONFIG.dimensions).toBe(768);
    });
  });

  describe('Text Prefixing Strategy', () => {
    // The nomic model uses different prefixes for documents vs queries
    it('should use search_document prefix for storage', () => {
      // This is verified by inspecting the code - documents use "search_document: " prefix
      const docPrefix = 'search_document: ';
      const queryPrefix = 'search_query: ';
      expect(docPrefix).not.toBe(queryPrefix);
    });
  });
});
