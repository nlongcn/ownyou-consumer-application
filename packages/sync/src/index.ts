/**
 * @ownyou/sync - Cross-Device Sync Package
 *
 * Provides synchronization infrastructure using OrbitDB v3 + Helia with E2EE.
 *
 * @see docs/sprints/ownyou-sprint10-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5
 */

// Types
export type {
  SyncLayer,
  SyncLayerConfig,
  SyncStatus,
  SyncState,
  SyncEvent,
  SyncEventType,
  SyncConfig,
  PeerDevice,
  ConnectionType,
  VectorClock,
  OfflineQueueEntry,
  SyncPayload,
  WalletProvider,
  TurnConfig,
  DerivedEncryptionKey,
  DeviceRegistration,
  SignalingMessage,
  CRDTType,
  CRDTMergeResult,
  GCounterState,
  PNCounterState,
  ORSetState,
  LWWRegisterState,
  LWWMapState,
  SelectiveRule,
  SyncScopeConfig,
} from './types.js';

// Default config
export { DEFAULT_SYNC_CONFIG } from './types.js';

// Core
export { createSyncLayer, createTestSyncLayer } from './core/sync-layer.js';
export * as VectorClock from './core/vector-clock.js';
export * as OfflineQueue from './core/offline-queue.js';
export type { OfflineQueueState } from './core/offline-queue.js';

// CRDT
export {
  GCounter,
  PNCounter,
  ORSet,
  LWWRegister,
  LWWMap,
  resolveConflict,
  createInitialState,
  applyOperation,
  serializeState,
  deserializeState,
  getValue,
  type CRDTOperation,
  type CRDTState,
  type ConflictResolutionResult,
} from './crdt/index.js';

// Encryption
export {
  deriveEncryptionKey,
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  deriveTurnCredentials,
  verifyKeyMatch,
  generateOneTimeKey,
  exportKey,
  importKey,
  createMockWalletProvider,
  type KeyPurpose,
} from './encryption/index.js';

// Configuration
export {
  getCRDTType,
  supportsIncrement,
  supportsDecrement,
  supportsSetOperations,
  supportsMapOperations,
  CRDT_TYPE_BY_NAMESPACE,
  shouldSyncNamespace,
  getSyncScopeConfig,
  shouldSyncItem,
  getSyncableNamespaces,
  getDeviceLocalNamespaces,
  SYNC_SCOPE_BY_NAMESPACE,
  EPISODIC_SYNC_RULES,
} from './config/index.js';
