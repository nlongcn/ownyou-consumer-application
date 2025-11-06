# Phase 5 Completion TODO - Bug Fix & Polish Phase

**Created:** 2025-10-01
**Focus:** Complete Track 1 & 2, then production-ready Track 3 & 4
**Philosophy:** Keep it simple - SQLite, not PostgreSQL. Zero setup, privacy-first.

---

## ✅ Completed

### Track 1 & 2 Basics
- [x] IAB profile CLI command (--iab-profile, --iab-csv, --user-id)
- [x] JSON profile export with valid schema
- [x] SQLite persistent memory backend
- [x] Incremental processing (skip processed emails)
- [x] `--force-reprocess` flag for reprocessing all emails
- [x] Core E2E tests (11/11 passing)
- [x] Manual persistence verification

---

## 🔴 Option A: Complete Track 1 & 2 (Solid MVP)

### A1: Fix Test Suite Issues ⚠️ HIGH PRIORITY
**Status:** Not Started
**Time:** 2-3 hours

**Problem:** Some persistence tests fail due to incorrect API usage in test code (not production code)

**Tasks:**
1. Fix `tests/integration/test_sqlite_persistence.py` API usage:
   - Update `store_semantic_memory()` calls (check actual API signature)
   - Update `mark_email_as_processed()` → check correct method name
   - Update `get_processed_emails()` → check correct method name

2. Run and verify:
   ```bash
   pytest tests/integration/test_sqlite_persistence.py -v
   ```

**Acceptance:**
- All persistence tests pass
- Tests use correct MemoryManager API

---

###  A2: Multi-Session Persistence Test ⚠️ MEDIUM PRIORITY
**Status:** Not Started
**Time:** 1 hour

**Goal:** Verify confidence evolution across multiple sessions

**Tasks:**
1. Create test script:
   ```bash
   # Day 1: First crypto email
   python -m src.email_parser.main --iab-csv crypto_email_1.csv --user-id multi_test

   # Day 2: Second crypto email (should increase confidence)
   python -m src.email_parser.main --iab-csv crypto_email_2.csv --user-id multi_test

   # Day 3: Third crypto email  (confidence should continue growing)
   python -m src.email_parser.main --iab-csv crypto_email_3.csv --user-id multi_test
   ```

2. Verify:
   - Confidence scores increase: Day1 < Day2 < Day3
   - Evidence count increases: 1 → 2 → 3
   - All emails tracked as processed

**Acceptance:**
- Confidence evolution documented
- Multi-session test script in `tests/manual/test_confidence_evolution.sh`

---

### A3: Simple Migration Utility 🟡 LOW PRIORITY
**Status:** Not Started
**Time:** 1-2 hours

**Goal:** Basic utility to export/import SQLite data (for backup/restore)

**Tasks:**
1. Create `scripts/export_memories.py`:
   ```python
   # Export all memories to JSON
   python scripts/export_memories.py --db data/email_parser_memory.db --output backup.json
   ```

2. Create `scripts/import_memories.py`:
   ```python
   # Import memories from JSON
   python scripts/import_memories.py --input backup.json --db data/email_parser_memory_new.db
   ```

**NOT Needed:**
- ❌ PostgreSQL migration (we chose SQLite deliberately)
- ❌ Complex schema migrations
- ❌ Multi-database sync

**Acceptance:**
- Simple export/import scripts work
- Useful for backup and testing

---

## 🟡 Option B: Production Readiness (Track 3 & 4)

### B1: Cost Tracking 🟢 HIGH VALUE
**Status:** Not Started
**Time:** 2-3 hours

**Goal:** Track and display LLM API costs

**Tasks:**
1. Create `src/email_parser/workflow/cost_tracker.py`:
   ```python
   class CostTracker:
       PRICING = {
           "openai": {"gpt-4o-mini": {"input": 0.000150/1000, "output": 0.000600/1000}},
           "claude": {"claude-sonnet-4": {"input": 0.003/1000, "output": 0.015/1000}},
           "ollama": {"default": {"input": 0, "output": 0}}  # Free
       }

       def track_call(self, provider, model, prompt_tokens, completion_tokens):
           cost = (prompt_tokens * PRICING[provider][model]["input"]) +
                  (completion_tokens * PRICING[provider][model]["output"])
           self.total_cost += cost
           return cost
   ```

2. Integrate into LLM clients to capture token counts

3. Display in session summary:
   ```
   ✅ IAB profile saved
   Emails: 50
   Cost: $0.42 USD ($0.0084 per email)
     - OpenAI: $0.35
     - Claude: $0.07
   ```

**Acceptance:**
- Costs tracked per LLM call
- Summary shows total and per-email cost
- Works with all providers (OpenAI, Claude, Ollama)

---

### B2: Optimize Test Suite ⚠️ BLOCKS CI/CD
**Status:** Not Started
**Time:** 3-4 hours

**Problem:** Tests timeout due to real LLM calls

**Tasks:**
1. Mock LLM calls in unit tests:
   ```python
   @pytest.fixture
   def mock_llm_client(monkeypatch):
       def mock_analyze(email, taxonomy_context):
           return {"classifications": [{"taxonomy_id": 342, "confidence": 0.85}]}

       monkeypatch.setattr("src.email_parser.workflow.llm_wrapper.get_llm_client",
                          lambda: MockLLMClient(mock_analyze))
   ```

2. Create separate test categories:
   - `tests/unit/` - Fast, mocked LLM (< 10s total)
   - `tests/integration/` - Real LLM, smaller datasets (< 2min)
   - `tests/e2e/` - Full flow, real data (manual/nightly)

3. Add pytest markers:
   ```python
   @pytest.mark.unit  # Fast, mocked
   @pytest.mark.integration  # Real LLM, small
   @pytest.mark.slow  # Full E2E, manual
   ```

**Acceptance:**
- Unit tests complete in < 30s
- Integration tests complete in < 5min
- No timeouts

---

### B3: User Documentation 📚 CRITICAL FOR USERS
**Status:** Not Started
**Time:** 2-3 hours

**Goal:** Clear, concise user guide

**Tasks:**
1. Create `docs/USER_GUIDE.md` with:
   ```markdown
   # IAB Profile Generator - User Guide

   ## Quick Start
   ```bash
   # Generate profile from CSV
   python -m src.email_parser.main --iab-csv emails.csv --iab-output profile.json

   # Generate profile from Gmail
   python -m src.email_parser.main --iab-profile --provider gmail --max-emails 50
   ```

   ## Configuration
   - LLM Provider selection (OpenAI, Claude, Ollama)
   - Memory backend (SQLite by default)
   - Output customization

   ## Understanding Your Profile
   - What each section means
   - Confidence scores explained
   - Privacy guarantees

   ## Troubleshooting
   - Common errors and solutions
   ```

2. Create `docs/API_QUICKSTART.md`:
   ```markdown
   # API Quick Start

   ```python
   from email_parser.main import EmailParser

   parser = EmailParser()
   profile_path = parser.generate_iab_profile(
       csv_file="emails.csv",
       output_file="profile.json",
       user_id="user_123"
   )
   ```
   ```

**Acceptance:**
- User can go from zero to profile in 5 minutes
- Clear troubleshooting section
- API usage examples

---

### B4: Performance Benchmarks 📊 OPTIONAL
**Status:** Not Started
**Time:** 2-3 hours

**Goal:** Document performance characteristics

**Tasks:**
1. Create `benchmarks/benchmark_throughput.py`:
   ```python
   def benchmark_email_processing():
       for size in [10, 50, 100, 500]:
           emails = generate_test_emails(size)
           start = time.time()
           run_iab_workflow(emails)
           elapsed = time.time() - start

           print(f"{size} emails: {elapsed:.1f}s ({elapsed/size:.2f}s/email)")
   ```

2. Run and document:
   ```
   Performance Benchmarks (2025-10-01, MacBook Pro M1)
   - 10 emails: 19s (1.9s/email)
   - 50 emails: 95s (1.9s/email)
   - 100 emails: 190s (1.9s/email)
   - Incremental run: 0.2s (skips processed)

   Memory Usage:
   - Peak: 250MB for 100 emails
   - Database: 50KB per 100 emails
   ```

**Acceptance:**
- Benchmarks documented in `docs/PERFORMANCE.md`
- Known bottlenecks identified
- Reasonable expectations set

---

## 📋 Summary Checklist

### Must Have (for v1.0 Release)
- [x] IAB profile generation working
- [x] SQLite persistence working
- [x] Incremental processing working
- [x] --force-reprocess flag
- [ ] Test suite passing (A1)
- [ ] User documentation (B3)

### Should Have (for production use)
- [ ] Cost tracking (B1)
- [ ] Multi-session testing (A2)
- [ ] Test suite optimized (B2)

### Nice to Have (polish)
- [ ] Migration utility (A3)
- [ ] Performance benchmarks (B4)
- [ ] CI/CD pipeline

---

## Time Estimates

**Option A (MVP Polish):** 4-6 hours
- A1: Fix test suite (2-3h)
- A2: Multi-session test (1h)
- A3: Migration utility (1-2h)

**Option B (Production Ready):** 9-13 hours
- B1: Cost tracking (2-3h)
- B2: Optimize tests (3-4h)
- B3: User docs (2-3h)
- B4: Benchmarks (2-3h)

**Total for both:** 13-19 hours

---

## NOT Doing (Deliberately Out of Scope)

### Why NOT PostgreSQL?
We chose SQLite because:
- ✅ Zero setup (no database server needed)
- ✅ Privacy-first (local file, no network)
- ✅ Portable (single file, easy backup)
- ✅ Free (no hosting costs)
- ✅ Perfect for single-user CLI tool

PostgreSQL would add:
- ❌ Setup complexity (install, configure, maintain)
- ❌ Server dependency (must be running)
- ❌ Network exposure (potential security risk)
- ❌ Hosting costs (cloud databases)
- ❌ Overkill for single-user use case

### Why NOT These Features?
- ❌ **Accuracy validation** - Requires manual labeling (50+ emails), time-intensive, academic exercise
- ❌ **Dashboard UI** - Out of scope for CLI tool (future web app)
- ❌ **Response caching** - Premature optimization, adds complexity
- ❌ **Batch optimization** - LLMs already batched internally
- ❌ **Sentry integration** - Adds dependency, logs sufficient for now

---

## Philosophy

**Keep It Simple:**
- SQLite, not PostgreSQL
- Local-first, privacy-first
- Zero external dependencies
- One command to run
- Clear error messages
- Obvious behavior

**Focus on Value:**
- Does it help the user?
- Does it make the system more reliable?
- Does it improve the experience?
- If no → skip it

---

## Next Steps

1. **Discuss priorities** with user
2. **Start with Option A** (4-6 hours for solid MVP)
3. **Then Option B** (9-13 hours for production)
4. **Ship v1.0** when Must Have items complete

**Question for User:**
- Which tasks are most important to you?
- Any tasks we should skip or add?
- Timeline/deadline considerations?
