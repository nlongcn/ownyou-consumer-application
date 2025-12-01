/**
 * Storage Backend Types - v13 Section 8.13
 *
 * Abstract interface for storage backends.
 * Supports IndexedDB (PWA), SQLite (Tauri), and in-memory (testing).
 *
 * @see docs/architecture/extracts/storage-backends-8.13.md
 */

/**
 * StorageBackend - Abstract interface for persistence layer
 *
 * All backends must implement this interface to be compatible
 * with the MemoryStore.
 */
export interface StorageBackend {
  /**
   * Store a value
   * @param namespace The namespace (e.g., 'ownyou.semantic')
   * @param userId User identifier for data isolation
   * @param key Item key within the namespace
   * @param value Data to store
   */
  put<T>(namespace: string, userId: string, key: string, value: T): Promise<void>;

  /**
   * Retrieve a value
   * @returns The stored value or null if not found
   */
  get<T>(namespace: string, userId: string, key: string): Promise<T | null>;

  /**
   * Delete a value
   * @returns true if deleted, false if not found
   */
  delete(namespace: string, userId: string, key: string): Promise<boolean>;

  /**
   * List values in a namespace
   * @param limit Maximum number of items to return
   * @param offset Number of items to skip
   */
  list<T>(namespace: string, userId: string, limit: number, offset: number): Promise<T[]>;

  /**
   * Check if a key exists
   */
  exists(namespace: string, userId: string, key: string): Promise<boolean>;

  /**
   * Get statistics for a namespace
   */
  getStats(namespace: string, userId: string): Promise<StoreStats>;

  /**
   * Clear data
   * @param namespace Optional - clear only this namespace
   * @param userId Optional - clear only this user's data
   */
  clear(namespace?: string, userId?: string): Promise<void>;

  /**
   * Close the backend connection
   */
  close?(): Promise<void>;
}

/**
 * Store statistics
 */
export interface StoreStats {
  namespace: string;
  count: number;
  sizeBytes?: number;
  oldestRecord?: number;
  newestRecord?: number;
}

/**
 * Backend configuration options
 */
export interface BackendConfig {
  /** Database name for IndexedDB/SQLite */
  dbName?: string;

  /** Encryption key for SQLCipher (SQLite) */
  encryptionKey?: string;

  /** Database path for SQLite */
  dbPath?: string;
}
