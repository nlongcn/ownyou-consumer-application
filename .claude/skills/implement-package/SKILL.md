---
name: implement-package
description: Guide implementation of a sprint package following TDD, v13 architecture compliance, and proper documentation. Use when implementing any package from a sprint specification.
---

# Implement Package

**Structured workflow for implementing a single sprint package.**

## When to Use This Skill

- **Implementing a specific package from sprint spec**
- **After sprint-mode has loaded context**
- **User asks to implement a named package**

## Package Implementation Flow

### Phase 1: Understand the Package

**1.1 Read Package Specification**

From the sprint spec, extract:
- Package name and purpose
- Files to create
- Interfaces/types to implement
- Acceptance criteria
- Dependencies (must be complete)

**1.2 Verify Dependencies**

```
Are all dependency packages complete?
├─ NO → STOP. Use sprint-mode to complete dependencies first
└─ YES → Continue
```

**1.3 Load Architecture Context**

Load relevant extracts based on package type:
```
Read: docs/architecture/extracts/{relevant}.md
```

### Phase 2: TDD Implementation

**MANDATORY: Follow RED-GREEN-REFACTOR**

**2.1 Write Test First (RED)**

```typescript
// packages/package-name/src/__tests__/feature.test.ts
// (or packages/package-name/tests/feature.test.ts - choose one convention)
describe('FeatureName', () => {
  it('should satisfy acceptance criteria 1', () => {
    // Test implementation
    expect(feature.doThing()).toBe(expected);
  });

  it('should satisfy acceptance criteria 2', () => {
    // Test implementation
  });
});
```

**Run test - MUST FAIL:**
```bash
npm test -- packages/package-name/
```

**2.2 Implement Minimal Code (GREEN)**

Write MINIMAL code to make tests pass:
```typescript
// packages/package-name/src/feature.ts
export function doThing(): Result {
  // Minimal implementation
  return expected;
}
```

**Run test - MUST PASS:**
```bash
npm test -- packages/package-name/
```

**2.3 Refactor (REFACTOR)**

Improve code quality:
- Extract constants
- Add proper types
- Add documentation
- Follow v13 patterns

**Run test - MUST STILL PASS:**
```bash
npm test -- packages/package-name/
```

### Phase 3: V13 Compliance Check

**MANDATORY before marking package complete:**

Use `v13-compliance-check` skill:

```
Checklist:
- [ ] Uses STORE_NAMESPACES from v13 Section 8.12
- [ ] Memory types match v13 Section 8.4
- [ ] Follows LangGraph Store API (put/get/search/list/delete)
- [ ] Respects privacy tiers
- [ ] No separate databases created
```

### Phase 4: Documentation

**4.1 Add Code Comments**

```typescript
/**
 * MemoryStore - LangGraph Store wrapper for OwnYou
 *
 * Implements v13 Section 8.4 Memory Schema and Section 8.12 Namespaces.
 *
 * @see docs/architecture/extracts/memory-types-8.4.md
 * @see docs/architecture/extracts/namespaces-8.12.md
 */
export class MemoryStore {
  // ...
}
```

**4.2 Update Package Status**

In sprint spec or status tracking:
```
Package: memory-store
Status: COMPLETE
Completed: 2025-12-01
Tests: 15/15 passing
V13 Compliance: Verified
```

### Phase 5: Commit

**Single commit per package (or logical unit):**

```bash
git add packages/package-name/
git commit -m "feat(sprint0): implement package-name

- Implement Feature A per v13 Section X.Y
- Add tests for acceptance criteria
- V13 compliance verified

Acceptance Criteria:
- [x] Criterion 1
- [x] Criterion 2
- [x] Criterion 3"
```

## Package Implementation TodoWrite

```python
todos = [
    # Phase 1: Understand
    {"content": "Read package spec from sprint doc", "status": "completed", "activeForm": "Reading package spec"},
    {"content": "Verify dependencies complete", "status": "completed", "activeForm": "Verifying dependencies"},
    {"content": "Load architecture extracts", "status": "completed", "activeForm": "Loading architecture extracts"},

    # Phase 2: TDD
    {"content": "Write tests for package (RED)", "status": "in_progress", "activeForm": "Writing tests"},
    {"content": "Run tests - verify FAIL", "status": "pending", "activeForm": "Running tests"},
    {"content": "Implement minimal code (GREEN)", "status": "pending", "activeForm": "Implementing minimal code"},
    {"content": "Run tests - verify PASS", "status": "pending", "activeForm": "Running tests"},
    {"content": "Refactor code (REFACTOR)", "status": "pending", "activeForm": "Refactoring code"},
    {"content": "Run tests - verify still PASS", "status": "pending", "activeForm": "Running tests"},

    # Phase 3: Compliance
    {"content": "V13 compliance check", "status": "pending", "activeForm": "Checking v13 compliance"},

    # Phase 4: Documentation
    {"content": "Add code comments", "status": "pending", "activeForm": "Adding comments"},
    {"content": "Update package status", "status": "pending", "activeForm": "Updating status"},

    # Phase 5: Commit
    {"content": "Commit package", "status": "pending", "activeForm": "Committing package"},
]
```

## Decision Trees

### Can I Start Implementation?

```
Ready to implement?
├─ Have you read package spec?
│   ├─ NO → STOP. Read from sprint doc
│   └─ YES → Continue
├─ Are dependencies complete?
│   ├─ NO → STOP. Complete dependencies first
│   └─ YES → Continue
├─ Have you loaded architecture extracts?
│   ├─ NO → STOP. Load relevant extracts
│   └─ YES → Continue
└─ Start with tests (RED phase)
```

### Can I Mark Package Complete?

```
Ready to mark complete?
├─ All tests passing?
│   ├─ NO → STOP. Fix failures
│   └─ YES → Continue
├─ V13 compliance verified?
│   ├─ NO → STOP. Run v13-compliance-check skill
│   └─ YES → Continue
├─ Code documented?
│   ├─ NO → STOP. Add comments
│   └─ YES → Continue
├─ Changes committed?
│   ├─ NO → STOP. Commit first
│   └─ YES → Mark complete
```

## Common Package Types

### Type 1: Shared Types Package

```typescript
// packages/shared-types/src/index.ts
export interface Memory { /* v13 Section 8.4.1 */ }
export interface Episode { /* v13 Section 8.4.2 */ }
export interface Entity { /* v13 Section 8.4.4 */ }
export const STORE_NAMESPACES = { /* v13 Section 8.12 */ };
```

**Tests:** Type compilation, exports exist

### Type 2: Store Implementation Package

```typescript
// packages/memory-store/src/index.ts
export class MemoryStore {
  async put(namespace, key, value) { /* LangGraph Store API */ }
  async get(namespace, key) { /* LangGraph Store API */ }
  async search(params) { /* LangGraph Store API */ }
  async list(namespace) { /* LangGraph Store API */ }
  async delete(namespace, key) { /* LangGraph Store API */ }
}
```

**Tests:** CRUD operations, namespace isolation, search functionality

### Type 3: Service Package

```typescript
// packages/llm-client/src/index.ts
export class LLMClient {
  async chat(messages: Message[]): Promise<string> { /* OpenAI/Claude */ }
  async trackCost(usage: TokenUsage): Promise<void> { /* Budget tracking */ }
}
```

**Tests:** API calls, budget enforcement, fallback chains

## Validation Checklist

Before marking ANY package complete:

- [ ] Package spec fully understood
- [ ] All dependencies are complete
- [ ] Tests written FIRST (RED phase)
- [ ] Tests failed before implementation
- [ ] Minimal implementation created (GREEN phase)
- [ ] All tests passing
- [ ] Code refactored (REFACTOR phase)
- [ ] Tests still passing after refactor
- [ ] V13 compliance verified
- [ ] Code comments added
- [ ] Package status updated
- [ ] Changes committed
