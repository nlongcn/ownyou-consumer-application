/**
 * MissionCard Base Component
 * v13 Section 4.5 - Mission Card Specifications
 */

import React from 'react';
import { cn, Card, CardContent } from '@ownyou/ui-design-system';
import { FeedbackHeart } from './FeedbackHeart';
import type { Mission, HeartState, MissionCardType, CARD_DIMENSIONS } from '../types';

export interface MissionCardProps {
  /** Mission data */
  mission: Mission;
  /** Click handler */
  onClick?: () => void;
  /** Feedback state change handler */
  onFeedbackChange?: (state: HeartState) => void;
  /** Additional CSS class names */
  className?: string;
  /** Show feedback heart */
  showFeedback?: boolean;
}

/**
 * Get card height based on type
 */
function getCardHeight(type: MissionCardType): number {
  const heights: Record<MissionCardType, number> = {
    shopping: 290,
    savings: 284,
    consumables: 284,
    content: 284,
    travel: 208,
    entertainment: 207,
    food: 287,
    people: 210,
    health: 180,
  };
  return heights[type] || 284;
}

/**
 * Check if card type should display price
 */
function shouldShowPrice(type: MissionCardType): boolean {
  return type === 'shopping';
}

/**
 * Check if card type should display brand logo
 */
function shouldShowBrandLogo(type: MissionCardType): boolean {
  return ['shopping', 'savings', 'content'].includes(type);
}

/**
 * Base MissionCard component with v13 Figma styling
 */
export function MissionCard({
  mission,
  onClick,
  onFeedbackChange,
  className,
  showFeedback = true,
}: MissionCardProps) {
  const height = getCardHeight(mission.type);
  const showPrice = shouldShowPrice(mission.type);
  const showBrandLogo = shouldShowBrandLogo(mission.type);

  return (
    <Card
      className={cn(
        'relative overflow-hidden cursor-pointer',
        'w-[180px] md:w-[220px] lg:w-[260px]',
        'transition-transform duration-200 hover:scale-[1.02]',
        'active:scale-[0.98]',
        className,
      )}
      style={{ height: `${height}px` }}
      onClick={onClick}
      role="article"
      aria-label={mission.title}
      data-testid={`mission-card-${mission.id}`}
      data-type={mission.type}
    >
      {/* Image Section */}
      {mission.imageUrl ? (
        <div className="relative w-full h-[60%] overflow-hidden">
          <img
            src={mission.imageUrl}
            alt={mission.title}
            className="w-full h-full object-cover rounded-t-[12px]"
            loading="lazy"
          />
          {/* Brand Logo Overlay */}
          {showBrandLogo && mission.brandLogoUrl && (
            <div className="absolute bottom-2 left-2 bg-white rounded-full p-1 shadow-sm">
              <img
                src={mission.brandLogoUrl}
                alt={mission.brandName || 'Brand'}
                className="w-6 h-6 object-contain rounded-full"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-[60%] bg-placeholder rounded-t-[12px]" />
      )}

      {/* Content Section */}
      <CardContent className="p-3 flex flex-col h-[40%]">
        {/* Title */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-2">
          {mission.title}
        </h3>

        {/* Subtitle / Brand Name */}
        {(mission.subtitle || mission.brandName) && (
          <p className="font-body text-xs text-gray-600 mt-1 line-clamp-1">
            {mission.subtitle || mission.brandName}
          </p>
        )}

        {/* Price Row (shopping cards only) */}
        {showPrice && mission.price !== undefined && (
          <div className="flex items-center gap-2 mt-auto">
            <span className="font-price text-sm font-medium text-text-primary">
              {mission.currency || '$'}{mission.price.toFixed(2)}
            </span>
            {mission.originalPrice && mission.originalPrice > mission.price && (
              <span className="font-price text-xs text-gray-400 line-through">
                {mission.currency || '$'}{mission.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Feedback Heart */}
        {showFeedback && (
          <div className="absolute bottom-2 right-2">
            <FeedbackHeart
              initialState={mission.feedbackState || 'meh'}
              size="small"
              onStateChange={onFeedbackChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MissionCard;
