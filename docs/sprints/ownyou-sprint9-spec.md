# Sprint 9: Observability & Debugging

**Duration:** 2 weeks
**Status:** ⚠️ INCOMPLETE (~15% complete)
**Goal:** Implement production-ready debugging, comprehensive tracing, LLM cost visibility, and GDPR-compliant data export
**Success Criteria:** Agent traces captured with full detail, LLM costs visible in dashboard, Debug UI accessible from Settings, GDPR-compliant data export working
**Depends On:** Sprint 8 complete (Data Sources + Diagnostic Agent)
**v13 Coverage:** Section 10 (Complete)

---

## Previous Sprint Summary

### Sprint 8: Data Sources + Diagnostic Agent (COMPLETE)

- `@ownyou/data-financial` — Plaid integration (mock), transaction IAB classification (113 tests)
- `@ownyou/data-calendar` — Google/Microsoft calendar, relationship extraction (131 tests)
- `@ownyou/agents-diagnostic` — Profile analysis, pattern detection, LLM insights (63 tests)
- Total: 307 tests (236% of target)

**Current State:**

- 6 agents operational (Shopping, Content, Restaurant, Events, Travel, Diagnostic)
- 4 data sources operational (Email, Financial, Calendar, Browser)
- Memory system with hybrid retrieval and reflection
- 4-mode trigger system with agent coordinator
- Ikigai intelligence layer for personalization
- **Basic observability package exists** (`@ownyou/observability` with tracing types)
- **No sync debugging infrastructure**
- **No LLM cost dashboard**
- **No Debug UI components**
- **No GDPR data export**

---

## Sprint 9 Overview

```
+------------------------------------------------------------------+
|                     SPRINT 9 END STATE                            |
+------------------------------------------------------------------+
|                                                                   |
|  WEEK 1: TRACING & LOGGING INFRASTRUCTURE                         |
|  +----------------------------------------------------------+     |
|  | [Enhance AgentTracer with v13-complete step types]       |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Add SyncLogger for cross-device sync debugging]         |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement LLMMetricsCollector for cost tracking]        |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Create privacy-preserving sanitization for traces]      |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 2: DEBUG UI & GDPR EXPORT                                   |
|  +----------------------------------------------------------+     |
|  | [Build Agent Inspector UI component]                     |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Build Cost Dashboard UI component]                      |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Build Sync Monitor UI (placeholder for Sprint 10)]      |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement GDPR data export (Right to Access)]           |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement data deletion (Right to be Forgotten)]        |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  PRODUCTION-READY DEBUGGING FOR 6 AGENTS + 4 DATA SOURCES         |
|  GDPR COMPLIANCE FOR EU USERS                                     |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture Compliance

### Target Sections: v13 Section 10 (Observability & Debugging)

| v13 Section | Requirement | Sprint 9 Implementation | Priority |
|-------------|-------------|------------------------|----------|
| **10.1** | Observability Architecture | 3-layer architecture (traces, sync logs, LLM metrics) | P0 |
| **10.2** | Agent Execution Tracing | Enhanced AgentStep types, full trace capture | P0 |
| **10.3** | Sync Debugging | SyncLog types and SyncLogger (infrastructure only, full impl in Sprint 10) | P1 |
| **10.4** | LLM Cost Metering Dashboard | LLMMetrics collector, projections, alerts | P0 |
| **10.5** | Debug UI Components | Agent Inspector, Cost Dashboard, Sync Monitor (placeholder) | P0 |
| **10.6** | GDPR Data Export | Full user data export, Right to be Forgotten | P0 |
| **10.7** | Observability Namespaces | Add DEBUG_* namespaces to shared-types | P0 |
| **10.8** | Privacy-Preserving Debugging | Sanitization, truncation, PII redaction | P0 |

### Already Complete (from previous sprints)

| v13 Section | Requirement | Status |
|-------------|-------------|--------|
| **3.6.1** | All 6 mission agents | ✅ Sprint 3-8 |
| **3.1-3.5** | Mission State Machine, Triggers, Coordinator | ✅ Sprint 5 |
| **2.1-2.9** | Complete Ikigai Intelligence | ✅ Sprint 6 |
| **8.1-8.11** | Memory system with retrieval and reflection | ✅ Sprint 4 |
| **Phase 2A** | Financial + Calendar data sources | ✅ Sprint 8 |

### Already Partially Complete

| v13 Section | Requirement | Current State | Sprint 9 Work |
|-------------|-------------|---------------|---------------|
| **10.2** | Agent Traces | Basic `AgentTracer` class exists | Enhance with v13-complete step types |

---

## Package Specifications

### Package 1: `@ownyou/observability` (Enhancement)

**Purpose:** Enhance existing package with v13-complete tracing, sync logging, LLM metrics

**Current State:**
- `AgentTrace`, `TraceSpan`, `TraceEvent` types exist
- `AgentTracer` class with basic trace management
- 8 tests passing

**Sprint 9 Additions:**

**Directory Structure:**
```
packages/observability/
├── src/
│   ├── index.ts                    # Existing (update exports)
│   ├── traces/
│   │   ├── index.ts                # Existing
│   │   ├── types.ts                # Existing (enhance)
│   │   └── tracer.ts               # Existing (enhance)
│   ├── sync/                       # NEW
│   │   ├── index.ts
│   │   ├── types.ts                # SyncLog, conflict types
│   │   └── sync-logger.ts          # SyncLogger class
│   ├── llm/                        # NEW
│   │   ├── index.ts
│   │   ├── types.ts                # LLMMetrics, projections
│   │   └── metrics-collector.ts    # LLMMetricsCollector class
│   ├── privacy/                    # NEW
│   │   ├── index.ts
│   │   └── sanitizer.ts            # PII redaction, truncation
│   ├── export/                     # NEW
│   │   ├── index.ts
│   │   ├── types.ts                # DataExport interfaces
│   │   ├── exporter.ts             # DataExporter class
│   │   └── deletion.ts             # Data deletion (GDPR)
│   └── retention/                  # NEW
│       ├── index.ts
│       └── cleanup.ts              # Auto-cleanup by retention policy
└── __tests__/
    ├── traces.test.ts              # Existing (expand)
    ├── sync-logger.test.ts         # NEW
    ├── llm-metrics.test.ts         # NEW
    ├── sanitizer.test.ts           # NEW
    ├── exporter.test.ts            # NEW
    └── retention.test.ts           # NEW
```

#### Enhanced Trace Types (v13 Section 10.2)

```typescript
// Add to types.ts - complete AgentStep types from v13
interface AgentStep {
  step_index: number;
  step_type: 'llm_call' | 'tool_call' | 'memory_read' | 'memory_write' | 'decision' | 'external_api';
  timestamp: number;
  duration_ms: number;

  // For LLM calls
  llm?: {
    model: string;
    prompt_preview: string;      // First 200 chars (for debugging)
    response_preview: string;    // First 200 chars
    tokens: { input: number; output: number };
    cost_usd: number;
  };

  // For tool calls
  tool?: {
    name: string;
    args: Record<string, unknown>;
    result_preview: string;
    success: boolean;
    error?: string;
  };

  // For memory operations
  memory?: {
    operation: 'read' | 'write' | 'search' | 'delete';
    namespace: string;
    key?: string;
    query?: string;
    result_count?: number;
  };

  // For external API calls
  external_api?: {
    service: string;
    endpoint: string;
    status_code: number;
    latency_ms: number;
    cached: boolean;
  };

  // For decisions
  decision?: {
    decision_point: string;
    options_considered: string[];
    selected: string;
    reasoning: string;
  };
}
```

#### SyncLog Types (v13 Section 10.3)

```typescript
// src/sync/types.ts
interface SyncLog {
  log_id: string;
  device_id: string;
  peer_device_id?: string;
  timestamp: number;

  event_type:
    | 'sync_started'
    | 'sync_completed'
    | 'conflict_detected'
    | 'conflict_resolved'
    | 'connection_established'
    | 'connection_failed'
    | 'connection_lost'
    | 'data_corrupted'
    | 'queue_overflow';

  details: {
    sync?: {
      direction: 'push' | 'pull' | 'bidirectional';
      records_sent: number;
      records_received: number;
      bytes_transferred: number;
      latency_ms: number;
    };

    conflict?: {
      namespace: string;
      key: string;
      local_value_preview: string;
      remote_value_preview: string;
      local_timestamp: number;
      remote_timestamp: number;
      resolution: 'local_wins' | 'remote_wins' | 'merged' | 'manual';
      resolution_reason: string;
    };

    connection?: {
      peer_count: number;
      connection_type: 'direct_p2p' | 'relayed' | 'cloud_backup';
      nat_type?: string;
    };

    error?: {
      type: string;
      message: string;
      recoverable: boolean;
      recovery_action?: string;
    };
  };
}

// Conflict notification levels (by namespace sensitivity)
const CONFLICT_NOTIFICATION_RULES: Record<string, 'silent' | 'toast' | 'modal'> = {
  'ownyou.earnings': 'modal',           // Financial data - always alert user
  'ownyou.missions': 'toast',           // Mission state - inform but don't block
  'ownyou.semantic': 'silent',          // Memories - auto-resolve silently
  'ownyou.episodic': 'silent',
  'ownyou.iab': 'silent',
  'ownyou.ikigai': 'toast',             // Profile changes - user should know
  'ownyou.preferences': 'toast',
};
```

#### LLMMetrics Types (v13 Section 10.4)

```typescript
// src/llm/types.ts
interface LLMMetrics {
  current_period: {
    period_type: 'daily' | 'monthly';
    period_start: number;
    total_cost_usd: number;
    budget_limit_usd: number;
    budget_remaining_usd: number;
    budget_used_percent: number;
    throttle_state: 'normal' | 'warning' | 'reduced' | 'deferred' | 'local_only';
  };

  by_agent: Record<string, {
    tokens: number;
    cost_usd: number;
    calls: number;
    avg_latency_ms: number;
  }>;

  by_operation: Record<string, {
    tokens: number;
    cost_usd: number;
    calls: number;
  }>;

  by_model: Record<string, {
    tokens: number;
    cost_usd: number;
    calls: number;
  }>;

  by_day: Array<{
    date: string;
    cost_usd: number;
    calls: number;
  }>;

  projections: {
    projected_monthly_cost: number;
    days_until_budget_exceeded: number | null;
    recommendation: 'on_track' | 'reduce_usage' | 'critical';
  };

  alerts: Array<{
    timestamp: number;
    type: 'info' | 'warning' | 'throttled' | 'budget_exceeded';
    message: string;
    acknowledged: boolean;
  }>;
}

interface LLMMetricsConfig {
  monthlyBudgetUsd: number;
  alertThresholds: {
    warning: number;      // 0.5 = 50%
    reduced: number;      // 0.8 = 80%
    deferred: number;     // 0.95 = 95%
    localOnly: number;    // 1.0 = 100%
  };
}
```

#### Privacy-Preserving Sanitizer (v13 Section 10.8)

```typescript
// src/privacy/sanitizer.ts
export interface SanitizeConfig {
  maxLength: number;
  redactPatterns: {
    email: boolean;
    phone: boolean;
    creditCard: boolean;
    ssn: boolean;
    customPatterns?: RegExp[];
  };
}

export const DEFAULT_SANITIZE_CONFIG: SanitizeConfig = {
  maxLength: 200,
  redactPatterns: {
    email: true,
    phone: true,
    creditCard: true,
    ssn: true,
  },
};

export function sanitizeForTrace(content: string, config: SanitizeConfig = DEFAULT_SANITIZE_CONFIG): string {
  let result = content;

  // Truncate
  if (result.length > config.maxLength) {
    result = result.substring(0, config.maxLength) + '...';
  }

  // Redact PII patterns
  if (config.redactPatterns.email) {
    result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  }
  if (config.redactPatterns.phone) {
    result = result.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  }
  if (config.redactPatterns.creditCard) {
    result = result.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]');
  }
  if (config.redactPatterns.ssn) {
    result = result.replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, '[SSN]');
  }

  // Custom patterns
  for (const pattern of config.redactPatterns.customPatterns ?? []) {
    result = result.replace(pattern, '[REDACTED]');
  }

  return result;
}
```

#### Data Export (v13 Section 10.6)

```typescript
// src/export/types.ts
export interface DataExportOptions {
  format: 'json' | 'csv';

  includes: {
    memories: boolean;
    profile: boolean;
    missions: boolean;
    preferences: boolean;
    earnings: boolean;
    consents: boolean;
    agent_traces: boolean;
    sync_logs: boolean;
    llm_usage: boolean;
  };

  date_range?: {
    start: number;
    end: number;
  };
}

export interface DataExportResult {
  exportId: string;
  timestamp: number;
  format: 'json' | 'csv';
  data: Blob;
  recordCount: number;
  namespaces: string[];
}

export interface DataDeletionResult {
  deleted_records: number;
  namespaces_cleared: string[];
  confirmation_id: string;
  timestamp: number;
}
```

**Namespace Updates Required:**

```typescript
// Add to @ownyou/shared-types/namespaces.ts
DEBUG_TRACES: 'ownyou.debug.traces',
DEBUG_SYNC: 'ownyou.debug.sync',
DEBUG_LLM: 'ownyou.debug.llm',
DEBUG_ERRORS: 'ownyou.debug.errors',
DEBUG_AUDIT: 'ownyou.debug.audit',

// Add factory functions
debugTraces: (userId: string) => ['ownyou.debug.traces', userId],
debugSync: (deviceId: string) => ['ownyou.debug.sync', deviceId],
debugLlm: (userId: string) => ['ownyou.debug.llm', userId],
debugErrors: (userId: string) => ['ownyou.debug.errors', userId],
debugAudit: (userId: string) => ['ownyou.debug.audit', userId],
```

**Success Criteria:**
- [  ] v13-complete AgentStep types implemented
- [  ] SyncLogger infrastructure ready (full impl in Sprint 10)
- [  ] LLMMetricsCollector with projections and alerts
- [  ] Privacy sanitizer with PII redaction
- [  ] Data export (JSON/CSV) working
- [  ] Data deletion (Right to be Forgotten) working
- [  ] Retention policy auto-cleanup
- [  ] 80%+ test coverage

---

### Package 2: `@ownyou/debug-ui`

**Purpose:** React components for debug panel in Settings

**Dependencies:**
- `@ownyou/observability` (trace/metrics reading)
- `@ownyou/ui-components` (shared UI primitives)
- `@ownyou/shared-types` (namespaces)

**Directory Structure:**
```
packages/debug-ui/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── components/
│   │   ├── AgentInspector/
│   │   │   ├── AgentInspector.tsx      # Main component
│   │   │   ├── TraceList.tsx           # List of traces
│   │   │   ├── TraceDetail.tsx         # Expanded trace view
│   │   │   ├── StepViewer.tsx          # Individual step viewer
│   │   │   └── TraceFilters.tsx        # Filter controls
│   │   ├── CostDashboard/
│   │   │   ├── CostDashboard.tsx       # Main component
│   │   │   ├── CostChart.tsx           # Daily cost chart
│   │   │   ├── AgentPieChart.tsx       # Cost by agent
│   │   │   ├── BudgetMeter.tsx         # Budget usage gauge
│   │   │   └── AlertsList.tsx          # Cost alerts
│   │   ├── SyncMonitor/
│   │   │   ├── SyncMonitor.tsx         # Main component (placeholder)
│   │   │   ├── ConnectionStatus.tsx    # Connection state
│   │   │   ├── PendingQueue.tsx        # Pending operations
│   │   │   └── ConflictResolver.tsx    # Manual conflict UI
│   │   └── DataExport/
│   │       ├── DataExport.tsx          # Export UI
│   │       ├── ExportOptions.tsx       # Checkbox options
│   │       └── DeleteDataModal.tsx     # Right to be Forgotten UI
│   ├── hooks/
│   │   ├── useTraces.ts
│   │   ├── useLLMMetrics.ts
│   │   └── useSyncStatus.ts
│   └── types.ts
└── __tests__/
    ├── AgentInspector.test.tsx
    ├── CostDashboard.test.tsx
    ├── SyncMonitor.test.tsx
    └── DataExport.test.tsx
```

#### Agent Inspector Component (v13 Section 10.5.1)

```typescript
// src/components/AgentInspector/AgentInspector.tsx
export interface AgentInspectorProps {
  userId: string;
  className?: string;
}

export interface AgentInspectorState {
  filters: {
    agentType?: string;
    status?: 'success' | 'error' | 'cancelled';
    dateRange?: [number, number];
    minDurationMs?: number;
    minCostUsd?: number;
  };
  selectedTraceId?: string;
  expandedSteps: number[];
}

// Features:
// - List recent traces with filtering
// - Expand trace to see all steps
// - Filter by agent type, status, date range
// - View LLM prompts/responses (sanitized)
// - View tool calls with args/results
// - Replay trace (re-run with same context)
// - Export trace as JSON
// - Delete traces
```

#### Cost Dashboard Component (v13 Section 10.5.3)

```typescript
// src/components/CostDashboard/CostDashboard.tsx
export interface CostDashboardProps {
  userId: string;
  className?: string;
}

// Features:
// - Budget meter showing usage %
// - Daily cost line chart
// - Cost by agent pie chart
// - Cost by model bar chart
// - Monthly budget control (set limit)
// - Alert acknowledgment
// - Projection warning
```

#### Sync Monitor Component (v13 Section 10.5.2)

```typescript
// src/components/SyncMonitor/SyncMonitor.tsx
export interface SyncMonitorProps {
  userId: string;
  deviceId: string;
  className?: string;
}

// NOTE: This is a PLACEHOLDER for Sprint 10
// Sprint 9 builds the UI shell, Sprint 10 implements actual sync
// Features (Sprint 10):
// - Connection status indicator
// - Peer count
// - Last sync time
// - Pending operations count
// - Force sync button
// - Conflict resolution UI
```

#### Data Export Component

```typescript
// src/components/DataExport/DataExport.tsx
export interface DataExportProps {
  userId: string;
  onExportComplete?: (result: DataExportResult) => void;
  onDeleteComplete?: (result: DataDeletionResult) => void;
}

// Features:
// - Checkbox for each data category
// - Date range picker
// - Format selector (JSON/CSV)
// - Download button
// - "Delete All Data" button (with confirmation modal)
```

**Success Criteria:**
- [  ] Agent Inspector shows traces with full step detail
- [  ] Cost Dashboard displays budget, charts, alerts
- [  ] Sync Monitor placeholder ready for Sprint 10
- [  ] Data Export UI with all GDPR features
- [  ] All components accessible from Settings → Debug
- [  ] 80%+ test coverage

---

## Implementation Requirements

### From Sprint 8 Lessons Learned (MANDATORY)

#### C1: Namespace Usage
```typescript
// ❌ NEVER do this
await store.put(['ownyou.debug.traces', userId], 'recent', {...});

// ✅ ALWAYS use NS.* factory functions
import { NS } from '@ownyou/shared-types';
await store.put(NS.debugTraces(userId), 'recent', {...});
```

#### C2: Unconditional Data Writes
```typescript
// ❌ NEVER do this
if (traces.length > 0) {
  await store.put(NS.debugTraces(userId), 'recent', {...});
}

// ✅ ALWAYS write, even when empty
await store.put(NS.debugTraces(userId), 'recent', {
  traces: traces,
  isEmpty: traces.length === 0,
  updatedAt: Date.now(),
});
```

#### I1: Configurable Model Selection (N/A for observability - no LLM calls)

#### I2: Extract Magic Numbers to Config
```typescript
// ❌ NEVER do this
const maxPreviewLength = 200;
const retentionDays = 30;

// ✅ Extract to typed config objects
export interface ObservabilityConfig {
  sanitization: {
    maxPreviewLength: number;
    truncationSuffix: string;
  };
  retention: {
    traces: number;       // days
    syncLogs: number;
    llmMetrics: number;
    errorLogs: number;
    auditLog: number;
  };
}

export const DEFAULT_OBSERVABILITY_CONFIG: ObservabilityConfig = {
  sanitization: {
    maxPreviewLength: 200,
    truncationSuffix: '...',
  },
  retention: {
    traces: 30,
    syncLogs: 14,
    llmMetrics: 90,
    errorLogs: 7,
    auditLog: 365,
  },
};
```

#### I3: Integration Tests for Main Flow
```typescript
describe('DataExporter Integration', () => {
  it('should export all user data as JSON', async () => {
    const exporter = new DataExporter(mockStore);
    const result = await exporter.exportAll({
      userId: 'test-user',
      format: 'json',
      includes: {
        memories: true,
        profile: true,
        missions: true,
        preferences: true,
        earnings: true,
        consents: true,
        agent_traces: true,
        sync_logs: true,
        llm_usage: true,
      },
    });

    expect(result.data).toBeInstanceOf(Blob);
    expect(result.recordCount).toBeGreaterThan(0);
    expect(result.namespaces).toContain('ownyou.semantic');
  });
});
```

### From Roadmap Lessons Learned

#### Namespace Management
- Single source of truth in `@ownyou/shared-types/namespaces.ts`
- Factory functions for all new DEBUG_* namespaces
- No hardcoded namespace strings

#### Testing Quality
- Real implementation testing (not just mocks)
- Mathematical verification for cost calculations
- State machine testing for retention policy states

#### Agent Architecture Conformance
- Sprint 9 has no new agents, but debug components must follow v13 patterns
- All data stored locally (no external telemetry)
- Privacy-first approach (sanitization, truncation, PII redaction)

---

## Week-by-Week Breakdown

### Week 1: Tracing & Logging Infrastructure

**Day 1-2: Enhanced Tracing**
- [ ] Enhance `AgentStep` with v13-complete types (llm, tool, memory, external_api, decision)
- [ ] Update `AgentTracer.recordStep()` to capture full step detail
- [ ] Add step preview sanitization using privacy module
- [ ] Update existing tests + add new step type tests

**Day 3-4: Sync Logger & LLM Metrics**
- [ ] Create `src/sync/` module with `SyncLog` types
- [ ] Implement `SyncLogger` class (infrastructure only - actual sync in Sprint 10)
- [ ] Create `src/llm/` module with `LLMMetrics` types
- [ ] Implement `LLMMetricsCollector` with projections and alerts
- [ ] Write tests for both modules

**Day 5: Privacy & Retention**
- [ ] Create `src/privacy/` module with `sanitizeForTrace()`
- [ ] Implement PII redaction patterns (email, phone, card, SSN)
- [ ] Create `src/retention/` module with cleanup logic
- [ ] Implement retention policy per namespace (30/14/90/7/365 days)
- [ ] Write tests for sanitization and retention

### Week 2: Debug UI & GDPR Export

**Day 1-2: Agent Inspector UI**
- [ ] Create `@ownyou/debug-ui` package
- [ ] Build `AgentInspector` component with trace list
- [ ] Build `TraceDetail` component with step expansion
- [ ] Build `TraceFilters` component
- [ ] Add trace export and deletion actions
- [ ] Write component tests

**Day 3-4: Cost Dashboard UI**
- [ ] Build `CostDashboard` component
- [ ] Build `BudgetMeter` gauge component
- [ ] Build `CostChart` (daily costs line chart)
- [ ] Build `AgentPieChart` (cost by agent)
- [ ] Add budget setting and alert acknowledgment
- [ ] Write component tests

**Day 5: Sync Monitor & GDPR**
- [ ] Build `SyncMonitor` placeholder component
- [ ] Build `DataExport` component with checkbox options
- [ ] Implement `DataExporter.exportAll()` and `exportSelected()`
- [ ] Implement `DataExporter.deleteAll()` (Right to be Forgotten)
- [ ] Build `DeleteDataModal` with confirmation
- [ ] Write export/deletion tests

---

## Test Targets

| Package | Target Tests | Focus Areas |
|---------|-------------|-------------|
| `@ownyou/observability` (enhanced) | 60+ | Step types, sync logging, LLM metrics, sanitization, retention |
| `@ownyou/debug-ui` | 40+ | Component rendering, user interactions, data binding |
| **Total** | **100+** | |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage | >80% for all packages |
| Agent trace capture | All 6 agents emit complete traces |
| LLM cost accuracy | Cost tracking matches actual billing |
| PII redaction | 100% of known PII patterns redacted |
| Export completeness | All namespaces exported correctly |
| Deletion completeness | All user data removed on request |

---

## Dependencies and Risks

### Dependencies
- Existing `@ownyou/observability` package as foundation
- `@ownyou/shared-types` for namespaces
- `@ownyou/ui-components` for shared UI primitives
- Chart library for Cost Dashboard (recommend: recharts or victory)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Chart library complexity | Medium | Low | Use simple bar/line charts, avoid complex visualizations |
| GDPR export edge cases | Medium | Medium | Test with real-world data scenarios, handle missing namespaces gracefully |
| Sync Monitor without sync | Low | Low | Build placeholder UI that shows "Sync not yet enabled" |
| PII pattern false positives | Medium | Low | Make patterns configurable, document known limitations |

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/observability/src/sync/types.ts` | SyncLog types |
| `packages/observability/src/sync/sync-logger.ts` | SyncLogger class |
| `packages/observability/src/sync/index.ts` | Module exports |
| `packages/observability/src/llm/types.ts` | LLMMetrics types |
| `packages/observability/src/llm/metrics-collector.ts` | LLMMetricsCollector class |
| `packages/observability/src/llm/index.ts` | Module exports |
| `packages/observability/src/privacy/sanitizer.ts` | PII sanitization |
| `packages/observability/src/privacy/index.ts` | Module exports |
| `packages/observability/src/export/types.ts` | Export types |
| `packages/observability/src/export/exporter.ts` | DataExporter class |
| `packages/observability/src/export/deletion.ts` | Data deletion |
| `packages/observability/src/export/index.ts` | Module exports |
| `packages/observability/src/retention/cleanup.ts` | Retention policy |
| `packages/observability/src/retention/index.ts` | Module exports |
| `packages/debug-ui/package.json` | Package config |
| `packages/debug-ui/src/index.ts` | Public exports |
| `packages/debug-ui/src/components/AgentInspector/*.tsx` | Inspector components |
| `packages/debug-ui/src/components/CostDashboard/*.tsx` | Dashboard components |
| `packages/debug-ui/src/components/SyncMonitor/*.tsx` | Monitor components |
| `packages/debug-ui/src/components/DataExport/*.tsx` | Export components |

### Modified Files

| File | Change |
|------|--------|
| `packages/observability/src/traces/types.ts` | Add v13-complete AgentStep types |
| `packages/observability/src/traces/tracer.ts` | Add recordStep() with full detail |
| `packages/observability/src/index.ts` | Export new modules |
| `packages/shared-types/src/namespaces.ts` | Add DEBUG_* namespaces |
| `packages/shared-types/src/index.ts` | Export new types |

---

## Context7 Documentation Lookup Required

The following libraries will be used in Sprint 9. Use context7 MCP to fetch current documentation:

| Library | Usage |
|---------|-------|
| `recharts` or `victory` | Charts in Cost Dashboard |
| `date-fns` | Date formatting for traces and metrics |
| `file-saver` | Downloading exported data blobs |

---

## Key Architectural Decisions

### 1. All Debug Data Stays On-Device

**Decision:** Debug logs, traces, and metrics never leave the device unless the user explicitly exports them.

**Rationale:**
- Privacy-first approach matches OwnYou's core value proposition
- No telemetry means no data collection infrastructure to build
- User owns their debug data just like personal data

**Implementation:** All observability namespaces use the same Store abstraction as user data.

### 2. Sync Monitor is Placeholder in Sprint 9

**Decision:** Build the Sync Monitor UI shell but show "Sync not yet enabled" message.

**Rationale:**
- Sprint 10 implements actual OrbitDB sync
- Having the UI ready accelerates Sprint 10
- Users see consistent Settings → Debug panel structure

### 3. Retention Policy Per Namespace

**Decision:** Different retention periods for different log types.

```typescript
traces: 30,      // Agent traces - useful for debugging recent issues
syncLogs: 14,    // Sync logs - short-lived operational data
llmMetrics: 90,  // Cost data - longer for billing reconciliation
errorLogs: 7,    // Errors - short, high-volume
auditLog: 365,   // Audit - long for compliance
```

**Rationale:** Balances debugging utility with storage constraints.

### 4. PII Sanitization in Traces

**Decision:** All trace content is sanitized before storage using pattern matching.

**Rationale:**
- Traces may contain user input or LLM responses with PII
- Developers should be able to debug without accessing raw PII
- Matches GDPR data minimization principle

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2025-12-08 | Initial Sprint 9 specification |
| v2 | 2026-01-03 | Status updated to INCOMPLETE after code review audit |

---

## Completion Status (Added 2026-01-03)

**Actual Completion: ~15%**

| Deliverable | Status | Notes |
|-------------|--------|-------|
| @ownyou/observability - src/traces/ | ✅ | Done in Sprint 0 |
| @ownyou/observability - src/sync/ (SyncLogger) | ❌ | Never implemented |
| @ownyou/observability - src/llm/ (LLMMetricsCollector) | ❌ | Never implemented |
| @ownyou/observability - src/privacy/ (sanitizer) | ❌ | Never implemented |
| @ownyou/observability - src/export/ (GDPR) | ❌ | Never implemented |
| @ownyou/observability - src/retention/ | ❌ | Never implemented |
| DEBUG_* namespaces | ❌ | Never added to shared-types |
| @ownyou/debug-ui - SyncMonitor | ✅ | 762 lines, 34 tests |
| @ownyou/debug-ui - AgentInspector | ❌ | Never implemented |
| @ownyou/debug-ui - CostDashboard | ❌ | Never implemented |
| @ownyou/debug-ui - DataExport UI | ❌ | Never implemented |

**Root Cause:** PR #6 was created but never merged due to merge conflicts and CI failures. The branch drifted significantly from main (1.4M line diff). PR was closed on 2026-01-03.

**Test Count:**
- Target: 100+ (60 observability + 40 debug-ui)
- Actual: 51 (17 + 34)

---

**Document Status:** Sprint 9 Specification v2 - ⚠️ INCOMPLETE
**Date:** 2026-01-03
**Validates Against:** OwnYou_architecture_v13.md (Section 10)
**Next Sprint:** Sprint 10 (Cross-Device Sync)
