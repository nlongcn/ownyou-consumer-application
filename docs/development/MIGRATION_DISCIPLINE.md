# Migration Discipline

**Date:** 2025-01-07
**Incident:** IABClassifier divergence from Python source
**Status:** Protocol established to prevent recurrence

---

## What Happened

During TypeScript migration, the IABClassifier was implemented as a simplified 3-node graph instead of the full 6-node Python workflow with 4 analyzer agents. This divergence went undetected until explicitly questioned.

### The Divergence

**Python Implementation:**
- 6 nodes: load_emails → retrieve_profile → analyze_all → reconcile → update_memory → advance_email
- 4 specialized analyzer agents (Demographics, Household, Interests, Purchase)
- Full WorkflowState with ~20 fields
- Batch processing for 20-30x performance
- Evidence judge integration
- Reconciliation and confidence management

**TypeScript Implementation (WRONG):**
- 3 nodes: prepare → classify → store
- No analyzer agents
- Simplified state
- Missing batch processing
- Missing reconciliation

### How It Happened

1. Previous session created simplified version (unknown reason)
2. Continuation session saw failing tests
3. Fixed tests to pass without verifying against Python source
4. Marked as complete

### Root Cause

**Missing verification step:** No mandatory check for 1:1 correspondence with Python before modifying migrated code.

---

## The Fix: Migration Verification Protocol

### New Skill: `migration-verification`

**Location:** `.claude/skills/migration-verification/SKILL.md`

**When MANDATORY:**
1. Before fixing ANY bug in migrated code
2. Before modifying ANY migrated code  
3. When tests fail for migrated components
4. When continuing work on partial migrations

### The 4-Step Protocol

```
Step 1: Locate Python Source (MANDATORY)
├─ Search migration spec: docs/migration/*SPEC.md
├─ Search Python source: src/email_parser/**/*.py
└─ If not found → STOP and ask user

Step 2: Compare Structures (MANDATORY)
├─ Count nodes/functions/fields
├─ Compare names
├─ Compare logic flow
└─ If mismatch → STOP and report divergence

Step 3: Root Cause Analysis (MANDATORY)
├─ Compare failing code paths
├─ Document differences
└─ Explain dependency chain

Step 4: Fix with Verification
├─ Make fix that maintains 1:1
├─ Run tests
└─ Verify against Python behavior
```

### Red Flags That Trigger This Skill

**Immediate:**
- "This test is failing"
- "Found a bug in X"
- "Need to fix Y"
- Modifying ANY file in `src/browser/` with Python equivalent

**Context:**
- Continuing from previous session
- Migration work in progress (check todo list)

---

## Enforcement

### Skills Integration

**Before `testing-discipline`:**
- Must use `migration-verification` when tests fail

**Before `systematic-debugging`:**
- Must verify 1:1 match before debugging

**Before `git-workflow-discipline`:**
- Cannot commit divergent code

### TodoWrite Protocol

Migration todos now require verification metadata:

```json
{
  "content": "Port X from Python",
  "verification": {
    "python_source": "src/email_parser/path/file.py",
    "spec_doc": "docs/migration/X_SPEC.md",
    "verified_1_to_1": true
  }
}
```

### Checklist for Every Migration Task

**Before writing TypeScript:**
- [ ] Located Python source file
- [ ] Read spec document
- [ ] Compared structures
- [ ] Confirmed 1:1 match

**Before fixing bugs:**
- [ ] Used migration-verification skill
- [ ] Found root cause via Python comparison
- [ ] Fix maintains 1:1 match

**Before marking complete:**
- [ ] Tests pass
- [ ] Verified against Python
- [ ] No divergence from spec

---

## Example: Correct vs Wrong

### WRONG (What Happened)

```
1. See failing test
2. Read TypeScript code
3. Fix to pass tests
4. Mark complete
❌ No Python comparison
❌ Divergence undetected
```

### CORRECT (New Protocol)

```
1. See failing test
2. Use migration-verification skill
   ├─ Find Python source
   ├─ Compare structures
   └─ Detect divergence
3. Report to user: "Code diverges from Python spec"
4. Get approval to fix properly
5. Implement 1:1 port
✅ Divergence prevented
```

---

## Current Action Items

1. ✅ Created `migration-verification` skill
2. ⏳ Review all migrated code for divergences
3. ⏳ Complete proper 1:1 IABClassifier port
4. ⏳ Update all migration specs with verification checklist
5. ⏳ Add migration-verification to session startup protocol

---

## Key Principle

**FULL PORT, NO COMPROMISES** means:

- Port bugs and all
- No "improvements" during migration
- No simplifications
- No "better" approaches
- 1:1 correspondence is LAW

If Python code is wrong → port it wrong → fix in BOTH places.
Never fix in TypeScript only.

---

**Last Updated:** 2025-01-07
**Next Review:** After completing proper IABClassifier port
