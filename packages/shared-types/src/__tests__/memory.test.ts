/**
 * Memory Types Tests - v13 Section 8.4
 *
 * Tests that Memory, Episode, ProceduralRule, and SyncableMemory types
 * are correctly defined per the v13 architecture specification.
 */
import { describe, it, expect } from 'vitest';
import type {
  Memory,
  PrivacyTier,
  Episode,
  AgentType,
  ProceduralRule,
  SyncableMemory,
  ConflictStrategy,
} from '../memory';

describe('Memory Types (v13 Section 8.4)', () => {
  describe('Memory interface', () => {
    it('should have all required fields per v13 Section 8.4.1', () => {
      const memory: Memory = {
        id: 'mem_123',
        content: 'User prefers direct flights',
        context: 'travel',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: ['episode_456'],
        confidence: 0.95,
        privacyTier: 'public',
      };

      expect(memory.id).toBe('mem_123');
      expect(memory.content).toBeDefined();
      expect(memory.context).toBeDefined();
      expect(memory.validAt).toBeDefined();
      expect(memory.createdAt).toBeDefined();
      expect(memory.strength).toBe(1.0);
      expect(memory.lastAccessed).toBeDefined();
      expect(memory.accessCount).toBe(0);
      expect(memory.sources).toHaveLength(1);
      expect(memory.confidence).toBe(0.95);
      expect(memory.privacyTier).toBe('public');
    });

    it('should support optional invalidAt for bi-temporal model', () => {
      const memory: Memory = {
        id: 'mem_456',
        content: 'User lived in NYC',
        context: 'personal',
        validAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        invalidAt: Date.now(), // No longer true
        createdAt: Date.now(),
        strength: 0.8,
        lastAccessed: Date.now(),
        accessCount: 5,
        sources: ['episode_789'],
        confidence: 0.9,
        privacyTier: 'sensitive',
      };

      expect(memory.invalidAt).toBeDefined();
    });

    it('should support optional embedding for vector search', () => {
      const memory: Memory = {
        id: 'mem_789',
        content: 'User enjoys hiking',
        context: 'interests',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 0.85,
        privacyTier: 'public',
        embedding: new Array(768).fill(0.1), // nomic-embed-text-v1.5 dimensions
      };

      expect(memory.embedding).toHaveLength(768);
    });

    it('should support optional contradictions field', () => {
      const memory: Memory = {
        id: 'mem_abc',
        content: 'User is vegetarian',
        context: 'dining',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.7,
        lastAccessed: Date.now(),
        accessCount: 2,
        sources: ['episode_111'],
        confidence: 0.6,
        privacyTier: 'public',
        contradictions: ['mem_def'], // Conflicting memory
      };

      expect(memory.contradictions).toContain('mem_def');
    });
  });

  describe('PrivacyTier type', () => {
    it('should allow public, sensitive, and private values', () => {
      const tiers: PrivacyTier[] = ['public', 'sensitive', 'private'];
      expect(tiers).toHaveLength(3);
    });
  });

  describe('Episode interface (v13 Section 8.4.2)', () => {
    it('should have all required fields for few-shot learning', () => {
      const episode: Episode = {
        id: 'ep_123',
        situation: 'User asked for flight recommendations to Paris',
        reasoning: 'Searched for direct flights, filtered by price range',
        action: 'Presented 3 flight options with prices',
        outcome: 'User selected the mid-range option',
        agentType: 'travel',
        missionId: 'mission_456',
        timestamp: Date.now(),
        tags: ['booking', 'flight', 'success'],
      };

      expect(episode.situation).toBeDefined();
      expect(episode.reasoning).toBeDefined();
      expect(episode.action).toBeDefined();
      expect(episode.outcome).toBeDefined();
      expect(episode.agentType).toBe('travel');
      expect(episode.tags).toContain('flight');
    });

    it('should support optional userFeedback', () => {
      const episode: Episode = {
        id: 'ep_456',
        situation: 'Restaurant recommendation',
        reasoning: 'Filtered by cuisine preference',
        action: 'Suggested Italian restaurant',
        outcome: 'User visited and enjoyed',
        userFeedback: 'love',
        agentType: 'restaurant',
        missionId: 'mission_789',
        timestamp: Date.now(),
        tags: ['restaurant', 'positive'],
      };

      expect(episode.userFeedback).toBe('love');
    });

    it('should support optional embedding', () => {
      const episode: Episode = {
        id: 'ep_789',
        situation: 'Shopping assistance',
        reasoning: 'Analyzed preferences',
        action: 'Recommended products',
        outcome: 'User purchased item',
        agentType: 'shopping',
        missionId: 'mission_abc',
        timestamp: Date.now(),
        tags: ['shopping'],
        embedding: new Array(768).fill(0.1),
      };

      expect(episode.embedding).toBeDefined();
    });
  });

  describe('AgentType type', () => {
    it('should include all v13 agent types', () => {
      const agentTypes: AgentType[] = [
        'shopping',
        'travel',
        'restaurant',
        'events',
        'content',
        'diagnostic',
      ];
      expect(agentTypes).toHaveLength(6);
    });
  });

  describe('ProceduralRule interface (v13 Section 8.4.3)', () => {
    it('should have all required fields for agent rules', () => {
      const rule: ProceduralRule = {
        id: 'rule_123',
        agentType: 'travel',
        rule: 'Always filter for direct flights first - user has strong aversion to layovers',
        derivedFrom: ['episode_123', 'episode_456'],
        createdAt: Date.now(),
        confidence: 0.95,
        applicationCount: 10,
        overrideCount: 0,
      };

      expect(rule.rule).toContain('direct flights');
      expect(rule.derivedFrom).toHaveLength(2);
      expect(rule.confidence).toBeGreaterThan(0.9);
    });

    it('should support optional embedding', () => {
      const rule: ProceduralRule = {
        id: 'rule_456',
        agentType: 'shopping',
        rule: 'Suggest mid-range options before budget',
        derivedFrom: ['episode_789'],
        createdAt: Date.now(),
        confidence: 0.8,
        applicationCount: 5,
        overrideCount: 1,
        embedding: new Array(768).fill(0.1),
      };

      expect(rule.embedding).toBeDefined();
    });
  });

  describe('SyncableMemory wrapper (v13 Section 8.14)', () => {
    it('should wrap any type with sync metadata', () => {
      const syncable: SyncableMemory<Memory> = {
        data: {
          id: 'mem_sync',
          content: 'Synced memory',
          context: 'test',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 1.0,
          lastAccessed: Date.now(),
          accessCount: 0,
          sources: [],
          confidence: 1.0,
          privacyTier: 'public',
        },
        syncId: 'sync_123',
        deviceId: 'device_456',
        vectorClock: { device_456: 1 },
        conflictStrategy: 'latest_wins',
      };

      expect(syncable.syncId).toBeDefined();
      expect(syncable.deviceId).toBeDefined();
      expect(syncable.vectorClock).toBeDefined();
      expect(syncable.conflictStrategy).toBe('latest_wins');
    });

    it('should support optional lastSyncedAt', () => {
      const syncable: SyncableMemory<Episode> = {
        data: {
          id: 'ep_sync',
          situation: 'Test',
          reasoning: 'Test',
          action: 'Test',
          outcome: 'Test',
          agentType: 'diagnostic',
          missionId: 'mission_sync',
          timestamp: Date.now(),
          tags: [],
        },
        syncId: 'sync_456',
        deviceId: 'device_789',
        vectorClock: { device_789: 1, device_abc: 2 },
        lastSyncedAt: Date.now(),
        conflictStrategy: 'merge',
      };

      expect(syncable.lastSyncedAt).toBeDefined();
    });
  });

  describe('ConflictStrategy type', () => {
    it('should include all v13 conflict strategies', () => {
      const strategies: ConflictStrategy[] = [
        'latest_wins',
        'merge',
        'manual',
        'sum',
      ];
      expect(strategies).toHaveLength(4);
    });
  });
});
