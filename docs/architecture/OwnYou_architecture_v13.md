# OwnYou System Architecture Specification (v13)

**Status:** DRAFT - PENDING APPROVAL
**Date:** December 2025
**Supersedes:** v12

**Key Changes from v12:**

- **LLM Cost Management (6.10):** Budget enforcement, throttling, per-operation limits targeting <$10/user/month
- **Error Handling & Resilience (6.11):** Circuit breakers, LLM fallback chains, partial data handling
- **Agent Specification Matrix (3.6):** Per-agent tools, namespace permissions, external APIs
- **Observability & Debugging (10):** Agent tracing, sync debugging, cost metering, GDPR data export

**Key Changes from v11 (preserved from v12):**

- Ikigai Intelligence Layer: Full specification with hybrid architecture
- Mission Agent System: 4-mode trigger system with complete state machine
- Consumer UI: Implementation plan (Figma complete)
- Data Source Sync: Detailed OrbitDB/IPFS architecture with encryption policy
- Decentralization Ledger: All compromises documented with migration paths
- Publisher/Advertiser SDK: Complete specifications with demo environment

---

## Executive Summary

**Core Value Proposition:** OwnYou enables users to leverage their personal data (Email, Financial, Browsing, Health) for rich, private AI experiences ("Missions") and monetise their anonymized profile via Publisher SSO, without ever sharing raw data with third parties.

**v13 Architectural Additions:**

| Addition                            | Description                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| **LLM Cost Management**       | Budget enforcement, throttling, model tier downgrades                          |
| **Error Handling & Resilience** | Circuit breakers, fallback chains, partial data handling                     |
| **Agent Specification Matrix** | Per-agent tools, namespace permissions, external API mappings                 |
| **Observability & Debugging** | Agent traces, sync logs, cost dashboard, GDPR export                          |

**v12 Architectural Additions (preserved):**

| Addition                            | Description                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| **Ikigai Intelligence Layer** | Hybrid architecture: Continuous Agent sets baseline, specialized agents refine |
| **4-Mode Mission Triggers**   | Data-driven + Scheduled + Event-driven + User-driven                           |
| **Consumer UI Plan**          | Full Figma implementation with component library                               |
| **Sync Architecture**         | OrbitDB with offline handling, P2P discovery, encryption policy                |
| **Decentralization Ledger**   | Explicit compromises and migration paths documented                            |
| **Publisher/Advertiser SDK**  | Complete SDK specs with demo publisher/advertiser                              |

---

## 1. Phase Structure Overview

```
                          ┌─────────────────────────────────────────────────────┐
                          │                    PHASE 0 (DONE)                    │
                          │  IAB Classifier ✅  IndexedDB Store ✅               │
                          │  Browser Email OAuth (24hr) ✅  Admin Dashboard ✅   │
                          └─────────────────────────────────────────────────────┘
                                                    │
                          ┌─────────────────────────▼─────────────────────────┐
                          │         PHASE 1: FOUNDATION + TAURI OAuth          │
                          │                                                    │
                          │  • Tauri Desktop scaffolding (Rust + React)       │
                          │  • Custom protocol handler (ownyou://)            │
                          │  • 90-day OAuth (Microsoft + Gmail)               │
                          │  • Complete API contracts (OpenAPI)               │
                          │  • Mission Agent specs (6 agents)                 │
                          │  • BBS+ protocol specification                    │
                          └─────────────────────────┬─────────────────────────┘
                                                    │
┌───────────────────────────────────────────────────┴───────────────────────────────────────────────────┐
│                                    PHASE 2: PARALLEL DEVELOPMENT                                       │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐   ┌─────────────────────────────┐  │
│  │   TRACK A: DATA SOURCES     │   │   TRACK B: MISSION AGENTS   │   │   TRACK C: BBS+ & IDENTITY  │  │
│  │                             │   │                             │   │                             │  │
│  │  • Financial (Plaid)        │   │  • Shopping Agent (L1-2)    │   │  • BBS+ library integration │  │
│  │  • Transaction IAB          │   │  • Travel Agent (L3)        │   │  • Pseudonym generation     │  │
│  │  • Browser History          │   │  • Restaurant Agent (L2)    │   │  • Publisher SSO protocol   │  │
│  │  • Browsing IAB             │   │  • Events Agent (L2)        │   │  • Selective disclosure     │  │
│  │  • Calendar (Google/MSFT)   │   │  • Content Agent (L1)       │   │  • Solana smart contract    │  │
│  │  • Calendar IAB             │   │  • Diagnostic Agent (L2)    │   │  • Revenue distribution     │  │
│  │  • Ikigai Intelligence ⭐   │   │  • 4-Mode Trigger System ⭐ │   │  • Advertiser SDK ⭐        │  │
│  └─────────────────────────────┘   └─────────────────────────────┘   └─────────────────────────────┘  │
└───────────────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                                    │
                          ┌─────────────────────────▼─────────────────────────┐
                          │              PHASE 3: INTEGRATION                  │
                          │                                                    │
                          │  • Consumer UI (Figma → React) ⭐                 │
                          │  • Mission Cards feed                             │
                          │  • Profile management                             │
                          │  • Wallet + earnings display                      │
                          │  • BBS+ consent flows                             │
                          │  • Cross-device sync (OrbitDB) ⭐                 │
                          └─────────────────────────┬─────────────────────────┘
                                                    │
                          ┌─────────────────────────▼─────────────────────────┐
                          │              PHASE 4: PRODUCTION                   │
                          │                                                    │
                          │  • Demo Publisher Website ⭐                      │
                          │  • Mock Advertiser Dashboard ⭐                   │
                          │  • PostgreSQL migration (LangGraph Store)         │
                          │  • Real external API integrations                 │
                          │  • Security audit                                 │
                          │  • Publisher pilot (1-2 partners)                 │
                          └─────────────────────────────────────────────────────┘
```

⭐ = New in v12

---

## 2. Ikigai Intelligence Layer

### 2.1 Architecture: Signal-Based Inference

The Ikigai layer passively extracts well-being signals from user data to prioritize missions. No user questions required - the system learns entirely from data.

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES                                │
│  Email │ Transactions │ Calendar │ Browser History               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              PARALLEL LLM INFERENCE (4 prompts)                  │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐│
│  │ EXPERIENCES  │ │RELATIONSHIPS │ │  INTERESTS   │ │  GIVING  ││
│  │   Prompt     │ │   Prompt     │ │   Prompt     │ │  Prompt  ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 IKIGAI SYNTHESIS PROMPT                          │
│  Combines all dimension outputs into unified profile update      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    IKIGAI PROFILE                                │
│  Used by Mission Agents for prioritization and personalization   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Ikigai Dimensions

| Dimension               | What We Infer             | Data Signals                                                                                    |
| ----------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Experiences**   | Activities that bring joy | Travel bookings, event tickets, hobby purchases, activity-related emails                        |
| **Relationships** | People who matter         | Shared calendar events, gift purchases, dining reservations for 2+, emails with specific people |
| **Interests**     | Recurring passions        | Purchase patterns, browsing topics, newsletter subscriptions, content consumption               |
| **Giving**        | Contribution to others    | Charitable donations, volunteer calendar events, gifts purchased                                |

### 2.3 Store Schema: ikigai Namespace

```typescript
interface IkigaiProfile {
  user_id: string;
  updated_at: timestamp;

  // Inferred from data via LLM prompts
  experiences: {
    preferred_types: string[];     // ["travel", "concerts", "dining", "outdoor"]
    frequency: "rare" | "occasional" | "frequent";
    recent_activities: Activity[]; // Last 90 days
  };

  relationships: {
    key_people: Person[];          // Extracted from emails, calendar, transactions
    social_frequency: "solo" | "couple" | "social" | "very_social";
  };

  interests: {
    topics: TopicScore[];          // IAB categories with engagement scores
    hobbies: string[];             // Inferred from purchases and content
  };

  giving: {
    causes: string[];              // Charities, volunteer activities
    gift_giving_frequency: number; // Purchases identified as gifts
  };

  // Weights for mission ranking
  dimension_weights: {
    experiences: number;           // 0-1, based on historical engagement
    relationships: number;
    interests: number;
    giving: number;
  };

  // Evidence chain for transparency
  evidence: {
    dimension: string;
    source_type: "email" | "transaction" | "calendar" | "browser";
    source_id: string;
    signal_strength: number;  // 0.0-1.0
    extracted_at: timestamp;
  }[];
}

interface Person {
  name: string;
  relationship_strength: number;   // Based on interaction frequency
  shared_interests: string[];      // What they do together
  last_interaction: timestamp;
}
```

### 2.4 LLM-Based Ikigai Inference

Instead of rule-based extraction, use specialized LLM prompts to infer ikigai signals. Each prompt focuses on a different dimension and runs in parallel.

#### Prompt 1: Experiences Inference

```
You are analyzing a user's data to understand what experiences bring them joy.

Given the following data from the past [time_window]:
{sanitized_data_batch}

Current experiences profile:
{current_experiences_profile}

Identify:
1. What types of experiences does this person seek? (travel, entertainment, dining, adventure, learning, creative, social gatherings, outdoor, wellness)
2. What new experiences are evident in this data?
3. How frequently do they pursue experiences vs. routine activities?
4. Any patterns in timing, location, or companions for experiences?

Return structured JSON:
{
  "experience_types": ["travel", "dining", ...],
  "new_experiences_detected": [
    {"type": "...", "description": "...", "evidence": "..."}
  ],
  "frequency": "rare|occasional|frequent",
  "patterns": {
    "timing": "...",
    "companions": ["..."],
    "locations": ["..."]
  },
  "confidence": 0.0-1.0
}
```

#### Prompt 2: Relationships Inference

```
You are analyzing a user's data to understand their important relationships.

Given the following data from the past [time_window]:
{sanitized_data_batch}

Current relationships profile:
{current_relationships_profile}

Identify:
1. Who are the key people in this person's life? (Look for recurring names in emails, calendar, shared activities, gifts)
2. What is the nature of each relationship? (family, friend, colleague, romantic partner)
3. How does this person invest in relationships? (time together, gifts, shared experiences)
4. Any relationships that seem particularly meaningful based on interaction patterns?

Return structured JSON:
{
  "key_people": [
    {
      "name": "...",
      "relationship_type": "family|friend|colleague|partner",
      "interaction_frequency": "daily|weekly|monthly|occasional",
      "shared_activities": ["..."],
      "evidence": "..."
    }
  ],
  "social_style": "solo|couple|small_group|social",
  "relationship_investment_patterns": "...",
  "confidence": 0.0-1.0
}
```

#### Prompt 3: Interests Inference

```
You are analyzing a user's data to understand their genuine interests and passions.

Given the following data from the past [time_window]:
{sanitized_data_batch}

Current interests profile:
{current_interests_profile}

Identify:
1. What topics does this person engage with repeatedly? (not one-off purchases)
2. What hobbies or activities do they invest time and money in?
3. What content do they consume? (newsletters, browsing patterns)
4. Distinguish between genuine interests vs. obligations/necessities

Return structured JSON:
{
  "genuine_interests": [
    {
      "topic": "...",
      "evidence_type": "purchases|content|activities|emails",
      "engagement_depth": "casual|moderate|deep",
      "evidence": "..."
    }
  ],
  "hobbies": ["..."],
  "learning_interests": ["..."],
  "confidence": 0.0-1.0
}
```

#### Prompt 4: Giving Inference

```
You are analyzing a user's data to understand how they contribute to others.

Given the following data from the past [time_window]:
{sanitized_data_batch}

Current giving profile:
{current_giving_profile}

Identify:
1. Does this person give to charitable causes? Which ones?
2. Do they buy gifts for others? For whom and how often?
3. Any evidence of volunteering or community involvement?
4. How do they show care for others through their actions?

Return structured JSON:
{
  "charitable_giving": [
    {"cause": "...", "frequency": "...", "evidence": "..."}
  ],
  "gift_giving": {
    "frequency": "rare|occasional|frequent",
    "recipients": ["..."]
  },
  "volunteering": ["..."],
  "care_patterns": "...",
  "confidence": 0.0-1.0
}
```

#### Prompt 5: Ikigai Synthesis

```
You are synthesizing a user's ikigai profile from multiple data analyses.

Experiences analysis:
{experiences_output}

Relationships analysis:
{relationships_output}

Interests analysis:
{interests_output}

Giving analysis:
{giving_output}

Previous ikigai profile:
{previous_profile}

Recent mission feedback from this user:
{mission_feedback_context}

Synthesize an updated ikigai profile:
1. What brings this person daily joy? (small, recurring pleasures)
2. Who matters most to them?
3. What are they genuinely passionate about?
4. How do they contribute to others?
5. What has changed since the last profile update?

Return structured JSON matching IkigaiProfile schema.
```

### 2.5 Batch Processing Configuration

```typescript
interface IkigaiInferenceConfig {
  // Don't run on every item - batch for efficiency
  batch_window: "daily" | "weekly";

  // Minimum new items before triggering inference
  min_items_threshold: 10;

  // Run all 4 dimension prompts in parallel
  parallel_inference: true;

  // Model choice is USER CONFIGURABLE in Settings
  // User selects based on their cost/quality preferences
}
```

### 2.6 Mission Prioritization

Missions are ranked by **well-being value**, which weights experiences and relationships higher than pure material purchases:

```typescript
interface MissionWellBeingScore {
  // Core practical value (always present)
  utility_score: number;           // 0-1: How useful is this mission?

  // Ikigai enhancement (optional boost)
  experience_boost: number;        // 0-0.5: Does this create an experience?
  relationship_boost: number;      // 0-0.5: Does this involve key people?
  interest_alignment: number;      // 0-0.3: Does this match their interests?

  // Final ranking score
  total_score: number;             // utility + boosts, capped at 2.0
}
```

**Example Scoring:**

| Mission                      | Utility | Experience | Relationship | Interest | Total         |
| ---------------------------- | ------- | ---------- | ------------ | -------- | ------------- |
| Plan weekend trip with Sarah | 0.7     | 0.5        | 0.5          | 0.3      | **2.0** |
| Find birthday gift for Mom   | 0.6     | 0.2        | 0.4          | 0.0      | **1.2** |
| Compare TV prices            | 0.8     | 0.0        | 0.0          | 0.2      | **1.0** |

### 2.7 Ikigai Points & Rewards

Users earn points for completing missions, with bonuses for well-being-aligned activities:

```typescript
interface IkigaiRewards {
  base_points: 100;

  // Multipliers
  experience_multiplier: 2.0;      // 2x for experiences
  relationship_multiplier: 1.5;    // 1.5x when involves key people
  giving_multiplier: 2.5;          // 2.5x for charitable/gift missions

  // Point categories (visible to user)
  categories: {
    explorer: number;              // Experience points
    connector: number;             // Relationship points
    helper: number;                // Giving points
    achiever: number;              // Utility points
  };
}
```

### 2.8 Mission Card Ikigai Feedback

Replace thumbs up/down with a heart that communicates ikigai relevance through state changes.

#### Heart States (No Text)

```
🩶 Meh (grey)     →  ❤️ Like (red)     →  ❤️ Love (large red)  →  🩶 Meh
   (default)          (1 tap)              (2 taps)                (3 taps)
```

#### Interaction Model

| User Action                           | Ikigai Signal   | Heart State    |
| ------------------------------------- | --------------- | -------------- |
| No interaction                        | Meh (neutral)   | 🩶 Grey        |
| Tap heart once                        | Like            | ❤️ Red       |
| Tap heart twice                       | Love            | ❤️ Large red |
| Tap heart again                       | Reset to Meh    | 🩶 Grey        |
| **Click into mission** (engage) | Like (implicit) | ❤️ Red       |
| **Complete mission**            | Love (implicit) | ❤️ Large red |

#### Feedback Data Model

```typescript
interface MissionFeedback {
  mission_id: string;
  timestamp: timestamp;

  // Ikigai signal: 0 = meh, 1 = like, 2 = love
  ikigai_signal: 0 | 1 | 2;

  // How the signal was captured
  signal_source: "explicit_tap" | "implicit_engage" | "implicit_complete";

  // Context for learning
  mission_type: string;
  time_to_engage?: number;
  time_to_complete?: number;
}
```

**Signal Priority:** Explicit taps always override implicit behavior signals. If user never taps, system infers from engagement (click = like, complete = love, ignore = meh).

### 2.9 Ikigai-Memory Integration

This subsection explicitly maps how Ikigai inference outputs flow into the Memory Architecture (Section 8).

#### Ikigai Dimension → Memory Namespace Mapping

| Ikigai Dimension | Inference Outputs | Storage Namespace | Example |
|------------------|-------------------|-------------------|---------|
| **Passion** | interests, hobbies, creative_outlets | `semanticMemory` | "photography", "jazz music" |
| **Mission** | causes, values, impact_areas | `semanticMemory` | "climate action", "mentoring" |
| **Vocation** | skills, expertise, certifications | `semanticMemory` + `entities` | "data science", "PMP certified" |
| **Profession** | job_title, industry, income_bracket | `semanticMemory` + `iab_classifications` | "Sr. Engineer", "Tech/Software" |
| **Relationships** | key_people, relationship_types | `entities` | {name: "Sarah", type: "spouse"} |
| **Well-being** | health_goals, stress_indicators | `semanticMemory` (privacy-protected) | "improve sleep", "reduce anxiety" |

#### Storage Flow

```typescript
// After Ikigai inference completes, results are written to appropriate namespaces
async function storeIkigaiInference(userId: string, inference: IkigaiInference): Promise<void> {
  const store = getStore();

  // 1. Core dimensions → semanticMemory
  await store.put(
    NS.semanticMemory(userId),
    "ikigai_profile",
    {
      passion: inference.passion,
      mission: inference.mission,
      vocation: inference.vocation,
      profession: inference.profession,
      well_being: inference.well_being,
      confidence: inference.overall_confidence,
      last_updated: new Date().toISOString(),
    }
  );

  // 2. Key people → entities namespace (for cross-mission reference)
  for (const person of inference.relationships.key_people) {
    await store.put(
      NAMESPACES.entities(userId),
      `person:${person.name.toLowerCase().replace(/\s+/g, '_')}`,
      {
        entity_type: "person",
        name: person.name,
        relationship: person.relationship_type,
        mentioned_in: person.source_contexts,
        first_seen: person.first_mentioned,
        last_seen: new Date().toISOString(),
      }
    );
  }

  // 3. Professional profile → IAB alignment for ad relevance
  if (inference.profession.industry) {
    await store.put(
      NAMESPACES.iab_classifications(userId),
      "ikigai_derived",
      {
        derived_from: "ikigai_inference",
        categories: mapProfessionToIAB(inference.profession),
        confidence: inference.profession.confidence,
      }
    );
  }
}
```

#### Retrieval for Mission Agents

Mission agents query Ikigai data through unified memory search:

```typescript
// Mission agent retrieves relevant Ikigai context
const ikigaiContext = await store.search(
  NS.semanticMemory(userId),
  { query: missionContext, filter: { type: "ikigai" } }
);

// Entity lookup for personalization
const knownPeople = await store.list(
  NAMESPACES.entities(userId),
  { prefix: "person:" }
);
```

This mapping ensures:
1. **Single Source of Truth**: Ikigai insights stored once, queried by all agents
2. **Privacy Boundaries**: Well-being data stays in user-controlled namespaces
3. **Cross-System Coherence**: IAB classifications and Ikigai alignment share entities

---

## 3. Mission Agent System (ENHANCED)

### 3.1 Four-Mode Trigger System

Mission Agents respond to **four distinct trigger modes**:

| Mode                   | Description                        | Example                                       |
| ---------------------- | ---------------------------------- | --------------------------------------------- |
| **Data-Driven**  | Store watch on new classifications | New receipt → Shopping price check           |
| **Scheduled**    | Cron-style recurring triggers      | Daily digest, weekly review, monthly planning |
| **Event-Driven** | Calendar events, location changes  | Upcoming trip → Travel preparation           |
| **User-Driven**  | Natural language requests          | "Find me a weekend trip to the coast"         |

### 3.2 Trigger Architecture

```typescript
interface TriggerEngine {
  // Data-driven: Watch Store for changes
  watchNamespaces: string[];  // ["iab_classifications", "financial_transactions"]

  // Scheduled: Cron expressions
  schedules: {
    daily_digest: "0 8 * * *",      // 8 AM daily
    weekly_review: "0 10 * * SUN",  // 10 AM Sundays
    monthly_planning: "0 9 1 * *",  // 9 AM first of month
  };

  // Event-driven: External event subscriptions
  eventSources: ["calendar", "location", "webhook"];

  // User-driven: NLU intent router
  intentRouter: CoordinatorAgent;
}
```

### 3.3 Mission State Machine

```
                    ┌──────────────┐
                    │   CREATED    │  (Agent generates mission)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  PRESENTED   │  (Shown to user in feed)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼───────┐    │     ┌──────▼───────┐
       │   SNOOZED    │    │     │  DISMISSED   │
       │  (Remind     │    │     │  (Won't show │
       │   later)     │    │     │   again)     │
       └──────────────┘    │     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │    ACTIVE    │  (User engaged)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  COMPLETED   │  (Mission fulfilled)
                    └──────────────┘
```

### 3.4 Mission Card Structure

```typescript
interface MissionCard {
  id: string;
  type: "shopping" | "travel" | "restaurant" | "events" | "content" | "diagnostic";

  // Display
  title: string;
  summary: string;
  urgency: "low" | "medium" | "high";

  // State
  status: "CREATED" | "PRESENTED" | "ACTIVE" | "SNOOZED" | "DISMISSED" | "COMPLETED";
  created_at: timestamp;
  expires_at?: timestamp;
  snoozed_until?: timestamp;

  // Ikigai context
  ikigai_dimensions: string[];  // Which dimensions this serves
  ikigai_alignment_boost: number;  // How much completion improves alignment

  // Actions
  primary_action: {
    label: string;
    type: "navigate" | "confirm" | "input" | "external";
    payload: any;
  };
  secondary_actions?: Action[];

  // Agent context
  agent_thread_id: string;  // For resuming conversation
  evidence_refs: string[];  // Store keys that triggered this

  // Feedback
  user_rating?: 1 | 2 | 3 | 4 | 5;
  completion_feedback?: string;
}
```

### 3.5 Agent Coordinator

```typescript
class MissionCoordinator {
  // Route user requests to appropriate agent
  async routeUserRequest(request: string): Promise<MissionCard> {
    const intent = await this.classifyIntent(request);
    const agent = this.selectAgent(intent);
    return agent.execute(request);
  }

  // Process Store changes
  async onStoreChange(namespace: string, key: string, value: any): Promise<void> {
    const relevantAgents = this.findAgentsForNamespace(namespace);
    for (const agent of relevantAgents) {
      const mission = await agent.evaluateTrigger(key, value);
      if (mission) {
        await this.presentMission(mission);
      }
    }
  }

  // Process scheduled triggers
  async onScheduledTrigger(scheduleId: string): Promise<void> {
    const agent = this.getAgentForSchedule(scheduleId);
    const missions = await agent.generateScheduledMissions();
    for (const mission of missions) {
      await this.presentMission(mission);
    }
  }
}
```

### 3.6 Agent Specification Matrix

Each Mission Agent has defined capabilities, memory access, and external integrations.

#### 3.6.1 Agent Overview Table

| Agent | Level | Memory Read | Memory Write | External APIs | Key Tools |
|-------|-------|-------------|--------------|---------------|-----------|
| **Shopping** | L1-2 | shopping_*, entities, iab, semantic | shopping_*, episodic, procedural | SerpAPI, Amazon PA-API | `search_products`, `compare_prices`, `track_price`, `find_deals` |
| **Travel** | L3 | travel_*, relationships, entities, calendar, financial | travel_*, episodic, procedural | Google Flights, Tripadvisor, Booking.com | `search_flights`, `search_hotels`, `build_itinerary`, `check_visa` |
| **Restaurant** | L2 | dining_*, entities, relationships, location | dining_*, episodic, procedural | Yelp, OpenTable, Google Places | `search_restaurants`, `make_reservation`, `get_menu`, `check_dietary` |
| **Events** | L2 | events_*, relationships, calendar, interests | events_*, episodic, procedural | Ticketmaster, Eventbrite, Meetup | `search_events`, `check_availability`, `add_to_calendar`, `invite_friends` |
| **Content** | L1 | content_*, interests, episodic | content_*, episodic, procedural | RSS feeds, Podcast APIs, News APIs | `recommend_content`, `summarize_article`, `find_similar`, `save_for_later` |
| **Diagnostic** | L2 | ALL (read-only) | diagnostic_reports only | None | `analyze_profile`, `find_patterns`, `suggest_connections`, `generate_insights` |

#### 3.6.2 Namespace Access Control

```typescript
interface AgentPermissions {
  agent_type: string;

  memory_access: {
    read: string[];      // Namespaces agent can read
    write: string[];     // Namespaces agent can write
    search: string[];    // Namespaces agent can semantic search
  };

  external_apis: {
    name: string;
    rate_limit: string;  // e.g., "100/hour"
    requires_user_consent: boolean;
  }[];

  tool_definitions: ToolDefinition[];
}

const AGENT_PERMISSIONS: Record<string, AgentPermissions> = {
  shopping: {
    agent_type: "shopping",
    memory_access: {
      read: [
        "semanticMemory",
        "episodicMemory",
        "entities",
        "iab_classifications",
        "shopping_preferences",
      ],
      write: [
        "shopping_searches",
        "shopping_recommendations",
        "episodicMemory",
        "proceduralMemory:shopping",
      ],
      search: ["semanticMemory", "episodicMemory", "entities"],
    },
    external_apis: [
      { name: "SerpAPI", rate_limit: "100/hour", requires_user_consent: false },
      { name: "Amazon PA-API", rate_limit: "1/second", requires_user_consent: false },
    ],
    tool_definitions: [
      { name: "search_products", description: "Search for products matching criteria" },
      { name: "compare_prices", description: "Compare prices across retailers" },
      { name: "track_price", description: "Set up price drop alerts" },
      { name: "find_deals", description: "Find current deals on saved items" },
    ],
  },

  travel: {
    agent_type: "travel",
    memory_access: {
      read: [
        "semanticMemory",
        "episodicMemory",
        "entities",
        "relationships",        // For travel companions
        "calendar",             // For availability
        "financial_profile",    // For budget awareness
        "travel_preferences",
      ],
      write: [
        "travel_itineraries",
        "travel_bookings",
        "episodicMemory",
        "proceduralMemory:travel",
      ],
      search: ["semanticMemory", "episodicMemory", "entities", "relationships"],
    },
    external_apis: [
      { name: "Google Flights", rate_limit: "60/hour", requires_user_consent: false },
      { name: "Tripadvisor", rate_limit: "100/hour", requires_user_consent: false },
      { name: "Booking.com", rate_limit: "60/hour", requires_user_consent: true },
    ],
    tool_definitions: [
      { name: "search_flights", description: "Search flights with preferences (direct, timing)" },
      { name: "search_hotels", description: "Search accommodations matching preferences" },
      { name: "build_itinerary", description: "Create day-by-day travel plan" },
      { name: "check_visa", description: "Check visa requirements for destination" },
    ],
  },

  restaurant: {
    agent_type: "restaurant",
    memory_access: {
      read: [
        "semanticMemory",
        "episodicMemory",
        "entities",
        "relationships",
        "dining_preferences",
      ],
      write: [
        "dining_reservations",
        "restaurant_favorites",
        "episodicMemory",
        "proceduralMemory:restaurant",
      ],
      search: ["semanticMemory", "episodicMemory", "entities"],
    },
    external_apis: [
      { name: "Yelp", rate_limit: "100/hour", requires_user_consent: false },
      { name: "OpenTable", rate_limit: "60/hour", requires_user_consent: true },
      { name: "Google Places", rate_limit: "100/hour", requires_user_consent: false },
    ],
    tool_definitions: [
      { name: "search_restaurants", description: "Find restaurants matching criteria" },
      { name: "make_reservation", description: "Book a table at selected restaurant" },
      { name: "get_menu", description: "Retrieve menu and pricing" },
      { name: "check_dietary", description: "Verify dietary accommodation availability" },
    ],
  },

  events: {
    agent_type: "events",
    memory_access: {
      read: [
        "semanticMemory",
        "episodicMemory",
        "entities",
        "relationships",
        "calendar",
        "interests",
      ],
      write: [
        "event_interests",
        "event_bookings",
        "episodicMemory",
        "proceduralMemory:events",
      ],
      search: ["semanticMemory", "episodicMemory", "interests"],
    },
    external_apis: [
      { name: "Ticketmaster", rate_limit: "60/hour", requires_user_consent: false },
      { name: "Eventbrite", rate_limit: "100/hour", requires_user_consent: false },
      { name: "Meetup", rate_limit: "60/hour", requires_user_consent: false },
    ],
    tool_definitions: [
      { name: "search_events", description: "Find events matching interests and location" },
      { name: "check_availability", description: "Verify ticket availability and pricing" },
      { name: "add_to_calendar", description: "Add event to user's calendar" },
      { name: "invite_friends", description: "Share event with contacts" },
    ],
  },

  content: {
    agent_type: "content",
    memory_access: {
      read: [
        "semanticMemory",
        "episodicMemory",
        "interests",
        "content_history",
      ],
      write: [
        "content_recommendations",
        "saved_content",
        "episodicMemory",
        "proceduralMemory:content",
      ],
      search: ["semanticMemory", "interests"],
    },
    external_apis: [
      { name: "RSS Feeds", rate_limit: "unlimited", requires_user_consent: false },
      { name: "Podcast APIs", rate_limit: "100/hour", requires_user_consent: false },
      { name: "News APIs", rate_limit: "100/hour", requires_user_consent: false },
    ],
    tool_definitions: [
      { name: "recommend_content", description: "Suggest articles, podcasts, videos" },
      { name: "summarize_article", description: "Generate summary of linked content" },
      { name: "find_similar", description: "Find related content to a given item" },
      { name: "save_for_later", description: "Save content to reading list" },
    ],
  },

  diagnostic: {
    agent_type: "diagnostic",
    memory_access: {
      read: ["*"],  // Can read ALL namespaces for analysis
      write: ["diagnostic_reports"],  // Can ONLY write reports
      search: ["*"],
    },
    external_apis: [],  // No external APIs - analysis only
    tool_definitions: [
      { name: "analyze_profile", description: "Analyze user profile completeness" },
      { name: "find_patterns", description: "Identify behavioral patterns across data" },
      { name: "suggest_connections", description: "Suggest data connections user might want" },
      { name: "generate_insights", description: "Generate actionable insights from data" },
    ],
  },
};
```

#### 3.6.3 Agent Complexity Levels

| Level | Characteristics | Example Agents | Typical Use Cases |
|-------|-----------------|----------------|-------------------|
| **L1 (Simple)** | Single tool call, no coordination, stateless | Content (recommend), Shopping (search) | Quick lookups, simple recommendations |
| **L2 (Coordinated)** | Multi-step, memory-dependent, may use multiple tools | Restaurant (search → reserve), Events (search → calendar) | Workflows with 2-5 steps |
| **L3 (Complex)** | Multi-agent coordination, external bookings, long-running | Travel (flights + hotels + activities + calendar) | Full trip planning, complex research |

#### 3.6.4 Tool Call Limits by Level

```typescript
const AGENT_LIMITS = {
  L1: {
    max_tool_calls: 3,
    max_llm_calls: 2,
    timeout_seconds: 30,
    max_memory_reads: 10,
    max_memory_writes: 3,
  },
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

// Enforcement
const enforceAgentLimits = (agentType: string, level: AgentLevel) => {
  const limits = AGENT_LIMITS[level];

  return {
    onToolCall: (count: number) => {
      if (count > limits.max_tool_calls) {
        throw new AgentLimitExceeded("tool_calls", count, limits.max_tool_calls);
      }
    },
    onLLMCall: (count: number) => {
      if (count > limits.max_llm_calls) {
        throw new AgentLimitExceeded("llm_calls", count, limits.max_llm_calls);
      }
    },
    onTimeout: () => {
      throw new AgentTimeout(agentType, limits.timeout_seconds);
    },
  };
};

// Implementation Note (Sprint 3):
// BaseAgent uses lazy initialization for LimitsEnforcer to handle
// TypeScript abstract class initialization order. The enforcer is
// created via a getter when first accessed, ensuring the subclass's
// `level` property is available.
```

#### 3.6.5 Privacy-Tier Enforcement for Agents

```typescript
// Agents must respect privacy tiers (see Section 8.11)
const enforcePrivacyTier = (
  requestingAgent: string,
  namespace: string,
  operation: "read" | "write" | "search"
): boolean => {
  const agentPerms = AGENT_PERMISSIONS[requestingAgent];

  // Check if agent has permission for this namespace
  const allowedNamespaces = agentPerms.memory_access[operation];

  // Special case: diagnostic can read all
  if (requestingAgent === "diagnostic" && operation === "read") {
    return true;
  }

  // Check explicit permission
  if (!allowedNamespaces.includes(namespace) && !allowedNamespaces.includes("*")) {
    // Log attempted violation
    auditLog.record({
      type: "permission_violation_attempt",
      agent: requestingAgent,
      namespace,
      operation,
      action: "blocked",
      timestamp: Date.now(),
    });

    throw new PermissionDeniedError(requestingAgent, namespace, operation);
  }

  // Check privacy tier (health, journal are private - see 8.11)
  const tier = getPrivacyTier(namespace);
  if (tier === "private" && requestingAgent !== "diagnostic") {
    throw new PrivacyTierViolationError(requestingAgent, namespace);
  }

  return true;
};

// Wrap all Store access through this guard
const createSecureStore = (store: Store, agentType: string) => {
  return {
    get: async (namespace: string[], key: string) => {
      enforcePrivacyTier(agentType, namespace.join("."), "read");
      return store.get(namespace, key);
    },
    put: async (namespace: string[], key: string, value: any) => {
      enforcePrivacyTier(agentType, namespace.join("."), "write");
      return store.put(namespace, key, value);
    },
    search: async (params: SearchParams) => {
      enforcePrivacyTier(agentType, params.namespace.join("."), "search");
      return store.search(params);
    },
  };
};
```

---

## 4. Consumer UI Implementation

### 4.1 Status

**Figma Designs:** Complete (OwnYou May-25 Mockup)

**Source:** `https://www.figma.com/design/uslNpFN9c097hmsNRcKhZl/OwnYou--May-25-mockup`

**Implementation Approach:** React component library shared between Tauri desktop and PWA (95% shared code)

### 4.2 Implementation Phases

| Phase                            | Deliverables                                |
| -------------------------------- | ------------------------------------------- |
| **UI-1: Shell**            | Navigation, auth screens, routing           |
| **UI-2: Dashboard**        | Mission Cards feed, status overview         |
| **UI-3: Data Connections** | Gmail, Calendar, Financial connection pages |
| **UI-4: Profile**          | IAB profile visualization, Ikigai wheel     |
| **UI-5: Settings**         | Privacy controls, data management, wallet   |

### 4.3 Design System Specifications

#### 4.3.1 Color Palette

| Token                      | Value                    | Usage                       |
| -------------------------- | ------------------------ | --------------------------- |
| `--color-primary`        | `#87CEEB` (Sky Blue)   | App background, navigation  |
| `--color-secondary`      | `#70DF82` (Mint Green) | Savings section, success    |
| `--color-card-bg`        | `#FFFBFB` (Off-white)  | Card backgrounds            |
| `--color-card-bg-alt`    | `#F4F5F7` (Light gray) | Utility card backgrounds    |
| `--color-text-primary`   | `#000000`              | Primary text                |
| `--color-text-secondary` | `#FFFBFB`              | Text on colored backgrounds |
| `--color-placeholder`    | `#D9D9D9`              | Image placeholders          |

#### 4.3.2 Typography

| Token              | Font                                          | Size | Weight | Usage                 |
| ------------------ | --------------------------------------------- | ---- | ------ | --------------------- |
| `--font-display` | "Life Savers", sans-serif                     | 16px | Bold   | Card titles, headings |
| `--font-body`    | "Life Savers", sans-serif                     | 12px | Bold   | Card descriptions     |
| `--font-label`   | "Life Savers", sans-serif                     | 11px | Bold   | Card labels, captions |
| `--font-price`   | "Alata", sans-serif                           | 11px | Normal | Prices, values        |
| `--font-brand`   | "Lohit Tamil" / "Lohit Bengali" / "Noto Sans" | 13px | Normal | Brand names           |
| `--font-system`  | "SF Pro", sans-serif                          | 17px | Semi   | Status bar time       |

#### 4.3.3 Spacing & Layout

| Token                   | Value   | Usage                 |
| ----------------------- | ------- | --------------------- |
| `--radius-card`       | 35px    | Standard card corners |
| `--radius-card-small` | 20px    | Utility cards         |
| `--radius-image`      | 12-21px | Card images           |
| `--radius-nav`        | 12.5px  | Navigation pill       |
| `--card-width`        | 180px   | Standard card width   |
| `--card-gap`          | 13-15px | Gap between cards     |
| `--feed-padding`      | 10-15px | Feed side padding     |

### 4.4 Component Library

```
components/
├── layout/
│   ├── Navigation.tsx         # Bottom nav (mobile) / Sidebar (desktop)
│   ├── Header.tsx             # App header with logo + token balance
│   ├── Shell.tsx              # Main app wrapper with sky blue bg
│   ├── StatusBar.tsx          # iOS-style status bar (PWA only)
│   └── FilterTabs.tsx         # "All | Savings | Ikigai | Health" tabs
│
├── mission/
│   ├── MissionCard.tsx        # Base card component
│   ├── MissionCardShopping.tsx    # Shopping recommendations
│   ├── MissionCardSavings.tsx     # Utility/energy savings
│   ├── MissionCardConsumables.tsx # Shopping list/price drops
│   ├── MissionCardContent.tsx     # Podcast/news content
│   ├── MissionCardTravel.tsx      # Holiday suggestions
│   ├── MissionCardEntertainment.tsx # Comedy/theater events
│   ├── MissionCardFood.tsx        # Dinner ideas/recipes
│   ├── MissionCardPeople.tsx      # Relationship suggestions
│   ├── MissionCardHealth.tsx      # Health/longevity content
│   ├── MissionFeed.tsx        # Masonry grid layout
│   ├── MissionDetail.tsx      # Expanded mission view
│   └── FeedbackHeart.tsx      # Heart feedback icon (🩶→❤️→❤️large)
│
├── branding/
│   ├── OwnYouLogo.tsx         # App logo (top-left)
│   ├── TokenBalance.tsx       # Token icon + balance display
│   ├── BrandLogo.tsx          # Third-party brand logos on cards
│   └── EnergySwitchLogo.tsx   # "to" arrow for utility switching
│
├── profile/
│   ├── IkigaiWheel.tsx        # Four-dimension visualization
│   ├── IABCategories.tsx      # Category breakdown
│   ├── ConfidenceGauge.tsx    # Confidence level indicator
│   └── EvidenceChain.tsx      # Show supporting evidence
│
├── data/
│   ├── ConnectionCard.tsx     # Data source connection status
│   ├── OAuthFlow.tsx          # OAuth connection flow
│   └── SyncStatus.tsx         # Last sync, next sync
│
├── wallet/
│   ├── EarningsDisplay.tsx    # Current earnings
│   ├── TransactionHistory.tsx
│   └── WithdrawFlow.tsx
│
└── shared/
    ├── Button.tsx
    ├── Card.tsx               # Base card with 35px radius
    ├── Modal.tsx
    ├── Toast.tsx
    ├── PriceDisplay.tsx       # Price with strikethrough for discounts
    └── ImagePlaceholder.tsx   # D9D9D9 placeholder
```

### 4.5 Mission Card Specifications

#### 4.5.1 Card Types & Dimensions

| Card Type                                  | Figma Node | Height | Special Features                               |
| ------------------------------------------ | ---------- | ------ | ---------------------------------------------- |
| `home_card_savings_shopping`             | 791:5278   | 290px  | Product image, brand logo, price with discount |
| `home_card_savings_utility`              | 791:5282   | 284px  | Energy supplier logos, savings amount          |
| `home_card_savings_consumables`          | 791:5299   | 284px  | Product grid image, "Shopping List" label      |
| `home_card_ikigai_content`               | 791:5309   | 284px  | Podcast/article preview, publisher logo        |
| `home_card_ikigai_shopping`              | 791:5332   | 289px  | Product image, brand logo, price with discount |
| `home_card_ikigai_travel`                | 791:5321   | 208px  | Full-bleed destination image                   |
| `home_card_ikigai_entertainment_comedy`  | 791:5316   | 204px  | Event image with performer                     |
| `home_card_ikigai_entertainment_theater` | 791:5317   | 210px  | Theater/show poster image                      |
| `home_card_ikigai_food_recipe`           | 791:5324   | 287px  | Food image, "Dinner Ideas" label               |
| `home_card_ikigai_people`                | 791:5279   | 210px  | Person photo, "Call [Name]?" prompt            |
| `home_health_card_small`                 | 791:5304   | 180px  | Health imagery, "Optimising Longevity" label   |

#### 4.5.2 Card Anatomy

```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐    │  ← Card container (35px radius)
│  │  Brand Logo + Name           │    │  ← Optional brand header
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  │      Primary Image           │    │  ← Product/content image (12-21px radius)
│  │                              │    │
│  └──────────────────────────────┘    │
│  Product/Content Title               │  ← 11-12px Life Savers Bold
│  £34.95  £43.00 (strikethrough)      │  ← Price display (Alata)
│                               ❤️     │  ← Feedback heart (bottom-right)
├──────────────────────────────────────┤
│  Category Label (outside card)       │  ← 11px label below card
└──────────────────────────────────────┘
```

#### 4.5.3 Feedback Heart Component

```typescript
interface FeedbackHeartProps {
  state: "meh" | "like" | "love";     // Visual state
  size: "small" | "default";          // 29px for cards
  onTap: () => void;                  // Cycle through states
}

// States:
// 🩶 meh (grey, default)
// ❤️ like (red, 1 tap)
// ❤️ love (large red, 2 taps)
// 🩶 meh (grey, 3 taps - reset)
```

### 4.6 Navigation Components

#### 4.6.1 Header Bar (Mobile)

```
┌────────────────────────────────────────────┐
│  [Logo]    All  Savings  Ikigai  Health  [🪙1000] │
└────────────────────────────────────────────┘
```

- **Left:** OwnYou logo (circular, ~39px)
- **Center:** Filter tabs with underline on active
- **Right:** Token balance with coin icon

#### 4.6.2 Bottom Navigation (Mobile)

```
┌─────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────┐  │
│  │  [Missions] [Home] [Profile] [Settings] [Wallet] │  ← Sky blue pill (12.5px radius)
│  └───────────────────────────────────────────┘  │
│                                                 │  ← Gradient backdrop blur
└─────────────────────────────────────────────────┘
```

- 5 navigation icons
- Active icon highlighted
- Backdrop blur effect: `backdrop-blur-[2px]`
- Gradient: transparent → rgba(94,171,203,0.061)

### 4.7 Feed Layout

#### 4.7.1 Mobile (PWA)

```
┌──────────────────────────────────────────┐
│            STATUS BAR (iOS)              │
├──────────────────────────────────────────┤
│  [Logo]  All Savings Ikigai Health [🪙]  │
├──────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐        │
│  │             │  │             │        │
│  │   Card 1    │  │   Card 2    │        │
│  │  (290px)    │  │  (210px)    │        │
│  │             │  │             │        │
│  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐        │
│  │             │  │             │        │  ← Masonry grid, 2 columns
│  │   Card 3    │  │   Card 4    │        │     Variable card heights
│  │  (289px)    │  │  (284px)    │        │
│  │             │  │             │        │
│  └─────────────┘  └─────────────┘        │
│        ...              ...              │
├──────────────────────────────────────────┤
│       [ BOTTOM NAVIGATION BAR ]          │
└──────────────────────────────────────────┘
```

- **Screen width:** 402px (iPhone 14 Pro reference)
- **Card width:** 180px fixed
- **Gap:** ~13-15px
- **Columns:** 2
- **Layout:** Masonry (variable height cards)

### 4.8 Platform Adaptations

| Component                 | PWA Mobile (Default)               | Tauri Desktop                                 |
| ------------------------- | ---------------------------------- | --------------------------------------------- |
| **Navigation**      | Bottom tab bar (pill shape)        | Left sidebar (vertical navigation)            |
| **Header**          | Horizontal filter tabs             | Sidebar section headers                       |
| **Feed Layout**     | 2-column masonry                   | 3-4 column masonry (responsive)               |
| **Card Width**      | 180px fixed                        | 220-280px responsive                          |
| **Status Bar**      | iOS-style (9:41, signals, battery) | Native window chrome                          |
| **OAuth**           | Popup (24-hour tokens)             | Custom protocol `ownyou://` (90-day tokens) |
| **Background sync** | Service Worker                     | Native Rust service                           |
| **Wallet**          | WalletConnect                      | Embedded Solana wallet                        |
| **Notifications**   | Web Push                           | System native                                 |
| **Window Size**     | Full viewport                      | Min 1024x768, resizable                       |

#### 4.8.1 Desktop-Specific Changes

**Sidebar Navigation (Desktop):**

```
┌──────────────────────────────────────────────────────────┐
│ ┌─────────┐                                              │
│ │         │                                              │
│ │  Logo   │  ────────────────────────────────────────────│
│ │         │                                              │
│ ├─────────┤  ┌────────────────────────────────────────┐  │
│ │  Home   │  │                                        │  │
│ ├─────────┤  │     MISSION CARDS FEED                 │  │
│ │ Savings │  │     (3-4 column masonry grid)          │  │
│ ├─────────┤  │                                        │  │
│ │  Ikigai │  │  ┌───────┐ ┌───────┐ ┌───────┐        │  │
│ ├─────────┤  │  │       │ │       │ │       │        │  │
│ │ Health  │  │  │ Card  │ │ Card  │ │ Card  │        │  │
│ ├─────────┤  │  │       │ │       │ │       │        │  │
│ │ Profile │  │  └───────┘ └───────┘ └───────┘        │  │
│ ├─────────┤  │  ┌───────┐ ┌───────┐ ┌───────┐        │  │
│ │Settings │  │  │       │ │       │ │       │        │  │
│ ├─────────┤  │  │ Card  │ │ Card  │ │ Card  │        │  │
│ │ Wallet  │  │  │       │ │       │ │       │        │  │
│ │  [🪙]   │  │  └───────┘ └───────┘ └───────┘        │  │
│ └─────────┘  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Desktop Breakpoints:**

| Breakpoint | Columns | Card Width | Sidebar         |
| ---------- | ------- | ---------- | --------------- |
| 1024px     | 3       | 220px      | Collapsed icons |
| 1280px     | 3       | 260px      | Expanded labels |
| 1440px     | 4       | 280px      | Expanded labels |
| 1920px+    | 4-5     | 300px      | Expanded labels |

**Desktop-Specific Components:**

- `SidebarNavigation.tsx` - Vertical nav replacing bottom bar
- `DesktopHeader.tsx` - Search bar + notifications + profile avatar
- `CardHoverActions.tsx` - Hover reveals quick actions (snooze, save, share)
- `KeyboardShortcuts.tsx` - J/K navigation, Enter to open, Esc to close

### 4.9 Asset Management

#### 4.9.1 Image Assets from Figma

Images are served from Figma's MCP asset URLs (7-day expiry). For production:

1. **Download assets during build:** Fetch all image URLs and save to `/public/assets/`
2. **Generate responsive variants:** 1x, 2x, 3x for card images
3. **Placeholder strategy:** Use `#D9D9D9` background while loading

#### 4.9.2 Icon Assets

| Icon                  | Usage               | Source                  |
| --------------------- | ------------------- | ----------------------- |
| OwnYou Logo           | Header, splash      | `img9` from Figma     |
| Missions Icon         | Navigation          | `img3` from Figma     |
| Home Icon             | Navigation          | Custom SVG              |
| Profile Icon          | Navigation          | `img4` from Figma     |
| Settings Icon         | Navigation          | `img6` from Figma     |
| Wallet Icon           | Navigation, balance | `img5` from Figma     |
| Token Coin            | Balance display     | Custom SVG              |
| Feedback Heart        | Card feedback       | `imgProperty1Default` |
| Cellular/WiFi/Battery | Status bar          | SF Symbols              |

### 4.10 Implementation Priority

| Priority | Component              | Complexity | Dependencies       |
| -------- | ---------------------- | ---------- | ------------------ |
| P0       | Shell + Navigation     | Medium     | None               |
| P0       | MissionCard (base)     | Medium     | Card component     |
| P0       | MissionFeed (grid)     | Medium     | MissionCard        |
| P1       | FilterTabs             | Low        | None               |
| P1       | FeedbackHeart          | Low        | State management   |
| P1       | All card type variants | High       | MissionCard base   |
| P2       | TokenBalance           | Low        | Wallet integration |
| P2       | Desktop sidebar        | Medium     | Shell              |
| P3       | Card hover actions     | Low        | Desktop only       |
| P3       | Keyboard navigation    | Medium     | Desktop only       |

---

## 5. Data Source Sync Architecture

> **Review Status:** Approved with amendments (Nov 27, 2025)
> **Key Decision:** OrbitDB selected over Ceramic (js-ceramic deprecated April 2025)
> **Integration:** Must align with ADR-001 (Privy wallet-based authentication)

### 5.1 Platform Tier Architecture

| Platform                  | Sync Method                        | Data Scope                                                 | OrbitDB Mode                              |
| ------------------------- | ---------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| **Tauri (Desktop)** | Background service + OAuth refresh | Full: Gmail, Calendar, Plaid, Browser History              | Full IPFS node (Rust sidecar)             |
| **PWA (Browser)**   | On-demand + Service Worker         | Limited: 90-day Gmail, Calendar, Browser (current session) | Helia light client (resource-constrained) |

**Platform-Specific Considerations:**

- **Tauri:** Full OrbitDB/IPFS node runs in Rust sidecar process. Stable, performant, always-on sync.
- **PWA:** Service Worker execution is resource-constrained. Use on-demand sync to prevent battery drain and browser tab throttling. Aggressive IndexedDB caching required.

### 5.2 Sync Layer: OrbitDB v3 + IPFS (Helia)

> **Package:** `@orbitdb/core` (v3) - NOT the deprecated `orbit-db` package
> **IPFS:** Helia (replaces deprecated js-ipfs)

#### 5.2.1 Offline Handling

```typescript
interface OfflineQueue {
  // Queue mutations when offline
  mutations: {
    id: string;
    operation: "put" | "delete";
    namespace: string;
    key: string;
    value: any;
    timestamp: number;
    vectorClock: VectorClock;  // For CRDT conflict resolution
    synced: boolean;
  }[];

  // On reconnect
  async flush(): Promise<void> {
    const pending = this.mutations.filter(m => !m.synced);
    for (const mutation of pending.sort((a, b) => a.timestamp - b.timestamp)) {
      await this.orbitdb.apply(mutation);
      mutation.synced = true;
    }
  }
}
```

#### 5.2.2 CRDT Conflict Resolution (AMENDED)

> **CRITICAL:** Do NOT use Last-Write-Wins (LWW) for all data types.
> Financial data and profile classifications require specific CRDT types to prevent data loss.

```typescript
// CRDT type selection based on data semantics
interface ConflictResolutionPolicy {
  // Map namespace → CRDT type
  crdtTypes: {
    // G-Counter (grow-only): For values that only increment
    "earnings": "g-counter",
    "ikigai_points": "g-counter",
    "mission_completion_count": "g-counter",

    // PN-Counter (increment/decrement): For values that can go up or down
    "token_balance": "pn-counter",

    // OR-Set (observed-remove): For collections where items can be added/removed
    "iab_classifications": "or-set",
    "mission_tags": "or-set",
    "trusted_peers": "or-set",
    "dismissed_missions": "or-set",

    // LWW-Register: ONLY for atomic fields where latest value wins
    "user_preferences": "lww-register",
    "user_name": "lww-register",
    "notification_settings": "lww-register",
    "last_sync_timestamp": "lww-register",

    // LWW-Map: For maps where each key is independently LWW
    "mission_states": "lww-map",  // Each mission has independent state
    "data_source_configs": "lww-map",
  };

  // Vector clock for causal ordering
  vectorClock: Map<deviceId, number>;

  resolve(namespace: string, local: Entry, remote: Entry): Entry {
    const crdtType = this.crdtTypes[namespace] || "lww-register";

    switch (crdtType) {
      case "g-counter":
        return this.mergeGCounter(local, remote);
      case "pn-counter":
        return this.mergePNCounter(local, remote);
      case "or-set":
        return this.mergeORSet(local, remote);
      case "lww-register":
        return this.compareClocks(local.clock, remote.clock) > 0 ? local : remote;
      case "lww-map":
        return this.mergeLWWMap(local, remote);
    }
  }

  // G-Counter merge: take max of each device's count
  mergeGCounter(local: GCounter, remote: GCounter): GCounter {
    const merged = new Map<string, number>();
    for (const [device, count] of [...local.counts, ...remote.counts]) {
      merged.set(device, Math.max(merged.get(device) || 0, count));
    }
    return { counts: merged, value: sum(merged.values()) };
  }

  // OR-Set merge: union of adds, subtract observed removes
  mergeORSet(local: ORSet, remote: ORSet): ORSet {
    const adds = new Set([...local.adds, ...remote.adds]);
    const removes = new Set([...local.removes, ...remote.removes]);
    return {
      adds,
      removes,
      value: [...adds].filter(item => !removes.has(item)),
    };
  }
}
```

#### 5.2.3 Device Discovery & Sync

> **Simplified Design:** Privy wallet identity eliminates need for manual device pairing.
> All devices with the same wallet are automatically trusted and can sync.

```typescript
interface DeviceDiscovery {
  // Automatic discovery via Privy wallet identity
  // No QR codes, no manual pairing - just sign in with same wallet
  async discoverDevices(): Promise<PeerDevice[]> {
    const walletAddress = await this.privy.getWalletAddress();

    // Register this device with signaling server
    const deviceSignature = await this.privy.signMessage(
      `ownyou-device:${this.deviceId}:${Date.now()}`
    );

    await this.signaling.register({
      walletAddress,
      deviceId: this.deviceId,
      signature: deviceSignature,
      platform: this.getPlatform(),  // "tauri" | "pwa"
    });

    // Query for other devices with same wallet
    return this.signaling.findPeers(walletAddress);
  }

  // Trust model: Same wallet = same user = trusted
  // No explicit "trusted peers" list needed
  isTrusted(peer: PeerDevice): boolean {
    return peer.walletAddress === this.walletAddress;
  }

  // Signaling infrastructure for cross-internet discovery
  signaling: {
    server: "wss://signal.ownyou.app",

    // STUN for NAT traversal (works for ~70% of connections)
    stunServers: ["stun:stun.l.google.com:19302"],

    // TURN relay for symmetric NAT (~30% of connections)
    turnServer: {
      url: "turn:turn.ownyou.app:443",
      credentials: "derived-from-wallet",  // No hardcoded credentials
    },
  };
}
```

**Why no mDNS or QR pairing?**

| Removed Feature      | Reason                                                                          |
| -------------------- | ------------------------------------------------------------------------------- |
| **mDNS**       | Only works on local network; signaling server handles all cases including LAN   |
| **QR Pairing** | Privy wallet identity makes manual pairing obsolete; same wallet = auto-trusted |

**Sync Modes:**

| Mode                        | When Used                            | Infrastructure       |
| --------------------------- | ------------------------------------ | -------------------- |
| **Direct P2P**        | Both devices online, NAT traversable | Signaling + STUN     |
| **Relayed P2P**       | Both devices online, symmetric NAT   | Signaling + TURN     |
| **Async via Pinning** | Devices not online simultaneously    | Blind Backup service |

#### 5.2.4 Encryption Policy (AMENDED)

> **IMPORTANT:** Evaluate OrbitDB v3's native modular encryption BEFORE implementing custom encryption.
> Custom encryption risks: Index leakage (are indices encrypted?), search performance, key management complexity.

```typescript
interface EncryptionPolicy {
  // DECISION POINT: Use OrbitDB v3 native encryption or custom?
  encryptionMode: "orbitdb-native" | "custom-aes-gcm";

  // RECOMMENDED: Try OrbitDB v3 native encryption first
  // OrbitDB v3 includes modular encryption that handles IPFS DAG node encryption automatically
  orbitdbNative: {
    enabled: true,
    // OrbitDB v3 encrypts at the DAG level, not application level
    // This handles index encryption automatically
    evaluationStatus: "MUST_EVALUATE_BEFORE_PHASE_3",
  };

  // FALLBACK: Custom encryption (only if OrbitDB native insufficient)
  customEncryption: {
    enabled: false,  // Enable only after OrbitDB native evaluation

    // Key derivation integrated with ADR-001 (Privy wallet)
    async deriveKey(): Promise<CryptoKey> {
      // Use Privy wallet for key derivation (ADR-001 alignment)
      const wallet = await this.privy.getWallet();

      // Sign a deterministic message to derive encryption key
      const signature = await wallet.signMessage("ownyou-encryption-key-v1");
      const seed = sha256(signature);

      // Argon2id for key stretching
      const stretched = argon2id(seed, {
        memory: 65536,
        iterations: 3,
        parallelism: 4,
      });

      return crypto.subtle.importKey("raw", stretched, "AES-GCM", false, ["encrypt", "decrypt"]);
    },

    // All data encrypted before IPFS
    async encryptForStorage(data: any, key: CryptoKey): Promise<Uint8Array> {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encode(data)
      );
      return concat(iv, encrypted);  // IV prepended
    },
  };

  // Encryption scope
  encryptedNamespaces: ["*"];  // All namespaces encrypted

  // Key recovery
  recovery: {
    method: "privy-wallet",  // Primary: Privy's built-in recovery
    fallback: "mnemonic",    // Backup: BIP-39 24-word seed (exportable from Privy)
    socialRecovery: {
      enabled: true,
      scheme: "shamir",
      threshold: 3,
      shares: 5,
    },
  };
}
```

#### 5.2.5 ADR-001 Integration (Privy Wallet)

> **Alignment with ADR-001:** Sync architecture must integrate with Privy-based authentication.
> The wallet used for auth is the SAME wallet used for sync encryption.

```typescript
interface PrivySyncIntegration {
  // Same wallet for auth AND sync
  walletSource: "privy";  // ADR-001 specifies Privy

  // Device registration via wallet signature
  async registerDevice(): Promise<DeviceRegistration> {
    const wallet = await this.privy.getWallet();
    const deviceId = await this.generateDeviceId();

    // Sign device registration with wallet
    const registration = {
      deviceId,
      walletAddress: wallet.address,
      timestamp: Date.now(),
      platform: this.getPlatform(),  // "tauri" | "pwa"
    };

    const signature = await wallet.signTypedData(registration);

    return { ...registration, signature };
  }

  // Multi-device sync via wallet identity (NOT QR pairing)
  async syncWithOtherDevices(): Promise<void> {
    // All devices with same wallet are automatically authorized
    const walletAddress = await this.privy.getWalletAddress();

    // Discovery: Find other devices with same wallet
    const peerDevices = await this.discoverPeersByWallet(walletAddress);

    // Sync: Each peer already has encryption key (derived from same wallet)
    for (const peer of peerDevices) {
      await this.syncWithPeer(peer);
    }
  }

  // Key derivation is deterministic from wallet
  // Same wallet on different devices → same encryption key
  // No key exchange needed between user's own devices
}
```

### 5.3 Key Recovery

| Method                              | Description                                | Tradeoffs                |
| ----------------------------------- | ------------------------------------------ | ------------------------ |
| **Privy Recovery** (Primary)  | Privy's built-in social/email recovery     | Depends on Privy service |
| **24-word mnemonic** (Backup) | BIP-39 seed phrase (exportable from Privy) | User must securely store |
| **Social recovery**           | Shamir 3-of-5 shares to trusted contacts   | Requires trusted network |
| **Hardware key**              | YubiKey or similar                         | Additional hardware cost |

### 5.4 Data Availability & E2EE Cloud Backup

> **CRITICAL GAP:** Key recovery solves "I lost my keys" but NOT "I lost my data".
> If user loses their only device AND no other peers are online, OrbitDB cannot sync from nowhere.

#### 5.4.1 The Lost Device Scenario

```
User has:        ✅ Seed phrase (can recover keys)
                 ✅ New device (can install app)
                 ❌ No other devices online
                 ❌ Data was only on lost device

Without backup:  🚨 Data is LOST
With E2EE backup: ✅ Full recovery in minutes
```

#### 5.4.2 E2EE Cloud Backup (Signal-style)

> **Architecture Decision:** Use proven E2EE cloud backup pattern (Signal, WhatsApp, Tresorit).
> Zero-knowledge architecture ensures OwnYou cannot read user data.

**Why E2EE Cloud over IPFS Pinning:**

| Aspect                   | E2EE Cloud                        | IPFS Pinning                         |
| ------------------------ | --------------------------------- | ------------------------------------ |
| **Privacy**        | Zero-knowledge (can't read)       | Zero-knowledge (can't read)          |
| **Reliability**    | 99.999999999% (S3 SLA)            | Variable (pinning service dependent) |
| **Recovery Speed** | Seconds (direct download)         | Minutes (DHT lookup + retrieval)     |
| **Implementation** | 1-2 weeks                         | 3-4 weeks                            |
| **Cost**           | ~$0.02/GB/month | ~$0.40/GB/month |                                      |
| **Complexity**     | Low                               | Medium-High                          |

**Conclusion:** Same privacy, simpler implementation, higher reliability.

```typescript
interface E2EECloudBackup {
  // Zero-knowledge architecture: OwnYou stores encrypted blobs, cannot decrypt

  encryption: {
    // Key derived from Privy wallet (ADR-001 alignment)
    keyDerivation: "wallet-signature";
    algorithm: "AES-256-GCM";

    // Deterministic: same wallet = same key on any device
    async deriveBackupKey(): Promise<CryptoKey> {
      const wallet = await this.privy.getWallet();
      const signature = await wallet.signMessage("ownyou-backup-key-v1");
      return crypto.subtle.importKey(
        "raw",
        sha256(signature),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
      );
    }
  };

  storage: {
    // OwnYou-managed (default) or user's own cloud
    provider: "ownyou" | "s3" | "gcs" | "azure";

    // OwnYou-managed storage
    ownyou: {
      endpoint: "https://backup.ownyou.app/v1";

      // Indexed by wallet address hash (not plaintext address)
      // Prevents correlation between backup and on-chain identity
      indexKey: "sha256(walletAddress + 'backup-index')";

      // Trust model
      trust: {
        canRead: false,      // Cannot decrypt without wallet
        canDelete: true,     // Can delete if user requests or stops paying
        canCorrelate: false, // Index is hashed, no plaintext wallet address
      };
    };

    // Self-hosted option (power users)
    selfHosted: {
      // User provides their own S3/GCS credentials
      // Stored encrypted in local storage
      credentials: EncryptedCredentials;
    };
  };

  // Backup structure
  backup: {
    // Full snapshot (weekly) + incremental (daily)
    strategy: "incremental";

    // What's backed up
    includes: [
      "iab_classifications",
      "ikigai_profile",
      "mission_state",
      "user_preferences",
      "financial_profile",
      "earnings",
    ];

    // What's NOT backed up (can be re-fetched)
    excludes: [
      "raw_emails",        // Re-fetch from OAuth
      "cached_content",    // Transient
      "session_data",      // Device-specific
    ];
  };
}
```

#### 5.4.3 Backup Policy

```typescript
interface BackupPolicy {
  frequency: {
    realtime: ["earnings", "mission_completions"],  // Immediate
    hourly: ["iab_classifications", "ikigai_profile"],
    daily: ["preferences", "historical_data"],
  };

  retention: {
    snapshots: 7,           // Keep last 7 daily snapshots
    maxAge: "90 days",      // Delete backups older than 90 days
  };

  triggers: {
    automatic: true,        // Background sync when online
    beforeLogout: true,     // Force backup before signing out
    manual: true,           // User can trigger anytime
  };

  // Bandwidth optimization
  optimization: {
    compression: "gzip",
    deduplication: true,    // Only upload changed data
    deltaSync: true,        // Incremental updates, not full snapshots
  };
}
```

#### 5.4.4 Recovery Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISASTER RECOVERY FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User loses phone (only device)                              │
│                                                                  │
│  2. User gets new phone, installs OwnYou                        │
│                                                                  │
│  3. User recovers wallet (Privy recovery OR seed phrase)        │
│     → Wallet restored                                           │
│     → Backup encryption key derived automatically               │
│                                                                  │
│  4. App queries backup service                                  │
│     → Request: GET /backup/{hashedWalletAddress}                │
│     → Response: Encrypted backup blob                           │
│                                                                  │
│  5. App decrypts and restores locally                           │
│     → IndexedDB populated                                       │
│     → OrbitDB initialized with restored state                   │
│                                                                  │
│  6. P2P sync resumes normally                                   │
│     → Other devices (if any) sync incremental changes           │
│                                                                  │
│  Result: ✅ Full recovery in under 2 minutes                    │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.4.5 Implementation

| Phase             | Feature                                        | Priority            |
| ----------------- | ---------------------------------------------- | ------------------- |
| **Phase 2** | E2EE backup to OwnYou cloud (free tier, 1GB)   | **MUST HAVE** |
| **Phase 2** | Automatic daily backups                        | **MUST HAVE** |
| **Phase 2** | Recovery flow in onboarding                    | **MUST HAVE** |
| **Phase 3** | Self-hosted storage option (bring your own S3) | SHOULD HAVE         |
| **Phase 4** | Paid tier (10GB+), extended retention          | COULD HAVE          |

#### 5.4.6 Security Considerations

```typescript
interface BackupSecurity {
  // Encryption is mandatory, not optional
  encryptionRequired: true;

  // Key never leaves device
  keyStorage: "device-only";

  // Backup index uses hashed wallet address
  // Prevents: "Show me all backups for wallet 0x123..."
  indexPrivacy: "hashed";

  // Rate limiting prevents enumeration attacks
  rateLimiting: {
    maxRequestsPerMinute: 10,
    maxFailedAttempts: 5,
    lockoutDuration: "15 minutes",
  };

  // Audit log (encrypted, only user can read)
  auditLog: {
    backupCreated: timestamp,
    backupRestored: timestamp,
    deviceId: string,
  };
}
```

### 5.5 Data Sanitization Pipeline

Before sending data to cloud LLMs, apply sanitization:

```typescript
interface SanitizationPipeline {
  // Entity extraction
  extractEntities(text: string): Entity[];

  // Sanitization rules (MINIMAL - preserve utility)
  rules: {
    // REMOVE (true PII)
    ssn: "REDACT",
    credit_card: "REDACT",
    password: "REDACT",
    full_address: "REDACT",  // Keep city/state

    // KEEP (utility > privacy risk)
    first_names: "KEEP",           // Relationship tracking
    merchant_names: "KEEP",        // Purchase patterns
    amounts: "KEEP",               // Financial analysis
    dates: "KEEP",                 // Timeline analysis
    venues: "KEEP",                // Activity patterns
    product_names: "KEEP",         // Interest signals
    cities: "KEEP",                // Location patterns
    email_subjects: "KEEP",        // Intent signals
  };

  // Validation
  validate(sanitized: string): boolean {
    // Ensure no SSN, CC, password patterns remain
    return !this.containsSensitivePatterns(sanitized);
  }
}
```

### 5.6 Section 5 Summary & Action Items

> **Review Date:** November 27, 2025
> **Status:** APPROVED

#### Key Architectural Decisions

| Decision                      | Resolution                       | Rationale                                                                |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| **Sync Technology**     | OrbitDB v3 (`@orbitdb/core`)   | Ceramic js-ceramic deprecated; OrbitDB v3 mature with modular encryption |
| **IPFS Implementation** | Helia                            | Replaces deprecated js-ipfs                                              |
| **Auth Integration**    | Privy wallet (ADR-001)           | Same wallet for auth, sync, AND backup encryption                        |
| **Conflict Resolution** | Data-type specific CRDTs         | LWW only for atomic fields; G-Counter/OR-Set for financial/profile data  |
| **Sync Encryption**     | Evaluate OrbitDB native first    | Custom AES-GCM as fallback only                                          |
| **Data Availability**   | E2EE Cloud Backup (Signal-style) | Proven pattern; same privacy as IPFS pinning, simpler & more reliable    |

#### Pre-Phase 3 Checklist (MUST COMPLETE)

- [ ] **Evaluate OrbitDB v3 native encryption** - Test if DAG-level encryption meets requirements
- [ ] **Implement CRDT type mapping** - G-Counter, OR-Set, LWW-Register per namespace
- [ ] **Build E2EE Cloud Backup service** - Free tier (1GB) for data availability
- [ ] **Integrate Privy wallet** - Device registration, key derivation, auto-discovery
- [ ] **Set up signaling/TURN infrastructure** - For cross-internet P2P sync
- [ ] **Implement recovery flow** - Wallet recovery → backup decryption → data restore

#### Risks & Mitigations

| Risk                                        | Likelihood | Impact   | Mitigation                                    |
| ------------------------------------------- | ---------- | -------- | --------------------------------------------- |
| OrbitDB v3 encryption insufficient          | Medium     | High     | Fallback to custom AES-GCM (already designed) |
| P2P fails for ~30% of users (symmetric NAT) | High       | Medium   | TURN server required; E2EE backup as fallback |
| Single device users lose data               | High       | Critical | E2EE Cloud Backup (Phase 2 MUST HAVE)         |
| Privy service outage                        | Low        | High     | Key export enables migration; backup mnemonic |
| Backup service unavailable                  | Low        | Medium   | Self-hosted option (bring your own S3)        |

#### Related Documents

- **ADR-001:** `/docs/architecture/ADR-001-authentication.md` - Privy wallet authentication
- **Ceramic Decision:** `/ceramic-research/CERAMIC_DECISION_FINAL.md` - Historical (superseded)
- **Review Feedback:** `/docs/architecture/SECTION_5_DATA_SYNC_REVIEW.md` - Reviewer analysis

---

## 6. Decentralization Ledger

> **Last Updated:** November 2025
> **Research Status:** Complete evaluation of 10+ private inference platforms

### 6.1 Self-Sovereign Principle

**All consumer data at rest must be self-sovereign.** The user controls their data, stored on their device or in user-controlled decentralized storage.

### 6.2 Current Compromises

| Component                 | Current State         | Compromise Reason               | Migration Path                                        |
| ------------------------- | --------------------- | ------------------------------- | ----------------------------------------------------- |
| **LLM Inference**   | Cloud (OpenAI/Claude) | Local models too slow/expensive | WebLLM → Phala TEE → Nillion Blind Compute          |
| **OAuth Tokens**    | Local encrypted       | Industry standard               | DID-based auth (future)                               |
| **IPFS Pinning**    | Optional third-party  | Availability guarantee          | Filecoin incentivized pinning                         |
| **Solana Payments** | Public blockchain     | Revenue verification            | Layer 2 / privacy chain                               |

### 6.3 LLM Data Policy

```typescript
interface LLMDataPolicy {
  // What goes to cloud LLMs
  allowed: [
    "sanitized_text",      // PII removed
    "iab_categories",      // Non-identifying
    "aggregated_patterns", // No raw data
  ];

  // What NEVER goes to cloud LLMs
  forbidden: [
    "raw_emails",
    "raw_transactions",
    "oauth_tokens",
    "wallet_keys",
    "full_addresses",
    "ssn_or_tax_ids",
  ];

  // Local-only operations (when local LLM available)
  localPreferred: [
    "medical_analysis",
    "financial_advice",
    "password_management",
  ];
}
```

### 6.4 Private Inference Technology Landscape

> **Research completed November 2025.** Categorized by technology approach and readiness level.

#### 6.4.1 Tier 1: Production-Ready Private Inference

| Platform | Technology | Privacy Model | OwnYou Fit | Status |
| --- | --- | --- | --- | --- |
| **Phala Network** | GPU TEE (Intel TDX, NVIDIA H100/H200) | Hardware isolation, attestation | **HIGH** - Best for sensitive inference | Production |
| **Venice AI** | Zero-retention cloud + encryption | No server-side logging | **MEDIUM** - Good interim solution | Production |
| **Redpill AI** | TEE aggregation (Intel TDX, NVIDIA CC) | 200+ models, zero data retention | **MEDIUM** - Multi-model access | Production |

#### 6.4.2 Tier 2: Maturing Platforms (6-12 months)

| Platform | Technology | Privacy Model | OwnYou Fit | Status |
| --- | --- | --- | --- | --- |
| **Nillion** | Blind Compute (MPC + FHE + ZKP) | Data never decrypted | **HIGHEST** - Ultimate privacy | Mainnet Mar 2025 |
| **Marlin Protocol** | TEE + ZK coprocessors (Oyster/Kalypso) | Verifiable compute | **HIGH** - Good for proofs | Production |
| **Hyperbolic** | Decentralized GPU (PoSP verification) | Distributed compute | **MEDIUM** - Cost optimization | Beta |

#### 6.4.3 Tier 3: Research/Evaluation

| Platform | Technology | Privacy Model | OwnYou Fit | Status |
| --- | --- | --- | --- | --- |
| **Nesa** | ZKML + Split Learning + TEE | Critical vs General inference modes | **HIGH** - Healthcare/Finance | Research |
| **Ritual** | Infernet (off-chain → on-chain bridge) | Verifiable AI for Web3 | **MEDIUM** - Smart contract integration | Development |
| **Together AI** | Centralized cloud, open-source models | Opt-out privacy, not decentralized | **LOW** - Not self-sovereign | Production |

### 6.5 Detailed Platform Evaluations

#### 6.5.1 Nillion — Blind Computation Network

> **Website:** [nillion.com](https://nillion.com)
> **Status:** Mainnet + NIL token launched March 2025
> **Verdict:** 🟢 **RECOMMENDED** for Phase 4+ sensitive inference

**What It Is:**
Nillion is humanity's first "blind computer" — a network that processes data without ever seeing it. Uses Nil Message Compute (NMC) to enable computations on encrypted data without decryption.

**Privacy Technologies:**
- Multi-Party Computation (MPC)
- Fully Homomorphic Encryption (FHE)
- Zero-Knowledge Proofs (ZKPs)

**Key Capabilities:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      NILLION ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│  User Data (encrypted) ──▶ Nillion Network ──▶ Result (encrypted)│
│                                │                                 │
│                         NO NODE SEES:                            │
│                         • Full input data                        │
│                         • Full model weights                     │
│                         • Intermediate results                   │
│                                                                  │
│  Use Cases:                                                      │
│  • Private AI inference (regression, classification, forecasting)│
│  • Healthcare diagnostics                                        │
│  • Financial modeling                                            │
│  • Genomic analysis                                              │
└─────────────────────────────────────────────────────────────────┘
```

**2025 Roadmap (nilVM, nilDB, nilAI):**
- **nilVM:** Blind virtual machine for general computation
- **nilDB:** Private storage with encrypted queries
- **nilAI:** Private inference for ML models

**Partnerships:**
- io.net (decentralized GPU infrastructure)
- Ritual (trustless AI inference)
- NEAR Protocol (privacy for NEAR ecosystem)
- Verida (privacy-preserving data)

**OwnYou Integration Plan:**
| Phase | Integration | Use Case |
| --- | --- | --- |
| Phase 4 | nilAI for IAB classification | Process raw emails without exposure |
| Phase 5 | nilDB for profile storage | Encrypted user profiles |
| Future | Full stack | Complete blind computation |

**Limitations:**
- Higher latency than direct inference (~2-5x)
- Higher cost than cloud LLMs
- Model size limitations (currently best for regression, classification)

---

#### 6.5.2 Phala Network — Confidential Computing Cloud

> **Website:** [phala.network](https://phala.network)
> **Status:** Production, NVIDIA Inception Program member
> **Verdict:** 🟢 **RECOMMENDED** for immediate TEE-based inference

**What It Is:**
Phala provides GPU Trusted Execution Environments (TEEs) for confidential AI inference. Hardware-level isolation ensures data remains encrypted even during processing.

**Supported Hardware:**
- Intel TDX (Trust Domain Extensions)
- Intel SGX (legacy, being phased out 2025)
- AMD SEV (Secure Encrypted Virtualization)
- **NVIDIA H100/H200 TEE** (Confidential Computing mode)

**Key Capabilities:**
```typescript
interface PhalaCapabilities {
  // Near-zero performance overhead on H100 for large models
  performance: {
    llama_3_1_70B: "~0% overhead in TEE mode",
    latency: "comparable to non-TEE inference",
  };

  // Cryptographic attestation
  verification: {
    attestation: "hardware-backed proof of secure execution",
    auditability: "external parties can verify model integrity",
  };

  // Supported models
  models: [
    "Llama 3.x (all sizes)",
    "Mistral",
    "DeepSeek",
    "Custom fine-tuned models",
  ];
}
```

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    PHALA TEE INFERENCE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User ──▶ [Encrypted Request] ──▶ TEE Enclave ──▶ [Encrypted Result]│
│                                       │                          │
│                              ┌────────┴────────┐                 │
│                              │  NVIDIA H100    │                 │
│                              │  TEE Mode       │                 │
│                              │                 │                 │
│                              │  • Data encrypted in memory       │
│                              │  • Model weights protected        │
│                              │  • Attestation proof generated    │
│                              └─────────────────┘                 │
│                                                                  │
│  Guarantees:                                                     │
│  ✓ Confidentiality: Data never exposed, even to Phala           │
│  ✓ Integrity: Computation cannot be tampered with               │
│  ✓ Attestation: Cryptographic proof of correct execution        │
└─────────────────────────────────────────────────────────────────┘
```

**2024-2025 Partnerships:**
- a16z (Eliza AI Agent TEE framework)
- NVIDIA Inception Program
- Ava Protocol (DeFi automation)
- 0G (decentralized AI OS)
- NeurochainAI (GPU compute)

**OwnYou Integration Plan:**
| Phase | Integration | Use Case |
| --- | --- | --- |
| Phase 2 | Phala TEE for IAB inference | Sensitive email classification |
| Phase 3 | TEE for Ikigai analysis | Private well-being inference |
| Phase 4 | Mission Agent inference | Private agent execution |

**Limitations:**
- Requires specific GPU hardware (H100/H200)
- Higher cost than standard cloud inference
- Geographic availability of TEE nodes

---

#### 6.5.3 Marlin Protocol — Verifiable AI Coprocessors

> **Website:** [marlin.org](https://marlin.org)
> **Status:** Production (Oyster TEE, Kalypso ZK)
> **Verdict:** 🟡 **EVALUATE** for verifiable computation needs

**What It Is:**
Marlin provides verifiable computing coprocessors using TEEs (Oyster) and ZK proofs (Kalypso) to delegate complex workloads from smart contracts.

**Two Product Lines:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    MARLIN COPROCESSORS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OYSTER (TEE-based)                 KALYPSO (ZK-based)          │
│  ─────────────────                  ─────────────────            │
│  • Trusted Execution Environments    • Zero-Knowledge Proofs     │
│  • High performance (~native speed)  • Trustless verification    │
│  • Hardware attestation              • Higher compute overhead   │
│  • Best for: General AI inference    • Best for: Critical proofs │
│                                                                  │
│  Use Case: Fast, private inference   Use Case: Auditable results │
└─────────────────────────────────────────────────────────────────┘
```

**Key Advantage:**
TEEs are inexpensive compared to MPC, FHE, or ZK proofs — offering near-native performance at lower cost.

**2024-2025 Partnerships:**
- ChainGPT (AI + blockchain)
- Chromia (Layer-1 AI security)
- DeepLink (AI gaming)
- Talus Network (verifiable AI agents)

**OwnYou Integration Plan:**
| Phase | Integration | Use Case |
| --- | --- | --- |
| Phase 3 | Oyster for Mission Agents | Verifiable agent execution |
| Phase 4 | Kalypso for BBS+ proofs | ZK proof generation |

---

#### 6.5.4 Venice AI — Zero-Retention Private Inference

> **Website:** [venice.ai](https://venice.ai)
> **Status:** Production, 400K+ users, VVV token on Base
> **Verdict:** 🟡 **INTERIM SOLUTION** — good privacy, not decentralized

**What It Is:**
Venice provides private, uncensored AI inference using open-source models. Zero data retention policy — prompts are never logged or stored.

**Privacy Architecture:**
```typescript
interface VenicePrivacy {
  // Data handling
  storage: "local browser only (encrypted)",
  serverRetention: "none — zero logging",
  transmission: "SSL encrypted",

  // Current limitations
  limitations: {
    gpuPlaintext: "GPU must see prompt in plaintext during inference",
    trustModel: "trust Venice's claims (no cryptographic verification)",
  };

  // 2025 roadmap
  future: {
    homomorphicEncryption: "researching, not yet feasible (too slow)",
    thirdPartyVerification: "key priority for 2025",
  };
}
```

**Supported Models:**
- Llama 3.x family
- Qwen variants
- Stable Diffusion / Flux (images)
- DeepSeek R1

**Why "Interim":**
Venice is privacy-respecting but not cryptographically private. Users must trust Venice's zero-logging claims. No TEE, MPC, or FHE — the GPU processes plaintext.

**OwnYou Integration Plan:**
| Phase | Integration | Use Case |
| --- | --- | --- |
| Phase 1-2 | Venice API for general inference | Non-sensitive queries |
| Phase 3+ | Migrate to Phala/Nillion | Sensitive data processing |

---

#### 6.5.5 Redpill AI — Confidential AI Gateway

> **Website:** [redpill.ai](https://redpill.ai)
> **Status:** Production, 200+ models
> **Verdict:** 🟡 **EVALUATE** for multi-model aggregation

**What It Is:**
Redpill is a decentralized AI aggregator providing access to 200+ models through a single API, with TEE-based privacy (Intel TDX, NVIDIA Confidential Computing).

**Key Features:**
```typescript
interface RedpillCapabilities {
  models: "200+ AI models via single API",
  privacy: {
    gpuTEE: true,           // Intel TDX, NVIDIA CC
    dataRetention: "zero",
    openAICompatible: true, // Drop-in replacement
  };

  routing: {
    intelligent: true,      // Routes to best LLM based on query
    criteria: ["performance", "cost", "efficiency"],
  };
}
```

**Funding:** $5M seed (July 2024)

**OwnYou Integration Plan:**
| Phase | Integration | Use Case |
| --- | --- | --- |
| Phase 2 | Redpill as model router | Multi-model fallback |
| Phase 3 | TEE inference option | Sensitive queries |

---

#### 6.5.6 Nesa — Decentralized AI with ZKML

> **Website:** [nesa.ai](https://nesa.ai)
> **Status:** Research/Development
> **Verdict:** 🟡 **MONITOR** for future healthcare/finance use cases

**What It Is:**
Nesa is a Layer-1 blockchain for secure, privacy-preserving AI inference. Distinguishes between "critical" and "general" inference with different privacy levels.

**Two Inference Modes:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    NESA INFERENCE MODES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CRITICAL INFERENCE                 GENERAL INFERENCE            │
│  ──────────────────                 ─────────────────            │
│  Healthcare, Finance, Legal         Weather, Recommendations     │
│                                                                  │
│  Technologies:                      Technologies:                │
│  • ZKML (model integrity)           • Consensus-Based Verification│
│  • Homomorphic Encryption (privacy) • Split Learning (privacy)   │
│  • TEE (secure execution)           • Faster processing          │
│                                                                  │
│  Latency: Higher                    Latency: Lower               │
│  Privacy: Maximum                   Privacy: Adequate            │
└─────────────────────────────────────────────────────────────────┘
```

**Key Innovation — zkDPS:**
Zero-Knowledge Decentralized Proof System allows nodes to prove correct inference without revealing inputs or model internals.

**OwnYou Integration Plan:**
| Phase | Integration | Use Case |
| --- | --- | --- |
| Future | Critical mode for medical missions | Health diagnostic agent |
| Future | General mode for daily queries | Standard Mission Agents |

---

#### 6.5.7 Hyperbolic — Decentralized GPU Marketplace

> **Website:** [hyperbolic.xyz](https://hyperbolic.xyz)
> **Status:** Beta, $20M funding
> **Verdict:** 🟡 **EVALUATE** for cost optimization

**What It Is:**
Hyperbolic aggregates underutilized GPUs globally (data centers, mining farms, personal machines) into a decentralized compute marketplace.

**Key Features:**
```typescript
interface HyperbolicCapabilities {
  cost: "up to 75% lower than traditional providers",
  scale: "1B+ tokens/day, 40K+ developers",
  verification: "Proof of Sampling (PoSP) protocol",
  hardware: ["NVIDIA", "AMD", "Intel", "Apple GPUs"],

  // AI Agent capabilities
  agentKit: {
    gpuManagement: true,
    blockchainValidation: true,
    modelTraining: true,
  };
}
```

**2025 Roadmap:**
- Own blockchain for AI infrastructure governance
- AgentKit for autonomous AI agents

**OwnYou Integration Plan:**
| Phase | Integration | Use Case |
| --- | --- | --- |
| Phase 3 | Hyperbolic for batch processing | Cost-optimized IAB classification |
| Phase 4 | AgentKit exploration | Autonomous Mission Agents |

---

#### 6.5.8 Ritual — Decentralized AI Infrastructure

> **Website:** [ritual.net](https://ritual.net)
> **Status:** Development, $25M Series A (June 2024)
> **Verdict:** 🟡 **MONITOR** for smart contract integration

**What It Is:**
Ritual connects off-chain AI computations with on-chain smart contracts via Infernet, enabling dApps to leverage AI without centralized providers.

**Key Innovation — Infernet:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    RITUAL INFERNET                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Smart Contract ──▶ [AI Request] ──▶ Infernet ──▶ Off-chain AI  │
│        │                                              │          │
│        └──────────────── [Verified Result] ◀─────────┘          │
│                                                                  │
│  Features:                                                       │
│  • Any EVM-compatible chain                                      │
│  • ZK proofs for verification                                    │
│  • TEE code execution                                            │
│  • Cross-chain state access                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Partnerships:**
- Nillion (blind compute integration)
- FLock.io (decentralized model fine-tuning)
- io.net (decentralized compute)

**OwnYou Integration Plan:**
| Phase | Integration | Use Case |
| --- | --- | --- |
| Phase 4 | Infernet for BBS+ verification | On-chain proof verification |
| Future | Ritual Superchain | Decentralized Mission Agent execution |

---

### 6.6 Local/Browser-Based Inference Options

> For maximum privacy, run models entirely on user devices.

#### 6.6.1 WebLLM (Browser)

**Status:** Production-ready
**Performance:** ~80% of native speed via WebGPU

```typescript
interface WebLLMCapabilities {
  runtime: "browser (WebGPU + WebAssembly)",
  api: "OpenAI-compatible",
  models: ["Llama 3.x", "Mistral", "Phi", "Gemma"],
  quantization: "4-bit, 8-bit supported",

  // OwnYou usage
  useCase: "Privacy-sensitive inference in PWA",
  limitations: {
    modelSize: "Limited by device VRAM",
    performance: "Depends on user hardware",
  };
}
```

**OwnYou Integration:** Already planned for Phase 5 consumer PWA.

#### 6.6.2 Desktop Local LLMs

| Tool | Best For | Integration |
| --- | --- | --- |
| **Ollama** | Server-style local inference | Tauri desktop via localhost API |
| **LM Studio** | User-friendly GUI | Power user option |
| **llama.cpp** | Maximum performance | Backend for other tools |
| **Llamafile** | Single-file distribution | Easy deployment |

### 6.7 OwnYou Private Inference Strategy

#### 6.7.1 Phased Migration Plan

```
┌─────────────────────────────────────────────────────────────────┐
│                OwnYou PRIVATE INFERENCE ROADMAP                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1-2 (Now)                                                 │
│  ─────────────────                                               │
│  • OpenAI/Claude for general inference (with sanitization)       │
│  • Venice AI for privacy-conscious queries                       │
│  • WebLLM exploration for browser-based processing               │
│                                                                  │
│  PHASE 3 (Q2 2025)                                              │
│  ─────────────────                                               │
│  • Phala TEE for sensitive IAB classification                    │
│  • Redpill for multi-model routing                               │
│  • WebLLM for local-first PWA inference                          │
│                                                                  │
│  PHASE 4 (Q3-Q4 2025)                                           │
│  ─────────────────────                                           │
│  • Nillion nilAI for blind compute (medical, financial)          │
│  • Marlin Kalypso for BBS+ ZK proofs                             │
│  • Hyperbolic for cost-optimized batch processing                │
│                                                                  │
│  FUTURE (2026+)                                                  │
│  ─────────────                                                   │
│  • Nesa for critical inference (healthcare missions)             │
│  • Ritual for smart contract AI integration                      │
│  • Full decentralization with user-selected providers            │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.7.2 Provider Selection Logic

```typescript
interface InferenceRouting {
  // Route based on data sensitivity and use case
  selectProvider(query: InferenceQuery): InferenceProvider {
    // Level 1: Maximum privacy (medical, financial, passwords)
    if (query.sensitivity === "critical") {
      return this.preferenceOrder([
        "nillion",      // Blind compute (when available)
        "phala_tee",    // Hardware isolation
        "webllm_local", // Device-local
      ]);
    }

    // Level 2: High privacy (personal emails, transactions)
    if (query.sensitivity === "high") {
      return this.preferenceOrder([
        "phala_tee",
        "webllm_local",
        "venice",       // Zero-retention
        "redpill_tee",
      ]);
    }

    // Level 3: Standard privacy (general queries, IAB classification)
    if (query.sensitivity === "standard") {
      return this.preferenceOrder([
        "webllm_local",
        "venice",
        "redpill",
        "hyperbolic",   // Cost-optimized
        "openai",       // With sanitization
      ]);
    }

    // Level 4: Non-sensitive (public data, general knowledge)
    return this.preferenceOrder([
      "hyperbolic",
      "together",
      "openai",
    ]);
  }
}
```

#### 6.7.3 Cost vs Privacy Trade-offs

| Provider | Privacy Level | Relative Cost | Latency | Best For |
| --- | --- | --- | --- | --- |
| **Nillion** | ★★★★★ | $$$$$ | High | Medical, Financial |
| **Phala TEE** | ★★★★☆ | $$$$ | Medium | Sensitive PII |
| **WebLLM** | ★★★★★ | Free | Variable | User-controlled |
| **Venice** | ★★★☆☆ | $$ | Low | Privacy-conscious |
| **Redpill** | ★★★☆☆ | $$ | Low | Multi-model |
| **Hyperbolic** | ★★☆☆☆ | $ | Low | Batch processing |
| **OpenAI** | ★★☆☆☆ | $$$ | Low | General (sanitized) |

### 6.8 Research Summary & Recommendations

#### 6.8.1 Key Findings

| Finding | Implication for OwnYou |
| --- | --- |
| **TEE is production-ready** | Phala can be integrated NOW for sensitive inference |
| **Blind compute is maturing** | Nillion mainnet (Mar 2025) enables future migration |
| **WebLLM performance is viable** | Browser-based inference is practical for many tasks |
| **Decentralized GPU markets exist** | Cost optimization possible via Hyperbolic |
| **ZKML is still research** | Not ready for production; use TEE instead |

#### 6.8.2 Recommended Actions

| Priority | Action | Timeline |
| --- | --- | --- |
| **P0** | Integrate WebLLM for local inference in PWA | Phase 2 |
| **P1** | Evaluate Phala TEE for sensitive IAB classification | Phase 2-3 |
| **P1** | Test Venice AI as interim private inference | Phase 2 |
| **P2** | Monitor Nillion nilAI for Q3 2025 integration | Phase 4 |
| **P2** | Evaluate Hyperbolic for batch processing costs | Phase 3 |
| **P3** | Research Nesa for healthcare Mission Agents | Future |
| **P3** | Monitor Ritual for BBS+ smart contract integration | Future |

#### 6.8.3 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Nillion delays beyond 2025 | Medium | High | Phala TEE as primary solution |
| TEE hardware availability limited | Low | Medium | Multi-provider fallback (Phala + Marlin) |
| WebLLM performance insufficient | Medium | Low | Server-side inference with sanitization |
| Privacy tech costs prohibitive | Medium | High | Tiered approach based on data sensitivity |

### 6.9 Decentralization Technology Summary

| Technology | Use Case | Status | OwnYou Phase |
| --- | --- | --- | --- |
| **Nillion** | Blind compute for sensitive inference | Mainnet Mar 2025 | Phase 4+ |
| **Phala Network** | TEE-based confidential AI | Production | Phase 2-3 |
| **Marlin Protocol** | Verifiable compute (TEE + ZK) | Production | Phase 3-4 |
| **Venice AI** | Zero-retention private inference | Production | Phase 1-2 |
| **Redpill AI** | Multi-model TEE aggregation | Production | Phase 2-3 |
| **Nesa** | ZKML for critical inference | Research | Future |
| **Hyperbolic** | Decentralized GPU marketplace | Beta | Phase 3 |
| **Ritual** | Off-chain AI ↔ on-chain bridge | Development | Phase 4+ |
| **WebLLM** | Browser-based local inference | Production | Phase 2+ |
| **Lit Protocol** | Programmable key management | Production | Evaluate |
| **Ceramic** | Decentralized data streams | Rejected | N/A (OrbitDB selected) |

### 6.10 LLM Cost Management

OwnYou targets **<$10/user/month** average LLM spend. This section defines enforcement mechanisms to achieve this target.

#### 6.10.1 Budget Policy Interface

```typescript
interface LLMBudgetPolicy {
  // Monthly ceiling per user
  monthly_budget_usd: 10;

  // Per-operation token limits
  operations: {
    ikigai_inference: {
      max_input_tokens: 4000;
      max_output_tokens: 2000;
      max_runs_per_day: 2;
      model_tier: "standard";  // gpt-4o-mini, claude-3-haiku
    };

    mission_agent: {
      max_input_tokens: 3000;
      max_output_tokens: 1500;
      max_tool_calls_per_mission: 10;
      max_missions_per_day: 20;
      model_tier: "standard";
    };

    iab_classification: {
      max_input_tokens: 2000;
      max_output_tokens: 500;
      batch_size: 20;  // Emails per batch
      model_tier: "fast";  // gpt-4o-mini only
    };

    reflection_node: {
      max_input_tokens: 8000;
      max_output_tokens: 2000;
      max_runs_per_day: 1;
      model_tier: "standard";
    };

    embedding_generation: {
      max_tokens_per_batch: 8000;
      max_batches_per_day: 10;
      model: "text-embedding-3-small";
    };
  };

  // Throttling thresholds
  throttling: {
    at_50_percent: "log_warning";
    at_80_percent: "reduce_model_tier";    // Switch to cheaper models
    at_95_percent: "defer_non_urgent";     // Only user-initiated operations
    at_100_percent: "local_only";          // WebLLM or cached responses
  };
}
```

#### 6.10.2 Cost Tracking

```typescript
interface UserLLMUsage {
  user_id: string;
  period: "daily" | "monthly";
  period_start: timestamp;

  usage: {
    total_tokens: number;
    total_cost_usd: number;

    by_operation: {
      [operation: string]: {
        invocations: number;
        tokens: number;
        cost_usd: number;
      };
    };

    by_model: {
      [model: string]: {
        tokens: number;
        cost_usd: number;
      };
    };
  };

  throttle_state: "normal" | "warning" | "reduced" | "deferred" | "local_only";
}

// Store namespace for cost tracking
const LLM_USAGE_NAMESPACE = {
  daily: (userId: string) => ["ownyou.llm_usage.daily", userId],
  monthly: (userId: string) => ["ownyou.llm_usage.monthly", userId],
};
```

#### 6.10.3 Model Tier Definitions

| Tier | Models | Cost/1K input | Cost/1K output | Use Cases |
|------|--------|---------------|----------------|-----------|
| **fast** | gpt-4o-mini | $0.00015 | $0.0006 | IAB classification, simple queries |
| **standard** | gpt-4o-mini, claude-3-haiku | $0.00025 | $0.00125 | Missions, Ikigai, Reflection |
| **quality** | gpt-4o, claude-3.5-sonnet | $0.0025 | $0.01 | Complex reasoning (user-initiated only) |
| **local** | WebLLM (Llama-3-8B) | $0 | $0 | Fallback, offline, budget exceeded |

```typescript
const MODEL_TIERS = {
  fast: {
    models: ["gpt-4o-mini"],
    avg_cost_per_1k: 0.000375,  // Blended input/output
  },
  standard: {
    models: ["gpt-4o-mini", "claude-3-haiku-20240307"],
    avg_cost_per_1k: 0.00075,
  },
  quality: {
    models: ["gpt-4o", "claude-3-5-sonnet-20241022"],
    avg_cost_per_1k: 0.00625,
  },
  local: {
    models: ["webllm/Llama-3-8B-Instruct-q4f32_1"],
    avg_cost_per_1k: 0,
  },
};

const downgradeModelTier = (currentTier: string): string => {
  const downgradeMap = {
    quality: "standard",
    standard: "fast",
    fast: "local",
    local: "local",  // Can't downgrade further
  };
  return downgradeMap[currentTier];
};
```

#### 6.10.4 Budget Enforcement Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM REQUEST FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request → Check Budget → Select Model → Execute → Track Cost   │
│              │                │                                  │
│              ▼                ▼                                  │
│        ┌─────────┐    ┌──────────────┐                          │
│        │ >100%?  │───▶│ Local/Cached │                          │
│        └────┬────┘    └──────────────┘                          │
│             │ No                                                 │
│             ▼                                                    │
│        ┌─────────┐    ┌──────────────┐                          │
│        │ >95%?   │───▶│ Defer if     │                          │
│        └────┬────┘    │ non-urgent   │                          │
│             │ No      └──────────────┘                          │
│             ▼                                                    │
│        ┌─────────┐    ┌──────────────┐                          │
│        │ >80%?   │───▶│ Downgrade    │                          │
│        └────┬────┘    │ model tier   │                          │
│             │ No      └──────────────┘                          │
│             ▼                                                    │
│        Execute with requested model                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
const enforceBudget = async (
  userId: string,
  request: LLMRequest
): Promise<LLMRequest> => {
  const usage = await store.get(LLM_USAGE_NAMESPACE.monthly(userId), "current");
  const budgetUsedPercent = (usage.usage.total_cost_usd / 10) * 100;

  // >100%: Local only
  if (budgetUsedPercent >= 100) {
    return { ...request, model: "webllm/Llama-3-8B-Instruct-q4f32_1", throttled: true };
  }

  // >95%: Defer non-urgent
  if (budgetUsedPercent >= 95 && !request.urgent) {
    throw new DeferredRequestError("Budget nearly exhausted. Request deferred.");
  }

  // >80%: Downgrade model
  if (budgetUsedPercent >= 80) {
    const downgradedTier = downgradeModelTier(request.modelTier);
    const downgradedModel = selectModel(downgradedTier);
    return { ...request, model: downgradedModel, throttled: true };
  }

  // <80%: Normal execution
  return request;
};
```

### 6.11 Error Handling & Resilience

For a system with 6 agents, 4 data sources, P2P sync, and LLM inference, systematic error handling is critical.

#### 6.11.1 Resilience Policy Interface

```typescript
interface ResiliencePolicy {
  // LLM inference failures
  llm_inference: {
    retries: 3;
    backoff: "exponential";  // 1s, 2s, 4s
    fallback_chain: [
      "retry_same_model",
      "downgrade_model",        // gpt-4o → gpt-4o-mini
      "try_alternative_provider", // OpenAI → Anthropic
      "use_cached_response",    // If similar query exists
      "use_local_llm",          // WebLLM fallback
      "graceful_degradation",   // Return partial result
      "user_notification",      // Ask user to retry later
    ];
    timeout_ms: 30000;
  };

  // External API failures (Plaid, SerpAPI, etc.)
  external_apis: {
    circuit_breaker: {
      failure_threshold: 5;      // Failures before opening circuit
      recovery_timeout_ms: 60000; // Time before trying again
      half_open_requests: 2;     // Test requests in half-open state
    };

    per_api_config: {
      plaid: { retries: 3; timeout_ms: 10000; critical: true };
      serpapi: { retries: 2; timeout_ms: 5000; critical: false };
      tripadvisor: { retries: 2; timeout_ms: 5000; critical: false };
      ticketmaster: { retries: 2; timeout_ms: 5000; critical: false };
      google_flights: { retries: 2; timeout_ms: 8000; critical: false };
      yelp: { retries: 2; timeout_ms: 5000; critical: false };
      opentable: { retries: 2; timeout_ms: 5000; critical: false };
    };
  };

  // Sync failures
  sync: {
    connection_retry: {
      attempts: 5;
      backoff: "exponential";
      max_delay_ms: 30000;
    };
    conflict_resolution: "automatic";  // Use CRDT rules
    offline_queue_max: 1000;           // Max pending operations
    conflict_notification: "toast";    // How to notify user
  };

  // Data source sync failures
  data_sources: {
    email_sync: {
      partial_success: true;    // Accept partial results
      min_success_rate: 0.8;    // Fail if <80% emails fetched
      stale_threshold_hours: 24; // Re-fetch if older than 24h
    };
    financial_sync: {
      partial_success: false;   // All or nothing (financial accuracy)
      retry_on_auth_failure: true;
      reauth_prompt: true;      // Ask user to re-authenticate
    };
    calendar_sync: {
      partial_success: true;
      min_success_rate: 0.7;
      stale_threshold_hours: 12;
    };
  };
}
```

#### 6.11.2 Circuit Breaker Implementation

```typescript
type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreaker {
  name: string;
  state: CircuitState;
  failure_count: number;
  last_failure: timestamp;
  last_success: timestamp;
  config: {
    failure_threshold: number;
    recovery_timeout_ms: number;
    half_open_requests: number;
  };
}

class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  async execute<T>(
    name: string,
    operation: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    const breaker = this.getOrCreate(name);

    if (!this.canExecute(breaker)) {
      if (fallback) return fallback();
      throw new CircuitOpenError(name, breaker.last_failure);
    }

    try {
      const result = await withTimeout(operation(), breaker.config.timeout_ms);
      this.onSuccess(breaker);
      return result;
    } catch (error) {
      this.onFailure(breaker, error);
      if (fallback) return fallback();
      throw error;
    }
  }

  private canExecute(breaker: CircuitBreaker): boolean {
    if (breaker.state === "closed") return true;
    if (breaker.state === "open") {
      const timeSinceFailure = Date.now() - breaker.last_failure;
      if (timeSinceFailure > breaker.config.recovery_timeout_ms) {
        breaker.state = "half_open";
        return true;
      }
      return false;
    }
    // half_open: allow limited requests
    return breaker.failure_count < breaker.config.half_open_requests;
  }
}

// Global registry
const circuitBreakers = new CircuitBreakerRegistry();

// Usage in Mission Agent
const searchProducts = async (query: string) => {
  return circuitBreakers.execute(
    "serpapi",
    () => serpAPI.search(query),
    () => cachedSearchResults(query)  // Fallback to cached results
  );
};
```

#### 6.11.3 LLM Fallback Chain

```typescript
async function llmInferenceWithFallback(
  request: LLMRequest
): Promise<LLMResponse> {
  const fallbackChain: Array<() => Promise<LLMResponse>> = [
    // 1. Try original request
    () => callLLM(request),

    // 2. Retry same model (transient failure)
    () => callLLM({ ...request, attempt: 2 }),

    // 3. Downgrade to cheaper model
    () => callLLM({
      ...request,
      model: downgradeModel(request.model),
      attempt: 1,
    }),

    // 4. Try alternative provider
    () => callAlternativeProvider(request),

    // 5. Check cache for similar query
    () => getCachedResponse(request),

    // 6. Use local LLM (WebLLM)
    () => callLocalLLM(request),
  ];

  for (let i = 0; i < fallbackChain.length; i++) {
    try {
      const response = await withTimeout(fallbackChain[i](), 30000);
      if (i > 0) logFallbackSuccess(request, i);
      return response;
    } catch (error) {
      logFallbackAttempt(request, i, error);
      continue;
    }
  }

  // All fallbacks exhausted - graceful degradation
  return gracefulDegradation(request);
}

function gracefulDegradation(request: LLMRequest): LLMResponse {
  const contextSummary = getSummaryFromMemory(request.context);
  return {
    content: `I'm having trouble processing this right now. ` +
             `Here's what I can tell you from your saved data:\n\n` +
             contextSummary,
    degraded: true,
    retry_suggested: true,
    retry_after_seconds: 60,
  };
}
```

#### 6.11.4 Partial Data Handling

```typescript
interface PartialDataPolicy {
  email: {
    min_coverage: 0.5;
    show_warning: true;
    proceed_with_partial: true;
    confidence_penalty: 0.2;
  };
  financial: {
    min_coverage: 0.9;
    show_warning: true;
    proceed_with_partial: false;
    prompt_retry: true;
  };
  calendar: {
    min_coverage: 0.7;
    show_warning: true;
    proceed_with_partial: true;
    confidence_penalty: 0.15;
  };
  browser: {
    min_coverage: 0.3;
    show_warning: false;
    proceed_with_partial: true;
    confidence_penalty: 0.1;
  };
}

const handlePartialData = async (
  dataSource: string,
  fetchedCount: number,
  expectedCount: number
): Promise<PartialDataResult> => {
  const policy = PARTIAL_DATA_POLICIES[dataSource];
  const coverage = fetchedCount / expectedCount;

  if (coverage < policy.min_coverage && !policy.proceed_with_partial) {
    throw new InsufficientDataError(dataSource, coverage, policy.min_coverage);
  }

  return {
    proceed: coverage >= policy.min_coverage || policy.proceed_with_partial,
    warning: policy.show_warning && coverage < 1.0,
    confidence_multiplier: coverage < 1.0 ? (1 - policy.confidence_penalty) : 1.0,
    message: coverage < 1.0
      ? `Using ${Math.round(coverage * 100)}% of available ${dataSource} data`
      : undefined,
  };
};
```

#### 6.11.5 Error Recovery UI States

```typescript
type UserErrorState =
  | { type: "temporary"; message: string; retry_in_seconds: number }
  | { type: "action_required"; message: string; action: UserAction }
  | { type: "degraded"; message: string; capabilities_affected: string[] }
  | { type: "offline"; message: string; available_offline: string[] };

const ERROR_STATES: Record<string, UserErrorState> = {
  llm_rate_limited: {
    type: "temporary",
    message: "AI is busy. Your request will process shortly.",
    retry_in_seconds: 30,
  },
  llm_budget_exceeded: {
    type: "degraded",
    message: "Monthly AI budget reached. Using local processing.",
    capabilities_affected: ["Complex analysis", "Multi-step missions", "Quality recommendations"],
  },
  plaid_reauth_needed: {
    type: "action_required",
    message: "Please reconnect your bank account to continue.",
    action: { label: "Reconnect Bank", action: () => openPlaidLink() },
  },
  email_reauth_needed: {
    type: "action_required",
    message: "Email access expired. Please reconnect.",
    action: { label: "Reconnect Email", action: () => startEmailOAuth() },
  },
  sync_offline: {
    type: "offline",
    message: "You're offline. Some features are limited.",
    available_offline: ["View saved missions", "Browse profile", "Local search", "View earnings history"],
  },
};
```

---

## 7. Publisher/Advertiser SDK & BBS+ Attribution Protocol

### 7.1 End-to-End Attribution Flow

This section describes the complete privacy-preserving attribution system using BBS+ pseudonyms. The flow enables advertisers to track conversions while ensuring users maintain control and receive fair compensation.

#### 7.1.1 Complete Attribution Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 1: AD TARGETING                              │
│                                                                              │
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────────────────┐  │
│  │  User logs   │───▶│ Wallet shares │───▶│  Header Bidding (Prebid.js) │  │
│  │  into site   │    │ pseudonym +   │    │  • Pseudonym (payment addr) │  │
│  │  via OwnYou  │    │ IAB profile   │    │  • IAB segments (selective) │  │
│  └──────────────┘    └───────────────┘    │  • BBS+ proof-of-human      │  │
│                                           └──────────────┬──────────────┘  │
│                                                          │                  │
│                                                          ▼                  │
│                                           ┌─────────────────────────────┐  │
│                                           │  DSPs bid based on profile  │  │
│                                           │  Winner serves ad with      │  │
│                                           │  embedded campaign_ID       │  │
│                                           └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2: TRACKING CONSENT                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      USER'S WALLET PROMPT                            │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  "Nike wants to track your response to this campaign"       │   │   │
│  │  │                                                              │   │   │
│  │  │  Campaign: Summer Running Shoes 2025                         │   │   │
│  │  │  Payment: $0.02 per impression across sites                  │   │   │
│  │  │  Duration: Until you revoke or campaign ends                 │   │   │
│  │  │                                                              │   │   │
│  │  │  [Accept]                              [Decline]             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  User Decision:                                                              │
│  • DECLINE → No tracking, ad still shown, no payment                        │
│  • ACCEPT  → Proceed to Phase 3                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼ (if accepted)
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 3: ESCROW DEPOSIT                              │
│                                                                              │
│  ┌──────────────┐    ┌───────────────────────────────────────────────────┐ │
│  │  Advertiser  │───▶│            ESCROW SMART CONTRACT                  │ │
│  │  deposits    │    │  ┌─────────────────────────────────────────────┐ │ │
│  │  campaign    │    │  │  Campaign: nike_summer_2025                 │ │ │
│  │  budget      │    │  │  Budget: $10,000 USDC                       │ │ │
│  │              │    │  │  Rate: $0.02 per tracked impression         │ │ │
│  │  ($10,000)   │    │  │  Status: ACTIVE                             │ │ │
│  └──────────────┘    │  └─────────────────────────────────────────────┘ │ │
│                      └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: TRACKING ID GENERATION                           │
│                                                                              │
│  User's wallet generates campaign-specific tracking_ID:                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  tracking_ID = hash_to_curve_g1(campaign_ID) * nym_secret           │   │
│  │                                                                      │   │
│  │  Where:                                                              │   │
│  │  • campaign_ID = "nike_summer_2025" (from ad creative)               │   │
│  │  • nym_secret = prover_nym + signer_nym_entropy (user's secret)      │   │
│  │  • hash_to_curve_g1 = BLS12-381 hash-to-curve function               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Properties of this tracking_ID:                                             │
│  ✓ Deterministic: Same user + same campaign = same tracking_ID always       │
│  ✓ Unlinkable: Different campaigns = different tracking_IDs (can't correlate)│
│  ✓ User-controlled: Only user can generate (requires nym_secret)            │
│  ✓ Verifiable: ZKP proves correct derivation without revealing nym_secret   │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 5: CROSS-SITE TRACKING & PAYMENT                     │
│                                                                              │
│  User visits Publisher B, C, D... (different sites in ad network)            │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Publisher B  │    │ Publisher C  │    │ Publisher D  │                  │
│  │              │    │              │    │              │                  │
│  │ Nike ad      │    │ Nike ad      │    │ Nike ad      │                  │
│  │ appears      │    │ appears      │    │ appears      │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  For each impression:                                               │    │
│  │  1. Wallet detects same campaign_ID                                 │    │
│  │  2. Wallet regenerates same tracking_ID (deterministic)             │    │
│  │  3. Wallet shares tracking_ID with advertiser                       │    │
│  │  4. Smart contract debits $0.02 from escrow → user's wallet         │    │
│  │  5. Advertiser logs impression (can now correlate across sites)     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  User earnings accumulate: $0.02 × N impressions                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 6: CONVERSION & ATTRIBUTION                       │
│                                                                              │
│  User visits advertiser's site and converts (purchase, signup, etc.)         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    USER-INITIATED CONVERSION                         │   │
│  │                                                                      │   │
│  │  1. User completes purchase on nike.com                              │   │
│  │  2. User's wallet prompts: "Claim attribution reward?"               │   │
│  │  3. User accepts → Wallet generates:                                 │   │
│  │     • Same tracking_ID (proves "I saw your ads")                     │   │
│  │     • ZKP of tracking_ID ownership                                   │   │
│  │     • Conversion evidence (ZK proof of purchase, or merchant sig)    │   │
│  │  4. Advertiser verifies → Attribution confirmed                      │   │
│  │  5. Conversion bonus released from escrow                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 7.1.2 Why This Architecture Preserves Privacy

| Property | How It's Achieved |
|----------|-------------------|
| **No cross-campaign tracking** | Different campaign_IDs produce mathematically unlinkable tracking_IDs |
| **User controls tracking** | User must accept; can revoke anytime |
| **Fair compensation** | Per-impression payment, not flat fee |
| **Advertiser gets attribution** | Same tracking_ID appears at impression and conversion |
| **No central tracking database** | Advertiser only sees their own campaign's tracking_IDs |

#### 7.1.3 Attack Surface Analysis

| Attacker | What They See | Can They Track Cross-Campaign? |
|----------|---------------|-------------------------------|
| Publisher A | User's pseudonym + IAB profile | No - doesn't see tracking_IDs |
| Publisher B | User's pseudonym + tracking_ID (campaign X) | No - can't link to Publisher A |
| Advertiser X | tracking_ID for their campaign only | Yes, but only their campaign (by design) |
| Advertiser Y | tracking_ID for different campaign | No - different tracking_IDs, unlinkable |
| Colluding advertisers | Their respective tracking_IDs | No - math prevents correlation |
| Ad exchange / SSP | Multiple tracking_IDs in transit | No - without nym_secret, can't link them |

**Critical Security Dependency:** User's `nym_secret` must remain secure. Compromise = all tracking_IDs derivable.

#### 7.1.4 Agency/DSP Sharing Protection

**Problem:** An agency or DSP could share a user's tracking_ID with multiple end advertisers, enabling tracking beyond the consented campaign.

**Mitigation Layer 1 (Contractual):**
- Terms of service bind advertiser to use tracking_ID only for the specified campaign_ID
- Violation = ban from OwnYou network + potential legal action
- Audit trail: all tracking_ID queries logged on-chain

**Mitigation Layer 2 (Technical - Advertiser-Bound Verification):**

To prevent agencies/DSPs from sharing tracking_IDs across advertisers, we cryptographically bind the verification capability to a specific advertiser's key:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ADVERTISER-BOUND TRACKING_ID                              │
│                                                                              │
│  Standard tracking_ID (can be shared):                                      │
│    tracking_ID = hash_to_curve_g1(campaign_ID) * nym_secret                 │
│                                                                              │
│  Advertiser-bound tracking_ID (cannot be shared):                           │
│    bound_tracking_ID = hash_to_curve_g1(campaign_ID || advertiser_pubkey)   │
│                        * nym_secret                                          │
│                                                                              │
│  Key difference:                                                             │
│  • The advertiser's public key is baked into the tracking_ID derivation     │
│  • Only this advertiser can verify the ZKP (needs matching private key)     │
│  • Sharing with another advertiser = useless (they can't verify it)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// Enhanced tracking_ID generation with advertiser binding
function generateBoundTrackingID(
  nymSecret: Scalar,
  campaignId: string,
  advertiserPubKey: G1Point      // Advertiser's registered public key
): G1Point {
  // Combine campaign_ID with advertiser identity
  const bindingInput = `${campaignId}||${advertiserPubKey.toHex()}`;
  const boundPoint = hashToCurveG1(bindingInput);

  return boundPoint.multiply(nymSecret);
}

// Verification requires advertiser's private key
async function verifyBoundTrackingID(
  boundTrackingId: G1Point,
  campaignId: string,
  advertiserPrivKey: Scalar,      // Only the real advertiser has this
  zkProof: BBS_Proof
): Promise<boolean> {
  // Reconstruct expected binding point
  const advertiserPubKey = G1.generator().multiply(advertiserPrivKey);
  const bindingInput = `${campaignId}||${advertiserPubKey.toHex()}`;
  const expectedBindingPoint = hashToCurveG1(bindingInput);

  // Verify the ZKP against the expected binding
  return verifyBBSProofWithBinding(zkProof, boundTrackingId, expectedBindingPoint);
}
```

**Advertiser Key Registration:**

```typescript
interface AdvertiserKeyManagement {
  /**
   * Register advertiser's public key with OwnYou
   * Required before creating campaigns with binding protection
   */
  registerPublicKey(request: {
    advertiserId: string;
    publicKey: G1Point;
    keyProof: SchnorrProof;        // Proves ownership of private key
  }): Promise<{
    keyId: string;
    registeredAt: number;
    expiresAt: number;             // Keys must be rotated annually
  }>;

  /**
   * Create campaign with advertiser binding
   */
  createBoundCampaign(campaign: {
    name: string;
    advertiserId: string;
    keyId: string;                 // Which registered key to bind to
    bindingLevel: 'standard' | 'advertiser_bound';
    // ... other campaign fields
  }): Promise<{ campaignId: string }>;
}
```

**Trade-offs:**

| Aspect | Standard tracking_ID | Advertiser-Bound tracking_ID |
|--------|---------------------|------------------------------|
| **Verification** | Any party can verify | Only bound advertiser can verify |
| **Agency use** | Agency can share with clients | Agency cannot share (useless to others) |
| **Key management** | None required | Advertiser must manage keys |
| **Recovery** | N/A | Key loss = campaign data inaccessible |
| **Recommended for** | Single-brand advertisers | Agencies managing multiple brands |

**Phased Rollout:**
- **MVP:** Contractual protection only (Layer 1)
- **v1.1:** Optional advertiser binding for enterprise customers
- **v2.0:** Default advertiser binding for agency accounts

### 7.2 BBS+ Pseudonym Mechanics

#### 7.2.1 Identity Setup (One-Time)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER IDENTITY CREATION                               │
│                                                                              │
│  Step 1: User generates prover_nym (random scalar on BLS12-381)             │
│          prover_nym = random_scalar()                                        │
│                                                                              │
│  Step 2: User sends blinding commitment to OwnYou Identity Service          │
│          commitment = g1 * prover_nym  (hides actual value)                  │
│                                                                              │
│  Step 3: Identity Service adds entropy and signs                            │
│          signer_nym_entropy = random_scalar()                                │
│          signature = BBS_Sign(commitment, signer_nym_entropy)                │
│                                                                              │
│  Step 4: User computes final nym_secret                                     │
│          nym_secret = prover_nym + signer_nym_entropy                        │
│                                                                              │
│  Result: User has nym_secret that:                                          │
│          • Only user knows (prover_nym is secret)                            │
│          • Is certified by OwnYou (signature proves legitimacy)              │
│          • Cannot be linked to user's real identity                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 7.2.2 Tracking ID Generation

```typescript
// Campaign-specific tracking ID (unlinkable across campaigns)
function generateTrackingID(
  nymSecret: Scalar,           // User's secret (prover_nym + signer_nym_entropy)
  campaignId: string           // e.g., "nike_summer_2025"
): G1Point {
  // Hash campaign ID to a point on the BLS12-381 G1 curve
  const campaignPoint = hashToCurveG1(campaignId);

  // Multiply by user's secret scalar
  // This is a one-way operation: knowing tracking_ID doesn't reveal nym_secret
  const trackingId = campaignPoint.multiply(nymSecret);

  return trackingId;
}

// Key properties:
// 1. Deterministic: Same inputs always produce same output
// 2. Unlinkable: tracking_ID_A and tracking_ID_B cannot be correlated
//    (without knowing nym_secret, can't prove they came from same user)
// 3. Unforgeable: Can't generate valid tracking_ID without nym_secret
```

#### 7.2.3 Zero-Knowledge Proof of Tracking ID

When sharing a tracking_ID, the user's wallet also generates a ZKP proving:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ZKP PROVES (without revealing nym_secret):            │
│                                                                              │
│  1. "I know a nym_secret such that:"                                        │
│     tracking_ID = hash_to_curve_g1(campaign_ID) * nym_secret                 │
│                                                                              │
│  2. "My nym_secret is legitimately signed by OwnYou Identity Service"       │
│     (proves user is real, not a bot)                                         │
│                                                                              │
│  3. "I control this nym_secret"                                             │
│     (proves ownership, prevents replay attacks)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 7.2.3.1 Cross-Publisher Unlinkability Proof Structure

A critical privacy property is that tracking_IDs cannot be linked to the publisher-visible pseudonym. This section explains the cryptographic structure that guarantees unlinkability:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UNLINKABILITY GUARANTEE                               │
│                                                                              │
│  Publisher sees (during SSO login):                                         │
│    pseudonym = g1 * nym_secret                                              │
│    (This is the user's payment address derivation base)                      │
│                                                                              │
│  Advertiser sees (after tracking consent):                                  │
│    tracking_ID = hash_to_curve_g1(campaign_ID) * nym_secret                 │
│                                                                              │
│  Key insight: These two values share the same nym_secret, BUT:              │
│    • pseudonym uses generator point g1                                       │
│    • tracking_ID uses hash_to_curve_g1(campaign_ID) as base point           │
│                                                                              │
│  Without knowing nym_secret, it is computationally infeasible to:           │
│    1. Link pseudonym to tracking_ID (Discrete Log Problem)                  │
│    2. Link tracking_ID_A to tracking_ID_B (DDH assumption)                  │
│    3. Derive nym_secret from either value                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Mathematical Proof of Unlinkability:**

```typescript
/**
 * The security relies on the Decisional Diffie-Hellman (DDH) assumption
 * on the BLS12-381 G1 group.
 *
 * Given:
 *   pseudonym = g1 * s           (where s = nym_secret)
 *   tracking_ID = H(c) * s       (where H = hash_to_curve_g1, c = campaign_ID)
 *
 * An attacker sees: (g1, pseudonym, H(c), tracking_ID)
 * This is equivalent to: (g1, g1*s, H(c), H(c)*s)
 *
 * By DDH assumption, this is indistinguishable from:
 *   (g1, g1*s, H(c), H(c)*r)     where r is random
 *
 * Therefore, the attacker cannot determine if tracking_ID and pseudonym
 * share the same secret exponent.
 */

// What each party can and cannot learn:
interface UnlinkabilityGuarantees {
  publisher: {
    sees: ['pseudonym', 'IAB_segments', 'proof_of_human'];
    cannotDerive: ['nym_secret', 'any_tracking_ID'];
    cannotLink: 'pseudonym to any tracking_ID';
  };

  advertiser: {
    sees: ['tracking_ID', 'ZKP', 'campaign_ID'];
    cannotDerive: ['nym_secret', 'pseudonym', 'other_tracking_IDs'];
    cannotLink: 'tracking_ID to pseudonym or other campaigns';
  };

  colludingAdvertisers: {
    see: ['tracking_ID_A', 'tracking_ID_B'];  // Different campaigns
    cannotProve: 'tracking_ID_A and tracking_ID_B belong to same user';
    reason: 'DDH assumption - no efficient algorithm exists';
  };

  publisherAdvertiserCollusion: {
    see: ['pseudonym', 'tracking_ID'];
    cannotProve: 'pseudonym and tracking_ID belong to same user';
    reason: 'Different base points, DDH assumption holds';
  };
}
```

**ZKP Structure for Proving Tracking ID Ownership:**

```typescript
interface BBS_TrackingID_Proof {
  // Public inputs (visible to verifier)
  publicInputs: {
    trackingId: G1Point;           // The tracking_ID being proven
    campaignId: string;            // Campaign context
    identityServicePubKey: G2Point; // OwnYou's public key (for signature verification)
    nonce: string;                 // Prevents replay attacks
    timestamp: number;             // Freshness guarantee
  };

  // Proof components (cryptographic commitments)
  proofComponents: {
    // Schnorr-like proof of knowledge of nym_secret
    commitment_r: G1Point;         // r * H(campaign_ID)
    response_s: Scalar;            // s = r + c * nym_secret (c = challenge)

    // BBS+ signature proof (proves nym_secret is signed)
    signatureProof: {
      A_prime: G1Point;            // Randomized signature component
      A_bar: G1Point;              // Blinded commitment
      d: G1Point;                  // Auxiliary commitment
      proofC: Scalar;              // Challenge
      proofS_sk: Scalar;           // Response for signer's contribution
      proofS_r: Scalar;            // Response for randomization
    };

    // Ownership proof (proves user controls the key)
    ownershipProof: {
      commitment: G1Point;         // Commitment to user's private key
      response: Scalar;            // Response proving knowledge
    };
  };

  // Metadata
  metadata: {
    proofVersion: '1.0';
    curveType: 'BLS12-381';
    hashFunction: 'SHA-256';
    proofGenerationTime: number;   // For performance monitoring
  };
}
```

**Verification Algorithm (Simplified):**

```typescript
async function verifyTrackingIDProof(proof: BBS_TrackingID_Proof): Promise<boolean> {
  const { publicInputs, proofComponents } = proof;

  // 1. Reconstruct the campaign point
  const campaignPoint = hashToCurveG1(publicInputs.campaignId);

  // 2. Verify Schnorr-like proof of nym_secret knowledge
  //    Check: commitment_r + c * tracking_ID = response_s * campaignPoint
  const challenge = hashToScalar(
    publicInputs.trackingId,
    proofComponents.commitment_r,
    publicInputs.nonce
  );

  const lhs = proofComponents.commitment_r.add(
    publicInputs.trackingId.multiply(challenge)
  );
  const rhs = campaignPoint.multiply(proofComponents.response_s);

  if (!lhs.equals(rhs)) {
    return false;  // User doesn't know nym_secret
  }

  // 3. Verify BBS+ signature proof
  //    Proves nym_secret was signed by OwnYou Identity Service
  const signatureValid = await verifyBBSSignatureProof(
    proofComponents.signatureProof,
    publicInputs.identityServicePubKey
  );

  if (!signatureValid) {
    return false;  // nym_secret not properly issued
  }

  // 4. Verify ownership proof
  //    Proves user controls the private key that generated nym_secret
  const ownershipValid = verifyOwnershipProof(
    proofComponents.ownershipProof,
    publicInputs.trackingId
  );

  if (!ownershipValid) {
    return false;  // User doesn't own this identity
  }

  // 5. Check freshness (prevent replay)
  const now = Date.now();
  if (now - publicInputs.timestamp > 300000) {  // 5 minute window
    return false;  // Proof too old
  }

  return true;  // All checks passed
}
```

**Why Publishers and Advertisers Cannot Collude:**

Even if a publisher and advertiser share data:
1. **Publisher knows:** `pseudonym = g1 * nym_secret`
2. **Advertiser knows:** `tracking_ID = H(campaign_ID) * nym_secret`

To link these, they would need to solve:
```
Given: (g1, pseudonym, H(campaign_ID), tracking_ID)
Determine: Do pseudonym and tracking_ID share the same discrete log?
```

This is the **Decisional Diffie-Hellman (DDH)** problem, which is believed to be computationally hard on BLS12-381. No efficient algorithm is known.

#### 7.2.4 Verification Strategies

| Verification Type | Speed | When to Use |
|-------------------|-------|-------------|
| **Fast Path** | < 1ms | Retargeting decisions during RTB |
| **Bloom Filter Path** | < 0.1ms | High-volume campaign membership testing |
| **Witness-Cached Path** | 5-20ms | Recurring user re-verification |
| **Complete Path** | 50-200ms | Conversion verification, payment release |

**Fast Path Implementation (Hash Cache):**
```typescript
// After first verification, advertiser caches the tracking_ID
const knownTrackingIds = new Map<string, CampaignData>();

function fastPathVerify(trackingId: string, campaignId: string): boolean {
  const cacheKey = hash(campaignId + trackingId);
  return knownTrackingIds.has(cacheKey);
}
```

**Bloom Filter Path Implementation (Large Campaigns):**

For campaigns with millions of tracking_IDs, Bloom filters provide constant-time membership testing with minimal memory:

```typescript
interface BloomFilterVerification {
  /**
   * Bloom filter for O(1) "definitely not in campaign" checks
   * False positives possible (0.01%), false negatives impossible
   */
  campaignBloomFilters: Map<string, BloomFilter>;

  /**
   * Initialize Bloom filter for a campaign
   * Size determined by expected number of tracking_IDs
   */
  initializeCampaignFilter(campaignId: string, expectedUsers: number): void {
    // Size for 0.01% false positive rate
    const bitsPerElement = 14.4;  // ln(0.0001) / ln(2)^2
    const filterSize = Math.ceil(expectedUsers * bitsPerElement);
    const numHashes = 10;  // Optimal for this false positive rate

    this.campaignBloomFilters.set(campaignId, new BloomFilter(filterSize, numHashes));
  }

  /**
   * Add verified tracking_ID to Bloom filter
   * Called after successful Complete Path verification
   */
  addToFilter(campaignId: string, trackingId: string): void {
    const filter = this.campaignBloomFilters.get(campaignId);
    filter?.add(hash(trackingId));
  }

  /**
   * Ultra-fast membership test (< 0.1ms)
   * Returns: true = "maybe in campaign", false = "definitely NOT in campaign"
   */
  mightBeInCampaign(campaignId: string, trackingId: string): boolean {
    const filter = this.campaignBloomFilters.get(campaignId);
    return filter?.test(hash(trackingId)) ?? false;
  }
}

// Usage in retargeting flow
async function retargetingDecision(trackingId: string, campaignId: string): Promise<boolean> {
  // Step 1: Bloom filter pre-screen (< 0.1ms)
  if (!bloomFilter.mightBeInCampaign(campaignId, trackingId)) {
    return false;  // Definitely not a known user - skip retargeting
  }

  // Step 2: Fast path verification (< 1ms)
  if (fastPathVerify(trackingId, campaignId)) {
    return true;  // Known user - proceed with retargeting
  }

  // Step 3: Bloom filter false positive - need complete verification
  // This only happens 0.01% of the time
  return completePathVerify(trackingId, campaignId, zkProof);
}
```

**Witness Caching Path (Recurring Users):**

For users who return multiple times, caching ZKP verification witnesses provides 5-10x speedup:

```typescript
interface WitnessCaching {
  /**
   * Cache structure for ZKP verification witnesses
   * Witnesses are intermediate values that speed up re-verification
   */
  witnessCache: Map<string, {
    campaignPoint: G1Point;        // hash_to_curve_g1(campaign_ID) - expensive to compute
    pairingPrecompute: GT;         // Pairing precomputation for BBS+ verification
    lastVerified: number;          // Timestamp of last verification
    verificationCount: number;     // How many times verified (for analytics)
  }>;

  /**
   * Cache witness after first complete verification
   */
  cacheWitness(trackingId: string, campaignId: string, witness: VerificationWitness): void {
    const cacheKey = hash(campaignId + trackingId);
    this.witnessCache.set(cacheKey, {
      campaignPoint: witness.campaignPoint,
      pairingPrecompute: witness.pairingPrecompute,
      lastVerified: Date.now(),
      verificationCount: 1
    });
  }

  /**
   * Re-verify using cached witness (5-10x faster)
   */
  async verifyWithCachedWitness(
    trackingId: G1Point,
    campaignId: string,
    zkProof: BBS_Proof
  ): Promise<boolean> {
    const cacheKey = hash(campaignId + trackingId.toHex());
    const cached = this.witnessCache.get(cacheKey);

    if (!cached) {
      // No cached witness - fall back to complete path
      return this.completePathWithWitnessCaching(trackingId, campaignId, zkProof);
    }

    // Use cached precomputation (skips expensive hash_to_curve and pairing setup)
    const proofValid = await verifyBBSProofWithWitness(
      zkProof,
      trackingId,
      cached.campaignPoint,
      cached.pairingPrecompute
    );

    if (proofValid) {
      cached.lastVerified = Date.now();
      cached.verificationCount++;
    }

    return proofValid;
  }

  /**
   * Periodic cleanup of stale witnesses
   */
  cleanupStaleWitnesses(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, witness] of this.witnessCache) {
      if (now - witness.lastVerified > maxAgeMs) {
        this.witnessCache.delete(key);
      }
    }
  }
}
```

**Performance Comparison:**

| Path | Time | Memory per Campaign | Use Case |
|------|------|---------------------|----------|
| Bloom Filter | < 0.1ms | ~2MB for 1M users | Pre-screening, negative confirmation |
| Hash Cache | < 1ms | ~100MB for 1M users | Positive confirmation |
| Witness Cache | 5-20ms | ~500B per user | Recurring user verification |
| Complete Path | 50-200ms | N/A | First-time verification, conversions |

**Recommended Verification Pipeline:**

```typescript
async function optimizedVerificationPipeline(
  trackingId: G1Point,
  campaignId: string,
  zkProof: BBS_Proof,
  context: 'retargeting' | 'impression' | 'conversion'
): Promise<VerificationResult> {

  // 1. Bloom filter pre-screen (always - < 0.1ms)
  if (!bloomFilter.mightBeInCampaign(campaignId, trackingId.toHex())) {
    return { verified: false, path: 'bloom_negative', latency: 0.1 };
  }

  // 2. Hash cache for known users (< 1ms)
  if (hashCache.has(campaignId, trackingId)) {
    if (context === 'retargeting' || context === 'impression') {
      return { verified: true, path: 'hash_cache', latency: 0.5 };
    }
    // Conversions always need fresh verification (but can use witness cache)
  }

  // 3. Witness cache for recurring users (5-20ms)
  if (witnessCache.has(campaignId, trackingId)) {
    const result = await witnessCache.verifyWithCachedWitness(trackingId, campaignId, zkProof);
    return { verified: result, path: 'witness_cache', latency: 15 };
  }

  // 4. Complete path for new users (50-200ms)
  const result = await completePathVerify(trackingId, campaignId, zkProof);

  // Cache for future verifications
  if (result) {
    hashCache.add(campaignId, trackingId);
    bloomFilter.addToFilter(campaignId, trackingId.toHex());
    witnessCache.cacheWitness(trackingId.toHex(), campaignId, extractWitness(zkProof));
  }

  return { verified: result, path: 'complete', latency: 100 };
}
```

**Complete Path Implementation:**
```typescript
async function completePathVerify(
  trackingId: G1Point,
  campaignId: string,
  zkProof: BBS_Proof
): Promise<boolean> {
  // 1. Verify the ZKP (computationally intensive)
  const proofValid = await verifyBBSProof(zkProof, trackingId, campaignId);

  // 2. Check campaign is active and has escrow funds
  const campaignActive = await checkEscrowBalance(campaignId);

  // 3. Check tracking_ID not revoked by user
  const notRevoked = await checkRevocationList(trackingId);

  return proofValid && campaignActive && notRevoked;
}
```

#### 7.2.5 Revocation Mechanism

Users can revoke tracking consent at any time. The revocation system ensures:
- **Immediate effect**: No new impressions logged after revocation
- **Privacy-preserving**: Revocation itself doesn't reveal user identity
- **Auditable**: Revocations are logged for dispute resolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REVOCATION ARCHITECTURE                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        USER'S WALLET                                 │   │
│  │                                                                      │   │
│  │  Active Tracking Consents:                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  Nike Summer 2025        [Revoke]  Earned: $1.24             │  │   │
│  │  │  Starbucks Rewards       [Revoke]  Earned: $0.48             │  │   │
│  │  │  Amazon Prime Day        [Revoke]  Earned: $2.10             │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  On [Revoke] click:                                                 │   │
│  │  1. Generate revocation_token = hash(tracking_ID || timestamp)      │   │
│  │  2. Sign with user's private key                                    │   │
│  │  3. Publish to OwnYou Revocation Service                            │   │
│  │  4. Remove tracking consent from local storage                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                            │                                │
│                                            ▼                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   OWNYOU REVOCATION SERVICE                          │   │
│  │                                                                      │   │
│  │  • Maintains Bloom filter of revoked tracking_IDs per campaign      │   │
│  │  • Bloom filter enables O(1) revocation check without revealing     │   │
│  │    the full list of revoked IDs                                     │   │
│  │  • Advertisers query this service during verification               │   │
│  │  • Revocation propagates within 60 seconds globally                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                            │                                │
│                                            ▼                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      ADVERTISER IMPACT                               │   │
│  │                                                                      │   │
│  │  After revocation:                                                  │   │
│  │  • checkRevocationList(trackingId) returns true                     │   │
│  │  • All verification paths fail for this tracking_ID                 │   │
│  │  • No new impressions or conversions accepted                       │   │
│  │  • Existing impression data retained for billing (past events)      │   │
│  │  • Future re-consent generates NEW tracking_ID (unlinkable)         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Revocation API:**

```typescript
interface RevocationService {
  /**
   * User revokes consent for a specific campaign
   * Called by user's wallet
   */
  revokeConsent(request: {
    trackingId: string;
    campaignId: string;
    revocationToken: string;       // hash(tracking_ID || timestamp)
    userSignature: Ed25519Signature;
    reason?: 'user_request' | 'campaign_ended' | 'fraud_detected';
  }): Promise<{
    success: boolean;
    effectiveTimestamp: number;    // When revocation takes effect
    finalEarnings: number;         // Total earned before revocation
  }>;

  /**
   * Check if a tracking_ID has been revoked
   * Called by advertisers during verification
   */
  checkRevocation(request: {
    trackingId: string;
    campaignId: string;
  }): Promise<{
    revoked: boolean;
    revokedAt?: number;
  }>;

  /**
   * Bulk revocation check using Bloom filter
   * For high-volume advertisers
   */
  getRevocationBloomFilter(campaignId: string): Promise<{
    bloomFilter: Uint8Array;
    lastUpdated: number;
    falsePositiveRate: number;     // Typically 0.01%
  }>;
}

// Revocation storage in user's wallet
interface WalletRevocationState {
  activeConsents: Map<string, {    // campaignId → consent data
    trackingId: string;
    consentedAt: number;
    impressionCount: number;
    totalEarnings: number;
  }>;

  revokedConsents: Map<string, {   // campaignId → revocation data
    trackingId: string;            // Kept for dispute resolution
    revokedAt: number;
    finalEarnings: number;
    revocationToken: string;
  }>;
}
```

**Re-consent After Revocation:**

If a user later wants to re-consent to a previously revoked campaign:
1. A **new tracking_ID** is generated (different campaign context or timestamp salt)
2. The new tracking_ID is **cryptographically unlinkable** to the old one
3. Advertiser sees this as a "new user" - no continuity of tracking history
4. This prevents "revoke-and-spy" attacks where advertiser could correlate before/after

### 7.3 Publisher SDK

#### 7.3.1 Integration Overview

Publishers integrate OwnYou to enable privacy-preserving ad targeting and earn revenue share.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PUBLISHER INTEGRATION                                │
│                                                                              │
│  1. Add OwnYou SDK to site                                                  │
│  2. Replace/augment existing SSO with "Login with OwnYou"                   │
│  3. Configure Prebid.js adapter                                              │
│  4. Receive revenue share on each impression                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 7.3.2 Publisher SDK API

```typescript
interface OwnYouPublisherSDK {
  /**
   * Initialize SDK with publisher credentials
   */
  init(config: {
    publisherId: string;
    siteId: string;
    testMode?: boolean;
  }): void;

  /**
   * Trigger OwnYou SSO login
   * Returns pseudonym (for payment routing) and consented IAB segments
   */
  loginWithOwnYou(): Promise<{
    pseudonym: string;              // User's payment address derivable from this
    segments: IABSegment[];         // User-consented segments for targeting
    proofOfHuman: BBS_Signature;    // Proves user is real (anti-bot)
  }>;

  /**
   * Get Prebid.js adapter for header bidding integration
   */
  getPrebidAdapter(): PrebidBidAdapter;

  /**
   * Show consent modal for attribute selection
   * User chooses which IAB segments to share with this publisher
   */
  showConsentModal(options: {
    requestedSegments: IABCategory[];
    explanation: string;
  }): Promise<{
    granted: IABCategory[];
    denied: IABCategory[];
  }>;

  /**
   * Revenue event callback
   * Called when impression generates revenue for publisher
   */
  onRevenue(callback: (event: {
    impressionId: string;
    grossRevenue: number;      // Total bid amount
    publisherShare: number;    // Publisher's 20%
    userShare: number;         // User's 70%
    currency: 'USD' | 'USDC';
  }) => void): void;
}
```

#### 7.3.3 Prebid.js Integration

```typescript
// OwnYou Prebid Adapter
const ownYouAdapter: PrebidBidAdapter = {
  code: 'ownyou',
  supportedMediaTypes: ['banner', 'video', 'native'],

  buildRequests(bidRequests, bidderRequest) {
    const ownYouUser = window.ownYou?.getCurrentUser();

    if (!ownYouUser) {
      // User not logged in - proceed without OwnYou data
      return buildStandardRequest(bidRequests, bidderRequest);
    }

    // Inject OwnYou data into bid request
    return {
      method: 'POST',
      url: OWNYOU_BID_ENDPOINT,
      data: {
        ...buildStandardRequest(bidRequests, bidderRequest),
        ownyou: {
          pseudonym: ownYouUser.pseudonym,
          segments: ownYouUser.segments,
          proofOfHuman: ownYouUser.proofOfHuman,
          // Publisher can request tracking - user will be prompted
          trackingRequest: bidderRequest.trackingEnabled ? {
            paymentPerImpression: 0.02,
          } : null
        }
      }
    };
  },

  interpretResponse(serverResponse) {
    // Standard Prebid response handling
    // Plus: extract tracking consent status if applicable
  }
};
```

### 7.4 Advertiser SDK

#### 7.4.1 Integration Overview

Advertisers integrate OwnYou to request user consent for tracking and receive privacy-preserving attribution.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ADVERTISER INTEGRATION                                │
│                                                                              │
│  1. Register campaign with OwnYou network                                   │
│  2. Deposit escrow for tracking payments                                     │
│  3. Embed campaign_ID in ad creatives                                        │
│  4. Receive tracking_IDs for consenting users                                │
│  5. Log conversions with ZK proof verification                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 7.4.2 Advertiser SDK API

```typescript
interface OwnYouAdvertiserSDK {
  /**
   * Initialize with advertiser credentials
   */
  init(config: {
    advertiserId: string;
    apiKey: string;
    testMode?: boolean;
  }): void;

  /**
   * Register a new campaign
   * Returns campaign_ID to embed in ad creatives
   */
  createCampaign(campaign: {
    name: string;
    paymentPerImpression: number;    // USD, paid to user per tracked impression
    conversionBonus: number;         // USD, bonus paid on conversion
    budget: number;                  // Total campaign budget (USD)
    startDate: Date;
    endDate: Date;
  }): Promise<{
    campaignId: string;              // Embed this in ad creatives
    escrowAddress: string;           // Deposit funds here
  }>;

  /**
   * Deposit funds to campaign escrow
   */
  depositEscrow(campaignId: string, amount: number): Promise<{
    transactionHash: string;
    newBalance: number;
  }>;

  /**
   * Called when tracking_ID is received from user
   * SDK handles verification (fast path for retargeting, complete for new)
   */
  onTrackingId(callback: (event: {
    trackingId: string;
    campaignId: string;
    publisherId: string;
    zkProof: BBS_Proof;
    isNewUser: boolean;              // First time seeing this tracking_ID?
    verificationPath: 'fast' | 'complete';
  }) => void): void;

  /**
   * Log a conversion event
   * User initiates this from their wallet with ZK evidence
   */
  verifyConversion(conversion: {
    trackingId: string;
    campaignId: string;
    conversionType: 'purchase' | 'signup' | 'lead' | 'app_install';
    zkProof: BBS_Proof;              // Proves same user who saw ads
    evidence: ConversionEvidence;    // ZK proof of purchase or merchant sig
  }): Promise<{
    verified: boolean;
    attributionChain: Impression[];  // All impressions from this tracking_ID
    paymentReleased: number;         // Conversion bonus amount
  }>;

  /**
   * Get attribution report for campaign
   */
  getAttributionReport(options: {
    campaignId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalImpressions: number;
    uniqueUsers: number;             // Count of unique tracking_IDs
    conversions: number;
    conversionRate: number;
    totalSpend: number;
    costPerConversion: number;
  }>;
}
```

#### 7.4.3 Conversion Evidence Types

```typescript
type ConversionEvidence =
  | ZKPurchaseProof      // Zero-knowledge proof of purchase (privacy-preserving)
  | MerchantAttestation  // Merchant signs transaction hash
  | OnChainProof;        // For crypto purchases, transaction on-chain

interface ZKPurchaseProof {
  type: 'zk_purchase';
  // Proves: "I made a purchase of at least $X from merchant Y"
  // Without revealing: exact amount, items, payment method
  proof: SNARKProof;
  publicInputs: {
    merchantId: string;
    minValue: number;
    timestamp: number;
  };
}

interface MerchantAttestation {
  type: 'merchant_attestation';
  merchantId: string;
  transactionHash: string;           // Hash of transaction (not details)
  value: number;
  merchantSignature: Ed25519Signature;
}

interface OnChainProof {
  type: 'onchain';
  chain: 'solana' | 'ethereum' | 'base';
  transactionId: string;
  // Verifier can check on-chain directly
}

interface OfflineConversionProof {
  type: 'offline';
  method: 'qr_scan' | 'nfc_tap' | 'loyalty_card' | 'receipt_scan';
  locationId: string;              // Store/venue identifier
  timestamp: number;
  merchantSignature: Ed25519Signature;  // Merchant POS signs the interaction
  zkProof: BBS_Proof;              // Proves tracking_ID ownership
}
```

#### 7.4.4 Offline Conversion Flow

For in-store purchases, store visits, and other offline conversions, users can claim attribution rewards through several mechanisms:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OFFLINE CONVERSION SCENARIOS                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SCENARIO 1: QR Code at Point of Sale                               │   │
│  │                                                                      │   │
│  │  1. User sees Nike ads online (tracking_ID recorded)                 │   │
│  │  2. User visits Nike store, makes purchase                          │   │
│  │  3. Cashier displays QR code with: {merchant_id, transaction_hash}  │   │
│  │  4. User scans with OwnYou wallet:                                  │   │
│  │     • Wallet generates same tracking_ID for nike_summer_2025        │   │
│  │     • Wallet creates ZKP proving ownership                          │   │
│  │     • Wallet sends to OwnYou verification service                   │   │
│  │  5. Merchant POS signs the interaction                              │   │
│  │  6. Attribution verified → Conversion bonus released                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SCENARIO 2: NFC Tap at Store Entry                                 │   │
│  │                                                                      │   │
│  │  1. User sees restaurant ads online (tracking_ID recorded)          │   │
│  │  2. User visits restaurant, taps phone on NFC terminal at entrance  │   │
│  │  3. OwnYou wallet automatically:                                    │   │
│  │     • Detects campaign_ID from NFC payload                          │   │
│  │     • Prompts user: "Claim visit reward for ChilisCampaign2025?"    │   │
│  │     • If accepted: generates tracking_ID + ZKP                      │   │
│  │  4. Store system receives proof, verifies, logs visit               │   │
│  │  5. Visit attribution confirmed → Micro-payment released            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SCENARIO 3: Receipt Scan (Delayed Attribution)                     │   │
│  │                                                                      │   │
│  │  1. User makes purchase without claiming attribution at POS         │   │
│  │  2. Later, user opens OwnYou wallet, scans receipt                  │   │
│  │  3. OCR extracts: merchant_id, date, transaction_id, amount         │   │
│  │  4. Wallet checks: "Did you see ads for this merchant?"             │   │
│  │  5. If tracking_ID exists for merchant's campaign:                  │   │
│  │     • Wallet creates ZKP + receipt evidence                         │   │
│  │     • Submits for delayed attribution verification                  │   │
│  │  6. Merchant verifies transaction occurred → Bonus released         │   │
│  │                                                                      │   │
│  │  Note: Delayed attribution may have reduced bonus (e.g., 50%)       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Offline Conversion API:**

```typescript
interface OfflineConversionRequest {
  trackingId: string;
  campaignId: string;
  zkProof: BBS_Proof;

  // Offline-specific fields
  offlineMethod: 'qr_scan' | 'nfc_tap' | 'loyalty_card' | 'receipt_scan';
  locationId: string;

  // Evidence varies by method
  evidence:
    | { type: 'merchant_signed'; signature: Ed25519Signature; transactionHash: string }
    | { type: 'receipt_ocr'; receiptImage: string; extractedData: ReceiptData }
    | { type: 'nfc_attestation'; nfcPayload: string; terminalSignature: string };

  // Timing
  interactionTimestamp: number;
  submissionTimestamp: number;  // For delayed attribution penalty calculation
}

interface OfflineConversionResponse {
  verified: boolean;
  attributionType: 'real_time' | 'delayed';
  delayPenalty: number;          // 0% for real-time, up to 50% for delayed
  bonusAmount: number;           // After penalty applied
  attributionChain: Impression[];
}
```

**Merchant Integration for Offline:**

```typescript
interface MerchantPOSIntegration {
  /**
   * Generate QR code for customer to scan at checkout
   */
  generateAttributionQR(transaction: {
    transactionId: string;
    amount: number;
    campaignIds: string[];        // Active campaigns for this merchant
  }): QRCodeData;

  /**
   * NFC terminal broadcasts campaign info for automatic detection
   */
  configureNFCTerminal(config: {
    locationId: string;
    activeCampaigns: string[];
    rewardType: 'visit' | 'purchase';
  }): void;

  /**
   * Verify receipt scan request (called by OwnYou backend)
   */
  verifyTransaction(request: {
    transactionId: string;
    date: string;
    amount: number;
  }): Promise<{ verified: boolean; merchantSignature?: string }>;
}
```

#### 7.4.5 Escrow & Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ESCROW SMART CONTRACT                              │
│                                                                              │
│  Campaign: nike_summer_2025                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Total Deposited:    $10,000 USDC                                   │   │
│  │  Impression Rate:    $0.02 per tracked impression                   │   │
│  │  Conversion Bonus:   $0.50 per verified conversion                  │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Impressions Paid:   15,000 × $0.02 = $300                          │   │
│  │  Conversions Paid:   50 × $0.50 = $25                               │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Remaining Balance:  $9,675 USDC                                    │   │
│  │  Status: ACTIVE (auto-pauses when balance < $100)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Payment triggers:                                                           │
│  • On tracked impression: $0.02 → user's wallet (instant)                   │
│  • On verified conversion: $0.50 → user's wallet (after ZKP verified)       │
│  • Low balance alert: Notify advertiser to top up                           │
│  • Campaign end: Return remaining balance to advertiser                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 7.4.5 Fraud Prevention

| Attack | Mitigation |
|--------|------------|
| **Fake users (bots)** | BBS+ proof-of-human required; OwnYou identity service validates |
| **Replay attacks** | Nonce + timestamp in ZKP; each proof single-use |
| **Fake conversions** | Conversion evidence required (ZK proof or merchant sig) |
| **Impression fraud** | tracking_ID must exist in advertiser's impression log before conversion |
| **Value inflation** | Merchant signature on transaction hash; or ZK proof with committed value |
| **Sybil attacks** | Rate limiting per tracking_ID; anomaly detection |

```typescript
interface FraudDetection {
  // Per-tracking_ID limits
  limits: {
    maxImpressionsPerDay: 50;
    maxConversionsPerDay: 5;
    maxValuePerDay: 500;  // USD
  };

  // Velocity checks
  velocityRules: {
    windowSeconds: 3600;
    maxImpressionsInWindow: 10;
  };

  // Anomaly flags (triggers manual review)
  anomalyPatterns: [
    'rapid_fire_impressions',      // Too many impressions too fast
    'conversion_without_dwell',    // Converted instantly after impression
    'geographic_impossibility',    // Impressions from distant locations
    'device_fingerprint_mismatch', // Different devices same tracking_ID
  ];
}
```

### 7.5 Revenue Distribution

#### 7.5.1 Revenue Split

| Party | Share | Rationale |
|-------|-------|-----------|
| **User** | 70% | They own their data; primary value creator |
| **Publisher** | 20% | Provides audience and context |
| **OwnYou** | 10% | Infrastructure and identity service |

#### 7.5.2 Payment Timing

| Event | Payment | Timing |
|-------|---------|--------|
| Tracked impression | $0.02 (configurable) | Instant (on-chain) |
| Conversion bonus | $0.50 (configurable) | After ZKP verification (~1 min) |
| Publisher share | 20% of impression value | Batched daily |
| OwnYou fee | 10% of impression value | Batched daily |

### 7.6 Demo Environment

#### 7.6.1 Demo Publisher Site

```
demo-publisher.ownyou.dev
├── /                     Homepage with articles
├── /login                OwnYou SSO integration
├── /article/:id          Article pages with ad slots
├── /consent              Attribute selection modal demo
└── /dashboard            Publisher earnings dashboard

Features:
• "Login with OwnYou" button (SSO flow)
• Consent modal (user selects which IAB segments to share)
• Live header bidding visualization
• Real-time revenue counter
• Tracking consent prompts embedded in ads
```

#### 7.6.2 Demo Advertiser Dashboard

```
demo-advertiser.ownyou.dev
├── /campaigns            Campaign list and creation
├── /campaign/:id         Campaign detail and analytics
├── /escrow               Deposit and balance management
├── /tracking             Live tracking_ID stream
├── /conversions          Conversion log with verification status
├── /attribution          Attribution reports
└── /simulate             End-to-end flow simulation

Features:
• Create test campaigns with campaign_ID
• Deposit test USDC to escrow
• View tracking_IDs as they arrive
• Simulate conversions with ZK proofs
• View attribution chain visualization
```

#### 7.6.3 End-to-End Demo Flow

```typescript
// Simulated end-to-end attribution demo
async function runAttributionDemo() {
  // 1. User logs into publisher site
  const user = await publisherSDK.loginWithOwnYou();
  console.log('User logged in with pseudonym:', user.pseudonym);

  // 2. Header bidding - Nike wins with tracking request
  const bidResponse = await simulateHeaderBidding(user.segments);
  console.log('Winning bid:', bidResponse.winner);  // "Nike - $3.50 CPM"

  // 3. User sees tracking consent prompt
  const consent = await user.wallet.promptTrackingConsent({
    advertiser: 'Nike',
    campaign: 'Summer Running 2025',
    payment: '$0.02 per impression'
  });

  if (consent.accepted) {
    // 4. Generate tracking_ID
    const trackingId = generateTrackingID(
      user.nymSecret,
      'nike_summer_2025'
    );
    console.log('Tracking ID generated:', trackingId);

    // 5. Simulate cross-site tracking
    for (const publisher of ['siteA.com', 'siteB.com', 'siteC.com']) {
      await simulateImpression(trackingId, 'nike_summer_2025', publisher);
      console.log(`Impression on ${publisher} - User earned $0.02`);
    }

    // 6. Simulate conversion
    const conversion = await simulateConversion({
      trackingId,
      campaignId: 'nike_summer_2025',
      type: 'purchase',
      value: 150,
      evidence: await generateZKPurchaseProof(150, 'nike')
    });

    console.log('Conversion verified:', conversion.verified);
    console.log('Attribution chain:', conversion.attributionChain);
    console.log('Total user earnings:', conversion.totalUserEarnings);
  }
}
```

---

## 8. Memory Architecture

OwnYou implements a **Letta-inspired memory architecture** using LangGraph Store as the persistence layer. Specifically, we adopt three key Letta concepts:

1. **Tiered Memory** — Semantic (facts), Episodic (experiences), Procedural (rules) following cognitive science
2. **Agent-Editable Blocks** — Agents write memories via tools, not passive logging
3. **Virtual Context Management** — Reflection Node synthesizes and compresses memories to fit context windows

This gives agents the cognitive benefits of structured memory while maintaining LangGraph's debuggability and OwnYou's privacy-first principles.

### 8.1 Why Memory Matters

Missions become dramatically more useful when agents have access to:
- **Who the user is** — preferences, values, relationships, Ikigai dimensions
- **What happened before** — past mission outcomes, user reactions, what worked
- **How to behave** — learned rules that evolve from feedback patterns

Without structured memory, every mission starts from zero. With it, the Travel Agent knows you hate layovers (from a frustrated reaction last time), the Shopping Agent knows you returned the "budget" option (so suggests mid-range), and the Restaurant Agent remembers your partner is vegetarian (from relationship context).

**Key principle:** Agents decide what to save — not developers maintaining manual schemas. Agents have agency to determine what information improves future interactions.

### 8.2 Memory Types (Cognitive Model)

Following the cognitive science model from [LangMem](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/), OwnYou uses four memory types:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LANGGRAPH STORE                                    │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐        │
│  │  SEMANTIC MEMORY  │  │  EPISODIC MEMORY  │  │ PROCEDURAL MEMORY │        │
│  │      [MVP]        │  │      [MVP]        │  │      [MVP]        │        │
│  │                   │  │                   │  │                   │        │
│  │ Facts & knowledge │  │ Past experiences  │  │ Behavioral rules  │        │
│  │ • Preferences     │  │ • Mission records │  │ • System prompts  │        │
│  │ • Observations    │  │ • User feedback   │  │ • Learned patterns│        │
│  │ • IAB profile     │  │ • Context/outcome │  │ • Agent-specific  │        │
│  │ • Relationships   │  │ • Few-shot source │  │                   │        │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘        │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │              RELATIONAL MEMORY (Simplified for MVP)                │      │
│  │                                                                    │      │
│  │  MVP: Entities stored in LangGraph Store namespaces               │      │
│  │       Basic lookup by entity name/type, no graph traversal        │      │
│  │                                                                    │      │
│  │  Post-MVP: Full Graphiti-style temporal knowledge graph           │      │
│  │            Kuzu/Neo4j backend, BFS traversal, edge scoring        │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Memory Type | What Agents Write | How It's Used | Write Pattern | MVP Status |
|-------------|-------------------|---------------|---------------|------------|
| **Semantic** | Facts, preferences, observations in natural language | Searched by relevance at mission start | Hot-path (immediate) | ✅ Full |
| **Episodic** | Complete interaction records with situation/reasoning/action/outcome | Few-shot examples for similar situations | Hot-path (immediate) | ✅ Full |
| **Procedural** | Behavioral rules that evolve from patterns | Injected into agent system prompt | Background (Reflection) | ✅ Full |
| **Relational** | Entities and relationships | Entity lookup by name/type | Hot-path | ⚠️ Simplified |

### 8.3 Agent-Driven Memory (No Manual Schemas)

Agents write what they observe, not what a schema demands. Memory content is **natural language**, not structured fields:

```typescript
// ❌ DON'T DO THIS — manually maintained schema
interface UserPreferences {
  seat_preference: string;
  airline_loyalty: string;
  layover_tolerance: string;
}

// ✅ DO THIS — agent-written memories as natural language
const memories = [
  {
    content: "User strongly prefers window seats - mentioned twice during bookings",
    context: "travel",
    confidence: 0.9
  },
  {
    content: "User is Delta SkyMiles Gold member - uses this for all domestic flights",
    context: "travel",
    confidence: 0.95
  },
  {
    content: "User was extremely frustrated by 4-hour layover in Atlanta - said 'never again'",
    context: "travel",
    confidence: 1.0
  },
  {
    content: "User returned budget headphones I recommended - said quality was unacceptable",
    context: "shopping",
    confidence: 1.0
  }
];
```

Retrieval is via **semantic search**, not field lookup. This allows agents to capture nuance and context that rigid schemas would miss.

### 8.4 Memory Schema

#### 8.4.1 Base Memory Structure

Every memory includes temporal tracking, provenance, and strength:

```typescript
interface Memory {
  id: string;
  content: string;                    // Natural language, agent-written
  context: string;                    // Domain hint: "travel", "shopping", "dining", etc.

  // Bi-temporal model (when was this true vs when did we learn it)
  valid_at: timestamp;                // When fact became true in reality
  invalid_at?: timestamp;             // When fact stopped being true (null = still valid)
  created_at: timestamp;              // When system learned this

  // Strength & decay
  strength: number;                   // Starts at 1.0, increases on access/confirmation
  last_accessed: timestamp;           // For decay calculation
  access_count: number;               // How often retrieved

  // Provenance (for transparency and BBS+ authenticity)
  sources: string[];                  // Episode IDs or data source refs that contributed
  confidence: number;                 // 0.0-1.0, based on confirmation frequency
  contradictions?: string[];          // Any conflicting observations

  // Privacy tier
  privacy_tier: "public" | "sensitive" | "private";
}
```

#### 8.4.2 Episodic Memory Structure

Episodes capture complete interactions for few-shot learning:

```typescript
interface Episode {
  id: string;

  // The interaction record
  situation: string;      // What was the user trying to do
  reasoning: string;      // How the agent approached it
  action: string;         // What solution was provided
  outcome: string;        // What happened (success/failure/partial)
  user_feedback?: string; // Explicit feedback or inferred satisfaction

  // Metadata
  agent_type: string;     // "travel", "shopping", "restaurant", etc.
  mission_id: string;     // Link to mission card
  timestamp: timestamp;

  // For few-shot retrieval
  tags: string[];         // Searchable tags: ["booking", "flight", "negative_outcome"]
}
```

#### 8.4.3 Procedural Memory Structure

Agent-specific behavioral rules that evolve:

```typescript
interface ProceduralRule {
  id: string;
  agent_type: string;                 // Which agent this applies to
  rule: string;                       // Natural language instruction

  // Evidence
  derived_from: string[];             // Episode IDs that led to this rule
  confidence: number;                 // How strongly supported by evidence

  // Lifecycle
  created_at: timestamp;
  last_validated: timestamp;          // Last time episodes confirmed this
  override_count: number;             // Times user overrode this behavior
}

// Example procedural rules:
const travelAgentRules = [
  {
    rule: "Always filter for direct flights first - user has strong aversion to layovers",
    derived_from: ["episode_123", "episode_456"],
    confidence: 0.95
  },
  {
    rule: "Suggest mid-range options before budget - user returned budget items twice",
    derived_from: ["episode_789"],
    confidence: 0.8
  }
];
```

#### 8.4.4 Relational Memory Structure (Simplified MVP)

For MVP, entities and relationships are stored in LangGraph Store namespaces (no separate graph database). Post-MVP will upgrade to Graphiti-style temporal knowledge graph with Kuzu.

```typescript
// === ENTITY SCHEMA ===
interface Entity {
  id: string;
  name: string;                       // "Sarah", "Delta Airlines", "Olive Garden"
  type: "person" | "organization" | "place" | "product" | "event";

  // Properties (flexible, agent-written)
  properties: Record<string, unknown>; // { "relationship": "partner", "dietary": "vegetarian" }

  // Temporal
  first_seen: timestamp;
  last_mentioned: timestamp;
  mention_count: number;

  // Provenance
  source_memories: string[];          // Memory IDs where this entity was mentioned
}

// === RELATIONSHIP SCHEMA ===
interface Relationship {
  id: string;
  from_entity: string;                // Entity ID (usually "USER" for user-centric)
  to_entity: string;                  // Entity ID
  type: string;                       // "KNOWS", "PREFERS", "VISITED", "PURCHASED"

  // Temporal (bi-temporal for history)
  valid_at: timestamp;                // When relationship became true
  invalid_at?: timestamp;             // When relationship ended (null = still valid)
  created_at: timestamp;              // When system learned this

  // Properties
  properties: Record<string, unknown>; // { "strength": 0.8, "context": "dining" }

  // Provenance
  source_memories: string[];
}

// === MVP IMPLEMENTATION (Store-based, no graph DB) ===

// Store entities in namespace
const storeEntity = async (userId: string, entity: Entity) => {
  await store.put(
    ["entities", userId],
    entity.id,
    entity
  );
};

// Store relationships in namespace
const storeRelationship = async (userId: string, rel: Relationship) => {
  await store.put(
    ["relationships", userId],
    rel.id,
    rel
  );
};

// MVP lookup: by entity name or type (no graph traversal)
const findEntitiesByType = async (userId: string, type: Entity["type"]) => {
  const all = await store.list(["entities", userId]);
  return all.filter(e => e.value.type === type);
};

const findRelationshipsFor = async (userId: string, entityId: string) => {
  const all = await store.list(["relationships", userId]);
  return all.filter(r =>
    r.value.from_entity === entityId || r.value.to_entity === entityId
  );
};

// Example: "Who is Sarah?"
const lookupEntity = async (userId: string, name: string) => {
  const entities = await store.list(["entities", userId]);
  const match = entities.find(e =>
    e.value.name.toLowerCase() === name.toLowerCase()
  );
  if (match) {
    const relationships = await findRelationshipsFor(userId, match.key);
    return { entity: match.value, relationships: relationships.map(r => r.value) };
  }
  return null;
};
```

**Post-MVP Enhancement:** Replace Store-based lookups with Kuzu graph database for:
- BFS/DFS traversal (e.g., "restaurants similar to ones I've liked")
- Edge scoring and weighting
- Complex graph queries (e.g., "people I've dined with more than 3 times")

#### 8.4.5 Entity Extraction Pipeline

Entities are extracted from semantic memories during the Reflection phase:

```typescript
const extractAndStoreEntities = async (memory: Memory, userId: string) => {
  // Use LLM to extract entities from memory content
  const extraction = await llm.invoke({
    prompt: `Extract entities from this observation about the user:
"${memory.content}"

Return JSON array of entities found:
[{
  "name": "entity name",
  "type": "person|organization|place|product|event",
  "relationship_to_user": "how user relates to this entity",
  "properties": { any relevant properties }
}]

Only extract clearly mentioned entities. Return [] if none found.`,
    response_format: { type: "json_object" }
  });

  const entities = JSON.parse(extraction);

  for (const extracted of entities) {
    // Check if entity already exists
    const existing = await lookupEntity(userId, extracted.name);

    if (existing) {
      // Update existing entity
      await store.update(["entities", userId], existing.entity.id, {
        last_mentioned: now(),
        mention_count: existing.entity.mention_count + 1,
        source_memories: [...existing.entity.source_memories, memory.id],
        properties: { ...existing.entity.properties, ...extracted.properties }
      });
    } else {
      // Create new entity
      const entityId = uuid();
      await storeEntity(userId, {
        id: entityId,
        name: extracted.name,
        type: extracted.type,
        properties: extracted.properties,
        first_seen: now(),
        last_mentioned: now(),
        mention_count: 1,
        source_memories: [memory.id]
      });

      // Create relationship to user
      if (extracted.relationship_to_user) {
        await storeRelationship(userId, {
          id: uuid(),
          from_entity: "USER",
          to_entity: entityId,
          type: extracted.relationship_to_user.toUpperCase().replace(/ /g, "_"),
          valid_at: memory.valid_at,
          created_at: now(),
          properties: {},
          source_memories: [memory.id]
        });
      }
    }
  }
};

// Called during Reflection Node
const processEntitiesFromRecentMemories = async (userId: string) => {
  const recentMemories = await store.search({
    namespace: NS.semanticMemory(userId),
    filter: { entities_extracted: { $ne: true } },
    limit: 50
  });

  for (const memory of recentMemories) {
    await extractAndStoreEntities(memory, userId);
    await store.update(NS.semanticMemory(userId), memory.id, {
      entities_extracted: true
    });
  }
};
```

### 8.5 Vector Embeddings

All semantic search requires vector embeddings. OwnYou uses **local embeddings** to maintain privacy — memory content is never sent to external APIs for embedding.

#### 8.5.1 Embedding Configuration

```typescript
const EMBEDDING_CONFIG = {
  // Model selection (local-first)
  model: "nomic-embed-text-v1.5",     // Default: good balance of quality/speed
  alternatives: [
    "BAAI/bge-small-en-v1.5",         // Smaller, faster, slightly lower quality
    "sentence-transformers/all-MiniLM-L6-v2"  // Widely supported fallback
  ],

  dimensions: 768,                     // Must match model output

  // When to compute embeddings
  compute_on: "write",                 // Embed immediately when storing memory

  // If device is busy (e.g., during mission execution)
  fallback: "queue_for_background",    // Defer to next Reflection cycle

  // Batch settings for efficiency
  batch_size: 32,                      // Embed up to 32 memories at once
  max_queue_size: 1000,                // Alert if queue grows too large
};
```

#### 8.5.2 Embedding Storage

```typescript
// Memory with embedding
interface MemoryWithEmbedding extends Memory {
  embedding?: number[];               // 768-dimensional vector
  embedding_model?: string;           // Which model generated it
  embedded_at?: timestamp;            // When embedding was computed
}

// Compute embedding on write
const storeMemoryWithEmbedding = async (
  userId: string,
  memory: Omit<Memory, "id" | "embedding">
) => {
  const embedding = await computeLocalEmbedding(memory.content);

  const fullMemory: MemoryWithEmbedding = {
    ...memory,
    id: uuid(),
    embedding,
    embedding_model: EMBEDDING_CONFIG.model,
    embedded_at: now()
  };

  await store.put(NS.semanticMemory(userId), fullMemory.id, fullMemory);
  return fullMemory;
};

// Local embedding computation
const computeLocalEmbedding = async (text: string): Promise<number[]> => {
  // PWA: Use transformers.js or WebLLM
  // Tauri: Use local model via Rust bindings
  // Both run entirely on-device

  const model = await loadEmbeddingModel(EMBEDDING_CONFIG.model);
  return model.embed(text);
};
```

#### 8.5.3 Platform-Specific Embedding

| Platform | Embedding Implementation | Performance |
|----------|-------------------------|-------------|
| **PWA** | `@xenova/transformers` (WebGPU/WASM) | ~50ms per embedding |
| **Tauri** | `candle` or `ort` (native Rust) | ~10ms per embedding |
| **Production** | Local service or pgvector built-in | ~5ms per embedding |

**Privacy guarantee:** Embedding models run entirely on-device. Memory content never leaves the user's device for embedding computation.

### 8.6 Bi-Temporal Modeling (Temporal Queries)

Every fact carries two timelines — when it was true in reality vs when the system learned it:

| Timestamp | Purpose | Example |
|-----------|---------|---------|
| `valid_at` | When fact became true | User started preferring vegetarian: Jan 2024 |
| `invalid_at` | When fact stopped being true | User resumed eating meat: Aug 2024 |
| `created_at` | When system learned this | Ingested from email analysis: Jan 15, 2024 |

**Why this matters:**
- "What was my budget in February?" filters by validity window, not just semantic match
- Historical queries work correctly even after preferences change
- Edge invalidation (not deletion) preserves audit trail for transparency

```typescript
// Temporal query example
const getPreferencesAtTime = async (userId: string, queryDate: Date) => {
  return store.search({
    namespace: NS.semanticMemory(userId),
    filter: {
      valid_at: { $lte: queryDate },
      $or: [
        { invalid_at: null },           // Still valid
        { invalid_at: { $gt: queryDate }} // Was valid at query time
      ]
    }
  });
};
```

### 8.7 Memory Retrieval

Retrieval combines multiple strategies for **18.5% improvement** over pure semantic search (per Graphiti benchmarks).

#### 8.7.1 Hybrid Retrieval Strategy

```typescript
// Result type from any search method (computed during retrieval, not stored)
interface SearchResult {
  memory: Memory;
  score: number;          // Raw score from search method
  similarity?: number;    // Cosine similarity (semantic search only, computed not stored)
  rank: number;           // Position in result list
}

const retrieveMemories = async (
  query: string,
  userId: string,
  options: { limit?: number; context?: string } = {}
) => {
  const { limit = 10, context } = options;

  // 1. Semantic search (cosine similarity on embeddings)
  const semanticResults = await vectorSearch(query, {
    namespace: NS.semanticMemory(userId),
    limit: limit * 2
  });

  // 2. Keyword search (BM25 full-text matching)
  // BM25 catches exact matches that semantic search might miss
  // e.g., "Delta SkyMiles" as exact phrase
  const keywordResults = await fullTextSearch(query, {
    namespace: NS.semanticMemory(userId),
    limit: limit * 2
  });

  // 3. Entity lookup (MVP: simple lookup, not graph traversal)
  // Extract entity names from query, look them up directly
  const entityNames = await extractEntityNames(query);
  const entityResults: SearchResult[] = [];
  for (const name of entityNames) {
    const entity = await lookupEntity(userId, name);
    if (entity) {
      // Find memories that mention this entity
      const relatedMemories = await store.search({
        namespace: NS.semanticMemory(userId),
        filter: { content: { $contains: name } },
        limit: 5
      });
      entityResults.push(...relatedMemories.map((m, i) => ({
        memory: m,
        score: 1.0 / (i + 1),
        rank: i + 1
      })));
    }
  }

  // 4. Combine via Reciprocal Rank Fusion (RRF)
  const combined = reciprocalRankFusion([
    semanticResults,
    keywordResults,
    entityResults
  ]);

  // 5. Final scoring: relevance + importance + recency
  const scored = combined.map(result => ({
    ...result.memory,
    finalScore: calculateFinalScore(result)
  }));

  // 6. Filter by context if provided
  const filtered = context
    ? scored.filter(m => m.context === context || m.context === "general")
    : scored;

  return filtered.sort((a, b) => b.finalScore - a.finalScore).slice(0, limit);
};
```

#### 8.7.2 Reciprocal Rank Fusion (RRF)

RRF combines results from multiple search methods without requiring score normalization:

```typescript
/**
 * Reciprocal Rank Fusion (RRF) combines ranked lists from different retrieval methods.
 *
 * Formula: RRF_score(d) = Σ 1 / (k + rank_i(d))
 *
 * where:
 * - d is a document (memory)
 * - k is a constant (typically 60) that dampens high-ranked results
 * - rank_i(d) is the rank of document d in result list i
 *
 * Why RRF works:
 * - Doesn't require normalizing scores across different methods
 * - Rewards documents that appear in multiple lists
 * - Dampens the effect of being #1 vs #2 (less volatile than raw scores)
 */
const reciprocalRankFusion = (
  resultLists: SearchResult[][],
  k: number = 60
): SearchResult[] => {
  const scores = new Map<string, { memory: Memory; rrfScore: number; appearances: number }>();

  for (const results of resultLists) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const memoryId = result.memory.id;

      const existing = scores.get(memoryId);
      const rrfContribution = 1 / (k + rank + 1);

      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.appearances += 1;
      } else {
        scores.set(memoryId, {
          memory: result.memory,
          rrfScore: rrfContribution,
          appearances: 1
        });
      }
    }
  }

  // Convert to array and sort by RRF score
  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(item => ({
      memory: item.memory,
      score: item.rrfScore,
      rank: 0  // Will be re-ranked by final scoring
    }));
};
```

#### 8.7.3 Final Scoring

Combines RRF score with memory-specific factors:

```typescript
interface ScoredResult extends SearchResult {
  rrfScore: number;
}

const calculateFinalScore = (result: ScoredResult): number => {
  const memory = result.memory;

  // Weights (tune based on testing)
  const rrfWeight = 0.5;           // How well it matched the query
  const strengthWeight = 0.3;      // How important/confirmed is this memory
  const recencyWeight = 0.2;       // How recently was it accessed

  // Recency decay
  const daysSinceAccess = daysBetween(memory.last_accessed, now());
  const recencyScore = Math.pow(0.95, daysSinceAccess / 7); // ~5% decay per week

  // Normalize strength to 0-1 (strength can grow > 1 with confirmations)
  const normalizedStrength = Math.min(memory.strength / 5.0, 1.0);

  return (
    result.rrfScore * rrfWeight +
    normalizedStrength * strengthWeight +
    recencyScore * recencyWeight
  );
};
```

#### 8.7.4 Helper Functions

```typescript
// Extract potential entity names from a query
const extractEntityNames = async (query: string): Promise<string[]> => {
  // Simple approach: extract capitalized words and quoted phrases
  const capitalized = query.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  const quoted = query.match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)) || [];
  return [...new Set([...capitalized, ...quoted])];
};

// Vector search using local embeddings
const vectorSearch = async (
  query: string,
  options: { namespace: string[]; limit: number }
): Promise<SearchResult[]> => {
  const queryEmbedding = await computeLocalEmbedding(query);

  // LangGraph Store search with vector similarity
  const results = await store.search({
    namespace: options.namespace,
    query: queryEmbedding,  // Vector query
    limit: options.limit
  });

  return results.map((r, i) => ({
    memory: r.value as Memory,
    score: r.score,           // Cosine similarity from store
    similarity: r.score,
    rank: i + 1
  }));
};

// BM25 full-text search
const fullTextSearch = async (
  query: string,
  options: { namespace: string[]; limit: number }
): Promise<SearchResult[]> => {
  // LangGraph Store with text search (implementation varies by backend)
  const results = await store.search({
    namespace: options.namespace,
    query: query,             // Text query (not vector)
    mode: "fulltext",         // BM25 mode
    limit: options.limit
  });

  return results.map((r, i) => ({
    memory: r.value as Memory,
    score: r.score,           // BM25 score
    rank: i + 1
  }));
};
```

> **Implementation Note:** The retrieval code above assumes LangGraph Store supports `mode: "fulltext"` for BM25 search, and methods like `store.count()` and `store.size()`. These may need to be implemented at the backend level:
> - **IndexedDB (PWA):** Use IDB indexes + custom BM25 scoring, or integrate a library like [Flexsearch](https://github.com/nextapps-de/flexsearch)
> - **SQLite (Tauri):** Use SQLite FTS5 for full-text search
> - **PostgreSQL:** Use `pg_trgm` or `tsvector` for text search
>
> If LangGraph Store's API doesn't natively support these operations, wrap the Store with a custom adapter that provides the extended methods.

### 8.8 Memory Tools for Agents

Agents access memory through callable tools, plus automatic context injection:

#### 8.8.1 Memory Tools

```typescript
const memoryTools = {
  // === Write Tools ===

  save_observation: {
    description: "Save a fact or preference learned about the user",
    parameters: {
      content: "string - what was learned, in natural language",
      context: "string - domain: travel, shopping, dining, health, etc.",
      confidence: "number - how confident (0.0-1.0)"
    },
    handler: async ({ content, context, confidence }, { userId, episodeId }) => {
      // Check for similar existing memories
      const similar = await findSimilarMemories(content, userId, threshold: 0.85);

      if (similar.length > 0) {
        // Consolidate: strengthen existing memory
        return consolidateMemory(similar[0], content, confidence);
      }

      // Create new memory
      return store.put(NS.semanticMemory(userId), uuid(), {
        content,
        context,
        confidence,
        valid_at: now(),
        created_at: now(),
        strength: 1.0,
        sources: [episodeId]
      });
    }
  },

  save_episode: {
    description: "Record a complete interaction for future learning",
    parameters: {
      situation: "string - what the user was trying to do",
      reasoning: "string - how you approached it",
      action: "string - what solution you provided",
      outcome: "string - what happened",
      user_feedback: "string? - explicit or inferred satisfaction"
    },
    handler: async (episode, { userId, agentType, missionId }) => {
      return store.put(NS.episodicMemory(userId), uuid(), {
        ...episode,
        agent_type: agentType,
        mission_id: missionId,
        timestamp: now(),
        tags: await extractTags(episode)
      });
    }
  },

  invalidate_memory: {
    description: "Mark a fact as no longer true (don't delete - preserve history)",
    parameters: {
      memory_id: "string - ID of memory to invalidate",
      reason: "string - why this is no longer true"
    },
    handler: async ({ memory_id, reason }, { userId }) => {
      return store.update(NS.semanticMemory(userId), memory_id, {
        invalid_at: now(),
        invalidation_reason: reason
      });
    }
  },

  // === Read Tools ===

  search_memories: {
    description: "Find relevant memories about the user",
    parameters: {
      query: "string - what to search for",
      context: "string? - optional domain filter",
      limit: "number? - max results (default 10)"
    },
    handler: async ({ query, context, limit = 10 }, { userId }) => {
      return retrieveMemories(query, userId, { limit, context });
    }
  },

  get_similar_episodes: {
    description: "Find past interactions similar to current situation (for few-shot learning)",
    parameters: {
      situation: "string - current situation to match",
      outcome_filter: "string? - 'positive', 'negative', or 'all'"
    },
    handler: async ({ situation, outcome_filter = "all" }, { userId, agentType }) => {
      const episodes = await store.search({
        namespace: NS.episodicMemory(userId),
        query: situation,
        filter: {
          agent_type: agentType,
          ...(outcome_filter !== "all" && { outcome_type: outcome_filter })
        },
        limit: 5
      });
      return episodes;
    }
  }
};
```

#### 8.8.2 Automatic Context Injection

At mission start, relevant memories are automatically injected:

```typescript
const startMission = async (agent: Agent, trigger: Trigger, userId: string) => {
  // 1. Retrieve relevant semantic memories
  const relevantMemories = await retrieveMemories(
    trigger.description,
    userId,
    { limit: 10, context: agent.type }
  );

  // 2. Get similar past episodes for few-shot learning
  const similarEpisodes = await store.search({
    namespace: NS.episodicMemory(userId),
    query: trigger.description,
    filter: { agent_type: agent.type },
    limit: 3
  });

  // 3. Load procedural rules for this agent
  const proceduralRules = await store.get(
    NS.proceduralMemory(userId, agent.type),
    "rules"
  );

  // 4. Inject into agent context
  const enrichedSystemPrompt = `
${agent.baseSystemPrompt}

## What You Know About This User

${formatMemoriesAsContext(relevantMemories)}

## Relevant Past Experiences

${formatEpisodesAsFewShot(similarEpisodes)}

## Learned Behaviors for This User

${formatRulesAsInstructions(proceduralRules)}
`;

  return agent.execute(trigger, { systemPrompt: enrichedSystemPrompt });
};
```

### 8.9 Memory Lifecycle Management

#### 8.9.1 Consolidation (Merge Similar Memories)

When new information overlaps with existing memories, consolidate rather than duplicate:

```typescript
// Note: namespace is passed separately to store operations, not stored on Memory
const consolidateMemory = async (
  existing: Memory,
  newContent: string,
  newConfidence: number,
  userId: string  // Required for namespace construction
) => {
  // Merge content if significantly different
  const mergedContent = existing.content === newContent
    ? existing.content
    : await llm.invoke(`
        Merge these two observations about the same topic into one clear statement:
        1. ${existing.content}
        2. ${newContent}
      `);

  // Increase strength (confirmation reinforces memory)
  const newStrength = Math.min(existing.strength + 0.5, 5.0);

  // Update confidence (weighted average favoring recent)
  const newConfidenceScore = (existing.confidence + newConfidence * 2) / 3;

  // Namespace is derived from userId, not stored on Memory
  return store.update(
    NS.semanticMemory(userId),
    existing.id,
    {
      content: mergedContent,
      strength: newStrength,
      confidence: newConfidenceScore,
      last_accessed: now(),
      access_count: existing.access_count + 1
    }
  );
};
```

#### 8.9.2 Decay (Reduce Strength Over Time)

Memories that aren't accessed gradually fade:

```typescript
const DECAY_RATE = 0.95;  // Per week
const PRUNE_THRESHOLD = 0.1;

const calculateEffectiveStrength = (memory: Memory): number => {
  const weeksSinceAccess = daysBetween(memory.last_accessed, now()) / 7;
  return memory.strength * Math.pow(DECAY_RATE, weeksSinceAccess);
};
```

#### 8.9.3 Pruning (Remove Low-Value Memories)

Periodic cleanup removes memories below threshold:

```typescript
const pruneMemories = async (userId: string) => {
  const allMemories = await store.list(NS.semanticMemory(userId));

  for (const memory of allMemories) {
    const effectiveStrength = calculateEffectiveStrength(memory);

    if (effectiveStrength < PRUNE_THRESHOLD) {
      // Don't delete - mark as archived for potential recovery
      await store.update(NS.semanticMemory(userId), memory.id, {
        archived: true,
        archived_at: now(),
        archived_reason: "low_strength_decay"
      });
    }
  }
};
```

#### 8.9.4 Community Summaries (Compression)

Clusters of related memories generate high-level summaries:

```typescript
const generateCommunitySummary = async (userId: string, context: string) => {
  const memories = await store.search({
    namespace: NS.semanticMemory(userId),
    filter: { context, archived: { $ne: true } },
    limit: 50
  });

  if (memories.length < 5) return null;

  const summary = await llm.invoke(`
    Analyze these ${memories.length} observations about the user's ${context} preferences.
    Generate a concise summary (2-3 sentences) capturing the key patterns.

    Observations:
    ${memories.map(m => `- ${m.content}`).join('\n')}
  `);

  return store.put(["community_summaries", userId], context, {
    summary,
    source_count: memories.length,
    generated_at: now()
  });
};

// Example output:
// "Prefers Italian and Japanese cuisine, typically spends $40-60/person.
//  Values quiet atmosphere over trendy locations. Usually dines with partner Sarah."
```

### 8.10 Reflection Node

The Reflection Node runs in the background to synthesize patterns and maintain memory quality:

```typescript
const reflectionNode = async (userId: string, trigger: ReflectionTrigger) => {

  // 1. CONSOLIDATION — merge similar memories
  await consolidateSimilarMemories(userId);

  // 2. DECAY & PRUNE — remove low-value memories
  await pruneMemories(userId);

  // 3. SUMMARIZATION — generate community summaries
  for (const context of ["travel", "shopping", "dining", "events"]) {
    await generateCommunitySummary(userId, context);
  }

  // 4. PROCEDURAL SYNTHESIS — extract rules from episode patterns
  await synthesizeProceduralRules(userId);

  // 5. TEMPORAL VALIDATION — mark outdated facts as invalid
  await validateTemporalFacts(userId);

  // 6. IKIGAI SYNTHESIS — update Ikigai profile (see Section 2.4)
  await synthesizeIkigaiProfile(userId);
};

// Reflection triggers
const REFLECTION_TRIGGERS = {
  after_episodes: 5,           // Run after every 5 episodes
  daily_idle: "03:00",         // Run at 3 AM if app was used that day
  after_negative_feedback: true, // Immediate reflection on negative outcomes
  weekly_maintenance: "SUN",   // Weekly cleanup and summarization
};
```

#### 8.10.1 Procedural Rule Synthesis

Extract behavioral rules from episode patterns:

```typescript
const synthesizeProceduralRules = async (userId: string) => {
  const agentTypes = ["travel", "shopping", "dining", "events", "content"];

  for (const agentType of agentTypes) {
    // Get recent episodes for this agent
    const episodes = await store.search({
      namespace: NS.episodicMemory(userId),
      filter: { agent_type: agentType },
      sort: { timestamp: "desc" },
      limit: 20
    });

    if (episodes.length < 3) continue;

    // Ask LLM to identify patterns
    const patterns = await llm.invoke(`
      Analyze these ${episodes.length} past interactions and identify behavioral rules.

      For each rule:
      - State the rule clearly (e.g., "Always suggest X before Y")
      - Explain the evidence (which episodes support this)
      - Rate confidence (how consistent is the pattern)

      Episodes:
      ${episodes.map(e => `
        Situation: ${e.situation}
        Action: ${e.action}
        Outcome: ${e.outcome}
        Feedback: ${e.user_feedback || 'none'}
      `).join('\n---\n')}
    `);

    // Store synthesized rules
    await store.put(NS.proceduralMemory(userId, agentType), "rules", {
      rules: patterns.rules,
      derived_from: episodes.map(e => e.id),
      synthesized_at: now()
    });
  }
};
```

### 8.11 Privacy Tiers

Different memory domains have different cross-agent access controls:

```typescript
const PRIVACY_TIERS = {
  public: {
    domains: ["shopping", "travel", "dining", "events", "content"],
    cross_access: "full",  // All public agents can read each other's memories
    description: "General lifestyle preferences safe to share across agents"
  },

  sensitive: {
    domains: ["financial", "relationships"],
    cross_access: "justified",  // Requires explicit reasoning to access
    description: "Personal information shared only when directly relevant"
  },

  private: {
    domains: ["health", "journal"],
    cross_access: "none",  // No cross-agent access without explicit consent
    description: "Highly personal information isolated by default"
  }
};

const canAccessMemory = (
  requestingAgent: string,
  memory: Memory,
  justification?: string
): boolean => {
  const tier = PRIVACY_TIERS[memory.privacy_tier];

  if (tier.cross_access === "full") return true;
  if (tier.cross_access === "none") return false;
  if (tier.cross_access === "justified") {
    return justification && justification.length > 20;
  }
  return false;
};
```

### 8.12 Namespace Schema

All memory is organized into typed namespaces following the LangGraph Store pattern:

```typescript
// Namespace factory functions for type-safe access
// Import: import { NS } from '@ownyou/shared-types';
const NS = {
  // === SEMANTIC MEMORY (Facts & Knowledge) ===
  semanticMemory: (userId: string) => ["ownyou.semantic", userId],
  communitySummaries: (userId: string) => ["ownyou.summaries", userId],

  // === EPISODIC MEMORY (Interaction History) ===
  episodicMemory: (userId: string) => ["ownyou.episodes", userId],

  // === PROCEDURAL MEMORY (Agent Rules) ===
  proceduralMemory: (userId: string, agentType: string) =>
    ["ownyou.procedural", userId, agentType],

  // === RELATIONAL MEMORY (Entity Graph) ===
  entities: (userId: string) => ["ownyou.entities", userId],
  relationships: (userId: string) => ["ownyou.relationships", userId],

  // === IAB CLASSIFICATION (Advertising Profile) ===
  iabClassifications: (userId: string) => ["ownyou.iab", userId],
  iabEvidence: (userId: string) => ["ownyou.iab_evidence", userId],

  // === IKIGAI (Well-Being Profile) ===
  ikigaiProfile: (userId: string) => ["ownyou.ikigai", userId],
  ikigaiDimensions: (userId: string) => ["ownyou.ikigai_dims", userId],

  // === MISSION STATE ===
  missionCards: (userId: string) => ["ownyou.missions", userId],
  missionFeedback: (userId: string, missionId: string) =>
    ["ownyou.feedback", userId, missionId],

  // === BBS+ IDENTITY ===
  pseudonyms: (userId: string) => ["ownyou.pseudonyms", userId],
  disclosureHistory: (userId: string) => ["ownyou.disclosures", userId],
  earnings: (userId: string) => ["ownyou.earnings", userId],
  trackingConsents: (userId: string) => ["ownyou.consents", userId],

  // === SYNC & ARCHIVAL ===
  archived: (namespace: string) => ["ownyou.archived", namespace],
  yearlySummaries: (userId: string, context: string) =>
    ["ownyou.yearly_summaries", userId, context],
  syncMetadata: (deviceId: string) => ["ownyou.sync", deviceId],
} as const;

// Usage example:
// await store.put(NS.semanticMemory(userId), memoryId, memory);
// await store.search({ namespace: NS.episodicMemory(userId), query });
```

### 8.13 Storage Backends

LangGraph Store abstracts the persistence layer, allowing the same memory architecture across platforms:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LANGGRAPH STORE API                               │
│         put() | get() | search() | list() | delete()                    │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PWA/Browser   │     │  Tauri Desktop  │     │   Production    │
│                 │     │                 │     │                 │
│  IndexedDB +    │     │  SQLite +       │     │  PostgreSQL +   │
│  (vector: local │     │  LanceDB        │     │  pgvector       │
│   embeddings)   │     │  (+ Kuzu graph) │     │  (+ Neo4j opt.) │
│                 │     │                 │     │                 │
│  Sync: OrbitDB  │     │  Sync: OrbitDB  │     │  Sync: Native   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

| Platform | Structured Storage | Vector Search | Graph (Optional) | Sync |
|----------|-------------------|---------------|------------------|------|
| **PWA** | IndexedDB | Local embeddings | In-memory | OrbitDB |
| **Tauri Desktop** | SQLite + SQLCipher | LanceDB | Kuzu (embedded) | OrbitDB |
| **Production** | PostgreSQL | pgvector | Neo4j | Native replication |

### 8.14 Memory-Sync Integration

Memory must synchronize across devices while respecting privacy and handling offline scenarios. This section defines which memories sync, how conflicts are resolved, and the encryption requirements.

#### 8.14.1 Sync Scope by Namespace

Not all memory syncs — some is device-specific, some is shared:

| Namespace | Sync? | Rationale |
|-----------|-------|-----------|
| `semanticMemory` | ✅ Yes | User preferences should be consistent across devices |
| `episodicMemory` | ⚠️ Selective | Recent episodes sync; old episodes archived locally |
| `proceduralMemory` | ✅ Yes | Agent rules must be consistent (critical for UX) |
| `entities` | ✅ Yes | Entity knowledge should be shared |
| `relationships` | ✅ Yes | Relationship context should be shared |
| `community_summaries` | ✅ Yes | Summaries are derived; sync for efficiency |
| `iab_classifications` | ✅ Yes | Advertising profile must be consistent |
| `ikigai_profile` | ✅ Yes | Core user understanding shared |
| `missionCards` | ✅ Yes | Active missions visible everywhere |
| `mission_feedback` | ✅ Yes | Feedback informs all devices |
| `earnings` | ✅ Yes | Financial data must be accurate everywhere |
| **Device-local only:** | | |
| `embedding_queue` | ❌ No | Device-specific processing queue |
| `sync_metadata` | ❌ No | Per-device sync state |
| `temp_*` | ❌ No | Temporary processing data |

#### 8.14.2 Sync Architecture with OrbitDB

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LANGGRAPH STORE                                │
│                    (Local IndexedDB or SQLite)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Store operations
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MEMORY SYNC LAYER                                │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    SYNC DECISION ENGINE                           │  │
│  │  • Checks namespace against sync scope table                      │  │
│  │  • Applies freshness rules for episodic memory                    │  │
│  │  • Adds encryption before sync (see 8.13.3)                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     ORBITDB CRDT LAYER                            │  │
│  │  • Encrypted operations only                                      │  │
│  │  • CRDT merge semantics for conflict-free sync                    │  │
│  │  • P2P + optional cloud relay                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Device A │  │ Device B │  │ Device C │
              │  (Phone) │  │ (Desktop)│  │ (Tablet) │
              └──────────┘  └──────────┘  └──────────┘
```

#### 8.14.3 Encryption Requirements

All synced data is encrypted before leaving the device:

```typescript
interface SyncPayload {
  // Encrypted content (AES-256-GCM)
  ciphertext: Uint8Array;

  // Encryption metadata (not sensitive)
  iv: Uint8Array;                    // Random IV per operation
  key_derivation_salt: string;       // For wallet-derived key

  // Sync metadata (not encrypted)
  namespace: string;
  operation: "put" | "update" | "delete";
  timestamp: number;
  device_id: string;
}

const encryptForSync = async (
  memory: Memory,
  namespace: string,             // Namespace passed separately (not on Memory)
  walletKey: CryptoKey
): Promise<SyncPayload> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = JSON.stringify(memory);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    walletKey,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
    key_derivation_salt: currentSalt,
    namespace,                     // Use parameter, not memory.namespace
    operation: "put",
    timestamp: Date.now(),
    device_id: getDeviceId()
  };
};
```

**Key management:** Encryption key is derived from user's wallet (deterministic derivation). All devices with access to the wallet can decrypt synced memories. See Section 5 for wallet-based authentication.

#### 8.14.4 Conflict Resolution by Namespace

Different memory types have different conflict semantics:

| Namespace | Conflict Strategy | Rationale |
|-----------|-------------------|-----------|
| **semanticMemory** | Latest-write-wins | Preferences evolve; newest is most accurate |
| **episodicMemory** | Merge (append) | Episodes are immutable records; both valid |
| **proceduralMemory** | Latest-write-wins + reconcile | Rules must be consistent; trigger Reflection to reconcile |
| **entities** | Merge properties | Combine entity properties from both versions |
| **relationships** | Latest-write-wins | Relationship state should be newest |
| **missionCards** | Custom merge | Active missions merge; completed use newest |
| **earnings** | Sum (financial reconcile) | Never lose earnings; reconcile with ledger |

```typescript
const resolveConflict = async (
  namespace: string,
  local: Memory,
  remote: Memory
): Promise<Memory> => {
  const strategy = CONFLICT_STRATEGIES[namespace];

  switch (strategy) {
    case "latest_write_wins":
      return local.created_at > remote.created_at ? local : remote;

    case "merge_append":
      // Both records are valid; keep both (different IDs)
      return local; // Remote stored separately

    case "merge_properties":
      return {
        ...remote,
        ...local,
        properties: { ...remote.properties, ...local.properties },
        source_memories: [...new Set([
          ...(local.source_memories || []),
          ...(remote.source_memories || [])
        ])]
      };

    case "procedural_reconcile":
      // Keep latest, but flag for Reflection to validate consistency
      const winner = local.created_at > remote.created_at ? local : remote;
      await flagForReflection(namespace, "procedural_conflict", {
        kept: winner,
        discarded: local.created_at > remote.created_at ? remote : local
      });
      return winner;

    case "financial_reconcile":
      // Never lose money; take higher value, flag for audit
      if (local.amount !== remote.amount) {
        await flagForAudit("earnings_mismatch", { local, remote });
      }
      return local.amount > remote.amount ? local : remote;
  }
};
```

#### 8.14.5 Episodic Memory Sync Rules

Episodic memory uses selective sync to balance storage and completeness:

```typescript
const EPISODIC_SYNC_RULES = {
  // Always sync recent episodes
  recent_threshold_days: 30,

  // Sync episodes with strong signals regardless of age
  always_sync_if: {
    outcome: "negative",           // Learning opportunities
    has_user_feedback: true,       // Explicit user input
    led_to_procedural_rule: true,  // Contributed to learning
  },

  // Archive old episodes locally (don't sync)
  archive_after_days: 90,

  // Maximum synced episodes per agent type
  max_synced_per_agent: 50,
};

const shouldSyncEpisode = (episode: Episode): boolean => {
  const age = daysBetween(episode.timestamp, now());

  // Recent? Always sync
  if (age < EPISODIC_SYNC_RULES.recent_threshold_days) return true;

  // Strong signal? Always sync
  if (episode.outcome === "negative") return true;
  if (episode.user_feedback) return true;
  if (episode.led_to_procedural_rule) return true;

  // Old and unremarkable? Archive locally
  return false;
};
```

### 8.15 Memory Size Limits

Device storage is finite. This section defines limits, quotas, and archival strategies.

#### 8.15.1 Storage Quotas by Platform

| Platform | Total Memory Budget | IndexedDB/SQLite Limit | Recommended Action at 80% |
|----------|--------------------|-----------------------|--------------------------|
| **PWA (Browser)** | 50 MB | ~100 MB (browser-dependent) | Aggressive pruning + archive |
| **Tauri Desktop** | 500 MB | Unlimited (filesystem) | Compress + archive old data |
| **Production** | 2 GB per user | PostgreSQL (scalable) | Archive to cold storage |

#### 8.15.2 Per-Namespace Limits

```typescript
const NAMESPACE_LIMITS = {
  semanticMemory: {
    max_records: 10_000,           // ~10K facts per user
    max_size_mb: 20,               // Content + embeddings
    archival_threshold: 0.8,       // Archive when 80% full
  },

  episodicMemory: {
    max_records: 5_000,            // ~5K episodes per user
    max_size_mb: 15,
    archival_threshold: 0.7,       // More aggressive archival
  },

  proceduralMemory: {
    max_records: 500,              // ~50 rules per agent × 10 agents
    max_size_mb: 2,
    archival_threshold: 0.9,       // Keep most rules active
  },

  entities: {
    max_records: 2_000,            // ~2K entities
    max_size_mb: 5,
    archival_threshold: 0.8,
  },

  relationships: {
    max_records: 10_000,           // ~10K relationships
    max_size_mb: 5,
    archival_threshold: 0.8,
  },

  community_summaries: {
    max_records: 100,              // Summaries are compact
    max_size_mb: 1,
    archival_threshold: 0.9,
  },
};

const checkQuota = async (namespace: string): Promise<QuotaStatus> => {
  const limits = NAMESPACE_LIMITS[namespace];
  const current = await store.count(namespace);
  const size = await store.size(namespace);

  return {
    namespace,
    records: { current, max: limits.max_records, pct: current / limits.max_records },
    size_mb: { current: size, max: limits.max_size_mb, pct: size / limits.max_size_mb },
    needs_archival: current / limits.max_records > limits.archival_threshold,
  };
};
```

#### 8.15.3 Archival Strategy

When approaching limits, memories are archived — not deleted:

```typescript
interface ArchivedMemory {
  original_id: string;
  namespace: string;
  compressed_content: Uint8Array;  // gzip compressed
  archival_reason: "quota" | "age" | "low_strength";
  archived_at: timestamp;

  // Searchable summary (for potential retrieval)
  summary: string;                 // LLM-generated 1-sentence summary
  tags: string[];
}

const archiveMemories = async (namespace: string, count: number) => {
  // Select candidates: lowest effective strength
  const candidates = await store.list(namespace, {
    sort: { effective_strength: "asc" },
    limit: count
  });

  for (const memory of candidates) {
    // Generate summary for future search
    const summary = await llm.invoke(
      `Summarize in one sentence: ${memory.content}`
    );

    // Compress and archive
    const compressed = gzip(JSON.stringify(memory));

    await store.put(["archived", namespace], memory.id, {
      original_id: memory.id,
      namespace,
      compressed_content: compressed,
      archival_reason: "quota",
      archived_at: now(),
      summary,
      tags: memory.tags || []
    });

    // Remove from active store
    await store.delete(namespace, memory.id);
  }
};

// Restore from archive if needed
const restoreFromArchive = async (archiveId: string): Promise<Memory> => {
  const archived = await store.get(["archived"], archiveId);
  const memory = JSON.parse(gunzip(archived.compressed_content));

  await store.put(archived.namespace, memory.id, memory);
  await store.delete(["archived"], archiveId);

  return memory;
};
```

#### 8.15.4 Long-Term User Strategy (3+ Years)

For users with extensive history:

```typescript
const LONG_TERM_STRATEGY = {
  // After 1 year: compress older memories into summaries
  yearly_compression: {
    enabled: true,
    keep_originals: false,  // Replace with community summaries
    summary_per_context: true,
  },

  // After 2 years: archive rarely-accessed memories
  deep_archive: {
    enabled: true,
    access_threshold: 2,    // Archived if accessed < 2 times in year
    storage: "local_file",  // Archive to filesystem (not IndexedDB)
  },

  // Retention policies by type
  retention: {
    semanticMemory: "indefinite",     // Facts may always be relevant
    episodicMemory: "3_years",        // Old episodes compressed to summaries
    proceduralMemory: "indefinite",   // Rules must persist
    entities: "indefinite",            // Entity knowledge persists
    relationships: "5_years",          // Old relationships fade
  },
};

const performYearlyMaintenance = async (userId: string) => {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  // For each context, compress old memories into yearly summary
  for (const context of ["travel", "shopping", "dining", "events"]) {
    const oldMemories = await store.search({
      namespace: NS.semanticMemory(userId),
      filter: {
        context,
        created_at: { $lt: oneYearAgo },
        yearly_summary_processed: { $ne: true }
      },
      limit: 500
    });

    if (oldMemories.length < 10) continue;

    // Generate yearly summary
    const yearlySummary = await llm.invoke(`
      Create a comprehensive summary of these ${oldMemories.length} observations
      about the user's ${context} preferences from ${oldMemories[0].created_at.getFullYear()}.

      Focus on enduring patterns, not one-time events.

      Observations:
      ${oldMemories.map(m => `- ${m.content}`).join('\n')}
    `);

    // Store summary
    await store.put(
      ["yearly_summaries", userId, context],
      `${oldMemories[0].created_at.getFullYear()}`,
      {
        summary: yearlySummary,
        source_count: oldMemories.length,
        year: oldMemories[0].created_at.getFullYear(),
        generated_at: now()
      }
    );

    // Mark originals as processed (or archive them)
    for (const m of oldMemories) {
      await store.update(
        NS.semanticMemory(userId),
        m.id,
        { yearly_summary_processed: true, archived: true }
      );
    }
  }
};
```

#### 8.15.5 Storage Monitoring

```typescript
interface StorageReport {
  total_mb: number;
  by_namespace: Record<string, { records: number; size_mb: number }>;
  quota_status: "healthy" | "warning" | "critical";
  recommendations: string[];
}

const generateStorageReport = async (userId: string): Promise<StorageReport> => {
  const namespaces = Object.keys(NAMESPACE_LIMITS);
  const report: StorageReport = {
    total_mb: 0,
    by_namespace: {},
    quota_status: "healthy",
    recommendations: []
  };

  for (const ns of namespaces) {
    const status = await checkQuota([ns, userId].join("/"));
    report.by_namespace[ns] = {
      records: status.records.current,
      size_mb: status.size_mb.current
    };
    report.total_mb += status.size_mb.current;

    if (status.needs_archival) {
      report.recommendations.push(
        `Archive ${ns}: ${status.records.pct.toFixed(0)}% of quota used`
      );
      if (status.records.pct > 0.95) {
        report.quota_status = "critical";
      } else if (report.quota_status !== "critical") {
        report.quota_status = "warning";
      }
    }
  }

  return report;
};
```

### 8.16 Concrete Example: How Travel Agent Gets Smarter

```
═══════════════════════════════════════════════════════════════════════════
MISSION 1: "Book flight to Paris"
═══════════════════════════════════════════════════════════════════════════

Agent searches semantic memory → nothing relevant found
Agent searches similar episodes → none for travel

Agent books flight: connection through Atlanta, middle seat

User feedback: "This is terrible, I hate layovers and middle seats"

┌─ Agent writes to EPISODIC MEMORY ─────────────────────────────────────┐
│ situation: "User requested flight to Paris"                           │
│ reasoning: "Found cheapest available option"                          │
│ action: "Booked connection through Atlanta, middle seat"              │
│ outcome: "negative"                                                   │
│ user_feedback: "Hates layovers and middle seats"                      │
│ tags: ["booking", "flight", "negative_outcome", "layover", "seating"] │
└───────────────────────────────────────────────────────────────────────┘

┌─ Agent writes to SEMANTIC MEMORY ─────────────────────────────────────┐
│ content: "User strongly dislikes layover flights - expressed as       │
│           'terrible' and 'hate'"                                      │
│ context: "travel"                                                     │
│ confidence: 1.0                                                       │
│                                                                       │
│ content: "User dislikes middle seats"                                 │
│ context: "travel"                                                     │
│ confidence: 1.0                                                       │
└───────────────────────────────────────────────────────────────────────┘

Reflection triggered (negative feedback) →

┌─ Reflection writes to PROCEDURAL MEMORY ──────────────────────────────┐
│ rule: "Always filter for direct flights first when booking for this   │
│        user - they have strong aversion to layovers"                  │
│ rule: "Prefer window or aisle seats - user dislikes middle seats"     │
│ derived_from: ["episode_001"]                                         │
│ confidence: 0.9                                                       │
└───────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════
MISSION 2: "Book flight to Rome" (2 weeks later)
═══════════════════════════════════════════════════════════════════════════

Agent searches semantic memory → finds:
  • "User strongly dislikes layover flights"
  • "User dislikes middle seats"

Agent searches similar episodes → finds Paris episode:
  • Situation: flight booking
  • Outcome: negative
  • Lesson: don't book connections or middle seats

Agent loads procedural rules:
  • "Always filter for direct flights first"
  • "Prefer window or aisle seats"

Agent books: direct flight, window seat, slightly higher price

User feedback: "Perfect! This is exactly what I wanted"

┌─ Agent writes to EPISODIC MEMORY ─────────────────────────────────────┐
│ situation: "User requested flight to Rome"                            │
│ reasoning: "Applied learned preferences: direct flight, window seat"  │
│ action: "Booked direct flight with window seat"                       │
│ outcome: "positive"                                                   │
│ user_feedback: "Perfect - exactly what they wanted"                   │
└───────────────────────────────────────────────────────────────────────┘

┌─ Semantic memory STRENGTHENED ────────────────────────────────────────┐
│ "User strongly dislikes layover flights"                              │
│ strength: 1.0 → 1.5 (confirmed by successful application)             │
│ access_count: 1 → 2                                                   │
└───────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════
MISSION 3: "Book flight to Tokyo" (1 month later)
═══════════════════════════════════════════════════════════════════════════

All context automatically available:
  • Semantic: prefers direct flights, window seats
  • Episodic: Paris (negative), Rome (positive) as few-shot examples
  • Procedural: "filter direct first, prefer window/aisle"

Agent immediately:
  ✓ Filters to direct flights only (17 hour flight, limited options)
  ✓ Selects window seat
  ✓ Presents options sorted by user's likely preferences

No trial and error needed — agent learned from experience.
```

---

## 9. MVP Scope Definition (Updated)

### 9.1 Included in MVP

| Component                    | Specific Items                                                       |
| ---------------------------- | -------------------------------------------------------------------- |
| **Platforms**          | PWA + Tauri Desktop                                                  |
| **Data Sources**       | Email ✅ + Financial + Browser + Calendar (4 total)                  |
| **Mission Agents**     | Shopping, Travel, Restaurant, Events, Content, Diagnostic (6 agents) |
| **Mission Triggers**   | All 4 modes: Data, Scheduled, Event, User-driven                     |
| **Ikigai**             | Full Intelligence Layer with hybrid architecture                     |
| **IAB Classification** | Complete ✅ (TypeScript)                                             |
| **BBS+ Revenue**       | Working with 1-2 pilot publishers                                    |
| **Memory**             | LangGraph Store (IndexedDB → SQLite → PostgreSQL)                  |
| **OAuth**              | 90-day tokens via Tauri custom protocol                              |
| **Consumer UI**        | Full implementation from Figma designs                               |
| **Sync**               | OrbitDB with offline handling + encryption                           |
| **Publisher SDK**      | Complete with Prebid.js adapter                                      |
| **Advertiser SDK**     | Complete with conversion tracking + fraud prevention                 |
| **Demo Environment**   | Demo publisher site + mock advertiser dashboard                      |

### 9.2 Excluded from MVP (Post-MVP)

| Component                  | Deferred Items                                     |
| -------------------------- | -------------------------------------------------- |
| **Data Sources**     | Health, Photos, Location, Social Media             |
| **Mission Agents**   | Bill, Services, Hobby, Cooking, Fitness (5 agents) |
| **Memory**           | Graphiti temporal knowledge graph                  |
| **Attribution**      | First Click, Linear, Time Decay models             |
| **Decentralization** | Nillion/Nesa integration, DID auth                 |

---

## 10. Observability & Debugging

For a system with 6 agents, 4 data sources, P2P sync, and LLM inference, comprehensive observability is critical for debugging, cost management, and user transparency.

### 10.1 Observability Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY LAYERS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Agent Traces │  │  Sync Logs   │  │ LLM Metrics  │           │
│  │              │  │              │  │              │           │
│  │ • Tool calls │  │ • Conflicts  │  │ • Tokens     │           │
│  │ • Decisions  │  │ • Latency    │  │ • Costs      │           │
│  │ • Memory ops │  │ • Errors     │  │ • Latency    │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│         └────────────┬────┴────────────────┘                    │
│                      ▼                                           │
│              ┌──────────────┐                                    │
│              │ Local Store  │  (encrypted, user-controlled)      │
│              │ IndexedDB    │                                    │
│              └──────┬───────┘                                    │
│                     │                                            │
│                     ▼                                            │
│              ┌──────────────┐                                    │
│              │ Debug UI     │  (Settings → Debug panel)          │
│              └──────────────┘                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principle:** All observability data stays on-device. Users own their debug logs just like they own their personal data.

### 10.2 Agent Execution Tracing

```typescript
interface AgentTrace {
  trace_id: string;
  agent_type: string;
  mission_id?: string;
  user_id: string;

  started_at: timestamp;
  completed_at?: timestamp;
  status: "running" | "completed" | "failed" | "timeout";

  // Execution steps
  steps: AgentStep[];

  // Resource usage summary
  resources: {
    llm_calls: number;
    llm_tokens: { input: number; output: number };
    llm_cost_usd: number;
    tool_calls: number;
    memory_reads: number;
    memory_writes: number;
    external_api_calls: number;
    duration_ms: number;
  };

  // Error info (if failed)
  error?: {
    type: string;
    message: string;
    stack?: string;
    step_index: number;
    recoverable: boolean;
  };
}

interface AgentStep {
  step_index: number;
  step_type: "llm_call" | "tool_call" | "memory_read" | "memory_write" | "decision" | "external_api";
  timestamp: timestamp;
  duration_ms: number;

  // For LLM calls
  llm?: {
    model: string;
    prompt_preview: string;      // First 200 chars (for debugging)
    response_preview: string;    // First 200 chars
    tokens: { input: number; output: number };
    cost_usd: number;
  };

  // For tool calls
  tool?: {
    name: string;
    args: Record<string, any>;
    result_preview: string;
    success: boolean;
    error?: string;
  };

  // For memory operations
  memory?: {
    operation: "read" | "write" | "search" | "delete";
    namespace: string;
    key?: string;
    query?: string;
    result_count?: number;
  };

  // For external API calls
  external_api?: {
    service: string;
    endpoint: string;
    status_code: number;
    latency_ms: number;
    cached: boolean;
  };

  // For decisions
  decision?: {
    decision_point: string;
    options_considered: string[];
    selected: string;
    reasoning: string;
  };
}
```

### 10.3 Sync Debugging

```typescript
interface SyncLog {
  log_id: string;
  device_id: string;
  peer_device_id?: string;
  timestamp: timestamp;

  event_type:
    | "sync_started"
    | "sync_completed"
    | "conflict_detected"
    | "conflict_resolved"
    | "connection_established"
    | "connection_failed"
    | "connection_lost"
    | "data_corrupted"
    | "queue_overflow";

  details: {
    sync?: {
      direction: "push" | "pull" | "bidirectional";
      records_sent: number;
      records_received: number;
      bytes_transferred: number;
      latency_ms: number;
    };

    conflict?: {
      namespace: string;
      key: string;
      local_value_preview: string;
      remote_value_preview: string;
      local_timestamp: timestamp;
      remote_timestamp: timestamp;
      resolution: "local_wins" | "remote_wins" | "merged" | "manual";
      resolution_reason: string;
    };

    connection?: {
      peer_count: number;
      connection_type: "direct_p2p" | "relayed" | "cloud_backup";
      nat_type?: string;
    };

    error?: {
      type: string;
      message: string;
      recoverable: boolean;
      recovery_action?: string;
    };
  };
}

// Conflict notification levels (by namespace sensitivity)
const CONFLICT_NOTIFICATION_RULES: Record<string, "silent" | "toast" | "modal"> = {
  "ownyou.earnings": "modal",           // Financial data - always alert user
  "ownyou.missions": "toast",           // Mission state - inform but don't block
  "ownyou.semantic": "silent",          // Memories - auto-resolve silently
  "ownyou.episodic": "silent",
  "ownyou.iab": "silent",
  "ownyou.ikigai": "toast",             // Profile changes - user should know
  "ownyou.preferences": "toast",
};
```

### 10.4 LLM Cost Metering Dashboard

```typescript
interface LLMMetrics {
  current_period: {
    period_type: "daily" | "monthly";
    period_start: timestamp;
    total_cost_usd: number;
    budget_limit_usd: number;
    budget_remaining_usd: number;
    budget_used_percent: number;
    throttle_state: "normal" | "warning" | "reduced" | "deferred" | "local_only";
  };

  by_agent: Record<string, {
    tokens: number;
    cost_usd: number;
    calls: number;
    avg_latency_ms: number;
  }>;

  by_operation: Record<string, {
    tokens: number;
    cost_usd: number;
    calls: number;
  }>;

  by_model: Record<string, {
    tokens: number;
    cost_usd: number;
    calls: number;
  }>;

  by_day: Array<{
    date: string;
    cost_usd: number;
    calls: number;
  }>;

  projections: {
    projected_monthly_cost: number;
    days_until_budget_exceeded: number | null;
    recommendation: "on_track" | "reduce_usage" | "critical";
  };

  alerts: Array<{
    timestamp: timestamp;
    type: "info" | "warning" | "throttled" | "budget_exceeded";
    message: string;
    acknowledged: boolean;
  }>;
}
```

### 10.5 Debug UI Components

#### 10.5.1 Agent Inspector (Settings → Debug → Agent Inspector)

```typescript
interface AgentInspectorView {
  recent_traces: AgentTrace[];
  total_traces: number;

  filters: {
    agent_type?: string;
    status?: "completed" | "failed" | "timeout";
    date_range?: [timestamp, timestamp];
    min_duration_ms?: number;
    min_cost_usd?: number;
  };

  selected_trace?: {
    trace: AgentTrace;
    expanded_steps: number[];
  };

  actions: {
    replay_trace: (trace_id: string) => Promise<void>;
    export_trace: (trace_id: string) => Promise<Blob>;
    delete_traces: (trace_ids: string[]) => Promise<void>;
  };
}
```

#### 10.5.2 Sync Monitor (Settings → Debug → Sync Monitor)

```typescript
interface SyncMonitorView {
  connection: {
    status: "connected" | "disconnected" | "connecting" | "error";
    peer_count: number;
    last_sync: timestamp;
    next_scheduled_sync: timestamp;
    connection_type: "direct_p2p" | "relayed" | "offline";
  };

  recent_logs: SyncLog[];

  pending_operations: {
    count: number;
    oldest: timestamp;
    namespaces_affected: string[];
  };

  pending_conflicts: Array<{
    namespace: string;
    key: string;
    local_preview: string;
    remote_preview: string;
    local_timestamp: timestamp;
    remote_timestamp: timestamp;
    resolve: (choice: "local" | "remote" | "manual") => Promise<void>;
  }>;

  actions: {
    force_sync: () => Promise<void>;
    clear_queue: () => Promise<void>;
    reconnect: () => Promise<void>;
  };
}
```

#### 10.5.3 Cost Dashboard (Settings → Debug → LLM Costs)

```typescript
interface CostDashboardView {
  metrics: LLMMetrics;

  charts: {
    daily_costs: Array<{ date: string; cost: number }>;
    by_agent_pie: Array<{ agent: string; cost: number }>;
    by_model_bar: Array<{ model: string; cost: number }>;
  };

  controls: {
    set_monthly_budget: (amount: number) => Promise<void>;
    acknowledge_alert: (alert_id: string) => Promise<void>;
    reset_period_stats: () => Promise<void>;
  };
}
```

### 10.6 User Data Export (GDPR Compliance)

```typescript
interface DataExport {
  format: "json" | "csv";

  includes: {
    memories: boolean;
    profile: boolean;
    missions: boolean;
    preferences: boolean;
    earnings: boolean;
    consents: boolean;
    agent_traces: boolean;
    sync_logs: boolean;
    llm_usage: boolean;
  };

  date_range?: {
    start: timestamp;
    end: timestamp;
  };

  export_all: () => Promise<Blob>;
  export_selected: (includes: Partial<DataExport["includes"]>) => Promise<Blob>;

  // GDPR Right to be Forgotten
  delete_all: () => Promise<{
    deleted_records: number;
    namespaces_cleared: string[];
    confirmation_id: string;
  }>;
}
```

### 10.7 Observability Store Namespaces

```typescript
const OBSERVABILITY_NAMESPACES = {
  agent_traces: (userId: string) => ["ownyou.debug.traces", userId],
  sync_logs: (deviceId: string) => ["ownyou.debug.sync", deviceId],
  llm_metrics: (userId: string) => ["ownyou.debug.llm", userId],
  error_logs: (userId: string) => ["ownyou.debug.errors", userId],
  audit_log: (userId: string) => ["ownyou.debug.audit", userId],
};

// Retention policy (auto-cleanup)
const DEBUG_RETENTION_DAYS = {
  agent_traces: 30,
  sync_logs: 14,
  llm_metrics: 90,
  error_logs: 7,
  audit_log: 365,
};
```

### 10.8 Privacy-Preserving Debugging

All debug data follows the same privacy principles as user data:

1. **Local-only storage** - Debug logs never leave the device unless user explicitly exports
2. **Encrypted at rest** - Same encryption as all other Store data
3. **User-controlled retention** - Users can clear debug data anytime
4. **No telemetry** - OwnYou never receives debug data automatically
5. **Previews only** - Full prompts/responses are truncated to prevent sensitive data in logs

```typescript
const sanitizeForTrace = (content: string, maxLength: number = 200): string => {
  const truncated = content.length > maxLength
    ? content.substring(0, maxLength) + "..."
    : content;

  // Redact potential PII patterns
  return truncated
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[CARD]")
    .replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, "[SSN]");
};
```

---

## 11. Critical Path Dependencies

```
Phase 0 (DONE)
    │
    ▼
Phase 1 (Foundation) ───────────────────────────────────────┐
    │                                                        │
    ├──────────────────────────────────────────────────────┐ │
    │              PHASE 2 (Parallel Development)          │ │
    │  ┌──────────────┬──────────────┬──────────────────┐  │ │
    │  │              │              │                  │  │ │
    │  ▼              ▼              ▼                  │  │ │
    │  Track A     Track B       Track C               │  │ │
    │  (Data +     (Agents +     (BBS+ +               │  │ │
    │   Ikigai)    Triggers)     SDKs)                 │  │ │
    │  │              │              │                  │  │ │
    │  └──────────────┴──────────────┴──────────────────┘  │ │
    └──────────────────────────────────────────────────────┘ │
                                                             │
                    Phase 3 (Integration + UI) ◄─────────────┘
                              │
                              ▼
                    Phase 4 (Production + Demo)
```

---

## 12. Success Metrics (Updated)

### 12.1 Technical Metrics

| Metric                     | Target                                            |
| -------------------------- | ------------------------------------------------- |
| **Reliability**      | 99% uptime for desktop app                        |
| **Performance**      | Mission execution <30s for 90% of simple missions |
| **Cost**             | <$10/user/month average LLM spend                 |
| **Sync**             | Profile sync latency <5s between devices          |
| **IAB Accuracy**     | >80% classification accuracy                      |
| **Fraud Prevention** | <1% fraudulent conversions                        |

### 12.2 Product Metrics (Post-MVP)

| Metric                     | Target                                     |
| -------------------------- | ------------------------------------------ |
| **Engagement**       | User opens app 3x/week                     |
| **Mission Utility**  | 60% of mission cards get user interaction  |
| **Ikigai Alignment** | Average alignment score >0.6 after 30 days |
| **Retention**        | 40% DAU/MAU ratio                          |
| **Monetization**     | 20% of users enable Publisher SSO          |
| **Revenue**          | $5/month average per monetizing user       |

---

## 13. Migration from v11 → v12 → v13

### 13.1 v12 → v13 Changes (This Version)

| Area                       | v12                      | v13                                                      |
| -------------------------- | ------------------------ | -------------------------------------------------------- |
| **LLM Cost Management** | Mentioned as target | Full enforcement: budget policy, throttling, model tiers |
| **Error Handling** | Implicit | Explicit: circuit breakers, fallback chains, partial data |
| **Agent Specifications** | Deferred to catalog | Complete matrix: tools, permissions, external APIs |
| **Observability** | Minimal | Full: agent traces, sync logs, cost dashboard, GDPR export |
| **Privacy Enforcement** | canAccessMemory only | Explicit wrapper with audit logging |

### 13.2 v11 → v12 Key Changes

| Area                       | v11                      | v12                                                      |
| -------------------------- | ------------------------ | -------------------------------------------------------- |
| **Ikigai**           | Mentioned, not specified | Full Intelligence Layer with hybrid architecture         |
| **Mission Triggers** | Implicit                 | Explicit 4-mode system (Data, Schedule, Event, User)     |
| **Consumer UI**      | "PWA Consumer UI"        | Full implementation plan with component library          |
| **Sync**             | "OrbitDB sync"           | Complete architecture: offline, P2P, encryption          |
| **Decentralization** | Vague mention            | Explicit ledger with compromises and migration paths     |
| **Publisher SDK**    | SSO flow diagram         | Complete SDK with Prebid.js adapter                      |
| **Advertiser SDK**   | Not detailed             | Complete SDK with conversion tracking + fraud prevention |
| **Demo**             | Not mentioned            | Full demo environment (publisher + advertiser)           |

### 13.3 What's Preserved from v11

- ✅ Phase structure (0-4 with parallel tracks)
- ✅ Memory architecture (LangGraph Store)
- ✅ OAuth strategy (Tauri 90-day)
- ✅ Technology stack
- ✅ 6 MVP Mission Agents
- ✅ 4 MVP Data Sources
- ✅ BBS+ on Solana
- ✅ Revenue split (70/20/10)

---

## 14. Next Steps

After document approval:

1. **Create Mission Agent Catalog** (`docs/reference/MISSION_AGENT_CATALOG.md`)

   - Detailed specs for all 6 MVP agents
   - External APIs, Store namespaces, triggers, card structures
2. **Create Ikigai Intelligence Spec** (`docs/reference/IKIGAI_INTELLIGENCE_SPEC.md`)

   - Continuous Agent implementation
   - Dimension scoring algorithms
   - Evidence chain structure
3. **Create Publisher SDK Guide** (`docs/sdk/PUBLISHER_SDK.md`)

   - Integration instructions
   - Prebid.js adapter configuration
   - Consent UI customization
4. **Create Advertiser SDK Guide** (`docs/sdk/ADVERTISER_SDK.md`)

   - Integration instructions
   - Conversion tracking implementation
   - Fraud prevention configuration
5. **Archive Previous Roadmaps**

   - Mark v11 as superseded by v12
   - Keep for historical reference
6. **Begin Phase 1 Implementation**

   - Tauri 2.0 scaffolding
   - Custom protocol OAuth
   - Contract specifications

---

**Document Status:** Architecture v12 - DRAFT PENDING APPROVAL
**Date:** November 2025
**Supersedes:** v11

**Next Review:** After user approval

---

## Appendix A: Glossary

| Term                           | Definition                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| **BBS+**                 | Boneh-Boyen-Shacham signature scheme enabling selective disclosure                              |
| **Circuit Breaker**      | Pattern that prevents cascading failures by stopping requests to failing services               |
| **Episode**              | Complete interaction record (situation/reasoning/action/outcome) for few-shot learning         |
| **Graceful Degradation** | Providing reduced functionality when full capability is unavailable                             |
| **Ikigai**               | Japanese concept of "reason for being" - intersection of passion, mission, vocation, profession |
| **LangGraph Store**      | Key-value memory abstraction with namespace-based organization                                  |
| **Mission Agent**        | AI agent that generates actionable tasks (Mission Cards) for users                              |
| **Mission Card**         | UI component representing a single mission with actions                                         |
| **OrbitDB**              | P2P database built on IPFS using CRDTs for sync                                                 |
| **Procedural Rule**      | Agent-specific behavioral rule derived from episode patterns (e.g., "user hates layovers")      |
| **Pseudonym**            | Context-specific identifier unlinkable across contexts                                          |
| **RRF**                  | Reciprocal Rank Fusion - algorithm for combining ranked lists without score normalization       |
| **Selective Disclosure** | Revealing only chosen attributes while proving possession of others                             |
| **TEE**                  | Trusted Execution Environment - hardware-isolated secure processing (Intel TDX, NVIDIA H100)    |
| **Throttling**           | Reducing system capacity to prevent budget/resource exhaustion                                  |

## Appendix B: External API Dependencies

| Service             | Use Case                  | Phase           |
| ------------------- | ------------------------- | --------------- |
| Plaid               | Financial account linking | Phase 2 Track A |
| SerpAPI             | Product search            | Phase 2 Track B |
| Tripadvisor         | Travel/Restaurant data    | Phase 2 Track B |
| Ticketmaster        | Event discovery           | Phase 2 Track B |
| Google Calendar API | Calendar sync             | Phase 2 Track A |
| Microsoft Graph API | Outlook/Calendar sync     | Phase 1         |
| OpenAI/Anthropic    | LLM inference             | All phases      |
| Solana              | Payments/Identity         | Phase 2 Track C |
