/**
 * Embedding Service - v13 Section 8.7
 *
 * Abstract interface for generating text embeddings.
 * Supports pluggable embedding providers (local transformers, OpenAI, etc.)
 *
 * @see docs/architecture/extracts/memory-types-8.4.md
 */

/**
 * EmbeddingService - Abstract interface for embedding generation
 */
export interface EmbeddingService {
  /**
   * Generate embedding for text
   * @param text Input text
   * @returns Normalized embedding vector
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch)
   * @param texts Array of input texts
   * @returns Array of normalized embedding vectors
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get embedding dimensions
   */
  getDimensions(): number;
}

/**
 * MockEmbeddingService - Deterministic embeddings for testing
 *
 * Generates consistent embeddings based on content hash.
 * Not suitable for production - use a real embedding model.
 */
export class MockEmbeddingService implements EmbeddingService {
  private dimensions: number;

  constructor(dimensions: number = 768) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    return this.generateMockEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateMockEmbedding(text));
  }

  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Generate a deterministic embedding based on content hash
   */
  private generateMockEmbedding(text: string): number[] {
    const hash = this.simpleHash(text);
    const embedding: number[] = [];

    for (let i = 0; i < this.dimensions; i++) {
      // Generate deterministic values based on hash and index
      embedding.push(Math.sin(hash + i) * 0.5 + 0.5);
    }

    // Normalize to unit length
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  }

  /**
   * Simple hash function for deterministic embedding generation
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}
