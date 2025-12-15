/**
 * SyncMonitor Types - v13 Section 10.5.2
 *
 * Types for the Sync Monitor debug UI component.
 */

import type {
  SyncStatus,
  SyncEvent,
  SyncLayer,
  SyncState,
  ConnectionType,
} from '@ownyou/sync';

/**
 * Props for the main SyncMonitor component
 */
export interface SyncMonitorProps {
  /** User ID for context */
  userId: string;
  /** Device ID for this device */
  deviceId: string;
  /** Sync layer instance to monitor */
  syncLayer: SyncLayer;
  /** Optional CSS class name */
  className?: string;
  /** Maximum number of recent logs to display */
  maxLogs?: number;
}

/**
 * Connection status display data
 */
export interface ConnectionStatusData {
  /** Connection status */
  status: SyncState;
  /** Number of connected peers */
  peerCount: number;
  /** Last sync timestamp */
  lastSync: number | null;
  /** Next scheduled sync timestamp */
  nextScheduledSync?: number;
  /** Connection type */
  connectionType: ConnectionType | 'offline';
  /** Error message if any */
  error?: string;
}

/**
 * Pending operations display data
 */
export interface PendingOperationsData {
  /** Number of pending operations */
  count: number;
  /** Oldest pending operation timestamp */
  oldest: number | null;
  /** Namespaces with pending operations */
  namespacesAffected: string[];
}

/**
 * Conflict for manual resolution
 */
export interface PendingConflict {
  /** Namespace of the conflict */
  namespace: string;
  /** Key of the conflicting item */
  key: string;
  /** Preview of local value */
  localPreview: string;
  /** Preview of remote value */
  remotePreview: string;
  /** Local value timestamp */
  localTimestamp: number;
  /** Remote value timestamp */
  remoteTimestamp: number;
}

/**
 * Actions available in SyncMonitor
 */
export interface SyncMonitorActions {
  /** Force an immediate sync */
  forceSync: () => Promise<void>;
  /** Clear the offline queue */
  clearQueue: () => Promise<void>;
  /** Reconnect to peers */
  reconnect: () => Promise<void>;
  /** Resolve a conflict */
  resolveConflict: (
    conflict: PendingConflict,
    choice: 'local' | 'remote'
  ) => Promise<void>;
}

/**
 * Full view state for SyncMonitor
 */
export interface SyncMonitorView {
  /** Connection information */
  connection: ConnectionStatusData;
  /** Recent sync logs/events */
  recentLogs: SyncEvent[];
  /** Pending operations info */
  pendingOperations: PendingOperationsData;
  /** Conflicts waiting for resolution */
  pendingConflicts: PendingConflict[];
  /** Available actions */
  actions: SyncMonitorActions;
}

/**
 * Props for ConnectionStatus component
 */
export interface ConnectionStatusProps {
  data: ConnectionStatusData;
  onReconnect?: () => void;
  className?: string;
}

/**
 * Props for PendingQueue component
 */
export interface PendingQueueProps {
  data: PendingOperationsData;
  onClearQueue?: () => void;
  className?: string;
}

/**
 * Props for ConflictResolver component
 */
export interface ConflictResolverProps {
  conflicts: PendingConflict[];
  onResolve: (conflict: PendingConflict, choice: 'local' | 'remote') => void;
  className?: string;
}

/**
 * Props for SyncLogs component
 */
export interface SyncLogsProps {
  logs: SyncEvent[];
  maxItems?: number;
  className?: string;
}
