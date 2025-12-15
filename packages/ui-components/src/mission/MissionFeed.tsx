/**
 * MissionFeed Component
 * v13 Section 4.7 - Masonry Grid Layout
 */

import Masonry from 'react-masonry-css';
import { cn, masonryColumns, cardDimensions, cardHeights, radius } from '@ownyou/ui-design-system';
import { MissionCard } from './MissionCard';
import type { Mission, HeartState } from '../types';

export interface MissionFeedProps {
  /** Array of missions to display */
  missions: Mission[];
  /** Click handler for mission cards */
  onMissionClick?: (missionId: string) => void;
  /** Feedback change handler */
  onFeedbackChange?: (missionId: string, state: HeartState) => void;
  /** Snooze handler - Sprint 11b Bugfix 8 */
  onSnooze?: (missionId: string) => void;
  /** Dismiss handler - Sprint 11b Bugfix 8 */
  onDismiss?: (missionId: string) => void;
  /** Call-to-action handler - Sprint 11b Bugfix 8 */
  onCallToAction?: (missionId: string) => void;
  /** Additional CSS class names */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Loading skeleton for mission cards
 */
function MissionCardSkeleton() {
  return (
    <div
      className="bg-placeholder animate-pulse"
      style={{
        width: cardDimensions.width,
        height: cardHeights.savings,
        borderRadius: radius.card,
      }}
      data-testid="mission-card-skeleton"
    />
  );
}

/**
 * Mission feed with masonry layout
 * Uses design tokens for all spacing values
 */
export function MissionFeed({
  missions,
  onMissionClick,
  onFeedbackChange,
  onSnooze,
  onDismiss,
  onCallToAction,
  className,
  isLoading = false,
  emptyMessage = 'No missions yet. Check back soon!',
}: MissionFeedProps) {
  // Masonry container styles using design tokens
  const masonryStyle = {
    marginLeft: cardDimensions.overlapMargin,
  };
  const columnStyle = {
    paddingLeft: cardDimensions.gap,
  };
  const itemStyle = {
    marginBottom: cardDimensions.gap,
  };

  // Loading state with skeletons
  if (isLoading) {
    return (
      <Masonry
        breakpointCols={masonryColumns}
        className={cn('flex w-auto', className)}
        style={masonryStyle}
        columnClassName="bg-clip-padding"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`skeleton-${i}`} style={columnStyle}>
            <div style={itemStyle}>
              <MissionCardSkeleton />
            </div>
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
      breakpointCols={masonryColumns}
      className={cn('flex w-auto', className)}
      style={masonryStyle}
      columnClassName="bg-clip-padding"
      data-testid="mission-feed"
    >
      {missions.map((mission) => (
        <div key={mission.id} style={{ ...columnStyle, ...itemStyle }}>
          <MissionCard
            mission={mission}
            onClick={() => onMissionClick?.(mission.id)}
            onFeedbackChange={(state) => onFeedbackChange?.(mission.id, state)}
            onSnooze={() => onSnooze?.(mission.id)}
            onDismiss={() => onDismiss?.(mission.id)}
            onCallToAction={() => onCallToAction?.(mission.id)}
          />
        </div>
      ))}
    </Masonry>
  );
}

export default MissionFeed;
