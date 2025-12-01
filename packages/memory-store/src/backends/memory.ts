/**
 * In-Memory Backend - For Testing
 *
 * Simple in-memory storage backend for unit tests.
 * Not suitable for production use.
 */

import type { StorageBackend, StoreStats } from './types';

/**
 * InMemoryBackend - Simple Map-based storage
 */
export class InMemoryBackend implements StorageBackend {
  private data: Map<string, unknown> = new Map();

  /**
   * Create composite key from namespace, userId, and key
   */
  private makeKey(namespace: string, userId: string, key: string): string {
    return `${namespace}::${userId}::${key}`;
  }

  /**
   * Parse composite key back to components
   */
  private parseKey(compositeKey: string): { namespace: string; userId: string; key: string } {
    const [namespace, userId, key] = compositeKey.split('::');
    return { namespace, userId, key };
  }

  async put<T>(namespace: string, userId: string, key: string, value: T): Promise<void> {
    const compositeKey = this.makeKey(namespace, userId, key);
    this.data.set(compositeKey, value);
  }

  async get<T>(namespace: string, userId: string, key: string): Promise<T | null> {
    const compositeKey = this.makeKey(namespace, userId, key);
    const value = this.data.get(compositeKey);
    return value !== undefined ? (value as T) : null;
  }

  async delete(namespace: string, userId: string, key: string): Promise<boolean> {
    const compositeKey = this.makeKey(namespace, userId, key);
    return this.data.delete(compositeKey);
  }

  async list<T>(namespace: string, userId: string, limit: number, offset: number): Promise<T[]> {
    const prefix = `${namespace}::${userId}::`;
    const items: T[] = [];

    for (const [compositeKey, value] of this.data.entries()) {
      if (compositeKey.startsWith(prefix)) {
        items.push(value as T);
      }
    }

    return items.slice(offset, offset + limit);
  }

  async exists(namespace: string, userId: string, key: string): Promise<boolean> {
    const compositeKey = this.makeKey(namespace, userId, key);
    return this.data.has(compositeKey);
  }

  async getStats(namespace: string, userId: string): Promise<StoreStats> {
    const prefix = `${namespace}::${userId}::`;
    let count = 0;

    for (const compositeKey of this.data.keys()) {
      if (compositeKey.startsWith(prefix)) {
        count++;
      }
    }

    return {
      namespace,
      count,
    };
  }

  async clear(namespace?: string, userId?: string): Promise<void> {
    if (!namespace && !userId) {
      this.data.clear();
      return;
    }

    const keysToDelete: string[] = [];

    for (const compositeKey of this.data.keys()) {
      const parsed = this.parseKey(compositeKey);

      if (namespace && userId) {
        if (parsed.namespace === namespace && parsed.userId === userId) {
          keysToDelete.push(compositeKey);
        }
      } else if (namespace) {
        if (parsed.namespace === namespace) {
          keysToDelete.push(compositeKey);
        }
      } else if (userId) {
        if (parsed.userId === userId) {
          keysToDelete.push(compositeKey);
        }
      }
    }

    for (const key of keysToDelete) {
      this.data.delete(key);
    }
  }

  async close(): Promise<void> {
    // No-op for in-memory backend
  }
}
