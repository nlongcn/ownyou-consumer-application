/**
 * SyncMonitor Component - v13 Section 10.5.2
 *
 * Main debug UI component for monitoring sync status.
 * Connects to the real sync layer via useSyncMonitor hook.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 10.5.2
 */

import { useSyncMonitor } from './useSyncMonitor.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { PendingQueue } from './PendingQueue.js';
import { ConflictResolver } from './ConflictResolver.js';
import { SyncLogs } from './SyncLogs.js';
import type { SyncMonitorProps } from './types.js';

/**
 * SyncMonitor component
 *
 * Provides a debug view of the sync layer status including:
 * - Connection status (online/offline, peer count, last sync)
 * - Pending operations in offline queue
 * - Conflicts waiting for manual resolution
 * - Recent sync activity logs
 *
 * @example
 * ```tsx
 * import { SyncMonitor } from '@ownyou/debug-ui';
 *
 * function DebugPanel({ syncLayer }) {
 *   return (
 *     <SyncMonitor
 *       userId="user_123"
 *       deviceId="device_abc"
 *       syncLayer={syncLayer}
 *     />
 *   );
 * }
 * ```
 */
export function SyncMonitor({
  userId,
  deviceId,
  syncLayer,
  className = '',
  maxLogs = 50,
}: SyncMonitorProps): JSX.Element {
  const view = useSyncMonitor({
    syncLayer,
    deviceId,
    maxLogs,
  });

  return (
    <div className={`sync-monitor ${className}`}>
      <div className="sync-monitor-header">
        <h2>Sync Monitor</h2>
        <div className="user-info">
          <span>User: {userId.slice(0, 8)}...</span>
          <span>Device: {deviceId.slice(0, 8)}...</span>
        </div>
        <button
          className="force-sync-button"
          onClick={view.actions.forceSync}
          disabled={view.connection.status === 'syncing'}
        >
          {view.connection.status === 'syncing' ? 'Syncing...' : 'Force Sync'}
        </button>
      </div>

      <div className="sync-monitor-grid">
        <ConnectionStatus
          data={view.connection}
          onReconnect={view.actions.reconnect}
          className="grid-item"
        />

        <PendingQueue
          data={view.pendingOperations}
          onClearQueue={view.actions.clearQueue}
          className="grid-item"
        />

        <ConflictResolver
          conflicts={view.pendingConflicts}
          onResolve={view.actions.resolveConflict}
          className="grid-item full-width"
        />

        <SyncLogs
          logs={view.recentLogs}
          maxItems={20}
          className="grid-item full-width"
        />
      </div>
    </div>
  );
}
