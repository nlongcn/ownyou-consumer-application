/**
 * Sync Types - v13 Section 10.3
 *
 * Type definitions for cross-device sync debugging.
 */

/**
 * Sync event types
 */
export type SyncEventType =
  | 'sync_started'
  | 'sync_completed'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'connection_established'
  | 'connection_failed'
  | 'connection_lost'
  | 'data_corrupted'
  | 'queue_overflow';

/**
 * Sync direction
 */
export type SyncDirection = 'push' | 'pull' | 'bidirectional';

/**
 * Connection type
 */
export type ConnectionType = 'direct_p2p' | 'relayed' | 'cloud_backup';

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = 'local_wins' | 'remote_wins' | 'merged' | 'manual';

/**
 * Notification level for conflicts
 */
export type ConflictNotificationLevel = 'silent' | 'toast' | 'modal';

/**
 * Sync details
 */
export interface SyncDetails {
  direction: SyncDirection;
  recordsSent: number;
  recordsReceived: number;
  bytesTransferred: number;
  latencyMs: number;
}

/**
 * Conflict details
 */
export interface ConflictDetails {
  namespace: string;
  key: string;
  localValuePreview: string;
  remoteValuePreview: string;
  localTimestamp: number;
  remoteTimestamp: number;
  resolution?: ConflictResolution;
  resolutionReason?: string;
}

/**
 * Connection details
 */
export interface ConnectionDetails {
  peerCount: number;
  connectionType: ConnectionType;
  natType?: string;
}

/**
 * Error details
 */
export interface ErrorDetails {
  type: string;
  message: string;
  recoverable: boolean;
  recoveryAction?: string;
}

/**
 * Sync log - v13 Section 10.3
 */
export interface SyncLog {
  logId: string;
  deviceId: string;
  peerDeviceId?: string;
  timestamp: number;
  eventType: SyncEventType;
  details: {
    sync?: SyncDetails;
    conflict?: ConflictDetails;
    connection?: ConnectionDetails;
    error?: ErrorDetails;
  };
}

/**
 * Sync statistics
 */
export interface SyncStats {
  totalSyncs: number;
  totalRecordsSent: number;
  totalRecordsReceived: number;
  totalBytesTransferred: number;
  avgLatencyMs: number;
  failureCount: number;
}

/**
 * Sync log query options
 */
export interface SyncLogQueryOptions {
  eventType?: SyncEventType;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
}
