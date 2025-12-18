# Sprint 11c: 3W-Compliant A/B Testing Framework

**Duration:** 2 weeks
**Status:** COMPLETE ✅
**Goal:** Port the complete 3-stage A/B testing workflow from admin-dashboard to consumer app with full 3W compliance (Web Workers + WASM + WebLLM).
**Success Criteria:** Multi-model classification comparison runs entirely in Web Worker, OAuth via Tauri deep links, ResultsDashboard displays all 6 analysis tabs.
**Depends On:** Sprint 11b (WASM Embeddings) ✅
**v13 Coverage:** Section 3.2.1 (3W Architecture), Section 5.1 (Agent Execution), Section 6.6 (Local Inference)
**Target Tests:** 60+ new tests (types: 10, metrics: 15, worker: 15, UI: 20)

---

## Previous Sprint Summary

### Sprint 11b: WASM Embeddings & Performance (COMPLETE)

**Files Created:**
- `packages/memory-store/src/search/onnx-embeddings.ts` - ONNX embedding service
- `apps/consumer/scripts/performance-test.ts` - Performance benchmark
- `apps/consumer/src/utils/performance-monitor.ts` - UI responsiveness monitor

**Files Modified:**
- `apps/consumer/src/workers/agent.worker.ts` - Uses OnnxEmbeddingService
- `apps/consumer/src-tauri/src/lib.rs` - Singleton HTTP client with pooling

**Current State:**
- ✅ WASM embeddings via onnxruntime-web
- ✅ Performance verified (100 emails < 15 min, UI responsive)
- ✅ HTTP connection pooling in Rust backend
- ✅ Complete "3W" architecture foundation
- 🔴 No multi-model A/B testing in consumer app
- 🔴 Classification results not visible to users
- 🔴 No IAB profile summary on Profile page

---

## Sprint 11c Overview

```
+------------------------------------------------------------------+
|                     SPRINT 11c END STATE                          |
+------------------------------------------------------------------+
|                                                                   |
|  WEEK 1: TYPES, METRICS & WORKER                                  |
|  +----------------------------------------------------------+     |
|  | [Port types.ts, metrics.ts from admin-dashboard]         |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Create classification.worker.ts with @ownyou/llm-client]|     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Create useABTestingWorker hook for React integration]   |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 2: UI COMPONENTS & INTEGRATION                              |
|  +----------------------------------------------------------+     |
|  | [Port Stage1/2/3 Panels with Tauri OAuth]                |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Port ResultsDashboard (33KB) with all 6 tabs]           |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Create ABTesting.tsx and Results.tsx routes]            |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Add IAB summary to Profile page]                        |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  3W-COMPLIANT A/B TESTING (NO SERVER APIS)                        |
|  USER-VISIBLE CLASSIFICATION RESULTS                              |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture Compliance

### Target Sections

| v13 Section | Requirement | Sprint 11c Implementation | Priority |
|-------------|-------------|--------------------------|----------|
| **3.2.1** | 3W Runtime Architecture | Classification in Web Worker | P0 |
| **5.1.1** | Agent Execution Runtime | Multi-model parallel execution | P0 |
| **6.6** | Local/Browser-Based Inference | LLM calls via @ownyou/llm-client | P0 |
| **4.7** | Consumer App Routes | ABTesting + Results routes | P0 |
| **4.5** | Profile View | IAB summary integration | P1 |

### Already Complete (from Sprint 11b)

| v13 Section | Requirement | Status |
|-------------|-------------|--------|
| **3.2.1** | Web Workers | ✅ `agent.worker.ts` |
| **3.2.1** | WASM | ✅ ONNX embeddings |
| **5.2** | Tauri HTTP Proxy | ✅ Connection pooling |
| **8.5.3** | Platform Embedding | ✅ OnnxEmbeddingService |

---

## Implementation Requirements

These mandatory patterns from previous sprints MUST be followed:

### C1: Namespace Usage

```typescript
// NEVER do this
await store.put('ownyou.abtesting.results', key, value);

// ALWAYS use NS.* factory functions
import { NS } from '@ownyou/shared-types';
await store.put(NS.abTestingResults(userId), key, value);
```

### C2: Unconditional Data Writes

```typescript
// NEVER do this
if (classifications.length > 0) {
  await store.put(namespace, key, classifications);
}

// ALWAYS write, even when empty
await store.put(namespace, key, {
  classifications: classifications,
  isEmpty: classifications.length === 0,
  updatedAt: Date.now(),
});
```

### I2: Extract Magic Numbers to Config

```typescript
// NEVER do this
const maxEmails = 100;
const timeoutMs = 30000;

// ALWAYS extract to typed config objects
export interface ABTestingConfig {
  maxEmails: number;
  timeoutMs: number;
  defaultModels: ModelConfig[];
}

export const DEFAULT_ABTESTING_CONFIG: ABTestingConfig = {
  maxEmails: 100,
  timeoutMs: 30000,
  defaultModels: FALLBACK_MODELS.slice(0, 4),
};
```

### I3: Integration Tests for Main Flow

Every A/B testing feature MUST have integration tests validating:
1. Download → Summarize → Classify flow works end-to-end
2. Multi-model comparison produces valid metrics
3. Results persist to IndexedDB correctly
4. UI displays results accurately

### C4: Tauri Build Discipline (OAuth/Deep Links)

**CRITICAL:** For any sprint involving OAuth:

```bash
cd apps/consumer
pnpm tauri:build    # Builds + deploys to /Applications/OwnYou.app
```

**Why:** macOS routes `ownyou://` deep links to the INSTALLED app, NOT the dev server. OAuth callbacks use deep links, so testing requires the rebuilt app.

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Worker-based classification** | 3W compliance requires all LLM calls in Web Worker, not main thread |
| **@ownyou/llm-client in worker** | Unified LLM interface works in both browser and worker contexts |
| **Direct port of metrics.ts** | Pure functions have no server dependencies, can be reused directly |
| **Tauri deep links for OAuth** | No server-side callback handlers in 3W architecture |
| **IndexedDB for stage data** | Self-sovereign storage, no cloud persistence |
| **Parallel model execution** | Run multiple models concurrently for faster comparison |
| **API keys from environment** | Worker reads `import.meta.env.VITE_*_API_KEY`, NO manual user input |

---

## CRITICAL: API Key Handling (3W Compliance)

### ❌ WRONG - Manual API Key Input

**DO NOT implement this pattern:**

```typescript
// ❌ WRONG - Asking user to paste API keys
const [apiKeys, setApiKeys] = useState({
  openai: '',
  anthropic: '',
});

// ❌ WRONG - Manual input fields
<input
  type="password"
  value={apiKeys.openai}
  placeholder="sk-..."
  onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
/>

// ❌ WRONG - Passing API keys as parameters
await runClassification(emails, models, apiKeys);
```

**Why this is wrong:**
1. Poor UX - users shouldn't manage API keys
2. Security risk - keys in React state
3. Not 3W compliant - keys should be in `.env`

### ✅ CORRECT - Environment Variable API Keys

**API keys are configured in `apps/consumer/.env`:**

```env
# apps/consumer/.env
VITE_OPENAI_API_KEY=sk-proj-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_GOOGLE_API_KEY=AIza...
VITE_GROQ_API_KEY=gsk_...
VITE_DEEPINFRA_API_KEY=...
```

**Worker reads API keys at initialization:**

```typescript
// apps/consumer/src/workers/classification.worker.ts

// Read API keys from environment (Vite exposes VITE_* vars)
const API_KEYS = {
  openai: import.meta.env.VITE_OPENAI_API_KEY || '',
  anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  google: import.meta.env.VITE_GOOGLE_API_KEY || '',
  groq: import.meta.env.VITE_GROQ_API_KEY || '',
  deepinfra: import.meta.env.VITE_DEEPINFRA_API_KEY || '',
};

// Create provider with API key from environment
function createProviderForModel(model: ModelConfig): LLMProvider {
  const providerMap = {
    openai: () => new OpenAIProvider({ apiKey: API_KEYS.openai }),
    claude: () => new AnthropicProvider({ apiKey: API_KEYS.anthropic }),
    gemini: () => new GoogleProvider({ apiKey: API_KEYS.google }),
    groq: () => new GroqProvider({ apiKey: API_KEYS.groq }),
    deepinfra: () => new DeepInfraProvider({ apiKey: API_KEYS.deepinfra }),
  };

  const factory = providerMap[model.provider];
  if (!factory) throw new Error(`Unknown provider: ${model.provider}`);
  return factory();
}
```

### Stage 2 UI: Provider/Model Dropdowns (NOT API Key Inputs)

**Port from admin-dashboard's Stage2Panel.tsx:**

```typescript
// Stage 2 shows ONLY model selection, NOT API key inputs
<div className="grid grid-cols-2 gap-4">
  {/* Provider Dropdown */}
  <div>
    <label>Summarizer Provider</label>
    <select
      value={config.summarizerProvider}
      onChange={(e) => handleProviderChange(e.target.value)}
    >
      {providers.map(p => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  </div>

  {/* Model Dropdown */}
  <div>
    <label>Summarizer Model</label>
    <select
      value={config.summarizerModel}
      onChange={(e) => onConfigChange({ ...config, summarizerModel: e.target.value })}
    >
      {modelsForProvider.map(m => (
        <option key={m.model} value={m.model}>{m.displayName}</option>
      ))}
    </select>
  </div>
</div>

{/* NO API KEY INPUTS - keys come from .env */}
```

### Stage 3 UI: Multi-Model Selection Checkboxes

**Port from admin-dashboard's Stage3Panel.tsx:**

```typescript
// Stage 3 shows model checkboxes grouped by provider
<div className="space-y-4">
  {Object.entries(modelsByProvider).map(([provider, models]) => (
    <div key={provider} className="border rounded p-3">
      <div className="font-medium capitalize">{provider}</div>
      <div className="grid grid-cols-2 gap-2">
        {models.map(model => (
          <label key={model.model} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isModelSelected(model)}
              onChange={() => onModelToggle(model)}
            />
            <span>{model.displayName}</span>
          </label>
        ))}
      </div>
    </div>
  ))}
</div>

{/* NO API KEY INPUTS - keys come from .env */}
```

### Validation: Available Providers

**Worker should validate API keys are configured:**

```typescript
// In worker initialization
function getAvailableProviders(): string[] {
  const available: string[] = [];
  if (API_KEYS.openai) available.push('openai');
  if (API_KEYS.anthropic) available.push('claude');
  if (API_KEYS.google) available.push('gemini');
  if (API_KEYS.groq) available.push('groq');
  if (API_KEYS.deepinfra) available.push('deepinfra');
  return available;
}

// Filter FALLBACK_MODELS to only show models with configured API keys
const availableModels = FALLBACK_MODELS.filter(
  model => getAvailableProviders().includes(model.provider)
);
```

### UI Should Show Configuration Status

```typescript
// Show which providers are configured
<div className="text-sm text-gray-500 mb-4">
  Available providers: {availableProviders.join(', ')}
  {availableProviders.length === 0 && (
    <span className="text-red-500">
      No API keys configured. Add keys to .env file.
    </span>
  )}
</div>
```

---

## Architecture Difference: Admin-Dashboard vs Consumer App

| Aspect | Admin-Dashboard | Consumer App (3W) |
|--------|-----------------|-------------------|
| **LLM Calls** | Server API routes (`/api/classify`) | Web Worker via `@ownyou/llm-client` |
| **Storage** | IndexedDB + server | IndexedDB only (self-sovereign) |
| **OAuth** | Server callbacks | Tauri deep links (`ownyou://`) |
| **Execution** | Main thread | `classification.worker.ts` |
| **Model Loading** | `/api/analyze/models` | `@ownyou/llm-client` registry |

---

## Package 1: `@ownyou/ab-testing` - Types & Metrics

**Purpose:** Shared types and pure-function metrics for A/B testing

**Dependencies:**
- None (pure TypeScript, no runtime dependencies)

**Directory Structure:**
```
packages/ab-testing/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts          # Port from admin-dashboard
│   ├── metrics.ts        # Port from admin-dashboard (pure functions)
│   └── export-import.ts  # Port from admin-dashboard
└── __tests__/
    ├── types.test.ts
    └── metrics.test.ts
```

### 1.1 Core Types (port directly)

```typescript
// packages/ab-testing/src/types.ts

/** Stage status tracking */
export type StageStatus = 'idle' | 'running' | 'completed' | 'error';

/** Email providers */
export type EmailProvider = 'gmail' | 'outlook' | 'both';

/** LLM Providers - matches @ownyou/llm-client */
export type LLMProvider = 'openai' | 'claude' | 'gemini' | 'groq' | 'deepinfra' | 'ollama' | 'webllm';

/** IAB Classification sections */
export type IABSection = 'demographics' | 'household' | 'interests' | 'purchase_intent';

/** Core Email interface */
export interface Email {
  id: string;
  subject: string;
  from: string;
  body: string;
  date: string;  // ISO date string
}

/** Pre-processed email with summary */
export interface PreprocessedEmail extends Email {
  summary: string;
  summaryTokenCount: number;
}

/** Model configuration */
export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  displayName: string;
}

/** Individual classification result */
export interface Classification {
  emailId: string;
  category: string;
  taxonomyId: string;
  confidence: number;
  reasoning: string;
  section: IABSection;
}

/** Results for a single model */
export interface ModelResults {
  modelKey: string;  // "provider:model"
  classifications: Classification[];
  stats: {
    avgConfidence: number;
    minConfidence: number;
    maxConfidence: number;
    totalClassifications: number;
    uniqueCategories: string[];
  };
  timing: {
    startTime: string;
    endTime: string;
    durationMs: number;
  };
}

/** Per-model statistics */
export interface ModelStats {
  avgConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  stdDevConfidence: number;
  totalClassifications: number;
  uniqueCategories: string[];
  classificationRate: number;
  durationMs: number;
}

/** Cross-model agreement metrics */
export interface AgreementMetrics {
  fullAgreementCount: number;
  partialAgreementCount: number;
  noAgreementCount: number;
  agreementRate: number;
  pairwiseAgreement: Record<string, Record<string, number>>;
}

/** Category coverage metrics */
export interface CoverageMetrics {
  categoriesByModel: Record<string, string[]>;
  commonCategories: string[];
  uniqueCategories: Record<string, string[]>;
  categoryFrequency: Record<string, number>;
}

/** Complete comparison metrics */
export interface ComparisonMetrics {
  modelStats: Record<string, ModelStats>;
  agreement: AgreementMetrics;
  coverage: CoverageMetrics;
}

/** Stage 1 export format */
export interface Stage1Export {
  version: '1.0';
  exportedAt: string;
  downloadConfig: {
    provider: EmailProvider;
    maxEmails: number;
    userId: string;
  };
  emails: Email[];
}

/** Stage 2 export format */
export interface Stage2Export {
  version: '1.0';
  exportedAt: string;
  preprocessConfig: {
    summarizerProvider: string;
    summarizerModel: string;
    sourceStage1File?: string;
  };
  emails: PreprocessedEmail[];
}

/** Stage 3 export format */
export interface Stage3Export {
  version: '1.0';
  exportedAt: string;
  sourceStage2File?: string;
  models: ModelConfig[];
  results: Record<string, ModelResults>;
  comparisonMetrics: ComparisonMetrics;
}

/** Main state interface */
export interface ABTestingState {
  currentStage: 1 | 2 | 3;
  stageStatus: {
    download: StageStatus;
    preprocess: StageStatus;
    classify: StageStatus;
  };
  downloadedEmails: Email[];
  downloadConfig: {
    provider: EmailProvider;
    maxEmails: number;
  };
  preprocessedEmails: PreprocessedEmail[];
  preprocessConfig: {
    summarizerModel: string;
    summarizerProvider: string;
  };
  selectedModels: ModelConfig[];
  classificationResults: Map<string, ModelResults>;
  comparisonMetrics: ComparisonMetrics | null;
}

/** Fallback models for selection */
export const FALLBACK_MODELS: ModelConfig[] = [
  { provider: 'openai', model: 'gpt-4o-mini', displayName: 'GPT-4o-mini' },
  { provider: 'openai', model: 'gpt-4o', displayName: 'GPT-4o' },
  { provider: 'claude', model: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet' },
  { provider: 'claude', model: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku' },
  { provider: 'gemini', model: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
  { provider: 'gemini', model: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B (Groq)' },
  { provider: 'deepinfra', model: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B (DeepInfra)' },
];
```

### 1.2 Metrics (port directly - pure functions)

```typescript
// packages/ab-testing/src/metrics.ts
// Direct port from admin-dashboard - these are pure functions with no server dependencies

export function computeModelStats(results: ModelResults, totalEmails: number): ModelStats;
export function computeAgreementMetrics(results: Map<string, ModelResults>, emailIds: string[]): AgreementMetrics;
export function computeCoverageMetrics(results: Map<string, ModelResults>): CoverageMetrics;
export function computeComparisonMetrics(results: Map<string, ModelResults>, emailIds: string[]): ComparisonMetrics;
```

### 1.3 Export/Import (port directly)

```typescript
// packages/ab-testing/src/export-import.ts
// Direct port from admin-dashboard - pure serialization functions

export function exportStage1(state: ABTestingState): Stage1Export;
export function exportStage2(state: ABTestingState): Stage2Export;
export function exportStage3(state: ABTestingState): Stage3Export;
export function importStage1(data: Stage1Export): Partial<ABTestingState>;
export function importStage2(data: Stage2Export): Partial<ABTestingState>;
export function importStage3(data: Stage3Export): Partial<ABTestingState>;
```

### 1.4 Success Criteria

- [ ] All types compile without errors
- [ ] Metrics produce identical results to admin-dashboard
- [ ] Export/import round-trips preserve all data
- [ ] 25 tests passing

---

## Package 2: Classification Worker

**Purpose:** 3W-compliant LLM classification in Web Worker

**Location:** `apps/consumer/src/workers/classification.worker.ts`

### 2.1 Worker Implementation

```typescript
// apps/consumer/src/workers/classification.worker.ts
/**
 * 3W-Compliant Classification Worker
 *
 * Runs all LLM calls via @ownyou/llm-client in Web Worker context.
 * NO server API calls - fully self-sovereign.
 *
 * CRITICAL: API keys are read from environment variables, NOT passed as parameters.
 */

import {
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider,
  GroqProvider,
  DeepInfraProvider,
  type LLMProvider,
} from '@ownyou/llm-client';
import type {
  PreprocessedEmail,
  ModelConfig,
  Classification,
  ModelResults,
} from '@ownyou/ab-testing';

// =============================================================================
// API KEYS FROM ENVIRONMENT (NOT from user input!)
// =============================================================================
const API_KEYS = {
  openai: import.meta.env.VITE_OPENAI_API_KEY || '',
  anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  google: import.meta.env.VITE_GOOGLE_API_KEY || '',
  groq: import.meta.env.VITE_GROQ_API_KEY || '',
  deepinfra: import.meta.env.VITE_DEEPINFRA_API_KEY || '',
};

// Get which providers are configured (have API keys)
function getAvailableProviders(): string[] {
  const available: string[] = [];
  if (API_KEYS.openai) available.push('openai');
  if (API_KEYS.anthropic) available.push('claude');
  if (API_KEYS.google) available.push('gemini');
  if (API_KEYS.groq) available.push('groq');
  if (API_KEYS.deepinfra) available.push('deepinfra');
  return available;
}

// Create provider instance for a model (uses env API keys)
function createProviderForModel(model: ModelConfig): LLMProvider {
  const providerMap: Record<string, () => LLMProvider> = {
    openai: () => new OpenAIProvider({ apiKey: API_KEYS.openai }),
    claude: () => new AnthropicProvider({ apiKey: API_KEYS.anthropic }),
    gemini: () => new GoogleProvider({ apiKey: API_KEYS.google }),
    groq: () => new GroqProvider({ apiKey: API_KEYS.groq }),
    deepinfra: () => new DeepInfraProvider({ apiKey: API_KEYS.deepinfra }),
  };

  const factory = providerMap[model.provider];
  if (!factory) throw new Error(`Unknown provider: ${model.provider}`);
  if (!API_KEYS[model.provider === 'claude' ? 'anthropic' : model.provider === 'gemini' ? 'google' : model.provider]) {
    throw new Error(`No API key configured for ${model.provider}. Add to .env file.`);
  }
  return factory();
}

// =============================================================================
// MESSAGE TYPES (NO apiKeys parameter!)
// =============================================================================

interface ClassifyRequest {
  type: 'classify';
  requestId: string;
  emails: PreprocessedEmail[];
  models: ModelConfig[];
  // NOTE: NO apiKeys parameter - keys come from environment
}

interface GetAvailableProvidersRequest {
  type: 'getAvailableProviders';
  requestId: string;
}

interface SummarizeRequest {
  type: 'summarize';
  requestId: string;
  emails: Email[];
  model: ModelConfig;
}

interface ProgressMessage {
  type: 'progress';
  requestId: string;
  modelKey: string;
  completed: number;
  total: number;
}

interface ResultMessage {
  type: 'result';
  requestId: string;
  results: Record<string, ModelResults>;
}

interface ErrorMessage {
  type: 'error';
  requestId: string;
  error: string;
}

self.onmessage = async (event: MessageEvent<ClassifyRequest | SummarizeRequest>) => {
  const { type, requestId } = event.data;

  try {
    if (type === 'classify') {
      const { emails, models } = event.data as ClassifyRequest;
      await runClassification(requestId, emails, models);
    } else if (type === 'summarize') {
      const { emails, model } = event.data as SummarizeRequest;
      await runSummarization(requestId, emails, model);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as ErrorMessage);
  }
};

async function runClassification(
  requestId: string,
  emails: PreprocessedEmail[],
  models: ModelConfig[]
): Promise<void> {
  const results: Record<string, ModelResults> = {};

  // Run models in parallel
  await Promise.all(
    models.map(async (model) => {
      const modelKey = `${model.provider}:${model.model}`;
      const startTime = new Date().toISOString();
      const classifications: Classification[] = [];

      const client = createLLMClient({ provider: model.provider as LLMProvider });

      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];

        // Report progress
        self.postMessage({
          type: 'progress',
          requestId,
          modelKey,
          completed: i,
          total: emails.length,
        } as ProgressMessage);

        // Classify email
        const classification = await classifyEmail(client, email, model);
        if (classification) {
          classifications.push(classification);
        }
      }

      const endTime = new Date().toISOString();

      results[modelKey] = {
        modelKey,
        classifications,
        stats: computeStats(classifications),
        timing: {
          startTime,
          endTime,
          durationMs: new Date(endTime).getTime() - new Date(startTime).getTime(),
        },
      };
    })
  );

  self.postMessage({
    type: 'result',
    requestId,
    results,
  } as ResultMessage);
}

async function classifyEmail(
  client: ReturnType<typeof createLLMClient>,
  email: PreprocessedEmail,
  model: ModelConfig
): Promise<Classification | null> {
  // IAB classification prompt
  const prompt = `Classify this email into an IAB category.

Email Summary: ${email.summary}
Subject: ${email.subject}
From: ${email.from}

Return JSON: {"category": "IAB category", "taxonomyId": "IAB-XXX", "confidence": 0.0-1.0, "reasoning": "brief explanation", "section": "interests|demographics|household|purchase_intent"}`;

  try {
    const response = await client.chat({
      messages: [{ role: 'user', content: prompt }],
      model: model.model,
      temperature: 0.3,
    });

    // Parse response
    const content = response.content;
    const parsed = JSON.parse(content);

    return {
      emailId: email.id,
      ...parsed,
    };
  } catch (error) {
    console.error(`[ClassificationWorker] Failed to classify email ${email.id}:`, error);
    return null;
  }
}

function computeStats(classifications: Classification[]) {
  const confidences = classifications.map((c) => c.confidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  return {
    avgConfidence,
    minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
    maxConfidence: confidences.length > 0 ? Math.max(...confidences) : 0,
    totalClassifications: classifications.length,
    uniqueCategories: [...new Set(classifications.map((c) => c.category))],
  };
}
```

### 2.2 React Hook

```typescript
// apps/consumer/src/hooks/useABTestingWorker.ts

import { useRef, useState, useCallback, useEffect } from 'react';
import type {
  PreprocessedEmail,
  ModelConfig,
  ModelResults,
} from '@ownyou/ab-testing';

interface WorkerProgress {
  modelKey: string;
  completed: number;
  total: number;
}

interface UseABTestingWorkerReturn {
  runClassification: (emails: PreprocessedEmail[], models: ModelConfig[]) => Promise<Record<string, ModelResults>>;
  runSummarization: (emails: Email[], model: ModelConfig) => Promise<PreprocessedEmail[]>;
  getAvailableProviders: () => Promise<string[]>;  // Get providers with configured API keys
  progress: WorkerProgress | null;
  isRunning: boolean;
  error: string | null;
  cancel: () => void;
}

// NOTE: NO apiKeys parameter in runClassification/runSummarization!
// Worker reads API keys from environment variables internally.

export function useABTestingWorker(): UseABTestingWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState<WorkerProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create worker on mount
    workerRef.current = new Worker(
      new URL('../workers/classification.worker.ts', import.meta.url),
      { type: 'module' }
    );

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runClassification = useCallback(
    async (emails: PreprocessedEmail[], models: ModelConfig[]): Promise<Record<string, ModelResults>> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const requestId = crypto.randomUUID();
        setIsRunning(true);
        setError(null);

        const handleMessage = (event: MessageEvent) => {
          if (event.data.requestId !== requestId) return;

          switch (event.data.type) {
            case 'progress':
              setProgress({
                modelKey: event.data.modelKey,
                completed: event.data.completed,
                total: event.data.total,
              });
              break;
            case 'result':
              workerRef.current?.removeEventListener('message', handleMessage);
              setIsRunning(false);
              setProgress(null);
              resolve(event.data.results);
              break;
            case 'error':
              workerRef.current?.removeEventListener('message', handleMessage);
              setIsRunning(false);
              setError(event.data.error);
              reject(new Error(event.data.error));
              break;
          }
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'classify',
          requestId,
          emails,
          models,
        });
      });
    },
    []
  );

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = new Worker(
      new URL('../workers/classification.worker.ts', import.meta.url),
      { type: 'module' }
    );
    setIsRunning(false);
    setProgress(null);
  }, []);

  return {
    runClassification,
    runSummarization: async () => [], // TODO: Implement
    progress,
    isRunning,
    error,
    cancel,
  };
}
```

### 2.3 Success Criteria

- [ ] Worker loads and initializes in browser
- [ ] Classification runs for all configured models
- [ ] Progress events sent for UI updates
- [ ] Error handling works correctly
- [ ] 15 tests passing

---

## Package 3: UI Components

**Purpose:** A/B testing UI with 3-stage workflow and results dashboard

**Location:** `apps/consumer/src/routes/ABTesting.tsx` and supporting components

### 3.1 Files to Port

| Admin-Dashboard File | Consumer App Location | Changes Required |
|---------------------|----------------------|------------------|
| `components/ab-testing/StageIndicator.tsx` | `components/ab-testing/` | Direct copy |
| `components/ab-testing/Stage1Panel.tsx` | `components/ab-testing/` | OAuth → Tauri deep links |
| `components/ab-testing/Stage2Panel.tsx` | `components/ab-testing/` | API → Worker |
| `components/ab-testing/Stage3Panel.tsx` | `components/ab-testing/` | API → Worker |
| `components/ab-testing/ResultsDashboard.tsx` | `components/ab-testing/` | Direct copy (33KB) |

### 3.2 OAuth Adaptation

```typescript
// Stage1Panel.tsx - OAuth changes

// BEFORE (admin-dashboard): Server callback
const handleGmailAuth = async () => {
  window.location.href = '/api/auth/gmail/authorize';
};

// AFTER (consumer app): Tauri deep link
import { startTauriOAuth } from '../utils/tauri-oauth';

const handleGmailAuth = async () => {
  try {
    const tokens = await startTauriOAuth('gmail');
    // tokens.access_token available for email download
    setOAuthTokens(tokens);
  } catch (error) {
    console.error('Gmail auth failed:', error);
  }
};
```

### 3.3 Route Structure

```typescript
// apps/consumer/src/App.tsx - Add routes

import { ABTesting } from './routes/ABTesting';
import { Results } from './routes/Results';

// In routes array:
<Route path="/ab-testing" element={<ABTesting />} />
<Route path="/results" element={<Results />} />
```

### 3.4 ABTesting.tsx

```typescript
// apps/consumer/src/routes/ABTesting.tsx
/**
 * A/B Testing Route - 3-stage workflow
 *
 * Stage 1: Download emails (Gmail/Outlook via Tauri deep links)
 * Stage 2: Summarize/preprocess (LLM in worker)
 * Stage 3: Multi-model classification comparison (parallel in worker)
 */

import { useState } from 'react';
import { Header } from '@ownyou/ui-components';
import { StageIndicator } from '../components/ab-testing/StageIndicator';
import { Stage1Panel } from '../components/ab-testing/Stage1Panel';
import { Stage2Panel } from '../components/ab-testing/Stage2Panel';
import { Stage3Panel } from '../components/ab-testing/Stage3Panel';
import { ResultsDashboard } from '../components/ab-testing/ResultsDashboard';
import { useABTestingWorker } from '../hooks/useABTestingWorker';
import type { ABTestingState } from '@ownyou/ab-testing';

export function ABTesting() {
  const [state, setState] = useState<ABTestingState>({
    currentStage: 1,
    stageStatus: { download: 'idle', preprocess: 'idle', classify: 'idle' },
    downloadedEmails: [],
    downloadConfig: { provider: 'gmail', maxEmails: 50 },
    preprocessedEmails: [],
    preprocessConfig: { summarizerModel: 'gpt-4o-mini', summarizerProvider: 'openai' },
    selectedModels: [],
    classificationResults: new Map(),
    comparisonMetrics: null,
  });

  const { runClassification, progress, isRunning, cancel } = useABTestingWorker();

  // ... stage handlers

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="A/B Testing" showFilters={false} />

      <div className="flex-1 px-4 py-6">
        <StageIndicator currentStage={state.currentStage} stageStatus={state.stageStatus} />

        {state.currentStage === 1 && (
          <Stage1Panel state={state} setState={setState} />
        )}
        {state.currentStage === 2 && (
          <Stage2Panel state={state} setState={setState} />
        )}
        {state.currentStage === 3 && (
          <Stage3Panel
            state={state}
            setState={setState}
            runClassification={runClassification}
            progress={progress}
            isRunning={isRunning}
            cancel={cancel}
          />
        )}

        {state.comparisonMetrics && (
          <ResultsDashboard
            results={state.classificationResults}
            metrics={state.comparisonMetrics}
            emails={state.preprocessedEmails}
            models={state.selectedModels}
          />
        )}
      </div>
    </div>
  );
}
```

### 3.5 Results.tsx (Dedicated Results Page)

```typescript
// apps/consumer/src/routes/Results.tsx
/**
 * Detailed Results Page
 *
 * Full ResultsDashboard with all 6 tabs:
 * - Overview: Model comparison table
 * - Confidence: Distribution charts
 * - Agreement: Cross-model heatmap
 * - Coverage: Category analysis
 * - Details: Per-email classifications
 * - Disagreements: Where models differ
 */

import { useEffect, useState } from 'react';
import { Header } from '@ownyou/ui-components';
import { ResultsDashboard } from '../components/ab-testing/ResultsDashboard';
import { useStore } from '../contexts/StoreContext';
import { NS } from '@ownyou/shared-types';
import type { Stage3Export } from '@ownyou/ab-testing';

export function Results() {
  const { store, isReady } = useStore();
  const [data, setData] = useState<Stage3Export | null>(null);

  useEffect(() => {
    if (!store || !isReady) return;

    const loadResults = async () => {
      const results = await store.get<Stage3Export>(NS.abTestingResults('user'), 'latest');
      if (results) {
        setData(results);
      }
    };

    loadResults();
  }, [store, isReady]);

  if (!data) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Classification Results" showFilters={false} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">No results yet. Run A/B testing first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Classification Results" showFilters={false} />
      <div className="flex-1 px-4 py-6">
        <ResultsDashboard
          results={new Map(Object.entries(data.results))}
          metrics={data.comparisonMetrics}
          emails={[]} // TODO: Load from Stage2
          models={data.models}
        />
      </div>
    </div>
  );
}
```

### 3.6 Profile Page Integration

```typescript
// apps/consumer/src/routes/Profile.tsx
// ADD: IAB Summary Section

import { IABSummary } from '../components/profile/IABSummary';

// In Profile component, add:
<IABSummary
  topCategories={latestResults?.topCategories ?? []}
  confidence={latestResults?.avgConfidence ?? 0}
  lastUpdated={latestResults?.timestamp}
  onViewDetails={() => navigate('/results')}
/>
```

### 3.7 Success Criteria

- [ ] 3-stage workflow navigates correctly
- [ ] Stage 1 downloads emails via Tauri OAuth
- [ ] Stage 2 summarizes in worker
- [ ] Stage 3 classifies with multiple models
- [ ] ResultsDashboard shows all 6 tabs
- [ ] Results page loads saved data
- [ ] Profile shows IAB summary
- [ ] 20 tests passing

---

## Week-by-Week Breakdown (2 Weeks)

### Week 1: Types, Metrics & Worker (Days 1-5)

**Day 1: Package Setup**
- [ ] Create `packages/ab-testing/` directory structure
- [ ] Create `package.json` with dependencies
- [ ] Port `types.ts` from admin-dashboard
- [ ] Add namespace to `@ownyou/shared-types`: `NS.abTestingResults(userId)`

**Day 2: Metrics Implementation**
- [ ] Port `metrics.ts` (pure functions)
- [ ] Port `export-import.ts`
- [ ] Write unit tests for metrics
- [ ] Verify identical output to admin-dashboard

**Day 3: Classification Worker**
- [ ] Create `classification.worker.ts`
- [ ] Implement classify request handler
- [ ] Implement summarize request handler
- [ ] Wire to `@ownyou/llm-client`

**Day 4: Worker Hook**
- [ ] Create `useABTestingWorker.ts` hook
- [ ] Implement progress tracking
- [ ] Implement cancel functionality
- [ ] Integration tests for worker communication

**Day 5: Worker Testing**
- [ ] Test with real LLM calls
- [ ] Test multi-model parallel execution
- [ ] Verify progress events
- [ ] Fix any issues

### Week 2: UI Components & Integration (Days 6-10)

**Day 6: Port Stage Panels**
- [ ] Port `StageIndicator.tsx` (direct copy)
- [ ] Port `Stage1Panel.tsx` (adapt OAuth)
- [ ] Test OAuth flow with Tauri deep links
- [ ] Run `pnpm tauri:build` for OAuth testing

**Day 7: Port Stage 2 & 3 Panels**
- [ ] Port `Stage2Panel.tsx` (adapt to worker)
- [ ] Port `Stage3Panel.tsx` (adapt to worker)
- [ ] Test summarization in worker
- [ ] Test classification in worker

**Day 8: Port ResultsDashboard**
- [ ] Port `ResultsDashboard.tsx` (33KB, direct copy)
- [ ] Verify all 6 tabs work:
  - [ ] Overview tab
  - [ ] Confidence tab
  - [ ] Agreement tab
  - [ ] Coverage tab
  - [ ] Details tab
  - [ ] Disagreements tab

**Day 9: Routes & Navigation**
- [ ] Create `ABTesting.tsx` route
- [ ] Create `Results.tsx` route
- [ ] Add routes to `App.tsx`
- [ ] Add navigation item
- [ ] Test full workflow end-to-end

**Day 10: Profile Integration & Polish**
- [ ] Create `IABSummary.tsx` component
- [ ] Add to Profile page
- [ ] Run full `pnpm tauri:build`
- [ ] Test in installed app
- [ ] Fix any remaining issues

---

## Test Targets

| Area | Target Tests | Focus |
|------|--------------|-------|
| `@ownyou/ab-testing` types | 10 | Type validation, serialization |
| `@ownyou/ab-testing` metrics | 15 | Statistics, agreement, coverage |
| `classification.worker.ts` | 15 | Classification, summarization, progress |
| UI Components | 20 | Rendering, interaction, workflow |
| **Total** | **60** | |

---

## Success Criteria

### Priority 1: 3W Compliance
- [ ] All LLM calls run in Web Worker (no main thread)
- [ ] No server API routes used
- [ ] Classification uses `@ownyou/llm-client`
- [ ] Data stored in IndexedDB only

### Priority 2: Full Workflow
- [ ] Stage 1: Download emails via Tauri OAuth
- [ ] Stage 2: Summarize in worker
- [ ] Stage 3: Multi-model classification comparison
- [ ] Progress displayed during processing

### Priority 3: Results Visibility
- [ ] ResultsDashboard shows all 6 tabs
- [ ] Profile page shows IAB summary
- [ ] Results page shows full analysis
- [ ] Export/import works for all stages

### Priority 4: Quality
- [ ] 60+ tests passing
- [ ] Tauri build succeeds
- [ ] OAuth flow works in installed app
- [ ] No console errors in production

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/ab-testing/package.json` | Package config |
| `packages/ab-testing/src/index.ts` | Exports |
| `packages/ab-testing/src/types.ts` | Type definitions |
| `packages/ab-testing/src/metrics.ts` | Statistical analysis |
| `packages/ab-testing/src/export-import.ts` | Data persistence |
| `apps/consumer/src/workers/classification.worker.ts` | 3W classification |
| `apps/consumer/src/hooks/useABTestingWorker.ts` | Worker communication |
| `apps/consumer/src/routes/ABTesting.tsx` | Main A/B testing page |
| `apps/consumer/src/routes/Results.tsx` | Detailed results page |
| `apps/consumer/src/components/ab-testing/StageIndicator.tsx` | Stage progress |
| `apps/consumer/src/components/ab-testing/Stage1Panel.tsx` | Email download |
| `apps/consumer/src/components/ab-testing/Stage2Panel.tsx` | Summarization |
| `apps/consumer/src/components/ab-testing/Stage3Panel.tsx` | Classification |
| `apps/consumer/src/components/ab-testing/ResultsDashboard.tsx` | 6-tab analysis |
| `apps/consumer/src/components/profile/IABSummary.tsx` | Profile integration |

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared-types/src/namespaces.ts` | Add `abTestingResults` namespace |
| `apps/consumer/src/App.tsx` | Add ABTesting and Results routes |
| `apps/consumer/src/routes/Profile.tsx` | Add IABSummary component |
| `packages/ui-components/src/layout/Navigation.tsx` | Add A/B Testing nav item |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Worker context limitations | Medium | High | Test early, fallback to mock |
| OAuth token expiry | Medium | Medium | Refresh token handling |
| Large ResultsDashboard (33KB) | Low | Medium | Code splitting |
| API rate limits | Medium | Medium | Request throttling |
| WebLLM not working in worker | High | Medium | Use cloud providers as fallback |

---

## Dependencies & External Services

### NPM Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@ownyou/llm-client` | workspace | LLM API access |
| `@ownyou/shared-types` | workspace | Namespaces |
| `@ownyou/memory-store` | workspace | IndexedDB storage |

### External APIs (via @ownyou/llm-client)

| Provider | Usage | Notes |
|----------|-------|-------|
| OpenAI | Classification | GPT-4o, GPT-4o-mini |
| Anthropic | Classification | Claude 3.5 Sonnet/Haiku |
| Google | Classification | Gemini 1.5/2.0 |
| Groq | Classification | Llama 3.3 |
| DeepInfra | Classification | Llama 3.3 |

---

## Definition of Done

Sprint 11c is complete when:

### Types & Metrics
1. [ ] `@ownyou/ab-testing` package created
2. [ ] All types compile without errors
3. [ ] Metrics produce identical results to admin-dashboard
4. [ ] Export/import works for all 3 stages

### Worker (CRITICAL: API Key Handling)
5. [ ] `classification.worker.ts` handles classify/summarize
6. [ ] **Worker reads API keys from `import.meta.env.VITE_*_API_KEY`**
7. [ ] **NO `apiKeys` parameter in worker messages**
8. [ ] Multi-model parallel execution works
9. [ ] Progress events sent to UI
10. [ ] `useABTestingWorker` hook working (no apiKeys param)

### UI (CRITICAL: No Manual API Key Input)
11. [ ] **Stage 2 shows Provider/Model dropdowns (NOT API key inputs)**
12. [ ] **Stage 3 shows multi-model checkboxes (NOT API key inputs)**
13. [ ] **NO `<input type="password" placeholder="sk-...">` fields anywhere**
14. [ ] UI shows which providers are configured (have API keys in .env)
15. [ ] Stage 1-3 panels ported from admin-dashboard correctly
16. [ ] OAuth via Tauri deep links
17. [ ] ResultsDashboard shows all 6 tabs
18. [ ] ABTesting and Results routes working

### Integration
19. [ ] Profile page shows IAB summary
20. [ ] Full workflow tested end-to-end
21. [ ] 60+ tests passing
22. [ ] Tauri build succeeds

### Validation Checklist (Before Marking Complete)
- [ ] **Grep codebase for `apiKeys` state - should NOT exist in ABTesting.tsx**
- [ ] **Grep codebase for manual API key inputs - should NOT exist**
- [ ] **Verify Stage 2 has Provider/Model dropdowns**
- [ ] **Verify Stage 3 has model checkboxes grouped by provider**
- [ ] **Verify worker reads from `import.meta.env`**

---

## Admin-Dashboard Source Files Reference

These files should be ported from `src/admin-dashboard/`:

| Source File | Size | Port Method |
|-------------|------|-------------|
| `lib/ab-testing/types.ts` | 331 lines | Direct copy |
| `lib/ab-testing/metrics.ts` | 231 lines | Direct copy |
| `lib/ab-testing/export-import.ts` | ~150 lines | Direct copy |
| `components/ab-testing/StageIndicator.tsx` | ~50 lines | Direct copy |
| `components/ab-testing/Stage1Panel.tsx` | ~200 lines | Adapt OAuth |
| `components/ab-testing/Stage2Panel.tsx` | ~150 lines | Adapt to worker |
| `components/ab-testing/Stage3Panel.tsx` | ~200 lines | Adapt to worker |
| `components/ab-testing/ResultsDashboard.tsx` | 33KB | Direct copy |

---

## Lessons Learned (From Initial Implementation Attempt)

### What Went Wrong

| Issue | What Was Done | What Should Have Been Done |
|-------|---------------|---------------------------|
| **Manual API Key Inputs** | Added `<input type="password" placeholder="sk-...">` for users to paste API keys | API keys should come from `.env` file, worker reads via `import.meta.env.VITE_*` |
| **API Keys Passed to Worker** | `runClassification(emails, models, apiKeys)` with apiKeys parameter | Worker reads API keys internally from environment, NO apiKeys parameter |
| **Missing Model Selection UI** | Stage 2 showed only API key input, no model selection | Port Stage2Panel with Provider/Model dropdowns from admin-dashboard |
| **Incomplete Stage 3 UI** | Had model checkboxes but also manual API key inputs | Port Stage3Panel with model checkboxes only, no API key inputs |
| **Spec Lacked API Key Section** | Original spec said "via @ownyou/llm-client" but didn't specify HOW | Spec now has explicit "CRITICAL: API Key Handling" section |

### Root Cause Analysis

1. **Spec Ambiguity**: The original spec stated "LLM calls via `@ownyou/llm-client`" without explicitly documenting:
   - WHERE API keys come from (environment variables)
   - HOW they're accessed (worker reads `import.meta.env`)
   - WHAT NOT to do (no manual user input)

2. **Admin-Dashboard Pattern Not Followed**: The admin-dashboard uses server API routes which have access to server-side environment variables. The consumer app implementation incorrectly assumed user input was needed instead of porting the pattern correctly.

3. **Testing Discipline Not Applied**: The implementation was not tested against the spec's "Architecture Difference" table which clearly states "Model Loading: `@ownyou/llm-client` registry" (not user input).

### Spec Improvements Made

1. Added explicit "CRITICAL: API Key Handling" section with:
   - ❌ WRONG pattern examples
   - ✅ CORRECT pattern examples
   - Stage 2 and Stage 3 UI requirements

2. Updated Definition of Done with:
   - Explicit checks for no API key inputs
   - Validation checklist with grep commands
   - Critical requirements in bold

3. Updated Worker implementation section with:
   - API key reading from environment
   - `createProviderForModel()` function
   - `getAvailableProviders()` function

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-16 | Claude Code Agent | Initial specification |
| 1.1 | 2025-12-16 | Claude Code Agent | Added CRITICAL: API Key Handling section, Lessons Learned from implementation attempt, updated Definition of Done with validation checklist |
| 1.2 | 2025-12-18 | Claude Code Agent | Sprint COMPLETE - All 6 tabs in Results page, 182 tests passing, Tauri build v0.1.15 deployed |

---

**Document Status:** Sprint 11c Specification v1.2 - COMPLETE ✅
**Date:** 2025-12-18
**Author:** Claude Code Agent
**Validates Against:** OwnYou_architecture_v13.md, Sprint 11b completion
**v13 Sections Covered:**
- Section 3.2.1: 3W Runtime Architecture
- Section 5.1.1: Agent Execution Runtime
- Section 6.6: Local/Browser-Based Inference
- Section 4.7: Consumer App Routes
**Previous Sprint:** Sprint 11b (WASM Embeddings) ✅ COMPLETE
**Next Sprint:** Sprint 12 (BBS+ & Publisher/Advertiser SDK)
