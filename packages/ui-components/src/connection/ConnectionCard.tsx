/**
 * ConnectionCard - Display data source connection status
 * v13 Section 4.4 - Connection Components
 * TODO: Add detailed connection status and reconnect actions
 */

import { cn, Card, CardContent } from '@ownyou/ui-design-system';

export type ConnectionStatus = 'connected' | 'disconnected' | 'pending' | 'error';

export interface ConnectionCardProps {
  /** Data source name (e.g., "Gmail", "Outlook") */
  sourceName: string;
  /** Data source icon URL */
  iconUrl?: string;
  /** Connection status */
  status: ConnectionStatus;
  /** Last sync timestamp */
  lastSyncAt?: Date;
  /** Number of items synced */
  itemCount?: number;
  /** Connect button handler */
  onConnect?: () => void;
  /** Disconnect button handler */
  onDisconnect?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const statusColors = {
  connected: 'bg-green-100 text-green-800',
  disconnected: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
} as const;

const statusLabels = {
  connected: 'Connected',
  disconnected: 'Not Connected',
  pending: 'Connecting...',
  error: 'Error',
} as const;

/**
 * Card showing data source connection status with actions
 */
export function ConnectionCard({
  sourceName,
  iconUrl,
  status,
  lastSyncAt,
  itemCount,
  onConnect,
  onDisconnect,
  className,
}: ConnectionCardProps) {
  return (
    <Card
      className={cn('p-4', className)}
      data-testid={`connection-card-${sourceName.toLowerCase()}`}
    >
      <CardContent className="flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={sourceName}
              className="w-8 h-8 object-contain"
            />
          ) : (
            <span className="text-xl font-bold text-gray-400">
              {sourceName[0]}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="font-display font-bold text-text-primary">
            {sourceName}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                statusColors[status],
              )}
            >
              {statusLabels[status]}
            </span>
            {itemCount !== undefined && status === 'connected' && (
              <span className="text-xs text-gray-500">
                {itemCount} items
              </span>
            )}
          </div>
          {lastSyncAt && status === 'connected' && (
            <p className="text-xs text-gray-400 mt-1">
              Last synced: {lastSyncAt.toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Action */}
        {status === 'connected' && onDisconnect && (
          <button
            onClick={onDisconnect}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Disconnect
          </button>
        )}
        {status === 'disconnected' && onConnect && (
          <button
            onClick={onConnect}
            className="text-sm px-3 py-1 bg-ownyou-primary text-white rounded-full hover:opacity-90 transition-opacity"
          >
            Connect
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default ConnectionCard;
