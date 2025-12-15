/**
 * SyncLogs Component
 *
 * Displays recent sync events/logs.
 */

import type { SyncLogsProps } from './types.js';
import type { SyncEvent } from '@ownyou/sync';

/**
 * Format a timestamp for display
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Get event type color class
 */
function getEventTypeClass(type: string): string {
  switch (type) {
    case 'sync_completed':
      return 'event-success';
    case 'sync_failed':
      return 'event-error';
    case 'sync_started':
      return 'event-info';
    case 'peer_connected':
      return 'event-success';
    case 'peer_disconnected':
      return 'event-warning';
    case 'conflict_resolved':
      return 'event-info';
    case 'offline_queued':
      return 'event-warning';
    case 'offline_flushed':
      return 'event-success';
    default:
      return 'event-default';
  }
}

/**
 * Format event type for display
 */
function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Single log entry component
 */
function LogEntry({ event }: { event: SyncEvent }): JSX.Element {
  const { type, timestamp, deviceId, data } = event;

  return (
    <div className={`log-entry ${getEventTypeClass(type)}`}>
      <span className="log-time">{formatTime(timestamp)}</span>
      <span className="log-type">{formatEventType(type)}</span>
      <span className="log-device">{deviceId.slice(0, 8)}</span>
      {data && Object.keys(data).length > 0 && (
        <span className="log-data">{JSON.stringify(data)}</span>
      )}
    </div>
  );
}

/**
 * SyncLogs component
 */
export function SyncLogs({
  logs,
  maxItems = 20,
  className = '',
}: SyncLogsProps): JSX.Element {
  const displayLogs = logs.slice(0, maxItems);
  const hasLogs = displayLogs.length > 0;

  return (
    <div className={`sync-logs ${className}`}>
      <h3>Recent Activity</h3>

      {hasLogs ? (
        <div className="logs-list">
          {displayLogs.map((event, index) => (
            <LogEntry key={`${event.timestamp}-${index}`} event={event} />
          ))}
        </div>
      ) : (
        <div className="no-logs">No recent activity</div>
      )}
    </div>
  );
}
