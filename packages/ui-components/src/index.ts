/**
 * @ownyou/ui-components - v13 Section 3.4-3.5
 *
 * Shared UI components for OwnYou mission cards and feedback.
 *
 * @example
 * ```tsx
 * import { MissionCard, MissionFeed, FeedbackButtons } from '@ownyou/ui-components';
 *
 * // Display a single mission card
 * <MissionCard
 *   mission={mission}
 *   onAction={(m, action) => handleAction(m, action)}
 * />
 *
 * // Display a filtered feed of missions
 * <MissionFeed
 *   missions={missions}
 *   filter="active"
 *   onMissionAction={handleAction}
 * />
 *
 * // Standalone feedback buttons
 * <FeedbackButtons
 *   onFeedback={(rating) => saveFeedback(rating)}
 * />
 * ```
 */

// Components
export { MissionCard } from './MissionCard';
export { FeedbackButtons } from './FeedbackButtons';
export { MissionFeed, MissionFeedHeader } from './MissionFeed';

// Types
export type {
  FeedbackRating,
  MissionActionHandler,
  MissionFeedbackHandler,
  MissionCardProps,
  MissionFeedFilter,
  MissionFeedProps,
  FeedbackButtonsProps,
} from './types';

export { STATUS_LABELS, URGENCY_COLORS } from './types';
