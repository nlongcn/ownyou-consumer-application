/**
 * PendingQueue Component
 *
 * Displays pending sync operations in the offline queue.
 */

import type { PendingQueueProps } from './types.js';

/**
 * Format a timestamp for display
 */
function formatTime(timestamp: number | null): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * PendingQueue component
 */
export function PendingQueue({
  data,
  onClearQueue,
  className = '',
}: PendingQueueProps): JSX.Element {
  const { count, oldest, namespacesAffected } = data;

  const hasItems = count > 0;

  return (
    <div className={`pending-queue ${className}`}>
      <h3>Pending Operations</h3>

      <div className="queue-summary">
        <div className="queue-count">
          <span className="count-number">{count}</span>
          <span className="count-label">pending</span>
        </div>

        {hasItems && (
          <div className="queue-details">
            <div className="detail-item">
              <span className="label">Oldest:</span>
              <span className="value">{formatTime(oldest)}</span>
            </div>

            {namespacesAffected.length > 0 && (
              <div className="detail-item">
                <span className="label">Namespaces:</span>
                <span className="value">{namespacesAffected.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {hasItems && onClearQueue && (
        <button className="clear-queue-button" onClick={onClearQueue}>
          Clear Queue
        </button>
      )}

      {!hasItems && (
        <div className="empty-message">No pending operations</div>
      )}
    </div>
  );
}
