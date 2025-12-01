# IAB Classifier TypeScript/JavaScript Implementation Specification

**Document Version**: 1.0
**Date**: 2025-11-12
**Source**: TypeScript implementation at `src/browser/` and `src/admin-dashboard/`
**Status**: Production (Admin Dashboard), Development (Browser PWA)

---

## Table of Contents

1. [Architecture & Deployment Models](#1-architecture--deployment-models)
2. [LangGraph Implementation](#2-langgraph-implementation)
3. [Batch Processing System](#3-batch-processing-system)
4. [LLM Infrastructure](#4-llm-infrastructure)
5. [IAB Analyzer Agents](#5-iab-analyzer-agents)
6. [Evidence Judge System](#6-evidence-judge-system)
7. [Taxonomy System](#7-taxonomy-system)
8. [Memory & Store Integration](#8-memory--store-integration)
9. [Admin Dashboard Integration](#9-admin-dashboard-integration)
10. [3-Stage Email Processing Pipeline](#10-3-stage-email-processing-pipeline)
11. [Type Definitions & Interfaces](#11-type-definitions--interfaces)
12. [Algorithms & Formulas](#12-algorithms--formulas)
13. [Migration from Python](#13-migration-from-python)
14. [Critical Implementation Details](#14-critical-implementation-details)

---

## 1. Architecture & Deployment Models

### 1.1 Two Deployment Contexts

The TypeScript IAB classifier supports **two distinct deployment models**:

#### **1. Admin Dashboard (Server-Side Next.js)** ✅ PRODUCTION

**Location**: `/src/admin-dashboard/`

**Runtime Environment**:
- Node.js server (Next.js App Router)
- Server-side rendering (SSR)
- API routes for LLM calls

**Store**:
- In-memory per-user instances (`InMemorySaver`)
- Managed by shared store singleton

**LangGraph Support**:
- Full support (Node.js `async_hooks` available)
- Checkpointing via `MemorySaver`

**Entry Points**:
- **Classification**: `POST /api/classify`
- **Summarization**: `POST /api/summarize`
- **OAuth**: `/api/auth/{gmail,outlook}/{authorize,callback}`

**Use Case**: Development testing, admin tools, rapid prototyping

**File**: `/src/admin-dashboard/lib/shared-store.ts`
```typescript
const userStores = new Map<string, InMemorySaver>()

export function getStore(userId: string): InMemorySaver {
  if (!userStores.has(userId)) {
    userStores.set(userId, new InMemorySaver())
  }
  return userStores.get(userId)!
}
```

#### **2. Browser PWA (Client-Side)** ⚠️ IN DEVELOPMENT

**Location**: `/src/browser/`

**Runtime Environment**:
- Browser Web APIs only
- No Node.js dependencies
- Client-side execution

**Store**:
- `IndexedDBStore` (validated via research spike)
- LangGraph BaseStore implementation

**LangGraph Support**:
- Browser-compatible imports: `@langchain/langgraph/web`
- Checkpointing via PGlite with `idb://` backend

**Entry Point**: TBD (awaiting PWA integration)

**Use Case**: Production self-sovereign deployment (no server required)

**Status**:
- ✅ Infrastructure complete (`IndexedDBStore`, agents, LLM clients)
- ⚠️ Integration pending (PWA shell, service worker, UI)

### 1.2 Current Implementation Status

| Component | Admin Dashboard | Browser PWA |
|-----------|----------------|-------------|
| **LangGraph Workflow** | ✅ Complete | ✅ Complete |
| **Batch Optimizer** | ✅ Complete | ✅ Complete |
| **LLM Clients** | ✅ Complete (OpenAI, Claude, Google) | ✅ Complete |
| **IAB Analyzers** | ✅ Complete (all 4) | ✅ Complete |
| **Evidence Judge** | ✅ Complete | ✅ Complete |
| **Store** | ✅ In-Memory | ✅ IndexedDB |
| **OAuth** | ✅ Gmail, Outlook | ❌ TBD |
| **UI** | ✅ Next.js pages | ❌ TBD |
| **Service Worker** | N/A | ❌ TBD |

---

## 2. LangGraph Implementation

### 2.1 State Schema (Annotation.Root)

**File**: `/src/browser/agents/iab-classifier/state.ts` (715 lines)

**Key Difference from Python**: Uses `Annotation.Root` instead of `TypedDict`

**State Definition**:
```typescript
import { Annotation } from '@langchain/langgraph'

export const WorkflowState = Annotation.Root({
  // ===== REQUIRED FIELDS =====
  user_id: Annotation<string>,  // No default (must be provided)

  // ===== EMAIL DATA =====
  emails: Annotation<Array<Record<string, any>>>({
    default: () => []
  }),

  processed_email_ids: Annotation<Array<string>>({
    default: () => []
  }),

  total_emails: Annotation<number>({
    default: () => 0
  }),

  // ===== BATCH PROCESSING (CRITICAL) =====
  current_batch_start: Annotation<number>({
    default: () => 0
  }),

  batch_size: Annotation<number>({
    default: () => 1  // Will be recalculated
  }),

  model_context_window: Annotation<number>({
    default: () => 0  // Fetched from model registry
  }),

  force_reprocess: Annotation<boolean>({
    default: () => false  // Skip processed_email_ids check
  }),

  // ===== LLM CONFIGURATION =====
  llm_provider: Annotation<string>({
    default: () => ''  // "openai", "claude", "google"
  }),

  llm_model: Annotation<string>({
    default: () => ''  // e.g., "gpt-4o-mini"
  }),

  llm_config: Annotation<any>({
    default: () => null  // API keys, temperature, etc.
  }),

  cost_tracker: Annotation<any>({
    default: () => null  // CostTracker instance
  }),

  // ===== PROFILE DATA =====
  existing_profile: Annotation<Record<string, any>>({
    default: () => ({})  // Retrieved from Store
  }),

  // ===== ANALYZER RESULTS (4 SECTIONS) =====
  demographics_results: Annotation<Array<Record<string, any>>>({
    default: () => []
  }),

  household_results: Annotation<Array<Record<string, any>>>({
    default: () => []
  }),

  interests_results: Annotation<Array<Record<string, any>>>({
    default: () => []
  }),

  purchase_results: Annotation<Array<Record<string, any>>>({
    default: () => []
  }),

  // ===== RECONCILIATION =====
  reconciliation_data: Annotation<Array<Record<string, any>>>({
    default: () => []  // Bayesian updates, conflicts
  }),

  updated_profile: Annotation<Record<string, any>>({
    default: () => ({})  // Final IABConsumerProfile
  }),

  // ===== ERROR TRACKING =====
  errors: Annotation<Array<string>>({
    default: () => []
  }),

  warnings: Annotation<Array<string>>({
    default: () => []
  }),

  // ===== WORKFLOW METADATA =====
  workflow_started_at: Annotation<string>({
    default: () => ''
  }),

  workflow_completed_at: Annotation<string>({
    default: () => ''
  })
})
```

**Type Extraction** (for TypeScript consumers):
```typescript
export type WorkflowStateType = typeof WorkflowState.State
```

### 2.2 Graph Structure

**File**: `/src/browser/agents/iab-classifier/index.ts` (329 lines)

**Graph Building Function**:
```typescript
import { StateGraph, END } from '@langchain/langgraph'
import { WorkflowState } from './state'
import { load_emails } from './nodes/loadEmails'
import { retrieve_profile } from './nodes/retrieveProfile'
import { analyzeAllNode } from './nodes/analyzers'
import { reconcile } from './nodes/reconcile'
import { update_memory } from './nodes/updateMemory'

export function buildWorkflowGraph(
  store: BaseStore,
  checkpointer: any = null,
  userId: string = 'default_user'
) {
  const workflow = new StateGraph(WorkflowState)

  // Add nodes
  workflow.addNode('load_emails', load_emails)
  workflow.addNode('retrieve_profile', retrieve_profile)
  workflow.addNode('analyze_all', analyzeAllNode)
  workflow.addNode('reconcile', reconcile)
  workflow.addNode('update_memory', update_memory)

  // Set entry point
  workflow.setEntryPoint('load_emails')

  // Add edges
  workflow.addConditionalEdges(
    'load_emails',
    _checkHasEmailsConditional,
    {
      has_emails: 'retrieve_profile',
      no_emails: END
    }
  )

  workflow.addEdge('retrieve_profile', 'analyze_all')
  workflow.addEdge('analyze_all', 'reconcile')
  workflow.addEdge('reconcile', 'update_memory')
  workflow.addEdge('update_memory', END)

  // Compile
  return checkpointer
    ? workflow.compile({ checkpointer })
    : workflow.compile()
}
```

**Node Flow**:
```
START
  ↓
load_emails (filter unprocessed, mark as processing)
  ↓ [conditional: has_emails?]
retrieve_profile (load existing classifications from Store)
  ↓
analyze_all (run all 4 analyzers sequentially)
  ├─ demographics_analyzer
  ├─ household_analyzer
  ├─ interests_analyzer
  └─ purchase_analyzer
  ↓
reconcile (Bayesian confidence update, merge results)
  ↓
update_memory (write to Store)
  ↓
END
```

**Key Difference from Python**:
- **No Email Loop**: Python has `advance_email` node + loop back to `retrieve_profile`
- **TypeScript**: Processes ALL emails in ONE invocation
- **Rationale**: Frontend handles batching (send multiple requests if >50 emails)

### 2.3 Conditional Edge Functions

**Function**: `_checkHasEmailsConditional()` (line 289)

```typescript
function _checkHasEmailsConditional(
  state: typeof WorkflowState.State
): string {
  const emails = state.emails || []

  if (emails.length === 0) {
    return 'no_emails'
  }

  return 'has_emails'
}
```

**No Continuation Check**: Unlike Python's `_checkContinuationConditional`, TypeScript version ends after ONE pass

---

## 3. Batch Processing System

### 3.1 Batch Optimizer

**File**: `/src/browser/agents/iab-classifier/batchOptimizer.ts` (292 lines)

**Token Estimation**:
```typescript
/**
 * Estimate token count for a single email.
 * Python source: batch_optimizer.py:17-32
 */
export function estimateEmailTokens(email: Record<string, any>): number {
  const subject = email.subject || ''
  const sender = email.sender || ''
  const body = email.body || ''

  const totalChars = subject.length + sender.length + body.length

  // Account for formatting overhead:
  // "Email N:\nSubject: ...\nFrom: ...\nBody: ...\n\n"
  const formatOverhead = 100

  // Approximation: 1 token ≈ 4 characters for English text
  return Math.floor((totalChars + formatOverhead) / 4)
}
```

**Batch Size Calculation**:
```typescript
/**
 * Calculate optimal batch size for given context window.
 * Python source: batch_optimizer.py:50-136
 */
export function calculateBatchSize(
  emails: Array<Record<string, any>>,
  contextWindow: number,
  startIndex: number = 0,
  targetUtilization: number = 0.70,  // 70% for emails, 30% reserve
  minBatchSize: number = 5,
  maxBatchSize: number = 50
): number {
  // Reserve tokens for system prompt + taxonomy + response
  const reservedTokens = Math.floor(contextWindow * (1 - targetUtilization))
  const availableTokens = contextWindow - reservedTokens

  let cumulativeTokens = 0
  let batchSize = 0

  // Greedy fill: Add emails until we hit the limit
  for (
    let i = startIndex;
    i < Math.min(startIndex + maxBatchSize, emails.length);
    i++
  ) {
    const emailTokens = estimateEmailTokens(emails[i])

    if (cumulativeTokens + emailTokens > availableTokens) {
      break  // Would exceed limit
    }

    cumulativeTokens += emailTokens
    batchSize++
  }

  // Enforce minimum batch size (may slightly exceed context)
  const remainingEmails = emails.length - startIndex
  if (batchSize < minBatchSize && remainingEmails >= minBatchSize) {
    batchSize = Math.min(minBatchSize, remainingEmails)
  }

  // Edge case: Single email exceeds context
  if (batchSize === 0 && remainingEmails > 0) {
    batchSize = 1  // Process anyway (may truncate body)
  }

  return batchSize
}
```

**Initialization in Workflow**:

**File**: `/src/browser/agents/iab-classifier/nodes/loadEmails.ts` (line 87)

```typescript
// Calculate batch size based on model's context window
const contextWindow = state.model_context_window || 128000  // Default: 128K
const batchSize = calculateBatchSize(
  state.emails,
  contextWindow,
  state.current_batch_start,
  0.70,  // targetUtilization
  5,     // minBatchSize
  50     // maxBatchSize
)

return {
  batch_size: batchSize,
  model_context_window: contextWindow
}
```

### 3.2 Performance Characteristics

**Example: GPT-4o-mini (128K context)**

| Metric | Value |
|--------|-------|
| Context Window | 128,000 tokens |
| Reserved (30%) | 38,400 tokens |
| Available (70%) | 89,600 tokens |
| Avg Email Size | 1,500 tokens |
| **Batch Size** | **~60 emails** |
| Capped at `maxBatchSize` | **50 emails** |

**Example: Claude Sonnet 4 (200K context)**

| Metric | Value |
|--------|-------|
| Context Window | 200,000 tokens |
| Reserved (30%) | 60,000 tokens |
| Available (70%) | 140,000 tokens |
| Avg Email Size | 1,500 tokens |
| **Batch Size** | **~93 emails** |
| Capped at `maxBatchSize` | **50 emails** |

**Example: Gemini 2.0 Flash (1M context)**

| Metric | Value |
|--------|-------|
| Context Window | 1,000,000 tokens |
| Reserved (30%) | 300,000 tokens |
| Available (70%) | 700,000 tokens |
| Avg Email Size | 1,500 tokens |
| **Batch Size** | **~466 emails** |
| Capped at `maxBatchSize` | **50 emails** |

---

## 4. LLM Infrastructure

### 4.1 Base Client Architecture

**File**: `/src/browser/llm/base.ts` (752 lines)

**Abstract Class**:
```typescript
export abstract class BaseLLMClient {
  protected config: Record<string, any>
  protected logger: Logger

  constructor(config: Record<string, any> = {}) {
    this.config = config
    this.logger = config.logger || new Logger()
  }

  // ===== ABSTRACT METHODS (must implement) =====
  abstract getProvider(): LLMProvider
  abstract isAvailable(): Promise<boolean>
  abstract generate(request: LLMRequest): Promise<LLMResponse>
  abstract getSupportedModels(): Promise<Array<string>>
  abstract estimateCost(request: LLMRequest): Promise<number | undefined>

  // ===== CONCRETE METHODS (provided) =====
  validateRequest(request: LLMRequest): Array<string>
  prepareMessages(request: LLMRequest): Array<LLMMessage>
  createErrorResponse(error: string, model: string): LLMResponse
  analyzeEmail(email_content: string, model: string): Promise<Record<string, any>>
}
```

**Key Interfaces**:

**LLMRequest**:
```typescript
export interface LLMRequest {
  messages: Array<LLMMessage>
  model?: string
  max_tokens?: number
  temperature?: number
  system_prompt?: string
  json_mode?: boolean
}
```

**LLMResponse**:
```typescript
export interface LLMResponse {
  content: string
  model: string
  usage: Record<string, any>  // { prompt_tokens, completion_tokens }
  metadata: Record<string, any>
  success: boolean
  error?: string | Record<string, any>
  cost?: number
  finish_reason?: string
}
```

**LLMMessage**:
```typescript
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
```

### 4.2 Model Registry

**File**: `/src/browser/llm/modelRegistry.ts` (714 lines)

**Purpose**: Fetch actual context window limits from provider APIs

**Key Functions**:

**1. OpenAI Context Windows**:
```typescript
/**
 * Get context window for OpenAI model.
 * Python source: model_registry.py:24-89
 */
export async function getContextWindowOpenai(
  client: any,
  modelName: string,
  logger: Logger
): Promise<number> {
  try {
    // Note: OpenAI API doesn't expose model info endpoint
    // Use documented limits with prefix matching

    if (modelName.startsWith('gpt-4o-mini')) {
      return 128000
    } else if (modelName.startsWith('gpt-4o')) {
      return 128000
    } else if (modelName.startsWith('gpt-4-turbo')) {
      return 128000
    } else if (modelName.startsWith('gpt-4')) {
      return 8192
    } else if (modelName.startsWith('o1-preview')) {
      return 128000
    } else if (modelName.startsWith('o1-mini')) {
      return 128000
    }

    return 128000  // Default fallback
  } catch (error) {
    logger.warn(`Failed to get context window for ${modelName}: ${error}`)
    return 128000
  }
}
```

**2. Claude Context Windows**:
```typescript
/**
 * Get context window for Claude model.
 * Python source: model_registry.py:130-167
 */
export async function getContextWindowClaude(
  client: any,
  modelName: string,
  logger: Logger
): Promise<number> {
  // Anthropic doesn't expose context via API
  // Use documented limits

  if (modelName.includes('claude-3') || modelName.includes('claude-sonnet-4')) {
    return 200000  // All Claude 3+ models: 200K
  }

  return 200000  // Default
}
```

**3. Google Context Windows** (DYNAMIC):
```typescript
/**
 * Get context window for Google Gemini model.
 * Python source: model_registry.py:200-245
 *
 * CRITICAL: Google API exposes input_token_limit!
 */
export async function getContextWindowGoogle(
  client: any,
  modelName: string,
  logger: Logger
): Promise<number> {
  try {
    // Google API provides model metadata
    const modelInfo = await client.models.get({ model: `models/${modelName}` })
    return modelInfo.inputTokenLimit  // 1,000,000 for Gemini 2.0
  } catch (error) {
    logger.warn(`Failed to fetch Google model info: ${error}`)

    // Fallback to documented limits
    if (modelName.includes('gemini-2.0') || modelName.includes('gemini-1.5')) {
      return 1000000
    } else if (modelName.includes('gemini-1.0')) {
      return 30720
    }

    return 1000000  // Default
  }
}
```

**4. Max Completion Tokens**:
```typescript
export async function getMaxCompletionTokensOpenai(
  client: any,
  modelName: string,
  logger: Logger
): Promise<number> {
  if (modelName.includes('gpt-4o')) {
    return 16384
  } else if (modelName.includes('o1-preview')) {
    return 32768
  } else if (modelName.includes('o1-mini')) {
    return 65536
  }

  return 4096  // Default
}

export async function getMaxCompletionTokensClaude(
  client: any,
  modelName: string,
  logger: Logger
): Promise<number> {
  return 8192  // All Claude 3+ models
}

export async function getMaxCompletionTokensGoogle(
  client: any,
  modelName: string,
  logger: Logger
): Promise<number> {
  return 8192  // Gemini 1.5+
}
```

**Documented Limits** (as of 2025-01-09):

**OpenAI:**
```typescript
const OPENAI_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'o1-preview': 128000,
  'o1-mini': 128000
}

const OPENAI_MAX_COMPLETION_TOKENS: Record<string, number> = {
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'gpt-4-turbo': 4096,
  'o1-preview': 32768,
  'o1-mini': 65536
}
```

**Claude:**
```typescript
const CLAUDE_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-sonnet-4': 200000,
  'claude-sonnet-4-5': 200000,
  'claude-3-5-sonnet': 200000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000
}

const CLAUDE_MAX_COMPLETION_TOKENS = 8192  // All models
```

**Google:**
```typescript
const GOOGLE_CONTEXT_WINDOWS: Record<string, number> = {
  'gemini-2.0-flash-exp': 1000000,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,
  'gemini-1.0-pro': 30720
}

const GOOGLE_MAX_COMPLETION_TOKENS = 8192  // Gemini 1.5+
```

### 4.3 OpenAI Client

**File**: `/src/browser/llm/openaiClient.ts` (1,051 lines)

**Class Definition**:
```typescript
import OpenAI from 'openai'

export class OpenAIClient extends BaseLLMClient {
  private client: OpenAI

  constructor(config: Record<string, any> = {}) {
    super(config)

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key required')
    }

    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: config.dangerouslyAllowBrowser || false
    })
  }

  getProvider(): LLMProvider {
    return LLMProvider.OPENAI
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || this.config.defaultModel || 'gpt-4o-mini'
    const temperature = request.temperature ?? 0.7
    const max_tokens = request.max_tokens

    try {
      // Prepare messages
      const messages = this.prepareMessages(request)

      // Call OpenAI API
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens,
        response_format: request.json_mode ? { type: 'json_object' } : undefined
      })

      // Extract content
      const content = response.choices[0]?.message?.content || ''

      // Calculate cost
      const cost = this.calculateCost(
        model,
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      )

      return {
        content,
        model,
        usage: response.usage || {},
        metadata: { finish_reason: response.choices[0]?.finish_reason },
        success: true,
        cost
      }
    } catch (error) {
      return this.createErrorResponse(error.message, model)
    }
  }

  private calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): number {
    const pricing = this.getPricing(model)
    return (
      (promptTokens / 1_000_000) * pricing.input +
      (completionTokens / 1_000_000) * pricing.output
    )
  }

  private getPricing(model: string): { input: number; output: number } {
    // Pricing per 1M tokens (as of 2025-01-09)
    const PRICING: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 }
    }

    // Prefix match
    for (const [key, value] of Object.entries(PRICING)) {
      if (model.startsWith(key)) {
        return value
      }
    }

    return { input: 0.15, output: 0.60 }  // Default: gpt-4o-mini
  }
}
```

**Token Estimation**:
```typescript
estimateTokens(text: string): number {
  // Approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}
```

**Retry Logic**:
```typescript
async generateWithRetry(
  request: LLMRequest,
  maxRetries: number = 3
): Promise<LLMResponse> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.generate(request)
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000  // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}
```

### 4.4 Claude Client

**File**: `/src/browser/llm/claudeClient.ts` (903 lines)

**Key Differences**:

1. **System Message Extraction**:
```typescript
prepareMessages(request: LLMRequest): {
  system: string | undefined
  messages: Array<LLMMessage>
} {
  const messages = request.messages || []

  // Extract system messages (Claude requires separate parameter)
  const systemMessages = messages.filter(m => m.role === 'system')
  const userMessages = messages.filter(m => m.role !== 'system')

  const system = systemMessages.length > 0
    ? systemMessages.map(m => m.content).join('\n\n')
    : undefined

  return { system, messages: userMessages }
}
```

2. **Response Format**:
```typescript
// Claude returns content as array of blocks
const content = response.content[0]?.text || ''
```

3. **Pricing**:
```typescript
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 }
}
```

### 4.5 Cost Tracking

**File**: `/src/browser/agents/iab-classifier/costTracker.ts` (487 lines)

**Class Definition**:
```typescript
export class CostTracker {
  private calls: Array<LLMCall> = []
  private provider_stats: Record<string, ProviderStats> = {}
  private session_start: string = new Date().toISOString()

  constructor() {
    // Initialize provider stats
    this.provider_stats = {
      openai: { total_calls: 0, total_tokens: 0, total_cost_usd: 0 },
      claude: { total_calls: 0, total_tokens: 0, total_cost_usd: 0 },
      google: { total_calls: 0, total_tokens: 0, total_cost_usd: 0 }
    }
  }

  trackCall(
    provider: string,
    model: string,
    prompt_tokens: number,
    completion_tokens: number
  ): number {
    const pricing = this.getPricing(provider, model)
    const totalCost = (
      (prompt_tokens / 1_000_000) * pricing.input_per_1m +
      (completion_tokens / 1_000_000) * pricing.output_per_1m
    )

    // Record call
    this.calls.push({
      timestamp: new Date().toISOString(),
      provider,
      model,
      prompt_tokens,
      completion_tokens,
      cost_usd: totalCost
    })

    // Update stats
    if (this.provider_stats[provider]) {
      this.provider_stats[provider].total_calls++
      this.provider_stats[provider].total_tokens += (prompt_tokens + completion_tokens)
      this.provider_stats[provider].total_cost_usd += totalCost
    }

    return totalCost
  }

  getTotalCost(): number {
    return this.calls.reduce((sum, call) => sum + call.cost_usd, 0)
  }

  getTotalTokens(): number {
    return this.calls.reduce(
      (sum, call) => sum + call.prompt_tokens + call.completion_tokens,
      0
    )
  }

  getSummary(emails_processed?: number): string {
    const totalCost = this.getTotalCost()
    const totalTokens = this.getTotalTokens()
    const totalCalls = this.calls.length

    let summary = `Total Cost: $${totalCost.toFixed(4)}\n`
    summary += `Total LLM Calls: ${totalCalls}\n`
    summary += `Total Tokens: ${totalTokens.toLocaleString()}\n`

    if (totalCalls > 0) {
      summary += `Average Cost per Call: $${(totalCost / totalCalls).toFixed(4)}\n`
    }

    if (emails_processed) {
      summary += `Average Cost per Email: $${(totalCost / emails_processed).toFixed(4)}\n`
    }

    return summary
  }
}
```

---

## 5. IAB Analyzer Agents

### 5.1 Shared Pattern (All 4 Analyzers)

**File Example**: `/src/browser/agents/iab-classifier/agents/demographics.ts` (279 lines)

**Function Signature**:
```typescript
/**
 * Extract demographics classifications using ReAct agent.
 * Python source: agents/demographics_agent.py:24-277
 */
export async function extract_demographics_with_agent(params: {
  emails: Record<string, any>[]
  llm_client: AnalyzerLLMClient
  max_iterations?: number  // Default: 1
  logger?: Logger
}): Promise<{
  classifications: Record<string, any>[]
  iterations: number
  tool_calls: number
}>
```

**Execution Steps**:

**1. Get Taxonomy Context** (cached):
```typescript
import { getCachedTaxonomyContext } from '../taxonomy/taxonomyContext'

const taxonomy_context = getCachedTaxonomyContext('demographics')
// Returns: "ID 5 (Age Range): 18-24, 25-29, 30-34, ..."
```

**2. Format Emails for Prompt**:
```typescript
const email_number_to_id: Record<number, string> = {}
const email_text_parts: string[] = []

for (let i = 0; i < emails.slice(0, 50).length; i++) {
  const email = emails[i]
  email_number_to_id[i + 1] = email.id || `unknown_${i}`

  const subject = email.subject || 'No subject'
  const sender = email.from || email.sender || 'Unknown sender'
  const summary = email.summary || email.body || ''

  email_text_parts.push(
    `Email ${i + 1}:\n` +
    `Subject: ${subject}\n` +
    `From: ${sender}\n` +
    `Summary: ${summary.slice(0, 500)}...\n\n`
  )
}

const email_text = email_text_parts.join('\n')
```

**3. Build Prompts**:
```typescript
import {
  DEMOGRAPHICS_AGENT_SYSTEM_PROMPT,
  DEMOGRAPHICS_AGENT_USER_PROMPT
} from '../llm/prompts'

const system_prompt = `${DEMOGRAPHICS_AGENT_SYSTEM_PROMPT}\n\n` +
  `## Available Taxonomy Entries\n\n${taxonomy_context}`

let user_prompt = DEMOGRAPHICS_AGENT_USER_PROMPT
  .replace('{email_batch}', email_text)
  .replace('{batch_size}', emails.length.toString())
```

**4. ReAct Loop** (Validation + Reflection):
```typescript
let tool_calls = 0
let iterations = 0
let classifications: Record<string, any>[] = []

for (let iteration = 0; iteration < max_iterations; iteration++) {
  iterations++

  // ===== CALL LLM =====
  const response = await llm_client.analyze_email({
    prompt: `${system_prompt}\n\n${user_prompt}`,
    temperature: 0.1
  })

  const parsed_classifications = response.classifications || []

  // ===== TAXONOMY VALIDATION =====
  let all_valid = true
  const taxonomy_valid_classifications: Record<string, any>[] = []

  for (const classification of parsed_classifications) {
    tool_calls++

    const { taxonomy_id, value } = classification
    const validation_result = validateClassification(taxonomy_id, value)

    if (validation_result.valid) {
      taxonomy_valid_classifications.push(classification)
    } else {
      all_valid = false

      // Add reflection prompt
      user_prompt += `\n\nREFLECTION: Classification ${taxonomy_id}=${value} is INVALID.\n`
      user_prompt += `Expected value: '${validation_result.expected_value}'.\n`
      user_prompt += `Please correct this classification in your next response.\n`

      break  // Stop validating, trigger retry
    }
  }

  // ===== EVIDENCE QUALITY VALIDATION (BATCH PARALLEL) =====
  let validated_classifications: Record<string, any>[] = []

  if (taxonomy_valid_classifications.length > 0) {
    const evidence_evals = await evaluate_evidence_quality_batch({
      classifications: taxonomy_valid_classifications,
      email_context: email_text,
      section_guidelines: DEMOGRAPHICS_EVIDENCE_GUIDELINES,
      llm_client,
      max_workers: 5,  // Parallel (Promise.all in browser)
      actual_batch_size: emails.length
    })

    // Adjust confidence + filter blocks
    for (let i = 0; i < taxonomy_valid_classifications.length; i++) {
      let classification = adjust_confidence_with_evidence_quality(
        taxonomy_valid_classifications[i],
        evidence_evals[i]
      )

      // Block if quality_score < 0.15
      if (should_block_classification(evidence_evals[i].quality_score)) {
        logger.warn(
          `Blocked classification: ${classification.value} ` +
          `(quality_score=${evidence_evals[i].quality_score})`
        )
        continue  // Skip this classification
      }

      // Map email_numbers → email_ids
      classification.email_ids = (classification.email_numbers || [])
        .map((n: number) => email_number_to_id[n])

      validated_classifications.push(classification)
    }
  }

  // ===== CHECK COMPLETION =====
  if (all_valid && validated_classifications.length > 0) {
    classifications = validated_classifications
    break  // Success, exit loop
  }

  // Continue to next iteration (reflection)
}

return { classifications, iterations, tool_calls }
```

### 5.2 All 4 Analyzer Files

| Analyzer | File | Lines | Taxonomy IDs |
|----------|------|-------|--------------|
| **Demographics** | `/src/browser/agents/iab-classifier/agents/demographics.ts` | 279 | Age (5), Gender (50), Education (70), Employment (80) |
| **Household** | `/src/browser/agents/iab-classifier/agents/household.ts` | 279 | Income (110), Marital Status (120), Children (130), Location (300) |
| **Interests** | `/src/browser/agents/iab-classifier/agents/interests.ts` | 279 | Hobbies (342), Lifestyle (156), Brands (450) |
| **Purchase Intent** | `/src/browser/agents/iab-classifier/agents/purchase.ts` | 279 | Shopping Behavior (520), Product Categories (530) |

**All follow identical structure** (only differ in taxonomy context and prompts)

### 5.3 Analyzer Node (Runs All 4 Sequentially)

**File**: `/src/browser/agents/iab-classifier/nodes/analyzers.ts` (1,003 lines)

```typescript
/**
 * Run all 4 analyzers sequentially.
 * Python source: analyzers.py:890-940 (analyze_all_node)
 */
export async function analyzeAllNode(
  state: typeof WorkflowState.State
): Promise<Partial<typeof WorkflowState.State>> {
  const { emails, llm_provider, llm_model, llm_config } = state

  // Initialize LLM client
  const llm_client = new AnalyzerLLMClient({
    provider: llm_provider,
    model: llm_model,
    config: llm_config
  })

  // Run all 4 analyzers
  const demographics_result = await extract_demographics_with_agent({
    emails,
    llm_client
  })

  const household_result = await extract_household_with_agent({
    emails,
    llm_client
  })

  const interests_result = await extract_interests_with_agent({
    emails,
    llm_client
  })

  const purchase_result = await extract_purchase_with_agent({
    emails,
    llm_client
  })

  return {
    demographics_results: demographics_result.classifications,
    household_results: household_result.classifications,
    interests_results: interests_result.classifications,
    purchase_results: purchase_result.classifications
  }
}
```

---

## 6. Evidence Judge System

### 6.1 Core Function

**File**: `/src/browser/agents/iab-classifier/llm/evidenceJudge.ts` (387 lines)

**Single Evaluation**:
```typescript
/**
 * Evaluate evidence quality for a single classification.
 * Python source: evidence_judge.py:28-181
 */
export async function evaluate_evidence_quality(params: {
  classification: Record<string, any>
  email_context: string
  section_guidelines: string
  llm_client: AnalyzerLLMClient
  actual_batch_size?: number | null
}): Promise<EvidenceEvaluation> {
  const {
    classification,
    email_context,
    section_guidelines,
    llm_client,
    actual_batch_size
  } = params

  // ===== HALLUCINATION DETECTION =====
  const email_numbers = classification.email_numbers || []
  if (actual_batch_size && email_numbers.length > 0) {
    const max_cited = Math.max(...email_numbers)
    if (max_cited > actual_batch_size) {
      return {
        is_valid: false,
        quality_score: 0.0,
        evidence_type: 'inappropriate',
        issue: `HALLUCINATION: Cites Email ${max_cited} but batch only has ${actual_batch_size} emails.`
      }
    }
  }

  // ===== BUILD JUDGE PROMPT =====
  const judge_prompt = `
## Section Evidence Guidelines:
${section_guidelines}

## Classification to Evaluate:
- Taxonomy ID: ${classification.taxonomy_id}
- Value: ${classification.value}
- Reasoning: ${classification.reasoning}

## Email Context:
${email_context.slice(0, 2000)}  # Limit to 2K chars

## Task:
Return ONLY JSON:
{
  "is_valid": true/false,
  "quality_score": 0.0-1.0,
  "evidence_type": "explicit|contextual|weak|inappropriate",
  "issue": "explanation if invalid"
}
`

  // ===== CALL LLM JUDGE =====
  const response = await llm_client.call_json({
    prompt: judge_prompt,
    temperature: 0.0,  // Deterministic
    max_tokens: 1024
  })

  return {
    is_valid: response.is_valid ?? true,
    quality_score: response.quality_score ?? 1.0,
    evidence_type: response.evidence_type || 'unknown',
    issue: response.issue || ''
  }
}
```

### 6.2 Batch Parallel Evaluation

**Function**: `evaluate_evidence_quality_batch()` (line 184)

```typescript
/**
 * Evaluate multiple classifications in parallel.
 * Python source: evidence_judge.py:184-230 (ThreadPoolExecutor)
 * TypeScript: Uses Promise.all for browser compatibility
 */
export async function evaluate_evidence_quality_batch(params: {
  classifications: Record<string, any>[]
  email_context: string
  section_guidelines: string
  llm_client: AnalyzerLLMClient
  max_workers?: number  // Ignored (kept for API compatibility)
  actual_batch_size?: number | null
}): Promise<EvidenceEvaluation[]> {
  const {
    classifications,
    email_context,
    section_guidelines,
    llm_client,
    actual_batch_size
  } = params

  // Single classification: No parallelism overhead
  if (classifications.length === 1) {
    return [
      await evaluate_evidence_quality({
        classification: classifications[0],
        email_context,
        section_guidelines,
        llm_client,
        actual_batch_size
      })
    ]
  }

  // ===== PARALLEL EVALUATION (Promise.all) =====
  async function evaluate_single(
    index: number,
    classification: Record<string, any>
  ): Promise<[number, EvidenceEvaluation]> {
    const result = await evaluate_evidence_quality({
      classification,
      email_context,
      section_guidelines,
      llm_client,
      actual_batch_size
    })
    return [index, result]
  }

  const promises = classifications.map((c, i) => evaluate_single(i, c))
  const results_with_indices = await Promise.all(promises)

  // Sort by index to preserve order
  const results = new Array(classifications.length)
  for (const [index, result] of results_with_indices) {
    results[index] = result
  }

  return results
}
```

**Performance**:
- 20 classifications × 3 seconds/call = 60 seconds (sequential)
- 20 classifications via Promise.all ≈ 3 seconds (parallel, browser)
- **Speedup**: 20x (limited by API rate limits in practice)

### 6.3 Quality Scoring Constants

```typescript
export const QUALITY_EXPLICIT = 1.0      // Direct statement ("I'm 35 years old")
export const QUALITY_CONTEXTUAL = 0.7    // Strong inference (graduation year → age)
export const QUALITY_WEAK = 0.4          // Indirect signal (retirement → age 50+)
export const QUALITY_INAPPROPRIATE = 0.0 // Wrong evidence type (products → gender)
```

### 6.4 Confidence Adjustment

**Function**: `adjust_confidence_with_evidence_quality()` (line 268)

```typescript
/**
 * Adjust confidence based on evidence quality.
 * Python source: evidence_judge.py:268-320
 */
export function adjust_confidence_with_evidence_quality(
  classification: Record<string, any>,
  evidence_evaluation: EvidenceEvaluation
): Record<string, any> {
  const original_conf = classification.confidence || 0.0
  const quality_score = evidence_evaluation.quality_score ?? 1.0
  const evidence_type = evidence_evaluation.evidence_type || 'unknown'

  let adjusted_conf: number

  // Less harsh penalty for contextual evidence
  if (evidence_type === 'contextual' && quality_score >= 0.6 && quality_score <= 0.8) {
    adjusted_conf = original_conf * Math.min(0.85, quality_score + 0.15)
  }
  // Less harsh penalty for weak evidence
  else if (evidence_type === 'weak' && quality_score >= 0.3 && quality_score <= 0.5) {
    adjusted_conf = original_conf * Math.min(0.65, quality_score + 0.25)
  }
  // Standard penalty
  else {
    adjusted_conf = original_conf * quality_score
  }

  // Clamp to [0.0, 1.0]
  adjusted_conf = Math.max(0.0, Math.min(1.0, adjusted_conf))

  // Update classification
  classification.confidence = adjusted_conf
  classification.original_confidence = original_conf
  classification.evidence_quality = quality_score
  classification.evidence_type = evidence_evaluation.evidence_type

  return classification
}
```

### 6.5 Blocking Threshold

```typescript
/**
 * Check if classification should be blocked.
 * Python source: evidence_judge.py:333-342
 */
export function should_block_classification(
  quality_score: number,
  threshold: number = 0.15
): boolean {
  return quality_score < threshold
}
```

---

## 7. Taxonomy System

### 7.1 Structure

**File**: `/src/browser/taxonomy/IABTaxonomyLoader.ts`

**Full IAB Taxonomy 1.1**:
- 1,558 entries
- Tier hierarchy: section | tier1 | tier2 | tier3 | tier4 | tier5
- Sections: demographics, household, interests, purchase_intent

**Entry Schema**:
```typescript
interface TaxonomyEntry {
  taxonomy_id: number
  section: string
  tier1: string
  tier2: string
  tier3: string
  tier4: string
  tier5: string
  category_path: string  // Concatenated tiers
  grouping_tier_key: string
  grouping_value: string
}
```

### 7.2 Taxonomy Context (Cached)

**File**: `/src/browser/agents/iab-classifier/taxonomy/taxonomyContext.ts`

**Function**: `getCachedTaxonomyContext()`

```typescript
const TAXONOMY_CONTEXT_CACHE: Record<string, string> = {}

export function getCachedTaxonomyContext(section: string): string {
  if (TAXONOMY_CONTEXT_CACHE[section]) {
    return TAXONOMY_CONTEXT_CACHE[section]
  }

  // Load taxonomy entries for section
  const entries = searchTaxonomy(section)

  // Format as text for LLM
  const context = entries.map(entry => {
    const tiers = [entry.tier1, entry.tier2, entry.tier3, entry.tier4, entry.tier5]
      .filter(t => t && t !== '')
      .join(' | ')

    return `ID ${entry.taxonomy_id}: ${entry.section} | ${tiers}`
  }).join('\n')

  // Cache
  TAXONOMY_CONTEXT_CACHE[section] = context

  return context
}
```

**Example Output**:
```
ID 5: Demographics | Age Range | 18-24
ID 6: Demographics | Age Range | 25-29
ID 7: Demographics | Age Range | 30-34
ID 50: Demographics | Gender | Male
ID 51: Demographics | Gender | Female
...
```

### 7.3 Validation Tools

**File**: `/src/browser/agents/iab-classifier/analyzers/tools.ts`

**Function**: `validateClassification()`

```typescript
/**
 * Validate if taxonomy_id matches expected value.
 * Python source: agents/tools.py
 */
export function validateClassification(
  taxonomy_id: number,
  value: string
): {
  valid: boolean
  expected_value: string | null
  provided_value: string
} {
  const entry = taxonomy_map.get(taxonomy_id)

  if (!entry) {
    return {
      valid: false,
      expected_value: null,
      provided_value: value
    }
  }

  // Get expected value (deepest tier)
  const expected_value = entry.tier5 || entry.tier4 || entry.tier3 || entry.tier2 || entry.tier1

  // Normalize both values
  const expected_norm = expected_value.toLowerCase().trim()
  const provided_norm = value.toLowerCase().trim()

  return {
    valid: expected_norm === provided_norm,
    expected_value,
    provided_value: value
  }
}
```

---

## 8. Memory & Store Integration

### 8.1 IndexedDB Store (Browser)

**File**: `/src/browser/store/IndexedDBStore.ts`

**Features**:
- LangGraph BaseStore implementation
- Browser-compatible (no Node.js dependencies)
- Namespace organization: `[user_id, namespace_key]`
- CRUD operations: `put()`, `get()`, `search()`, `delete()`

**Usage**:
```typescript
import { IndexedDBStore } from '@/browser/store/IndexedDBStore'

const store = await IndexedDBStore.create('ownyou_iab_store')

// Store classification
await store.put(
  ['user_123', 'semantic_memory'],
  'demographics::5::25-29',
  {
    taxonomy_id: 5,
    value: '25-29',
    confidence: 0.95,
    ...
  }
)

// Retrieve classification
const memory = await store.get(
  ['user_123', 'semantic_memory'],
  'demographics::5::25-29'
)
```

### 8.2 In-Memory Store (Admin Dashboard)

**File**: `/src/admin-dashboard/lib/shared-store.ts`

```typescript
import { InMemorySaver } from '@langchain/langgraph'

const userStores = new Map<string, InMemorySaver>()

export function getStore(userId: string): InMemorySaver {
  if (!userStores.has(userId)) {
    userStores.set(userId, new InMemorySaver())
  }
  return userStores.get(userId)!
}

export function clearStore(userId: string): void {
  userStores.delete(userId)
}
```

**Usage in API Route**:
```typescript
// /app/api/classify/route.ts
import { getStore } from '@/lib/shared-store'

const store = getStore(user_id)
const graph = buildWorkflowGraph(store, null)
```

### 8.3 Namespace Organization

**Format**:
```
[user_id, namespace_key] → key → value
```

**Examples**:
```typescript
// IAB Profile (reconciled)
['user_123', 'iab_profile'] → 'current' → { demographics: {...}, household: {...}, ... }

// Raw Classifications
['user_123', 'iab_classifications'] → 'demographics::5::25-29' → { taxonomy_id: 5, ... }

// Email Metadata
['user_123', 'email_metadata'] → 'email_abc123' → { processed: true, ... }
```

### 8.4 Reconciliation Logic

**File**: `/src/browser/agents/iab-classifier/nodes/reconcile.ts`

```typescript
/**
 * Reconcile classifications with Bayesian confidence update.
 * Python source: reconciliation.py:81-288
 */
export async function reconcileEvidenceNode(
  state: typeof WorkflowState.State,
  memoryManager: MemoryManager
): Promise<Partial<typeof WorkflowState.State>> {
  // Merge all classifications
  const all_classifications = [
    ...(state.demographics_results || []),
    ...(state.household_results || []),
    ...(state.interests_results || []),
    ...(state.purchase_results || [])
  ]

  // Group by taxonomy_id + value
  const grouped: Record<string, Record<string, any>[]> = {}
  for (const c of all_classifications) {
    const key = `${c.taxonomy_id}::${c.value}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(c)
  }

  // Apply reconciliation rules
  const reconciliation_data: Record<string, any>[] = []
  const updated_profile: Record<string, any> = {}

  for (const [key, classifications] of Object.entries(grouped)) {
    // Multi-source agreement
    const avg_confidence = classifications.reduce(
      (sum, c) => sum + c.confidence, 0
    ) / classifications.length

    // Temporal decay (if existing memory)
    // Evidence quality filtering (already applied)

    // Store reconciliation
    reconciliation_data.push({
      taxonomy_id: classifications[0].taxonomy_id,
      value: classifications[0].value,
      confidence: avg_confidence,
      evidence_count: classifications.length,
      ...
    })
  }

  return { reconciliation_data, updated_profile }
}
```

---

## 9. Admin Dashboard Integration

### 9.1 OAuth Routes

**Gmail Authorization**:

**File**: `/src/admin-dashboard/app/api/auth/gmail/authorize/route.ts`

```typescript
export async function GET() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly']
  })

  return NextResponse.redirect(authUrl)
}
```

**Gmail Callback**:

**File**: `/src/admin-dashboard/app/api/auth/gmail/callback/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  // Store tokens in session
  // Redirect to dashboard

  return NextResponse.redirect('/emails')
}
```

**Similar for Outlook** (`/api/auth/outlook/{authorize,callback}`)

### 9.2 Email Download API

**File**: `/src/admin-dashboard/app/api/emails/download/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { provider, max_emails } = await request.json()

  if (provider === 'gmail') {
    // Use Gmail API
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: max_emails
    })

    const emails = await Promise.all(
      response.data.messages.map(async (msg) => {
        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id })
        return {
          id: full.data.id,
          subject: getHeader(full.data, 'Subject'),
          from: getHeader(full.data, 'From'),
          body: getBody(full.data)
        }
      })
    )

    return NextResponse.json({ emails })
  }

  // Similar for Outlook
}
```

---

## 10. 3-Stage Email Processing Pipeline

### 10.1 Stage 1: Download (OAuth)

**Frontend** (`/app/emails/page.tsx`):
```typescript
const handleDownload = async () => {
  const response = await fetch('/api/emails/download', {
    method: 'POST',
    body: JSON.stringify({ provider: 'gmail', max_emails: 50 })
  })

  const { emails } = await response.json()
  setEmails(emails)
}
```

### 10.2 Stage 2: Summarize (Concurrent LLM Calls)

**API Route** (`/app/api/summarize/route.ts` - 161 lines):

```typescript
/**
 * Summarize a single email.
 * Python source: base.py:130-190 (analyze_email)
 */
export async function POST(request: NextRequest) {
  const { email_content, llm_provider, llm_model, llm_config } = await request.json()

  // Build prompt
  const system_prompt = `Extract the following from the email:
- summary (2-3 sentences)
- products (mentioned products/services)
- category (shopping, finance, news, etc.)
- sentiment (positive, neutral, negative)
- key_topics (main topics discussed)
- action_required (boolean)`

  const user_prompt = `Analyze this email:\n\n${email_content}`

  // Call LLM
  const llm = createLLMClient(llm_provider, llm_model, llm_config)
  const response = await llm.invoke([
    { role: 'system', content: system_prompt },
    { role: 'user', content: user_prompt }
  ])

  // Parse response
  const parsed = JSON.parse(response.content)

  return NextResponse.json({
    summary: parsed.summary,
    products: parsed.products,
    category: parsed.category,
    sentiment: parsed.sentiment,
    key_topics: parsed.key_topics,
    action_required: parsed.action_required
  })
}
```

**Frontend - Concurrent Execution**:
```typescript
const handleSummarize = async () => {
  console.log('[Concurrent Summarization] Processing', emails.length, 'emails')

  // Create promises for all emails
  const summaryPromises = emails.map((email, index) =>
    fetch('/api/summarize', {
      method: 'POST',
      body: JSON.stringify({
        email_content: email.body,
        llm_provider: selectedEmailModel.split(':')[0],
        llm_model: selectedEmailModel.split(':')[1],
        llm_config: { /* API keys */ }
      })
    }).then(r => r.json())
  )

  // Execute all in parallel
  const summaries = await Promise.all(summaryPromises)

  // Merge summaries back into emails
  const emailsWithSummaries = emails.map((email, i) => ({
    ...email,
    summary: summaries[i].summary
  }))

  setEmails(emailsWithSummaries)
}
```

**Performance**:
- 5 emails × 2 seconds/call = 10 seconds (sequential)
- 5 emails via Promise.all ≈ 2 seconds (parallel)
- **Speedup**: 5x

### 10.3 Stage 3: Classify (Batch Processing)

**API Route** (`/app/api/classify/route.ts` - 153 lines):

```typescript
/**
 * Classify emails using batch processing.
 * Python source: main.py:380-542 (generate_iab_profile)
 */
export async function POST(request: NextRequest) {
  const { user_id, emails, llm_provider, llm_model } = await request.json()

  // Get shared in-memory store
  const store = getStore(user_id)

  // Build workflow graph
  const graph = buildWorkflowGraph(store, null)

  // Prepare emails (with summaries from Stage 2)
  const emailsArray = emails.map(email => ({
    id: email.id,
    subject: email.subject,
    from: email.from,
    body: email.body,
    summary: email.summary || email.body.substring(0, 500)  // Prefer LLM summary
  }))

  // Run classification (batch processing)
  const result = await graph.invoke({
    user_id,
    emails: emailsArray,
    llm_provider,
    llm_model,
    total_emails: emailsArray.length,
    current_batch_start: 0,
    batch_size: emailsArray.length  // Process all in one batch
  })

  // Extract classifications
  const allClassifications = [
    ...(result.demographics_results || []),
    ...(result.household_results || []),
    ...(result.interests_results || []),
    ...(result.purchase_results || [])
  ]

  return NextResponse.json({
    success: true,
    all_classifications: allClassifications,
    emails_processed: emailsArray.length,
    cost: result.cost_tracker?.getTotalCost() || 0
  })
}
```

**Frontend**:
```typescript
const handleClassify = async () => {
  const response = await fetch('/api/classify', {
    method: 'POST',
    body: JSON.stringify({
      user_id: 'user_123',
      emails: emailsWithSummaries,  // From Stage 2
      llm_provider: selectedTaxonomyModel.split(':')[0],
      llm_model: selectedTaxonomyModel.split(':')[1]
    })
  })

  const { all_classifications } = await response.json()

  // Display results
  setClassifications(all_classifications)
}
```

**Complete Pipeline Flow**:
```
User clicks "Download & Classify"
  ↓
Stage 1: Download 5 emails (OAuth) → 2 seconds
  ↓
Stage 2: Summarize 5 emails (Promise.all) → 2 seconds
  ↓
Stage 3: Classify 5 emails (batch) → 10 seconds
  ↓
Display results
  ↓
Total: ~14 seconds
```

---

## 11. Type Definitions & Interfaces

### 11.1 Core Types

**Email**:
```typescript
interface Email {
  id: string
  subject: string
  from: string
  body: string
  summary?: string  // From Stage 2 summarization
  date?: string
}
```

**Classification**:
```typescript
interface Classification {
  taxonomy_id: number
  section: 'demographics' | 'household' | 'interests' | 'purchase_intent'
  value: string
  confidence: number  // 0.0-1.0
  category_path: string
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4?: string
  tier_5?: string
  grouping_tier_key: string
  grouping_value: string
  reasoning: string
  email_numbers: number[]
  email_ids: string[]
  original_confidence?: number
  evidence_quality?: number
  evidence_type?: string
}
```

**Evidence Evaluation**:
```typescript
interface EvidenceEvaluation {
  is_valid: boolean
  quality_score: number
  evidence_type: 'explicit' | 'contextual' | 'weak' | 'inappropriate' | 'unknown'
  issue: string
}
```

### 11.2 LLM Types

**LLM Provider Enum**:
```typescript
export enum LLMProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GOOGLE = 'google',
  OLLAMA = 'ollama'
}
```

**LLM Error Types**:
```typescript
export enum LLMError {
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  BAD_REQUEST = 'bad_request',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}
```

### 11.3 Cost Tracking Types

```typescript
interface LLMCall {
  timestamp: string
  provider: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  cost_usd: number
}

interface ProviderStats {
  total_calls: number
  total_tokens: number
  total_cost_usd: number
}
```

---

## 12. Algorithms & Formulas

### 12.1 Token Estimation

```typescript
function estimateEmailTokens(email: Record<string, any>): number {
  const totalChars = email.subject.length + email.sender.length + email.body.length
  const formatOverhead = 100

  // 1 token ≈ 4 characters
  return Math.floor((totalChars + formatOverhead) / 4)
}
```

### 12.2 Batch Size Calculation

```typescript
function calculateBatchSize(
  emails: Email[],
  contextWindow: number,
  startIndex: number = 0,
  targetUtilization: number = 0.70,
  minBatchSize: number = 5,
  maxBatchSize: number = 50
): number {
  const reservedTokens = Math.floor(contextWindow * (1 - targetUtilization))
  const availableTokens = contextWindow - reservedTokens

  let cumulativeTokens = 0
  let batchSize = 0

  for (let i = startIndex; i < Math.min(startIndex + maxBatchSize, emails.length); i++) {
    const emailTokens = estimateEmailTokens(emails[i])

    if (cumulativeTokens + emailTokens > availableTokens) {
      break
    }

    cumulativeTokens += emailTokens
    batchSize++
  }

  // Enforce minimum
  const remainingEmails = emails.length - startIndex
  if (batchSize < minBatchSize && remainingEmails >= minBatchSize) {
    batchSize = Math.min(minBatchSize, remainingEmails)
  }

  // Edge case
  if (batchSize === 0 && remainingEmails > 0) {
    batchSize = 1
  }

  return batchSize
}
```

### 12.3 Confidence Adjustment

```typescript
function adjust_confidence_with_evidence_quality(
  classification: Classification,
  evidence_evaluation: EvidenceEvaluation
): Classification {
  const original_conf = classification.confidence
  const quality_score = evidence_evaluation.quality_score ?? 1.0
  const evidence_type = evidence_evaluation.evidence_type

  let adjusted_conf: number

  if (evidence_type === 'contextual' && quality_score >= 0.6 && quality_score <= 0.8) {
    adjusted_conf = original_conf * Math.min(0.85, quality_score + 0.15)
  } else if (evidence_type === 'weak' && quality_score >= 0.3 && quality_score <= 0.5) {
    adjusted_conf = original_conf * Math.min(0.65, quality_score + 0.25)
  } else {
    adjusted_conf = original_conf * quality_score
  }

  adjusted_conf = Math.max(0.0, Math.min(1.0, adjusted_conf))

  classification.confidence = adjusted_conf
  classification.original_confidence = original_conf
  classification.evidence_quality = quality_score
  classification.evidence_type = evidence_evaluation.evidence_type

  return classification
}
```

---

## 13. Migration from Python

### 13.1 Identical Components

| Component | Implementation |
|-----------|----------------|
| **Workflow Structure** | 6 nodes, same conditional edges |
| **Batch Optimizer** | Token estimation, batch size calculation |
| **IAB Taxonomy** | 1,558 entries, identical structure |
| **Evidence Judge** | LLM-as-Judge, quality scoring, blocking threshold |
| **Confidence Adjustment** | Same formulas (contextual/weak penalties) |
| **ReAct Pattern** | Validation loop, reflection prompts |
| **Taxonomy Validation** | `validateClassification()` logic |

### 13.2 Adapted Components

| Component | Python | TypeScript | Reason |
|-----------|--------|-----------|--------|
| **State Schema** | TypedDict | Annotation.Root | LangGraph.js requirement |
| **Async Pattern** | `asyncio` | `async/await` Promises | JavaScript standard |
| **Parallel Execution** | ThreadPoolExecutor | Promise.all | Browser compatibility |
| **System Messages** | In messages array | Extracted for Claude | SDK requirement |
| **Error Types** | Generic Exception | SDK-specific (RateLimitError) | Type safety |
| **Batch Loop** | Loop in workflow | Frontend responsibility | Deployment model |

### 13.3 Missing/Planned Components

| Component | Status | Notes |
|-----------|--------|-------|
| **Browser PWA UI** | ⚠️ Planned | Infrastructure ready |
| **Browser OAuth** | ⚠️ Planned | TBD (may use Web Auth API) |
| **IndexedDB Checkpointer** | ⚠️ Planned | PGlite with `idb://` |
| **WebLLM Support** | ⚠️ Planned | Local inference option |
| **Service Worker** | ⚠️ Planned | Offline capability |
| **Bayesian Reconciliation** | ⚠️ Simplified | Python has full confidence.py |

### 13.4 TypeScript-Specific Patterns

**Type Safety**:
```typescript
// All data structures have TypeScript interfaces
interface Classification {
  taxonomy_id: number
  value: string
  // ...
}

// Function signatures enforce types
function validateClassification(
  taxonomy_id: number,
  value: string
): { valid: boolean; expected_value: string | null }
```

**Enums**:
```typescript
export enum LLMProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GOOGLE = 'google'
}
```

**Logger Interface** (placeholder):
```typescript
interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}
```

**Browser Compatibility**:
```typescript
// LangGraph imports
import { StateGraph, Annotation } from '@langchain/langgraph/web'

// OpenAI client
const client = new OpenAI({
  apiKey: '...',
  dangerouslyAllowBrowser: true  // Required for browser
})
```

---

## 14. Critical Implementation Details

### 14.1 File Paths & Line Numbers

| Component | File | Lines |
|-----------|------|-------|
| **State Schema** | `/src/browser/agents/iab-classifier/state.ts` | 715 |
| **Graph Builder** | `/src/browser/agents/iab-classifier/index.ts` | 329 |
| **Batch Optimizer** | `/src/browser/agents/iab-classifier/batchOptimizer.ts` | 292 |
| **Base LLM Client** | `/src/browser/llm/base.ts` | 752 |
| **OpenAI Client** | `/src/browser/llm/openaiClient.ts` | 1,051 |
| **Claude Client** | `/src/browser/llm/claudeClient.ts` | 903 |
| **Model Registry** | `/src/browser/llm/modelRegistry.ts` | 714 |
| **Cost Tracker** | `/src/browser/agents/iab-classifier/costTracker.ts` | 487 |
| **Demographics Agent** | `/src/browser/agents/iab-classifier/agents/demographics.ts` | 279 |
| **Household Agent** | `/src/browser/agents/iab-classifier/agents/household.ts` | 279 |
| **Interests Agent** | `/src/browser/agents/iab-classifier/agents/interests.ts` | 279 |
| **Purchase Agent** | `/src/browser/agents/iab-classifier/agents/purchase.ts` | 279 |
| **Analyzer Node** | `/src/browser/agents/iab-classifier/nodes/analyzers.ts` | 1,003 |
| **Evidence Judge** | `/src/browser/agents/iab-classifier/llm/evidenceJudge.ts` | 387 |
| **Reconciliation** | `/src/browser/agents/iab-classifier/nodes/reconcile.ts` | TBD |
| **Classify API** | `/src/admin-dashboard/app/api/classify/route.ts` | 153 |
| **Summarize API** | `/src/admin-dashboard/app/api/summarize/route.ts` | 161 |
| **Shared Store** | `/src/admin-dashboard/lib/shared-store.ts` | ~50 |
| **IndexedDB Store** | `/src/browser/store/IndexedDBStore.ts` | TBD |

### 14.2 Critical Parameters

**Batch Processing**:
- `targetUtilization`: 0.70 (70% for emails, 30% reserve)
- `minBatchSize`: 5
- `maxBatchSize`: 50

**Evidence Judge**:
- `quality_threshold`: 0.15 (block if below)
- `max_workers`: Ignored (Promise.all in browser)

**Retry Logic**:
- `max_retries`: 3
- Backoff: 1s, 2s, 4s (exponential)

### 14.3 Production Deployment

**Admin Dashboard**:
- ✅ Production-ready
- Deployed on Node.js (Next.js)
- In-memory stores (per-user isolation)
- OAuth for Gmail/Outlook

**Browser PWA**:
- ⚠️ Infrastructure ready, UI pending
- IndexedDB for persistent storage
- No server required (self-sovereign)
- Local API keys (user-provided)

---

## Summary

This TypeScript IAB Classifier implementation provides:

- **Two Deployment Models**: Admin Dashboard (Node.js) + Browser PWA (client-side)
- **Complete LangGraph Workflow**: 6 nodes, batch processing, evidence judging
- **Multi-Provider LLM Support**: OpenAI, Claude, Google (Ollama planned)
- **Performance**: 10x speedup via batch processing (5-50 emails per call)
- **Type Safety**: Full TypeScript interfaces and type checking
- **Browser Compatibility**: Promise.all for parallelism, IndexedDB for storage
- **Production Status**: Admin Dashboard ✅ COMPLETE | Browser PWA ⚠️ IN DEVELOPMENT

**Use Case**: Reference for understanding the TypeScript implementation and its relationship to the Python source.

---

**Last Updated**: 2025-11-12
**Maintainer**: OwnYou Development Team
**Status**: Production (Admin Dashboard), Development (Browser PWA)
