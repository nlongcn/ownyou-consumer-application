---
name: sprint-mode
description: Enforce sprint-focused development workflow for OwnYou. Use when starting ANY sprint task, implementing packages, or when asked to work on sprint deliverables. Ensures work stays aligned with sprint spec and v13 architecture.
---
# Sprint Mode

**MANDATORY workflow for ALL sprint-based development in OwnYou.**

## When to Use This Skill

- **Starting ANY sprint task**
- **User says "start sprint", "work on package X", "implement X from sprint"**
- **Beginning a new development session**
- **Before implementing any sprint package**

## Sprint Mode Activation

### Step 1: Load Sprint Context

**FIRST, read the current sprint specification:**

```
Read: docs/sprints/ownyou-sprint*-spec.md
```

**Extract and understand:**

1. Sprint goals and deliverables
2. Package breakdown (what to implement)
3. Acceptance criteria for each package
4. Dependencies between packages

### Step 2: Load Relevant Architecture Extracts

**Based on the package you're implementing, load relevant extracts:**

| Package Type    | Load These Extracts                                               |
| --------------- | ----------------------------------------------------------------- |
| Memory/Store    | `extracts/memory-types-8.4.md`, `extracts/namespaces-8.12.md` |
| Storage Backend | `extracts/storage-backends-8.13.md`                             |
| LLM Integration | `extracts/llm-cost-6.10.md`                                     |
| Sync Features   | `extracts/sync-8.14.md`                                         |

```
Read: docs/architecture/extracts/{relevant-extract}.md
```

### Step 3: Create Sprint TodoWrite

**Create todos for the sprint work:**

```python
todos = [
    # Context loading
    {"content": "Load sprint spec", "status": "completed", "activeForm": "Loading sprint spec"},
    {"content": "Load architecture extracts", "status": "completed", "activeForm": "Loading architecture extracts"},

    # Package implementation (example)
    {"content": "Implement Package 1: shared-types", "status": "in_progress", "activeForm": "Implementing shared-types"},
    {"content": "Write tests for shared-types", "status": "pending", "activeForm": "Writing tests for shared-types"},
    {"content": "Verify v13 compliance", "status": "pending", "activeForm": "Verifying v13 compliance"},
    {"content": "Commit shared-types", "status": "pending", "activeForm": "Committing shared-types"},

    # Continue with next packages...
]
```

### Step 4: Implement Package-by-Package

**For EACH package in the sprint:**

1. **Read package spec** from sprint document
2. **Identify acceptance criteria**
3. **Use `implement-package` skill** for implementation
4. **Use `v13-compliance-check` skill** before marking complete
5. **Commit after each package**

## Sprint Workflow Decision Tree

```
Starting sprint work?
├─ Have you read the sprint spec?
│   ├─ NO → STOP. Read docs/sprints/ownyou-sprint0-spec.md first
│   └─ YES → Continue
├─ Have you loaded relevant architecture extracts?
│   ├─ NO → STOP. Load from docs/architecture/extracts/
│   └─ YES → Continue
├─ Have you created TodoWrite with packages?
│   ├─ NO → STOP. Create todos for each package
│   └─ YES → Continue
└─ Proceed with package implementation
```

## Package Implementation Order

**ALWAYS respect package dependencies:**

```
Sprint 0 Example:
├── Package 1: shared-types (no dependencies)
├── Package 2: memory-store (depends on shared-types)
├── Package 3: embedding-service (depends on shared-types)
├── Package 4: sync-layer (depends on memory-store)
└── Package 5: integration tests (depends on all above)
```

**Decision Tree:**

```
Ready to implement Package N?
├─ Are all dependencies complete?
│   ├─ NO → STOP. Complete dependencies first
│   └─ YES → Continue
├─ Have you loaded the package spec?
│   ├─ NO → STOP. Read package section from sprint spec
│   └─ YES → Continue
└─ Use implement-package skill
```

## Integration with Other Skills

**Sprint mode orchestrates these skills:**

1. **`implement-package`** - For each package implementation
2. **`v13-compliance-check`** - Before marking package complete
3. **`git-workflow-discipline`** - For commits and branches
4. **`testing-discipline`** - For TDD within packages

## Common Mistakes

**❌ Don't:**

- Start implementing without reading sprint spec
- Skip architecture extracts loading
- Implement packages out of dependency order
- Mark package complete without v13 compliance check
- Mix work from different packages in one commit

**✅ Do:**

- Always load sprint context first
- Load relevant architecture extracts
- Implement packages in dependency order
- Use v13-compliance-check before marking complete
- One package per commit (or logical unit)

## Sprint Status Tracking

**Update sprint status as you work:**

```python
# In sprint spec or separate status file
sprint_status = {
    "sprint": "Sprint 0",
    "packages": {
        "shared-types": "complete",
        "memory-store": "in_progress",
        "embedding-service": "pending",
        "sync-layer": "pending",
        "integration-tests": "pending"
    },
    "last_updated": "2025-12-01"
}
```

## AI Assistant Protocol

**When user asks to work on a sprint:**

1. **Activate sprint-mode skill**
2. **Announce:** "I'm using sprint-mode to load context and plan the work."
3. **Read sprint spec**
4. **Ask which package** if not specified
5. **Load relevant extracts**
6. **Create TodoWrite**
7. **Begin implementation** with implement-package skill

**Example Response:**

```
I'm using sprint-mode to work on Sprint 0.

Let me first load the sprint context:
1. Reading sprint spec...
2. Loading relevant architecture extracts...
3. Creating implementation plan...

Sprint 0 has 5 packages:
1. shared-types (no deps) ← Start here
2. memory-store (depends on 1)
3. embedding-service (depends on 1)
4. sync-layer (depends on 2)
5. integration-tests (depends on all)

Which package would you like me to implement first?
```

## Validation Checklist

Before marking sprint work complete:

- [ ] Sprint spec read and understood
- [ ] All packages implemented in dependency order
- [ ] Each package passed v13-compliance-check
- [ ] All tests passing
- [ ] Code committed with meaningful messages
- [ ] Sprint status updated
