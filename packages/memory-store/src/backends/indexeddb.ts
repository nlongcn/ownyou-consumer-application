/**
 * IndexedDB Backend - v13 Section 8.13
 *
 * Browser-based storage backend using IndexedDB via the idb library.
 * Suitable for PWA deployments.
 *
 * @see docs/architecture/extracts/storage-backends-8.13.md
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { StorageBackend, StoreStats, BackendConfig } from './types';

/**
 * IndexedDB schema
 */
interface OwnYouDBSchema extends DBSchema {
  memories: {
    key: string; // compositeKey: namespace::userId::key
    value: {
      namespace: string;
      userId: string;
      key: string;
      value: unknown;
      createdAt: number;
      updatedAt: number;
    };
    indexes: {
      'by-namespace-user': [string, string];
      'by-namespace': string;
      'by-user': string;
    };
  };
}

/**
 * IndexedDBBackend - Browser storage using IndexedDB
 */
export class IndexedDBBackend implements StorageBackend {
  private dbName: string;
  private dbPromise: Promise<IDBPDatabase<OwnYouDBSchema>> | null = null;

  constructor(config?: BackendConfig) {
    this.dbName = config?.dbName ?? 'ownyou_store';
  }

  /**
   * Get or create database connection
   */
  private async getDB(): Promise<IDBPDatabase<OwnYouDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<OwnYouDBSchema>(this.dbName, 1, {
        upgrade(db) {
          const store = db.createObjectStore('memories', {
            keyPath: 'key',
          });

          // Composite index for namespace + user queries
          store.createIndex('by-namespace-user', ['namespace', 'userId']);
          store.createIndex('by-namespace', 'namespace');
          store.createIndex('by-user', 'userId');
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Create composite key from namespace, userId, and key
   */
  private makeKey(namespace: string, userId: string, key: string): string {
    return `${namespace}::${userId}::${key}`;
  }

  async put<T>(namespace: string, userId: string, key: string, value: T): Promise<void> {
    const db = await this.getDB();
    const compositeKey = this.makeKey(namespace, userId, key);
    const now = Date.now();

    await db.put('memories', {
      key: compositeKey,
      namespace,
      userId,
      value,
      createdAt: now,
      updatedAt: now,
    });
  }

  async get<T>(namespace: string, userId: string, key: string): Promise<T | null> {
    const db = await this.getDB();
    const compositeKey = this.makeKey(namespace, userId, key);

    const record = await db.get('memories', compositeKey);
    return record ? (record.value as T) : null;
  }

  async delete(namespace: string, userId: string, key: string): Promise<boolean> {
    const db = await this.getDB();
    const compositeKey = this.makeKey(namespace, userId, key);

    const exists = await db.get('memories', compositeKey);
    if (!exists) return false;

    await db.delete('memories', compositeKey);
    return true;
  }

  async list<T>(namespace: string, userId: string, limit: number, offset: number): Promise<T[]> {
    const db = await this.getDB();
    const index = db.transaction('memories').store.index('by-namespace-user');

    const items: T[] = [];
    let skipped = 0;

    // Use cursor for efficient iteration
    let cursor = await index.openCursor(IDBKeyRange.only([namespace, userId]));

    while (cursor) {
      if (skipped < offset) {
        skipped++;
      } else if (items.length < limit) {
        items.push(cursor.value.value as T);
      } else {
        break;
      }
      cursor = await cursor.continue();
    }

    return items;
  }

  async exists(namespace: string, userId: string, key: string): Promise<boolean> {
    const db = await this.getDB();
    const compositeKey = this.makeKey(namespace, userId, key);

    const record = await db.get('memories', compositeKey);
    return record !== undefined;
  }

  async getStats(namespace: string, userId: string): Promise<StoreStats> {
    const db = await this.getDB();
    const index = db.transaction('memories').store.index('by-namespace-user');

    let count = 0;
    let oldest = Infinity;
    let newest = 0;

    let cursor = await index.openCursor(IDBKeyRange.only([namespace, userId]));

    while (cursor) {
      count++;
      oldest = Math.min(oldest, cursor.value.createdAt);
      newest = Math.max(newest, cursor.value.createdAt);
      cursor = await cursor.continue();
    }

    return {
      namespace,
      count,
      oldestRecord: count > 0 ? oldest : undefined,
      newestRecord: count > 0 ? newest : undefined,
    };
  }

  async clear(namespace?: string, userId?: string): Promise<void> {
    const db = await this.getDB();

    if (!namespace && !userId) {
      // Clear all
      await db.clear('memories');
      return;
    }

    const tx = db.transaction('memories', 'readwrite');
    const store = tx.store;

    if (namespace && userId) {
      // Clear specific namespace and user
      const index = store.index('by-namespace-user');
      let cursor = await index.openCursor(IDBKeyRange.only([namespace, userId]));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    } else if (namespace) {
      // Clear all users in namespace
      const index = store.index('by-namespace');
      let cursor = await index.openCursor(IDBKeyRange.only(namespace));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    } else if (userId) {
      // Clear all namespaces for user
      const index = store.index('by-user');
      let cursor = await index.openCursor(IDBKeyRange.only(userId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }

    await tx.done;
  }

  async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }
}
