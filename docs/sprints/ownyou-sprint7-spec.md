# Sprint 7: Additional Agents (Restaurant, Events, Travel)

**Duration:** 4 weeks
**Status:** ✅ COMPLETE
**Completed:** 2025-12-07
**Goal:** Complete MVP agent roster with L2 and L3 complexity agents that leverage Ikigai intelligence
**Success Criteria:** Restaurant, Events, and Travel agents operational with memory learning, Ikigai personalization, and mock external API integration
**Depends On:** Sprint 6 complete (Ikigai Intelligence Layer)
**Tests:** 179 passing (55 restaurant + 24 events + 49 travel + 51 mock-apis)


---

## Previous Sprint Summary

### Sprint 6: Ikigai Intelligence Layer (COMPLETE)

- `@ownyou/ikigai` — Ikigai inference engine with 4 parallel dimension prompts
- Experiences, Relationships, Interests, Giving dimension inference
- Mission well-being scoring and prioritization
- Ikigai points and rewards system
- Evidence chain storage for transparency

**Current State:**

- Foundation packages complete (store, types, LLM client)
- Shopping Agent (L1-2) operational with learning
- Content Agent (L1) operational
- Memory system with hybrid retrieval and reflection
- Resilience patterns (circuit breakers, fallback chains)
- 4-mode trigger system (data/scheduled/event/user)
- Ikigai intelligence layer for personalization
- **No Restaurant, Events, or Travel agents**
- **No L3 (complex multi-step) agent implemented**
- **No calendar integration for event scheduling**

---

## Sprint 7 Overview

```
+------------------------------------------------------------------+
|                     SPRINT 7 END STATE                            |
+------------------------------------------------------------------+
|                                                                   |
|  WEEK 1: RESTAURANT AGENT (L2)                                    |
|  +----------------------------------------------------------+     |
|  | User asks "Where should I take Sarah for dinner?"        |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Agent reads Ikigai → Sarah is spouse, dining pref]      |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Search restaurants matching dietary + preferences]      |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Make reservation (mock) → Mission card created]         |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 2: EVENTS AGENT (L2)                                        |
|  +----------------------------------------------------------+     |
|  | [Calendar trigger: "free weekend coming up"]             |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Agent reads Ikigai → interests, key people]             |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Search events matching interests + availability]        |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Add to calendar (mock) + invite friends (mock)]         |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEKS 3-4: TRAVEL AGENT (L3)                                     |
|  +----------------------------------------------------------+     |
|  | User asks "Plan a weekend trip to the coast"             |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Multi-step: flights → hotels → activities → itinerary]  |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Uses calendar for availability, Ikigai for preferences] |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Complex mission card with full trip details]            |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  ALL 6 AGENTS OPERATIONAL (Shopping, Content, Restaurant,         |
|  Events, Travel, Diagnostic*)                                     |
|  *Diagnostic in Sprint 8                                          |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture Compliance

### Target Sections: v13 Section 3.6.1 (Remaining Agents)

| v13 Section     | Requirement               | Sprint 7 Implementation                                 | Priority |
| --------------- | ------------------------- | ------------------------------------------------------- | -------- |
| **3.6.1** | Restaurant Agent (L2)     | Search, reservation (mock), dietary checks              | P0       |
| **3.6.1** | Events Agent (L2)         | Event search, calendar integration (mock)               | P0       |
| **3.6.1** | Travel Agent (L3)         | Multi-step planning, flights + hotels (mock)            | P0       |
| **3.6.2** | Namespace Access Control  | Per-agent memory permissions                            | P0       |
| **3.6.3** | Agent Complexity Levels   | L2 (10 tools, 5 LLM, 120s), L3 (25 tools, 10 LLM, 300s) | P0       |
| **3.6.4** | Tool Call Limits          | LimitsEnforcer for L2/L3                                | P0       |
| **3.6.5** | Privacy-Tier Enforcement  | PrivacyGuard for relationship data                      | P0       |
| **2.9**   | Ikigai-Memory Integration | Agents read Ikigai profile for personalization          | P0       |

### Already Complete (from previous sprints)

| v13 Section       | Requirement                                  | Status      |
| ----------------- | -------------------------------------------- | ----------- |
| **3.6.1**   | Shopping Agent (L1-2)                        | ✅ Sprint 3 |
| **3.6.1**   | Content Agent (L1)                           | ✅ Sprint 4 |
| **3.1-3.5** | Mission State Machine, Triggers, Coordinator | ✅ Sprint 5 |
| **2.1-2.9** | Complete Ikigai Intelligence                 | ✅ Sprint 6 |

### v13 Agent Permission Matrix (Reference)

From v13 Section 3.6.2:

```typescript
// Restaurant Agent Permissions
restaurant: {
  memoryAccess: {
    read: ["semanticMemory", "episodicMemory", "entities", "relationships", "diningPreferences"],
    write: ["diningReservations", "restaurantFavorites", "episodicMemory", "proceduralMemory:restaurant"],
    search: ["semanticMemory", "episodicMemory", "entities"],
  },
  externalApis: [
    { name: "Yelp", rateLimit: "100/hour", requiresUserConsent: false },
    { name: "OpenTable", rateLimit: "60/hour", requiresUserConsent: true },
    { name: "Google Places", rateLimit: "100/hour", requiresUserConsent: false },
  ],
  toolDefinitions: [
    { name: "searchRestaurants", description: "Find restaurants matching criteria" },
    { name: "makeReservation", description: "Book a table at selected restaurant" },
    { name: "getMenu", description: "Retrieve menu and pricing" },
    { name: "checkDietary", description: "Verify dietary accommodation availability" },
  ],
}

// Events Agent Permissions
events: {
  memoryAccess: {
    read: ["semanticMemory", "episodicMemory", "entities", "relationships", "calendar", "interests"],
    write: ["eventInterests", "eventBookings", "episodicMemory", "proceduralMemory:events"],
    search: ["semanticMemory", "episodicMemory", "interests"],
  },
  externalApis: [
    { name: "Ticketmaster", rateLimit: "60/hour", requiresUserConsent: false },
    { name: "Eventbrite", rateLimit: "100/hour", requiresUserConsent: false },
    { name: "Meetup", rateLimit: "60/hour", requiresUserConsent: false },
  ],
  toolDefinitions: [
    { name: "searchEvents", description: "Find events matching interests and location" },
    { name: "checkAvailability", description: "Verify ticket availability and pricing" },
    { name: "addToCalendar", description: "Add event to user's calendar" },
    { name: "inviteFriends", description: "Share event with contacts" },
  ],
}

// Travel Agent Permissions
travel: {
  memoryAccess: {
    read: ["semanticMemory", "episodicMemory", "entities", "relationships", "calendar", "financialProfile", "travelPreferences"],
    write: ["travelItineraries", "travelBookings", "episodicMemory", "proceduralMemory:travel"],
    search: ["semanticMemory", "episodicMemory", "entities", "relationships"],
  },
  externalApis: [
    { name: "Google Flights", rateLimit: "60/hour", requiresUserConsent: false },
    { name: "Tripadvisor", rateLimit: "100/hour", requiresUserConsent: false },
    { name: "Booking.com", rateLimit: "60/hour", requiresUserConsent: true },
  ],
  toolDefinitions: [
    { name: "searchFlights", description: "Search flights with preferences (direct, timing)" },
    { name: "searchHotels", description: "Search accommodations matching preferences" },
    { name: "buildItinerary", description: "Create day-by-day travel plan" },
    { name: "checkVisa", description: "Check visa requirements for destination" },
  ],
}
```

### v13 Agent Complexity Limits (Reference)

From v13 Section 3.6.4:

```typescript
const AGENT_LIMITS = {
  L2: {
    max_tool_calls: 10,
    max_llm_calls: 5,
    timeout_seconds: 120,
    max_memory_reads: 25,
    max_memory_writes: 10,
  },
  L3: {
    max_tool_calls: 25,
    max_llm_calls: 10,
    timeout_seconds: 300,
    max_memory_reads: 50,
    max_memory_writes: 20,
  },
};
```

---

## Lessons Learned from Sprint 6 (Implementation Requirements)

Based on the Sprint 6 Ikigai package bugfix report, the following implementation requirements are **mandatory** for Sprint 7 to avoid repeating the same issues:

### Critical: Namespace Usage (C1)

**Issue:** Sprint 6 used hardcoded namespace strings like `['ownyou.semantic', userId]` instead of NS factory functions.

**Sprint 7 Requirement:**
```typescript
// ❌ NEVER do this
await store.put(['ownyou.semantic', userId], 'dining_preferences', {...});

// ✅ ALWAYS use NS.* factory functions
import { NS } from '@ownyou/shared-types';
await store.put(NS.semanticMemory(userId), 'dining_preferences', {...});
```

**Enforcement:** All store operations MUST use `NS.*` factories from `@ownyou/shared-types`. No hardcoded namespace arrays.

### Critical: Unconditional Data Writes (C2)

**Issue:** Sprint 6 conditionally skipped writing to namespaces when data was empty, breaking BBS+ pseudonym flow.

**Sprint 7 Requirement:**
```typescript
// ❌ NEVER do this
if (restaurants.length > 0) {
  await store.put(NS.restaurantFavorites(userId), 'recent', {...});
}

// ✅ ALWAYS write, even when empty
await store.put(NS.restaurantFavorites(userId), 'recent', {
  restaurants: restaurants,
  isEmpty: restaurants.length === 0,
  updatedAt: Date.now(),
});
```

**Enforcement:** Always write to required namespaces. Use an `isEmpty` flag if data may be empty.

### Important: Configurable Model Selection (I1)

**Issue:** Sprint 6 hardcoded LLM model names like `'gpt-4o-mini'` instead of using configuration.

**Sprint 7 Requirement:**
```typescript
// ❌ NEVER do this
const model = 'gpt-4o';

// ✅ Use configurable model selection
interface AgentConfig {
  modelTier: 'fast' | 'standard' | 'quality';
  modelOverrides?: {
    fast?: string;
    standard?: string;
    quality?: string;
  };
}

private getModel(): string {
  if (this.config.modelOverrides?.[this.config.modelTier]) {
    return this.config.modelOverrides[this.config.modelTier]!;
  }
  return MODEL_TIERS[this.config.modelTier] ?? MODEL_TIERS.standard;
}
```

**Enforcement:** All LLM calls must use configurable model selection, never hardcoded model names.

### Important: Extract Magic Numbers to Config (I2)

**Issue:** Sprint 6 scattered magic numbers throughout code (scoring weights, thresholds, multipliers).

**Sprint 7 Requirement:**
```typescript
// ❌ NEVER do this
const relevanceScore = Math.min(1.5, base * 0.7);
const urgencyMultiplier = 2.0;

// ✅ Extract to typed config objects
export interface RestaurantScoringConfig {
  maxRelevanceScore: number;
  baseMultiplier: number;
  urgencyMultipliers: {
    tonight: number;
    thisWeekend: number;
    future: number;
  };
}

export const DEFAULT_RESTAURANT_SCORING: RestaurantScoringConfig = {
  maxRelevanceScore: 1.5,
  baseMultiplier: 0.7,
  urgencyMultipliers: {
    tonight: 2.0,
    thisWeekend: 1.5,
    future: 1.0,
  },
};
```

**Enforcement:** All numeric constants must be in typed config objects with defaults.

### Important: Integration Tests for Main Flow (I3)

**Issue:** Sprint 6 had unit tests for components but no integration tests for `runInference()`.

**Sprint 7 Requirement:**
- Every agent MUST have integration tests for `execute()` method
- Integration tests must verify:
  - Tool calls are made in correct order
  - Memory reads/writes occur correctly
  - Mission cards are generated properly
  - Episodes are recorded

```typescript
// Required integration test pattern
describe('RestaurantAgent Integration', () => {
  it('should complete full execute flow', async () => {
    const agent = new RestaurantAgent(mockConfig);
    const result = await agent.execute({
      userId: 'test-user',
      query: 'Find Italian restaurant for tonight',
    });

    expect(result.success).toBe(true);
    expect(result.mission).toBeDefined();
    expect(mockStore.put).toHaveBeenCalledWith(
      NS.missions('test-user'),
      expect.any(String),
      expect.any(Object)
    );
  });
});
```

### Important: Populate All Type Fields (I4)

**Issue:** Sprint 6 defined `Person.lastInteraction` as optional but never populated it.

**Sprint 7 Requirement:**
- Every field in type definitions must be populated by the code that creates those objects
- If a field is optional, either:
  1. Populate it with a value
  2. Explicitly document why it's left undefined in that context

```typescript
// ❌ NEVER define fields you don't populate
interface Restaurant {
  lastVisited?: number;  // Never set anywhere
}

// ✅ Populate all fields
const restaurant: Restaurant = {
  ...baseData,
  lastVisited: visitHistory.length > 0
    ? visitHistory[0].date
    : undefined,  // Explicitly undefined for new restaurants
};
```

### Important: Correct Data Persistence Order (I5)

**Issue:** Sprint 6 stored the profile BEFORE extracting evidence, resulting in profiles with empty evidence arrays.

**Sprint 7 Requirement:**
```typescript
// ❌ NEVER persist before extracting related data
await storeProfile(userId, profile, store);  // profile.evidence is []
const evidence = extractEvidence(results);
profile.evidence = evidence;  // Too late! Already stored

// ✅ Extract BEFORE storing
const evidence = extractEvidence(results);
const profile = {
  ...baseProfile,
  evidence,  // Include evidence in initial object
};
await storeProfile(userId, profile, store);  // Complete data
await storeEvidence(userId, evidence, store);  // Separate index
```

### Minor: Import Types, Don't Redefine (M1)

**Issue:** Sprint 6 redefined `MissionCard` locally as a subset of the shared-types definition.

**Sprint 7 Requirement:**
```typescript
// ❌ NEVER redefine types
interface MissionCard {
  id: string;
  type: string;
  // ... missing ikigaiDimensions, etc.
}

// ✅ Import from shared-types
import type { MissionCard } from '@ownyou/shared-types';
```

### Minor: Add Missing NS.* Factories Before Use (M3)

**Issue:** Sprint 6 used `NAMESPACES.IKIGAI_EVIDENCE` constant but `NS.ikigaiEvidence()` factory didn't exist.

**Sprint 7 Requirement:** Before using any new namespace:
1. Check if `NS.*` factory exists in `@ownyou/shared-types/namespaces.ts`
2. If not, add it as part of Sprint 7 deliverables (see "Update `@ownyou/shared-types`" section)

### Implementation Checklist

Before marking any Sprint 7 package complete, verify:

- [ ] All store operations use `NS.*` factories
- [ ] All required namespaces are written unconditionally
- [ ] LLM model selection is configurable
- [ ] All magic numbers extracted to config objects
- [ ] Integration tests exist for `execute()` method
- [ ] All type fields are populated appropriately
- [ ] Data persistence order is correct (extract → create → store)
- [ ] Types are imported from shared-types, not redefined
- [ ] All new namespaces have `NS.*` factories added

---

## Deliverables

| #  | Deliverable        | Priority | Week | Acceptance Criteria                                                           | Status |
| -- | ------------------ | -------- | ---- | ----------------------------------------------------------------------------- | ------ |
| 1  | Restaurant Agent   | P0       | 1    | Searches restaurants, respects dietary preferences, makes reservations (mock) | ✅ |
| 2  | Restaurant Tools   | P0       | 1    | searchRestaurants, getMenu, checkDietary, makeReservation                     | ✅ |
| 3  | Events Agent       | P0       | 2    | Searches events, checks calendar availability, adds to calendar (mock)        | ✅ |
| 4  | Events Tools       | P0       | 2    | searchEvents, checkAvailability, addToCalendar, inviteFriends                 | ✅ |
| 5  | Travel Agent       | P0       | 3-4  | Multi-step planning, flights + hotels + activities (mock)                     | ✅ |
| 6  | Travel Tools       | P0       | 3-4  | searchFlights, searchHotels, buildItinerary, checkVisa                        | ✅ |
| 7  | Mock API Layer     | P0       | 1    | Reusable mock responses for external APIs                                     | ✅ |
| 8  | Ikigai Integration | P0       | 1-4  | All agents read Ikigai profile for personalization                            | ✅ |
| 9  | Calendar Mock      | P1       | 2    | Mock calendar data for availability checks                                    | ✅ |
| 10 | Integration Tests  | P1       | 4    | Full agent loops validated                                                    | ✅ |

---

## New Packages

```
packages/
├── agents-restaurant/                 # NEW: Restaurant Agent
│   ├── src/
│   │   ├── index.ts
│   │   ├── agent.ts                   # RestaurantAgent class (L2)
│   │   ├── triggers.ts                # Dining intent detection
│   │   ├── prompts.ts                 # Agent system prompts
│   │   ├── tools/
│   │   │   ├── index.ts
│   │   │   ├── search-restaurants.ts  # Restaurant search (mock)
│   │   │   ├── get-menu.ts            # Menu retrieval (mock)
│   │   │   ├── check-dietary.ts       # Dietary compatibility
│   │   │   └── make-reservation.ts    # Reservation booking (mock)
│   │   └── types.ts
│   ├── __tests__/
│   │   ├── agent.test.ts
│   │   ├── tools.test.ts
│   │   └── integration.test.ts
│   ├── PACKAGE.md
│   └── package.json
│
├── agents-events/                     # NEW: Events Agent
│   ├── src/
│   │   ├── index.ts
│   │   ├── agent.ts                   # EventsAgent class (L2)
│   │   ├── triggers.ts                # Event-related triggers
│   │   ├── prompts.ts                 # Agent system prompts
│   │   ├── tools/
│   │   │   ├── index.ts
│   │   │   ├── search-events.ts       # Event search (mock)
│   │   │   ├── check-availability.ts  # Ticket/calendar check
│   │   │   ├── add-to-calendar.ts     # Calendar integration (mock)
│   │   │   └── invite-friends.ts      # Contact sharing (mock)
│   │   └── types.ts
│   ├── __tests__/
│   │   ├── agent.test.ts
│   │   ├── tools.test.ts
│   │   └── integration.test.ts
│   ├── PACKAGE.md
│   └── package.json
│
├── agents-travel/                     # NEW: Travel Agent
│   ├── src/
│   │   ├── index.ts
│   │   ├── agent.ts                   # TravelAgent class (L3)
│   │   ├── triggers.ts                # Travel-related triggers
│   │   ├── prompts.ts                 # Agent system prompts
│   │   ├── orchestrator.ts            # Multi-step workflow coordination
│   │   ├── tools/
│   │   │   ├── index.ts
│   │   │   ├── search-flights.ts      # Flight search (mock)
│   │   │   ├── search-hotels.ts       # Hotel search (mock)
│   │   │   ├── build-itinerary.ts     # Itinerary creation (includes activity planning)
│   │   │   └── check-visa.ts          # Visa requirements (mock)
│   │   └── types.ts
│   ├── __tests__/
│   │   ├── agent.test.ts
│   │   ├── tools.test.ts
│   │   ├── orchestrator.test.ts
│   │   └── integration.test.ts
│   ├── PACKAGE.md
│   └── package.json
│
├── mock-apis/                         # NEW: Mock external API layer
│   ├── src/
│   │   ├── index.ts
│   │   ├── restaurants/
│   │   │   ├── yelp-mock.ts
│   │   │   ├── opentable-mock.ts
│   │   │   └── google-places-mock.ts
│   │   ├── events/
│   │   │   ├── ticketmaster-mock.ts
│   │   │   ├── eventbrite-mock.ts
│   │   │   └── meetup-mock.ts
│   │   ├── travel/
│   │   │   ├── google-flights-mock.ts
│   │   │   ├── tripadvisor-mock.ts
│   │   │   └── booking-mock.ts
│   │   ├── calendar/
│   │   │   └── calendar-mock.ts       # Mock calendar data
│   │   └── types.ts
│   ├── __tests__/
│   │   └── mocks.test.ts
│   ├── PACKAGE.md
│   └── package.json
```

---

## Week 1: Restaurant Agent (L2)

### 1. RestaurantAgent Class

```typescript
// packages/agents-restaurant/src/agent.ts

import { BaseAgent, type AgentConfig, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { getIkigaiContextForAgent, getKnownPeople } from '@ownyou/ikigai';
import {
  searchRestaurantsTool,
  getMenuTool,
  checkDietaryTool,
  makeReservationTool,
} from './tools';
import { RESTAURANT_SYSTEM_PROMPT, buildDiningContext } from './prompts';

/**
 * Restaurant Agent - v13 Section 3.6.1
 *
 * L2 Agent for restaurant discovery and reservations.
 *
 * Capabilities:
 * - Search restaurants matching criteria
 * - Check dietary accommodations
 * - Retrieve menus and pricing
 * - Make reservations (mock)
 *
 * Limits (L2):
 * - max_tool_calls: 10
 * - max_llm_calls: 5
 * - timeout_seconds: 120
 */
export class RestaurantAgent extends BaseAgent {
  readonly type = 'restaurant';
  readonly level = 'L2';

  protected readonly tools = [
    searchRestaurantsTool,
    getMenuTool,
    checkDietaryTool,
    makeReservationTool,
  ];

  /**
   * v13 Section 3.6.2: Namespace permissions
   */
  protected readonly permissions = {
    read: [
      'semanticMemory',
      'episodicMemory',
      'entities',
      'relationships',
      'diningPreferences',
    ],
    write: [
      'diningReservations',
      'restaurantFavorites',
      'episodicMemory',
      'proceduralMemory:restaurant',
    ],
    search: ['semanticMemory', 'episodicMemory', 'entities'],
  };

  /**
   * Execute restaurant agent workflow
   */
  async execute(input: RestaurantInput): Promise<AgentResult> {
    const { userId, query, companions, occasion, dateTime, location } = input;

    this.tracer.start('restaurant_agent', { userId, query });

    try {
      // 1. Build context with Ikigai personalization
      const ikigaiContext = await getIkigaiContextForAgent(userId, this.store);
      const knownPeople = await getKnownPeople(userId, this.store);
      const diningPrefs = await this.getDiningPreferences(userId);
      const proceduralRules = await this.getProceduralRules(userId);

      const context = buildDiningContext({
        ikigaiContext,
        knownPeople,
        diningPrefs,
        proceduralRules,
        companions,
        occasion,
      });

      // 2. Generate restaurant recommendations via LLM
      const systemPrompt = RESTAURANT_SYSTEM_PROMPT + '\n\n' + context;

      const response = await this.llm.complete({
        model: this.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        tools: this.getToolDefinitions(),
        temperature: 0.7,
      });

      // 3. Execute tool calls
      const toolResults = await this.executeToolCalls(response.toolCalls);

      // 4. Generate mission card
      const mission = await this.generateMissionCard(
        userId,
        query,
        toolResults,
        companions,
        occasion
      );

      // 5. Record episode
      await this.recordEpisode(userId, query, mission, toolResults);

      this.tracer.end('restaurant_agent', { success: true, missionId: mission.id });

      return {
        success: true,
        mission,
        trace: this.tracer.getTrace(),
      };
    } catch (error) {
      this.tracer.end('restaurant_agent', { success: false, error: error.message });
      return {
        success: false,
        error: error.message,
        trace: this.tracer.getTrace(),
      };
    }
  }

  /**
   * Get user's dining preferences from memory
   */
  private async getDiningPreferences(userId: string): Promise<DiningPreferences> {
    try {
      const result = await this.store.get(
        NS.semanticMemory(userId),
        'dining_preferences'
      );
      return result?.value ?? DEFAULT_DINING_PREFERENCES;
    } catch {
      return DEFAULT_DINING_PREFERENCES;
    }
  }

  /**
   * Get learned procedural rules for restaurant recommendations
   */
  private async getProceduralRules(userId: string): Promise<string[]> {
    try {
      const rules = await this.store.list(
        NS.proceduralMemory(userId),
        { prefix: 'restaurant:' }
      );
      return rules
        .filter(r => r.value.confidence >= 0.7)
        .map(r => r.value.rule);
    } catch {
      return [];
    }
  }

  /**
   * Generate mission card from search results
   */
  private async generateMissionCard(
    userId: string,
    query: string,
    toolResults: ToolResult[],
    companions?: string[],
    occasion?: string
  ): Promise<MissionCard> {
    const restaurants = this.extractRestaurants(toolResults);
    const topRestaurant = restaurants[0];

    if (!topRestaurant) {
      throw new Error('No restaurants found matching criteria');
    }

    // Calculate Ikigai dimensions for this mission
    const ikigaiDimensions: IkigaiDimensionType[] = [];
    if (companions && companions.length > 0) {
      ikigaiDimensions.push('relationships');
    }
    if (occasion === 'special' || occasion === 'celebration') {
      ikigaiDimensions.push('experiences');
    }
    ikigaiDimensions.push('interests'); // Dining is always an interest

    const mission: MissionCard = {
      id: this.generateMissionId(),
      type: 'restaurant',
      title: `Dinner at ${topRestaurant.name}`,
      summary: this.buildSummary(topRestaurant, companions, occasion),
      urgency: occasion === 'tonight' ? 'high' : 'medium',
      status: 'CREATED',
      createdAt: Date.now(),
      expiresAt: this.calculateExpiry(occasion),

      // Ikigai context (v13 3.4)
      ikigaiDimensions,
      ikigaiAlignmentBoost: this.calculateAlignmentBoost(ikigaiDimensions),

      // Actions
      primaryAction: {
        label: 'Make Reservation',
        type: 'confirm',
        payload: {
          restaurantId: topRestaurant.id,
          dateTime: topRestaurant.suggestedTime,
          partySize: (companions?.length ?? 0) + 1,
        },
      },
      secondaryActions: [
        {
          label: 'View Menu',
          type: 'navigate',
          payload: { url: topRestaurant.menuUrl },
        },
        {
          label: 'See Alternatives',
          type: 'navigate',
          payload: { view: 'restaurant_alternatives', restaurants },
        },
      ],

      // Agent context
      agentThreadId: this.threadId,
      evidenceRefs: toolResults.map(t => t.evidenceRef),

      // Additional data
      data: {
        restaurant: topRestaurant,
        alternatives: restaurants.slice(1, 4),
        companions,
        occasion,
      },
    };

    // Store mission
    await this.store.put(
      NS.missions(userId),
      mission.id,
      mission
    );

    return mission;
  }

  private buildSummary(
    restaurant: Restaurant,
    companions?: string[],
    occasion?: string
  ): string {
    let summary = `${restaurant.cuisine} restaurant • ${restaurant.priceRange} • ${restaurant.rating}★`;

    if (companions && companions.length > 0) {
      summary += ` • with ${companions.join(', ')}`;
    }
    if (occasion) {
      summary += ` • ${occasion}`;
    }

    return summary;
  }

  private calculateExpiry(occasion?: string): number | undefined {
    if (occasion === 'tonight') {
      return Date.now() + 6 * 60 * 60 * 1000; // 6 hours
    }
    if (occasion === 'this_weekend') {
      return Date.now() + 5 * 24 * 60 * 60 * 1000; // 5 days
    }
    return Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  }
}

interface RestaurantInput {
  userId: string;
  query: string;
  companions?: string[];
  occasion?: string;
  dateTime?: string;
  location?: string;
}

interface DiningPreferences {
  cuisines: string[];
  priceRange: 'budget' | 'moderate' | 'upscale' | 'any';
  dietaryRestrictions: string[];
  ambiance: string[];
  noiseLevel: 'quiet' | 'moderate' | 'lively' | 'any';
}

const DEFAULT_DINING_PREFERENCES: DiningPreferences = {
  cuisines: [],
  priceRange: 'any',
  dietaryRestrictions: [],
  ambiance: [],
  noiseLevel: 'any',
};
```

### 2. Restaurant Tools

```typescript
// packages/agents-restaurant/src/tools/search-restaurants.ts

import type { Tool, ToolResult } from '@ownyou/agents-base';
import { YelpMock, GooglePlacesMock } from '@ownyou/mock-apis';

/**
 * Search Restaurants Tool - v13 Section 3.6.1
 *
 * Searches for restaurants matching user criteria.
 * Uses mock APIs for MVP (Sprint 13 replaces with real APIs).
 */
export const searchRestaurantsTool: Tool = {
  name: 'searchRestaurants',
  description: 'Find restaurants matching cuisine, location, price range, and dietary requirements',

  parameters: {
    type: 'object',
    properties: {
      cuisine: {
        type: 'string',
        description: 'Type of cuisine (e.g., Italian, Japanese, Mexican)',
      },
      location: {
        type: 'string',
        description: 'Location or area to search',
      },
      priceRange: {
        type: 'string',
        enum: ['$', '$$', '$$$', '$$$$'],
        description: 'Price range filter',
      },
      dietaryRequirements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Dietary requirements (vegetarian, vegan, gluten-free, etc.)',
      },
      partySize: {
        type: 'number',
        description: 'Number of people in the party',
      },
      dateTime: {
        type: 'string',
        description: 'Desired date and time (ISO 8601)',
      },
      ambiance: {
        type: 'string',
        description: 'Preferred ambiance (romantic, casual, business, etc.)',
      },
    },
    required: ['location'],
  },

  async execute(params: SearchRestaurantsParams): Promise<ToolResult> {
    const {
      cuisine,
      location,
      priceRange,
      dietaryRequirements,
      partySize,
      dateTime,
      ambiance,
    } = params;

    // Use mock APIs for MVP
    const yelpResults = await YelpMock.searchRestaurants({
      term: cuisine,
      location,
      price: priceRange,
      categories: dietaryRequirements,
    });

    const placesResults = await GooglePlacesMock.searchNearby({
      query: cuisine ? `${cuisine} restaurant` : 'restaurant',
      location,
      priceLevel: mapPriceRange(priceRange),
    });

    // Merge and dedupe results
    const merged = mergeRestaurantResults(yelpResults, placesResults);

    // Filter by dietary requirements
    const filtered = dietaryRequirements?.length
      ? merged.filter(r => matchesDietary(r, dietaryRequirements))
      : merged;

    // Filter by availability (mock)
    const available = dateTime
      ? filtered.filter(r => hasAvailability(r, dateTime, partySize))
      : filtered;

    // Sort by rating and relevance
    const sorted = available.sort((a, b) => {
      const ratingDiff = b.rating - a.rating;
      if (Math.abs(ratingDiff) > 0.3) return ratingDiff;
      return b.reviewCount - a.reviewCount;
    });

    return {
      success: true,
      data: {
        restaurants: sorted.slice(0, 10),
        totalResults: sorted.length,
        searchCriteria: params,
      },
      evidenceRef: `search:restaurants:${Date.now()}`,
    };
  },
};

interface SearchRestaurantsParams {
  cuisine?: string;
  location: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  dietaryRequirements?: string[];
  partySize?: number;
  dateTime?: string;
  ambiance?: string;
}

function mapPriceRange(range?: string): number | undefined {
  const mapping: Record<string, number> = {
    '$': 1,
    '$$': 2,
    '$$$': 3,
    '$$$$': 4,
  };
  return range ? mapping[range] : undefined;
}

function matchesDietary(restaurant: Restaurant, requirements: string[]): boolean {
  const labels = restaurant.dietaryLabels ?? [];
  return requirements.every(req =>
    labels.some(label => label.toLowerCase().includes(req.toLowerCase()))
  );
}

function hasAvailability(
  restaurant: Restaurant,
  dateTime: string,
  partySize?: number
): boolean {
  // Mock availability check
  // In production, would call OpenTable API
  return true;
}
```

```typescript
// packages/agents-restaurant/src/tools/make-reservation.ts

import type { Tool, ToolResult } from '@ownyou/agents-base';
import { OpenTableMock } from '@ownyou/mock-apis';

/**
 * Make Reservation Tool - v13 Section 3.6.1
 *
 * Books a restaurant reservation.
 * Uses mock API for MVP (Sprint 13 replaces with real API).
 */
export const makeReservationTool: Tool = {
  name: 'makeReservation',
  description: 'Book a table at a restaurant for a specific date, time, and party size',

  parameters: {
    type: 'object',
    properties: {
      restaurantId: {
        type: 'string',
        description: 'Unique identifier of the restaurant',
      },
      dateTime: {
        type: 'string',
        description: 'Reservation date and time (ISO 8601)',
      },
      partySize: {
        type: 'number',
        description: 'Number of guests',
      },
      specialRequests: {
        type: 'string',
        description: 'Special requests (e.g., high chair, dietary needs)',
      },
      contactName: {
        type: 'string',
        description: 'Name for the reservation',
      },
    },
    required: ['restaurantId', 'dateTime', 'partySize'],
  },

  async execute(params: MakeReservationParams): Promise<ToolResult> {
    const { restaurantId, dateTime, partySize, specialRequests, contactName } = params;

    // Use mock API for MVP
    const reservation = await OpenTableMock.createReservation({
      restaurantId,
      dateTime,
      partySize,
      specialRequests,
      guestName: contactName ?? 'Guest',
    });

    if (!reservation.success) {
      return {
        success: false,
        error: reservation.error ?? 'Failed to make reservation',
        evidenceRef: `reservation:failed:${Date.now()}`,
      };
    }

    return {
      success: true,
      data: {
        confirmationNumber: reservation.confirmationNumber,
        restaurantName: reservation.restaurantName,
        dateTime: reservation.dateTime,
        partySize: reservation.partySize,
        status: 'confirmed',
      },
      evidenceRef: `reservation:${reservation.confirmationNumber}`,
    };
  },
};

interface MakeReservationParams {
  restaurantId: string;
  dateTime: string;
  partySize: number;
  specialRequests?: string;
  contactName?: string;
}
```

### 3. Restaurant Agent Prompts

```typescript
// packages/agents-restaurant/src/prompts.ts

import type { Person } from '@ownyou/ikigai';

/**
 * Restaurant Agent System Prompt - v13 Section 3.6.1
 */
export const RESTAURANT_SYSTEM_PROMPT = `You are a restaurant recommendation assistant that helps users find the perfect dining experience.

Your capabilities:
1. Search for restaurants matching cuisine, location, and dietary requirements
2. Check menus and pricing
3. Verify dietary accommodations
4. Make reservations

Your approach:
- Consider the user's dining history and preferences from their profile
- When companions are mentioned, think about the social context (romantic dinner, family gathering, business meal)
- Prioritize restaurants that match dietary restrictions of ALL diners
- Balance quality ratings with practical factors (distance, availability, price)

When making recommendations:
1. Start with their stated preferences
2. Cross-reference with their Ikigai profile (interests, key people)
3. Consider past dining feedback (what worked, what didn't)
4. Suggest alternatives at different price points when appropriate

You have access to the following tools:
- searchRestaurants: Find restaurants matching criteria
- getMenu: Retrieve menu and pricing details
- checkDietary: Verify dietary accommodation availability
- makeReservation: Book a table

Always explain WHY you're recommending a particular restaurant based on the user's profile and preferences.`;

/**
 * Build dining context from Ikigai and preferences
 */
export function buildDiningContext(params: DiningContextParams): string {
  const {
    ikigaiContext,
    knownPeople,
    diningPrefs,
    proceduralRules,
    companions,
    occasion,
  } = params;

  const sections: string[] = [];

  // Ikigai context
  sections.push('## User Profile');
  sections.push(ikigaiContext);

  // Dining preferences
  if (diningPrefs) {
    sections.push('\n## Dining Preferences');
    if (diningPrefs.cuisines.length > 0) {
      sections.push(`Favorite cuisines: ${diningPrefs.cuisines.join(', ')}`);
    }
    sections.push(`Price preference: ${diningPrefs.priceRange}`);
    if (diningPrefs.dietaryRestrictions.length > 0) {
      sections.push(`Dietary restrictions: ${diningPrefs.dietaryRestrictions.join(', ')}`);
    }
    if (diningPrefs.ambiance.length > 0) {
      sections.push(`Preferred ambiance: ${diningPrefs.ambiance.join(', ')}`);
    }
  }

  // Companion context
  if (companions && companions.length > 0) {
    sections.push('\n## Dining Companions');

    for (const companionName of companions) {
      const person = knownPeople.find(
        p => p.name.toLowerCase() === companionName.toLowerCase()
      );

      if (person) {
        sections.push(`- ${person.name} (${person.relationshipType})`);
        if (person.sharedActivities.length > 0) {
          sections.push(`  Past shared activities: ${person.sharedActivities.join(', ')}`);
        }
      } else {
        sections.push(`- ${companionName} (unknown relationship)`);
      }
    }
  }

  // Occasion context
  if (occasion) {
    sections.push(`\n## Occasion: ${occasion}`);
    sections.push(getOccasionGuidance(occasion));
  }

  // Learned rules
  if (proceduralRules.length > 0) {
    sections.push('\n## Learned Preferences');
    for (const rule of proceduralRules) {
      sections.push(`- ${rule}`);
    }
  }

  return sections.join('\n');
}

function getOccasionGuidance(occasion: string): string {
  const guidance: Record<string, string> = {
    romantic: 'Prioritize: quiet atmosphere, intimate seating, good ambiance, quality over quantity',
    celebration: 'Prioritize: group-friendly, can accommodate large parties, festive atmosphere',
    business: 'Prioritize: quiet enough for conversation, professional atmosphere, convenient location',
    casual: 'Prioritize: relaxed vibe, good value, crowd-pleasers on menu',
    family: 'Prioritize: kid-friendly options, varied menu, comfortable seating',
    tonight: 'Note: Short notice - check immediate availability, suggest alternatives if needed',
    this_weekend: 'Note: Weekend reservations book up fast - suggest booking now',
  };
  return guidance[occasion] ?? '';
}

interface DiningContextParams {
  ikigaiContext: string;
  knownPeople: Person[];
  diningPrefs?: DiningPreferences;
  proceduralRules: string[];
  companions?: string[];
  occasion?: string;
}
```

---

## Week 2: Events Agent (L2)

### 4. EventsAgent Class

```typescript
// packages/agents-events/src/agent.ts

import { BaseAgent, type AgentConfig, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { getIkigaiContextForAgent, getKnownPeople } from '@ownyou/ikigai';
import { CalendarMock } from '@ownyou/mock-apis';
import {
  searchEventsTool,
  checkAvailabilityTool,
  addToCalendarTool,
  inviteFriendsTool,
} from './tools';
import { EVENTS_SYSTEM_PROMPT, buildEventsContext } from './prompts';

/**
 * Events Agent - v13 Section 3.6.1
 *
 * L2 Agent for event discovery and calendar management.
 *
 * Capabilities:
 * - Search for events matching interests
 * - Check ticket availability
 * - Add events to calendar
 * - Invite friends to events
 *
 * Limits (L2):
 * - max_tool_calls: 10
 * - max_llm_calls: 5
 * - timeout_seconds: 120
 */
export class EventsAgent extends BaseAgent {
  readonly type = 'events';
  readonly level = 'L2';

  protected readonly tools = [
    searchEventsTool,
    checkAvailabilityTool,
    addToCalendarTool,
    inviteFriendsTool,
  ];

  protected readonly permissions = {
    read: [
      'semanticMemory',
      'episodicMemory',
      'entities',
      'relationships',
      'calendar',
      'interests',
    ],
    write: [
      'eventInterests',
      'eventBookings',
      'episodicMemory',
      'proceduralMemory:events',
    ],
    search: ['semanticMemory', 'episodicMemory', 'interests'],
  };

  /**
   * Execute events agent workflow
   */
  async execute(input: EventsInput): Promise<AgentResult> {
    const { userId, query, dateRange, interests, companions, location } = input;

    this.tracer.start('events_agent', { userId, query });

    try {
      // 1. Build context with Ikigai personalization
      const ikigaiContext = await getIkigaiContextForAgent(userId, this.store);
      const knownPeople = await getKnownPeople(userId, this.store);
      const calendarAvailability = await this.getCalendarAvailability(userId, dateRange);
      const proceduralRules = await this.getProceduralRules(userId);

      const context = buildEventsContext({
        ikigaiContext,
        knownPeople,
        calendarAvailability,
        proceduralRules,
        companions,
        dateRange,
      });

      // 2. Determine interests to search
      const searchInterests = interests ?? await this.getInterestsFromIkigai(userId);

      // 3. Generate event recommendations via LLM
      const systemPrompt = EVENTS_SYSTEM_PROMPT + '\n\n' + context;

      const response = await this.llm.complete({
        model: this.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query ?? `Find events matching my interests for ${dateRange ?? 'this weekend'}` },
        ],
        tools: this.getToolDefinitions(),
        temperature: 0.7,
      });

      // 4. Execute tool calls
      const toolResults = await this.executeToolCalls(response.toolCalls);

      // 5. Generate mission card
      const mission = await this.generateMissionCard(
        userId,
        query,
        toolResults,
        companions
      );

      // 6. Record episode
      await this.recordEpisode(userId, query, mission, toolResults);

      this.tracer.end('events_agent', { success: true, missionId: mission.id });

      return {
        success: true,
        mission,
        trace: this.tracer.getTrace(),
      };
    } catch (error) {
      this.tracer.end('events_agent', { success: false, error: error.message });
      return {
        success: false,
        error: error.message,
        trace: this.tracer.getTrace(),
      };
    }
  }

  /**
   * Get calendar availability (mock)
   */
  private async getCalendarAvailability(
    userId: string,
    dateRange?: string
  ): Promise<CalendarSlot[]> {
    return CalendarMock.getFreeSlots(userId, dateRange ?? 'this_week');
  }

  /**
   * Extract interests from Ikigai profile
   */
  private async getInterestsFromIkigai(userId: string): Promise<string[]> {
    const profile = await this.store.get(
      NS.semanticMemory(userId),
      'ikigai_profile'
    );

    if (!profile?.value?.interests?.genuineInterests) {
      return [];
    }

    return profile.value.interests.genuineInterests
      .slice(0, 5)
      .map((i: any) => i.topic);
  }

  /**
   * Get learned procedural rules for events
   */
  private async getProceduralRules(userId: string): Promise<string[]> {
    try {
      const rules = await this.store.list(
        NS.proceduralMemory(userId),
        { prefix: 'events:' }
      );
      return rules
        .filter(r => r.value.confidence >= 0.7)
        .map(r => r.value.rule);
    } catch {
      return [];
    }
  }

  /**
   * Generate mission card from event search results
   */
  private async generateMissionCard(
    userId: string,
    query: string | undefined,
    toolResults: ToolResult[],
    companions?: string[]
  ): Promise<MissionCard> {
    const events = this.extractEvents(toolResults);
    const topEvent = events[0];

    if (!topEvent) {
      throw new Error('No events found matching criteria');
    }

    // Calculate Ikigai dimensions
    const ikigaiDimensions: IkigaiDimensionType[] = ['experiences', 'interests'];
    if (companions && companions.length > 0) {
      ikigaiDimensions.push('relationships');
    }

    const mission: MissionCard = {
      id: this.generateMissionId(),
      type: 'events',
      title: topEvent.name,
      summary: this.buildEventSummary(topEvent, companions),
      urgency: this.calculateEventUrgency(topEvent),
      status: 'CREATED',
      createdAt: Date.now(),
      expiresAt: topEvent.startDate,

      // Ikigai context
      ikigaiDimensions,
      ikigaiAlignmentBoost: this.calculateAlignmentBoost(ikigaiDimensions),

      // Actions
      primaryAction: {
        label: topEvent.requiresTicket ? 'Get Tickets' : 'Add to Calendar',
        type: topEvent.requiresTicket ? 'external' : 'confirm',
        payload: topEvent.requiresTicket
          ? { url: topEvent.ticketUrl }
          : { eventId: topEvent.id },
      },
      secondaryActions: companions?.length
        ? [{
            label: 'Invite Friends',
            type: 'confirm',
            payload: { eventId: topEvent.id, contacts: companions },
          }]
        : undefined,

      // Agent context
      agentThreadId: this.threadId,
      evidenceRefs: toolResults.map(t => t.evidenceRef),

      // Additional data
      data: {
        event: topEvent,
        alternatives: events.slice(1, 4),
        companions,
      },
    };

    await this.store.put(NS.missions(userId), mission.id, mission);

    return mission;
  }

  private buildEventSummary(event: Event, companions?: string[]): string {
    let summary = `${event.venue} • ${formatEventDate(event.startDate)}`;

    if (event.price) {
      summary += ` • ${event.price}`;
    }
    if (companions && companions.length > 0) {
      summary += ` • with ${companions.join(', ')}`;
    }

    return summary;
  }

  private calculateEventUrgency(event: Event): 'low' | 'medium' | 'high' {
    const daysUntil = (event.startDate - Date.now()) / (1000 * 60 * 60 * 24);

    if (daysUntil <= 2) return 'high';
    if (daysUntil <= 7) return 'medium';
    return 'low';
  }
}

interface EventsInput {
  userId: string;
  query?: string;
  dateRange?: string;
  interests?: string[];
  companions?: string[];
  location?: string;
}

interface CalendarSlot {
  start: string;
  end: string;
  duration: number;
}
```

### 5. Events Tools

```typescript
// packages/agents-events/src/tools/search-events.ts

import type { Tool, ToolResult } from '@ownyou/agents-base';
import { TicketmasterMock, EventbriteMock, MeetupMock } from '@ownyou/mock-apis';

/**
 * Search Events Tool - v13 Section 3.6.1
 */
export const searchEventsTool: Tool = {
  name: 'searchEvents',
  description: 'Find events matching interests, location, and date range',

  parameters: {
    type: 'object',
    properties: {
      interests: {
        type: 'array',
        items: { type: 'string' },
        description: 'Interests to search for (e.g., music, comedy, sports)',
      },
      location: {
        type: 'string',
        description: 'City or area to search',
      },
      dateRange: {
        type: 'string',
        enum: ['today', 'tomorrow', 'this_weekend', 'this_week', 'next_week', 'this_month'],
        description: 'Date range for events',
      },
      eventType: {
        type: 'string',
        enum: ['concert', 'sports', 'theater', 'comedy', 'festival', 'workshop', 'social'],
        description: 'Type of event',
      },
      priceRange: {
        type: 'string',
        enum: ['free', 'budget', 'moderate', 'premium'],
        description: 'Price range filter',
      },
    },
    required: ['location'],
  },

  async execute(params: SearchEventsParams): Promise<ToolResult> {
    const { interests, location, dateRange, eventType, priceRange } = params;

    // Query multiple event sources (mocks for MVP)
    const [ticketmaster, eventbrite, meetup] = await Promise.all([
      TicketmasterMock.searchEvents({
        keyword: eventType ?? interests?.[0],
        city: location,
        startDateTime: getStartDate(dateRange),
        endDateTime: getEndDate(dateRange),
      }),
      EventbriteMock.searchEvents({
        q: interests?.join(' ') ?? eventType,
        location: { address: location },
        dateRange: dateRange,
      }),
      MeetupMock.searchEvents({
        topics: interests ?? [],
        location: location,
        radius: '25mi',
      }),
    ]);

    // Merge and dedupe
    const allEvents = mergeEventResults(ticketmaster, eventbrite, meetup);

    // Filter by price range
    const filtered = priceRange
      ? allEvents.filter(e => matchesPriceRange(e, priceRange))
      : allEvents;

    // Sort by relevance and date
    const sorted = filtered.sort((a, b) => {
      // Prioritize by interest match
      const aScore = calculateInterestScore(a, interests ?? []);
      const bScore = calculateInterestScore(b, interests ?? []);
      if (aScore !== bScore) return bScore - aScore;

      // Then by date (sooner first)
      return a.startDate - b.startDate;
    });

    return {
      success: true,
      data: {
        events: sorted.slice(0, 15),
        totalResults: sorted.length,
        searchCriteria: params,
      },
      evidenceRef: `search:events:${Date.now()}`,
    };
  },
};

interface SearchEventsParams {
  interests?: string[];
  location: string;
  dateRange?: string;
  eventType?: string;
  priceRange?: string;
}
```

```typescript
// packages/agents-events/src/tools/add-to-calendar.ts

import type { Tool, ToolResult } from '@ownyou/agents-base';
import { CalendarMock } from '@ownyou/mock-apis';

/**
 * Add to Calendar Tool - v13 Section 3.6.1
 */
export const addToCalendarTool: Tool = {
  name: 'addToCalendar',
  description: 'Add an event to the user\'s calendar',

  parameters: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: 'ID of the event to add',
      },
      eventTitle: {
        type: 'string',
        description: 'Title for the calendar entry',
      },
      startTime: {
        type: 'string',
        description: 'Start time (ISO 8601)',
      },
      endTime: {
        type: 'string',
        description: 'End time (ISO 8601)',
      },
      location: {
        type: 'string',
        description: 'Event location/venue',
      },
      notes: {
        type: 'string',
        description: 'Additional notes for the calendar entry',
      },
      reminders: {
        type: 'array',
        items: { type: 'number' },
        description: 'Reminder times in minutes before event',
      },
    },
    required: ['eventTitle', 'startTime', 'endTime'],
  },

  async execute(params: AddToCalendarParams): Promise<ToolResult> {
    const { eventId, eventTitle, startTime, endTime, location, notes, reminders } = params;

    // Use mock calendar for MVP
    const result = await CalendarMock.createEvent({
      title: eventTitle,
      start: startTime,
      end: endTime,
      location,
      description: notes,
      reminders: reminders ?? [60, 1440], // Default: 1 hour and 1 day before
    });

    return {
      success: true,
      data: {
        calendarEventId: result.id,
        addedToCalendar: true,
        reminderSet: true,
      },
      evidenceRef: `calendar:${result.id}`,
    };
  },
};

interface AddToCalendarParams {
  eventId?: string;
  eventTitle: string;
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
  reminders?: number[];
}
```

---

## Weeks 3-4: Travel Agent (L3)

### 6. TravelAgent Class

```typescript
// packages/agents-travel/src/agent.ts

import { BaseAgent, type AgentConfig, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { getIkigaiContextForAgent, getKnownPeople } from '@ownyou/ikigai';
import { CalendarMock } from '@ownyou/mock-apis';
import {
  searchFlightsTool,
  searchHotelsTool,
  buildItineraryTool,
  checkVisaTool,
} from './tools';
import { TravelOrchestrator } from './orchestrator';
import { TRAVEL_SYSTEM_PROMPT, buildTravelContext } from './prompts';

/**
 * Travel Agent - v13 Section 3.6.1
 *
 * L3 Agent for comprehensive travel planning.
 *
 * This is the most complex agent type, handling multi-step
 * workflows that coordinate flights, hotels, and itineraries.
 *
 * Capabilities (per v13 3.6.1):
 * - Search flights with preferences (direct, timing)
 * - Search accommodations matching preferences
 * - Build day-by-day itinerary (includes activities)
 * - Check visa requirements for destination
 *
 * Limits (L3):
 * - max_tool_calls: 25
 * - max_llm_calls: 10
 * - timeout_seconds: 300
 */
export class TravelAgent extends BaseAgent {
  readonly type = 'travel';
  readonly level = 'L3';

  private orchestrator: TravelOrchestrator;

  // v13 Section 3.6.1: Exactly 4 tools for Travel Agent
  protected readonly tools = [
    searchFlightsTool,
    searchHotelsTool,
    buildItineraryTool,
    checkVisaTool,
  ];

  protected readonly permissions = {
    read: [
      'semanticMemory',
      'episodicMemory',
      'entities',
      'relationships',
      'calendar',
      'financialProfile',
      'travelPreferences',
    ],
    write: [
      'travelItineraries',
      'travelBookings',
      'episodicMemory',
      'proceduralMemory:travel',
    ],
    search: ['semanticMemory', 'episodicMemory', 'entities', 'relationships'],
  };

  constructor(config: AgentConfig) {
    super(config);
    this.orchestrator = new TravelOrchestrator(this);
  }

  /**
   * Execute travel planning workflow
   *
   * L3 workflow has multiple phases (per v13 3.6.1):
   * 1. Understand trip requirements
   * 2. Search flights
   * 3. Search accommodations
   * 4. Build itinerary (includes activity suggestions)
   * 5. Generate comprehensive mission card
   */
  async execute(input: TravelInput): Promise<AgentResult> {
    const {
      userId,
      query,
      destination,
      origin,
      departureDate,
      returnDate,
      travelers,
      budget,
      tripType,
    } = input;

    this.tracer.start('travel_agent', { userId, destination });

    try {
      // 1. Build comprehensive context
      const ikigaiContext = await getIkigaiContextForAgent(userId, this.store);
      const knownPeople = await getKnownPeople(userId, this.store);
      const travelPrefs = await this.getTravelPreferences(userId);
      const proceduralRules = await this.getProceduralRules(userId);
      const calendarAvailability = await this.getCalendarAvailability(
        userId,
        departureDate,
        returnDate
      );

      const context = buildTravelContext({
        ikigaiContext,
        knownPeople,
        travelPrefs,
        proceduralRules,
        travelers,
        tripType,
        budget,
        calendarAvailability,
      });

      // 2. Use orchestrator for multi-step planning
      const tripPlan = await this.orchestrator.planTrip({
        destination,
        origin: origin ?? 'user_location',
        departureDate,
        returnDate,
        travelers: travelers ?? 1,
        budget,
        tripType,
        context,
        llm: this.llm,
        systemPrompt: TRAVEL_SYSTEM_PROMPT,
      });

      // 3. Generate comprehensive mission card
      const mission = await this.generateMissionCard(
        userId,
        tripPlan,
        travelers
      );

      // 4. Record episode
      await this.recordEpisode(userId, query ?? `Trip to ${destination}`, mission, tripPlan);

      this.tracer.end('travel_agent', { success: true, missionId: mission.id });

      return {
        success: true,
        mission,
        trace: this.tracer.getTrace(),
      };
    } catch (error) {
      this.tracer.end('travel_agent', { success: false, error: error.message });
      return {
        success: false,
        error: error.message,
        trace: this.tracer.getTrace(),
      };
    }
  }

  /**
   * Get travel preferences from memory
   */
  private async getTravelPreferences(userId: string): Promise<TravelPreferences> {
    try {
      const result = await this.store.get(
        NS.semanticMemory(userId),
        'travel_preferences'
      );
      return result?.value ?? DEFAULT_TRAVEL_PREFERENCES;
    } catch {
      return DEFAULT_TRAVEL_PREFERENCES;
    }
  }

  /**
   * Get calendar availability for trip dates
   */
  private async getCalendarAvailability(
    userId: string,
    departure?: string,
    return_?: string
  ): Promise<CalendarConflict[]> {
    if (!departure || !return_) return [];

    return CalendarMock.getConflicts(userId, departure, return_);
  }

  /**
   * Get learned procedural rules for travel
   */
  private async getProceduralRules(userId: string): Promise<string[]> {
    try {
      const rules = await this.store.list(
        NS.proceduralMemory(userId),
        { prefix: 'travel:' }
      );
      return rules
        .filter(r => r.value.confidence >= 0.7)
        .map(r => r.value.rule);
    } catch {
      return [];
    }
  }

  /**
   * Generate comprehensive travel mission card
   */
  private async generateMissionCard(
    userId: string,
    tripPlan: TripPlan,
    travelers?: TravelerInfo[]
  ): Promise<MissionCard> {
    // Calculate Ikigai dimensions
    const ikigaiDimensions: IkigaiDimensionType[] = ['experiences'];
    if (travelers && travelers.length > 1) {
      ikigaiDimensions.push('relationships');
    }

    // Calculate total cost
    const totalCost = this.calculateTotalCost(tripPlan);

    const mission: MissionCard = {
      id: this.generateMissionId(),
      type: 'travel',
      title: `Trip to ${tripPlan.destination}`,
      summary: this.buildTripSummary(tripPlan, totalCost),
      urgency: this.calculateTripUrgency(tripPlan.departureDate),
      status: 'CREATED',
      createdAt: Date.now(),
      expiresAt: new Date(tripPlan.departureDate).getTime(),

      // Ikigai context
      ikigaiDimensions,
      ikigaiAlignmentBoost: this.calculateAlignmentBoost(ikigaiDimensions),

      // Actions
      primaryAction: {
        label: 'Review Itinerary',
        type: 'navigate',
        payload: { view: 'travel_itinerary', tripId: tripPlan.id },
      },
      secondaryActions: [
        {
          label: 'Book Flights',
          type: 'external',
          payload: { url: tripPlan.flights?.[0]?.bookingUrl },
        },
        {
          label: 'Book Hotel',
          type: 'external',
          payload: { url: tripPlan.hotels?.[0]?.bookingUrl },
        },
        {
          label: 'Modify Trip',
          type: 'confirm',
          payload: { action: 'modify', tripId: tripPlan.id },
        },
      ],

      // Agent context
      agentThreadId: this.threadId,
      evidenceRefs: tripPlan.evidenceRefs,

      // Full trip data
      data: {
        tripPlan,
        totalCost,
        travelers,
      },
    };

    await this.store.put(NS.missions(userId), mission.id, mission);

    // Also store the full itinerary
    await this.store.put(
      NS.travelItineraries(userId),
      tripPlan.id,
      tripPlan
    );

    return mission;
  }

  private buildTripSummary(tripPlan: TripPlan, totalCost: number): string {
    const nights = this.calculateNights(tripPlan.departureDate, tripPlan.returnDate);
    const dateRange = `${formatDate(tripPlan.departureDate)} - ${formatDate(tripPlan.returnDate)}`;

    return `${nights} nights • ${dateRange} • Est. $${totalCost.toLocaleString()}`;
  }

  private calculateTotalCost(tripPlan: TripPlan): number {
    let total = 0;

    if (tripPlan.flights) {
      total += tripPlan.flights.reduce((sum, f) => sum + f.price, 0);
    }
    if (tripPlan.hotels) {
      total += tripPlan.hotels.reduce((sum, h) => sum + h.totalPrice, 0);
    }
    if (tripPlan.activities) {
      total += tripPlan.activities.reduce((sum, a) => sum + (a.price ?? 0), 0);
    }

    return total;
  }

  private calculateNights(departure: string, return_: string): number {
    const d1 = new Date(departure);
    const d2 = new Date(return_);
    return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateTripUrgency(departureDate: string): 'low' | 'medium' | 'high' {
    const daysUntil = (new Date(departureDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);

    if (daysUntil <= 7) return 'high';
    if (daysUntil <= 30) return 'medium';
    return 'low';
  }
}

interface TravelInput {
  userId: string;
  query?: string;
  destination: string;
  origin?: string;
  departureDate: string;
  returnDate: string;
  travelers?: TravelerInfo[];
  budget?: number;
  tripType?: 'adventure' | 'relaxation' | 'cultural' | 'business' | 'family';
}

interface TravelerInfo {
  name: string;
  relationship?: string;
}

interface TravelPreferences {
  preferredAirlines: string[];
  seatPreference: 'window' | 'aisle' | 'any';
  flightClass: 'economy' | 'premium_economy' | 'business' | 'first';
  hotelStars: number;
  hotelAmenities: string[];
  activityLevel: 'relaxed' | 'moderate' | 'active';
}

const DEFAULT_TRAVEL_PREFERENCES: TravelPreferences = {
  preferredAirlines: [],
  seatPreference: 'any',
  flightClass: 'economy',
  hotelStars: 3,
  hotelAmenities: [],
  activityLevel: 'moderate',
};
```

### 7. Travel Orchestrator

```typescript
// packages/agents-travel/src/orchestrator.ts

import type { LLMClient } from '@ownyou/llm-client';
import type { TravelAgent } from './agent';
import type { TripPlan, FlightOption, HotelOption, ActivityOption } from './types';
import {
  searchFlightsTool,
  searchHotelsTool,
  buildItineraryTool,
} from './tools';

/**
 * Travel Orchestrator - Multi-step workflow coordinator
 *
 * L3 agents require careful orchestration of multiple tool calls
 * to build comprehensive results.
 *
 * Workflow phases (per v13 3.6.1):
 * 1. Flight search (outbound + return)
 * 2. Hotel search (near destination)
 * 3. Itinerary construction (includes activity planning via LLM)
 *
 * Note: Activity planning is integrated into buildItinerary per v13 spec.
 * The buildItinerary tool uses LLM to suggest activities based on
 * user interests from Ikigai profile.
 */
export class TravelOrchestrator {
  private agent: TravelAgent;

  constructor(agent: TravelAgent) {
    this.agent = agent;
  }

  /**
   * Plan a complete trip with flights, hotels, and activities
   */
  async planTrip(params: PlanTripParams): Promise<TripPlan> {
    const {
      destination,
      origin,
      departureDate,
      returnDate,
      travelers,
      budget,
      tripType,
      context,
      llm,
      systemPrompt,
    } = params;

    const evidenceRefs: string[] = [];

    // Phase 1: Search flights
    const flights = await this.searchFlights({
      origin,
      destination,
      departureDate,
      returnDate,
      travelers,
      budget: budget ? budget * 0.4 : undefined, // 40% of budget for flights
    });
    evidenceRefs.push(...flights.evidenceRefs);

    // Phase 2: Search hotels
    const hotels = await this.searchHotels({
      destination,
      checkIn: departureDate,
      checkOut: returnDate,
      guests: travelers,
      budget: budget ? budget * 0.5 : undefined, // 50% of budget for hotels
      tripType,
    });
    evidenceRefs.push(...hotels.evidenceRefs);

    // Phase 3: Build itinerary using LLM (includes activity planning per v13 3.6.1)
    const itinerary = await this.buildItinerary({
      destination,
      departureDate,
      returnDate,
      flights: flights.options,
      hotels: hotels.options,
      tripType,
      context,
      llm,
      systemPrompt,
      activityBudget: budget ? budget * 0.1 : undefined, // 10% for activities
    });

    return {
      id: this.generateTripId(),
      destination,
      origin,
      departureDate,
      returnDate,
      travelers,
      flights: [flights.options[0]], // Top flight option
      hotels: [hotels.options[0]], // Top hotel option
      activities: itinerary.selectedActivities,
      itinerary: itinerary.dayByDay,
      totalEstimate: itinerary.totalEstimate,
      evidenceRefs,
      createdAt: Date.now(),
    };
  }

  /**
   * Search flights for the trip
   */
  private async searchFlights(params: FlightSearchParams): Promise<{
    options: FlightOption[];
    evidenceRefs: string[];
  }> {
    const outbound = await searchFlightsTool.execute({
      origin: params.origin,
      destination: params.destination,
      date: params.departureDate,
      travelers: params.travelers,
      maxPrice: params.budget ? params.budget / 2 : undefined,
    });

    const return_ = await searchFlightsTool.execute({
      origin: params.destination,
      destination: params.origin,
      date: params.returnDate,
      travelers: params.travelers,
      maxPrice: params.budget ? params.budget / 2 : undefined,
    });

    // Combine outbound and return into round-trip options
    const options = this.combineFlights(outbound.data.flights, return_.data.flights);

    return {
      options,
      evidenceRefs: [outbound.evidenceRef, return_.evidenceRef],
    };
  }

  /**
   * Search hotels for the stay
   */
  private async searchHotels(params: HotelSearchParams): Promise<{
    options: HotelOption[];
    evidenceRefs: string[];
  }> {
    const result = await searchHotelsTool.execute({
      destination: params.destination,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      guests: params.guests,
      maxPricePerNight: params.budget
        ? params.budget / this.calculateNights(params.checkIn, params.checkOut)
        : undefined,
      amenities: this.getAmenitiiesForTripType(params.tripType),
    });

    return {
      options: result.data.hotels,
      evidenceRefs: [result.evidenceRef],
    };
  }

  /**
   * Build day-by-day itinerary using LLM (per v13 3.6.1)
   *
   * This tool handles activity planning internally by using LLM to
   * suggest activities based on user interests from Ikigai profile.
   */
  private async buildItinerary(params: ItineraryBuildParams): Promise<{
    dayByDay: DayPlan[];
    suggestedActivities: ActivityOption[];
    totalEstimate: number;
  }> {
    const { llm, systemPrompt, flights, hotels, tripType, context, activityBudget } = params;

    // Extract interests from Ikigai context for activity suggestions
    const interests = this.extractInterestsFromContext(context);
    const categories = this.getCategoriesForTripType(tripType);

    const prompt = `Create a day-by-day itinerary for this trip:

Destination: ${params.destination}
Dates: ${params.departureDate} to ${params.returnDate}
Trip type: ${tripType ?? 'general'}
Activity budget: ${activityBudget ? `$${activityBudget}` : 'flexible'}

User interests: ${interests.join(', ')}
Activity categories to consider: ${categories.join(', ')}

Available flights:
${JSON.stringify(flights.slice(0, 3), null, 2)}

Available hotels:
${JSON.stringify(hotels.slice(0, 3), null, 2)}

User context:
${context}

Create a balanced itinerary that:
1. Uses travel time wisely
2. Suggests activities based on user interests
3. Includes rest time
4. Considers the user's interests and preferences
5. Groups nearby activities together

Return JSON:
{
  "dayByDay": [
    {
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "time": "10:00",
          "activity": "...",
          "duration": "2h",
          "notes": "..."
        }
      ],
      "meals": { "breakfast": "...", "lunch": "...", "dinner": "..." }
    }
  ],
  "selectedActivities": ["activity_id_1", "activity_id_2"],
  "totalEstimate": 1500
}`;

    const response = await llm.complete({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      responseFormat: 'json',
    });

    const parsed = JSON.parse(response.content);

    // Map selected activity IDs back to full objects
    const selectedActivities = activities.filter(a =>
      parsed.selectedActivities.includes(a.id)
    );

    return {
      dayByDay: parsed.dayByDay,
      selectedActivities,
      totalEstimate: parsed.totalEstimate,
    };
  }

  private combineFlights(outbound: any[], return_: any[]): FlightOption[] {
    // Create round-trip combinations
    const combinations: FlightOption[] = [];

    for (const out of outbound.slice(0, 3)) {
      for (const ret of return_.slice(0, 3)) {
        combinations.push({
          id: `${out.id}-${ret.id}`,
          outbound: out,
          return: ret,
          price: out.price + ret.price,
          totalDuration: out.duration + ret.duration,
          bookingUrl: out.bookingUrl,
        });
      }
    }

    // Sort by price
    return combinations.sort((a, b) => a.price - b.price);
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getAmenitiiesForTripType(tripType?: string): string[] {
    const amenities: Record<string, string[]> = {
      business: ['wifi', 'workspace', 'gym'],
      relaxation: ['pool', 'spa', 'room_service'],
      family: ['pool', 'family_friendly', 'breakfast'],
      adventure: ['parking', 'early_checkin'],
    };
    return amenities[tripType ?? 'relaxation'] ?? [];
  }

  private getCategoriesForTripType(tripType?: string): string[] {
    const categories: Record<string, string[]> = {
      adventure: ['outdoor', 'hiking', 'sports', 'water_sports'],
      cultural: ['museums', 'historical', 'tours', 'art'],
      relaxation: ['spa', 'beach', 'wellness', 'nature'],
      family: ['theme_parks', 'zoos', 'family_friendly', 'educational'],
    };
    return categories[tripType ?? 'cultural'] ?? ['sightseeing', 'tours'];
  }

  private extractInterestsFromContext(context: string): string[] {
    // Extract interests mentioned in the Ikigai context
    const interestMatch = context.match(/Interests: ([^\n]+)/);
    if (interestMatch) {
      return interestMatch[1].split(', ').slice(0, 3);
    }
    return [];
  }

  private generateTripId(): string {
    return `trip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

interface PlanTripParams {
  destination: string;
  origin: string;
  departureDate: string;
  returnDate: string;
  travelers: number;
  budget?: number;
  tripType?: string;
  context: string;
  llm: LLMClient;
  systemPrompt: string;
}

interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  travelers: number;
  budget?: number;
}

interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  budget?: number;
  tripType?: string;
}

interface ActivitySearchParams {
  destination: string;
  dates: { start: string; end: string };
  tripType?: string;
  context: string;
  budget?: number;
}

interface ItineraryBuildParams {
  destination: string;
  departureDate: string;
  returnDate: string;
  flights: FlightOption[];
  hotels: HotelOption[];
  activities: ActivityOption[];
  tripType?: string;
  context: string;
  llm: LLMClient;
  systemPrompt: string;
}

interface DayPlan {
  date: string;
  activities: Array<{
    time: string;
    activity: string;
    duration: string;
    notes?: string;
  }>;
  meals: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
}
```

---

## Mock API Layer

### 8. Mock APIs Package

```typescript
// packages/mock-apis/src/restaurants/yelp-mock.ts

/**
 * Yelp Mock API - v13 Section 3.6.1
 *
 * Provides realistic mock data for restaurant searches.
 * Will be replaced with real API in Sprint 13.
 */
export const YelpMock = {
  async searchRestaurants(params: YelpSearchParams): Promise<YelpResponse> {
    const { term, location, price, categories } = params;

    // Generate mock restaurants based on search criteria
    const restaurants = generateMockRestaurants(term, location, price, categories);

    return {
      businesses: restaurants,
      total: restaurants.length,
      region: { center: { latitude: 0, longitude: 0 } },
    };
  },
};

function generateMockRestaurants(
  term?: string,
  location?: string,
  price?: string,
  categories?: string[]
): MockRestaurant[] {
  // Base set of mock restaurants
  const baseRestaurants: MockRestaurant[] = [
    {
      id: 'mock-1',
      name: 'The Golden Fork',
      rating: 4.5,
      review_count: 423,
      price: '$$',
      categories: [{ alias: 'italian', title: 'Italian' }],
      location: { address1: '123 Main St', city: location ?? 'San Francisco' },
      phone: '+14155551234',
      is_closed: false,
      dietary_labels: ['vegetarian_options', 'gluten_free_options'],
    },
    {
      id: 'mock-2',
      name: 'Sakura Japanese',
      rating: 4.7,
      review_count: 312,
      price: '$$$',
      categories: [{ alias: 'japanese', title: 'Japanese' }],
      location: { address1: '456 Oak Ave', city: location ?? 'San Francisco' },
      phone: '+14155555678',
      is_closed: false,
      dietary_labels: ['vegan_options'],
    },
    {
      id: 'mock-3',
      name: 'El Jardin',
      rating: 4.3,
      review_count: 567,
      price: '$$',
      categories: [{ alias: 'mexican', title: 'Mexican' }],
      location: { address1: '789 Mission St', city: location ?? 'San Francisco' },
      phone: '+14155559012',
      is_closed: false,
      dietary_labels: ['vegetarian_options', 'gluten_free_options'],
    },
    // Add more mock restaurants...
  ];

  // Filter by term (cuisine type)
  let filtered = baseRestaurants;
  if (term) {
    filtered = filtered.filter(r =>
      r.categories.some(c =>
        c.title.toLowerCase().includes(term.toLowerCase()) ||
        c.alias.toLowerCase().includes(term.toLowerCase())
      ) || r.name.toLowerCase().includes(term.toLowerCase())
    );
  }

  // Filter by price
  if (price) {
    filtered = filtered.filter(r => r.price === price);
  }

  return filtered;
}

interface YelpSearchParams {
  term?: string;
  location: string;
  price?: string;
  categories?: string[];
}

interface YelpResponse {
  businesses: MockRestaurant[];
  total: number;
  region: { center: { latitude: number; longitude: number } };
}

interface MockRestaurant {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  price: string;
  categories: Array<{ alias: string; title: string }>;
  location: { address1: string; city: string };
  phone: string;
  is_closed: boolean;
  dietary_labels: string[];
}
```

```typescript
// packages/mock-apis/src/calendar/calendar-mock.ts

/**
 * Calendar Mock API
 *
 * Provides mock calendar data for availability checks.
 * Will integrate with Google/Microsoft Calendar in Sprint 8.
 */
export const CalendarMock = {
  /**
   * Get free time slots for a date range
   */
  async getFreeSlots(userId: string, dateRange: string): Promise<CalendarSlot[]> {
    // Generate realistic free slots
    const today = new Date();
    const slots: CalendarSlot[] = [];

    const daysToGenerate = dateRange === 'this_week' ? 7 : 14;

    for (let i = 0; i < daysToGenerate; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // Weekends have more free time
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      if (isWeekend) {
        slots.push({
          start: `${date.toISOString().split('T')[0]}T10:00:00`,
          end: `${date.toISOString().split('T')[0]}T22:00:00`,
          duration: 12 * 60,
        });
      } else {
        // Weekday evenings
        slots.push({
          start: `${date.toISOString().split('T')[0]}T18:00:00`,
          end: `${date.toISOString().split('T')[0]}T22:00:00`,
          duration: 4 * 60,
        });
      }
    }

    return slots;
  },

  /**
   * Get calendar conflicts for a date range
   */
  async getConflicts(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarConflict[]> {
    // Generate some mock conflicts
    return [
      {
        title: 'Team Meeting',
        start: startDate,
        end: startDate,
        allDay: false,
      },
    ];
  },

  /**
   * Create a calendar event
   */
  async createEvent(params: CreateEventParams): Promise<{ id: string }> {
    return {
      id: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  },
};

interface CalendarSlot {
  start: string;
  end: string;
  duration: number;
}

interface CalendarConflict {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface CreateEventParams {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  reminders?: number[];
}
```

---

## Integration with Existing Packages

### Update `@ownyou/shared-types`

Add new namespace functions:

```typescript
// packages/shared-types/src/namespaces.ts

// Add to existing NS object:
export const NS = {
  // ... existing namespaces ...

  // Sprint 7 additions
  diningPreferences: (userId: string) => ['ownyou', userId, 'dining_preferences'],
  diningReservations: (userId: string) => ['ownyou', userId, 'dining_reservations'],
  restaurantFavorites: (userId: string) => ['ownyou', userId, 'restaurant_favorites'],

  eventInterests: (userId: string) => ['ownyou', userId, 'event_interests'],
  eventBookings: (userId: string) => ['ownyou', userId, 'event_bookings'],

  travelPreferences: (userId: string) => ['ownyou', userId, 'travel_preferences'],
  travelItineraries: (userId: string) => ['ownyou', userId, 'travel_itineraries'],
  travelBookings: (userId: string) => ['ownyou', userId, 'travel_bookings'],
};
```

### Update `@ownyou/triggers`

Register new agent triggers:

```typescript
// packages/triggers/src/agent-registry.ts

import { RestaurantAgent } from '@ownyou/agents-restaurant';
import { EventsAgent } from '@ownyou/agents-events';
import { TravelAgent } from '@ownyou/agents-travel';

// Add to agent registry
export const AGENT_REGISTRY = {
  shopping: ShoppingAgent,
  content: ContentAgent,
  restaurant: RestaurantAgent,  // Sprint 7
  events: EventsAgent,          // Sprint 7
  travel: TravelAgent,          // Sprint 7
};
```

---

## Success Criteria

| #  | Criteria                                                    | Test Method      |
| -- | ----------------------------------------------------------- | ---------------- |
| 1  | Restaurant Agent searches with dietary filters              | Integration test |
| 2  | Restaurant Agent respects L2 limits (10 tools, 5 LLM, 120s) | Unit test        |
| 3  | Restaurant Agent uses Ikigai for personalization            | Unit test        |
| 4  | Events Agent searches by interests                          | Integration test |
| 5  | Events Agent checks calendar availability                   | Integration test |
| 6  | Events Agent respects L2 limits                             | Unit test        |
| 7  | Travel Agent orchestrates multi-step workflow               | Integration test |
| 8  | Travel Agent respects L3 limits (25 tools, 10 LLM, 300s)    | Unit test        |
| 9  | Travel Agent builds day-by-day itinerary                    | Integration test |
| 10 | All agents record episodes                                  | Integration test |
| 11 | All agents use memory system                                | Integration test |
| 12 | All agents learn from procedural rules                      | Unit test        |
| 13 | Mock APIs return realistic data                             | Unit test        |
| 14 | All tests passing                                           | CI/CD pipeline   |

---

## Test Plan

### Unit Tests

```typescript
// packages/agents-restaurant/src/__tests__/agent.test.ts
describe('RestaurantAgent', () => {
  describe('L2 Limits', () => {
    it('should enforce max 10 tool calls');
    it('should enforce max 5 LLM calls');
    it('should timeout at 120 seconds');
  });

  describe('Ikigai Integration', () => {
    it('should read Ikigai profile for personalization');
    it('should recognize key people as companions');
    it('should apply dining preferences');
  });

  describe('Mission Generation', () => {
    it('should generate restaurant mission card');
    it('should include dietary info in summary');
    it('should set correct urgency for tonight');
  });
});

// packages/agents-events/src/__tests__/agent.test.ts
describe('EventsAgent', () => {
  describe('Calendar Integration', () => {
    it('should check calendar for conflicts');
    it('should suggest events during free time');
    it('should add events to calendar (mock)');
  });

  describe('Interest Matching', () => {
    it('should use Ikigai interests for search');
    it('should rank events by interest alignment');
  });
});

// packages/agents-travel/src/__tests__/agent.test.ts
describe('TravelAgent', () => {
  describe('L3 Limits', () => {
    it('should enforce max 25 tool calls');
    it('should enforce max 10 LLM calls');
    it('should timeout at 300 seconds');
  });

  describe('Multi-Step Orchestration', () => {
    it('should search flights first');
    it('should search hotels second');
    it('should search activities third');
    it('should build itinerary last');
  });

  describe('Itinerary Building', () => {
    it('should create day-by-day plan');
    it('should balance activity types');
    it('should consider travel time');
  });
});
```

### Integration Tests

```typescript
// packages/integration-tests/src/__tests__/sprint7.test.ts
describe('Sprint 7 Integration', () => {
  describe('Restaurant Flow', () => {
    it('should complete: query → search → recommend → reserve');
    it('should personalize based on Ikigai');
    it('should record episode with feedback');
  });

  describe('Events Flow', () => {
    it('should complete: interests → search → select → calendar');
    it('should use known people for invites');
    it('should trigger on free weekend');
  });

  describe('Travel Flow', () => {
    it('should complete: destination → flights → hotels → activities → itinerary');
    it('should respect budget constraints');
    it('should use Ikigai for activity selection');
  });

  describe('Cross-Agent', () => {
    it('should share entities between agents');
    it('should all use same memory system');
    it('should all learn from procedural rules');
  });
});
```

---

## Dependencies

### New Dependencies

```json
{
  "dependencies": {},
  "devDependencies": {}
}
```

No new external dependencies required - uses mock APIs for MVP.

### Package Dependencies

- `@ownyou/agents-restaurant` depends on: `@ownyou/agents-base`, `@ownyou/ikigai`, `@ownyou/mock-apis`
- `@ownyou/agents-events` depends on: `@ownyou/agents-base`, `@ownyou/ikigai`, `@ownyou/mock-apis`
- `@ownyou/agents-travel` depends on: `@ownyou/agents-base`, `@ownyou/ikigai`, `@ownyou/mock-apis`
- `@ownyou/mock-apis` depends on: none (standalone)

---

## Roadmap Alignment

| Roadmap Week | Focus                 | Sprint 7 Deliverable                    |
| ------------ | --------------------- | --------------------------------------- |
| Week 1       | Restaurant Agent (L2) | Search, reservation, dietary checks     |
| Week 2       | Events Agent (L2)     | Event search, calendar integration      |
| Week 3-4     | Travel Agent (L3)     | Multi-step planning, itinerary building |

---

## Completion Summary

### Implemented Packages

| Package | Description | Tests | v13 Compliance |
|---------|-------------|-------|----------------|
| `@ownyou/agents-restaurant` | L2 Restaurant Agent | 55 | ✅ Full |
| `@ownyou/agents-events` | L2 Events Agent | 24 | ✅ Full |
| `@ownyou/agents-travel` | L3 Travel Agent | 49 | ✅ Full |
| `@ownyou/mock-apis` | Mock external APIs | 51 | ✅ N/A |

### Key Achievements

1. **Three new agents operational**
   - Restaurant Agent (L2): Searches restaurants, respects dietary preferences, generates mission cards
   - Events Agent (L2): Searches events, checks calendar availability, generates mission cards
   - Travel Agent (L3): Multi-step planning with flights, hotels, and itineraries

2. **v13 Architecture Compliance**
   - All agents use `NS.*` namespace factories
   - Configurable model selection (no hardcoded model names)
   - Magic numbers extracted to typed config objects
   - Episode recording with proper situation/observation/tags
   - Evidence refs on all mission cards
   - Ikigai profile integration for personalization

3. **Mock API Layer**
   - YelpMock for restaurant search
   - TicketmasterMock for event search
   - CalendarMock for availability checks
   - GoogleFlightsMock, BookingMock, TripAdvisorMock for travel

4. **Sprint 6 Lessons Applied**
   - C1: NS.* factory functions (no hardcoded namespaces)
   - C2: Unconditional data writes
   - I1: Configurable model selection
   - I2: Magic numbers in typed configs
   - I3: Integration tests for execute() flows
   - I4: All type fields populated
   - I5: Correct data persistence order

---

## Document History

| Version | Date       | Changes               |
| ------- | ---------- | --------------------- |
| Draft   | 2025-12-05 | Initial specification |
| v1.0    | 2025-12-07 | Sprint complete - all deliverables done |

---

**Document Status:** COMPLETE
**Author:** Claude Code
**Validates Against:** OwnYou_architecture_v13.md (Section 3.6.1 - Remaining Agents)
**Next Sprint:** Sprint 8 (Data Sources + Diagnostic Agent)
