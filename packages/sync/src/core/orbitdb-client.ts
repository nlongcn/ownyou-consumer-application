/**
 * OrbitDB Client - v13 Section 5.2.2
 *
 * Wraps OrbitDB v3 for peer-to-peer database synchronization.
 * Uses Helia for IPFS networking and storage.
 * Implements E2EE using @orbitdb/simple-encryption for both data and replication.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.2
 * @see https://github.com/orbitdb/orbitdb/blob/main/docs/ENCRYPTION.md
 */

import type { HeliaNode } from './helia-node.js';
import { NAMESPACES } from '@ownyou/shared-types';

/**
 * OrbitDB encryption module interface
 */
export interface EncryptionModule {
  encrypt(value: Uint8Array): Promise<Uint8Array>;
  decrypt(value: Uint8Array): Promise<Uint8Array>;
}

/**
 * OrbitDB encryption configuration
 */
export interface OrbitDBEncryption {
  /** Encryption for data payload */
  data: EncryptionModule;
  /** Encryption for replication log entries */
  replication: EncryptionModule;
}

/**
 * OrbitDB client configuration
 */
export interface OrbitDBClientConfig {
  /** Helia node for IPFS */
  heliaNode: HeliaNode;
  /** Directory for OrbitDB data */
  directory?: string;
  /** Wallet address for access control */
  walletAddress: string;
  /** Encryption password derived from wallet signature */
  encryptionPassword: string;
}

/**
 * Database types supported by OrbitDB
 */
export type OrbitDBDatabaseType = 'events' | 'documents' | 'keyvalue';

/**
 * Database entry from OrbitDB
 */
export interface OrbitDBEntry<T = unknown> {
  key: string;
  value: T;
  hash: string;
}

/**
 * OrbitDB database interface
 */
export interface OrbitDBDatabase<T = unknown> {
  /** Database address (OrbitDB multiaddr) */
  address: string;
  /** Database type */
  type: OrbitDBDatabaseType;
  /** Add an entry (events database) */
  add(value: T): Promise<string>;
  /** Put a key-value pair (keyvalue/documents database) */
  put(key: string, value: T): Promise<string>;
  /** Get a value by key */
  get(key: string): Promise<T | undefined>;
  /** Delete a key */
  del(key: string): Promise<string>;
  /** Get all entries */
  all(): Promise<OrbitDBEntry<T>[]>;
  /** Query entries (documents database) */
  query(filter: (entry: T) => boolean): Promise<T[]>;
  /** Subscribe to updates */
  onUpdate(callback: (entry: OrbitDBEntry<T>) => void): () => void;
  /** Close the database */
  close(): Promise<void>;
}

/**
 * OrbitDB client interface
 */
export interface OrbitDBClient {
  /** Open or create a database */
  open<T = unknown>(
    name: string,
    options?: { type?: OrbitDBDatabaseType; meta?: Record<string, unknown> }
  ): Promise<OrbitDBDatabase<T>>;
  /** Open a database by its address */
  openByAddress<T = unknown>(address: string): Promise<OrbitDBDatabase<T>>;
  /** Get the client's identity */
  getIdentity(): string;
  /** Get all open databases */
  getDatabases(): Map<string, OrbitDBDatabase>;
  /** Stop the client */
  stop(): Promise<void>;
}

/**
 * Create an OrbitDB client
 *
 * @param config - Client configuration
 * @returns OrbitDB client instance
 *
 * @example
 * ```typescript
 * const heliaNode = await createHeliaNode({ platform: 'pwa' });
 * const orbitdb = await createOrbitDBClient({
 *   heliaNode,
 *   walletAddress: '0x1234...',
 * });
 *
 * const db = await orbitdb.open('my-sync-db', { type: 'keyvalue' });
 * await db.put('key1', { data: 'value1' });
 * ```
 */
export async function createOrbitDBClient(
  config: OrbitDBClientConfig
): Promise<OrbitDBClient> {
  const { heliaNode, directory, walletAddress, encryptionPassword } = config;

  // Dynamic import for OrbitDB and encryption
  const { createOrbitDB, IPFSAccessController } = await import('@orbitdb/core');
  // SimpleEncryption is a default export
  const SimpleEncryptionModule = await import('@orbitdb/simple-encryption');
  const SimpleEncryption = SimpleEncryptionModule.default;

  // Setup E2EE encryption for both data and replication
  // Using same password for both ensures only wallet owner can read data
  // See: https://github.com/orbitdb/orbitdb/blob/main/docs/ENCRYPTION.md
  const dataEncryption = await SimpleEncryption({ password: encryptionPassword });
  const replicationEncryption = await SimpleEncryption({ password: encryptionPassword });

  const encryption: OrbitDBEncryption = {
    data: dataEncryption,
    replication: replicationEncryption,
  };

  const orbitdbConfig: Record<string, unknown> = {
    ipfs: heliaNode.helia,
  };

  if (directory) {
    orbitdbConfig.directory = directory;
  }

  const orbitdb = await createOrbitDB(orbitdbConfig);
  const databases = new Map<string, OrbitDBDatabase>();

  return {
    async open<T = unknown>(
      name: string,
      options: { type?: OrbitDBDatabaseType; meta?: Record<string, unknown> } = {}
    ): Promise<OrbitDBDatabase<T>> {
      const { type = 'keyvalue', meta } = options;

      // Use IPFSAccessController with wallet-based write access
      // AND encryption for both data and replication
      const dbOptions: Record<string, unknown> = {
        type,
        AccessController: IPFSAccessController({
          write: [walletAddress, '*'], // Allow wallet owner and peers
        }),
        // E2EE: Encrypt both data payload and replication log entries
        encryption,
      };

      if (meta) {
        dbOptions.meta = meta;
      }

      const db = await orbitdb.open(name, dbOptions);
      const wrappedDb = wrapOrbitDBDatabase<T>(db, type);
      databases.set(db.address.toString(), wrappedDb);

      return wrappedDb;
    },

    async openByAddress<T = unknown>(address: string): Promise<OrbitDBDatabase<T>> {
      // When opening by address, also use encryption
      const db = await orbitdb.open(address, { encryption });
      const type = (db.type || 'keyvalue') as OrbitDBDatabaseType;
      const wrappedDb = wrapOrbitDBDatabase<T>(db, type);
      databases.set(address, wrappedDb);

      return wrappedDb;
    },

    getIdentity(): string {
      return orbitdb.identity.id;
    },

    getDatabases(): Map<string, OrbitDBDatabase> {
      return new Map(databases);
    },

    async stop(): Promise<void> {
      // Close all databases
      for (const db of databases.values()) {
        await db.close();
      }
      databases.clear();

      // Stop OrbitDB
      await orbitdb.stop();
    },
  };
}

/**
 * Wrap an OrbitDB database with a type-safe interface
 */
function wrapOrbitDBDatabase<T>(
  db: unknown,
  type: OrbitDBDatabaseType
): OrbitDBDatabase<T> {
  const orbitDb = db as {
    address: { toString(): string };
    add(value: T): Promise<string>;
    put(key: string, value: T): Promise<string>;
    get(key: string): Promise<T | undefined>;
    del(key: string): Promise<string>;
    all(): Promise<Array<{ key?: string; value: T; hash: string }>>;
    query(filter: (entry: T) => boolean): Promise<T[]>;
    events: {
      on(event: string, callback: (entry: unknown) => void): void;
      off(event: string, callback: (entry: unknown) => void): void;
    };
    close(): Promise<void>;
  };

  const listeners = new Map<(entry: OrbitDBEntry<T>) => void, (entry: unknown) => void>();

  return {
    address: orbitDb.address.toString(),
    type,

    async add(value: T): Promise<string> {
      return orbitDb.add(value);
    },

    async put(key: string, value: T): Promise<string> {
      return orbitDb.put(key, value);
    },

    async get(key: string): Promise<T | undefined> {
      return orbitDb.get(key);
    },

    async del(key: string): Promise<string> {
      return orbitDb.del(key);
    },

    async all(): Promise<OrbitDBEntry<T>[]> {
      const entries = await orbitDb.all();
      return entries.map((e, i) => ({
        key: e.key || String(i),
        value: e.value,
        hash: e.hash,
      }));
    },

    async query(filter: (entry: T) => boolean): Promise<T[]> {
      if (type !== 'documents') {
        // For non-documents databases, filter manually
        const all = await orbitDb.all();
        return all.map((e) => e.value).filter(filter);
      }
      return orbitDb.query(filter);
    },

    onUpdate(callback: (entry: OrbitDBEntry<T>) => void): () => void {
      const wrappedCallback = (entry: unknown) => {
        const typedEntry = entry as { payload?: { key?: string; value: T }; hash?: string };
        callback({
          key: typedEntry.payload?.key || '',
          value: typedEntry.payload?.value as T,
          hash: typedEntry.hash || '',
        });
      };

      listeners.set(callback, wrappedCallback);
      orbitDb.events.on('update', wrappedCallback);

      return () => {
        orbitDb.events.off('update', wrappedCallback);
        listeners.delete(callback);
      };
    },

    async close(): Promise<void> {
      // Remove all listeners
      for (const [, wrappedCallback] of listeners) {
        orbitDb.events.off('update', wrappedCallback);
      }
      listeners.clear();

      await orbitDb.close();
    },
  };
}

/**
 * Get the OrbitDB database name for a namespace
 *
 * Maps OwnYou namespaces to OrbitDB database names.
 */
export function getOrbitDBNameForNamespace(namespace: string, userId: string): string {
  // Sanitize namespace for use as database name
  const sanitized = namespace.replace(/\./g, '-');
  return `ownyou-${sanitized}-${userId.slice(0, 8)}`;
}

/**
 * Get the recommended OrbitDB database type for a namespace
 */
export function getOrbitDBTypeForNamespace(namespace: string): OrbitDBDatabaseType {
  // Most data is key-value
  // Events log for append-only data like traces
  if (
    namespace === NAMESPACES.AGENT_TRACES ||
    namespace === NAMESPACES.SYNC_LOGS
  ) {
    return 'events';
  }

  // Documents for complex queryable data
  if (
    namespace === NAMESPACES.EPISODIC_MEMORY ||
    namespace === NAMESPACES.ENTITIES ||
    namespace === NAMESPACES.RELATIONSHIPS
  ) {
    return 'documents';
  }

  // Default to keyvalue for most data
  return 'keyvalue';
}

/**
 * Check if OrbitDB dependencies are available
 */
export async function checkOrbitDBAvailability(): Promise<{
  available: boolean;
  missingDeps: string[];
}> {
  const requiredDeps = ['@orbitdb/core'];
  const missingDeps: string[] = [];

  for (const dep of requiredDeps) {
    try {
      await import(dep);
    } catch {
      missingDeps.push(dep);
    }
  }

  return {
    available: missingDeps.length === 0,
    missingDeps,
  };
}
