/**
 * ConflictResolver Component
 *
 * UI for manually resolving sync conflicts.
 */

import type { ConflictResolverProps, PendingConflict } from './types.js';

/**
 * Format a timestamp for display
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Truncate a string for preview
 */
function truncate(str: string, maxLen: number = 50): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Single conflict card component
 */
function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: PendingConflict;
  onResolve: (choice: 'local' | 'remote') => void;
}): JSX.Element {
  return (
    <div className="conflict-card">
      <div className="conflict-header">
        <span className="conflict-key">{conflict.key}</span>
        <span className="conflict-namespace">{conflict.namespace}</span>
      </div>

      <div className="conflict-comparison">
        <div className="conflict-side local">
          <h4>Local</h4>
          <div className="value-preview">{truncate(conflict.localPreview)}</div>
          <div className="timestamp">{formatTime(conflict.localTimestamp)}</div>
          <button
            className="resolve-button local"
            onClick={() => onResolve('local')}
          >
            Keep Local
          </button>
        </div>

        <div className="conflict-divider">vs</div>

        <div className="conflict-side remote">
          <h4>Remote</h4>
          <div className="value-preview">{truncate(conflict.remotePreview)}</div>
          <div className="timestamp">{formatTime(conflict.remoteTimestamp)}</div>
          <button
            className="resolve-button remote"
            onClick={() => onResolve('remote')}
          >
            Keep Remote
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ConflictResolver component
 */
export function ConflictResolver({
  conflicts,
  onResolve,
  className = '',
}: ConflictResolverProps): JSX.Element {
  const hasConflicts = conflicts.length > 0;

  return (
    <div className={`conflict-resolver ${className}`}>
      <h3>Conflicts</h3>

      {hasConflicts ? (
        <div className="conflicts-list">
          {conflicts.map((conflict) => (
            <ConflictCard
              key={`${conflict.namespace}:${conflict.key}`}
              conflict={conflict}
              onResolve={(choice) => onResolve(conflict, choice)}
            />
          ))}
        </div>
      ) : (
        <div className="no-conflicts">No conflicts to resolve</div>
      )}
    </div>
  );
}
