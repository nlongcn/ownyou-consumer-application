/**
 * AgentCoordinator Tests - v13 Section 3.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentCoordinator, AgentRegistry, classifyIntent } from '../coordinator';
import type { DataTrigger, ScheduledTrigger, UserTrigger } from '../types';

// Mock agent for testing
const createMockAgent = (success = true, missionId?: string) => ({
  run: vi.fn().mockResolvedValue({
    success,
    missionCard: missionId ? { id: missionId, title: 'Test Mission' } : undefined,
    response: 'Test response',
    error: success ? undefined : 'Test error',
    usage: { toolCalls: 0, llmCalls: 0, memoryReads: 0, memoryWrites: 0, elapsedSeconds: 0, totalCostUsd: 0 },
    toolCalls: [],
    llmCalls: [],
    memoryOps: [],
  }),
});

describe('AgentCoordinator', () => {
  let coordinator: AgentCoordinator;
  let mockShoppingAgent: ReturnType<typeof createMockAgent>;
  let mockContentAgent: ReturnType<typeof createMockAgent>;

  beforeEach(() => {
    mockShoppingAgent = createMockAgent(true, 'mission_1');
    mockContentAgent = createMockAgent(true, 'mission_2');

    coordinator = new AgentCoordinator({
      agentFactory: (type) => {
        switch (type) {
          case 'shopping':
            return mockShoppingAgent as any;
          case 'content':
            return mockContentAgent as any;
          default:
            return null;
        }
      },
    });
  });

  describe('routeTrigger', () => {
    describe('data triggers', () => {
      it('should route to agents registered for namespace', async () => {
        const trigger: DataTrigger = {
          id: 'test_1',
          mode: 'data',
          namespace: 'ownyou.iab',
          key: 'classification_1',
          changeType: 'create',
          value: { category: 'Electronics' },
          createdAt: Date.now(),
        };

        const context = {
          userId: 'user_123',
          store: {} as any,
          tools: [],
        };

        const results = await coordinator.routeTrigger(trigger, context);

        // Both shopping and content are registered for ownyou.iab
        expect(results.length).toBeGreaterThan(0);
        expect(mockShoppingAgent.run).toHaveBeenCalled();
      });

      it('should return skipped for unknown namespace', async () => {
        const trigger: DataTrigger = {
          id: 'test_1',
          mode: 'data',
          namespace: 'unknown.namespace',
          key: 'item_1',
          changeType: 'create',
          value: {},
          createdAt: Date.now(),
        };

        const context = {
          userId: 'user_123',
          store: {} as any,
          tools: [],
        };

        const results = await coordinator.routeTrigger(trigger, context);

        expect(results).toHaveLength(1);
        expect(results[0].skipped).toBe(true);
        expect(results[0].skipReason).toContain('No agent found');
      });
    });

    describe('scheduled triggers', () => {
      it('should route to agents for schedule ID', async () => {
        const trigger: ScheduledTrigger = {
          id: 'test_1',
          mode: 'scheduled',
          scheduleId: 'daily_digest',
          scheduledAt: Date.now(),
          createdAt: Date.now(),
        };

        const context = {
          userId: 'user_123',
          store: {} as any,
          tools: [],
        };

        const results = await coordinator.routeTrigger(trigger, context);

        // daily_digest maps to shopping and content
        expect(results.length).toBe(2);
      });

      it('should use custom schedule agents when provided in config', async () => {
        const customCoordinator = new AgentCoordinator({
          agentFactory: (type) => {
            switch (type) {
              case 'shopping':
                return mockShoppingAgent as any;
              case 'content':
                return mockContentAgent as any;
              default:
                return null;
            }
          },
          scheduleAgents: {
            custom_schedule: ['content'],
          },
        });

        const trigger: ScheduledTrigger = {
          id: 'test_1',
          mode: 'scheduled',
          scheduleId: 'custom_schedule',
          scheduledAt: Date.now(),
          createdAt: Date.now(),
        };

        const context = {
          userId: 'user_123',
          store: {} as any,
          tools: [],
        };

        const results = await customCoordinator.routeTrigger(trigger, context);

        expect(results.length).toBe(1);
        expect(results[0].agentType).toBe('content');
        expect(mockContentAgent.run).toHaveBeenCalled();
        expect(mockShoppingAgent.run).not.toHaveBeenCalled();
      });

      it('should allow runtime updates to schedule agents', async () => {
        coordinator.setScheduleAgents('new_schedule', ['shopping']);

        const trigger: ScheduledTrigger = {
          id: 'test_1',
          mode: 'scheduled',
          scheduleId: 'new_schedule',
          scheduledAt: Date.now(),
          createdAt: Date.now(),
        };

        const context = {
          userId: 'user_123',
          store: {} as any,
          tools: [],
        };

        const results = await coordinator.routeTrigger(trigger, context);

        expect(results.length).toBe(1);
        expect(results[0].agentType).toBe('shopping');
      });
    });

    describe('user triggers', () => {
      it('should route to agent for intent', async () => {
        const trigger: UserTrigger = {
          id: 'test_1',
          mode: 'user',
          request: 'Find me deals on headphones',
          intent: 'shopping',
          entities: {},
          createdAt: Date.now(),
        };

        const context = {
          userId: 'user_123',
          store: {} as any,
          tools: [],
        };

        const results = await coordinator.routeTrigger(trigger, context);

        expect(results).toHaveLength(1);
        expect(results[0].agentType).toBe('shopping');
        expect(mockShoppingAgent.run).toHaveBeenCalled();
      });
    });

    describe('event triggers', () => {
      it('should use custom event agents when provided in config', async () => {
        const customCoordinator = new AgentCoordinator({
          agentFactory: (type) => {
            switch (type) {
              case 'shopping':
                return mockShoppingAgent as any;
              case 'content':
                return mockContentAgent as any;
              default:
                return null;
            }
          },
          eventAgents: {
            custom_event: ['shopping'],
          },
        });

        const trigger = {
          id: 'test_1',
          mode: 'event' as const,
          eventSource: 'custom_event',
          payload: {},
          createdAt: Date.now(),
        };

        const context = {
          userId: 'user_123',
          store: {} as any,
          tools: [],
        };

        const results = await customCoordinator.routeTrigger(trigger, context);

        expect(results.length).toBe(1);
        expect(results[0].agentType).toBe('shopping');
        expect(mockShoppingAgent.run).toHaveBeenCalled();
        expect(mockContentAgent.run).not.toHaveBeenCalled();
      });

      it('should allow runtime updates to event agents', async () => {
        coordinator.setEventAgents('custom_event_source', ['content']);

        const trigger = {
          id: 'test_1',
          mode: 'event' as const,
          eventSource: 'custom_event_source',
          payload: {},
          createdAt: Date.now(),
        };

        const context = {
          userId: 'user_123',
          store: {} as any,
          tools: [],
        };

        const results = await coordinator.routeTrigger(trigger, context);

        expect(results.length).toBe(1);
        expect(results[0].agentType).toBe('content');
      });
    });
  });

  describe('routeUserRequest', () => {
    it('should classify intent and route to correct agent', async () => {
      const context = {
        userId: 'user_123',
        store: {} as any,
        tools: [],
      };

      const result = await coordinator.routeUserRequest('Buy me some headphones', context);

      expect(result.agentType).toBe('shopping');
      expect(result.trigger.mode).toBe('user');
      expect((result.trigger as UserTrigger).intent).toBe('shopping');
    });

    it('should classify content intents', async () => {
      const context = {
        userId: 'user_123',
        store: {} as any,
        tools: [],
      };

      const result = await coordinator.routeUserRequest('Recommend some articles to read', context);

      expect(result.agentType).toBe('content');
      expect((result.trigger as UserTrigger).intent).toBe('content');
    });
  });

  describe('error handling', () => {
    it('should handle agent errors gracefully', async () => {
      const errorAgent = {
        run: vi.fn().mockRejectedValue(new Error('Agent crashed')),
      };

      const errorCoordinator = new AgentCoordinator({
        agentFactory: () => errorAgent as any,
      });

      const trigger: DataTrigger = {
        id: 'test_1',
        mode: 'data',
        namespace: 'ownyou.iab',
        key: 'item_1',
        changeType: 'create',
        value: {},
        createdAt: Date.now(),
      };

      const context = {
        userId: 'user_123',
        store: {} as any,
        tools: [],
      };

      const results = await errorCoordinator.routeTrigger(trigger, context);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].skipped).toBe(true);
      expect(results[0].skipReason).toContain('Agent crashed');
    });

    it('should handle unavailable agents', async () => {
      const nullCoordinator = new AgentCoordinator({
        agentFactory: () => null,
      });

      const trigger: DataTrigger = {
        id: 'test_1',
        mode: 'data',
        namespace: 'ownyou.iab',
        key: 'item_1',
        changeType: 'create',
        value: {},
        createdAt: Date.now(),
      };

      const context = {
        userId: 'user_123',
        store: {} as any,
        tools: [],
      };

      const results = await nullCoordinator.routeTrigger(trigger, context);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].skipped).toBe(true);
      expect(results[0].skipReason).toContain('not available');
    });
  });
});

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should register default agents', () => {
    const agents = registry.getEnabledAgents();
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.some(a => a.type === 'shopping')).toBe(true);
    expect(agents.some(a => a.type === 'content')).toBe(true);
  });

  it('should index agents by namespace', () => {
    const agents = registry.getAgentsForNamespace('ownyou.iab');
    expect(agents).toContain('shopping');
    expect(agents).toContain('content');
  });

  it('should index agents by intent', () => {
    expect(registry.getAgentForIntent('buy')).toBe('shopping');
    expect(registry.getAgentForIntent('read')).toBe('content');
  });

  it('should enable/disable agents', () => {
    registry.setEnabled('shopping', false);
    expect(registry.getEnabledAgents().some(a => a.type === 'shopping')).toBe(false);

    registry.setEnabled('shopping', true);
    expect(registry.getEnabledAgents().some(a => a.type === 'shopping')).toBe(true);
  });
});

describe('classifyIntent', () => {
  it('should classify shopping intents', () => {
    const result = classifyIntent('I want to buy some headphones');
    expect(result.intent).toBe('shopping');
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('should classify content intents', () => {
    const result = classifyIntent('Recommend some articles to read');
    expect(result.intent).toBe('content');
  });

  it('should classify travel intents', () => {
    const result = classifyIntent('Book me a flight to Paris');
    expect(result.intent).toBe('travel');
  });

  it('should extract price entities', () => {
    const result = classifyIntent('Find headphones under $100');
    expect(result.entities.price).toBeDefined();
    expect(result.entities.price).toContain('$100');
  });

  it('should default to shopping for ambiguous requests', () => {
    const result = classifyIntent('Something interesting');
    expect(result.intent).toBe('shopping');
    expect(result.confidence).toBeLessThan(0.6);
  });
});
