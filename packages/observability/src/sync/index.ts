/**
 * Sync Module - v13 Section 10.3
 *
 * Exports sync debugging utilities.
 */

export { SyncLogger, CONFLICT_NOTIFICATION_RULES } from './sync-logger';

export type {
  SyncLog,
  SyncEventType,
  SyncDirection,
  ConnectionType,
  ConflictResolution,
  ConflictNotificationLevel,
  SyncDetails,
  ConflictDetails,
  ConnectionDetails,
  ErrorDetails,
  SyncStats,
  SyncLogQueryOptions,
} from './types';
