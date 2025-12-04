/**
 * BaseAgent Tests - v13 Section 3.6
 *
 * Tests for the abstract base agent class.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../base-agent';
import type { AgentContext, AgentResult, AgentStore, AgentTool } from '../types';
import type { AgentPermissions, MissionCard, Episode } from '@ownyou/shared-types';
import { NAMESPACES, NS } from '@ownyou/shared-types';

// Concrete test implementation of BaseAgent
class TestAgent extends BaseAgent {
  readonly agentType = 'shopping' as const;
  readonly level = 'L2' as const;

  // Track execute calls for testing
  public executeCalled = false;
  public executeContext: AgentContext | null = null;
  public executeResult: Partial<AgentResult> = { success: true };
  public returnMissionCard = false;

  protected async execute(context: AgentContext): Promise<AgentResult> {
    this.executeCalled = true;
    this.executeContext = context;

    // Optionally return a mission card for episode recording tests
    const missionCard: MissionCard | undefined = this.returnMissionCard ? {
      id: 'generated-mission-1',
      type: 'shopping',
      title: 'Deal Alert',
      summary: 'Found great deals for you',
      urgency: 'medium',
      status: 'CREATED',
      createdAt: Date.now(),
      ikigaiDimensions: ['interests'],
      ikigaiAlignmentBoost: 0.5,
      primaryAction: {
        label: 'View Deals',
        type: 'navigate',
        payload: { route: '/deals' },
      },
      agentThreadId: 'thread-1',
      evidenceRefs: [],
    } : undefined;

    return {
      success: this.executeResult.success ?? true,
      response: this.executeResult.response ?? 'Test response',
      error: this.executeResult.error,
      missionCard,
      usage: this.limitsEnforcer.getUsage(),
      toolCalls: [],
      llmCalls: [],
      memoryOps: [],
    };
  }

  // Expose protected methods for testing
  public testRecordToolCall(name: string, input: unknown, output: unknown, durationMs: number) {
    return this.recordToolCall(name, input, output, durationMs);
  }

  public testRecordLlmCall(model: string, input: unknown, output: string, tokens: { input: number; output: number }, costUsd: number, durationMs: number) {
    return this.recordLlmCall(model, input, output, tokens, costUsd, durationMs);
  }

  public testRecordMemoryOp(type: 'read' | 'write' | 'search' | 'delete', namespace: string, key?: string, query?: string) {
    return this.recordMemoryOp(type, namespace, key, query);
  }
}

// Mock store for testing
const createMockStore = (): AgentStore => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue([]),
  list: vi.fn().mockResolvedValue([]),
});

// Test permissions for shopping agent
const testPermissions: AgentPermissions = {
  agentType: 'shopping',
  memoryAccess: {
    read: [
      NAMESPACES.SEMANTIC_MEMORY,
      NAMESPACES.IAB_CLASSIFICATIONS,
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

describe('BaseAgent', () => {
  let agent: TestAgent;
  let mockStore: AgentStore;
  let context: AgentContext;

  beforeEach(() => {
    agent = new TestAgent(testPermissions);
    mockStore = createMockStore();
    context = {
      userId: 'test-user',
      store: mockStore,
      tools: [],
    };
  });

  describe('run', () => {
    it('should call execute with context', async () => {
      const result = await agent.run(context);

      expect(agent.executeCalled).toBe(true);
      expect(agent.executeContext).toBe(context);
      expect(result.success).toBe(true);
    });

    it('should return error result on execute failure', async () => {
      agent.executeResult = { success: false, error: 'Test error' };

      const result = await agent.run(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should catch and wrap exceptions', async () => {
      const errorAgent = new (class extends BaseAgent {
        readonly agentType = 'shopping' as const;
        readonly level = 'L1' as const;

        protected async execute(): Promise<AgentResult> {
          throw new Error('Unexpected error');
        }
      })(testPermissions);

      const result = await errorAgent.run(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });

    it('should include usage statistics in result', async () => {
      const result = await agent.run(context);

      expect(result.usage).toBeDefined();
      expect(result.usage.toolCalls).toBe(0);
      expect(result.usage.llmCalls).toBe(0);
      expect(result.usage.elapsedSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('tool call tracking', () => {
    it('should record tool calls', async () => {
      agent.testRecordToolCall('searchDeals', { query: 'laptop' }, { results: [] }, 100);

      const usage = agent.limitsEnforcer.getUsage();
      expect(usage.toolCalls).toBe(1);
    });

    it('should throw when tool call limit exceeded', async () => {
      // L2 allows 10 tool calls
      for (let i = 0; i < 10; i++) {
        agent.testRecordToolCall('tool', {}, {}, 10);
      }

      expect(() => agent.testRecordToolCall('tool', {}, {}, 10))
        .toThrow();
    });
  });

  describe('LLM call tracking', () => {
    it('should record LLM calls', async () => {
      agent.testRecordLlmCall(
        'gpt-4o-mini',
        { messages: [] },
        'response',
        { input: 100, output: 50 },
        0.001,
        200
      );

      const usage = agent.limitsEnforcer.getUsage();
      expect(usage.llmCalls).toBe(1);
      expect(usage.totalCostUsd).toBeCloseTo(0.001);
    });

    it('should throw when LLM call limit exceeded', async () => {
      // L2 allows 5 LLM calls
      for (let i = 0; i < 5; i++) {
        agent.testRecordLlmCall('model', {}, 'resp', { input: 10, output: 10 }, 0.001, 100);
      }

      expect(() => agent.testRecordLlmCall('model', {}, 'resp', { input: 10, output: 10 }, 0.001, 100))
        .toThrow();
    });
  });

  describe('memory operation tracking', () => {
    it('should record memory reads', async () => {
      agent.testRecordMemoryOp('read', NAMESPACES.SEMANTIC_MEMORY, 'key1');

      const usage = agent.limitsEnforcer.getUsage();
      expect(usage.memoryReads).toBe(1);
    });

    it('should record memory writes', async () => {
      agent.testRecordMemoryOp('write', NAMESPACES.MISSION_CARDS, 'key1');

      const usage = agent.limitsEnforcer.getUsage();
      expect(usage.memoryWrites).toBe(1);
    });

    it('should record memory searches as reads', async () => {
      agent.testRecordMemoryOp('search', NAMESPACES.SEMANTIC_MEMORY, undefined, 'query');

      const usage = agent.limitsEnforcer.getUsage();
      expect(usage.memoryReads).toBe(1);
    });
  });

  describe('privacy enforcement', () => {
    it('should allow operations on permitted namespaces', async () => {
      expect(() => agent.testRecordMemoryOp('read', NAMESPACES.SEMANTIC_MEMORY))
        .not.toThrow();
      expect(() => agent.testRecordMemoryOp('write', NAMESPACES.MISSION_CARDS))
        .not.toThrow();
    });

    it('should deny operations on non-permitted namespaces', async () => {
      expect(() => agent.testRecordMemoryOp('read', NAMESPACES.PSEUDONYMS))
        .toThrow();
      expect(() => agent.testRecordMemoryOp('write', NAMESPACES.SEMANTIC_MEMORY))
        .toThrow();
    });
  });

  describe('agent properties', () => {
    it('should expose agent type', () => {
      expect(agent.agentType).toBe('shopping');
    });

    it('should expose agent level', () => {
      expect(agent.level).toBe('L2');
    });

    it('should provide access to limits enforcer', async () => {
      // Run the agent to initialize limits enforcer
      await agent.run(context);
      expect(agent.limitsEnforcer).toBeDefined();
      expect(agent.limitsEnforcer.getLimits().maxToolCalls).toBe(10); // L2 limit
    });

    it('should provide access to privacy guard', () => {
      expect(agent.privacyGuard).toBeDefined();
      expect(agent.privacyGuard.canRead(NAMESPACES.SEMANTIC_MEMORY)).toBe(true);
    });
  });

  describe('context with mission card', () => {
    it('should handle context with existing mission card', async () => {
      const missionCard: MissionCard = {
        id: 'mission-1',
        type: 'shopping',
        title: 'Find laptop deals',
        summary: 'Looking for laptop deals based on your preferences',
        urgency: 'medium',
        status: 'CREATED',
        createdAt: Date.now(),
        ikigaiDimensions: ['productivity'],
        ikigaiAlignmentBoost: 0.5,
        primaryAction: {
          label: 'View Deals',
          type: 'navigate',
          payload: { route: '/deals' },
        },
        agentThreadId: 'thread-1',
        evidenceRefs: [],
      };

      context.missionCard = missionCard;

      const result = await agent.run(context);

      expect(agent.executeContext?.missionCard).toBe(missionCard);
      expect(result.success).toBe(true);
    });
  });

  describe('episode recording (v13 Section 8.4.2)', () => {
    beforeEach(() => {
      agent.returnMissionCard = true;
    });

    it('should record episode when mission card is created', async () => {
      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      expect(result.episode).toBeDefined();
      expect(result.episode?.agentType).toBe('shopping');
      expect(result.episode?.missionId).toBe(result.missionCard?.id);
      expect(result.episode?.outcome).toBe('pending');
    });

    it('should store episode in episodic memory namespace', async () => {
      await agent.run(context);

      // Verify store.put was called with episodic memory namespace
      expect(mockStore.put).toHaveBeenCalledWith(
        NS.episodicMemory('test-user'),
        expect.any(String), // episode id
        expect.objectContaining({
          agentType: 'shopping',
          outcome: 'pending',
        })
      );
    });

    it('should not record episode when no mission card is created', async () => {
      agent.returnMissionCard = false;

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeUndefined();
      expect(result.episode).toBeUndefined();
    });

    it('should not record episode on failure', async () => {
      agent.executeResult = { success: false, error: 'Test failure' };
      agent.returnMissionCard = true;

      const result = await agent.run(context);

      expect(result.success).toBe(false);
      expect(result.episode).toBeUndefined();
    });

    it('should include trigger data in episode situation', async () => {
      context.triggerData = { type: 'iab_classification', category: 'Shopping' };

      const result = await agent.run(context);

      expect(result.episode?.situation).toContain('iab_classification');
      expect(result.episode?.situation).toContain('Shopping');
    });

    it('should include tags from mission card', async () => {
      const result = await agent.run(context);

      expect(result.episode?.tags).toContain('shopping');
      expect(result.episode?.tags).toContain('medium'); // urgency
      expect(result.episode?.tags).toContain('interests'); // ikigai dimension
    });

    it('should truncate long trigger data', async () => {
      context.triggerData = { data: 'x'.repeat(1000) };

      const result = await agent.run(context);

      expect(result.episode?.situation.length).toBeLessThanOrEqual(500);
      expect(result.episode?.situation).toContain('...');
    });

    it('should track episode write as memory operation', async () => {
      const result = await agent.run(context);

      // Find the episodic memory write in memoryOps
      const episodeWrite = result.memoryOps.find(
        (op) => op.type === 'write' && op.namespace === NAMESPACES.EPISODIC_MEMORY
      );

      expect(episodeWrite).toBeDefined();
      expect(episodeWrite?.key).toBe(result.episode?.id);
    });
  });
});
