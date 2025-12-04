# Sprint 3: First Agent Vertical (Shopping Agent + Mission UI)

**Duration:** 3 weeks
**Goal:** Build agent framework + first complete agent + mission card UI with feedback loop
**Success Criteria:** Shopping Agent detects purchase intent from IAB data, generates mission cards, user provides feedback, episodes recorded
**Depends On:** Sprint 2 complete (LLM Client Consolidation)

---

## Previous Sprints Summary

### Sprint 0: Foundation (COMPLETED)

| Package | Description | Tests |
|---------|-------------|-------|
| `@ownyou/shared-types` | v13 type definitions (Memory, Episode, Entity, Ikigai, Agent, Identity, Namespaces) | 91 |
| `@ownyou/memory-store` | LangGraph Store-compatible interface with IndexedDB + SQLite backends, hybrid search | 87 |
| `@ownyou/llm-client` | Abstract interface with budget management (skeleton) | 39 |
| `@ownyou/observability` | Agent traces (10.2), cost metering, memory operation tracking | 17 |
| `@ownyou/integration-tests` | Sprint 0 success criteria validation | 7 |

**Total:** 241 tests

### Sprint 1a: Desktop Infrastructure (COMPLETED)

| Deliverable | Status |
|-------------|--------|
| Tauri scaffold | ✅ `apps/desktop/` with React frontend |
| SQLite backend | ✅ sql.js (WebAssembly) cross-platform |
| Custom protocol | ✅ `ownyou://` deep links working |

### Sprint 1b: OAuth + Email + IAB Migration (COMPLETED)

| Package | Description | Tests |
|---------|-------------|-------|
| `@ownyou/oauth` | Unified OAuth (Microsoft + Google, browser + desktop) | 46 |
| `@ownyou/iab-classifier` | IAB classification workflow | 5 |
| `@ownyou/email` | Email fetch + classification pipeline | 35 |

### Sprint 2: LLM Client Consolidation (COMPLETED)

| Deliverable | Status |
|-------------|--------|
| Real providers | ✅ OpenAI, Anthropic, Google, Groq, DeepInfra, Ollama |
| WebLLM provider | ✅ Local browser inference for 100% budget fallback |
| Response cache | ✅ LLMCache with TTL by operation, LRU eviction |
| Fallback chain | ✅ v13 6.11.3 implementation |
| IAB migration | ✅ iab-classifier uses @ownyou/llm-client |

**Current State:**
- Email data flows through: OAuth → Fetch → IAB Classify → Memory Store
- LLM infrastructure complete with 7 providers + fallback + caching
- No agents built yet
- No mission cards
- No user feedback loop

---

## Sprint 3 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SPRINT 3 END STATE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Email classifications in memory-store]                         │
│       ↓                                                          │
│  [Shopping Agent scans for purchase intent patterns]             │
│       ↓                                                          │
│  [Agent uses LLM to generate personalized recommendation]        │
│       ↓                                                          │
│  [Mission Card stored + displayed in UI]                         │
│       ↓                                                          │
│  [User provides feedback: ❤️ 👍 😐]                              │
│       ↓                                                          │
│  [Episode recorded for future learning]                          │
│                                                                  │
│  FIRST COMPLETE AGENT LOOP WORKING                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## v13 Architecture References

| Section | Requirement | Sprint 3 Implementation |
|---------|-------------|------------------------|
| **3.6.1** | Agent Types | Shopping Agent definition |
| **3.6.2** | Agent Permissions | PrivacyGuard enforcement |
| **3.6.3** | Agent Levels (L1/L2/L3) | LimitsEnforcer |
| **3.4** | Mission Cards | MissionCard type + UI |
| **8.4.2** | Episodes | Episode recording from agent runs |
| **8.12** | Namespaces | missions, episodic_memory namespaces |
| **10.2** | Agent Traces | AgentTracer integration |

---

## Deliverables

| # | Deliverable | Priority | Acceptance Criteria |
|---|-------------|----------|---------------------|
| 1 | Agent Framework | P0 | BaseAgent, LimitsEnforcer, PrivacyGuard |
| 2 | Shopping Agent | P0 | Detects purchase intent, generates missions |
| 3 | Mission Card Storage | P0 | Cards stored in `ownyou.missions` namespace |
| 4 | Mission Card UI | P0 | Display cards with actions |
| 5 | User Feedback | P0 | Capture love/like/meh feedback |
| 6 | Episode Recording | P0 | Episodes stored in `ownyou.episodic` |
| 7 | Agent Triggers | P1 | Scheduled + on-demand triggering |
| 8 | Integration Tests | P1 | Full loop tested |

---

## New Packages

```
packages/
├── agents/
│   ├── base/                       # NEW: Shared agent infrastructure
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── base-agent.ts       # Abstract base class
│   │   │   ├── limits-enforcer.ts  # L1/L2/L3 limit checking
│   │   │   ├── privacy-guard.ts    # Namespace access control
│   │   │   ├── tool-executor.ts    # Tool execution with limits
│   │   │   └── types.ts
│   │   ├── __tests__/
│   │   │   ├── limits-enforcer.test.ts
│   │   │   └── privacy-guard.test.ts
│   │   ├── PACKAGE.md
│   │   └── package.json
│   │
│   └── shopping/                   # NEW: Shopping Agent
│       ├── src/
│       │   ├── index.ts
│       │   ├── agent.ts            # ShoppingAgent class
│       │   ├── triggers.ts         # Purchase intent detection
│       │   ├── tools/
│       │   │   ├── search-deals.ts # Mock deal search (no external API)
│       │   │   └── price-check.ts  # Mock price comparison
│       │   └── types.ts
│       ├── __tests__/
│       │   └── agent.test.ts
│       ├── PACKAGE.md
│       └── package.json
│
├── ui-components/                  # NEW: Shared React components
│   ├── src/
│   │   ├── index.ts
│   │   ├── MissionCard.tsx
│   │   ├── MissionFeed.tsx
│   │   ├── FeedbackButtons.tsx
│   │   └── types.ts
│   ├── __tests__/
│   │   └── MissionCard.test.tsx
│   └── package.json
```

---

## Technical Specifications

### 1. Agent Framework

#### 1.1 BaseAgent Abstract Class

```typescript
// packages/agents/base/src/base-agent.ts

import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import type { AgentTracer } from '@ownyou/observability';
import type {
  AgentType,
  AgentLevel,
  AgentPermissions,
  MissionCard,
  Episode,
} from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { LimitsEnforcer } from './limits-enforcer';
import { PrivacyGuard } from './privacy-guard';

export interface AgentContext {
  userId: string;
  tracer: AgentTracer;
}

export interface AgentConfig {
  store: MemoryStore;
  llm: LLMClient;
  userId: string;
}

export interface AgentResult {
  success: boolean;
  mission?: MissionCard | null;
  error?: string;
  trace: AgentTrace;
}

/**
 * BaseAgent - Abstract base class for all OwnYou agents
 *
 * Provides:
 * - Limit enforcement (L1/L2/L3)
 * - Privacy guard (namespace access control)
 * - Memory access with tracking
 * - LLM calls with budget awareness
 * - Episode recording
 * - Trace management
 */
export abstract class BaseAgent<TTrigger = unknown> {
  protected store: MemoryStore;
  protected llm: LLMClient;
  protected userId: string;
  protected limitsEnforcer: LimitsEnforcer;
  protected privacyGuard: PrivacyGuard;

  // Subclasses must define these
  abstract readonly agentType: AgentType;
  abstract readonly level: AgentLevel;
  abstract readonly permissions: AgentPermissions;

  constructor(config: AgentConfig) {
    this.store = config.store;
    this.llm = config.llm;
    this.userId = config.userId;
  }

  /**
   * Main execution entry point
   */
  async run(trigger: TTrigger): Promise<AgentResult> {
    // Initialize enforcement for this run
    this.limitsEnforcer = new LimitsEnforcer(this.level);
    this.privacyGuard = new PrivacyGuard(this.permissions);

    const tracer = new AgentTracer(this.agentType, this.userId);

    try {
      // Reset limits for new run
      this.limitsEnforcer.reset();

      // Execute agent logic
      const mission = await this.execute(trigger, { userId: this.userId, tracer });

      // Store episode if mission was created
      if (mission) {
        await this.recordEpisode(trigger, mission, tracer);
      }

      const trace = tracer.complete();
      await this.storeTrace(trace);

      return {
        success: true,
        mission,
        trace,
      };
    } catch (error) {
      const trace = tracer.fail(error as Error, this.isRecoverable(error));
      await this.storeTrace(trace);

      return {
        success: false,
        error: (error as Error).message,
        trace,
      };
    }
  }

  /**
   * Subclasses implement this - core agent logic
   */
  protected abstract execute(
    trigger: TTrigger,
    context: AgentContext
  ): Promise<MissionCard | null>;

  /**
   * Memory read with privacy enforcement and tracking
   */
  protected async readMemory<T>(
    namespace: readonly string[],
    key: string,
    tracer: AgentTracer
  ): Promise<T | null> {
    const namespaceStr = namespace[0];

    // Privacy check
    if (!this.privacyGuard.canRead(namespaceStr)) {
      throw new PrivacyViolationError(
        `Agent ${this.agentType} cannot read from ${namespaceStr}`
      );
    }

    // Limit check
    if (!this.limitsEnforcer.canReadMemory()) {
      throw new LimitExceededError(
        `Agent ${this.agentType} exceeded memory read limit`
      );
    }

    const start = Date.now();
    const result = await this.store.get<T>(namespace, key);

    this.limitsEnforcer.recordMemoryRead();

    tracer.recordMemoryOp({
      operation: 'read',
      namespace: namespaceStr,
      key,
      resultCount: result ? 1 : 0,
      durationMs: Date.now() - start,
    });

    return result;
  }

  /**
   * Memory write with privacy enforcement and tracking
   */
  protected async writeMemory<T>(
    namespace: readonly string[],
    key: string,
    value: T,
    tracer: AgentTracer
  ): Promise<void> {
    const namespaceStr = namespace[0];

    // Privacy check
    if (!this.privacyGuard.canWrite(namespaceStr)) {
      throw new PrivacyViolationError(
        `Agent ${this.agentType} cannot write to ${namespaceStr}`
      );
    }

    // Limit check
    if (!this.limitsEnforcer.canWriteMemory()) {
      throw new LimitExceededError(
        `Agent ${this.agentType} exceeded memory write limit`
      );
    }

    const start = Date.now();
    await this.store.put(namespace, key, value);

    this.limitsEnforcer.recordMemoryWrite();

    tracer.recordMemoryOp({
      operation: 'write',
      namespace: namespaceStr,
      key,
      durationMs: Date.now() - start,
    });
  }

  /**
   * Memory search with privacy enforcement
   */
  protected async searchMemory<T>(
    namespace: readonly string[],
    query: string,
    limit: number,
    tracer: AgentTracer
  ): Promise<T[]> {
    const namespaceStr = namespace[0];

    if (!this.privacyGuard.canSearch(namespaceStr)) {
      throw new PrivacyViolationError(
        `Agent ${this.agentType} cannot search ${namespaceStr}`
      );
    }

    const start = Date.now();
    const results = await this.store.search<T>({
      namespace,
      query,
      limit,
    });

    tracer.recordMemoryOp({
      operation: 'search',
      namespace: namespaceStr,
      query,
      resultCount: results.length,
      durationMs: Date.now() - start,
    });

    return results.map((r) => r.item);
  }

  /**
   * LLM call with limits enforcement
   */
  protected async callLLM(
    messages: ChatMessage[],
    options: LLMCallOptions,
    tracer: AgentTracer
  ): Promise<string> {
    // Check limits
    if (!this.limitsEnforcer.canMakeLLMCall()) {
      throw new LimitExceededError(
        `Agent ${this.agentType} exceeded LLM call limit (${this.limitsEnforcer.limits.maxLlmCalls})`
      );
    }

    const start = Date.now();
    const response = await this.llm.completeWithFallback(this.userId, {
      messages,
      operation: options.operation ?? this.agentType,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    this.limitsEnforcer.recordLLMCall();

    tracer.recordLLMCall({
      model: response.model,
      prompt: messages[messages.length - 1].content.slice(0, 200),
      response: response.content.slice(0, 200),
      tokens: {
        input: response.usage.promptTokens,
        output: response.usage.completionTokens,
      },
      costUsd: this.estimateCost(response),
      durationMs: Date.now() - start,
      fromCache: response.fromCache ?? false,
    });

    return response.content;
  }

  /**
   * Tool execution with limits enforcement
   */
  protected async executeTool<T>(
    toolName: string,
    args: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<T>,
    tracer: AgentTracer
  ): Promise<T> {
    // Check limits
    if (!this.limitsEnforcer.canMakeToolCall()) {
      throw new LimitExceededError(
        `Agent ${this.agentType} exceeded tool call limit (${this.limitsEnforcer.limits.maxToolCalls})`
      );
    }

    const start = Date.now();

    try {
      const result = await handler(args);

      this.limitsEnforcer.recordToolCall();

      tracer.recordToolCall({
        name: toolName,
        args,
        result,
        success: true,
        durationMs: Date.now() - start,
      });

      return result;
    } catch (error) {
      this.limitsEnforcer.recordToolCall();

      tracer.recordToolCall({
        name: toolName,
        args,
        result: null,
        success: false,
        error: (error as Error).message,
        durationMs: Date.now() - start,
      });

      throw error;
    }
  }

  /**
   * Record episode for future learning
   */
  private async recordEpisode(
    trigger: TTrigger,
    mission: MissionCard,
    tracer: AgentTracer
  ): Promise<void> {
    const episode: Episode = {
      id: crypto.randomUUID(),
      situation: this.describeTrigger(trigger),
      reasoning: this.extractReasoning(tracer),
      action: mission.summary,
      outcome: 'pending', // Updated when user provides feedback
      agentType: this.agentType,
      missionId: mission.id,
      timestamp: Date.now(),
      tags: this.extractTags(trigger, mission),
    };

    await this.store.put(
      NS.episodicMemory(this.userId),
      episode.id,
      episode
    );

    tracer.recordMemoryOp({
      operation: 'write',
      namespace: 'ownyou.episodic',
      key: episode.id,
      durationMs: 5,
    });
  }

  /**
   * Store trace for observability
   */
  private async storeTrace(trace: AgentTrace): Promise<void> {
    await this.store.put(
      NS.agentTraces(this.userId),
      trace.traceId,
      trace
    );
  }

  // Subclasses can override these for customization
  protected describeTrigger(trigger: TTrigger): string {
    return JSON.stringify(trigger).slice(0, 500);
  }

  protected extractReasoning(tracer: AgentTracer): string {
    const trace = tracer.getTrace();
    const llmSteps = trace.steps.filter((s) => s.stepType === 'llm_call');
    return llmSteps.map((s) => s.llm?.responsePreview).join(' → ');
  }

  protected extractTags(trigger: TTrigger, mission: MissionCard): string[] {
    return [this.agentType, mission.urgency];
  }

  protected isRecoverable(error: unknown): boolean {
    return error instanceof LimitExceededError;
  }

  private estimateCost(response: LLMResponse): number {
    // Rough estimate - actual cost tracked by llm-client
    const inputCost = (response.usage.promptTokens / 1000) * 0.0001;
    const outputCost = (response.usage.completionTokens / 1000) * 0.0002;
    return inputCost + outputCost;
  }
}

export interface LLMCallOptions {
  operation?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class PrivacyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrivacyViolationError';
  }
}

export class LimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimitExceededError';
  }
}
```

#### 1.2 Limits Enforcer

```typescript
// packages/agents/base/src/limits-enforcer.ts

import type { AgentLevel, AgentLimits } from '@ownyou/shared-types';
import { AGENT_LIMITS } from '@ownyou/shared-types';

/**
 * LimitsEnforcer - Enforces L1/L2/L3 agent limits per v13 Section 3.6.3
 *
 * L1: Simple tasks (3 tool calls, 2 LLM calls, 30s timeout)
 * L2: Complex tasks (10 tool calls, 5 LLM calls, 120s timeout)
 * L3: Multi-step planning (25 tool calls, 10 LLM calls, 300s timeout)
 */
export class LimitsEnforcer {
  readonly limits: AgentLimits;

  private toolCallCount = 0;
  private llmCallCount = 0;
  private memoryReadCount = 0;
  private memoryWriteCount = 0;
  private startTime = 0;

  constructor(level: AgentLevel) {
    this.limits = AGENT_LIMITS[level];
  }

  reset(): void {
    this.toolCallCount = 0;
    this.llmCallCount = 0;
    this.memoryReadCount = 0;
    this.memoryWriteCount = 0;
    this.startTime = Date.now();
  }

  // Check methods
  canMakeToolCall(): boolean {
    return this.toolCallCount < this.limits.maxToolCalls && !this.isTimedOut();
  }

  canMakeLLMCall(): boolean {
    return this.llmCallCount < this.limits.maxLlmCalls && !this.isTimedOut();
  }

  canReadMemory(): boolean {
    return this.memoryReadCount < this.limits.maxMemoryReads && !this.isTimedOut();
  }

  canWriteMemory(): boolean {
    return this.memoryWriteCount < this.limits.maxMemoryWrites && !this.isTimedOut();
  }

  isTimedOut(): boolean {
    return Date.now() - this.startTime > this.limits.timeoutSeconds * 1000;
  }

  // Record methods
  recordToolCall(): void {
    this.toolCallCount++;
  }

  recordLLMCall(): void {
    this.llmCallCount++;
  }

  recordMemoryRead(): void {
    this.memoryReadCount++;
  }

  recordMemoryWrite(): void {
    this.memoryWriteCount++;
  }

  // Status reporting
  getStatus(): LimitsStatus {
    return {
      toolCalls: { used: this.toolCallCount, max: this.limits.maxToolCalls },
      llmCalls: { used: this.llmCallCount, max: this.limits.maxLlmCalls },
      memoryReads: { used: this.memoryReadCount, max: this.limits.maxMemoryReads },
      memoryWrites: { used: this.memoryWriteCount, max: this.limits.maxMemoryWrites },
      elapsedMs: Date.now() - this.startTime,
      timeoutMs: this.limits.timeoutSeconds * 1000,
    };
  }

  getRemainingBudget(): RemainingBudget {
    return {
      toolCalls: this.limits.maxToolCalls - this.toolCallCount,
      llmCalls: this.limits.maxLlmCalls - this.llmCallCount,
      memoryReads: this.limits.maxMemoryReads - this.memoryReadCount,
      memoryWrites: this.limits.maxMemoryWrites - this.memoryWriteCount,
      timeMs: this.limits.timeoutSeconds * 1000 - (Date.now() - this.startTime),
    };
  }
}

export interface LimitsStatus {
  toolCalls: { used: number; max: number };
  llmCalls: { used: number; max: number };
  memoryReads: { used: number; max: number };
  memoryWrites: { used: number; max: number };
  elapsedMs: number;
  timeoutMs: number;
}

export interface RemainingBudget {
  toolCalls: number;
  llmCalls: number;
  memoryReads: number;
  memoryWrites: number;
  timeMs: number;
}
```

#### 1.3 Privacy Guard

```typescript
// packages/agents/base/src/privacy-guard.ts

import type { AgentPermissions } from '@ownyou/shared-types';
import { NAMESPACE_PRIVACY } from '@ownyou/shared-types';

/**
 * PrivacyGuard - Enforces namespace access control per v13 Section 3.6.5
 *
 * Each agent has explicit permissions for:
 * - read: Which namespaces it can read from
 * - write: Which namespaces it can write to
 * - search: Which namespaces it can search
 */
export class PrivacyGuard {
  private permissions: AgentPermissions;

  constructor(permissions: AgentPermissions) {
    this.permissions = permissions;
  }

  canRead(namespace: string): boolean {
    return this.permissions.memoryAccess.read.some(
      (allowed) => namespace.startsWith(allowed) || allowed === '*'
    );
  }

  canWrite(namespace: string): boolean {
    return this.permissions.memoryAccess.write.some(
      (allowed) => namespace.startsWith(allowed) || allowed === '*'
    );
  }

  canSearch(namespace: string): boolean {
    return this.permissions.memoryAccess.search.some(
      (allowed) => namespace.startsWith(allowed) || allowed === '*'
    );
  }

  /**
   * Check if agent can disclose data at a given privacy tier
   * Agents can never disclose private data
   */
  canDisclose(namespace: string): boolean {
    const tier = NAMESPACE_PRIVACY[namespace as keyof typeof NAMESPACE_PRIVACY];
    return tier === 'public';
  }

  /**
   * Validate a set of planned operations before execution
   */
  validateOperations(operations: PlannedOperation[]): ValidationResult {
    const violations: Violation[] = [];

    for (const op of operations) {
      if (op.type === 'read' && !this.canRead(op.namespace!)) {
        violations.push({
          operation: op,
          reason: `Cannot read from ${op.namespace}`,
        });
      }
      if (op.type === 'write' && !this.canWrite(op.namespace!)) {
        violations.push({
          operation: op,
          reason: `Cannot write to ${op.namespace}`,
        });
      }
      if (op.type === 'search' && !this.canSearch(op.namespace!)) {
        violations.push({
          operation: op,
          reason: `Cannot search ${op.namespace}`,
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  getReadableNamespaces(): string[] {
    return [...this.permissions.memoryAccess.read];
  }

  getWritableNamespaces(): string[] {
    return [...this.permissions.memoryAccess.write];
  }
}

export interface PlannedOperation {
  type: 'read' | 'write' | 'search';
  namespace?: string;
}

export interface Violation {
  operation: PlannedOperation;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}
```

---

### 2. Shopping Agent

#### 2.1 Agent Definition

```typescript
// packages/agents/shopping/src/agent.ts

import {
  BaseAgent,
  AgentContext,
  LimitExceededError,
} from '@ownyou/agents-base';
import type {
  AgentType,
  AgentLevel,
  AgentPermissions,
  MissionCard,
  Memory,
} from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { detectPurchaseIntent } from './triggers';
import { searchDeals } from './tools/search-deals';
import { checkPrices } from './tools/price-check';

export interface ShoppingTrigger {
  type: 'scheduled' | 'classification_detected';
  classifications?: IABClassification[];
}

interface PurchaseIntent {
  category: string;
  product?: string;
  priceRange?: { min: number; max: number };
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
}

interface Deal {
  title: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  url: string;
  source: string;
  expiresAt?: number;
}

/**
 * Shopping Agent - L2 Complexity
 *
 * Detects purchase intent from IAB classifications and generates
 * personalized shopping recommendations.
 *
 * v13 Section 3.6.1 - Agent Type: shopping
 * v13 Section 3.6.3 - Level: L2 (10 tool calls, 5 LLM calls, 120s timeout)
 */
export class ShoppingAgent extends BaseAgent<ShoppingTrigger> {
  readonly agentType: AgentType = 'shopping';
  readonly level: AgentLevel = 'L2';

  readonly permissions: AgentPermissions = {
    agentType: 'shopping',
    memoryAccess: {
      read: [
        'ownyou.semantic',
        'ownyou.iab',
        'ownyou.ikigai',
        'ownyou.procedural',
      ],
      write: [
        'ownyou.episodic',
        'ownyou.missions',
      ],
      search: [
        'ownyou.semantic',
        'ownyou.iab',
      ],
    },
    externalApis: [
      // No external APIs in Sprint 3 - using mock tools
    ],
    toolDefinitions: [
      { name: 'search_deals', description: 'Search for deals in a category' },
      { name: 'check_prices', description: 'Compare prices across sources' },
    ],
  };

  protected async execute(
    trigger: ShoppingTrigger,
    context: AgentContext
  ): Promise<MissionCard | null> {
    const { tracer } = context;

    // 1. Get recent IAB classifications
    const classifications = await this.getRecentClassifications(tracer);
    if (classifications.length === 0) {
      return null; // Not enough data
    }

    // 2. Detect purchase intent
    const intents = await this.detectPurchaseIntents(classifications, tracer);
    if (intents.length === 0) {
      return null; // No purchase intent detected
    }

    // 3. Get procedural rules (learned preferences)
    const rules = await this.getProceduralRules(tracer);

    // 4. Find deals for top intent
    const topIntent = intents[0];
    const deals = await this.findDeals(topIntent, rules, tracer);
    if (deals.length === 0) {
      return null; // No deals found
    }

    // 5. Generate mission card
    const mission = await this.generateMission(topIntent, deals, tracer);

    return mission;
  }

  private async getRecentClassifications(
    tracer: AgentTracer
  ): Promise<IABClassification[]> {
    // Search for shopping-related classifications from last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const results = await this.store.list<IABClassification>(
      NS.iabClassifications(this.userId)
    );

    tracer.recordMemoryOp({
      operation: 'read',
      namespace: 'ownyou.iab',
      resultCount: results.items.length,
      durationMs: 10,
    });

    // Filter for shopping-related categories
    const shoppingCategories = [
      'IAB22', // Shopping
      'IAB2',  // Automotive
      'IAB3',  // Business (B2B shopping)
      'IAB10', // Home & Garden
      'IAB18', // Style & Fashion
      'IAB19', // Technology & Computing
    ];

    return results.items.filter((c) => {
      const isRecent = c.created_at > thirtyDaysAgo;
      const isShopping = shoppingCategories.some(
        (cat) => c.tier1_id?.startsWith(cat) || c.tier2_id?.startsWith(cat)
      );
      return isRecent && isShopping;
    });
  }

  private async detectPurchaseIntents(
    classifications: IABClassification[],
    tracer: AgentTracer
  ): Promise<PurchaseIntent[]> {
    // Use LLM to analyze patterns and detect intent
    const response = await this.callLLM(
      [
        {
          role: 'system',
          content: `You analyze email classification patterns to detect purchase intent.
Given IAB classifications, identify likely shopping interests.
Output JSON array: [{ "category": string, "product": string?, "urgency": "low"|"medium"|"high", "confidence": 0-1 }]
Only include intents with confidence > 0.5.`,
        },
        {
          role: 'user',
          content: `Classifications from last 30 days:\n${classifications
            .map((c) => `- ${c.tier1_category} > ${c.tier2_category} (${c.confidence})`)
            .join('\n')}`,
        },
      ],
      { maxTokens: 500, temperature: 0.1 },
      tracer
    );

    try {
      const intents = JSON.parse(response);
      return intents
        .filter((i: PurchaseIntent) => i.confidence > 0.5)
        .sort((a: PurchaseIntent, b: PurchaseIntent) => b.confidence - a.confidence);
    } catch {
      return [];
    }
  }

  private async getProceduralRules(tracer: AgentTracer): Promise<ProceduralRule[]> {
    try {
      const results = await this.store.list<ProceduralRule>(
        NS.proceduralMemory(this.userId, 'shopping')
      );
      return results.items.filter((r) => r.confidence > 0.5);
    } catch {
      return [];
    }
  }

  private async findDeals(
    intent: PurchaseIntent,
    rules: ProceduralRule[],
    tracer: AgentTracer
  ): Promise<Deal[]> {
    // Apply procedural rules to search parameters
    const searchParams = this.applyRules(intent, rules);

    // Use tool to search for deals (mocked in Sprint 3)
    const deals = await this.executeTool(
      'search_deals',
      { category: intent.category, ...searchParams },
      searchDeals,
      tracer
    );

    // If we have budget for more tool calls, check prices
    if (this.limitsEnforcer.canMakeToolCall() && deals.length > 0) {
      try {
        const priceChecked = await this.executeTool(
          'check_prices',
          { products: deals.slice(0, 3) },
          checkPrices,
          tracer
        );
        return priceChecked;
      } catch {
        return deals;
      }
    }

    return deals;
  }

  private applyRules(
    intent: PurchaseIntent,
    rules: ProceduralRule[]
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    for (const rule of rules) {
      // Parse rules and apply to search params
      if (rule.rule.includes('prefer free shipping')) {
        params.freeShipping = true;
      }
      if (rule.rule.includes('avoid marketplace sellers')) {
        params.excludeMarketplace = true;
      }
      if (rule.rule.includes('wait for sales')) {
        params.onSaleOnly = true;
      }
    }

    return params;
  }

  private async generateMission(
    intent: PurchaseIntent,
    deals: Deal[],
    tracer: AgentTracer
  ): Promise<MissionCard> {
    // Use LLM to generate compelling mission card
    const response = await this.callLLM(
      [
        {
          role: 'system',
          content: `Generate a mission card for a shopping recommendation.
Be specific and actionable. Highlight savings if applicable.
Output JSON: { "title": string (max 60 chars), "summary": string (max 200 chars) }`,
        },
        {
          role: 'user',
          content: `Purchase intent: ${intent.category} (${intent.product || 'general'})
Best deals found:
${deals.slice(0, 3).map((d) => `- ${d.title}: $${d.price} (${d.discount || 0}% off)`).join('\n')}`,
        },
      ],
      { maxTokens: 200, temperature: 0.3 },
      tracer
    );

    let title = `Deal Alert: ${intent.category}`;
    let summary = `Found ${deals.length} deals matching your interests`;

    try {
      const parsed = JSON.parse(response);
      title = parsed.title ?? title;
      summary = parsed.summary ?? summary;
    } catch {
      // Use defaults
    }

    const mission: MissionCard = {
      id: crypto.randomUUID(),
      type: 'shopping',
      title,
      summary,
      urgency: intent.urgency,
      status: 'CREATED',
      createdAt: Date.now(),
      expiresAt: deals[0]?.expiresAt,
      ikigaiDimensions: ['interests'],
      ikigaiAlignmentBoost: intent.confidence * 0.3,
      primaryAction: {
        label: 'View Deals',
        type: 'navigate',
        payload: { deals },
      },
      secondaryActions: [
        {
          label: 'Not Interested',
          type: 'confirm',
          payload: { action: 'dismiss' },
        },
        {
          label: 'Remind Later',
          type: 'confirm',
          payload: { action: 'snooze', duration: 24 * 60 * 60 * 1000 },
        },
      ],
      agentThreadId: tracer.getTrace().traceId,
      evidenceRefs: [intent.category],
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

  protected extractTags(trigger: ShoppingTrigger, mission: MissionCard): string[] {
    return ['shopping', mission.urgency, 'deals'];
  }
}
```

#### 2.2 Mock Tools

```typescript
// packages/agents/shopping/src/tools/search-deals.ts

export interface SearchDealsParams {
  category: string;
  freeShipping?: boolean;
  excludeMarketplace?: boolean;
  onSaleOnly?: boolean;
}

export interface Deal {
  title: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  url: string;
  source: string;
  expiresAt?: number;
}

/**
 * Mock deal search tool for Sprint 3
 * In Sprint 4+, this will call real APIs
 */
export async function searchDeals(params: SearchDealsParams): Promise<Deal[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Return mock deals based on category
  const categoryDeals: Record<string, Deal[]> = {
    'Technology & Computing': [
      {
        title: 'Wireless Earbuds - Premium Sound',
        price: 79.99,
        originalPrice: 129.99,
        discount: 38,
        url: 'https://example.com/earbuds',
        source: 'Amazon',
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      {
        title: 'USB-C Hub 7-in-1',
        price: 34.99,
        originalPrice: 49.99,
        discount: 30,
        url: 'https://example.com/hub',
        source: 'Best Buy',
      },
    ],
    'Home & Garden': [
      {
        title: 'Smart LED Light Strip',
        price: 24.99,
        originalPrice: 39.99,
        discount: 37,
        url: 'https://example.com/lights',
        source: 'Amazon',
      },
    ],
    'Style & Fashion': [
      {
        title: 'Casual Sneakers - All Colors',
        price: 59.99,
        originalPrice: 89.99,
        discount: 33,
        url: 'https://example.com/sneakers',
        source: 'Nike',
      },
    ],
  };

  // Find matching deals
  let deals = categoryDeals[params.category] ?? [
    {
      title: `${params.category} Item on Sale`,
      price: 49.99,
      originalPrice: 79.99,
      discount: 37,
      url: 'https://example.com/item',
      source: 'Generic Store',
    },
  ];

  // Apply filters
  if (params.onSaleOnly) {
    deals = deals.filter((d) => d.discount && d.discount > 0);
  }

  if (params.freeShipping) {
    // Mock: assume all deals have free shipping for simplicity
  }

  return deals;
}
```

```typescript
// packages/agents/shopping/src/tools/price-check.ts

import type { Deal } from './search-deals';

export interface PriceCheckParams {
  products: Deal[];
}

/**
 * Mock price comparison tool for Sprint 3
 * In Sprint 4+, this will call real price APIs
 */
export async function checkPrices(params: PriceCheckParams): Promise<Deal[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Mock: Return same deals with slight price variations
  return params.products.map((deal) => ({
    ...deal,
    // Occasionally find better price
    price: Math.random() > 0.7 ? deal.price * 0.95 : deal.price,
  }));
}
```

---

### 3. Mission Card UI

#### 3.1 Mission Card Component

```tsx
// packages/ui-components/src/MissionCard.tsx

import React from 'react';
import type { MissionCard as MissionCardType } from '@ownyou/shared-types';
import { FeedbackButtons } from './FeedbackButtons';

export interface MissionCardProps {
  mission: MissionCardType;
  onAction: (actionType: string, payload: unknown) => void;
  onFeedback: (missionId: string, feedback: 'love' | 'like' | 'meh') => void;
}

export function MissionCard({ mission, onAction, onFeedback }: MissionCardProps) {
  const urgencyColors = {
    low: 'bg-gray-100 border-gray-200',
    medium: 'bg-yellow-50 border-yellow-200',
    high: 'bg-red-50 border-red-200',
  };

  const urgencyBadge = {
    low: 'bg-gray-200 text-gray-700',
    medium: 'bg-yellow-200 text-yellow-800',
    high: 'bg-red-200 text-red-800',
  };

  return (
    <div
      className={`rounded-lg border-2 p-4 ${urgencyColors[mission.urgency]} transition-all hover:shadow-md`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AgentIcon type={mission.type} />
            <span className={`text-xs px-2 py-0.5 rounded-full ${urgencyBadge[mission.urgency]}`}>
              {mission.urgency}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900">{mission.title}</h3>
        </div>
        {mission.expiresAt && (
          <ExpiryBadge expiresAt={mission.expiresAt} />
        )}
      </div>

      {/* Summary */}
      <p className="text-gray-600 text-sm mb-4">{mission.summary}</p>

      {/* Primary Action */}
      <button
        onClick={() => onAction(mission.primaryAction.type, mission.primaryAction.payload)}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors mb-3"
      >
        {mission.primaryAction.label}
      </button>

      {/* Secondary Actions */}
      {mission.secondaryActions && mission.secondaryActions.length > 0 && (
        <div className="flex gap-2 mb-4">
          {mission.secondaryActions.map((action, index) => (
            <button
              key={index}
              onClick={() => onAction(action.type, action.payload)}
              className="flex-1 py-1.5 px-3 text-gray-600 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Feedback */}
      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs text-gray-500 mb-2">How relevant was this?</p>
        <FeedbackButtons
          onFeedback={(feedback) => onFeedback(mission.id, feedback)}
          currentFeedback={mission.userRating ? ratingToFeedback(mission.userRating) : undefined}
        />
      </div>
    </div>
  );
}

function AgentIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    shopping: '🛒',
    travel: '✈️',
    restaurant: '🍽️',
    events: '🎫',
    content: '📚',
  };
  return <span className="text-xl">{icons[type] ?? '🤖'}</span>;
}

function ExpiryBadge({ expiresAt }: { expiresAt: number }) {
  const hoursLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / (60 * 60 * 1000)));
  
  if (hoursLeft < 24) {
    return (
      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
        {hoursLeft}h left
      </span>
    );
  }
  
  const daysLeft = Math.floor(hoursLeft / 24);
  return (
    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
      {daysLeft}d left
    </span>
  );
}

function ratingToFeedback(rating: number): 'love' | 'like' | 'meh' {
  if (rating >= 4) return 'love';
  if (rating >= 3) return 'like';
  return 'meh';
}
```

#### 3.2 Feedback Buttons

```tsx
// packages/ui-components/src/FeedbackButtons.tsx

import React from 'react';

export interface FeedbackButtonsProps {
  onFeedback: (feedback: 'love' | 'like' | 'meh') => void;
  currentFeedback?: 'love' | 'like' | 'meh';
}

export function FeedbackButtons({ onFeedback, currentFeedback }: FeedbackButtonsProps) {
  const buttons = [
    { value: 'love', emoji: '❤️', label: 'Love it' },
    { value: 'like', emoji: '👍', label: 'Helpful' },
    { value: 'meh', emoji: '😐', label: 'Not relevant' },
  ] as const;

  return (
    <div className="flex gap-2">
      {buttons.map(({ value, emoji, label }) => (
        <button
          key={value}
          onClick={() => onFeedback(value)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
            currentFeedback === value
              ? 'bg-blue-100 border-2 border-blue-400 text-blue-700'
              : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
          title={label}
        >
          <span className="text-lg">{emoji}</span>
        </button>
      ))}
    </div>
  );
}
```

#### 3.3 Mission Feed

```tsx
// packages/ui-components/src/MissionFeed.tsx

import React, { useState, useEffect } from 'react';
import type { MissionCard as MissionCardType, MemoryStore } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { MissionCard } from './MissionCard';

export interface MissionFeedProps {
  store: MemoryStore;
  userId: string;
  onMissionAction: (missionId: string, actionType: string, payload: unknown) => void;
}

export function MissionFeed({ store, userId, onMissionAction }: MissionFeedProps) {
  const [missions, setMissions] = useState<MissionCardType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMissions();
  }, [userId]);

  async function loadMissions() {
    setLoading(true);
    try {
      const result = await store.list<MissionCardType>(
        NS.missionCards(userId)
      );
      
      // Sort by urgency and creation date
      const sorted = result.items
        .filter((m) => m.status === 'CREATED' || m.status === 'PRESENTED')
        .sort((a, b) => {
          const urgencyOrder = { high: 0, medium: 1, low: 2 };
          const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
          if (urgencyDiff !== 0) return urgencyDiff;
          return b.createdAt - a.createdAt;
        });
      
      setMissions(sorted);
    } catch (error) {
      console.error('Failed to load missions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(missionId: string, feedback: 'love' | 'like' | 'meh') {
    // Update mission with feedback
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return;

    const userRating = feedback === 'love' ? 5 : feedback === 'like' ? 3 : 1;
    const updatedMission: MissionCardType = {
      ...mission,
      userRating,
      status: 'COMPLETED',
    };

    await store.put(
      NS.missionCards(userId),
      missionId,
      updatedMission
    );

    // Update episode with feedback
    await updateEpisodeWithFeedback(missionId, feedback);

    // Refresh list
    await loadMissions();
  }

  async function updateEpisodeWithFeedback(missionId: string, feedback: 'love' | 'like' | 'meh') {
    // Find episode for this mission
    const episodes = await store.list<Episode>(
      NS.episodicMemory(userId)
    );
    
    const episode = episodes.items.find((e) => e.missionId === missionId);
    if (episode) {
      const updatedEpisode = {
        ...episode,
        userFeedback: feedback,
        outcome: feedback === 'meh' ? 'negative' : 'positive',
      };
      
      await store.put(
        NS.episodicMemory(userId),
        episode.id,
        updatedEpisode
      );
    }
  }

  async function handleAction(missionId: string, actionType: string, payload: unknown) {
    onMissionAction(missionId, actionType, payload);

    // Handle built-in actions
    if (actionType === 'confirm') {
      const action = payload as { action: string; duration?: number };
      
      if (action.action === 'dismiss') {
        const mission = missions.find((m) => m.id === missionId);
        if (mission) {
          await store.put(
            NS.missionCards(userId),
            missionId,
            { ...mission, status: 'DISMISSED' }
          );
          await loadMissions();
        }
      }
      
      if (action.action === 'snooze' && action.duration) {
        const mission = missions.find((m) => m.id === missionId);
        if (mission) {
          await store.put(
            NS.missionCards(userId),
            missionId,
            { ...mission, status: 'SNOOZED', snoozedUntil: Date.now() + action.duration }
          );
          await loadMissions();
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (missions.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p className="text-lg mb-2">No missions yet</p>
        <p className="text-sm">Connect your email to get personalized recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Your Missions</h2>
      {missions.map((mission) => (
        <MissionCard
          key={mission.id}
          mission={mission}
          onAction={(type, payload) => handleAction(mission.id, type, payload)}
          onFeedback={handleFeedback}
        />
      ))}
    </div>
  );
}
```

---

### 4. Agent Scheduler

```typescript
// packages/agents/base/src/scheduler.ts

import type { MemoryStore } from '@ownyou/memory-store';
import type { LLMClient } from '@ownyou/llm-client';
import { ShoppingAgent } from '@ownyou/agents-shopping';

export interface SchedulerConfig {
  store: MemoryStore;
  llm: LLMClient;
  userId: string;
}

export interface ScheduledTask {
  id: string;
  agentType: string;
  schedule: TaskSchedule;
  lastRun?: number;
  nextRun: number;
  enabled: boolean;
}

export type TaskSchedule =
  | { type: 'interval'; intervalMs: number }
  | { type: 'daily'; hour: number };

/**
 * Agent Scheduler - Runs agents on schedule or on-demand
 */
export class AgentScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private config: SchedulerConfig;
  private running = false;

  constructor(config: SchedulerConfig) {
    this.config = config;
    this.initializeDefaultTasks();
  }

  private initializeDefaultTasks(): void {
    // Shopping Agent: Run every 4 hours
    this.registerTask({
      id: 'shopping',
      agentType: 'shopping',
      schedule: { type: 'interval', intervalMs: 4 * 60 * 60 * 1000 },
      enabled: true,
      nextRun: Date.now() + 60 * 1000, // First run in 1 minute
    });
  }

  registerTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task);
    if (this.running && task.enabled) {
      this.scheduleTask(task);
    }
  }

  start(): void {
    this.running = true;
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
    console.log('Agent scheduler started');
  }

  stop(): void {
    this.running = false;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private scheduleTask(task: ScheduledTask): void {
    const delay = Math.max(0, task.nextRun - Date.now());

    const timer = setTimeout(() => {
      this.runTask(task);
    }, delay);

    this.timers.set(task.id, timer);
  }

  private async runTask(task: ScheduledTask): Promise<void> {
    console.log(`Running agent: ${task.agentType}`);

    try {
      const agent = this.createAgent(task.agentType);
      if (agent) {
        await agent.run({ type: 'scheduled' });
      }

      // Update task
      task.lastRun = Date.now();
      task.nextRun = this.calculateNextRun(task.schedule);

      if (this.running && task.enabled) {
        this.scheduleTask(task);
      }
    } catch (error) {
      console.error(`Agent ${task.agentType} failed:`, error);
      // Retry in 5 minutes on failure
      task.nextRun = Date.now() + 5 * 60 * 1000;
      if (this.running && task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  private createAgent(agentType: string): BaseAgent | null {
    switch (agentType) {
      case 'shopping':
        return new ShoppingAgent({
          store: this.config.store,
          llm: this.config.llm,
          userId: this.config.userId,
        });
      default:
        console.warn(`Unknown agent type: ${agentType}`);
        return null;
    }
  }

  private calculateNextRun(schedule: TaskSchedule): number {
    if (schedule.type === 'interval') {
      return Date.now() + schedule.intervalMs;
    }
    if (schedule.type === 'daily') {
      const now = new Date();
      const next = new Date(now);
      next.setHours(schedule.hour, 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }
    return Date.now() + 60 * 60 * 1000; // Default: 1 hour
  }

  // Manual trigger for testing
  async runNow(agentType: string): Promise<AgentResult | null> {
    const agent = this.createAgent(agentType);
    if (agent) {
      return agent.run({ type: 'scheduled' });
    }
    return null;
  }
}
```

---

## Implementation Tasks

### Week 1: Agent Framework

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | BaseAgent class | Abstract base with memory, LLM, tool methods |
| 3 | LimitsEnforcer | L1/L2/L3 limit checking with tests |
| 4 | PrivacyGuard | Namespace access control with tests |
| 5 | Integration | Connect to existing packages |

### Week 2: Shopping Agent

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 6-7 | Agent implementation | ShoppingAgent using BaseAgent |
| 8 | Purchase intent detection | Pattern matching from IAB data |
| 9 | Mock tools | search-deals, price-check |
| 10 | Mission generation | LLM-powered card creation |

### Week 3: UI + Integration

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 11-12 | Mission Card UI | Component + FeedbackButtons |
| 13 | Mission Feed | List view with actions |
| 14 | Agent Scheduler | Scheduled + on-demand running |
| 15 | Integration testing | Full loop working |

---

## Testing Strategy

### Unit Tests

```typescript
// packages/agents/base/src/__tests__/limits-enforcer.test.ts

describe('LimitsEnforcer', () => {
  describe('L2 limits', () => {
    let enforcer: LimitsEnforcer;

    beforeEach(() => {
      enforcer = new LimitsEnforcer('L2');
      enforcer.reset();
    });

    it('should allow up to 10 tool calls', () => {
      for (let i = 0; i < 10; i++) {
        expect(enforcer.canMakeToolCall()).toBe(true);
        enforcer.recordToolCall();
      }
      expect(enforcer.canMakeToolCall()).toBe(false);
    });

    it('should allow up to 5 LLM calls', () => {
      for (let i = 0; i < 5; i++) {
        expect(enforcer.canMakeLLMCall()).toBe(true);
        enforcer.recordLLMCall();
      }
      expect(enforcer.canMakeLLMCall()).toBe(false);
    });

    it('should timeout after 120 seconds', async () => {
      // Mock time
      jest.useFakeTimers();
      enforcer.reset();
      
      expect(enforcer.isTimedOut()).toBe(false);
      
      jest.advanceTimersByTime(120 * 1000 + 1);
      
      expect(enforcer.isTimedOut()).toBe(true);
    });
  });
});
```

```typescript
// packages/agents/base/src/__tests__/privacy-guard.test.ts

describe('PrivacyGuard', () => {
  const shoppingPermissions: AgentPermissions = {
    agentType: 'shopping',
    memoryAccess: {
      read: ['ownyou.semantic', 'ownyou.iab'],
      write: ['ownyou.episodic', 'ownyou.missions'],
      search: ['ownyou.semantic'],
    },
    externalApis: [],
    toolDefinitions: [],
  };

  let guard: PrivacyGuard;

  beforeEach(() => {
    guard = new PrivacyGuard(shoppingPermissions);
  });

  it('should allow reading from permitted namespaces', () => {
    expect(guard.canRead('ownyou.semantic')).toBe(true);
    expect(guard.canRead('ownyou.iab')).toBe(true);
  });

  it('should deny reading from non-permitted namespaces', () => {
    expect(guard.canRead('ownyou.pseudonyms')).toBe(false);
    expect(guard.canRead('ownyou.earnings')).toBe(false);
  });

  it('should allow writing to permitted namespaces', () => {
    expect(guard.canWrite('ownyou.episodic')).toBe(true);
    expect(guard.canWrite('ownyou.missions')).toBe(true);
  });

  it('should deny writing to non-permitted namespaces', () => {
    expect(guard.canWrite('ownyou.semantic')).toBe(false);
    expect(guard.canWrite('ownyou.pseudonyms')).toBe(false);
  });
});
```

### Integration Tests

```typescript
// packages/agents/shopping/src/__tests__/agent.integration.test.ts

describe('ShoppingAgent Integration', () => {
  let store: MemoryStore;
  let llm: LLMClient;
  let agent: ShoppingAgent;
  const userId = 'test-user';

  beforeEach(async () => {
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      defaultSearchLimit: 10,
      enableEmbeddings: false,
    });

    llm = createMockLLMClient();

    agent = new ShoppingAgent({ store, llm, userId });

    // Seed with IAB classifications
    await store.put(
      NS.iabClassifications(userId),
      'class-1',
      {
        id: 'class-1',
        content: 'Classified: Technology',
        context: 'iab_classification',
        tier1_id: 'IAB19',
        tier1_category: 'Technology & Computing',
        tier2_id: 'IAB19-1',
        tier2_category: 'Consumer Electronics',
        confidence: 0.9,
        created_at: Date.now(),
        strength: 1.0,
        privacy_tier: 'sensitive',
      }
    );
  });

  it('should detect purchase intent and create mission', async () => {
    // Mock LLM responses
    llm.setResponses([
      // Purchase intent detection
      JSON.stringify([
        { category: 'Technology & Computing', product: 'headphones', urgency: 'medium', confidence: 0.8 }
      ]),
      // Mission generation
      JSON.stringify({ title: 'Tech Deals for You', summary: 'Found great deals on headphones' }),
    ]);

    const result = await agent.run({ type: 'scheduled' });

    expect(result.success).toBe(true);
    expect(result.mission).not.toBeNull();
    expect(result.mission?.type).toBe('shopping');
    expect(result.mission?.title).toContain('Tech');
  });

  it('should respect L2 limits', async () => {
    const result = await agent.run({ type: 'scheduled' });

    // L2 = max 10 tool calls, 5 LLM calls
    const toolCalls = result.trace.steps.filter((s) => s.stepType === 'tool_call');
    const llmCalls = result.trace.steps.filter((s) => s.stepType === 'llm_call');

    expect(toolCalls.length).toBeLessThanOrEqual(10);
    expect(llmCalls.length).toBeLessThanOrEqual(5);
  });

  it('should record episode after mission creation', async () => {
    await agent.run({ type: 'scheduled' });

    const episodes = await store.list(NS.episodicMemory(userId));
    expect(episodes.items.length).toBeGreaterThan(0);
    expect(episodes.items[0].agentType).toBe('shopping');
  });

  it('should store mission card', async () => {
    const result = await agent.run({ type: 'scheduled' });

    if (result.mission) {
      const stored = await store.get(
        NS.missionCards(userId),
        result.mission.id
      );
      expect(stored).not.toBeNull();
    }
  });
});
```

---

## Success Criteria

> **Status:** See `ownyou-sprint3-status.md` for current implementation status.

### Agent Framework
- [ ] BaseAgent abstract class implemented
- [ ] LimitsEnforcer enforces L1/L2/L3 limits
- [ ] PrivacyGuard blocks unauthorized namespace access
- [ ] Memory operations tracked in traces
- [ ] LLM calls tracked with cost estimation

### Shopping Agent
- [ ] Detects purchase intent from IAB classifications (LLM + rules)
- [ ] Generates relevant mission cards
- [ ] Respects L2 limits (≤10 tools, ≤5 LLM calls, ≤120s)
- [ ] Uses mock tools (no external APIs yet)
- [ ] Records episodes for learning

### Mission UI
- [ ] MissionCard component displays all fields
- [ ] FeedbackButtons capture user response
- [ ] MissionFeed shows sorted list
- [ ] Actions (dismiss, snooze) work
- [ ] Feedback updates episode

### Integration
- [ ] AgentScheduler runs Shopping Agent on schedule
- [ ] Full loop: IAB data → Agent → Mission → Feedback → Episode
- [ ] Admin dashboard shows missions
- [ ] All tests passing

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| No IAB data to work with | Low | High | Seed test data, require email connection first |
| LLM costs high during testing | Medium | Medium | Use mock LLM in tests, cache responses |
| Agent produces irrelevant missions | Medium | Medium | Confidence thresholds, user feedback loop |
| L2 limits too restrictive | Low | Low | Tune limits based on actual usage |
| UI doesn't match UX expectations | Medium | Medium | Iterate based on user feedback |

---

## Files to Create

### New Packages

**@ownyou/agents-base:**
- `packages/agents/base/src/index.ts`
- `packages/agents/base/src/base-agent.ts`
- `packages/agents/base/src/limits-enforcer.ts`
- `packages/agents/base/src/privacy-guard.ts`
- `packages/agents/base/src/__tests__/limits-enforcer.test.ts`
- `packages/agents/base/src/__tests__/privacy-guard.test.ts`
- `packages/agents/base/package.json`

**@ownyou/agents-shopping:**
- `packages/agents/shopping/src/index.ts`
- `packages/agents/shopping/src/agent.ts`
- `packages/agents/shopping/src/triggers.ts`
- `packages/agents/shopping/src/tools/search-deals.ts`
- `packages/agents/shopping/src/tools/price-check.ts`
- `packages/agents/shopping/src/__tests__/agent.test.ts`
- `packages/agents/shopping/package.json`

**@ownyou/ui-components:**
- `packages/ui-components/src/index.ts`
- `packages/ui-components/src/MissionCard.tsx`
- `packages/ui-components/src/MissionFeed.tsx`
- `packages/ui-components/src/FeedbackButtons.tsx`
- `packages/ui-components/package.json`

### Modified Files
- `pnpm-workspace.yaml` - Add new packages
- `apps/desktop/src/App.tsx` - Add MissionFeed

---

## v13 Compliance Checklist

- [x] **Agent Types (3.6.1):** Shopping Agent defined
- [x] **Agent Permissions (3.6.2):** PrivacyGuard enforces access
- [x] **Agent Levels (3.6.3):** LimitsEnforcer implements L1/L2/L3
- [x] **Mission Cards (3.4):** MissionCard type + UI
- [x] **Episodes (8.4.2):** Episode recording from agent runs
- [x] **Namespaces (8.12):** Uses NS factory functions
- [x] **Traces (10.2):** AgentTracer integration
- [x] **Privacy Tiers (8.11):** PrivacyGuard respects tiers

---

## What Comes After Sprint 3?

After Sprint 3, you'll have:
- ✅ Agent framework proven with one agent
- ✅ Shopping Agent producing missions
- ✅ Mission UI with feedback loop
- ✅ Episodes recorded for learning

**Sprint 4 candidates:**

1. **Reflection Node + Memory Intelligence**
   - Memory decay (5%/week)
   - Episode consolidation → procedural rules
   - Pruning weak memories

2. **Content Agent (L1) + Ikigai Inference**
   - Second agent proves framework scales
   - Ikigai profile built from IAB data

3. **Travel Agent (L3) + Calendar Sync**
   - Most complex agent
   - Second data source (calendar)

**Recommended:** Sprint 4 = Reflection Node + Content Agent

This proves:
- Memory learns from feedback
- Agent pattern scales to multiple agents
- System becomes smarter over time

---

## Implementation Plan

### Phase 1: Agent Framework (Week 1)

| Task | Files | Acceptance |
|------|-------|------------|
| Package scaffold | `packages/agents/base/package.json`, `tsconfig.json` | Package builds |
| LimitsEnforcer | `src/limits-enforcer.ts` + tests | L1/L2/L3 limits enforced |
| PrivacyGuard | `src/privacy-guard.ts` + tests | Namespace access controlled |
| ToolExecutor | `src/tool-executor.ts` | Tool calls tracked |
| BaseAgent | `src/base-agent.ts` | Abstract class with memory/LLM/trace |
| Types | `src/types.ts` | AgentResult, AgentContext exported |

### Phase 2: Shopping Agent (Week 2)

| Task | Files | Acceptance |
|------|-------|------------|
| Package scaffold | `packages/agents/shopping/package.json` | Package builds |
| ShoppingAgent | `src/agent.ts` | Extends BaseAgent, L2 level |
| Purchase intent | `src/triggers.ts` | Detects IAB shopping categories |
| Mock tools | `src/tools/search-deals.ts`, `price-check.ts` | Return mock data |
| Mission generation | Agent `execute()` method | LLM generates card |
| Tests | `__tests__/agent.test.ts` | Agent produces mission |

### Phase 3: UI + Integration (Week 3)

| Task | Files | Acceptance |
|------|-------|------------|
| UI package scaffold | `packages/ui-components/package.json` | Package builds |
| MissionCard | `src/MissionCard.tsx` | Displays card data |
| FeedbackButtons | `src/FeedbackButtons.tsx` | Love/like/meh buttons |
| MissionFeed | `src/MissionFeed.tsx` | List of cards |
| Integration | `src/admin-dashboard/app/missions/` | UI displays missions |
| Full loop test | Integration test | Email → Agent → Card → Feedback → Episode |

### Critical Files to Read

Before implementation, review these existing files:

1. `packages/shared-types/src/namespaces.ts` - NS factory functions
2. `packages/shared-types/src/index.ts` - AgentType, AgentLevel, MissionCard types
3. `packages/llm-client/src/index.ts` - LLMClient interface
4. `packages/memory-store/src/index.ts` - MemoryStore interface
5. `packages/observability/src/index.ts` - AgentTracer

### Implementation Order (Dependency Chain)

```
1. @ownyou/agents-base (no deps except existing packages)
   └── types.ts
   └── limits-enforcer.ts + tests
   └── privacy-guard.ts + tests
   └── tool-executor.ts
   └── base-agent.ts
   └── index.ts

2. @ownyou/agents-shopping (depends on base)
   └── types.ts
   └── tools/search-deals.ts
   └── tools/price-check.ts
   └── triggers.ts
   └── agent.ts + tests
   └── index.ts

3. @ownyou/ui-components (depends on shared-types)
   └── types.ts
   └── MissionCard.tsx + tests
   └── FeedbackButtons.tsx
   └── MissionFeed.tsx
   └── index.ts

4. Integration (depends on all above)
   └── Add missions page to admin-dashboard
   └── Full loop integration test
```

---

**Document Status:** Sprint 3 Technical Specification v1.1 (Implementation Status Added)
**Previous Sprint:** Sprint 2 (LLM Client Consolidation)
**Architecture Reference:** v13 Sections 3.4, 3.6, 8.4.2, 8.12, 10.2
**Remediation:** See `docs/bugfixing/sprint3-remediation.md`
