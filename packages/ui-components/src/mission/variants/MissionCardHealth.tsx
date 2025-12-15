/**
 * MissionCardHealth - Health/longevity card
 * v13 Section 4.5.1 - Health card (180px height)
 */

import { cn, Card, CardContent, cardDimensions, cardHeights, radius } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardHealthProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
  /** Health category */
  category?: 'exercise' | 'nutrition' | 'sleep' | 'mental' | 'checkup' | 'other';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Goal text */
  goal?: string;
}

/**
 * Health card for wellness and longevity suggestions
 */
export function MissionCardHealth({
  mission,
  onClick,
  onFeedbackChange,
  className,
  category = 'other',
  progress,
  goal,
}: MissionCardHealthProps) {
  const categoryEmojis: Record<string, string> = {
    exercise: '🏃',
    nutrition: '🥗',
    sleep: '😴',
    mental: '🧘',
    checkup: '🩺',
    other: '💪',
  };

  const categoryColors: Record<string, string> = {
    exercise: 'bg-orange-100 text-orange-700',
    nutrition: 'bg-green-100 text-green-700',
    sleep: 'bg-purple-100 text-purple-700',
    mental: 'bg-blue-100 text-blue-700',
    checkup: 'bg-red-100 text-red-700',
    other: 'bg-gray-100 text-gray-700',
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden cursor-pointer',
        'transition-transform duration-200 hover:scale-[1.02]',
        'active:scale-[0.98]',
        className,
      )}
      style={{
        width: cardDimensions.width,
        height: cardHeights.health,
      }}
      onClick={onClick}
      role="article"
      aria-label={`Health: ${mission.title}`}
      data-testid={`mission-card-health-${mission.id}`}
      data-mission-card
      data-mission-id={mission.id}
    >
      {/* Compact Layout */}
      <CardContent className="p-3 flex flex-col h-full">
        {/* Header Row */}
        <div className="flex items-start justify-between">
          {/* Category Badge */}
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-label',
            categoryColors[category]
          )}>
            <span>{categoryEmojis[category]}</span>
            <span className="capitalize">{category}</span>
          </span>

          {/* Small Image or Icon */}
          <div className="w-12 h-12 overflow-hidden flex-shrink-0" style={{ borderRadius: radius.image }}>
            {mission.imageUrl ? (
              <img
                src={mission.imageUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-placeholder flex items-center justify-center text-xl">
                {categoryEmojis[category]}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-2 mt-2">
          {mission.title}
        </h3>

        {/* Progress Bar */}
        {progress !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-body text-gray-500">Progress</span>
              <span className="font-price text-ownyou-secondary">{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-ownyou-secondary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* Goal */}
        {goal && !progress && (
          <p className="font-body text-xs text-gray-500 mt-2 line-clamp-1">
            🎯 {goal}
          </p>
        )}

        {/* Feedback Heart */}
        <div className="absolute bottom-2 right-2">
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

export default MissionCardHealth;
