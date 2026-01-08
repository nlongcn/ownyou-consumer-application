# Plan: Dynamic LLM Configuration System

## Problem Statement

The codebase has **partial dynamic model discovery** but still has extensive hardcoding:

### Already Dynamic (Keep)
| Location | What It Does |
|----------|--------------|
| `/api/analyze/models/route.ts` | Fetches from 6 live provider APIs (OpenAI, Anthropic, Google, Groq, DeepInfra, Ollama) |
| `Stage2Panel.tsx`, `Stage3Panel.tsx` | Use dynamic API data for dropdowns |

### Still Hardcoded (Fix)
| Location | Data Type | Lines |
|----------|-----------|-------|
| `lib/ab-testing/types.ts` | FALLBACK_MODELS | 168-185 |
| `/api/analyze/models/route.ts` | Fallback arrays per provider | 89-96, 129-138, 172-179, 225-231, 269-275 |
| `packages/llm-client/src/providers/registry.ts` | MODEL_REGISTRY (pricing, metadata) | 67-369 |
| `packages/llm-client/src/providers/openai.ts` | getSupportedModels() | 139-151 |
| `packages/llm-client/src/providers/google.ts` | getSupportedModels() | 55-62 |
| `packages/llm-client/src/providers/groq.ts` | getSupportedModels() | 57-65 |
| `packages/llm-client/src/providers/deepinfra.ts` | getSupportedModels() | 58-68 |
| `packages/iab-classifier/src/costTracker.ts` | Pricing per 1M tokens | 160-195 |
| `src/email_parser/llm_clients/model_registry.py` | Context windows, completion limits | 24-430 |

**Total: 10+ files with hardcoded model data**

---

## Solution: Self-Sovereign Dynamic Configuration

### Architecture Constraints
- **No central OwnYou servers** - self-sovereign architecture
- **Browser + Tauri desktop app** - must work in both environments
- **Fully automated pricing updates** - no manual maintenance

### Data Sources

**For Model Lists (keep existing):**
- Live provider APIs (OpenAI, Anthropic, Google, etc.) - already implemented in `/api/analyze/models/route.ts`

**For Pricing/Metadata (new):**
- **Primary:** `https://www.llm-prices.com/current-v1.json` - CORS-friendly, community-maintained
- **Fallback:** OpenRouter `/api/v1/models` - real-time, 400+ models
- **Offline:** Bundled defaults (minimal, versioned)

**Note:** OpenAI, Anthropic, Google do NOT expose pricing via API - community sources are required.

---

## Implementation Plan

### Phase 1: Create Prevention Skill

**Create:** `.claude/skills/data-vs-code-separation/instructions.md`

**What it enforces:**
1. No hardcoded prices, model names, or dynamic config values in code
2. All dynamic data must come from ConfigService or live APIs
3. Fallbacks must be clearly marked and minimal
4. Test data must not use production model names

**Enforcement examples:**
```
❌ const price = 0.00015;
✅ const price = await configService.getPricing(modelId);

❌ const models = ['gpt-4o', 'claude-3'];
✅ const models = await fetchModelsFromAPI();

❌ if (model === 'gpt-4o-mini') { ... }
✅ if (config.tiers.fast.includes(model)) { ... }
```

### Phase 2: ConfigService Implementation

**Create in `packages/llm-client/src/config/`:**

```
config/
├── ConfigService.ts       # Main service
├── types.ts              # LLMProviderConfig interface
├── defaults.ts           # Bundled fallback for offline
├── sources/
│   ├── llmPrices.ts      # llm-prices.com fetcher
│   └── openRouter.ts     # OpenRouter fallback
└── __tests__/
    └── ConfigService.test.ts
```

**ConfigService.ts design:**
```typescript
class ConfigService {
  private cache: LLMProviderConfig | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async getConfig(): Promise<LLMProviderConfig> {
    // 1. Memory cache (instant)
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    // 2. Storage cache (IndexedDB/SQLite)
    const stored = await this.storage.get('llm-config');
    if (stored && Date.now() < stored.expiry) {
      this.cache = stored.config;
      return stored.config;
    }

    // 3. Remote fetch with fallback chain
    try {
      const config = await this.fetchFromRemote();
      await this.cacheConfig(config);
      return config;
    } catch (error) {
      // 4. Bundled defaults (offline)
      return BUNDLED_DEFAULTS;
    }
  }

  async getPricing(modelId: string): Promise<{ input: number; output: number }> {
    const config = await this.getConfig();
    return config.models[modelId]?.pricing ?? { input: 0, output: 0 };
  }

  async getModelMetadata(modelId: string): Promise<ModelMetadata | null> {
    const config = await this.getConfig();
    return config.models[modelId] ?? null;
  }
}
```

### Phase 3: Refactor Existing Code

**3a. `/api/analyze/models/route.ts` (API endpoint)**
```typescript
// BEFORE: Hardcoded fallback arrays
const defaultOpenAIModels = ['gpt-4o', 'gpt-4o-mini', ...];

// AFTER: Use ConfigService fallbacks
const defaultOpenAIModels = await configService.getModelsByProvider('openai');
```

**3b. `types.ts` (Frontend fallbacks)**
```typescript
// BEFORE: Hardcoded FALLBACK_MODELS
export const FALLBACK_MODELS: ModelConfig[] = [
  { provider: 'openai', model: 'gpt-4o-mini', displayName: 'GPT-4o-mini' },
  // ... 8 hardcoded models
];

// AFTER: Dynamic from ConfigService
export async function getFallbackModels(): Promise<ModelConfig[]> {
  const config = await configService.getConfig();
  return config.fallbackModels;
}
```

**3c. `registry.ts` (Model metadata)**
```typescript
// BEFORE: Hardcoded MODEL_REGISTRY
export const MODEL_REGISTRY = { 'gpt-4o-mini': { pricing: {...} }, ... };

// AFTER: Dynamic from ConfigService
export async function getModelRegistry() {
  const config = await configService.getConfig();
  return config.models;
}

export async function calculateCost(modelId: string, tokens: { input: number; output: number }) {
  const pricing = await configService.getPricing(modelId);
  return (tokens.input * pricing.input + tokens.output * pricing.output) / 1000;
}
```

**3d. Provider `getSupportedModels()` methods**
```typescript
// BEFORE: Hardcoded list
getSupportedModels(): string[] {
  return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
}

// AFTER: Dynamic from ConfigService
async getSupportedModels(): Promise<string[]> {
  const config = await configService.getConfig();
  return Object.keys(config.models)
    .filter(id => config.models[id].provider === this.providerId);
}
```

**3e. `costTracker.ts` (IAB classifier)**
```typescript
// BEFORE: Hardcoded PRICING map
const PRICING = { 'gpt-4o-mini': { input: 0.15, output: 0.60 }, ... };

// AFTER: Use ConfigService
async function trackCost(modelId: string, tokens: TokenCount) {
  const pricing = await configService.getPricing(modelId);
  return calculateCostFromPricing(pricing, tokens);
}
```

**3f. Python `model_registry.py`**
- Option A: Create Python ConfigService equivalent
- Option B: Generate Python constants from JSON at build time
- Option C: Python fetches from same remote source

### Phase 4: Test Updates

1. **Mock ConfigService** instead of hardcoded model strings
2. **Use tier names** (`fast`, `standard`) instead of specific models
3. **Test fallback behavior** - config fetch failure → bundled defaults
4. **Remove model-specific assertions** like `expect(model).toBe('gpt-4o-mini')`

### Phase 5: Update Architecture Doc

Update `docs/architecture/extracts/llm-cost-6.10.md` with:
- Complete implementation details
- ConfigService API reference
- Migration guide for existing code
- Data source documentation

### Phase 6: Complete LLM Cost Management Component

Create UI component in admin-dashboard for:
- Viewing current pricing config
- Forcing config refresh
- Viewing cost tracking data
- Budget alerts and throttling status

---

## Files to Modify

| File | Change |
|------|--------|
| `src/admin-dashboard/lib/ab-testing/types.ts` | Remove FALLBACK_MODELS, use ConfigService |
| `src/admin-dashboard/app/api/analyze/models/route.ts` | Replace hardcoded fallbacks |
| `packages/llm-client/src/providers/registry.ts` | Remove MODEL_REGISTRY, use ConfigService |
| `packages/llm-client/src/providers/openai.ts` | Dynamic getSupportedModels() |
| `packages/llm-client/src/providers/google.ts` | Dynamic getSupportedModels() |
| `packages/llm-client/src/providers/groq.ts` | Dynamic getSupportedModels() |
| `packages/llm-client/src/providers/deepinfra.ts` | Dynamic getSupportedModels() |
| `packages/iab-classifier/src/costTracker.ts` | Use ConfigService for pricing |
| `src/email_parser/llm_clients/model_registry.py` | Python equivalent or build-time gen |
| `docs/architecture/extracts/llm-cost-6.10.md` | Complete documentation |

## New Files to Create

| File | Purpose |
|------|---------|
| `.claude/skills/data-vs-code-separation/instructions.md` | Prevention skill |
| `packages/llm-client/src/config/ConfigService.ts` | Main service |
| `packages/llm-client/src/config/types.ts` | LLMProviderConfig interface |
| `packages/llm-client/src/config/defaults.ts` | Bundled fallback |
| `packages/llm-client/src/config/sources/llmPrices.ts` | llm-prices.com fetcher |
| `packages/llm-client/src/config/sources/openRouter.ts` | OpenRouter fallback |
| `packages/llm-client/src/config/__tests__/ConfigService.test.ts` | Tests |
| `src/admin-dashboard/components/LLMCostManagement.tsx` | UI component |

---

## Verification Plan

1. **Skill verification:**
   - Try to add hardcoded price → skill blocks it
   - Skill guides to ConfigService pattern

2. **ConfigService verification:**
   - App starts with network → fetches from llm-prices.com
   - App starts offline → uses bundled defaults
   - Primary source fails → falls back to OpenRouter
   - Cache works → second request uses cached data (24hr TTL)

3. **A/B Testing verification:**
   - Model dropdowns populate correctly
   - Pre-processing model selection works
   - Classification model selection works
   - Cost tracking shows correct pricing

4. **End-to-end verification:**
   - New model appears in llm-prices.com → app recognizes it
   - Price change → cost tracking reflects new price
   - Run `pnpm test` → all packages pass
   - Run `pnpm build` → succeeds

---

## Sources

- [llm-prices.com](https://www.llm-prices.com/) - Primary pricing source
- [simonw/llm-prices GitHub](https://github.com/simonw/llm-prices)
- [OpenRouter API](https://openrouter.ai/docs/api/api-reference/models/get-models)
