# OwnYou Sprint 1: Infrastructure + OAuth + Email

**Total Duration:** 3 weeks (Split into Sprint 1a + Sprint 1b)
**Goal:** Desktop foundation + unified OAuth + complete email data pipeline
**Success Criteria:** User authenticates once (browser OR desktop), emails classified and stored, still working 7 days later
**Depends On:** Sprint 0 complete

---

## Sprint 0 Summary (COMPLETED)

Sprint 0 established the foundational infrastructure for all future development.

### Packages Delivered

| Package | Description | Status |
|---------|-------------|--------|
| `@ownyou/shared-types` | v13 type definitions (Memory, Episode, Entity, Ikigai, Agent, Identity) | ✅ Complete |
| `@ownyou/memory-store` | LangGraph Store-compatible interface with IndexedDB backend, hybrid search (semantic + BM25 + RRF) | ✅ Complete |
| `@ownyou/llm-client` | OpenAI integration with budget enforcement (6.10), circuit breaker, fallback chains | ✅ Complete |
| `@ownyou/observability` | Agent traces (10.2), cost metering, memory operation tracking | ✅ Complete |
| `@ownyou/integration-tests` | Sprint 0 success criteria validation | ✅ Complete |

### Key Deliverables

- **17 namespaces** defined with privacy tiers and sync scope (v13 Section 8.12)
- **Memory types** with bi-temporal model, strength decay, access tracking (v13 Section 8.4)
- **Budget management** with throttling at 50%/80%/95%/100% thresholds
- **Agent limits** for L1/L2/L3 complexity levels
- **Hybrid search** combining semantic embeddings + BM25 + Reciprocal Rank Fusion
- **Sync-compatible design** with encryption helpers and conflict strategies

### v13 Architecture Compliance

| v13 Section | Requirement | Sprint 0 Implementation |
|-------------|-------------|------------------------|
| 8.4 | Memory Schema | Memory, Episode, ProceduralRule, Entity types |
| 8.5 | Vector Embeddings | EmbeddingService interface + MockEmbeddingService |
| 8.7 | Memory Retrieval | Hybrid search (semantic + BM25 + RRF) |
| 8.12 | Namespace Schema | 17 namespaces with NS factory functions |
| 8.13 | Storage Backends | IndexedDB backend (SQLite deferred to Sprint 1a) |
| 8.14 | Sync Integration | SyncableMemory wrapper, encryption helpers |
| 6.10 | LLM Cost Management | BudgetManager with throttling |
| 6.11 | Error Handling | CircuitBreaker with state management |
| 10.x | Observability | AgentTracer with spans and cost metering |

### Sprint 0 Success Criteria ✅

```
✅ Store a memory using MemoryStore
✅ Call LLM using LLMClient with budget tracking
✅ Log agent trace using AgentTracer
✅ Verify cost tracking and observability
```

---

## Sprint 1 Overview

Sprint 1 is split into two phases to manage complexity:

```
Sprint 1a: Infrastructure (1 week)
├── Tauri desktop scaffold
├── SQLite backend for memory-store
└── Custom protocol handler (ownyou://)

Sprint 1b: OAuth + Email + IAB Migration (2 weeks)
├── Unified OAuth package (browser + desktop)
├── Microsoft/Google OAuth with long-lived tokens
├── IAB classifier migration to packages/
├── Email fetch + classification pipeline
└── Memory storage integration
```

### End State

```
┌─────────────────────────────────────────────────────────────────┐
│                     SPRINT 1 DELIVERABLE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [User clicks "Connect Email"]                                   │
│       ↓                                                          │
│  [Browser: popup redirect] OR [Desktop: ownyou:// protocol]      │
│       ↓                                                          │
│  [Microsoft/Google OAuth with offline_access]                    │
│       ↓                                                          │
│  [Tokens stored: Keychain (desktop) / localStorage (browser)]    │
│       ↓                                                          │
│  [Fetch emails → IAB Classify → Store in memory-store]           │
│       ↓                                                          │
│  [7 days later: Token auto-refreshes, emails still flowing]      │
│                                                                  │
│  Works in BOTH browser (admin-dashboard) AND desktop (Tauri)     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sprint 1a: Infrastructure (1 week)

**Goal:** Desktop foundation with SQLite backend

### Deliverables

| # | Deliverable | Priority | Acceptance Criteria |
|---|-------------|----------|---------------------|
| 1 | Tauri scaffold | P0 | `apps/desktop/` with React frontend launches |
| 2 | SQLite backend | P0 | `@ownyou/memory-store` SQLite adapter passes tests |
| 3 | Custom protocol | P0 | `ownyou://` URLs open Tauri app |

### Package Changes

**New:**
- `apps/desktop/` - Tauri 2.0 desktop app with React frontend

**Modified:**
- `packages/memory-store/` - Add SQLite backend

### Technical Specifications

#### 1. Tauri Desktop Scaffold

```
apps/desktop/
├── src/                    # React frontend (shared components where possible)
│   ├── App.tsx
│   ├── main.tsx
│   └── components/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── oauth.rs        # Deep link handler
│       └── keychain.rs     # OS keychain integration
├── package.json
└── vite.config.ts
```

**Tauri Configuration:**
```json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["ownyou"]
      }
    }
  }
}
```

#### 2. SQLite Backend

```typescript
// packages/memory-store/src/backends/sqlite.ts

export class SQLiteBackend implements StorageBackend {
  // Uses @tauri-apps/plugin-sql for Tauri
  // Uses better-sqlite3 for Node.js testing

  async put<T>(namespace: string, userId: string, key: string, value: T): Promise<void>;
  async get<T>(namespace: string, userId: string, key: string): Promise<T | null>;
  async delete(namespace: string, userId: string, key: string): Promise<boolean>;
  async list<T>(namespace: string, userId: string, limit: number, offset: number): Promise<T[]>;
}
```

#### 3. Custom Protocol Handler

```rust
// src-tauri/src/oauth.rs

pub fn setup_deep_link_handler(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.deep_link().on_open_url(move |event| {
        // Handle ownyou://oauth/callback/microsoft
        // Handle ownyou://oauth/callback/google
    });
    Ok(())
}
```

### Sprint 1a Success Criteria

- [ ] `pnpm tauri dev` launches desktop app with React UI
- [ ] SQLite backend passes same test suite as IndexedDB backend
- [ ] `ownyou://test` opens the Tauri app
- [ ] Desktop app can read/write to SQLite via memory-store

### Sprint 1a Timeline

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | Tauri scaffold | Basic app launches with React |
| 3-4 | SQLite backend | StorageBackend implementation |
| 5-7 | Custom protocol | Deep link handler + testing |

---

## Sprint 1b: OAuth + Email + IAB Migration (2 weeks)

**Goal:** Unified OAuth + complete email pipeline for both platforms

### Deliverables

| # | Deliverable | Priority | Acceptance Criteria |
|---|-------------|----------|---------------------|
| 1 | Unified OAuth package | P0 | Works in browser AND desktop |
| 2 | Microsoft OAuth | P0 | 90-day `offline_access` tokens |
| 3 | Google OAuth | P0 | Refresh tokens working |
| 4 | Token storage | P0 | Keychain (desktop) / encrypted localStorage (browser) |
| 5 | Token refresh | P0 | Auto-refresh before expiry |
| 6 | IAB classifier migration | P0 | `packages/iab-classifier/` standalone |
| 7 | Email fetch | P1 | Microsoft Graph + Gmail API |
| 8 | Classification pipeline | P1 | Emails → IAB categories → memory-store |
| 9 | UI | P2 | "Connect Email" button + status (both platforms) |

### New Packages

```
packages/
├── oauth/                          # NEW: Unified OAuth management
│   ├── src/
│   │   ├── index.ts
│   │   ├── providers/
│   │   │   ├── microsoft.ts
│   │   │   └── google.ts
│   │   ├── storage/
│   │   │   ├── keychain.ts        # Desktop: OS keychain
│   │   │   └── browser.ts         # Browser: encrypted localStorage
│   │   ├── token-manager.ts
│   │   └── types.ts
│   └── package.json
│
├── email/                          # NEW: Email fetching + classification
│   ├── src/
│   │   ├── index.ts
│   │   ├── fetch.ts
│   │   ├── classify.ts
│   │   ├── pipeline.ts
│   │   └── types.ts
│   └── package.json
│
├── iab-classifier/                 # MIGRATED from src/browser/agents/iab-classifier/
│   ├── src/
│   │   ├── index.ts
│   │   ├── classifier.ts
│   │   ├── taxonomy.ts
│   │   └── prompts.ts
│   └── package.json
```

### Technical Specifications

#### 1. Unified OAuth Package

The OAuth package must work in both environments:

```typescript
// packages/oauth/src/index.ts

export interface OAuthConfig {
  platform: 'browser' | 'desktop';
  storage: TokenStorage;
}

export function createOAuthClient(config: OAuthConfig): OAuthClient {
  return new OAuthClient({
    storage: config.platform === 'desktop'
      ? new KeychainStorage()
      : new BrowserStorage(),
    redirectHandler: config.platform === 'desktop'
      ? new DeepLinkRedirectHandler()
      : new PopupRedirectHandler(),
  });
}
```

**Browser OAuth Flow:**
```
1. User clicks "Connect Email"
2. Open popup window to Microsoft/Google
3. User authorizes
4. Popup redirects to callback URL
5. Parent window captures tokens
6. Store in encrypted localStorage
```

**Desktop OAuth Flow:**
```
1. User clicks "Connect Email"
2. Open system browser to Microsoft/Google
3. User authorizes
4. Browser redirects to ownyou://oauth/callback
5. Tauri captures deep link, emits event
6. Store in OS keychain
```

#### 2. Token Storage Abstraction

```typescript
// packages/oauth/src/storage/types.ts

export interface TokenStorage {
  store(userId: string, provider: string, tokens: StoredTokens): Promise<void>;
  get(userId: string, provider: string): Promise<StoredTokens | null>;
  delete(userId: string, provider: string): Promise<void>;
}

// packages/oauth/src/storage/keychain.ts (Desktop)
export class KeychainStorage implements TokenStorage {
  async store(userId: string, provider: string, tokens: StoredTokens): Promise<void> {
    await invoke('store_oauth_tokens', { userId, provider, tokens });
  }
}

// packages/oauth/src/storage/browser.ts (Browser)
export class BrowserStorage implements TokenStorage {
  async store(userId: string, provider: string, tokens: StoredTokens): Promise<void> {
    const encrypted = await encrypt(JSON.stringify(tokens), this.encryptionKey);
    localStorage.setItem(`oauth_${userId}_${provider}`, encrypted);
  }
}
```

#### 3. IAB Classifier Migration

Migrate from `src/browser/agents/iab-classifier/` to `packages/iab-classifier/`:

```typescript
// packages/iab-classifier/src/index.ts

export { IABClassifier } from './classifier';
export { IAB_TAXONOMY, IABCategory, IABTier1, IABTier2 } from './taxonomy';
export { classifyEmail, classifyBatch } from './classify';
```

**Migration checklist:**
- [ ] Copy classifier logic to packages/iab-classifier/
- [ ] Update imports to use @ownyou/shared-types
- [ ] Update imports to use @ownyou/llm-client
- [ ] Add comprehensive tests
- [ ] Update admin-dashboard to import from @ownyou/iab-classifier

#### 4. Email Pipeline

```typescript
// packages/email/src/pipeline.ts

export class EmailPipeline {
  constructor(
    private oauth: OAuthClient,
    private classifier: IABClassifier,
    private store: MemoryStore,
    private llm: LLMClient,
    private userId: string
  ) {}

  async run(): Promise<PipelineResult> {
    // 1. Fetch emails from connected providers
    // 2. Classify using IAB classifier
    // 3. Store classifications in memory-store
    // 4. Extract semantic memories
    // 5. Record trace
  }
}
```

### Platform Support Matrix

| Feature | Browser (PWA) | Desktop (Tauri) |
|---------|---------------|-----------------|
| Storage backend | IndexedDB | SQLite |
| OAuth redirect | Popup window | `ownyou://` protocol |
| Token storage | Encrypted localStorage | OS Keychain |
| IAB classifier | Same package | Same package |
| Email fetch | Same package | Same package |
| Memory store | Same package | Same package |

### Sprint 1b Success Criteria

- [ ] OAuth works in **browser** (admin-dashboard popup flow)
- [ ] OAuth works in **desktop** (Tauri deep link flow)
- [ ] Microsoft OAuth obtains `offline_access` tokens
- [ ] Google OAuth obtains refresh tokens
- [ ] Tokens stored securely (keychain OR encrypted localStorage)
- [ ] Auto-refresh works before expiry
- [ ] `@ownyou/iab-classifier` importable and working
- [ ] 30 days of emails retrieved
- [ ] Emails have IAB categories in memory-store
- [ ] **7-day persistence test passes** (key success metric)

### Sprint 1b Timeline

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | Unified OAuth package | Storage abstraction, platform detection |
| 3-4 | Microsoft OAuth | Full flow with 90-day tokens |
| 5 | Google OAuth | Full flow with refresh tokens |
| 6 | IAB classifier migration | Package created, tests passing |
| 7-8 | Email fetch service | Microsoft Graph + Gmail API |
| 9-10 | Classification pipeline | Full pipeline working |
| 11-12 | Integration testing | Both platforms, 7-day test |
| 13-14 | UI + polish | "Connect Email" in both platforms |

---

## Testing Strategy

### Unit Tests

```typescript
// packages/oauth/src/__tests__/token-manager.test.ts
describe('TokenManager', () => {
  it('should refresh token before expiry');
  it('should emit event on refresh failure');
  it('should work with browser storage');
  it('should work with keychain storage');
});

// packages/iab-classifier/src/__tests__/classifier.test.ts
describe('IABClassifier', () => {
  it('should classify email to correct categories');
  it('should batch emails efficiently');
  it('should handle classification errors gracefully');
});
```

### Integration Tests

```typescript
// packages/email/src/__tests__/pipeline.integration.test.ts
describe('EmailPipeline (Integration)', () => {
  it('should fetch, classify, and store emails');
  it('should create semantic memories from classifications');
  it('should record trace with cost metering');
});
```

### Manual Tests

| Test | Steps | Expected |
|------|-------|----------|
| 7-day persistence | 1. Auth on day 0, 2. Wait 7 days, 3. Fetch emails | Emails fetched without re-auth |
| Platform parity | Run same flow in browser and desktop | Same results |
| Token refresh | Wait for token expiry | Auto-refresh occurs |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Microsoft rejects custom protocol | Medium | Critical | Test early, browser fallback ready |
| Refresh token revoked | Low | High | Graceful re-auth flow with notification |
| Rate limited by email APIs | Medium | Medium | Implement exponential backoff, cache results |
| Keychain access denied | Low | High | Fall back to encrypted file storage |
| IAB classifier migration breaks admin-dashboard | Medium | Medium | Test admin-dashboard after migration |

---

## Definition of Done

### Sprint 1a Complete When:
- [ ] Tauri app launches with `pnpm tauri dev`
- [ ] SQLite backend passes all memory-store tests
- [ ] Custom protocol `ownyou://` opens app
- [ ] Code committed and pushed

### Sprint 1b Complete When:
- [ ] OAuth works in browser (popup) AND desktop (deep link)
- [ ] Microsoft OAuth: 90-day tokens obtained
- [ ] Google OAuth: refresh tokens obtained
- [ ] Tokens persist in keychain (desktop) / localStorage (browser)
- [ ] Token auto-refresh works
- [ ] IAB classifier migrated to `packages/iab-classifier/`
- [ ] Admin-dashboard uses new `@ownyou/iab-classifier`
- [ ] Email fetch works for Microsoft + Google
- [ ] Classification pipeline creates memories
- [ ] 7-day persistence test passes
- [ ] Code committed and pushed

---

**Document Status:** Sprint 1 Technical Specification v2.0
**Previous Version:** Sprint 1 v1.0 (desktop-only focus)
**Changes:** Added Sprint 0 summary, split into 1a/1b, unified OAuth for browser+desktop, IAB migration
**Architecture Reference:** v13 Sections 8.13, 6.10, 8.4
