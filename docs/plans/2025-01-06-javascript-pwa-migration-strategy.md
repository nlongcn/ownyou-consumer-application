# OwnYou JavaScript/PWA Migration Strategy

**Date:** 2025-01-06
**Status:** Research Spike Phase
**Decision:** Full JavaScript migration for browser-based PWA

---

## Executive Summary

OwnYou is pivoting from a Python-based local agent architecture to a **pure browser-based Progressive Web App (PWA)** implemented in JavaScript/TypeScript. This decision prioritizes accessibility for non-technical MVP test users who need zero-friction access ("just visit a URL").

**Key Change:** Python backend (localhost) → JavaScript in browser (PWA)

**Timeline:** 7 months (1 week spike + 4 months backend + 2 months UI)

**Critical Risk:** IndexedDB Store implementation (MEDIUM risk, requires custom development)

---

## Technology Decisions

### 1. Architecture

**Deployment Model:**
- ✅ **Pure Browser PWA** (no installation required)
- ✅ **JavaScript/TypeScript** throughout
- ✅ **IndexedDB** for client-side storage (MVP Phase 2-5)
- ✅ **LangGraph.js** for agent workflows

**Rejected Alternatives:**
- ❌ Local Python Agent (requires installation, too complex for MVP users)
- ❌ User-hosted backend (infrastructure management burden)
- ❌ OwnYou-hosted backend (violates self-sovereign temporarily)

**Rationale:**
"My MVP test users are not technical. Everything needs to be abstracted away, as much as possible."

---

### 2. Inference Architecture

**Default:**
- External API calls (OpenAI/Anthropic) from browser
- User's own API keys (stored encrypted in IndexedDB)
- **OwnYou provides keys for MVP trial users**

**Optional (Future):**
- Local inference via Ollama (desktop only, not mobile)
- Trusted Execution Environment (TEE) for privacy + performance (Phase 6-7)

**Trust Model:**
Similar to iCloud/Gmail - users trust contractual privacy obligations. Not emphasis on user transparency (which would confuse average users), but on user control (can export, delete, manage data).

---

### 3. Application Separation

**Dashboard (Existing):**
- Admin/development tool for debugging
- Keep separate from consumer app
- Current Flask/React stays as-is

**PWA (New):**
- Consumer-facing application
- Built from scratch (not evolution of dashboard)
- Installable, offline-capable, mobile-friendly

**Rationale:**
Clean separation of concerns. Dashboard for developers, PWA for end users.

---

### 4. Migration Strategy

**Approach:** Horizontal Layers (Bottom-Up)

**Layer 1:** Storage & Data Models (IndexedDB + Zod)
**Layer 2:** LangGraph.js Foundation (StateGraph + Store + Checkpointer)
**Layer 3:** Data Connectors (OAuth + APIs)
**Layer 4:** Intelligence (IAB + Mission Agents)
**Layer 5:** UI Components (React PWA)

**Principle:**
Each layer is fully functional and tested before building the next. No end-to-end user functionality until Layer 4-5 complete.

**Timeline:**
- Month 1: Layers 1-2 (Foundation)
- Month 2: Layer 3 (Data Connectors)
- Month 3: Layer 4 (Intelligence)
- Month 4: Integration Testing
- Month 5+: Layer 5 (UI Development)

**Rationale:**
User preference: "Build UI Last (After Migration)" - Backend fully tested before UI built.

---

## Critical Risk: IndexedDB Store Gap

### The Problem

**What LangGraph.js HAS:**
- ✅ Checkpointing (short-term thread state) via `@steerprotocol/langgraph-checkpoint-pglite`
  - Supports IndexedDB: `idb://my-database`
  - Persists across browser refreshes
  - Production-ready

**What LangGraph.js LACKS:**
- ❌ Store (long-term cross-thread memory) with IndexedDB backend
  - Only `InMemoryStore` (ephemeral) and `PostgresStore` (server-side)
  - No official IndexedDB implementation
  - **Custom development required**

### Impact on OwnYou

OwnYou architecture requires:
1. **Checkpointing** (conversation threads, ReAct loops) → ✅ **SOLVED** (PGlite)
2. **Store** (IAB classifications, Mission cards, user preferences) → ❌ **UNSOLVED**

**Without Store persistence:**
- IAB classifications lost on browser refresh
- Mission cards not available across sessions
- Cross-thread memory (core to Mission Agents) broken

**Risk Level:** 🟡 **MEDIUM**

### Mitigation: 1-Week Research Spike

**Goal:** Prove IndexedDB Store viability before committing to 31K-line migration

**Approach:**
- Build custom `IndexedDBStore` extending `BaseStore` interface
- Test with minimal IAB classifier workflow
- Benchmark performance vs Python SQLite
- Identify blockers early

**Success Criteria:**
- ✅ State survives browser refresh
- ✅ Cross-thread memory works
- ✅ Performance acceptable (<2s latency)
- ✅ Architecture extensible for production

**Failure Exit:**
- Evaluate Electron/Capacitor (can use SQLite)
- Consider hybrid architecture (Python backend + browser UI)
- Document findings for future reference

---

## Research Spike Plan (Week 1)

### Day 1-2: PGlite Checkpointer + IndexedDB

**Goal:** Validate PGlite checkpointing works in browser with IndexedDB

**Tasks:**
1. Install `@langchain/langgraph` + `@steerprotocol/langgraph-checkpoint-pglite`
2. Build minimal StateGraph with PGlite checkpointer (`idb://spike-test`)
3. Create conversation thread, add messages
4. **Refresh browser** - verify state survives
5. Resume conversation in same thread
6. Create second thread - verify isolation
7. Test cross-tab synchronization (IndexedDB quirk)

**Deliverable:** `research_spike/day1-2_pglite_checkpointer/README.md` with findings

---

### Day 3-4: Custom IndexedDBStore

**Goal:** Build minimal IndexedDB-backed Store implementation

**Tasks:**
1. Read `BaseStore` interface source code in LangGraph.js
2. Implement `IndexedDBStore` class:
   ```typescript
   class IndexedDBStore extends BaseStore {
     async put(namespace: string[], key: string, value: any): Promise<void>
     async get(namespace: string[], key: string): Promise<any>
     async delete(namespace: string[], key: string): Promise<void>
     async search(namespace: string[], options?: SearchOptions): Promise<any[]>
     async list_keys(namespace: string[]): Promise<string[]>
   }
   ```
3. Unit tests for each method
4. Integration test: Use custom Store with compiled graph
5. Test cross-thread reads (Store's primary use case)

**Deliverable:** `research_spike/day3-4_custom_indexeddb_store/IndexedDBStore.ts` + README

---

### Day 5: Integration Test (Email→IAB→Mission)

**Goal:** Validate end-to-end workflow with custom Store

**Tasks:**
1. Build mini IAB classifier:
   - Hardcode 1 email
   - Classify to 1 IAB category (e.g., "Shopping")
   - Write to IndexedDBStore namespace: `["user_123", "iab_classifications"]`
2. Build mini Mission Agent:
   - Read IAB classification from Store
   - Generate 1 mission card (e.g., "Track shopping budget")
   - Write card to Store namespace: `["user_123", "mission_cards"]`
3. Test full flow:
   - Run IAB classifier
   - **Refresh browser**
   - Run Mission Agent (should find classification)
   - **Refresh browser**
   - Verify mission card persisted
4. Benchmark:
   - Measure latency (target: <2s for IAB classification)
   - Compare to Python SQLite baseline (if available)

**Deliverable:** `research_spike/day5_integration_test/mini-iab-classifier.ts` + README

---

### Day 6-7: Documentation & Decision

**Goal:** Make informed GO/NO-GO decision on full migration

**Tasks:**
1. Compile findings:
   - What works? What doesn't?
   - Performance benchmarks
   - Blockers identified (if any)
   - Comparison to Python implementation
2. Estimate full migration effort:
   - 31K lines of Python → JavaScript
   - Expected timeline (months)
   - Team capacity required
3. Risk assessment:
   - Technical risks (Store, performance, browser compat)
   - Timeline risks (7 months realistic?)
   - Resource risks (team bandwidth, expertise)
4. Make recommendation:
   - **GO:** IndexedDB Store works, proceed with full migration
   - **NO-GO:** Blockers found, pivot to alternative architecture

**Deliverable:** `research_spike/FINDINGS.md` with GO/NO-GO recommendation

---

## Migration Scope (If GO)

### Python Codebase to Migrate

**Email Parser:** ~31,154 lines across 82 files
- Main entry: 2,132 lines (`main.py`)
- LangGraph workflow: ~8 nodes
- Dependencies: Pydantic v2, LangChain, LangGraph, OpenAI/Anthropic

**Migration Confidence Levels:**

**High-Confidence (Direct Port):**
- ✅ LangGraph workflows (StateGraph, nodes, edges)
- ✅ Multi-agent patterns (Supervisor, Swarm, ReAct)
- ✅ State management (Annotation, reducers)

**Medium-Risk (Logic Port):**
- 🟡 Batch optimizer (Python-specific 20-30x gains may not translate)
- 🟡 LangGraph Studio integration (may differ in JS version)
- 🟡 Semantic memory reconciliation (manual porting required)

**High-Risk (Architecture Change):**
- 🔴 SQLite → IndexedDB (schema differences, no SQL queries)
- 🔴 Store cross-thread reads (IndexedDB cross-tab sync complexity)
- 🔴 Embedding search (IndexedDB has no native vector search)

### Technology Stack Changes

| Component | Python | JavaScript | Notes |
|-----------|--------|------------|-------|
| **Language** | Python 3.8+ | TypeScript 5.0+ | Type safety required |
| **Models** | Pydantic v2 | Zod | Schema validation |
| **Workflows** | LangGraph | LangGraph.js | ~95% feature parity |
| **Storage** | SQLite | IndexedDB | Custom Store needed |
| **Checkpointing** | MemorySaver | PGlite (`idb://`) | Production-ready |
| **LLM Clients** | LangChain | LangChain.js | Official SDKs |
| **Testing** | pytest | Jest/Vitest | Unit + integration |
| **OAuth** | Requests | Fetch API + PKCE | Browser-compatible |

---

## Documentation Updates Required

### After Spike Success (Priority Order)

**Priority 1: CRITICAL (Week 2)**
1. `CLAUDE.md` - Update deployment model, commands, structure
2. `docs/reference/ARCHITECTURAL_DECISIONS.md` - Replace all Python examples
3. `docs/plans/2025-01-04-ownyou-strategic-roadmap.md` - Update all phases
4. `README.md` - Prerequisites, installation, commands
5. Archive `docs/reference/CURRENT_SYSTEM.md` → `CURRENT_SYSTEM_PYTHON.md`
6. Create `docs/reference/CURRENT_SYSTEM_JS.md` (new)

**Priority 2: HIGH (Week 3)**
- `docs/reference/DEVELOPMENT_GUIDELINES.md` (JavaScript patterns)
- `docs/development/TESTING_PLAN.md` (Jest/Vitest)
- `docs/development/REPOSITORY_GUIDELINES.md` (npm commands)
- `docs/plans/mission_agents_architecture.md` (LangGraph.js)
- `docs/plans/end-to-end-architecture.md` (PWA architecture)

**Priority 3: MEDIUM (As Needed)**
- Skills (`.claude/skills/` → JavaScript patterns)
- Technical references (PROJECT_STRUCTURE.md, etc.)
- Phase-specific plans

**Total Documents:** ~26 main files + skills

**Estimated Effort:** 5-6 days for complete documentation migration

---

## Decision Gate

### After Week 1 Spike

**GO Decision:**
- ✅ IndexedDB Store implementation works
- ✅ Performance acceptable
- ✅ No fundamental blockers
- → Proceed with full migration

**Next Steps (If GO):**
1. Week 2-3: Update all CRITICAL documentation
2. Week 4-5: Set up production TypeScript project structure
3. Month 2: Begin Layer 1 migration (Storage + Data Models)
4. Month 3: Layer 2 (LangGraph.js Foundation)
5. Month 4: Layer 3 (Data Connectors)
6. Month 5: Layer 4 (Intelligence)
7. Month 6-7: Layer 5 (PWA UI)

**NO-GO Decision:**
- ❌ Fundamental blockers found (e.g., IndexedDB Store not viable)
- ❌ Performance unacceptable
- ❌ Browser compatibility issues
- → Pivot to alternative architecture

**Alternative Architectures (If NO-GO):**
1. **Electron/Capacitor:** Desktop/mobile app with SQLite (can reuse Python)
2. **Hybrid:** Python backend (localhost) + React frontend (browser)
3. **Server-Side:** Python on cloud (evaluate privacy implications)

---

## Success Metrics

### Technical Metrics
- ✅ All layers functional before UI built
- ✅ Test coverage >70%
- ✅ Type safety (TypeScript strict mode)
- ✅ Performance: <2s IAB classification, <5s mission generation
- ✅ Browser compatibility: Chrome, Safari, Firefox latest 2 versions
- ✅ Offline support: Service worker + IndexedDB

### User Metrics (After UI Launch)
- ✅ Zero-installation access (just visit URL)
- ✅ Works on mobile browsers
- ✅ Installable as PWA
- ✅ 8 data sources connectable
- ✅ >40% mission completion rate
- ✅ >30% retention (30-day)

---

## Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| IndexedDB Store blocker | Medium | High | 1-week spike to validate early |
| Performance degradation | Medium | Medium | Benchmark during spike, optimize iteratively |
| Browser incompatibility | Low | Medium | Test on 3 browsers during spike |
| Vector search missing | High | Low | Defer semantic search to Phase 6-7 |
| Batch optimizer loss | High | Medium | Accept trade-off, optimize differently |

### Timeline Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Spike takes >1 week | Low | Low | Hard stop at Day 7, make decision anyway |
| Migration takes >7 months | Medium | Medium | Monthly checkpoints, adjust scope |
| Documentation updates delayed | High | Low | Parallel work, don't block migration |

### Resource Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Insufficient JavaScript expertise | Low | High | Research spike validates feasibility |
| Context switching cost | Medium | Low | Focus on migration, defer other work |
| MVP users wait too long | Medium | High | Communicate timeline, manage expectations |

---

## Community Resources to Check

Before/during spike, search for existing solutions:

1. **LangChain Discord:** #langgraph-js channel for IndexedDB Store implementations
2. **GitHub Issues:** Search `langchain-ai/langgraphjs` for "IndexedDB" or "browser"
3. **npm Packages:** Search for "langgraph indexeddb" or "langgraph browser"
4. **Stack Overflow:** Questions about LangGraph.js + browser deployment
5. **Reddit:** r/LangChain for PWA patterns

**Goal:** Don't reinvent the wheel - find existing IndexedDB Store if available.

---

## Appendix: Key Conversations

### Why Pure PWA (Not Python Agent)?

**User Constraint:**
"My MVP test users are not technical. Everything needs to be abstracted away, as much as possible."

**Decision:**
Non-technical users cannot install Python, configure localhost, manage CLI tools. They need browser-only access.

**Rejected:**
- Local Python Agent (too complex for users)
- User-hosted backend (infrastructure management)

---

### Why External Inference (Not Local LLMs)?

**User Clarification:**
"Local inference could be an option for users running the application on a desktop but it isn't practical for mobile."

**Decision:**
Default to external API (OpenAI/Anthropic) with user's keys (or OwnYou trial keys). Optional Ollama for desktop power users.

**Trust Model:**
Similar to iCloud/Gmail - users trust contractual obligations, not technical transparency.

---

### Why Build UI Last (Not Incrementally)?

**User Preference:**
"Build UI Last (After Migration)" - backend fully tested before UI built.

**Rationale:**
Clean separation, each layer production-ready before moving up. No rushing to "show something" that's half-baked.

---

## References

- **Audit Report:** Full documentation audit in conversation 2025-01-06
- **LangGraph.js Research:** Context7 MCP documentation retrieval
- **Strategic Roadmap:** `docs/plans/2025-01-04-ownyou-strategic-roadmap.md`
- **Architectural Decisions:** `docs/reference/ARCHITECTURAL_DECISIONS.md`

---

**Last Updated:** 2025-01-06
**Next Review:** After Week 1 Spike (Day 7)
**Owner:** OwnYou Development Team
**Status:** 🟡 Research Spike in Progress
