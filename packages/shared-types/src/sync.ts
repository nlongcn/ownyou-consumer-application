/**
 * Sync Types - v13 Section 8.14
 *
 * Types for OrbitDB synchronization and conflict resolution.
 *
 * @see docs/architecture/extracts/sync-8.14.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 8.14
 */

import type { ConflictStrategy } from './memory';

/**
 * Vector clock for causality tracking
 */
export type VectorClock = Record<string, number>;

/**
 * SyncPayload - v13 Section 8.14.3
 *
 * Encrypted payload for OrbitDB replication.
 */
export interface SyncPayload {
  /** Encrypted data (AES-GCM) */
  ciphertext: Uint8Array;

  /** Initialization vector (12 bytes for AES-GCM) */
  iv: Uint8Array;

  /** Salt used for key derivation */
  keyDerivationSalt: string;

  // Metadata (not encrypted)
  /** Which namespace this data belongs to */
  namespace: string;

  /** Type of operation */
  operation: 'put' | 'update' | 'delete';

  /** When this operation occurred */
  timestamp: number;

  /** Which device originated this change */
  deviceId: string;

  /** Vector clock for causality */
  vectorClock: VectorClock;
}

/**
 * Extended conflict strategy for sync operations
 */
export type SyncConflictStrategy =
  | ConflictStrategy
  | 'merge_properties'
  | 'sum_reconcile'
  | 'flag_for_review';

/**
 * ConflictResolution - Generic conflict resolver
 */
export interface ConflictResolution<T> {
  /** Which strategy to use */
  strategy: ConflictStrategy;

  /** Resolution function */
  resolve(
    local: T,
    remote: T,
    localClock: VectorClock,
    remoteClock: VectorClock
  ): T;
}

/**
 * CONFLICT_STRATEGIES - v13 Section 8.14.4
 *
 * Default conflict resolution strategies by namespace.
 */
export const CONFLICT_STRATEGIES: Record<string, SyncConflictStrategy> = {
  'ownyou.semantic': 'latest_wins',
  'ownyou.episodic': 'merge',
  'ownyou.procedural': 'flag_for_review',
  'ownyou.entities': 'merge_properties',
  'ownyou.relationships': 'latest_wins',
  'ownyou.missions': 'latest_wins',
  'ownyou.earnings': 'sum_reconcile',
};

/**
 * SyncState - Tracks sync progress
 */
export interface SyncState {
  /** Last successful sync timestamp */
  lastSyncedAt: number;

  /** Current local vector clock */
  localClock: VectorClock;

  /** Pending changes to sync */
  pendingChanges: number;

  /** Whether sync is in progress */
  isSyncing: boolean;

  /** Last sync error if any */
  lastError?: string;
}

/**
 * SyncConfig - Configuration for sync behavior
 */
export interface SyncConfig {
  /** Minimum interval between syncs (ms) */
  minSyncInterval: number;

  /** Maximum batch size for sync */
  maxBatchSize: number;

  /** Whether to sync immediately on changes */
  syncOnChange: boolean;

  /** Whether to sync on app startup */
  syncOnStartup: boolean;
}

// Re-export ConflictStrategy from memory for convenience
export type { ConflictStrategy } from './memory';
