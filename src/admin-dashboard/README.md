# OwnYou Admin Dashboard

**Phase 1.5:** Interim Development Tool (TypeScript Migration)

**Purpose:** Browser-based admin dashboard for debugging IAB classifier and developing mission agents.

**Status:** 🔄 In Development (Week 1/4)

---

## Overview

This is a Next.js 14 application that serves as the primary development and debugging tool for:
- **IAB Classifier:** Debug classifications, view evidence, assess quality
- **Mission Agents:** Test mission generation, preview cards
- **System Development:** Workflow debugging, Store browsing, prompt editing

**Architecture:** Pure browser PWA with IndexedDB storage (self-sovereign)

**Relationship to Consumer UI:** This admin dashboard validates the browser architecture and documents learnings that will inform the consumer-facing UI in Phase 5.

---

## Quick Start

```bash
# Install dependencies
cd src/admin-dashboard
npm install

# Run development server
npm run dev

# Open browser
open http://localhost:3001
```

---

## Features

### Existing Features (From Flask Dashboard)
- ✅ IAB Profile Viewer (6 sections)
- ✅ Analysis Runner (download emails → classify)
- ✅ Evidence Viewer (LLM reasoning)
- ✅ Real-time Status (job progress)
- ✅ Cost Tracking (token usage)
- ✅ Category Browser (IAB taxonomy)

### New Features (Phase 1.5)
- 🆕 Workflow Debugger (LangGraph visualizer)
- 🆕 Store Browser (IndexedDB inspector)
- 🆕 Evidence Quality Analyzer (batch evaluation)
- 🆕 Prompt Editor (modify classifier prompts)
- 🆕 Mission Agent Tester (test mission generation)

---

## Project Structure

```
src/admin-dashboard/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard home
│   ├── layout.tsx         # Root layout
│   ├── api/               # API routes (TypeScript backend)
│   │   ├── profile/       # Profile API
│   │   ├── analyze/       # Analysis API
│   │   ├── evidence/      # Evidence API
│   │   ├── categories/    # Taxonomy API
│   │   └── analytics/     # Analytics API
│   ├── profile/           # Profile viewer UI
│   ├── analyze/           # Analysis runner UI
│   ├── evidence/          # Evidence viewer UI
│   ├── workflow/          # Workflow debugger (NEW)
│   ├── store/             # Store browser (NEW)
│   ├── quality/           # Quality analyzer (NEW)
│   ├── prompts/           # Prompt editor (NEW)
│   └── missions/          # Mission tester (NEW)
│
├── components/            # React components
│   ├── AnalysisRunner.tsx
│   ├── ProfileSummary.tsx
│   ├── EvidenceViewer.tsx
│   ├── WorkflowDebugger.tsx (NEW)
│   ├── StoreBrowser.tsx (NEW)
│   └── ... (more components)
│
├── lib/                   # Utility libraries
│   ├── store-client.ts    # IndexedDBStore wrapper
│   ├── classifier-api.ts  # TypeScript IAB integration
│   ├── extension-bridge.ts # Browser extension communication
│   └── analytics-engine.ts # Quality metrics
│
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md (this file)
```

---

## Integration with TypeScript IAB Classifier

The admin dashboard integrates directly with the TypeScript IAB classifier (no REST API overhead):

```typescript
import { buildWorkflowGraph } from '@ownyou/iab-classifier'
import { IndexedDBStore } from '@/lib/IndexedDBStore'

const store = new IndexedDBStore('admin-dashboard')
const graph = buildWorkflowGraph(store, null)

const result = await graph.invoke({
  user_id: 'test_user',
  emails: [...],
  llm_provider: 'openai',
  llm_model: 'gpt-4o-mini'
})
```

---

## Browser Extension Integration

OAuth flows (Gmail/Outlook) are handled by a Chrome/Firefox browser extension:

**Location:** `src/browser-extension/`

**Communication:** postMessage API between admin dashboard and extension

**Setup:**
1. Load extension in Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `src/browser-extension/` directory

---

## Data Storage

**Storage:** IndexedDB (replaces Flask dashboard's SQLite)

**Namespaces:**
- `iab_classifications` - IAB taxonomy classifications
- `email_events` - Downloaded emails
- `analysis_jobs` - Analysis job tracking
- `analytics_metrics` - Quality metrics

**Migration from SQLite:**
```bash
# Run migration tool (to be implemented)
npm run migrate:from-sqlite
```

---

## Development

### Running Tests
```bash
npm test
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
npm start
```

---

## Learnings Documentation

**File:** `docs/learnings/ADMIN_DASHBOARD_TO_CONSUMER_UI.md`

**Purpose:** Document all learnings from Phase 1.5 to inform Phase 5 consumer UI

**What to document:**
- OAuth extension patterns
- IndexedDB performance benchmarks
- React component patterns
- TypeScript integration approaches
- Real-time UI patterns
- UX insights for consumer UI

**When to document:** Throughout Phase 1.5 development

---

## Roadmap

### Week 1: Backend Migration
- [x] Set up Next.js project
- [ ] Migrate Flask API → TypeScript API routes
- [ ] Replace SQLite → IndexedDB queries
- [ ] Test profile API as POC

### Week 2: Frontend Migration + Extension
- [ ] Port React components
- [ ] Update for IndexedDB
- [ ] Create browser extension
- [ ] Test OAuth flows

### Week 3: New Development Features
- [ ] Workflow debugger
- [ ] Store browser
- [ ] Quality analyzer
- [ ] Prompt editor
- [ ] Mission tester

### Week 4: Testing + Documentation
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance benchmarks
- [ ] Complete learnings document

---

## FAQ

### Why a separate admin dashboard?
The admin dashboard serves different users (developers) with different needs (debugging, metrics) than the consumer UI (non-technical users, simple cards). Keeping them separate allows each to optimize for its audience.

### Why not just use LangGraph Studio?
The admin dashboard provides OwnYou-specific features (IAB classification quality, mission card preview) that LangGraph Studio doesn't support. It also validates the browser-based architecture before building the consumer UI.

### How does this relate to the consumer UI (Phase 5)?
The admin dashboard is a **proving ground**. Learnings about browser extension OAuth, IndexedDB performance, and React patterns will directly inform consumer UI design, reducing risk and rework.

### Can the admin dashboard be used in production?
Yes! It's a functional development tool. However, it's designed for internal use (power users) and will be complemented by the consumer-facing UI in Phase 5.

---

## Links

- **Strategic Roadmap:** `docs/plans/2025-01-04-ownyou-strategic-roadmap.md`
- **Learnings Document:** `docs/learnings/ADMIN_DASHBOARD_TO_CONSUMER_UI.md`
- **TypeScript IAB Classifier:** `src/browser/agents/iab-classifier/`
- **IndexedDB Store:** `src/browser/store/IndexedDBStore.ts`
- **Browser Extension:** `src/browser-extension/`
- **Original Flask Dashboard:** `dashboard/` (deprecated after Phase 1.5)

---

**Last Updated:** 2025-01-10
**Phase:** 1.5 (Week 1/4)
**Status:** 🔄 In Development
