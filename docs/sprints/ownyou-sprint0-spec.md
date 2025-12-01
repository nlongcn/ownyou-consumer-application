# OwnYou Sprint 0: Foundation Technical Specification (v13-Aligned)

**Duration:** 2 weeks  
**Goal:** Development environment + core abstractions that unblock all future sprints  
**Success Criteria:** Store a memory, call an LLM with cost tracking, log an agent trace  
**Architecture Reference:** OwnYou_architecture_v13.md

---

## 0. v13 Compliance Checklist

This section maps Sprint 0 deliverables to v13 architecture sections, ensuring foundation enables the full system.

| v13 Section | Requirement | Sprint 0 Deliverable | Status |
|-------------|-------------|---------------------|--------|
| **8.4** Memory Schema | Memory, Episode, ProceduralRule, Entity types | `@ownyou/shared-types` | ✅ |
| **8.5** Vector Embeddings | Local embedding with nomic-embed-text-v1.5 | Embedding strategy decision | ✅ |
| **8.7** Memory Retrieval | Hybrid search (semantic + BM25 + RRF) | `@ownyou/memory-store/search` | ✅ |
| **8.12** Namespace Schema | All 15+ namespaces defined | `namespaces.ts` with exact v13 names | ✅ |
| **8.13** Storage Backends | IndexedDB (PWA), SQLite (Tauri) | Both backends in Sprint 0 | ✅ |
| **8.14** Sync Integration | Interface must be sync-compatible | `SyncableMemory` wrapper type | ✅ |
| **6.10** LLM Cost Management | Budget enforcement, throttling | `@ownyou/llm-client/budget` | ✅ |
| **6.11** Error Handling | Circuit breakers, fallback chains | `@ownyou/llm-client/fallback` | ✅ |
| **10.1** Observability | Agent traces, cost metering | `@ownyou/observability` | ✅ |
| **7.x** BBS+ Types | Pseudonym, DisclosureProof placeholders | `@ownyou/shared-types/identity` | ✅ |
| **Phase 0** | IAB Classifier, Admin Dashboard | Migration path defined | ✅ |

---

## 1. Overview

Sprint 0 establishes the foundational infrastructure that every subsequent sprint depends on. This version is explicitly aligned with v13 architecture.

### 1.1 Deliverables Summary

| Deliverable | Priority | v13 Section | Acceptance Criteria |
|-------------|----------|-------------|---------------------|
| Monorepo structure | P0 | N/A | `pnpm build` works across all packages |
| Tauri scaffold | P0 | 8.13 | App launches with SQLite backend ready |
| memory-store package | P0 | 8.x | LangGraph Store-compatible interface |
| shared-types package | P0 | 8.4, 7.x | All v13 types defined |
| llm-client package | P0 | 6.10-6.11 | OpenAI + budget + fallback |
| observability package | P1 | 10.x | Agent trace matches v13 schema |
| Phase 0 migration | P1 | Phase 0 | Existing code integrated |
| CI pipeline | P1 | N/A | PR checks pass |

### 1.2 Key Decisions (Aligned with v13)

| Decision | Choice | v13 Reference |
|----------|--------|---------------|
| **Embedding Model** | `@xenova/transformers` with `nomic-embed-text-v1.5` | Section 8.5 |
| **SQLite Timing** | Sprint 0 (not Sprint 3) — required for Tauri | Section 8.13 |
| **Sync Design** | Interface sync-compatible from day 1 | Section 8.14 |
| **Namespace Format** | Tuple: `[namespace, userId]` or `[namespace, userId, subkey]` | Section 8.12 |

---

## 2. Monorepo Structure

### 2.0 Migration Strategy: Incremental, Not Big-Bang

**IMPORTANT:** The directory layout in Section 2.1 shows the TARGET end state. Sprint 0 does NOT require restructuring the entire repo.

**Sprint 0 Approach:**
1. **Add `packages/` directory** to existing `ownyou_consumer_application/` repo
2. **Build new packages** (shared-types, memory-store, etc.) in `packages/`
3. **Keep existing `src/`** untouched - the working code stays where it is
4. **Migration happens later** - Phase 0 code moves to `packages/` incrementally after Sprint 0 packages prove themselves

**Why:**
- Working code (`src/browser/`, `src/email_parser/`) should not move until new packages are proven
- Sprint 0 focus is building NEW packages, not reorganizing existing code
- The target layout (Section 2.1) becomes reality through gradual migration, not upfront restructuring

**Sprint 0 Actual Structure:**
```
ownyou_consumer_application/       # EXISTING repo name (unchanged)
├── packages/                      # NEW - Sprint 0 packages
│   ├── shared-types/
│   ├── memory-store/
│   ├── llm-client/
│   └── observability/
├── src/                           # UNCHANGED - existing working code
│   ├── browser/                   # Phase 1.5 browser PWA (keep here)
│   ├── email_parser/              # Working Python (keep here)
│   └── admin-dashboard/           # Admin dashboard (keep here)
├── pnpm-workspace.yaml            # NEW - workspace config
├── turbo.json                     # NEW - build orchestration
└── ... existing files
```

**Post-Sprint 0 Migration (Future):**
- `src/browser/agents/iab-classifier/` → `packages/iab-classifier/`
- `src/browser/store/` → `packages/memory-store/backends/`
- `src/admin-dashboard/` → `apps/admin/`

---

### 2.1 Target Directory Layout (End State)

This is the TARGET structure after all migrations complete (NOT required for Sprint 0):

```
ownyou/
├── apps/
│   ├── desktop/                    # Tauri 2.0 application
│   │   ├── src-tauri/
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json
│   │   │   └── src/
│   │   │       ├── main.rs
│   │   │       ├── commands.rs
│   │   │       └── sqlite.rs       # SQLite + SQLCipher setup
│   │   ├── src/                    # React frontend
│   │   └── package.json
│   │
│   ├── pwa/                        # PWA build (shares src/ with desktop)
│   │   └── package.json
│   │
│   └── admin/                      # Phase 0 Admin Dashboard (migrated)
│       ├── src/                    # Existing Phase 0 code
│       └── package.json
│
├── packages/
│   ├── shared-types/               # v13 type definitions
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── memory.ts           # Memory, Episode, ProceduralRule
│   │   │   ├── entities.ts         # Entity, Relationship
│   │   │   ├── agent.ts            # AgentPermissions, MissionCard
│   │   │   ├── identity.ts         # Pseudonym, DisclosureProof (stubs)
│   │   │   ├── ikigai.ts           # IkigaiProfile, IkigaiDimension
│   │   │   └── sync.ts             # SyncPayload, ConflictResolution
│   │   └── package.json
│   │
│   ├── memory-store/               # LangGraph Store-compatible
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── store.ts            # MemoryStore (LangGraph interface)
│   │   │   ├── namespaces.ts       # v13 STORE_NAMESPACES
│   │   │   ├── backends/
│   │   │   │   ├── types.ts
│   │   │   │   ├── indexeddb.ts    # PWA backend
│   │   │   │   ├── sqlite.ts       # Tauri backend
│   │   │   │   └── memory.ts       # Testing backend
│   │   │   ├── search/
│   │   │   │   ├── semantic.ts
│   │   │   │   ├── bm25.ts
│   │   │   │   ├── rrf.ts
│   │   │   │   └── embeddings.ts   # @xenova/transformers
│   │   │   └── sync/
│   │   │       ├── types.ts        # Sync-compatible wrappers
│   │   │       └── encryption.ts   # AES-GCM helpers
│   │   └── package.json
│   │
│   ├── llm-client/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts
│   │   │   ├── providers/
│   │   │   │   ├── openai.ts
│   │   │   │   ├── anthropic.ts
│   │   │   │   └── webllm.ts
│   │   │   ├── budget.ts           # v13 Section 6.10
│   │   │   ├── fallback.ts         # v13 Section 6.11
│   │   │   ├── circuit-breaker.ts  # v13 Section 6.11.2
│   │   │   └── pricing.ts
│   │   └── package.json
│   │
│   ├── observability/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── agent-trace.ts      # v13 Section 10.2
│   │   │   ├── cost-meter.ts       # v13 Section 10.4
│   │   │   └── sync-log.ts         # v13 Section 10.3
│   │   └── package.json
│   │
│   ├── iab-classifier/             # Migrated from Phase 0
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── classifier.ts       # Existing Phase 0 classifier
│   │   │   └── taxonomy.ts         # IAB taxonomy
│   │   └── package.json
│   │
│   └── ui-components/
│       ├── src/
│       │   ├── index.ts
│       │   └── Shell.tsx
│       └── package.json
│
├── docs/
│   ├── architecture/
│   │   └── OwnYou_architecture_v13.md  # Canonical reference
│   ├── LOCAL_DEV_SETUP.md
│   └── PHASE_0_MIGRATION.md
│
├── legacy/                         # Phase 0 code before migration
│   └── browser-extension/          # Original browser code (archived)
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### 2.2 Phase 0 Migration Path (FUTURE - Not Sprint 0)

**NOTE:** This section describes FUTURE migration work. Sprint 0 focuses on building new packages - the migration happens AFTER Sprint 0 proves the new packages work.

**PHASE_0_MIGRATION.md (for future reference):**
```markdown
# Phase 0 Migration Guide

## What Exists (Phase 0 Complete)
- ✅ IAB Classifier (browser-based) - in `src/browser/agents/iab-classifier/`
- ✅ IndexedDB Store (basic implementation) - in `src/browser/store/`
- ✅ Admin Dashboard - in `src/admin-dashboard/`
- ✅ Browser Email OAuth (24hr tokens)

## Migration Strategy (Post-Sprint 0)

### IAB Classifier → `@ownyou/iab-classifier`
1. After Sprint 0 `shared-types` and `memory-store` are proven
2. Extract classifier logic from `src/browser/agents/iab-classifier/`
3. Update to use `@ownyou/memory-store` instead of raw IndexedDB
4. Export as pure TypeScript module

### IndexedDB Store → `@ownyou/memory-store`
1. Sprint 0 builds `memory-store` with new schema
2. Existing `src/browser/store/` stays in place initially
3. After Sprint 0, update existing code to import from `@ownyou/memory-store`
4. Eventually delete `src/browser/store/` after migration complete

### Admin Dashboard → `apps/admin/`
1. Deferred until apps/ structure is needed
2. Currently stays at `src/admin-dashboard/`
3. Update imports to use new packages as they're ready
```

### 2.3 Current Phase 0 Asset Locations (Reference)

**Current codebase structure - these stay in place during Sprint 0:**

| Asset | Current Location | Target Location (FUTURE) | Sprint 0 Action |
|-------|------------------|--------------------------|-----------------|
| IAB Classifier | `src/browser/agents/iab-classifier/` | `packages/iab-classifier/` | None - stays in place |
| IndexedDB Store | `src/browser/store/` | `packages/memory-store/backends/` | Build new, don't move |
| LLM Clients | `src/browser/llm/` | `packages/llm-client/providers/` | Build new, don't move |
| Admin Dashboard | `src/admin-dashboard/` | `apps/admin/` | None - stays in place |
| IAB Taxonomy | `src/browser/taxonomy/` | `packages/shared-types/taxonomy/` | Copy to new package |

**Sprint 0 creates NEW packages alongside existing code. Migration happens AFTER validation.**

### 2.4 Sprint 0 Completion Checklist

**Before Sprint 0 completion, verify:**

- [ ] `packages/shared-types` - All v13 types compile
- [ ] `packages/memory-store` - LangGraph Store interface works (put/get/search/list/delete)
- [ ] `packages/memory-store` - IndexedDB backend passes tests
- [ ] `packages/memory-store` - SQLite backend passes tests (for Tauri)
- [ ] `packages/llm-client` - OpenAI calls work with budget tracking
- [ ] `packages/observability` - Agent traces log correctly
- [ ] `pnpm build` succeeds across all packages
- [ ] Workspace dependencies resolve correctly
- [ ] Existing `src/browser/` code still works (no regressions)
- [ ] Existing `src/admin-dashboard/` still works (no regressions)

**NOT required for Sprint 0 completion:**
- ❌ Moving existing code to new locations
- ❌ Admin dashboard at `apps/admin/`
- ❌ Tauri app scaffold (deferred to Sprint 1)
- ❌ Full OrbitDB sync implementation

---

## 3. shared-types Package (v13-Aligned)

This package defines all types from v13 architecture, serving as the single source of truth.

### 3.1 Memory Types (v13 Section 8.4)

```typescript
// packages/shared-types/src/memory.ts

/**
 * Base Memory - v13 Section 8.4.1
 */
export interface Memory {
  id: string;
  content: string;                    // Natural language, agent-written
  context: string;                    // Domain: "travel", "shopping", etc.

  // Bi-temporal model (v13 Section 8.6)
  validAt: number;                    // When fact became true
  invalidAt?: number;                 // When fact stopped being true
  createdAt: number;                  // When system learned this

  // Strength & decay (v13 Section 8.9)
  strength: number;                   // Starts 1.0, decays 5%/week
  lastAccessed: number;
  accessCount: number;

  // Provenance
  sources: string[];                  // Episode IDs or data source refs
  confidence: number;                 // 0.0-1.0
  contradictions?: string[];

  // Privacy (v13 Section 8.11)
  privacyTier: PrivacyTier;

  // Vector (v13 Section 8.5)
  embedding?: number[];
}

export type PrivacyTier = 'public' | 'sensitive' | 'private';

/**
 * Episode - v13 Section 8.4.2
 */
export interface Episode {
  id: string;
  
  situation: string;
  reasoning: string;
  action: string;
  outcome: string;
  userFeedback?: 'love' | 'like' | 'meh';

  agentType: AgentType;
  missionId: string;
  timestamp: number;
  tags: string[];

  embedding?: number[];
}

export type AgentType = 
  | 'shopping' 
  | 'travel' 
  | 'restaurant' 
  | 'events' 
  | 'content' 
  | 'diagnostic';

/**
 * ProceduralRule - v13 Section 8.4.3
 */
export interface ProceduralRule {
  id: string;
  agentType: AgentType;

  rule: string;                       // Natural language rule
  derivedFrom: string[];              // Episode IDs
  createdAt: number;

  confidence: number;
  applicationCount: number;
  overrideCount: number;

  embedding?: number[];
}

/**
 * Sync-compatible wrapper - v13 Section 8.14
 */
export interface SyncableMemory<T> {
  data: T;
  
  // Sync metadata
  syncId: string;
  deviceId: string;
  vectorClock: Record<string, number>;
  lastSyncedAt?: number;
  
  // Conflict resolution
  conflictStrategy: ConflictStrategy;
}

export type ConflictStrategy = 
  | 'latest_wins' 
  | 'merge' 
  | 'manual' 
  | 'sum';
```

### 3.2 Entity Types (v13 Section 8.4.4-8.4.5)

```typescript
// packages/shared-types/src/entities.ts

/**
 * Entity - v13 Section 8.4.4
 */
export interface Entity {
  id: string;
  name: string;
  type: EntityType;

  properties: Record<string, unknown>;

  // Temporal
  validAt: number;
  invalidAt?: number;
  createdAt: number;

  sourceMemories: string[];

  embedding?: number[];
}

export type EntityType = 
  | 'person' 
  | 'place' 
  | 'product' 
  | 'company' 
  | 'event'
  | 'concept';

/**
 * Relationship - v13 Section 8.4.4
 */
export interface Relationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationshipType;

  validAt: number;
  invalidAt?: number;
  createdAt: number;

  properties: Record<string, unknown>;
  sourceMemories: string[];
}

export type RelationshipType = 
  | 'KNOWS' 
  | 'WORKS_AT' 
  | 'LIVES_IN' 
  | 'PURCHASED_FROM'
  | 'VISITED'
  | 'INTERESTED_IN';
```

### 3.3 Identity Types (v13 Section 7.x - Stubs)

```typescript
// packages/shared-types/src/identity.ts

/**
 * BBS+ Pseudonym - v13 Section 7.1
 * Stub for Sprint 0 - full implementation in Phase 2
 */
export interface Pseudonym {
  id: string;
  
  // BBS+ credential components (opaque for now)
  credentialHash: string;
  issuerSignature: string;
  
  // Derived payment address
  paymentAddress: string;
  
  // Context
  createdAt: number;
  lastUsedAt?: number;
}

/**
 * Disclosure Proof - v13 Section 7.1.4
 */
export interface DisclosureProof {
  pseudonymId: string;
  
  // What's being disclosed
  disclosedAttributes: string[];      // IAB category IDs
  
  // ZKP components (opaque for now)
  proof: string;
  nonce: string;
  timestamp: number;
  
  // Verification
  isValid?: boolean;
}

/**
 * Tracking ID - v13 Section 7.1.4
 */
export interface TrackingId {
  id: string;
  campaignId: string;
  pseudonymId: string;
  
  // Derived deterministically from campaign + nym_secret
  trackingIdHash: string;
  
  createdAt: number;
  impressionCount: number;
}
```

### 3.4 Ikigai Types (v13 Section 2)

```typescript
// packages/shared-types/src/ikigai.ts

/**
 * IkigaiProfile - v13 Section 2.3
 */
export interface IkigaiProfile {
  userId: string;
  updatedAt: number;

  experiences: {
    preferredTypes: ExperienceType[];
    frequency: 'rare' | 'occasional' | 'frequent';
    recentActivities: Activity[];
  };

  relationships: {
    keyPeople: Person[];
    socialFrequency: 'solo' | 'couple' | 'social' | 'very_social';
  };

  interests: {
    topics: TopicScore[];
    hobbies: string[];
  };

  giving: {
    causes: string[];
    giftGivingFrequency: number;
  };

  dimensionWeights: {
    experiences: number;
    relationships: number;
    interests: number;
    giving: number;
  };

  evidence: IkigaiEvidence[];
}

export type ExperienceType = 
  | 'travel' 
  | 'entertainment' 
  | 'dining' 
  | 'adventure' 
  | 'learning' 
  | 'creative' 
  | 'social' 
  | 'outdoor' 
  | 'wellness';

export interface Activity {
  type: ExperienceType;
  description: string;
  date: number;
  evidenceRef: string;
}

export interface Person {
  name: string;
  relationshipStrength: number;
  sharedInterests: string[];
  lastInteraction: number;
}

export interface TopicScore {
  iabCategoryId: string;
  score: number;
  engagementDepth: 'casual' | 'moderate' | 'deep';
}

export interface IkigaiEvidence {
  dimension: 'experiences' | 'relationships' | 'interests' | 'giving';
  sourceType: 'email' | 'transaction' | 'calendar' | 'browser';
  sourceId: string;
  signalStrength: number;
  extractedAt: number;
}
```

### 3.5 Agent Types (v13 Section 3.6)

```typescript
// packages/shared-types/src/agent.ts

import type { AgentType } from './memory';

/**
 * AgentPermissions - v13 Section 3.6.2
 */
export interface AgentPermissions {
  agentType: AgentType;
  
  memoryAccess: {
    read: string[];
    write: string[];
    search: string[];
  };
  
  externalApis: ExternalApiConfig[];
  toolDefinitions: ToolDefinition[];
}

export interface ExternalApiConfig {
  name: string;
  rateLimit: string;
  requiresUserConsent: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

/**
 * AgentLevel - v13 Section 3.6.3
 */
export type AgentLevel = 'L1' | 'L2' | 'L3';

export interface AgentLimits {
  maxToolCalls: number;
  maxLlmCalls: number;
  timeoutSeconds: number;
  maxMemoryReads: number;
  maxMemoryWrites: number;
}

export const AGENT_LIMITS: Record<AgentLevel, AgentLimits> = {
  L1: {
    maxToolCalls: 3,
    maxLlmCalls: 2,
    timeoutSeconds: 30,
    maxMemoryReads: 10,
    maxMemoryWrites: 3,
  },
  L2: {
    maxToolCalls: 10,
    maxLlmCalls: 5,
    timeoutSeconds: 120,
    maxMemoryReads: 25,
    maxMemoryWrites: 10,
  },
  L3: {
    maxToolCalls: 25,
    maxLlmCalls: 10,
    timeoutSeconds: 300,
    maxMemoryReads: 50,
    maxMemoryWrites: 20,
  },
};

/**
 * MissionCard - v13 Section 3.4
 */
export interface MissionCard {
  id: string;
  type: AgentType;

  title: string;
  summary: string;
  urgency: 'low' | 'medium' | 'high';

  status: MissionStatus;
  createdAt: number;
  expiresAt?: number;
  snoozedUntil?: number;

  ikigaiDimensions: string[];
  ikigaiAlignmentBoost: number;

  primaryAction: MissionAction;
  secondaryActions?: MissionAction[];

  agentThreadId: string;
  evidenceRefs: string[];

  userRating?: 1 | 2 | 3 | 4 | 5;
  completionFeedback?: string;
}

export type MissionStatus = 
  | 'CREATED' 
  | 'PRESENTED' 
  | 'ACTIVE' 
  | 'SNOOZED' 
  | 'DISMISSED' 
  | 'COMPLETED';

export interface MissionAction {
  label: string;
  type: 'navigate' | 'confirm' | 'input' | 'external';
  payload: unknown;
}
```

---

## 4. memory-store Package (LangGraph-Compatible)

### 4.1 Namespace Definitions (v13 Section 8.12)

```typescript
// packages/memory-store/src/namespaces.ts

/**
 * v13 Section 8.12 - Namespace Schema
 * All namespaces follow LangGraph Store pattern: [namespace, userId, subkey?]
 */
export const NAMESPACES = {
  // Core memory (Section 8.4)
  SEMANTIC_MEMORY: 'ownyou.semantic',
  EPISODIC_MEMORY: 'ownyou.episodic',
  PROCEDURAL_MEMORY: 'ownyou.procedural',
  
  // Relational (Section 8.4.4)
  ENTITIES: 'ownyou.entities',
  RELATIONSHIPS: 'ownyou.relationships',
  COMMUNITY_SUMMARIES: 'ownyou.summaries',
  
  // Classifications
  IAB_CLASSIFICATIONS: 'ownyou.iab',
  
  // Ikigai (Section 2)
  IKIGAI_PROFILE: 'ownyou.ikigai',
  IKIGAI_EVIDENCE: 'ownyou.ikigai_evidence',
  
  // Missions (Section 3)
  MISSION_CARDS: 'ownyou.missions',
  MISSION_FEEDBACK: 'ownyou.mission_feedback',
  
  // Identity (Section 7)
  PSEUDONYMS: 'ownyou.pseudonyms',
  DISCLOSURE_HISTORY: 'ownyou.disclosures',
  TRACKING_CONSENTS: 'ownyou.tracking_consents',
  
  // Financial
  EARNINGS: 'ownyou.earnings',
  
  // Observability (Section 10)
  AGENT_TRACES: 'ownyou.traces',
  LLM_USAGE: 'ownyou.llm_usage',
  SYNC_LOGS: 'ownyou.sync_logs',
} as const;

export type Namespace = typeof NAMESPACES[keyof typeof NAMESPACES];

/**
 * Namespace tuple constructors - matches v13 pattern
 */
export const NS = {
  semanticMemory: (userId: string) => 
    [NAMESPACES.SEMANTIC_MEMORY, userId] as const,
  
  episodicMemory: (userId: string) => 
    [NAMESPACES.EPISODIC_MEMORY, userId] as const,
  
  proceduralMemory: (userId: string, agentType: string) => 
    [NAMESPACES.PROCEDURAL_MEMORY, userId, agentType] as const,
  
  entities: (userId: string) => 
    [NAMESPACES.ENTITIES, userId] as const,
  
  relationships: (userId: string) => 
    [NAMESPACES.RELATIONSHIPS, userId] as const,
  
  iabClassifications: (userId: string) => 
    [NAMESPACES.IAB_CLASSIFICATIONS, userId] as const,
  
  ikigaiProfile: (userId: string) => 
    [NAMESPACES.IKIGAI_PROFILE, userId] as const,
  
  missionCards: (userId: string) => 
    [NAMESPACES.MISSION_CARDS, userId] as const,
  
  pseudonyms: (userId: string) => 
    [NAMESPACES.PSEUDONYMS, userId] as const,
  
  earnings: (userId: string) => 
    [NAMESPACES.EARNINGS, userId] as const,
  
  agentTraces: (userId: string) => 
    [NAMESPACES.AGENT_TRACES, userId] as const,
  
  llmUsage: (userId: string, period: 'daily' | 'monthly') => 
    [NAMESPACES.LLM_USAGE, userId, period] as const,
};

/**
 * Privacy tiers by namespace - v13 Section 8.11
 */
export const NAMESPACE_PRIVACY: Record<Namespace, 'public' | 'sensitive' | 'private'> = {
  [NAMESPACES.SEMANTIC_MEMORY]: 'public',
  [NAMESPACES.EPISODIC_MEMORY]: 'public',
  [NAMESPACES.PROCEDURAL_MEMORY]: 'public',
  [NAMESPACES.ENTITIES]: 'public',
  [NAMESPACES.RELATIONSHIPS]: 'sensitive',
  [NAMESPACES.COMMUNITY_SUMMARIES]: 'public',
  [NAMESPACES.IAB_CLASSIFICATIONS]: 'public',
  [NAMESPACES.IKIGAI_PROFILE]: 'sensitive',
  [NAMESPACES.IKIGAI_EVIDENCE]: 'sensitive',
  [NAMESPACES.MISSION_CARDS]: 'public',
  [NAMESPACES.MISSION_FEEDBACK]: 'public',
  [NAMESPACES.PSEUDONYMS]: 'private',
  [NAMESPACES.DISCLOSURE_HISTORY]: 'private',
  [NAMESPACES.TRACKING_CONSENTS]: 'private',
  [NAMESPACES.EARNINGS]: 'sensitive',
  [NAMESPACES.AGENT_TRACES]: 'private',
  [NAMESPACES.LLM_USAGE]: 'private',
  [NAMESPACES.SYNC_LOGS]: 'private',
};

/**
 * Sync scope by namespace - v13 Section 8.14.1
 */
export const NAMESPACE_SYNC_SCOPE: Record<Namespace, 'full' | 'selective' | 'none'> = {
  [NAMESPACES.SEMANTIC_MEMORY]: 'full',
  [NAMESPACES.EPISODIC_MEMORY]: 'selective',  // Recent 30 days + strong signals
  [NAMESPACES.PROCEDURAL_MEMORY]: 'full',
  [NAMESPACES.ENTITIES]: 'full',
  [NAMESPACES.RELATIONSHIPS]: 'full',
  [NAMESPACES.COMMUNITY_SUMMARIES]: 'full',
  [NAMESPACES.IAB_CLASSIFICATIONS]: 'full',
  [NAMESPACES.IKIGAI_PROFILE]: 'full',
  [NAMESPACES.IKIGAI_EVIDENCE]: 'selective',
  [NAMESPACES.MISSION_CARDS]: 'full',
  [NAMESPACES.MISSION_FEEDBACK]: 'full',
  [NAMESPACES.PSEUDONYMS]: 'full',
  [NAMESPACES.DISCLOSURE_HISTORY]: 'full',
  [NAMESPACES.TRACKING_CONSENTS]: 'full',
  [NAMESPACES.EARNINGS]: 'full',
  [NAMESPACES.AGENT_TRACES]: 'none',          // Device-local
  [NAMESPACES.LLM_USAGE]: 'none',             // Device-local
  [NAMESPACES.SYNC_LOGS]: 'none',             // Device-local
};
```

### 4.2 LangGraph Store Interface

```typescript
// packages/memory-store/src/store.ts

import type { Memory, Episode, Entity, SyncableMemory } from '@ownyou/shared-types';
import type { StorageBackend } from './backends/types';
import type { EmbeddingService } from './search/embeddings';
import { SemanticSearch } from './search/semantic';
import { BM25Search } from './search/bm25';
import { RRFusion } from './search/rrf';

/**
 * LangGraph Store-compatible interface
 * Matches v13 Section 8.7 retrieval requirements
 */
export interface Store {
  /**
   * Store an item
   * @param namespace Tuple: [namespace, userId] or [namespace, userId, subkey]
   * @param key Item ID
   * @param value Item data
   */
  put(namespace: readonly string[], key: string, value: unknown): Promise<void>;

  /**
   * Retrieve an item
   */
  get<T = unknown>(namespace: readonly string[], key: string): Promise<T | null>;

  /**
   * Delete an item
   */
  delete(namespace: readonly string[], key: string): Promise<boolean>;

  /**
   * List items in namespace
   */
  list<T = unknown>(
    namespace: readonly string[],
    options?: ListOptions
  ): Promise<ListResult<T>>;

  /**
   * Search with hybrid retrieval (semantic + BM25 + RRF)
   */
  search<T = Memory>(options: SearchOptions): Promise<SearchResult<T>[]>;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, unknown>;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface SearchOptions {
  namespace: readonly string[];
  query: string;
  limit?: number;
  
  // v13 Section 8.7 - hybrid modes
  modes?: Array<'semantic' | 'bm25' | 'entity'>;
  
  // Filters
  filter?: {
    context?: string;
    privacyTier?: Array<'public' | 'sensitive' | 'private'>;
    validAt?: { before?: number; after?: number };
    minStrength?: number;
    tags?: string[];
    agentType?: string;
  };
  
  // v13 Section 8.7.4 - scoring weights
  weights?: {
    rrf?: number;         // Default: 0.5
    strength?: number;    // Default: 0.3
    recency?: number;     // Default: 0.2
  };
}

export interface SearchResult<T> {
  item: T;
  score: number;
  scores: {
    semantic?: number;
    bm25?: number;
    rrf?: number;
    strength?: number;
    recency?: number;
    final: number;
  };
  matchedTerms?: string[];
}

/**
 * MemoryStore - LangGraph Store implementation
 */
export class MemoryStore implements Store {
  private backend: StorageBackend;
  private embeddingService: EmbeddingService | null;
  private semanticSearch: SemanticSearch;
  private bm25Search: BM25Search;
  private rrfFusion: RRFusion;
  private onEvent?: (event: StoreEvent) => void;

  constructor(config: MemoryStoreConfig) {
    this.backend = config.backend;
    this.embeddingService = config.embeddingService ?? null;
    this.semanticSearch = new SemanticSearch();
    this.bm25Search = new BM25Search();
    this.rrfFusion = new RRFusion();
    this.onEvent = config.onEvent;
  }

  async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
    const start = Date.now();
    
    // Compute embedding if content exists
    let valueWithEmbedding = value;
    if (this.embeddingService && hasContent(value)) {
      const embedding = await this.embeddingService.embed((value as any).content);
      valueWithEmbedding = { ...value, embedding };
    }
    
    await this.backend.put(
      namespace[0],           // namespace
      namespace[1],           // userId
      namespace[2] ?? key,    // subkey or key
      valueWithEmbedding
    );
    
    this.emitEvent('put', namespace, key, Date.now() - start);
  }

  async get<T = unknown>(namespace: readonly string[], key: string): Promise<T | null> {
    const start = Date.now();
    
    const item = await this.backend.get<T>(
      namespace[0],
      namespace[1],
      namespace[2] ?? key
    );
    
    // Update access tracking
    if (item && hasAccessTracking(item)) {
      (item as any).lastAccessed = Date.now();
      (item as any).accessCount = ((item as any).accessCount ?? 0) + 1;
      await this.backend.put(namespace[0], namespace[1], namespace[2] ?? key, item);
    }
    
    this.emitEvent('get', namespace, key, Date.now() - start, item ? 1 : 0);
    return item;
  }

  async delete(namespace: readonly string[], key: string): Promise<boolean> {
    const start = Date.now();
    const result = await this.backend.delete(namespace[0], namespace[1], namespace[2] ?? key);
    this.emitEvent('delete', namespace, key, Date.now() - start);
    return result;
  }

  async list<T = unknown>(
    namespace: readonly string[],
    options?: ListOptions
  ): Promise<ListResult<T>> {
    const start = Date.now();
    const { limit = 100, offset = 0, filter } = options ?? {};
    
    let items = await this.backend.list<T>(
      namespace[0],
      namespace[1],
      limit + 1,  // Fetch one extra to check hasMore
      offset
    );
    
    // Apply filter if provided
    if (filter) {
      items = items.filter(item => this.matchesFilter(item, filter));
    }
    
    const hasMore = items.length > limit;
    if (hasMore) items = items.slice(0, limit);
    
    this.emitEvent('list', namespace, undefined, Date.now() - start, items.length);
    
    return {
      items,
      total: items.length + offset,  // Approximate
      hasMore,
    };
  }

  async search<T = Memory>(options: SearchOptions): Promise<SearchResult<T>[]> {
    const start = Date.now();
    const {
      namespace,
      query,
      limit = 10,
      modes = ['semantic', 'bm25'],
      filter,
      weights = {},
    } = options;

    // Get all items (optimize with indexes later)
    const allItems = await this.backend.list<T>(namespace[0], namespace[1], 10000, 0);
    
    // Apply filter
    const filtered = filter 
      ? allItems.filter(item => this.matchesFilter(item, filter))
      : allItems;
    
    // Run search modes
    const resultLists: Array<{ item: T; score: number }[]> = [];
    
    if (modes.includes('semantic') && this.embeddingService) {
      const queryEmbedding = await this.embeddingService.embed(query);
      resultLists.push(this.semanticSearch.search(filtered, queryEmbedding, limit * 2));
    }
    
    if (modes.includes('bm25')) {
      resultLists.push(this.bm25Search.search(filtered, query, limit * 2));
    }
    
    // RRF fusion
    const fused = this.rrfFusion.fuse<T>(resultLists, limit);
    
    // Final scoring with strength and recency
    const scored = this.applyFinalScoring(fused, weights);
    
    this.emitEvent('search', namespace, query, Date.now() - start, scored.length);
    
    return scored;
  }

  private matchesFilter(item: unknown, filter: Record<string, unknown>): boolean {
    const memory = item as Partial<Memory>;
    
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'context' && memory.context !== value) return false;
      if (key === 'privacyTier' && !((value as string[]).includes(memory.privacyTier!))) return false;
      if (key === 'minStrength' && (memory.strength ?? 1) < (value as number)) return false;
      // Add more filter logic as needed
    }
    
    return true;
  }

  private applyFinalScoring<T>(
    results: SearchResult<T>[],
    weights: SearchOptions['weights']
  ): SearchResult<T>[] {
    const { rrf = 0.5, strength = 0.3, recency = 0.2 } = weights ?? {};
    const now = Date.now();
    const maxAge = 90 * 24 * 60 * 60 * 1000;
    
    return results.map(result => {
      const item = result.item as unknown as Partial<Memory>;
      
      const strengthScore = item.strength ?? 1.0;
      const age = now - (item.createdAt ?? now);
      const recencyScore = Math.max(0, 1 - (age / maxAge));
      
      const final = 
        (result.scores.rrf ?? result.score) * rrf +
        strengthScore * strength +
        recencyScore * recency;
      
      return {
        ...result,
        score: final,
        scores: {
          ...result.scores,
          strength: strengthScore,
          recency: recencyScore,
          final,
        },
      };
    }).sort((a, b) => b.score - a.score);
  }

  private emitEvent(
    type: string,
    namespace: readonly string[],
    key: string | undefined,
    durationMs: number,
    resultCount?: number
  ): void {
    this.onEvent?.({
      type: type as any,
      namespace: namespace.join('.'),
      userId: namespace[1],
      key,
      durationMs,
      resultCount,
    });
  }
}

// Type guards
function hasContent(value: unknown): value is { content: string } {
  return typeof value === 'object' && value !== null && 'content' in value;
}

function hasAccessTracking(value: unknown): value is { lastAccessed: number; accessCount: number } {
  return typeof value === 'object' && value !== null && 'lastAccessed' in value;
}

export interface MemoryStoreConfig {
  backend: StorageBackend;
  embeddingService?: EmbeddingService;
  onEvent?: (event: StoreEvent) => void;
}

export interface StoreEvent {
  type: 'get' | 'put' | 'delete' | 'list' | 'search';
  namespace: string;
  userId: string;
  key?: string;
  durationMs: number;
  resultCount?: number;
  error?: string;
}
```

### 4.3 Embedding Strategy (v13 Section 8.5)

```typescript
// packages/memory-store/src/search/embeddings.ts

/**
 * v13 Section 8.5 - Local Embeddings
 * 
 * Strategy Decision (for Sprint 0):
 * - Use @xenova/transformers for browser/PWA
 * - Use same library in Tauri (via webview)
 * - Model: nomic-embed-text-v1.5 (768 dimensions)
 * 
 * Post-MVP:
 * - Tauri: candle or ort for native performance
 * - Production: local embedding service
 */

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
  readonly modelId: string;
}

/**
 * Transformers.js embedding service
 * Works in browser and Tauri webview
 */
export class TransformersEmbeddingService implements EmbeddingService {
  private pipeline: any = null;
  private initPromise: Promise<void> | null = null;
  
  readonly dimensions = 768;
  readonly modelId = 'nomic-ai/nomic-embed-text-v1.5';

  private async init(): Promise<void> {
    if (this.pipeline) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      // Dynamic import to avoid SSR issues
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', this.modelId, {
        quantized: true,  // Use quantized model for faster inference
      });
    })();
    
    return this.initPromise;
  }

  async embed(text: string): Promise<number[]> {
    await this.init();
    
    // Nomic requires "search_query: " or "search_document: " prefix
    const prefixed = `search_document: ${text}`;
    
    const output = await this.pipeline(prefixed, {
      pooling: 'mean',
      normalize: true,
    });
    
    return Array.from(output.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.init();
    
    const prefixed = texts.map(t => `search_document: ${t}`);
    
    const outputs = await this.pipeline(prefixed, {
      pooling: 'mean',
      normalize: true,
    });
    
    // Reshape flat array into batch
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const start = i * this.dimensions;
      embeddings.push(Array.from(outputs.data.slice(start, start + this.dimensions)));
    }
    
    return embeddings;
  }

  /**
   * Embed a query (uses different prefix)
   */
  async embedQuery(text: string): Promise<number[]> {
    await this.init();
    
    const prefixed = `search_query: ${text}`;
    
    const output = await this.pipeline(prefixed, {
      pooling: 'mean',
      normalize: true,
    });
    
    return Array.from(output.data);
  }
}

/**
 * OpenAI embedding service (fallback for development)
 */
export class OpenAIEmbeddingService implements EmbeddingService {
  private apiKey: string;
  
  readonly dimensions = 1536;
  readonly modelId = 'text-embedding-3-small';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelId,
        input: text,
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelId,
        input: texts,
      }),
    });

    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  }
}

/**
 * Mock for testing
 */
export class MockEmbeddingService implements EmbeddingService {
  readonly dimensions = 768;
  readonly modelId = 'mock';

  async embed(text: string): Promise<number[]> {
    const hash = this.hashString(text);
    return Array.from({ length: this.dimensions }, (_, i) => 
      Math.sin(hash + i) * 0.5 + 0.5
    );
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }
}

/**
 * Factory function - chooses service based on environment
 */
export function createEmbeddingService(config?: {
  openaiApiKey?: string;
  preferLocal?: boolean;
}): EmbeddingService {
  // In tests, use mock
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return new MockEmbeddingService();
  }
  
  // Prefer local if available and requested
  if (config?.preferLocal !== false) {
    try {
      return new TransformersEmbeddingService();
    } catch {
      console.warn('Transformers.js not available, falling back to OpenAI');
    }
  }
  
  // Fall back to OpenAI
  if (config?.openaiApiKey) {
    return new OpenAIEmbeddingService(config.openaiApiKey);
  }
  
  throw new Error('No embedding service available');
}
```

### 4.4 SQLite Backend (for Tauri)

```typescript
// packages/memory-store/src/backends/sqlite.ts

import type { StorageBackend } from './types';
import type { StoreStats } from '../types';

/**
 * SQLite backend for Tauri desktop
 * Uses Tauri SQL plugin with SQLCipher encryption
 * 
 * v13 Section 8.13: "SQLite + SQLCipher + LanceDB"
 */
export class SQLiteBackend implements StorageBackend {
  private db: any = null;  // Tauri SQL connection
  private dbPath: string;
  private encryptionKey?: string;

  constructor(config: {
    dbPath: string;
    encryptionKey?: string;
  }) {
    this.dbPath = config.dbPath;
    this.encryptionKey = config.encryptionKey;
  }

  private async getDb(): Promise<any> {
    if (this.db) return this.db;
    
    // Dynamic import of Tauri SQL plugin
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    
    // Open with SQLCipher encryption if key provided
    const connectionString = this.encryptionKey
      ? `sqlite:${this.dbPath}?key=${this.encryptionKey}`
      : `sqlite:${this.dbPath}`;
    
    this.db = await Database.load(connectionString);
    
    // Create tables if not exist
    await this.initSchema();
    
    return this.db;
  }

  private async initSchema(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS memories (
        composite_key TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        context TEXT,
        embedding BLOB
      )
    `);
    
    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_namespace_user 
      ON memories (namespace, user_id)
    `);
    
    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_context 
      ON memories (context)
    `);
    
    // FTS5 for full-text search
    await this.db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts 
      USING fts5(content, content='memories', content_rowid='rowid')
    `);
  }

  private makeKey(namespace: string, userId: string, key: string): string {
    return `${namespace}::${userId}::${key}`;
  }

  async put<T>(namespace: string, userId: string, key: string, value: T): Promise<void> {
    const db = await this.getDb();
    const compositeKey = this.makeKey(namespace, userId, key);
    const content = (value as any).content ?? '';
    const context = (value as any).context ?? null;
    const embedding = (value as any).embedding 
      ? new Uint8Array(new Float32Array((value as any).embedding).buffer)
      : null;
    
    await db.execute(
      `INSERT OR REPLACE INTO memories 
       (composite_key, namespace, user_id, key, value, created_at, context, embedding)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        compositeKey,
        namespace,
        userId,
        key,
        JSON.stringify(value),
        Date.now(),
        context,
        embedding,
      ]
    );
    
    // Update FTS index
    if (content) {
      await db.execute(
        `INSERT INTO memories_fts (rowid, content) 
         SELECT rowid, json_extract(value, '$.content') 
         FROM memories WHERE composite_key = ?`,
        [compositeKey]
      );
    }
  }

  async get<T>(namespace: string, userId: string, key: string): Promise<T | null> {
    const db = await this.getDb();
    const compositeKey = this.makeKey(namespace, userId, key);
    
    const result = await db.select<{ value: string }[]>(
      'SELECT value FROM memories WHERE composite_key = ?',
      [compositeKey]
    );
    
    if (result.length === 0) return null;
    return JSON.parse(result[0].value);
  }

  async delete(namespace: string, userId: string, key: string): Promise<boolean> {
    const db = await this.getDb();
    const compositeKey = this.makeKey(namespace, userId, key);
    
    const result = await db.execute(
      'DELETE FROM memories WHERE composite_key = ?',
      [compositeKey]
    );
    
    return result.rowsAffected > 0;
  }

  async list<T>(namespace: string, userId: string, limit: number, offset: number): Promise<T[]> {
    const db = await this.getDb();
    
    const results = await db.select<{ value: string }[]>(
      `SELECT value FROM memories 
       WHERE namespace = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [namespace, userId, limit, offset]
    );
    
    return results.map(r => JSON.parse(r.value));
  }

  async exists(namespace: string, userId: string, key: string): Promise<boolean> {
    const db = await this.getDb();
    const compositeKey = this.makeKey(namespace, userId, key);
    
    const result = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM memories WHERE composite_key = ?',
      [compositeKey]
    );
    
    return result[0].count > 0;
  }

  async getStats(namespace: string, userId: string): Promise<StoreStats> {
    const db = await this.getDb();
    
    const result = await db.select<{
      count: number;
      oldest: number;
      newest: number;
    }[]>(
      `SELECT 
         COUNT(*) as count,
         MIN(created_at) as oldest,
         MAX(created_at) as newest
       FROM memories 
       WHERE namespace = ? AND user_id = ?`,
      [namespace, userId]
    );
    
    return {
      namespace,
      count: result[0].count,
      sizeBytes: 0,  // TODO: Calculate actual size
      oldestRecord: result[0].oldest ?? 0,
      newestRecord: result[0].newest ?? 0,
    };
  }

  async clear(namespace?: string, userId?: string): Promise<void> {
    const db = await this.getDb();
    
    if (!namespace && !userId) {
      await db.execute('DELETE FROM memories');
    } else if (namespace && userId) {
      await db.execute(
        'DELETE FROM memories WHERE namespace = ? AND user_id = ?',
        [namespace, userId]
      );
    } else if (namespace) {
      await db.execute('DELETE FROM memories WHERE namespace = ?', [namespace]);
    } else {
      await db.execute('DELETE FROM memories WHERE user_id = ?', [userId]);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Full-text search using FTS5
   */
  async fullTextSearch<T>(
    namespace: string,
    userId: string,
    query: string,
    limit: number
  ): Promise<T[]> {
    const db = await this.getDb();
    
    const results = await db.select<{ value: string }[]>(
      `SELECT m.value FROM memories m
       JOIN memories_fts fts ON m.rowid = fts.rowid
       WHERE m.namespace = ? AND m.user_id = ?
         AND memories_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      [namespace, userId, query, limit]
    );
    
    return results.map(r => JSON.parse(r.value));
  }
}
```

---

## 5. Sync-Compatible Design (v13 Section 8.14)

Even though OrbitDB integration is deferred, the interface must support sync from day 1.

### 5.1 Sync Types

```typescript
// packages/memory-store/src/sync/types.ts

import type { Memory, Episode, Entity } from '@ownyou/shared-types';

/**
 * v13 Section 8.14.3 - Sync Payload
 */
export interface SyncPayload {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  keyDerivationSalt: string;
  
  // Metadata (not encrypted)
  namespace: string;
  operation: 'put' | 'update' | 'delete';
  timestamp: number;
  deviceId: string;
  vectorClock: VectorClock;
}

export type VectorClock = Record<string, number>;

/**
 * v13 Section 8.14.4 - Conflict Resolution
 */
export type ConflictStrategy = 
  | 'latest_wins'      // LWW for preferences
  | 'merge'            // For episodes (append both)
  | 'merge_properties' // For entities
  | 'sum_reconcile'    // For earnings
  | 'flag_for_review'; // For procedural rules

export interface ConflictResolution<T> {
  strategy: ConflictStrategy;
  resolve(local: T, remote: T, localClock: VectorClock, remoteClock: VectorClock): T;
}

/**
 * Namespace-specific conflict strategies (v13 Section 8.14.4)
 */
export const CONFLICT_STRATEGIES: Record<string, ConflictStrategy> = {
  'ownyou.semantic': 'latest_wins',
  'ownyou.episodic': 'merge',
  'ownyou.procedural': 'flag_for_review',
  'ownyou.entities': 'merge_properties',
  'ownyou.relationships': 'latest_wins',
  'ownyou.missions': 'latest_wins',
  'ownyou.earnings': 'sum_reconcile',
};

/**
 * Sync scope filter (v13 Section 8.14.1)
 */
export interface SyncScopeFilter {
  shouldSync(namespace: string, item: unknown): boolean;
}

export class EpisodicSyncFilter implements SyncScopeFilter {
  shouldSync(namespace: string, item: unknown): boolean {
    if (namespace !== 'ownyou.episodic') return true;
    
    const episode = item as Episode;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // Sync if: recent, negative outcome, has feedback, or led to rule
    return (
      episode.timestamp > thirtyDaysAgo ||
      episode.outcome?.includes('negative') ||
      episode.userFeedback !== undefined
    );
  }
}
```

### 5.2 Encryption Helpers

```typescript
// packages/memory-store/src/sync/encryption.ts

/**
 * v13 Section 8.14.3 - AES-GCM encryption for sync
 */
export async function encryptForSync(
  data: unknown,
  encryptionKey: CryptoKey
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    plaintext
  );
  
  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
  };
}

export async function decryptFromSync(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  encryptionKey: CryptoKey
): Promise<unknown> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    ciphertext
  );
  
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/**
 * Derive encryption key from wallet signature (v13 Section 8.14.3)
 */
export async function deriveEncryptionKey(
  walletSignature: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const signatureBytes = encoder.encode(walletSignature);
  
  // Import as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    signatureBytes,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

---

## 6. Updated Sprint 0 Timeline

| Day | Focus | v13 Alignment |
|-----|-------|---------------|
| 1-2 | Monorepo + shared-types | All v13 types defined |
| 3-4 | Tauri scaffold + SQLite | Section 8.13 |
| 5-6 | memory-store core | Section 8.4, 8.12 |
| 7-8 | memory-store search | Section 8.5, 8.7 |
| 9 | llm-client + budget | Section 6.10-6.11 |
| 10 | observability | Section 10.x |
| 11-12 | Phase 0 migration | Phase 0 → packages |
| 13-14 | Integration + CI | End-to-end test |

---

## 7. Acceptance Criteria (v13-Aligned)

| Criteria | v13 Section | Test |
|----------|-------------|------|
| All v13 types compile | 8.4, 2, 3, 7 | `pnpm typecheck` |
| Namespaces match v13 | 8.12 | Unit test: NS functions |
| SQLite backend works | 8.13 | Integration test in Tauri |
| Embeddings generate locally | 8.5 | Unit test: TransformersEmbeddingService |
| Hybrid search works | 8.7 | Unit test: semantic + BM25 + RRF |
| Budget enforcement works | 6.10 | Unit test: throttling at 80% |
| Agent trace matches v13 | 10.2 | Unit test: trace schema |
| Sync types defined | 8.14 | Type compiles, encryption works |
| Phase 0 migrated | Phase 0 | IAB classifier importable |

---

**Document Status:** Sprint 0 Technical Specification v2 (v13-Aligned)  
**Architecture Reference:** OwnYou_architecture_v13.md  
**Compliance:** 100% alignment with v13 requirements
