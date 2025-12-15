/**
 * OnnxEmbeddingService - Local WASM-based embeddings using ONNX Runtime
 *
 * Sprint 11b implementation for v13 Section 6.6 (Local/Browser-Based Inference)
 * and Section 8.5.3 (Platform-Specific Embedding).
 *
 * Uses all-MiniLM-L6-v2 model for 384-dimensional embeddings via @xenova/transformers.
 * Runs entirely in browser/worker via WebAssembly.
 *
 * Reference: https://blog.mozilla.ai/3w-for-in-browser-ai-webllm-wasm-webworkers/
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 6.6
 */

import type { EmbeddingService } from './embeddings';

/**
 * Configuration for OnnxEmbeddingService
 * Follows I2 pattern: Extract magic numbers to typed config objects
 */
export interface OnnxEmbeddingConfig {
  /** Model identifier for sentence-transformers model (default: 'Xenova/all-MiniLM-L6-v2') */
  modelId?: string;

  /** Number of dimensions in output embeddings (default: 384 for MiniLM) */
  dimensions?: number;

  /** Fallback embedding service if ONNX fails to load */
  fallback?: EmbeddingService;

  /** Whether to log progress during model download */
  logProgress?: boolean;

  /** Cache directory for models (browser: uses IndexedDB cache automatically) */
  cacheDir?: string;
}

/**
 * Default configuration for OnnxEmbeddingService
 */
export const DEFAULT_ONNX_EMBEDDING_CONFIG: Required<Omit<OnnxEmbeddingConfig, 'fallback' | 'cacheDir'>> = {
  modelId: 'Xenova/all-MiniLM-L6-v2',
  dimensions: 384,
  logProgress: false,
};

/**
 * OnnxEmbeddingService - Real semantic embeddings using ONNX Runtime
 *
 * Replaces MockEmbeddingService with actual sentence-transformer embeddings.
 * Lazy-loads the model on first use to avoid blocking initial render.
 *
 * Features:
 * - 384-dimensional embeddings via all-MiniLM-L6-v2
 * - WASM-based inference (no server required)
 * - Automatic caching of downloaded models
 * - Graceful fallback if ONNX fails
 */
export class OnnxEmbeddingService implements EmbeddingService {
  private config: Required<Omit<OnnxEmbeddingConfig, 'fallback' | 'cacheDir'>> & Pick<OnnxEmbeddingConfig, 'fallback' | 'cacheDir'>;
  private pipeline: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private initError: Error | null = null;

  constructor(config: OnnxEmbeddingConfig = {}) {
    this.config = {
      ...DEFAULT_ONNX_EMBEDDING_CONFIG,
      ...config,
    };
  }

  /**
   * Initialize the embedding pipeline
   * Called lazily on first embed() call
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initError) throw this.initError;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Dynamic import to avoid bundling issues
      // @ts-expect-error - transformers.js types may not be available
      const { pipeline, env } = await import('@xenova/transformers');

      // Configure for browser/worker environment
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Disable multi-threading if not in SharedArrayBuffer environment
      // This avoids issues in non-crossOriginIsolated contexts
      if (typeof SharedArrayBuffer === 'undefined') {
        env.backends.onnx.wasm.numThreads = 1;
      }

      // Create feature-extraction pipeline for embeddings
      const progressCallback = this.config.logProgress
        ? (progress: { status: string; progress?: number }) => {
            console.log(`[OnnxEmbedding] ${progress.status}${progress.progress ? ` ${Math.round(progress.progress * 100)}%` : ''}`);
          }
        : undefined;

      this.pipeline = await pipeline('feature-extraction', this.config.modelId, {
        progress_callback: progressCallback,
        cache_dir: this.config.cacheDir,
      });

      this.isInitialized = true;
      console.log(`[OnnxEmbedding] Model ${this.config.modelId} loaded successfully`);
    } catch (error) {
      this.initError = error instanceof Error ? error : new Error(String(error));
      console.error('[OnnxEmbedding] Failed to initialize:', this.initError.message);

      // If we have a fallback, don't throw - we'll use fallback instead
      if (!this.config.fallback) {
        throw this.initError;
      }
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    try {
      await this.initialize();

      // Use fallback if ONNX failed to initialize
      if (this.initError && this.config.fallback) {
        return this.config.fallback.embed(text);
      }

      if (!this.pipeline) {
        throw new Error('Embedding pipeline not initialized');
      }

      // Run the model
      const output = await this.pipeline(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Extract embedding from output tensor
      const embedding = Array.from(output.data as Float32Array);

      // Truncate or pad to expected dimensions
      return this.ensureDimensions(embedding);
    } catch (error) {
      // Fallback on runtime errors
      if (this.config.fallback) {
        console.warn('[OnnxEmbedding] Runtime error, using fallback:', error);
        return this.config.fallback.embed(text);
      }
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      await this.initialize();

      // Use fallback if ONNX failed to initialize
      if (this.initError && this.config.fallback) {
        return this.config.fallback.embedBatch(texts);
      }

      if (!this.pipeline) {
        throw new Error('Embedding pipeline not initialized');
      }

      // Process texts - transformers.js handles batching internally
      const results: number[][] = [];
      for (const text of texts) {
        const output = await this.pipeline(text, {
          pooling: 'mean',
          normalize: true,
        });
        const embedding = Array.from(output.data as Float32Array);
        results.push(this.ensureDimensions(embedding));
      }

      return results;
    } catch (error) {
      // Fallback on runtime errors
      if (this.config.fallback) {
        console.warn('[OnnxEmbedding] Batch runtime error, using fallback:', error);
        return this.config.fallback.embedBatch(texts);
      }
      throw error;
    }
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Check if the service is ready (model loaded)
   */
  isReady(): boolean {
    return this.isInitialized && this.pipeline !== null;
  }

  /**
   * Check if using fallback due to ONNX initialization failure
   */
  isUsingFallback(): boolean {
    return this.initError !== null && this.config.fallback !== undefined;
  }

  /**
   * Ensure embedding has correct dimensions (truncate or pad)
   */
  private ensureDimensions(embedding: number[]): number[] {
    const targetDim = this.config.dimensions;

    if (embedding.length === targetDim) {
      return embedding;
    }

    if (embedding.length > targetDim) {
      // Truncate
      return embedding.slice(0, targetDim);
    }

    // Pad with zeros
    const padded = [...embedding];
    while (padded.length < targetDim) {
      padded.push(0);
    }
    return padded;
  }
}

/**
 * Create an OnnxEmbeddingService with a MockEmbeddingService fallback
 * Use this for graceful degradation in environments where ONNX may fail
 */
export async function createEmbeddingServiceWithFallback(
  config: Omit<OnnxEmbeddingConfig, 'fallback'> = {}
): Promise<EmbeddingService> {
  // Import MockEmbeddingService dynamically to avoid circular dependencies
  const { MockEmbeddingService } = await import('./embeddings');
  const fallback = new MockEmbeddingService(config.dimensions ?? 384);

  return new OnnxEmbeddingService({
    ...config,
    fallback,
  });
}
