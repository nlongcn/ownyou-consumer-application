/**
 * SyncLogger - v13 Section 10.3
 *
 * Logs cross-device sync events for debugging.
 *
 * ## Current Implementation (Sprint 9)
 *
 * This implementation uses in-memory storage for sync logs. All logs are
 * stored in an array and will be lost on app restart.
 *
 * This is intentional for Sprint 9 as sync functionality (OrbitDB) is not
 * yet implemented. This class provides the infrastructure for Sprint 10.
 *
 * ## TODO: Sprint 10 - Store Integration
 *
 * Add LangGraph Store persistence to comply with v13 Section 10.1:
 * "All observability data stays on-device" (implies persistence)
 *
 * Required changes:
 * 1. Add Store dependency to constructor: `constructor(store: BaseStore, deviceId: string)`
 * 2. Persist logs using NS.debugSync(deviceId) namespace
 * 3. Load existing logs on initialization
 * 4. Add integration tests for Store operations
 *
 * Example:
 * ```typescript
 * constructor(store: BaseStore, deviceId: string) {
 *   this.store = store;
 *   this.deviceId = deviceId;
 * }
 *
 * async logSyncStarted(options: {...}): Promise<SyncLog> {
 *   const log = { ... };
 *   await this.store.put(NS.debugSync(this.deviceId), log.logId, log);
 *   return log;
 * }
 * ```
 */

import type {
  SyncLog,
  SyncEventType,
  SyncDetails,
  ConflictDetails,
  ConnectionDetails,
  ErrorDetails,
  SyncStats,
  SyncLogQueryOptions,
  SyncDirection,
  ConnectionType,
  ConflictResolution,
  ConflictNotificationLevel,
} from './types';

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Conflict notification rules by namespace - v13 Section 10.3
 */
export const CONFLICT_NOTIFICATION_RULES: Record<string, ConflictNotificationLevel> = {
  'ownyou.earnings': 'modal',           // Financial data - always alert user
  'ownyou.missions': 'toast',           // Mission state - inform but don't block
  'ownyou.semantic': 'silent',          // Memories - auto-resolve silently
  'ownyou.episodic': 'silent',
  'ownyou.iab': 'silent',
  'ownyou.ikigai': 'toast',             // Profile changes - user should know
  'ownyou.preferences': 'toast',
};

/**
 * SyncLogger - Records sync events for debugging
 */
export class SyncLogger {
  private logs: SyncLog[] = [];
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  /**
   * Log sync started event
   */
  logSyncStarted(options: {
    peerDeviceId?: string;
    direction: SyncDirection;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('sync'),
      deviceId: this.deviceId,
      peerDeviceId: options.peerDeviceId,
      timestamp: Date.now(),
      eventType: 'sync_started',
      details: {
        sync: {
          direction: options.direction,
          recordsSent: 0,
          recordsReceived: 0,
          bytesTransferred: 0,
          latencyMs: 0,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * Log sync completed event
   */
  logSyncCompleted(options: {
    peerDeviceId?: string;
    direction: SyncDirection;
    recordsSent: number;
    recordsReceived: number;
    bytesTransferred: number;
    latencyMs: number;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('sync'),
      deviceId: this.deviceId,
      peerDeviceId: options.peerDeviceId,
      timestamp: Date.now(),
      eventType: 'sync_completed',
      details: {
        sync: {
          direction: options.direction,
          recordsSent: options.recordsSent,
          recordsReceived: options.recordsReceived,
          bytesTransferred: options.bytesTransferred,
          latencyMs: options.latencyMs,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * Log conflict detected event
   */
  logConflictDetected(options: {
    peerDeviceId?: string;
    namespace: string;
    key: string;
    localValuePreview: string;
    remoteValuePreview: string;
    localTimestamp: number;
    remoteTimestamp: number;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('conflict'),
      deviceId: this.deviceId,
      peerDeviceId: options.peerDeviceId,
      timestamp: Date.now(),
      eventType: 'conflict_detected',
      details: {
        conflict: {
          namespace: options.namespace,
          key: options.key,
          localValuePreview: options.localValuePreview,
          remoteValuePreview: options.remoteValuePreview,
          localTimestamp: options.localTimestamp,
          remoteTimestamp: options.remoteTimestamp,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * Log conflict resolved event
   */
  logConflictResolved(options: {
    peerDeviceId?: string;
    namespace: string;
    key: string;
    localValuePreview: string;
    remoteValuePreview: string;
    localTimestamp: number;
    remoteTimestamp: number;
    resolution: ConflictResolution;
    resolutionReason: string;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('conflict'),
      deviceId: this.deviceId,
      peerDeviceId: options.peerDeviceId,
      timestamp: Date.now(),
      eventType: 'conflict_resolved',
      details: {
        conflict: {
          namespace: options.namespace,
          key: options.key,
          localValuePreview: options.localValuePreview,
          remoteValuePreview: options.remoteValuePreview,
          localTimestamp: options.localTimestamp,
          remoteTimestamp: options.remoteTimestamp,
          resolution: options.resolution,
          resolutionReason: options.resolutionReason,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * Log connection established event
   */
  logConnectionEstablished(options: {
    peerDeviceId?: string;
    peerCount: number;
    connectionType: ConnectionType;
    natType?: string;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('conn'),
      deviceId: this.deviceId,
      peerDeviceId: options.peerDeviceId,
      timestamp: Date.now(),
      eventType: 'connection_established',
      details: {
        connection: {
          peerCount: options.peerCount,
          connectionType: options.connectionType,
          natType: options.natType,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * Log connection failed event
   */
  logConnectionFailed(options: {
    peerDeviceId?: string;
    errorType: string;
    errorMessage: string;
    recoverable: boolean;
    recoveryAction?: string;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('conn'),
      deviceId: this.deviceId,
      peerDeviceId: options.peerDeviceId,
      timestamp: Date.now(),
      eventType: 'connection_failed',
      details: {
        error: {
          type: options.errorType,
          message: options.errorMessage,
          recoverable: options.recoverable,
          recoveryAction: options.recoveryAction,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * Log connection lost event
   */
  logConnectionLost(options: {
    peerDeviceId?: string;
    errorType: string;
    errorMessage: string;
    recoverable: boolean;
    recoveryAction?: string;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('conn'),
      deviceId: this.deviceId,
      peerDeviceId: options.peerDeviceId,
      timestamp: Date.now(),
      eventType: 'connection_lost',
      details: {
        error: {
          type: options.errorType,
          message: options.errorMessage,
          recoverable: options.recoverable,
          recoveryAction: options.recoveryAction,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * Log data corrupted event
   */
  logDataCorrupted(options: {
    namespace?: string;
    errorType: string;
    errorMessage: string;
    recoverable: boolean;
    recoveryAction?: string;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('err'),
      deviceId: this.deviceId,
      timestamp: Date.now(),
      eventType: 'data_corrupted',
      details: {
        error: {
          type: options.errorType,
          message: options.errorMessage,
          recoverable: options.recoverable,
          recoveryAction: options.recoveryAction,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * Log queue overflow event
   */
  logQueueOverflow(options: {
    errorType: string;
    errorMessage: string;
    recoverable: boolean;
    recoveryAction?: string;
  }): SyncLog {
    const log: SyncLog = {
      logId: generateId('err'),
      deviceId: this.deviceId,
      timestamp: Date.now(),
      eventType: 'queue_overflow',
      details: {
        error: {
          type: options.errorType,
          message: options.errorMessage,
          recoverable: options.recoverable,
          recoveryAction: options.recoveryAction,
        },
      },
    };

    this.logs.push(log);
    return log;
  }

  /**
   * List logs with filtering
   */
  listLogs(options: SyncLogQueryOptions = {}): SyncLog[] {
    let logs = [...this.logs];

    // Filter by event type
    if (options.eventType) {
      logs = logs.filter((l) => l.eventType === options.eventType);
    }

    // Filter by time range
    if (options.startTime) {
      logs = logs.filter((l) => l.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      logs = logs.filter((l) => l.timestamp <= options.endTime!);
    }

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Paginate
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    return logs.slice(offset, offset + limit);
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    const completedSyncs = this.logs.filter((l) => l.eventType === 'sync_completed');
    const failures = this.logs.filter((l) =>
      ['connection_failed', 'data_corrupted', 'queue_overflow'].includes(l.eventType)
    );

    let totalRecordsSent = 0;
    let totalRecordsReceived = 0;
    let totalBytesTransferred = 0;
    let totalLatency = 0;

    for (const log of completedSyncs) {
      if (log.details.sync) {
        totalRecordsSent += log.details.sync.recordsSent;
        totalRecordsReceived += log.details.sync.recordsReceived;
        totalBytesTransferred += log.details.sync.bytesTransferred;
        totalLatency += log.details.sync.latencyMs;
      }
    }

    return {
      totalSyncs: completedSyncs.length,
      totalRecordsSent,
      totalRecordsReceived,
      totalBytesTransferred,
      avgLatencyMs: completedSyncs.length > 0 ? totalLatency / completedSyncs.length : 0,
      failureCount: failures.length,
    };
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }
}
