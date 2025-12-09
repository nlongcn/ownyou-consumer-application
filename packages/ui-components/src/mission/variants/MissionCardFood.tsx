/**
 * MissionCardFood - Recipe/dinner idea card
 * v13 Section 4.5.1 - Food card (287px height)
 */

import React from 'react';
import { cn, Card, CardContent } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardFoodProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
  /** Prep time in minutes */
  prepTime?: number;
  /** Cooking time in minutes */
  cookTime?: number;
  /** Difficulty level */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Dietary tags */
  dietaryTags?: string[];
}

/**
 * Food card for recipes and dinner ideas
 */
export function MissionCardFood({
  mission,
  onClick,
  onFeedbackChange,
  className,
  prepTime,
  cookTime,
  difficulty,
  dietaryTags = [],
}: MissionCardFoodProps) {
  const totalTime = (prepTime || 0) + (cookTime || 0);

  const difficultyColors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
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
      style={{ height: '287px' }}
      onClick={onClick}
      role="article"
      aria-label={`Recipe: ${mission.title}`}
      data-testid={`mission-card-food-${mission.id}`}
    >
      {/* Food Image */}
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

        {/* Time Badge */}
        {totalTime > 0 && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
            <span>⏱️</span>
            <span className="font-price text-xs">{totalTime} min</span>
          </div>
        )}

        {/* Dietary Tags */}
        {dietaryTags.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {dietaryTags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="bg-white/90 backdrop-blur-sm text-xs px-1.5 py-0.5 rounded-full font-label"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3 flex flex-col h-[45%]">
        {/* Title */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-2">
          {mission.title}
        </h3>

        {/* Difficulty & Time */}
        <div className="flex items-center gap-2 mt-2">
          {difficulty && (
            <span className={cn(
              'font-label text-xs px-2 py-0.5 rounded-full capitalize',
              difficultyColors[difficulty]
            )}>
              {difficulty}
            </span>
          )}
          {prepTime && (
            <span className="font-body text-xs text-gray-500">
              {prepTime}m prep
            </span>
          )}
        </div>

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

export default MissionCardFood;
