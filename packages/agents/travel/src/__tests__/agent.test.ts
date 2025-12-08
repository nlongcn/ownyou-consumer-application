/**
 * Travel Agent Tests - Sprint 7
 *
 * TDD: Write tests first (RED), then implement (GREEN)
 *
 * L3 Agent with multi-step workflow orchestration
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
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
// TravelAgent Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('TravelAgent', () => {
  let agent: TravelAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new TravelAgent();
    mockStore = createMockStore();
  });

  describe('construction', () => {
    it('should have correct agent type', () => {
      expect(agent.agentType).toBe('travel');
    });

    it('should have L3 level', () => {
      expect(agent.level).toBe('L3');
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

    it('should process valid trip planning trigger', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Plan a trip to Paris',
        origin: 'San Francisco',
        destination: 'Paris',
        departureDate: '2025-06-15',
        returnDate: '2025-06-22',
        travelers: 2,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      expect(result.missionCard?.type).toBe('travel');
    });

    it('should handle one-way trips', async () => {
      const triggerData: TravelTriggerData = {
        query: 'One-way flight to Tokyo',
        origin: 'Los Angeles',
        destination: 'Tokyo',
        departureDate: '2025-07-01',
        travelers: 1,
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

    it('should include budget constraints in search', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Budget trip to London',
        origin: 'New York',
        destination: 'London',
        departureDate: '2025-08-10',
        returnDate: '2025-08-17',
        budget: { min: 500, max: 2000, currency: 'USD' },
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

    it('should include Ikigai dimensions in mission card', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Cultural trip to Rome',
        origin: 'Chicago',
        destination: 'Rome',
        departureDate: '2025-09-01',
        returnDate: '2025-09-08',
        travelStyle: 'cultural',
        interests: ['art', 'history', 'food'],
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.missionCard?.ikigaiDimensions).toBeDefined();
      // Cultural trips relate to growth/passion
      expect(result.missionCard?.ikigaiDimensions).toContain('growth');
    });
  });

  describe('L3 resource limits', () => {
    it('should track tool calls within L3 limits (25 max)', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Complex trip planning',
        origin: 'Seattle',
        destination: 'Barcelona',
        departureDate: '2025-10-01',
        returnDate: '2025-10-10',
        includeActivities: true,
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.usage).toBeDefined();
      expect(result.usage.toolCalls).toBeLessThanOrEqual(25); // L3 limit
    });

    it('should track memory operations', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Trip to Japan',
        origin: 'San Francisco',
        destination: 'Tokyo',
        departureDate: '2025-11-01',
        returnDate: '2025-11-10',
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
    it('should record episode when trip is planned', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Beach vacation to Hawaii',
        origin: 'Denver',
        destination: 'Honolulu',
        departureDate: '2025-12-15',
        returnDate: '2025-12-22',
        travelStyle: 'relaxation',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.episode).toBeDefined();
      expect(result.episode?.agentType).toBe('travel');
    });
  });

  describe('mission card generation', () => {
    it('should generate mission card with primary action', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Weekend getaway to Las Vegas',
        origin: 'Phoenix',
        destination: 'Las Vegas',
        departureDate: '2025-05-01',
        returnDate: '2025-05-03',
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
      const triggerData: TravelTriggerData = {
        query: 'Business trip to London',
        origin: 'Boston',
        destination: 'London',
        departureDate: '2025-04-10',
        returnDate: '2025-04-15',
        travelStyle: 'business',
        cabinClass: 'business',
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

    it('should set appropriate urgency based on departure date', async () => {
      // Trip in 2 days is high urgency
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      const urgentTrigger: TravelTriggerData = {
        query: 'Last-minute trip',
        origin: 'Miami',
        destination: 'New York',
        departureDate: twoDaysFromNow.toISOString().split('T')[0],
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData: urgentTrigger,
      });

      expect(result.missionCard?.urgency).toBe('high');
    });
  });
});

describe('TravelAgent Orchestration', () => {
  let agent: TravelAgent;
  let mockStore: AgentStore;

  beforeEach(() => {
    agent = new TravelAgent();
    mockStore = createMockStore();
  });

  describe('multi-step workflow', () => {
    it('should search flights as part of workflow', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Trip to Paris with flights',
        origin: 'New York',
        destination: 'Paris',
        departureDate: '2025-06-01',
        returnDate: '2025-06-08',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      expect(result.toolCalls).toBeDefined();
      const flightCall = result.toolCalls.find(t => t.name === 'search_flights');
      expect(flightCall).toBeDefined();
    });

    it('should search hotels as part of workflow', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Trip with hotel in Tokyo',
        origin: 'Los Angeles',
        destination: 'Tokyo',
        departureDate: '2025-07-01',
        returnDate: '2025-07-10',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      const hotelCall = result.toolCalls.find(t => t.name === 'search_hotels');
      expect(hotelCall).toBeDefined();
    });

    it('should build itinerary when activities requested', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Trip to Rome with activities',
        origin: 'Chicago',
        destination: 'Rome',
        departureDate: '2025-08-01',
        returnDate: '2025-08-07',
        includeActivities: true,
        interests: ['art', 'food', 'history'],
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      const itineraryCall = result.toolCalls.find(t => t.name === 'build_itinerary');
      expect(itineraryCall).toBeDefined();
    });

    it('should check visa requirements when nationality provided', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Trip to Brazil',
        origin: 'New York',
        destination: 'Brazil',
        departureDate: '2025-09-01',
        returnDate: '2025-09-10',
        nationality: 'US',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      const visaCall = result.toolCalls.find(t => t.name === 'check_visa');
      expect(visaCall).toBeDefined();
    });
  });

  describe('trip plan generation', () => {
    it('should generate a complete trip plan', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Complete trip plan to London',
        origin: 'San Francisco',
        destination: 'London',
        departureDate: '2025-10-01',
        returnDate: '2025-10-08',
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
      // Trip plan should be stored
      expect(mockStore.put).toHaveBeenCalled();
    });

    it('should handle travel companions', async () => {
      const triggerData: TravelTriggerData = {
        query: 'Family trip to Orlando',
        origin: 'Atlanta',
        destination: 'Orlando',
        departureDate: '2025-12-20',
        returnDate: '2025-12-27',
        travelers: 4,
        companions: ['spouse', 'child1', 'child2'],
        travelStyle: 'relaxation',
      };

      const result = await agent.run({
        userId: 'user_123',
        store: mockStore,
        tools: [],
        triggerData,
      });

      expect(result.success).toBe(true);
      // Companions trigger 'relationships' Ikigai dimension
      expect(result.missionCard?.ikigaiDimensions).toContain('relationships');
    });
  });
});

describe('TravelAgent Privacy', () => {
  let agent: TravelAgent;

  beforeEach(() => {
    agent = new TravelAgent();
  });

  it('should have read access to ikigaiProfile', () => {
    expect(() => {
      agent.privacyGuard.assertRead('ownyou.ikigai');
    }).not.toThrow();
  });

  it('should have read access to travelPreferences', () => {
    expect(() => {
      agent.privacyGuard.assertRead('ownyou.travel_preferences');
    }).not.toThrow();
  });

  it('should have read access to episodicMemory', () => {
    expect(() => {
      agent.privacyGuard.assertRead('ownyou.episodic');
    }).not.toThrow();
  });

  it('should have write access to travelItineraries', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.travel_itineraries');
    }).not.toThrow();
  });

  it('should have write access to episodicMemory', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.episodic');
    }).not.toThrow();
  });

  it('should have write access to missionCards', () => {
    expect(() => {
      agent.privacyGuard.assertWrite('ownyou.missions');
    }).not.toThrow();
  });
});
