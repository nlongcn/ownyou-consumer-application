/**
 * Local Embedder - v13 Section 8.5
 *
 * Uses @xenova/transformers for local embedding generation.
 * Model: nomic-embed-text-v1.5 (768 dimensions)
 *
 * Performance targets:
 * - PWA: ~50ms per embedding
 * - Tauri: ~10ms per embedding
 */

import type { EmbeddingConfig } from '../types';

/**
 * Default embedding configuration
 */
export const EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'Xenova/nomic-embed-text-v1.5',
  dimensions: 768,
  batchSize: 32,
};

// Lazy-loaded pipeline
let embedder: unknown = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Load the embedding model (lazy initialization)
 */
async function loadModel(): Promise<void> {
  if (embedder) return;
  if (isLoading && loadPromise) {
    await loadPromise;
    return;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      // Dynamic import to avoid bundling issues
      const { pipeline, env } = await import('@xenova/transformers');

      // Configure for browser/node environment
      env.allowLocalModels = true;
      env.useBrowserCache = true;

      // Feature extraction pipeline with mean pooling
      embedder = await pipeline('feature-extraction', EMBEDDING_CONFIG.model, {
        quantized: true, // Use quantized model for faster inference
      });
    } finally {
      isLoading = false;
    }
  })();

  await loadPromise;
}

/**
 * Compute embedding for a single text
 *
 * v13 Section 8.5 - Local embeddings for privacy
 */
export async function computeLocalEmbedding(text: string): Promise<number[]> {
  await loadModel();

  if (!embedder) {
    throw new Error('Embedding model failed to load');
  }

  // Add prefix for nomic model (improves retrieval quality)
  const prefixedText = `search_document: ${text}`;

  const output = await (embedder as (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>)(prefixedText, {
    pooling: 'mean',
    normalize: true,
  });

  // Extract the embedding array
  return Array.from(output.data);
}

/**
 * Compute embeddings for multiple texts (batched)
 */
export async function computeBatchEmbeddings(texts: string[]): Promise<number[][]> {
  await loadModel();

  if (!embedder) {
    throw new Error('Embedding model failed to load');
  }

  const prefixedTexts = texts.map((t) => `search_document: ${t}`);
  const results: number[][] = [];

  // Process in batches
  for (let i = 0; i < prefixedTexts.length; i += EMBEDDING_CONFIG.batchSize) {
    const batch = prefixedTexts.slice(i, i + EMBEDDING_CONFIG.batchSize);
    const outputs = await Promise.all(
      batch.map(async (text) => {
        const output = await (embedder as (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>)(text, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(output.data);
      })
    );
    results.push(...outputs);
  }

  return results;
}

/**
 * Compute query embedding (different prefix for retrieval)
 */
export async function computeQueryEmbedding(query: string): Promise<number[]> {
  await loadModel();

  if (!embedder) {
    throw new Error('Embedding model failed to load');
  }

  // Different prefix for queries (per nomic recommendation)
  const prefixedQuery = `search_query: ${query}`;

  const output = await (embedder as (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>)(prefixedQuery, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  // For normalized vectors, cosine similarity = dot product
  // But we compute full formula for safety
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Check if embeddings are available
 */
export function isEmbeddingAvailable(): boolean {
  return embedder !== null;
}

/**
 * Reset the embedder (for testing)
 */
export function resetEmbedder(): void {
  embedder = null;
  isLoading = false;
  loadPromise = null;
}
