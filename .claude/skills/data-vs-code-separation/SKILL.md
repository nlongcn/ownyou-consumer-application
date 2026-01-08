---
name: data-vs-code-separation
description: Enforce separation of dynamic data from code. Use when implementing features that involve model names, pricing, configuration values, or any data that changes independently of code releases. Prevents hardcoding errors.
---

# Data vs Code Separation

**MANDATORY verification when working with configuration, pricing, model names, or any dynamic data.**

## When to Use This Skill

- **Before adding ANY model name to code** (e.g., `gpt-4o-mini`, `claude-3`)
- **Before adding ANY pricing data** (e.g., `$0.00015`, `0.15`)
- **When implementing configuration management**
- **When reviewing code for hardcoded dynamic values**
- **Before adding fallback arrays or default lists**

## The Core Principle

> **If data changes independently of code releases, it MUST NOT be in code.**

**Examples of Data (NOT code):**
- LLM model names (`gpt-4o-mini`, `claude-3-5-sonnet`)
- Pricing (`$0.15/1M tokens`)
- Context windows (`128000`)
- API endpoints that may change
- Feature flags
- Rate limits
- Default values that users might want to customize

**Examples of Code (can stay in code):**
- Type definitions and interfaces
- Business logic
- API client implementations
- Schema definitions (structure, not values)
- Constants that never change (e.g., `Math.PI`)

---

## Compliance Checklist

### 1. Model Names

```typescript
// ❌ WRONG - Hardcoded model names
const models = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet'];
const defaultModel = 'gpt-4o-mini';
if (model === 'gpt-4o-mini') { ... }

// ✅ CORRECT - Dynamic from ConfigService
const models = await configService.getModelsByProvider('openai');
const defaultModel = config.tiers.fast.primaryModel;
if (config.tiers.fast.models.includes(model)) { ... }
```

**Checklist:**
- [ ] No model name strings in source code
- [ ] No model name strings in test assertions
- [ ] Default models come from ConfigService
- [ ] Model comparisons use tier membership, not string equality

### 2. Pricing Data

```typescript
// ❌ WRONG - Hardcoded pricing
const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 }
};
const cost = tokens * 0.00015;

// ✅ CORRECT - Dynamic from ConfigService
const pricing = await configService.getPricing(modelId);
const cost = (tokens * pricing.inputPer1M) / 1_000_000;
```

**Checklist:**
- [ ] No price numbers in source code
- [ ] No price numbers in test files
- [ ] All cost calculations use ConfigService
- [ ] Pricing format normalized (per 1M tokens preferred)

### 3. Fallback Data

```typescript
// ❌ WRONG - Hardcoded fallbacks
export const FALLBACK_MODELS = [
  { provider: 'openai', model: 'gpt-4o-mini' }
];

// ✅ CORRECT - Fallbacks from ConfigService (bundled defaults)
export async function getFallbackModels() {
  return configService.getFallbackModels();
}

// ✅ ACCEPTABLE - Bundled defaults file (clearly marked)
// File: packages/llm-client/src/config/defaults.ts
// This file contains bundled fallback data for offline use.
// DO NOT import this file directly - use ConfigService.
export const BUNDLED_DEFAULTS = { ... };
```

**Checklist:**
- [ ] Fallbacks come from ConfigService
- [ ] Bundled defaults isolated in single `defaults.ts` file
- [ ] Bundled defaults file clearly marked with comments
- [ ] No other files import defaults directly

### 4. Context Windows & Limits

```typescript
// ❌ WRONG - Hardcoded limits
const contextWindow = 128000;
const maxCompletionTokens = 16384;

// ✅ CORRECT - From ConfigService
const metadata = await configService.getModelMetadata(modelId);
const contextWindow = metadata?.contextWindow ?? 32000; // Safe fallback
```

**Checklist:**
- [ ] No context window numbers in code
- [ ] No max token limits in code
- [ ] Metadata from ConfigService with safe fallbacks

### 5. Test Data

```typescript
// ❌ WRONG - Tests assert specific model names
expect(result.model).toBe('gpt-4o-mini');
expect(pricing['gpt-4o'].input).toBe(2.50);

// ✅ CORRECT - Tests use mocked ConfigService
const mockConfig = createMockConfig();
expect(result.model).toBe(mockConfig.tiers.fast.primaryModel);

// ✅ CORRECT - Tests use tier membership
expect(config.tiers.fast.models).toContain(result.model);
```

**Checklist:**
- [ ] Tests mock ConfigService, not hardcoded data
- [ ] No specific model names in test assertions
- [ ] No specific pricing in test assertions
- [ ] Tests verify behavior, not specific values

---

## Decision Tree

```
Adding new data to code?
│
├─ Does this data change when providers update?
│   ├─ YES → MUST use ConfigService
│   └─ NO → Continue
│
├─ Is this a model name or pricing?
│   ├─ YES → MUST use ConfigService
│   └─ NO → Continue
│
├─ Could this value change between releases?
│   ├─ YES → Should use ConfigService or environment variable
│   └─ NO → Continue
│
├─ Is this a fallback/default value?
│   ├─ YES → Must be in defaults.ts, accessed via ConfigService
│   └─ NO → Continue
│
└─ ACCEPTABLE to hardcode
```

---

## Allowed Exceptions

Some data can remain in code with justification:

| Exception | Justification | Example |
|-----------|---------------|---------|
| Type definitions | Structure, not values | `type Provider = 'openai' \| 'anthropic'` |
| Schema constants | Structural constraints | `const MAX_NAMESPACE_DEPTH = 5` |
| Test fixtures | Clearly marked test data | `const TEST_MODEL = 'test-model'` |
| Bundled defaults | Single file, ConfigService access only | `defaults.ts` |

---

## Common Violations & Fixes

| Violation | Location Pattern | Fix |
|-----------|------------------|-----|
| Hardcoded model array | `getSupportedModels()` | Return `configService.getModelsByProvider()` |
| Hardcoded pricing | `PRICING = { ... }` | Use `configService.getPricing()` |
| Hardcoded fallbacks | `FALLBACK_MODELS = [...]` | Move to `defaults.ts`, use ConfigService |
| Model name in condition | `if (model === 'gpt-4o')` | Use `config.tiers.fast.includes(model)` |
| Price in calculation | `cost = tokens * 0.00015` | Use `configService.getPricing()` |

---

## AI Assistant Protocol

**When implementing features involving configuration or dynamic data:**

1. **Identify dynamic data:**
   - Model names?
   - Pricing?
   - Limits/thresholds?
   - Default values?

2. **Check ConfigService existence:**
   - If ConfigService exists → Use it
   - If not → Create it first (see `docs/architecture/extracts/llm-cost-6.10.md`)

3. **Review for violations:**
   - Search for model name strings
   - Search for price/cost numbers
   - Search for hardcoded arrays

4. **Document exceptions:**
   - If hardcoding is necessary, add comment explaining why
   - Ensure bundled defaults are in single file

5. **Test compliance:**
   - Tests use mocked ConfigService
   - No specific values in assertions

---

## Reference Implementation

See: `docs/architecture/extracts/llm-cost-6.10.md`

**ConfigService location:** `packages/llm-client/src/config/`

**Data sources:**
- Primary: `https://www.llm-prices.com/current-v1.json`
- Fallback: `https://openrouter.ai/api/v1/models`
- Offline: Bundled `defaults.ts`

---

## Verification Commands

```bash
# Search for hardcoded model names
grep -r "gpt-4" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."

# Search for hardcoded pricing
grep -r "0\.00015\|0\.15\|0\.60" --include="*.ts" | grep -v node_modules

# Search for FALLBACK or DEFAULT arrays
grep -r "FALLBACK_\|DEFAULT_" --include="*.ts" | grep -v node_modules | grep -v defaults.ts
```

---

## Related Skills

- **v13-compliance-check** - Catches hardcoded namespace strings
- **code-review-skill** - General code quality (includes some config checks)
- **testing-discipline** - Ensures tests use mocks properly
