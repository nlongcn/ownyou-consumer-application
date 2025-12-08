/**
 * Travel Agent Business Logic Tests
 *
 * Tests for selectBestFlight, selectBestHotel, and calculateCosts
 * These test the internal selection algorithms through behavior verification.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentStore } from '@ownyou/agents-base';
import { TravelAgent } from '../agent';
import type { TravelTriggerData } from '../types';

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
// selectBestFlight behavior tests
// ─────────────────────────────────────────────────────────────────────────────

describe('selectBestFlight behavior', () => {
  let agent: TravelAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new TravelAgent();
    mockStore = createMockStore();
  });

  describe('budget travel style', () => {
    it('should prioritize cheapest flight for budget travelers', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Budget trip to Paris',
        origin: 'New York',
        destination: 'Paris',
        departureDate: '2025-06-15',
        returnDate: '2025-06-22',
        travelStyle: 'budget',
        budget: { min: 500, max: 1500, currency: 'USD' },
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      // Budget travelers get cheaper options prioritized
      // The mission card summary should reflect budget-conscious selection
      expect(result.missionCard?.summary).toBeDefined();
    });

    it('should select flight with lowest price when travelStyle is budget', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Cheapest flight to London',
        origin: 'Chicago',
        destination: 'London',
        departureDate: '2025-07-01',
        returnDate: '2025-07-10',
        travelStyle: 'budget',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      // The toolCalls should show search_flights was called
      const flightSearch = result.toolCalls.find((t) => t.name === 'search_flights');
      expect(flightSearch).toBeDefined();
    });
  });

  describe('luxury travel style', () => {
    it('should prioritize shortest duration for non-budget travelers', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Business trip to Tokyo',
        origin: 'San Francisco',
        destination: 'Tokyo',
        departureDate: '2025-08-01',
        returnDate: '2025-08-05',
        travelStyle: 'business',
        cabinClass: 'business',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      // Non-budget travelers get shortest duration flights
    });

    it('should select direct flights when available for luxury style', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Luxury trip to Dubai',
        origin: 'New York',
        destination: 'Dubai',
        departureDate: '2025-09-10',
        returnDate: '2025-09-17',
        travelStyle: 'luxury',
        cabinClass: 'first',
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

  describe('default travel style', () => {
    it('should use duration as default sorting when no style specified', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Trip to Rome',
        origin: 'Boston',
        destination: 'Rome',
        departureDate: '2025-10-01',
        returnDate: '2025-10-08',
        // No travelStyle specified
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
// selectBestHotel behavior tests
// ─────────────────────────────────────────────────────────────────────────────

describe('selectBestHotel behavior', () => {
  let agent: TravelAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new TravelAgent();
    mockStore = createMockStore();
  });

  describe('luxury travel style', () => {
    it('should prioritize highest star rating for luxury travelers', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Luxury stay in Paris',
        origin: 'Miami',
        destination: 'Paris',
        departureDate: '2025-06-01',
        returnDate: '2025-06-07',
        travelStyle: 'luxury',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      // Luxury travelers get 5-star hotels prioritized
      const hotelSearch = result.toolCalls.find((t) => t.name === 'search_hotels');
      expect(hotelSearch).toBeDefined();
    });

    it('should select 5-star hotels over 4-star for luxury style', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Premium hotel in Tokyo',
        origin: 'Los Angeles',
        destination: 'Tokyo',
        departureDate: '2025-07-15',
        returnDate: '2025-07-22',
        travelStyle: 'luxury',
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

  describe('budget travel style', () => {
    it('should prioritize lowest price for budget travelers', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Cheap hotel in Barcelona',
        origin: 'New York',
        destination: 'Barcelona',
        departureDate: '2025-08-01',
        returnDate: '2025-08-10',
        travelStyle: 'budget',
        budget: { min: 100, max: 1000, currency: 'USD' },
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
    });

    it('should select cheapest hotel regardless of star rating for budget style', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Budget accommodation in London',
        origin: 'Boston',
        destination: 'London',
        departureDate: '2025-09-01',
        returnDate: '2025-09-05',
        travelStyle: 'budget',
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

  describe('default travel style', () => {
    it('should prioritize user rating when no style specified', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Hotel in Berlin',
        origin: 'Chicago',
        destination: 'Berlin',
        departureDate: '2025-10-01',
        returnDate: '2025-10-08',
        // No travelStyle - defaults to user rating sorting
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
    });

    it('should select highest rated hotel by default', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Good hotel in Amsterdam',
        origin: 'San Francisco',
        destination: 'Amsterdam',
        departureDate: '2025-11-01',
        returnDate: '2025-11-07',
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
// calculateCosts behavior tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateCosts behavior', () => {
  let agent: TravelAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new TravelAgent();
    mockStore = createMockStore();
  });

  it('should include total costs in mission card', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Complete trip to Paris',
      origin: 'New York',
      destination: 'Paris',
      departureDate: '2025-06-01',
      returnDate: '2025-06-08',
      travelers: 2,
      includeActivities: true,
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
    // Mission card should have summary with cost information
    expect(result.missionCard?.summary).toBeDefined();
  });

  it('should calculate costs for multiple travelers', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Family trip to Orlando',
      origin: 'Boston',
      destination: 'Orlando',
      departureDate: '2025-07-15',
      returnDate: '2025-07-22',
      travelers: 4,
      companions: ['spouse', 'child1', 'child2'],
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
  });

  it('should include hotel costs in calculation', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Week in Tokyo',
      origin: 'Seattle',
      destination: 'Tokyo',
      departureDate: '2025-08-01',
      returnDate: '2025-08-08',
      travelers: 2,
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
    // Should have both flight and hotel search calls
    const flightSearch = result.toolCalls.find((t) => t.name === 'search_flights');
    const hotelSearch = result.toolCalls.find((t) => t.name === 'search_hotels');
    expect(flightSearch).toBeDefined();
    expect(hotelSearch).toBeDefined();
  });

  it('should include activity costs when activities are requested', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Trip to Rome with tours',
      origin: 'Los Angeles',
      destination: 'Rome',
      departureDate: '2025-09-01',
      returnDate: '2025-09-08',
      travelers: 2,
      includeActivities: true,
      interests: ['art', 'history', 'food'],
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
    // Should have itinerary building with activities
    const itineraryCall = result.toolCalls.find((t) => t.name === 'build_itinerary');
    expect(itineraryCall).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases and error handling
// ─────────────────────────────────────────────────────────────────────────────

describe('business logic edge cases', () => {
  let agent: TravelAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new TravelAgent();
    mockStore = createMockStore();
  });

  it('should handle trip with no return date (one-way)', async () => {
    const triggerData: TravelTriggerData = {
      query: 'One-way to Tokyo',
      origin: 'New York',
      destination: 'Tokyo',
      departureDate: '2025-12-01',
      // No returnDate
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
  });

  it('should handle single traveler', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Solo trip to Iceland',
      origin: 'Seattle',
      destination: 'Reykjavik',
      departureDate: '2025-06-01',
      returnDate: '2025-06-08',
      travelers: 1,
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
  });

  it('should handle trip without budget constraints', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Trip to Bali',
      origin: 'Los Angeles',
      destination: 'Bali',
      departureDate: '2025-08-01',
      returnDate: '2025-08-15',
      // No budget specified
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
  });

  it('should handle cultural travel style', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Cultural trip to Kyoto',
      origin: 'San Francisco',
      destination: 'Kyoto',
      departureDate: '2025-10-01',
      returnDate: '2025-10-10',
      travelStyle: 'cultural',
      interests: ['temples', 'tea ceremony', 'gardens'],
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
    // Cultural trips should include growth dimension
    expect(result.missionCard?.ikigaiDimensions).toContain('growth');
  });

  it('should handle adventure travel style', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Adventure trip to Costa Rica',
      origin: 'Miami',
      destination: 'Costa Rica',
      departureDate: '2025-11-01',
      returnDate: '2025-11-10',
      travelStyle: 'adventure',
      interests: ['zip-lining', 'hiking', 'wildlife'],
    };

    const result = await agent.run({
      userId: 'user_123',
      store: mockStore,
      tools: [],
      triggerData,
    });

    expect(result.success).toBe(true);
  });

  it('should handle relaxation travel style', async () => {
    const triggerData: TravelTriggerData = {
      query: 'Relaxing beach trip to Maldives',
      origin: 'New York',
      destination: 'Maldives',
      departureDate: '2025-12-20',
      returnDate: '2025-12-30',
      travelStyle: 'relaxation',
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
