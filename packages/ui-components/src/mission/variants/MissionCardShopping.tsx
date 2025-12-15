/**
 * MissionCardShopping - Product recommendation card
 * v13 Section 4.5.1 - Shopping card (290px height)
 */

import { cn, Card, CardContent, cardDimensions, cardHeights, radius } from '@ownyou/ui-design-system';
import { FeedbackHeart } from '../FeedbackHeart';
import type { Mission, HeartState } from '../../types';

export interface MissionCardShoppingProps {
  mission: Mission;
  onClick?: () => void;
  onFeedbackChange?: (state: HeartState) => void;
  className?: string;
}

/**
 * Shopping card with product image, brand logo, title, and price
 */
export function MissionCardShopping({
  mission,
  onClick,
  onFeedbackChange,
  className,
}: MissionCardShoppingProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden cursor-pointer',
        'transition-transform duration-200 hover:scale-[1.02]',
        'active:scale-[0.98]',
        className,
      )}
      style={{ width: cardDimensions.width, height: cardHeights.shopping }}
      onClick={onClick}
      role="article"
      aria-label={`Shopping: ${mission.title}`}
      data-testid={`mission-card-shopping-${mission.id}`}
      data-mission-card
      data-mission-id={mission.id}
    >
      {/* Product Image */}
      <div className="relative w-full h-[55%] overflow-hidden">
        {mission.imageUrl ? (
          <img
            src={mission.imageUrl}
            alt={mission.title}
            className="w-full h-full object-cover"
            style={{ borderTopLeftRadius: radius.imageLarge, borderTopRightRadius: radius.imageLarge }}
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full bg-placeholder"
            style={{ borderTopLeftRadius: radius.imageLarge, borderTopRightRadius: radius.imageLarge }}
          />
        )}

        {/* Brand Logo */}
        {mission.brandLogoUrl && (
          <div className="absolute bottom-2 left-2 bg-white rounded-full p-1.5 shadow-md">
            <img
              src={mission.brandLogoUrl}
              alt={mission.brandName || 'Brand'}
              className="w-7 h-7 object-contain rounded-full"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3 flex flex-col h-[45%]">
        {/* Brand Name */}
        {mission.brandName && (
          <span className="font-brand text-xs text-gray-500 uppercase tracking-wide">
            {mission.brandName}
          </span>
        )}

        {/* Product Title */}
        <h3 className="font-display text-sm font-bold text-text-primary line-clamp-2 mt-1">
          {mission.title}
        </h3>

        {/* Price Row */}
        <div className="flex items-center gap-2 mt-auto">
          <span className="font-price text-base font-semibold text-text-primary">
            {mission.currency || '$'}{mission.price?.toFixed(2)}
          </span>
          {mission.originalPrice && mission.originalPrice > (mission.price || 0) && (
            <span className="font-price text-sm text-gray-400 line-through">
              {mission.currency || '$'}{mission.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

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

export default MissionCardShopping;
