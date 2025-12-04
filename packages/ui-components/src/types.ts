/**
 * UI Components Types - v13 Section 3.4-3.5
 */

import type { MissionCard, MissionStatus, MissionAction } from '@ownyou/shared-types';

/**
 * User feedback rating
 */
export type FeedbackRating = 'love' | 'like' | 'meh';

/**
 * Mission card action handler
 */
export type MissionActionHandler = (
  mission: MissionCard,
  action: MissionAction
) => void | Promise<void>;

/**
 * Mission feedback handler
 */
export type MissionFeedbackHandler = (
  mission: MissionCard,
  rating: FeedbackRating
) => void | Promise<void>;

/**
 * Mission card component props
 */
export interface MissionCardProps {
  /** The mission card to display */
  mission: MissionCard;

  /** Handler for mission actions */
  onAction?: MissionActionHandler;

  /** Handler for feedback */
  onFeedback?: MissionFeedbackHandler;

  /** Whether actions are disabled */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Mission feed filter options
 */
export type MissionFeedFilter =
  | 'all'
  | 'active'
  | 'snoozed'
  | 'completed'
  | 'dismissed';

/**
 * Mission feed component props
 */
export interface MissionFeedProps {
  /** Missions to display */
  missions: MissionCard[];

  /** Filter to apply */
  filter?: MissionFeedFilter;

  /** Handler for mission actions */
  onMissionAction?: MissionActionHandler;

  /** Handler for mission feedback */
  onMissionFeedback?: MissionFeedbackHandler;

  /** Empty state message */
  emptyMessage?: string;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Feedback buttons component props
 */
export interface FeedbackButtonsProps {
  /** Handler for feedback selection */
  onFeedback: (rating: FeedbackRating) => void;

  /** Currently selected rating (if any) */
  selected?: FeedbackRating;

  /** Whether buttons are disabled */
  disabled?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Additional CSS classes */
  className?: string;
}

/**
 * Map mission status to display label
 */
export const STATUS_LABELS: Record<MissionStatus, string> = {
  CREATED: 'New',
  PRESENTED: 'Active',
  ACTIVE: 'In Progress',
  SNOOZED: 'Snoozed',
  DISMISSED: 'Dismissed',
  COMPLETED: 'Completed',
};

/**
 * Map urgency to color classes
 */
export const URGENCY_COLORS: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};
