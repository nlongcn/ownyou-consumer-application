# LLM Cost Management (v13 Section 6.10)

*Extracted from OwnYou_architecture_v13.md - Updated Jan 2026*

OwnYou targets **<$10/user/month** average LLM spend. To achieve this in a volatile market where model prices and capabilities change weekly, we employ a **Dynamic Remote Configuration** strategy instead of hardcoding model definitions.

---

## 1. Dynamic Configuration Strategy

**Problem:** Hardcoding model names (e.g., `gpt-4o-mini`, `claude-3-haiku`) and specific pricing (e.g., `$0.00015/1K`) in the codebase leads to technical debt and requires full application redeployments to take advantage of new models and price drops on existing models.

**Solution:** Model pricing and metadata are fetched from public community-maintained sources at runtime and cached locally.

### Self-Sovereign Architecture Constraints

- **No central OwnYou servers** - user's app fetches directly from public sources
- **Browser + Tauri desktop app** - must work in both environments with CORS support
- **Fully automated updates** - no manual maintenance required
- **Offline support** - bundled defaults for when network unavailable

### Data Sources

| Source | URL | Purpose | CORS |
|--------|-----|---------|------|
| **Primary** | `https://www.llm-prices.com/current-v1.json` | Pricing data | Yes |
| **Fallback** | `https://openrouter.ai/api/v1/models` | Models + pricing | Yes |
| **Offline** | Bundled `defaults.ts` | Minimal fallback | N/A |

**Note:** OpenAI, Anthropic, and Google do NOT expose pricing via their APIs. Community-maintained sources are the only option for automated pricing updates.

### Model Lists vs Pricing

| Data Type | Source | Update Frequency |
|-----------|--------|------------------|
| **Model Lists** | Live provider APIs (already implemented in `/api/analyze/models`) | Real-time |
| **Pricing** | llm-prices.com / OpenRouter | Daily (24hr cache) |
| **Context Windows** | llm-prices.com / bundled | Daily |

---

## 2. Configuration Schema

```typescript
interface LLMProviderConfig {
  timestamp: number;           // Unix timestamp for cache validation
  source: string;              // "llm-prices.com" | "openrouter" | "bundled"

  models: {
    [modelId: string]: ModelMetadata;
  };

  tiers: {
    fast: TierConfig;
    standard: TierConfig;
    quality: TierConfig;
    local: TierConfig;
  };

  fallbackModels: FallbackModel[];  // For UI when API unavailable
}

interface ModelMetadata {
  id: string;                  // e.g., "gpt-4o-mini"
  provider: Provider;          // "openai" | "anthropic" | "google" | "groq" | "deepinfra" | "ollama"
  displayName: string;         // Human-readable name
  contextWindow: number;       // Max input tokens
  maxCompletionTokens: number; // Max output tokens
  pricing: {
    inputPer1M: number;        // USD per 1M input tokens
    outputPer1M: number;       // USD per 1M output tokens
    cachedInputPer1M?: number; // Cached input pricing (if available)
  };
  capabilities: string[];      // ["json_mode", "vision", "function_calling"]
  zeroDataRetention: boolean;  // Privacy-safe providers (Groq, DeepInfra)
  isReasoningModel: boolean;   // o1/o3/DeepSeek-R1 style models
}

interface TierConfig {
  primaryModel: string;
  fallbackModels: string[];
  avgCostPer1k: number;
  description: string;
}

interface FallbackModel {
  provider: string;
  model: string;
  displayName: string;
}
```

---

## 3. ConfigService Implementation

Located at: `packages/llm-client/src/config/`

```
config/
├── ConfigService.ts       # Main service (singleton)
├── types.ts              # TypeScript interfaces
├── defaults.ts           # Bundled fallback data
├── sources/
│   ├── llmPrices.ts      # llm-prices.com fetcher
│   └── openRouter.ts     # OpenRouter fallback fetcher
└── __tests__/
    └── ConfigService.test.ts
```

### ConfigService API

```typescript
class ConfigService {
  // Singleton instance
  static getInstance(): ConfigService;

  // Get full config (cached)
  async getConfig(): Promise<LLMProviderConfig>;

  // Convenience methods
  async getPricing(modelId: string): Promise<ModelPricing>;
  async getModelMetadata(modelId: string): Promise<ModelMetadata | null>;
  async getModelsByProvider(provider: string): Promise<string[]>;
  async getModelsByTier(tier: string): Promise<string[]>;
  async getFallbackModels(): Promise<FallbackModel[]>;

  // Cache management
  async forceRefresh(): Promise<LLMProviderConfig>;
  getCacheStatus(): { cached: boolean; expiry: Date | null; source: string };
}
```

### Caching Strategy

```typescript
// Cache hierarchy (fastest to slowest)
1. Memory cache      → Instant access during session
2. IndexedDB/SQLite  → Persisted with 24-hour TTL
3. Remote fetch      → llm-prices.com → OpenRouter → bundled defaults
```

### Usage Example

```typescript
import { configService } from '@ownyou/llm-client';

// Get pricing for cost calculation
const pricing = await configService.getPricing('gpt-4o-mini');
const cost = (inputTokens * pricing.inputPer1M + outputTokens * pricing.outputPer1M) / 1_000_000;

// Get models for a provider
const openaiModels = await configService.getModelsByProvider('openai');

// Get fallback models for UI
const fallbacks = await configService.getFallbackModels();
```

---

## 4. Budget Policy Interface

The application logic remains decoupled from specific models, requesting "Tiers" instead.

```typescript
interface LLMBudgetPolicy {
  monthlyBudgetUsd: 10;

  operations: {
    ikigai_inference: {
      maxInputTokens: 4000;
      maxOutputTokens: 2000;
      maxRunsPerDay: 2;
      modelTier: "standard";  // Resolved dynamically via ConfigService
    };

    iab_classification: {
      maxInputTokens: 2000;
      maxOutputTokens: 500;
      batchSize: 20;
      modelTier: "fast";
    };
  };

  throttling: {
    at50Percent: "log_warning";
    at80Percent: "reduce_model_tier";
    at95Percent: "defer_non_urgent";
    at100Percent: "local_only";
  };
}
```

---

## 5. Budget Enforcement & Cost Tracking

Cost tracking calculates usage based on **pricing from ConfigService**, not hardcoded constants.

```typescript
const enforceBudget = async (userId: string, request: LLMRequest): Promise<LLMRequest> => {
  const config = await configService.getConfig();
  const usage = await store.get(LLM_USAGE_NAMESPACE.monthly(userId), "current");
  const budgetUsedPercent = (usage.totalCostUsd / 10) * 100;

  // >100%: Force Local Tier
  if (budgetUsedPercent >= 100) {
    const localModel = config.tiers.local.primaryModel;
    return { ...request, model: localModel, throttled: true };
  }

  // >80%: Downgrade Tier
  if (budgetUsedPercent >= 80) {
    const currentTier = determineTier(request.model, config);
    const downgradedTier = downgradeModelTier(currentTier);
    const newModel = config.tiers[downgradedTier].primaryModel;
    return { ...request, model: newModel, throttled: true };
  }

  return request;
};

// Cost calculation using ConfigService
const trackCost = async (modelId: string, tokens: TokenCount): Promise<number> => {
  const pricing = await configService.getPricing(modelId);
  return (tokens.input * pricing.inputPer1M + tokens.output * pricing.outputPer1M) / 1_000_000;
};
```

---

## 6. Files Affected by This Refactor

### Files to Modify

| File | Current State | Change Required |
|------|---------------|-----------------|
| `packages/llm-client/src/providers/registry.ts` | Hardcoded MODEL_REGISTRY (24 models) | Use ConfigService |
| `packages/llm-client/src/providers/openai.ts` | Hardcoded getSupportedModels() | Dynamic from ConfigService |
| `packages/llm-client/src/providers/google.ts` | Hardcoded getSupportedModels() | Dynamic from ConfigService |
| `packages/llm-client/src/providers/groq.ts` | Hardcoded getSupportedModels() | Dynamic from ConfigService |
| `packages/llm-client/src/providers/deepinfra.ts` | Hardcoded getSupportedModels() | Dynamic from ConfigService |
| `packages/iab-classifier/src/costTracker.ts` | Hardcoded PRICING map | Use ConfigService |
| `src/admin-dashboard/lib/ab-testing/types.ts` | Hardcoded FALLBACK_MODELS | Use ConfigService |
| `src/admin-dashboard/app/api/analyze/models/route.ts` | Hardcoded fallback arrays | Use ConfigService |
| `src/email_parser/llm_clients/model_registry.py` | Hardcoded context windows | Python ConfigService or build-time gen |

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/llm-client/src/config/ConfigService.ts` | Main service |
| `packages/llm-client/src/config/types.ts` | TypeScript interfaces |
| `packages/llm-client/src/config/defaults.ts` | Bundled fallback |
| `packages/llm-client/src/config/sources/llmPrices.ts` | Primary fetcher |
| `packages/llm-client/src/config/sources/openRouter.ts` | Fallback fetcher |
| `.claude/skills/data-vs-code-separation/` | Prevention skill |

---

## 7. Migration Guide

### Before (Hardcoded)

```typescript
// ❌ Hardcoded pricing
const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 }
};

// ❌ Hardcoded model list
getSupportedModels(): string[] {
  return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
}

// ❌ Hardcoded fallbacks
const FALLBACK_MODELS = [
  { provider: 'openai', model: 'gpt-4o-mini' }
];
```

### After (Dynamic)

```typescript
// ✅ Dynamic pricing
const pricing = await configService.getPricing(modelId);

// ✅ Dynamic model list
async getSupportedModels(): Promise<string[]> {
  return configService.getModelsByProvider(this.providerId);
}

// ✅ Dynamic fallbacks
const fallbacks = await configService.getFallbackModels();
```

---

## 8. External Data Sources Reference

### llm-prices.com (Primary)

**Endpoint:** `https://www.llm-prices.com/current-v1.json`

**Response Format:**
```json
{
  "updated_at": "2026-01-08",
  "prices": [
    {
      "id": "gpt-4o-mini",
      "vendor": "openai",
      "name": "GPT-4o Mini",
      "input": 0.15,
      "output": 0.60,
      "input_cached": null
    }
  ]
}
```

**Features:**
- CORS-enabled (Cloudflare Pages)
- No authentication required
- Community-maintained (simonw/llm-prices)
- Covers: OpenAI, Anthropic, Google, Groq, DeepInfra, Together AI

### OpenRouter (Fallback)

**Endpoint:** `https://openrouter.ai/api/v1/models`

**Response Format:**
```json
{
  "data": [
    {
      "id": "openai/gpt-4o-mini",
      "name": "GPT-4o Mini",
      "context_length": 128000,
      "pricing": {
        "prompt": "0.00015",
        "completion": "0.0006"
      }
    }
  ]
}
```

**Features:**
- CORS-enabled
- No authentication required
- 400+ models
- Real-time pricing

---

## 9. Verification Checklist

- [ ] ConfigService fetches from llm-prices.com successfully
- [ ] Fallback to OpenRouter works when primary fails
- [ ] Bundled defaults used when offline
- [ ] 24-hour cache TTL working correctly
- [ ] Cost tracking uses dynamic pricing
- [ ] Model dropdowns populate correctly in A/B Testing UI
- [ ] All existing tests pass with mocked ConfigService
- [ ] `pnpm build` succeeds in all packages
