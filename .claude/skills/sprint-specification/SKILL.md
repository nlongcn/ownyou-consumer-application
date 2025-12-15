---
name: sprint-specification
description: Create comprehensive sprint specification documents for OwnYou development. This skill should be used when the user requests a new sprint spec (e.g., "create a specification doc for Sprint 11", "draft the sprint 12 spec", "generate a new sprint specification"). It reviews the architecture (v13) and strategic roadmap to produce specifications that align with project standards.
---

# Sprint Specification Creation

## Overview

This skill creates comprehensive sprint specification documents for OwnYou consumer application development. It ensures all specifications align with the v13 architecture document and follow the established patterns from previous sprint specs.

## When To Use This Skill

Trigger this skill when the user requests:
- "Create a specification doc for Sprint N"
- "Draft the sprint X spec"
- "Generate a new sprint specification"
- "Write a spec for [feature/sprint]"
- Any request to create sprint planning documentation

## Mandatory Source Documents

Before creating any sprint specification, ALWAYS read these documents:

| Document | Path | Purpose |
|----------|------|---------|
| **Architecture (v13)** | `docs/architecture/OwnYou_architecture_v13.md` | Core architecture, ALL features must comply |
| **Strategic Roadmap** | `docs/roadmap/OwnYou_strategic_roadmap_v2.md` | Sprint sequence, dependencies, v13 coverage matrix |
| **Previous Sprint** | `docs/sprints/ownyou-sprint{N-1}-spec.md` | Current state, completed features, test counts |

## Creation Workflow

### Step 1: Gather Context

1. Read the architecture document (`docs/architecture/OwnYou_architecture_v13.md`)
2. Read the strategic roadmap (`docs/roadmap/OwnYou_strategic_roadmap_v2.md`)
3. Read the most recent sprint spec to understand current system state
4. Identify which v13 sections this sprint addresses (from roadmap coverage matrix)

### Step 2: Identify Dependencies

1. Check the roadmap's "Sprint Dependency Graph" section
2. List packages from previous sprints this sprint depends on
3. Identify any external dependencies (NPM packages, APIs, services)

### Step 3: Use Context7 for Third-Party Packages

**MANDATORY:** For ANY third-party library or package mentioned in the spec:

1. Use `mcp__context7__resolve-library-id` to find the correct library ID
2. Use `mcp__context7__get-library-docs` to fetch current documentation
3. Include accurate version numbers and API patterns in the spec

Example workflow:
```
1. resolve-library-id: "orbitdb"
2. get-library-docs: "/orbitdb/orbitdb" topic="getting started"
3. Include correct import patterns and API usage in spec
```

### Step 4: Draft the Specification

Create the spec at: `docs/sprints/ownyou-sprint{N}-spec.md`

## Specification Template

Every sprint spec MUST include these sections (see `references/sprint-spec-template.md` for full template):

### Required Sections Checklist

| Section | Required | Description |
|---------|----------|-------------|
| Title & Metadata | YES | Sprint number, duration, status, goal, success criteria |
| Dependencies | YES | Previous sprint, v13 sections covered |
| Previous Sprint Summary | YES | What was completed, current state |
| Sprint Overview | YES | ASCII diagram showing week-by-week flow |
| v13 Architecture Compliance | YES | Table mapping v13 sections to implementations |
| Package Specifications | YES | Per-package: purpose, dependencies, directory structure, types, success criteria |
| Implementation Requirements | YES | Lessons learned constraints (C1-C3, I1-I3) |
| Week-by-Week Breakdown | YES | Daily tasks with checkboxes |
| Test Targets | YES | Per-package test counts |
| Success Metrics | YES | Measurable targets |
| Dependencies & External Services | YES | NPM packages with versions, infrastructure requirements |
| Risks | YES | Technical risks with likelihood/impact/mitigation |
| Files to Create/Modify | YES | New files and modified files tables |
| Key Architectural Decisions | YES | Major decisions with rationale |
| Document History | YES | Version tracking |

## Implementation Requirements (From Previous Sprints)

ALWAYS include these mandatory patterns in every spec:

### C1: Namespace Usage
```typescript
// NEVER do this
await store.put('ownyou.sync.status', key, value);

// ALWAYS use NS.* factory functions
import { NS } from '@ownyou/shared-types';
await store.put(NS.syncStatus(deviceId), key, value);
```

### C2: Unconditional Data Writes
```typescript
// NEVER do this
if (items.length > 0) {
  await store.put(namespace, key, items);
}

// ALWAYS write, even when empty
await store.put(namespace, key, {
  items: items,
  isEmpty: items.length === 0,
  updatedAt: Date.now(),
});
```

### I2: Extract Magic Numbers to Config
```typescript
// NEVER do this
const maxRetries = 3;
const timeout = 30000;

// ALWAYS extract to typed config objects
export interface FeatureConfig {
  maxRetries: number;
  timeoutMs: number;
}

export const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  maxRetries: 3,
  timeoutMs: 30000,
};
```

### I3: Integration Tests for Main Flow
Every sprint MUST include integration tests that validate the complete flow from trigger to result.

## Agent Architecture Conformance

When a sprint includes new agents, include this mandatory section:

```markdown
### Agent Conformance Checklist

Before implementing ANY new agent:
1. Read `packages/agents/base/src/base-agent.ts` (understand contract)
2. Read `packages/agents/restaurant/src/agent.ts` (see pattern in practice)

| Requirement | Pattern |
|-------------|---------|
| Extends BaseAgent | `class XAgent extends BaseAgent` |
| Has agentType | `readonly agentType = 'x' as const` |
| Has level | `readonly level = 'L2' as const` |
| Implements execute | `protected async execute(ctx: AgentContext): Promise<AgentResult>` |
| Has permissions | `export const X_PERMISSIONS: AgentPermissions = { ... }` |
| Returns MissionCard | `return { success: true, missionCard }` |
```

## Package Specification Template

For each new package, include:

```markdown
### Package N: `@ownyou/package-name`

**Purpose:** One-line description

**Dependencies:**
- `@ownyou/shared-types` (namespaces)
- `@ownyou/store` (local store)
- External: `library-name` (v1.x) — purpose

**Directory Structure:**
\`\`\`
packages/package-name/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   └── feature/
│       └── implementation.ts
└── __tests__/
    └── feature.test.ts
\`\`\`

**Core Types:**
\`\`\`typescript
// Include actual TypeScript interfaces
\`\`\`

**Success Criteria:**
- [ ] Feature X working
- [ ] Feature Y integrated
- [ ] 80%+ test coverage
```

## Output Location

Save the completed specification to:
```
docs/sprints/ownyou-sprint{N}-spec.md
```

## Validation Checklist

Before marking the spec complete, verify:

- [ ] All v13 sections for this sprint are mapped in compliance table
- [ ] All dependencies from roadmap are listed
- [ ] Third-party package versions verified via context7
- [ ] Previous sprint summary accurately reflects current state
- [ ] Test targets are realistic based on previous sprint patterns
- [ ] Week-by-week breakdown includes all packages
- [ ] Success metrics are measurable
- [ ] Risks include mitigations
- [ ] Document history includes version 1 entry
