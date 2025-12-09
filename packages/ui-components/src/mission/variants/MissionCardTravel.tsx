/**
 * MissionCardTravel - Holiday/travel destination card
 * v13 Section 4.5.1 - Travel card (208px height)
 */

import React from 'react';
import { cn, Card, CardContent } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardTravelProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
  /** Destination location */
  destination?: string;
  /** Travel dates */
  dates?: string;
}

/**
 * Travel card with full-bleed destination image
 */
export function MissionCardTravel({
  mission,
  onClick,
  onFeedbackChange,
  className,
  destination,
  dates,
}: MissionCardTravelProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden cursor-pointer',
        'w-[180px] md:w-[220px] lg:w-[260px]',
        'transition-transform duration-200 hover:scale-[1.02]',
        'active:scale-[0.98]',
        className,
      )}
      style={{ height: '208px' }}
      onClick={onClick}
      role="article"
      aria-label={`Travel: ${mission.title}`}
      data-testid={`mission-card-travel-${mission.id}`}
    >
      {/* Full-bleed Image */}
      <div className="absolute inset-0 overflow-hidden">
        {mission.imageUrl ? (
          <img
            src={mission.imageUrl}
            alt={mission.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-placeholder" />
        )}
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Content Overlay */}
      <CardContent className="absolute inset-0 p-3 flex flex-col justify-end">
        {/* Destination Badge */}
        {destination && (
          <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white px-2 py-1 rounded-full self-start mb-2">
            <span>✈️</span>
            <span className="font-label text-xs">{destination}</span>
          </div>
        )}

        {/* Title */}
        <h3 className="font-display text-base font-bold text-white line-clamp-2 drop-shadow-lg">
          {mission.title}
        </h3>

        {/* Dates */}
        {dates && (
          <p className="font-body text-xs text-white/80 mt-1">
            {dates}
          </p>
        )}

        {/* Feedback Heart */}
        <div className="absolute bottom-3 right-3">
          <FeedbackHeart
            initialState={mission.feedbackState || 'meh'}
            size="default"
            onStateChange={onFeedbackChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default MissionCardTravel;
