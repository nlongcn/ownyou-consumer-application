# Sprint 11a v13 Architecture Compliance Bugfix

**Date:** 2025-12-15
**Status:** PLANNED
**Priority:** HIGH
**Affected Files:** DataSourceContext.tsx, Settings UI, ResilienceContext.tsx, MemoryContext.tsx

---

## Problem Statement

Sprint 11a was implemented with hardcoded values and missing features that deviate from v13 architecture specification. This document specifies the fixes required to bring the implementation into compliance.

---

## Deviation 1: Hardcoded `data_source_configs`

### Current State (WRONG)
**File:** `apps/consumer/src/contexts/DataSourceContext.tsx:529-536`
```typescript
fetchOptions: {
  maxResults: 100,
  daysBack: 30,
}
```

### v13 Requirement
**Source:** `docs/architecture/OwnYou_architecture_v13.md:1476`
```typescript
"data_source_configs": "lww-map",  // User-configurable, synced across devices
```

### Fix Required

#### 1.1 Add namespace to shared-types
**File:** `packages/shared-types/src/namespaces.ts`
```typescript
// Add to NS constant
dataSourceConfigs: (userId: string) => ["ownyou.data_source_configs", userId],
```

#### 1.2 Create DataSourceConfig interface
**File:** `packages/shared-types/src/data-source.ts` (NEW)
```typescript
export interface DataSourceConfig {
  sourceId: 'gmail' | 'outlook' | 'google-calendar' | 'microsoft-calendar' | 'plaid';
  enabled: boolean;
  fetchOptions: {
    maxResults: number;      // Default: 100
    daysBack: number;        // Default: 30 for email, 90 for calendar, 90 for financial
  };
  syncFrequency: 'manual' | 'hourly' | 'daily';
  lastModified: number;
}

export const DEFAULT_DATA_SOURCE_CONFIGS: Record<string, Partial<DataSourceConfig['fetchOptions']>> = {
  'gmail': { maxResults: 100, daysBack: 30 },
  'outlook': { maxResults: 100, daysBack: 30 },
  'google-calendar': { maxResults: 500, daysBack: 90 },
  'microsoft-calendar': { maxResults: 500, daysBack: 90 },
  'plaid': { maxResults: 500, daysBack: 90 },
};
```

#### 1.3 Update DataSourceContext to read from Store
**File:** `apps/consumer/src/contexts/DataSourceContext.tsx`

Replace hardcoded values:
```typescript
// BEFORE (line 529-536)
fetchOptions: {
  maxResults: 100,
  daysBack: 30,
}

// AFTER
const getConfigForSource = async (sourceId: DataSource['id']): Promise<DataSourceConfig['fetchOptions']> => {
  const config = await store.get<DataSourceConfig>(
    NS.dataSourceConfigs(userId),
    sourceId
  );
  return config?.fetchOptions ?? DEFAULT_DATA_SOURCE_CONFIGS[sourceId];
};

// Then in syncSource:
const fetchOptions = await getConfigForSource(sourceId);
```

---

## Deviation 2: No Settings UI for Data Source Configuration

### Current State (WRONG)
No UI exists for users to configure:
- How many emails to fetch
- How far back to fetch
- Sync frequency

### v13 Requirement
User-configurable settings stored in `data_source_configs` lww-map that syncs across devices.

### Fix Required

#### 2.1 Create DataSourceSettings component
**File:** `apps/consumer/src/routes/Settings/DataSourceSettings.tsx` (NEW)

```typescript
export function DataSourceSettings() {
  const { store } = useStore();
  const { wallet } = useAuth();
  const userId = wallet?.address ?? 'anonymous';

  const [configs, setConfigs] = useState<Record<string, DataSourceConfig>>({});

  // Load configs from store
  useEffect(() => {
    const loadConfigs = async () => {
      const items = await store.list<DataSourceConfig>(NS.dataSourceConfigs(userId));
      const configMap = Object.fromEntries(items.map(i => [i.key, i.value]));
      setConfigs(configMap);
    };
    loadConfigs();
  }, [store, userId]);

  const updateConfig = async (sourceId: string, updates: Partial<DataSourceConfig['fetchOptions']>) => {
    const current = configs[sourceId] ?? { fetchOptions: DEFAULT_DATA_SOURCE_CONFIGS[sourceId] };
    const updated = {
      ...current,
      fetchOptions: { ...current.fetchOptions, ...updates },
      lastModified: Date.now(),
    };
    await store.put(NS.dataSourceConfigs(userId), sourceId, updated);
    setConfigs(prev => ({ ...prev, [sourceId]: updated }));
  };

  return (
    <div className="space-y-6">
      <h2>Data Source Settings</h2>

      {/* Email settings */}
      <section>
        <h3>Email Fetch Settings</h3>
        <label>
          Maximum emails to fetch:
          <input
            type="number"
            value={configs['gmail']?.fetchOptions?.maxResults ?? 100}
            onChange={(e) => updateConfig('gmail', { maxResults: parseInt(e.target.value) })}
            min={10}
            max={500}
          />
        </label>
        <label>
          Days of history:
          <input
            type="number"
            value={configs['gmail']?.fetchOptions?.daysBack ?? 30}
            onChange={(e) => updateConfig('gmail', { daysBack: parseInt(e.target.value) })}
            min={7}
            max={365}
          />
        </label>
      </section>

      {/* Similar for calendar, financial */}
    </div>
  );
}
```

#### 2.2 Add route to Settings
**File:** `apps/consumer/src/routes/Settings.tsx`

Add DataSourceSettings as a tab/section in the Settings page.

---

## Deviation 3: Invented `uiPreferences` namespace

### Current State (WRONG)
**File:** `apps/consumer/src/contexts/DataSourceContext.tsx:465`
```typescript
await store.put(NS.uiPreferences(userId), `oauth_${sourceId}`, { ... });
```

### v13 Requirement
**Source:** `docs/architecture/OwnYou_architecture_v13.md:5693-5736`

The v13 namespace schema does not include `uiPreferences`. OAuth tokens should be stored securely, separate from synced data.

### Fix Required

#### 3.1 Create proper namespace for OAuth tokens
OAuth tokens should NOT sync (device-specific) and should be encrypted. Options:

**Option A (Recommended):** Use Tauri's secure storage for tokens
```typescript
// In Tauri desktop
import { store } from '@tauri-apps/plugin-store';
const secureStore = await store.load('oauth-tokens.dat', { autoSave: true });
await secureStore.set(`oauth_${sourceId}`, { accessToken, refreshToken });
```

**Option B:** Create device-local namespace (no sync)
```typescript
// Add to namespaces.ts
oauthTokens: (deviceId: string) => ["ownyou.oauth_tokens", deviceId],  // Device-local, no sync
```

#### 3.2 Remove uiPreferences from codebase
Search and replace all uses of `NS.uiPreferences` with appropriate alternatives.

---

## Deviation 4: Missing Partial Data Handling

### Current State (WRONG)
No handling for partial data fetches. If 50% of emails fail to fetch, the system has no policy.

### v13 Requirement
**Source:** `docs/architecture/OwnYou_architecture_v13.md:3052-3099`

```typescript
interface PartialDataPolicy {
  email: {
    min_coverage: 0.5;      // Accept if ≥50% fetched
    show_warning: true;
    proceed_with_partial: true;
    confidence_penalty: 0.2;
  };
  financial: {
    min_coverage: 0.9;      // Require ≥90%
    show_warning: true;
    proceed_with_partial: false;  // Fail if below
    prompt_retry: true;
  };
  calendar: {
    min_coverage: 0.7;
    show_warning: true;
    proceed_with_partial: true;
    confidence_penalty: 0.15;
  };
}
```

### Fix Required

#### 4.1 Add partial data handling to DataSourceContext
**File:** `apps/consumer/src/contexts/DataSourceContext.tsx`

```typescript
const PARTIAL_DATA_POLICIES = {
  email: { minCoverage: 0.5, proceedWithPartial: true, confidencePenalty: 0.2 },
  financial: { minCoverage: 0.9, proceedWithPartial: false, confidencePenalty: 0 },
  calendar: { minCoverage: 0.7, proceedWithPartial: true, confidencePenalty: 0.15 },
};

const handlePartialData = (
  dataSource: string,
  fetchedCount: number,
  expectedCount: number
): { proceed: boolean; warning: string | null; confidenceMultiplier: number } => {
  const policy = PARTIAL_DATA_POLICIES[dataSource];
  const coverage = fetchedCount / expectedCount;

  if (coverage < policy.minCoverage && !policy.proceedWithPartial) {
    throw new Error(`Insufficient ${dataSource} data: ${Math.round(coverage * 100)}% (need ${policy.minCoverage * 100}%)`);
  }

  return {
    proceed: true,
    warning: coverage < 1.0 ? `Using ${Math.round(coverage * 100)}% of available ${dataSource} data` : null,
    confidenceMultiplier: coverage < 1.0 ? (1 - policy.confidencePenalty) : 1.0,
  };
};
```

---

## Deviation 5: Missing Per-API Circuit Breaker Configuration

### Current State (WRONG)
ResilienceContext exists but doesn't configure per-API circuit breaker settings.

### v13 Requirement
**Source:** `docs/architecture/OwnYou_architecture_v13.md:2873-2887`

```typescript
per_api_config: {
  plaid: { retries: 3; timeout_ms: 10000; critical: true };
  serpapi: { retries: 2; timeout_ms: 5000; critical: false };
  tripadvisor: { retries: 2; timeout_ms: 5000; critical: false };
  ticketmaster: { retries: 2; timeout_ms: 5000; critical: false };
  google_flights: { retries: 2; timeout_ms: 8000; critical: false };
  yelp: { retries: 2; timeout_ms: 5000; critical: false };
  opentable: { retries: 2; timeout_ms: 5000; critical: false };
};
```

### Fix Required

#### 5.1 Add API configs to resilience package
**File:** `packages/resilience/src/config.ts` (NEW or update)

```typescript
export const API_CONFIGS = {
  // Data source APIs
  gmail_api: { retries: 3, timeoutMs: 15000, critical: true },
  outlook_api: { retries: 3, timeoutMs: 15000, critical: true },
  google_calendar: { retries: 2, timeoutMs: 10000, critical: false },
  microsoft_calendar: { retries: 2, timeoutMs: 10000, critical: false },
  plaid: { retries: 3, timeoutMs: 10000, critical: true },

  // External APIs for agents
  serpapi: { retries: 2, timeoutMs: 5000, critical: false },
  tripadvisor: { retries: 2, timeoutMs: 5000, critical: false },
  ticketmaster: { retries: 2, timeoutMs: 5000, critical: false },
  google_flights: { retries: 2, timeoutMs: 8000, critical: false },
  yelp: { retries: 2, timeoutMs: 5000, critical: false },
  opentable: { retries: 2, timeoutMs: 5000, critical: false },

  // LLM APIs
  openai: { retries: 3, timeoutMs: 30000, critical: false },
  anthropic: { retries: 3, timeoutMs: 30000, critical: false },
};

export type ApiName = keyof typeof API_CONFIGS;
```

#### 5.2 Update CircuitBreakerRegistry to use configs
**File:** `packages/resilience/src/circuit-breaker.ts`

```typescript
import { API_CONFIGS, ApiName } from './config';

class CircuitBreakerRegistry {
  private getConfig(apiName: string) {
    return API_CONFIGS[apiName as ApiName] ?? {
      retries: 2,
      timeoutMs: 5000,
      critical: false,
    };
  }

  async execute<T>(apiName: string, operation: () => Promise<T>, fallback?: () => T): Promise<T> {
    const config = this.getConfig(apiName);
    // Use config.retries, config.timeoutMs, etc.
    // ...
  }
}
```

---

## Deviation 6: Missing LLM Budget Management

### Current State (WRONG)
No budget tracking, no throttling, no model tier downgrades when budget exceeded.

### v13 Requirement
**Source:** `docs/architecture/OwnYou_architecture_v13.md:2649-2844`

- Monthly budget: $10/user
- Track usage by operation type
- Throttle at 50%, 80%, 95%, 100% thresholds
- Store usage in `LLM_USAGE_NAMESPACE`

### Fix Required

#### 6.1 Add LLM usage namespace
**File:** `packages/shared-types/src/namespaces.ts`

```typescript
llmUsageDaily: (userId: string) => ["ownyou.llm_usage.daily", userId],
llmUsageMonthly: (userId: string) => ["ownyou.llm_usage.monthly", userId],
```

#### 6.2 Create budget enforcement module
**File:** `packages/llm-client/src/budget.ts` (NEW)

```typescript
interface UserLLMUsage {
  userId: string;
  period: 'daily' | 'monthly';
  periodStart: number;
  usage: {
    totalTokens: number;
    totalCostUsd: number;
    byOperation: Record<string, { invocations: number; tokens: number; costUsd: number }>;
    byModel: Record<string, { tokens: number; costUsd: number }>;
  };
  throttleState: 'normal' | 'warning' | 'reduced' | 'deferred' | 'local_only';
}

const MONTHLY_BUDGET_USD = 10;

const THROTTLE_THRESHOLDS = {
  warning: 0.5,      // 50%
  reduced: 0.8,      // 80% - downgrade model tier
  deferred: 0.95,    // 95% - defer non-urgent
  localOnly: 1.0,    // 100% - WebLLM only
};

export async function enforceBudget(
  userId: string,
  request: LLMRequest,
  store: Store
): Promise<LLMRequest> {
  const usage = await store.get<UserLLMUsage>(NS.llmUsageMonthly(userId), 'current');
  const budgetUsedPercent = (usage?.usage.totalCostUsd ?? 0) / MONTHLY_BUDGET_USD;

  if (budgetUsedPercent >= THROTTLE_THRESHOLDS.localOnly) {
    return { ...request, model: 'webllm/Llama-3-8B-Instruct-q4f32_1', throttled: true };
  }

  if (budgetUsedPercent >= THROTTLE_THRESHOLDS.deferred && !request.urgent) {
    throw new DeferredRequestError('Budget nearly exhausted. Request deferred.');
  }

  if (budgetUsedPercent >= THROTTLE_THRESHOLDS.reduced) {
    const downgradedModel = downgradeModel(request.model);
    return { ...request, model: downgradedModel, throttled: true };
  }

  return request;
}
```

---

## Deviation 7: Missing `reflectionState` Namespace Usage

### Current State (WRONG)
MemoryContext mentions ReflectionTriggerManager but doesn't show persistence of reflection state.

### v13 Requirement
**Source:** `docs/architecture/OwnYou_architecture_v13.md:5723`
```typescript
reflectionState: (userId: string) => ["ownyou.reflection", userId],
```

### Fix Required

#### 7.1 Ensure ReflectionTriggerManager persists state
**File:** `packages/reflection/src/trigger-manager.ts`

```typescript
class ReflectionTriggerManager {
  async saveState(): Promise<void> {
    await this.store.put(NS.reflectionState(this.userId), 'state', {
      episodeCount: this.episodeCount,
      lastReflectionTime: this.lastReflectionTime,
      lastDailyRun: this.lastDailyRun,
      lastWeeklyRun: this.lastWeeklyRun,
    });
  }

  async loadState(): Promise<void> {
    const state = await this.store.get(NS.reflectionState(this.userId), 'state');
    if (state) {
      this.episodeCount = state.episodeCount;
      this.lastReflectionTime = state.lastReflectionTime;
      // etc.
    }
  }
}
```

---

## Implementation Order

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | Deviation 1: User-configurable data_source_configs | Medium | High - Core UX issue |
| **P0** | Deviation 2: Settings UI for data sources | Medium | High - Enables P0.1 |
| **P1** | Deviation 4: Partial data handling | Low | Medium - Resilience |
| **P1** | Deviation 5: Per-API circuit breaker configs | Low | Medium - Resilience |
| **P2** | Deviation 3: Fix uiPreferences namespace | Low | Low - Cleanup |
| **P2** | Deviation 6: LLM budget management | High | Medium - Cost control |
| **P2** | Deviation 7: reflectionState persistence | Low | Low - Already may work |

---

## Success Criteria

- [ ] User can configure email fetch settings in Settings UI
- [ ] Settings persist across app restarts
- [ ] Settings sync across devices (via OrbitDB lww-map)
- [ ] Partial data fetch shows warning but proceeds (for email/calendar)
- [ ] Financial data fetch fails gracefully if <90% coverage
- [ ] Circuit breakers use per-API timeout configurations
- [ ] LLM usage tracked and throttled at thresholds (Phase 2)

---

## Related Documents

- `docs/architecture/OwnYou_architecture_v13.md` - Source of truth
- `docs/sprints/ownyou-sprint11a-spec.md` - Original implementation spec
- `packages/shared-types/src/namespaces.ts` - Namespace definitions

---

**Document History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-15 | Claude Code | Initial bugfix specification |
