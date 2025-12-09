/**
 * MissionFeed Component
 * v13 Section 4.7 - Masonry Grid Layout
 */

import React from 'react';
import Masonry from 'react-masonry-css';
import { cn } from '@ownyou/ui-design-system';
import { MissionCard } from './MissionCard';
import type { Mission, HeartState, BREAKPOINT_COLUMNS } from '../types';

export interface MissionFeedProps {
  /** Array of missions to display */
  missions: Mission[];
  /** Click handler for mission cards */
  onMissionClick?: (missionId: string) => void;
  /** Feedback change handler */
  onFeedbackChange?: (missionId: string, state: HeartState) => void;
  /** Additional CSS class names */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Breakpoint columns configuration for masonry layout
 */
const breakpointCols = {
  default: 4,   // 1920px+
  1440: 4,
  1280: 3,
  1024: 3,
  768: 2,
  640: 2,
};

/**
 * Loading skeleton for mission cards
 */
function MissionCardSkeleton() {
  return (
    <div
      className="w-[180px] h-[284px] rounded-[35px] bg-placeholder animate-pulse"
      data-testid="mission-card-skeleton"
    />
  );
}

/**
 * Mission feed with masonry layout
 */
export function MissionFeed({
  missions,
  onMissionClick,
  onFeedbackChange,
  className,
  isLoading = false,
  emptyMessage = 'No missions yet. Check back soon!',
}: MissionFeedProps) {
  // Loading state with skeletons
  if (isLoading) {
    return (
      <Masonry
        breakpointCols={breakpointCols}
        className={cn('flex -ml-[13px] w-auto', className)}
        columnClassName="pl-[13px] bg-clip-padding"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="mb-[13px]">
            <MissionCardSkeleton />
          </div>
        ))}
      </Masonry>
    );
  }

  // Empty state
  if (missions.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          'py-16 px-4 text-center',
          className,
        )}
        data-testid="mission-feed-empty"
      >
        <span className="text-4xl mb-4">🎯</span>
        <p className="font-display text-lg text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Masonry
      breakpointCols={breakpointCols}
      className={cn('flex -ml-[13px] w-auto', className)}
      columnClassName="pl-[13px] bg-clip-padding"
      data-testid="mission-feed"
    >
      {missions.map((mission) => (
        <div key={mission.id} className="mb-[13px]">
          <MissionCard
            mission={mission}
            onClick={() => onMissionClick?.(mission.id)}
            onFeedbackChange={(state) => onFeedbackChange?.(mission.id, state)}
          />
        </div>
      ))}
    </Masonry>
  );
}

export default MissionFeed;
