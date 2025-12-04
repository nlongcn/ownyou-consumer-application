/**
 * Procedural Synthesis Tests - v13 Section 8.10.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStore, InMemoryBackend, MockEmbeddingService } from '@ownyou/memory-store';
import { NS, type Episode } from '@ownyou/shared-types';
import {
  synthesizeProceduralRules,
  getProceduralRules,
  recordRuleOverride,
  retireOverriddenRules,
} from '../procedural-synthesis';

// Mock LLM client
const mockLLM = {
  complete: vi.fn(),
};

describe('Procedural Synthesis', () => {
  let store: MemoryStore;
  const userId = 'test-user';

  beforeEach(() => {
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      embeddingService: new MockEmbeddingService(),
    });
    vi.clearAllMocks();
  });

  describe('synthesizeProceduralRules', () => {
    it('should return 0 with insufficient episodes', async () => {
      // Only 2 episodes (need at least 3)
      await store.put(NS.episodicMemory(userId), 'ep-1', {
        id: 'ep-1',
        situation: 'User wanted hotel',
        reasoning: 'Searched nearby',
        action: 'Recommended Hotel A',
        outcome: 'success',
        agentType: 'travel',
        missionId: 'm1',
        timestamp: Date.now(),
        tags: [],
      } as Episode);

      await store.put(NS.episodicMemory(userId), 'ep-2', {
        id: 'ep-2',
        situation: 'User wanted flight',
        reasoning: 'Searched deals',
        action: 'Found cheap flight',
        outcome: 'success',
        agentType: 'travel',
        missionId: 'm2',
        timestamp: Date.now(),
        tags: [],
      } as Episode);

      const result = await synthesizeProceduralRules(userId, store, mockLLM as any);
      expect(result).toBe(0);
    });

    it('should synthesize rules from multiple episodes', async () => {
      // Create 5 episodes for travel agent
      for (let i = 1; i <= 5; i++) {
        await store.put(NS.episodicMemory(userId), `ep-${i}`, {
          id: `ep-${i}`,
          situation: `User wanted ${i % 2 === 0 ? 'hotel' : 'flight'}`,
          reasoning: 'Applied user preferences',
          action: 'Found matching option',
          outcome: 'success',
          agentType: 'travel',
          missionId: `m${i}`,
          timestamp: Date.now() - i * 1000,
          tags: [],
        } as Episode);
      }

      // Mock LLM to return rules
      mockLLM.complete.mockResolvedValueOnce({
        content: JSON.stringify([
          {
            rule: 'Always check user preferences before searching',
            evidence: ['ep-1', 'ep-2', 'ep-3'],
            confidence: 0.85,
          },
        ]),
      });

      const result = await synthesizeProceduralRules(userId, store, mockLLM as any);
      expect(result).toBe(1);

      // Verify rule was stored
      const rules = await getProceduralRules(userId, 'travel', store);
      expect(rules.length).toBe(1);
      expect(rules[0].rule).toBe('Always check user preferences before searching');
    });

    it('should filter rules below confidence threshold', async () => {
      // Create episodes
      for (let i = 1; i <= 3; i++) {
        await store.put(NS.episodicMemory(userId), `ep-${i}`, {
          id: `ep-${i}`,
          situation: 'Test situation',
          reasoning: 'Test reasoning',
          action: 'Test action',
          outcome: 'success',
          agentType: 'shopping',
          missionId: `m${i}`,
          timestamp: Date.now(),
          tags: [],
        } as Episode);
      }

      // Mock LLM to return low-confidence rule
      mockLLM.complete.mockResolvedValueOnce({
        content: JSON.stringify([
          {
            rule: 'Low confidence rule',
            evidence: ['ep-1'],
            confidence: 0.5, // Below threshold
          },
        ]),
      });

      const result = await synthesizeProceduralRules(userId, store, mockLLM as any);
      expect(result).toBe(0);
    });
  });

  describe('getProceduralRules', () => {
    it('should return empty array when no rules exist', async () => {
      const rules = await getProceduralRules(userId, 'travel', store);
      expect(rules).toEqual([]);
    });

    it('should filter rules by confidence', async () => {
      // Store rules with varying confidence
      await store.put(NS.proceduralMemory(userId, 'shopping'), 'rules', {
        rules: [
          {
            id: 'rule-1',
            agentType: 'shopping',
            rule: 'High confidence',
            confidence: 0.9,
            derivedFrom: [],
            createdAt: Date.now(),
            lastValidated: Date.now(),
            overrideCount: 0,
          },
          {
            id: 'rule-2',
            agentType: 'shopping',
            rule: 'Low confidence',
            confidence: 0.4, // Below 0.5 threshold
            derivedFrom: [],
            createdAt: Date.now(),
            lastValidated: Date.now(),
            overrideCount: 0,
          },
        ],
        synthesizedAt: Date.now(),
      });

      const rules = await getProceduralRules(userId, 'shopping', store);
      expect(rules.length).toBe(1);
      expect(rules[0].rule).toBe('High confidence');
    });
  });

  describe('recordRuleOverride', () => {
    it('should increment override count', async () => {
      await store.put(NS.proceduralMemory(userId, 'travel'), 'rules', {
        rules: [
          {
            id: 'rule-1',
            agentType: 'travel',
            rule: 'Test rule',
            confidence: 0.8,
            derivedFrom: [],
            createdAt: Date.now(),
            lastValidated: Date.now(),
            overrideCount: 0,
          },
        ],
        synthesizedAt: Date.now(),
      });

      await recordRuleOverride(userId, 'travel', 'rule-1', store);

      const rules = await getProceduralRules(userId, 'travel', store);
      expect(rules[0].overrideCount).toBe(1);
      expect(rules[0].confidence).toBeCloseTo(0.7); // Reduced by 0.1
    });
  });

  describe('retireOverriddenRules', () => {
    it('should remove rules with too many overrides', async () => {
      await store.put(NS.proceduralMemory(userId, 'dining'), 'rules', {
        rules: [
          {
            id: 'rule-1',
            agentType: 'dining',
            rule: 'Good rule',
            confidence: 0.8,
            derivedFrom: [],
            createdAt: Date.now(),
            lastValidated: Date.now(),
            overrideCount: 1,
          },
          {
            id: 'rule-2',
            agentType: 'dining',
            rule: 'Bad rule',
            confidence: 0.3,
            derivedFrom: [],
            createdAt: Date.now(),
            lastValidated: Date.now(),
            overrideCount: 5, // Too many overrides
          },
        ],
        synthesizedAt: Date.now(),
      });

      const retired = await retireOverriddenRules(userId, 'dining', store, 3);
      expect(retired).toBe(1);

      const rules = await getProceduralRules(userId, 'dining', store);
      expect(rules.length).toBe(1);
      expect(rules[0].rule).toBe('Good rule');
    });
  });
});
