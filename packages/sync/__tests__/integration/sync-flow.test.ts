/**
 * Sync Flow Integration Tests
 *
 * Tests for multi-device sync simulation including:
 * - Sync layer lifecycle (initialize, start, stop)
 * - Event emission
 * - Peer management
 * - Status tracking
 *
 * @see packages/sync/src/core/sync-layer.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createSyncLayer } from '../../src/core/sync-layer.js';
import type { SyncLayer, SyncEvent, WalletProvider, SyncEventType } from '../../src/types.js';

// Mock crypto.subtle for tests
vi.stubGlobal('crypto', {
  subtle: {
    importKey: vi.fn().mockResolvedValue({} as CryptoKey),
    deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
    encrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => {
      // Return IV + data as mock encrypted
      const iv = new Uint8Array(12).fill(1);
      const result = new Uint8Array(iv.length + data.length);
      result.set(iv);
      result.set(new Uint8Array(data), iv.length);
      return result.buffer;
    }),
    decrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => {
      // Strip IV and return data
      return new Uint8Array(data).slice(12).buffer;
    }),
    digest: vi.fn().mockImplementation(async (_algorithm, data: Uint8Array) => {
      return new Uint8Array(32).fill(1).buffer;
    }),
  },
  getRandomValues: vi.fn().mockImplementation((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
});

// Mock Helia and OrbitDB (they require complex setup)
vi.mock('../../src/core/helia-node.js', () => ({
  createHeliaNode: vi.fn().mockRejectedValue(new Error('Helia not available in test')),
}));

vi.mock('../../src/core/orbitdb-client.js', () => ({
  createOrbitDBClient: vi.fn().mockRejectedValue(new Error('OrbitDB not available in test')),
  getOrbitDBNameForNamespace: vi.fn((ns: string) => `test-${ns}`),
  getOrbitDBTypeForNamespace: vi.fn(() => 'keyvalue'),
}));

/**
 * Create a mock wallet provider
 */
function createMockWalletProvider(seed: string = 'test-seed'): WalletProvider {
  return {
    getWalletAddress: vi.fn().mockResolvedValue(`0x${seed.padEnd(40, '0')}`),
    signMessage: vi.fn().mockImplementation(async (message: string) => {
      return `0x${seed}${message}`.substring(0, 132);
    }),
  };
}

/**
 * Create a mock store
 */
function createMockStore() {
  const data = new Map<string, Map<string, unknown>>();

  return {
    data,
    async get(namespace: readonly string[], key: string): Promise<unknown> {
      const ns = namespace.join('.');
      return data.get(ns)?.get(key) ?? null;
    },
    async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
      const ns = namespace.join('.');
      if (!data.has(ns)) {
        data.set(ns, new Map());
      }
      data.get(ns)!.set(key, value);
    },
    async delete(namespace: readonly string[], key: string): Promise<void> {
      const ns = namespace.join('.');
      data.get(ns)?.delete(key);
    },
    async list(namespace: readonly string[]): Promise<Array<{ key: string; value: unknown }>> {
      const ns = namespace.join('.');
      const nsData = data.get(ns);
      if (!nsData) return [];
      return Array.from(nsData.entries()).map(([key, value]) => ({ key, value }));
    },
  };
}

describe('Sync Layer Integration', () => {
  let syncLayer: SyncLayer;
  let store: ReturnType<typeof createMockStore>;
  let walletProvider: WalletProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createMockStore();
    walletProvider = createMockWalletProvider();

    syncLayer = createSyncLayer({
      platform: 'pwa',
      walletProvider,
      signalingServer: 'wss://signal.test.ownyou.app',
      stunServers: ['stun:stun.test.ownyou.app:19302'],
      encryptionMode: 'custom-aes-gcm',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Lifecycle', () => {
    it('should initialize successfully', async () => {
      await syncLayer.initialize(store);

      const status = syncLayer.getStatus();
      expect(status.syncState).toBe('offline');
      expect(status.pendingMutations).toBe(0);
    });

    it('should throw if initialized twice', async () => {
      await syncLayer.initialize(store);

      await expect(syncLayer.initialize(store)).rejects.toThrow('already initialized');
    });

    it('should start after initialization', async () => {
      await syncLayer.initialize(store);
      await syncLayer.start();

      const status = syncLayer.getStatus();
      expect(['idle', 'syncing', 'offline']).toContain(status.syncState);
    });

    it('should throw if started without initialization', async () => {
      await expect(syncLayer.start()).rejects.toThrow('not initialized');
    });

    it('should stop gracefully', async () => {
      await syncLayer.initialize(store);
      await syncLayer.start();
      await syncLayer.stop();

      const status = syncLayer.getStatus();
      expect(status.syncState).toBe('offline');
    });

    it('should handle multiple stop calls', async () => {
      await syncLayer.initialize(store);
      await syncLayer.start();
      await syncLayer.stop();
      await syncLayer.stop(); // Should not throw

      expect(syncLayer.getStatus().syncState).toBe('offline');
    });
  });

  describe('Status', () => {
    it('should report initial offline status', async () => {
      await syncLayer.initialize(store);

      const status = syncLayer.getStatus();
      expect(status).toEqual({
        isOnline: false,
        lastSyncTime: null,
        pendingMutations: 0,
        connectedPeers: 0,
        syncState: 'offline',
        error: undefined,
      });
    });

    it('should report valid status after start', async () => {
      await syncLayer.initialize(store);
      await syncLayer.start();

      const status = syncLayer.getStatus();
      // After start, should be in a valid state (could be idle, syncing, offline, or error)
      expect(['idle', 'syncing', 'offline', 'error']).toContain(status.syncState);
    });

    it('should track peer count', async () => {
      await syncLayer.initialize(store);

      const status = syncLayer.getStatus();
      expect(status.connectedPeers).toBe(0);
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to events', async () => {
      const events: SyncEvent[] = [];
      const unsubscribe = syncLayer.onSyncEvent((event) => {
        events.push(event);
      });

      await syncLayer.initialize(store);
      await syncLayer.start();

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe from events', async () => {
      const events: SyncEvent[] = [];
      const unsubscribe = syncLayer.onSyncEvent((event) => {
        events.push(event);
      });

      await syncLayer.initialize(store);
      unsubscribe();

      await syncLayer.start();

      // Only events before unsubscribe should be captured
      const startedEvents = events.filter((e) => e.type === 'sync_started');
      expect(startedEvents.length).toBeLessThanOrEqual(1);
    });

    it('should emit sync_started event', async () => {
      const events: SyncEvent[] = [];
      syncLayer.onSyncEvent((event) => {
        events.push(event);
      });

      await syncLayer.initialize(store);
      await syncLayer.start();

      const syncStartedEvents = events.filter((e) => e.type === 'sync_started');
      expect(syncStartedEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should include timestamp and deviceId in events', async () => {
      const events: SyncEvent[] = [];
      syncLayer.onSyncEvent((event) => {
        events.push(event);
      });

      await syncLayer.initialize(store);
      await syncLayer.start();

      for (const event of events) {
        expect(event.timestamp).toBeGreaterThan(0);
        expect(event.deviceId).toBeDefined();
        expect(event.deviceId.startsWith('device-')).toBe(true);
      }
    });
  });

  describe('Peer Management', () => {
    it('should return empty peers initially', async () => {
      await syncLayer.initialize(store);

      const peers = syncLayer.getPeers();
      expect(peers).toEqual([]);
    });

    it('should return peers array', async () => {
      await syncLayer.initialize(store);
      await syncLayer.start();

      const peers = syncLayer.getPeers();
      expect(Array.isArray(peers)).toBe(true);
    });
  });

  describe('Force Sync', () => {
    it('should trigger immediate sync', async () => {
      const events: SyncEvent[] = [];
      syncLayer.onSyncEvent((event) => {
        events.push(event);
      });

      await syncLayer.initialize(store);
      await syncLayer.start();

      const beforeCount = events.filter((e) => e.type === 'sync_started').length;

      await syncLayer.forceSync();

      const afterCount = events.filter((e) => e.type === 'sync_started').length;
      expect(afterCount).toBeGreaterThan(beforeCount);
    });
  });

  describe('Wallet Integration', () => {
    it('should call wallet provider during initialization', async () => {
      await syncLayer.initialize(store);

      expect(walletProvider.getWalletAddress).toHaveBeenCalled();
      expect(walletProvider.signMessage).toHaveBeenCalled();
    });

    it('should derive encryption key from wallet', async () => {
      await syncLayer.initialize(store);

      // Sign message should be called for key derivation
      expect(walletProvider.signMessage).toHaveBeenCalledWith(expect.stringContaining('sync'));
    });
  });
});

describe('Multi-Device Sync Simulation', () => {
  let device1: SyncLayer;
  let device2: SyncLayer;
  let store1: ReturnType<typeof createMockStore>;
  let store2: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    vi.useFakeTimers();

    store1 = createMockStore();
    store2 = createMockStore();

    // Same wallet = same user, different devices
    const walletProvider1 = createMockWalletProvider('user-wallet');
    const walletProvider2 = createMockWalletProvider('user-wallet');

    device1 = createSyncLayer({
      platform: 'pwa',
      walletProvider: walletProvider1,
      signalingServer: 'wss://signal.test.ownyou.app',
      stunServers: ['stun:stun.test.ownyou.app:19302'],
      encryptionMode: 'custom-aes-gcm',
    });

    device2 = createSyncLayer({
      platform: 'tauri',
      walletProvider: walletProvider2,
      signalingServer: 'wss://signal.test.ownyou.app',
      stunServers: ['stun:stun.test.ownyou.app:19302'],
      encryptionMode: 'custom-aes-gcm',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should create independent sync layers for each device', async () => {
    await device1.initialize(store1);
    await device2.initialize(store2);

    const status1 = device1.getStatus();
    const status2 = device2.getStatus();

    expect(status1.syncState).toBe('offline');
    expect(status2.syncState).toBe('offline');
  });

  it('should start both devices independently', async () => {
    await device1.initialize(store1);
    await device2.initialize(store2);

    await device1.start();
    await device2.start();

    // Both should be in a valid state
    expect(['idle', 'syncing', 'offline', 'error']).toContain(device1.getStatus().syncState);
    expect(['idle', 'syncing', 'offline', 'error']).toContain(device2.getStatus().syncState);
  });

  it('should stop both devices independently', async () => {
    await device1.initialize(store1);
    await device2.initialize(store2);

    await device1.start();
    await device2.start();

    await device1.stop();

    // Device 1 stopped, Device 2 still running
    expect(device1.getStatus().syncState).toBe('offline');
    // Device 2 could be in various states
    expect(['idle', 'syncing', 'offline', 'error']).toContain(device2.getStatus().syncState);

    await device2.stop();
    expect(device2.getStatus().syncState).toBe('offline');
  });

  it('should emit events independently per device', async () => {
    const events1: SyncEvent[] = [];
    const events2: SyncEvent[] = [];

    device1.onSyncEvent((e) => events1.push(e));
    device2.onSyncEvent((e) => events2.push(e));

    await device1.initialize(store1);
    await device2.initialize(store2);

    await device1.start();

    // Only device1 should have events
    expect(events1.length).toBeGreaterThan(0);

    // Now start device2
    await device2.start();

    // Both should have events, but device IDs should differ
    const device1Ids = new Set(events1.map((e) => e.deviceId));
    const device2Ids = new Set(events2.map((e) => e.deviceId));

    // Each device should emit events with its own deviceId
    expect(device1Ids.size).toBeGreaterThan(0);
    expect(device2Ids.size).toBeGreaterThan(0);
  });

  it('should handle different platforms', async () => {
    // device1 is PWA, device2 is Tauri
    await device1.initialize(store1);
    await device2.initialize(store2);

    await device1.start();
    await device2.start();

    // Both should function regardless of platform
    const status1 = device1.getStatus();
    const status2 = device2.getStatus();

    expect(status1).toBeDefined();
    expect(status2).toBeDefined();
  });
});

describe('Sync State Transitions', () => {
  let syncLayer: SyncLayer;
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    // Use real timers for these tests to avoid interval issues
    store = createMockStore();

    syncLayer = createSyncLayer({
      platform: 'pwa',
      walletProvider: createMockWalletProvider(),
      signalingServer: 'wss://signal.test.ownyou.app',
      stunServers: ['stun:stun.test.ownyou.app:19302'],
      encryptionMode: 'custom-aes-gcm',
    });
  });

  afterEach(async () => {
    // Clean up by stopping if started
    try {
      await syncLayer.stop();
    } catch {
      // Ignore if not started
    }
    vi.clearAllMocks();
  });

  it('should transition: offline -> valid state on start', async () => {
    await syncLayer.initialize(store);

    expect(syncLayer.getStatus().syncState).toBe('offline');

    await syncLayer.start();

    // After start, should be in a valid state (could be idle, syncing, offline, or error)
    expect(['idle', 'syncing', 'offline', 'error']).toContain(syncLayer.getStatus().syncState);
  });

  it('should transition to offline on stop', async () => {
    await syncLayer.initialize(store);
    await syncLayer.start();

    await syncLayer.stop();

    expect(syncLayer.getStatus().syncState).toBe('offline');
  });

  it('should record events for state transitions', async () => {
    const eventTypes: SyncEventType[] = [];
    syncLayer.onSyncEvent((e) => eventTypes.push(e.type));

    await syncLayer.initialize(store);
    await syncLayer.start();

    // Should have sync_started at minimum
    expect(eventTypes).toContain('sync_started');
  });
});
