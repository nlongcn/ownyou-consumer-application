/**
 * Day 3-4: Custom IndexedDBStore Implementation
 *
 * Extends BaseStore from @langchain/langgraph-checkpoint to provide IndexedDB
 * persistence for browser-based LangGraph applications.
 *
 * This enables long-term cross-thread memory for:
 * - IAB classifications
 * - Mission cards
 * - User preferences
 * - Any persistent data needed by Mission Agents
 */

import {
  BaseStore,
  Item,
  SearchItem,
  GetOperation,
  SearchOperation,
  PutOperation,
  ListNamespacesOperation,
  Operation,
  OperationResults
} from "@langchain/langgraph-checkpoint";

/**
 * IndexedDB-backed implementation of LangGraph BaseStore.
 *
 * Storage Model:
 * - Database: One per application
 * - Object Store: "items" with composite key [namespace, key]
 * - Index: "namespace" for efficient namespace filtering
 *
 * @example
 * const store = new IndexedDBStore("ownyou-store");
 * await store.put(["user_123", "iab_classifications"], "taxonomy_25", {
 *   category: "Shopping",
 *   confidence: 0.95
 * });
 *
 * const item = await store.get(["user_123", "iab_classifications"], "taxonomy_25");
 */
export class IndexedDBStore extends BaseStore {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * @param dbName Name of the IndexedDB database
   */
  constructor(dbName: string = "langgraph-store") {
    super();
    this.dbName = dbName;
  }

  /**
   * Initialize the IndexedDB database and create object stores.
   * Called automatically on first operation.
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for items
        // Key: composite [namespace-joined, key]
        if (!db.objectStoreNames.contains("items")) {
          const store = db.createObjectStore("items", {
            keyPath: ["_namespaceStr", "key"]
          });

          // Index for namespace prefix queries
          store.createIndex("namespace", "_namespaceStr", { unique: false });

          // Index for timestamps
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Convert namespace array to string for IndexedDB key.
   * Example: ["user_123", "memories"] → "user_123/memories"
   */
  private namespaceToString(namespace: string[]): string {
    return namespace.join("/");
  }

  /**
   * Convert namespace string back to array.
   * Example: "user_123/memories" → ["user_123", "memories"]
   */
  private stringToNamespace(str: string): string[] {
    return str === "" ? [] : str.split("/");
  }

  /**
   * Convert stored item to BaseStore Item interface.
   */
  private toItem(stored: any): Item {
    return {
      value: stored.value,
      key: stored.key,
      namespace: this.stringToNamespace(stored._namespaceStr),
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
    };
  }

  /**
   * Execute multiple operations in a single batch.
   * Required by BaseStore interface.
   */
  async batch<Op extends Operation[]>(operations: Op): Promise<OperationResults<Op>> {
    const db = await this.ensureDB();
    const results: any[] = [];

    for (const op of operations) {
      if ("key" in op && "namespace" in op && "value" in op) {
        // PutOperation
        await this.put(op.namespace, op.key, op.value, op.index);
        results.push(undefined);
      } else if ("key" in op && "namespace" in op) {
        // GetOperation
        const item = await this.get(op.namespace, op.key);
        results.push(item);
      } else if ("namespacePrefix" in op) {
        // SearchOperation
        const items = await this.search(op.namespacePrefix, {
          filter: op.filter,
          limit: op.limit,
          offset: op.offset,
          query: op.query,
        });
        results.push(items);
      } else if ("matchConditions" in op) {
        // ListNamespacesOperation
        const namespaces = await this.listNamespaces({
          limit: op.limit,
          offset: op.offset,
        });
        results.push(namespaces);
      }
    }

    return results as OperationResults<Op>;
  }

  /**
   * Retrieve a single item by namespace and key.
   */
  async get(namespace: string[], key: string): Promise<Item | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["items"], "readonly");
      const store = transaction.objectStore("items");

      const namespaceStr = this.namespaceToString(namespace);
      const request = store.get([namespaceStr, key]);

      request.onsuccess = () => {
        if (request.result) {
          resolve(this.toItem(request.result));
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to get item: ${request.error?.message}`));
      };
    });
  }

  /**
   * Search for items within a namespace prefix.
   * Supports filtering by exact field values.
   *
   * Note: Vector similarity search (query parameter) not yet implemented.
   */
  async search(
    namespacePrefix: string[],
    options?: {
      filter?: Record<string, any>;
      limit?: number;
      offset?: number;
      query?: string;
    }
  ): Promise<SearchItem[]> {
    const db = await this.ensureDB();
    const limit = options?.limit ?? 10;
    const offset = options?.offset ?? 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["items"], "readonly");
      const store = transaction.objectStore("items");
      const index = store.index("namespace");

      const prefixStr = this.namespaceToString(namespacePrefix);
      const results: SearchItem[] = [];
      let skipped = 0;

      // Use cursor to iterate items with matching namespace prefix
      const request = index.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }

        const item = cursor.value;
        const itemNamespace = item._namespaceStr as string;

        // Check if namespace starts with prefix
        if (itemNamespace.startsWith(prefixStr)) {
          // Apply filters if provided
          if (options?.filter) {
            const matches = this.matchesFilter(item.value, options.filter);
            if (!matches) {
              cursor.continue();
              return;
            }
          }

          // Apply offset
          if (skipped < offset) {
            skipped++;
            cursor.continue();
            return;
          }

          // Add to results
          results.push(this.toItem(item));
        }

        cursor.continue();
      };

      request.onerror = () => {
        reject(new Error(`Failed to search: ${request.error?.message}`));
      };
    });
  }

  /**
   * Check if an item's value matches the filter criteria.
   * Supports exact matches and basic comparison operators.
   */
  private matchesFilter(value: Record<string, any>, filter: Record<string, any>): boolean {
    for (const [key, filterValue] of Object.entries(filter)) {
      const itemValue = value[key];

      // Check for operator-based filters
      if (typeof filterValue === "object" && filterValue !== null) {
        for (const [op, opValue] of Object.entries(filterValue)) {
          switch (op) {
            case "$eq":
              if (itemValue !== opValue) return false;
              break;
            case "$ne":
              if (itemValue === opValue) return false;
              break;
            case "$gt":
              if (!(itemValue > opValue)) return false;
              break;
            case "$gte":
              if (!(itemValue >= opValue)) return false;
              break;
            case "$lt":
              if (!(itemValue < opValue)) return false;
              break;
            case "$lte":
              if (!(itemValue <= opValue)) return false;
              break;
            default:
              // Unknown operator, treat as exact match
              if (itemValue !== filterValue) return false;
          }
        }
      } else {
        // Exact match
        if (itemValue !== filterValue) return false;
      }
    }

    return true;
  }

  /**
   * Store or update an item.
   *
   * @param namespace Hierarchical path for the item
   * @param key Unique identifier within the namespace
   * @param value Object containing the item's data
   * @param index Optional indexing configuration (not yet used)
   */
  async put(
    namespace: string[],
    key: string,
    value: Record<string, any>,
    index?: false | string[]
  ): Promise<void> {
    const db = await this.ensureDB();

    const namespaceStr = this.namespaceToString(namespace);
    const now = new Date().toISOString();

    // Check if item exists to preserve createdAt
    const existing = await this.get(namespace, key);

    const storedItem = {
      _namespaceStr: namespaceStr,
      key,
      namespace,  // Store array for easier retrieval
      value,
      createdAt: existing ? existing.createdAt.toISOString() : now,
      updatedAt: now,
      _index: index,  // Store index config for future use
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["items"], "readwrite");
      const store = transaction.objectStore("items");

      const request = store.put(storedItem);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to put item: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete an item from the store.
   */
  async delete(namespace: string[], key: string): Promise<void> {
    const db = await this.ensureDB();

    const namespaceStr = this.namespaceToString(namespace);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["items"], "readwrite");
      const store = transaction.objectStore("items");

      const request = store.delete([namespaceStr, key]);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete item: ${request.error?.message}`));
      };
    });
  }

  /**
   * List namespaces in the store.
   *
   * For MVP, returns all unique namespaces.
   * Filtering options (prefix, suffix, maxDepth) not yet implemented.
   */
  async listNamespaces(options?: {
    prefix?: string[];
    suffix?: string[];
    maxDepth?: number;
    limit?: number;
    offset?: number;
  }): Promise<string[][]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["items"], "readonly");
      const store = transaction.objectStore("items");
      const index = store.index("namespace");

      const namespaces = new Set<string>();
      const request = index.openKeyCursor();

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          // Convert set to array of namespace arrays
          const result = Array.from(namespaces).map(ns => this.stringToNamespace(ns));
          resolve(result);
          return;
        }

        namespaces.add(cursor.key as string);
        cursor.continue();
      };

      request.onerror = () => {
        reject(new Error(`Failed to list namespaces: ${request.error?.message}`));
      };
    });
  }

  /**
   * Initialize the store (called automatically on first use).
   */
  start(): void {
    // Initialization happens lazily in ensureDB()
    // This method exists to satisfy BaseStore interface
  }

  /**
   * Close the database connection.
   */
  stop(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
    }
  }
}
