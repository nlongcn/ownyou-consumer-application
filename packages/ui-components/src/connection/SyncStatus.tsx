/**
 * SyncStatus - Display sync status indicator
 * v13 Section 4.4 - Connection Components
 * TODO: Add detailed sync progress and conflict resolution
 */

import { cn } from '@ownyou/ui-design-system';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncStatusProps {
  /** Current sync state */
  state: SyncState;
  /** Last successful sync timestamp */
  lastSyncAt?: Date;
  /** Number of pending changes */
  pendingChanges?: number;
  /** Error message if in error state */
  errorMessage?: string;
  /** Retry sync handler */
  onRetry?: () => void;
  /** Display variant */
  variant?: 'minimal' | 'compact' | 'full';
  /** Additional CSS classes */
  className?: string;
}

const stateConfig = {
  idle: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    icon: '○',
    label: 'Ready',
  },
  syncing: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    icon: '↻',
    label: 'Syncing',
  },
  synced: {
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    icon: '✓',
    label: 'Synced',
  },
  error: {
    color: 'text-red-500',
    bgColor: 'bg-red-100',
    icon: '✕',
    label: 'Sync Error',
  },
  offline: {
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100',
    icon: '⚡',
    label: 'Offline',
  },
} as const;

/**
 * Sync status indicator with optional details
 */
export function SyncStatus({
  state,
  lastSyncAt,
  pendingChanges,
  errorMessage,
  onRetry,
  variant = 'compact',
  className,
}: SyncStatusProps) {
  const config = stateConfig[state];

  if (variant === 'minimal') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-2 h-2 rounded-full',
          config.bgColor,
        )}
        title={config.label}
      />
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn('flex items-center gap-1.5', className)}
        title={config.label}
      >
        <span
          className={cn(
            'text-sm',
            config.color,
            state === 'syncing' && 'animate-spin',
          )}
        >
          {config.icon}
        </span>
        <span className={cn('text-xs', config.color)}>
          {config.label}
        </span>
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn('p-3 rounded-lg', config.bgColor, className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-lg',
            config.color,
            state === 'syncing' && 'animate-spin',
          )}
        >
          {config.icon}
        </span>
        <div className="flex-1">
          <p className={cn('font-medium text-sm', config.color)}>
            {config.label}
          </p>
          {lastSyncAt && state !== 'syncing' && (
            <p className="text-xs text-gray-500">
              Last sync: {lastSyncAt.toLocaleTimeString()}
            </p>
          )}
          {pendingChanges !== undefined && pendingChanges > 0 && (
            <p className="text-xs text-gray-500">
              {pendingChanges} pending change{pendingChanges > 1 ? 's' : ''}
            </p>
          )}
          {errorMessage && state === 'error' && (
            <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
          )}
        </div>
        {state === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default SyncStatus;
