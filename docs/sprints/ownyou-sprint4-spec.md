# Sprint 4: Memory Intelligence + Content Agent

**Duration:** 3 weeks
**Goal:** Make the system learn from feedback and prove the agent framework scales with a second agent
**Success Criteria:** Memory tools callable by agents, Reflection Node synthesizes procedural rules, Shopping Agent demonstrates learning, Content Agent generates recommendation cards
**Depends On:** Sprint 3 complete (Shopping Agent + Mission UI)

Remember, w**hen implementing:**

**  **1. **Follow existing codebase conventions** (camelCase for TypeScript)

**  **2. **Adapt spec code to match existing patterns** (e.g., use **validAt** not **valid_at**)

**  **3. **Reuse existing types** from **@ownyou/shared-types** rather than redefining them

---

## Previous Sprints Summary

### Sprint 0: Foundation (COMPLETED)

| Package                       | Description                                                                          | Tests |
| ----------------------------- | ------------------------------------------------------------------------------------ | ----- |
| `@ownyou/shared-types`      | v13 type definitions (Memory, Episode, Entity, Ikigai, Agent, Identity, Namespaces)  | 91    |
| `@ownyou/memory-store`      | LangGraph Store-compatible interface with IndexedDB + SQLite backends, hybrid search | 87    |
| `@ownyou/llm-client`        | Abstract interface with budget management (skeleton)                                 | 39    |
| `@ownyou/observability`     | Agent traces (10.2), cost metering, memory operation tracking                        | 17    |
| `@ownyou/integration-tests` | Sprint 0 success criteria validation                                                 | 7     |

**Total:** 241 tests

### Sprint 1a: Desktop Infrastructure (COMPLETED)

| Deliverable     | Status                                |
| --------------- | ------------------------------------- |
| Tauri scaffold  | `apps/desktop/` with React frontend |
| SQLite backend  | sql.js (WebAssembly) cross-platform   |
| Custom protocol | `ownyou://` deep links working      |

### Sprint 1b: OAuth + Email + IAB Migration (COMPLETED)

| Package                    | Description                                           | Tests |
| -------------------------- | ----------------------------------------------------- | ----- |
| `@ownyou/oauth`          | Unified OAuth (Microsoft + Google, browser + desktop) | 46    |
| `@ownyou/iab-classifier` | IAB classification workflow                           | 5     |
| `@ownyou/email`          | Email fetch + classification pipeline                 | 35    |

### Sprint 2: LLM Client Consolidation (COMPLETED)

| Deliverable     | Status                                             |
| --------------- | -------------------------------------------------- |
| Real providers  | OpenAI, Anthropic, Google, Groq, DeepInfra, Ollama |
| WebLLM provider | Local browser inference for 100% budget fallback   |
| Response cache  | LLMCache with TTL by operation, LRU eviction       |
| Fallback chain  | v13 6.11.3 implementation                          |
| IAB migration   | iab-classifier uses @ownyou/llm-client             |

### Sprint 3: Shopping Agent + Mission UI (COMPLETED)

| Package                     | Description                               | Tests |
| --------------------------- | ----------------------------------------- | ----- |
| `@ownyou/agents-base`     | BaseAgent, LimitsEnforcer, PrivacyGuard   | 62    |
| `@ownyou/agents-shopping` | Hybrid LLM + rule-based shopping agent    | 29    |
| `@ownyou/scheduler`       | Background task scheduling                | 25    |
| `@ownyou/ui-components`   | MissionCard, MissionFeed, FeedbackButtons | 14    |
| Integration tests           | Full agent loop validation                | 10    |
| Admin Dashboard             | Missions page with feedback               | 12    |

**Total:** 152 tests

**Current State:**

- Shopping Agent produces mission cards from IAB data
- Mission UI displays cards and captures feedback (love/like/meh)
- Episodes recorded for each agent run
- No learning from feedback yet
- No memory decay or pruning
- No Reflection Node
- Only one agent type implemented

---

## Sprint 4 Overview

```
+------------------------------------------------------------------+
|                     SPRINT 4 END STATE                           |
+------------------------------------------------------------------+
|                                                                   |
|  [User provides feedback on mission card]                         |
|       |                                                           |
|  [Episode updated with feedback]                                  |
|       |                                                           |
|  [Reflection Node triggered (5 episodes OR negative feedback)]    |
|       |                                                           |
|  +---+---+---+---+                                                |
|  |       |       |                                                |
|  v       v       v                                                |
|  [Decay] [Prune] [Synthesize Procedural Rules]                    |
|       |                                                           |
|  [Procedural rules stored per agent type]                         |
|       |                                                           |
|  [Next Shopping Agent run uses learned preferences]               |
|       |                                                           |
|  [Content Agent also generates cards using same framework]        |
|                                                                   |
|  AGENTS LEARN FROM USER FEEDBACK                                  |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture References

| Section           | Requirement                 | Sprint 4 Implementation                                            |
| ----------------- | --------------------------- | ------------------------------------------------------------------ |
| **8.1-8.2** | Memory Types (4 types)      | Semantic, Episodic, Procedural, Relational (MVP)                   |
| **8.3**     | Agent-Driven Memory         | Natural language memories via tools                                |
| **8.4.1-4** | Memory Schema               | Memory, Episode, ProceduralRule, Entity, Relationship              |
| **8.4.5**   | Entity Extraction Pipeline  | LLM extraction during Reflection                                   |
| **8.5**     | Vector Embeddings           | Local nomic-embed-text-v1.5 via @xenova/transformers               |
| **8.6**     | Bi-Temporal Modeling        | valid_at/invalid_at/created_at tracking                            |
| **8.7**     | Memory Retrieval (Hybrid)   | Semantic + BM25 + Entity + RRF                                     |
| **8.8.1**   | Memory Tools                | save_observation, save_episode, search_memories, invalidate_memory |
| **8.8.2**   | Automatic Context Injection | buildAgentContext, formatContextForPrompt                          |
| **8.9**     | Memory Lifecycle            | Consolidation, decay (5%/week), pruning (0.1), summaries           |
| **8.10**    | Reflection Node             | 6-phase orchestrator with triggers                                 |
| **8.10.1**  | Procedural Rule Synthesis   | Episode pattern analysis, confidence >= 0.7                        |
| **8.11**    | Privacy Tiers               | public/sensitive/private access controls                           |
| **8.15**    | Memory Size Limits          | Quotas (10K semantic, 5K episodic) and archival                    |
| **8.16**    | Concrete Example            | Learning loop test validates flow                                  |
| **3.6.1**   | Content Agent               | L1 content recommendation agent                                    |
| **3.6.5**   | Privacy-Tier Enforcement    | PrivacyGuard enhanced with tier checks                             |

---

## Deliverables

| #  | Deliverable              | Priority | Acceptance Criteria                                                |
| -- | ------------------------ | -------- | ------------------------------------------------------------------ |
| 1  | Memory Tools             | P0       | save_observation, save_episode, search_memories, invalidate_memory |
| 2  | Vector Embeddings        | P0       | Local embeddings with @xenova/transformers                         |
| 3  | Hybrid Retrieval         | P0       | Semantic + BM25 + RRF combination                                  |
| 4  | Memory Decay             | P0       | 5%/week strength decay calculation                                 |
| 5  | Memory Pruning           | P0       | Archive memories below threshold (0.1)                             |
| 6  | Reflection Node          | P0       | Procedural rule synthesis from episodes                            |
| 7  | Procedural Injection     | P0       | Rules injected into agent context                                  |
| 8  | Content Agent            | P0       | L1 agent generates content recommendations                         |
| 9  | Privacy-Tier Enforcement | P1       | Enhanced PrivacyGuard with tier checks                             |
| 10 | Integration Tests        | P1       | Learning loop demonstrated end-to-end                              |

---

## New Packages

```
packages/
+-- memory/                          # NEW: Memory intelligence
|   +-- src/
|   |   +-- index.ts
|   |   +-- tools/
|   |   |   +-- save-observation.ts  # Memory write tool
|   |   |   +-- save-episode.ts      # Episode recording tool
|   |   |   +-- search-memories.ts   # Hybrid retrieval
|   |   |   +-- invalidate-memory.ts # Temporal invalidation
|   |   +-- embedding/
|   |   |   +-- local-embedder.ts    # @xenova/transformers wrapper
|   |   |   +-- embedding-queue.ts   # Background embedding batch
|   |   +-- retrieval/
|   |   |   +-- vector-search.ts     # Semantic search
|   |   |   +-- fulltext-search.ts   # BM25 keyword search
|   |   |   +-- rrf.ts               # Reciprocal Rank Fusion
|   |   |   +-- hybrid-retrieval.ts  # Combined retrieval
|   |   +-- lifecycle/
|   |   |   +-- decay.ts             # Strength decay calculation
|   |   |   +-- consolidation.ts     # Merge similar memories
|   |   |   +-- pruning.ts           # Archive low-strength
|   |   +-- types.ts
|   +-- __tests__/
|   |   +-- tools.test.ts
|   |   +-- embedding.test.ts
|   |   +-- retrieval.test.ts
|   |   +-- lifecycle.test.ts
|   +-- PACKAGE.md
|   +-- package.json
|
+-- reflection/                      # NEW: Background reflection
|   +-- src/
|   |   +-- index.ts
|   |   +-- reflection-node.ts       # Main reflection orchestrator
|   |   +-- procedural-synthesis.ts  # Extract rules from episodes
|   |   +-- context-injection.ts     # Build agent context (v13 8.8.2)
|   |   +-- entity-extraction.ts     # Extract entities (v13 8.4.5)
|   |   +-- temporal-validation.ts   # Mark outdated facts invalid
|   |   +-- triggers.ts              # Reflection trigger logic
|   |   +-- types.ts
|   +-- __tests__/
|   |   +-- reflection-node.test.ts
|   |   +-- procedural-synthesis.test.ts
|   |   +-- context-injection.test.ts
|   |   +-- entity-extraction.test.ts
|   +-- PACKAGE.md
|   +-- package.json
|
+-- agents/
|   +-- content/                     # NEW: Content Agent
|       +-- src/
|       |   +-- index.ts
|       |   +-- agent.ts             # ContentAgent class
|       |   +-- triggers.ts          # Content interest detection
|       |   +-- tools/
|       |   |   +-- recommend-content.ts   # Mock content search
|       |   |   +-- summarize-article.ts   # Article summarization
|       |   |   +-- find-similar.ts        # Similar content
|       |   |   +-- save-for-later.ts      # Reading list
|       |   +-- types.ts
|       +-- __tests__/
|       |   +-- agent.test.ts
|       +-- PACKAGE.md
|       +-- package.json
```

---

## Technical Specifications

### 1. Memory Tools

#### 1.1 Save Observation Tool

```typescript
// packages/memory/src/tools/save-observation.ts

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import { computeLocalEmbedding } from '../embedding/local-embedder';
import { findSimilarMemories } from '../retrieval/hybrid-retrieval';
import { consolidateMemory } from '../lifecycle/consolidation';

export interface SaveObservationParams {
  content: string;           // Natural language observation
  context: string;           // Domain: travel, shopping, dining, etc.
  confidence: number;        // 0.0-1.0
  validAt?: number;          // When fact became true (default: now)
  privacyTier?: 'public' | 'sensitive' | 'private';
}

export interface SaveObservationContext {
  userId: string;
  episodeId?: string;        // Link to triggering episode
  store: MemoryStore;
}

/**
 * Save Observation Tool - v13 Section 8.8.1
 *
 * Saves a fact or preference learned about the user.
 * Automatically checks for similar existing memories and consolidates if found.
 */
export async function saveObservation(
  params: SaveObservationParams,
  context: SaveObservationContext
): Promise<{ memoryId: string; action: 'created' | 'consolidated' }> {
  const { content, context: domain, confidence, validAt, privacyTier } = params;
  const { userId, episodeId, store } = context;

  // 1. Compute embedding for similarity check
  const embedding = await computeLocalEmbedding(content);

  // 2. Check for similar existing memories (threshold: 0.85)
  const similar = await findSimilarMemories({
    query: content,
    queryEmbedding: embedding,
    userId,
    store,
    threshold: 0.85,
    limit: 3,
  });

  // 3. Consolidate if similar memory exists
  if (similar.length > 0) {
    const consolidated = await consolidateMemory({
      existing: similar[0].memory,
      newContent: content,
      newConfidence: confidence,
      userId,
      store,
    });
    return { memoryId: consolidated.id, action: 'consolidated' };
  }

  // 4. Create new memory
  const memory: Memory = {
    id: crypto.randomUUID(),
    content,
    context: domain,

    // Bi-temporal
    valid_at: validAt ?? Date.now(),
    created_at: Date.now(),

    // Strength & decay
    strength: 1.0,
    last_accessed: Date.now(),
    access_count: 1,

    // Provenance
    sources: episodeId ? [episodeId] : [],
    confidence,

    // Privacy
    privacy_tier: privacyTier ?? 'public',

    // Embedding
    embedding,
    embedding_model: 'nomic-embed-text-v1.5',
    embedded_at: Date.now(),
  };

  await store.put(NS.semanticMemory(userId), memory.id, memory);

  return { memoryId: memory.id, action: 'created' };
}
```

#### 1.2 Save Episode Tool

```typescript
// packages/memory/src/tools/save-episode.ts

import type { Episode } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import { extractTags } from './tag-extraction';

export interface SaveEpisodeParams {
  situation: string;        // What the user was trying to do
  reasoning: string;        // How the agent approached it
  action: string;           // What solution was provided
  outcome: 'success' | 'failure' | 'partial' | 'pending';
  userFeedback?: string;    // Explicit feedback or inferred satisfaction
}

export interface SaveEpisodeContext {
  userId: string;
  agentType: string;
  missionId: string;
  store: MemoryStore;
}

/**
 * Save Episode Tool - v13 Section 8.8.1
 *
 * Records a complete interaction for few-shot learning.
 * Episodes are the raw material for procedural rule synthesis.
 */
export async function saveEpisode(
  params: SaveEpisodeParams,
  context: SaveEpisodeContext
): Promise<{ episodeId: string }> {
  const { situation, reasoning, action, outcome, userFeedback } = params;
  const { userId, agentType, missionId, store } = context;

  // Extract searchable tags
  const tags = await extractTags({
    situation,
    action,
    outcome,
    agentType,
  });

  const episode: Episode = {
    id: crypto.randomUUID(),
    situation,
    reasoning,
    action,
    outcome,
    user_feedback: userFeedback,
    agent_type: agentType,
    mission_id: missionId,
    timestamp: Date.now(),
    tags,
  };

  await store.put(NS.episodicMemory(userId), episode.id, episode);

  return { episodeId: episode.id };
}

/**
 * Update Episode with Feedback - called when user rates mission
 */
export async function updateEpisodeWithFeedback(
  episodeId: string,
  feedback: 'love' | 'like' | 'meh',
  userId: string,
  store: MemoryStore
): Promise<void> {
  const episode = await store.get<Episode>(NS.episodicMemory(userId), episodeId);

  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`);
  }

  const updatedEpisode: Episode = {
    ...episode,
    user_feedback: feedback,
    outcome: feedback === 'meh' ? 'failure' : 'success',
  };

  await store.put(NS.episodicMemory(userId), episodeId, updatedEpisode);
}
```

#### 1.3 Search Memories Tool

```typescript
// packages/memory/src/tools/search-memories.ts

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { retrieveMemories } from '../retrieval/hybrid-retrieval';

export interface SearchMemoriesParams {
  query: string;            // What to search for
  context?: string;         // Optional domain filter
  limit?: number;           // Max results (default: 10)
  includeArchived?: boolean; // Include archived memories
}

export interface SearchMemoriesContext {
  userId: string;
  store: MemoryStore;
  requestingAgent?: string; // For privacy enforcement
}

export interface ScoredMemory extends Memory {
  finalScore: number;
  matchType: 'semantic' | 'keyword' | 'entity' | 'combined';
}

/**
 * Search Memories Tool - v13 Section 8.8.1
 *
 * Finds relevant memories using hybrid retrieval:
 * - Semantic search (cosine similarity on embeddings)
 * - Keyword search (BM25 full-text)
 * - Entity lookup
 * - Combined via Reciprocal Rank Fusion (RRF)
 */
export async function searchMemories(
  params: SearchMemoriesParams,
  context: SearchMemoriesContext
): Promise<ScoredMemory[]> {
  const { query, context: domain, limit = 10, includeArchived = false } = params;
  const { userId, store, requestingAgent } = context;

  const results = await retrieveMemories({
    query,
    userId,
    store,
    options: {
      limit,
      context: domain,
      includeArchived,
      requestingAgent,
    },
  });

  return results;
}
```

#### 1.4 Invalidate Memory Tool

```typescript
// packages/memory/src/tools/invalidate-memory.ts

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';

export interface InvalidateMemoryParams {
  memoryId: string;
  reason: string;           // Why this is no longer true
}

export interface InvalidateMemoryContext {
  userId: string;
  store: MemoryStore;
}

/**
 * Invalidate Memory Tool - v13 Section 8.8.1
 *
 * Marks a fact as no longer true (don't delete - preserve history).
 * This supports bi-temporal modeling: we remember when things changed.
 */
export async function invalidateMemory(
  params: InvalidateMemoryParams,
  context: InvalidateMemoryContext
): Promise<void> {
  const { memoryId, reason } = params;
  const { userId, store } = context;

  const memory = await store.get<Memory>(NS.semanticMemory(userId), memoryId);

  if (!memory) {
    throw new Error(`Memory not found: ${memoryId}`);
  }

  const updatedMemory: Memory = {
    ...memory,
    invalid_at: Date.now(),
    invalidation_reason: reason,
  };

  await store.put(NS.semanticMemory(userId), memoryId, updatedMemory);
}
```

---

### 2. Vector Embeddings

#### 2.1 Local Embedder

```typescript
// packages/memory/src/embedding/local-embedder.ts

import { pipeline, env } from '@xenova/transformers';

// Configure for browser/node environment
env.allowLocalModels = true;
env.useBrowserCache = true;

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

export const EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'Xenova/nomic-embed-text-v1.5',
  dimensions: 768,
  batchSize: 32,
};

let embedder: Awaited<ReturnType<typeof pipeline>> | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Load the embedding model (lazy initialization)
 */
async function loadModel(): Promise<void> {
  if (embedder) return;
  if (isLoading && loadPromise) {
    await loadPromise;
    return;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      // feature-extraction pipeline with mean pooling
      embedder = await pipeline('feature-extraction', EMBEDDING_CONFIG.model, {
        quantized: true, // Use quantized model for faster inference
      });
    } finally {
      isLoading = false;
    }
  })();

  await loadPromise;
}

/**
 * Compute embedding for a single text
 *
 * v13 Section 8.5 - Local embeddings for privacy
 * Performance: ~50ms per embedding (PWA), ~10ms (Tauri)
 */
export async function computeLocalEmbedding(text: string): Promise<number[]> {
  await loadModel();

  if (!embedder) {
    throw new Error('Embedding model failed to load');
  }

  // Add prefix for nomic model (improves retrieval quality)
  const prefixedText = `search_document: ${text}`;

  const output = await embedder(prefixedText, {
    pooling: 'mean',
    normalize: true,
  });

  // Extract the embedding array
  return Array.from(output.data);
}

/**
 * Compute embeddings for multiple texts (batched)
 */
export async function computeBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  await loadModel();

  if (!embedder) {
    throw new Error('Embedding model failed to load');
  }

  const prefixedTexts = texts.map((t) => `search_document: ${t}`);

  const results: number[][] = [];

  // Process in batches
  for (let i = 0; i < prefixedTexts.length; i += EMBEDDING_CONFIG.batchSize) {
    const batch = prefixedTexts.slice(i, i + EMBEDDING_CONFIG.batchSize);
    const outputs = await Promise.all(
      batch.map(async (text) => {
        const output = await embedder!(text, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(output.data);
      })
    );
    results.push(...outputs);
  }

  return results;
}

/**
 * Compute query embedding (different prefix for retrieval)
 */
export async function computeQueryEmbedding(query: string): Promise<number[]> {
  await loadModel();

  if (!embedder) {
    throw new Error('Embedding model failed to load');
  }

  // Different prefix for queries (per nomic recommendation)
  const prefixedQuery = `search_query: ${query}`;

  const output = await embedder(prefixedQuery, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  // For normalized vectors, cosine similarity = dot product
  // But we compute full formula for safety
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

#### 2.2 Embedding Queue

```typescript
// packages/memory/src/embedding/embedding-queue.ts

import { computeBatchEmbeddings } from './local-embedder';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';

export interface EmbeddingQueueConfig {
  maxQueueSize: number;
  processInterval: number;    // ms
  batchSize: number;
}

export const DEFAULT_QUEUE_CONFIG: EmbeddingQueueConfig = {
  maxQueueSize: 1000,
  processInterval: 5000,      // Process every 5 seconds
  batchSize: 32,
};

interface QueueItem {
  memoryId: string;
  userId: string;
  content: string;
  addedAt: number;
}

/**
 * Embedding Queue - v13 Section 8.5.1
 *
 * Handles background embedding computation when device is busy.
 * Processes queued memories during Reflection cycles.
 */
export class EmbeddingQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private config: EmbeddingQueueConfig;
  private store: MemoryStore;

  constructor(store: MemoryStore, config: Partial<EmbeddingQueueConfig> = {}) {
    this.store = store;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  /**
   * Add memory to embedding queue
   */
  enqueue(memoryId: string, userId: string, content: string): void {
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('Embedding queue at capacity, dropping oldest items');
      this.queue.shift();
    }

    this.queue.push({
      memoryId,
      userId,
      content,
      addedAt: Date.now(),
    });
  }

  /**
   * Start background processing
   */
  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.processQueue();
    }, this.config.processInterval);
  }

  /**
   * Stop background processing
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Process queued items
   */
  async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    try {
      // Take a batch
      const batch = this.queue.splice(0, this.config.batchSize);

      // Compute embeddings
      const embeddings = await computeBatchEmbeddings(
        batch.map((item) => item.content)
      );

      // Update memories with embeddings
      await Promise.all(
        batch.map(async (item, i) => {
          const memory = await this.store.get(
            NS.semanticMemory(item.userId),
            item.memoryId
          );

          if (memory) {
            await this.store.put(NS.semanticMemory(item.userId), item.memoryId, {
              ...memory,
              embedding: embeddings[i],
              embedding_model: 'nomic-embed-text-v1.5',
              embedded_at: Date.now(),
            });
          }
        })
      );
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get queue status
   */
  getStatus(): { size: number; maxSize: number; processing: boolean } {
    return {
      size: this.queue.length,
      maxSize: this.config.maxQueueSize,
      processing: this.processing,
    };
  }
}
```

---

### 3. Hybrid Retrieval

#### 3.1 Reciprocal Rank Fusion

```typescript
// packages/memory/src/retrieval/rrf.ts

import type { Memory } from '@ownyou/shared-types';

export interface SearchResult {
  memory: Memory;
  score: number;          // Raw score from search method
  similarity?: number;    // Cosine similarity (semantic only)
  rank: number;           // Position in result list
  source: 'semantic' | 'keyword' | 'entity';
}

export interface RRFResult {
  memory: Memory;
  rrfScore: number;
  appearances: number;
  sources: string[];
}

/**
 * Reciprocal Rank Fusion (RRF) - v13 Section 8.7.2
 *
 * Combines ranked lists from different retrieval methods.
 * Formula: RRF_score(d) = SUM( 1 / (k + rank_i(d)) )
 *
 * Benefits:
 * - No score normalization needed across methods
 * - Rewards documents appearing in multiple lists
 * - Dampens volatility of being #1 vs #2
 *
 * @param resultLists - Arrays of search results from different methods
 * @param k - Dampening constant (default: 60)
 */
export function reciprocalRankFusion(
  resultLists: SearchResult[][],
  k: number = 60
): RRFResult[] {
  const scores = new Map<
    string,
    { memory: Memory; rrfScore: number; appearances: number; sources: string[] }
  >();

  for (const results of resultLists) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const memoryId = result.memory.id;

      const existing = scores.get(memoryId);
      const rrfContribution = 1 / (k + rank + 1);

      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.appearances += 1;
        if (!existing.sources.includes(result.source)) {
          existing.sources.push(result.source);
        }
      } else {
        scores.set(memoryId, {
          memory: result.memory,
          rrfScore: rrfContribution,
          appearances: 1,
          sources: [result.source],
        });
      }
    }
  }

  // Sort by RRF score descending
  return Array.from(scores.values()).sort((a, b) => b.rrfScore - a.rrfScore);
}
```

#### 3.2 Hybrid Retrieval

```typescript
// packages/memory/src/retrieval/hybrid-retrieval.ts

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import { computeQueryEmbedding, cosineSimilarity } from '../embedding/local-embedder';
import { reciprocalRankFusion, SearchResult, RRFResult } from './rrf';

export interface RetrievalOptions {
  limit?: number;
  context?: string;           // Domain filter
  includeArchived?: boolean;
  requestingAgent?: string;   // For privacy enforcement
}

export interface ScoredMemory extends Memory {
  finalScore: number;
  matchType: 'semantic' | 'keyword' | 'entity' | 'combined';
}

const DECAY_RATE = 0.95;  // Per week
const RRF_WEIGHT = 0.5;
const STRENGTH_WEIGHT = 0.3;
const RECENCY_WEIGHT = 0.2;

/**
 * Retrieve memories using hybrid strategy - v13 Section 8.7
 *
 * Combines:
 * 1. Semantic search (cosine similarity on embeddings)
 * 2. Keyword search (BM25 full-text matching)
 * 3. Entity lookup
 *
 * Results combined via Reciprocal Rank Fusion (RRF).
 * Final scoring adds strength and recency factors.
 */
export async function retrieveMemories(params: {
  query: string;
  userId: string;
  store: MemoryStore;
  options?: RetrievalOptions;
}): Promise<ScoredMemory[]> {
  const { query, userId, store, options = {} } = params;
  const { limit = 10, context, includeArchived = false } = options;

  // 1. Semantic search
  const semanticResults = await semanticSearch({
    query,
    userId,
    store,
    limit: limit * 2,
  });

  // 2. Keyword search (BM25)
  const keywordResults = await keywordSearch({
    query,
    userId,
    store,
    limit: limit * 2,
  });

  // 3. Entity lookup
  const entityResults = await entityLookup({
    query,
    userId,
    store,
    limit: 5,
  });

  // 4. Combine via RRF
  const rrfResults = reciprocalRankFusion([
    semanticResults,
    keywordResults,
    entityResults,
  ]);

  // 5. Calculate final scores
  const scored = rrfResults.map((result) => calculateFinalScore(result));

  // 6. Filter by context if provided
  const filtered = context
    ? scored.filter(
        (m) => m.context === context || m.context === 'general'
      )
    : scored;

  // 7. Filter archived if needed
  const archived = includeArchived
    ? filtered
    : filtered.filter((m) => !m.archived);

  // 8. Return top results
  return archived
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);
}

/**
 * Semantic search using vector embeddings
 */
async function semanticSearch(params: {
  query: string;
  userId: string;
  store: MemoryStore;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, userId, store, limit } = params;

  // Compute query embedding
  const queryEmbedding = await computeQueryEmbedding(query);

  // Get all memories with embeddings
  const allMemories = await store.list<Memory>(NS.semanticMemory(userId));

  // Calculate similarities
  const withScores = allMemories.items
    .filter((m) => m.embedding && !m.archived)
    .map((memory) => ({
      memory,
      score: cosineSimilarity(queryEmbedding, memory.embedding!),
      similarity: cosineSimilarity(queryEmbedding, memory.embedding!),
      rank: 0,
      source: 'semantic' as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Assign ranks
  return withScores.map((item, i) => ({ ...item, rank: i + 1 }));
}

/**
 * Keyword search using BM25
 */
async function keywordSearch(params: {
  query: string;
  userId: string;
  store: MemoryStore;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, userId, store, limit } = params;

  // Simple keyword matching (full BM25 implementation in store backend)
  const results = await store.search<Memory>({
    namespace: NS.semanticMemory(userId),
    query,
    limit,
    mode: 'fulltext',
  });

  return results.map((r, i) => ({
    memory: r.item,
    score: r.score ?? 1 / (i + 1),
    rank: i + 1,
    source: 'keyword' as const,
  }));
}

/**
 * Entity lookup for mentioned entities
 */
async function entityLookup(params: {
  query: string;
  userId: string;
  store: MemoryStore;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, userId, store, limit } = params;

  // Extract potential entity names (capitalized words, quoted phrases)
  const entityNames = extractEntityNames(query);

  const results: SearchResult[] = [];

  for (const name of entityNames) {
    // Look up entity
    const entities = await store.search<{ id: string; name: string }>({
      namespace: NS.entities(userId),
      query: name,
      limit: 1,
    });

    if (entities.length > 0) {
      // Find memories mentioning this entity
      const relatedMemories = await store.list<Memory>(
        NS.semanticMemory(userId)
      );

      const matching = relatedMemories.items
        .filter((m) => m.content.toLowerCase().includes(name.toLowerCase()))
        .slice(0, limit);

      matching.forEach((memory, i) => {
        results.push({
          memory,
          score: 1 / (i + 1),
          rank: results.length + 1,
          source: 'entity' as const,
        });
      });
    }
  }

  return results.slice(0, limit);
}

/**
 * Extract potential entity names from query
 */
function extractEntityNames(query: string): string[] {
  const capitalized = query.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  const quoted = query.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) || [];
  return [...new Set([...capitalized, ...quoted])];
}

/**
 * Calculate final score with strength and recency - v13 Section 8.7.3
 */
function calculateFinalScore(result: RRFResult): ScoredMemory {
  const memory = result.memory;

  // Recency decay (~5% per week)
  const daysSinceAccess = (Date.now() - memory.last_accessed) / (24 * 60 * 60 * 1000);
  const recencyScore = Math.pow(DECAY_RATE, daysSinceAccess / 7);

  // Normalize strength to 0-1 (strength can grow > 1)
  const normalizedStrength = Math.min(memory.strength / 5.0, 1.0);

  // Combined score
  const finalScore =
    result.rrfScore * RRF_WEIGHT +
    normalizedStrength * STRENGTH_WEIGHT +
    recencyScore * RECENCY_WEIGHT;

  // Determine match type
  const matchType =
    result.sources.length > 1
      ? 'combined'
      : (result.sources[0] as 'semantic' | 'keyword' | 'entity');

  return {
    ...memory,
    finalScore,
    matchType,
  };
}

/**
 * Find similar memories (for consolidation check)
 */
export async function findSimilarMemories(params: {
  query: string;
  queryEmbedding: number[];
  userId: string;
  store: MemoryStore;
  threshold: number;
  limit: number;
}): Promise<{ memory: Memory; similarity: number }[]> {
  const { queryEmbedding, userId, store, threshold, limit } = params;

  const allMemories = await store.list<Memory>(NS.semanticMemory(userId));

  return allMemories.items
    .filter((m) => m.embedding && !m.archived && !m.invalid_at)
    .map((memory) => ({
      memory,
      similarity: cosineSimilarity(queryEmbedding, memory.embedding!),
    }))
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
```

---

### 4. Memory Lifecycle

#### 4.1 Decay

```typescript
// packages/memory/src/lifecycle/decay.ts

import type { Memory } from '@ownyou/shared-types';

/**
 * Memory Decay - v13 Section 8.9.2
 *
 * Memories that aren't accessed gradually fade.
 * Rate: 5% per week (configurable)
 */

export const DECAY_RATE = 0.95;  // 5% decay per week
export const PRUNE_THRESHOLD = 0.1;

/**
 * Calculate effective strength after decay
 */
export function calculateEffectiveStrength(memory: Memory): number {
  const weeksSinceAccess =
    (Date.now() - memory.last_accessed) / (7 * 24 * 60 * 60 * 1000);

  return memory.strength * Math.pow(DECAY_RATE, weeksSinceAccess);
}

/**
 * Check if memory should be pruned
 */
export function shouldPrune(memory: Memory): boolean {
  const effectiveStrength = calculateEffectiveStrength(memory);
  return effectiveStrength < PRUNE_THRESHOLD;
}

/**
 * Calculate time until memory hits prune threshold
 */
export function weeksUntilPrune(memory: Memory): number {
  const effectiveStrength = calculateEffectiveStrength(memory);

  if (effectiveStrength <= PRUNE_THRESHOLD) {
    return 0;
  }

  // Solve: strength * DECAY_RATE^weeks = threshold
  // weeks = log(threshold / strength) / log(DECAY_RATE)
  return Math.log(PRUNE_THRESHOLD / effectiveStrength) / Math.log(DECAY_RATE);
}

/**
 * Boost memory strength on access
 */
export function boostOnAccess(memory: Memory): Partial<Memory> {
  return {
    last_accessed: Date.now(),
    access_count: memory.access_count + 1,
    strength: Math.min(memory.strength + 0.1, 5.0),
  };
}

/**
 * Boost memory strength on confirmation (new evidence)
 */
export function boostOnConfirmation(memory: Memory): Partial<Memory> {
  return {
    last_accessed: Date.now(),
    strength: Math.min(memory.strength + 0.5, 5.0),
    confidence: Math.min(memory.confidence + 0.1, 1.0),
  };
}
```

#### 4.2 Consolidation

```typescript
// packages/memory/src/lifecycle/consolidation.ts

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { NS } from '@ownyou/shared-types';

export interface ConsolidationParams {
  existing: Memory;
  newContent: string;
  newConfidence: number;
  userId: string;
  store: MemoryStore;
  llm?: LLMClient;
}

/**
 * Consolidate Memory - v13 Section 8.9.1
 *
 * When new information overlaps with existing memories, consolidate.
 * - Merge content if significantly different
 * - Increase strength (confirmation reinforces)
 * - Update confidence (weighted average favoring recent)
 */
export async function consolidateMemory(
  params: ConsolidationParams
): Promise<Memory> {
  const { existing, newContent, newConfidence, userId, store, llm } = params;

  // Merge content if different
  let mergedContent = existing.content;

  if (existing.content !== newContent) {
    if (llm) {
      // Use LLM to merge intelligently
      const response = await llm.complete({
        messages: [
          {
            role: 'system',
            content:
              'Merge these two observations about the same topic into one clear statement. Keep it concise.',
          },
          {
            role: 'user',
            content: `1. ${existing.content}\n2. ${newContent}`,
          },
        ],
        maxTokens: 150,
        temperature: 0.1,
      });
      mergedContent = response.content;
    } else {
      // Simple append if no LLM
      mergedContent = `${existing.content} (Updated: ${newContent})`;
    }
  }

  // Increase strength (confirmation reinforces memory)
  const newStrength = Math.min(existing.strength + 0.5, 5.0);

  // Update confidence (weighted average favoring recent)
  const newConfidenceScore = (existing.confidence + newConfidence * 2) / 3;

  const updatedMemory: Memory = {
    ...existing,
    content: mergedContent,
    strength: newStrength,
    confidence: newConfidenceScore,
    last_accessed: Date.now(),
    access_count: existing.access_count + 1,
  };

  await store.put(NS.semanticMemory(userId), existing.id, updatedMemory);

  return updatedMemory;
}

/**
 * Find memories that should be consolidated
 */
export async function findConsolidationCandidates(
  userId: string,
  store: MemoryStore
): Promise<Array<{ a: Memory; b: Memory; similarity: number }>> {
  // This is called during Reflection to find duplicate/similar memories
  // Implementation deferred - uses embedding similarity matrix
  return [];
}
```

#### 4.3 Pruning

```typescript
// packages/memory/src/lifecycle/pruning.ts

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import { calculateEffectiveStrength, PRUNE_THRESHOLD } from './decay';

export interface ArchivedMemory {
  original_id: string;
  namespace: string;
  content: string;
  summary: string;              // LLM-generated 1-sentence summary
  archival_reason: 'quota' | 'age' | 'low_strength';
  archived_at: number;
  original_created_at: number;
  original_context: string;
}

export interface PruneResult {
  archived: number;
  retained: number;
}

/**
 * Prune Memories - v13 Section 8.9.3
 *
 * Periodic cleanup archives memories below threshold.
 * Memories are never deleted - only archived for potential recovery.
 */
export async function pruneMemories(
  userId: string,
  store: MemoryStore
): Promise<PruneResult> {
  const allMemories = await store.list<Memory>(NS.semanticMemory(userId));

  let archived = 0;
  let retained = 0;

  for (const memory of allMemories.items) {
    // Skip already archived
    if (memory.archived) {
      continue;
    }

    const effectiveStrength = calculateEffectiveStrength(memory);

    if (effectiveStrength < PRUNE_THRESHOLD) {
      // Archive the memory
      await archiveMemory(memory, userId, 'low_strength', store);
      archived++;
    } else {
      retained++;
    }
  }

  return { archived, retained };
}

/**
 * Archive a memory (don't delete)
 */
async function archiveMemory(
  memory: Memory,
  userId: string,
  reason: 'quota' | 'age' | 'low_strength',
  store: MemoryStore
): Promise<void> {
  // Mark as archived in original location
  await store.put(NS.semanticMemory(userId), memory.id, {
    ...memory,
    archived: true,
    archived_at: Date.now(),
    archived_reason: reason,
  });

  // Also store in archive namespace with summary
  const archivedMemory: ArchivedMemory = {
    original_id: memory.id,
    namespace: 'semanticMemory',
    content: memory.content,
    summary: memory.content.slice(0, 100), // Simple summary for now
    archival_reason: reason,
    archived_at: Date.now(),
    original_created_at: memory.created_at,
    original_context: memory.context,
  };

  await store.put(
    NS.archived('semanticMemory'),
    memory.id,
    archivedMemory
  );
}

/**
 * Check storage quotas - v13 Section 8.15.2
 */
export async function checkQuota(
  namespace: string,
  userId: string,
  store: MemoryStore
): Promise<{
  current: number;
  max: number;
  percentage: number;
  needsArchival: boolean;
}> {
  const NAMESPACE_LIMITS: Record<string, { max: number; threshold: number }> = {
    semanticMemory: { max: 10000, threshold: 0.8 },
    episodicMemory: { max: 5000, threshold: 0.7 },
    proceduralMemory: { max: 500, threshold: 0.9 },
    entities: { max: 2000, threshold: 0.8 },
    relationships: { max: 10000, threshold: 0.8 },
  };

  const limits = NAMESPACE_LIMITS[namespace] ?? { max: 1000, threshold: 0.8 };

  const items = await store.list(NS.semanticMemory(userId));
  const current = items.items.filter((m) => !m.archived).length;

  const percentage = current / limits.max;

  return {
    current,
    max: limits.max,
    percentage,
    needsArchival: percentage > limits.threshold,
  };
}
```

---

### 5. Reflection Node

#### 5.1 Reflection Orchestrator

```typescript
// packages/reflection/src/reflection-node.ts

import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { pruneMemories } from '@ownyou/memory';
import { synthesizeProceduralRules } from './procedural-synthesis';
import { validateTemporalFacts } from './temporal-validation';

export type ReflectionTrigger =
  | { type: 'after_episodes'; count: number }
  | { type: 'daily_idle' }
  | { type: 'after_negative_feedback'; episodeId: string }
  | { type: 'weekly_maintenance' };

export interface ReflectionConfig {
  afterEpisodes: number;      // Run after N episodes (default: 5)
  dailyIdleHour: number;      // Hour to run daily (default: 3 = 3 AM)
  weeklyMaintenanceDay: number; // Day of week (default: 0 = Sunday)
}

export const DEFAULT_REFLECTION_CONFIG: ReflectionConfig = {
  afterEpisodes: 5,
  dailyIdleHour: 3,
  weeklyMaintenanceDay: 0,
};

export interface ReflectionResult {
  trigger: ReflectionTrigger;
  memoriesPruned: number;
  rulesGenerated: number;
  factsInvalidated: number;
  durationMs: number;
}

/**
 * Reflection Node - v13 Section 8.10
 *
 * Background process that synthesizes patterns and maintains memory quality.
 *
 * Runs:
 * 1. CONSOLIDATION - merge similar memories
 * 2. DECAY & PRUNE - remove low-value memories
 * 3. SUMMARIZATION - generate community summaries
 * 4. PROCEDURAL SYNTHESIS - extract rules from episode patterns
 * 5. TEMPORAL VALIDATION - mark outdated facts as invalid
 * 6. ENTITY EXTRACTION - extract entities from new memories (v13 8.4.5)
 */
export async function runReflection(
  userId: string,
  trigger: ReflectionTrigger,
  store: MemoryStore,
  llm: LLMClient
): Promise<ReflectionResult> {
  const startTime = Date.now();

  // 1. CONSOLIDATION - merge similar memories
  // (Deferred to background - computationally expensive)

  // 2. DECAY & PRUNE - remove low-value memories
  const pruneResult = await pruneMemories(userId, store);

  // 3. SUMMARIZATION - generate community summaries
  // (Run weekly only)
  if (trigger.type === 'weekly_maintenance') {
    await generateCommunitySummaries(userId, store, llm);
  }

  // 4. PROCEDURAL SYNTHESIS - extract rules from episode patterns
  const rulesGenerated = await synthesizeProceduralRules(userId, store, llm);

  // 5. TEMPORAL VALIDATION - mark outdated facts as invalid
  const factsInvalidated = await validateTemporalFacts(userId, store);

  // 6. ENTITY EXTRACTION - extract entities from new memories
  const entitiesExtracted = await extractEntitiesFromNewMemories(userId, store, llm);

  return {
    trigger,
    memoriesPruned: pruneResult.archived,
    rulesGenerated,
    factsInvalidated,
    entitiesExtracted,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Generate community summaries - v13 Section 8.9.4
 */
async function generateCommunitySummaries(
  userId: string,
  store: MemoryStore,
  llm: LLMClient
): Promise<void> {
  const contexts = ['travel', 'shopping', 'dining', 'events', 'content'];

  for (const context of contexts) {
    const memories = await store.search({
      namespace: ['ownyou.semantic', userId],
      filter: { context, archived: false },
      limit: 50,
    });

    if (memories.length < 5) continue;

    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content:
            'Analyze these observations about the user and generate a 2-3 sentence summary capturing key patterns.',
        },
        {
          role: 'user',
          content: `${context} observations:\n${memories.map((m) => `- ${m.item.content}`).join('\n')}`,
        },
      ],
      maxTokens: 200,
      temperature: 0.1,
    });

    await store.put(['ownyou.summaries', userId], context, {
      summary: response.content,
      source_count: memories.length,
      generated_at: Date.now(),
    });
  }
}

/**
 * Extract entities from new memories - v13 Section 8.4.5
 *
 * Entities are extracted during Reflection, not during hot-path writes.
 * This keeps write latency low while still building the entity graph.
 */
async function extractEntitiesFromNewMemories(
  userId: string,
  store: MemoryStore,
  llm: LLMClient
): Promise<number> {
  // Find memories that haven't had entities extracted yet
  const recentMemories = await store.search({
    namespace: NS.semanticMemory(userId),
    filter: { entities_extracted: { $ne: true } },
    limit: 50,
  });

  let entitiesCreated = 0;

  for (const memory of recentMemories) {
    // Use LLM to extract entities
    const extraction = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `Extract entities from this observation about the user.
Return JSON array:
[{
  "name": "entity name",
  "type": "person|organization|place|product|event",
  "relationship_to_user": "how user relates to this entity",
  "properties": { any relevant properties }
}]
Only extract clearly mentioned entities. Return [] if none found.`,
        },
        {
          role: 'user',
          content: memory.item.content,
        },
      ],
      maxTokens: 500,
      temperature: 0.1,
    });

    try {
      const entities = JSON.parse(extraction.content);

      for (const extracted of entities) {
        // Check if entity already exists
        const existingEntities = await store.search({
          namespace: NS.entities(userId),
          query: extracted.name,
          limit: 1,
        });

        if (existingEntities.length > 0) {
          // Update existing entity
          const existing = existingEntities[0].item;
          await store.put(NS.entities(userId), existing.id, {
            ...existing,
            last_mentioned: Date.now(),
            mention_count: (existing.mention_count || 0) + 1,
            source_memories: [...(existing.source_memories || []), memory.item.id],
            properties: { ...existing.properties, ...extracted.properties },
          });
        } else {
          // Create new entity
          const entityId = crypto.randomUUID();
          await store.put(NS.entities(userId), entityId, {
            id: entityId,
            name: extracted.name,
            type: extracted.type,
            properties: extracted.properties || {},
            first_seen: Date.now(),
            last_mentioned: Date.now(),
            mention_count: 1,
            source_memories: [memory.item.id],
          });

          // Create relationship to user if specified
          if (extracted.relationship_to_user) {
            await store.put(NS.relationships(userId), crypto.randomUUID(), {
              id: crypto.randomUUID(),
              from_entity: 'USER',
              to_entity: entityId,
              type: extracted.relationship_to_user.toUpperCase().replace(/ /g, '_'),
              valid_at: memory.item.valid_at,
              created_at: Date.now(),
              properties: {},
              source_memories: [memory.item.id],
            });
          }

          entitiesCreated++;
        }
      }
    } catch {
      // JSON parse failed, skip this memory
    }

    // Mark memory as processed
    await store.put(NS.semanticMemory(userId), memory.item.id, {
      ...memory.item,
      entities_extracted: true,
    });
  }

  return entitiesCreated;
}
```

#### 5.2 Procedural Synthesis

```typescript
// packages/reflection/src/procedural-synthesis.ts

import type { Episode, ProceduralRule } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { NS } from '@ownyou/shared-types';

/**
 * Synthesize Procedural Rules - v13 Section 8.10.1
 *
 * Extracts behavioral rules from episode patterns.
 * These rules are injected into agent system prompts.
 */
export async function synthesizeProceduralRules(
  userId: string,
  store: MemoryStore,
  llm: LLMClient
): Promise<number> {
  const agentTypes = ['travel', 'shopping', 'dining', 'events', 'content'];
  let totalRules = 0;

  for (const agentType of agentTypes) {
    // Get recent episodes for this agent
    const episodes = await store.list<Episode>(NS.episodicMemory(userId));

    const agentEpisodes = episodes.items
      .filter((e) => e.agent_type === agentType)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    // Need at least 3 episodes to find patterns
    if (agentEpisodes.length < 3) continue;

    // Ask LLM to identify patterns
    const response = await llm.complete({
      messages: [
        {
          role: 'system',
          content: `You analyze past interactions to identify behavioral rules.

For each rule:
1. State the rule clearly (e.g., "Always suggest X before Y")
2. Explain which episodes support this pattern
3. Rate confidence (0.0-1.0) based on pattern consistency

Output JSON array:
[
  {
    "rule": "string - the behavioral rule",
    "evidence": ["episode_id1", "episode_id2"],
    "confidence": 0.0-1.0
  }
]

Only include rules with confidence >= 0.7.`,
        },
        {
          role: 'user',
          content: `Analyze these ${agentEpisodes.length} past ${agentType} interactions:

${agentEpisodes
  .map(
    (e, i) => `
Episode ${i + 1} (${e.id}):
- Situation: ${e.situation}
- Action: ${e.action}
- Outcome: ${e.outcome}
- Feedback: ${e.user_feedback || 'none'}
`
  )
  .join('\n---\n')}`,
        },
      ],
      maxTokens: 1000,
      temperature: 0.1,
    });

    // Parse rules
    let rules: Array<{ rule: string; evidence: string[]; confidence: number }> =
      [];
    try {
      rules = JSON.parse(response.content);
    } catch {
      continue;
    }

    // Filter by confidence
    rules = rules.filter((r) => r.confidence >= 0.7);

    if (rules.length === 0) continue;

    // Store synthesized rules
    const proceduralRules: ProceduralRule[] = rules.map((r) => ({
      id: crypto.randomUUID(),
      agent_type: agentType,
      rule: r.rule,
      derived_from: r.evidence,
      confidence: r.confidence,
      created_at: Date.now(),
      last_validated: Date.now(),
      override_count: 0,
    }));

    await store.put(NS.proceduralMemory(userId, agentType), 'rules', {
      rules: proceduralRules,
      synthesized_at: Date.now(),
    });

    totalRules += proceduralRules.length;
  }

  return totalRules;
}

/**
 * Get procedural rules for an agent (for context injection)
 */
export async function getProceduralRules(
  userId: string,
  agentType: string,
  store: MemoryStore
): Promise<ProceduralRule[]> {
  const stored = await store.get<{ rules: ProceduralRule[] }>(
    NS.proceduralMemory(userId, agentType),
    'rules'
  );

  if (!stored) return [];

  // Filter by confidence and recency
  return stored.rules
    .filter((r) => r.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence);
}
```

#### 5.3 Automatic Context Injection

```typescript
// packages/reflection/src/context-injection.ts

import type { Memory, Episode, ProceduralRule } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import { retrieveMemories } from '@ownyou/memory';
import { getProceduralRules } from './procedural-synthesis';

export interface AgentContext {
  semanticMemories: Memory[];
  similarEpisodes: Episode[];
  proceduralRules: ProceduralRule[];
}

/**
 * Automatic Context Injection - v13 Section 8.8.2
 *
 * At mission start, relevant memories are automatically injected
 * into the agent's context. This provides:
 * - Relevant semantic memories (what we know about the user)
 * - Similar past episodes (few-shot learning examples)
 * - Procedural rules (learned behaviors)
 */
export async function buildAgentContext(
  userId: string,
  agentType: string,
  triggerDescription: string,
  store: MemoryStore
): Promise<AgentContext> {
  // 1. Retrieve relevant semantic memories
  const semanticMemories = await retrieveMemories({
    query: triggerDescription,
    userId,
    store,
    options: { limit: 10, context: agentType },
  });

  // 2. Get similar past episodes for few-shot learning
  const allEpisodes = await store.list<Episode>(NS.episodicMemory(userId));
  const agentEpisodes = allEpisodes.items
    .filter((e) => e.agent_type === agentType)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  // 3. Load procedural rules for this agent
  const proceduralRules = await getProceduralRules(userId, agentType, store);

  return {
    semanticMemories,
    similarEpisodes: agentEpisodes,
    proceduralRules,
  };
}

/**
 * Format context for injection into agent system prompt
 */
export function formatContextForPrompt(context: AgentContext): string {
  const sections: string[] = [];

  // Format semantic memories
  if (context.semanticMemories.length > 0) {
    sections.push(`## What You Know About This User

${context.semanticMemories.map((m) => `- ${m.content} (confidence: ${m.confidence})`).join('\n')}`);
  }

  // Format episodes as few-shot examples
  if (context.similarEpisodes.length > 0) {
    sections.push(`## Relevant Past Experiences

${context.similarEpisodes
  .map(
    (e) => `**${e.outcome === 'success' ? 'SUCCESS' : 'FAILURE'}**: ${e.situation}
  - Approach: ${e.reasoning}
  - Action: ${e.action}
  - Feedback: ${e.user_feedback || 'none'}`
  )
  .join('\n\n')}`);
  }

  // Format procedural rules
  if (context.proceduralRules.length > 0) {
    sections.push(`## Learned Behaviors for This User

${context.proceduralRules.map((r) => `- ${r.rule}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Create enriched system prompt with memory context
 */
export function createEnrichedSystemPrompt(
  basePrompt: string,
  context: AgentContext
): string {
  const memoryContext = formatContextForPrompt(context);

  if (!memoryContext) {
    return basePrompt;
  }

  return `${basePrompt}

---

${memoryContext}`;
}
```

#### 5.4 Reflection Triggers

```typescript
// packages/reflection/src/triggers.ts

import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { NS } from '@ownyou/shared-types';
import { runReflection, ReflectionTrigger, DEFAULT_REFLECTION_CONFIG } from './reflection-node';

interface TriggerState {
  episodeSinceLastReflection: number;
  lastReflectionTime: number;
  lastDailyReflection: number;
  lastWeeklyReflection: number;
}

/**
 * Reflection Trigger Manager - v13 Section 8.10
 *
 * Triggers:
 * - after_episodes: 5 - Run after every 5 episodes
 * - daily_idle: 03:00 - Run at 3 AM if app was used that day
 * - after_negative_feedback - Immediate on negative outcomes
 * - weekly_maintenance: SUN - Weekly cleanup
 */
export class ReflectionTriggerManager {
  private state: TriggerState = {
    episodeSinceLastReflection: 0,
    lastReflectionTime: 0,
    lastDailyReflection: 0,
    lastWeeklyReflection: 0,
  };

  constructor(
    private userId: string,
    private store: MemoryStore,
    private llm: LLMClient
  ) {}

  /**
   * Called when a new episode is recorded
   */
  async onEpisodeRecorded(episodeId: string, wasNegative: boolean): Promise<void> {
    this.state.episodeSinceLastReflection++;

    // Immediate reflection on negative feedback
    if (wasNegative) {
      await this.triggerReflection({
        type: 'after_negative_feedback',
        episodeId,
      });
      return;
    }

    // Check episode count threshold
    if (this.state.episodeSinceLastReflection >= DEFAULT_REFLECTION_CONFIG.afterEpisodes) {
      await this.triggerReflection({
        type: 'after_episodes',
        count: this.state.episodeSinceLastReflection,
      });
    }
  }

  /**
   * Called on app idle (background task)
   */
  async checkDailyReflection(): Promise<void> {
    const now = new Date();
    const today = now.toDateString();

    // Already ran today?
    const lastDaily = new Date(this.state.lastDailyReflection).toDateString();
    if (lastDaily === today) return;

    // Is it time?
    if (now.getHours() === DEFAULT_REFLECTION_CONFIG.dailyIdleHour) {
      await this.triggerReflection({ type: 'daily_idle' });
      this.state.lastDailyReflection = Date.now();
    }
  }

  /**
   * Called weekly (background task)
   */
  async checkWeeklyReflection(): Promise<void> {
    const now = new Date();

    // Already ran this week?
    const lastWeeklyDate = new Date(this.state.lastWeeklyReflection);
    const daysSinceLastWeekly = Math.floor(
      (now.getTime() - lastWeeklyDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceLastWeekly < 7) return;

    // Is it the right day?
    if (now.getDay() === DEFAULT_REFLECTION_CONFIG.weeklyMaintenanceDay) {
      await this.triggerReflection({ type: 'weekly_maintenance' });
      this.state.lastWeeklyReflection = Date.now();
    }
  }

  private async triggerReflection(trigger: ReflectionTrigger): Promise<void> {
    console.log(`[Reflection] Triggered by: ${trigger.type}`);

    const result = await runReflection(
      this.userId,
      trigger,
      this.store,
      this.llm
    );

    console.log(
      `[Reflection] Complete: pruned=${result.memoriesPruned}, rules=${result.rulesGenerated}, duration=${result.durationMs}ms`
    );

    // Reset counter after successful reflection
    this.state.episodeSinceLastReflection = 0;
    this.state.lastReflectionTime = Date.now();
  }
}
```

---

### 6. Content Agent

#### 6.1 Agent Definition

```typescript
// packages/agents/content/src/agent.ts

import {
  BaseAgent,
  AgentContext,
} from '@ownyou/agents-base';
import type {
  AgentType,
  AgentLevel,
  AgentPermissions,
  MissionCard,
} from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { getProceduralRules } from '@ownyou/reflection';
import { detectContentInterests } from './triggers';
import { recommendContent } from './tools/recommend-content';
import { summarizeArticle } from './tools/summarize-article';

export interface ContentTrigger {
  type: 'scheduled' | 'interest_detected';
  interests?: string[];
}

interface ContentItem {
  title: string;
  url: string;
  source: string;
  type: 'article' | 'podcast' | 'video';
  summary?: string;
  relevanceScore: number;
}

/**
 * Content Agent - L1 Complexity
 *
 * Recommends articles, podcasts, and videos based on user interests.
 *
 * v13 Section 3.6.1 - Agent Type: content
 * v13 Section 3.6.3 - Level: L1 (3 tool calls, 2 LLM calls, 30s timeout)
 */
export class ContentAgent extends BaseAgent<ContentTrigger> {
  readonly agentType: AgentType = 'content';
  readonly level: AgentLevel = 'L1';

  readonly permissions: AgentPermissions = {
    agentType: 'content',
    memoryAccess: {
      read: [
        'ownyou.semantic',
        'ownyou.episodes',
        'ownyou.iab',
        'ownyou.ikigai',
      ],
      write: [
        'ownyou.episodes',
        'ownyou.missions',
      ],
      search: [
        'ownyou.semantic',
      ],
    },
    externalApis: [
      // Mock APIs in Sprint 4
    ],
    toolDefinitions: [
      { name: 'recommend_content', description: 'Find relevant content' },
      { name: 'summarize_article', description: 'Summarize article content' },
    ],
  };

  protected async execute(
    trigger: ContentTrigger,
    context: AgentContext
  ): Promise<MissionCard | null> {
    const { tracer } = context;

    // 1. Get user interests from semantic memory
    const interests = await this.getUserInterests(tracer);
    if (interests.length === 0) {
      return null;
    }

    // 2. Get procedural rules (learned preferences)
    const rules = await getProceduralRules(this.userId, 'content', this.store);

    // 3. Find content recommendations
    const content = await this.findContent(interests, rules, tracer);
    if (content.length === 0) {
      return null;
    }

    // 4. Generate mission card
    const mission = await this.generateMission(interests, content, tracer);

    return mission;
  }

  private async getUserInterests(tracer: any): Promise<string[]> {
    // Search semantic memory for interest-related facts
    const results = await this.searchMemory<{ content: string }>(
      NS.semanticMemory(this.userId),
      'interests hobbies reading preferences topics',
      10,
      tracer
    );

    // Extract interest keywords
    const interests = results
      .map((r) => r.content)
      .join(' ')
      .toLowerCase();

    // Simple keyword extraction
    const keywords = new Set<string>();
    const interestPatterns = [
      /interested in (\w+)/gi,
      /enjoys? (\w+)/gi,
      /likes? (\w+)/gi,
      /passionate about (\w+)/gi,
    ];

    for (const pattern of interestPatterns) {
      let match;
      while ((match = pattern.exec(interests)) !== null) {
        keywords.add(match[1]);
      }
    }

    // Also check IAB categories for topics
    const iabResults = await this.store.list(NS.iabClassifications(this.userId));
    const topCategories = new Map<string, number>();

    for (const item of iabResults.items.slice(0, 50)) {
      const cat = item.tier1_category || '';
      topCategories.set(cat, (topCategories.get(cat) || 0) + 1);
    }

    // Add top 3 IAB categories as interests
    const sortedCategories = Array.from(topCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    return [...keywords, ...sortedCategories].slice(0, 5);
  }

  private async findContent(
    interests: string[],
    rules: any[],
    tracer: any
  ): Promise<ContentItem[]> {
    // Use tool to find content (mocked in Sprint 4)
    const content = await this.executeTool(
      'recommend_content',
      { interests, rules },
      recommendContent,
      tracer
    );

    return content;
  }

  private async generateMission(
    interests: string[],
    content: ContentItem[],
    tracer: any
  ): Promise<MissionCard> {
    // Use LLM to generate mission card
    const response = await this.callLLM(
      [
        {
          role: 'system',
          content: `Generate a mission card for content recommendations.
Be engaging and specific. Highlight why this content matches user interests.
Output JSON: { "title": string (max 60 chars), "summary": string (max 200 chars) }`,
        },
        {
          role: 'user',
          content: `User interests: ${interests.join(', ')}

Top recommendations:
${content.slice(0, 3).map((c) => `- ${c.title} (${c.type}): ${c.summary || 'No summary'}`).join('\n')}`,
        },
      ],
      { maxTokens: 200, temperature: 0.3 },
      tracer
    );

    let title = `Reading List: ${interests[0] || 'Curated Content'}`;
    let summary = `Found ${content.length} items matching your interests`;

    try {
      const parsed = JSON.parse(response);
      title = parsed.title ?? title;
      summary = parsed.summary ?? summary;
    } catch {
      // Use defaults
    }

    const mission: MissionCard = {
      id: crypto.randomUUID(),
      type: 'content',
      title,
      summary,
      urgency: 'low',
      status: 'CREATED',
      createdAt: Date.now(),
      ikigaiDimensions: ['interests'],
      ikigaiAlignmentBoost: 0.2,
      primaryAction: {
        label: 'View Recommendations',
        type: 'navigate',
        payload: { content },
      },
      secondaryActions: [
        {
          label: 'Not Interested',
          type: 'confirm',
          payload: { action: 'dismiss' },
        },
        {
          label: 'Save for Later',
          type: 'confirm',
          payload: { action: 'save' },
        },
      ],
      agentThreadId: tracer.getTrace().traceId,
      evidenceRefs: interests,
    };

    // Store mission card
    await this.writeMemory(
      NS.missionCards(this.userId),
      mission.id,
      mission,
      tracer
    );

    return mission;
  }

  protected extractTags(trigger: ContentTrigger, mission: MissionCard): string[] {
    return ['content', 'reading', 'recommendations'];
  }
}
```

#### 6.2 Mock Tools

```typescript
// packages/agents/content/src/tools/recommend-content.ts

export interface RecommendContentParams {
  interests: string[];
  rules?: any[];
}

export interface ContentItem {
  title: string;
  url: string;
  source: string;
  type: 'article' | 'podcast' | 'video';
  summary?: string;
  relevanceScore: number;
}

/**
 * Mock content recommendation tool for Sprint 4
 * In Sprint 5+, this will call real RSS/News APIs
 */
export async function recommendContent(
  params: RecommendContentParams
): Promise<ContentItem[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const { interests } = params;

  // Mock content based on interests
  const mockContent: Record<string, ContentItem[]> = {
    technology: [
      {
        title: 'The Future of AI in Everyday Life',
        url: 'https://example.com/ai-future',
        source: 'TechCrunch',
        type: 'article',
        summary: 'How artificial intelligence is transforming daily routines',
        relevanceScore: 0.9,
      },
      {
        title: 'Understanding Web3 Fundamentals',
        url: 'https://example.com/web3',
        source: 'The Verge',
        type: 'article',
        summary: 'A beginner\'s guide to decentralized technologies',
        relevanceScore: 0.85,
      },
    ],
    travel: [
      {
        title: 'Hidden Gems of Southeast Asia',
        url: 'https://example.com/asia-travel',
        source: 'Lonely Planet',
        type: 'article',
        summary: 'Off-the-beaten-path destinations worth exploring',
        relevanceScore: 0.88,
      },
    ],
    health: [
      {
        title: 'The Science of Better Sleep',
        url: 'https://example.com/sleep',
        source: 'Huberman Lab',
        type: 'podcast',
        summary: 'Evidence-based strategies for improving sleep quality',
        relevanceScore: 0.92,
      },
    ],
    default: [
      {
        title: 'This Week in Interesting Reads',
        url: 'https://example.com/weekly',
        source: 'Medium',
        type: 'article',
        summary: 'A curated collection of thought-provoking articles',
        relevanceScore: 0.7,
      },
    ],
  };

  // Collect content matching interests
  const results: ContentItem[] = [];

  for (const interest of interests) {
    const lowerInterest = interest.toLowerCase();
    for (const [key, items] of Object.entries(mockContent)) {
      if (lowerInterest.includes(key) || key.includes(lowerInterest)) {
        results.push(...items);
      }
    }
  }

  // Add default content if nothing matched
  if (results.length === 0) {
    results.push(...mockContent.default);
  }

  // Sort by relevance
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
```

---

### 7. Privacy-Tier Enforcement Enhancement

```typescript
// packages/agents/base/src/privacy-guard.ts (ENHANCED)

import type { AgentPermissions, Memory } from '@ownyou/shared-types';

/**
 * Privacy Tiers - v13 Section 8.11
 */
export const PRIVACY_TIERS = {
  public: {
    domains: ['shopping', 'travel', 'dining', 'events', 'content'],
    cross_access: 'full' as const,
    description: 'General lifestyle preferences safe to share across agents',
  },
  sensitive: {
    domains: ['financial', 'relationships'],
    cross_access: 'justified' as const,
    description: 'Personal information shared only when directly relevant',
  },
  private: {
    domains: ['health', 'journal'],
    cross_access: 'none' as const,
    description: 'Highly personal information isolated by default',
  },
} as const;

/**
 * PrivacyGuard - Enhanced with privacy tier enforcement
 *
 * v13 Section 3.6.5 - Privacy-Tier Enforcement for Agents
 */
export class PrivacyGuard {
  private permissions: AgentPermissions;

  constructor(permissions: AgentPermissions) {
    this.permissions = permissions;
  }

  // ... existing methods ...

  /**
   * Check if agent can access memory with given privacy tier
   *
   * v13 Section 8.11 - Privacy Tiers
   */
  canAccessMemoryWithTier(
    memory: Memory,
    justification?: string
  ): { allowed: boolean; reason?: string } {
    const tier = PRIVACY_TIERS[memory.privacy_tier];

    if (!tier) {
      return { allowed: false, reason: 'Unknown privacy tier' };
    }

    switch (tier.cross_access) {
      case 'full':
        return { allowed: true };

      case 'justified':
        if (justification && justification.length > 20) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'Sensitive data requires justification (>20 chars)',
        };

      case 'none':
        return {
          allowed: false,
          reason: 'Private data cannot be accessed by other agents',
        };

      default:
        return { allowed: false, reason: 'Invalid access policy' };
    }
  }

  /**
   * Determine privacy tier for a memory based on context
   */
  static inferPrivacyTier(context: string): 'public' | 'sensitive' | 'private' {
    for (const [tier, config] of Object.entries(PRIVACY_TIERS)) {
      if (config.domains.includes(context)) {
        return tier as 'public' | 'sensitive' | 'private';
      }
    }
    return 'public'; // Default
  }

  /**
   * Audit log for privacy violations
   */
  static logViolationAttempt(
    agentType: string,
    namespace: string,
    operation: string
  ): void {
    console.warn(
      `[Privacy Violation Attempt] Agent: ${agentType}, Namespace: ${namespace}, Operation: ${operation}`
    );
    // In production, this would go to audit log storage
  }
}
```

---

## Implementation Tasks

### Week 1: Memory Infrastructure

| Day | Focus            | Deliverables                                      |
| --- | ---------------- | ------------------------------------------------- |
| 1   | Local embeddings | @xenova/transformers integration, embedding queue |
| 2   | Memory tools     | save_observation, save_episode, search_memories   |
| 3   | Hybrid retrieval | Vector search, BM25, RRF combination              |
| 4   | Lifecycle        | Decay calculation, consolidation, pruning         |
| 5   | Tests            | Full memory package test suite                    |

### Week 2: Reflection Node

| Day | Focus                   | Deliverables                              |
| --- | ----------------------- | ----------------------------------------- |
| 6   | Reflection orchestrator | Main reflection flow                      |
| 7   | Procedural synthesis    | Episode pattern analysis, rule extraction |
| 8   | Trigger system          | Episode-based, daily, weekly triggers     |
| 9   | Context injection       | Procedural rules into agent prompts       |
| 10  | Tests                   | Reflection test suite                     |

### Week 3: Content Agent + Integration

| Day | Focus               | Deliverables                              |
| --- | ------------------- | ----------------------------------------- |
| 11  | Content Agent       | L1 agent using BaseAgent                  |
| 12  | Content tools       | Mock recommend_content, summarize_article |
| 13  | Privacy enhancement | PrivacyGuard tier enforcement             |
| 14  | Integration         | Shopping Agent uses learned rules         |
| 15  | End-to-end test     | Full learning loop demonstration          |

---

## Testing Strategy

### Unit Tests

```typescript
// packages/memory/src/__tests__/embedding.test.ts

describe('LocalEmbedder', () => {
  it('should compute embedding for text', async () => {
    const embedding = await computeLocalEmbedding('The user prefers direct flights');
    expect(embedding).toHaveLength(768);
    expect(embedding.every((v) => typeof v === 'number')).toBe(true);
  });

  it('should return similar embeddings for similar text', async () => {
    const emb1 = await computeLocalEmbedding('User likes Italian food');
    const emb2 = await computeLocalEmbedding('User enjoys Italian cuisine');
    const emb3 = await computeLocalEmbedding('User prefers direct flights');

    const sim12 = cosineSimilarity(emb1, emb2);
    const sim13 = cosineSimilarity(emb1, emb3);

    expect(sim12).toBeGreaterThan(sim13);
    expect(sim12).toBeGreaterThan(0.8);
  });
});

// packages/memory/src/__tests__/retrieval.test.ts

describe('Hybrid Retrieval', () => {
  it('should combine semantic and keyword search via RRF', async () => {
    // Setup: store memories with embeddings
    const results = await retrieveMemories({
      query: 'budget travel preferences',
      userId: 'test-user',
      store: mockStore,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].finalScore).toBeDefined();
    expect(results[0].matchType).toMatch(/semantic|keyword|entity|combined/);
  });

  it('should boost frequently accessed memories', async () => {
    // Memory accessed 10 times should rank higher
    const results = await retrieveMemories({
      query: 'user preferences',
      userId: 'test-user',
      store: mockStore,
    });

    const frequentMemory = results.find((m) => m.access_count === 10);
    const rareMemory = results.find((m) => m.access_count === 1);

    if (frequentMemory && rareMemory) {
      expect(frequentMemory.finalScore).toBeGreaterThan(rareMemory.finalScore);
    }
  });
});

// packages/memory/src/__tests__/lifecycle.test.ts

describe('Memory Decay', () => {
  it('should calculate 5% decay per week', () => {
    const memory: Memory = {
      ...baseMemory,
      strength: 1.0,
      last_accessed: Date.now() - 7 * 24 * 60 * 60 * 1000, // 1 week ago
    };

    const effective = calculateEffectiveStrength(memory);
    expect(effective).toBeCloseTo(0.95, 2);
  });

  it('should identify memories for pruning', () => {
    const weakMemory: Memory = {
      ...baseMemory,
      strength: 0.05,
      last_accessed: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    };

    expect(shouldPrune(weakMemory)).toBe(true);
  });
});
```

### Integration Tests

```typescript
// packages/integration-tests/src/__tests__/learning-loop.test.ts

describe('Learning Loop Integration', () => {
  let store: MemoryStore;
  let llm: LLMClient;
  let shoppingAgent: ShoppingAgent;
  const userId = 'test-user';

  beforeEach(async () => {
    store = await createTestStore();
    llm = createMockLLMClient();
    shoppingAgent = new ShoppingAgent({ store, llm, userId });

    // Seed with episodes
    await seedEpisodes(store, userId, 'shopping', 6); // Trigger reflection
  });

  it('should synthesize procedural rules from episodes', async () => {
    // Run reflection
    const reflectionResult = await runReflection(
      userId,
      { type: 'after_episodes', count: 6 },
      store,
      llm
    );

    expect(reflectionResult.rulesGenerated).toBeGreaterThan(0);

    // Check rules were stored
    const rules = await getProceduralRules(userId, 'shopping', store);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should inject procedural rules into agent context', async () => {
    // First, create rules
    await runReflection(
      userId,
      { type: 'after_episodes', count: 6 },
      store,
      llm
    );

    // Run agent
    const result = await shoppingAgent.run({ type: 'scheduled' });

    // Verify trace shows rules were used
    const trace = result.trace;
    const systemPromptStep = trace.steps.find(
      (s) => s.stepType === 'context_injection'
    );

    // Agent should have procedural rules in context
    expect(trace.metadata?.proceduralRulesCount).toBeGreaterThan(0);
  });

  it('should demonstrate learning from feedback', async () => {
    // 1. Agent generates mission
    const result1 = await shoppingAgent.run({ type: 'scheduled' });
    expect(result1.mission).not.toBeNull();

    // 2. User gives negative feedback
    await updateEpisodeWithFeedback(
      result1.mission!.agentThreadId,
      'meh',
      userId,
      store
    );

    // 3. Reflection triggered
    await runReflection(
      userId,
      { type: 'after_negative_feedback', episodeId: result1.mission!.agentThreadId },
      store,
      llm
    );

    // 4. New rules should be synthesized
    const rules = await getProceduralRules(userId, 'shopping', store);

    // At least one rule should address negative feedback patterns
    const hasNegativePattern = rules.some(
      (r) => r.rule.toLowerCase().includes('avoid') ||
             r.rule.toLowerCase().includes("don't") ||
             r.derived_from.length > 0
    );
    expect(hasNegativePattern).toBe(true);
  });
});

describe('Content Agent Integration', () => {
  it('should generate content recommendations', async () => {
    const contentAgent = new ContentAgent({ store, llm, userId });

    // Seed with interests
    await store.put(NS.semanticMemory(userId), 'interest-1', {
      id: 'interest-1',
      content: 'User is interested in technology and AI',
      context: 'interests',
      strength: 1.0,
      confidence: 0.9,
      created_at: Date.now(),
      valid_at: Date.now(),
      last_accessed: Date.now(),
      access_count: 1,
      sources: [],
      privacy_tier: 'public',
    });

    const result = await contentAgent.run({ type: 'scheduled' });

    expect(result.success).toBe(true);
    expect(result.mission?.type).toBe('content');
    expect(result.mission?.title).toBeDefined();
  });

  it('should respect L1 limits', async () => {
    const contentAgent = new ContentAgent({ store, llm, userId });
    const result = await contentAgent.run({ type: 'scheduled' });

    // L1 = max 3 tool calls, 2 LLM calls
    const toolCalls = result.trace.steps.filter((s) => s.stepType === 'tool_call');
    const llmCalls = result.trace.steps.filter((s) => s.stepType === 'llm_call');

    expect(toolCalls.length).toBeLessThanOrEqual(3);
    expect(llmCalls.length).toBeLessThanOrEqual(2);
  });
});
```

---

## Success Criteria

### Memory Tools

- [ ] save_observation creates memories with embeddings
- [ ] save_episode records complete interactions
- [ ] search_memories uses hybrid retrieval (semantic + BM25 + RRF)
- [ ] invalidate_memory marks facts as no longer true (bi-temporal)
- [ ] Memory consolidation merges similar memories

### Vector Embeddings

- [ ] @xenova/transformers loads nomic-embed-text-v1.5
- [ ] Embeddings computed in ~50ms (PWA) / ~10ms (Tauri)
- [ ] Batch embedding queue processes background work
- [ ] Cosine similarity correctly identifies similar memories

### Memory Lifecycle

- [ ] Decay: 5%/week strength reduction calculated correctly
- [ ] Pruning: Memories below 0.1 threshold archived
- [ ] Archival: Archived memories recoverable, not deleted
- [ ] Quota checks warn at 80% capacity

### Reflection Node

- [ ] Triggered after 5 episodes
- [ ] Triggered immediately on negative feedback
- [ ] Procedural rules synthesized from episode patterns
- [ ] Rules filtered by confidence >= 0.7
- [ ] Temporal validation marks outdated facts

### Content Agent

- [ ] L1 agent generates content recommendations
- [ ] Respects L1 limits (3 tools, 2 LLM, 30s)
- [ ] Uses procedural rules from memory
- [ ] Records episodes for learning

### Privacy-Tier Enforcement

- [ ] Public tier: full cross-agent access
- [ ] Sensitive tier: requires justification
- [ ] Private tier: no cross-agent access
- [ ] Violations logged to audit trail

### Integration

- [ ] Shopping Agent demonstrates learning from feedback
- [ ] Procedural rules injected into agent context
- [ ] Full loop: Feedback → Episode → Reflection → Rules → Agent
- [ ] All tests passing

---

## Risks and Mitigations

| Risk                                     | Likelihood | Impact | Mitigation                                 |
| ---------------------------------------- | ---------- | ------ | ------------------------------------------ |
| Embedding model too large for browser    | Medium     | High   | Use quantized model, lazy loading          |
| Procedural synthesis produces poor rules | Medium     | Medium | Confidence thresholds, user override count |
| Memory retrieval slow with many memories | Low        | Medium | Indexing, pagination, caching              |
| Reflection runs too often                | Low        | Low    | Debounce triggers, rate limiting           |
| Privacy tier too restrictive             | Low        | Medium | Start with public tier, expand carefully   |

---

## Files to Create

### New Packages

**@ownyou/memory:**

- `packages/memory/src/index.ts`
- `packages/memory/src/tools/save-observation.ts`
- `packages/memory/src/tools/save-episode.ts`
- `packages/memory/src/tools/search-memories.ts`
- `packages/memory/src/tools/invalidate-memory.ts`
- `packages/memory/src/embedding/local-embedder.ts`
- `packages/memory/src/embedding/embedding-queue.ts`
- `packages/memory/src/retrieval/vector-search.ts`
- `packages/memory/src/retrieval/fulltext-search.ts`
- `packages/memory/src/retrieval/rrf.ts`
- `packages/memory/src/retrieval/hybrid-retrieval.ts`
- `packages/memory/src/lifecycle/decay.ts`
- `packages/memory/src/lifecycle/consolidation.ts`
- `packages/memory/src/lifecycle/pruning.ts`
- `packages/memory/src/__tests__/*.test.ts`
- `packages/memory/package.json`

**@ownyou/reflection:**

- `packages/reflection/src/index.ts`
- `packages/reflection/src/reflection-node.ts`
- `packages/reflection/src/procedural-synthesis.ts`
- `packages/reflection/src/context-injection.ts`
- `packages/reflection/src/entity-extraction.ts`
- `packages/reflection/src/temporal-validation.ts`
- `packages/reflection/src/triggers.ts`
- `packages/reflection/src/__tests__/*.test.ts`
- `packages/reflection/package.json`

**@ownyou/agents-content:**

- `packages/agents/content/src/index.ts`
- `packages/agents/content/src/agent.ts`
- `packages/agents/content/src/triggers.ts`
- `packages/agents/content/src/tools/recommend-content.ts`
- `packages/agents/content/src/tools/summarize-article.ts`
- `packages/agents/content/src/__tests__/*.test.ts`
- `packages/agents/content/package.json`

### Modified Files

- `packages/agents/base/src/privacy-guard.ts` - Add tier enforcement
- `packages/agents/base/src/base-agent.ts` - Add procedural rule injection
- `pnpm-workspace.yaml` - Add new packages

---

## v13 Compliance Checklist

- [X] **8.1-8.2 Memory Types:** Semantic, Episodic, Procedural, Relational (MVP)
- [X] **8.3 Agent-Driven Memory:** Memory tools for agents (natural language, not schemas)
- [X] **8.4.1 Base Memory Structure:** Memory interface with bi-temporal, strength, provenance
- [X] **8.4.2 Episodic Memory Structure:** Episode interface with situation/reasoning/action/outcome
- [X] **8.4.3 Procedural Memory Structure:** ProceduralRule with evidence and confidence
- [X] **8.4.4 Relational Memory (MVP):** Entity and Relationship interfaces in Store namespaces
- [X] **8.4.5 Entity Extraction Pipeline:** LLM-based entity extraction during Reflection
- [X] **8.5 Vector Embeddings:** Local nomic-embed-text-v1.5 via @xenova/transformers
- [X] **8.6 Bi-Temporal Modeling:** valid_at/invalid_at/created_at tracking
- [X] **8.7 Memory Retrieval:** Hybrid (Semantic + BM25 + Entity) + RRF + Final Scoring
- [X] **8.8.1 Memory Tools:** save_observation, save_episode, search_memories, invalidate_memory
- [X] **8.8.2 Automatic Context Injection:** buildAgentContext, formatContextForPrompt
- [X] **8.9.1 Consolidation:** Merge similar memories with LLM
- [X] **8.9.2 Decay:** 5%/week (DECAY_RATE=0.95)
- [X] **8.9.3 Pruning:** Archive below threshold (PRUNE_THRESHOLD=0.1)
- [X] **8.9.4 Community Summaries:** LLM-generated summaries per domain
- [X] **8.10 Reflection Node:** Full orchestrator with 6 phases
- [X] **8.10.1 Procedural Rule Synthesis:** Episode pattern analysis with confidence >= 0.7
- [X] **8.11 Privacy Tiers:** public/sensitive/private with cross-agent access control
- [X] **8.15 Memory Size Limits:** Quota checks and archival strategy
- [X] **8.16 Concrete Example:** Learning loop integration test validates Paris→Rome→Tokyo flow
- [X] **3.6.1 Content Agent:** L1 content recommendation agent with tools
- [X] **3.6.5 Privacy-Tier Enforcement:** Enhanced PrivacyGuard with tier checks

---

## What Comes After Sprint 4?

After Sprint 4, you'll have:

- Memory system that learns from feedback
- Reflection Node that synthesizes behavioral rules
- Two agents (Shopping + Content) proving framework scales
- Privacy tier enforcement for cross-agent memory access

**Sprint 5: Resilience + Trigger System**

- Circuit breakers for external APIs
- LLM fallback chain implementation
- 4-mode trigger system (Data/Schedule/Event/User)
- Agent Coordinator for routing

This builds production-grade error handling before adding more agents.

---

## Implementation Plan Summary

### Phase 1: Memory Infrastructure (Week 1)

| Task                             | Acceptance                     |
| -------------------------------- | ------------------------------ |
| @xenova/transformers integration | Embeddings computed locally    |
| Memory tools                     | save/search/invalidate working |
| Hybrid retrieval                 | Semantic + BM25 + RRF combined |
| Lifecycle management             | Decay/prune/archive working    |

### Phase 2: Reflection Node (Week 2)

| Task                    | Acceptance                         |
| ----------------------- | ---------------------------------- |
| Reflection orchestrator | Runs on triggers                   |
| Procedural synthesis    | Rules extracted from episodes      |
| Trigger system          | Episode-based, time-based triggers |
| Context injection       | Rules in agent prompts             |

### Phase 3: Content Agent + Integration (Week 3)

| Task                   | Acceptance                        |
| ---------------------- | --------------------------------- |
| Content Agent          | L1 agent generating missions      |
| Privacy enforcement    | Tier-based access control         |
| Learning demonstration | Shopping Agent uses learned rules |
| End-to-end test        | Full loop validated               |

---

**Document Status:** Sprint 4 Technical Specification v1.0
**Previous Sprint:** Sprint 3 (Shopping Agent + Mission UI)
**Architecture Reference:** v13 Sections 3.6.1, 3.6.5, 8.3-8.15
