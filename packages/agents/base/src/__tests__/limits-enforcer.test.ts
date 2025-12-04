/**
 * LimitsEnforcer Tests - v13 Section 3.6.3
 *
 * Tests for agent resource limit enforcement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LimitsEnforcer, LimitsExceededError } from '../limits-enforcer';
import { AGENT_LIMITS } from '@ownyou/shared-types';

describe('LimitsEnforcer', () => {
  describe('L1 limits', () => {
    let enforcer: LimitsEnforcer;

    beforeEach(() => {
      enforcer = new LimitsEnforcer('L1');
    });

    it('should initialize with L1 limits', () => {
      expect(enforcer.getLimits()).toEqual(AGENT_LIMITS.L1);
    });

    it('should track tool calls and throw when exceeded', () => {
      // L1 allows 3 tool calls
      enforcer.recordToolCall();
      enforcer.recordToolCall();
      enforcer.recordToolCall();

      expect(() => enforcer.recordToolCall()).toThrow(LimitsExceededError);
      try {
        enforcer.recordToolCall();
      } catch (e) {
        expect((e as LimitsExceededError).violation.limit).toBe('maxToolCalls');
      }
    });

    it('should track LLM calls and throw when exceeded', () => {
      // L1 allows 2 LLM calls
      enforcer.recordLlmCall();
      enforcer.recordLlmCall();

      expect(() => enforcer.recordLlmCall()).toThrow(LimitsExceededError);
      try {
        enforcer.recordLlmCall();
      } catch (e) {
        expect((e as LimitsExceededError).violation.limit).toBe('maxLlmCalls');
      }
    });

    it('should track memory reads and throw when exceeded', () => {
      // L1 allows 10 memory reads
      for (let i = 0; i < 10; i++) {
        enforcer.recordMemoryRead();
      }

      expect(() => enforcer.recordMemoryRead()).toThrow(LimitsExceededError);
      try {
        enforcer.recordMemoryRead();
      } catch (e) {
        expect((e as LimitsExceededError).violation.limit).toBe('maxMemoryReads');
      }
    });

    it('should track memory writes and throw when exceeded', () => {
      // L1 allows 3 memory writes
      enforcer.recordMemoryWrite();
      enforcer.recordMemoryWrite();
      enforcer.recordMemoryWrite();

      expect(() => enforcer.recordMemoryWrite()).toThrow(LimitsExceededError);
      try {
        enforcer.recordMemoryWrite();
      } catch (e) {
        expect((e as LimitsExceededError).violation.limit).toBe('maxMemoryWrites');
      }
    });

    it('should check timeout and throw when exceeded', async () => {
      // Create enforcer with custom 0.1s timeout for testing
      const shortEnforcer = new LimitsEnforcer('L1', { timeoutSeconds: 0.1 });

      // Should not throw initially
      shortEnforcer.checkTimeout();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(() => shortEnforcer.checkTimeout()).toThrow(LimitsExceededError);
      try {
        shortEnforcer.checkTimeout();
      } catch (e) {
        expect((e as LimitsExceededError).violation.limit).toBe('timeoutSeconds');
      }
    });

    it('should report current usage', () => {
      enforcer.recordToolCall();
      enforcer.recordLlmCall();
      enforcer.recordMemoryRead();
      enforcer.recordMemoryWrite();

      const usage = enforcer.getUsage();
      expect(usage.toolCalls).toBe(1);
      expect(usage.llmCalls).toBe(1);
      expect(usage.memoryReads).toBe(1);
      expect(usage.memoryWrites).toBe(1);
      expect(usage.elapsedSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should check if limit would be exceeded before operation', () => {
      enforcer.recordToolCall();
      enforcer.recordToolCall();

      // 2 tool calls used, 1 remaining
      expect(enforcer.canRecordToolCall()).toBe(true);

      enforcer.recordToolCall();
      // 3 tool calls used, none remaining
      expect(enforcer.canRecordToolCall()).toBe(false);
    });
  });

  describe('L2 limits', () => {
    let enforcer: LimitsEnforcer;

    beforeEach(() => {
      enforcer = new LimitsEnforcer('L2');
    });

    it('should initialize with L2 limits', () => {
      expect(enforcer.getLimits()).toEqual(AGENT_LIMITS.L2);
    });

    it('should allow more resources than L1', () => {
      // L2 allows 10 tool calls (vs L1's 3)
      for (let i = 0; i < 10; i++) {
        enforcer.recordToolCall();
      }

      expect(() => enforcer.recordToolCall()).toThrow(LimitsExceededError);
    });

    it('should track cost accumulation', () => {
      enforcer.recordLlmCall(0.01);
      enforcer.recordLlmCall(0.02);

      const usage = enforcer.getUsage();
      expect(usage.totalCostUsd).toBeCloseTo(0.03);
    });
  });

  describe('L3 limits', () => {
    let enforcer: LimitsEnforcer;

    beforeEach(() => {
      enforcer = new LimitsEnforcer('L3');
    });

    it('should initialize with L3 limits', () => {
      expect(enforcer.getLimits()).toEqual(AGENT_LIMITS.L3);
    });

    it('should allow the most resources', () => {
      // L3 allows 25 tool calls
      for (let i = 0; i < 25; i++) {
        enforcer.recordToolCall();
      }

      expect(() => enforcer.recordToolCall()).toThrow(LimitsExceededError);
    });
  });

  describe('custom limits', () => {
    it('should allow overriding specific limits', () => {
      const enforcer = new LimitsEnforcer('L1', { maxToolCalls: 5 });

      // Should have custom tool call limit
      expect(enforcer.getLimits().maxToolCalls).toBe(5);

      // Other limits should remain L1 defaults
      expect(enforcer.getLimits().maxLlmCalls).toBe(AGENT_LIMITS.L1.maxLlmCalls);
    });
  });

  describe('reset', () => {
    it('should reset all counters', () => {
      const enforcer = new LimitsEnforcer('L1');

      enforcer.recordToolCall();
      enforcer.recordLlmCall();
      enforcer.recordMemoryRead();

      enforcer.reset();

      const usage = enforcer.getUsage();
      expect(usage.toolCalls).toBe(0);
      expect(usage.llmCalls).toBe(0);
      expect(usage.memoryReads).toBe(0);
      expect(usage.memoryWrites).toBe(0);
    });
  });

  describe('getViolation', () => {
    it('should return violation details when limit exceeded', () => {
      const enforcer = new LimitsEnforcer('L1');

      // Exhaust tool calls
      for (let i = 0; i < 3; i++) {
        enforcer.recordToolCall();
      }

      const violation = enforcer.getViolation('maxToolCalls');
      expect(violation).toEqual({
        limit: 'maxToolCalls',
        current: 3,
        max: 3,
        message: expect.stringContaining('Tool call limit'),
      });
    });

    it('should return null when no violation', () => {
      const enforcer = new LimitsEnforcer('L1');
      enforcer.recordToolCall();

      const violation = enforcer.getViolation('maxToolCalls');
      expect(violation).toBeNull();
    });
  });
});
