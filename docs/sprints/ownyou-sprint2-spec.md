# Sprint 2: LLM Client Consolidation

**Duration:** 2 weeks
**Goal:** Unified LLM client with budget management, fallback chains, caching, and WebLLM support
**Success Criteria:** Single `@ownyou/llm-client` used by IAB classifier with working fallback chain and cache
**Depends On:** Sprint 1b complete

---

## Previous Sprints Summary

### Sprint 0: Foundation (COMPLETED)

| Package | Description | Tests |
|---------|-------------|-------|
| `@ownyou/shared-types` | v13 type definitions | 91 |
| `@ownyou/memory-store` | LangGraph Store with IndexedDB backend | 87 |
| `@ownyou/llm-client` | Abstract interface with budget management (skeleton) | 39 |
| `@ownyou/observability` | Agent traces, cost metering | 17 |
| `@ownyou/integration-tests` | Sprint 0 validation | 7 |

### Sprint 1a: Desktop Infrastructure (COMPLETED)

- Tauri scaffold with React frontend
- SQLite backend (sql.js WebAssembly)
- Custom `ownyou://` protocol

### Sprint 1b: OAuth + Email + IAB Migration (COMPLETED)

| Package | Description | Tests |
|---------|-------------|-------|
| `@ownyou/oauth` | Unified OAuth (Microsoft + Google) | 46 |
| `@ownyou/iab-classifier` | IAB classification workflow | 5 |
| `@ownyou/email` | Email fetch + classification pipeline | 35 |

---

## Problem Statement

OwnYou has two parallel LLM implementations:

1. **`@ownyou/iab-classifier/llm/`** (7,831 lines)
   - 6 provider implementations (OpenAI, Claude, Google, Groq, DeepInfra, Ollama)
   - Full retry logic, JSON parsing, context window management
   - Currently used by: iab-classifier workflow, admin-dashboard

2. **`@ownyou/llm-client`** (1,600 lines)
   - Abstract `LLMProvider` interface
   - Budget management, throttling, circuit breaker
   - Currently used by: nothing (only MockLLMProvider exists)

**This sprint consolidates into a single `@ownyou/llm-client` package.**

---

## v13 Architecture Requirements (Section 6.10-6.11)

### LLM Consumers

| Consumer | Operation Type | Max Input | Max Output | Model Tier |
|----------|---------------|-----------|------------|------------|
| IAB Classification | `iab_classification` | 2,000 | 500 | fast |
| Mission Agents (6) | `mission_agent` | 3,000 | 1,500 | standard |
| Ikigai Inference | `ikigai_inference` | 4,000 | 2,000 | standard |
| Reflection Node | `reflection_node` | 8,000 | 2,000 | standard |
| Embeddings | `embedding_generation` | 8,000 | 0 | fast |

### Budget Policy

- Target: <$10/user/month
- 50%: log warning
- 80%: downgrade model tier
- 95%: defer non-urgent
- 100%: WebLLM/local only

### Fallback Chain (Section 6.11.3)

1. Original request
2. Retry same model
3. Downgrade to cheaper model
4. Try alternative provider (OpenAI → Anthropic)
5. **Check cache** (NEW)
6. Use local LLM (WebLLM)

---

## Sprint 2 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SPRINT 2 END STATE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Any LLM consumer: IAB, Mission Agents, Ikigai]                │
│       ↓                                                          │
│  [LLMClient.completeWithFallback()]                             │
│       ↓                                                          │
│  [1. Check cache → 2. Budget check → 3. Execute fallback chain] │
│       ↓                                                          │
│  [Provider: OpenAI | Anthropic | Google | Groq | DeepInfra |    │
│   Ollama | WebLLM]                                              │
│       ↓                                                          │
│  [Response cached, budget tracked, trace recorded]               │
│                                                                  │
│  iab-classifier migrated to use @ownyou/llm-client              │
│  ~4,000 lines removed from iab-classifier                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deliverables

| # | Deliverable | Priority | Acceptance Criteria |
|---|-------------|----------|---------------------|
| 1 | Real providers | P0 | OpenAI, Anthropic, Google, Groq, DeepInfra, Ollama |
| 2 | WebLLM provider | P0 | Local browser inference for 100% budget fallback |
| 3 | Response cache | P0 | Cache with TTL by operation type, LRU eviction |
| 4 | Fallback chain | P0 | v13 6.11.3 fallback chain implementation |
| 5 | IAB migration | P0 | iab-classifier uses @ownyou/llm-client |
| 6 | Provider tests | P1 | Each provider with mocked HTTP |
| 7 | Budget tests | P1 | Throttling at 50%/80%/95%/100% |
| 8 | Cache tests | P1 | TTL, eviction, invalidation |

---

## Package Structure

### @ownyou/llm-client (Enhanced)

```
packages/llm-client/src/
├── index.ts                    # MODIFIED: Export all
├── cache.ts                    # NEW: LLMCache class
├── cache.test.ts               # NEW: Cache tests
├── providers/
│   ├── index.ts                # NEW: Provider exports
│   ├── base.ts                 # NEW: Shared logging, validation
│   ├── registry.ts             # NEW: Model context windows, pricing
│   ├── client.ts               # MODIFIED: Add fallback chain + cache
│   ├── types.ts                # MODIFIED: Add OperationType enum
│   ├── openai.ts               # NEW: Extract from iab-classifier
│   ├── anthropic.ts            # NEW: Extract from iab-classifier
│   ├── google.ts               # NEW: Extract from iab-classifier
│   ├── groq.ts                 # NEW: Extract from iab-classifier
│   ├── deepinfra.ts            # NEW: Extract from iab-classifier
│   ├── ollama.ts               # NEW: Extract from iab-classifier
│   └── webllm.ts               # NEW: Local browser inference
└── __tests__/
    ├── providers.test.ts       # NEW: Provider tests
    ├── fallback.test.ts        # NEW: Fallback chain tests
    └── cache.test.ts           # NEW: Cache tests
```

### @ownyou/iab-classifier (Simplified)

```
packages/iab-classifier/src/llm/
├── client.ts                   # SIMPLIFIED: Thin adapter (~150 lines, was 556)
├── prompts.ts                  # KEEP: IAB classification prompts
├── evidenceJudge.ts            # KEEP: LLM-as-Judge
├── taxonomyContext.ts          # KEEP: IAB taxonomy formatting
│
├── openaiClient.ts             # DELETE
├── claudeClient.ts             # DELETE
├── googleClient.ts             # DELETE
├── groqClient.ts               # DELETE
├── deepinfraClient.ts          # DELETE
├── ollamaClient.ts             # DELETE
├── base.ts                     # DELETE (moved to llm-client)
├── modelRegistry.ts            # DELETE (moved to llm-client)
└── types.ts                    # DELETE (moved to llm-client)
```

---

## Technical Specifications

### 1. Provider Interface

```typescript
// packages/llm-client/src/providers/types.ts

export type OperationType =
  | 'iab_classification'
  | 'mission_agent'
  | 'ikigai_inference'
  | 'reflection_node'
  | 'embedding_generation';

export interface LLMRequest {
  messages: ChatMessage[];
  operation: OperationType;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  fromCache?: boolean;
}

export interface LLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
  getSupportedModels(): string[];
  isAvailable(): Promise<boolean>;
}
```

### 2. LLMClient with Fallback Chain

```typescript
// packages/llm-client/src/providers/client.ts

import { STORE_NAMESPACES } from '@ownyou/shared-types';

export class LLMClient {
  private providers: Map<string, LLMProvider>;
  private fallbackOrder: string[];  // ['openai', 'anthropic', 'groq', 'webllm']
  private cache: LLMCache;
  private budgetManager: BudgetManager;

  async completeWithFallback(
    userId: string,
    request: ClientRequest
  ): Promise<LLMResponse> {
    // 1. Check cache FIRST (before any provider calls)
    const cached = await this.cache.get(userId, request);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    // 2. Check budget
    const decision = await this.budgetManager.getThrottleDecision(userId);

    // 3. Build fallback chain based on budget
    const chain = this.buildFallbackChain(request, decision);

    // 4. Execute with retries and fallback
    for (const step of chain) {
      try {
        const response = await this.executeWithRetry(step);
        await this.budgetManager.trackUsage(userId, response.usage);

        // 5. Cache successful response
        await this.cache.set(userId, request, response);

        return response;
      } catch (error) {
        // Continue to next fallback
      }
    }

    // 6. Graceful degradation (WebLLM)
    return this.gracefulDegradation(request);
  }
}
```

### 3. Response Cache (v13 Compliant)

**Namespace (Section 8.12):**

```typescript
// Add to packages/shared-types/src/namespaces.ts
const STORE_NAMESPACES = {
  // ... existing namespaces ...

  // === LLM CACHE (v13 6.11.3 - Fallback Chain Step 5) ===
  llm_cache: (userId: string) => ["ownyou.llm_cache", userId],
} as const;
```

**Cache Key Strategy:**

```typescript
function generateCacheKey(request: LLMRequest): string {
  const payload = JSON.stringify({
    operation: request.operation,
    model: request.model,
    messages: request.messages,
    temperature: request.temperature || 0,
  });
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
    .then(hash => Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join(''));
}
```

**TTL by Operation:**

| Operation | TTL | Rationale |
|-----------|-----|-----------|
| `iab_classification` | 30 days | Email → IAB mapping is stable |
| `mission_agent` | 1 hour | Missions depend on current context |
| `ikigai_inference` | 7 days | User ikigai changes slowly |
| `reflection_node` | 24 hours | Daily reflection context |
| `embedding_generation` | 90 days | Same text = same embeddings |

**Size Limits:**

- Maximum entries: 1,000 per user
- Maximum size: 50 MB per user
- Eviction policy: LRU (Least Recently Used)

**Cache Implementation:**

```typescript
// packages/llm-client/src/cache.ts

import { STORE_NAMESPACES } from '@ownyou/shared-types';

export class LLMCache {
  constructor(private store: BaseStore, private config: CacheConfig) {}

  async get(userId: string, request: LLMRequest): Promise<LLMResponse | null> {
    const key = await generateCacheKey(request);
    const namespace = STORE_NAMESPACES.llm_cache(userId);
    const entry = await this.store.get(namespace, key);

    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      await this.delete(userId, key);
      return null;
    }

    entry.hitCount++;
    await this.store.put(namespace, key, entry);
    return entry.response;
  }

  async set(userId: string, request: LLMRequest, response: LLMResponse): Promise<void> {
    // Skip caching high-temperature responses
    if ((request.temperature || 0) > 0.5) return;

    const key = await generateCacheKey(request);
    const ttl = TTL_BY_OPERATION[request.operation];
    const namespace = STORE_NAMESPACES.llm_cache(userId);

    await this.enforceSize(userId);

    const entry: CacheEntry = {
      key,
      response,
      operation: request.operation,
      model: request.model,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      hitCount: 0,
      sizeBytes: JSON.stringify(response).length,
    };

    await this.store.put(namespace, key, entry);
  }
}
```

### 4. IAB Classifier Migration

**Thin Adapter Pattern:**

```typescript
// packages/iab-classifier/src/llm/client.ts (SIMPLIFIED)

import { LLMClient, OpenAIProvider } from '@ownyou/llm-client';

export class AnalyzerLLMClient {
  private client: LLMClient;

  constructor(params: { provider?: string; llm_config?: any; userId: string }) {
    const provider = this.createProvider(params.provider, params.llm_config);
    this.client = new LLMClient({
      provider,
      budgetConfig: { monthlyBudgetUsd: 10 },
    });
  }

  // KEEP domain-specific method signature
  async analyze_email(params: { prompt: string }): Promise<{ classifications: any[] }> {
    const response = await this.client.complete(this.userId, {
      messages: [{ role: 'user', content: params.prompt }],
      operation: 'iab_classification',
    });
    return this._parseJsonResponse(response.content);
  }

  // KEEP JSON parsing with recovery logic
  private _parseJsonResponse(content: string): { classifications: any[] } { ... }
}
```

### 5. WebLLM Provider

```typescript
// packages/llm-client/src/providers/webllm.ts

import * as webllm from '@anthropic-ai/webllm';

export class WebLLMProvider implements LLMProvider {
  private engine: webllm.MLCEngine | null = null;
  private modelId = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

  async initialize(): Promise<void> {
    this.engine = await webllm.CreateMLCEngine(this.modelId, {
      initProgressCallback: (progress) => {
        console.log(`WebLLM loading: ${(progress.progress * 100).toFixed(0)}%`);
      },
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.engine) {
      await this.initialize();
    }

    const completion = await this.engine!.chat.completions.create({
      messages: request.messages,
      max_tokens: request.maxTokens || 500,
      temperature: request.temperature || 0.1,
    });

    return {
      content: completion.choices[0].message.content || '',
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      model: this.modelId,
    };
  }

  getSupportedModels(): string[] {
    return [this.modelId];
  }

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'gpu' in navigator;
  }
}
```

---

## Implementation Tasks

### Week 1: Providers + Cache

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | Extract providers | OpenAI, Anthropic, Google from iab-classifier |
| 3-4 | Add remaining providers | Groq, DeepInfra, Ollama |
| 5 | WebLLM provider | Local browser inference |
| 6-7 | Response cache | LLMCache with TTL, LRU eviction |

### Week 2: Fallback + Migration

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 8-9 | Fallback chain | Full v13 6.11.3 implementation |
| 10-11 | IAB migration | Thin adapter, delete old files |
| 12-13 | Testing | Provider, cache, fallback tests |
| 14 | Integration | admin-dashboard using new llm-client |

---

## Testing Strategy

### Provider Tests

```typescript
describe('OpenAIProvider', () => {
  it('should complete chat request', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test' });
    const response = await provider.complete({
      messages: [{ role: 'user', content: 'Hello' }],
      operation: 'iab_classification',
    });
    expect(response.content).toBeDefined();
  });

  it('should handle rate limits with retry', async () => { ... });
  it('should track token usage', async () => { ... });
});
```

### Cache Tests

```typescript
describe('LLMCache', () => {
  it('should return cached response on hit', async () => { ... });
  it('should return null on miss', async () => { ... });
  it('should expire entries based on TTL', async () => { ... });
  it('should evict LRU entries when full', async () => { ... });
  it('should not cache high-temperature responses', async () => { ... });
  it('should use different keys for different operations', async () => { ... });
});
```

### Fallback Tests

```typescript
describe('LLMClient.completeWithFallback', () => {
  it('should try primary provider first', async () => { ... });
  it('should fall back to next provider on failure', async () => { ... });
  it('should downgrade model at 80% budget', async () => { ... });
  it('should fall back to WebLLM at 100% budget', async () => { ... });
  it('should return cached response if available', async () => { ... });
});
```

### Budget Tests

```typescript
describe('BudgetManager', () => {
  it('should log warning at 50%', async () => { ... });
  it('should downgrade model tier at 80%', async () => { ... });
  it('should defer non-urgent at 95%', async () => { ... });
  it('should force WebLLM at 100%', async () => { ... });
});
```

---

## Success Criteria

- [ ] All 7 providers implemented (OpenAI, Anthropic, Google, Groq, DeepInfra, Ollama, WebLLM)
- [ ] Response cache working with TTL by operation
- [ ] Fallback chain executes per v13 6.11.3
- [ ] Budget enforcement at 50%/80%/95%/100%
- [ ] IAB classifier using @ownyou/llm-client
- [ ] ~4,000 lines removed from iab-classifier
- [ ] admin-dashboard still working
- [ ] All tests passing
- [ ] Code committed and pushed

---

## Migration Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking admin-dashboard | Keep `AnalyzerLLMClient` API unchanged |
| Breaking classification | Comprehensive tests before/after |
| Budget blocking real users | Default $10/month (generous) |
| Provider behavior change | Same SDK calls, just wrapped |
| WebLLM not available | Check `navigator.gpu`, graceful fallback |

---

## Files to Modify

### New Files

- `packages/llm-client/src/cache.ts`
- `packages/llm-client/src/providers/openai.ts`
- `packages/llm-client/src/providers/anthropic.ts`
- `packages/llm-client/src/providers/google.ts`
- `packages/llm-client/src/providers/groq.ts`
- `packages/llm-client/src/providers/deepinfra.ts`
- `packages/llm-client/src/providers/ollama.ts`
- `packages/llm-client/src/providers/webllm.ts`
- `packages/llm-client/src/providers/base.ts`
- `packages/llm-client/src/providers/registry.ts`
- `packages/shared-types/src/namespaces.ts` (add `llm_cache`)

### Modified Files

- `packages/llm-client/src/providers/client.ts` - Add fallback + cache
- `packages/llm-client/src/providers/types.ts` - Add OperationType
- `packages/llm-client/src/index.ts` - Export all
- `packages/iab-classifier/src/llm/client.ts` - Thin adapter

### Deleted Files

- `packages/iab-classifier/src/llm/openaiClient.ts`
- `packages/iab-classifier/src/llm/claudeClient.ts`
- `packages/iab-classifier/src/llm/googleClient.ts`
- `packages/iab-classifier/src/llm/groqClient.ts`
- `packages/iab-classifier/src/llm/deepinfraClient.ts`
- `packages/iab-classifier/src/llm/ollamaClient.ts`
- `packages/iab-classifier/src/llm/base.ts`
- `packages/iab-classifier/src/llm/modelRegistry.ts`
- `packages/iab-classifier/src/llm/types.ts`

---

## V13 Compliance Checklist

- [x] **Store API**: Uses `put()`/`get()` via LangGraph Store
- [x] **Namespace**: Uses `STORE_NAMESPACES.llm_cache(userId)` factory
- [x] **Memory Types**: Cache entries are operational data (appropriate structure)
- [x] **Privacy Tier**: Stores derived LLM responses, not raw PII
- [x] **Self-Sovereign**: All data stays local
- [x] **No Separate DBs**: Single Store with namespace separation

---

## Architecture References

- **v13 Section 6.10:** LLM Cost Management
- **v13 Section 6.11:** LLM Fallback Chain
- **v13 Section 8.12:** Namespace Schema
- **v13 Section 8.13:** Storage Backends

---

**Document Status:** Sprint 2 Technical Specification v1.0
**Parent Document:** Strategic Roadmap
**Previous Sprint:** Sprint 1b (OAuth + Email + IAB Migration)
