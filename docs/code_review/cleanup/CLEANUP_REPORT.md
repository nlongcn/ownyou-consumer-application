# OwnYou Repository Cleanup Report

**Generated:** 2025-12-31
**Reviewed By:** Claude Code
**Status:** READY FOR ACTION
**Last Verified:** 2025-12-31 (sizes verified, dependencies migrated)
**Total Repository Size:** 22 GB

---

## Executive Summary

| Category                      | Items | Potential Savings | Risk   |
| ----------------------------- | ----- | ----------------- | ------ |
| Archived/Research Directories | 4     | 1.3 GB            | NONE   |
| Legacy Desktop App            | 1     | 3.0 GB            | NONE   |
| Build Artifacts & SDKs        | 2     | 843 MB            | NONE   |
| Legacy Source Code            | 3     | ~280 KB           | MEDIUM |
| Stale Configuration           | 3     | ~3 KB             | NONE   |
| Regenerable Data              | 3     | ~536 KB           | NONE   |
| **TOTAL**                     | **16**| **~5.2 GB**       |        |

### ✅ Migration Completed (2025-12-31)

| Item | Action Taken |
|------|--------------|
| `dashboard/` | Dependency migrated to `src/email_parser/workflow/tracking_queries.py` - **SAFE TO DELETE** |

### ⚠️ Critical Items (DO NOT DELETE)

| Item | Reason |
|------|--------|
| `src/browser/` | ACTIVELY USED by admin-dashboard (4,684 lines of code) |

---

## Phase 1: Safe Deletions (No Risk) - ~4.6 GB

All items verified to have NO dependencies.

| Item                  | Size   | Command                              |
| --------------------- | ------ | ------------------------------------ |
| `src/desktop-app/`    | 3.0 GB | `rm -rf src/desktop-app/`            |
| `dashboard/`          | 735 MB | `rm -rf dashboard/`                  |
| `google-cloud-sdk/`   | 643 MB | `rm -rf google-cloud-sdk/`           |
| `_archive/`           | 174 MB | `rm -rf _archive/`                   |
| `logs/`               | 200 MB | `rm -rf logs/`                       |
| `flask_session/`      | 336 KB | `rm -rf flask_session/`              |
| `.env.backup`         | 3 KB   | `rm .env.backup`                     |
| `.pglite-*`           | ~0 KB  | `rm -rf .pglite-*`                   |

**One-liner for Phase 1:**
```bash
rm -rf src/desktop-app/ dashboard/ google-cloud-sdk/ _archive/ logs/ flask_session/ .env.backup .pglite-*
```

---

## Phase 2: Archive First, Then Delete - ~418 MB

| Item                  | Size   | Action                                   |
| --------------------- | ------ | ---------------------------------------- |
| `research_spike/`     | 156 MB | Archive findings to docs, then delete    |
| `ceramic-research/`   | 262 MB | Archive decision rationale, then delete  |

---

## Phase 3: Evaluate (Low Priority) - ~280 KB

| Item                    | Size   | Action                          |
| ----------------------- | ------ | ------------------------------- |
| `src/auth/`             | 120 KB | Check if superseded by packages |
| `src/frontend/`         | 4 KB   | Verify empty, then delete       |
| `src/mission_agents/`   | 156 KB | Verify migration complete       |

**⚠️ DO NOT DELETE:** `src/browser/` - ACTIVELY USED (4,684 lines)

---

## Detailed Item Descriptions

### 1. src/desktop-app/ (3.0 GB) - ✅ SAFE TO DELETE

**Path:** `/src/desktop-app/`
**Status:** REDUNDANT - OLD TAURI APP
**Reason:** Superseded by `apps/consumer/` (current Tauri desktop app)

**Contents:**
```
src/desktop-app/
├── src-tauri/
│   └── target/           # 3.0 GB - Rust build artifacts
├── src/                  # 36 KB - Old React code
├── package.json
└── *.md docs
```

**Why safe to delete:**
- Zero imports found in codebase
- Replaced by `apps/consumer/` (current production app)
- 99.9% of size is Rust `target/` build cache

---

### 2. dashboard/ (735 MB) - ✅ SAFE TO DELETE

**Path:** `/dashboard/`
**Status:** REDUNDANT - DEPENDENCY MIGRATED
**Reason:** Superseded by `src/admin-dashboard/`

**Dependency Migration (2025-12-31):**
- ✅ Created `src/email_parser/workflow/tracking_queries.py`
- ✅ Updated `tracking.py` to use local module
- ✅ Dashboard dependency eliminated

---

### 3. google-cloud-sdk/ (643 MB) - ✅ SAFE TO DELETE

**Path:** `/google-cloud-sdk/`
**Status:** SHOULD NOT BE IN REPO
**Reason:** Binary SDK - install via `brew install google-cloud-sdk`

---

### 4. _archive/ (174 MB) - ✅ SAFE TO DELETE

**Path:** `/_archive/`
**Status:** HISTORICAL ARCHIVE
**Reason:** 2025-11-25 cleanup artifacts, no references

---

### 5. logs/ (200 MB) - ✅ SAFE TO DELETE

**Path:** `/logs/`
**Status:** REGENERABLE
**Reason:** Application logs, will be recreated

**Post-cleanup:** Add to `.gitignore`:
```gitignore
logs/*.log
logs/**/*.log
```

---

### 6. research_spike/ (156 MB) - ARCHIVE FIRST

**Path:** `/research_spike/`
**Status:** ARCHIVED RESEARCH
**Reason:** Pre-sprint investigations completed Nov 2024

**Before deletion:**
1. Document key findings in `docs/research/`
2. Extract any reusable patterns

---

### 7. ceramic-research/ (262 MB) - ARCHIVE FIRST

**Path:** `/ceramic-research/`
**Status:** ARCHIVED RESEARCH
**Reason:** Tech evaluation complete - GUN.js chosen over Ceramic

**Before deletion:**
1. Document decision rationale in `docs/architecture/ADR-*.md`
2. Archive benchmark comparison data

---

### 8. src/browser/ - ⚠️ DO NOT DELETE

**Status:** ACTIVE - CRITICAL DEPENDENCY

**Active modules (4,684 lines):**
- `api/` - Gmail/Outlook API clients
- `checkpointer/` - LangGraph PGlite checkpointer
- `memory/` - MemoryManager
- `store/` - IndexedDBStore (imported by admin-dashboard)
- `taxonomy/` - IABTaxonomyLoader
- `workflow/` - LLM wrapper, evidence judge

**Active imports:**
- `src/admin-dashboard/app/evidence/page.tsx` → `@browser/store/IndexedDBStore`
- `vitest.config.ts` → defines `@browser` alias

**Already deleted (2025-12-31):**
- ✅ `src/browser/agents/iab-classifier/` → consolidated to `packages/iab-classifier/`
- ✅ `src/browser/llm/` → consolidated to `packages/llm-client/`

---

## .gitignore Additions

Add these entries:

```gitignore
# Build artifacts
google-cloud-sdk/

# Development databases
.pglite-*/

# Session data
flask_session/

# Log files
logs/*.log
logs/**/*.log

# Token files
token.json
ms_token.json
msal_token_cache.bin

# Environment backups
.env.backup

# Test artifacts
test-screenshots/
test-results/
```

---

## Post-Cleanup Verification

```bash
# 1. Verify no broken imports
pnpm tsc --noEmit

# 2. Run tests
pnpm test

# 3. Build apps
cd apps/consumer && pnpm build

# 4. Check new size
du -sh .
```

---

## Summary

| Phase | Items | Size | Risk |
|-------|-------|------|------|
| Phase 1 | 8 | ~4.6 GB | NONE |
| Phase 2 | 2 | ~418 MB | NONE (after archiving) |
| Phase 3 | 3 | ~280 KB | MEDIUM (needs evaluation) |
| **Total** | **13** | **~5.0 GB** | |

**Expected repository size after Phase 1:** ~17.4 GB (down from 22 GB)

---

## Appendix: Verification Performed

### Size Verification (2025-12-31)

| Item | Reported | Verified |
|------|----------|----------|
| `src/desktop-app/` | ~20 MB | **3.0 GB** (Rust target/) |
| `dashboard/` | 735 MB | ✅ 735 MB |
| `google-cloud-sdk/` | 643 MB | ✅ 643 MB |
| `logs/` | 200 MB | ✅ 200 MB |
| `_archive/` | 174 MB | ✅ 174 MB |
| `research_spike/` | 156 MB | ✅ 156 MB |
| `ceramic-research/` | 262 MB | ✅ 262 MB |
| `flask_session/` | 336 KB | ✅ 336 KB |
| `.pglite-*` | ~45 MB | **~0 KB** (empty) |

### Dependency Checks

| Item | Check | Result |
|------|-------|--------|
| `src/desktop-app/` | Import search | ✅ No dependencies |
| `dashboard/` | Import search | ✅ Migrated |
| `src/browser/` | Import search | ⚠️ ACTIVE - used by admin-dashboard |
| `_archive/` | Import search | ✅ No dependencies |
| `research_spike/` | Import search | ✅ No dependencies |
| `ceramic-research/` | Import search | ✅ No dependencies |

---

*Report generated and verified by Claude Code.*
