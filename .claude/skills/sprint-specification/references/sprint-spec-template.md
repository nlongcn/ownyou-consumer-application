# Sprint Specification Template

Use this template when creating new sprint specifications. Replace all placeholders in `{curly braces}`.

---

```markdown
# Sprint {N}: {Sprint Title}

**Duration:** {N} weeks
**Status:** {PLANNED | IN_PROGRESS | COMPLETE}
**Goal:** {One sentence describing the sprint goal}
**Success Criteria:** {Comma-separated list of measurable outcomes}
**Depends On:** Sprint {N-1} complete ({previous sprint name})
**v13 Coverage:** Section {X} ({section name}), Section {Y} ({section name})
**Tests:** {Expected test count} (package1: {N}, package2: {N})

---

## Previous Sprint Summary

### Sprint {N-1}: {Previous Sprint Name} (COMPLETE)

- `@ownyou/{package1}` — {brief description} ({N} tests)
- `@ownyou/{package2}` — {brief description} ({N} tests)
- Total: {N} tests

**Current State:**

- {Bullet point describing current system capability}
- {Bullet point describing what's working}
- {Bullet point describing what's NOT yet implemented}

---

## Sprint {N} Overview

```
+------------------------------------------------------------------+
|                     SPRINT {N} END STATE                          |
+------------------------------------------------------------------+
|                                                                   |
|  WEEK 1: {WEEK 1 THEME}                                           |
|  +----------------------------------------------------------+     |
|  | [{Step 1}]                                               |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [{Step 2}]                                               |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [{Step 3}]                                               |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 2: {WEEK 2 THEME}                                           |
|  +----------------------------------------------------------+     |
|  | [{Step 1}]                                               |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [{Step 2}]                                               |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  {SPRINT OUTCOME SUMMARY}                                         |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture Compliance

### Target Sections: v13 Section {X} ({Section Name})

| v13 Section | Requirement | Sprint {N} Implementation | Priority |
|-------------|-------------|---------------------------|----------|
| **{X.1}** | {Requirement name} | {How it's implemented} | P0 |
| **{X.2}** | {Requirement name} | {How it's implemented} | P0 |
| **{X.3}** | {Requirement name} | {How it's implemented} | P1 |

### Already Complete (from previous sprints)

| v13 Section | Requirement | Status |
|-------------|-------------|--------|
| **{Y.1}** | {Requirement name} | ✅ Sprint {M} |
| **{Y.2}** | {Requirement name} | ✅ Sprint {M} |

---

## Package Specifications

### Package 1: `@ownyou/{package-name}`

**Purpose:** {One-line description of what this package does}

**Dependencies:**
- `@ownyou/shared-types` (namespaces)
- `@ownyou/store` (local store interface)
- `{external-package}` ({version}) — {purpose}

**Directory Structure:**
```
packages/{package-name}/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   └── {feature}/
│       └── {implementation}.ts
└── __tests__/
    └── {feature}.test.ts
```

#### Core Types (from v13 Section {X})

```typescript
// src/types.ts
export interface {TypeName} {
  // Field definitions with comments
  field1: string;
  field2: number;
}

export interface {AnotherType} {
  // More type definitions
}
```

#### Implementation Example

```typescript
// src/{feature}/{implementation}.ts
import { NS } from '@ownyou/shared-types';

export class {ClassName} {
  // Implementation details
}
```

**Namespace Updates Required:**

```typescript
// Add to @ownyou/shared-types/namespaces.ts
{NAMESPACE_CONSTANT}: 'ownyou.{namespace.path}',

// Add factory functions
{factoryName}: (id: string) => ['ownyou.{namespace.path}', id],
```

**Success Criteria:**
- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}
- [ ] 80%+ test coverage

---

### Package 2: `@ownyou/{package-name-2}`

{Repeat the package specification structure}

---

## Implementation Requirements

### From Previous Sprint Lessons Learned (MANDATORY)

#### C1: Namespace Usage
```typescript
// ❌ NEVER do this
await store.put('ownyou.{namespace}', key, value);

// ✅ ALWAYS use NS.* factory functions
import { NS } from '@ownyou/shared-types';
await store.put(NS.{factoryName}(id), key, value);
```

#### C2: Unconditional Data Writes
```typescript
// ❌ NEVER do this
if (items.length > 0) {
  await store.put(namespace, key, items);
}

// ✅ ALWAYS write, even when empty
await store.put(namespace, key, {
  items: items,
  isEmpty: items.length === 0,
  updatedAt: Date.now(),
});
```

#### I1: Configurable Model Selection
```typescript
// ❌ NEVER hardcode model
const model = 'gpt-4o-mini';

// ✅ Make model configurable via settings
const model = config.modelSelection || DEFAULT_MODEL;
```

#### I2: Extract Magic Numbers to Config
```typescript
// ❌ NEVER do this
const maxItems = 100;
const timeout = 30000;

// ✅ Extract to typed config objects
export interface {Feature}Config {
  maxItems: number;
  timeoutMs: number;
}

export const DEFAULT_{FEATURE}_CONFIG: {Feature}Config = {
  maxItems: 100,
  timeoutMs: 30000,
};
```

#### I3: Integration Tests for Main Flow
```typescript
describe('{Feature} Integration', () => {
  it('should {complete the main flow}', async () => {
    // Setup
    const service = await create{Feature}({config});

    // Execute
    const result = await service.{mainMethod}({input});

    // Verify
    expect(result).toEqual(expect.objectContaining({
      // Expected output structure
    }));
  });
});
```

---

## Week-by-Week Breakdown

### Week 1: {Week 1 Theme}

**Day 1-2: {Focus Area}**
- [ ] {Task 1}
- [ ] {Task 2}
- [ ] {Task 3}

**Day 3-4: {Focus Area}**
- [ ] {Task 1}
- [ ] {Task 2}

**Day 5: {Focus Area}**
- [ ] {Task 1}
- [ ] Write unit tests (target: {N}+ tests)

### Week 2: {Week 2 Theme}

**Day 1-2: {Focus Area}**
- [ ] {Task 1}
- [ ] {Task 2}

**Day 3-4: {Focus Area}**
- [ ] {Task 1}
- [ ] {Task 2}

**Day 5: Integration**
- [ ] {Integration task 1}
- [ ] Write integration tests (target: {N}+ tests)
- [ ] Update documentation

---

## Test Targets

| Package | Target Tests | Focus Areas |
|---------|--------------|-------------|
| `@ownyou/{package1}` | {N}+ | {Focus area 1}, {focus area 2} |
| `@ownyou/{package2}` | {N}+ | {Focus area 1}, {focus area 2} |
| Integration tests | {N}+ | {End-to-end flow description} |
| **Total** | **{N}+** | |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage | >{N}% for all packages |
| {Metric 1} | {Target value} |
| {Metric 2} | {Target value} |
| {Metric 3} | {Target value} |

---

## Dependencies and External Services

### NPM Packages (from context7 lookup)

| Package | Version | Purpose |
|---------|---------|---------|
| `{package-name}` | ^{X.x} | {Purpose} |
| `{package-name-2}` | ^{X.x} | {Purpose} |

### Infrastructure Requirements

| Service | Purpose | Phase |
|---------|---------|-------|
| **{Service 1}** | {Purpose} | Sprint {N} |
| **{Service 2}** | {Purpose} | Sprint {N} |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| {Risk 1} | {Low/Medium/High} | {Low/Medium/High/Critical} | {Mitigation strategy} |
| {Risk 2} | {Low/Medium/High} | {Low/Medium/High/Critical} | {Mitigation strategy} |

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/{package}/package.json` | Package config |
| `packages/{package}/src/index.ts` | Public exports |
| `packages/{package}/src/types.ts` | Type definitions |
| `packages/{package}/src/{feature}/{file}.ts` | {Purpose} |

### Modified Files

| File | Change |
|------|--------|
| `packages/shared-types/src/namespaces.ts` | Add {NAMESPACE} namespaces |
| `packages/shared-types/src/index.ts` | Export new types |

---

## Key Architectural Decisions

### 1. {Decision Title}

**Decision:** {What was decided}

**Rationale:**
- {Reason 1}
- {Reason 2}
- {Reason 3}

### 2. {Another Decision Title}

**Decision:** {What was decided}

**Rationale:**
- {Reason 1}
- {Reason 2}

---

## Post-Sprint Action Items

After Sprint {N} completion:

- [ ] {Action item 1}
- [ ] {Action item 2}

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | {YYYY-MM-DD} | Initial Sprint {N} specification |

---

**Document Status:** Sprint {N} Specification v1 - {STATUS}
**Date:** {YYYY-MM-DD}
**Validates Against:** OwnYou_architecture_v13.md (Section {X}, Section {Y})
**Next Sprint:** Sprint {N+1} ({Next Sprint Name})
```
