# Sprint 6: Ikigai Intelligence Layer

**Duration:** 3 weeks
**Status:** 🔲 PLANNED
**Goal:** Implement well-being-based mission prioritization through signal-based Ikigai inference
**Success Criteria:** Ikigai profile generated from user data, 4 dimensions scored independently, missions prioritized by well-being value, Ikigai points awarded with multipliers
**Depends On:** Sprint 5 complete (Resilience + Trigger System)

---

## Previous Sprint Summary

### Sprint 5: Resilience + Trigger System (COMPLETE)
- `@ownyou/resilience` — Circuit breakers, LLM fallback chain, partial data, error states (95 tests)
- `@ownyou/triggers` — 4-mode trigger system, agent coordinator (74 tests)
- `@ownyou/integration-tests` — Trigger-to-mission flow validation (58 tests)
- Total: 227 tests

**Current State:**
- Resilience patterns protect all external APIs
- 7-level LLM fallback chain operational
- 4-mode trigger system (data/scheduled/event/user) working
- Agent Coordinator routes triggers to correct agents
- Shopping and Content agents operational with memory learning
- **No Ikigai intelligence** - missions not prioritized by well-being
- **No well-being scoring** - all missions ranked by utility only
- **No Ikigai points/rewards** - no gamification for well-being alignment

---

## Sprint 6 Overview

```
+------------------------------------------------------------------+
|                     SPRINT 6 END STATE                            |
+------------------------------------------------------------------+
|                                                                   |
|  DATA SOURCES (existing):                                         |
|  +----------------+  +----------------+  +----------------+       |
|  | Email          |  | Transactions   |  | Browser History|       |
|  | (IAB)          |  | (Future)       |  | (Future)       |       |
|  +-------+--------+  +----------------+  +----------------+       |
|          |                                                        |
|          v                                                        |
|  WEEK 1: IKIGAI INFERENCE                                         |
|  +----------------------------------------------------------+     |
|  |           PARALLEL LLM INFERENCE (4 prompts)             |     |
|  |                                                          |     |
|  | +-------------+ +-------------+ +-------------+ +-------+|     |
|  | | EXPERIENCES | |RELATIONSHIPS| | INTERESTS   | | GIVING||     |
|  | | Prompt      | | Prompt      | | Prompt      | | Prompt||     |
|  | +-------------+ +-------------+ +-------------+ +-------+|     |
|  +-------------------------+--------------------------------+     |
|                            |                                      |
|                            v                                      |
|  WEEK 2: SYNTHESIS + STORAGE                                      |
|  +----------------------------------------------------------+     |
|  |             IKIGAI SYNTHESIS PROMPT                       |     |
|  |  Combines all dimension outputs into unified profile      |     |
|  +-------------------------+--------------------------------+     |
|                            |                                      |
|                            v                                      |
|  +----------------+  +------------------+  +------------------+   |
|  | Ikigai Profile |  | Evidence Chains  |  | Key People       |   |
|  | (semanticMem)  |  | (per dimension)  |  | (entities NS)    |   |
|  +-------+--------+  +------------------+  +------------------+   |
|          |                                                        |
|          v                                                        |
|  WEEK 3: MISSION INTEGRATION                                      |
|  +----------------------------------------------------------+     |
|  |                MISSION PRIORITIZATION                     |     |
|  |  utility_score + experience_boost + relationship_boost    |     |
|  |  + interest_alignment = total_well_being_score            |     |
|  +----------------------------------------------------------+     |
|  |                   IKIGAI REWARDS                          |     |
|  |  base_points * multiplier (experience: 2x, giving: 2.5x)  |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  MISSIONS RANKED BY WELL-BEING VALUE                              |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture Compliance

### Target Sections: v13 Section 2 (Complete Ikigai)

| v13 Section | Requirement | Sprint 6 Implementation | Priority |
|-------------|-------------|-------------------------|----------|
| **2.1** | Signal-Based Inference Architecture | Parallel LLM prompts extracting from user data | P0 |
| **2.2** | Ikigai Dimensions (4) | Experiences, Relationships, Interests, Giving | P0 |
| **2.3** | Store Schema: ikigai namespace | IkigaiProfile stored in semanticMemory | P0 |
| **2.4** | LLM-Based Ikigai Inference (4 parallel prompts + synthesis) | 4 dimension prompts + synthesis prompt | P0 |
| **2.5** | Batch Processing Configuration | Configurable batch window and thresholds | P0 |
| **2.6** | Mission Prioritization (well-being value scoring) | MissionWellBeingScore calculation | P0 |
| **2.7** | Ikigai Points & Rewards | Point multipliers by dimension | P1 |
| **2.9** | Ikigai-Memory Integration | Storage flow to appropriate namespaces | P0 |

### Already Complete (from previous sprints)

| v13 Section | Requirement | Status |
|-------------|-------------|--------|
| **2.8** | Mission Card Ikigai Feedback (heart states) | ✅ Sprint 3 |

### v13 Compliance Analysis

**Gaps Identified and Resolved:**

| Gap | v13 Section | Resolution |
|-----|-------------|------------|
| Section 2.9 defines 6 dimensions, Section 2.2 defines 4 | 2.2, 2.9 | Use 4-prompt inference (2.2), map to 6-dimension storage (2.9) |
| `Person` interface missing `sharedInterests` | 2.3 | Added `sharedInterests` field to match v13 |
| Synthesis prompt missing `missionFeedbackContext` | 2.4 | Added `MissionFeedbackContext` parameter |
| Storage flow must write to multiple namespaces | 2.9 | Profile→semanticMemory, People→entities, Profession→iabClassifications |
| MissionCard missing `ikigaiDimensions`, `ikigaiAlignmentBoost` | 3.4 | Added to `@ownyou/shared-types` update |

**Convention:** Both v13 and codebase now use **camelCase** for all TypeScript properties.

**Cross-Section Dependencies:**

| Sprint 6 Deliverable | v13 Section | Dependencies |
|---------------------|-------------|--------------|
| MissionCard.ikigaiDimensions | 3.4 | Requires IkigaiProfile to tag missions |
| MissionCard.ikigaiAlignmentBoost | 3.4 | Requires well-being scoring (2.6) |
| ikigaiDerived in iabClassifications | 2.9 | Required for BBS+ pseudonym relevance (Section 7) |
| Entity sync for key people | 2.9 | Required by Travel/Restaurant agents (3.6) |

**v13 2.9 Storage Flow Compliance:**

```typescript
// 1. Core profile → semanticMemory
store.put(NS.semanticMemory(userId), "ikigai_profile", {...})

// 2. Key people → entities (cross-mission reference)
store.put(NS.entities(userId), "person:sarah_jones", {...})

// 3. Profession → IAB alignment (for ad relevance)
store.put(NS.iabClassifications(userId), "ikigai_derived", {...})
```

---

## Deliverables

| # | Deliverable | Priority | Status | Acceptance Criteria |
|---|-------------|----------|--------|---------------------|
| 1 | Ikigai Inference Engine | P0 | 🔲 | 4 parallel dimension prompts execute successfully |
| 2 | Experiences Dimension Prompt | P0 | 🔲 | Extracts activities, frequency, patterns from data |
| 3 | Relationships Dimension Prompt | P0 | 🔲 | Identifies key people and relationship strengths |
| 4 | Interests Dimension Prompt | P0 | 🔲 | Detects genuine interests vs obligations |
| 5 | Giving Dimension Prompt | P0 | 🔲 | Finds charitable giving and care patterns |
| 6 | Ikigai Synthesis Prompt | P0 | 🔲 | Combines dimensions into unified profile |
| 7 | Evidence Chain Storage | P0 | 🔲 | Links Ikigai signals to source data |
| 8 | Mission Well-Being Scoring | P0 | 🔲 | Missions scored with experience/relationship boosts |
| 9 | Ikigai Points & Rewards | P1 | 🔲 | Point multipliers implemented (2x/1.5x/2.5x) |
| 10 | Batch Processing | P0 | 🔲 | Configurable batch window (daily/weekly) |
| 11 | Integration Tests | P1 | 🔲 | Ikigai inference flow validated end-to-end |

---

## Week 1: Ikigai Inference Engine

### Package: `@ownyou/ikigai`

#### File Structure

```
packages/
+-- ikigai/                              # NEW: Ikigai intelligence
|   +-- src/
|   |   +-- index.ts
|   |   +-- engine/
|   |   |   +-- inference-engine.ts      # Main orchestrator
|   |   |   +-- batch-processor.ts       # Batch window management
|   |   |   +-- data-sanitizer.ts        # Prepare data for LLM
|   |   +-- prompts/
|   |   |   +-- experiences.ts           # Experiences dimension prompt
|   |   |   +-- relationships.ts         # Relationships dimension prompt
|   |   |   +-- interests.ts             # Interests dimension prompt
|   |   |   +-- giving.ts                # Giving dimension prompt
|   |   |   +-- synthesis.ts             # Combine all dimensions
|   |   +-- scoring/
|   |   |   +-- well-being-score.ts      # Mission prioritization
|   |   |   +-- rewards.ts               # Ikigai points calculation
|   |   +-- storage/
|   |   |   +-- profile-store.ts         # IkigaiProfile persistence
|   |   |   +-- evidence-store.ts        # Evidence chain storage
|   |   |   +-- entity-sync.ts           # Sync people to entities NS
|   |   +-- types.ts
|   +-- __tests__/
|   |   +-- engine.test.ts
|   |   +-- prompts.test.ts
|   |   +-- scoring.test.ts
|   |   +-- storage.test.ts
|   +-- PACKAGE.md
|   +-- package.json
```

#### 1. Core Types (v13 Section 2.3)

**IMPORTANT: v13 Section 2.9 defines additional Ikigai dimensions not in Section 2.2:**

| v13 2.9 Dimension | Description | Storage Namespace |
|-------------------|-------------|-------------------|
| **Passion** | interests, hobbies, creative_outlets | `semanticMemory` |
| **Mission** | causes, values, impact_areas | `semanticMemory` |
| **Vocation** | skills, expertise, certifications | `semanticMemory` + `entities` |
| **Profession** | job_title, industry, income_bracket | `semanticMemory` + `iab_classifications` |
| **Relationships** | key_people, relationship_types | `entities` |
| **Well-being** | health_goals, stress_indicators | `semanticMemory` (privacy-protected) |

**Design Decision:** Section 2.2 defines 4 dimensions (Experiences, Relationships, Interests, Giving) for inference prompts, while Section 2.9 maps to 6 storage dimensions. We use 2.2's 4-prompt structure for inference, then map outputs to 2.9's storage structure during synthesis.

```typescript
// packages/ikigai/src/types.ts

import type { PrivacyTier } from '@ownyou/shared-types';

/**
 * Ikigai Profile - v13 Section 2.3 + 2.9
 *
 * Stored in semanticMemory namespace with key "ikigai_profile"
 *
 * v13 2.9 Storage Flow:
 * - Core profile → semanticMemory (NS.semanticMemory(userId), "ikigai_profile")
 * - Key people → entities (NS.entities(userId), "person:*")
 * - Professional → iab_classifications (NS.iabClassifications(userId), "ikigai_derived")
 */
export interface IkigaiProfile {
  userId: string;
  updatedAt: number;

  // Inferred from data via LLM prompts (v13 2.2 - 4 dimensions)
  experiences: ExperiencesDimension;
  relationships: RelationshipsDimension;
  interests: InterestsDimension;
  giving: GivingDimension;

  // v13 2.9 additional mapped dimensions
  passion?: PassionDimension;       // Derived from interests + experiences
  mission?: MissionDimension;       // Derived from giving + interests
  vocation?: VocationDimension;     // Derived from profession signals
  profession?: ProfessionDimension; // Derived from emails + IAB
  wellBeing?: WellBeingDimension;   // Privacy-protected, derived from patterns

  // Weights for mission ranking (v13 2.6)
  dimensionWeights: DimensionWeights;

  // Evidence chain for transparency (v13 2.3)
  evidence: IkigaiEvidence[];

  // Overall profile confidence
  confidence: number;
}

/**
 * v13 2.9 - Passion dimension (mapped from interests + experiences)
 */
export interface PassionDimension {
  interests: string[];
  hobbies: string[];
  creativeOutlets: string[];
}

/**
 * v13 2.9 - Mission dimension (mapped from giving)
 */
export interface MissionDimension {
  causes: string[];
  values: string[];
  impactAreas: string[];
}

/**
 * v13 2.9 - Vocation dimension
 */
export interface VocationDimension {
  skills: string[];
  expertise: string[];
  certifications: string[];
}

/**
 * v13 2.9 - Profession dimension
 */
export interface ProfessionDimension {
  jobTitle?: string;
  industry?: string;
  incomeBracket?: 'low' | 'medium' | 'high' | 'unknown';
  confidence: number;
}

/**
 * v13 2.9 - Well-being dimension (privacy-protected)
 */
export interface WellBeingDimension {
  healthGoals: string[];
  stressIndicators: string[];
  privacyTier: 'private';  // Always private per v13 2.9
}

/**
 * Experiences Dimension - v13 2.2
 *
 * Activities that bring joy
 */
export interface ExperiencesDimension {
  preferredTypes: ExperienceType[];
  frequency: 'rare' | 'occasional' | 'frequent';
  recentActivities: Activity[];
  patterns: ExperiencePatterns;
  confidence: number;
}

export type ExperienceType =
  | 'travel'
  | 'entertainment'
  | 'dining'
  | 'adventure'
  | 'learning'
  | 'creative'
  | 'social_gatherings'
  | 'outdoor'
  | 'wellness';

export interface Activity {
  type: ExperienceType;
  description: string;
  date: number;
  evidence: string;
}

export interface ExperiencePatterns {
  timing?: string;          // "weekends", "monthly", etc.
  companions?: string[];    // People they do activities with
  locations?: string[];     // Preferred locations
}

/**
 * Relationships Dimension - v13 2.2
 *
 * People who matter
 */
export interface RelationshipsDimension {
  keyPeople: Person[];
  socialFrequency: 'solo' | 'couple' | 'social' | 'very_social';
  relationshipInvestmentPatterns: string;
  confidence: number;
}

/**
 * Person entity - v13 Section 2.3
 *
 * Matches v13 Person interface exactly:
 * - name, relationship_strength, shared_interests, last_interaction
 */
export interface Person {
  name: string;
  relationshipType: 'family' | 'friend' | 'colleague' | 'partner' | 'other';
  interactionFrequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  sharedInterests: string[];      // v13: "What they do together"
  sharedActivities: string[];     // Additional detail
  relationshipStrength: number;   // v13: "Based on interaction frequency" (0.0-1.0)
  lastInteraction?: number;       // v13: last_interaction timestamp
  evidence: string;
}

/**
 * Interests Dimension - v13 2.2
 *
 * Recurring passions
 */
export interface InterestsDimension {
  genuineInterests: Interest[];
  hobbies: string[];
  learningInterests: string[];
  confidence: number;
}

export interface Interest {
  topic: string;
  evidenceType: 'purchases' | 'content' | 'activities' | 'emails';
  engagementDepth: 'casual' | 'moderate' | 'deep';
  evidence: string;
}

/**
 * Giving Dimension - v13 2.2
 *
 * Contribution to others
 */
export interface GivingDimension {
  charitableGiving: CharitableActivity[];
  giftGiving: GiftGivingPattern;
  volunteering: string[];
  carePatterns: string;
  confidence: number;
}

export interface CharitableActivity {
  cause: string;
  frequency: string;
  evidence: string;
}

export interface GiftGivingPattern {
  frequency: 'rare' | 'occasional' | 'frequent';
  recipients: string[];
}

/**
 * Dimension Weights - for mission ranking
 */
export interface DimensionWeights {
  experiences: number;       // 0-1, based on historical engagement
  relationships: number;
  interests: number;
  giving: number;
}

/**
 * Evidence Chain - v13 2.3
 *
 * Links Ikigai signals to source data
 */
export interface IkigaiEvidence {
  dimension: 'experiences' | 'relationships' | 'interests' | 'giving';
  sourceType: 'email' | 'transaction' | 'calendar' | 'browser';
  sourceId: string;
  signalStrength: number;   // 0.0-1.0
  extractedAt: number;
  summary: string;
}

/**
 * Inference Configuration - v13 Section 2.5
 */
export interface IkigaiInferenceConfig {
  // Batch window for efficiency
  batchWindow: 'daily' | 'weekly';

  // Minimum new items before triggering inference
  minItemsThreshold: number;

  // Run all 4 dimension prompts in parallel
  parallelInference: boolean;

  // Time window for data consideration
  dataWindowDays: number;

  // Model selection (user configurable)
  modelTier: 'fast' | 'standard' | 'quality';
}

/**
 * Mission Well-Being Score - v13 Section 2.6
 */
export interface MissionWellBeingScore {
  // Core practical value (always present)
  utilityScore: number;           // 0-1: How useful is this mission?

  // Ikigai enhancement (optional boost)
  experienceBoost: number;        // 0-0.5: Does this create an experience?
  relationshipBoost: number;      // 0-0.5: Does this involve key people?
  interestAlignment: number;      // 0-0.3: Does this match their interests?

  // Giving boost (special case)
  givingBoost: number;            // 0-0.3: Is this charitable/gift-related?

  // Final ranking score
  totalScore: number;             // utility + boosts, capped at 2.0
}

/**
 * Ikigai Rewards - v13 Section 2.7
 */
export interface IkigaiRewards {
  basePoints: number;             // Default: 100

  // Multipliers
  experienceMultiplier: number;   // 2.0x for experiences
  relationshipMultiplier: number; // 1.5x when involves key people
  givingMultiplier: number;       // 2.5x for charitable/gift missions

  // Point categories (visible to user)
  categories: {
    explorer: number;             // Experience points
    connector: number;            // Relationship points
    helper: number;               // Giving points
    achiever: number;             // Utility points
  };
}
```

#### 2. Inference Engine

```typescript
// packages/ikigai/src/engine/inference-engine.ts

import type { LLMClient } from '@ownyou/llm-client';
import type { MemoryStore } from '@ownyou/memory-store';
import type {
  IkigaiProfile,
  IkigaiInferenceConfig,
  ExperiencesDimension,
  RelationshipsDimension,
  InterestsDimension,
  GivingDimension,
  IkigaiEvidence,
} from '../types';
import { experiencesPrompt, parseExperiencesResponse } from '../prompts/experiences';
import { relationshipsPrompt, parseRelationshipsResponse } from '../prompts/relationships';
import { interestsPrompt, parseInterestsResponse } from '../prompts/interests';
import { givingPrompt, parseGivingResponse } from '../prompts/giving';
import { synthesisPrompt, parseSynthesisResponse } from '../prompts/synthesis';
import { sanitizeDataForLLM } from './data-sanitizer';
import { storeIkigaiProfile, getExistingProfile } from '../storage/profile-store';
import { storeEvidence } from '../storage/evidence-store';
import { syncPeopleToEntities } from '../storage/entity-sync';

const DEFAULT_CONFIG: IkigaiInferenceConfig = {
  batchWindow: 'daily',
  minItemsThreshold: 10,
  parallelInference: true,
  dataWindowDays: 90,
  modelTier: 'standard',
};

/**
 * Ikigai Inference Engine - v13 Section 2.1
 *
 * Orchestrates the 4 parallel dimension prompts + synthesis.
 */
export class IkigaiInferenceEngine {
  private config: IkigaiInferenceConfig;
  private llm: LLMClient;
  private store: MemoryStore;

  constructor(
    llm: LLMClient,
    store: MemoryStore,
    config: Partial<IkigaiInferenceConfig> = {}
  ) {
    this.llm = llm;
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run full Ikigai inference pipeline
   *
   * v13 2.4: "4 parallel prompts + synthesis"
   */
  async runInference(userId: string): Promise<IkigaiProfile> {
    // 1. Gather data from Store
    const rawData = await this.gatherUserData(userId);

    // 2. Sanitize data for LLM (remove PII, summarize)
    const sanitizedData = await sanitizeDataForLLM(rawData, this.config.dataWindowDays);

    // 3. Get existing profile for context
    const existingProfile = await getExistingProfile(userId, this.store);

    // 4. Run 4 dimension prompts in parallel (v13 2.4)
    const [experiences, relationships, interests, giving] = await Promise.all([
      this.inferExperiences(sanitizedData, existingProfile),
      this.inferRelationships(sanitizedData, existingProfile),
      this.inferInterests(sanitizedData, existingProfile),
      this.inferGiving(sanitizedData, existingProfile),
    ]);

    // 5. Run synthesis prompt
    const profile = await this.synthesizeProfile(
      userId,
      experiences,
      relationships,
      interests,
      giving,
      existingProfile
    );

    // 6. Store results
    await storeIkigaiProfile(userId, profile, this.store);

    // 7. Sync key people to entities namespace
    await syncPeopleToEntities(userId, relationships.keyPeople, this.store);

    // 8. Store evidence chains
    const evidence = this.extractEvidence(
      experiences,
      relationships,
      interests,
      giving
    );
    await storeEvidence(userId, evidence, this.store);

    return profile;
  }

  /**
   * Infer Experiences dimension - v13 2.4 Prompt 1
   */
  private async inferExperiences(
    sanitizedData: string,
    existingProfile?: IkigaiProfile
  ): Promise<ExperiencesDimension> {
    const prompt = experiencesPrompt(
      sanitizedData,
      existingProfile?.experiences
    );

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseExperiencesResponse(response.content);
  }

  /**
   * Infer Relationships dimension - v13 2.4 Prompt 2
   */
  private async inferRelationships(
    sanitizedData: string,
    existingProfile?: IkigaiProfile
  ): Promise<RelationshipsDimension> {
    const prompt = relationshipsPrompt(
      sanitizedData,
      existingProfile?.relationships
    );

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseRelationshipsResponse(response.content);
  }

  /**
   * Infer Interests dimension - v13 2.4 Prompt 3
   */
  private async inferInterests(
    sanitizedData: string,
    existingProfile?: IkigaiProfile
  ): Promise<InterestsDimension> {
    const prompt = interestsPrompt(
      sanitizedData,
      existingProfile?.interests
    );

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseInterestsResponse(response.content);
  }

  /**
   * Infer Giving dimension - v13 2.4 Prompt 4
   */
  private async inferGiving(
    sanitizedData: string,
    existingProfile?: IkigaiProfile
  ): Promise<GivingDimension> {
    const prompt = givingPrompt(
      sanitizedData,
      existingProfile?.giving
    );

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    return parseGivingResponse(response.content);
  }

  /**
   * Synthesize unified profile - v13 2.4 Prompt 5
   */
  private async synthesizeProfile(
    userId: string,
    experiences: ExperiencesDimension,
    relationships: RelationshipsDimension,
    interests: InterestsDimension,
    giving: GivingDimension,
    existingProfile?: IkigaiProfile
  ): Promise<IkigaiProfile> {
    const prompt = synthesisPrompt(
      experiences,
      relationships,
      interests,
      giving,
      existingProfile
    );

    const response = await this.llm.complete({
      model: this.getModel(),
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    const synthesized = parseSynthesisResponse(response.content);

    return {
      userId,
      updatedAt: Date.now(),
      experiences,
      relationships,
      interests,
      giving,
      dimensionWeights: synthesized.dimensionWeights,
      confidence: synthesized.overallConfidence,
      evidence: [], // Populated separately
    };
  }

  /**
   * Gather user data from Store namespaces
   */
  private async gatherUserData(userId: string): Promise<UserDataBundle> {
    // Get from relevant namespaces
    // For MVP, focus on email-derived IAB classifications
    // Future: financial, calendar, browser
    return {
      // Will expand as data sources are added
      iabClassifications: await this.store.list(`iab:${userId}`),
      emails: await this.store.list(`email:${userId}`),
      // financial: await this.store.list(`financial:${userId}`),
      // calendar: await this.store.list(`calendar:${userId}`),
    };
  }

  /**
   * Extract evidence from dimension outputs
   */
  private extractEvidence(
    experiences: ExperiencesDimension,
    relationships: RelationshipsDimension,
    interests: InterestsDimension,
    giving: GivingDimension
  ): IkigaiEvidence[] {
    const evidence: IkigaiEvidence[] = [];
    const now = Date.now();

    // Extract from experiences
    for (const activity of experiences.recentActivities) {
      evidence.push({
        dimension: 'experiences',
        sourceType: 'email', // For MVP
        sourceId: activity.evidence,
        signalStrength: experiences.confidence,
        extractedAt: now,
        summary: `${activity.type}: ${activity.description}`,
      });
    }

    // Extract from relationships
    for (const person of relationships.keyPeople) {
      evidence.push({
        dimension: 'relationships',
        sourceType: 'email',
        sourceId: person.evidence,
        signalStrength: person.relationshipStrength,
        extractedAt: now,
        summary: `${person.name} (${person.relationshipType})`,
      });
    }

    // Extract from interests
    for (const interest of interests.genuineInterests) {
      evidence.push({
        dimension: 'interests',
        sourceType: interest.evidenceType === 'emails' ? 'email' : 'browser',
        sourceId: interest.evidence,
        signalStrength: interests.confidence,
        extractedAt: now,
        summary: `${interest.topic} (${interest.engagementDepth})`,
      });
    }

    // Extract from giving
    for (const charity of giving.charitableGiving) {
      evidence.push({
        dimension: 'giving',
        sourceType: 'email',
        sourceId: charity.evidence,
        signalStrength: giving.confidence,
        extractedAt: now,
        summary: `${charity.cause}: ${charity.frequency}`,
      });
    }

    return evidence;
  }

  private getModel(): string {
    switch (this.config.modelTier) {
      case 'fast':
        return 'gpt-4o-mini';
      case 'standard':
        return 'gpt-4o';
      case 'quality':
        return 'claude-3-opus';
      default:
        return 'gpt-4o';
    }
  }
}

interface UserDataBundle {
  iabClassifications: Array<{ key: string; value: unknown }>;
  emails: Array<{ key: string; value: unknown }>;
}
```

#### 3. Dimension Prompts

```typescript
// packages/ikigai/src/prompts/experiences.ts

import type { ExperiencesDimension, ExperiencePatterns } from '../types';

/**
 * Experiences Inference Prompt - v13 Section 2.4 Prompt 1
 */
export function experiencesPrompt(
  sanitizedData: string,
  currentProfile?: ExperiencesDimension
): string {
  const currentProfileContext = currentProfile
    ? `
Current experiences profile:
- Preferred types: ${currentProfile.preferredTypes.join(', ')}
- Frequency: ${currentProfile.frequency}
- Recent activities: ${currentProfile.recentActivities.length} recorded
`
    : 'No previous profile exists.';

  return `You are analyzing a user's data to understand what experiences bring them joy.

Given the following data from the past 90 days:
${sanitizedData}

${currentProfileContext}

Identify:
1. What types of experiences does this person seek? (travel, entertainment, dining, adventure, learning, creative, social_gatherings, outdoor, wellness)
2. What new experiences are evident in this data?
3. How frequently do they pursue experiences vs. routine activities?
4. Any patterns in timing, location, or companions for experiences?

Return structured JSON:
{
  "preferredTypes": ["travel", "dining", ...],
  "frequency": "rare" | "occasional" | "frequent",
  "recentActivities": [
    {
      "type": "...",
      "description": "...",
      "date": <unix_timestamp>,
      "evidence": "<source_reference>"
    }
  ],
  "patterns": {
    "timing": "weekends" | "monthly" | "spontaneous" | null,
    "companions": ["name1", "name2"] | null,
    "locations": ["city1", "city2"] | null
  },
  "confidence": 0.0-1.0
}

Important:
- Only include experiences with clear evidence
- Be conservative with confidence scores
- Distinguish between routine activities and joy-bringing experiences`;
}

/**
 * Parse LLM response to ExperiencesDimension
 */
export function parseExperiencesResponse(content: string): ExperiencesDimension {
  try {
    const parsed = JSON.parse(content);

    return {
      preferredTypes: parsed.preferredTypes ?? [],
      frequency: parsed.frequency ?? 'occasional',
      recentActivities: (parsed.recentActivities ?? []).map((a: any) => ({
        type: a.type,
        description: a.description,
        date: a.date ?? Date.now(),
        evidence: a.evidence ?? '',
      })),
      patterns: {
        timing: parsed.patterns?.timing,
        companions: parsed.patterns?.companions,
        locations: parsed.patterns?.locations,
      },
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    };
  } catch {
    // Return default on parse error
    return {
      preferredTypes: [],
      frequency: 'occasional',
      recentActivities: [],
      patterns: {},
      confidence: 0,
    };
  }
}
```

```typescript
// packages/ikigai/src/prompts/relationships.ts

import type { RelationshipsDimension, Person } from '../types';

/**
 * Relationships Inference Prompt - v13 Section 2.4 Prompt 2
 */
export function relationshipsPrompt(
  sanitizedData: string,
  currentProfile?: RelationshipsDimension
): string {
  const currentProfileContext = currentProfile
    ? `
Current relationships profile:
- Key people: ${currentProfile.keyPeople.map(p => p.name).join(', ')}
- Social style: ${currentProfile.socialFrequency}
`
    : 'No previous profile exists.';

  return `You are analyzing a user's data to understand their important relationships.

Given the following data from the past 90 days:
${sanitizedData}

${currentProfileContext}

Identify:
1. Who are the key people in this person's life? (Look for recurring names in emails, calendar, shared activities, gifts)
2. What is the nature of each relationship? (family, friend, colleague, partner)
3. How does this person invest in relationships? (time together, gifts, shared experiences)
4. Any relationships that seem particularly meaningful based on interaction patterns?

Return structured JSON:
{
  "keyPeople": [
    {
      "name": "...",
      "relationshipType": "family" | "friend" | "colleague" | "partner" | "other",
      "interactionFrequency": "daily" | "weekly" | "monthly" | "occasional",
      "sharedActivities": ["..."],
      "relationshipStrength": 0.0-1.0,
      "evidence": "<source_reference>"
    }
  ],
  "socialFrequency": "solo" | "couple" | "social" | "very_social",
  "relationshipInvestmentPatterns": "...",
  "confidence": 0.0-1.0
}

Important:
- Only include people with multiple data points
- Infer relationship type from context clues
- Be conservative about relationship strength scores`;
}

/**
 * Parse LLM response to RelationshipsDimension
 */
export function parseRelationshipsResponse(content: string): RelationshipsDimension {
  try {
    const parsed = JSON.parse(content);

    return {
      keyPeople: (parsed.keyPeople ?? []).map((p: any) => ({
        name: p.name,
        relationshipType: p.relationshipType ?? 'other',
        interactionFrequency: p.interactionFrequency ?? 'occasional',
        sharedActivities: p.sharedActivities ?? [],
        relationshipStrength: Math.min(1, Math.max(0, p.relationshipStrength ?? 0.5)),
        evidence: p.evidence ?? '',
      })),
      socialFrequency: parsed.socialFrequency ?? 'social',
      relationshipInvestmentPatterns: parsed.relationshipInvestmentPatterns ?? '',
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    };
  } catch {
    return {
      keyPeople: [],
      socialFrequency: 'social',
      relationshipInvestmentPatterns: '',
      confidence: 0,
    };
  }
}
```

```typescript
// packages/ikigai/src/prompts/interests.ts

import type { InterestsDimension, Interest } from '../types';

/**
 * Interests Inference Prompt - v13 Section 2.4 Prompt 3
 */
export function interestsPrompt(
  sanitizedData: string,
  currentProfile?: InterestsDimension
): string {
  const currentProfileContext = currentProfile
    ? `
Current interests profile:
- Genuine interests: ${currentProfile.genuineInterests.map(i => i.topic).join(', ')}
- Hobbies: ${currentProfile.hobbies.join(', ')}
`
    : 'No previous profile exists.';

  return `You are analyzing a user's data to understand their genuine interests and passions.

Given the following data from the past 90 days:
${sanitizedData}

${currentProfileContext}

Identify:
1. What topics does this person engage with repeatedly? (not one-off purchases)
2. What hobbies or activities do they invest time and money in?
3. What content do they consume? (newsletters, browsing patterns)
4. Distinguish between genuine interests vs. obligations/necessities

Return structured JSON:
{
  "genuineInterests": [
    {
      "topic": "...",
      "evidenceType": "purchases" | "content" | "activities" | "emails",
      "engagementDepth": "casual" | "moderate" | "deep",
      "evidence": "<source_reference>"
    }
  ],
  "hobbies": ["..."],
  "learningInterests": ["..."],
  "confidence": 0.0-1.0
}

Important:
- Exclude work obligations and necessities
- Look for recurring patterns, not one-time occurrences
- Be conservative - only include interests with clear evidence`;
}

/**
 * Parse LLM response to InterestsDimension
 */
export function parseInterestsResponse(content: string): InterestsDimension {
  try {
    const parsed = JSON.parse(content);

    return {
      genuineInterests: (parsed.genuineInterests ?? []).map((i: any) => ({
        topic: i.topic,
        evidenceType: i.evidenceType ?? 'emails',
        engagementDepth: i.engagementDepth ?? 'casual',
        evidence: i.evidence ?? '',
      })),
      hobbies: parsed.hobbies ?? [],
      learningInterests: parsed.learningInterests ?? [],
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    };
  } catch {
    return {
      genuineInterests: [],
      hobbies: [],
      learningInterests: [],
      confidence: 0,
    };
  }
}
```

```typescript
// packages/ikigai/src/prompts/giving.ts

import type { GivingDimension, CharitableActivity, GiftGivingPattern } from '../types';

/**
 * Giving Inference Prompt - v13 Section 2.4 Prompt 4
 */
export function givingPrompt(
  sanitizedData: string,
  currentProfile?: GivingDimension
): string {
  const currentProfileContext = currentProfile
    ? `
Current giving profile:
- Charitable causes: ${currentProfile.charitableGiving.map(c => c.cause).join(', ')}
- Gift giving frequency: ${currentProfile.giftGiving.frequency}
`
    : 'No previous profile exists.';

  return `You are analyzing a user's data to understand how they contribute to others.

Given the following data from the past 90 days:
${sanitizedData}

${currentProfileContext}

Identify:
1. Does this person give to charitable causes? Which ones?
2. Do they buy gifts for others? For whom and how often?
3. Any evidence of volunteering or community involvement?
4. How do they show care for others through their actions?

Return structured JSON:
{
  "charitableGiving": [
    {
      "cause": "...",
      "frequency": "one-time" | "monthly" | "annual",
      "evidence": "<source_reference>"
    }
  ],
  "giftGiving": {
    "frequency": "rare" | "occasional" | "frequent",
    "recipients": ["..."]
  },
  "volunteering": ["..."],
  "carePatterns": "...",
  "confidence": 0.0-1.0
}

Important:
- Be specific about charitable causes
- Distinguish gifts from regular purchases
- Look for patterns of care and generosity`;
}

/**
 * Parse LLM response to GivingDimension
 */
export function parseGivingResponse(content: string): GivingDimension {
  try {
    const parsed = JSON.parse(content);

    return {
      charitableGiving: (parsed.charitableGiving ?? []).map((c: any) => ({
        cause: c.cause,
        frequency: c.frequency ?? 'one-time',
        evidence: c.evidence ?? '',
      })),
      giftGiving: {
        frequency: parsed.giftGiving?.frequency ?? 'occasional',
        recipients: parsed.giftGiving?.recipients ?? [],
      },
      volunteering: parsed.volunteering ?? [],
      carePatterns: parsed.carePatterns ?? '',
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    };
  } catch {
    return {
      charitableGiving: [],
      giftGiving: { frequency: 'occasional', recipients: [] },
      volunteering: [],
      carePatterns: '',
      confidence: 0,
    };
  }
}
```

```typescript
// packages/ikigai/src/prompts/synthesis.ts

import type {
  ExperiencesDimension,
  RelationshipsDimension,
  InterestsDimension,
  GivingDimension,
  IkigaiProfile,
  DimensionWeights,
} from '../types';

/**
 * Ikigai Synthesis Prompt - v13 Section 2.4 Prompt 5
 *
 * v13 requires: {mission_feedback_context} to incorporate recent feedback
 */
export function synthesisPrompt(
  experiences: ExperiencesDimension,
  relationships: RelationshipsDimension,
  interests: InterestsDimension,
  giving: GivingDimension,
  previousProfile?: IkigaiProfile,
  missionFeedback?: MissionFeedbackContext  // v13 2.4: Required feedback context
): string {
  const previousContext = previousProfile
    ? `
Previous ikigai profile:
- Dimension weights: Experiences=${previousProfile.dimensionWeights.experiences}, Relationships=${previousProfile.dimensionWeights.relationships}, Interests=${previousProfile.dimensionWeights.interests}, Giving=${previousProfile.dimensionWeights.giving}
- Last updated: ${new Date(previousProfile.updatedAt).toISOString()}
`
    : 'No previous profile exists.';

  // v13 2.4: Include mission feedback in synthesis
  const feedbackContext = missionFeedback
    ? `
Recent mission feedback from this user:
- Loved missions: ${missionFeedback.lovedMissions.join(', ') || 'None'}
- Liked missions: ${missionFeedback.likedMissions.join(', ') || 'None'}
- Dismissed missions: ${missionFeedback.dismissedMissions.join(', ') || 'None'}
- Patterns: ${missionFeedback.patterns || 'Not enough data'}
`
    : 'No recent mission feedback available.';

  return `You are synthesizing a user's ikigai profile from multiple data analyses.

Experiences analysis:
${JSON.stringify(experiences, null, 2)}

Relationships analysis:
${JSON.stringify(relationships, null, 2)}

Interests analysis:
${JSON.stringify(interests, null, 2)}

Giving analysis:
${JSON.stringify(giving, null, 2)}

${previousContext}

${feedbackContext}

Synthesize an updated ikigai profile:
1. What brings this person daily joy? (small, recurring pleasures)
2. Who matters most to them?
3. What are they genuinely passionate about?
4. How do they contribute to others?
5. What has changed since the last profile update?

Also synthesize dimension weights and overall confidence:
- Which dimensions show the strongest signals? (weight higher)
- Which dimensions lack data? (weight lower)
- How does mission feedback align with or contradict data signals?

Return structured JSON:
{
  "dimensionWeights": {
    "experiences": 0.0-1.0,
    "relationships": 0.0-1.0,
    "interests": 0.0-1.0,
    "giving": 0.0-1.0
  },
  "overallConfidence": 0.0-1.0,
  "changesSinceLastUpdate": "...",
  "dailyJoy": "...",
  "keyPeopleInsight": "...",
  "passionInsight": "...",
  "contributionInsight": "..."
}

Weighting guidelines:
- Sum of weights should approximately equal 1.0
- Weight by both signal strength AND user engagement history
- Low-data dimensions should have lower weights
- Mission feedback can boost/reduce dimension weights`;
}

/**
 * Mission Feedback Context - v13 Section 2.4
 *
 * Used in synthesis prompt to incorporate user signals
 */
export interface MissionFeedbackContext {
  lovedMissions: string[];      // Mission types user loved (2 taps)
  likedMissions: string[];      // Mission types user liked (1 tap or engaged)
  dismissedMissions: string[];  // Mission types user dismissed
  patterns?: string;            // Any observed patterns
}

export interface SynthesisResult {
  dimensionWeights: DimensionWeights;
  overallConfidence: number;
  changesSinceLastUpdate: string;
}

/**
 * Parse synthesis response
 */
export function parseSynthesisResponse(content: string): SynthesisResult {
  try {
    const parsed = JSON.parse(content);

    const weights = parsed.dimensionWeights ?? {};
    const normalizedWeights: DimensionWeights = {
      experiences: Math.min(1, Math.max(0, weights.experiences ?? 0.25)),
      relationships: Math.min(1, Math.max(0, weights.relationships ?? 0.25)),
      interests: Math.min(1, Math.max(0, weights.interests ?? 0.25)),
      giving: Math.min(1, Math.max(0, weights.giving ?? 0.25)),
    };

    return {
      dimensionWeights: normalizedWeights,
      overallConfidence: Math.min(1, Math.max(0, parsed.overallConfidence ?? 0.5)),
      changesSinceLastUpdate: parsed.changesSinceLastUpdate ?? '',
    };
  } catch {
    return {
      dimensionWeights: {
        experiences: 0.25,
        relationships: 0.25,
        interests: 0.25,
        giving: 0.25,
      },
      overallConfidence: 0.5,
      changesSinceLastUpdate: '',
    };
  }
}
```

---

## Week 2: Storage + Synthesis

### 4. Profile Storage (v13 2.9)

```typescript
// packages/ikigai/src/storage/profile-store.ts

import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import type { IkigaiProfile } from '../types';

const IKIGAI_PROFILE_KEY = 'ikigai_profile';

/**
 * Store Ikigai profile - v13 Section 2.9
 *
 * Stored in semanticMemory namespace for cross-agent access.
 */
export async function storeIkigaiProfile(
  userId: string,
  profile: IkigaiProfile,
  store: MemoryStore
): Promise<void> {
  // Store main profile
  await store.put(
    NS.semanticMemory(userId),
    IKIGAI_PROFILE_KEY,
    {
      ...profile,
      type: 'ikigai',
      lastUpdated: new Date().toISOString(),
    }
  );

  // Also store IAB-derived categories for ad relevance (v13 2.9)
  if (profile.interests.genuineInterests.length > 0) {
    await store.put(
      NS.iabClassifications(userId),
      'ikigai_derived',
      {
        derivedFrom: 'ikigai_inference',
        categories: profile.interests.genuineInterests.map(i => i.topic),
        confidence: profile.interests.confidence,
        updatedAt: Date.now(),
      }
    );
  }
}

/**
 * Get existing Ikigai profile
 */
export async function getExistingProfile(
  userId: string,
  store: MemoryStore
): Promise<IkigaiProfile | undefined> {
  try {
    const result = await store.get(
      NS.semanticMemory(userId),
      IKIGAI_PROFILE_KEY
    );
    return result?.value as IkigaiProfile | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get Ikigai context for mission agents - v13 2.9
 */
export async function getIkigaiContextForAgent(
  userId: string,
  store: MemoryStore
): Promise<string> {
  const profile = await getExistingProfile(userId, store);

  if (!profile) {
    return 'No Ikigai profile available yet.';
  }

  const parts: string[] = [];

  // Experiences summary
  if (profile.experiences.preferredTypes.length > 0) {
    parts.push(`Preferred experiences: ${profile.experiences.preferredTypes.join(', ')}`);
    parts.push(`Experience frequency: ${profile.experiences.frequency}`);
  }

  // Key people summary
  if (profile.relationships.keyPeople.length > 0) {
    const people = profile.relationships.keyPeople
      .slice(0, 5)
      .map(p => `${p.name} (${p.relationshipType})`)
      .join(', ');
    parts.push(`Key people: ${people}`);
    parts.push(`Social style: ${profile.relationships.socialFrequency}`);
  }

  // Interests summary
  if (profile.interests.genuineInterests.length > 0) {
    const interests = profile.interests.genuineInterests
      .slice(0, 5)
      .map(i => i.topic)
      .join(', ');
    parts.push(`Interests: ${interests}`);
  }

  // Giving summary
  if (profile.giving.charitableGiving.length > 0) {
    const causes = profile.giving.charitableGiving
      .map(c => c.cause)
      .join(', ');
    parts.push(`Charitable causes: ${causes}`);
  }

  return parts.join('\n');
}
```

### 5. Entity Sync (v13 2.9)

```typescript
// packages/ikigai/src/storage/entity-sync.ts

import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import type { Person } from '../types';

/**
 * Sync key people to entities namespace - v13 Section 2.9
 *
 * Allows mission agents to reference known people.
 */
export async function syncPeopleToEntities(
  userId: string,
  people: Person[],
  store: MemoryStore
): Promise<void> {
  for (const person of people) {
    const entityKey = `person:${person.name.toLowerCase().replace(/\s+/g, '_')}`;

    await store.put(
      NS.entities(userId),
      entityKey,
      {
        entityType: 'person',
        name: person.name,
        relationship: person.relationshipType,
        interactionFrequency: person.interactionFrequency,
        sharedActivities: person.sharedActivities,
        relationshipStrength: person.relationshipStrength,
        lastSeen: new Date().toISOString(),
        sourceContext: 'ikigai_inference',
      }
    );
  }
}

/**
 * Get known people for an agent
 */
export async function getKnownPeople(
  userId: string,
  store: MemoryStore
): Promise<Person[]> {
  const entities = await store.list(NS.entities(userId), { prefix: 'person:' });

  return entities.map(e => ({
    name: e.value.name,
    relationshipType: e.value.relationship,
    interactionFrequency: e.value.interactionFrequency,
    sharedActivities: e.value.sharedActivities ?? [],
    relationshipStrength: e.value.relationshipStrength ?? 0.5,
    evidence: e.key,
  }));
}
```

---

## Week 3: Mission Integration

### 6. Well-Being Scoring (v13 2.6)

```typescript
// packages/ikigai/src/scoring/well-being-score.ts

import type { MissionCard } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import type { MissionWellBeingScore, IkigaiProfile, Person } from '../types';
import { getExistingProfile } from '../storage/profile-store';
import { getKnownPeople } from '../storage/entity-sync';

/**
 * Calculate Well-Being Score - v13 Section 2.6
 *
 * Missions are ranked by well-being value, not just utility.
 */
export async function calculateWellBeingScore(
  mission: MissionCard,
  userId: string,
  store: MemoryStore
): Promise<MissionWellBeingScore> {
  const profile = await getExistingProfile(userId, store);
  const knownPeople = await getKnownPeople(userId, store);

  // Start with base utility score
  const utilityScore = mission.utilityScore ?? 0.5;

  // Calculate boosts
  const experienceBoost = calculateExperienceBoost(mission, profile);
  const relationshipBoost = calculateRelationshipBoost(mission, profile, knownPeople);
  const interestAlignment = calculateInterestAlignment(mission, profile);
  const givingBoost = calculateGivingBoost(mission, profile);

  // Calculate total (capped at 2.0)
  const totalScore = Math.min(
    2.0,
    utilityScore + experienceBoost + relationshipBoost + interestAlignment + givingBoost
  );

  return {
    utilityScore,
    experienceBoost,
    relationshipBoost,
    interestAlignment,
    givingBoost,
    totalScore,
  };
}

/**
 * Experience boost - v13 2.6
 *
 * Does this mission create an experience?
 */
function calculateExperienceBoost(
  mission: MissionCard,
  profile?: IkigaiProfile
): number {
  if (!profile) return 0;

  // Check if mission type aligns with experience preferences
  const experienceTypes = ['travel', 'restaurant', 'events'];
  if (!experienceTypes.includes(mission.type)) {
    return 0;
  }

  // Check for preferred experience types
  const missionType = mission.type as string;
  const typeMapping: Record<string, string[]> = {
    travel: ['travel', 'adventure', 'outdoor'],
    restaurant: ['dining', 'social_gatherings'],
    events: ['entertainment', 'social_gatherings', 'creative'],
  };

  const relevantTypes = typeMapping[missionType] ?? [];
  const hasMatch = profile.experiences.preferredTypes.some(t =>
    relevantTypes.includes(t)
  );

  if (hasMatch) {
    // Full boost for matching preferences
    return 0.5 * profile.dimensionWeights.experiences;
  }

  // Partial boost for experience-type missions
  return 0.25 * profile.dimensionWeights.experiences;
}

/**
 * Relationship boost - v13 2.6
 *
 * Does this mission involve key people?
 */
function calculateRelationshipBoost(
  mission: MissionCard,
  profile?: IkigaiProfile,
  knownPeople?: Person[]
): number {
  if (!profile || !knownPeople || knownPeople.length === 0) return 0;

  // Check if mission mentions any known people
  const missionText = `${mission.title} ${mission.summary}`.toLowerCase();

  for (const person of knownPeople) {
    if (missionText.includes(person.name.toLowerCase())) {
      // Full boost for key person involvement
      return 0.5 * profile.dimensionWeights.relationships * person.relationshipStrength;
    }
  }

  // Check for gift-related missions for known recipients
  if (mission.type === 'shopping') {
    const giftKeywords = ['gift', 'birthday', 'present', 'surprise'];
    const isGiftMission = giftKeywords.some(k => missionText.includes(k));
    if (isGiftMission) {
      return 0.3 * profile.dimensionWeights.relationships;
    }
  }

  return 0;
}

/**
 * Interest alignment - v13 2.6
 *
 * Does this match their interests?
 */
function calculateInterestAlignment(
  mission: MissionCard,
  profile?: IkigaiProfile
): number {
  if (!profile || profile.interests.genuineInterests.length === 0) return 0;

  const missionText = `${mission.title} ${mission.summary}`.toLowerCase();

  for (const interest of profile.interests.genuineInterests) {
    if (missionText.includes(interest.topic.toLowerCase())) {
      // Scale by engagement depth
      const depthMultiplier =
        interest.engagementDepth === 'deep' ? 1.0 :
        interest.engagementDepth === 'moderate' ? 0.7 : 0.4;

      return 0.3 * profile.dimensionWeights.interests * depthMultiplier;
    }
  }

  return 0;
}

/**
 * Giving boost - v13 2.6
 *
 * Is this charitable or gift-related?
 */
function calculateGivingBoost(
  mission: MissionCard,
  profile?: IkigaiProfile
): number {
  if (!profile) return 0;

  const missionText = `${mission.title} ${mission.summary}`.toLowerCase();

  // Check for charitable keywords
  const charityKeywords = ['donate', 'charity', 'volunteer', 'help', 'support cause'];
  const isCharity = charityKeywords.some(k => missionText.includes(k));
  if (isCharity) {
    return 0.3 * profile.dimensionWeights.giving;
  }

  // Check for gift keywords
  const giftKeywords = ['gift', 'present', 'birthday', 'anniversary'];
  const isGift = giftKeywords.some(k => missionText.includes(k));
  if (isGift && profile.giving.giftGiving.frequency !== 'rare') {
    return 0.2 * profile.dimensionWeights.giving;
  }

  return 0;
}

/**
 * Sort missions by well-being score - v13 2.6
 */
export async function sortMissionsByWellBeing(
  missions: MissionCard[],
  userId: string,
  store: MemoryStore
): Promise<Array<MissionCard & { wellBeingScore: MissionWellBeingScore }>> {
  const scored = await Promise.all(
    missions.map(async mission => ({
      ...mission,
      wellBeingScore: await calculateWellBeingScore(mission, userId, store),
    }))
  );

  // Sort by total score descending
  return scored.sort((a, b) => b.wellBeingScore.totalScore - a.wellBeingScore.totalScore);
}
```

### 7. Ikigai Rewards (v13 2.7)

```typescript
// packages/ikigai/src/scoring/rewards.ts

import type { MissionCard } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import type { IkigaiRewards, IkigaiProfile } from '../types';
import { getExistingProfile } from '../storage/profile-store';

const DEFAULT_REWARDS: Omit<IkigaiRewards, 'categories'> = {
  basePoints: 100,
  experienceMultiplier: 2.0,
  relationshipMultiplier: 1.5,
  givingMultiplier: 2.5,
};

/**
 * Calculate Ikigai rewards for completed mission - v13 Section 2.7
 */
export async function calculateMissionRewards(
  mission: MissionCard,
  userId: string,
  store: MemoryStore
): Promise<IkigaiRewards> {
  const profile = await getExistingProfile(userId, store);

  const basePoints = DEFAULT_REWARDS.basePoints;
  let multiplier = 1.0;

  const categories = {
    explorer: 0,
    connector: 0,
    helper: 0,
    achiever: 0,
  };

  // Determine category and multiplier
  const missionText = `${mission.title} ${mission.summary}`.toLowerCase();

  // Experience missions (explorer)
  const experienceTypes = ['travel', 'restaurant', 'events'];
  if (experienceTypes.includes(mission.type)) {
    multiplier = Math.max(multiplier, DEFAULT_REWARDS.experienceMultiplier);
    categories.explorer = Math.round(basePoints * DEFAULT_REWARDS.experienceMultiplier);
  }

  // Relationship missions (connector)
  if (profile) {
    const involvesKeyPerson = profile.relationships.keyPeople.some(p =>
      missionText.includes(p.name.toLowerCase())
    );
    if (involvesKeyPerson) {
      multiplier = Math.max(multiplier, DEFAULT_REWARDS.relationshipMultiplier);
      categories.connector = Math.round(basePoints * DEFAULT_REWARDS.relationshipMultiplier);
    }
  }

  // Giving missions (helper)
  const givingKeywords = ['gift', 'donate', 'charity', 'volunteer', 'help'];
  const isGiving = givingKeywords.some(k => missionText.includes(k));
  if (isGiving) {
    multiplier = Math.max(multiplier, DEFAULT_REWARDS.givingMultiplier);
    categories.helper = Math.round(basePoints * DEFAULT_REWARDS.givingMultiplier);
  }

  // Utility missions (achiever) - always gets base points
  categories.achiever = basePoints;

  return {
    ...DEFAULT_REWARDS,
    categories,
  };
}

/**
 * Award points for completed mission - v13 Section 2.7
 */
export async function awardMissionPoints(
  mission: MissionCard,
  userId: string,
  store: MemoryStore
): Promise<number> {
  const rewards = await calculateMissionRewards(mission, userId, store);

  // Get total points (highest category)
  const totalPoints = Math.max(
    rewards.categories.explorer,
    rewards.categories.connector,
    rewards.categories.helper,
    rewards.categories.achiever
  );

  // Update user's Ikigai points
  const currentPoints = await getUserPoints(userId, store);
  const newPoints = {
    total: currentPoints.total + totalPoints,
    explorer: currentPoints.explorer + rewards.categories.explorer,
    connector: currentPoints.connector + rewards.categories.connector,
    helper: currentPoints.helper + rewards.categories.helper,
    achiever: currentPoints.achiever + rewards.categories.achiever,
    lastUpdated: Date.now(),
  };

  await store.put(NS.semanticMemory(userId), 'ikigai_points', newPoints);

  return totalPoints;
}

/**
 * Get user's current Ikigai points
 */
export async function getUserPoints(
  userId: string,
  store: MemoryStore
): Promise<{
  total: number;
  explorer: number;
  connector: number;
  helper: number;
  achiever: number;
}> {
  try {
    const result = await store.get(NS.semanticMemory(userId), 'ikigai_points');
    return result?.value ?? {
      total: 0,
      explorer: 0,
      connector: 0,
      helper: 0,
      achiever: 0,
    };
  } catch {
    return {
      total: 0,
      explorer: 0,
      connector: 0,
      helper: 0,
      achiever: 0,
    };
  }
}
```

---

## Integration with Existing Packages

### Update `@ownyou/shared-types`

Add Ikigai fields to MissionCard per v13 Section 3.4.

```typescript
// packages/shared-types/src/mission.ts

/**
 * v13 Section 3.4 - MissionCard Ikigai fields
 *
 * These fields enable Ikigai-aware mission prioritization and rewards.
 */
export interface MissionCard {
  // ... existing fields ...

  // Ikigai context (v13 3.4)
  ikigaiDimensions: IkigaiDimensionType[];  // Which dimensions this serves
  ikigaiAlignmentBoost: number;             // How much completion improves alignment

  // ... existing fields ...
}

export type IkigaiDimensionType =
  | 'experiences'
  | 'relationships'
  | 'interests'
  | 'giving';
```

### Update `@ownyou/agents-base`

Inject Ikigai context into agent prompts.

```typescript
// packages/agents-base/src/context/ikigai-context.ts

import type { MemoryStore } from '@ownyou/memory-store';
import { getIkigaiContextForAgent } from '@ownyou/ikigai';

/**
 * Build Ikigai context for agent system prompt
 */
export async function buildIkigaiContext(
  userId: string,
  store: MemoryStore
): Promise<string> {
  const ikigaiContext = await getIkigaiContextForAgent(userId, store);

  return `
## User Ikigai Profile (Well-Being Context)

${ikigaiContext}

Use this context to personalize recommendations and prioritize
suggestions that align with the user's values and relationships.
`;
}
```

### Update `@ownyou/triggers`

Trigger Ikigai inference based on data thresholds.

```typescript
// packages/triggers/src/scheduled/ikigai-schedule.ts

import { IkigaiInferenceEngine } from '@ownyou/ikigai';

/**
 * Register Ikigai inference schedule
 *
 * v13 2.5: Batch processing based on data thresholds
 */
export function registerIkigaiTriggers(
  scheduler: CronScheduler,
  engine: IkigaiInferenceEngine
): void {
  // Daily check for inference threshold
  scheduler.register('ikigai_daily_check', '0 2 * * *', async (userId) => {
    const shouldRun = await checkInferenceThreshold(userId);
    if (shouldRun) {
      await engine.runInference(userId);
    }
  });

  // Weekly inference (always run)
  scheduler.register('ikigai_weekly', '0 3 * * SUN', async (userId) => {
    await engine.runInference(userId);
  });
}
```

---

## Success Criteria

| # | Criteria | Test Method |
|---|----------|-------------|
| 1 | 4 parallel dimension prompts execute | Unit test with mock LLM |
| 2 | Experiences prompt extracts activities | Parse test with sample data |
| 3 | Relationships prompt identifies key people | Parse test with sample data |
| 4 | Interests prompt distinguishes genuine vs obligations | Parse test with sample data |
| 5 | Giving prompt finds charitable patterns | Parse test with sample data |
| 6 | Synthesis prompt combines dimensions | Integration test |
| 7 | IkigaiProfile stored in semanticMemory | Storage integration test |
| 8 | Key people synced to entities namespace | Storage integration test |
| 9 | Evidence chains stored with source refs | Storage test |
| 10 | Well-being scores calculated correctly | Unit tests for each boost |
| 11 | Missions sorted by well-being score | Integration test |
| 12 | Ikigai points awarded with multipliers | Rewards calculation test |
| 13 | Batch processing respects thresholds | Schedule trigger test |
| 14 | All tests passing | CI/CD pipeline |

---

## Test Plan

### Unit Tests

```typescript
// packages/ikigai/src/__tests__/prompts.test.ts
describe('Dimension Prompts', () => {
  describe('Experiences', () => {
    it('should extract preferred experience types');
    it('should identify frequency correctly');
    it('should parse recent activities');
    it('should detect experience patterns');
  });

  describe('Relationships', () => {
    it('should identify key people');
    it('should infer relationship types');
    it('should calculate relationship strength');
    it('should detect social frequency');
  });

  describe('Interests', () => {
    it('should distinguish genuine interests from obligations');
    it('should detect engagement depth');
    it('should identify hobbies');
    it('should find learning interests');
  });

  describe('Giving', () => {
    it('should detect charitable giving');
    it('should identify gift-giving patterns');
    it('should find volunteering activities');
    it('should detect care patterns');
  });

  describe('Synthesis', () => {
    it('should calculate dimension weights');
    it('should compute overall confidence');
    it('should detect changes from previous profile');
  });
});

// packages/ikigai/src/__tests__/scoring.test.ts
describe('Well-Being Scoring', () => {
  it('should calculate experience boost for travel missions');
  it('should calculate relationship boost for missions mentioning key people');
  it('should calculate interest alignment for matching topics');
  it('should calculate giving boost for charitable missions');
  it('should cap total score at 2.0');
  it('should sort missions by total score');
});

// packages/ikigai/src/__tests__/rewards.test.ts
describe('Ikigai Rewards', () => {
  it('should apply 2x multiplier for experience missions');
  it('should apply 1.5x multiplier for relationship missions');
  it('should apply 2.5x multiplier for giving missions');
  it('should track points by category');
  it('should accumulate total points');
});

// packages/ikigai/src/__tests__/engine.test.ts
describe('Inference Engine', () => {
  it('should run 4 prompts in parallel');
  it('should synthesize unified profile');
  it('should store profile in semanticMemory');
  it('should sync people to entities namespace');
  it('should store evidence chains');
  it('should respect batch thresholds');
});
```

### Integration Tests

```typescript
// packages/integration-tests/src/__tests__/ikigai-flow.test.ts
describe('Ikigai Integration', () => {
  it('should generate Ikigai profile from email data');
  it('should prioritize missions by well-being score');
  it('should inject Ikigai context into agent prompts');
  it('should award points on mission completion');
  it('should update profile on new data batch');
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

No new external dependencies required - uses existing `@ownyou/llm-client` and `@ownyou/memory-store`.

### Package Dependencies

- `@ownyou/ikigai` depends on: `@ownyou/llm-client`, `@ownyou/memory-store`, `@ownyou/shared-types`
- Updates to: `@ownyou/agents-base` (Ikigai context injection), `@ownyou/triggers` (Ikigai schedule)

---

## Roadmap Alignment

| Roadmap Week | Focus | Sprint 6 Deliverable |
|--------------|-------|---------------------|
| Week 1 | Ikigai Inference | Inference engine, 4 dimension prompts |
| Week 2 | Synthesis + Storage | Synthesis prompt, profile storage, evidence chains |
| Week 3 | Mission Integration | Well-being scoring, rewards, agent integration |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| Draft | 2025-12-05 | Initial specification |

---

**Document Status:** DRAFT - Ready for implementation
**Author:** Claude Code
**Validates Against:** OwnYou_architecture_v13.md (Section 2 - Complete Ikigai)
