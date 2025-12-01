/**
 * Storage Backends - v13 Section 8.13
 *
 * Exports all storage backend implementations.
 */

export type { StorageBackend, StoreStats, BackendConfig } from './types';
export { InMemoryBackend } from './memory';
export { IndexedDBBackend } from './indexeddb';
