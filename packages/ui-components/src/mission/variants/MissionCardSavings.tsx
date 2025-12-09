/**
 * MissionCardSavings - Utility/energy savings card
 * v13 Section 4.5.1 - Savings card (284px height)
 */

import React from 'react';
import { cn, Card, CardContent } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardSavingsProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
  /** Savings amount to highlight */
  savingsAmount?: number;
  /** Savings period (e.g., "per month") */
  savingsPeriod?: string;
}

/**
 * Savings card for utility/energy recommendations with savings highlight
 */
export function MissionCardSavings({
  mission,
  onClick,
  onFeedbackChange,
  className,
  savingsAmount,
  savingsPeriod = 'per month',
}: MissionCardSavingsProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden cursor-pointer',
        'w-[180px] md:w-[220px] lg:w-[260px]',
        'transition-transform duration-200 hover:scale-[1.02]',
        'active:scale-[0.98]',
        'bg-ownyou-secondary/10', // Light mint tint for savings
        className,
      )}
      style={{ height: '284px' }}
      onClick={onClick}
      role="article"
      aria-label={`Savings: ${mission.title}`}
      data-testid={`mission-card-savings-${mission.id}`}
    >
      {/* Image */}
      <div className="relative w-full h-[50%] overflow-hidden">
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
              alt={mission.brandName || 'Provider'}
              className="w-6 h-6 object-contain rounded-full"
            />
          </div>
        )}

        {/* Savings Badge */}
        {savingsAmount && (
          <div className="absolute top-2 right-2 bg-ownyou-secondary text-white px-2 py-1 rounded-full">
            <span className="font-price text-xs font-bold">
              Save {mission.currency || '$'}{savingsAmount}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3 flex flex-col h-[50%]">
        {/* Provider Name */}
        {mission.brandName && (
          <span className="font-brand text-xs text-gray-500 uppercase tracking-wide">
            {mission.brandName}
          </span>
        )}

        {/* Title */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-2 mt-1">
          {mission.title}
        </h3>

        {/* Savings Highlight */}
        {savingsAmount && (
          <div className="mt-auto">
            <span className="font-display text-lg font-bold text-ownyou-secondary">
              {mission.currency || '$'}{savingsAmount}
            </span>
            <span className="font-body text-xs text-gray-500 ml-1">
              {savingsPeriod}
            </span>
          </div>
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

export default MissionCardSavings;
