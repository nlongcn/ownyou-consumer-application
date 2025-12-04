/**
 * Content Agent Tests - v13 Section 3.6.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentAgent } from '../agent';
import type { AgentContext, AgentStore } from '@ownyou/agents-base';

// Mock store implementation
function createMockStore(): AgentStore {
  const data = new Map<string, Map<string, unknown>>();

  return {
    async get(namespace: readonly string[], key: string): Promise<unknown | null> {
      const ns = namespace.join('.');
      return data.get(ns)?.get(key) ?? null;
    },

    async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
      const ns = namespace.join('.');
      if (!data.has(ns)) {
        data.set(ns, new Map());
      }
      data.get(ns)!.set(key, value);
    },

    async delete(namespace: readonly string[], key: string): Promise<void> {
      const ns = namespace.join('.');
      data.get(ns)?.delete(key);
    },

    async search(
      _namespace: readonly string[],
      _query: string,
      _options?: { limit?: number }
    ): Promise<Array<{ key: string; value: unknown; score?: number }>> {
      return [];
    },

    async list(
      _namespace: readonly string[],
      _options?: { prefix?: string; limit?: number; offset?: number }
    ): Promise<Array<{ key: string; value: unknown }>> {
      return [];
    },
  };
}

describe('ContentAgent', () => {
  let agent: ContentAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new ContentAgent();
    mockStore = createMockStore();
  });

  describe('constructor', () => {
    it('should have correct agent type', () => {
      expect(agent.agentType).toBe('content');
    });

    it('should have correct level', () => {
      expect(agent.level).toBe('L1');
    });
  });

  describe('run', () => {
    it('should return error for missing trigger data', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
      };

      const result = await agent.run(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid trigger data');
    });

    it('should return error for invalid trigger data', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: { invalid: true },
      };

      const result = await agent.run(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid trigger data');
    });

    it('should handle scheduled trigger with no interests', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: { type: 'scheduled' },
      };

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('No interests detected');
    });

    it('should generate mission card with interests from trigger', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: {
          type: 'interest_detected',
          interests: ['technology', 'health'],
        },
      };

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      expect(result.missionCard?.type).toBe('content');
      expect(result.missionCard?.title).toContain('technology');
    });

    it('should store mission card in memory', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: {
          type: 'interest_detected',
          interests: ['technology'],
        },
      };

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();

      // Verify mission was stored
      const storedMission = await mockStore.get(
        ['ownyou.missions', 'user_123'],
        result.missionCard!.id
      );
      expect(storedMission).toBeDefined();
    });

    it('should record tool calls', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: {
          type: 'interest_detected',
          interests: ['science'],
        },
      };

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      // Tool calls are tracked internally
      expect(result.usage.toolCalls).toBeGreaterThanOrEqual(1);
    });

    it('should respect L1 limits', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: {
          type: 'interest_detected',
          interests: ['technology'],
        },
      };

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      // L1 limits: 3 tool calls, 2 LLM calls
      expect(result.usage.toolCalls).toBeLessThanOrEqual(3);
      expect(result.usage.llmCalls).toBeLessThanOrEqual(2);
    });
  });

  describe('mission card generation', () => {
    it('should generate proper mission card structure', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: {
          type: 'interest_detected',
          interests: ['technology'],
        },
      };

      const result = await agent.run(context);

      expect(result.missionCard).toMatchObject({
        type: 'content',
        urgency: 'low',
        status: 'CREATED',
        ikigaiDimensions: ['interests'],
        primaryAction: expect.objectContaining({
          label: 'View Recommendations',
          type: 'navigate',
        }),
      });
    });

    it('should include evidence refs from interests', async () => {
      const context: AgentContext = {
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: {
          type: 'interest_detected',
          interests: ['technology', 'health'],
        },
      };

      const result = await agent.run(context);

      expect(result.missionCard?.evidenceRefs).toContain('technology');
      expect(result.missionCard?.evidenceRefs).toContain('health');
    });
  });
});
