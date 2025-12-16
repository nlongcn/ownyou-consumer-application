/**
 * RawData Route - View imported raw data
 * Sprint 11b Bugfix 10: Add raw data viewer
 *
 * Allows users to see what data OwnYou has captured from their connected sources.
 * Critical for transparency and trust.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@ownyou/ui-components';
import { Card, radius } from '@ownyou/ui-design-system';
import { NS } from '@ownyou/shared-types';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';

interface RawDataItem {
  id: string;
  summary: string;
  sourceType?: string;
  date: string;
  metadata?: Record<string, unknown>;
}

type SourceType = 'emails' | 'transactions' | 'calendar';

/** Get namespace for source type */
function getNamespaceForSource(sourceType: SourceType, userId: string) {
  switch (sourceType) {
    case 'emails':
      // Email processing results are stored in IAB classifications namespace
      // as episodic_email_* records from the email parsing pipeline
      return NS.iabClassifications(userId);
    case 'transactions':
      return NS.financialTransactions(userId);
    case 'calendar':
      return NS.calendarEvents(userId);
    default:
      return NS.iabClassifications(userId);
  }
}

/** Get display title for source type */
function getSourceTitle(sourceType: SourceType): string {
  switch (sourceType) {
    case 'emails':
      return 'Emails';
    case 'transactions':
      return 'Transactions';
    case 'calendar':
      return 'Calendar Events';
    default:
      return 'Data';
  }
}

/** Get icon for source type */
function getSourceIcon(sourceType: SourceType): string {
  switch (sourceType) {
    case 'emails':
      return '📧';
    case 'transactions':
      return '💳';
    case 'calendar':
      return '📅';
    default:
      return '📁';
  }
}

export function RawData() {
  const { sourceType = 'emails' } = useParams<{ sourceType: string }>();
  const navigate = useNavigate();
  const { store, isReady } = useStore();
  const { wallet, isAuthenticated } = useAuth();

  const [data, setData] = useState<RawDataItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = wallet?.address ?? 'anonymous';
  const validSourceType = (['emails', 'transactions', 'calendar'].includes(sourceType)
    ? sourceType
    : 'emails') as SourceType;

  // Load raw data from store
  useEffect(() => {
    if (!store || !isReady || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const namespace = getNamespaceForSource(validSourceType, userId);
        const result = await store.list<RawDataItem>(namespace, { limit: 100, offset: 0 });

        // Transform items to RawDataItem format
        // Filter to only include email records (not classification records)
        const items: RawDataItem[] = result.items
          .filter((item: unknown) => {
            const i = item as Record<string, unknown>;
            // Only include items that have sourceType='email' or have email-like properties
            // Exclude classification records which have 'category' field
            return i.sourceType === 'email' || (i.summary && !i.category);
          })
          .map((item: unknown) => {
            const i = item as Record<string, unknown>;
            return {
              id: String(i.id ?? i.key ?? Math.random()),
              summary: String(i.summary ?? i.content ?? i.subject ?? i.description ?? 'No summary'),
              sourceType: String(i.sourceType ?? validSourceType),
              date: String(i.date ?? i.timestamp ?? i.createdAt ?? new Date().toISOString()),
              metadata: {
                ...(i.metadata as Record<string, unknown> | undefined),
                from: i.from,
                to: i.to,
              },
            };
          });

        // Sort by date, newest first
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setData(items);
      } catch (err) {
        console.error('[RawData] Failed to load data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [store, isReady, isAuthenticated, userId, validSourceType]);

  // Filter data based on search
  const filteredData = data.filter((item) =>
    item.summary.toLowerCase().includes(search.toLowerCase())
  );

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showLogo={false} title="Your Data" onBack={handleBack} showFilters={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-8 text-center max-w-sm">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">🔒</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Connect to View Data</h2>
            <p className="text-gray-600">
              Connect your wallet to view your imported data.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header showLogo={false} title={`Your ${getSourceTitle(validSourceType)}`} onBack={handleBack} showFilters={false} />

      <div className="flex-1 px-4 py-6 space-y-4">
        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{getSourceIcon(validSourceType)}</span>
          <div>
            <h1 className="text-xl font-bold">{getSourceTitle(validSourceType)}</h1>
            <p className="text-sm text-gray-600">
              {data.length} items imported
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <input
            type="search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ownyou-primary focus:border-transparent"
            aria-label="Search data"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Source tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['emails', 'transactions', 'calendar'] as SourceType[]).map((type) => (
            <button
              key={type}
              onClick={() => navigate(`/data/${type}`)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                validSourceType === type
                  ? 'bg-ownyou-secondary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getSourceIcon(type)} {getSourceTitle(type)}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-placeholder animate-pulse h-24 rounded-lg"
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <Card className="p-6 text-center">
            <p className="text-red-500">{error}</p>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredData.length === 0 && (
          <Card className="p-8 text-center">
            <span className="text-4xl mb-4 block">{getSourceIcon(validSourceType)}</span>
            <h3 className="font-bold text-lg mb-2">
              {search ? 'No matching results' : `No ${getSourceTitle(validSourceType).toLowerCase()} yet`}
            </h3>
            <p className="text-gray-600">
              {search
                ? `Try a different search term.`
                : `Connect your data sources to import ${getSourceTitle(validSourceType).toLowerCase()}.`}
            </p>
          </Card>
        )}

        {/* Data list */}
        {!isLoading && !error && filteredData.length > 0 && (
          <div className="space-y-3">
            {filteredData.map((item) => (
              <RawDataCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Count indicator */}
        {!isLoading && filteredData.length > 0 && (
          <p className="text-center text-sm text-gray-500 py-4">
            Showing {filteredData.length} of {data.length} items
          </p>
        )}
      </div>
    </div>
  );
}

/** Individual data item card */
function RawDataCard({ item }: { item: RawDataItem }) {
  const [expanded, setExpanded] = useState(false);
  // Extract sender from metadata for type safety
  const senderFrom = item.metadata?.from ? String(item.metadata.from) : null;

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => setExpanded(!expanded)}
      style={{ borderRadius: radius.card }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-2">{item.summary}</p>
          {/* Show sender for emails */}
          {senderFrom && (
            <p className="text-xs text-gray-600 mt-0.5 truncate">
              From: {senderFrom}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {formatDate(item.date)}
          </p>
        </div>
        <button
          className="text-gray-400 hover:text-gray-600 text-xs"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▼' : '►'}
        </button>
      </div>

      {/* Expanded view */}
      {expanded && item.metadata && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Details:</p>
          <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(item.metadata, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}

/** Format date for display */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
