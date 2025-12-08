/**
 * Restaurant Agent Tests - Sprint 7
 *
 * TDD: Write tests first (RED), then implement (GREEN)
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentStore } from '@ownyou/agents-base';
import { RestaurantAgent } from '../agent';
import type { RestaurantTriggerData, Restaurant } from '../types';

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
// RestaurantAgent Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('RestaurantAgent', () => {
  let agent: RestaurantAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    // Provide defaultLocation for tests since trigger data may not include location
    agent = new RestaurantAgent({ defaultLocation: 'San Francisco' });
    mockStore = createMockStore();
  });

  describe('construction', () => {
    it('should have correct agent type', () => {
      expect(agent.agentType).toBe('restaurant');
    });

    it('should have L2 level', () => {
      expect(agent.level).toBe('L2');
    });

    it('should have proper permissions', () => {
      // L2 agents have specific namespace permissions
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

    it('should process valid restaurant search trigger', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Find Italian restaurant for tonight',
        cuisine: 'Italian',
        partySize: 2,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      // Debug: log the error if failed
      if (!result.success) {
        console.log('DEBUG: result.error =', result.error);
      }

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      expect(result.missionCard?.type).toBe('restaurant');
    });

    it('should respect dietary restrictions when searching', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Vegan restaurant near me',
        dietaryRestrictions: ['vegan'],
        partySize: 2,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      // The mission card should reflect dietary-aware search
      expect(result.missionCard?.summary).toBeDefined();
    });

    it('should include Ikigai dimensions in mission card', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Romantic dinner spot',
        cuisine: 'French',
        partySize: 2,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.missionCard?.ikigaiDimensions).toBeDefined();
      expect(result.missionCard?.ikigaiDimensions).toContain('relationships');
    });
  });

  describe('resource limits', () => {
    it('should track tool calls within L2 limits', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Any restaurant nearby',
        partySize: 4,
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
      const triggerData: RestaurantTriggerData = {
        query: 'Italian food',
        partySize: 2,
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
      const triggerData: RestaurantTriggerData = {
        query: 'Sushi restaurant',
        cuisine: 'Japanese',
        partySize: 3,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.episode).toBeDefined();
      expect(result.episode?.agentType).toBe('restaurant');
    });
  });

  describe('mission card generation', () => {
    it('should generate mission card with primary action', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Pizza place',
        cuisine: 'Italian',
        partySize: 2,
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
      const triggerData: RestaurantTriggerData = {
        query: 'Thai food',
        partySize: 4,
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
      // Tonight's dinner is more urgent
      const tonightTrigger: RestaurantTriggerData = {
        query: 'Dinner tonight',
        dateTime: new Date().toISOString(), // Today
        partySize: 2,
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

describe('RestaurantAgent Tools', () => {
  let agent: RestaurantAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    // Provide defaultLocation for tests since trigger data may not include location
    agent = new RestaurantAgent({ defaultLocation: 'San Francisco' });
    mockStore = createMockStore();
  });

  describe('searchRestaurants', () => {
    it('should search restaurants by cuisine', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Find Mexican restaurants',
        cuisine: 'Mexican',
        partySize: 4,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.toolCalls).toBeDefined();
      // Should have called search_restaurants tool
      const searchCall = result.toolCalls.find(t => t.name === 'search_restaurants');
      expect(searchCall).toBeDefined();
    });

    it('should filter by price range', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Cheap eats',
        priceRange: '$$',
        partySize: 2,
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
      const triggerData: RestaurantTriggerData = {
        query: 'Restaurants near Central Park',
        location: 'Central Park, NYC',
        partySize: 2,
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

  describe('makeReservation', () => {
    it('should support reservation flow', async () => {
      // Reservation trigger includes full details
      const triggerData: RestaurantTriggerData = {
        query: 'Book a table at Olive Garden',
        restaurantId: 'restaurant_123',
        partySize: 4,
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        specialRequests: 'Window seat if possible',
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

describe('RestaurantAgent Privacy', () => {
  let agent: RestaurantAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new RestaurantAgent();
    mockStore = createMockStore();
  });

  it('should have read access to ikigaiProfile', () => {
    // PrivacyGuard should allow read to ikigaiProfile
    expect(() => {
      agent.privacyGuard.assertRead('ownyou.ikigai');
    }).not.toThrow();
  });

  it('should have read access to episodicMemory', () => {
    expect(() => {
      agent.privacyGuard.assertRead('ownyou.episodic');
    }).not.toThrow();
  });

  it('should have write access to diningReservations', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.dining_reservations');
    }).not.toThrow();
  });

  it('should have write access to restaurantFavorites', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.restaurant_favorites');
    }).not.toThrow();
  });

  it('should have write access to episodicMemory', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.episodic');
    }).not.toThrow();
  });
});
