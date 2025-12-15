/**
 * useSyncMonitor Hook
 *
 * React hook for connecting to the sync layer and providing
 * real-time sync status updates to the SyncMonitor component.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SyncLayer, SyncEvent, SyncStatus } from '@ownyou/sync';
import type {
  SyncMonitorView,
  ConnectionStatusData,
  PendingOperationsData,
  PendingConflict,
} from './types.js';

/**
 * Default maximum number of logs to keep
 */
const DEFAULT_MAX_LOGS = 50;

/**
 * Hook options
 */
export interface UseSyncMonitorOptions {
  /** Sync layer instance to monitor */
  syncLayer: SyncLayer;
  /** Device ID for this device */
  deviceId: string;
  /** Maximum number of logs to keep */
  maxLogs?: number;
  /** Polling interval in ms for status updates */
  pollInterval?: number;
}

/**
 * Hook to connect SyncMonitor UI to real sync layer data
 *
 * @param options - Hook options
 * @returns SyncMonitorView with real-time data
 */
export function useSyncMonitor(options: UseSyncMonitorOptions): SyncMonitorView {
  const { syncLayer, deviceId, maxLogs = DEFAULT_MAX_LOGS, pollInterval = 1000 } = options;

  // State
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [logs, setLogs] = useState<SyncEvent[]>([]);
  const [conflicts, setConflicts] = useState<PendingConflict[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to sync events
  useEffect(() => {
    // Subscribe to events
    unsubscribeRef.current = syncLayer.subscribe((event: SyncEvent) => {
      setLogs((prev) => {
        const newLogs = [event, ...prev];
        return newLogs.slice(0, maxLogs);
      });
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [syncLayer, maxLogs]);

  // Poll for status updates
  useEffect(() => {
    const updateStatus = () => {
      const currentStatus = syncLayer.getStatus();
      setStatus(currentStatus);
    };

    // Initial status
    updateStatus();

    // Poll for updates
    const intervalId = setInterval(updateStatus, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [syncLayer, pollInterval]);

  // Actions
  const forceSync = useCallback(async () => {
    await syncLayer.sync();
  }, [syncLayer]);

  const clearQueue = useCallback(async () => {
    // The sync layer may not expose this directly
    // For now, we'll just trigger a sync to flush the queue
    await syncLayer.sync();
  }, [syncLayer]);

  const reconnect = useCallback(async () => {
    // Stop and restart the sync layer
    await syncLayer.stop();
    await syncLayer.start();
  }, [syncLayer]);

  const resolveConflict = useCallback(
    async (conflict: PendingConflict, choice: 'local' | 'remote') => {
      // Remove from pending conflicts
      setConflicts((prev) => prev.filter((c) => c.key !== conflict.key));

      // In a real implementation, this would call the sync layer
      // to resolve the conflict with the chosen value
      console.log(`Resolved conflict for ${conflict.key} with choice: ${choice}`);
    },
    []
  );

  // Build the view data
  const connection: ConnectionStatusData = {
    status: status?.syncState ?? 'idle',
    peerCount: status?.connectedPeers ?? 0,
    lastSync: status?.lastSyncTime ?? null,
    connectionType: status?.isOnline ? 'direct_p2p' : 'offline',
    error: status?.error,
  };

  const pendingOperations: PendingOperationsData = {
    count: status?.pendingMutations ?? 0,
    oldest: null, // Would need to track this in the offline queue
    namespacesAffected: [], // Would need to extract from offline queue
  };

  return {
    connection,
    recentLogs: logs,
    pendingOperations,
    pendingConflicts: conflicts,
    actions: {
      forceSync,
      clearQueue,
      reconnect,
      resolveConflict,
    },
  };
}
