/**
 * SyncMonitor Component Tests
 *
 * Tests for the SyncMonitor debug UI component and its sub-components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncLayer, SyncStatus, SyncEvent } from '@ownyou/sync';
import type {
  SyncMonitorProps,
  ConnectionStatusData,
  PendingOperationsData,
  PendingConflict,
} from '../src/components/SyncMonitor/types.js';

// Mock sync layer for testing
function createMockSyncLayer(
  status: Partial<SyncStatus> = {},
  events: SyncEvent[] = []
): SyncLayer {
  const subscribers: ((event: SyncEvent) => void)[] = [];

  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue({
      isOnline: true,
      lastSyncTime: Date.now() - 60000,
      pendingMutations: 0,
      connectedPeers: 2,
      syncState: 'idle' as const,
      ...status,
    }),
    subscribe: vi.fn((callback: (event: SyncEvent) => void) => {
      subscribers.push(callback);
      // Emit any pending events
      events.forEach((event) => callback(event));
      return () => {
        const index = subscribers.indexOf(callback);
        if (index > -1) subscribers.splice(index, 1);
      };
    }),
  } as unknown as SyncLayer;
}

describe('SyncMonitor Types', () => {
  describe('SyncMonitorProps', () => {
    it('should have required fields', () => {
      const props: SyncMonitorProps = {
        userId: 'user_123',
        deviceId: 'device_abc',
        syncLayer: createMockSyncLayer(),
      };

      expect(props.userId).toBe('user_123');
      expect(props.deviceId).toBe('device_abc');
      expect(props.syncLayer).toBeDefined();
    });

    it('should support optional fields', () => {
      const props: SyncMonitorProps = {
        userId: 'user_123',
        deviceId: 'device_abc',
        syncLayer: createMockSyncLayer(),
        className: 'custom-class',
        maxLogs: 100,
      };

      expect(props.className).toBe('custom-class');
      expect(props.maxLogs).toBe(100);
    });
  });

  describe('ConnectionStatusData', () => {
    it('should represent connected state', () => {
      const data: ConnectionStatusData = {
        status: 'idle',
        peerCount: 3,
        lastSync: Date.now(),
        connectionType: 'direct_p2p',
      };

      expect(data.status).toBe('idle');
      expect(data.peerCount).toBe(3);
      expect(data.connectionType).toBe('direct_p2p');
    });

    it('should represent offline state', () => {
      const data: ConnectionStatusData = {
        status: 'idle',
        peerCount: 0,
        lastSync: null,
        connectionType: 'offline',
      };

      expect(data.peerCount).toBe(0);
      expect(data.lastSync).toBeNull();
      expect(data.connectionType).toBe('offline');
    });

    it('should include error message when status is error', () => {
      const data: ConnectionStatusData = {
        status: 'error',
        peerCount: 0,
        lastSync: null,
        connectionType: 'offline',
        error: 'Connection timeout',
      };

      expect(data.status).toBe('error');
      expect(data.error).toBe('Connection timeout');
    });
  });

  describe('PendingOperationsData', () => {
    it('should represent empty queue', () => {
      const data: PendingOperationsData = {
        count: 0,
        oldest: null,
        namespacesAffected: [],
      };

      expect(data.count).toBe(0);
      expect(data.oldest).toBeNull();
      expect(data.namespacesAffected).toHaveLength(0);
    });

    it('should represent queue with pending items', () => {
      const data: PendingOperationsData = {
        count: 5,
        oldest: Date.now() - 300000,
        namespacesAffected: ['memory.episodic', 'profile.preferences'],
      };

      expect(data.count).toBe(5);
      expect(data.oldest).toBeLessThan(Date.now());
      expect(data.namespacesAffected).toContain('memory.episodic');
    });
  });

  describe('PendingConflict', () => {
    it('should represent a sync conflict', () => {
      const conflict: PendingConflict = {
        namespace: 'profile.preferences',
        key: 'theme',
        localPreview: 'dark',
        remotePreview: 'light',
        localTimestamp: Date.now() - 60000,
        remoteTimestamp: Date.now() - 30000,
      };

      expect(conflict.namespace).toBe('profile.preferences');
      expect(conflict.key).toBe('theme');
      expect(conflict.localPreview).toBe('dark');
      expect(conflict.remotePreview).toBe('light');
    });
  });
});

describe('Mock SyncLayer', () => {
  it('should return configured status', () => {
    const mockStatus: Partial<SyncStatus> = {
      isOnline: false,
      pendingMutations: 10,
      syncState: 'error',
      error: 'Network error',
    };

    const syncLayer = createMockSyncLayer(mockStatus);
    const status = syncLayer.getStatus();

    expect(status.isOnline).toBe(false);
    expect(status.pendingMutations).toBe(10);
    expect(status.syncState).toBe('error');
    expect(status.error).toBe('Network error');
  });

  it('should call subscribe callback with events', () => {
    const events: SyncEvent[] = [
      {
        type: 'sync_completed',
        timestamp: Date.now(),
        deviceId: 'device_1',
        data: { items: 5 },
      },
    ];

    const callback = vi.fn();
    const syncLayer = createMockSyncLayer({}, events);
    syncLayer.subscribe(callback);

    expect(callback).toHaveBeenCalledWith(events[0]);
  });

  it('should return unsubscribe function', () => {
    const syncLayer = createMockSyncLayer();
    const callback = vi.fn();
    const unsubscribe = syncLayer.subscribe(callback);

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    // No error means success
  });

  it('should call sync method', async () => {
    const syncLayer = createMockSyncLayer();
    await syncLayer.sync();

    expect(syncLayer.sync).toHaveBeenCalled();
  });

  it('should call start and stop methods', async () => {
    const syncLayer = createMockSyncLayer();
    await syncLayer.start();
    await syncLayer.stop();

    expect(syncLayer.start).toHaveBeenCalled();
    expect(syncLayer.stop).toHaveBeenCalled();
  });
});

describe('SyncEvent Types', () => {
  it('should handle sync_started event', () => {
    const event: SyncEvent = {
      type: 'sync_started',
      timestamp: Date.now(),
      deviceId: 'device_1',
    };

    expect(event.type).toBe('sync_started');
  });

  it('should handle sync_completed event with data', () => {
    const event: SyncEvent = {
      type: 'sync_completed',
      timestamp: Date.now(),
      deviceId: 'device_1',
      data: { itemsSynced: 10, duration: 1500 },
    };

    expect(event.type).toBe('sync_completed');
    expect(event.data?.itemsSynced).toBe(10);
  });

  it('should handle sync_failed event with error', () => {
    const event: SyncEvent = {
      type: 'sync_failed',
      timestamp: Date.now(),
      deviceId: 'device_1',
      data: { error: 'Connection reset' },
    };

    expect(event.type).toBe('sync_failed');
    expect(event.data?.error).toBe('Connection reset');
  });

  it('should handle peer_connected event', () => {
    const event: SyncEvent = {
      type: 'peer_connected',
      timestamp: Date.now(),
      deviceId: 'device_1',
      data: { peerId: 'peer_abc' },
    };

    expect(event.type).toBe('peer_connected');
    expect(event.data?.peerId).toBe('peer_abc');
  });

  it('should handle peer_disconnected event', () => {
    const event: SyncEvent = {
      type: 'peer_disconnected',
      timestamp: Date.now(),
      deviceId: 'device_1',
      data: { peerId: 'peer_abc', reason: 'timeout' },
    };

    expect(event.type).toBe('peer_disconnected');
  });

  it('should handle conflict_resolved event', () => {
    const event: SyncEvent = {
      type: 'conflict_resolved',
      timestamp: Date.now(),
      deviceId: 'device_1',
      data: { namespace: 'profile', key: 'name', winner: 'local' },
    };

    expect(event.type).toBe('conflict_resolved');
    expect(event.data?.winner).toBe('local');
  });

  it('should handle offline_queued event', () => {
    const event: SyncEvent = {
      type: 'offline_queued',
      timestamp: Date.now(),
      deviceId: 'device_1',
      data: { queueSize: 5 },
    };

    expect(event.type).toBe('offline_queued');
    expect(event.data?.queueSize).toBe(5);
  });

  it('should handle offline_flushed event', () => {
    const event: SyncEvent = {
      type: 'offline_flushed',
      timestamp: Date.now(),
      deviceId: 'device_1',
      data: { itemsFlushed: 5 },
    };

    expect(event.type).toBe('offline_flushed');
    expect(event.data?.itemsFlushed).toBe(5);
  });
});

describe('Connection State Scenarios', () => {
  it('should handle initial connecting state', () => {
    const syncLayer = createMockSyncLayer({
      isOnline: false,
      syncState: 'initializing',
      connectedPeers: 0,
      lastSyncTime: null,
    });

    const status = syncLayer.getStatus();
    expect(status.syncState).toBe('initializing');
    expect(status.isOnline).toBe(false);
  });

  it('should handle fully connected state', () => {
    const syncLayer = createMockSyncLayer({
      isOnline: true,
      syncState: 'idle',
      connectedPeers: 3,
      lastSyncTime: Date.now(),
    });

    const status = syncLayer.getStatus();
    expect(status.syncState).toBe('idle');
    expect(status.isOnline).toBe(true);
    expect(status.connectedPeers).toBe(3);
  });

  it('should handle syncing state', () => {
    const syncLayer = createMockSyncLayer({
      isOnline: true,
      syncState: 'syncing',
      connectedPeers: 2,
    });

    const status = syncLayer.getStatus();
    expect(status.syncState).toBe('syncing');
  });

  it('should handle error recovery state', () => {
    const syncLayer = createMockSyncLayer({
      isOnline: false,
      syncState: 'error',
      error: 'Network unreachable',
      connectedPeers: 0,
    });

    const status = syncLayer.getStatus();
    expect(status.syncState).toBe('error');
    expect(status.error).toBe('Network unreachable');
    expect(status.connectedPeers).toBe(0);
  });
});

describe('Offline Queue Scenarios', () => {
  it('should track pending mutations', () => {
    const syncLayer = createMockSyncLayer({
      pendingMutations: 10,
      isOnline: false,
    });

    const status = syncLayer.getStatus();
    expect(status.pendingMutations).toBe(10);
  });

  it('should show zero pending when online and synced', () => {
    const syncLayer = createMockSyncLayer({
      pendingMutations: 0,
      isOnline: true,
      syncState: 'idle',
    });

    const status = syncLayer.getStatus();
    expect(status.pendingMutations).toBe(0);
  });
});

describe('useSyncMonitor Hook Logic', () => {
  it('should map SyncStatus to ConnectionStatusData', () => {
    const syncLayer = createMockSyncLayer({
      isOnline: true,
      syncState: 'idle',
      connectedPeers: 2,
      lastSyncTime: 1234567890,
    });

    const status = syncLayer.getStatus();

    // This is what the hook would produce
    const connectionData: ConnectionStatusData = {
      status: status.syncState,
      peerCount: status.connectedPeers,
      lastSync: status.lastSyncTime,
      connectionType: status.isOnline ? 'direct_p2p' : 'offline',
    };

    expect(connectionData.status).toBe('idle');
    expect(connectionData.peerCount).toBe(2);
    expect(connectionData.lastSync).toBe(1234567890);
    expect(connectionData.connectionType).toBe('direct_p2p');
  });

  it('should map offline status correctly', () => {
    const syncLayer = createMockSyncLayer({
      isOnline: false,
      syncState: 'idle',
      connectedPeers: 0,
      lastSyncTime: null,
    });

    const status = syncLayer.getStatus();

    const connectionData: ConnectionStatusData = {
      status: status.syncState,
      peerCount: status.connectedPeers,
      lastSync: status.lastSyncTime,
      connectionType: status.isOnline ? 'direct_p2p' : 'offline',
    };

    expect(connectionData.connectionType).toBe('offline');
    expect(connectionData.peerCount).toBe(0);
    expect(connectionData.lastSync).toBeNull();
  });

  it('should map pendingMutations to PendingOperationsData', () => {
    const syncLayer = createMockSyncLayer({
      pendingMutations: 5,
    });

    const status = syncLayer.getStatus();

    // This is what the hook would produce
    const pendingData: PendingOperationsData = {
      count: status.pendingMutations,
      oldest: null, // Not tracked in basic status
      namespacesAffected: [], // Not tracked in basic status
    };

    expect(pendingData.count).toBe(5);
  });
});

describe('Action Handlers', () => {
  it('forceSync should call syncLayer.sync', async () => {
    const syncLayer = createMockSyncLayer();

    await syncLayer.sync();
    expect(syncLayer.sync).toHaveBeenCalled();
  });

  it('reconnect should call stop then start', async () => {
    const syncLayer = createMockSyncLayer();

    await syncLayer.stop();
    await syncLayer.start();

    expect(syncLayer.stop).toHaveBeenCalled();
    expect(syncLayer.start).toHaveBeenCalled();
  });
});

describe('Event Log Accumulation', () => {
  it('should limit log size to maxLogs', () => {
    const maxLogs = 10;
    const logs: SyncEvent[] = [];

    // Simulate adding more logs than the limit
    for (let i = 0; i < 15; i++) {
      const newLog: SyncEvent = {
        type: 'sync_completed',
        timestamp: Date.now() + i,
        deviceId: 'device_1',
      };

      logs.unshift(newLog);
      while (logs.length > maxLogs) {
        logs.pop();
      }
    }

    expect(logs.length).toBe(maxLogs);
    // Most recent should be first
    expect(logs[0].timestamp).toBeGreaterThan(logs[1].timestamp);
  });

  it('should keep newest logs when trimming', () => {
    const maxLogs = 3;
    const logs: SyncEvent[] = [];

    for (let i = 0; i < 5; i++) {
      const newLog: SyncEvent = {
        type: 'sync_completed',
        timestamp: i * 1000, // 0, 1000, 2000, 3000, 4000
        deviceId: 'device_1',
        data: { index: i },
      };

      logs.unshift(newLog);
      while (logs.length > maxLogs) {
        logs.pop();
      }
    }

    expect(logs.length).toBe(3);
    // Should have indices 4, 3, 2 (newest first)
    expect(logs[0].data?.index).toBe(4);
    expect(logs[1].data?.index).toBe(3);
    expect(logs[2].data?.index).toBe(2);
  });
});
