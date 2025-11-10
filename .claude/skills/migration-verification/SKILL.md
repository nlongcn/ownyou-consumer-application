---
name: migration-verification
description: MANDATORY verification before fixing bugs or modifying ANY migrated code. Prevents divergence from Python source. Use when encountering bugs in migrated TypeScript code, before making changes, or when tests fail.
---

# Migration Verification Skill

**CRITICAL: Use this skill BEFORE fixing any bug in migrated code.**

## When to Use This Skill

1. **Before fixing ANY bug** in migrated TypeScript code
2. **Before modifying ANY migrated code**
3. **When tests fail** for migrated components
4. **When encountering errors** in migrated code
5. **When continuing work** on partially migrated systems

**DO NOT skip this verification. It prevents cascading divergence.**

## The Verification Protocol

### Step 1: Locate Python Source (MANDATORY)

Before touching TypeScript, find the exact Python file:

```bash
# Search for migration spec
find docs/migration -name "*SPEC.md" -o -name "*EXTRACTION.md" | grep -i <component>

# If no spec, search Python source
find src/email_parser -name "*.py" | xargs grep -l <function_name>
```

**If you cannot find Python source:**
```
STOP. Ask user:
"I found TypeScript code for X but cannot locate the Python source.
This might be:
1. New code that shouldn't exist (violates FULL PORT mandate)
2. Spec document missing
3. Wrong search terms

Where is the Python source for X?"
```

### Step 2: Compare Structures (MANDATORY)

Open both files side-by-side:

**Python:**
```python
# src/email_parser/workflow/graph.py
def build_workflow_graph(config):
    graph = StateGraph(WorkflowState)
    graph.add_node("load_emails", load_emails_node)
    graph.add_node("retrieve_profile", retrieve_profile_node)
    graph.add_node("analyze_all", analyze_all_node)
    graph.add_node("reconcile", reconcile_node)
    graph.add_node("update_memory", update_memory_node)
    # ... 6 nodes total
```

**TypeScript:**
```typescript
// src/browser/agents/iab-classifier/index.ts
const graph = new StateGraph(IABClassifierState)
  .addNode('prepare', prepareNode)
  .addNode('classify', classifyNode)
  .addNode('store', storeNode)
  // ... 3 nodes total
```

**Question checklist:**
- [ ] Same number of nodes?
- [ ] Same node names?
- [ ] Same edges?
- [ ] Same state fields?
- [ ] Same helper functions?

**If ANY answer is NO:**
```
STOP. This is NOT a 1:1 port. Report to user:
"The TypeScript implementation diverges from Python:
- Python has 6 nodes: [list]
- TypeScript has 3 nodes: [list]
- Missing: [list]

This violates FULL PORT mandate. Should I:
1. Complete the proper 1:1 port
2. Document why this divergence exists
3. Something else?"
```

### Step 3: Root Cause Analysis (MANDATORY)

Only after confirming 1:1 match, analyze the bug:

**Compare the failing code paths:**

Python:
```python
# Line 206-209 in analyzers.py
classification: IABClassification = {
    "textPreview": state.text.substring(0, 200),
    "timestamp": new Date().toISOString(),
}
```

TypeScript:
```typescript
// What do we have?
// What's different?
// What's the dependency chain?
```

**Document:**
```markdown
## Root Cause

Python (line X): Does Y
TypeScript (line Z): Does W

Difference: [explain]
Dependency: [explain what depends on this]
Fix: [explain proper fix that maintains 1:1]
```

### Step 4: Fix with Verification

Make the fix, then verify it maintains 1:1:

```bash
# Run the specific test
npm test -- <test-file>

# Verify against Python behavior
# Document what Python does in same scenario
```

## Red Flags That Trigger This Skill

**Immediate triggers:**
- "This test is failing"
- "Found a bug in X"
- "Need to fix Y"
- "Tests are broken"
- Modifying ANY file in `src/browser/` that has Python equivalent

**Context triggers:**
- Continuing from previous session
- Working on migration tasks
- Porting is incomplete (check todo list)

## Example: Correct Usage

```
User: "The IABClassifier tests are failing"
AI (CORRECT): "Using migration-verification skill..."

Step 1: Find Python source
- Search: find docs/migration -name "*IAB*SPEC.md"
- Found: docs/migration/PYTHON_IAB_CLASSIFIER_SPEC.md
- Read spec...

Step 2: Compare structures
Python workflow (from spec):
- 6 nodes: load_emails, retrieve_profile, analyze_all, reconcile, update_memory, advance_email
- 4 analyzers inside analyze_all
- Full WorkflowState with ~20 fields

TypeScript implementation (actual):
- 3 nodes: prepare, classify, store
- No analyzers
- Simplified state

DIVERGENCE DETECTED. This is NOT a 1:1 port.

User, I found a critical issue:
The TypeScript IABClassifier is not a 1:1 port of the Python workflow.
It's missing 3 nodes and 4 analyzer agents.

Should I:
1. Complete the proper 1:1 port from the spec
2. Keep this as a demo and port the real one separately
```

**Compare to WRONG approach (what I did):**

```
User: "The IABClassifier tests are failing"

AI (WRONG): "Let me fix the tests..."
- Read test file
- Read TypeScript implementation
- Make changes to pass tests
- Mark complete

RESULT: Tests pass but code is still wrong
```

## Integration with Other Skills

**This skill is REQUIRED BEFORE:**
- `testing-discipline` - Can't write tests for wrong code
- `systematic-debugging` - Can't debug without knowing what's correct
- `git-workflow-discipline` - Can't commit wrong code

**Trigger from other skills:**
When `testing-discipline` finds failing tests, it MUST invoke `migration-verification` first.

## Enforcement Mechanism

Add to TodoWrite protocol:

```typescript
Before marking ANY migration todo as "in_progress":
1. Use migration-verification skill
2. Confirm 1:1 match with Python
3. Document verification in todo comment
```

**Todo template for migration work:**
```json
{
  "content": "Port X from Python",
  "status": "in_progress",
  "activeForm": "Porting X",
  "verification": {
    "python_source": "src/email_parser/path/to/file.py",
    "spec_doc": "docs/migration/X_SPEC.md",
    "verified_1_to_1": true,
    "verification_date": "2025-01-07"
  }
}
```

## Checklist for Every Migration Task

Before writing ANY TypeScript for migration:

- [ ] Located Python source file
- [ ] Read relevant spec document
- [ ] Compared structures (nodes, functions, fields)
- [ ] Confirmed 1:1 match
- [ ] Documented any approved divergences

Before fixing ANY bug in migrated code:

- [ ] Used migration-verification skill
- [ ] Found root cause by comparing Python/TypeScript
- [ ] Verified fix maintains 1:1 match
- [ ] Updated tests to match Python tests

Before marking migration todo complete:

- [ ] All tests pass
- [ ] Verified against Python behavior
- [ ] Confirmed no divergence from spec
- [ ] Documented verification

## FAQ

**Q: What if Python code is wrong?**
A: Port it wrong. Then fix it in Python AND TypeScript. Never diverge.

**Q: What if Python has a bug?**
A: Ask user. Don't assume.

**Q: What if I find better approach in TypeScript?**
A: FULL PORT means NO IMPROVEMENTS during migration. Port first, improve later.

**Q: What if previous session created wrong code?**
A: Use this skill to detect it. Report to user immediately.

**Q: How do I prevent this in future sessions?**
A: This skill is now MANDATORY for ALL migration work. No exceptions.
