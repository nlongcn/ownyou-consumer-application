# Phase 2: Data Layer - Self-Sovereign Architecture

**Status:** Planning
**Duration:** 3-4 weeks
**Dependencies:** Phase 1 (Complete)
**Next Phase:** Phase 3 (Mission Agents)

---

## 🎯 Goal

Implement Calendar and Browser Extension data connectors with **self-sovereign architecture** where **ALL personal data stays on user's device** or in user-controlled decentralized storage.

**Critical Principle:** OwnYou backend NEVER stores OAuth tokens, raw personal data, or access credentials.

---

## 📋 Scope

### ✅ Included in Phase 2
1. **Calendar Connector** (Google Calendar + Outlook Calendar)
2. **Browser Extension** (Chrome with WXT framework)
3. **Email Connector Enhancement** (migrate to local LangGraph Store)
4. **Multi-Source IAB Classification** (local LLM inference)
5. **Local Storage Architecture** (SQLite + IndexedDB with encryption)

### ❌ NOT Included (Deferred)
- **Financial/Plaid Integration** → Separate POC, integrate in Phase 7
- **Location Tracking** → Phase 7
- **Health Data** → Phase 7
- **Photos Analysis** → Phase 7
- **Social Media** → Phase 7

---

## 🏗️ Architecture Overview

### Deployment Model: Local Python Agent

**Phase 2 uses Local Python Agent deployment** (similar to Signal Desktop, 1Password, Docker Desktop):
- Python backend runs on user's machine (`localhost:8000`)
- All data stored locally in `~/.ownyou/`
- OAuth tokens in local filesystem (encrypted)
- LangGraph Store using SQLite (`~/.ownyou/store.db`)
- Optional: Browser UI connects to localhost

**Why Python Agent for Phase 2-5:**
- ✅ LangGraph Store available (Python-only)
- ✅ Mission agents work natively (LangGraph workflows)
- ✅ Full LLM support (local or API)
- ✅ All data connectors possible
- ✅ Faster development (reuse email parser patterns)
- ✅ LangGraph Studio debugging

**Browser-Based PWA** will be evaluated in Phase 6-7 after:
- Ceramic Network integration (multi-device sync)
- JS Store implementation or backend-as-library pattern
- WebLLM optimization

### Data Flow
```
┌────────────────────────────────────────────────────────┐
│           USER'S DEVICE (ALL DATA HERE)                │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │   Browser   │  │  Calendar   │  │    Email     │  │
│  │  Extension  │  │  Connector  │  │   Parser     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  │
│         │                 │                 │          │
│         └─────────────────┴─────────────────┘          │
│                           ↓                            │
│              ┌───────────────────────┐                 │
│              │   Local LLM (WebLLM)  │                 │
│              │  IAB Classification   │                 │
│              └───────────┬───────────┘                 │
│                          ↓                             │
│         ┌────────────────────────────────┐            │
│         │    LangGraph Store (SQLite)    │            │
│         │  + IndexedDB (OAuth tokens)    │            │
│         │  Encrypted with wallet keys    │            │
│         └────────────────────────────────┘            │
│                                                         │
└────────────────────────────────────────────────────────┘
                         ↓ (Optional)
┌────────────────────────────────────────────────────────┐
│     DECENTRALIZED SYNC (User-Controlled, Opt-In)       │
├────────────────────────────────────────────────────────┤
│  • Ceramic Network (encrypted backups)                 │
│  • IPFS (encrypted checkpoints)                        │
│  • Wallet-derived encryption keys                      │
│  • User controls sync on/off                           │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│         OWNYOU BACKEND (NO PERSONAL DATA)              │
├────────────────────────────────────────────────────────┤
│  ✅ JWT token issuance (stateless)                     │
│  ✅ Static asset hosting (PWA files)                   │
│  ✅ Wallet authentication challenge generation         │
│  ❌ NO OAuth tokens                                    │
│  ❌ NO raw personal data                               │
│  ❌ NO access credentials                              │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Deliverables

### 2.1 Calendar Connector (Week 1-2)

#### Google Calendar Integration

**OAuth Flow (Frontend Only):**
```javascript
// All OAuth happens in browser, NO backend involvement
import { google } from 'googleapis';

// 1. User clicks "Connect Google Calendar"
const oauth2Client = new google.auth.OAuth2(
  process.env.VITE_GOOGLE_CLIENT_ID,  // Public client ID
  null,  // No client secret (PKCE flow)
  window.location.origin + '/callback'
);

// 2. Generate auth URL with PKCE
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar.readonly'],
  prompt: 'consent',
  code_challenge_method: 'S256',
  code_challenge: generateCodeChallenge()
});

// 3. User completes OAuth in popup
// 4. Callback receives code
const { tokens } = await oauth2Client.getToken(code);

// 5. Encrypt tokens with wallet-derived key
const encryptionKey = await deriveKeyFromWallet(userWallet);
const encryptedTokens = await encrypt(tokens, encryptionKey);

// 6. Store LOCALLY in IndexedDB (never sent to backend)
await indexedDB.put('oauth_tokens', {
  service: 'google_calendar',
  encrypted_tokens: encryptedTokens,
  created_at: Date.now()
});
```

**Data Fetching (Local WebWorker):**
```javascript
// WebWorker runs in background (battery-efficient)
self.addEventListener('message', async (event) => {
  if (event.data.type === 'SYNC_CALENDAR') {
    // 1. Retrieve encrypted tokens from IndexedDB
    const record = await indexedDB.get('oauth_tokens', 'google_calendar');

    // 2. Decrypt with wallet key
    const tokens = await decrypt(record.encrypted_tokens, walletKey);

    // 3. Fetch events directly from Google Calendar API
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    const events = await response.json();

    // 4. Clear tokens from memory
    delete tokens;

    // 5. Process events locally
    for (const event of events.items) {
      // IAB classification (local LLM)
      const iabCategory = await classifyEventLocally(event);

      // Write to local LangGraph Store
      await localStore.put(
        namespace: ['ownyou.calendar_events', userId],
        key: event.id,
        value: {
          title: event.summary,
          start_time: event.start.dateTime,
          end_time: event.end.dateTime,
          location: event.location,
          iab_category: iabCategory,
          confidence: 0.85
        }
      );
    }

    // 6. Notify main thread
    self.postMessage({ type: 'SYNC_COMPLETE', count: events.items.length });
  }
});
```

**Outlook Calendar:**
- Same pattern as Google Calendar
- Microsoft Graph API (`https://graph.microsoft.com/v1.0/me/events`)
- OAuth via Microsoft Identity Platform
- PKCE flow, no client secret

**Store Schema:**
```python
namespace: ("ownyou.calendar_events", user_id)
{
  "event_id": str,
  "title": str,
  "start_time": str (ISO8601),
  "end_time": str (ISO8601),
  "location": Optional[str],
  "attendees_count": int,  # Privacy: count not names
  "iab_categories": List[str],  # ["IAB20-26"]
  "confidence": float,
  "source": "google_calendar" | "outlook_calendar"
}
```

---

### 2.2 Browser Extension (Week 3-4)

#### Chrome Extension with WXT Framework

**Extension Architecture:**
```
chrome_extension/
├── manifest.json (Manifest V3)
├── background/
│   ├── service-worker.ts (background processing)
│   └── history-tracker.ts (chrome.history API)
├── content/
│   └── page-analyzer.ts (optional: analyze current page)
├── popup/
│   └── privacy-controls.tsx (user settings)
└── lib/
    ├── session-cards.ts (URL → session cards)
    ├── local-llm.ts (WebAssembly LLM for classification)
    └── ipc.ts (extension ↔ main app communication)
```

**History Tracking (Privacy-First):**
```typescript
// background/history-tracker.ts
import browser from 'webextension-polyfill';

// Listen for history changes
browser.history.onVisited.addListener(async (historyItem) => {
  // 1. Redact sensitive data BEFORE any processing
  const redactedUrl = redactUrl(historyItem.url);  // Remove query params, fragments

  // 2. Create session card
  const sessionCard = {
    url: redactedUrl,  // "https://amazon.com" (NOT "https://amazon.com/product?id=123")
    title: historyItem.title,
    visit_time: new Date(historyItem.lastVisitTime),
    domain: new URL(historyItem.url).hostname,
    visit_count: historyItem.visitCount
  };

  // 3. Classify locally (WebAssembly LLM)
  const iabCategory = await classifyUrlLocally(sessionCard);

  // 4. Store locally in extension storage
  await browser.storage.local.set({
    [`session_${historyItem.id}`]: {
      ...sessionCard,
      iab_category: iabCategory
    }
  });

  // 5. Send to main app via postMessage (if user opt-in)
  if (await isCloudModeEnabled()) {
    window.postMessage({
      type: 'BROWSING_EVENT',
      data: sessionCard
    }, '*');
  }
});

function redactUrl(url: string): string {
  const parsed = new URL(url);
  // Remove query params and fragments for privacy
  return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
}
```

**Privacy Controls (Popup UI):**
```tsx
// popup/privacy-controls.tsx
export function PrivacyControls() {
  const [cloudMode, setCloudMode] = useState(false);
  const [dataToSend, setDataToSend] = useState<'none' | 'domains' | 'full'>('domains');

  return (
    <div>
      <h2>Privacy Settings</h2>

      <Toggle
        label="Cloud Processing"
        checked={cloudMode}
        onChange={setCloudMode}
        description={cloudMode
          ? "⚠️ Browsing data sent to external LLM (redacted)"
          : "✅ 100% local processing, zero egress"
        }
      />

      <Select
        label="Data Sharing Level"
        value={dataToSend}
        onChange={setDataToSend}
        options={[
          { value: 'none', label: '🔒 Nothing (fully private)' },
          { value: 'domains', label: '🌐 Domain names only (e.g., "amazon.com")' },
          { value: 'full', label: '📄 Full URLs (redacted query params)' }
        ]}
      />

      <Button onClick={showTransparencyPanel}>
        What's Being Sent? (Preview)
      </Button>
    </div>
  );
}
```

**Store Schema:**
```python
namespace: ("ownyou.browsing_history", user_id)
{
  "session_id": str,
  "domain": str,  # "amazon.com"
  "visit_time": str (ISO8601),
  "iab_categories": List[str],  # ["IAB13-7"] (Shopping - Gifts)
  "confidence": float,
  "visit_count": int,
  "source": "chrome_extension"
}
```

---

### 2.3 Email Connector Enhancement (Week 1)

**Migration from SQLite to Local LangGraph Store:**

**Current Architecture:**
```
Email Parser → SQLite database (local file)
```

**Target Architecture:**
```
Email Parser → LangGraph Store (SQLite-backed, local file)
```

**Migration Steps:**
1. Keep existing email parser logic (don't rewrite)
2. Replace SQLite calls with Store API calls
3. Maintain backward compatibility
4. Export existing data, import to Store

**Code Changes:**
```python
# src/email_parser/storage.py
from langgraph.store.sqlite import SQLiteStore

class EmailStorage:
    def __init__(self, db_path: str = "~/.ownyou/email_store.db"):
        # Use LangGraph Store instead of raw SQLite
        self.store = SQLiteStore(db_path=db_path)

    def save_classification(self, user_id: str, email_id: str, classification: dict):
        """Save IAB classification to Store"""
        self.store.put(
            namespace=("ownyou.email_events", user_id),
            key=email_id,
            value=classification
        )

    def get_classifications(self, user_id: str, limit: int = 100):
        """Retrieve IAB classifications from Store"""
        items = self.store.search(
            namespace_prefix=("ownyou.email_events", user_id),
            limit=limit
        )
        return [item.value for item in items]
```

**No functional changes, just storage backend swap.**

---

### 2.4 Multi-Source IAB Classification (Throughout)

**Local LLM Architecture:**

**Option A: WebLLM (Recommended for Phase 2)**
```javascript
import * as webllm from "@mlc-ai/web-llm";

// Initialize local LLM (runs in browser via WebGPU)
const engine = await webllm.CreateEngine(
  "Llama-3.2-3B-Instruct-q4f32_1",  // 3B model, 4-bit quantized
  {
    initProgressCallback: (progress) => console.log(progress),
    temperature: 0.1,  // Low temp for consistent classification
    top_p: 0.95
  }
);

// Classify text locally
async function classifyIAB(text: string): Promise<string[]> {
  const prompt = `Classify the following text into IAB Taxonomy categories:

Text: "${text}"

Return only the IAB category IDs (e.g., IAB13-7, IAB20-26) as a JSON array.`;

  const response = await engine.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 100
  });

  const categories = JSON.parse(response.choices[0].message.content);
  return categories;
}
```

**Cross-Source Evidence Reconciliation:**
```typescript
// Combine evidence from multiple sources
interface Evidence {
  source: 'email' | 'calendar' | 'browsing';
  iab_category: string;
  confidence: number;
  timestamp: Date;
}

function reconcileEvidence(evidences: Evidence[]): string[] {
  // Group by IAB category
  const grouped = evidences.reduce((acc, e) => {
    if (!acc[e.iab_category]) acc[e.iab_category] = [];
    acc[e.iab_category].push(e);
    return acc;
  }, {} as Record<string, Evidence[]>);

  // Calculate combined confidence
  const scores = Object.entries(grouped).map(([category, items]) => ({
    category,
    confidence: items.reduce((sum, e) => sum + e.confidence, 0) / items.length,
    sources: items.length
  }));

  // Return categories with confidence > 0.5 and at least 2 sources
  return scores
    .filter(s => s.confidence > 0.5 && s.sources >= 2)
    .sort((a, b) => b.confidence - a.confidence)
    .map(s => s.category);
}
```

---

### 2.5 Local Storage Architecture

#### IndexedDB (OAuth Tokens + Cache)

**Wallet-Derived Encryption:**
```javascript
// Derive encryption key from wallet signature
async function deriveEncryptionKey(wallet: any): Promise<CryptoKey> {
  // 1. User signs deterministic message
  const message = "OwnYou Token Encryption Key v1";
  const signature = await wallet.signMessage(message);

  // 2. Hash signature to create AES key
  const encoder = new TextEncoder();
  const data = encoder.encode(signature);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // 3. Import as AES-GCM key
  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,  // Non-extractable
    ['encrypt', 'decrypt']
  );
}

// Encrypt data before storing
async function encryptData(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Return IV + ciphertext as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

// Decrypt data after retrieval
async function decryptData(encrypted: string, key: CryptoKey): Promise<string> {
  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}
```

#### LangGraph Store (SQLite)

**Local SQLite Database:**
```python
from langgraph.store.sqlite import SQLiteStore

# All data stored in user's home directory
store = SQLiteStore(db_path="~/.ownyou/local_store.db")

# All namespaces stored locally:
NAMESPACES = [
    ("ownyou.email_events", user_id),
    ("ownyou.calendar_events", user_id),
    ("ownyou.browsing_history", user_id),
    ("ownyou.iab_classifications", user_id),
    ("ownyou.user_profile", user_id),
]
```

**Progressive Web App (PWA) Deployment:**
```javascript
// Service Worker for offline support
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('ownyou-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/app.js',
        '/assets/styles.css',
        // Cache WebLLM model
        '/models/llama-3.2-3b.wasm'
      ]);
    })
  );
});

// Fetch strategy: Cache-first for offline support
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

---

## 🔒 Security & Privacy

### Encryption Standards
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Derivation:** Wallet signature → SHA-256 → AES key
- **IV:** Random 12-byte nonce per encryption
- **Key Storage:** Non-extractable CryptoKey (never leaves memory)

### OAuth Token Security
- ✅ Stored locally in IndexedDB (encrypted)
- ✅ Encrypted with wallet-derived key
- ✅ Decrypted in-memory only (cleared after use)
- ✅ Never sent to OwnYou backend
- ✅ Refresh tokens encrypted separately

### Data Minimization
- Calendar: Store event metadata, NOT full descriptions
- Browsing: Redact query params, hash sensitive URLs
- Email: Store classifications, NOT raw content (Phase 0 already does this)

### User Controls
- Toggle cloud processing on/off
- Delete all local data
- Export encrypted backup
- Revoke OAuth permissions

---

## 🧪 Testing Strategy

### Unit Tests

**OAuth Flow:**
```typescript
describe('Calendar OAuth Flow', () => {
  it('should store encrypted tokens locally', async () => {
    const tokens = await mockOAuthFlow();
    const key = await deriveEncryptionKey(mockWallet);
    const encrypted = await encryptData(JSON.stringify(tokens), key);

    await indexedDB.put('oauth_tokens', { service: 'google_calendar', encrypted_tokens: encrypted });

    const retrieved = await indexedDB.get('oauth_tokens', 'google_calendar');
    const decrypted = await decryptData(retrieved.encrypted_tokens, key);

    expect(JSON.parse(decrypted)).toEqual(tokens);
  });

  it('should never send tokens to backend', async () => {
    const spy = jest.spyOn(fetch, 'default');

    await connectGoogleCalendar(mockWallet);

    // Assert: NO network calls to OwnYou backend
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('ownyou.com'));
  });
});
```

### Integration Tests

**Multi-Source IAB Classification:**
```python
def test_multi_source_iab_classification():
    """Test: Email + Calendar + Browsing → Unified IAB"""
    user_id = "test_user_123"

    # 1. Add email event (IAB20-26: Travel)
    email_store.put(
        namespace=("ownyou.email_events", user_id),
        key="email_1",
        value={"content": "Flight to Tokyo", "iab": ["IAB20-26"]}
    )

    # 2. Add calendar event (IAB20-26: Travel)
    calendar_store.put(
        namespace=("ownyou.calendar_events", user_id),
        key="cal_1",
        value={"title": "Tokyo trip", "iab": ["IAB20-26"]}
    )

    # 3. Add browsing history (IAB20-26: Travel)
    browsing_store.put(
        namespace=("ownyou.browsing_history", user_id),
        key="browse_1",
        value={"domain": "tripadvisor.com", "iab": ["IAB20-26"]}
    )

    # 4. Reconcile evidence
    evidences = collect_all_evidence(user_id, category="IAB20-26")
    assert len(evidences) == 3
    assert evidences[0]['sources'] == ['email', 'calendar', 'browsing']
    assert evidences[0]['confidence'] > 0.9  # High confidence from 3 sources
```

### End-to-End Tests

**Complete User Flow:**
```typescript
describe('E2E: User connects Calendar and browses', () => {
  it('should process data locally without backend', async () => {
    // 1. User connects Google Calendar
    await user.click('Connect Google Calendar');
    await user.completeOAuth();

    // 2. Verify tokens stored locally (encrypted)
    const tokens = await indexedDB.get('oauth_tokens', 'google_calendar');
    expect(tokens.encrypted_tokens).toBeDefined();

    // 3. Background worker fetches calendar events
    await waitFor(() => expect(getCalendarEvents()).resolves.toHaveLength(5));

    // 4. IAB classification happens locally
    const classifications = await store.search(['ownyou.calendar_events', userId]);
    expect(classifications[0].iab_categories).toContain('IAB20-26');

    // 5. User visits website (browser extension tracks)
    await user.navigate('https://tripadvisor.com');

    // 6. Browser extension classifies locally
    await waitFor(() => {
      const browsing = store.search(['ownyou.browsing_history', userId]);
      expect(browsing).resolves.toHaveLength(1);
    });

    // 7. Multi-source reconciliation
    const unified = await reconcileEvidence(userId);
    expect(unified).toContain('IAB20-26');  // Travel category from both sources
  });
});
```

---

## 📅 Timeline & Milestones

### Week 1: Foundation + Calendar
- **Day 1-2:** Set up local LangGraph Store (SQLite)
- **Day 3:** Implement wallet-derived encryption for IndexedDB
- **Day 4-5:** Build Google Calendar connector (OAuth + data fetch)

**Milestone:** User can connect Google Calendar, data stored locally encrypted

### Week 2: Calendar + Multi-Source
- **Day 1-2:** Build Outlook Calendar connector
- **Day 3:** Set up local LLM (WebLLM) for IAB classification
- **Day 4-5:** Implement multi-source evidence reconciliation

**Milestone:** Calendar events classified locally, multi-source IAB working

### Week 3: Browser Extension
- **Day 1-2:** Build Chrome extension structure (WXT framework)
- **Day 3:** Implement history tracking with privacy redaction
- **Day 4-5:** Local IAB classification in extension (WebAssembly LLM)

**Milestone:** Browser extension tracks history, classifies locally

### Week 4: Testing + Integration
- **Day 1-2:** Email connector migration to LangGraph Store
- **Day 3:** Write integration tests (multi-source scenarios)
- **Day 4-5:** E2E testing, bug fixes, documentation

**Milestone:** All Phase 2 deliverables complete, tests passing

---

## ✅ Success Criteria

### Technical
- ✅ ALL OAuth tokens stored locally (IndexedDB, encrypted)
- ✅ Zero personal data sent to OwnYou backend
- ✅ All IAB classification happens on-device (WebLLM)
- ✅ LangGraph Store working with multi-source data
- ✅ Browser extension functional (Chrome)
- ✅ Email connector migrated to Store
- ✅ Multi-source evidence reconciliation working
- ✅ Offline-first (all features work without network)

### Privacy
- ✅ User can delete all local data
- ✅ User can export encrypted backup (Ceramic/IPFS)
- ✅ User can toggle cloud processing on/off
- ✅ Transparency panel shows what data would be sent

### Performance
- ✅ Local LLM inference < 2 seconds per classification
- ✅ Calendar sync < 5 seconds for 100 events
- ✅ Browser extension < 10MB memory footprint
- ✅ Wallet-derived decryption < 100ms

---

## 🔗 Integration Points

### Phase 2 → Phase 3 (Mission Agents)
- ✅ Store fully populated with multi-source data
- ✅ IAB classifications from Calendar + Browser + Email
- ✅ Mission agents can query rich context
- ✅ No changes needed when mission agents added

### Phase 2 → Phase 7 (Production)
- Plaid POC integration (see separate document)
- Add Location, Health, Photos connectors (same pattern)
- Migrate to PostgreSQL-backed Store (optional)
- Add Ceramic Network for multi-device sync

---

## 📚 References

**Strategic Planning:**
- [Strategic Roadmap](2025-01-04-ownyou-strategic-roadmap.md) - Phase 2 overview
- [Architectural Decisions](../reference/ARCHITECTURAL_DECISIONS.md) - Decision 4: Multi-Source IAB

**Technical Specifications:**
- [Consumer App Requirements](../requirements/*OwnYou Consumer App Requirements (brainstorm copy).md) - Section 2.2: Technology Principles (lines 66-75)
- [Browser Extension Requirements](../requirements/browser_extension_chrome_requirement2.0.md) - WXT framework, privacy controls

**Architecture:**
- [End-to-End Architecture](end-to-end-architecture.md) - System integration overview
- [Mission Agents Architecture](mission_agents_architecture.md) - Memory architecture (Store + Checkpointer)

**Skills:**
- `decentralized-consumer-app-authentication` - Wallet-based auth, session keys, privacy patterns

---

## 🚀 Next Steps After Approval

1. **Create feature branch:** `git checkout -b feature/phase-2-data-layer`
2. **Set up local dev environment:** Install WebLLM, WXT CLI
3. **Start with Calendar connector:** Highest value for Mission Agents
4. **Weekly progress check:** Demo Calendar → Browser → Complete

**Questions for User:**
- Local LLM: WebLLM (easier) or ONNX Runtime (faster)?
- Browser Extension: Chrome only or include Safari workaround?
- Ceramic sync: Must-have for Phase 2 or defer to Phase 7?

---

**Last Updated:** 2025-11-06
**Status:** Ready for Review
**Next:** Plaid POC Requirements Document (separate)
