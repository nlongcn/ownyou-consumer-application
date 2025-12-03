---
description: Load sprint context and begin Sprint 0 development workflow
allowed-tools: Read, Glob, Grep, TodoWrite, Skill
---
# Start Sprint Command

Load sprint context and begin development workflow.

## Instructions

When this command is invoked:

1. **Read the current sprint specification:**

   - File: `docs/sprints/`
   - Extract: Sprint goals, packages, acceptance criteria
2. **Identify available packages:**

   - List all packages from the sprint spec
   - Show their dependency order
   - Indicate which are complete/pending
3. **Load relevant architecture extracts:**

   - Based on sprint scope, load from `docs/architecture/extracts/`
4. **Activate sprint-mode skill:**

   - Use the `sprint-mode` skill for workflow enforcement
5. **Ask user which package to implement:**

   - Present the package list
   - Recommend starting with first incomplete package that has all dependencies met

## Expected Output

```
## Sprint 0: Foundation

### Sprint Goals
- Establish packages/ directory with pnpm workspaces
- Implement shared types per v13
- Create memory store with IndexedDB + SQLite backends
- LLM client with budget tracking
- Observability package for agent traces

### Packages (Dependency Order)

| # | Package | Location | Status | Dependencies |
|---|---------|----------|--------|--------------|
| 1 | shared-types | `packages/shared-types/` | ⏳ Pending | None |
| 2 | memory-store | `packages/memory-store/` | ⏳ Pending | shared-types |
| 3 | llm-client | `packages/llm-client/` | ⏳ Pending | shared-types |
| 4 | observability | `packages/observability/` | ⏳ Pending | shared-types |
| 5 | integration-tests | `packages/integration-tests/` | ⏳ Pending | All above |

### Architecture Context Loaded
- ✅ namespaces-8.12.md
- ✅ memory-types-8.4.md
- ✅ storage-backends-8.13.md

### Recommendation
Start with Package 1: shared-types (no dependencies)

Which package would you like to implement?
```

## Usage

```
/start-sprint
```

Or with specific package:

```
/start-sprint memory-store
```
