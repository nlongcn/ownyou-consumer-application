# Admin Dashboard to Consumer UI - Learnings Document

**Phase:** 1.5 (Admin Dashboard Migration)
**Purpose:** Document learnings from admin dashboard migration to inform Phase 5 consumer UI design
**Date Started:** 2025-01-10
**Status:** 🔄 In Progress

---

## Executive Summary

This document captures learnings from migrating the Flask admin dashboard to a TypeScript browser-based PWA (Phase 1.5). These learnings will directly inform the design and implementation of the consumer-facing UI in Phase 5.

**Key Insight:** The admin dashboard serves as a **proving ground** for the self-sovereign browser architecture, validating technical approaches before building the consumer UI.

---

## 1. Architecture Learnings

### 1.1 What Worked Well

_Document successful patterns and approaches here as they're validated_

**IndexedDB Performance:**
- [ ] Benchmark: Write performance for X classifications
- [ ] Benchmark: Read performance for profile queries
- [ ] Benchmark: Complex queries (multi-namespace joins)
- [x] **LEARNING (2025-01-10):** IndexedDBStore.search() works efficiently with limit=10000 for profile queries
- Notes: search() method returns all items matching namespace prefix. Performance TBD with real data.

**Client-Side Data Access (PWA Pattern):**
- [x] **LEARNING (2025-01-10):** Direct IndexedDB access from React components is superior to API routes
- [x] Pattern: React hooks (useProfileSummary, useClassifications) provide clean abstraction
- [x] No server-side API needed - maintains self-sovereign architecture
- [x] StoreClient wrapper provides high-level interface over IndexedDBStore
- Notes: This pattern should be reused in consumer UI (Phase 5)

**Next.js App Router:**
- [x] **LEARNING (2025-01-10):** 'use client' directive required for browser-only code (IndexedDB)
- [x] Server Components for page structure, Client Components for IndexedDB access
- [x] Tailwind CSS integrates seamlessly with Next.js 14
- Notes: Clear separation between server rendering and client data access

### 1.2 What Didn't Work Well

_Document problems, limitations, and anti-patterns here_

**Server-Side API Routes with IndexedDB:**
- [x] **ISSUE (2025-01-10):** Next.js API routes run on server (Node.js), but IndexedDB only exists in browser
- [x] Attempted: Edge Runtime API route at app/api/profile/summary/route.ts
- [x] Problem: IndexedDB not available in Edge Runtime or Node.js runtime
- [x] Workaround: Deleted API routes, switched to direct client-side access via React hooks
- [x] Recommendation for Phase 5: **Never use API routes for IndexedDB queries** - use client-side hooks only

**IndexedDB Namespace Format:**
- [x] **ISSUE (2025-01-10):** Initial StoreClient used string namespace, but IndexedDBStore requires array
- [x] Problem: namespace format mismatch (string vs array)
- [x] Workaround: Updated StoreClient to use array format: `[userId, 'iab_taxonomy_profile']`
- [x] Recommendation for Phase 5: **Always use array-based namespaces** to match BaseStore interface

### 1.3 Recommendations for Consumer UI (Phase 5)

_High-level architectural recommendations based on admin dashboard experience_

**Storage Strategy:**
- [ ] Recommendation: _To be filled_
- [ ] Rationale: _Based on benchmarks from admin dashboard_

**OAuth Strategy:**
- [ ] Recommendation: _To be filled_
- [ ] Alternative approaches: _For browsers without extension support_

**Component Architecture:**
- [ ] Recommendation: _To be filled_
- [ ] Patterns to reuse: _From admin dashboard_

---

## 2. Browser Extension OAuth Learnings

### 2.1 Implementation Approach

**What We Built:**
- [ ] Extension manifest configuration
- [ ] OAuth flow implementation (Gmail)
- [ ] OAuth flow implementation (Outlook)
- [ ] Token storage strategy
- [ ] PWA ↔ Extension communication protocol

**Code Location:** `src/browser-extension/`

### 2.2 Pros and Cons

**Advantages:**
- ✅ _To be documented during implementation_

**Disadvantages:**
- ❌ _To be documented during implementation_

### 2.3 User Experience Insights

**Installation Flow:**
- [ ] User friction points: _Document during testing_
- [ ] Success rate: _Track during testing_
- [ ] Common errors: _Document during debugging_

### 2.4 Recommendations for Consumer UI

**What to Keep:**
- [ ] _Patterns that worked well_

**What to Change:**
- [ ] _Improvements for consumer UX_

**Alternative Approaches:**
- [ ] Fallback for Safari (no chrome.identity): _Document solution_
- [ ] Fallback for users who refuse extension: _Document solution_

---

## 3. IndexedDB Performance Learnings

### 3.1 Benchmarks

_All benchmarks to be filled during implementation and testing_

**Write Performance:**
| Operation | Records | Time | Notes |
|-----------|---------|------|-------|
| Insert classifications | _TBD_ | _TBD_ | _TBD_ |
| Update classifications | _TBD_ | _TBD_ | _TBD_ |
| Batch insert | _TBD_ | _TBD_ | _TBD_ |

**Read Performance:**
| Operation | Records | Time | Notes |
|-----------|---------|------|-------|
| Get profile (all classifications) | _TBD_ | _TBD_ | _TBD_ |
| Search by taxonomy_id | _TBD_ | _TBD_ | _TBD_ |
| Filter by confidence | _TBD_ | _TBD_ | _TBD_ |

**Complex Queries:**
| Operation | Complexity | Time | Notes |
|-----------|------------|------|-------|
| Multi-namespace join | _TBD_ | _TBD_ | _TBD_ |
| Full-text search | _TBD_ | _TBD_ | _TBD_ |

### 3.2 Optimization Strategies

**What Worked:**
- [ ] Strategy: _Document successful optimizations_
- [ ] Impact: _Measure improvement_

**What Didn't Work:**
- [ ] Strategy: _Document failed optimizations_
- [ ] Reason: _Why it failed_

### 3.3 Index Design

**Indexes Created:**
- [ ] Index: _Document index structure_
- [ ] Purpose: _Why this index_
- [ ] Impact: _Performance improvement_

### 3.4 Recommendations for Consumer UI

**Index Strategy:**
- [ ] Recommendation: _Optimal index design for consumer queries_

**Query Patterns:**
- [ ] Pattern: _Efficient query approaches_
- [ ] Anti-pattern: _Queries to avoid_

**Caching Strategy:**
- [ ] Recommendation: _When to use in-memory cache vs IndexedDB_

---

## 4. React Component Patterns

### 4.1 Reusable Components

_Document React components that can be adapted for consumer UI_

**Classification Cards:**
- **Admin Version:** `src/admin-dashboard/components/ClassificationCard.tsx`
- **Consumer Adaptation:** _How to simplify for consumer UI_
- **Reusable Parts:** _Which sub-components can be shared_

**Evidence Viewer:**
- **Admin Version:** `src/admin-dashboard/components/EvidenceViewer.tsx`
- **Consumer Adaptation:** _Simplified "drill-down" pattern_
- **Reusable Parts:** _Evidence rendering logic_

**Analysis Runner:**
- **Admin Version:** `src/admin-dashboard/components/AnalysisRunner.tsx`
- **Consumer Adaptation:** _Simplified onboarding wizard_
- **Reusable Parts:** _Progress tracking UI_

### 4.2 Component Architecture Decisions

**State Management:**
- [ ] Approach used in admin dashboard: _Document_
- [ ] What worked well: _Document_
- [ ] Recommendation for consumer UI: _Document_

**Loading States:**
- [ ] Pattern: _Document successful patterns_
- [ ] Anti-pattern: _Document what to avoid_

**Error Boundaries:**
- [ ] Implementation: _Document approach_
- [ ] Recommendation: _Improvements for consumer UI_

### 4.3 Recommendations for Consumer UI

**Component Reuse:**
- [ ] Components to reuse directly: _List_
- [ ] Components to adapt: _List with adaptation notes_
- [ ] Components to rebuild: _List with reasoning_

---

## 5. TypeScript IAB Classifier Integration

### 5.1 Integration Approach

**What We Built:**
- **Direct Integration:** TypeScript IAB classifier called directly from admin dashboard
- **Location:** `src/admin-dashboard/lib/classifier-api.ts`
- **Pattern:** _Document integration pattern_

### 5.2 Benefits of Direct Integration

**Advantages:**
- ✅ _Document benefits observed_

**Performance:**
- [ ] Benchmark: Classification time for X emails
- [ ] Comparison: vs REST API overhead (if measured)

### 5.3 Challenges Encountered

**Issues:**
- [ ] Issue: _Document problems_
- [ ] Solution: _Document how solved_

### 5.4 Recommendations for Consumer UI

**Integration Pattern:**
- [ ] Recommendation: _Same direct integration or different approach?_
- [ ] Rationale: _Based on admin dashboard experience_

**Web Worker Strategy:**
- [ ] Recommendation: _Should classification run in Web Worker?_
- [ ] Trade-offs: _Performance vs complexity_

---

## 6. Real-Time UI Patterns

### 6.1 Analysis Progress Tracking

**Implementation:**
- [ ] Pattern: _How real-time progress was implemented_
- [ ] Technology: _Polling, WebSockets, Server-Sent Events?_
- [ ] Update frequency: _How often UI updates_

**User Experience:**
- [ ] Feedback: _Was it responsive enough?_
- [ ] Issues: _Any UI lag or performance problems?_

### 6.2 Recommendations for Consumer UI

**Real-Time Updates:**
- [ ] Approach: _Recommended technology for consumer UI_
- [ ] Rationale: _Based on admin dashboard testing_

**Progress Indicators:**
- [ ] Pattern: _UI pattern that worked best_
- [ ] Example: _Code reference from admin dashboard_

---

## 7. UX Learnings for Consumer UI

### 7.1 Admin Dashboard UX (Power Users)

**Characteristics:**
- **Data Density:** Tables, metrics, raw data
- **Operations:** Batch operations (100 emails at once)
- **Control:** Full control (all models, all parameters)
- **Form Factor:** Desktop-focused, mouse-driven

**What Worked:**
- [ ] Feature: _Successful UX patterns_

**What Didn't Work:**
- [ ] Feature: _UX issues to fix_

### 7.2 Consumer UI Recommendations (Non-Technical Users)

**Simplifications Needed:**
- [ ] Data presentation: _Cards instead of tables_
- [ ] Operations: _Incremental instead of batch_
- [ ] Control: _Smart defaults, hide complexity_
- [ ] Form factor: _Mobile-first, touch-friendly_

**Delightful Interactions:**
- [ ] Recommendation: _Animations, micro-feedback_
- [ ] Examples: _Specific interactions to implement_

---

## 8. Performance Learnings

### 8.1 Load Time

**Admin Dashboard:**
- [ ] Initial load: _Measure time_
- [ ] Subsequent loads: _With IndexedDB cache_

**Bottlenecks:**
- [ ] Bottleneck: _Identify slow operations_
- [ ] Solution: _Optimization applied_

### 8.2 Runtime Performance

**Heavy Operations:**
- [ ] Operation: _IAB classification of X emails_
- [ ] Time: _Measure_
- [ ] User experience: _Was it acceptable?_

### 8.3 Recommendations for Consumer UI

**Optimization Priorities:**
1. [ ] _Most important optimization based on admin dashboard_
2. [ ] _Second priority_
3. [ ] _Third priority_

**Performance Targets:**
- [ ] Target: _Based on admin dashboard measurements_

---

## 9. Security Learnings

### 9.1 Token Storage

**Admin Dashboard Approach:**
- [ ] Storage location: _Where OAuth tokens stored_
- [ ] Encryption: _How tokens protected_
- [ ] Access control: _Who can access tokens_

**Security Review:**
- [ ] Audit result: _Any vulnerabilities found?_
- [ ] Fixes applied: _Document security improvements_

### 9.2 Recommendations for Consumer UI

**Token Security:**
- [ ] Recommendation: _Best practices for consumer UI_
- [ ] Rationale: _Based on admin dashboard audit_

---

## 10. Browser Compatibility

### 10.1 Testing Results

**Browsers Tested:**
- [ ] Chrome: _Version, issues found_
- [ ] Firefox: _Version, issues found_
- [ ] Safari: _Version, issues found (extension won't work)_
- [ ] Edge: _Version, issues found_

**Issues Found:**
- [ ] Issue: _Document browser-specific problems_
- [ ] Workaround: _How solved_

### 10.2 Recommendations for Consumer UI

**Browser Support:**
- [ ] Primary: _Which browsers to support fully_
- [ ] Secondary: _Which browsers to support with limitations_
- [ ] Unsupported: _Which browsers to exclude_

**Fallback Strategies:**
- [ ] Safari workaround: _Since no extension support_
- [ ] Other browsers: _Alternative approaches_

---

## 11. Testing Insights

### 11.1 Testing Approach

**What We Tested:**
- [ ] Unit tests: _Coverage, patterns_
- [ ] Integration tests: _Full workflows tested_
- [ ] E2E tests: _Playwright tests implemented_

**What Worked Well:**
- [ ] Testing strategy: _Successful patterns_

**What Didn't Work:**
- [ ] Testing challenge: _Issues encountered_

### 11.2 Recommendations for Consumer UI

**Testing Strategy:**
- [ ] Recommendation: _Based on admin dashboard testing experience_
- [ ] Tools: _Testing tools that worked well_

---

## 12. Development Workflow Learnings

### 12.1 Migration Process

**What Worked:**
- [ ] Process: _Successful migration patterns_
- [ ] Tools: _Helpful tools/scripts_

**What Was Challenging:**
- [ ] Challenge: _Difficult aspects of migration_
- [ ] Lesson: _How to handle it better in Phase 5_

### 12.2 Recommendations for Consumer UI Development

**Development Approach:**
- [ ] Recommendation: _Best practices for Phase 5_
- [ ] Rationale: _Based on Phase 1.5 experience_

---

## 13. Summary of Key Recommendations

### High-Priority Recommendations for Phase 5

1. **Architecture:** _Top architectural recommendation_
2. **OAuth:** _OAuth strategy recommendation_
3. **Storage:** _IndexedDB optimization recommendation_
4. **UX:** _Key UX simplification_
5. **Performance:** _Critical performance optimization_

### Patterns to Reuse Directly

- [ ] Pattern: _Specific code/patterns to reuse_
- [ ] Location: _Where to find in admin dashboard codebase_

### Patterns to Avoid

- [ ] Anti-pattern: _What not to do in consumer UI_
- [ ] Reason: _Why it didn't work in admin dashboard_

---

## 14. Conclusion

**Overall Assessment:**
- [ ] Success: _Was Phase 1.5 successful in validating architecture?_
- [ ] Value: _Did it provide useful learnings for Phase 5?_
- [ ] ROI: _Was the 4-week investment worth it?_

**Readiness for Phase 5:**
- [ ] Confidence level: _How confident are we for consumer UI development?_
- [ ] Outstanding questions: _What still needs to be resolved?_

---

## Appendix: Code References

### Reusable Components
- **Path:** `src/admin-dashboard/components/`
- **Key Files:** _List files that should be referenced in Phase 5_

### Reusable Libraries
- **Path:** `src/admin-dashboard/lib/`
- **Key Files:** _List utility libraries to reuse_

### Browser Extension
- **Path:** `src/browser-extension/`
- **Reusability:** _Can this extension be used for consumer UI?_

---

**Last Updated:** 2025-01-12
**Status:** 🔄 Document being populated during Phase 1.5 implementation
**Next Review:** After Phase 1.5 completion (Week 4)

---

## 15. Week 2 Learnings (2025-01-12): End-to-End Browser PWA Testing

**Context:** Completed first complete end-to-end testing of browser PWA with real LLM API calls, data persistence, and UI validation.

### 15.1 Critical Architecture Validation ✅

**Self-Sovereign API Key Management:**
- [x] **LEARNING (2025-01-12):** Browser environment variables MUST NOT use `NEXT_PUBLIC_` prefix for API keys
- [x] **WHY:** `NEXT_PUBLIC_*` variables are bundled into client JavaScript and visible in browser DevTools
- [x] **CORRECT APPROACH (Phase 1.5 Dev):** Server-side `/api/llm-config` route reads `.env.local` and provides config to browser
- [x] **CORRECT APPROACH (Phase 5 Production):** Users provide their own API keys via Settings UI, stored encrypted in localStorage
- [x] **CODE:** `/app/api/llm-config/route.ts` + `/app/analyze/page.tsx:257-297`
- [x] **SECURITY:** API keys remain server-side in Phase 1.5, will be user-provided in Phase 5
- **Recommendation for Phase 5:** Implement Settings UI where users enter their own OpenAI/Anthropic/Google API keys, encrypt with wallet-derived key, store in localStorage

**Database Name Consistency (CRITICAL BUG):**
- [x] **ISSUE (2025-01-12):** Different components using different IndexedDB database names
- [x] **SYMPTOM:** Classifications page showed "0 of 0 classifications" despite Profile page showing 1 classification
- [x] **ROOT CAUSE:**
  - BrowserClassifier: `'ownyou_store'`
  - StoreClient: `'ownyou_admin_${userId}'` → `'ownyou_admin_default_user'`
  - Different databases = data isolation
- [x] **FIX:** Updated `store-client.ts:44` to use `'ownyou_store'` consistently across ALL components
- [x] **LESSON:** Database name MUST be standardized across all components that read/write to Store
- **Recommendation for Phase 5:** Define database name constant in shared config file, import everywhere

**Workflow State Schema Validation:**
- [x] **LEARNING (2025-01-12):** Added `llm_config` field to workflow state for API key propagation
- [x] **PATTERN:** State fields flow through 6 workflow nodes (load → retrieve → analyze → reconcile → update → advance)
- [x] **CODE:** `/src/browser/agents/iab-classifier/state.ts:167-178, 700-703`
- [x] **ALL 4 ANALYZERS UPDATED:** Demographics, Household, Interests, Purchase analyzers now receive and use llm_config
- [x] **CODE:** `/src/browser/agents/iab-classifier/analyzers/index.ts` (all 4 nodes updated)
- **Recommendation for Phase 5:** Keep workflow state clean - only add fields that ALL nodes may use

### 15.2 Real-World Performance Benchmarks

**Manual Text Classification (First Real Test):**
- [x] **INPUT:** Cryptocurrency investment text (~200 words)
- [x] **OUTPUT:** Finance and Insurance (78.3% confidence after reconciliation)
- [x] **PROCESSING TIME:** ~25 seconds total
- [x] **LLM CALLS:** 4 analyzer agents + 1 evidence judge = 5 total calls
- [x] **BREAKDOWN:**
  - Demographics: 1 LLM call (~5s)
  - Household: 1 LLM call (~5s)
  - Interests: 1 LLM call (~5s)
  - Purchase: 1 LLM call (~5s)
  - Reconciliation: Semantic memory update (~5s)
- [x] **USER EXPERIENCE:** Acceptable for manual testing, too slow for bulk processing
- **Recommendation for Phase 5:** Batch optimization critical (Phase 2 Week 4-5) - Python achieves 8-10s for 1 email via batching

**IndexedDB Persistence Validation:**
- [x] **WRITE:** 4 items stored after classification
  - 1 semantic memory (Finance and Insurance classification)
  - 3 episodic memories (evidence from text)
- [x] **NAMESPACE:** `['default_user', 'iab_taxonomy_profile']`
- [x] **KEY PATTERN:** `semantic_purchase_intent_342_finance-and-insurance` (section_taxonomyId_slug)
- [x] **STORAGE SIZE:** ~7KB for 1 classification + 3 episodic memories
- [x] **READ SPEED:** <10ms to retrieve all 4 items
- [x] **BROWSER RESTART:** Data survived browser close/reopen - persistence validated ✅
- **Recommendation for Phase 5:** IndexedDB persistence is production-ready for consumer UI

**Memory Reconciliation Validation:**
- [x] **FIRST CLASSIFICATION:** 0.722 confidence (created new semantic memory)
- [x] **SECOND CLASSIFICATION:** 0.783 confidence (confirming evidence boosted confidence)
- [x] **BOOST:** +0.061 confidence increase (+8.4% relative)
- [x] **MECHANISM:** Reconciliation layer detects existing classification, validates new evidence, increases confidence
- [x] **CODE:** Memory reconciliation in update node
- **Recommendation for Phase 5:** Memory reconciliation provides "learning over time" user experience - highlight this in consumer UI

### 15.3 UI Component Validation

**Analysis Runner Page (`/analyze`):**
- [x] **TESTED:** Manual text classification flow
- [x] **STEPS:** Enter text → Select LLM provider/model → Click "Run IAB Classification" → View results
- [x] **RESULT:** Successfully classified Finance and Insurance (78.3% confidence)
- [x] **UX FEEDBACK:**
  - Loading state: Spinning indicator during 25-second processing
  - Result display: Clear category, confidence, reasoning
  - Error handling: Failed gracefully when API keys missing (first test)
- **Recommendation for Phase 5:** Simplify for non-technical users - hide LLM provider selection, use smart defaults

**Profile Page (`/profile`):**
- [x] **TESTED:** Tiered classification display after classification
- [x] **RESULT:** Showed 1 Purchase Intent classification correctly
- [x] **DISPLAY:** Category name, confidence percentage, evidence count, tier path
- [x] **PERFORMANCE:** Instant load (<10ms IndexedDB read)
- **Recommendation for Phase 5:** Profile page pattern works well - adapt for consumer UI with more visual hierarchy

**Classifications Page (`/classifications`):**
- [x] **TESTED:** Browse all classifications view
- [x] **INITIAL ISSUE:** Showed "0 of 0 classifications" (database name bug)
- [x] **AFTER FIX:** Showed 1 classification correctly with all metadata
- [x] **DISPLAY:** Cards view with section, category, confidence, timestamps
- **Recommendation for Phase 5:** Card-based layout preferred over table for consumer UI - more mobile-friendly

### 15.4 Testing Process Learnings

**End-to-End Testing Checklist (ALL PASSED ✅):**
1. ✅ Manual text classification
2. ✅ IndexedDB persistence (data written)
3. ✅ Profile page display (data read)
4. ✅ Classifications page display (data read)
5. ✅ Browser restart persistence (data survives)

**Debugging Process:**
- [x] **PLAYWRIGHT MCP TOOLS:** Used extensively for browser automation
  - `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_wait_for`
  - Enabled rapid testing without manual clicking
- [x] **CONSOLE LOGS:** Critical for debugging classification flow
  - LLM client initialization logs
  - Evidence judge validation logs
  - Memory reconciliation logs
  - Store write/read logs
- [x] **DATABASE NAME BUG:** Found via added debug logging in `store-client.ts:122-131`
  - Logged namespace, item count, item keys
  - Revealed data in different database than expected
- **Recommendation for Phase 5:** Keep comprehensive logging in development build, disable in production via environment flag

### 15.5 Development Workflow Insights

**Server Restart Required for:**
- [x] New API routes (e.g., `/api/llm-config/route.ts`)
- [x] `.env.local` changes (though not in this case since we avoided `NEXT_PUBLIC_*`)
- [x] Next.js hot reload doesn't catch new routes immediately

**No Restart Required for:**
- [x] React component changes (hot reload works)
- [x] Client-side TypeScript changes (hot reload works)
- [x] IndexedDB schema changes (runtime changes)

**Git Workflow:**
- [x] **PATTERN USED:** Made changes, tested, committed after validation
- [x] **COMMIT MESSAGE:** Conventional commit format (`feat: description`)
- **Recommendation for Phase 5:** Continue using feature branches, commit after each logical checkpoint (as per git-workflow-discipline skill)

### 15.6 Phase 5 Consumer UI Recommendations

**Based on Week 2 Testing:**

**1. API Key Management UI (HIGH PRIORITY):**
- Implement Settings page where users enter their own API keys
- Support OpenAI, Anthropic, Google, Ollama (local)
- Encrypt keys with wallet-derived encryption key (deterministic)
- Store encrypted keys in localStorage (NOT IndexedDB - separate security domain)
- Show key status indicator (green = configured, red = missing)
- Pattern: `localStorage.setItem('ownyou_llm_keys_encrypted', encryptedBlob)`

**2. Classification Progress UI:**
- Current admin dashboard: Spinning indicator (generic)
- Consumer UI: Show classification progress with 4 steps:
  - "Analyzing demographics..." ✓
  - "Analyzing household..." ✓
  - "Analyzing interests..." ⏳
  - "Analyzing purchase intent..." ⏳
- Estimated time remaining based on benchmarks (5-7s per analyzer)
- Cancel button to abort long-running classifications

**3. Profile Visualization:**
- Current admin dashboard: List view with cards
- Consumer UI: Visual hierarchy with confidence-based sizing
  - Larger cards = higher confidence
  - Color coding by section (demographics=blue, interests=green, etc.)
  - Drill-down to see supporting evidence
- Mobile-first design (current dashboard is desktop-focused)

**4. Data Management:**
- Clear profile button (with confirmation dialog)
- Export profile as JSON (for backup/portability)
- Import profile from JSON (restore from backup)
- Storage usage indicator (e.g., "Using 2.3 MB of 50 MB limit")

**5. Performance Optimization:**
- **CRITICAL:** Implement batch optimizer (Phase 2 Week 4-5)
- Current: 25s for 1 email (sequential LLM calls)
- Target: 8-10s for 1 email (Python baseline with batching)
- Approach: Batch 20-30 emails, single LLM call per analyzer
- User experience: Progress bar showing "Processing 15 of 100 emails..."

### 15.7 Outstanding Questions for Phase 5

**Authentication:**
- [ ] How to derive encryption key from wallet signature? (deterministic derivation)
- [ ] Which wallet protocols to support? (MetaMask, WalletConnect, others?)
- [ ] Fallback for users without wallet? (Phase 5 decision)

**OAuth Integration:**
- [ ] Can browser extension OAuth tokens be shared with PWA? (security implications)
- [ ] Fallback for Safari (no chrome.identity API)? (PKCE flow in-page?)
- [ ] Token refresh strategy? (background refresh or on-demand?)

**Batch Processing:**
- [ ] What's acceptable latency for 100 emails? (2-3 minutes? 5 minutes?)
- [ ] How to show progress without blocking UI? (Web Workers?)
- [ ] Should we process incrementally or wait for full batch? (UX trade-off)

---
