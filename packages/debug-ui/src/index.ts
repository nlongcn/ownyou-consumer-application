/**
 * @ownyou/debug-ui - Debug UI Components
 *
 * React components for the OwnYou debug panel.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 10.5
 */

// SyncMonitor - v13 Section 10.5.2
export {
  SyncMonitor,
  ConnectionStatus,
  PendingQueue,
  ConflictResolver,
  SyncLogs,
  useSyncMonitor,
  type SyncMonitorProps,
  type SyncMonitorView,
  type ConnectionStatusData,
  type ConnectionStatusProps,
  type PendingOperationsData,
  type PendingQueueProps,
  type PendingConflict,
  type ConflictResolverProps,
  type SyncLogsProps,
  type SyncMonitorActions,
} from './components/SyncMonitor/index.js';
