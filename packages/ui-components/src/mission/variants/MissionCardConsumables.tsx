/**
 * MissionCardConsumables - Shopping list card
 * v13 Section 4.5.1 - Consumables card (284px height)
 */

import React from 'react';
import { cn, Card, CardContent } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardConsumablesProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
  /** Grid of item images */
  itemImages?: string[];
  /** Number of items in list */
  itemCount?: number;
}

/**
 * Consumables card with grid image display for shopping lists
 */
export function MissionCardConsumables({
  mission,
  onClick,
  onFeedbackChange,
  className,
  itemImages = [],
  itemCount,
}: MissionCardConsumablesProps) {
  // Show up to 4 images in a 2x2 grid
  const gridImages = itemImages.slice(0, 4);
  const hasGrid = gridImages.length > 1;

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
      aria-label={`Shopping list: ${mission.title}`}
      data-testid={`mission-card-consumables-${mission.id}`}
    >
      {/* Image Grid */}
      <div className="relative w-full h-[55%] overflow-hidden">
        {hasGrid ? (
          <div className="grid grid-cols-2 gap-1 w-full h-full p-1">
            {gridImages.map((img, i) => (
              <div key={i} className="bg-placeholder overflow-hidden rounded-[12px]">
                <img
                  src={img}
                  alt={`Item ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {/* Fill remaining slots with placeholders */}
            {Array.from({ length: 4 - gridImages.length }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className="bg-placeholder rounded-[12px]"
              />
            ))}
          </div>
        ) : mission.imageUrl ? (
          <img
            src={mission.imageUrl}
            alt={mission.title}
            className="w-full h-full object-cover rounded-t-[21px]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-placeholder rounded-t-[21px]" />
        )}

        {/* Item Count Badge */}
        {itemCount && itemCount > 0 && (
          <div className="absolute top-2 right-2 bg-ownyou-primary text-white px-2 py-1 rounded-full">
            <span className="font-price text-xs font-bold">
              {itemCount} items
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3 flex flex-col h-[45%]">
        {/* Title */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-2">
          {mission.title}
        </h3>

        {/* Subtitle */}
        {mission.subtitle && (
          <p className="font-body text-xs text-gray-500 mt-1 line-clamp-2">
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

export default MissionCardConsumables;
