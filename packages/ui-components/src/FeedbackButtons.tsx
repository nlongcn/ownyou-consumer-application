/**
 * FeedbackButtons Component - v13 Section 3.5
 *
 * Inline feedback buttons for mission cards.
 */

import React from 'react';
import type { FeedbackButtonsProps, FeedbackRating } from './types';

const FEEDBACK_OPTIONS: Array<{
  rating: FeedbackRating;
  emoji: string;
  label: string;
}> = [
  { rating: 'love', emoji: '❤️', label: 'Love it!' },
  { rating: 'like', emoji: '👍', label: 'Good' },
  { rating: 'meh', emoji: '😐', label: 'Meh' },
];

const SIZE_CLASSES = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-3 py-1.5 text-base',
  lg: 'px-4 py-2 text-lg',
};

/**
 * FeedbackButtons - Inline feedback selection
 *
 * @example
 * ```tsx
 * <FeedbackButtons
 *   onFeedback={(rating) => saveFeedback(missionId, rating)}
 *   selected="like"
 *   size="md"
 * />
 * ```
 */
export function FeedbackButtons({
  onFeedback,
  selected,
  disabled = false,
  size = 'md',
  className = '',
}: FeedbackButtonsProps): React.ReactElement {
  return (
    <div
      className={`flex gap-2 ${className}`}
      data-testid="feedback-buttons"
      role="group"
      aria-label="Mission feedback"
    >
      {FEEDBACK_OPTIONS.map(({ rating, emoji, label }) => {
        const isSelected = selected === rating;

        return (
          <button
            key={rating}
            onClick={() => onFeedback(rating)}
            disabled={disabled}
            className={`
              ${SIZE_CLASSES[size]}
              rounded-md border
              transition-all duration-150
              ${isSelected
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 bg-white hover:bg-gray-50'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `.trim()}
            title={label}
            aria-pressed={isSelected}
            aria-label={label}
            data-testid={`feedback-${rating}`}
          >
            <span role="img" aria-hidden="true">{emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
