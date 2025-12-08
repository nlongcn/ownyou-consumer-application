# OwnYou Consumer Application - Strategic Development Roadmap v2

**Goal:** Build complete consumer application using vertical slice approach with minimal rework

**Strategy:** Vertical slices - build complete end-to-end features incrementally, each sprint delivers working functionality

**Date:** 2025-12-08 (updated)

**Supersedes:** `2025-01-04-ownyou-strategic-roadmap.md` (horizontal layer approach)

**Validates Against:** `OwnYou_architecture_v13.md` (architecture specification)

---

## Strategy Comparison

### Original Approach (Horizontal Layers)

```
Phase 1: Foundation ████████████████████████████████ (all contracts)
Phase 2: Data Layer ████████████████████████████████ (all sources)
Phase 3: Agent Layer ████████████████████████████████ (all agents)
Phase 4: API Layer ████████████████████████████████ (all endpoints)
Phase 5: UI Layer ████████████████████████████████ (all screens)
```

### New Approach (Vertical Slices)

```
Sprint 0-9: Foundation→Observability  ████████████████░░░░░░░░░░░░░░ (COMPLETE - 6 agents, 4 data sources, debugging)
Sprint 10-11: Sync + UI               ████████████████░░░░░░░░░░░░░░ (cross-device, consumer UI)
...continues...
```

### Why Vertical Slices for Solo/Small Team

| Aspect                          | Horizontal Layers                         | Vertical Slices                       |
| ------------------------------- | ----------------------------------------- | ------------------------------------- |
| **First working feature** | After Phase 5 (~20 weeks)                 | After Sprint 3 (~6 weeks)             |
| **Validation**            | Late (integration issues discovered late) | Early (full stack tested each sprint) |
| **Parallel work**         | Requires multiple teams                   | Works for solo developer              |
| **Rework risk**           | High (contracts may need changes)         | Low (contracts evolve with usage)     |
| **Motivation**            | Long wait for tangible results            | Regular wins, visible progress        |

---

## V13 Architecture Coverage Matrix

This section maps every v13 architecture requirement to a sprint, ensuring nothing is missed.

### Section 2: Ikigai Intelligence Layer

| V13 Requirement                                                       | Sprint   | Status      |
| --------------------------------------------------------------------- | -------- | ----------- |
| 2.1 Signal-Based Inference Architecture                               | Sprint 6 | ✅ Complete |
| 2.2 Ikigai Dimensions (Experiences, Relationships, Interests, Giving) | Sprint 6 | ✅ Complete |
| 2.3 Store Schema: ikigai namespace                                    | Sprint 6 | ✅ Complete |
| 2.4 LLM-Based Ikigai Inference (4 parallel prompts + synthesis)       | Sprint 6 | ✅ Complete |
| 2.5 Batch Processing Configuration                                    | Sprint 6 | ✅ Complete |
| 2.6 Mission Prioritization (well-being value scoring)                 | Sprint 6 | ✅ Complete |
| 2.7 Ikigai Points & Rewards                                           | Sprint 6 | ✅ Complete |
| 2.8 Mission Card Ikigai Feedback (heart states)                       | Sprint 3 | ✅ Complete |
| 2.9 Ikigai-Memory Integration                                         | Sprint 6 | ✅ Complete |

### Section 3: Mission Agent System

| V13 Requirement                          | Sprint   | Status      |
| ---------------------------------------- | -------- | ----------- |
| 3.1 Four-Mode Trigger System             | Sprint 5 | ✅ Complete |
| 3.2 Trigger Architecture                 | Sprint 5 | ✅ Complete |
| 3.3 Mission State Machine                | Sprint 3 | ✅ Complete |
| 3.4 Mission Card Structure               | Sprint 3 | ✅ Complete |
| 3.5 Agent Coordinator                    | Sprint 5 | ✅ Complete |
| 3.6.1 Shopping Agent (L1-2)              | Sprint 3 | ✅ Complete |
| 3.6.1 Content Agent (L1)                 | Sprint 4 | ✅ Complete |
| 3.6.1 Restaurant Agent (L2)              | Sprint 7 | ✅ Complete |
| 3.6.1 Events Agent (L2)                  | Sprint 7 | ✅ Complete |
| 3.6.1 Travel Agent (L3)                  | Sprint 7 | ✅ Complete |
| 3.6.1 Diagnostic Agent (L2)              | Sprint 8 | ✅ Complete |
| 3.6.2 Namespace Access Control           | Sprint 3 | ✅ Complete |
| 3.6.3 Agent Complexity Levels (L1/L2/L3) | Sprint 3 | ✅ Complete |
| 3.6.4 Tool Call Limits                   | Sprint 3 | ✅ Complete |
| 3.6.5 Privacy-Tier Enforcement           | Sprint 4 | ✅ Complete |

### Section 4: Consumer UI

| V13 Requirement                        | Sprint                        | Status      |
| -------------------------------------- | ----------------------------- | ----------- |
| 4.1-4.2 Design System & Figma Specs    | Sprint 11                     | 🔲 Planned  |
| 4.3 Component Library                  | Sprint 3 (partial), Sprint 11 | 🟡 Partial  |
| 4.4 MissionCard Components             | Sprint 3                      | ✅ Complete |
| 4.5 MissionFeed Layout                 | Sprint 3                      | ✅ Complete |
| 4.6 Navigation Components              | Sprint 11                     | 🔲 Planned  |
| 4.7 Feed Layout (Masonry)              | Sprint 11                     | 🔲 Planned  |
| 4.8 Platform Adaptations (PWA/Desktop) | Sprint 11                     | 🔲 Planned  |
| 4.9 Asset Management                   | Sprint 11                     | 🔲 Planned  |

### Section 5: Data Source Sync

| V13 Requirement                | Sprint    | Status      |
| ------------------------------ | --------- | ----------- |
| 5.1 Platform Tier Architecture | Sprint 1  | ✅ Complete |
| 5.2 OrbitDB v3 + Helia         | Sprint 10 | 🔲 Planned  |
| 5.2.1 Offline Handling         | Sprint 10 | 🔲 Planned  |
| 5.2.2 CRDT Conflict Resolution | Sprint 10 | 🔲 Planned  |
| 5.2.3 Device Discovery         | Sprint 10 | 🔲 Planned  |
| 5.2.4 Encryption Policy        | Sprint 10 | 🔲 Planned  |
| 5.3 Key Recovery               | Sprint 10 | 🔲 Planned  |
| 5.4 E2EE Cloud Backup          | Sprint 10 | 🔲 Planned  |
| 5.5 Data Sanitization Pipeline | Sprint 2  | ✅ Complete |

### Section 6: Decentralization & LLM Management

| V13 Requirement                       | Sprint    | Status                |
| ------------------------------------- | --------- | --------------------- |
| 6.1-6.5 Private Inference Strategy    | Sprint 14 | 🔲 Planned (Post-MVP) |
| 6.10 LLM Cost Management              | Sprint 2  | ✅ Complete           |
| 6.10.1 Budget Policy Interface        | Sprint 2  | ✅ Complete           |
| 6.10.2 Cost Tracking                  | Sprint 2  | ✅ Complete           |
| 6.10.3 Model Tier Definitions         | Sprint 2  | ✅ Complete           |
| 6.10.4 Budget Enforcement Flow        | Sprint 2  | ✅ Complete           |
| 6.11 Error Handling & Resilience      | Sprint 5  | ✅ Complete           |
| 6.11.1 Resilience Policy Interface    | Sprint 5  | ✅ Complete           |
| 6.11.2 Circuit Breaker Implementation | Sprint 5  | ✅ Complete           |
| 6.11.3 LLM Fallback Chain             | Sprint 5  | ✅ Complete           |
| 6.11.4 Partial Data Handling          | Sprint 5  | ✅ Complete           |
| 6.11.5 Error Recovery UI States       | Sprint 5  | ✅ Complete           |

### Section 7: Publisher/Advertiser SDK & BBS+

| V13 Requirement                 | Sprint    | Status     |
| ------------------------------- | --------- | ---------- |
| 7.1 End-to-End Attribution Flow | Sprint 12 | 🔲 Planned |
| 7.2 BBS+ Pseudonym Mechanics    | Sprint 12 | 🔲 Planned |
| 7.3 Publisher SDK               | Sprint 12 | 🔲 Planned |
| 7.4 Advertiser SDK              | Sprint 12 | 🔲 Planned |
| 7.5 Revenue Distribution        | Sprint 12 | 🔲 Planned |
| 7.6 Demo Environment            | Sprint 12 | 🔲 Planned |

### Section 8: Memory Architecture

| V13 Requirement                                                   | Sprint    | Status      |
| ----------------------------------------------------------------- | --------- | ----------- |
| 8.1-8.2 Memory Types (Semantic, Episodic, Procedural, Relational) | Sprint 4  | ✅ Complete |
| 8.3 Agent-Driven Memory                                           | Sprint 4  | ✅ Complete |
| 8.4 Memory Schema                                                 | Sprint 4  | ✅ Complete |
| 8.5 Vector Embeddings (Local)                                     | Sprint 4  | ✅ Complete |
| 8.6 Bi-Temporal Modeling                                          | Sprint 4  | ✅ Complete |
| 8.7 Memory Retrieval (Hybrid: Semantic + BM25 + RRF)              | Sprint 4  | ✅ Complete |
| 8.8 Memory Tools for Agents                                       | Sprint 4  | ✅ Complete |
| 8.9 Memory Lifecycle (Consolidation, Decay, Pruning)              | Sprint 4  | ✅ Complete |
| 8.10 Reflection Node                                              | Sprint 4  | ✅ Complete |
| 8.11 Privacy Tiers                                                | Sprint 4  | ✅ Complete |
| 8.12 Namespace Schema                                             | Sprint 0  | ✅ Complete |
| 8.13 Storage Backends                                             | Sprint 0  | ✅ Complete |
| 8.14 Memory-Sync Integration                                      | Sprint 10 | 🔲 Planned  |
| 8.15 Memory Size Limits                                           | Sprint 4  | ✅ Complete |

### Section 10: Observability & Debugging

| V13 Requirement                  | Sprint    | Status      |
| -------------------------------- | --------- | ----------- |
| 10.1 Observability Architecture  | Sprint 9  | ✅ Complete |
| 10.2 Agent Execution Tracing     | Sprint 9  | ✅ Complete |
| 10.3 Sync Debugging              | Sprint 10 | 🔲 Planned  |
| 10.4 LLM Cost Metering Dashboard | Sprint 9  | ✅ Complete |
| 10.5 Debug UI Components         | Sprint 9  | ✅ Complete |
| 10.6 User Data Export (GDPR)     | Sprint 9  | ✅ Complete |

---

## Completed Sprints (Phase 0-4)

### Sprint 0: Foundation ✅

**Duration:** 2 weeks | **Tests:** 241 passing

| Package                  | Purpose                                        | v13 Section |
| ------------------------ | ---------------------------------------------- | ----------- |
| `@ownyou/shared-types` | Type definitions, namespace schema             | 8.12        |
| `@ownyou/store`        | LangGraph Store abstraction (IndexedDB/SQLite) | 8.13        |
| `@ownyou/config`       | Configuration management                       | -           |
| `@ownyou/utils`        | Shared utilities                               | -           |

### Sprint 1a: Desktop Infrastructure ✅

**Duration:** 2 weeks

| Deliverable                             | Purpose                   | v13 Section |
| --------------------------------------- | ------------------------- | ----------- |
| Tauri 2.0 scaffolding                   | Desktop application shell | 5.1         |
| Custom protocol handler (`ownyou://`) | OAuth callback handling   | 5.1         |
| Native window management                | Desktop UX                | 4.8         |

### Sprint 1b: OAuth + Email + IAB ✅

**Duration:** 3 weeks

| Package                    | Purpose                        | v13 Section |
| -------------------------- | ------------------------------ | ----------- |
| `@ownyou/oauth`          | 90-day OAuth token management  | 5.1         |
| `@ownyou/data-email`     | Email fetching (Gmail/Outlook) | Phase 0     |
| `@ownyou/iab-classifier` | TypeScript IAB classification  | Phase 0     |

### Sprint 2: LLM Client Consolidation ✅

**Duration:** 2 weeks

| Package                | Purpose                        | v13 Section |
| ---------------------- | ------------------------------ | ----------- |
| `@ownyou/llm-client` | 7-provider LLM abstraction     | 6.10        |
| Cost tracking          | Per-user budget management     | 6.10.2      |
| Model tier routing     | fast/standard/quality/local    | 6.10.3      |
| Budget enforcement     | Throttling at 50%/80%/95%/100% | 6.10.4      |

### Sprint 3: Shopping Agent + Mission UI ✅

**Duration:** 3 weeks | **Tests:** 152 passing

| Package                                | Purpose                                   | v13 Section  |
| -------------------------------------- | ----------------------------------------- | ------------ |
| `@ownyou/agents-base` (62 tests)     | BaseAgent, LimitsEnforcer, PrivacyGuard   | 3.6.3, 3.6.4 |
| `@ownyou/agents-shopping` (29 tests) | Hybrid LLM + rule-based shopping agent    | 3.6.1        |
| `@ownyou/scheduler` (25 tests)       | Background task scheduling                | 3.2          |
| `@ownyou/ui-components` (14 tests)   | MissionCard, MissionFeed, FeedbackButtons | 4.4, 4.5     |
| Integration tests (10 tests)           | Full agent loop validation                | -            |
| Admin Dashboard (12 tests)             | Missions page with feedback               | 4            |

### Sprint 4: Memory Intelligence + Content Agent ✅

**Duration:** 3 weeks | **Completed:** 2025-12-04 | **Tests:** 245+

**Goal:** Make the system learn from feedback and prove agent framework scales

| Package                       | Purpose                                                        | Tests |
| ----------------------------- | -------------------------------------------------------------- | ----- |
| `@ownyou/memory`            | Memory tools, embeddings, hybrid retrieval, lifecycle          | 65    |
| `@ownyou/reflection`        | Background reflection, procedural synthesis, context injection | 22    |
| `@ownyou/agents-base`       | BaseAgent, LimitsEnforcer, PrivacyGuard (enhanced)             | 86    |
| `@ownyou/agents-shopping`   | Hybrid LLM + rule-based shopping agent                         | 29    |
| `@ownyou/agents-content`    | L1 content recommendation agent                                | 11    |
| `@ownyou/integration-tests` | Learning loop validation                                       | 32    |

**Success Criteria:**

- [X] Memory tools callable by agents
- [X] Reflection Node runs on triggers (5 episodes, daily, negative feedback)
- [X] Procedural rules synthesized from episode patterns
- [X] Shopping Agent demonstrates learning from feedback
- [X] Content Agent generates recommendation cards
- [X] All tests passing (245+)

---

### Sprint 5: Resilience + Trigger System ✅

**Duration:** 2 weeks | **Completed:** 2025-12-05 | **Tests:** 227 passing (95 resilience + 74 triggers + 58 integration)

**Goal:** Production-grade error handling and complete trigger architecture

| Package                       | Purpose                                                    | Tests |
| ----------------------------- | ---------------------------------------------------------- | ----- |
| `@ownyou/resilience`        | Circuit breakers, LLM fallback, partial data, error states | 95    |
| `@ownyou/triggers`          | 4-mode trigger system, agent coordinator                   | 74    |
| `@ownyou/integration-tests` | Trigger-to-mission flow validation                         | 58    |

**Success Criteria:**

- [X] Circuit breakers protect all external APIs
- [X] LLM requests have full 7-level fallback chain
- [X] All 4 trigger modes working (data/scheduled/event/user)
- [X] Agent Coordinator routes requests correctly
- [X] Graceful degradation on failures
- [X] All tests passing (227)

---

### Sprint 6: Ikigai Intelligence Layer ✅

**Duration:** 3 weeks | **Completed:** 2025-12-05 | **v13 Coverage:** Section 2 (Complete Ikigai)

**Goal:** Implement well-being-based mission prioritization

| Week   | Focus               | Deliverables                                                                 |
| ------ | ------------------- | ---------------------------------------------------------------------------- |
| Week 1 | Ikigai Inference    | 4 parallel dimension prompts (Experiences, Relationships, Interests, Giving) |
| Week 2 | Synthesis + Storage | Ikigai synthesis prompt, Profile storage, Evidence chains                    |
| Week 3 | Mission Integration | Well-being scoring, Mission prioritization, Ikigai points/rewards            |

**New Packages:**

- `@ownyou/ikigai` — Ikigai inference engine

**Success Criteria:**

- [X] Ikigai profile generated from user data
- [X] 4 dimensions scored independently
- [X] Missions prioritized by well-being value
- [X] Ikigai points awarded with multipliers
- [X] Ikigai-Memory integration working

---

### Sprint 7: Additional Agents (Restaurant, Events, Travel) ✅

**Duration:** 4 weeks | **Completed:** 2025-12-07 | **Tests:** 179 passing

**Goal:** Complete MVP agent roster with varying complexity levels

| Week     | Focus                 | Deliverables                                 |
| -------- | --------------------- | -------------------------------------------- |
| Week 1   | Restaurant Agent (L2) | Search, reservation (mock), dietary checks   |
| Week 2   | Events Agent (L2)     | Event search, calendar integration (mock)    |
| Week 3-4 | Travel Agent (L3)     | Multi-step planning, flights + hotels (mock) |

**New Packages:**

- `@ownyou/agents-restaurant` — L2 dining agent (55 tests)
- `@ownyou/agents-events` — L2 events agent (24 tests)
- `@ownyou/agents-travel` — L3 travel planning agent (49 tests)
- `@ownyou/mock-apis` — Mock external APIs (51 tests)

**Success Criteria:**

- [X] Restaurant Agent respects L2 limits (10 tools, 5 LLM, 120s)
- [X] Events Agent integrates with mock calendar
- [X] Travel Agent handles multi-step workflows (L3)
- [X] All agents use memory system
- [X] All agents learn from feedback

---

### Sprint 8: Data Sources (Financial, Calendar) + Diagnostic Agent ✅

**Duration:** 3 weeks | **Completed:** 2025-12-08 | **Tests:** 307 passing (236% of target)
**Spec:** `docs/sprints/ownyou-sprint8-spec.md`

**Goal:** Expand data sources and add diagnostic agent

| Package                       | Tests | Purpose                                                               |
| ----------------------------- | ----- | --------------------------------------------------------------------- |
| `@ownyou/data-financial`    | 113   | Plaid integration (mock), transaction IAB classification              |
| `@ownyou/data-calendar`     | 131   | Google/Microsoft Calendar, relationship extraction with decay scoring |
| `@ownyou/agents-diagnostic` | 63    | Profile analysis, pattern detection, LLM-based insight generation     |

**Success Criteria:**

- [X] Financial transactions classified by IAB
- [X] Calendar events classified by IAB
- [X] Diagnostic Agent analyzes complete profile
- [X] Data sources feed Ikigai inference
- [X] 4 data sources working (email, financial, calendar, browser)
- [X] 307 tests passing (236% of 130 target)

---

### Sprint 9: Observability & Debugging ✅

**Duration:** 2 weeks | **Completed:** 2025-12-08 | **Tests:** 229 passing | **v13 Coverage:** Section 10 (Complete)

**Goal:** Production-ready debugging and GDPR compliance

| Package                   | Tests | Purpose                                                       |
| ------------------------- | ----- | ------------------------------------------------------------- |
| `@ownyou/observability` | 154   | Agent tracing, sync logging, LLM metrics, data retention      |
| `@ownyou/debug-ui`      | 75    | Agent Inspector, Cost Dashboard, Sync Monitor, Data Export UI |

**Success Criteria:**

- [X] Agent traces captured with full detail (28 trace tests)
- [X] LLM costs visible in dashboard (25 metrics tests)
- [X] Debug UI accessible from Settings (4 components, 75 tests)
- [X] GDPR-compliant data export working (18 export tests)
- [X] Privacy-preserving sanitization (27 sanitizer tests)
- [X] Data retention policies (19 retention tests)

---

## Remaining Sprints (Phase 5+)

### Sprint 10: Cross-Device Sync 🔲

**Duration:** 3 weeks | **v13 Coverage:** Section 5 (Complete)

**Goal:** Implement OrbitDB sync with encryption

| Week   | Focus                  | Deliverables                                                  |
| ------ | ---------------------- | ------------------------------------------------------------- |
| Week 1 | OrbitDB Integration    | OrbitDB v3 + Helia setup, CRDT conflict resolution            |
| Week 2 | Encryption & Discovery | E2EE encryption, Device discovery (Privy wallet)              |
| Week 3 | Backup & Recovery      | E2EE cloud backup, Key recovery flow, Memory-sync integration |

**Dependencies:**

- `@orbitdb/core` (v3)
- `helia` (IPFS)

**Success Criteria:**

- [ ] Data syncs between devices
- [ ] Conflicts resolved automatically (CRDT)
- [ ] All sync data encrypted
- [ ] E2EE backup working
- [ ] Key recovery tested

**Post-Sprint Action Items:**

- [ ] **Complete Plaid Registration** - Privy wallet auth enables "phishing-resistant MFA" answer
  - Screenshot wallet connection flow for Q4 documentation
  - See: `docs/architecture/PLAID/PLAID_application.md`

---

### Sprint 11: Consumer UI (Full Implementation) 🔲

**Duration:** 4 weeks | **v13 Coverage:** Section 4 (Complete)

**Goal:** Production-ready consumer interface from Figma designs

| Week   | Focus                         | Deliverables                                                |
| ------ | ----------------------------- | ----------------------------------------------------------- |
| Week 1 | Shell & Navigation            | Header, Bottom nav (mobile), Sidebar (desktop), Filter tabs |
| Week 2 | All Card Variants             | 11 card types from Figma (savings, utility, travel, etc.)   |
| Week 3 | Profile & Settings            | Ikigai wheel, IAB visualization, Privacy controls           |
| Week 4 | Polish & Platform Adaptations | PWA optimization, Desktop breakpoints, Keyboard shortcuts   |

**Success Criteria:**

- [ ] All 11 card types implemented
- [ ] Navigation working (mobile + desktop)
- [ ] Ikigai wheel visualization
- [ ] Settings screens complete
- [ ] PWA and Tauri builds working

---

### Sprint 12: BBS+ & Publisher/Advertiser SDK 🔲

**Duration:** 4 weeks | **v13 Coverage:** Section 7 (Complete)

**Goal:** Privacy-preserving attribution and monetization

| Week   | Focus            | Deliverables                                     |
| ------ | ---------------- | ------------------------------------------------ |
| Week 1 | BBS+ Pseudonyms  | Pseudonym generation, Tracking ID derivation     |
| Week 2 | Publisher SDK    | SSO flow, Prebid.js adapter, Consent UI          |
| Week 3 | Advertiser SDK   | Campaign management, Escrow, Conversion tracking |
| Week 4 | Demo Environment | Demo publisher site, Mock advertiser dashboard   |

**Dependencies:**

- BBS+ library (BLS12-381)
- Solana SDK

**Success Criteria:**

- [ ] BBS+ pseudonyms working
- [ ] Tracking IDs unlinkable across campaigns
- [ ] Publisher SSO flow complete
- [ ] Advertiser conversion tracking working
- [ ] Demo environment functional

---

### Sprint 13: Production Readiness 🔲

**Duration:** 3 weeks | **v13 Coverage:** Phase 4

**Goal:** Replace mocks with real APIs and prepare for launch

| Week   | Focus                  | Deliverables                                           |
| ------ | ---------------------- | ------------------------------------------------------ |
| Week 1 | Real API Integrations  | SerpAPI, Tripadvisor, Ticketmaster, Plaid (production) |
| Week 2 | PostgreSQL Migration   | Store backend migration, pgvector for embeddings       |
| Week 3 | Security & Performance | Security audit, Performance optimization, Load testing |

**Success Criteria:**

- [ ] All mock APIs replaced
- [ ] PostgreSQL backend working
- [ ] Security audit passed
- [ ] Performance targets met
- [ ] Ready for pilot launch

---

### Sprint 14: Private Inference (Post-MVP) 🔲

**Duration:** 4 weeks | **v13 Coverage:** Section 6.1-6.9

**Goal:** Migrate sensitive inference to privacy-preserving platforms

| Week     | Focus                 | Deliverables                                           |
| -------- | --------------------- | ------------------------------------------------------ |
| Week 1-2 | Phala TEE Integration | TEE-based IAB classification, Attestation verification |
| Week 3-4 | Nillion Evaluation    | Blind compute for sensitive data (if available)        |

**Success Criteria:**

- [ ] Sensitive inference runs in TEE
- [ ] Attestation proofs validated
- [ ] Privacy guarantees documented

---

## Timeline Summary

| Sprint              | Duration            | Focus                        | v13 Sections                          |
| ------------------- | ------------------- | ---------------------------- | ------------------------------------- |
| **0-3**       | **10 weeks**  | **COMPLETE**           | Foundation, Shopping Agent, UI basics |
| **4**         | **3 weeks**   | **COMPLETE**           | Memory Intelligence, Content Agent    |
| **5**         | **2 weeks**   | **COMPLETE**           | Resilience + Triggers                 |
| **6**         | **3 weeks**   | **COMPLETE**           | Ikigai Intelligence                   |
| **7**         | **4 weeks**   | **COMPLETE**           | Restaurant, Events, Travel Agents     |
| **8**         | **3 weeks**   | **COMPLETE**           | Financial, Calendar, Diagnostic       |
| **9**         | **2 weeks**   | **COMPLETE**           | Observability                         |
| 10                  | 3 weeks             | Cross-Device Sync            | 5                                     |
| 11                  | 4 weeks             | Consumer UI (Full)           | 4                                     |
| 12                  | 4 weeks             | BBS+ & SDKs                  | 7                                     |
| 13                  | 3 weeks             | Production Readiness         | Phase 4                               |
| **MVP Total** | **~41 weeks** | **Full v13 MVP**       | All sections                          |
| 14                  | 4 weeks             | Private Inference (Post-MVP) | 6.1-6.9                               |

---

## Sprint Dependency Graph

```
Sprint 0-9 (COMPLETE ✅)
    │
    │ Foundation, memory, 6 agents, resilience, triggers, Ikigai, 4 data sources,
    │ observability, debugging UI, GDPR export all working
    │ Tests: 1891 passing
    │
    ▼
Sprint 10 ← NEXT
(Cross-Device Sync)
    │
    ▼
Sprint 11
(Consumer UI Full)
    │
    ▼
Sprint 12
(BBS+ & SDKs)
    │
    ▼
Sprint 13
(Production Readiness)
    │
    ▼
Sprint 14
(Private Inference - Post-MVP)
```

---

## Risk Mitigation

### Technical Risks

| Risk                            | Likelihood | Impact | Mitigation                                   |
| ------------------------------- | ---------- | ------ | -------------------------------------------- |
| Memory architecture too complex | Medium     | High   | Start simple in Sprint 4, iterate            |
| Ikigai inference inaccurate     | Medium     | Medium | Use confidence scores, allow user correction |
| OrbitDB performance issues      | Low        | High   | Test early in Sprint 10, have fallback       |
| BBS+ implementation complexity  | High       | High   | Use existing library, simplify MVP scope     |

### Schedule Risks

| Risk                                    | Mitigation                                              |
| --------------------------------------- | ------------------------------------------------------- |
| Sprint takes longer than estimated      | Each sprint delivers independently; can ship partial    |
| Integration issues between sprints      | Continuous integration testing after each sprint        |
| External dependencies (APIs, libraries) | Mock everything first, integrate real APIs in Sprint 13 |

---

## Success Metrics

### Per-Sprint Metrics

| Metric            | Target                             |
| ----------------- | ---------------------------------- |
| Test coverage     | >80% for new code                  |
| All tests passing | 100% before sprint completion      |
| Documentation     | README + API docs for new packages |
| Performance       | No regression from previous sprint |

### MVP Metrics (After Sprint 13)

| Metric                      | Target                                  |
| --------------------------- | --------------------------------------- |
| Agent execution time        | <30s for L1, <120s for L2, <300s for L3 |
| LLM cost per user           | <$10/month average                      |
| Sync latency                | <5s between devices                     |
| IAB classification accuracy | >80%                                    |
| Mission interaction rate    | >60% of cards get user interaction      |

---

## Learnings & Best Practices

*Captured from Sprint 0-7 code review (December 7, 2025)*

### Namespace Management

**What Worked:**

- Single source of truth in `@ownyou/shared-types/namespaces.ts`
- Factory functions (`NS.iabClassifications(userId)`) prevent hardcoded strings
- Consistent import pattern across all packages

**What Failed:**

- Hardcoded namespace strings (e.g., `'ownyou.reflection'`) bypass type safety
- Local duplicate constants (even with "matches shared-types" comments) drift over time
- Missing factory functions force developers to hardcode

**Best Practice:** Every new namespace needs:

1. Entry in `NAMESPACES` constant
2. Factory function in `NS` object
3. Sync scope and privacy settings documented

### Testing Quality

**Patterns That Work:**

| Pattern                     | Example                                      | Benefit                    |
| --------------------------- | -------------------------------------------- | -------------------------- |
| Real implementation testing | `InMemoryBackend` for store tests          | Catches integration bugs   |
| Mathematical verification   | Budget tracking with exact cost calculations | Proves correctness         |
| State machine testing       | Circuit breaker state transitions            | Covers all paths           |
| Fake timers                 | Cache TTL tests                              | Deterministic timing tests |

**Anti-Patterns to Avoid:**

| Anti-Pattern                  | Problem                        | Fix                                        |
| ----------------------------- | ------------------------------ | ------------------------------------------ |
| `get: vi.fn(() => null)`    | Can't test personalization     | Return realistic data for specific keys    |
| Never verifying `put` calls | Unknown what was stored        | Use `.toHaveBeenCalledWith()` assertions |
| Hollow mock responses         | Tests pass but logic untested  | Vary responses based on input              |
| Implicit mock API testing     | Parameter passing not verified | Assert on mock API call parameters         |

**Test Coverage Targets:**

- Core infrastructure: 90%+ (memory-store, llm-client, triggers)
- Agent business logic: 80%+ (currently ~65%, needs isolated unit tests)
- UI components: 80%+ (currently ~25%, needs expansion)

### Sprint Review Process

**Recommended Review Checklist:**

1. ☐ All packages import namespaces from `@ownyou/shared-types`
2. ☐ No hardcoded namespace strings in source files
3. ☐ All new namespaces have factory functions
4. ☐ Business logic functions have isolated unit tests
5. ☐ Mock store returns realistic data for tested scenarios
6. ☐ Store writes verified with `.toHaveBeenCalledWith()`
7. ☐ Dead code removed (search for unused exports)

### Priority-Based Fix Ordering

When addressing code review findings, use this priority order:

| Priority      | Criteria                                        | Action                 |
| ------------- | ----------------------------------------------- | ---------------------- |
| P1 - Critical | v13 architecture violations, broken type safety | Fix before next sprint |
| P2 - High     | Shallow test verification, missing unit tests   | Fix this sprint        |
| P3 - Medium   | Under-tested components, missing edge cases     | Next sprint backlog    |
| P4 - Low      | Technical debt, anti-patterns                   | Opportunistic fixes    |

### Agent Test Improvement Template

For agents with shallow mock stores, apply this pattern:

```typescript
// BEFORE (anti-pattern)
get: vi.fn(async () => null)

// AFTER (realistic mock)
get: vi.fn(async (ns, key) => {
  if (key === 'profile') return { dietaryPreferences: ['vegan'] };
  if (key === 'history') return [{ venue: 'Thai Place', rating: 4 }];
  return null;
})
```

Add store write verification:

```typescript
expect(mockStore.put).toHaveBeenCalledWith(
  expect.any(Array),
  expect.stringMatching(/^mission_/),
  expect.objectContaining({
    type: 'restaurant',
    primaryAction: expect.objectContaining({ type: 'navigate' }),
  })
);
```

### Agent Architecture Conformance (Sprint 8 Post-Mortem)

**Background:** The Diagnostic Agent was initially built as a standalone class instead of extending `BaseAgent`, requiring a complete rewrite. This section captures learnings to prevent similar architectural violations.

**Root Causes Identified:**

1. No reference to existing implementations before building
2. Treating agent domain as "different" despite uniform architecture requirement
3. Tests validated behavior but not structure
4. Missing structural validation step

**MANDATORY for New Agents:**

Before implementing ANY new agent, read these files FIRST:

```bash
# 1. Read base interface (understand contract)
cat packages/agents/base/src/base-agent.ts

# 2. Read reference implementation (see pattern in practice)
cat packages/agents/restaurant/src/agent.ts
```

**Structural Tests Required:**

Write these tests BEFORE implementing the agent:

```typescript
// These tests catch architectural violations early
describe('Agent Structure', () => {
  it('should extend BaseAgent', () => {
    expect(agent).toBeInstanceOf(BaseAgent);
  });

  it('should have correct agentType', () => {
    expect(agent.agentType).toBe('expected-type');
  });

  it('should have correct level', () => {
    expect(['L1', 'L2', 'L3']).toContain(agent.level);
  });

  it('should return AgentResult with missionCard on success', async () => {
    const result = await agent.run(context);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('missionCard');
  });
});
```

**Agent Conformance Checklist:**

| Requirement         | Pattern                                                              |
| ------------------- | -------------------------------------------------------------------- |
| Extends BaseAgent   | `class XAgent extends BaseAgent`                                   |
| Has agentType       | `readonly agentType = 'x' as const`                                |
| Has level           | `readonly level = 'L2' as const`                                   |
| Implements execute  | `protected async execute(ctx: AgentContext): Promise<AgentResult>` |
| Has permissions     | `export const X_PERMISSIONS: AgentPermissions = { ... }`           |
| Has trigger type    | `export interface XTriggerData { ... }`                            |
| Returns MissionCard | `return { success: true, missionCard }`                            |
| Records tool calls  | Uses `this.recordToolCall()`                                       |
| Records memory ops  | Uses `this.recordMemoryOp()`                                       |
| Supports episodes   | Overrides `describeTrigger()` and `extractTags()`                |

**Key Lesson:** Domain complexity ≠ structural complexity. Complex domain logic (pattern detection, LLM insights) lives INSIDE the `execute()` method, not in a different class structure.

See: `docs/bugfixing/DIAGNOSTIC_AGENT_POST_MORTEM.md` for full analysis.

---

## Document History

| Version | Date       | Changes                                                                             |
| ------- | ---------- | ----------------------------------------------------------------------------------- |
| v1      | 2025-01-04 | Original horizontal layer approach                                                  |
| v2      | 2025-12-03 | Vertical slice approach, v13 coverage matrix                                        |
| v2.1    | 2025-12-04 | Sprint 4 completed - Memory Intelligence + Content Agent                            |
| v2.2    | 2025-12-05 | Sprint 5 completed - Resilience + Trigger System (227 tests)                        |
| v2.3    | 2025-12-05 | Sprint 6 completed - Ikigai Intelligence Layer                                      |
| v2.4    | 2025-12-07 | Sprint 7 completed - Restaurant, Events, Travel Agents (179 tests)                  |
| v2.5    | 2025-12-07 | Added Learnings & Best Practices section from Sprint 0-7 code review                |
| v2.6    | 2025-12-08 | Added Agent Architecture Conformance section from Sprint 8 post-mortem              |
| v2.7    | 2025-12-08 | Sprint 8 completed - Data Sources + Diagnostic Agent (307 tests)                    |
| v2.8    | 2025-12-08 | Sprint 9 completed - Observability & Debugging (229 tests, v13 Section 10 complete) |

---

**Document Status:** Strategic Roadmap v2.8 - ACTIVE
**Date:** 2025-12-08
**Validates Against:** OwnYou_architecture_v13.md
**Next Sprint:** Sprint 10 (Cross-Device Sync)
