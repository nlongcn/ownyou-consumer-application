/**
 * MissionCardContent - Podcast/article content card
 * v13 Section 4.5.1 - Content card (284px height)
 */

import React from 'react';
import { cn, Card, CardContent } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardContentProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
  /** Content type (podcast, article, video) */
  contentType?: 'podcast' | 'article' | 'video';
  /** Duration in minutes */
  duration?: number;
}

/**
 * Content card for podcasts, articles, and videos
 */
export function MissionCardContent({
  mission,
  onClick,
  onFeedbackChange,
  className,
  contentType = 'article',
  duration,
}: MissionCardContentProps) {
  const typeIcons: Record<string, string> = {
    podcast: '🎙️',
    article: '📄',
    video: '🎬',
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
      style={{ height: '284px' }}
      onClick={onClick}
      role="article"
      aria-label={`${contentType}: ${mission.title}`}
      data-testid={`mission-card-content-${mission.id}`}
    >
      {/* Cover Image */}
      <div className="relative w-full h-[55%] overflow-hidden">
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

        {/* Brand Logo */}
        {mission.brandLogoUrl && (
          <div className="absolute bottom-2 left-2 bg-white rounded-full p-1.5 shadow-md">
            <img
              src={mission.brandLogoUrl}
              alt={mission.brandName || 'Source'}
              className="w-6 h-6 object-contain rounded-full"
            />
          </div>
        )}

        {/* Content Type Badge */}
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
          <span>{typeIcons[contentType]}</span>
          <span className="font-label text-xs capitalize">{contentType}</span>
        </div>

        {/* Duration Badge */}
        {duration && (
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full">
            <span className="font-price text-xs">
              {duration} min
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3 flex flex-col h-[45%]">
        {/* Source */}
        {mission.brandName && (
          <span className="font-brand text-xs text-gray-500 uppercase tracking-wide">
            {mission.brandName}
          </span>
        )}

        {/* Title */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-2 mt-1">
          {mission.title}
        </h3>

        {/* Subtitle */}
        {mission.subtitle && (
          <p className="font-body text-xs text-gray-500 mt-1 line-clamp-1">
            {mission.subtitle}
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

export default MissionCardContent;
