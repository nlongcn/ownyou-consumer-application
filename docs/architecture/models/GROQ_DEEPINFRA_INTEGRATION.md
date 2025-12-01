# Groq & DeepInfra Integration Implementation Plan

> **Status:** Draft
> **Created:** November 2025
> **Purpose:** Add zero-data-retention LLM providers for cost-efficient, privacy-preserving inference

---

## 1. Executive Summary

### Why Add These Providers?

| Provider | Key Benefit | Cost (Llama 3.3 70B) | Privacy |
|----------|-------------|---------------------|---------|
| **Current: OpenAI** | Best quality | $2.50/$10.00 per 1M | 30-day retention |
| **Groq** | Fastest inference (~10x) | $0.59/$0.79 per 1M | Zero retention (toggle) |
| **DeepInfra** | Best price/performance | $0.35/$0.40 per 1M | Zero retention (default) |

**Result:**
- **7-25x cost reduction** for high-volume IAB classification
- **Zero data retention** by default (self-sovereign principle)
- **Faster inference** for better UX

### Files to Create/Modify

```
src/browser/llm/
├── types.ts                    # Add GROQ, DEEPINFRA to LLMProvider enum
├── base.ts                     # Update factory with new providers
├── groqClient.ts               # NEW - Groq implementation
├── deepinfraClient.ts          # NEW - DeepInfra implementation
└── modelRegistry.ts            # Add context windows for new providers

src/browser/agents/iab-classifier/llm/
└── client.ts                   # Update AnalyzerLLMClient to support new providers
```

---

## 2. Provider Specifications

### 2.1 Groq

**API Documentation:** https://console.groq.com/docs

**Base URL:** `https://api.groq.com/openai/v1`

**Authentication:** Bearer token (`Authorization: Bearer <API_KEY>`)

**API Compatibility:** OpenAI-compatible (drop-in replacement)

**Key Features:**
- Fastest inference in market (LPU hardware)
- Zero Data Retention toggle in Console
- OpenAI-compatible API format
- Function calling support

**Supported Models:**
| Model | Context | Input/1M | Output/1M | Tool Calling |
|-------|---------|----------|-----------|--------------|
| `llama-3.3-70b-versatile` | 128K | $0.59 | $0.79 | ✅ |
| `llama-3.1-70b-versatile` | 128K | $0.59 | $0.79 | ✅ |
| `llama-3.1-8b-instant` | 128K | $0.05 | $0.08 | ✅ |
| `mixtral-8x7b-32768` | 32K | $0.24 | $0.24 | ✅ |
| `gemma2-9b-it` | 8K | $0.20 | $0.20 | ✅ |

**Request Format:**
```typescript
// Standard OpenAI format
{
  model: "llama-3.3-70b-versatile",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." }
  ],
  max_tokens: 2048,
  temperature: 0.1,
  response_format: { type: "json_object" }  // JSON mode
}
```

**Response Format:**
```typescript
{
  id: "chatcmpl-...",
  object: "chat.completion",
  created: 1234567890,
  model: "llama-3.3-70b-versatile",
  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: "..."
    },
    finish_reason: "stop"
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  }
}
```

**Tool Calling Format:**
```typescript
// Request with tools
{
  model: "llama-3.3-70b-versatile",
  messages: [...],
  tools: [{
    type: "function",
    function: {
      name: "search_taxonomy",
      description: "Search IAB taxonomy for matching categories",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search term" },
          section: { type: "string", enum: ["demographics", "interests", "purchase"] }
        },
        required: ["keyword", "section"]
      }
    }
  }],
  tool_choice: "auto"
}

// Response with tool call
{
  choices: [{
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{
        id: "call_abc123",
        type: "function",
        function: {
          name: "search_taxonomy",
          arguments: "{\"keyword\": \"finance\", \"section\": \"interests\"}"
        }
      }]
    }
  }]
}
```

---

### 2.2 DeepInfra

**API Documentation:** https://deepinfra.com/docs

**Base URL:** `https://api.deepinfra.com/v1/openai`

**Authentication:** Bearer token (`Authorization: Bearer <API_KEY>`)

**API Compatibility:** OpenAI-compatible

**Key Features:**
- Zero data retention by default
- SOC 2 + ISO 27001 certified
- Competitive pricing
- Dedicated instance option

**Supported Models:**
| Model | Context | Input/1M | Output/1M | Tool Calling |
|-------|---------|----------|-----------|--------------|
| `meta-llama/Llama-3.3-70B-Instruct` | 128K | $0.35 | $0.40 | ✅ |
| `meta-llama/Llama-3.1-70B-Instruct` | 128K | $0.35 | $0.40 | ✅ |
| `meta-llama/Llama-3.1-8B-Instruct` | 128K | $0.05 | $0.05 | ✅ |
| `Qwen/Qwen2.5-72B-Instruct` | 128K | $0.35 | $0.40 | ✅ |
| `mistralai/Mixtral-8x22B-Instruct-v0.1` | 64K | $0.65 | $0.65 | ✅ |
| `mistralai/Mistral-7B-Instruct-v0.3` | 32K | $0.06 | $0.06 | ✅ |

**Request Format:**
```typescript
// Same as OpenAI format
{
  model: "meta-llama/Llama-3.3-70B-Instruct",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." }
  ],
  max_tokens: 2048,
  temperature: 0.1
}
```

**Response Format:**
```typescript
// Same as OpenAI format
{
  id: "chatcmpl-...",
  object: "chat.completion",
  model: "meta-llama/Llama-3.3-70B-Instruct",
  choices: [{
    message: {
      role: "assistant",
      content: "..."
    },
    finish_reason: "stop"
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  }
}
```

---

## 3. Implementation Details

### 3.1 Update LLMProvider Enum

**File:** `src/browser/llm/types.ts`

```typescript
export enum LLMProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  CLAUDE = 'claude',
  GOOGLE = 'google',
  GROQ = 'groq',           // NEW
  DEEPINFRA = 'deepinfra', // NEW
}
```

---

### 3.2 Groq Client Implementation

**File:** `src/browser/llm/groqClient.ts`

```typescript
/**
 * Groq LLM Client for OwnYou Browser PWA
 *
 * Groq provides the fastest LLM inference using custom LPU hardware.
 * API is OpenAI-compatible with zero data retention option.
 *
 * Key differences from OpenAI:
 * - Different model names (llama-3.3-70b-versatile vs gpt-4o)
 * - Different pricing structure
 * - Zero data retention toggle available
 *
 * Privacy: Enable ZDR in Groq Console → Settings → Data Controls
 */

import { BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage } from './base';
import { Logger } from '../utils/logger';

// Groq model pricing per 1M tokens (as of Nov 2025)
const GROQ_PRICING: Record<string, { input: number; output: number }> = {
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  'gemma2-9b-it': { input: 0.20, output: 0.20 },
  'llama-guard-3-8b': { input: 0.20, output: 0.20 },
};

// Groq model context windows
const GROQ_CONTEXT_WINDOWS: Record<string, number> = {
  'llama-3.3-70b-versatile': 128000,
  'llama-3.1-70b-versatile': 128000,
  'llama-3.1-8b-instant': 128000,
  'mixtral-8x7b-32768': 32768,
  'gemma2-9b-it': 8192,
  'llama-guard-3-8b': 8192,
};

// Default max completion tokens by model
const GROQ_MAX_COMPLETION: Record<string, number> = {
  'llama-3.3-70b-versatile': 8192,
  'llama-3.1-70b-versatile': 8192,
  'llama-3.1-8b-instant': 8192,
  'mixtral-8x7b-32768': 4096,
  'gemma2-9b-it': 4096,
  'llama-guard-3-8b': 4096,
};

export class GroqClient extends BaseLLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: Record<string, any>) {
    super(config);

    // Extract configuration - support both groq_ prefix and generic names
    this.apiKey =
      config.groq_api_key ||
      config.api_key ||
      process.env.NEXT_PUBLIC_GROQ_API_KEY ||
      '';

    this.defaultModel =
      config.groq_model ||
      config.model ||
      process.env.NEXT_PUBLIC_GROQ_MODEL ||
      'llama-3.3-70b-versatile';

    this.baseUrl =
      config.groq_base_url ||
      config.base_url ||
      'https://api.groq.com/openai/v1';

    this.defaultMaxTokens = config.groq_max_tokens || config.max_tokens || 4096;
    this.defaultTemperature = config.groq_temperature ?? config.temperature ?? 0.7;

    if (!this.apiKey) {
      throw new Error('Groq API key is required. Set groq_api_key in config or VITE_GROQ_API_KEY env var.');
    }

    this.logger.info(`GroqClient initialized with model: ${this.defaultModel}`);
  }

  getProvider(): LLMProvider {
    return LLMProvider.GROQ;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      this.logger.error(`Groq availability check failed: ${error}`);
      return false;
    }
  }

  async getSupportedModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.map((m: any) => m.id) || Object.keys(GROQ_PRICING);
    } catch (error) {
      this.logger.warn(`Error fetching Groq models, using defaults: ${error}`);
      return Object.keys(GROQ_PRICING);
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    // Validate request
    const errors = this.validateRequest(request);
    if (errors.length > 0) {
      return this.createErrorResponse(errors.join('; '), request.model || this.defaultModel);
    }

    const model = request.model || this.defaultModel;
    const messages = this.prepareMessages(request);
    const maxTokens = this._adjustMaxTokens(request.max_tokens || this.defaultMaxTokens, model);
    const temperature = request.temperature ?? this.defaultTemperature;

    try {
      // Build request body (OpenAI-compatible format)
      const requestBody: Record<string, any> = {
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: maxTokens,
        temperature,
      };

      // Add JSON mode if requested
      if (request.json_mode) {
        requestBody.response_format = { type: 'json_object' };
      }

      this.logger.debug(`Groq request: model=${model}, max_tokens=${maxTokens}, temp=${temperature}`);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`Groq API error: ${errorMsg}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};

      // Calculate cost
      const cost = this._calculateCost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0);

      return {
        content,
        model: data.model || model,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
        },
        metadata: {
          provider: 'groq',
          finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
          id: data.id,
          created: data.created,
        },
        success: true,
        cost,
        finish_reason: data.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Groq generate error: ${errorMsg}`);
      return this.createErrorResponse(errorMsg, model);
    }
  }

  async estimateCost(request: LLMRequest): Promise<number | undefined> {
    const model = request.model || this.defaultModel;
    const pricing = GROQ_PRICING[model];

    if (!pricing) {
      return undefined;
    }

    // Estimate tokens (rough: 4 chars per token)
    const inputText = request.messages.map(m => m.content).join(' ');
    const estimatedInputTokens = Math.ceil(inputText.length / 4);
    const estimatedOutputTokens = request.max_tokens || this.defaultMaxTokens;

    return this._calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
  }

  // Get context window for a model
  getContextWindow(model?: string): number {
    const m = model || this.defaultModel;
    return GROQ_CONTEXT_WINDOWS[m] || 32768;
  }

  // Get max completion tokens for a model
  getMaxCompletionTokens(model?: string): number {
    const m = model || this.defaultModel;
    return GROQ_MAX_COMPLETION[m] || 4096;
  }

  private _adjustMaxTokens(requested: number, model: string): number {
    const maxAllowed = GROQ_MAX_COMPLETION[model] || 4096;
    return Math.min(requested, maxAllowed);
  }

  private _calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = GROQ_PRICING[model];
    if (!pricing) {
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }
}
```

---

### 3.3 DeepInfra Client Implementation

**File:** `src/browser/llm/deepinfraClient.ts`

```typescript
/**
 * DeepInfra LLM Client for OwnYou Browser PWA
 *
 * DeepInfra provides cost-effective inference with zero data retention by default.
 * SOC 2 + ISO 27001 certified. API is OpenAI-compatible.
 *
 * Key differences from OpenAI:
 * - Different model names (meta-llama/Llama-3.3-70B-Instruct vs gpt-4o)
 * - Different pricing structure (generally cheaper)
 * - Zero data retention is DEFAULT (no opt-in required)
 *
 * Privacy: Zero retention by default - inputs, outputs, user data stay private.
 */

import { BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage } from './base';
import { Logger } from '../utils/logger';

// DeepInfra model pricing per 1M tokens (as of Nov 2025)
const DEEPINFRA_PRICING: Record<string, { input: number; output: number }> = {
  'meta-llama/Llama-3.3-70B-Instruct': { input: 0.35, output: 0.40 },
  'meta-llama/Llama-3.1-70B-Instruct': { input: 0.35, output: 0.40 },
  'meta-llama/Llama-3.1-8B-Instruct': { input: 0.05, output: 0.05 },
  'Qwen/Qwen2.5-72B-Instruct': { input: 0.35, output: 0.40 },
  'Qwen/Qwen2.5-7B-Instruct': { input: 0.05, output: 0.05 },
  'mistralai/Mixtral-8x22B-Instruct-v0.1': { input: 0.65, output: 0.65 },
  'mistralai/Mixtral-8x7B-Instruct-v0.1': { input: 0.24, output: 0.24 },
  'mistralai/Mistral-7B-Instruct-v0.3': { input: 0.06, output: 0.06 },
  'microsoft/WizardLM-2-8x22B': { input: 0.65, output: 0.65 },
  'google/gemma-2-27b-it': { input: 0.27, output: 0.27 },
};

// DeepInfra model context windows
const DEEPINFRA_CONTEXT_WINDOWS: Record<string, number> = {
  'meta-llama/Llama-3.3-70B-Instruct': 128000,
  'meta-llama/Llama-3.1-70B-Instruct': 128000,
  'meta-llama/Llama-3.1-8B-Instruct': 128000,
  'Qwen/Qwen2.5-72B-Instruct': 128000,
  'Qwen/Qwen2.5-7B-Instruct': 128000,
  'mistralai/Mixtral-8x22B-Instruct-v0.1': 65536,
  'mistralai/Mixtral-8x7B-Instruct-v0.1': 32768,
  'mistralai/Mistral-7B-Instruct-v0.3': 32768,
  'microsoft/WizardLM-2-8x22B': 65536,
  'google/gemma-2-27b-it': 8192,
};

// Default max completion tokens by model
const DEEPINFRA_MAX_COMPLETION: Record<string, number> = {
  'meta-llama/Llama-3.3-70B-Instruct': 8192,
  'meta-llama/Llama-3.1-70B-Instruct': 8192,
  'meta-llama/Llama-3.1-8B-Instruct': 8192,
  'Qwen/Qwen2.5-72B-Instruct': 8192,
  'Qwen/Qwen2.5-7B-Instruct': 8192,
  'mistralai/Mixtral-8x22B-Instruct-v0.1': 4096,
  'mistralai/Mixtral-8x7B-Instruct-v0.1': 4096,
  'mistralai/Mistral-7B-Instruct-v0.3': 4096,
  'microsoft/WizardLM-2-8x22B': 4096,
  'google/gemma-2-27b-it': 4096,
};

export class DeepInfraClient extends BaseLLMClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: Record<string, any>) {
    super(config);

    // Extract configuration - support both deepinfra_ prefix and generic names
    this.apiKey =
      config.deepinfra_api_key ||
      config.api_key ||
      process.env.NEXT_PUBLIC_DEEPINFRA_API_KEY ||
      '';

    this.defaultModel =
      config.deepinfra_model ||
      config.model ||
      process.env.NEXT_PUBLIC_DEEPINFRA_MODEL ||
      'meta-llama/Llama-3.3-70B-Instruct';

    this.baseUrl =
      config.deepinfra_base_url ||
      config.base_url ||
      'https://api.deepinfra.com/v1/openai';

    this.defaultMaxTokens = config.deepinfra_max_tokens || config.max_tokens || 4096;
    this.defaultTemperature = config.deepinfra_temperature ?? config.temperature ?? 0.7;

    if (!this.apiKey) {
      throw new Error('DeepInfra API key is required. Set deepinfra_api_key in config or VITE_DEEPINFRA_API_KEY env var.');
    }

    this.logger.info(`DeepInfraClient initialized with model: ${this.defaultModel}`);
  }

  getProvider(): LLMProvider {
    return LLMProvider.DEEPINFRA;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      this.logger.error(`DeepInfra availability check failed: ${error}`);
      return false;
    }
  }

  async getSupportedModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      // Filter to chat/instruct models
      const chatModels = data.data?.filter((m: any) =>
        m.id.includes('Instruct') || m.id.includes('Chat')
      ).map((m: any) => m.id) || [];

      return chatModels.length > 0 ? chatModels : Object.keys(DEEPINFRA_PRICING);
    } catch (error) {
      this.logger.warn(`Error fetching DeepInfra models, using defaults: ${error}`);
      return Object.keys(DEEPINFRA_PRICING);
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    // Validate request
    const errors = this.validateRequest(request);
    if (errors.length > 0) {
      return this.createErrorResponse(errors.join('; '), request.model || this.defaultModel);
    }

    const model = request.model || this.defaultModel;
    const messages = this.prepareMessages(request);
    const maxTokens = this._adjustMaxTokens(request.max_tokens || this.defaultMaxTokens, model);
    const temperature = request.temperature ?? this.defaultTemperature;

    try {
      // Build request body (OpenAI-compatible format)
      const requestBody: Record<string, any> = {
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: maxTokens,
        temperature,
      };

      // Add JSON mode if requested (DeepInfra supports this for some models)
      if (request.json_mode) {
        requestBody.response_format = { type: 'json_object' };
      }

      this.logger.debug(`DeepInfra request: model=${model}, max_tokens=${maxTokens}, temp=${temperature}`);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`DeepInfra API error: ${errorMsg}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};

      // Calculate cost
      const cost = this._calculateCost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0);

      return {
        content,
        model: data.model || model,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
        },
        metadata: {
          provider: 'deepinfra',
          finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
          id: data.id,
          created: data.created,
        },
        success: true,
        cost,
        finish_reason: data.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`DeepInfra generate error: ${errorMsg}`);
      return this.createErrorResponse(errorMsg, model);
    }
  }

  async estimateCost(request: LLMRequest): Promise<number | undefined> {
    const model = request.model || this.defaultModel;
    const pricing = DEEPINFRA_PRICING[model];

    if (!pricing) {
      return undefined;
    }

    // Estimate tokens (rough: 4 chars per token)
    const inputText = request.messages.map(m => m.content).join(' ');
    const estimatedInputTokens = Math.ceil(inputText.length / 4);
    const estimatedOutputTokens = request.max_tokens || this.defaultMaxTokens;

    return this._calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
  }

  // Get context window for a model
  getContextWindow(model?: string): number {
    const m = model || this.defaultModel;
    return DEEPINFRA_CONTEXT_WINDOWS[m] || 32768;
  }

  // Get max completion tokens for a model
  getMaxCompletionTokens(model?: string): number {
    const m = model || this.defaultModel;
    return DEEPINFRA_MAX_COMPLETION[m] || 4096;
  }

  private _adjustMaxTokens(requested: number, model: string): number {
    const maxAllowed = DEEPINFRA_MAX_COMPLETION[model] || 4096;
    return Math.min(requested, maxAllowed);
  }

  private _calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = DEEPINFRA_PRICING[model];
    if (!pricing) {
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }
}
```

---

### 3.4 Update Factory in base.ts

**File:** `src/browser/llm/base.ts`

Add to `LLMClientFactory.createClient()`:

```typescript
import { GroqClient } from './groqClient';
import { DeepInfraClient } from './deepinfraClient';

// In createClient method, add cases:
} else if (provider === LLMProvider.GROQ || provider === 'groq') {
  return new GroqClient(config);
} else if (provider === LLMProvider.DEEPINFRA || provider === 'deepinfra') {
  return new DeepInfraClient(config);
}
```

---

### 3.5 Update Model Registry

**File:** `src/browser/llm/modelRegistry.ts`

Add functions for new providers:

```typescript
// Groq context windows
export function getContextWindowGroq(client: any, modelName: string): number | null {
  const windows: Record<string, number> = {
    'llama-3.3-70b-versatile': 128000,
    'llama-3.1-70b-versatile': 128000,
    'llama-3.1-8b-instant': 128000,
    'mixtral-8x7b-32768': 32768,
    'gemma2-9b-it': 8192,
  };
  return windows[modelName] || null;
}

export function getMaxCompletionTokensGroq(client: any, modelName: string): number {
  const limits: Record<string, number> = {
    'llama-3.3-70b-versatile': 8192,
    'llama-3.1-70b-versatile': 8192,
    'llama-3.1-8b-instant': 8192,
    'mixtral-8x7b-32768': 4096,
    'gemma2-9b-it': 4096,
  };
  return limits[modelName] || 4096;
}

// DeepInfra context windows
export function getContextWindowDeepInfra(client: any, modelName: string): number | null {
  const windows: Record<string, number> = {
    'meta-llama/Llama-3.3-70B-Instruct': 128000,
    'meta-llama/Llama-3.1-70B-Instruct': 128000,
    'meta-llama/Llama-3.1-8B-Instruct': 128000,
    'Qwen/Qwen2.5-72B-Instruct': 128000,
    'mistralai/Mixtral-8x22B-Instruct-v0.1': 65536,
  };
  return windows[modelName] || null;
}

export function getMaxCompletionTokensDeepInfra(client: any, modelName: string): number {
  const limits: Record<string, number> = {
    'meta-llama/Llama-3.3-70B-Instruct': 8192,
    'meta-llama/Llama-3.1-70B-Instruct': 8192,
    'meta-llama/Llama-3.1-8B-Instruct': 8192,
    'Qwen/Qwen2.5-72B-Instruct': 8192,
    'mistralai/Mixtral-8x22B-Instruct-v0.1': 4096,
  };
  return limits[modelName] || 4096;
}

// Update generic dispatcher
export function getModelContextWindow(provider: string, modelName: string): number | null {
  // ... existing cases ...
  case 'groq':
    return getContextWindowGroq(null, modelName);
  case 'deepinfra':
    return getContextWindowDeepInfra(null, modelName);
}
```

---

### 3.6 Update AnalyzerLLMClient

**File:** `src/browser/agents/iab-classifier/llm/client.ts`

Add support for new providers:

```typescript
import { GroqClient } from '@browser/llm/groqClient';
import { DeepInfraClient } from '@browser/llm/deepinfraClient';

// In constructor, add cases:
} else if (this.provider === 'groq') {
  this.client = new GroqClient({
    groq_api_key: llm_config?.api_key || llm_config?.groq_api_key,
    groq_model: model,
    groq_max_tokens: llm_config?.max_tokens,
    groq_temperature: llm_config?.temperature,
  });
  this.model = model || 'llama-3.3-70b-versatile';
} else if (this.provider === 'deepinfra') {
  this.client = new DeepInfraClient({
    deepinfra_api_key: llm_config?.api_key || llm_config?.deepinfra_api_key,
    deepinfra_model: model,
    deepinfra_max_tokens: llm_config?.max_tokens,
    deepinfra_temperature: llm_config?.temperature,
  });
  this.model = model || 'meta-llama/Llama-3.3-70B-Instruct';
}
```

---

## 4. Environment Variables

### Project Structure

OwnYou uses two environment files:

| File | Purpose | Used By |
|------|---------|---------|
| `/.env` (root) | Python email parser | `src/email_parser/` |
| `/src/admin-dashboard/.env.local` | Next.js admin dashboard | `src/admin-dashboard/` |

### Add to Root `.env` (for Python)

```bash
# Groq Configuration (https://console.groq.com/keys)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile

# DeepInfra Configuration (https://deepinfra.com/dash/api_keys)
DEEPINFRA_API_KEY=xxxxxxxxxxxxx
DEEPINFRA_MODEL=meta-llama/Llama-3.3-70B-Instruct
```

### Add to `/src/admin-dashboard/.env.local` (for Next.js)

```bash
# Groq Configuration (https://console.groq.com/keys)
# Server-side only (API routes)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx

# Browser-exposed (admin dashboard development ONLY)
NEXT_PUBLIC_GROQ_API_KEY=gsk_xxxxxxxxxxxxx

# DeepInfra Configuration (https://deepinfra.com/dash/api_keys)
# Server-side only (API routes)
DEEPINFRA_API_KEY=xxxxxxxxxxxxx

# Browser-exposed (admin dashboard development ONLY)
NEXT_PUBLIC_DEEPINFRA_API_KEY=xxxxxxxxxxxxx
```

**SECURITY NOTE:**
- `NEXT_PUBLIC_*` vars are bundled into browser code
- Only use for development/admin dashboard
- Production consumer PWA: users provide their own keys via UI

### Production (Self-Sovereign)

API keys should be provided by user at runtime:
- Settings UI with secure input
- Stored in localStorage (encrypted with wallet key)
- Never bundled in application code

---

## 5. Testing Plan

### 5.1 Unit Tests

**File:** `tests/browser/llm/groqClient.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { GroqClient } from '@browser/llm/groqClient';

describe('GroqClient', () => {
  it('should initialize with valid config', () => {
    const client = new GroqClient({
      groq_api_key: 'test-key',
      groq_model: 'llama-3.3-70b-versatile',
    });
    expect(client.getProvider()).toBe('groq');
  });

  it('should throw without API key', () => {
    expect(() => new GroqClient({})).toThrow('API key is required');
  });

  it('should calculate cost correctly', async () => {
    const client = new GroqClient({
      groq_api_key: 'test-key',
    });
    const cost = await client.estimateCost({
      messages: [{ role: 'user', content: 'test '.repeat(1000) }],
      max_tokens: 1000,
    });
    expect(cost).toBeGreaterThan(0);
  });
});
```

### 5.2 Integration Tests

```typescript
describe('Groq Integration', () => {
  it('should generate response with real API', async () => {
    const client = new GroqClient({
      groq_api_key: process.env.VITE_GROQ_API_KEY,
    });

    const response = await client.generate({
      messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
      max_tokens: 10,
      temperature: 0,
    });

    expect(response.success).toBe(true);
    expect(response.content.toLowerCase()).toContain('hello');
  });
});
```

---

## 6. Migration Guide

### 6.1 Switching from OpenAI to Groq

```typescript
// Before (OpenAI)
const client = new AnalyzerLLMClient({
  provider: 'openai',
  model: 'gpt-4o-mini',
  llm_config: { api_key: openaiKey },
});

// After (Groq) - same interface
const client = new AnalyzerLLMClient({
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  llm_config: { api_key: groqKey },
});
```

### 6.2 Cost Comparison (1000 emails @ ~2000 tokens each)

| Provider | Model | Input Cost | Output Cost | Total |
|----------|-------|------------|-------------|-------|
| OpenAI | gpt-4o-mini | $0.30 | $1.20 | **$1.50** |
| OpenAI | gpt-4o | $5.00 | $15.00 | **$20.00** |
| Groq | llama-3.3-70b | $1.18 | $1.58 | **$2.76** |
| DeepInfra | Llama-3.3-70B | $0.70 | $0.80 | **$1.50** |

**Savings:** DeepInfra = same cost as GPT-4o-mini, but with zero data retention

---

## 7. Recommended Default Configuration

For OwnYou IAB Classification:

```typescript
const RECOMMENDED_CONFIG = {
  // Primary: Best cost/performance with ZDR
  primary: {
    provider: 'deepinfra',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    reason: 'Best price, zero retention default, SOC2 certified',
  },

  // Fallback: Fastest inference
  fallback: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    reason: 'Fastest inference, good for real-time UX',
  },

  // Complex reasoning: When quality matters most
  premium: {
    provider: 'openai',
    model: 'gpt-4o',
    reason: 'Best quality for complex Ikigai analysis',
  },
};
```

---

## 8. Privacy Verification Checklist

- [ ] Groq: Enable ZDR in Console → Settings → Data Controls
- [ ] DeepInfra: ZDR is default (verify in privacy policy)
- [ ] Never log API keys in client code
- [ ] Never send API keys to any analytics
- [ ] Verify no PII leakage in error messages
- [ ] Test with sanitized email content

---

## 9. Implementation Checklist

- [ ] Create `src/browser/llm/groqClient.ts`
- [ ] Create `src/browser/llm/deepinfraClient.ts`
- [ ] Update `src/browser/llm/types.ts` with new enum values
- [ ] Update `src/browser/llm/base.ts` factory
- [ ] Update `src/browser/llm/modelRegistry.ts`
- [ ] Update `src/browser/agents/iab-classifier/llm/client.ts`
- [ ] Add environment variables to `.env.local`
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Test with real API keys
- [ ] Verify zero data retention settings
- [ ] Update admin dashboard model selector

---

## 10. References

- [Groq API Documentation](https://console.groq.com/docs)
- [Groq Data Privacy](https://console.groq.com/docs/your-data)
- [DeepInfra API Documentation](https://deepinfra.com/docs)
- [DeepInfra Data Privacy](https://deepinfra.com/docs/data)
- [OwnYou Decentralization Ledger](../OwnYou_architecture_v12.md#6-decentralization-ledger)
