# @ownyou/reflection

Reflection Node for memory synthesis and pattern extraction - v13 Section 8.10

## Purpose

Background process that maintains memory quality and extracts patterns:
- 6-phase reflection cycle
- Procedural rule synthesis from episodes
- Context injection for agents
- Temporal validation for fact freshness
- Entity extraction from memories

## Architecture (v13)

- **Section 8.10**: Reflection Node orchestrator
- **Section 8.9.3**: Procedural synthesis from episode patterns
- **Section 8.9.4**: Community summaries
- **Section 8.11**: Privacy tier enforcement

## Usage

```typescript
import {
  runReflection,
  buildAgentContext,
  createEnrichedSystemPrompt,
  ReflectionTriggerManager,
  getProceduralRules,
} from '@ownyou/reflection';

// Run reflection manually
const result = await runReflection(
  userId,
  { type: 'after_episodes', count: 5 },
  store,
  llm
);

// Build context for an agent
const context = await buildAgentContext(
  userId,
  'shopping',
  'Find deals on electronics',
  store
);

// Create enriched prompt with context
const enrichedPrompt = createEnrichedSystemPrompt(basePrompt, context);

// Use trigger manager for automatic scheduling
const manager = new ReflectionTriggerManager(userId, store, llm);
await manager.loadState();
await manager.onEpisodeSaved(); // May trigger reflection
```

## 6-Phase Reflection Cycle

1. **CONSOLIDATION**: Merge similar memories (handled during write)
2. **DECAY & PRUNE**: Remove low-value memories
3. **SUMMARIZATION**: Generate community summaries (weekly)
4. **PROCEDURAL SYNTHESIS**: Extract rules from episode patterns
5. **TEMPORAL VALIDATION**: Mark outdated facts invalid
6. **ENTITY EXTRACTION**: Extract entities from new memories

## Reflection Triggers

- `after_episodes`: After N episodes saved (default: 5)
- `daily_idle`: During idle hours (default: 3am)
- `weekly_maintenance`: Weekly full maintenance (default: Sunday 3am)
- `after_negative_feedback`: User gave negative feedback on an episode

## Context Injection

Provides agents with relevant context:
- Semantic memories (similar to current query)
- Similar episodes (past interactions)
- Procedural rules (learned patterns)

```typescript
interface AgentContext {
  semanticMemories: Memory[];
  similarEpisodes: Episode[];
  proceduralRules: ProceduralRule[];
}
```

## Tests

```bash
pnpm test  # 22 tests
```
