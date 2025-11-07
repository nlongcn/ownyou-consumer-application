# IndexedDB Store Feasibility Research Spike

**Duration:** 1 week (Days 1-7)
**Goal:** Validate IndexedDB Store viability for OwnYou PWA before committing to 31K-line Python→JavaScript migration

---

## Background

OwnYou is migrating from Python (LangGraph + SQLite) to JavaScript/TypeScript (LangGraph.js + IndexedDB) for a browser-based PWA architecture.

**Critical Question:** Can we implement a production-ready IndexedDB-backed Store for LangGraph.js?

**Why This Matters:**
- ✅ **Checkpointing** (short-term thread state) already solved via PGlite
- ❌ **Store** (long-term cross-thread memory) has NO official IndexedDB implementation
- OwnYou Mission Agents require Store for IAB classifications and mission cards

---

## Research Structure

### Day 1-2: PGlite Checkpointer + IndexedDB
**Goal:** Validate PGlite checkpointing works in browser with IndexedDB persistence

**Files:**
- `day1-2_pglite_checkpointer/test-checkpointer.ts`
- `day1-2_pglite_checkpointer/README.md`

**Run:**
```bash
npm run day1
```

---

### Day 3-4: Custom IndexedDBStore
**Goal:** Build minimal IndexedDB-backed Store extending `BaseStore`

**Files:**
- `day3-4_custom_indexeddb_store/IndexedDBStore.ts`
- `day3-4_custom_indexeddb_store/test-store.ts`
- `day3-4_custom_indexeddb_store/README.md`

**Run:**
```bash
npm run day3
```

---

### Day 5: Integration Test (Email→IAB→Mission)
**Goal:** Validate end-to-end workflow with both checkpointing and custom Store

**Files:**
- `day5_integration_test/mini-iab-classifier.ts`
- `day5_integration_test/README.md`

**Run:**
```bash
npm run day5
```

---

### Day 6-7: Documentation & Decision
**Goal:** Compile findings and make GO/NO-GO recommendation

**Files:**
- `FINDINGS.md` (progress tracked daily)

---

## Setup

```bash
# Install dependencies
cd research_spike
npm install

# Run individual day tests
npm run day1   # PGlite checkpointer test
npm run day3   # Custom IndexedDB Store test
npm run day5   # Integration test
```

---

## Success Criteria

- ✅ State survives browser refresh (checkpointing)
- ✅ Cross-thread memory works (Store)
- ✅ Performance acceptable (<2s for IAB classification)
- ✅ Architecture extensible for production

---

## Failure Exit

If spike reveals fundamental blockers:
- Document findings in `FINDINGS.md`
- Evaluate alternative architectures (Electron, hybrid, server-side)
- Make NO-GO recommendation

---

## Daily Progress

Track findings in `FINDINGS.md` after each day's work.

---

**Status:** 🟡 In Progress
**Last Updated:** 2025-01-06
