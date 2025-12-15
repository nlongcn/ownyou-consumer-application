/**
 * ConnectionStatus Component
 *
 * Displays the current sync connection status.
 */

import type { ConnectionStatusProps } from './types.js';

/**
 * Format a timestamp for display
 */
function formatTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Get status color class
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'syncing':
      return 'status-syncing';
    case 'idle':
      return 'status-idle';
    case 'error':
      return 'status-error';
    case 'initializing':
      return 'status-initializing';
    default:
      return 'status-unknown';
  }
}

/**
 * ConnectionStatus component
 */
export function ConnectionStatus({
  data,
  onReconnect,
  className = '',
}: ConnectionStatusProps): JSX.Element {
  const { status, peerCount, lastSync, connectionType, error } = data;

  return (
    <div className={`connection-status ${className}`}>
      <h3>Connection Status</h3>

      <div className="status-grid">
        <div className="status-item">
          <span className="label">Status:</span>
          <span className={`value ${getStatusColor(status)}`}>{status}</span>
        </div>

        <div className="status-item">
          <span className="label">Peers:</span>
          <span className="value">{peerCount}</span>
        </div>

        <div className="status-item">
          <span className="label">Connection:</span>
          <span className="value">{connectionType}</span>
        </div>

        <div className="status-item">
          <span className="label">Last Sync:</span>
          <span className="value">{formatTime(lastSync)}</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      {onReconnect && (
        <button
          className="reconnect-button"
          onClick={onReconnect}
          disabled={status === 'syncing'}
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
