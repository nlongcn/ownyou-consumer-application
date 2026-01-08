---
description: Run comprehensive code review (v13 compliance, quality, redundancy, sprint gaps, sprint completion audit)
allowed-tools: Read, Glob, Grep, TodoWrite, Skill, Write, Task, Bash
---
# Code Review Command

Run a comprehensive code review covering v13 architecture compliance, code quality, redundancy detection, sprint alignment, and **full sprint completion audit**.

## Instructions

When this command is invoked:

1. **Determine scope** (if not specified, ask user):
   - `full` - Entire codebase + all sprints audit
   - `package <name>` - Specific package (e.g., `packages/iab-classifier`)
   - `sprint` - Changes in current sprint only
   - `pr` - Current branch diff against main
   - `audit` - Sprint completion audit only (no code review)

2. **Load context:**
   - Read ALL sprint specs from `docs/sprints/ownyou-sprint*-spec.md`
   - Load v13 architecture from `docs/architecture/extracts/`
   - Check `docs/DEFERRED.md` for already-deferred items
   - Load strategic roadmap from `docs/plans/`

3. **Create TodoWrite items for each section:**
   - A: v13 Architecture Compliance
   - B: Code Quality Assessment
   - C: Redundancy Detection
   - D: Sprint & Roadmap Gaps
   - E: Specification Quality
   - **F: Sprint Completion Audit** (NEW - comprehensive)

4. **Execute each section** using the detailed checklists below

5. **Generate report** and save to `.review-output/CODE_REVIEW_REPORT.md`

6. **Summarize findings** with emphasis on sprint completion failures

## Review Sections

| Section | What It Checks |
|---------|----------------|
| **A. v13 Compliance** | Store usage, namespaces, memory types, privacy |
| **B. Code Quality** | TypeScript standards, error handling, testing |
| **C. Redundancy** | Dead code, duplicates, unused packages |
| **D. Sprint Gaps** | Missing deliverables, unplanned code |
| **E. Specifications** | Ambiguous requirements, doc currency |
| **F. Sprint Audit** | **ALL sprints: promised vs delivered, cross-sprint completion** |

---

## Section F: Sprint Completion Audit (CRITICAL)

This is the most important section. It answers: **"What did we promise vs. what did we actually deliver?"**

### F1. Sprint Inventory

For EACH sprint spec in `docs/sprints/`:

```
1. Read the sprint spec file
2. Extract:
   - Sprint number and name
   - Status field (PLANNED, IN_PROGRESS, COMPLETE)
   - Success criteria (checkboxes)
   - Package specifications
   - Test targets
   - v13 sections covered
```

### F2. Completion Verification

For each sprint, verify EVERY deliverable:

```markdown
| Sprint | Deliverable | Spec Says | Actually Exists | Test Count | Notes |
|--------|-------------|-----------|-----------------|------------|-------|
| 9 | @ownyou/observability enhancements | 60+ tests | 17 tests | ❌ Incomplete | Only traces module exists |
| 9 | AgentInspector component | Required | ❌ Missing | 0 | Never implemented |
| 9 | SyncMonitor component | Placeholder | ✅ Complete | 34 | Exceeded spec (762 lines) |
```

**Verification Steps:**
1. **Package exists?** - Check `packages/<name>/package.json`
2. **Files exist?** - Glob for expected source files
3. **Tests exist?** - Count tests in `__tests__/` or `*.test.ts`
4. **Test count matches?** - Compare to spec's test target
5. **Exports complete?** - Check `src/index.ts` exports what spec requires
6. **Functionality works?** - Run `pnpm --filter <pkg> test`

### F3. Cross-Sprint Tracking

Sometimes work specified in Sprint N is completed in Sprint M. Track this:

```markdown
| Original Sprint | Deliverable | Actually Completed In | Evidence |
|-----------------|-------------|----------------------|----------|
| Sprint 5 | Trigger system | Sprint 5 | ✅ As planned |
| Sprint 9 | LLMMetricsCollector | Never | ❌ Still missing |
| Sprint 8 | Basic observability | Sprint 0 | ⚠️ Earlier than planned |
```

### F4. Failure Pattern Analysis

Identify WHY sprints fail to complete:

**Common Patterns:**
- **Scope Creep**: Sprint took on too much
- **PR Not Merged**: Work done but stuck in PR
- **Branch Drift**: Feature branch diverged from main
- **Partial Implementation**: Some components done, others skipped
- **Test Shortfall**: Code exists but tests missing
- **Spec Inflation**: Spec claims more than implemented

For each incomplete sprint, categorize the failure mode.

### F5. Sprint Status Reconciliation

Compare spec status vs reality:

```markdown
| Sprint | Spec Status | Actual Status | Discrepancy |
|--------|-------------|---------------|-------------|
| 0 | COMPLETE | ✅ COMPLETE | None |
| 8 | COMPLETE | ✅ COMPLETE | None |
| 9 | PLANNED | ⚠️ 15% Complete | SyncMonitor only |
| 11c | COMPLETE | ✅ COMPLETE | None |
```

### F6. Test Count Audit

For each package mentioned in any sprint:

```bash
# Run this for each package
pnpm --filter @ownyou/<package> test 2>&1 | grep -E "Tests|passed|failed"
```

Compare to sprint spec test targets:

```markdown
| Package | Sprint Target | Actual Tests | Δ | Status |
|---------|---------------|--------------|---|--------|
| observability | 60+ | 17 | -43 | ❌ FAIL |
| debug-ui | 40+ | 34 | -6 | ⚠️ CLOSE |
| iab-classifier | 100+ | 156 | +56 | ✅ PASS |
```

### F7. Open PRs and Branches

Check for stuck work:

```bash
# List open PRs
gh pr list --state open

# List feature branches not merged
git branch -a | grep feature/sprint

# Check if any have diverged significantly
git log main..feature/<branch> --oneline | wc -l
```

### F8. Deliverables Traceability Matrix

Create a complete matrix of all sprint deliverables:

```markdown
## Sprint Deliverables Traceability

| Sprint | Package/Feature | Specified | Implemented | Tests | Merged | Notes |
|--------|----------------|-----------|-------------|-------|--------|-------|
| 0 | @ownyou/shared-types | ✅ | ✅ | ✅ | ✅ | Foundation |
| 0 | @ownyou/memory-store | ✅ | ✅ | ✅ | ✅ | |
| ... | ... | ... | ... | ... | ... | ... |
| 9 | Privacy sanitizer | ✅ | ❌ | ❌ | ❌ | Never started |
| 9 | LLMMetricsCollector | ✅ | ❌ | ❌ | ❌ | Never started |
| 9 | DataExporter (GDPR) | ✅ | ❌ | ❌ | ❌ | Never started |
```

---

## Output Format

Generate a report with this enhanced structure:

```markdown
# OwnYou Code Review Report

**Generated:** [timestamp]
**Scope:** [scope]
**Current Sprint:** [sprint number]
**Reviewer:** Claude Code

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Health Score** | X/100 |
| **v13 Compliance** | X% |
| **Critical Issues** | N |
| **High Priority Issues** | N |
| **Sprint Completion Rate** | X/Y sprints fully complete |
| **Test Count vs Target** | X% of target tests |
| **Open PRs with Sprint Work** | N |

### Key Findings

**Strengths:**
- [Top 3 things working well]

**Critical Gaps:**
- [Top 3 missing/incomplete items]

**Sprint Health:**
- [Summary of sprint completion status]

---

## A. v13 Architecture Compliance
[Issues with file:line references]

## B. Code Quality
[Issues categorized by severity]

## C. Redundancy
[Dead code, duplicates to consolidate]

## D. Sprint Gaps (Current Sprint)
[Missing implementations, unplanned code]

## E. Specification Issues
[Ambiguous requirements, doc updates needed]

---

## F. Sprint Completion Audit

### F1. Sprint Status Overview

| Sprint | Name | Spec Status | Actual Status | Completion % | Test Target | Actual Tests |
|--------|------|-------------|---------------|--------------|-------------|--------------|
| 0 | Foundation | COMPLETE | ✅ | 100% | 200 | 245 |
| ... | ... | ... | ... | ... | ... | ... |
| 9 | Observability | PLANNED | ⚠️ | 15% | 100 | 51 |

### F2. Incomplete Sprints Detail

#### Sprint 9: Observability & Debugging

**Spec Status:** PLANNED
**Actual Completion:** ~15%

| Deliverable | Status | Evidence | Failure Mode |
|-------------|--------|----------|--------------|
| Enhanced AgentStep types | ❌ Missing | types.ts lacks v13 fields | Partial Implementation |
| SyncLogger | ❌ Missing | No src/sync/ module | Never Started |
| LLMMetricsCollector | ❌ Missing | No src/llm/ module | Never Started |
| Privacy sanitizer | ❌ Missing | No src/privacy/ module | Never Started |
| DataExporter (GDPR) | ❌ Missing | No src/export/ module | Never Started |
| DEBUG_* namespaces | ❌ Missing | Not in shared-types | Never Started |
| AgentInspector UI | ❌ Missing | No component | Never Started |
| CostDashboard UI | ❌ Missing | No component | Never Started |
| SyncMonitor UI | ✅ Complete | 762 lines, 34 tests | Done |
| DataExport UI | ❌ Missing | No component | Never Started |

**Root Cause:** PR #6 created but never merged due to conflicts and CI failures.

[Repeat for each incomplete sprint]

### F3. Cross-Sprint Work Tracking

| Work Item | Specified In | Completed In | Notes |
|-----------|--------------|--------------|-------|
| Basic AgentTracer | Sprint 9 | Sprint 0 | Earlier implementation |
| SyncMonitor placeholder | Sprint 9 | Sprint 9 | ✅ On schedule |
| ... | ... | ... | ... |

### F4. Failure Pattern Summary

| Pattern | Occurrences | Affected Sprints |
|---------|-------------|------------------|
| PR Not Merged | 1 | Sprint 9 |
| Partial Implementation | 1 | Sprint 9 |
| Scope Creep | 0 | - |
| Branch Drift | 1 | Sprint 9 |

### F5. Open Work (PRs/Branches)

| PR/Branch | Sprint | Status | Commits Behind Main | Action Needed |
|-----------|--------|--------|---------------------|---------------|
| PR #6 | Sprint 9 | Closed | N/A | Re-implement on fresh branch |

### F6. Test Count Audit

| Package | Sprint | Target | Actual | Δ | Status |
|---------|--------|--------|--------|---|--------|
| @ownyou/observability | 9 | 60 | 17 | -43 | ❌ |
| @ownyou/debug-ui | 9 | 40 | 34 | -6 | ⚠️ |
| @ownyou/iab-classifier | 2 | 100 | 156 | +56 | ✅ |
| ... | ... | ... | ... | ... | ... |

**Total Test Debt:** X tests below target across all sprints

---

## Action Items

### Must Fix (Blocking)
1. [Critical issues]

### Should Fix (This Sprint)
1. [High priority issues]

### Sprint Remediation Required
1. [List sprints that need completion work]
2. [Specific missing deliverables to implement]

### Consider (Future)
1. [Medium/low priority]

---

## Recommendations

### Process Improvements
1. **Merge PRs promptly** - PR #6 sat for weeks, causing drift
2. **Update spec status** - Mark sprints as they actually complete
3. **Verify before marking complete** - Run this audit before claiming "done"

### Technical Debt
1. [List specific items to address]

---
Report generated by `/code-review` command
```

---

## Usage

```
/code-review              # Will ask for scope
/code-review full         # Full codebase + all sprints audit
/code-review package iab-classifier   # Single package
/code-review sprint       # Current sprint changes only
/code-review pr           # PR/branch changes only
/code-review audit        # Sprint audit only (no code quality checks)
```

## Audit-Only Mode

For sprint audit without full code review:

```
/code-review audit
```

This runs only Section F (Sprint Completion Audit) and generates a focused report.

---

## Quick Mode

For fast PR reviews, add `--quick`:

```
/code-review pr --quick
```

This runs abbreviated checks:
- v13 compliance (critical only)
- No new circular dependencies
- Tests present
- No hardcoded secrets
- Skip full sprint audit

---

## Automation Script

To run the full audit programmatically:

```bash
# List all sprint specs
ls docs/sprints/ownyou-sprint*-spec.md

# For each sprint, extract status
grep -l "Status:" docs/sprints/ownyou-sprint*-spec.md | while read f; do
  echo "=== $f ==="
  grep "Status:" "$f" | head -1
done

# Count tests per package
for pkg in $(ls packages/); do
  if [ -f "packages/$pkg/package.json" ]; then
    echo "=== $pkg ==="
    pnpm --filter "@ownyou/$pkg" test 2>&1 | grep -E "Tests|passed|failed" || echo "No tests"
  fi
done

# Check for open PRs
gh pr list --state open

# Check feature branches
git branch -a | grep "feature/sprint"
```

---

## Integration with Other Skills

This command works with:

- **v13-compliance-check** - Detailed architecture compliance
- **testing-discipline** - Test coverage verification
- **sprint-mode** - Sprint context loading
- **git-workflow-discipline** - PR and commit review
