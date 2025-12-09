/**
 * MissionCardEntertainment - Comedy/theater/event card
 * v13 Section 4.5.1 - Entertainment card (207px height)
 */

import React from 'react';
import { cn, Card, CardContent } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardEntertainmentProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
  /** Event type */
  eventType?: 'comedy' | 'theater' | 'concert' | 'movie' | 'other';
  /** Event date */
  eventDate?: string;
  /** Venue name */
  venue?: string;
}

/**
 * Entertainment card for events, shows, and performances
 */
export function MissionCardEntertainment({
  mission,
  onClick,
  onFeedbackChange,
  className,
  eventType = 'other',
  eventDate,
  venue,
}: MissionCardEntertainmentProps) {
  const typeEmojis: Record<string, string> = {
    comedy: '🎭',
    theater: '🎪',
    concert: '🎵',
    movie: '🎬',
    other: '🎟️',
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden cursor-pointer',
        'w-[180px] md:w-[220px] lg:w-[260px]',
        'transition-transform duration-200 hover:scale-[1.02]',
        'active:scale-[0.98]',
        className,
      )}
      style={{ height: '207px' }}
      onClick={onClick}
      role="article"
      aria-label={`Event: ${mission.title}`}
      data-testid={`mission-card-entertainment-${mission.id}`}
    >
      {/* Event Image */}
      <div className="relative w-full h-[60%] overflow-hidden">
        {mission.imageUrl ? (
          <img
            src={mission.imageUrl}
            alt={mission.title}
            className="w-full h-full object-cover rounded-t-[21px]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-placeholder rounded-t-[21px]" />
        )}

        {/* Event Type Badge */}
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
          <span>{typeEmojis[eventType]}</span>
          <span className="font-label text-xs capitalize">{eventType}</span>
        </div>

        {/* Date Badge */}
        {eventDate && (
          <div className="absolute top-2 right-2 bg-ownyou-primary text-white px-2 py-1 rounded-full">
            <span className="font-price text-xs">{eventDate}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3 flex flex-col h-[40%]">
        {/* Title */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-1">
          {mission.title}
        </h3>

        {/* Venue */}
        {venue && (
          <p className="font-body text-xs text-gray-500 mt-1 flex items-center gap-1">
            <span>📍</span>
            <span className="line-clamp-1">{venue}</span>
          </p>
        )}

        {/* Feedback Heart */}
        <div className="absolute bottom-3 right-3">
          <FeedbackHeart
            initialState={mission.feedbackState || 'meh'}
            size="small"
            onStateChange={onFeedbackChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default MissionCardEntertainment;
