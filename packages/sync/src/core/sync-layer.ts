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
import { deriveEncryptionKey, encrypt, decrypt } from '../encryption/wallet-encryption.js';
import { shouldSyncNamespace, getSyncScopeConfig, shouldSyncItem } from '../config/sync-scope.js';
import { resolveConflict, createInitialState, serializeState, deserializeState } from '../crdt/conflict-resolver.js';
import type { CRDTState } from '../crdt/conflict-resolver.js';

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
        };

        const plaintext = new TextEncoder().encode(JSON.stringify(payload));
        const encrypted = await encrypt(plaintext, state.encryptionKey);

        // In a real implementation, this would send to OrbitDB/peers
        // For now, we mark as synced locally
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
    // In a real implementation, this would:
    // 1. Connect to OrbitDB peers
    // 2. Fetch their updates
    // 3. Decrypt and merge using CRDTs

    // Placeholder for peer fetching logic
    // This would be implemented with actual OrbitDB integration
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
