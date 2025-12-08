/**
 * Sync Types - v13 Section 5
 *
 * Core types for cross-device synchronization using OrbitDB v3 + Helia.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5
 * @see docs/sprints/ownyou-sprint10-spec.md
 */

/**
 * Wallet provider interface for key derivation
 */
export interface WalletProvider {
  /** Get the wallet address */
  getWalletAddress(): Promise<string>;
  /** Sign a message for key derivation */
  signMessage(message: string): Promise<string>;
}

/**
 * TURN server configuration for NAT traversal
 */
export interface TurnConfig {
  url: string;
  username: string;
  credential: string;
}

/**
 * Configuration for the sync layer
 */
export interface SyncLayerConfig {
  /** Platform-specific mode */
  platform: 'tauri' | 'pwa';

  /** Privy wallet for encryption key derivation */
  walletProvider: WalletProvider;

  /** Signaling server for device discovery */
  signalingServer: string;

  /** STUN servers for NAT traversal */
  stunServers: string[];

  /** TURN server for relay (fallback for symmetric NAT) */
  turnServer?: TurnConfig;

  /** Encryption mode preference */
  encryptionMode: 'orbitdb-native' | 'custom-aes-gcm';

  /** Optional: Override default sync config */
  syncConfig?: Partial<SyncConfig>;
}

/**
 * Sync configuration with extracted magic numbers
 */
export interface SyncConfig {
  /** Maximum number of connected peers */
  maxPeers: number;
  /** Sync interval in milliseconds */
  syncIntervalMs: number;
  /** Maximum offline queue entries */
  offlineQueueLimit: number;
  /** Backup retention in days */
  backupRetentionDays: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number;
  /** Retry attempts for failed operations */
  maxRetryAttempts: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: number;
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxPeers: 50,
  syncIntervalMs: 30000,
  offlineQueueLimit: 1000,
  backupRetentionDays: 90,
  connectionTimeoutMs: 10000,
  maxRetryAttempts: 3,
  retryBaseDelayMs: 1000,
};

/**
 * Sync status states
 */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

/**
 * Connection type between peers
 */
export type ConnectionType = 'direct_p2p' | 'relayed' | 'cloud_backup';

/**
 * Current sync status
 */
export interface SyncStatus {
  /** Whether the device is online */
  isOnline: boolean;
  /** Last successful sync timestamp */
  lastSyncTime: number | null;
  /** Number of pending mutations in offline queue */
  pendingMutations: number;
  /** Number of connected peer devices */
  connectedPeers: number;
  /** Current sync state */
  syncState: SyncState;
  /** Error message if syncState is 'error' */
  error?: string;
}

/**
 * Connected peer device information
 */
export interface PeerDevice {
  /** Unique device identifier */
  deviceId: string;
  /** Wallet address (same for all user's devices) */
  walletAddress: string;
  /** Platform type */
  platform: 'tauri' | 'pwa';
  /** Last seen timestamp */
  lastSeen: number;
  /** Connection type */
  connectionType: ConnectionType;
}

/**
 * Vector clock for causal ordering
 *
 * Maps deviceId to logical timestamp
 */
export interface VectorClock {
  [deviceId: string]: number;
}

/**
 * Offline queue entry with vector clock
 */
export interface OfflineQueueEntry {
  /** Unique entry ID */
  id: string;
  /** Operation type */
  operation: 'put' | 'delete';
  /** Target namespace */
  namespace: string;
  /** Item key */
  key: string;
  /** Value (for put operations) */
  value: unknown;
  /** Operation timestamp */
  timestamp: number;
  /** Vector clock for causal ordering */
  vectorClock: VectorClock;
  /** Whether this entry has been synced */
  synced: boolean;
}

/**
 * Sync payload for encrypted data transfer
 */
export interface SyncPayload {
  /** Encrypted content (AES-256-GCM) */
  ciphertext: Uint8Array;
  /** Random IV per operation */
  iv: Uint8Array;
  /** Salt for key derivation */
  keyDerivationSalt: string;
  /** Target namespace */
  namespace: string;
  /** Operation type */
  operation: 'put' | 'update' | 'delete';
  /** Operation timestamp */
  timestamp: number;
  /** Source device ID */
  deviceId: string;
}

/**
 * Sync event types for observability
 */
export type SyncEventType =
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'peer_connected'
  | 'peer_disconnected'
  | 'conflict_resolved'
  | 'offline_queued'
  | 'offline_flushed';

/**
 * Sync event for logging and debugging
 */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
  deviceId: string;
  data?: Record<string, unknown>;
}

/**
 * Sync layer interface
 */
export interface SyncLayer {
  /** Initialize sync with local store */
  initialize(store: unknown): Promise<void>;

  /** Start syncing (call after initialize) */
  start(): Promise<void>;

  /** Stop syncing (cleanup) */
  stop(): Promise<void>;

  /** Get current sync status */
  getStatus(): SyncStatus;

  /** Force sync now */
  forceSync(): Promise<void>;

  /** Get connected peers */
  getPeers(): PeerDevice[];

  /** Subscribe to sync events */
  onSyncEvent(callback: (event: SyncEvent) => void): () => void;
}

/**
 * CRDT types for conflict resolution
 */
export type CRDTType = 'g-counter' | 'pn-counter' | 'or-set' | 'lww-register' | 'lww-map';

/**
 * CRDT operation result
 */
export interface CRDTMergeResult<T> {
  /** Merged value */
  value: T;
  /** Whether a conflict was detected */
  hadConflict: boolean;
  /** Winning device ID if conflict occurred */
  winningDeviceId?: string;
}

/**
 * G-Counter state (Grow-only counter)
 */
export interface GCounterState {
  /** Device ID → count mapping */
  counts: Record<string, number>;
}

/**
 * PN-Counter state (Positive-Negative counter)
 */
export interface PNCounterState {
  /** Positive counts by device */
  positive: Record<string, number>;
  /** Negative counts by device */
  negative: Record<string, number>;
}

/**
 * OR-Set state (Observed-Remove Set)
 */
export interface ORSetState<T> {
  /** Elements with unique tags */
  elements: Map<string, { value: T; addedBy: string; timestamp: number }>;
  /** Tombstones for removed elements */
  tombstones: Set<string>;
}

/**
 * LWW-Register state (Last-Write-Wins Register)
 */
export interface LWWRegisterState<T> {
  /** Current value */
  value: T;
  /** Timestamp of last write */
  timestamp: number;
  /** Device that performed the write */
  deviceId: string;
}

/**
 * LWW-Map state (Last-Write-Wins Map)
 */
export interface LWWMapState<T> {
  /** Key → LWW Register mapping */
  entries: Record<string, LWWRegisterState<T>>;
}

/**
 * Selective sync rule condition
 */
export interface SelectiveRule {
  condition:
    | 'age_days_less_than'
    | 'outcome_equals'
    | 'has_user_feedback'
    | 'led_to_procedural_rule';
  value: unknown;
}

/**
 * Sync scope configuration per namespace
 */
export interface SyncScopeConfig {
  /** Whether this namespace should sync */
  shouldSync: boolean;
  /** Sync strategy */
  syncStrategy?: 'full' | 'selective' | 'archive';
  /** Rules for selective sync */
  selectiveRules?: SelectiveRule[];
}

/**
 * Encryption key derivation result
 */
export interface DerivedEncryptionKey {
  /** The derived CryptoKey */
  key: CryptoKey;
  /** Salt used for derivation (for sync payload) */
  salt: string;
  /** Purpose of the key */
  purpose: 'sync' | 'backup';
}

/**
 * Device registration information
 */
export interface DeviceRegistration {
  /** Unique device identifier */
  deviceId: string;
  /** Wallet address (user identity) */
  walletAddress: string;
  /** Platform type */
  platform: 'tauri' | 'pwa';
  /** Registration timestamp */
  timestamp: number;
  /** Signature proving ownership */
  signature: string;
}

/**
 * Signaling message for device discovery
 */
export interface SignalingMessage {
  type: 'announce' | 'offer' | 'answer' | 'ice-candidate' | 'leave';
  from: string;
  to?: string;
  payload: unknown;
  timestamp: number;
}
