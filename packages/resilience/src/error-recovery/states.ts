/**
 * Error Recovery States - v13 Section 6.11.5
 *
 * User-facing error states for graceful error handling.
 */

import type { UserErrorState, ErrorStateType } from '../types';

/**
 * Error states per v13 Section 6.11.5
 */
export const ERROR_STATES: Record<string, UserErrorState> = {
  // LLM-related errors
  llm_rate_limited: {
    type: 'temporary',
    message: 'AI is busy. Your request will process shortly.',
    retryInSeconds: 30,
  },
  llm_budget_exceeded: {
    type: 'degraded',
    message: 'Monthly AI budget reached. Using local processing.',
    capabilitiesAffected: [
      'Complex analysis',
      'Multi-step missions',
      'Quality recommendations',
    ],
  },
  llm_timeout: {
    type: 'temporary',
    message: 'Request took too long. Please try again.',
    retryInSeconds: 10,
  },
  llm_unavailable: {
    type: 'degraded',
    message: 'AI services temporarily unavailable. Using cached responses.',
    capabilitiesAffected: [
      'Real-time recommendations',
      'New classifications',
    ],
  },

  // API-related errors
  api_circuit_open: {
    type: 'temporary',
    message: 'Service temporarily unavailable. Please try again later.',
    retryInSeconds: 60,
  },
  api_rate_limited: {
    type: 'temporary',
    message: 'Too many requests. Slowing down.',
    retryInSeconds: 30,
  },
  api_timeout: {
    type: 'temporary',
    message: 'External service is slow. Retrying...',
    retryInSeconds: 15,
  },

  // Authentication errors - v13: reauth_prompt patterns
  plaid_reauth_needed: {
    type: 'action_required',
    message: 'Please reconnect your bank account to continue.',
    action: { label: 'Reconnect Bank', actionType: 'PLAID_LINK' },
  },
  email_reauth_needed: {
    type: 'action_required',
    message: 'Email access expired. Please reconnect.',
    action: { label: 'Reconnect Email', actionType: 'EMAIL_OAUTH' },
  },
  calendar_reauth_needed: {
    type: 'action_required',
    message: 'Calendar access expired. Please reconnect.',
    action: { label: 'Reconnect Calendar', actionType: 'CALENDAR_OAUTH' },
  },

  // Sync errors - v13: sync_offline
  sync_offline: {
    type: 'offline',
    message: "You're offline. Some features are limited.",
    availableOffline: [
      'View saved missions',
      'Browse profile',
      'Local search',
      'View earnings history',
    ],
  },
  sync_conflict: {
    type: 'action_required',
    message: 'Data sync conflict detected. Please resolve.',
    action: { label: 'Resolve Conflict', actionType: 'SYNC_RESOLVE' },
  },
  sync_failed: {
    type: 'temporary',
    message: 'Sync failed. Will retry automatically.',
    retryInSeconds: 60,
  },

  // Data errors
  data_corrupted: {
    type: 'action_required',
    message: 'Some data appears corrupted. Would you like to restore from backup?',
    action: { label: 'Restore Backup', actionType: 'RESTORE_BACKUP' },
  },
  data_insufficient: {
    type: 'action_required',
    message: 'Not enough data for accurate recommendations. Connect more sources.',
    action: { label: 'Connect Sources', actionType: 'DATA_SOURCES' },
  },

  // Storage errors
  storage_quota_exceeded: {
    type: 'action_required',
    message: 'Storage is full. Please free up space.',
    action: { label: 'Manage Storage', actionType: 'STORAGE_SETTINGS' },
  },
  storage_unavailable: {
    type: 'temporary',
    message: 'Local storage unavailable. Using memory only.',
    retryInSeconds: 10,
  },
};

/**
 * Get error state by code
 */
export function getErrorState(errorCode: string): UserErrorState | undefined {
  return ERROR_STATES[errorCode];
}

/**
 * Create a custom error state
 */
export function createErrorState(
  type: ErrorStateType,
  message: string,
  options?: Partial<UserErrorState>
): UserErrorState {
  return { type, message, ...options };
}

/**
 * Map an error to an error state code
 *
 * @param error - The error to map
 * @returns Error state code or undefined if not mappable
 */
export function mapErrorToStateCode(error: Error | string): string | undefined {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Rate limiting
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
    if (lowerMessage.includes('llm') || lowerMessage.includes('ai')) {
      return 'llm_rate_limited';
    }
    return 'api_rate_limited';
  }

  // Timeout
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    if (lowerMessage.includes('llm') || lowerMessage.includes('ai')) {
      return 'llm_timeout';
    }
    return 'api_timeout';
  }

  // Circuit breaker
  if (lowerMessage.includes('circuit') && lowerMessage.includes('open')) {
    return 'api_circuit_open';
  }

  // Budget
  if (lowerMessage.includes('budget') && lowerMessage.includes('exceeded')) {
    return 'llm_budget_exceeded';
  }

  // Offline
  if (lowerMessage.includes('offline') || lowerMessage.includes('network')) {
    return 'sync_offline';
  }

  // Storage
  if (lowerMessage.includes('quota') || lowerMessage.includes('storage')) {
    return 'storage_quota_exceeded';
  }

  return undefined;
}

/**
 * Check if an error state is retryable
 */
export function isRetryable(errorCode: string): boolean {
  const state = ERROR_STATES[errorCode];
  return state?.type === 'temporary' && state.retryInSeconds !== undefined;
}

/**
 * Check if an error state requires user action
 */
export function requiresAction(errorCode: string): boolean {
  const state = ERROR_STATES[errorCode];
  return state?.type === 'action_required' && state.action !== undefined;
}

/**
 * Get all error codes by type
 */
export function getErrorCodesByType(type: ErrorStateType): string[] {
  return Object.entries(ERROR_STATES)
    .filter(([_, state]) => state.type === type)
    .map(([code, _]) => code);
}
