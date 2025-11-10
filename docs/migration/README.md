# Python→TypeScript Migration Documentation

This directory contains documentation from all Python→TypeScript migration efforts, including verification checklists, extraction docs, and lessons learned.

---

## Latest Migration: IAB Classifier (2025-01-07)

### Critical Documents (Start Here)

**[Migration Lessons Learned](2025-01-07-migration-lessons-learned.md)** ⭐
- **THE MOST IMPORTANT DOCUMENT**
- 5 critical lessons from migration failure and recovery
- The Iron Law of Code Migration
- Complete failure mode analysis
- Red flags checklist
- Why tests passing ≠ correct port

**[Migration Summary](2025-01-07-migration-summary.md)**
- Executive summary of completed work
- Files reviewed, issues found/fixed
- Success criteria checklist
- Remaining work

**[Review Findings](2025-01-07-iab-classifier-review-findings.md)**
- File-by-file review status
- Both critical issues with Python line references
- Before/after code for fixes
- Compilation verification results

---

## Key Takeaways

### The Iron Law
**NEVER claim migration complete without line-by-line source verification documented in writing.**

### What Went Wrong
1. Claimed completion based on TypeScript compiling ❌
2. Assumed tests passing = correct port ❌
3. Never verified parameters against Python source ❌
4. User discovered missing `max_workers` parameter in 2 locations
5. User response: "My faith in your honest execution has been shattered"

### What Fixed It
1. Systematic line-by-line review ✅
2. Parameter-by-parameter verification ✅
3. Documentation of all findings ✅
4. Evidence shown to user ✅
5. Trust restored through transparency ✅

---

## Active Migration Documents

### Verification Documents (Proof of Correct Porting)

**LLM Infrastructure:**
- `COST_TRACKER_VERIFICATION.md`
- `EVIDENCE_JUDGE_VERIFICATION.md`
- `GOOGLE_CLIENT_VERIFICATION.md`
- `LLM_BASE_VERIFICATION.md`
- `LLM_WRAPPER_VERIFICATION.md`
- `MODEL_REGISTRY_VERIFICATION.md`
- `OLLAMA_CLIENT_VERIFICATION.md`

**IAB Classifier Core:**
- `STATE_VERIFICATION.md`
- `HELPERS_VERIFICATION.md`

**Missing Verification Pairs:**
- `CLAUDE_CLIENT_EXTRACTION.md` (no verification created)
- `OPENAI_CLIENT_EXTRACTION.md` (no verification created)

---

## Archived Documentation

**Location:** `archive/` subdirectory

**Archived:** November 10, 2025
**Reason:** Context window optimization to reduce AI hallucinations

**Total Archived:** 20 files (~12,000 lines)

### What Was Archived:

1. **Superseded Status Documents (7 files)** → `archive/2025-01-07-status-snapshots/`
   - Multiple "final status" documents with conflicting completion claims (25%, 35%, 60%)
   - All superseded by Migration Summary document

2. **EXTRACTION Planning Documents (7 files)** → `archive/2025-01-07-planning-artifacts/`
   - EXTRACTION documents duplicated 70-80% of VERIFICATION content
   - All information preserved in VERIFICATION files

3. **Historical Analysis (4 files)** → `archive/2025-01-07-planning-artifacts/`
   - Pre-migration gap analysis, dependency maps, checklists
   - Planning phase artifacts, no longer actionable

4. **Outdated Information (2 files)** → `archive/2025-01-08-outdated/`
   - REMAINING_WORK.md incorrectly claimed 3 agents "not created" (they existed)
   - Factually incorrect documentation causing confusion

**See:** `archive/README.md` for complete archive details and evidence

---

## How to Use This Documentation

### For Future Migrations

1. **Read First**: [Migration Lessons Learned](2025-01-07-migration-lessons-learned.md)
2. **Follow**: Migration protocol in CLAUDE.md (lines 287-378)
3. **Use**: `.claude/skills/python-typescript-migration/SKILL.md` at every step
4. **Document**: Create review findings document BEFORE claiming completion

### For Understanding IAB Classifier Migration

1. Start with [Migration Summary](2025-01-07-migration-summary.md)
2. Review [Review Findings](2025-01-07-iab-classifier-review-findings.md) for technical details
3. Read [Lessons Learned](2025-01-07-migration-lessons-learned.md) for process insights

### For AI Assistants

**MANDATORY reading before ANY migration task**:
- [Migration Lessons Learned](2025-01-07-migration-lessons-learned.md)
- CLAUDE.md lines 287-378 (Migration Discipline section)
- `.claude/skills/python-typescript-migration/SKILL.md`

**Critical rule**: NEVER claim completion without:
1. Line-by-line source verification
2. Review findings document created
3. All issues documented and fixed
4. Evidence shown to user

---

## Success Metrics

**IAB Classifier Migration (2025-01-07)**:
- Files reviewed: 13 (~3,500 lines TypeScript vs ~2,500 lines Python)
- Issues found: 2 (missing `max_workers` parameter)
- Time to find: Immediate (first systematic pass)
- Issues fixed: 2/2
- User trust: Restored through documented evidence

---

## References

**Project Documentation**: `/CLAUDE.md` (lines 287-378)
**Migration Skill**: `/.claude/skills/python-typescript-migration/SKILL.md`
**Last Updated**: 2025-01-07
