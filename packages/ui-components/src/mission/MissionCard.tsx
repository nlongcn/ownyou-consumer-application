/**
 * MissionCard Dispatcher Component
 * v13 Section 4.5 - Mission Card Specifications
 *
 * Routes to specialized variant components based on mission type.
 * Each variant has unique styling and layout per Figma designs.
 */

import type { Mission, HeartState } from '../types';

// Import all variant components
import { MissionCardShopping } from './variants/MissionCardShopping';
import { MissionCardSavings } from './variants/MissionCardSavings';
import { MissionCardConsumables } from './variants/MissionCardConsumables';
import { MissionCardContent } from './variants/MissionCardContent';
import { MissionCardTravel } from './variants/MissionCardTravel';
import { MissionCardEntertainment } from './variants/MissionCardEntertainment';
import { MissionCardFood } from './variants/MissionCardFood';
import { MissionCardPeople } from './variants/MissionCardPeople';
import { MissionCardHealth } from './variants/MissionCardHealth';

export interface MissionCardProps {
  /** Mission data */
  mission: Mission;
  /** Click handler */
  onClick?: () => void;
  /** Feedback state change handler */
  onFeedbackChange?: (state: HeartState) => void;
  /** Snooze action handler - Sprint 11b Bugfix 8 */
  onSnooze?: () => void;
  /** Dismiss action handler - Sprint 11b Bugfix 8 */
  onDismiss?: () => void;
  /** Call-to-action handler - Sprint 11b Bugfix 8 */
  onCallToAction?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Show feedback heart (default: true) */
  showFeedback?: boolean;
}

/**
 * MissionCard dispatcher - routes to specialized variant based on mission.type
 *
 * Each variant implements type-specific layouts:
 * - shopping: Product with price, brand logo, 290px
 * - savings: Utility savings, brand logo, 284px
 * - consumables: Shopping list style, 284px
 * - content: Podcast/article with brand, 284px
 * - travel: Full-bleed destination image, 208px
 * - entertainment: Event with venue badge, 207px
 * - food: Recipe with difficulty badge, 287px
 * - people: Relationship suggestion, 210px
 * - health: Health metric, 180px
 */
export function MissionCard({
  mission,
  onClick,
  onFeedbackChange,
  onSnooze,
  onDismiss,
  onCallToAction,
  className,
  // showFeedback is maintained in the API for future flexibility
  // but currently all variants show feedback per Figma designs
  showFeedback: _showFeedback = true,
}: MissionCardProps) {
  // Common props for all variants
  const commonProps = {
    mission,
    onClick,
    onFeedbackChange,
    onSnooze,
    onDismiss,
    onCallToAction,
    className,
  };

  // Dispatch to the appropriate variant based on mission type
  switch (mission.type) {
    case 'shopping':
      return <MissionCardShopping {...commonProps} />;

    case 'savings':
      return <MissionCardSavings {...commonProps} />;

    case 'consumables':
      return <MissionCardConsumables {...commonProps} />;

    case 'content':
      return <MissionCardContent {...commonProps} />;

    case 'travel':
      return <MissionCardTravel {...commonProps} />;

    case 'entertainment':
      return <MissionCardEntertainment {...commonProps} />;

    case 'food':
      return <MissionCardFood {...commonProps} />;

    case 'people':
      return <MissionCardPeople {...commonProps} />;

    case 'health':
      return <MissionCardHealth {...commonProps} />;

    default:
      // Fallback to savings style for unknown types
      console.warn(`Unknown mission type: ${mission.type}, falling back to savings variant`);
      return <MissionCardSavings {...commonProps} />;
  }
}

export default MissionCard;
