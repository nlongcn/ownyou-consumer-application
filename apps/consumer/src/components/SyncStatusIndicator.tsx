/**
 * SyncStatusIndicator - Floating sync status indicator
 * Sprint 11b Bugfix 14: Add sync status display
 *
 * Shows sync status in a floating pill at bottom right:
 * - Syncing: blue with spinner
 * - Error: red with message
 * - Pending: yellow with count
 * - Offline: gray indicator
 */

import { useSync } from '../contexts/SyncContext';

/**
 * Format relative time for display
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function SyncStatusIndicator() {
  const { status, pendingChanges, error } = useSync();

  // Don't show anything when idle with no pending changes
  if (status === 'idle' && pendingChanges === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-20 right-4 z-50 md:bottom-4"
      data-testid="sync-status-indicator"
    >
      {/* Syncing state */}
      {status === 'syncing' && (
        <div className="flex items-center gap-2 bg-blue-100 px-3 py-2 rounded-full shadow-md animate-pulse">
          <svg
            className="w-4 h-4 animate-spin text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm text-blue-700 font-medium">Syncing...</span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex items-center gap-2 bg-red-100 px-3 py-2 rounded-full shadow-md">
          <svg
            className="w-4 h-4 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-red-700 font-medium">
            {error || 'Sync failed'}
          </span>
        </div>
      )}

      {/* Offline state */}
      {status === 'offline' && (
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-full shadow-md">
          <svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          <span className="text-sm text-gray-700 font-medium">Offline</span>
        </div>
      )}

      {/* Pending changes (when idle) */}
      {status === 'idle' && pendingChanges > 0 && (
        <div className="flex items-center gap-2 bg-yellow-100 px-3 py-2 rounded-full shadow-md">
          <svg
            className="w-4 h-4 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-yellow-700 font-medium">
            {pendingChanges} pending
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Detailed sync status for Settings page
 */
export function SyncStatusDetails() {
  const { status, lastSynced, pendingChanges, connectedDevices, error, sync } = useSync();

  return (
    <div className="space-y-3" data-testid="sync-status-details">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Status</span>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === 'syncing'
                ? 'bg-blue-500 animate-pulse'
                : status === 'error'
                ? 'bg-red-500'
                : status === 'offline'
                ? 'bg-gray-400'
                : 'bg-green-500'
            }`}
          />
          <span className="text-sm font-medium capitalize">{status}</span>
        </div>
      </div>

      {/* Last synced row */}
      {lastSynced && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Last synced</span>
          <span className="text-sm font-medium">
            {formatRelativeTime(lastSynced)}
          </span>
        </div>
      )}

      {/* Connected devices */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Connected devices</span>
        <span className="text-sm font-medium">{connectedDevices}</span>
      </div>

      {/* Pending changes */}
      {pendingChanges > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Pending changes</span>
          <span className="text-sm font-medium text-yellow-600">
            {pendingChanges}
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-2 bg-red-50 rounded text-sm text-red-600">{error}</div>
      )}

      {/* Sync now button */}
      <button
        onClick={() => sync()}
        disabled={status === 'syncing' || status === 'offline'}
        className="w-full py-2 bg-ownyou-secondary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'syncing' ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
}
