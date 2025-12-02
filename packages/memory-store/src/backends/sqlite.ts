/**
 * SQLite Backend - v13 Section 8.13
 *
 * Cross-platform SQLite storage backend using sql.js (WebAssembly).
 * Works in browser, Node.js, and Tauri without native compilation.
 *
 * Persistence:
 * - Node.js/Tauri: Saves to filesystem at dbPath
 * - Browser: Saves to IndexedDB (using idb library)
 *
 * @see docs/architecture/extracts/storage-backends-8.13.md
 */

import type { StorageBackend, StoreStats, BackendConfig } from './types';

// sql.js types
interface SqlJsStatic {
  Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  prepare(sql: string): SqlJsStatement;
  export(): Uint8Array;
  close(): void;
}

interface SqlJsStatement {
  bind(params?: unknown[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
  run(params?: unknown[]): void;
  get(params?: unknown[]): unknown[];
}

// Global SQL.js instance cache
let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * Initialize sql.js (cached)
 */
async function initSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      // Dynamic import for sql.js
      const initSqlJsFn = (await import('sql.js')).default;

      // Initialize with WASM - sql.js will locate the wasm file automatically in Node.js
      // For browser, you may need to configure locateFile
      return await initSqlJsFn({
        // In Node.js, sql.js can find the wasm file automatically
        // In browser builds, this should be configured by the bundler
      });
    })();
  }
  return sqlJsPromise;
}

/**
 * Check if running in Node.js environment
 */
function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' && process.versions?.node !== undefined;
}

/**
 * Persistence layer for SQLite database binary
 * Uses filesystem in Node.js, IndexedDB in browser
 */
class SQLitePersistence {
  private dbPath: string;
  private idbStore: IDBDatabase | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Load existing database from storage
   */
  async load(): Promise<Uint8Array | null> {
    if (this.dbPath === ':memory:') {
      return null;
    }

    if (isNodeEnvironment()) {
      return this.loadFromFile();
    } else {
      return this.loadFromIndexedDB();
    }
  }

  /**
   * Save database to storage
   */
  async save(data: Uint8Array): Promise<void> {
    if (this.dbPath === ':memory:') {
      return;
    }

    if (isNodeEnvironment()) {
      await this.saveToFile(data);
    } else {
      await this.saveToIndexedDB(data);
    }
  }

  /**
   * Load from filesystem (Node.js/Tauri)
   */
  private async loadFromFile(): Promise<Uint8Array | null> {
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(this.dbPath);
      return new Uint8Array(buffer);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      throw err;
    }
  }

  /**
   * Save to filesystem (Node.js/Tauri)
   */
  private async saveToFile(data: Uint8Array): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    // Write database file
    await fs.writeFile(this.dbPath, data);
  }

  /**
   * Load from IndexedDB (Browser)
   */
  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    const db = await this.getIDBStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sqlite_databases', 'readonly');
      const store = tx.objectStore('sqlite_databases');
      const request = store.get(this.dbPath);

      request.onsuccess = () => {
        resolve(request.result?.data || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save to IndexedDB (Browser)
   */
  private async saveToIndexedDB(data: Uint8Array): Promise<void> {
    const db = await this.getIDBStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sqlite_databases', 'readwrite');
      const store = tx.objectStore('sqlite_databases');
      const request = store.put({ path: this.dbPath, data, updatedAt: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get or create IndexedDB store for SQLite databases
   */
  private async getIDBStore(): Promise<IDBDatabase> {
    if (this.idbStore) {
      return this.idbStore;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ownyou_sqlite_persistence', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sqlite_databases')) {
          db.createObjectStore('sqlite_databases', { keyPath: 'path' });
        }
      };

      request.onsuccess = () => {
        this.idbStore = request.result;
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * SQLiteBackend - Cross-platform storage using sql.js (WebAssembly)
 */
export class SQLiteBackend implements StorageBackend {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private persistence: SQLitePersistence;
  private initPromise: Promise<SqlJsDatabase> | null = null;

  constructor(config?: BackendConfig) {
    this.dbPath = config?.dbPath ?? ':memory:';
    this.persistence = new SQLitePersistence(this.dbPath);
  }

  /**
   * Get or create database connection
   */
  private async getDB(): Promise<SqlJsDatabase> {
    if (!this.initPromise) {
      this.initPromise = this.initDatabase();
    }
    return this.initPromise;
  }

  /**
   * Initialize the database
   */
  private async initDatabase(): Promise<SqlJsDatabase> {
    const SQL = await initSqlJs();

    // Load existing database from persistence if available
    const existingData = await this.persistence.load();

    if (existingData) {
      // Restore from persisted data
      this.db = new SQL.Database(existingData);
    } else {
      // Create new database
      this.db = new SQL.Database();
      // Initialize schema for new database
      this.initSchema();
    }

    return this.db;
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    if (!this.db) return;

    // Create memories table with indexes matching v13 spec
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        composite_key TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.run('CREATE INDEX IF NOT EXISTS idx_namespace_user ON memories(namespace, user_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_namespace ON memories(namespace)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_user ON memories(user_id)');
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
    const valueJson = JSON.stringify(value);

    // Use INSERT OR REPLACE for upsert behavior
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO memories (composite_key, namespace, user_id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([compositeKey, namespace, userId, key, valueJson, now, now]);
    stmt.free();
  }

  async get<T>(namespace: string, userId: string, key: string): Promise<T | null> {
    const db = await this.getDB();
    const compositeKey = this.makeKey(namespace, userId, key);

    const stmt = db.prepare('SELECT value FROM memories WHERE composite_key = ?');
    stmt.bind([compositeKey]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return JSON.parse(row.value as string) as T;
    }

    stmt.free();
    return null;
  }

  async delete(namespace: string, userId: string, key: string): Promise<boolean> {
    const db = await this.getDB();
    const compositeKey = this.makeKey(namespace, userId, key);

    // Check if exists first
    const checkStmt = db.prepare('SELECT 1 FROM memories WHERE composite_key = ?');
    checkStmt.bind([compositeKey]);
    const exists = checkStmt.step();
    checkStmt.free();

    if (!exists) return false;

    const deleteStmt = db.prepare('DELETE FROM memories WHERE composite_key = ?');
    deleteStmt.run([compositeKey]);
    deleteStmt.free();

    return true;
  }

  async list<T>(namespace: string, userId: string, limit: number, offset: number): Promise<T[]> {
    const db = await this.getDB();

    const stmt = db.prepare(`
      SELECT value FROM memories
      WHERE namespace = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    stmt.bind([namespace, userId, limit, offset]);

    const items: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      items.push(JSON.parse(row.value as string) as T);
    }

    stmt.free();
    return items;
  }

  async exists(namespace: string, userId: string, key: string): Promise<boolean> {
    const db = await this.getDB();
    const compositeKey = this.makeKey(namespace, userId, key);

    const stmt = db.prepare('SELECT 1 FROM memories WHERE composite_key = ?');
    stmt.bind([compositeKey]);
    const exists = stmt.step();
    stmt.free();

    return exists;
  }

  async getStats(namespace: string, userId: string): Promise<StoreStats> {
    const db = await this.getDB();

    // Get count
    const countStmt = db.prepare(`
      SELECT COUNT(*) as count FROM memories
      WHERE namespace = ? AND user_id = ?
    `);
    countStmt.bind([namespace, userId]);
    countStmt.step();
    const countRow = countStmt.getAsObject();
    countStmt.free();

    // Get time range
    const timeStmt = db.prepare(`
      SELECT MIN(created_at) as oldest, MAX(created_at) as newest
      FROM memories
      WHERE namespace = ? AND user_id = ?
    `);
    timeStmt.bind([namespace, userId]);
    timeStmt.step();
    const timeRow = timeStmt.getAsObject();
    timeStmt.free();

    return {
      namespace,
      count: (countRow.count as number) || 0,
      oldestRecord: timeRow.oldest as number | undefined,
      newestRecord: timeRow.newest as number | undefined,
    };
  }

  async clear(namespace?: string, userId?: string): Promise<void> {
    const db = await this.getDB();

    if (!namespace && !userId) {
      // Clear all
      db.run('DELETE FROM memories');
      return;
    }

    if (namespace && userId) {
      // Clear specific namespace and user
      const stmt = db.prepare('DELETE FROM memories WHERE namespace = ? AND user_id = ?');
      stmt.run([namespace, userId]);
      stmt.free();
    } else if (namespace) {
      // Clear all users in namespace
      const stmt = db.prepare('DELETE FROM memories WHERE namespace = ?');
      stmt.run([namespace]);
      stmt.free();
    } else if (userId) {
      // Clear all namespaces for user
      const stmt = db.prepare('DELETE FROM memories WHERE user_id = ?');
      stmt.run([userId]);
      stmt.free();
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      // Save to persistence before closing
      await this.persistence.save(this.db.export());
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * Export database as Uint8Array (for persistence)
   */
  async export(): Promise<Uint8Array> {
    const db = await this.getDB();
    return db.export();
  }

  /**
   * Explicitly save database to persistence
   * Use this for manual save points (auto-saves on close)
   */
  async save(): Promise<void> {
    if (this.db) {
      await this.persistence.save(this.db.export());
    }
  }
}
