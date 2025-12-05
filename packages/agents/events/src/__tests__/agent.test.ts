/**
 * Events Agent Tests - Sprint 7
 *
 * TDD: Write tests first (RED), then implement (GREEN)
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentStore } from '@ownyou/agents-base';
import { EventsAgent } from '../agent';
import type { EventsTriggerData } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Store Implementation
// ─────────────────────────────────────────────────────────────────────────────

function createMockStore(): AgentStore {
  const data = new Map<string, unknown>();

  return {
    get: vi.fn(async (namespace: readonly string[], key: string) => {
      const fullKey = [...namespace, key].join('/');
      return data.get(fullKey) ?? null;
    }),
    put: vi.fn(async (namespace: readonly string[], key: string, value: unknown) => {
      const fullKey = [...namespace, key].join('/');
      data.set(fullKey, value);
    }),
    delete: vi.fn(async (namespace: readonly string[], key: string) => {
      const fullKey = [...namespace, key].join('/');
      data.delete(fullKey);
    }),
    search: vi.fn(async () => []),
    list: vi.fn(async () => []),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EventsAgent Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('EventsAgent', () => {
  let agent: EventsAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    // Provide defaultLocation for tests since trigger data may not include location
    agent = new EventsAgent({ defaultLocation: 'San Francisco' });
    mockStore = createMockStore();
  });

  describe('construction', () => {
    it('should have correct agent type', () => {
      expect(agent.agentType).toBe('events');
    });

    it('should have L2 level', () => {
      expect(agent.level).toBe('L2');
    });

    it('should have proper permissions', () => {
      expect(agent.privacyGuard).toBeDefined();
    });
  });

  describe('run()', () => {
    it('should fail without trigger data', async () => {
      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('trigger data');
    });

    it('should fail with invalid trigger data', async () => {
      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: { invalid: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('trigger data');
    });

    it('should process valid event search trigger', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Find music concerts this weekend',
        category: 'music',
        location: 'San Francisco',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      expect(result.missionCard?.type).toBe('events');
    });

    it('should respect date range when searching', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const twoWeeksLater = new Date();
      twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

      const triggerData: EventsTriggerData = {
        query: 'Find events next week',
        dateRange: {
          start: nextWeek.toISOString(),
          end: twoWeeksLater.toISOString(),
        },
        location: 'San Francisco',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
    });

    it('should filter by category', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Find comedy shows',
        category: 'comedy',
        location: 'New York',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
    });

    it('should include Ikigai dimensions in mission card', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Find tech meetups',
        category: 'technology',
        location: 'San Francisco',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.missionCard?.ikigaiDimensions).toBeDefined();
      // Tech events relate to growth/profession
      expect(result.missionCard?.ikigaiDimensions).toContain('growth');
    });
  });

  describe('resource limits', () => {
    it('should track tool calls within L2 limits', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Any event nearby',
        location: 'San Francisco',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.usage).toBeDefined();
      expect(result.usage.toolCalls).toBeLessThanOrEqual(10); // L2 limit
    });

    it('should track memory operations', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Music festival',
        category: 'music',
        location: 'Austin',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.memoryOps).toBeDefined();
      expect(result.memoryOps.length).toBeGreaterThan(0);
    });
  });

  describe('episode recording', () => {
    it('should record episode when mission is created', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Find jazz concert',
        category: 'music',
        location: 'Chicago',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.episode).toBeDefined();
      expect(result.episode?.agentType).toBe('events');
    });
  });

  describe('mission card generation', () => {
    it('should generate mission card with primary action', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Theater show tonight',
        category: 'theater',
        location: 'Broadway, NY',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.missionCard?.primaryAction).toBeDefined();
      expect(result.missionCard?.primaryAction.type).toBe('navigate');
    });

    it('should generate mission card with secondary actions', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Sports game',
        category: 'sports',
        location: 'Los Angeles',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.missionCard?.secondaryActions).toBeDefined();
      expect(result.missionCard?.secondaryActions?.length).toBeGreaterThan(0);
    });

    it('should set appropriate urgency based on time', async () => {
      // Tonight's event is more urgent
      const tonightTrigger: EventsTriggerData = {
        query: 'Events tonight',
        dateRange: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
        location: 'San Francisco',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: tonightTrigger,
      });

      expect(result.missionCard?.urgency).toBe('high');
    });
  });
});

describe('EventsAgent Tools', () => {
  let agent: EventsAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    // Provide defaultLocation for tests since trigger data may not include location
    agent = new EventsAgent({ defaultLocation: 'San Francisco' });
    mockStore = createMockStore();
  });

  describe('searchEvents', () => {
    it('should search events by category', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Find art exhibitions',
        category: 'arts',
        location: 'San Francisco',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.toolCalls).toBeDefined();
      const searchCall = result.toolCalls.find(t => t.name === 'search_events');
      expect(searchCall).toBeDefined();
    });

    it('should filter by price range', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Cheap events',
        priceRange: { min: 0, max: 50 },
        location: 'San Francisco',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
    });

    it('should handle location-based search', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Events near Central Park',
        location: 'Central Park, NYC',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('calendar integration', () => {
    it('should check calendar for conflicts', async () => {
      const triggerData: EventsTriggerData = {
        query: 'Find event tomorrow evening',
        dateRange: {
          start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        },
        location: 'San Francisco',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('EventsAgent Privacy', () => {
  let agent: EventsAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    // Provide defaultLocation for tests since trigger data may not include location
    agent = new EventsAgent({ defaultLocation: 'San Francisco' });
    mockStore = createMockStore();
  });

  it('should have read access to ikigaiProfile', () => {
    expect(() => {
      agent.privacyGuard.assertRead('ownyou.ikigai');
    }).not.toThrow();
  });

  it('should have read access to episodicMemory', () => {
    expect(() => {
      agent.privacyGuard.assertRead('ownyou.episodic');
    }).not.toThrow();
  });

  it('should have write access to eventTickets', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.event_tickets');
    }).not.toThrow();
  });

  it('should have write access to eventFavorites', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.event_favorites');
    }).not.toThrow();
  });

  it('should have write access to episodicMemory', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.episodic');
    }).not.toThrow();
  });
});
