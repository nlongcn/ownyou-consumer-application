/**
 * Sync Layer - v13 Section 5
 *
 * Main abstraction for cross-device synchronization.
 * Coordinates OrbitDB, encryption, offline queue, and CRDT resolution.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5
 */

import type {
  SyncLayer,
  SyncLayerConfig,
  SyncStatus,
  SyncState,
  SyncEvent,
  SyncEventType,
  PeerDevice,
  OfflineQueueEntry,
  SyncConfig,
  VectorClock,
} from '../types.js';
import { DEFAULT_SYNC_CONFIG } from '../types.js';
import * as OfflineQueue from './offline-queue.js';
import type { OfflineQueueState } from './offline-queue.js';
import * as VClock from './vector-clock.js';
import { deriveEncryptionKey, deriveEncryptionPassword, encrypt, decrypt } from '../encryption/wallet-encryption.js';
import { shouldSyncNamespace, getSyncScopeConfig, shouldSyncItem } from '../config/sync-scope.js';
import { resolveConflict, createInitialState, serializeState, deserializeState } from '../crdt/conflict-resolver.js';
import type { CRDTState } from '../crdt/conflict-resolver.js';
import { createHeliaNode, type HeliaNode } from './helia-node.js';
import {
  createOrbitDBClient,
  getOrbitDBNameForNamespace,
  getOrbitDBTypeForNamespace,
  type OrbitDBClient,
  type OrbitDBDatabase,
} from './orbitdb-client.js';

/**
 * Store interface (abstracted to avoid circular dependency)
 */
interface Store {
  get(namespace: readonly string[], key: string): Promise<unknown>;
  put(namespace: readonly string[], key: string, value: unknown): Promise<void>;
  delete(namespace: readonly string[], key: string): Promise<void>;
  list(namespace: readonly string[]): Promise<Array<{ key: string; value: unknown }>>;
}

/**
 * Internal state for the sync layer
 */
interface SyncLayerState {
  initialized: boolean;
  started: boolean;
  store: Store | null;
  encryptionKey: CryptoKey | null;
  offlineQueue: OfflineQueueState;
  peers: Map<string, PeerDevice>;
  syncState: SyncState;
  lastSyncTime: number | null;
  error: string | undefined;
  eventListeners: Set<(event: SyncEvent) => void>;
  syncIntervalId: ReturnType<typeof setInterval> | null;
  deviceId: string;
  /** Helia IPFS node */
  heliaNode: HeliaNode | null;
  /** OrbitDB client */
  orbitdbClient: OrbitDBClient | null;
  /** Open OrbitDB databases by namespace */
  orbitdbDatabases: Map<string, OrbitDBDatabase>;
  /** Wallet address for identity */
  walletAddress: string | null;
}

/**
 * Generate a unique device ID
 */
function generateDeviceId(): string {
  return `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new sync layer instance
 *
 * @param config - Sync layer configuration
 * @returns Sync layer instance
 */
export function createSyncLayer(config: SyncLayerConfig): SyncLayer {
  const deviceId = generateDeviceId();
  const syncConfig: SyncConfig = {
    ...DEFAULT_SYNC_CONFIG,
    ...config.syncConfig,
  };

  const state: SyncLayerState = {
    initialized: false,
    started: false,
    store: null,
    encryptionKey: null,
    offlineQueue: OfflineQueue.createOfflineQueue(deviceId, syncConfig),
    peers: new Map(),
    syncState: 'offline',
    lastSyncTime: null,
    error: undefined,
    eventListeners: new Set(),
    syncIntervalId: null,
    deviceId,
    heliaNode: null,
    orbitdbClient: null,
    orbitdbDatabases: new Map(),
    walletAddress: null,
  };

  /**
   * Emit a sync event to all listeners
   */
  function emitEvent(type: SyncEventType, data?: Record<string, unknown>): void {
    const event: SyncEvent = {
      type,
      timestamp: Date.now(),
      deviceId: state.deviceId,
      data,
    };

    for (const listener of state.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Sync event listener error:', err);
      }
    }
  }

  /**
   * Initialize the sync layer
   */
  async function initialize(store: Store): Promise<void> {
    if (state.initialized) {
      throw new Error('Sync layer already initialized');
    }

    state.store = store;

    // Get wallet address for identity
    state.walletAddress = await config.walletProvider.getWalletAddress();

    // Derive encryption key from wallet
    const keyResult = await deriveEncryptionKey(config.walletProvider, 'sync');
    state.encryptionKey = keyResult.key;

    // Load persisted offline queue if exists
    try {
      const persistedQueue = await store.get(
        ['ownyou.sync.queue', state.deviceId],
        'queue'
      );
      if (persistedQueue && typeof persistedQueue === 'string') {
        state.offlineQueue = OfflineQueue.deserialize(persistedQueue);
      }
    } catch {
      // No persisted queue, use fresh one
    }

    // Derive encryption password for OrbitDB SimpleEncryption
    const encryptionPassword = await deriveEncryptionPassword(config.walletProvider, 'sync');

    // Initialize Helia and OrbitDB for peer-to-peer sync
    try {
      state.heliaNode = await createHeliaNode({
        platform: config.platform,
        enableRelay: true,
      });

      state.orbitdbClient = await createOrbitDBClient({
        heliaNode: state.heliaNode,
        walletAddress: state.walletAddress,
        encryptionPassword, // Pass wallet-derived password for E2EE
      });

      emitEvent('sync_started', {
        peerId: state.heliaNode.getPeerId(),
        multiaddrs: state.heliaNode.getMultiaddrs(),
      });
    } catch (err) {
      // OrbitDB/Helia not available - continue in offline-only mode
      console.warn('OrbitDB/Helia initialization failed, running in offline mode:', err);
    }

    state.initialized = true;
    state.syncState = 'offline';
  }

  /**
   * Start the sync layer
   */
  async function start(): Promise<void> {
    if (!state.initialized) {
      throw new Error('Sync layer not initialized. Call initialize() first.');
    }

    if (state.started) {
      return;
    }

    state.started = true;
    state.syncState = 'idle';

    // Start periodic sync
    state.syncIntervalId = setInterval(async () => {
      if (state.syncState === 'idle') {
        await performSync();
      }
    }, syncConfig.syncIntervalMs);

    // Initial sync
    await performSync();

    emitEvent('sync_started');
  }

  /**
   * Stop the sync layer
   */
  async function stop(): Promise<void> {
    if (!state.started) {
      return;
    }

    // Stop periodic sync
    if (state.syncIntervalId) {
      clearInterval(state.syncIntervalId);
      state.syncIntervalId = null;
    }

    // Persist offline queue
    if (state.store) {
      const serializedQueue = OfflineQueue.serialize(state.offlineQueue);
      await state.store.put(
        ['ownyou.sync.queue', state.deviceId],
        'queue',
        serializedQueue
      );
    }

    // Close all OrbitDB databases
    for (const db of state.orbitdbDatabases.values()) {
      try {
        await db.close();
      } catch (err) {
        console.warn('Failed to close database:', err);
      }
    }
    state.orbitdbDatabases.clear();

    // Stop OrbitDB client
    if (state.orbitdbClient) {
      try {
        await state.orbitdbClient.stop();
      } catch (err) {
        console.warn('Failed to stop OrbitDB:', err);
      }
      state.orbitdbClient = null;
    }

    // Stop Helia node
    if (state.heliaNode) {
      try {
        await state.heliaNode.stop();
      } catch (err) {
        console.warn('Failed to stop Helia:', err);
      }
      state.heliaNode = null;
    }

    state.started = false;
    state.syncState = 'offline';
  }

  /**
   * Perform synchronization
   */
  async function performSync(): Promise<void> {
    if (state.syncState === 'syncing') {
      return;
    }

    state.syncState = 'syncing';
    emitEvent('sync_started');

    try {
      // 1. Flush offline queue
      await flushOfflineQueue();

      // 2. Fetch updates from peers
      await fetchPeerUpdates();

      state.lastSyncTime = Date.now();
      state.syncState = 'idle';
      state.error = undefined;

      emitEvent('sync_completed', {
        pendingMutations: OfflineQueue.getPendingCount(state.offlineQueue),
        connectedPeers: state.peers.size,
      });
    } catch (err) {
      state.syncState = 'error';
      state.error = err instanceof Error ? err.message : 'Unknown sync error';

      emitEvent('sync_failed', { error: state.error });
    }
  }

  /**
   * Get or create an OrbitDB database for a namespace
   */
  async function getOrCreateDatabase(namespace: string): Promise<OrbitDBDatabase | null> {
    if (!state.orbitdbClient || !state.walletAddress) {
      return null;
    }

    // Check if already open
    if (state.orbitdbDatabases.has(namespace)) {
      return state.orbitdbDatabases.get(namespace)!;
    }

    // Create new database
    const dbName = getOrbitDBNameForNamespace(namespace, state.walletAddress);
    const dbType = getOrbitDBTypeForNamespace(namespace);

    const db = await state.orbitdbClient.open(dbName, { type: dbType });
    state.orbitdbDatabases.set(namespace, db);

    // Subscribe to updates from other peers
    db.onUpdate((entry) => {
      handleRemoteUpdate(namespace, entry.key, entry.value);
    });

    return db;
  }

  /**
   * Handle an update received from a remote peer via OrbitDB
   */
  async function handleRemoteUpdate(
    namespace: string,
    key: string,
    encryptedValue: unknown
  ): Promise<void> {
    if (!state.encryptionKey || !state.store) {
      return;
    }

    try {
      // Decrypt the value
      const encrypted = encryptedValue as Uint8Array;
      const decrypted = await decrypt(encrypted, state.encryptionKey);
      const json = new TextDecoder().decode(decrypted);
      const remoteData = JSON.parse(json);

      // Resolve conflicts using CRDT
      const localData = await state.store.get([namespace, state.deviceId], key);

      if (localData) {
        // Both have data - resolve conflict
        const localState = createInitialState(namespace, localData, state.deviceId);
        const remoteState = createInitialState(namespace, remoteData.value, remoteData.deviceId);

        const resolution = resolveConflict(namespace, localState, remoteState);

        if (resolution.hadConflict) {
          emitEvent('conflict_resolved', {
            namespace,
            key,
            winningDeviceId: resolution.winningDeviceId,
          });
        }

        // Store merged result
        await state.store.put([namespace], key, resolution.mergedState);
      } else {
        // Only remote has data - just store it
        await state.store.put([namespace], key, remoteData.value);
      }

      emitEvent('sync_completed', { namespace, key });
    } catch (err) {
      console.error('Failed to handle remote update:', err);
    }
  }

  /**
   * Flush pending offline queue entries
   */
  async function flushOfflineQueue(): Promise<void> {
    const pending = OfflineQueue.getPendingEntries(state.offlineQueue);

    if (pending.length === 0) {
      return;
    }

    const syncedIds: string[] = [];

    for (const entry of pending) {
      try {
        // Encrypt the entry
        if (!state.encryptionKey) {
          throw new Error('Encryption key not available');
        }

        const payload = {
          namespace: entry.namespace,
          key: entry.key,
          value: entry.value,
          operation: entry.operation,
          timestamp: entry.timestamp,
          vectorClock: entry.vectorClock,
          deviceId: state.deviceId,
        };

        const plaintext = new TextEncoder().encode(JSON.stringify(payload));
        const encrypted = await encrypt(plaintext, state.encryptionKey);

        // Get or create OrbitDB database for this namespace
        const db = await getOrCreateDatabase(entry.namespace);

        if (db) {
          // Send to OrbitDB - this will replicate to peers
          if (entry.operation === 'put') {
            await db.put(entry.key, encrypted);
          } else if (entry.operation === 'delete') {
            await db.del(entry.key);
          }
        }

        syncedIds.push(entry.id);
      } catch (err) {
        console.error('Failed to sync entry:', entry.id, err);
      }
    }

    if (syncedIds.length > 0) {
      state.offlineQueue = OfflineQueue.markSynced(state.offlineQueue, syncedIds);

      emitEvent('offline_flushed', {
        count: syncedIds.length,
        remaining: OfflineQueue.getPendingCount(state.offlineQueue),
      });
    }
  }

  /**
   * Fetch updates from connected peers
   */
  async function fetchPeerUpdates(): Promise<void> {
    if (!state.orbitdbClient || !state.heliaNode) {
      // No OrbitDB connection - nothing to fetch
      return;
    }

    // OrbitDB automatically syncs when connected to peers
    // Here we just ensure our databases are open for replication

    // Get all syncable namespaces and ensure databases are open
    const syncableNamespaces = await getSyncableNamespacesFromStore();

    for (const namespace of syncableNamespaces) {
      try {
        await getOrCreateDatabase(namespace);
      } catch (err) {
        console.warn(`Failed to open database for ${namespace}:`, err);
      }
    }

    // Update peer count from libp2p connections
    const connections = (state.heliaNode.libp2p as { getConnections(): unknown[] }).getConnections();

    // Update peers map
    for (const conn of connections as Array<{ remotePeer: { toString(): string } }>) {
      const peerId = conn.remotePeer.toString();
      if (!state.peers.has(peerId)) {
        state.peers.set(peerId, {
          deviceId: peerId,
          lastSeen: Date.now(),
          connectionState: 'connected',
        });
        emitEvent('peer_connected', { peerId });
      }
    }
  }

  /**
   * Get syncable namespaces from the store
   */
  async function getSyncableNamespacesFromStore(): Promise<string[]> {
    if (!state.store) {
      return [];
    }

    // Get namespaces that have data and should sync
    const namespaces: string[] = [];

    // Check known syncable namespaces
    const knownNamespaces = [
      'ownyou.semantic',
      'ownyou.episodic',
      'ownyou.entities',
      'ownyou.iab',
      'ownyou.missions',
      'ownyou.earnings',
    ];

    for (const ns of knownNamespaces) {
      if (shouldSyncNamespace(ns)) {
        try {
          const entries = await state.store.list([ns]);
          if (entries.length > 0) {
            namespaces.push(ns);
          }
        } catch {
          // Namespace doesn't exist yet
        }
      }
    }

    return namespaces;
  }

  /**
   * Queue a local mutation for sync
   */
  async function queueMutation(
    namespace: string,
    key: string,
    value: unknown,
    operation: 'put' | 'delete'
  ): Promise<void> {
    // Check if namespace should sync
    if (!shouldSyncNamespace(namespace)) {
      return;
    }

    // Check selective sync rules
    const scopeConfig = getSyncScopeConfig(namespace);
    if (
      scopeConfig.syncStrategy === 'selective' &&
      scopeConfig.selectiveRules &&
      typeof value === 'object' &&
      value !== null
    ) {
      if (!shouldSyncItem(value as Record<string, unknown>, scopeConfig.selectiveRules)) {
        return;
      }
    }

    // Add to offline queue
    if (operation === 'put') {
      const result = OfflineQueue.enqueuePut(state.offlineQueue, namespace, key, value);
      if (result) {
        state.offlineQueue = result;
      }
    } else {
      const result = OfflineQueue.enqueueDelete(state.offlineQueue, namespace, key);
      if (result) {
        state.offlineQueue = result;
      }
    }

    emitEvent('offline_queued', { namespace, key, operation });
  }

  /**
   * Handle incoming sync data from a peer
   */
  async function handleIncomingData(
    peerId: string,
    encryptedData: Uint8Array,
    namespace: string
  ): Promise<void> {
    if (!state.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    // Decrypt
    const decrypted = await decrypt(encryptedData, state.encryptionKey);
    const json = new TextDecoder().decode(decrypted);
    const remoteData = JSON.parse(json);

    // Resolve conflicts using CRDT
    if (state.store) {
      const localData = await state.store.get(
        [namespace, state.deviceId],
        remoteData.key
      );

      if (localData) {
        // Both have data - resolve conflict
        const localState = createInitialState(namespace, localData, state.deviceId);
        const remoteState = createInitialState(namespace, remoteData.value, peerId);

        const resolution = resolveConflict(namespace, localState, remoteState);

        if (resolution.hadConflict) {
          emitEvent('conflict_resolved', {
            namespace,
            key: remoteData.key,
            winningDeviceId: resolution.winningDeviceId,
          });
        }

        // Store merged result
        // await state.store.put([namespace, state.deviceId], remoteData.key, resolution.mergedState);
      } else {
        // Only remote has data - just store it
        // await state.store.put([namespace, state.deviceId], remoteData.key, remoteData.value);
      }
    }
  }

  /**
   * Get current sync status
   */
  function getStatus(): SyncStatus {
    return {
      isOnline: state.syncState !== 'offline',
      lastSyncTime: state.lastSyncTime,
      pendingMutations: OfflineQueue.getPendingCount(state.offlineQueue),
      connectedPeers: state.peers.size,
      syncState: state.syncState,
      error: state.error,
    };
  }

  /**
   * Force immediate sync
   */
  async function forceSync(): Promise<void> {
    await performSync();
  }

  /**
   * Get connected peers
   */
  function getPeers(): PeerDevice[] {
    return Array.from(state.peers.values());
  }

  /**
   * Subscribe to sync events
   */
  function onSyncEvent(callback: (event: SyncEvent) => void): () => void {
    state.eventListeners.add(callback);
    return () => {
      state.eventListeners.delete(callback);
    };
  }

  /**
   * Add a peer (internal use)
   */
  function addPeer(peer: PeerDevice): void {
    state.peers.set(peer.deviceId, peer);
    emitEvent('peer_connected', { peerId: peer.deviceId });
  }

  /**
   * Remove a peer (internal use)
   */
  function removePeer(deviceId: string): void {
    if (state.peers.has(deviceId)) {
      state.peers.delete(deviceId);
      emitEvent('peer_disconnected', { peerId: deviceId });
    }
  }

  return {
    initialize,
    start,
    stop,
    getStatus,
    forceSync,
    getPeers,
    onSyncEvent,
  };
}

/**
 * Create a sync layer with default configuration (for testing)
 */
export function createTestSyncLayer(
  walletSeed: string,
  platform: 'tauri' | 'pwa' = 'pwa'
): SyncLayer {
  // Import mock wallet provider
  const { createMockWalletProvider } = require('../encryption/wallet-encryption.js');

  return createSyncLayer({
    platform,
    walletProvider: createMockWalletProvider(walletSeed),
    signalingServer: 'wss://signal.test.ownyou.app',
    stunServers: ['stun:stun.l.google.com:19302'],
    encryptionMode: 'custom-aes-gcm',
  });
}
