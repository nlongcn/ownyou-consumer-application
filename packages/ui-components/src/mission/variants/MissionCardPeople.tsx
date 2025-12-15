/**
 * MissionCardPeople - Relationship suggestion card
 * v13 Section 4.5.1 - People card (210px height)
 */

import { cn, Card, CardContent, cardDimensions, cardHeights } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardPeopleProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
  /** Relationship type */
  relationshipType?: 'friend' | 'family' | 'colleague' | 'partner' | 'other';
  /** Last interaction */
  lastInteraction?: string;
  /** Suggested action */
  suggestedAction?: string;
}

/**
 * People card for relationship suggestions and reminders
 */
export function MissionCardPeople({
  mission,
  onClick,
  onFeedbackChange,
  className,
  relationshipType = 'friend',
  lastInteraction,
  suggestedAction,
}: MissionCardPeopleProps) {
  const typeEmojis: Record<string, string> = {
    friend: '👋',
    family: '👨‍👩‍👧',
    colleague: '💼',
    partner: '❤️',
    other: '🤝',
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
        height: cardHeights.people,
      }}
      onClick={onClick}
      role="article"
      aria-label={`Connect: ${mission.title}`}
      data-testid={`mission-card-people-${mission.id}`}
      data-mission-card
      data-mission-id={mission.id}
    >
      {/* Person Image (circular crop) */}
      <div className="relative w-full h-[55%] flex items-center justify-center pt-3">
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg">
          {mission.imageUrl ? (
            <img
              src={mission.imageUrl}
              alt={mission.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-placeholder flex items-center justify-center">
              <span className="text-3xl">{typeEmojis[relationshipType]}</span>
            </div>
          )}
        </div>

        {/* Relationship Badge */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 bg-ownyou-primary text-white px-2 py-0.5 rounded-full">
          <span className="font-label text-xs capitalize">
            {typeEmojis[relationshipType]} {relationshipType}
          </span>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-3 flex flex-col h-[45%] text-center">
        {/* Name */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-1">
          {mission.title}
        </h3>

        {/* Last Interaction */}
        {lastInteraction && (
          <p className="font-body text-xs text-gray-500 mt-1">
            Last seen: {lastInteraction}
          </p>
        )}

        {/* Suggested Action */}
        {suggestedAction && (
          <p className="font-body text-xs text-ownyou-primary mt-1 line-clamp-1">
            💡 {suggestedAction}
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

export default MissionCardPeople;
