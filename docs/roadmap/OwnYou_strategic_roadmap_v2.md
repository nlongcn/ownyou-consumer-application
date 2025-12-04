# OwnYou Consumer Application - Strategic Development Roadmap v2

**Goal:** Build complete consumer application using vertical slice approach with minimal rework

**Strategy:** Vertical slices - build complete end-to-end features incrementally, each sprint delivers working functionality

**Date:** 2025-12-03

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
Sprint 0-3: Shopping Slice  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (foundation→agent→UI)
Sprint 4-5: Memory + Content ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (learning→2nd agent)
Sprint 6-7: Ikigai + Travel  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░ (well-being→L3 agent)
Sprint 8-9: Data Sources     ████████░░░░░░░░░░░░░░░░░░░░░░░░ (financial→calendar)
...continues...
```

### Why Vertical Slices for Solo/Small Team

| Aspect | Horizontal Layers | Vertical Slices |
|--------|------------------|-----------------|
| **First working feature** | After Phase 5 (~20 weeks) | After Sprint 3 (~6 weeks) |
| **Validation** | Late (integration issues discovered late) | Early (full stack tested each sprint) |
| **Parallel work** | Requires multiple teams | Works for solo developer |
| **Rework risk** | High (contracts may need changes) | Low (contracts evolve with usage) |
| **Motivation** | Long wait for tangible results | Regular wins, visible progress |

---

## V13 Architecture Coverage Matrix

This section maps every v13 architecture requirement to a sprint, ensuring nothing is missed.

### Section 2: Ikigai Intelligence Layer

| V13 Requirement | Sprint | Status |
|-----------------|--------|--------|
| 2.1 Signal-Based Inference Architecture | Sprint 6 | 🔲 Planned |
| 2.2 Ikigai Dimensions (Experiences, Relationships, Interests, Giving) | Sprint 6 | 🔲 Planned |
| 2.3 Store Schema: ikigai namespace | Sprint 6 | 🔲 Planned |
| 2.4 LLM-Based Ikigai Inference (4 parallel prompts + synthesis) | Sprint 6 | 🔲 Planned |
| 2.5 Batch Processing Configuration | Sprint 6 | 🔲 Planned |
| 2.6 Mission Prioritization (well-being value scoring) | Sprint 6 | 🔲 Planned |
| 2.7 Ikigai Points & Rewards | Sprint 6 | 🔲 Planned |
| 2.8 Mission Card Ikigai Feedback (heart states) | Sprint 3 | ✅ Complete |
| 2.9 Ikigai-Memory Integration | Sprint 6 | 🔲 Planned |

### Section 3: Mission Agent System

| V13 Requirement | Sprint | Status |
|-----------------|--------|--------|
| 3.1 Four-Mode Trigger System | Sprint 5 | 🔲 Planned |
| 3.2 Trigger Architecture | Sprint 5 | 🔲 Planned |
| 3.3 Mission State Machine | Sprint 3 | ✅ Complete |
| 3.4 Mission Card Structure | Sprint 3 | ✅ Complete |
| 3.5 Agent Coordinator | Sprint 5 | 🔲 Planned |
| 3.6.1 Shopping Agent (L1-2) | Sprint 3 | ✅ Complete |
| 3.6.1 Content Agent (L1) | Sprint 4 | 🔲 Planned |
| 3.6.1 Restaurant Agent (L2) | Sprint 7 | 🔲 Planned |
| 3.6.1 Events Agent (L2) | Sprint 7 | 🔲 Planned |
| 3.6.1 Travel Agent (L3) | Sprint 7 | 🔲 Planned |
| 3.6.1 Diagnostic Agent (L2) | Sprint 8 | 🔲 Planned |
| 3.6.2 Namespace Access Control | Sprint 3 | ✅ Complete |
| 3.6.3 Agent Complexity Levels (L1/L2/L3) | Sprint 3 | ✅ Complete |
| 3.6.4 Tool Call Limits | Sprint 3 | ✅ Complete |
| 3.6.5 Privacy-Tier Enforcement | Sprint 4 | 🔲 Planned |

### Section 4: Consumer UI

| V13 Requirement | Sprint | Status |
|-----------------|--------|--------|
| 4.1-4.2 Design System & Figma Specs | Sprint 11 | 🔲 Planned |
| 4.3 Component Library | Sprint 3 (partial), Sprint 11 | 🟡 Partial |
| 4.4 MissionCard Components | Sprint 3 | ✅ Complete |
| 4.5 MissionFeed Layout | Sprint 3 | ✅ Complete |
| 4.6 Navigation Components | Sprint 11 | 🔲 Planned |
| 4.7 Feed Layout (Masonry) | Sprint 11 | 🔲 Planned |
| 4.8 Platform Adaptations (PWA/Desktop) | Sprint 11 | 🔲 Planned |
| 4.9 Asset Management | Sprint 11 | 🔲 Planned |

### Section 5: Data Source Sync

| V13 Requirement | Sprint | Status |
|-----------------|--------|--------|
| 5.1 Platform Tier Architecture | Sprint 1 | ✅ Complete |
| 5.2 OrbitDB v3 + Helia | Sprint 10 | 🔲 Planned |
| 5.2.1 Offline Handling | Sprint 10 | 🔲 Planned |
| 5.2.2 CRDT Conflict Resolution | Sprint 10 | 🔲 Planned |
| 5.2.3 Device Discovery | Sprint 10 | 🔲 Planned |
| 5.2.4 Encryption Policy | Sprint 10 | 🔲 Planned |
| 5.3 Key Recovery | Sprint 10 | 🔲 Planned |
| 5.4 E2EE Cloud Backup | Sprint 10 | 🔲 Planned |
| 5.5 Data Sanitization Pipeline | Sprint 2 | ✅ Complete |

### Section 6: Decentralization & LLM Management

| V13 Requirement | Sprint | Status |
|-----------------|--------|--------|
| 6.1-6.5 Private Inference Strategy | Sprint 14 | 🔲 Planned (Post-MVP) |
| 6.10 LLM Cost Management | Sprint 2 | ✅ Complete |
| 6.10.1 Budget Policy Interface | Sprint 2 | ✅ Complete |
| 6.10.2 Cost Tracking | Sprint 2 | ✅ Complete |
| 6.10.3 Model Tier Definitions | Sprint 2 | ✅ Complete |
| 6.10.4 Budget Enforcement Flow | Sprint 2 | ✅ Complete |
| 6.11 Error Handling & Resilience | Sprint 5 | 🔲 Planned |
| 6.11.1 Resilience Policy Interface | Sprint 5 | 🔲 Planned |
| 6.11.2 Circuit Breaker Implementation | Sprint 5 | 🔲 Planned |
| 6.11.3 LLM Fallback Chain | Sprint 5 | 🔲 Planned |
| 6.11.4 Partial Data Handling | Sprint 5 | 🔲 Planned |
| 6.11.5 Error Recovery UI States | Sprint 5 | 🔲 Planned |

### Section 7: Publisher/Advertiser SDK & BBS+

| V13 Requirement | Sprint | Status |
|-----------------|--------|--------|
| 7.1 End-to-End Attribution Flow | Sprint 12 | 🔲 Planned |
| 7.2 BBS+ Pseudonym Mechanics | Sprint 12 | 🔲 Planned |
| 7.3 Publisher SDK | Sprint 12 | 🔲 Planned |
| 7.4 Advertiser SDK | Sprint 12 | 🔲 Planned |
| 7.5 Revenue Distribution | Sprint 12 | 🔲 Planned |
| 7.6 Demo Environment | Sprint 12 | 🔲 Planned |

### Section 8: Memory Architecture

| V13 Requirement | Sprint | Status |
|-----------------|--------|--------|
| 8.1-8.2 Memory Types (Semantic, Episodic, Procedural, Relational) | Sprint 0 (partial), Sprint 4 | 🟡 Partial |
| 8.3 Agent-Driven Memory | Sprint 4 | 🔲 Planned |
| 8.4 Memory Schema | Sprint 4 | 🔲 Planned |
| 8.5 Vector Embeddings (Local) | Sprint 4 | 🔲 Planned |
| 8.6 Bi-Temporal Modeling | Sprint 4 | 🔲 Planned |
| 8.7 Memory Retrieval (Hybrid: Semantic + BM25 + RRF) | Sprint 4 | 🔲 Planned |
| 8.8 Memory Tools for Agents | Sprint 4 | 🔲 Planned |
| 8.9 Memory Lifecycle (Consolidation, Decay, Pruning) | Sprint 4 | 🔲 Planned |
| 8.10 Reflection Node | Sprint 4 | 🔲 Planned |
| 8.11 Privacy Tiers | Sprint 4 | 🔲 Planned |
| 8.12 Namespace Schema | Sprint 0 | ✅ Complete |
| 8.13 Storage Backends | Sprint 0 | ✅ Complete |
| 8.14 Memory-Sync Integration | Sprint 10 | 🔲 Planned |
| 8.15 Memory Size Limits | Sprint 4 | 🔲 Planned |

### Section 10: Observability & Debugging

| V13 Requirement | Sprint | Status |
|-----------------|--------|--------|
| 10.1 Observability Architecture | Sprint 9 | 🔲 Planned |
| 10.2 Agent Execution Tracing | Sprint 9 | 🔲 Planned |
| 10.3 Sync Debugging | Sprint 10 | 🔲 Planned |
| 10.4 LLM Cost Metering Dashboard | Sprint 9 | 🔲 Planned |
| 10.5 Debug UI Components | Sprint 9 | 🔲 Planned |
| 10.6 User Data Export (GDPR) | Sprint 9 | 🔲 Planned |

---

## Completed Sprints (Phase 0-3)

### Sprint 0: Foundation ✅
**Duration:** 2 weeks | **Tests:** 241 passing

| Package | Purpose | v13 Section |
|---------|---------|-------------|
| `@ownyou/shared-types` | Type definitions, namespace schema | 8.12 |
| `@ownyou/store` | LangGraph Store abstraction (IndexedDB/SQLite) | 8.13 |
| `@ownyou/config` | Configuration management | - |
| `@ownyou/utils` | Shared utilities | - |

### Sprint 1a: Desktop Infrastructure ✅
**Duration:** 2 weeks

| Deliverable | Purpose | v13 Section |
|-------------|---------|-------------|
| Tauri 2.0 scaffolding | Desktop application shell | 5.1 |
| Custom protocol handler (`ownyou://`) | OAuth callback handling | 5.1 |
| Native window management | Desktop UX | 4.8 |

### Sprint 1b: OAuth + Email + IAB ✅
**Duration:** 3 weeks

| Package | Purpose | v13 Section |
|---------|---------|-------------|
| `@ownyou/oauth` | 90-day OAuth token management | 5.1 |
| `@ownyou/data-email` | Email fetching (Gmail/Outlook) | Phase 0 |
| `@ownyou/iab-classifier` | TypeScript IAB classification | Phase 0 |

### Sprint 2: LLM Client Consolidation ✅
**Duration:** 2 weeks

| Package | Purpose | v13 Section |
|---------|---------|-------------|
| `@ownyou/llm-client` | 7-provider LLM abstraction | 6.10 |
| Cost tracking | Per-user budget management | 6.10.2 |
| Model tier routing | fast/standard/quality/local | 6.10.3 |
| Budget enforcement | Throttling at 50%/80%/95%/100% | 6.10.4 |

### Sprint 3: Shopping Agent + Mission UI ✅
**Duration:** 3 weeks | **Tests:** 152 passing

| Package | Purpose | v13 Section |
|---------|---------|-------------|
| `@ownyou/agents-base` (62 tests) | BaseAgent, LimitsEnforcer, PrivacyGuard | 3.6.3, 3.6.4 |
| `@ownyou/agents-shopping` (29 tests) | Hybrid LLM + rule-based shopping agent | 3.6.1 |
| `@ownyou/scheduler` (25 tests) | Background task scheduling | 3.2 |
| `@ownyou/ui-components` (14 tests) | MissionCard, MissionFeed, FeedbackButtons | 4.4, 4.5 |
| Integration tests (10 tests) | Full agent loop validation | - |
| Admin Dashboard (12 tests) | Missions page with feedback | 4 |

---

## Remaining Sprints (Phase 4+)

### Sprint 4: Memory Intelligence + Content Agent 🔲
**Duration:** 3 weeks | **v13 Coverage:** Section 8 (Memory), Section 3.6.1 (Content Agent)

**Goal:** Make the system learn from feedback and prove agent framework scales

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Memory Infrastructure | Memory tools (save_observation, save_episode, search_memories), Vector embeddings (nomic-embed-text-v1.5), Memory consolidation |
| Week 2 | Reflection Node | Procedural synthesis, Memory decay (5%/week), Pruning (threshold 0.1), Reflection triggers |
| Week 3 | Content Agent + Integration | Content Agent (L1), Procedural injection into agents, End-to-end learning test |

**New Packages:**
- `@ownyou/reflection` — Background reflection node
- `@ownyou/agents-content` — L1 content recommendation agent

**Success Criteria:**
- [ ] Memory tools callable by agents
- [ ] Reflection Node runs on triggers (5 episodes, daily, negative feedback)
- [ ] Procedural rules synthesized from episode patterns
- [ ] Shopping Agent demonstrates learning from feedback
- [ ] Content Agent generates recommendation cards
- [ ] All tests passing

---

### Sprint 5: Resilience + Trigger System 🔲
**Duration:** 2 weeks | **v13 Coverage:** Section 6.11 (Error Handling), Section 3.1-3.2 (Triggers), Section 3.5 (Coordinator)

**Goal:** Production-grade error handling and complete trigger architecture

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Error Handling | Circuit breakers, LLM fallback chain, Partial data handling, Error recovery UI states |
| Week 2 | Trigger System | 4-mode triggers (Data/Schedule/Event/User), Agent Coordinator, Trigger routing |

**New Packages:**
- `@ownyou/resilience` — Circuit breakers, fallback chains
- `@ownyou/triggers` — Trigger engine implementation

**Success Criteria:**
- [ ] Circuit breakers protect all external APIs
- [ ] LLM requests have full fallback chain
- [ ] All 4 trigger modes working
- [ ] Agent Coordinator routes requests correctly
- [ ] Graceful degradation on failures

---

### Sprint 6: Ikigai Intelligence Layer 🔲
**Duration:** 3 weeks | **v13 Coverage:** Section 2 (Complete Ikigai)

**Goal:** Implement well-being-based mission prioritization

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Ikigai Inference | 4 parallel dimension prompts (Experiences, Relationships, Interests, Giving) |
| Week 2 | Synthesis + Storage | Ikigai synthesis prompt, Profile storage, Evidence chains |
| Week 3 | Mission Integration | Well-being scoring, Mission prioritization, Ikigai points/rewards |

**New Packages:**
- `@ownyou/ikigai` — Ikigai inference engine

**Success Criteria:**
- [ ] Ikigai profile generated from user data
- [ ] 4 dimensions scored independently
- [ ] Missions prioritized by well-being value
- [ ] Ikigai points awarded with multipliers
- [ ] Ikigai-Memory integration working

---

### Sprint 7: Additional Agents (Restaurant, Events, Travel) 🔲
**Duration:** 4 weeks | **v13 Coverage:** Section 3.6.1 (Remaining agents)

**Goal:** Complete MVP agent roster with varying complexity levels

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Restaurant Agent (L2) | Search, reservation (mock), dietary checks |
| Week 2 | Events Agent (L2) | Event search, calendar integration (mock) |
| Week 3-4 | Travel Agent (L3) | Multi-step planning, flights + hotels (mock) |

**New Packages:**
- `@ownyou/agents-restaurant` — L2 dining agent
- `@ownyou/agents-events` — L2 events agent
- `@ownyou/agents-travel` — L3 travel planning agent

**Success Criteria:**
- [ ] Restaurant Agent respects L2 limits (10 tools, 5 LLM, 120s)
- [ ] Events Agent integrates with mock calendar
- [ ] Travel Agent handles multi-step workflows (L3)
- [ ] All agents use memory system
- [ ] All agents learn from feedback

---

### Sprint 8: Data Sources (Financial, Calendar, Diagnostic) 🔲
**Duration:** 3 weeks | **v13 Coverage:** Section 3.6.1 (Diagnostic), Phase 2 Track A

**Goal:** Expand data sources and add diagnostic agent

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Financial Data | Plaid integration (mock), Transaction IAB classification |
| Week 2 | Calendar Data | Google/Microsoft Calendar, Calendar IAB classification |
| Week 3 | Diagnostic Agent | Profile analysis, Pattern finding, Connection suggestions |

**New Packages:**
- `@ownyou/data-financial` — Financial data connector
- `@ownyou/data-calendar` — Calendar data connector
- `@ownyou/agents-diagnostic` — L2 diagnostic agent

**Success Criteria:**
- [ ] Financial transactions classified by IAB
- [ ] Calendar events classified by IAB
- [ ] Diagnostic Agent analyzes complete profile
- [ ] Data sources feed Ikigai inference
- [ ] 4 data sources working (email, financial, calendar, browser)

---

### Sprint 9: Observability & Debugging 🔲
**Duration:** 2 weeks | **v13 Coverage:** Section 10 (Complete)

**Goal:** Production-ready debugging and GDPR compliance

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Tracing & Logging | Agent execution traces, Sync logs, LLM metrics |
| Week 2 | Debug UI & Export | Agent Inspector UI, Sync Monitor UI, Cost Dashboard, GDPR data export |

**New Packages:**
- `@ownyou/observability` — Tracing and metrics
- `@ownyou/debug-ui` — Debug panel components

**Success Criteria:**
- [ ] Agent traces captured with full detail
- [ ] LLM costs visible in dashboard
- [ ] Debug UI accessible from Settings
- [ ] GDPR-compliant data export working
- [ ] All traces stored locally (privacy preserved)

---

### Sprint 10: Cross-Device Sync 🔲
**Duration:** 3 weeks | **v13 Coverage:** Section 5 (Complete)

**Goal:** Implement OrbitDB sync with encryption

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | OrbitDB Integration | OrbitDB v3 + Helia setup, CRDT conflict resolution |
| Week 2 | Encryption & Discovery | E2EE encryption, Device discovery (Privy wallet) |
| Week 3 | Backup & Recovery | E2EE cloud backup, Key recovery flow, Memory-sync integration |

**Dependencies:**
- `@orbitdb/core` (v3)
- `helia` (IPFS)

**Success Criteria:**
- [ ] Data syncs between devices
- [ ] Conflicts resolved automatically (CRDT)
- [ ] All sync data encrypted
- [ ] E2EE backup working
- [ ] Key recovery tested

---

### Sprint 11: Consumer UI (Full Implementation) 🔲
**Duration:** 4 weeks | **v13 Coverage:** Section 4 (Complete)

**Goal:** Production-ready consumer interface from Figma designs

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Shell & Navigation | Header, Bottom nav (mobile), Sidebar (desktop), Filter tabs |
| Week 2 | All Card Variants | 11 card types from Figma (savings, utility, travel, etc.) |
| Week 3 | Profile & Settings | Ikigai wheel, IAB visualization, Privacy controls |
| Week 4 | Polish & Platform Adaptations | PWA optimization, Desktop breakpoints, Keyboard shortcuts |

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

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | BBS+ Pseudonyms | Pseudonym generation, Tracking ID derivation |
| Week 2 | Publisher SDK | SSO flow, Prebid.js adapter, Consent UI |
| Week 3 | Advertiser SDK | Campaign management, Escrow, Conversion tracking |
| Week 4 | Demo Environment | Demo publisher site, Mock advertiser dashboard |

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

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Real API Integrations | SerpAPI, Tripadvisor, Ticketmaster, Plaid (production) |
| Week 2 | PostgreSQL Migration | Store backend migration, pgvector for embeddings |
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

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1-2 | Phala TEE Integration | TEE-based IAB classification, Attestation verification |
| Week 3-4 | Nillion Evaluation | Blind compute for sensitive data (if available) |

**Success Criteria:**
- [ ] Sensitive inference runs in TEE
- [ ] Attestation proofs validated
- [ ] Privacy guarantees documented

---

## Timeline Summary

| Sprint | Duration | Focus | v13 Sections |
|--------|----------|-------|--------------|
| **0-3** | **10 weeks** | **COMPLETE** | Foundation, Shopping Agent, UI basics |
| 4 | 3 weeks | Memory + Content Agent | 8 |
| 5 | 2 weeks | Resilience + Triggers | 6.11, 3.1-3.5 |
| 6 | 3 weeks | Ikigai Intelligence | 2 |
| 7 | 4 weeks | Restaurant, Events, Travel Agents | 3.6.1 |
| 8 | 3 weeks | Financial, Calendar, Diagnostic | Data sources |
| 9 | 2 weeks | Observability | 10 |
| 10 | 3 weeks | Cross-Device Sync | 5 |
| 11 | 4 weeks | Consumer UI (Full) | 4 |
| 12 | 4 weeks | BBS+ & SDKs | 7 |
| 13 | 3 weeks | Production Readiness | Phase 4 |
| **MVP Total** | **~41 weeks** | **Full v13 MVP** | All sections |
| 14 | 4 weeks | Private Inference (Post-MVP) | 6.1-6.9 |

---

## Sprint Dependency Graph

```
Sprint 0-3 (COMPLETE)
    │
    ├─────────────────────────────────┐
    │                                 │
    ▼                                 ▼
Sprint 4                          Sprint 5
(Memory + Content)                (Resilience + Triggers)
    │                                 │
    └──────────┬──────────────────────┘
               │
               ▼
           Sprint 6
       (Ikigai Intelligence)
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
Sprint 7              Sprint 8
(3 More Agents)       (Data Sources + Diagnostic)
    │                     │
    └──────────┬──────────┘
               │
    ┌──────────┴──────────────────────┐
    │                                 │
    ▼                                 ▼
Sprint 9                          Sprint 10
(Observability)                   (Sync)
    │                                 │
    └──────────┬──────────────────────┘
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

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Memory architecture too complex | Medium | High | Start simple in Sprint 4, iterate |
| Ikigai inference inaccurate | Medium | Medium | Use confidence scores, allow user correction |
| OrbitDB performance issues | Low | High | Test early in Sprint 10, have fallback |
| BBS+ implementation complexity | High | High | Use existing library, simplify MVP scope |

### Schedule Risks

| Risk | Mitigation |
|------|------------|
| Sprint takes longer than estimated | Each sprint delivers independently; can ship partial |
| Integration issues between sprints | Continuous integration testing after each sprint |
| External dependencies (APIs, libraries) | Mock everything first, integrate real APIs in Sprint 13 |

---

## Success Metrics

### Per-Sprint Metrics

| Metric | Target |
|--------|--------|
| Test coverage | >80% for new code |
| All tests passing | 100% before sprint completion |
| Documentation | README + API docs for new packages |
| Performance | No regression from previous sprint |

### MVP Metrics (After Sprint 13)

| Metric | Target |
|--------|--------|
| Agent execution time | <30s for L1, <120s for L2, <300s for L3 |
| LLM cost per user | <$10/month average |
| Sync latency | <5s between devices |
| IAB classification accuracy | >80% |
| Mission interaction rate | >60% of cards get user interaction |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2025-01-04 | Original horizontal layer approach |
| v2 | 2025-12-03 | Vertical slice approach, v13 coverage matrix |

---

**Document Status:** Strategic Roadmap v2 - DRAFT
**Date:** 2025-12-03
**Validates Against:** OwnYou_architecture_v13.md
