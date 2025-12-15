# Sprint 11a: Production Wiring - From Mock Data to Real System

**Duration:** 4 weeks
**Status:** PLANNED
**Goal:** Wire ALL complete backend packages to the consumer app, replacing ALL mock data with real data flows. This includes integrating Sprint 4 (Memory + Reflection), Sprint 5 (Resilience + Triggers), Sprint 6 (Ikigai), Sprint 7 (Restaurant/Travel/Events agents), and Sprint 8 (Data Sources + Diagnostic).
**Success Criteria:** User connects Gmail → Emails fetched → IAB classified → Memory stored → Triggers fire → Agents (with Ikigai context + memory learning) generate personalized mission cards → Feedback updates episodes → Reflection synthesizes procedural rules → Next agent runs are smarter.
**Depends On:** Sprint 8 (Data Sources + Diagnostic), Sprint 10 (Sync), Sprint 11 (Consumer UI)
**v13 Coverage:** Full data pipeline integration (Sections 2, 3, 5, 8)
**Target Tests:** 220+ new integration tests (includes Sprint 4/5/6 verification)

---

## API Verification Status

This specification has been verified against actual package exports. Sections marked with "CORRECTED" use verified APIs:

| Context | Status | Key Corrections |
|---------|--------|-----------------|
| **ResilienceContext** | ✅ VERIFIED | Uses `circuitBreakers` singleton + `llmInferenceWithFallback` function (NOT `LLMFallbackChain` class) |
| **MemoryContext** | ✅ VERIFIED | Uses `ReflectionTriggerManager` class (NOT `ReflectionNode`), `runReflection` function |
| **DataSourceContext** | ✅ VERIFIED | Uses `EmailPipeline.run(token, classifierFn)`, `CalendarEventFetcher` + `CalendarEventClassifier` (NOT `CalendarPipeline`), `TransactionFetcher` + `TransactionClassifier` (NOT `FinancialPipeline`) |
| **TriggerContext** | ✅ VERIFIED | Uses `new LLMClient({ provider, budgetConfig })` (NOT `createLLMClient`) |

### Non-Existent APIs That Were Removed:

- ❌ `LLMFallbackChain` class → Use `llmInferenceWithFallback` function
- ❌ `ReflectionNode` class → Use `ReflectionTriggerManager` class + `runReflection` function
- ❌ `CalendarPipeline` class → Use `CalendarEventFetcher` + `CalendarEventClassifier`
- ❌ `FinancialPipeline` class → Use `TransactionFetcher` + `TransactionClassifier`
- ❌ `createCalendarProvider()` → Use `createCalendarFetcher()` + `createCalendarClassifier()`
- ❌ `createPlaidClient()` → Use `createMockPlaidClient()` or real Plaid SDK
- ❌ `createLLMClient()` → Use `new LLMClient({ provider, budgetConfig })`

---

## Critical Missing Integrations Analysis

### Sprint 4: Memory Intelligence + Content Agent ✅ COMPLETE BUT NOT WIRED

| Package | Status | Missing Integration |
|---------|--------|---------------------|
| `@ownyou/memory` | ✅ 65 tests | Not called when agents run |
| `@ownyou/reflection` | ✅ 22 tests | ReflectionNode never triggered |
| `@ownyou/agents-content` | ✅ 11 tests | Not registered in AgentScheduler |

**Gap:** Memory tools exist but agents don't call them. Reflection exists but never runs. Episodes recorded but never analyzed. Content Agent complete but not scheduled.

### Sprint 5: Resilience + Trigger System ✅ COMPLETE BUT NOT WIRED

| Package | Status | Missing Integration |
|---------|--------|---------------------|
| `@ownyou/resilience` | ✅ 95 tests | CircuitBreakers not protecting APIs |
| `@ownyou/triggers` | ✅ 74 tests | TriggerEngine not instantiated |

**Gap:** 4-mode trigger system complete but TriggerEngine never created in consumer app. CircuitBreakers exist but not wrapping external API calls.

### Sprint 6: Ikigai Intelligence Layer ✅ COMPLETE BUT NOT WIRED

| Package | Status | Missing Integration |
|---------|--------|---------------------|
| `@ownyou/ikigai` | ✅ 60+ tests | IkigaiInferenceEngine never runs |

**Gap:** Ikigai inference, well-being scoring, rewards calculation all complete but never called. Missions show in UI but not prioritized by Ikigai. No Ikigai points awarded.

### Sprint 7: Additional Agents ✅ COMPLETE BUT NOT WIRED

| Package | Status | Missing Integration |
|---------|--------|---------------------|
| `@ownyou/agents-restaurant` | ✅ 55 tests | Not in AgentScheduler |
| `@ownyou/agents-travel` | ✅ 49 tests | Not in AgentScheduler |
| `@ownyou/agents-events` | ✅ 24 tests | Not in AgentScheduler |

**Gap:** All 6 agents exist and are tested, but only ShoppingAgent registered in AgentScheduler.

### Sprint 8: Data Sources + Diagnostic ✅ COMPLETE BUT NOT WIRED

| Package | Status | Missing Integration |
|---------|--------|---------------------|
| `@ownyou/data-financial` | ✅ 113 tests | Plaid flow not wired to UI |
| `@ownyou/data-calendar` | ✅ 131 tests | Calendar sync not wired to UI |
| `@ownyou/agents-diagnostic` | ✅ 63 tests | Not in AgentScheduler |

**Gap:** Financial and Calendar pipelines exist but Settings page doesn't connect them. Diagnostic Agent exists but never runs.

---

## Problem Statement

### Current State (POST-Sprint 11)

Sprint 11 delivered a **beautiful UI shell** with:
- IndexedDBBackend for persistence
- Real store queries via `NS.missionCards(userId)`
- OAuth popup flow (real implementation)
- All 9 card variants, Ikigai wheel, Settings screens
- 410 tests passing (159 consumer + 251 ui-components)

**But the UI is disconnected from the backend:**

```
CURRENT DATA FLOW (BROKEN):
┌─────────────────┐
│ User opens app  │
└────────┬────────┘
         │
         v
┌─────────────────────────┐
│ useMissions() checks    │
│ if store is empty       │
└────────┬────────────────┘
         │ (store is empty)
         v
┌─────────────────────────┐
│ SAMPLE_MISSIONS seeded  │  ← PROBLEM: Hardcoded mock data
│ (8 fake mission cards)  │
└────────┬────────────────┘
         │
         v
┌─────────────────────────┐
│ UI renders fake cards   │
│ No personalization      │
│ No learning             │
└─────────────────────────┘
```

### Target State (POST-Sprint 11a)

```
FULL PRODUCTION DATA FLOW (WITH MEMORY, IKIGAI, RESILIENCE):

┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA INGESTION LAYER                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Gmail      │  │   Outlook    │  │   Calendar   │  │   Plaid      │ │
│  │   (OAuth)    │  │   (OAuth)    │  │   (OAuth)    │  │   (Link)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         └────────────────┬┴─────────────────┴─────────────────┘          │
│                          │                                               │
│                          v                                               │
│               ┌──────────────────────┐                                   │
│               │  DataSourceContext   │                                   │
│               │  (Sprint 11a NEW)    │                                   │
│               └──────────┬───────────┘                                   │
│                          │                                               │
└──────────────────────────┼───────────────────────────────────────────────┘
                           │
                           v
┌─────────────────────────────────────────────────────────────────────────┐
│                     IAB CLASSIFICATION LAYER (Sprint 1b)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  @ownyou/iab-classifier (6-node LangGraph workflow)                │ │
│  │  - Load emails → Retrieve profile → Analyze (4 analyzers)          │ │
│  │  - Reconcile → Update memory → Store classifications               │ │
│  └──────────────────────────────┬─────────────────────────────────────┘ │
│                                  │                                       │
│                                  v                                       │
│              ┌───────────────────────────────────┐                       │
│              │ NS.iabClassifications(userId)     │ ← Stored in LangGraph │
│              └───────────────────────────────────┘                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                           │
                           │ (store change detected)
                           v
┌─────────────────────────────────────────────────────────────────────────┐
│                      TRIGGER LAYER (Sprint 5)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  TriggerEngine (4-mode trigger system)                             │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ │ │
│  │  │ Data-Driven │ │ Scheduled   │ │ Event-Driven│ │ User-Driven   │ │ │
│  │  │ (StoreWatch)│ │ (CronStyle) │ │ (Calendar)  │ │ (NL Request)  │ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └───────┬───────┘ │ │
│  │         └───────────────┴───────────────┴─────────────────┘         │ │
│  │                                  │                                   │ │
│  │                                  v                                   │ │
│  │                    ┌─────────────────────────────┐                   │ │
│  │                    │    Agent Coordinator        │                   │ │
│  │                    │    (Intent Routing)         │                   │ │
│  │                    └─────────────────────────────┘                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                           │
                           │ (route to appropriate agent)
                           v
┌─────────────────────────────────────────────────────────────────────────┐
│                    AGENT LAYER (Sprints 3, 4, 7, 8)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  AgentScheduler (ALL 6 AGENTS REGISTERED)                          │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │ Shopping │ │Restaurant│ │  Travel  │ │  Events  │ │ Content  │ │ │
│  │  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │ │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │ │
│  │       │            │            │            │            │        │ │
│  │       └────────────┴────────────┴────────────┴────────────┘        │ │
│  │                               │                                     │ │
│  │                               │  ┌──────────────────┐               │ │
│  │                               └──┤ Diagnostic Agent │ (weekly)      │ │
│  │                                  └──────────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  EACH AGENT USES:                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ @ownyou/memory (Sprint 4)                                        │   │
│  │ - searchMemories() for context                                   │   │
│  │ - saveObservation() for learnings                                │   │
│  │ - saveEpisode() for interaction records                          │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ @ownyou/ikigai (Sprint 6)                                        │   │
│  │ - getIkigaiContextForAgent() for personalization                 │   │
│  │ - sortMissionsByWellBeing() for prioritization                   │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ @ownyou/resilience (Sprint 5)                                    │   │
│  │ - circuitBreakers.execute() for all external APIs                │   │
│  │ - llmInferenceWithFallback() for 7-level LLM fallback            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                           │
                           │ (agent generates mission)
                           v
┌─────────────────────────────────────────────────────────────────────────┐
│                    MISSION OUTPUT LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ NS.missionCards(userId) - Agent-generated missions with:           │ │
│  │ - ikigaiDimensions: ['experiences', 'relationships', ...]          │ │
│  │ - ikigaiAlignmentBoost: 0.4 (from well-being scoring)              │ │
│  │ - evidenceChain: [{ sourceId, sourceType, summary }]               │ │
│  │ - proceduralContext: "User prefers X based on previous feedback"   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                           │
                           v
┌─────────────────────────────────────────────────────────────────────────┐
│                         UI LAYER (Sprint 11)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ useMissions() - Reads from store, NO SAMPLE_MISSIONS               │ │
│  │ useProfile() - Real Ikigai profile from NS.ikigaiProfile()         │ │
│  │ useFeedback() - Updates NS.missionFeedback(), triggers reflection  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                           │
                           │ (user gives feedback: love/like/meh)
                           v
┌─────────────────────────────────────────────────────────────────────────┐
│                    LEARNING LAYER (Sprint 4)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Episode updated with user feedback                              │ │
│  │    updateEpisodeWithFeedback(episodeId, 'love', userId, store)     │ │
│  │                                                                     │ │
│  │ 2. ReflectionNode triggered (5 episodes OR negative feedback)      │ │
│  │    - Decay old memories (5%/week)                                   │ │
│  │    - Prune low-strength (<0.1)                                      │ │
│  │    - Synthesize procedural rules from episode patterns              │ │
│  │                                                                     │ │
│  │ 3. ProceduralRules stored per agent type                           │ │
│  │    NS.proceduralMemory(userId) → "shopping_rules"                  │ │
│  │                                                                     │ │
│  │ 4. Next agent run injects learned preferences                      │ │
│  │    buildAgentContext(userId, agentType, store)                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                           │
                           │ (learning loop completes)
                           v
┌─────────────────────────────────────────────────────────────────────────┐
│                    IKIGAI REWARDS (Sprint 6)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ awardMissionPoints(mission, userId, store)                         │ │
│  │ - Base: 100 points                                                  │ │
│  │ - Experience missions: 2.0x multiplier                              │ │
│  │ - Relationship missions: 1.5x multiplier                            │ │
│  │ - Giving missions: 2.5x multiplier                                  │ │
│  │                                                                     │ │
│  │ Categories tracked: Explorer, Connector, Helper, Achiever          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## What Exists vs What's Missing

### COMPLETE Packages (Ready to Wire)

| Package | Tests | Status | Missing Integration |
|---------|-------|--------|---------------------|
| `@ownyou/email` | 80+ | ✅ | Not called from consumer app |
| `@ownyou/data-financial` | 113 | ✅ | Not called from consumer app |
| `@ownyou/data-calendar` | 131 | ✅ | Not called from consumer app |
| `@ownyou/iab-classifier` | 75+ | ✅ | Not called when data arrives |
| `@ownyou/ikigai` | 60+ | ✅ | Not called for mission prioritization |
| `@ownyou/triggers` | 74 | ✅ | TriggerEngine not instantiated |
| `@ownyou/scheduler` | 25 | ✅ | Only ShoppingAgent registered |
| `@ownyou/agents-shopping` | 29 | ✅ | Not receiving real triggers |
| `@ownyou/agents-restaurant` | 55 | ✅ | Not registered in scheduler |
| `@ownyou/agents-travel` | 49 | ✅ | Not registered in scheduler |
| `@ownyou/agents-events` | 24 | ✅ | Not registered in scheduler |
| `@ownyou/agents-content` | 11 | ✅ | Not registered in scheduler |
| `@ownyou/agents-diagnostic` | 63 | ✅ | Not registered in scheduler |

### Consumer App Gaps

| File | Current State | Required Change |
|------|---------------|-----------------|
| `useMissions.ts` | Seeds `SAMPLE_MISSIONS` | Remove seeding, only read from store |
| `useProfile.ts` | Seeds sample profile | Remove seeding, only read from store |
| `StoreContext.tsx` | Uses `MockEmbeddingService` | Use real embedding service |
| (missing) | No `DataSourceContext` | Create data fetching orchestration |
| (missing) | No `TriggerContext` | Create trigger engine initialization |
| (missing) | No agent scheduler hook | Create `useAgentScheduler` |
| `OAuthFlow.tsx` | Popup returns token | Token must trigger data fetch |

---

## Package 1: Orchestration Layer

**Purpose:** Wire all backend packages together in the consumer app

### New Files to Create

```
apps/consumer/src/
├── contexts/
│   ├── DataSourceContext.tsx    # NEW: Manages OAuth + data fetching
│   ├── TriggerContext.tsx       # NEW: Initializes TriggerEngine + agents
│   └── StoreContext.tsx         # MODIFY: Real embedding service
├── hooks/
│   ├── useDataSource.ts         # NEW: Connect/fetch data sources
│   ├── useAgentScheduler.ts     # NEW: Start/stop agent scheduler
│   └── useMissions.ts           # MODIFY: Remove SAMPLE_MISSIONS
```

### 1.1 DataSourceContext (CORRECTED - Uses Actual Package APIs)

```typescript
// apps/consumer/src/contexts/DataSourceContext.tsx
/**
 * DataSourceContext - Manages data source connections and fetching
 *
 * CORRECTED API USAGE:
 * - EmailPipeline takes PipelineConfig { provider: 'microsoft' | 'google', ... }
 * - EmailPipeline.run(accessToken, classifier?) - classifier is a function
 * - CalendarEventFetcher + createCalendarFetcher() (NOT CalendarPipeline)
 * - CalendarEventClassifier + createCalendarClassifier()
 * - TransactionFetcher + createTransactionFetcher() (NOT FinancialPipeline)
 * - TransactionClassifier + createTransactionClassifier()
 * - createIABClassifier returns { invoke: async (input) => result }
 *
 * Responsibilities:
 * 1. Track connected data sources (email, calendar, financial)
 * 2. Store OAuth tokens in secure storage
 * 3. Trigger data fetching when sources connect
 * 4. Run IAB classification on fetched data
 * 5. Store classified data in LangGraph Store
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
// Email package - uses EmailPipeline class
import { EmailPipeline, type PipelineConfig, type Email } from '@ownyou/email';
// Calendar package - uses separate Fetcher and Classifier classes (NO CalendarPipeline)
import {
  CalendarEventFetcher,
  createCalendarFetcher,
  CalendarEventClassifier,
  createCalendarClassifier,
  CalendarStore,
  createCalendarStore,
  type CalendarEvent,
} from '@ownyou/data-calendar';
// Financial package - uses separate Fetcher and Classifier classes (NO FinancialPipeline)
import {
  TransactionFetcher,
  createTransactionFetcher,
  TransactionClassifier,
  createTransactionClassifier,
  FinancialStore,
  createFinancialStore,
  createMockPlaidClient,
  type Transaction,
} from '@ownyou/data-financial';
// IAB Classifier - returns { invoke } wrapper
import { createIABClassifier } from '@ownyou/iab-classifier';
import { NS } from '@ownyou/shared-types';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';

export interface DataSource {
  id: 'gmail' | 'outlook' | 'google-calendar' | 'microsoft-calendar' | 'plaid';
  provider: 'google' | 'microsoft' | 'plaid';
  type: 'email' | 'calendar' | 'financial';
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'syncing';
  lastSync?: Date;
  itemCount?: number;
  error?: string;
}

interface DataSourceContextValue {
  dataSources: DataSource[];
  connectSource: (sourceId: DataSource['id'], accessToken: string) => Promise<void>;
  disconnectSource: (sourceId: DataSource['id']) => Promise<void>;
  syncSource: (sourceId: DataSource['id']) => Promise<void>;
  syncAll: () => Promise<void>;
  isSyncing: boolean;
}

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const { store, isReady } = useStore();
  const { wallet } = useAuth();
  const userId = wallet?.address ?? 'anonymous';

  const [dataSources, setDataSources] = useState<DataSource[]>([
    { id: 'gmail', provider: 'google', type: 'email', status: 'disconnected' },
    { id: 'outlook', provider: 'microsoft', type: 'email', status: 'disconnected' },
    { id: 'google-calendar', provider: 'google', type: 'calendar', status: 'disconnected' },
    { id: 'microsoft-calendar', provider: 'microsoft', type: 'calendar', status: 'disconnected' },
    { id: 'plaid', provider: 'plaid', type: 'financial', status: 'disconnected' },
  ]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load saved tokens on mount
  useEffect(() => {
    if (!isReady || !wallet) return;
    loadSavedTokens();
  }, [isReady, wallet]);

  const loadSavedTokens = async () => {
    // Load OAuth tokens from secure storage and restore connection states
    // Implementation will check IndexedDB for saved tokens
  };

  const connectSource = useCallback(async (sourceId: DataSource['id'], accessToken: string) => {
    if (!store || !isReady) throw new Error('Store not ready');

    // Update status to connecting
    setDataSources(prev => prev.map(ds =>
      ds.id === sourceId ? { ...ds, status: 'connecting' } : ds
    ));

    try {
      // Store the access token securely
      await store.put(NS.uiPreferences(userId), `oauth_${sourceId}`, {
        accessToken,
        savedAt: Date.now(),
      });

      // Update to connected
      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? { ...ds, status: 'connected' } : ds
      ));

      // Immediately sync after connecting
      await syncSource(sourceId);
    } catch (error) {
      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? {
          ...ds,
          status: 'error',
          error: error instanceof Error ? error.message : 'Connection failed'
        } : ds
      ));
      throw error;
    }
  }, [store, isReady, userId]);

  /**
   * Sync a data source - fetch data, classify, and store
   *
   * CORRECT API USAGE:
   * - Email: EmailPipeline constructor takes PipelineConfig, .run(token, classifierFn)
   * - Calendar: CalendarEventFetcher.fetch() + CalendarEventClassifier.classify()
   * - Financial: TransactionFetcher.fetch() + TransactionClassifier.classify()
   */
  const syncSource = useCallback(async (sourceId: DataSource['id']) => {
    if (!store || !isReady) throw new Error('Store not ready');

    const source = dataSources.find(ds => ds.id === sourceId);
    if (!source || source.status === 'disconnected') {
      throw new Error('Source not connected');
    }

    // Update status to syncing
    setDataSources(prev => prev.map(ds =>
      ds.id === sourceId ? { ...ds, status: 'syncing' } : ds
    ));

    try {
      // Get the saved token
      const tokenData = await store.get<{ accessToken: string }>(
        NS.uiPreferences(userId),
        `oauth_${sourceId}`
      );
      if (!tokenData?.accessToken) throw new Error('No access token found');

      // Create IAB classifier wrapper
      // createIABClassifier returns { invoke: async (input) => { success, classification } }
      const iabClassifier = createIABClassifier({ store });

      let itemCount = 0;

      if (source.type === 'email') {
        // ========================================
        // EMAIL SYNC - Uses EmailPipeline class
        // ========================================
        // EmailPipeline constructor takes PipelineConfig
        const pipelineConfig: PipelineConfig = {
          provider: source.provider as 'google' | 'microsoft',
          runClassification: true,
          fetchOptions: {
            maxResults: 100,
            daysBack: 30,
          },
        };

        const pipeline = new EmailPipeline(pipelineConfig);

        // Create classifier function for EmailPipeline.run()
        // EmailPipeline expects: (emails: Email[]) => Promise<IABClassification[]>
        const classifyEmails = async (emails: Email[]) => {
          const results = [];
          for (const email of emails) {
            const result = await iabClassifier.invoke({
              userId,
              source: 'email',
              sourceItemId: email.id,
              text: `${email.subject} ${email.body ?? ''}`,
            });
            if (result.success) {
              results.push(result.classification);
            }
          }
          return results;
        };

        // Run pipeline with access token and classifier function
        const result = await pipeline.run(tokenData.accessToken, classifyEmails);
        itemCount = result.emailsFetched;

      } else if (source.type === 'calendar') {
        // ========================================
        // CALENDAR SYNC - Uses Fetcher + Classifier + Store
        // NO CalendarPipeline class exists!
        // ========================================
        // Create fetcher (fetches events from Google/Microsoft)
        const fetcher = createCalendarFetcher({
          provider: source.provider as 'google' | 'microsoft',
          accessToken: tokenData.accessToken,
        });

        // Create classifier (classifies events with IAB taxonomy)
        const classifier = createCalendarClassifier({
          llmClassifier: async (event: CalendarEvent) => {
            const result = await iabClassifier.invoke({
              userId,
              source: 'calendar',
              sourceItemId: event.id,
              text: `${event.title} ${event.description ?? ''}`,
            });
            return result.success ? result.classification : null;
          },
        });

        // Create store for persistence
        const calendarStore = createCalendarStore({ memoryStore: store, userId });

        // Fetch events
        const events = await fetcher.fetch({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),   // 90 days ahead
        });

        // Classify events
        const classifiedEvents = await classifier.classify(events);

        // Store events
        await calendarStore.saveEvents(classifiedEvents);

        itemCount = events.length;

      } else if (source.type === 'financial') {
        // ========================================
        // FINANCIAL SYNC - Uses Fetcher + Classifier + Store
        // NO FinancialPipeline class exists!
        // ========================================
        // Create fetcher (fetches transactions from Plaid)
        // In production, use real Plaid client; in dev, use mock
        const plaidClient = createMockPlaidClient(); // TODO: Real Plaid in production

        const fetcher = createTransactionFetcher({
          plaidClient,
          accessToken: tokenData.accessToken,
        });

        // Create classifier (classifies transactions with IAB taxonomy)
        const classifier = createTransactionClassifier({
          llmClassifier: async (transaction: Transaction) => {
            const result = await iabClassifier.invoke({
              userId,
              source: 'financial',
              sourceItemId: transaction.id,
              text: `${transaction.merchantName} ${transaction.category} $${transaction.amount}`,
            });
            return result.success ? result.classification : null;
          },
        });

        // Create store for persistence
        const financialStore = createFinancialStore({ memoryStore: store, userId });

        // Fetch transactions
        const fetchResult = await fetcher.fetch({
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          endDate: new Date(),
        });

        // Classify transactions
        const classifiedTransactions = await classifier.classify(fetchResult.transactions);

        // Store transactions
        await financialStore.saveTransactions(classifiedTransactions);

        itemCount = fetchResult.transactions.length;
      }

      // Update to connected with sync info
      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? {
          ...ds,
          status: 'connected',
          lastSync: new Date(),
          itemCount,
          error: undefined,
        } : ds
      ));
    } catch (error) {
      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? {
          ...ds,
          status: 'error',
          error: error instanceof Error ? error.message : 'Sync failed'
        } : ds
      ));
      throw error;
    }
  }, [store, isReady, userId, dataSources]);

  const disconnectSource = useCallback(async (sourceId: DataSource['id']) => {
    if (!store || !isReady) throw new Error('Store not ready');

    // Remove the saved token
    await store.delete(NS.uiPreferences(userId), `oauth_${sourceId}`);

    // Update to disconnected
    setDataSources(prev => prev.map(ds =>
      ds.id === sourceId ? {
        ...ds,
        status: 'disconnected',
        lastSync: undefined,
        itemCount: undefined,
        error: undefined,
      } : ds
    ));
  }, [store, isReady, userId]);

  const syncAll = useCallback(async () => {
    setIsSyncing(true);
    try {
      const connected = dataSources.filter(ds => ds.status === 'connected');
      await Promise.all(connected.map(ds => syncSource(ds.id)));
    } finally {
      setIsSyncing(false);
    }
  }, [dataSources, syncSource]);

  const value: DataSourceContextValue = {
    dataSources,
    connectSource,
    disconnectSource,
    syncSource,
    syncAll,
    isSyncing,
  };

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource() {
  const context = useContext(DataSourceContext);
  if (!context) {
    throw new Error('useDataSource must be used within a DataSourceProvider');
  }
  return context;
}
```

### 1.2 TriggerContext (CORRECTED - Uses Actual Package APIs)

```typescript
// apps/consumer/src/contexts/TriggerContext.tsx
/**
 * TriggerContext - Initializes and manages the TriggerEngine
 *
 * CORRECTED API USAGE:
 * - LLMClient is a class, NOT createLLMClient function
 * - LLMClient constructor takes { provider: LLMProvider, budgetConfig }
 * - TriggerEngine uses AgentStore interface (MemoryStore implements this)
 *
 * Responsibilities:
 * 1. Create TriggerEngine with all agents registered
 * 2. Watch store namespaces for data-driven triggers
 * 3. Run scheduled triggers (daily digest, weekly review)
 * 4. Route user requests to appropriate agents
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { TriggerEngine, type TriggerEngineStats } from '@ownyou/triggers';
import { ShoppingAgent } from '@ownyou/agents-shopping';
import { RestaurantAgent } from '@ownyou/agents-restaurant';
import { TravelAgent } from '@ownyou/agents-travel';
import { EventsAgent } from '@ownyou/agents-events';
import { ContentAgent } from '@ownyou/agents-content';
import { DiagnosticAgent } from '@ownyou/agents-diagnostic';
// CORRECT: LLMClient is a class, not a function
import { LLMClient, MockLLMProvider } from '@ownyou/llm-client';
import { NAMESPACES, type AgentType } from '@ownyou/shared-types';
import type { BaseAgent } from '@ownyou/agents-base';
import type { TriggerResult } from '@ownyou/triggers';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';

interface TriggerContextValue {
  isRunning: boolean;
  stats: TriggerEngineStats | null;
  handleUserRequest: (request: string) => Promise<TriggerResult>;
  start: () => void;
  stop: () => void;
}

const TriggerContext = createContext<TriggerContextValue | null>(null);

/**
 * Agent factory - creates agent instances by type
 *
 * ALL 6 AGENTS MUST BE REGISTERED HERE
 */
function createAgent(type: AgentType): BaseAgent | null {
  switch (type) {
    case 'shopping':
      return new ShoppingAgent();
    case 'restaurant':
      return new RestaurantAgent();
    case 'travel':
      return new TravelAgent();
    case 'events':
      return new EventsAgent();
    case 'content':
      return new ContentAgent();
    case 'diagnostic':
      return new DiagnosticAgent();
    default:
      console.warn(`[TriggerContext] Unknown agent type: ${type}`);
      return null;
  }
}

export function TriggerProvider({ children }: { children: ReactNode }) {
  const { store, isReady } = useStore();
  const { wallet, isAuthenticated } = useAuth();
  const userId = wallet?.address ?? 'anonymous';

  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<TriggerEngineStats | null>(null);
  const engineRef = useRef<TriggerEngine | null>(null);

  // Initialize TriggerEngine when store is ready
  useEffect(() => {
    if (!isReady || !isAuthenticated || !store) return;

    // CORRECT: LLMClient is a class with constructor({ provider, budgetConfig })
    const llm = new LLMClient({
      provider: new MockLLMProvider(), // Uses mock in dev, real provider in production
      budgetConfig: { monthlyBudgetUsd: 10 },
    });

    // Create TriggerEngine with all agents
    const engine = new TriggerEngine({
      store,
      llm,
      userId,
      watchNamespaces: [
        NAMESPACES.IAB_CLASSIFICATIONS,
        NAMESPACES.IKIGAI_PROFILE,
        NAMESPACES.FINANCIAL_TRANSACTIONS,
        NAMESPACES.CALENDAR_EVENTS,
        NAMESPACES.MISSION_FEEDBACK,
      ],
      schedules: {
        'daily_digest': '0 9 * * *',        // 9am daily
        'weekly_review': '0 10 * * 0',      // Sunday 10am
        'diagnostic': '0 9 * * 0',          // Sunday 9am (before weekly review)
      },
      agentFactory: createAgent,
    });

    // Register all agents with their configurations
    engine.registerAgent({
      type: 'shopping',
      namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.IKIGAI_PROFILE],
      intents: ['buy', 'purchase', 'shopping', 'deal', 'save money'],
      description: 'Shopping deals and product recommendations',
      enabled: true,
    });

    engine.registerAgent({
      type: 'restaurant',
      namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.CALENDAR],
      intents: ['eat', 'restaurant', 'dinner', 'lunch', 'food'],
      description: 'Restaurant recommendations and reservations',
      enabled: true,
    });

    engine.registerAgent({
      type: 'travel',
      namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.CALENDAR],
      intents: ['travel', 'trip', 'vacation', 'flight', 'hotel'],
      description: 'Travel planning and booking',
      enabled: true,
    });

    engine.registerAgent({
      type: 'events',
      namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.CALENDAR, NAMESPACES.INTERESTS],
      intents: ['event', 'concert', 'show', 'entertainment', 'tickets'],
      description: 'Event discovery and tickets',
      enabled: true,
    });

    engine.registerAgent({
      type: 'content',
      namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.IKIGAI_PROFILE],
      intents: ['read', 'watch', 'listen', 'learn', 'podcast', 'article'],
      description: 'Content recommendations',
      enabled: true,
    });

    engine.registerAgent({
      type: 'diagnostic',
      namespaces: ['*'], // Reads from all namespaces
      intents: ['analyze', 'profile', 'insights', 'patterns'],
      description: 'Profile analysis and insights',
      enabled: true,
    });

    engineRef.current = engine;

    // Auto-start when ready
    engine.start();
    setIsRunning(true);

    // Update stats periodically
    const statsInterval = setInterval(() => {
      if (engineRef.current) {
        setStats(engineRef.current.getStats());
      }
    }, 5000);

    return () => {
      clearInterval(statsInterval);
      engine.stop();
      engineRef.current = null;
    };
  }, [isReady, isAuthenticated, store, userId]);

  const handleUserRequest = useCallback(async (request: string): Promise<TriggerResult> => {
    if (!engineRef.current) {
      return {
        triggerId: 'error',
        agentType: 'unknown' as AgentType,
        success: false,
        skipped: true,
        error: 'Trigger engine not initialized',
      };
    }
    return engineRef.current.handleUserRequest(request);
  }, []);

  const start = useCallback(() => {
    engineRef.current?.start();
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setIsRunning(false);
  }, []);

  const value: TriggerContextValue = {
    isRunning,
    stats,
    handleUserRequest,
    start,
    stop,
  };

  return (
    <TriggerContext.Provider value={value}>
      {children}
    </TriggerContext.Provider>
  );
}

export function useTrigger() {
  const context = useContext(TriggerContext);
  if (!context) {
    throw new Error('useTrigger must be used within a TriggerProvider');
  }
  return context;
}
```

### 1.3 Update StoreContext (Real Embedding Service)

```typescript
// apps/consumer/src/contexts/StoreContext.tsx - Line ~127
// CHANGE FROM:
embeddingService: new MockEmbeddingService(), // TODO: Real embedding service

// CHANGE TO:
embeddingService: new LocalEmbeddingService({
  modelPath: '/models/all-MiniLM-L6-v2.onnx', // Bundled in public/
  fallbackToRemote: true, // Falls back to API if local fails
}),
```

### 1.4 Remove Sample Data Seeding from useMissions

```typescript
// apps/consumer/src/hooks/useMissions.ts
// DELETE LINES 39-157 (SAMPLE_MISSIONS constant)
// DELETE seedSampleMissions function
// DELETE useEffect that calls seedSampleMissions

// The hook should ONLY read from store, never seed data
export function useMissions(filter: FilterTab = 'all') {
  const { store, isReady } = useStore();
  const { wallet, isAuthenticated } = useAuth();

  const userId = wallet?.address ?? 'anonymous';

  const query = useQuery({
    queryKey: ['missions', filter, userId, isReady],
    queryFn: async (): Promise<Mission[]> => {
      if (!store || !isReady) return [];

      const namespace = NS.missionCards(userId);
      const result = await store.list<Mission>(namespace, 0, 100);

      // Parse dates and apply filter
      const missions = result.items.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
      }));

      missions.sort((a, b) => a.priority - b.priority);
      return filterMissions(missions, filter);
    },
    enabled: isReady && isAuthenticated,
    staleTime: 1000 * 60, // 1 minute - agents update frequently
  });

  return {
    missions: query.data ?? [],
    isLoading: query.isLoading || !isReady,
    error: query.error as Error | null,
    refetch: query.refetch,
    isStoreReady: isReady,
    /** True if user has no missions yet (needs to connect a data source) */
    isEmpty: isReady && !query.isLoading && (query.data?.length ?? 0) === 0,
  };
}
```

---

## Package 2: Update AgentScheduler

**File:** `packages/scheduler/src/agent-scheduler.ts`

### 2.1 Register All 6 Agents

```typescript
// Line 275-288 - REPLACE createAgent method

private createAgent(agentType: AgentType): BaseAgent | null {
  switch (agentType) {
    case 'shopping':
      return new ShoppingAgent();
    case 'restaurant':
      return new RestaurantAgent();
    case 'travel':
      return new TravelAgent();
    case 'events':
      return new EventsAgent();
    case 'content':
      return new ContentAgent();
    case 'diagnostic':
      return new DiagnosticAgent();
    default:
      console.warn(`[AgentScheduler] Unknown agent type: ${agentType}`);
      return null;
  }
}
```

### 2.2 Add Default Tasks for All Agents

```typescript
// Line 83-94 - REPLACE initializeDefaultTasks method

private initializeDefaultTasks(): void {
  // Shopping Agent: Run every 4 hours
  this.registerTask({
    id: 'shopping',
    agentType: 'shopping',
    schedule: { type: 'interval', intervalMs: 4 * 60 * 60 * 1000 },
    enabled: true,
    nextRun: Date.now() + 60 * 1000,
  });

  // Restaurant Agent: Run every 6 hours
  this.registerTask({
    id: 'restaurant',
    agentType: 'restaurant',
    schedule: { type: 'interval', intervalMs: 6 * 60 * 60 * 1000 },
    enabled: true,
    nextRun: Date.now() + 2 * 60 * 1000,
  });

  // Events Agent: Run every 12 hours
  this.registerTask({
    id: 'events',
    agentType: 'events',
    schedule: { type: 'interval', intervalMs: 12 * 60 * 60 * 1000 },
    enabled: true,
    nextRun: Date.now() + 3 * 60 * 1000,
  });

  // Travel Agent: Run daily at 10am
  this.registerTask({
    id: 'travel',
    agentType: 'travel',
    schedule: { type: 'daily', hour: 10, minute: 0 },
    enabled: true,
    nextRun: this.calculateNextRun({ type: 'daily', hour: 10, minute: 0 }),
  });

  // Content Agent: Run every 8 hours
  this.registerTask({
    id: 'content',
    agentType: 'content',
    schedule: { type: 'interval', intervalMs: 8 * 60 * 60 * 1000 },
    enabled: true,
    nextRun: Date.now() + 4 * 60 * 1000,
  });

  // Diagnostic Agent: Run weekly on Sunday at 9am
  this.registerTask({
    id: 'diagnostic',
    agentType: 'diagnostic',
    schedule: { type: 'daily', hour: 9, minute: 0 }, // Will add weekly support
    enabled: true,
    nextRun: this.calculateNextRun({ type: 'daily', hour: 9, minute: 0 }),
  });
}
```

---

## Package 3: Update OAuthFlow Integration

**File:** `packages/ui-components/src/connection/OAuthFlow.tsx`

### 3.1 Wire OAuth Token to DataSourceContext

The current OAuthFlow.tsx correctly implements OAuth popup flow and retrieves tokens. It needs to call `connectSource()` from DataSourceContext after receiving the token:

```typescript
// In the consumer app's Settings or Data page
// When OAuthFlow's onSuccess callback fires:

function handleOAuthSuccess(provider: 'google' | 'microsoft' | 'apple', token: string) {
  const { connectSource } = useDataSource();

  // Determine which data source was connected
  const sourceMap: Record<string, DataSource['id']> = {
    'google-email': 'gmail',
    'microsoft-email': 'outlook',
    'google-calendar': 'google-calendar',
    'microsoft-calendar': 'microsoft-calendar',
  };

  // Connect and immediately sync
  await connectSource(sourceMap[`${provider}-${selectedType}`], token);
}
```

---

## Package 4: Ikigai Integration

**Purpose:** Wire Ikigai inference to mission prioritization

### 4.1 IkigaiContext

```typescript
// apps/consumer/src/contexts/IkigaiContext.tsx
/**
 * IkigaiContext - Manages Ikigai profile and mission prioritization
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  createIkigaiEngine,
  sortMissionsByWellBeing,
  getIkigaiContextForAgent
} from '@ownyou/ikigai';
import { NS } from '@ownyou/shared-types';
import type { IkigaiProfile } from '@ownyou/shared-types';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';

interface IkigaiContextValue {
  profile: IkigaiProfile | null;
  isLoading: boolean;
  runInference: () => Promise<void>;
  getContextForAgent: (agentType: string) => Promise<Record<string, unknown>>;
}

const IkigaiContext = createContext<IkigaiContextValue | null>(null);

export function IkigaiProvider({ children }: { children: React.ReactNode }) {
  const { store, isReady } = useStore();
  const { wallet, isAuthenticated } = useAuth();
  const userId = wallet?.address ?? 'anonymous';

  const [profile, setProfile] = useState<IkigaiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load profile on mount
  useEffect(() => {
    if (!isReady || !isAuthenticated || !store) return;
    loadProfile();
  }, [isReady, isAuthenticated, store]);

  const loadProfile = async () => {
    if (!store) return;
    const saved = await store.get<IkigaiProfile>(NS.ikigaiProfile(userId), 'current');
    if (saved) setProfile(saved);
  };

  const runInference = useCallback(async () => {
    if (!store || !isReady) throw new Error('Store not ready');

    setIsLoading(true);
    try {
      const engine = createIkigaiEngine({ store, userId });
      const newProfile = await engine.runInference();
      setProfile(newProfile);

      // Store the updated profile
      await store.put(NS.ikigaiProfile(userId), 'current', newProfile);
    } finally {
      setIsLoading(false);
    }
  }, [store, isReady, userId]);

  const getContextForAgent = useCallback(async (agentType: string) => {
    if (!store) return {};
    return getIkigaiContextForAgent(store, userId, agentType);
  }, [store, userId]);

  const value: IkigaiContextValue = {
    profile,
    isLoading,
    runInference,
    getContextForAgent,
  };

  return (
    <IkigaiContext.Provider value={value}>
      {children}
    </IkigaiContext.Provider>
  );
}

export function useIkigai() {
  const context = useContext(IkigaiContext);
  if (!context) {
    throw new Error('useIkigai must be used within an IkigaiProvider');
  }
  return context;
}
```

---

## Package 5: Memory + Reflection Integration (Sprint 4)

**Purpose:** Wire @ownyou/memory and @ownyou/reflection to enable agent learning

### 5.1 MemoryContext (CORRECTED - Uses Actual Package APIs)

```typescript
// apps/consumer/src/contexts/MemoryContext.tsx
/**
 * MemoryContext - Provides memory tools to agents and triggers reflection
 *
 * Sprint 4 Integration: Wires @ownyou/memory and @ownyou/reflection to consumer app
 *
 * CORRECTED API USAGE:
 * - Uses ReflectionTriggerManager (NOT ReflectionNode which doesn't exist)
 * - ReflectionTriggerManager.onEpisodeSaved() tracks episode count
 * - ReflectionTriggerManager.onNegativeFeedback() triggers immediate reflection
 * - LLMClient constructor takes { provider, budgetConfig } (NOT createLLMClient)
 */

import { createContext, useContext, useCallback, useRef, useEffect, type ReactNode } from 'react';
import {
  saveObservation,
  searchMemories,
  updateEpisodeWithFeedback,
  type ScoredMemory,
} from '@ownyou/memory';
import { ReflectionTriggerManager, type ReflectionResult } from '@ownyou/reflection';
import { LLMClient, MockLLMProvider } from '@ownyou/llm-client';
import { NS } from '@ownyou/shared-types';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';

interface MemoryContextValue {
  /** Search for relevant memories */
  search: (query: string, context?: string) => Promise<ScoredMemory[]>;
  /** Save a new observation */
  save: (content: string, context: string, confidence: number) => Promise<string>;
  /** Update episode with user feedback (triggers reflection check) */
  recordFeedback: (episodeId: string, feedback: 'love' | 'like' | 'meh') => Promise<void>;
  /** Record that an episode was saved (may trigger reflection) */
  onEpisodeSaved: () => Promise<ReflectionResult | null>;
  /** Get memory count for debugging */
  getMemoryCount: () => Promise<number>;
  /** Check scheduled reflection triggers */
  checkScheduledTriggers: () => Promise<ReflectionResult | null>;
}

const MemoryContext = createContext<MemoryContextValue | null>(null);

interface MemoryProviderProps {
  children: ReactNode;
  /** Optional LLM client for reflection - uses mock if not provided */
  llmClient?: LLMClient;
}

export function MemoryProvider({ children, llmClient }: MemoryProviderProps) {
  const { store, isReady } = useStore();
  const { wallet } = useAuth();
  const userId = wallet?.address ?? 'anonymous';

  // ReflectionTriggerManager manages when reflection runs
  // It tracks episode count and schedules
  const triggerManagerRef = useRef<ReflectionTriggerManager | null>(null);

  // Initialize ReflectionTriggerManager
  useEffect(() => {
    if (!isReady || !store) return;

    // Create LLM client if not provided
    const llm = llmClient ?? new LLMClient({
      provider: new MockLLMProvider(), // Uses mock in dev, real in production
      budgetConfig: { monthlyBudgetUsd: 10 },
    });

    // Create the trigger manager
    // Constructor: (userId, store, llm, config?)
    triggerManagerRef.current = new ReflectionTriggerManager(
      userId,
      store,
      llm,
      {
        afterEpisodes: 5,           // Run after 5 episodes
        dailyIdleHour: 3,           // Run at 3 AM
        weeklyMaintenanceDay: 0,    // Run on Sunday (0 = Sunday)
      }
    );

    // Load saved state (episode count, last reflection time, etc.)
    triggerManagerRef.current.loadState().catch(err => {
      console.error('[MemoryContext] Failed to load reflection state:', err);
    });

    return () => {
      triggerManagerRef.current = null;
    };
  }, [isReady, store, userId, llmClient]);

  const search = useCallback(async (query: string, context?: string): Promise<ScoredMemory[]> => {
    if (!store || !isReady) return [];

    return searchMemories({
      query,
      context,
      limit: 10,
    }, { userId, store });
  }, [store, isReady, userId]);

  const save = useCallback(async (content: string, context: string, confidence: number): Promise<string> => {
    if (!store || !isReady) throw new Error('Store not ready');

    const result = await saveObservation({
      content,
      context,
      confidence,
    }, { userId, store });

    return result.memoryId;
  }, [store, isReady, userId]);

  /**
   * Called when an episode is saved
   *
   * Uses ReflectionTriggerManager.onEpisodeSaved() which:
   * 1. Increments the episode counter
   * 2. Returns a ReflectionResult if threshold reached (5 episodes)
   * 3. Returns null if threshold not reached yet
   */
  const onEpisodeSaved = useCallback(async (): Promise<ReflectionResult | null> => {
    if (!triggerManagerRef.current) return null;

    const result = await triggerManagerRef.current.onEpisodeSaved();
    if (result) {
      console.log('[MemoryContext] Reflection ran after episode threshold:', result);
    }
    return result;
  }, []);

  /**
   * Record user feedback on a mission/episode
   *
   * Uses ReflectionTriggerManager.onNegativeFeedback() for 'meh' feedback
   * which triggers immediate reflection to learn from negative outcomes.
   */
  const recordFeedback = useCallback(async (episodeId: string, feedback: 'love' | 'like' | 'meh'): Promise<void> => {
    if (!store || !isReady) throw new Error('Store not ready');

    // Update the episode with feedback
    await updateEpisodeWithFeedback(episodeId, feedback, userId, store);

    // Check if we should trigger immediate reflection for negative feedback
    if (triggerManagerRef.current && feedback === 'meh') {
      console.log('[MemoryContext] Triggering reflection due to negative feedback');
      const result = await triggerManagerRef.current.onNegativeFeedback(episodeId);
      console.log('[MemoryContext] Reflection completed:', result);
    }
  }, [store, isReady, userId]);

  /**
   * Check scheduled reflection triggers (daily/weekly)
   *
   * Call this periodically (e.g., every hour) to run scheduled reflection.
   */
  const checkScheduledTriggers = useCallback(async (): Promise<ReflectionResult | null> => {
    if (!triggerManagerRef.current) return null;
    return triggerManagerRef.current.checkScheduledTriggers();
  }, []);

  const getMemoryCount = useCallback(async (): Promise<number> => {
    if (!store || !isReady) return 0;

    const result = await store.list(NS.semanticMemory(userId), 0, 1);
    return result.total ?? 0;
  }, [store, isReady, userId]);

  const value: MemoryContextValue = {
    search,
    save,
    recordFeedback,
    onEpisodeSaved,
    getMemoryCount,
    checkScheduledTriggers,
  };

  return (
    <MemoryContext.Provider value={value}>
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemory() {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemory must be used within a MemoryProvider');
  }
  return context;
}
```

### 5.2 Update useFeedback to Trigger Reflection

```typescript
// apps/consumer/src/hooks/useFeedback.ts
// ADD: Import and use MemoryContext for feedback recording

import { useMemory } from '../contexts/MemoryContext';

export function useFeedback() {
  const { store, isReady } = useStore();
  const { wallet } = useAuth();
  const { recordFeedback: recordToMemory } = useMemory();
  const userId = wallet?.address ?? 'anonymous';

  const updateFeedback = useCallback(async (missionId: string, state: HeartState) => {
    if (!store || !isReady) return;

    // Store feedback in NS.missionFeedback
    await store.put(NS.missionFeedback(userId), missionId, {
      state,
      updatedAt: Date.now(),
    });

    // NEW: Record feedback to episode system for learning
    const mission = await store.get(NS.missionCards(userId), missionId);
    if (mission?.episodeId) {
      await recordToMemory(mission.episodeId, state);
    }
  }, [store, isReady, userId, recordToMemory]);

  // ... rest of hook
}
```

---

## Package 6: Resilience Integration (Sprint 5)

**Purpose:** Wire @ownyou/resilience to protect all external API calls

### 6.1 ResilienceContext (CORRECTED - Uses Actual Package APIs)

```typescript
// apps/consumer/src/contexts/ResilienceContext.tsx
/**
 * ResilienceContext - Provides circuit breakers and LLM fallback
 *
 * Sprint 5 Integration: Wires @ownyou/resilience to consumer app
 *
 * VERIFIED IMPORTS from @ownyou/resilience:
 * - circuitBreakers (CircuitBreakerRegistry singleton)
 * - llmInferenceWithFallback (function, NOT a class)
 * - CircuitBreakerRegistry
 * - API_CONFIGS
 */

import { createContext, useContext, useCallback } from 'react';
import {
  circuitBreakers,
  llmInferenceWithFallback,
  type FallbackChainConfig,
  type FallbackResult,
} from '@ownyou/resilience';
import type { CircuitBreakerStats } from '@ownyou/llm-client';
import type { LLMRequest, LLMProvider } from '@ownyou/llm-client';

interface ResilienceContextValue {
  /** Execute API call with circuit breaker protection */
  executeWithBreaker: <T>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ) => Promise<T>;

  /** Execute with retry and circuit breaker */
  executeWithRetry: <T>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ) => Promise<T>;

  /** Get circuit breaker stats for all APIs */
  getStats: () => Record<string, CircuitBreakerStats>;

  /** Check if an API circuit is open (failing) */
  isCircuitOpen: (apiName: string) => boolean;

  /** LLM inference with 7-level fallback chain (function call) */
  llmWithFallback: (
    request: LLMRequest,
    config: FallbackChainConfig
  ) => Promise<FallbackResult>;
}

const ResilienceContext = createContext<ResilienceContextValue | null>(null);

interface ResilienceProviderProps {
  children: React.ReactNode;
  /** Primary LLM provider for fallback chain */
  llmProvider?: LLMProvider;
  /** Alternative LLM provider (e.g., Anthropic when OpenAI fails) */
  alternativeProvider?: LLMProvider;
}

export function ResilienceProvider({
  children,
  llmProvider,
  alternativeProvider,
}: ResilienceProviderProps) {
  // Use the global circuitBreakers singleton from @ownyou/resilience
  const executeWithBreaker = useCallback(async <T,>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> => {
    return circuitBreakers.execute(apiName, operation, fallback);
  }, []);

  const executeWithRetry = useCallback(async <T,>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> => {
    return circuitBreakers.executeWithRetry(apiName, operation, fallback);
  }, []);

  const getStats = useCallback(() => {
    return circuitBreakers.getAllStats();
  }, []);

  const isCircuitOpen = useCallback((apiName: string): boolean => {
    return circuitBreakers.isOpen(apiName);
  }, []);

  // Wrap llmInferenceWithFallback with configured providers
  const llmWithFallback = useCallback(async (
    request: LLMRequest,
    config: Partial<FallbackChainConfig>
  ): Promise<FallbackResult> => {
    if (!llmProvider) {
      throw new Error('LLM provider not configured');
    }

    const fullConfig: FallbackChainConfig = {
      provider: llmProvider,
      alternativeProvider,
      maxRetries: config.maxRetries ?? 3,
      timeoutMs: config.timeoutMs ?? 30000,
      ...config,
    };

    return llmInferenceWithFallback(request, fullConfig);
  }, [llmProvider, alternativeProvider]);

  const value: ResilienceContextValue = {
    executeWithBreaker,
    executeWithRetry,
    getStats,
    isCircuitOpen,
    llmWithFallback,
  };

  return (
    <ResilienceContext.Provider value={value}>
      {children}
    </ResilienceContext.Provider>
  );
}

export function useResilience() {
  const context = useContext(ResilienceContext);
  if (!context) {
    throw new Error('useResilience must be used within a ResilienceProvider');
  }
  return context;
}
```

### 6.2 Wire CircuitBreakers in DataSourceContext

```typescript
// apps/consumer/src/contexts/DataSourceContext.tsx
// UPDATE: Use circuit breakers for all data fetching

import { useResilience } from './ResilienceContext';

export function DataSourceProvider({ children }: { children: React.ReactNode }) {
  const { executeWithBreaker } = useResilience();
  // ... existing code

  const syncSource = useCallback(async (sourceId: DataSource['id']) => {
    // ... existing code

    if (source.type === 'email') {
      // WRAP with circuit breaker
      await executeWithBreaker('email_api', async () => {
        const provider = createEmailProvider(source.provider, tokenData.accessToken);
        const pipeline = new EmailPipeline({ provider, classifier, store, userId });
        return pipeline.run();
      }, () => {
        // Fallback: Return cached/partial data
        console.warn('Email API circuit open, using cached data');
        return { processedCount: 0, cached: true };
      });
    }

    // Similar for calendar and financial
  }, [/* deps */]);
}
```

---

## Package 7: App Provider Composition (Full Integration)

**File:** `apps/consumer/src/App.tsx`

### 7.1 Complete Provider Hierarchy

The provider order matters - each context depends on providers above it:

```
QueryClientProvider (React Query for data fetching)
└── BrowserRouter (Routing)
    └── AuthProvider (Wallet authentication)
        └── StoreProvider (LangGraph Store + IndexedDB)
            └── ResilienceProvider (Circuit breakers + LLM fallback) ← Sprint 5
                └── MemoryProvider (Memory tools + Reflection) ← Sprint 4
                    └── DataSourceProvider (OAuth + data fetching)
                        └── TriggerProvider (4-mode trigger engine)
                            └── IkigaiProvider (Ikigai inference) ← Sprint 6
                                └── AppRoutes
```

### 7.2 Wire All Providers

```tsx
// apps/consumer/src/App.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { StoreProvider } from './contexts/StoreContext';
import { ResilienceProvider } from './contexts/ResilienceContext'; // Sprint 5
import { MemoryProvider } from './contexts/MemoryContext';         // Sprint 4
import { DataSourceProvider } from './contexts/DataSourceContext';
import { TriggerProvider } from './contexts/TriggerContext';
import { IkigaiProvider } from './contexts/IkigaiContext';         // Sprint 6
import { createLLMClient } from '@ownyou/llm-client';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
    },
  },
});

// Create LLM client for resilience fallback chain
const llmClient = createLLMClient({
  modelTier: 'standard',
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <StoreProvider>
            {/* Sprint 5: Resilience must wrap all API-calling contexts */}
            <ResilienceProvider llmClient={llmClient}>
              {/* Sprint 4: Memory must be above triggers (agents use memory) */}
              <MemoryProvider>
                <DataSourceProvider>
                  <TriggerProvider>
                    {/* Sprint 6: Ikigai uses data from triggers/agents */}
                    <IkigaiProvider>
                      <AppRoutes />
                    </IkigaiProvider>
                  </TriggerProvider>
                </DataSourceProvider>
              </MemoryProvider>
            </ResilienceProvider>
          </StoreProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

---

## Package 6: Empty State UI

When the user has no missions (because no data sources are connected), show an onboarding flow instead of empty feed:

```tsx
// apps/consumer/src/routes/Home.tsx

import { useMissions } from '../hooks/useMissions';
import { useDataSource } from '../contexts/DataSourceContext';
import { Header, MissionFeed, EmptyFeed } from '@ownyou/ui-components';

export function Home() {
  const { missions, isLoading, isEmpty } = useMissions();
  const { dataSources } = useDataSource();

  const hasConnectedSource = dataSources.some(ds => ds.status === 'connected');

  if (isEmpty && !hasConnectedSource) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <EmptyFeed
          title="Connect Your First Data Source"
          description="OwnYou needs to learn about you to create personalized missions. Connect your email, calendar, or financial accounts to get started."
          ctaLabel="Connect Data Source"
          ctaHref="/settings/data"
        />
      </div>
    );
  }

  if (isEmpty && hasConnectedSource) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <EmptyFeed
          title="Learning About You..."
          description="We're analyzing your data to create personalized missions. This may take a few minutes."
          showSpinner
        />
      </div>
    );
  }

  // Normal mission feed
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <MissionFeed missions={missions} isLoading={isLoading} />
    </div>
  );
}
```

---

## Week-by-Week Breakdown (4 Weeks)

### Week 1: Core Context Layer (Days 1-5)

**Day 1: ResilienceContext (Sprint 5)**
- [ ] Create `ResilienceContext.tsx` with CircuitBreakerRegistry
- [ ] Create LLMFallbackChain initialization
- [ ] Wire `executeWithBreaker()` for all external APIs
- [ ] Tests for circuit breaker states (closed/open/half-open)
- [ ] Tests for fallback chain behavior

**Day 2: MemoryContext (Sprint 4)**
- [ ] Create `MemoryContext.tsx` with memory tools
- [ ] Initialize ReflectionNode with decay thresholds
- [ ] Wire `searchMemories()` for agent context
- [ ] Wire `recordFeedback()` to trigger reflection
- [ ] Tests for memory save/search/feedback flow

**Day 3-4: DataSourceContext + TriggerContext**
- [ ] Create `DataSourceContext.tsx` with OAuth token management
- [ ] Wire to `@ownyou/email`, `@ownyou/data-calendar`, `@ownyou/data-financial`
- [ ] Create `TriggerContext.tsx` with TriggerEngine initialization
- [ ] Update AgentScheduler to register all 6 agents
- [ ] Tests for data source connection and trigger routing

**Day 5: IkigaiContext (Sprint 6) + useMissions cleanup**
- [ ] Create `IkigaiContext.tsx` for profile management
- [ ] Wire IkigaiInferenceEngine for 4-dimension analysis
- [ ] Remove `SAMPLE_MISSIONS` from `useMissions.ts`
- [ ] Remove `seedSampleMissions` logic
- [ ] Add `isEmpty` flag to useMissions
- [ ] Tests for Ikigai inference and empty state

### Week 2: End-to-End Data Flows (Days 6-10)

**Day 6-7: Email → Agent → Mission Flow**
- [ ] Wire OAuthFlow success → DataSourceContext.connectSource
- [ ] Wire EmailPipeline → IABClassifier → Store
- [ ] Wire StoreWatcher → TriggerEngine → Agents
- [ ] **Verify all 6 agents receive classifications** (not just Shopping)
- [ ] Integration tests: email → mission card

**Day 8-9: Calendar/Financial Flow + Memory Integration**
- [ ] Wire CalendarPipeline → Store → EventsAgent, TravelAgent
- [ ] Wire FinancialPipeline → Store → ShoppingAgent
- [ ] **Wire agents to use memory tools during execution:**
  - [ ] `searchMemories()` for context retrieval
  - [ ] `saveObservation()` for new learnings
  - [ ] `saveEpisode()` for interaction records
- [ ] Integration tests: calendar → events/travel missions

**Day 10: Ikigai + Well-Being Integration**
- [ ] Wire IkigaiEngine to run after IAB classification
- [ ] Wire `sortMissionsByWellBeing()` for mission prioritization
- [ ] Wire Ikigai rewards (2x experience, 1.5x relationship, 2.5x giving)
- [ ] Update Profile page to show real Ikigai wheel data
- [ ] Integration tests: IAB → Ikigai → prioritized missions

### Week 3: Feedback Loop + Learning (Days 11-15)

**Day 11-12: Feedback → Reflection Loop (Sprint 4)**
- [ ] Wire useFeedback → updateEpisodeWithFeedback
- [ ] Wire shouldTriggerReflection (5 episodes OR negative feedback)
- [ ] Wire ReflectionNode.run() to synthesize procedural rules
- [ ] Wire procedural rules → agent context injection
- [ ] Tests: verify agents get smarter after feedback

**Day 13: Resilience Wiring (Sprint 5)**
- [ ] Wire CircuitBreakers around all external API calls:
  - [ ] Gmail/Outlook API calls
  - [ ] Calendar API calls
  - [ ] Plaid API calls
  - [ ] External product/restaurant/event APIs
- [ ] Wire LLM fallback chain to all agent LLM calls
- [ ] Tests for graceful degradation on API failures

**Day 14-15: Edge Cases + Error States**
- [ ] Handle offline mode (agents queue, sync later)
- [ ] Handle OAuth token expiry (refresh flow)
- [ ] Handle agent failures (fallback to cached data)
- [ ] Handle empty profile (cold start UX with onboarding)
- [ ] Handle LLM budget exceeded (use cheaper tiers)

### Week 4: Polish + Verification (Days 16-20)

**Day 16-17: Real Embedding Service**
- [ ] Bundle `all-MiniLM-L6-v2.onnx` in public/
- [ ] Implement `LocalEmbeddingService` with ONNX runtime
- [ ] Test vector search with real embeddings
- [ ] Fallback to remote API if local fails
- [ ] Tests for embedding accuracy

**Day 18-19: Full Integration Testing**
- [ ] Full E2E: OAuth → Email → IAB → Memory → Triggers → 6 Agents → Missions
- [ ] Full E2E: Feedback → Episode → Reflection → Procedural Rules → Smarter Agents
- [ ] Full E2E: Ikigai Inference → Well-Being Sorting → Rewards
- [ ] Performance profiling (target: <100ms mission render)
- [ ] All 200+ tests passing

**Day 20: Documentation + Handoff**
- [ ] Update CLAUDE.md with new contexts
- [ ] Update architecture docs with data flow diagrams
- [ ] Document API contracts for all contexts
- [ ] Sprint 11a retrospective

---

## Test Targets

| Area | Target Tests | Focus |
|------|-------------|-------|
| ResilienceContext (Sprint 5) | 25+ | Circuit breaker states, fallback chains, graceful degradation |
| MemoryContext (Sprint 4) | 30+ | Memory save/search, episode updates, reflection triggers |
| DataSourceContext | 30+ | OAuth flow, token storage, sync triggering |
| TriggerContext | 25+ | Agent registration, 4-mode routing, scheduling |
| IkigaiContext (Sprint 6) | 20+ | Profile loading, 4-dimension inference, well-being sorting |
| Integration: Data→Agent | 25+ | Email→Mission, Calendar→Mission, Financial→Mission |
| Integration: Feedback→Learning | 20+ | Feedback→Episode→Reflection→ProceduralRules→SmarterAgents |
| Integration: Ikigai→Rewards | 15+ | Dimension scoring, multipliers, category tracking |
| Edge cases | 30+ | Offline, token expiry, agent failures, LLM budget |
| **Total** | **220+** | |

---

## Success Criteria

### Priority 1: Connect Real Data Sources
- [ ] User can connect Gmail/Outlook via OAuth
- [ ] User can connect Google/Microsoft Calendar
- [ ] User can connect bank accounts via Plaid
- [ ] Emails/events/transactions are fetched and classified by IAB
- [ ] Data persists in IndexedDB
- [ ] **Circuit breakers protect all API calls** (Sprint 5)

### Priority 2: Get Real Missions from ALL 6 Agents
- [ ] ShoppingAgent generates mission cards from email + financial data
- [ ] RestaurantAgent generates cards from email + calendar data
- [ ] TravelAgent generates cards from email + calendar data
- [ ] EventsAgent generates cards from calendar + interests data
- [ ] ContentAgent generates cards from IAB classifications
- [ ] DiagnosticAgent runs weekly and generates profile insights
- [ ] Mission cards appear in Home feed with real evidence chains
- [ ] **Agents use memory context for personalization** (Sprint 4)

### Priority 3: See Real Profile with Ikigai
- [ ] Ikigai wheel shows real dimension scores (Experiences, Relationships, Interests, Giving)
- [ ] Scores derived from IkigaiInferenceEngine 4-parallel prompts
- [ ] Profile page shows real IAB categories
- [ ] **sortMissionsByWellBeing() prioritizes feed** (Sprint 6)

### Priority 4: Learning from Feedback
- [ ] Feedback interactions update episodes
- [ ] **Reflection triggers after 5 episodes OR negative feedback** (Sprint 4)
- [ ] Procedural rules synthesized from episode patterns
- [ ] **Next agent runs are smarter** (inject learned preferences)
- [ ] Token balance updates with Ikigai multipliers (Sprint 6)

### Priority 5: Resilience + Graceful Degradation
- [ ] **CircuitBreakers protect Gmail, Outlook, Calendar, Plaid APIs** (Sprint 5)
- [ ] **LLM fallback chain (7 levels) for all LLM calls** (Sprint 5)
- [ ] Graceful fallback to cached data when APIs fail
- [ ] Offline mode queues actions for later sync

### Zero Mock Data
- [ ] `SAMPLE_MISSIONS` constant deleted
- [ ] `seedSampleMissions` function deleted
- [ ] `MockEmbeddingService` replaced with LocalEmbeddingService
- [ ] All `// TODO: Real` comments resolved
- [ ] No hardcoded sample data in any context or hook

---

## Files to Create

| File | Purpose | Sprint |
|------|---------|--------|
| `apps/consumer/src/contexts/ResilienceContext.tsx` | Circuit breakers + LLM fallback | Sprint 5 |
| `apps/consumer/src/contexts/MemoryContext.tsx` | Memory tools + Reflection triggers | Sprint 4 |
| `apps/consumer/src/contexts/DataSourceContext.tsx` | Data source orchestration | 11a |
| `apps/consumer/src/contexts/TriggerContext.tsx` | Trigger engine initialization | 11a |
| `apps/consumer/src/contexts/IkigaiContext.tsx` | Ikigai profile + well-being | Sprint 6 |
| `apps/consumer/src/hooks/useResilience.ts` | Re-export hook | Sprint 5 |
| `apps/consumer/src/hooks/useMemory.ts` | Re-export hook | Sprint 4 |
| `apps/consumer/src/hooks/useDataSource.ts` | Re-export hook | 11a |
| `apps/consumer/src/hooks/useTrigger.ts` | Re-export hook | 11a |
| `apps/consumer/src/hooks/useIkigai.ts` | Re-export hook | Sprint 6 |
| `packages/ui-components/src/feed/EmptyFeed.tsx` | Empty state component | 11a |
| `apps/consumer/src/services/LocalEmbeddingService.ts` | ONNX embedding service | 11a |

## Files to Modify

| File | Change | Sprint |
|------|--------|--------|
| `apps/consumer/src/App.tsx` | Add ALL 6 provider contexts | All |
| `apps/consumer/src/routes/Home.tsx` | Handle empty state, use DataSourceContext | 11a |
| `apps/consumer/src/hooks/useMissions.ts` | Remove SAMPLE_MISSIONS, add isEmpty | 11a |
| `apps/consumer/src/hooks/useProfile.ts` | Remove sample profile | 11a |
| `apps/consumer/src/hooks/useFeedback.ts` | Wire to MemoryContext.recordFeedback | Sprint 4 |
| `apps/consumer/src/contexts/StoreContext.tsx` | Use LocalEmbeddingService | 11a |
| `packages/scheduler/src/agent-scheduler.ts` | Register all 6 agents | 11a |
| `packages/agents-*/src/agent.ts` | Use memory tools + resilience | Sprint 4/5 |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OAuth scopes insufficient | Medium | High | Test with real Google/Microsoft accounts early |
| Agent execution too slow | Medium | Medium | Run agents in Web Worker, show progress |
| Embedding model too large | High | Medium | Use quantized model, lazy load |
| LLM costs exceed budget | Medium | High | Enforce LLM budget limits, use local models |

---

## Definition of Done

Sprint 11a is complete when:

### Data Flow Verification
1. [ ] User connects Gmail → Emails appear in store (verified)
2. [ ] User connects Calendar → Events appear in store (verified)
3. [ ] User connects Plaid → Transactions appear in store (verified)
4. [ ] IAB classification runs on all data sources (verified)

### Trigger + Agent Verification
5. [ ] TriggerEngine fires when IAB classifications written (verified)
6. [ ] All 6 agents are registered in AgentScheduler (verified)
7. [ ] Each agent receives appropriate namespace triggers (verified)
8. [ ] Agent-generated missions appear in Home feed (verified)

### Memory + Learning Verification (Sprint 4)
9. [ ] Agents call searchMemories() for context (verified)
10. [ ] Agents call saveObservation() for learnings (verified)
11. [ ] useFeedback updates episodes via updateEpisodeWithFeedback (verified)
12. [ ] ReflectionNode runs after 5 episodes (verified)
13. [ ] Procedural rules are injected into next agent run (verified)

### Resilience Verification (Sprint 5)
14. [ ] CircuitBreakers wrap all external API calls (verified)
15. [ ] LLM fallback chain works (simulate primary failure) (verified)
16. [ ] Graceful degradation shows cached data on API failure (verified)

### Ikigai Verification (Sprint 6)
17. [ ] Ikigai profile shows real dimension scores (verified)
18. [ ] Missions sorted by sortMissionsByWellBeing() (verified)
19. [ ] Ikigai rewards calculated with multipliers (verified)

### Code Quality
20. [ ] Zero mock data - no SAMPLE_MISSIONS, no sample profiles
21. [ ] 220+ new integration tests passing
22. [ ] All existing 410 tests still passing
23. [ ] Performance: <100ms mission render time

---

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-09 | Claude Code Agent | Initial Sprint 11a specification with mock integration contexts |
| 2.0 | 2025-12-09 | Claude Code Agent | Corrected all API usage to verified exports: `circuitBreakers` singleton, `llmInferenceWithFallback` function, `ReflectionTriggerManager` class, `LLMClient` constructor pattern, `EmailPipeline.run(token, classifierFn)`, `CalendarEventFetcher`/`CalendarEventClassifier` pattern, `TransactionFetcher`/`TransactionClassifier` pattern |
| 2.1 | 2025-12-10 | Claude Code Agent | Corrected v13 section references (removed Section 6 which is Decentralization Ledger), added Document History section per sprint-specification skill validation checklist |

---

**Document Status:** Sprint 11a Specification v2.1 - PLANNED (Complete with Sprint 4/5/6 integrations)
**Date:** 2025-12-10
**Author:** Claude Code Agent
**Validates Against:** OwnYou_architecture_v13.md
**v13 Sections Covered:**
- Section 2: Ikigai Intelligence Layer → IkigaiContext
- Section 3: Mission Agent System → TriggerContext, AgentScheduler
- Section 5: Data Source Sync Architecture → DataSourceContext
- Section 8: Memory Architecture → MemoryContext
**Integrates:**
- Sprint 4 (Memory Intelligence + Reflection) via MemoryContext
- Sprint 5 (Resilience + Triggers) via ResilienceContext + TriggerContext
- Sprint 6 (Ikigai Intelligence) via IkigaiContext
- Sprint 7 (Restaurant/Travel/Events agents) via AgentScheduler
- Sprint 8 (Data Sources + Diagnostic) via DataSourceContext
**Previous Sprint:** Sprint 11 (Consumer UI) ✅ COMPLETE
**Next Sprint:** Sprint 12 (BBS+ & SDKs)
