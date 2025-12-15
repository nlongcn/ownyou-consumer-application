/**
 * Debug UI Types - v13 Section 10.5
 *
 * Shared types for debug UI components.
 */

/**
 * Filter options for Agent Inspector
 */
export interface TraceFilterOptions {
  agentType?: string;
  status?: 'success' | 'error' | 'cancelled';
  dateRange?: [number, number];
  minDurationMs?: number;
  minCostUsd?: number;
}

/**
 * Export category for GDPR export
 */
export type ExportCategory =
  | 'memories'
  | 'profile'
  | 'missions'
  | 'preferences'
  | 'earnings'
  | 'consents'
  | 'agent_traces'
  | 'sync_logs'
  | 'llm_usage';

/**
 * Connection status for sync
 */
export type ConnectionStatusType = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error';

/**
 * Conflict for manual resolution
 */
export interface Conflict {
  id: string;
  namespace: string;
  key: string;
  localValue: unknown;
  remoteValue: unknown;
  localTimestamp: number;
  remoteTimestamp: number;
}
