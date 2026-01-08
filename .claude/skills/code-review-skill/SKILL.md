---
name: code-review-skill
description: Comprehensive AI-powered code review for OwnYou. Performs v13 architecture compliance, code quality, redundancy detection, and sprint gap analysis. Use before sprint completion, for PR reviews, or periodic codebase health checks.
---

# OwnYou Code Review

Comprehensive code review covering v13 architecture compliance, code quality, redundancy, and sprint alignment.

## When to Use

- **Before marking a sprint complete**
- **PR reviews** - Review changes before merge
- **Periodic health check** - Weekly/monthly codebase review
- **After major refactors**

## Review Sections

The review covers 5 areas:

| Section | Focus |
|---------|-------|
| **A. v13 Architecture** | Store usage, namespaces, memory types, privacy |
| **B. Code Quality** | Standards, error handling, testing, security |
| **C. Redundancy** | Dead code, duplicates, unused packages |
| **D. Sprint Gaps** | Missing deliverables, unplanned code |
| **E. Specifications** | Ambiguous requirements, missing acceptance criteria |

## Review Process

### Step 1: Scope Definition

Determine what to review:

```
Options:
1. Full codebase (packages/, apps/, src/)
2. Specific package (e.g., packages/iab-classifier)
3. Sprint changes (git diff against main)
4. PR changes (specific branch diff)
```

If user doesn't specify, ask which scope they want.

### Step 2: Load Context

Load the reference documents:

```
READ these files:
- docs/sprints/ownyou-sprint*-spec.md (current sprint)
- docs/architecture/OwnYou_architecture_v13.md (or extracts)
- docs/requirements/ (relevant requirements)
- docs/DEFERRED.md (already deferred items)
```

### Step 3: Run Review Sections

Execute each section using the checklists below.

---

## Section A: v13 Architecture Compliance

**Use the `v13-compliance-check` skill for detailed checks.**

Quick checklist:

### A1. Store API Usage
- [ ] All data operations use `store.put/get/search/list/delete`
- [ ] No direct IndexedDB or SQLite queries
- [ ] Single Store instance (no multiple databases)

### A2. Namespace Compliance
- [ ] Uses `STORE_NAMESPACES` from `@ownyou/shared-types`
- [ ] No hardcoded namespace strings
- [ ] User ID included in namespace calls

### A3. Memory Type Compliance
- [ ] All Memory objects have required fields (id, content, context, valid_at, created_at, strength, privacy_tier)
- [ ] Privacy tier assigned to all data
- [ ] Bi-temporal fields present

### A4. Privacy/Self-Sovereign
- [ ] All personal data stored locally (IndexedDB/SQLite)
- [ ] No calls to centralized OwnYou backend
- [ ] Private data never sent externally
- [ ] Sensitive data encrypted before external API calls

**Severity Ratings:**
- **Critical**: Privacy violation, data sent to unauthorized endpoint
- **High**: Wrong namespace, missing Store API usage
- **Medium**: Missing privacy tier, incomplete memory fields

---

## Section B: Code Quality Assessment

### B1. TypeScript Standards
- [ ] Strict mode enabled
- [ ] No `any` types (except justified cases)
- [ ] Proper error types (not just `Error`)
- [ ] Exports through index.ts

### B2. Package Boundaries
- [ ] No circular dependencies between packages
- [ ] Types imported from `@ownyou/shared-types`
- [ ] No direct imports of internal package files

### B3. Error Handling
- [ ] LLM calls have fallback chains
- [ ] Network operations handle failures
- [ ] Errors are typed and informative

### B4. Testing
- [ ] Unit tests exist for public APIs
- [ ] Integration tests for cross-package flows
- [ ] Mocks appropriate for LLM calls

### B5. Security
- [ ] Input validation at system boundaries
- [ ] OAuth tokens handled securely
- [ ] No hardcoded secrets or API keys
- [ ] .env files in .gitignore

**To find issues, search for:**
```
Grep: "any" in *.ts files (type safety)
Grep: "TODO|FIXME|HACK" (technical debt)
Grep: "console.log" (debugging left in)
Grep: hardcoded API keys or secrets
```

---

## Section C: Redundancy Detection

### C1. Dead Code
Search for:
- Unused exports (functions/classes exported but never imported)
- Commented-out code blocks
- Unreachable code paths

### C2. Duplicate Code
Look for:
- Near-duplicate files (>80% similar)
- Copy-pasted functions across packages
- Types duplicated instead of using shared-types

### C3. Unused Packages
Check:
- Packages with no imports from other packages
- Dependencies in package.json not used in code
- Duplicate functionality across packages

### C4. Legacy Code
Identify:
- Code in `src/email_parser/` not used by new packages
- Outdated patterns from pre-v13 architecture
- Migration files that should be archived

**Search commands:**
```
Find orphaned files: files not imported anywhere
Find unused exports: exported but never imported
Find duplicate deps: same package in multiple package.json
```

---

## Section D: Sprint & Roadmap Gaps

### D1. Current Sprint Progress
For each deliverable in current sprint spec:
- [ ] Implementation exists
- [ ] Tests pass
- [ ] v13 compliant

### D2. Missing Implementations
List requirements with NO corresponding code:
- From docs/requirements/
- From current sprint spec

### D3. Unplanned Code
Find implementations NOT in any spec:
- New packages without sprint backing
- Features added without requirements

### D4. Deferred Items
Cross-reference with docs/DEFERRED.md:
- Items that should be there but aren't
- Items that were fixed but not removed

---

## Section E: Specification Quality

### E1. Sprint Spec Clarity
For current sprint spec:
- [ ] Clear acceptance criteria for each deliverable
- [ ] Dependencies identified
- [ ] Package assignments clear

### E2. Requirements Gaps
- Ambiguous requirements that need clarification
- Missing acceptance criteria
- Conflicting specifications

### E3. Documentation Currency
- [ ] Architecture docs match implementation
- [ ] Package READMEs up to date
- [ ] Sprint spec reflects actual status

---

## Output Format

Generate a report in this format:

```markdown
# OwnYou Code Review Report

**Generated:** [timestamp]
**Scope:** [full codebase | package name | sprint changes]
**Current Sprint:** [sprint number]
**Reviewer:** Claude Code

## Executive Summary

- **Overall Health Score:** X/100
- **v13 Compliance:** X% (N issues)
- **Critical Issues:** N
- **High Priority:** N
- **Sprint Progress:** X% complete

## A. v13 Architecture Compliance

### Critical Issues
[List with file:line references]

### High Priority
[List with file:line references]

### Compliant Areas
[Brief summary of what's working well]

## B. Code Quality

### Issues Found
[Categorized by severity]

### Recommendations
[Top 3 improvements]

## C. Redundancy

### Recommended Deletions
[Files/code to remove]

### Consolidation Opportunities
[Code to merge/deduplicate]

## D. Sprint & Roadmap Gaps

### Missing from Sprint
[Deliverables not implemented]

### Unplanned Code
[Code without backing requirements]

## E. Specification Issues

### Needs Clarification
[Ambiguous requirements]

### Recommendations
[Documentation improvements]

## Action Items

### Must Fix (Blocking)
1. [Critical issues]

### Should Fix (This Sprint)
1. [High priority issues]

### Consider (Future)
1. [Medium/low priority]

---
Report generated by `/code-review` skill
```

---

## Quick Review Mode

For faster PR reviews, use abbreviated checklist:

```
Quick Review Checklist:
[ ] v13 compliant (Store, namespaces, privacy)
[ ] No new circular dependencies
[ ] Tests added/updated
[ ] No hardcoded secrets
[ ] Error handling present
[ ] Types from shared-types
```

---

## Integration with Other Skills

This skill works with:

- **v13-compliance-check** - Detailed architecture compliance
- **testing-discipline** - Test coverage verification
- **sprint-mode** - Sprint context loading
- **git-workflow-discipline** - PR and commit review

---

## AI Assistant Protocol

When invoking `/code-review`:

1. **Ask scope** if not specified (full, package, sprint, PR)
2. **Load context** (sprint spec, architecture, requirements)
3. **Create TodoWrite** items for each section
4. **Execute sections** A through E
5. **Generate report** in the format above
6. **Save report** to `.review-output/CODE_REVIEW_REPORT.md`
7. **Summarize** key findings for user

**Time estimate:**
- Full codebase: 10-15 minutes
- Single package: 3-5 minutes
- PR changes: 2-3 minutes
