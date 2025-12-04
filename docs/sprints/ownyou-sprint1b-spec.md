# Sprint 1b: OAuth + Email + IAB Migration

**Duration:** 2 weeks
**Goal:** Unified OAuth + complete email pipeline for both platforms
**Success Criteria:** User authenticates once (browser OR desktop), emails classified and stored, still working 7 days later
**Depends On:** Sprint 0 + Sprint 1a complete

---

## Previous Sprints Summary

### Sprint 0: Foundation (COMPLETED)

| Package | Description | Tests |
|---------|-------------|-------|
| `@ownyou/shared-types` | v13 type definitions (Memory, Episode, Entity, Ikigai, Agent, Identity, Namespaces) | 91 |
| `@ownyou/memory-store` | LangGraph Store-compatible interface with IndexedDB backend, hybrid search (semantic + BM25 + RRF) | 87 |
| `@ownyou/llm-client` | OpenAI integration with budget enforcement (6.10), circuit breaker, fallback chains | 39 |
| `@ownyou/observability` | Agent traces (10.2), cost metering, memory operation tracking | 17 |
| `@ownyou/integration-tests` | Sprint 0 success criteria validation | 7 |

**Key Deliverables:**
- 17 namespaces with privacy tiers and sync scope (v13 Section 8.12)
- Memory types with bi-temporal model, strength decay, access tracking
- Budget management with throttling at 50%/80%/95%/100% thresholds
- Hybrid search combining semantic embeddings + BM25 + Reciprocal Rank Fusion

**Total Tests:** 241 passing

---

### Sprint 1a: Desktop Infrastructure (COMPLETED)

| Deliverable | Status | Details |
|-------------|--------|---------|
| Tauri scaffold | ✅ | `apps/desktop/` with React frontend, Vite build |
| SQLite backend | ✅ | sql.js (WebAssembly) - cross-platform support |
| SQLite persistence | ✅ | IndexedDB (browser) + filesystem (Node/Tauri) |
| Custom protocol | ✅ | `ownyou://` deep links open desktop app |
| CSP security | ✅ | Content Security Policy enabled with OAuth endpoints |
| Memory Store demo | ✅ | Desktop UI demonstrates read/write operations |

**Key Commits:**
- `40391e2` - fix(sprint1a): Address code review issues (CSP, timestamps, demo)
- `6e0dadc` - fix(security+build): Address code review findings

**Total Tests:** 241 passing (unchanged)

---

## Sprint 1b Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SPRINT 1b END STATE                          │
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

## Deliverables

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

---

## New Packages

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

---

## Technical Specifications

### 1. Unified OAuth Package

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

### 2. Token Storage Abstraction

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

### 3. IAB Classifier Migration

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

### 4. Email Pipeline

```typescript
// packages/email/src/pipeline.ts
import { NS, type Memory } from '@ownyou/shared-types';

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
    const emails = await this.fetchEmails();

    // 2. Classify using IAB classifier (privacy: only metadata sent to LLM)
    const classifications = await this.classifier.classifyBatch(emails);

    // 3. Store classifications in memory-store using v13 namespaces
    for (const classification of classifications) {
      await this.store.put(
        NS.iabClassifications(this.userId),
        classification.id,
        classification
      );

      // Store evidence separately
      await this.store.put(
        NS.iabEvidence(this.userId),
        `evidence_${classification.id}`,
        classification.evidence
      );
    }

    // 4. Extract semantic memories
    const memories = await this.extractMemories(classifications);
    for (const memory of memories) {
      await this.store.put(
        NS.semanticMemory(this.userId),
        memory.id,
        memory
      );
    }

    // 5. Record trace
    await this.tracer.endSpan({ success: true });
  }
}
```

### 5. IAB Classification Structure (v13 Compliant)

```typescript
// IAB classification must include all v13 Memory fields
interface IABClassification extends Memory {
  id: string;
  content: string;                    // "Email classified as: Travel > Air Travel"
  context: "iab_classification";

  // Bi-temporal (v13 Section 8.4)
  valid_at: number;                   // When classification was made
  created_at: number;                 // Same as valid_at for classifications

  // Strength & decay
  strength: number;                   // 1.0 initial
  last_accessed: number;
  access_count: number;

  // Provenance
  sources: string[];                  // Email IDs that contributed
  confidence: number;                 // LLM confidence score

  // Privacy tier (IMPORTANT: IAB data is sensitive)
  privacy_tier: "sensitive";          // Advertising profile data

  // IAB-specific fields
  tier1_category: string;             // "Travel"
  tier2_category: string;             // "Air Travel"
  tier1_id: string;                   // "IAB20"
  tier2_id: string;                   // "IAB20-1"
}
```

### 6. Privacy Tier Requirements

| Data Type | Privacy Tier | External API Allowed |
|-----------|--------------|---------------------|
| Email raw content | `private` | ❌ Never |
| Email metadata (subject, sender) | `sensitive` | ⚠️ Encrypted only |
| IAB classifications | `sensitive` | ⚠️ Encrypted only |
| Semantic memories | `sensitive` | ⚠️ Encrypted only |

**LLM Call Privacy Rules:**
```typescript
// Before sending to LLM, verify privacy tier
async classifyEmail(email: Email): Promise<IABClassification> {
  // Only send metadata, never raw content
  const sanitized = {
    subject: email.subject,
    sender_domain: extractDomain(email.from),
    // NO: email.body (private)
  };

  return await this.llm.classify(sanitized);
}
```

---

## Platform Support Matrix

| Feature | Browser (PWA) | Desktop (Tauri) |
|---------|---------------|-----------------|
| Storage backend | IndexedDB | SQLite |
| OAuth redirect | Popup window | `ownyou://` protocol |
| Token storage | Encrypted localStorage | OS Keychain |
| IAB classifier | Same package | Same package |
| Email fetch | Same package | Same package |
| Memory store | Same package | Same package |

---

## Implementation Tasks

### Week 1: OAuth + IAB Migration

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1-2 | Unified OAuth package | Storage abstraction, platform detection |
| 3-4 | Microsoft OAuth | Full flow with 90-day tokens |
| 5 | Google OAuth | Full flow with refresh tokens |
| 6-7 | IAB classifier migration | Package created, tests passing |

### Week 2: Email Pipeline + Integration

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 8-9 | Email fetch service | Microsoft Graph + Gmail API |
| 10-11 | Classification pipeline | Full pipeline working |
| 12-13 | Integration testing | Both platforms, 7-day test |
| 14 | UI + polish | "Connect Email" in both platforms |

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

## Success Criteria

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
- [ ] Code committed and pushed

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

## Critical Files

**New packages:**
- `packages/oauth/src/index.ts`
- `packages/oauth/src/providers/microsoft.ts`
- `packages/oauth/src/providers/google.ts`
- `packages/oauth/src/storage/keychain.ts`
- `packages/oauth/src/storage/browser.ts`
- `packages/email/src/pipeline.ts`
- `packages/iab-classifier/src/classifier.ts`

**Modified:**
- `apps/desktop/src-tauri/src/main.rs` - Keychain Rust commands
- `src/admin-dashboard/` - Use new packages

---

## Architecture References

- **v13 Section 8.13:** Storage Backends
- **v13 Section 6.10:** LLM Cost Management
- **v13 Section 8.4:** Memory Types
- **v13 Section 10:** Observability

---

**Document Status:** Sprint 1b Technical Specification v1.0
**Parent Document:** `docs/sprints/ownyou-sprint1-spec.md`
**Previous Sprint:** Sprint 1a (Desktop Infrastructure)
