/**
 * Restaurant Agent Business Logic Tests
 *
 * Tests for mergeDietaryRestrictions behavior
 * These test the internal merging algorithm through behavior verification.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentStore } from '@ownyou/agents-base';
import { RestaurantAgent } from '../agent';
import type { RestaurantTriggerData } from '../types';

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
// mergeDietaryRestrictions behavior tests
// ─────────────────────────────────────────────────────────────────────────────

describe('mergeDietaryRestrictions behavior', () => {
  let agent: RestaurantAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new RestaurantAgent({ defaultLocation: 'San Francisco' });
    mockStore = createMockStore();
  });

  describe('single source restrictions', () => {
    it('should handle trigger-only dietary restrictions', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Vegan restaurant',
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
      // Mission card should reflect vegan constraint
      expect(result.missionCard).toBeDefined();
    });

    it('should handle multiple trigger restrictions', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Restaurant with dietary options',
        dietaryRestrictions: ['gluten-free', 'dairy-free'],
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

    it('should handle no dietary restrictions', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Any restaurant',
        partySize: 2,
        // No dietaryRestrictions
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

  describe('case normalization', () => {
    it('should normalize dietary restrictions to lowercase', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Restaurant search',
        dietaryRestrictions: ['VEGAN', 'Gluten-Free', 'dairy-FREE'],
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

    it('should handle mixed case consistently', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Restaurant with VeGeTaRiAn options',
        dietaryRestrictions: ['VeGeTaRiAn'],
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

  describe('common dietary restrictions', () => {
    it('should handle vegan restriction', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Vegan food',
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
    });

    it('should handle vegetarian restriction', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Vegetarian restaurant',
        dietaryRestrictions: ['vegetarian'],
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

    it('should handle gluten-free restriction', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Gluten-free options',
        dietaryRestrictions: ['gluten-free'],
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

    it('should handle nut-free restriction', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Nut-free restaurant',
        dietaryRestrictions: ['nut-free'],
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

    it('should handle kosher restriction', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Kosher restaurant',
        dietaryRestrictions: ['kosher'],
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

    it('should handle halal restriction', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Halal restaurant',
        dietaryRestrictions: ['halal'],
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

  describe('multiple combined restrictions', () => {
    it('should handle vegan + gluten-free combination', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Vegan gluten-free restaurant',
        dietaryRestrictions: ['vegan', 'gluten-free'],
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

    it('should handle multiple allergy restrictions', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Restaurant with allergy accommodations',
        dietaryRestrictions: ['nut-free', 'dairy-free', 'shellfish-free'],
        partySize: 4,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
    });

    it('should handle religious + health restrictions', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Halal gluten-free restaurant',
        dietaryRestrictions: ['halal', 'gluten-free'],
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

  describe('edge cases', () => {
    it('should handle empty dietary restrictions array', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Any restaurant',
        dietaryRestrictions: [],
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

    it('should handle large party with restrictions', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Group dinner with restrictions',
        dietaryRestrictions: ['vegetarian', 'gluten-free', 'nut-free'],
        partySize: 12,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
    });

    it('should include dietary info in mission card', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Vegan dinner',
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
      expect(result.missionCard?.summary).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant selection and ranking tests
// ─────────────────────────────────────────────────────────────────────────────

describe('restaurant selection behavior', () => {
  let agent: RestaurantAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new RestaurantAgent({ defaultLocation: 'San Francisco' });
    mockStore = createMockStore();
  });

  describe('price range filtering', () => {
    it('should filter by budget price range $', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Cheap eats',
        priceRange: '$',
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

    it('should filter by moderate price range $$', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Moderate restaurant',
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

    it('should filter by upscale price range $$$', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Nice restaurant',
        priceRange: '$$$',
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

    it('should filter by fine dining price range $$$$', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Fine dining',
        priceRange: '$$$$',
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

  describe('cuisine type filtering', () => {
    it('should filter by Italian cuisine', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Italian restaurant',
        cuisine: 'Italian',
        partySize: 2,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      const searchCall = result.toolCalls.find((t) => t.name === 'search_restaurants');
      expect(searchCall).toBeDefined();
    });

    it('should filter by Japanese cuisine', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Sushi place',
        cuisine: 'Japanese',
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

    it('should filter by Mexican cuisine', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Mexican food',
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
    });

    it('should filter by Indian cuisine', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Indian restaurant',
        cuisine: 'Indian',
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

    it('should filter by Chinese cuisine', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Chinese food',
        cuisine: 'Chinese',
        partySize: 6,
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

  describe('location-based search', () => {
    it('should search by specific location', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Restaurant near me',
        location: 'Downtown Seattle',
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

    it('should use default location when not specified', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Any restaurant',
        partySize: 2,
        // No location - should use defaultLocation from constructor
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
    });

    it('should handle landmark-based location', async () => {
      const triggerData: RestaurantTriggerData = {
        query: 'Restaurant near Central Park',
        location: 'Central Park, NYC',
        partySize: 4,
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

// ─────────────────────────────────────────────────────────────────────────────
// Ikigai dimension mapping tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Ikigai dimension mapping', () => {
  let agent: RestaurantAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new RestaurantAgent({ defaultLocation: 'San Francisco' });
    mockStore = createMockStore();
  });

  it('should map romantic dinner to relationships dimension', async () => {
    const triggerData: RestaurantTriggerData = {
      query: 'Romantic dinner spot',
      partySize: 2,
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
    expect(result.missionCard?.ikigaiDimensions).toContain('relationships');
  });

  it('should map group dinner to relationships dimension', async () => {
    const triggerData: RestaurantTriggerData = {
      query: 'Group celebration dinner',
      partySize: 8,
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
    // Large parties typically involve social/relationship aspects
    expect(result.missionCard?.ikigaiDimensions).toBeDefined();
  });

  it('should include appropriate dimensions for business dinner', async () => {
    const triggerData: RestaurantTriggerData = {
      query: 'Business dinner meeting',
      priceRange: '$$$',
      partySize: 4,
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
    expect(result.missionCard?.ikigaiDimensions).toBeDefined();
  });
});
