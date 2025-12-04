/**
 * PrivacyGuard Tests - v13 Section 3.6.2 + 3.6.5
 *
 * Tests for agent namespace access control and privacy tier enforcement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrivacyGuard, PrivacyViolationError, PRIVACY_TIERS } from '../privacy-guard';
import type { AgentPermissions, Memory } from '@ownyou/shared-types';
import { NAMESPACES } from '@ownyou/shared-types';

describe('PrivacyGuard', () => {
  // Sample shopping agent permissions
  const shoppingPermissions: AgentPermissions = {
    agentType: 'shopping',
    memoryAccess: {
      read: [
        NAMESPACES.SEMANTIC_MEMORY,
        NAMESPACES.IAB_CLASSIFICATIONS,
        NAMESPACES.IKIGAI_PROFILE,
        NAMESPACES.MISSION_CARDS,
      ],
      write: [
        NAMESPACES.MISSION_CARDS,
        NAMESPACES.EPISODIC_MEMORY,
      ],
      search: [
        NAMESPACES.SEMANTIC_MEMORY,
        NAMESPACES.IAB_CLASSIFICATIONS,
      ],
    },
    externalApis: [],
    toolDefinitions: [],
  };

  let guard: PrivacyGuard;

  beforeEach(() => {
    guard = new PrivacyGuard(shoppingPermissions);
  });

  describe('read access', () => {
    it('should allow reading from permitted namespaces', () => {
      expect(guard.canRead(NAMESPACES.SEMANTIC_MEMORY)).toBe(true);
      expect(guard.canRead(NAMESPACES.IAB_CLASSIFICATIONS)).toBe(true);
      expect(guard.canRead(NAMESPACES.IKIGAI_PROFILE)).toBe(true);
      expect(guard.canRead(NAMESPACES.MISSION_CARDS)).toBe(true);
    });

    it('should deny reading from non-permitted namespaces', () => {
      expect(guard.canRead(NAMESPACES.PSEUDONYMS)).toBe(false);
      expect(guard.canRead(NAMESPACES.DISCLOSURE_HISTORY)).toBe(false);
      expect(guard.canRead(NAMESPACES.EARNINGS)).toBe(false);
    });

    it('should throw when asserting read on non-permitted namespace', () => {
      expect(() => guard.assertRead(NAMESPACES.PSEUDONYMS))
        .toThrow(PrivacyViolationError);
    });

    it('should not throw when asserting read on permitted namespace', () => {
      expect(() => guard.assertRead(NAMESPACES.SEMANTIC_MEMORY))
        .not.toThrow();
    });

    it('should include namespace in error message', () => {
      try {
        guard.assertRead(NAMESPACES.PSEUDONYMS);
      } catch (e) {
        expect((e as PrivacyViolationError).violation.namespace).toBe(NAMESPACES.PSEUDONYMS);
        expect((e as PrivacyViolationError).violation.operation).toBe('read');
      }
    });
  });

  describe('write access', () => {
    it('should allow writing to permitted namespaces', () => {
      expect(guard.canWrite(NAMESPACES.MISSION_CARDS)).toBe(true);
      expect(guard.canWrite(NAMESPACES.EPISODIC_MEMORY)).toBe(true);
    });

    it('should deny writing to non-permitted namespaces', () => {
      // Can read but not write
      expect(guard.canWrite(NAMESPACES.SEMANTIC_MEMORY)).toBe(false);
      expect(guard.canWrite(NAMESPACES.IAB_CLASSIFICATIONS)).toBe(false);
      // Can't access at all
      expect(guard.canWrite(NAMESPACES.PSEUDONYMS)).toBe(false);
    });

    it('should throw when asserting write on non-permitted namespace', () => {
      expect(() => guard.assertWrite(NAMESPACES.SEMANTIC_MEMORY))
        .toThrow(PrivacyViolationError);
    });

    it('should not throw when asserting write on permitted namespace', () => {
      expect(() => guard.assertWrite(NAMESPACES.MISSION_CARDS))
        .not.toThrow();
    });
  });

  describe('search access', () => {
    it('should allow searching in permitted namespaces', () => {
      expect(guard.canSearch(NAMESPACES.SEMANTIC_MEMORY)).toBe(true);
      expect(guard.canSearch(NAMESPACES.IAB_CLASSIFICATIONS)).toBe(true);
    });

    it('should deny searching in non-permitted namespaces', () => {
      // Can read but not search
      expect(guard.canSearch(NAMESPACES.IKIGAI_PROFILE)).toBe(false);
      // Can't access at all
      expect(guard.canSearch(NAMESPACES.PSEUDONYMS)).toBe(false);
    });

    it('should throw when asserting search on non-permitted namespace', () => {
      expect(() => guard.assertSearch(NAMESPACES.IKIGAI_PROFILE))
        .toThrow(PrivacyViolationError);
    });

    it('should not throw when asserting search on permitted namespace', () => {
      expect(() => guard.assertSearch(NAMESPACES.SEMANTIC_MEMORY))
        .not.toThrow();
    });
  });

  describe('getPermissions', () => {
    it('should return a copy of permissions', () => {
      const perms = guard.getPermissions();
      expect(perms).toEqual(shoppingPermissions);
      // Should be a copy, not the same reference
      expect(perms).not.toBe(shoppingPermissions);
    });
  });

  describe('recordAccess', () => {
    it('should track read access attempts', () => {
      guard.assertRead(NAMESPACES.SEMANTIC_MEMORY);
      guard.assertRead(NAMESPACES.IAB_CLASSIFICATIONS);

      const log = guard.getAccessLog();
      expect(log.length).toBe(2);
      expect(log[0]).toEqual({
        operation: 'read',
        namespace: NAMESPACES.SEMANTIC_MEMORY,
        allowed: true,
        timestamp: expect.any(Number),
      });
    });

    it('should track write access attempts', () => {
      guard.assertWrite(NAMESPACES.MISSION_CARDS);

      const log = guard.getAccessLog();
      expect(log.length).toBe(1);
      expect(log[0].operation).toBe('write');
      expect(log[0].allowed).toBe(true);
    });

    it('should track denied access attempts', () => {
      expect(() => guard.assertRead(NAMESPACES.PSEUDONYMS)).toThrow();

      const log = guard.getAccessLog();
      expect(log.length).toBe(1);
      expect(log[0].allowed).toBe(false);
    });
  });

  describe('clearAccessLog', () => {
    it('should clear the access log', () => {
      guard.assertRead(NAMESPACES.SEMANTIC_MEMORY);
      expect(guard.getAccessLog().length).toBe(1);

      guard.clearAccessLog();
      expect(guard.getAccessLog().length).toBe(0);
    });
  });

  describe('restrictive agent permissions', () => {
    it('should handle agent with no write permissions', () => {
      const readOnlyPermissions: AgentPermissions = {
        agentType: 'diagnostic',
        memoryAccess: {
          read: [NAMESPACES.AGENT_TRACES],
          write: [],
          search: [],
        },
        externalApis: [],
        toolDefinitions: [],
      };

      const restrictiveGuard = new PrivacyGuard(readOnlyPermissions);

      expect(restrictiveGuard.canRead(NAMESPACES.AGENT_TRACES)).toBe(true);
      expect(restrictiveGuard.canWrite(NAMESPACES.AGENT_TRACES)).toBe(false);
      expect(restrictiveGuard.canSearch(NAMESPACES.AGENT_TRACES)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Privacy-Tier Enforcement Tests (v13 Section 3.6.5)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PRIVACY_TIERS constant', () => {
    it('should define public tier with full cross-access', () => {
      expect(PRIVACY_TIERS.public.crossAccess).toBe('full');
      expect(PRIVACY_TIERS.public.domains).toContain('shopping');
      expect(PRIVACY_TIERS.public.domains).toContain('travel');
    });

    it('should define sensitive tier with justification required', () => {
      expect(PRIVACY_TIERS.sensitive.crossAccess).toBe('justification');
      expect(PRIVACY_TIERS.sensitive.domains).toContain('health');
      expect(PRIVACY_TIERS.sensitive.domains).toContain('finance');
    });

    it('should define private tier with no cross-access', () => {
      expect(PRIVACY_TIERS.private.crossAccess).toBe('none');
      expect(PRIVACY_TIERS.private.domains).toContain('medical');
      expect(PRIVACY_TIERS.private.domains).toContain('legal');
    });
  });

  describe('canAccessMemoryWithTier', () => {
    // Helper to create test memories
    const createTestMemory = (privacyTier: 'public' | 'sensitive' | 'private'): Memory => ({
      id: `mem_${privacyTier}_123`,
      content: 'Test memory content',
      context: 'test',
      createdAt: Date.now(),
      validAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      sources: [],
      confidence: 0.95,
      privacyTier,
    });

    it('should allow access to public tier memories', () => {
      const memory = createTestMemory('public');
      const result = guard.canAccessMemoryWithTier(memory);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny access to sensitive tier without justification', () => {
      const memory = createTestMemory('sensitive');
      const result = guard.canAccessMemoryWithTier(memory);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Justification required');
    });

    it('should allow access to sensitive tier with justification', () => {
      const memory = createTestMemory('sensitive');
      const result = guard.canAccessMemoryWithTier(
        memory,
        'User explicitly requested health-related recommendations'
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny access to private tier even with justification', () => {
      const memory = createTestMemory('private');
      const result = guard.canAccessMemoryWithTier(
        memory,
        'Trying to access for recommendations'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Private tier memory cannot be accessed');
    });

    it('should record tier access attempts in access log', () => {
      const publicMemory = createTestMemory('public');
      const sensitiveMemory = createTestMemory('sensitive');

      guard.clearAccessLog();
      guard.canAccessMemoryWithTier(publicMemory);
      guard.canAccessMemoryWithTier(sensitiveMemory);

      const log = guard.getAccessLog();
      expect(log.length).toBe(2);
      expect(log[0].namespace).toContain('tier:public');
      expect(log[0].allowed).toBe(true);
      expect(log[1].namespace).toContain('tier:sensitive');
      expect(log[1].allowed).toBe(false);
    });
  });

  describe('assertMemoryTierAccess', () => {
    const createTestMemory = (privacyTier: 'public' | 'sensitive' | 'private'): Memory => ({
      id: `mem_${privacyTier}_456`,
      content: 'Test memory content',
      context: 'test',
      createdAt: Date.now(),
      validAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      sources: [],
      confidence: 0.95,
      privacyTier,
    });

    it('should not throw for public tier', () => {
      const memory = createTestMemory('public');
      expect(() => guard.assertMemoryTierAccess(memory)).not.toThrow();
    });

    it('should throw for sensitive tier without justification', () => {
      const memory = createTestMemory('sensitive');
      expect(() => guard.assertMemoryTierAccess(memory)).toThrow(PrivacyViolationError);
    });

    it('should not throw for sensitive tier with justification', () => {
      const memory = createTestMemory('sensitive');
      expect(() =>
        guard.assertMemoryTierAccess(memory, 'User requested access')
      ).not.toThrow();
    });

    it('should throw for private tier', () => {
      const memory = createTestMemory('private');
      expect(() => guard.assertMemoryTierAccess(memory)).toThrow(PrivacyViolationError);
    });

    it('should include privacy tier violation details in error', () => {
      const memory = createTestMemory('private');
      try {
        guard.assertMemoryTierAccess(memory);
      } catch (e) {
        const error = e as PrivacyViolationError;
        expect(error.violation.message).toContain('Privacy tier violation');
        expect(error.violation.message).toContain('shopping');
        expect(error.violation.namespace).toContain(memory.id);
      }
    });
  });

  describe('inferPrivacyTier (static)', () => {
    it('should infer public tier for shopping context', () => {
      expect(PrivacyGuard.inferPrivacyTier('shopping')).toBe('public');
    });

    it('should infer public tier for travel context', () => {
      expect(PrivacyGuard.inferPrivacyTier('travel')).toBe('public');
    });

    it('should infer sensitive tier for health context', () => {
      expect(PrivacyGuard.inferPrivacyTier('health')).toBe('sensitive');
    });

    it('should infer sensitive tier for finance context', () => {
      expect(PrivacyGuard.inferPrivacyTier('finance')).toBe('sensitive');
    });

    it('should infer private tier for medical context', () => {
      expect(PrivacyGuard.inferPrivacyTier('medical')).toBe('private');
    });

    it('should infer private tier for legal context', () => {
      expect(PrivacyGuard.inferPrivacyTier('legal')).toBe('private');
    });

    it('should default to public for unknown context', () => {
      expect(PrivacyGuard.inferPrivacyTier('unknown')).toBe('public');
      expect(PrivacyGuard.inferPrivacyTier('')).toBe('public');
    });

    it('should be case-insensitive', () => {
      expect(PrivacyGuard.inferPrivacyTier('HEALTH')).toBe('sensitive');
      expect(PrivacyGuard.inferPrivacyTier('Medical')).toBe('private');
      expect(PrivacyGuard.inferPrivacyTier('Shopping')).toBe('public');
    });
  });

  describe('getTierConfig (static)', () => {
    it('should return config for public tier', () => {
      const config = PrivacyGuard.getTierConfig('public');
      expect(config.crossAccess).toBe('full');
      expect(config.domains.length).toBeGreaterThan(0);
    });

    it('should return config for sensitive tier', () => {
      const config = PrivacyGuard.getTierConfig('sensitive');
      expect(config.crossAccess).toBe('justification');
    });

    it('should return config for private tier', () => {
      const config = PrivacyGuard.getTierConfig('private');
      expect(config.crossAccess).toBe('none');
    });
  });
});
