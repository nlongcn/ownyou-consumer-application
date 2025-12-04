/**
 * Embedding Queue - v13 Section 8.5.1
 *
 * Handles background embedding computation when device is busy.
 * Processes queued memories during Reflection cycles.
 */

import type { MemoryStore } from '@ownyou/memory-store';
import type { Memory } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { computeBatchEmbeddings } from './local-embedder';
import type { EmbeddingQueueConfig, EmbeddingQueueItem, EmbeddingQueueStatus } from '../types';

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: EmbeddingQueueConfig = {
  maxQueueSize: 1000,
  processInterval: 5000, // Process every 5 seconds
  batchSize: 32,
};

/**
 * Embedding Queue - background embedding computation
 */
export class EmbeddingQueue {
  private queue: EmbeddingQueueItem[] = [];
  private processing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private config: EmbeddingQueueConfig;
  private store: MemoryStore;

  constructor(store: MemoryStore, config: Partial<EmbeddingQueueConfig> = {}) {
    this.store = store;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  /**
   * Add memory to embedding queue
   */
  enqueue(memoryId: string, userId: string, content: string): void {
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('Embedding queue at capacity, dropping oldest items');
      this.queue.shift();
    }

    this.queue.push({
      memoryId,
      userId,
      content,
      addedAt: Date.now(),
    });
  }

  /**
   * Start background processing
   */
  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.processQueue();
    }, this.config.processInterval);
  }

  /**
   * Stop background processing
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Process queued items
   */
  async processQueue(): Promise<number> {
    if (this.processing || this.queue.length === 0) return 0;

    this.processing = true;
    let processed = 0;

    try {
      // Take a batch
      const batch = this.queue.splice(0, this.config.batchSize);

      // Compute embeddings
      const embeddings = await computeBatchEmbeddings(batch.map((item) => item.content));

      // Update memories with embeddings
      await Promise.all(
        batch.map(async (item, i) => {
          try {
            const memory = await this.store.get<Memory>(NS.semanticMemory(item.userId), item.memoryId);

            if (memory) {
              await this.store.put(NS.semanticMemory(item.userId), item.memoryId, {
                ...memory,
                embedding: embeddings[i],
              });
              processed++;
            }
          } catch (error) {
            console.error(`Failed to update embedding for ${item.memoryId}:`, error);
            // Re-queue failed items
            this.queue.push(item);
          }
        })
      );
    } finally {
      this.processing = false;
    }

    return processed;
  }

  /**
   * Process all queued items immediately
   */
  async flush(): Promise<number> {
    let totalProcessed = 0;

    while (this.queue.length > 0) {
      const processed = await this.processQueue();
      totalProcessed += processed;

      // Break if we're stuck (e.g., all items failing)
      if (processed === 0 && this.queue.length > 0) {
        break;
      }
    }

    return totalProcessed;
  }

  /**
   * Get queue status
   */
  getStatus(): EmbeddingQueueStatus {
    return {
      size: this.queue.length,
      maxSize: this.config.maxQueueSize,
      processing: this.processing,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Check if queue has items
   */
  hasItems(): boolean {
    return this.queue.length > 0;
  }
}
