/**
 * Sync Monitor Components - v13 Section 10.5.2
 *
 * UI components for cross-device sync monitoring.
 * NOTE: This is a placeholder for Sprint 10 - actual sync implementation pending.
 */
import React from 'react';
import type { ConnectionStatusType, Conflict } from '../../types';

// ============================================================================
// ConnectionStatus Component
// ============================================================================

export interface ConnectionStatusProps {
  status: ConnectionStatusType;
  peerCount: number;
}

export function ConnectionStatus({
  status,
  peerCount,
}: ConnectionStatusProps): React.ReactElement {
  const getStatusIcon = (): string => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'syncing':
        return '🔄';
      case 'error':
        return '🔴';
      case 'disconnected':
      default:
        return '⚪';
    }
  };

  return (
    <div className="connection-status" data-testid="connection-status">
      <div className="status-indicator">
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{status}</span>
      </div>
      {status === 'connected' && peerCount > 0 && (
        <div className="peer-count">{peerCount} peers connected</div>
      )}
    </div>
  );
}

// ============================================================================
// PendingQueue Component
// ============================================================================

export interface PendingQueueProps {
  pendingCount: number;
  lastSyncTime: number | null;
}

export function PendingQueue({
  pendingCount,
  lastSyncTime,
}: PendingQueueProps): React.ReactElement {
  const formatTimeSince = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  };

  return (
    <div className="pending-queue" data-testid="pending-queue">
      <div className="pending-count">
        {pendingCount > 0 ? (
          <span>{pendingCount} pending operations</span>
        ) : (
          <span>No pending operations</span>
        )}
      </div>
      <div className="last-sync">
        Last sync: {formatTimeSince(lastSyncTime)}
      </div>
    </div>
  );
}

// ============================================================================
// ConflictResolver Component
// ============================================================================

export interface ConflictResolverProps {
  conflicts: Conflict[];
  onResolve: (conflictId: string, resolution: 'local' | 'remote') => void;
}

export function ConflictResolver({
  conflicts,
  onResolve,
}: ConflictResolverProps): React.ReactElement {
  return (
    <div className="conflict-resolver" data-testid="conflict-resolver">
      <h4>Conflicts</h4>
      <p className="placeholder-notice">
        Conflict resolution coming in Sprint 10
      </p>
      {conflicts.length === 0 ? (
        <p className="no-conflicts">No conflicts to resolve</p>
      ) : (
        <div className="conflict-list">
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="conflict-item">
              <div className="conflict-header">
                <span className="namespace">{conflict.namespace}</span>
                <span className="key">{conflict.key}</span>
              </div>
              <div className="conflict-options">
                <button
                  onClick={() => onResolve(conflict.id, 'local')}
                  className="resolve-local"
                >
                  Keep Local
                </button>
                <button
                  onClick={() => onResolve(conflict.id, 'remote')}
                  className="resolve-remote"
                >
                  Use Remote
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SyncMonitor Main Component
// ============================================================================

export interface SyncMonitorProps {
  userId: string;
  deviceId: string;
  className?: string;
}

export function SyncMonitor({
  userId,
  deviceId,
  className,
}: SyncMonitorProps): React.ReactElement {
  return (
    <div className={`sync-monitor ${className ?? ''}`} data-testid="sync-monitor">
      <h2>Sync Monitor</h2>
      <p className="user-id">User: {userId}</p>
      <p className="device-id">Device: {deviceId}</p>

      <div className="sync-notice">
        <span className="notice-icon">ℹ️</span>
        <span className="notice-text">
          Sync not yet enabled. Cross-device synchronization will be available in Sprint 10.
        </span>
      </div>

      <div className="sync-grid">
        <div className="status-section">
          <ConnectionStatus status="disconnected" peerCount={0} />
        </div>

        <div className="queue-section">
          <PendingQueue pendingCount={0} lastSyncTime={null} />
        </div>

        <div className="conflicts-section">
          <ConflictResolver conflicts={[]} onResolve={() => {}} />
        </div>
      </div>

      <div className="sprint-notice">
        <h4>Coming in Sprint 10</h4>
        <ul>
          <li>OrbitDB-based peer-to-peer sync</li>
          <li>Real-time connection status</li>
          <li>Conflict detection and resolution</li>
          <li>Sync queue management</li>
          <li>Device pairing</li>
        </ul>
      </div>
    </div>
  );
}

export default SyncMonitor;
