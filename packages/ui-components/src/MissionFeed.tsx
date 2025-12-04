/**
 * MissionFeed Component - v13 Section 3.4
 *
 * Displays a filterable list of mission cards.
 */

import React, { useMemo } from 'react';
import type { MissionFeedProps, MissionFeedFilter } from './types';
import type { MissionCard as MissionCardType, MissionStatus } from '@ownyou/shared-types';
import { MissionCard } from './MissionCard';

/**
 * Filter missions by status
 */
function filterMissions(
  missions: MissionCardType[],
  filter: MissionFeedFilter
): MissionCardType[] {
  if (filter === 'all') return missions;

  const statusMap: Record<MissionFeedFilter, MissionStatus[]> = {
    all: [],
    active: ['CREATED', 'PRESENTED', 'ACTIVE'],
    snoozed: ['SNOOZED'],
    completed: ['COMPLETED'],
    dismissed: ['DISMISSED'],
  };

  const allowedStatuses = statusMap[filter];
  return missions.filter((m) => allowedStatuses.includes(m.status));
}

/**
 * Sort missions by urgency and creation time
 */
function sortMissions(missions: MissionCardType[]): MissionCardType[] {
  const urgencyOrder = { high: 0, medium: 1, low: 2 };

  return [...missions].sort((a, b) => {
    // First by urgency
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    // Then by creation time (newest first)
    return b.createdAt - a.createdAt;
  });
}

/**
 * MissionFeed - Displays a list of mission cards
 *
 * @example
 * ```tsx
 * <MissionFeed
 *   missions={missions}
 *   filter="active"
 *   onMissionAction={(mission, action) => handleAction(mission, action)}
 * />
 * ```
 */
export function MissionFeed({
  missions,
  filter = 'all',
  onMissionAction,
  onMissionFeedback,
  emptyMessage = 'No missions yet',
  className = '',
}: MissionFeedProps): React.ReactElement {
  const filteredMissions = useMemo(() => {
    const filtered = filterMissions(missions, filter);
    return sortMissions(filtered);
  }, [missions, filter]);

  if (filteredMissions.length === 0) {
    return (
      <div
        className={`text-center py-8 text-gray-500 ${className}`}
        data-testid="mission-feed-empty"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={`space-y-4 ${className}`}
      data-testid="mission-feed"
      role="list"
      aria-label="Mission cards"
    >
      {filteredMissions.map((mission) => (
        <MissionCard
          key={mission.id}
          mission={mission}
          onAction={onMissionAction}
          onFeedback={onMissionFeedback}
        />
      ))}
    </div>
  );
}

/**
 * MissionFeedHeader - Filter tabs for mission feed
 */
export interface MissionFeedHeaderProps {
  /** Current filter */
  filter: MissionFeedFilter;

  /** Filter change handler */
  onFilterChange: (filter: MissionFeedFilter) => void;

  /** Counts per filter */
  counts?: Record<MissionFeedFilter, number>;

  /** Additional CSS classes */
  className?: string;
}

const FILTER_LABELS: Record<MissionFeedFilter, string> = {
  all: 'All',
  active: 'Active',
  snoozed: 'Snoozed',
  completed: 'Completed',
  dismissed: 'Dismissed',
};

/**
 * MissionFeedHeader - Filter tabs
 *
 * @example
 * ```tsx
 * <MissionFeedHeader
 *   filter={currentFilter}
 *   onFilterChange={setFilter}
 *   counts={{ all: 10, active: 5, ... }}
 * />
 * ```
 */
export function MissionFeedHeader({
  filter,
  onFilterChange,
  counts,
  className = '',
}: MissionFeedHeaderProps): React.ReactElement {
  const filters: MissionFeedFilter[] = ['all', 'active', 'snoozed', 'completed', 'dismissed'];

  return (
    <div
      className={`flex gap-1 p-1 bg-gray-100 rounded-lg ${className}`}
      role="tablist"
      aria-label="Mission filters"
    >
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onFilterChange(f)}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-md transition-colors
            ${f === filter
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}
          `.trim()}
          role="tab"
          aria-selected={f === filter}
          data-testid={`filter-${f}`}
        >
          {FILTER_LABELS[f]}
          {counts && counts[f] > 0 && (
            <span className="ml-1.5 text-xs text-gray-500">
              ({counts[f]})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
