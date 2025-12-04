/**
 * MissionCard Component - v13 Section 3.4
 *
 * Displays a mission card with actions and feedback buttons.
 */

import React from 'react';
import type { MissionCardProps } from './types';
import { STATUS_LABELS, URGENCY_COLORS } from './types';
import { FeedbackButtons } from './FeedbackButtons';

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  const prefix = diff < 0 ? '' : 'in ';
  const suffix = diff < 0 ? ' ago' : '';

  if (days > 0) return `${prefix}${days} day${days > 1 ? 's' : ''}${suffix}`;
  if (hours > 0) return `${prefix}${hours} hour${hours > 1 ? 's' : ''}${suffix}`;
  if (minutes > 0) return `${prefix}${minutes} min${suffix}`;
  return 'just now';
}

/**
 * MissionCard - Displays a mission card with actions
 *
 * @example
 * ```tsx
 * <MissionCard
 *   mission={mission}
 *   onAction={(m, action) => handleAction(m, action)}
 *   onFeedback={(m, rating) => saveFeedback(m.id, rating)}
 * />
 * ```
 */
export function MissionCard({
  mission,
  onAction,
  onFeedback,
  disabled = false,
  className = '',
}: MissionCardProps): React.ReactElement {
  const handlePrimaryAction = () => {
    if (!disabled && onAction) {
      onAction(mission, mission.primaryAction);
    }
  };

  const handleSecondaryAction = (index: number) => {
    if (!disabled && onAction && mission.secondaryActions?.[index]) {
      onAction(mission, mission.secondaryActions[index]);
    }
  };

  const handleFeedback = (rating: 'love' | 'like' | 'meh') => {
    if (!disabled && onFeedback) {
      onFeedback(mission, rating);
    }
  };

  const isExpired = Boolean(mission.expiresAt && mission.expiresAt < Date.now());
  const isSnoozed = mission.status === 'SNOOZED' && mission.snoozedUntil;

  return (
    <div
      className={`
        rounded-lg border border-gray-200 bg-white p-4 shadow-sm
        ${disabled ? 'opacity-60' : ''}
        ${isExpired ? 'border-red-200 bg-red-50' : ''}
        ${className}
      `.trim()}
      data-testid="mission-card"
      data-mission-id={mission.id}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Agent Type Badge */}
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 capitalize">
            {mission.type}
          </span>
          {/* Urgency Badge */}
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${URGENCY_COLORS[mission.urgency]}`}>
            {mission.urgency}
          </span>
        </div>
        {/* Status */}
        <span className="text-xs text-gray-500">
          {STATUS_LABELS[mission.status]}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 mb-1">
        {mission.title}
      </h3>

      {/* Summary */}
      <p className="text-sm text-gray-600 mb-3">
        {mission.summary}
      </p>

      {/* Meta Info */}
      <div className="text-xs text-gray-500 mb-4 space-y-1">
        <div>Created {formatRelativeTime(mission.createdAt)}</div>
        {mission.expiresAt && (
          <div className={isExpired ? 'text-red-600 font-medium' : ''}>
            {isExpired ? 'Expired' : `Expires ${formatRelativeTime(mission.expiresAt)}`}
          </div>
        )}
        {isSnoozed && mission.snoozedUntil && (
          <div className="text-yellow-600">
            Snoozed until {formatRelativeTime(mission.snoozedUntil)}
          </div>
        )}
      </div>

      {/* Ikigai Alignment */}
      {mission.ikigaiDimensions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {mission.ikigaiDimensions.map((dim) => (
            <span
              key={dim}
              className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700"
            >
              {dim}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Primary Action */}
        <button
          onClick={handlePrimaryAction}
          disabled={disabled || isExpired}
          className={`
            px-4 py-2 text-sm font-medium rounded-md
            bg-blue-600 text-white
            hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed
          `.trim()}
          data-testid="primary-action"
        >
          {mission.primaryAction.label}
        </button>

        {/* Secondary Actions */}
        {mission.secondaryActions?.map((action, index) => (
          <button
            key={index}
            onClick={() => handleSecondaryAction(index)}
            disabled={disabled}
            className={`
              px-4 py-2 text-sm font-medium rounded-md
              border border-gray-300 text-gray-700
              hover:bg-gray-50
              disabled:opacity-50 disabled:cursor-not-allowed
            `.trim()}
            data-testid={`secondary-action-${index}`}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Feedback (for completed missions) */}
      {mission.status === 'COMPLETED' && (
        <div className="border-t pt-3">
          <div className="text-xs text-gray-500 mb-2">How was this mission?</div>
          <FeedbackButtons
            onFeedback={handleFeedback}
            selected={mission.userRating === 5 ? 'love' : mission.userRating === 4 ? 'like' : mission.userRating === 3 ? 'meh' : undefined}
            disabled={disabled}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
