# Sprint 4: Learning Loop Test Infrastructure Plan

**Version:** 1.0
**Created:** 2024-12-04
**Status:** Planning

---

## Overview

This document outlines the testing infrastructure required for Sprint 4's Memory Architecture and Learning Loop. The tests verify that the full feedback cycle works: user feedback → episode creation → Reflection Node → procedural rule synthesis → improved agent behavior.

---

## Test Categories

### 1. Unit Tests (Vitest)

Located in `packages/memory-store/__tests__/` and `packages/agents/__tests__/`

#### 1.1 Memory Store Tests
```
__tests__/
├── embeddings/
│   ├── embedding-generator.test.ts   # Vector embedding generation
│   ├── embedding-cache.test.ts       # Caching behavior
│   └── embedding-similarity.test.ts  # Cosine similarity calculations
├── retrieval/
│   ├── semantic-search.test.ts       # Vector similarity search
│   ├── bm25-search.test.ts           # Keyword search
│   ├── hybrid-retrieval.test.ts      # RRF fusion
│   └── filter-queries.test.ts        # Namespace/metadata filtering
├── lifecycle/
│   ├── memory-decay.test.ts          # 5%/week decay calculation
│   ├── memory-pruning.test.ts        # Threshold-based removal
│   ├── memory-consolidation.test.ts  # Duplicate merging
│   └── memory-archival.test.ts       # Cold storage migration
└── namespace/
    ├── namespace-isolation.test.ts   # Cross-user isolation
    └── privacy-tiers.test.ts         # Access controls
```

#### 1.2 Reflection Node Tests
```
__tests__/
├── reflection/
│   ├── episode-analysis.test.ts      # Pattern detection in episodes
│   ├── rule-synthesis.test.ts        # Procedural rule generation
│   ├── rule-validation.test.ts       # Rule quality checks
│   ├── entity-extraction.test.ts     # v13 8.4.5 compliance
│   └── context-injection.test.ts     # v13 8.8.2 compliance
└── agents/
    ├── shopping-agent.test.ts        # Shopping agent behavior
    └── content-agent.test.ts         # Content agent behavior
```

### 2. Integration Tests (Vitest)

Located in `packages/integration-tests/src/__tests__/`

#### 2.1 Learning Loop Integration
```typescript
// learning-loop.integration.test.ts

describe('Learning Loop Integration', () => {
  describe('Feedback → Episode Flow', () => {
    it('should create episode when user provides mission feedback', async () => {
      // 1. Create mission card
      // 2. Simulate user feedback (love/like/meh)
      // 3. Verify episode created with correct outcome
      // 4. Verify episode linked to mission
    });

    it('should update episode stats after feedback', async () => {
      // 1. Record initial stats
      // 2. Provide feedback
      // 3. Verify stats updated (positive/negative counts)
    });
  });

  describe('Episode → Reflection Flow', () => {
    it('should trigger Reflection Node after threshold episodes', async () => {
      // 1. Create 10+ episodes for agent
      // 2. Trigger Reflection Node
      // 3. Verify procedural rules generated
    });

    it('should extract entities from new memories', async () => {
      // 1. Create semantic memory entries
      // 2. Run entity extraction
      // 3. Verify entities stored in relational memory
      // 4. Verify relationships created
    });
  });

  describe('Rule → Behavior Flow', () => {
    it('should apply procedural rules to agent decisions', async () => {
      // 1. Create procedural rule (e.g., "avoid crypto content")
      // 2. Inject context into agent
      // 3. Verify agent respects rule
    });

    it('should inject memory context into agent prompts', async () => {
      // 1. Create relevant semantic memories
      // 2. Build agent context
      // 3. Verify context includes memories, episodes, rules
    });
  });
});
```

#### 2.2 Memory Retrieval Integration
```typescript
// memory-retrieval.integration.test.ts

describe('Hybrid Retrieval Integration', () => {
  it('should combine semantic and keyword search', async () => {
    // 1. Create memories with known content
    // 2. Search with query that matches semantically
    // 3. Search with query that matches keywords
    // 4. Verify RRF fusion ranking
  });

  it('should respect namespace isolation', async () => {
    // 1. Create memories for user_a
    // 2. Create memories for user_b
    // 3. Search as user_a
    // 4. Verify only user_a memories returned
  });

  it('should apply privacy tier filtering', async () => {
    // 1. Create public, sensitive, private memories
    // 2. Search with different access contexts
    // 3. Verify appropriate filtering
  });
});
```

### 3. E2E Tests (Playwright)

Located in `src/admin-dashboard/e2e/`

#### 3.1 Learning Loop E2E Tests
```typescript
// e2e/learning-loop.spec.ts

test.describe('Learning Loop E2E', () => {
  test('full feedback cycle', async ({ page }) => {
    // 1. Navigate to missions page
    // 2. Find a mission card
    // 3. Click feedback button (love/like/meh)
    // 4. Verify UI updates
    // 5. Check episode stats updated
    // 6. Verify episode created in IndexedDB
  });

  test('mission quality improves with feedback', async ({ page }) => {
    // 1. Provide negative feedback on certain categories
    // 2. Trigger agent to generate new missions
    // 3. Verify new missions avoid negative categories
    // 4. Check procedural rules applied
  });

  test('memory search from UI', async ({ page }) => {
    // 1. Navigate to a search interface (if exists)
    // 2. Enter search query
    // 3. Verify results from semantic memory
    // 4. Check relevance ranking
  });
});
```

#### 3.2 Reflection Node E2E Tests
```typescript
// e2e/reflection-node.spec.ts

test.describe('Reflection Node E2E', () => {
  test('background reflection runs on schedule', async ({ page }) => {
    // 1. Seed sufficient episodes
    // 2. Wait for reflection trigger
    // 3. Verify procedural rules created
    // 4. Check rule appears in debug UI (if available)
  });

  test('entity extraction from classified emails', async ({ page }) => {
    // 1. Classify emails with entity-rich content
    // 2. Trigger reflection
    // 3. Verify entities extracted
    // 4. Check entity relationships
  });
});
```

### 4. Performance Tests

Located in `packages/integration-tests/src/__tests__/performance/`

```typescript
// memory-performance.test.ts

describe('Memory Performance', () => {
  it('should handle 10,000 memories efficiently', async () => {
    // 1. Insert 10,000 semantic memories
    // 2. Measure search latency
    // 3. Assert < 100ms for top-10 results
  });

  it('should generate embeddings within budget', async () => {
    // 1. Generate embeddings for 100 texts
    // 2. Measure time and cost
    // 3. Assert within Sprint 4 budget (local model)
  });

  it('should complete Reflection Node within time limit', async () => {
    // 1. Create 100 episodes
    // 2. Run Reflection Node
    // 3. Assert completion < 30 seconds
  });
});
```

---

## Test Data Seeding

### IndexedDB Seeding Strategy

```typescript
// e2e/fixtures/seed-learning-data.ts

export async function seedLearningLoopData(page: Page) {
  await page.addInitScript(() => {
    const seed = async () => {
      const db = await openDB('ownyou_store');

      // Seed semantic memories
      await db.putAll('semantic_memory', testSemanticMemories);

      // Seed episodes with various outcomes
      await db.putAll('episodic_memory', testEpisodes);

      // Seed procedural rules
      await db.putAll('procedural_memory', testProceduralRules);

      // Seed entities
      await db.putAll('entities', testEntities);
    };
    seed();
  });
}
```

### Mock LLM Responses

```typescript
// __tests__/mocks/llm-mock.ts

export const mockLLMResponses = {
  entityExtraction: {
    entities: [
      { type: 'product', name: 'iPhone 15', attributes: {} },
      { type: 'company', name: 'Apple', attributes: {} },
    ],
  },
  ruleSynthesis: {
    rules: [
      {
        condition: 'User dismisses shopping emails',
        action: 'Reduce shopping mission frequency',
        confidence: 0.85,
      },
    ],
  },
  contextInjection: {
    relevantMemories: 5,
    similarEpisodes: 3,
    applicableRules: 2,
  },
};
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/sprint4-tests.yml

name: Sprint 4 Learning Loop Tests

on:
  push:
    paths:
      - 'packages/memory-store/**'
      - 'packages/agents/**'
      - 'src/admin-dashboard/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @ownyou/memory-store test
      - run: pnpm --filter @ownyou/agents test

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @ownyou/integration-tests test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: cd src/admin-dashboard && pnpm playwright:install
      - run: cd src/admin-dashboard && pnpm test:e2e
```

---

## Test Coverage Requirements

| Component | Unit Test | Integration | E2E | Target |
|-----------|-----------|-------------|-----|--------|
| Memory Store | ✓ | ✓ | - | 90% |
| Embeddings | ✓ | ✓ | - | 85% |
| Hybrid Retrieval | ✓ | ✓ | - | 90% |
| Reflection Node | ✓ | ✓ | ✓ | 85% |
| Entity Extraction | ✓ | ✓ | ✓ | 80% |
| Context Injection | ✓ | ✓ | ✓ | 85% |
| Feedback Loop | ✓ | ✓ | ✓ | 90% |
| Learning Cycle | - | ✓ | ✓ | 80% |

---

## v13 Architecture Compliance Tests

### Section 8 Compliance Checklist

| Section | Requirement | Test Location |
|---------|-------------|---------------|
| 8.4.1 | Semantic Memory storage | `memory-store/__tests__/storage.test.ts` |
| 8.4.2 | Episodic Memory with outcomes | `agents/__tests__/episode.test.ts` |
| 8.4.3 | Procedural rules format | `agents/__tests__/rules.test.ts` |
| 8.4.4 | Relational memory graph | `memory-store/__tests__/graph.test.ts` |
| 8.4.5 | Entity Extraction Pipeline | `agents/__tests__/entity-extraction.test.ts` |
| 8.5 | Memory Tools interface | `memory-store/__tests__/tools.test.ts` |
| 8.6.1 | Local embeddings | `memory-store/__tests__/embeddings.test.ts` |
| 8.7 | Hybrid retrieval (RRF) | `memory-store/__tests__/retrieval.test.ts` |
| 8.8.1 | Decay (5%/week) | `memory-store/__tests__/decay.test.ts` |
| 8.8.2 | Context Injection | `agents/__tests__/context-injection.test.ts` |
| 8.9 | Reflection Node phases | `agents/__tests__/reflection.test.ts` |
| 8.10 | Privacy tiers | `memory-store/__tests__/privacy.test.ts` |
| 8.11 | Access logging | `memory-store/__tests__/audit.test.ts` |
| 8.13 | Storage backends | `memory-store/__tests__/backends.test.ts` |

---

## Implementation Timeline

1. **Phase 1: Unit Test Framework**
   - Set up test utilities and mocks
   - Implement memory store unit tests
   - Implement embedding tests

2. **Phase 2: Integration Test Framework**
   - Create learning loop integration tests
   - Create retrieval integration tests
   - Set up test data seeding

3. **Phase 3: E2E Test Framework**
   - Extend Playwright tests for learning loop
   - Add reflection node E2E tests
   - Add performance benchmarks

4. **Phase 4: CI/CD Integration**
   - Configure GitHub Actions
   - Set up coverage reporting
   - Add performance regression tests

---

## Related Documents

- [Sprint 4 Specification](../sprints/ownyou-sprint4-spec.md)
- [v13 Architecture - Section 8](../architecture/OwnYou_architecture_v13.md)
- [Memory Types Extract](../architecture/extracts/memory-types-8.4.md)
