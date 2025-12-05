/**
 * Error Recovery Tests - v13 Section 6.11.5
 */

import { describe, it, expect } from 'vitest';
import {
  ERROR_STATES,
  getErrorState,
  createErrorState,
  mapErrorToStateCode,
  isRetryable,
  requiresAction,
  getErrorCodesByType,
} from '../error-recovery';

describe('Error Recovery', () => {
  describe('ERROR_STATES', () => {
    it('should have all v13 error states', () => {
      expect(ERROR_STATES.llm_rate_limited).toBeDefined();
      expect(ERROR_STATES.llm_budget_exceeded).toBeDefined();
      expect(ERROR_STATES.api_circuit_open).toBeDefined();
      expect(ERROR_STATES.plaid_reauth_needed).toBeDefined();
      expect(ERROR_STATES.email_reauth_needed).toBeDefined();
      expect(ERROR_STATES.sync_offline).toBeDefined();
    });

    it('should have correct types for each state', () => {
      expect(ERROR_STATES.llm_rate_limited.type).toBe('temporary');
      expect(ERROR_STATES.llm_budget_exceeded.type).toBe('degraded');
      expect(ERROR_STATES.plaid_reauth_needed.type).toBe('action_required');
      expect(ERROR_STATES.sync_offline.type).toBe('offline');
    });

    it('should have retry times for temporary errors', () => {
      expect(ERROR_STATES.llm_rate_limited.retryInSeconds).toBe(30);
      expect(ERROR_STATES.api_circuit_open.retryInSeconds).toBe(60);
    });

    it('should have actions for action_required errors', () => {
      expect(ERROR_STATES.plaid_reauth_needed.action).toBeDefined();
      expect(ERROR_STATES.plaid_reauth_needed.action?.label).toBe('Reconnect Bank');
      expect(ERROR_STATES.plaid_reauth_needed.action?.actionType).toBe('PLAID_LINK');
    });

    it('should have offline features list', () => {
      expect(ERROR_STATES.sync_offline.availableOffline).toBeDefined();
      expect(ERROR_STATES.sync_offline.availableOffline).toContain('View saved missions');
      expect(ERROR_STATES.sync_offline.availableOffline).toContain('Browse profile');
    });

    it('should have capabilities affected for degraded errors', () => {
      expect(ERROR_STATES.llm_budget_exceeded.capabilitiesAffected).toBeDefined();
      expect(ERROR_STATES.llm_budget_exceeded.capabilitiesAffected).toContain('Complex analysis');
    });
  });

  describe('getErrorState', () => {
    it('should return state for known codes', () => {
      const state = getErrorState('llm_rate_limited');
      expect(state).toBeDefined();
      expect(state?.type).toBe('temporary');
      expect(state?.message).toContain('AI is busy');
    });

    it('should return undefined for unknown codes', () => {
      expect(getErrorState('unknown_error')).toBeUndefined();
    });
  });

  describe('createErrorState', () => {
    it('should create basic error state', () => {
      const state = createErrorState('temporary', 'Test error');
      expect(state.type).toBe('temporary');
      expect(state.message).toBe('Test error');
    });

    it('should create error state with options', () => {
      const state = createErrorState('action_required', 'Need action', {
        action: { label: 'Do Something', actionType: 'CUSTOM' },
      });
      expect(state.type).toBe('action_required');
      expect(state.action?.label).toBe('Do Something');
    });
  });

  describe('mapErrorToStateCode', () => {
    it('should map rate limit errors', () => {
      expect(mapErrorToStateCode('Rate limit exceeded')).toBe('api_rate_limited');
      expect(mapErrorToStateCode(new Error('429 Too Many Requests'))).toBe('api_rate_limited');
      expect(mapErrorToStateCode('LLM rate limit hit')).toBe('llm_rate_limited');
    });

    it('should map timeout errors', () => {
      expect(mapErrorToStateCode('Request timed out')).toBe('api_timeout');
      expect(mapErrorToStateCode(new Error('LLM timeout after 30s'))).toBe('llm_timeout');
    });

    it('should map circuit breaker errors', () => {
      expect(mapErrorToStateCode('Circuit breaker is open')).toBe('api_circuit_open');
    });

    it('should map budget errors', () => {
      expect(mapErrorToStateCode('Budget exceeded for this month')).toBe('llm_budget_exceeded');
    });

    it('should map offline errors', () => {
      expect(mapErrorToStateCode('Network offline')).toBe('sync_offline');
      expect(mapErrorToStateCode(new Error('No network connection'))).toBe('sync_offline');
    });

    it('should map storage errors', () => {
      expect(mapErrorToStateCode('Storage quota exceeded')).toBe('storage_quota_exceeded');
    });

    it('should return undefined for unmappable errors', () => {
      expect(mapErrorToStateCode('Some random error')).toBeUndefined();
    });
  });

  describe('isRetryable', () => {
    it('should return true for temporary errors with retry time', () => {
      expect(isRetryable('llm_rate_limited')).toBe(true);
      expect(isRetryable('api_circuit_open')).toBe(true);
      expect(isRetryable('api_timeout')).toBe(true);
    });

    it('should return false for non-temporary errors', () => {
      expect(isRetryable('llm_budget_exceeded')).toBe(false);
      expect(isRetryable('plaid_reauth_needed')).toBe(false);
      expect(isRetryable('sync_offline')).toBe(false);
    });

    it('should return false for unknown error codes', () => {
      expect(isRetryable('unknown_error')).toBe(false);
    });
  });

  describe('requiresAction', () => {
    it('should return true for action_required errors', () => {
      expect(requiresAction('plaid_reauth_needed')).toBe(true);
      expect(requiresAction('email_reauth_needed')).toBe(true);
      expect(requiresAction('data_corrupted')).toBe(true);
    });

    it('should return false for non-action errors', () => {
      expect(requiresAction('llm_rate_limited')).toBe(false);
      expect(requiresAction('sync_offline')).toBe(false);
    });

    it('should return false for unknown error codes', () => {
      expect(requiresAction('unknown_error')).toBe(false);
    });
  });

  describe('getErrorCodesByType', () => {
    it('should return all temporary error codes', () => {
      const codes = getErrorCodesByType('temporary');
      expect(codes).toContain('llm_rate_limited');
      expect(codes).toContain('api_circuit_open');
      expect(codes).toContain('api_timeout');
    });

    it('should return all action_required error codes', () => {
      const codes = getErrorCodesByType('action_required');
      expect(codes).toContain('plaid_reauth_needed');
      expect(codes).toContain('email_reauth_needed');
      expect(codes).toContain('calendar_reauth_needed');
    });

    it('should return all degraded error codes', () => {
      const codes = getErrorCodesByType('degraded');
      expect(codes).toContain('llm_budget_exceeded');
      expect(codes).toContain('llm_unavailable');
    });

    it('should return all offline error codes', () => {
      const codes = getErrorCodesByType('offline');
      expect(codes).toContain('sync_offline');
    });
  });
});
