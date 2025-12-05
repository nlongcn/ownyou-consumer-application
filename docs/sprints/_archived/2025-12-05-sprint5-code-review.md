# Sprint 5 Code Review - Bugfixing Report

**Date:** 2025-12-05
**Sprint:** 5 (Resilience + Trigger System)
**Packages:** `@ownyou/resilience`, `@ownyou/triggers`
**Reviewer:** Claude Code (superpowers:code-reviewer)

---

## Review Summary

| Aspect | Status | Details |
|--------|--------|---------|
| **Overall** | NEEDS WORK | Implementation complete but has v13 compliance gaps |
| **Tests Passing** | 152 total | resilience: 84, triggers: 68 |
| **PACKAGE.md** | MISSING | Neither package has documentation |
| **V13 Compliance** | PARTIAL | Several deviations from spec |

---

## 1. CRITICAL FINDINGS - V13 Architecture Violations

### 1.1 Namespace Convention Violations

**Issue:** Agent registry uses raw namespace strings instead of v13 `NS` factory functions

**Location:** `packages/triggers/src/coordinator/agent-registry.ts:28-57`

```typescript
// CURRENT (INCORRECT):
namespaces: ['ownyou.iab', 'ownyou.semantic', 'ownyou.entities']

// V13 REQUIRED (per Section 8.12):
// Should use NS factory: NS.iabClassifications(userId), NS.semanticMemory(userId)
```

**v13 Reference:** Section 8.12 specifies ALL namespaces must use the `NS` factory pattern with userId parameter.

**Impact:** Breaking the single source of truth principle - namespaces are userId-scoped in v13.

---

### 1.2 Missing Alternative Provider Mapping

**Issue:** v13 Section 6.11.3 specifies `ALTERNATIVE_PROVIDERS` mapping, but it's not implemented

**Location:** `packages/resilience/src/fallback/llm-chain.ts`

```typescript
// V13 REQUIRED (Section 6.11.3):
const ALTERNATIVE_PROVIDERS: Record<string, string> = {
  openai: 'anthropic',
  anthropic: 'openai',
  google: 'groq',
  groq: 'deepinfra',
};
```

**Current Status:** Level 4 fallback exists but requires explicit `alternativeProvider` parameter. No automatic provider switching based on primary provider type.

---

### 1.3 Email Partial Data Policy Deviation

**Issue:** Email min coverage is 0.5, but v13 specifies 0.8

**Location:** `packages/resilience/src/partial-data/policies.ts:13-14`

```typescript
// CURRENT:
email: {
  minCoverage: 0.5,  // Comment says "v13: 0.8 for email_sync, using 0.5 for MVP"
  ...
}

// V13 REQUIRED (Section 6.11.4):
email_sync: {
  min_success_rate: 0.8,  // 80% minimum
  ...
}
```

**Impact:** Users may receive recommendations based on incomplete email data (50% instead of 80%).

---

## 2. HARDCODED VALUES - Should Be Configurable

### 2.1 Circuit Breaker Configuration

**Location:** `packages/resilience/src/circuit-breaker/config.ts`

| API | Hardcoded Value | Should Be |
|-----|-----------------|-----------|
| All APIs | `failureThreshold: 5` | Per-environment config |
| All APIs | `resetTimeoutMs: 60000` | Per-environment config |
| All APIs | `timeoutMs: 5000-10000` | Per-environment config |

**Recommendation:** Move to environment variables or runtime config:
```typescript
// Example configuration pattern
const API_CONFIGS = getApiConfigFromEnvironment() ?? DEFAULT_API_CONFIGS;
```

---

### 2.2 LLM Fallback Chain

**Location:** `packages/resilience/src/fallback/llm-chain.ts:42-46,51-60`

| Value | Line | Hardcoded | Should Be |
|-------|------|-----------|-----------|
| maxRetries | 43 | `3` | Configurable per operation |
| timeoutMs | 44 | `30000` | Configurable per operation |
| baseRetryDelayMs | 45 | `1000` | Configurable |
| Context summary length | 285 | `200` chars | Configurable |
| MODEL_DOWNGRADES map | 51-60 | Static | Injectable/configurable |

---

### 2.3 Partial Data Policies

**Location:** `packages/resilience/src/partial-data/policies.ts:12-54`

All thresholds are hardcoded with no way to override:

| Source | Field | Hardcoded | Issue |
|--------|-------|-----------|-------|
| email | minCoverage | `0.5` | Doesn't match v13 (0.8) |
| email | staleThresholdHours | `24` | No user override |
| financial | minCoverage | `0.9` | No user override |
| calendar | minCoverage | `0.7` | No user override |
| all | confidencePenalty | various | No user override |

**Recommendation:** Allow policy overrides via configuration.

---

### 2.4 Trigger System

**Location:** `packages/triggers/src/data-driven/store-watcher.ts:73-78`

| Value | Line | Hardcoded | Should Be |
|-------|------|-----------|-----------|
| debounceMs | 75 | `1000` | Configurable (is configurable) |
| batchSize | 76 | `10` | Configurable (is configurable) |

**Location:** `packages/triggers/src/coordinator/intent-classifier.ts:12-29`

| Value | Hardcoded | Issue |
|-------|-----------|-------|
| INTENT_PATTERNS | Static | Cannot add new intents without code change |
| ENTITY_PATTERNS | Static | Cannot add new entity types |
| Default intent | `'shopping'` (line 92) | Should be configurable |
| Confidence calculation | `0.4 + (score/max) * 0.55` | Magic numbers |

---

### 2.5 Agent Registry Defaults

**Location:** `packages/triggers/src/coordinator/agent-registry.ts:28-60`

| Value | Hardcoded | Issue |
|-------|-----------|-------|
| Shopping intents | 7 keywords | Static list |
| Content intents | 7 keywords | Static list |
| Namespace strings | Raw strings | Should use NS factory |
| Disabled agents | travel, restaurant | Hard-disable with no config |

---

## 3. MISSING V13 REQUIREMENTS

### 3.1 Missing Budget Integration (v13 Section 6.10)

**Issue:** LLM fallback chain doesn't integrate with budget management

**v13 Requirement (Section 6.10.1):**
```typescript
// Budget throttling thresholds:
// 50% -> Log warning
// 80% -> Reduce model tier
// 95% -> Defer non-urgent operations
// 100% -> Local only
```

**Current State:** No budget checking in fallback chain. The `llm_budget_exceeded` error state exists but is never triggered by the fallback chain itself.

---

### 3.2 Missing Rate Limit Specifications (v13 Section 3.6)

**v13 Requirement:** Per-agent API rate limits

| Agent | API | Rate Limit |
|-------|-----|------------|
| Shopping | SerpAPI | 100/hour |
| Travel | Google Flights | 60/hour |
| Restaurant | Yelp | 100/hour |

**Current State:** Circuit breaker config doesn't enforce rate limits, only failure thresholds.

---

### 3.3 Missing Cron Schedule Specifications

**v13 Requirement (Section 3.2):**
```typescript
schedules: {
  daily_digest: "0 8 * * *",       // 8 AM daily
  weekly_review: "0 10 * * SUN",   // 10 AM Sundays
  monthly_planning: "0 9 1 * *",   // 9 AM first of month
}
```

**Current State:** Schedules are not pre-configured. User must pass them in config.

---

## 4. CODE QUALITY ISSUES

### 4.1 Type Safety Gaps

**Location:** `packages/triggers/src/engine/trigger-engine.ts:283`

```typescript
// UNSAFE TYPE ASSERTION:
store: this.config.store as unknown as AgentStore,
```

This bypasses TypeScript's type checking. Should properly align MemoryStore and AgentStore interfaces.

---

### 4.2 Console Logging Instead of Proper Logger

**Locations:**
- `packages/resilience/src/fallback/llm-chain.ts:106-107`
- `packages/triggers/src/data-driven/store-watcher.ts:96,116,250`
- `packages/triggers/src/engine/trigger-engine.ts:152-153,161-163,180`

**Issue:** Uses raw `console.log/warn/error` instead of structured logging.

**Recommendation:** Use the observability package logger when available.

---

### 4.3 Missing PACKAGE.md Documentation

**Issue:** Neither `@ownyou/resilience` nor `@ownyou/triggers` has PACKAGE.md files.

**v13 Pattern (from other packages):** All packages should have PACKAGE.md with:
- Architecture overview
- API reference
- Usage examples
- V13 section references

---

## 5. SPRINT 5 SPEC COMPLIANCE

### 5.1 Deliverables Checklist

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 1 | CircuitBreaker Registry | COMPLETE | Complete |
| 2 | External API Resilience | COMPLETE | SerpAPI, RSS protected |
| 3 | LLM Fallback Chain | PARTIAL | Missing budget integration |
| 4 | Partial Data Handling | PARTIAL | Email threshold wrong |
| 5 | Error Recovery UI | COMPLETE | States defined |
| 6 | Data-Driven Triggers | COMPLETE | StoreWatcher works |
| 7 | Enhanced Scheduler | COMPLETE | Cron parsing works |
| 8 | Event-Driven Triggers | COMPLETE | Mock handlers present |
| 9 | Agent Coordinator | PARTIAL | Namespace violations |
| 10 | Integration Tests | BLOCKED | Build issue prevents running |

---

## 6. RECOMMENDED FIXES

### Priority 1: Critical V13 Violations

1. **Fix namespace usage in agent-registry.ts**
   - Import `NAMESPACES` from `@ownyou/shared-types`
   - Refactor to use `NAMESPACES.IAB_CLASSIFICATIONS` etc.

2. **Fix email minCoverage in policies.ts**
   - Change from `0.5` to `0.8` per v13

3. **Add ALTERNATIVE_PROVIDERS mapping**
   - Implement automatic provider switching in fallback chain

### Priority 2: Hardcoded Values

4. **Extract circuit breaker configs to environment**
   - Create config loader that reads from env/settings

5. **Make intent patterns configurable**
   - Allow runtime registration of new intents

6. **Make partial data policies overridable**
   - Add config merge capability

### Priority 3: Documentation & Quality

7. **Add PACKAGE.md to both packages**
   - Follow pattern from other packages

8. **Fix integration test build issue**
   - Debug the workspace package resolution

9. **Replace console.log with structured logger**
   - Integrate with @ownyou/observability when available

10. **Fix type assertion in trigger-engine.ts**
    - Properly align AgentStore and MemoryStore interfaces

---

## 7. FILES REQUIRING MODIFICATION

| File | Priority | Changes Needed |
|------|----------|----------------|
| `packages/triggers/src/coordinator/agent-registry.ts` | P1 | Use NAMESPACES constants |
| `packages/resilience/src/partial-data/policies.ts` | P1 | Fix email minCoverage to 0.8 |
| `packages/resilience/src/fallback/llm-chain.ts` | P1 | Add ALTERNATIVE_PROVIDERS |
| `packages/resilience/PACKAGE.md` | P3 | Create documentation |
| `packages/triggers/PACKAGE.md` | P3 | Create documentation |
| `packages/triggers/src/engine/trigger-engine.ts` | P3 | Fix type assertion |
| `packages/resilience/src/circuit-breaker/config.ts` | P2 | Make configurable |
| `packages/triggers/src/coordinator/intent-classifier.ts` | P2 | Make patterns configurable |

---

## 8. TEST STATUS

```
@ownyou/resilience: 84 tests passing (4 test files)
@ownyou/triggers: 68 tests passing (4 test files)
Total: 152 tests passing
```

**Note:** Tests pass but don't validate v13 namespace compliance since the implementation uses raw strings.

---

## 9. REMEDIATION PLAN

### Phase 1: Critical V13 Violations (Priority 1)

#### Task 1.1: Fix Namespace Usage in Agent Registry
**File:** `packages/triggers/src/coordinator/agent-registry.ts`

```typescript
// BEFORE:
namespaces: ['ownyou.iab', 'ownyou.semantic', 'ownyou.entities']

// AFTER:
import { NAMESPACES, type Namespace } from '@ownyou/shared-types';
namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.SEMANTIC_MEMORY, NAMESPACES.ENTITIES]
```

**Also update:**
- `packages/triggers/src/data-driven/store-watcher.ts` - config type
- `packages/triggers/src/engine/trigger-engine.ts` - watchNamespaces type

#### Task 1.2: Fix Email minCoverage
**File:** `packages/resilience/src/partial-data/policies.ts:14`

```typescript
// BEFORE:
minCoverage: 0.5,  // v13: 0.8 for email_sync, using 0.5 for MVP

// AFTER:
minCoverage: 0.8,  // v13: min_success_rate: 0.8
```

#### Task 1.3: Add ALTERNATIVE_PROVIDERS Mapping
**File:** `packages/resilience/src/fallback/llm-chain.ts`

```typescript
/**
 * Alternative provider mapping (v13 Section 6.11.3)
 */
const ALTERNATIVE_PROVIDERS: Record<string, string> = {
  openai: 'anthropic',
  anthropic: 'openai',
  google: 'groq',
  groq: 'deepinfra',
};

export function getAlternativeProvider(provider: string): string | undefined {
  return ALTERNATIVE_PROVIDERS[provider];
}
```

---

### Phase 2: Hardcoded Values -> Configurable (Priority 2)

#### Task 2.1: Circuit Breaker Config Loader
**File:** `packages/resilience/src/circuit-breaker/config.ts`

```typescript
export interface CircuitBreakerEnvironmentConfig {
  apiConfigs?: Partial<Record<string, Partial<ApiConfig>>>;
}

export function getApiConfigs(envConfig?: CircuitBreakerEnvironmentConfig): Record<string, ApiConfig> {
  const base = { ...API_CONFIGS };
  if (envConfig?.apiConfigs) {
    for (const [api, overrides] of Object.entries(envConfig.apiConfigs)) {
      if (base[api] && overrides) {
        base[api] = { ...base[api], ...overrides };
      }
    }
  }
  return base;
}
```

#### Task 2.2: Make Intent Patterns Configurable
**File:** `packages/triggers/src/coordinator/intent-classifier.ts`

```typescript
export interface IntentClassifierConfig {
  patterns?: Record<string, string[]>;
  defaultIntent?: string;
  entityPatterns?: Record<string, RegExp[]>;
}

let currentConfig: IntentClassifierConfig = {};

export function configureIntentClassifier(config: IntentClassifierConfig): void {
  currentConfig = config;
}
```

#### Task 2.3: Make Partial Data Policies Overridable
**File:** `packages/resilience/src/partial-data/policies.ts`

```typescript
export interface PartialDataPolicyOverrides {
  [source: string]: Partial<PartialDataPolicy>;
}

let policyOverrides: PartialDataPolicyOverrides = {};

export function configurePartialDataPolicies(overrides: PartialDataPolicyOverrides): void {
  policyOverrides = overrides;
}
```

---

### Phase 3: Documentation & Quality (Priority 3)

#### Task 3.1: Create PACKAGE.md for Resilience
**File:** `packages/resilience/PACKAGE.md`

#### Task 3.2: Create PACKAGE.md for Triggers
**File:** `packages/triggers/PACKAGE.md`

#### Task 3.3: Fix Type Assertion in TriggerEngine
**File:** `packages/triggers/src/engine/trigger-engine.ts:283`

#### Task 3.4: Update Tests for V13 Compliance

---

### Phase 4: Integration Test Fix

#### Task 4.1: Fix Integration Test Build
**File:** `packages/integration-tests/src/__tests__/trigger-flow.test.ts`

---

## 10. EXECUTION ORDER

1. **Task 1.2** - Fix email minCoverage (1 line change, immediate)
2. **Task 1.1** - Fix namespace usage (refactor, 3 files)
3. **Task 1.3** - Add ALTERNATIVE_PROVIDERS (new code, 1 file)
4. **Task 2.3** - Make policies configurable (enhancement)
5. **Task 2.1** - Circuit breaker config (enhancement)
6. **Task 2.2** - Intent patterns configurable (enhancement)
7. **Task 3.1** - PACKAGE.md resilience (documentation)
8. **Task 3.2** - PACKAGE.md triggers (documentation)
9. **Task 3.3** - Fix type assertion (code quality)
10. **Task 3.4** - Update tests (verification)
11. **Task 4.1** - Fix integration test (verification)

---

## 11. FILES TO MODIFY

| File | Task | Type |
|------|------|------|
| `packages/resilience/src/partial-data/policies.ts` | 1.2, 2.3 | Fix + Enhance |
| `packages/triggers/src/coordinator/agent-registry.ts` | 1.1 | Fix |
| `packages/triggers/src/data-driven/store-watcher.ts` | 1.1 | Fix |
| `packages/triggers/src/engine/trigger-engine.ts` | 1.1, 3.3 | Fix |
| `packages/resilience/src/fallback/llm-chain.ts` | 1.3 | Add |
| `packages/resilience/src/circuit-breaker/config.ts` | 2.1 | Enhance |
| `packages/triggers/src/coordinator/intent-classifier.ts` | 2.2 | Enhance |
| `packages/resilience/PACKAGE.md` | 3.1 | Create |
| `packages/triggers/PACKAGE.md` | 3.2 | Create |
| Test files | 3.4 | Update |
