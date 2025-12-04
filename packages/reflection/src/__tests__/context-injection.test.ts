/**
 * Context Injection Tests - v13 Section 8.8.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStore, InMemoryBackend, MockEmbeddingService } from '@ownyou/memory-store';
import { NS, type Memory, type Episode, type ProceduralRule } from '@ownyou/shared-types';
import {
  buildAgentContext,
  formatContextForPrompt,
  createEnrichedSystemPrompt,
  getContextStats,
} from '../context-injection';

// Mock the memory retrieval
vi.mock('@ownyou/memory', () => ({
  retrieveMemories: vi.fn().mockResolvedValue([
    {
      id: 'mem-1',
      content: 'User prefers window seats',
      context: 'travel',
      confidence: 0.9,
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 0.8,
      lastAccessed: Date.now(),
      accessCount: 3,
      sources: [],
      privacyTier: 'public',
    },
    {
      id: 'mem-2',
      content: 'User likes direct flights',
      context: 'travel',
      confidence: 0.85,
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 0.9,
      lastAccessed: Date.now(),
      accessCount: 5,
      sources: [],
      privacyTier: 'public',
    },
  ]),
}));

describe('Context Injection', () => {
  let store: MemoryStore;
  const userId = 'test-user';

  beforeEach(() => {
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      embeddingService: new MockEmbeddingService(),
    });
    vi.clearAllMocks();
  });

  describe('buildAgentContext', () => {
    it('should build context with memories and episodes', async () => {
      // Create some episodes
      await store.put(NS.episodicMemory(userId), 'ep-1', {
        id: 'ep-1',
        situation: 'User booked a flight',
        reasoning: 'Found best price',
        action: 'Booked LAX to JFK',
        outcome: 'success',
        agentType: 'travel',
        missionId: 'm1',
        timestamp: Date.now(),
        tags: [],
        userFeedback: 'like',
      } as Episode);

      // Create procedural rules
      await store.put(NS.proceduralMemory(userId, 'travel'), 'rules', {
        rules: [
          {
            id: 'rule-1',
            agentType: 'travel',
            rule: 'Always check for direct flights first',
            confidence: 0.85,
            derivedFrom: ['ep-1'],
            createdAt: Date.now(),
            lastValidated: Date.now(),
            overrideCount: 0,
          },
        ],
        synthesizedAt: Date.now(),
      });

      const context = await buildAgentContext(
        userId,
        'travel',
        'Find a flight to New York',
        store
      );

      expect(context.semanticMemories.length).toBe(2);
      expect(context.similarEpisodes.length).toBe(1);
      expect(context.proceduralRules.length).toBe(1);
    });
  });

  describe('formatContextForPrompt', () => {
    it('should format memories correctly', () => {
      const context = {
        semanticMemories: [
          {
            id: 'mem-1',
            content: 'User prefers window seats',
            context: 'travel',
            confidence: 0.9,
            validAt: Date.now(),
            createdAt: Date.now(),
            strength: 0.8,
            lastAccessed: Date.now(),
            accessCount: 1,
            sources: [],
            privacyTier: 'public' as const,
          },
        ],
        similarEpisodes: [],
        proceduralRules: [],
      };

      const formatted = formatContextForPrompt(context);

      expect(formatted).toContain('## What You Know About This User');
      expect(formatted).toContain('User prefers window seats');
      expect(formatted).toContain('confidence: 0.9');
    });

    it('should format episodes correctly', () => {
      const context = {
        semanticMemories: [],
        similarEpisodes: [
          {
            id: 'ep-1',
            situation: 'User needed hotel',
            reasoning: 'Searched 4-star hotels',
            action: 'Recommended Marriott',
            outcome: 'success' as const,
            agentType: 'travel',
            missionId: 'm1',
            timestamp: Date.now(),
            tags: [],
            userFeedback: 'love',
          },
        ],
        proceduralRules: [],
      };

      const formatted = formatContextForPrompt(context);

      expect(formatted).toContain('## Relevant Past Experiences');
      expect(formatted).toContain('**SUCCESS**');
      expect(formatted).toContain('User needed hotel');
      expect(formatted).toContain('Recommended Marriott');
    });

    it('should format rules correctly', () => {
      const context = {
        semanticMemories: [],
        similarEpisodes: [],
        proceduralRules: [
          {
            id: 'rule-1',
            agentType: 'shopping',
            rule: 'Always check for discount codes',
            confidence: 0.9,
            derivedFrom: [],
            createdAt: Date.now(),
            lastValidated: Date.now(),
            overrideCount: 0,
          },
        ],
      };

      const formatted = formatContextForPrompt(context);

      expect(formatted).toContain('## Learned Behaviors for This User');
      expect(formatted).toContain('Always check for discount codes');
    });

    it('should return empty string for empty context', () => {
      const context = {
        semanticMemories: [],
        similarEpisodes: [],
        proceduralRules: [],
      };

      const formatted = formatContextForPrompt(context);
      expect(formatted).toBe('');
    });
  });

  describe('createEnrichedSystemPrompt', () => {
    it('should append context to base prompt', () => {
      const basePrompt = 'You are a helpful travel assistant.';
      const context = {
        semanticMemories: [
          {
            id: 'mem-1',
            content: 'User likes luxury hotels',
            context: 'travel',
            confidence: 0.95,
            validAt: Date.now(),
            createdAt: Date.now(),
            strength: 1.0,
            lastAccessed: Date.now(),
            accessCount: 1,
            sources: [],
            privacyTier: 'public' as const,
          },
        ],
        similarEpisodes: [],
        proceduralRules: [],
      };

      const enriched = createEnrichedSystemPrompt(basePrompt, context);

      expect(enriched).toContain('You are a helpful travel assistant.');
      expect(enriched).toContain('---');
      expect(enriched).toContain('User likes luxury hotels');
    });

    it('should return base prompt for empty context', () => {
      const basePrompt = 'You are a helpful assistant.';
      const context = {
        semanticMemories: [],
        similarEpisodes: [],
        proceduralRules: [],
      };

      const enriched = createEnrichedSystemPrompt(basePrompt, context);
      expect(enriched).toBe(basePrompt);
    });
  });

  describe('getContextStats', () => {
    it('should calculate stats correctly', () => {
      const context = {
        semanticMemories: [
          {
            id: 'mem-1',
            content: 'Memory 1',
            context: 'test',
            confidence: 0.9,
            validAt: Date.now(),
            createdAt: Date.now(),
            strength: 1.0,
            lastAccessed: Date.now(),
            accessCount: 1,
            sources: [],
            privacyTier: 'public' as const,
          },
          {
            id: 'mem-2',
            content: 'Memory 2',
            context: 'test',
            confidence: 0.8,
            validAt: Date.now(),
            createdAt: Date.now(),
            strength: 1.0,
            lastAccessed: Date.now(),
            accessCount: 1,
            sources: [],
            privacyTier: 'public' as const,
          },
        ],
        similarEpisodes: [
          {
            id: 'ep-1',
            situation: 'Test',
            reasoning: 'Test',
            action: 'Test',
            outcome: 'success' as const,
            agentType: 'test',
            missionId: 'm1',
            timestamp: Date.now(),
            tags: [],
          },
        ],
        proceduralRules: [
          {
            id: 'rule-1',
            agentType: 'test',
            rule: 'Test rule',
            confidence: 0.9,
            derivedFrom: [],
            createdAt: Date.now(),
            lastValidated: Date.now(),
            overrideCount: 0,
          },
        ],
      };

      const stats = getContextStats(context);

      expect(stats.memoryCount).toBe(2);
      expect(stats.episodeCount).toBe(1);
      expect(stats.ruleCount).toBe(1);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
    });
  });
});
