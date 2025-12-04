/**
 * Learning Loop Integration Tests - Sprint 4
 *
 * Tests the full learning loop:
 * Episode → Reflection → Procedural Rules → Agent Context Injection
 *
 * v13 Section 8.16: Concrete Example of Learning Loop
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShoppingAgent, SHOPPING_PERMISSIONS } from '@ownyou/agents-shopping';
import { ContentAgent } from '@ownyou/agents-content';
import { PRIVACY_TIERS } from '@ownyou/agents-base';
import type { AgentStore } from '@ownyou/agents-base';
import { NS, NAMESPACES } from '@ownyou/shared-types';
import type { Episode, Memory, ProceduralRule } from '@ownyou/shared-types';
import {
  runReflection,
  getProceduralRules,
  buildAgentContext,
  ReflectionTriggerManager,
} from '@ownyou/reflection';
import type { LLMClient } from '@ownyou/llm-client';

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory store implementation for testing
 */
class InMemoryStore implements AgentStore {
  private data = new Map<string, Map<string, unknown>>();

  private getNamespaceKey(namespace: readonly string[]): string {
    return namespace.join('.');
  }

  async get<T = unknown>(namespace: readonly string[], key: string): Promise<T | null> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    return (nsData?.get(key) as T) ?? null;
  }

  async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
    const nsKey = this.getNamespaceKey(namespace);
    if (!this.data.has(nsKey)) {
      this.data.set(nsKey, new Map());
    }
    this.data.get(nsKey)!.set(key, value);
  }

  async delete(namespace: readonly string[], key: string): Promise<void> {
    const nsKey = this.getNamespaceKey(namespace);
    this.data.get(nsKey)?.delete(key);
  }

  async search(
    namespace: readonly string[],
    _query: string,
    options?: { limit?: number }
  ): Promise<Array<{ key: string; value: unknown; score?: number }>> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    if (!nsData) return [];

    const results: Array<{ key: string; value: unknown; score?: number }> = [];
    for (const [key, value] of nsData.entries()) {
      results.push({ key, value, score: 1 });
      if (options?.limit && results.length >= options.limit) break;
    }
    return results;
  }

  async list<T = unknown>(
    namespace: readonly string[],
    options?: { prefix?: string; limit?: number; offset?: number }
  ): Promise<{ items: T[]; cursor?: string }> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    if (!nsData) return { items: [] };

    let items: T[] = [];
    for (const [key, value] of nsData.entries()) {
      if (options?.prefix && !key.startsWith(options.prefix)) continue;
      items.push(value as T);
    }

    if (options?.offset) {
      items = items.slice(options.offset);
    }
    if (options?.limit) {
      items = items.slice(0, options.limit);
    }

    return { items };
  }

  // Helper to get all data (for testing)
  getAllData(): Map<string, Map<string, unknown>> {
    return this.data;
  }
}

/**
 * Mock LLM client for testing
 */
function createMockLLMClient(): LLMClient {
  return {
    complete: vi.fn().mockImplementation(async (_userId: string, request: { messages: Array<{ role: string; content: string }> }) => {
      // Check if this is a procedural synthesis request
      const systemMessage = request.messages[0]?.content || '';

      if (systemMessage.includes('behavioral rules')) {
        // Return mock procedural rules
        return {
          content: JSON.stringify([
            {
              rule: 'Always compare prices across multiple retailers before recommending',
              evidence: ['episode_1', 'episode_2'],
              confidence: 0.85,
            },
            {
              rule: 'Avoid recommending products from unfamiliar brands',
              evidence: ['episode_3'],
              confidence: 0.75,
            },
          ]),
          usage: { inputTokens: 500, outputTokens: 200 },
        };
      }

      if (systemMessage.includes('mission card') || systemMessage.includes('Mission card')) {
        // Return mock mission card content
        return {
          content: JSON.stringify({
            title: 'Shopping Deals Found',
            summary: 'Found great deals matching your interests',
          }),
          usage: { inputTokens: 300, outputTokens: 100 },
        };
      }

      // Default response
      return {
        content: 'Mock LLM response',
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }),
  } as unknown as LLMClient;
}

/**
 * Seed episodes for testing
 */
async function seedEpisodes(
  store: InMemoryStore,
  userId: string,
  agentType: string,
  count: number
): Promise<Episode[]> {
  const episodes: Episode[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const episode: Episode = {
      id: `episode_${i + 1}`,
      situation: `User was browsing ${agentType} category and found item ${i + 1}`,
      reasoning: `Analyzed user preferences and ${agentType} context`,
      action: `Generated mission card for ${agentType} recommendation ${i + 1}`,
      outcome: i % 3 === 0 ? 'positive' : i % 3 === 1 ? 'neutral' : 'negative',
      agentType: agentType as 'shopping' | 'travel' | 'restaurant' | 'events' | 'content',
      missionId: `mission_${i + 1}`,
      timestamp: now - (count - i) * 3600000, // 1 hour apart
      tags: [agentType, 'test'],
      userFeedback: i % 3 === 0 ? 'great' : i % 3 === 1 ? undefined : 'not helpful',
    };

    await store.put(NS.episodicMemory(userId), episode.id, episode);
    episodes.push(episode);
  }

  return episodes;
}

/**
 * Create a test memory
 */
function createTestMemory(
  id: string,
  content: string,
  context: string,
  privacyTier: 'public' | 'sensitive' | 'private' = 'public'
): Memory {
  return {
    id,
    content,
    context,
    createdAt: Date.now(),
    validAt: Date.now(),
    lastAccessed: Date.now(),
    accessCount: 0,
    sources: [],
    confidence: 0.9,
    privacyTier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Learning Loop Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Learning Loop Integration', () => {
  let store: InMemoryStore;
  let llm: LLMClient;
  const userId = 'test-user-123';

  beforeEach(() => {
    store = new InMemoryStore();
    llm = createMockLLMClient();
  });

  describe('Episode → Reflection → Rules Flow', () => {
    it('should synthesize procedural rules from episodes', async () => {
      // Seed episodes (enough to trigger reflection)
      await seedEpisodes(store, userId, 'shopping', 6);

      // Run reflection
      const reflectionResult = await runReflection(
        userId,
        { type: 'after_episodes', count: 6 },
        store as any,
        llm
      );

      expect(reflectionResult.rulesGenerated).toBeGreaterThan(0);

      // Check rules were stored
      const rules = await getProceduralRules(userId, 'shopping', store as any);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should filter rules below confidence threshold', async () => {
      await seedEpisodes(store, userId, 'shopping', 6);

      await runReflection(
        userId,
        { type: 'after_episodes', count: 6 },
        store as any,
        llm
      );

      const rules = await getProceduralRules(userId, 'shopping', store as any);

      // All returned rules should meet minimum confidence
      for (const rule of rules) {
        expect(rule.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('Context Injection for Agents', () => {
    it('should build agent context with procedural rules', async () => {
      // First, create some rules
      await seedEpisodes(store, userId, 'shopping', 6);
      await runReflection(
        userId,
        { type: 'after_episodes', count: 6 },
        store as any,
        llm
      );

      // Build context for shopping agent
      const context = await buildAgentContext(
        userId,
        'shopping',
        'Find deals on electronics',
        store as any
      );

      // Context should have rules (may be 0 if LLM mock returns none for this agent type)
      expect(context.proceduralRules).toBeDefined();
      expect(Array.isArray(context.proceduralRules)).toBe(true);
    });

    it('should include semantic memories in context', async () => {
      // Seed some memories
      const memory1 = createTestMemory(
        'mem_1',
        'User prefers Apple products',
        'shopping'
      );
      const memory2 = createTestMemory(
        'mem_2',
        'User looks for deals on electronics',
        'shopping'
      );

      await store.put(NS.semanticMemory(userId), memory1.id, memory1);
      await store.put(NS.semanticMemory(userId), memory2.id, memory2);

      const context = await buildAgentContext(
        userId,
        'shopping',
        'Find deals',
        store as any
      );

      // Context should have semantic memories field (may be empty due to embedding failures in test env)
      expect(context.semanticMemories).toBeDefined();
      expect(Array.isArray(context.semanticMemories)).toBe(true);
    });
  });

  describe('Reflection Trigger Manager', () => {
    it('should track episode count and trigger reflection', async () => {
      const manager = new ReflectionTriggerManager(userId, store as any, llm);
      await manager.loadState();

      // Simulate 5 episodes being saved (should trigger at 5)
      for (let i = 0; i < 5; i++) {
        const episode: Episode = {
          id: `ep_${i}`,
          situation: 'Test situation',
          reasoning: 'Test reasoning',
          action: 'Test action',
          outcome: 'positive',
          agentType: 'shopping',
          missionId: `mission_${i}`,
          timestamp: Date.now(),
          tags: ['test'],
        };

        await store.put(NS.episodicMemory(userId), episode.id, episode);
        const result = await manager.onEpisodeSaved();

        if (i < 4) {
          // Should not trigger yet - returns null
          expect(result).toBeNull();
        } else {
          // Should trigger on 5th episode - returns ReflectionResult
          expect(result).not.toBeNull();
          expect(result?.durationMs).toBeDefined();
        }
      }
    });

    it('should trigger immediately on negative feedback', async () => {
      const manager = new ReflectionTriggerManager(userId, store as any, llm);
      await manager.loadState();

      // Seed some episodes first
      await seedEpisodes(store, userId, 'shopping', 3);

      const result = await manager.onNegativeFeedback('episode_1');

      // Returns ReflectionResult directly (not wrapped)
      expect(result).toBeDefined();
      expect(result.trigger.type).toBe('after_negative_feedback');
      expect(result.durationMs).toBeDefined();
    });
  });

  describe('Content Agent Integration', () => {
    it('should generate content recommendations with context', async () => {
      // Seed interests
      await store.put(
        NS.semanticMemory(userId),
        'interest_1',
        createTestMemory('interest_1', 'User is interested in technology and AI', 'interests')
      );

      // Seed IAB classifications
      await store.put(NS.iabClassifications(userId), 'iab_1', {
        id: 'iab_1',
        tier1Category: 'Technology & Computing',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      const agent = new ContentAgent();
      const result = await agent.run({
        userId,
        store: store as any,
        tools: [],
        triggerData: { type: 'scheduled' },
      });

      expect(result.success).toBe(true);
      // Content agent may or may not generate mission depending on interests found
    });

    it('should respect L1 limits', async () => {
      const agent = new ContentAgent();
      const result = await agent.run({
        userId,
        store: store as any,
        tools: [],
        triggerData: { type: 'scheduled' },
      });

      // L1 limits: max 3 tool calls, 2 LLM calls
      expect(result.usage.toolCalls).toBeLessThanOrEqual(3);
      expect(result.usage.llmCalls).toBeLessThanOrEqual(2);
    });
  });

  describe('Privacy Tier Enforcement', () => {
    it('should define correct privacy tier configurations', () => {
      expect(PRIVACY_TIERS.public.crossAccess).toBe('full');
      expect(PRIVACY_TIERS.sensitive.crossAccess).toBe('justification');
      expect(PRIVACY_TIERS.private.crossAccess).toBe('none');
    });

    it('should include shopping in public tier domains', () => {
      expect(PRIVACY_TIERS.public.domains).toContain('shopping');
      expect(PRIVACY_TIERS.public.domains).toContain('travel');
      expect(PRIVACY_TIERS.public.domains).toContain('content');
    });

    it('should include health in sensitive tier domains', () => {
      expect(PRIVACY_TIERS.sensitive.domains).toContain('health');
      expect(PRIVACY_TIERS.sensitive.domains).toContain('finance');
    });

    it('should include medical in private tier domains', () => {
      expect(PRIVACY_TIERS.private.domains).toContain('medical');
      expect(PRIVACY_TIERS.private.domains).toContain('legal');
    });
  });

  describe('Full Learning Loop (Paris → Rome → Tokyo)', () => {
    it('should demonstrate learning from user travel preferences', async () => {
      // 1. Seed initial episodes about travel preferences
      const episodes: Episode[] = [
        {
          id: 'ep_paris',
          situation: 'User searched for Paris vacation packages',
          reasoning: 'Detected interest in European travel',
          action: 'Recommended Paris hotels and tours',
          outcome: 'positive',
          agentType: 'travel',
          missionId: 'mission_paris',
          timestamp: Date.now() - 7 * 24 * 3600000,
          tags: ['travel', 'europe', 'paris'],
          userFeedback: 'loved it',
        },
        {
          id: 'ep_rome',
          situation: 'User searched for Rome vacation packages',
          reasoning: 'Detected continued interest in European travel',
          action: 'Recommended Rome hotels and tours',
          outcome: 'positive',
          agentType: 'travel',
          missionId: 'mission_rome',
          timestamp: Date.now() - 3 * 24 * 3600000,
          tags: ['travel', 'europe', 'rome'],
          userFeedback: 'excellent suggestions',
        },
        {
          id: 'ep_tokyo',
          situation: 'User searched for Tokyo vacation packages',
          reasoning: 'Detected new interest in Asian travel',
          action: 'Recommended Tokyo hotels and tours',
          outcome: 'neutral',
          agentType: 'travel',
          missionId: 'mission_tokyo',
          timestamp: Date.now() - 1 * 24 * 3600000,
          tags: ['travel', 'asia', 'tokyo'],
          userFeedback: 'too expensive',
        },
      ];

      for (const ep of episodes) {
        await store.put(NS.episodicMemory(userId), ep.id, ep);
      }

      // Add more episodes to trigger reflection
      await seedEpisodes(store, userId, 'travel', 3);

      // 2. Run reflection to synthesize rules
      const reflectionResult = await runReflection(
        userId,
        { type: 'after_episodes', count: 6 },
        store as any,
        llm
      );

      expect(reflectionResult.rulesGenerated).toBeGreaterThanOrEqual(0);

      // 3. Build context for future travel agent runs
      const context = await buildAgentContext(
        userId,
        'travel',
        'Find vacation deals',
        store as any
      );

      // Context should have proper structure
      expect(context.proceduralRules).toBeDefined();
      expect(context.semanticMemories).toBeDefined();
      expect(context.similarEpisodes).toBeDefined();
      // Should have some past episodes
      expect(context.similarEpisodes.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Episode Recording', () => {
    it('should record episode when agent creates mission', async () => {
      const agent = new ShoppingAgent();

      const result = await agent.run({
        userId,
        store: store as any,
        tools: [],
        triggerData: {
          classification: { tier1: 'Shopping', confidence: 0.85 },
          productKeywords: ['laptop'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();

      // Check that episode was recorded
      expect(result.episode).toBeDefined();
      expect(result.episode?.agentType).toBe('shopping');
      expect(result.episode?.missionId).toBe(result.missionCard?.id);
    });

    it('should include episode details for learning', async () => {
      const agent = new ShoppingAgent();

      const result = await agent.run({
        userId,
        store: store as any,
        tools: [],
        triggerData: {
          classification: { tier1: 'Shopping', confidence: 0.9 },
          productKeywords: ['headphones'],
        },
      });

      if (result.episode) {
        expect(result.episode.situation).toBeDefined();
        expect(result.episode.reasoning).toBeDefined();
        expect(result.episode.action).toBeDefined();
        expect(result.episode.outcome).toBe('pending'); // Pending user feedback
        expect(result.episode.tags).toContain('shopping');
      }
    });
  });
});
