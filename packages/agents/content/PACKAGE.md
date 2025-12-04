# @ownyou/agents-content

Content Agent for personalized content curation - v13 Section 3.6

## Purpose

L2 agent that learns user content preferences and provides recommendations:
- Article summarization
- Content recommendations based on learned interests
- Theme extraction with privacy tier awareness
- Integration with reflection system

## Architecture (v13)

- **Section 3.6.2**: Agent level limits (L2)
- **Section 3.6.5**: Privacy tier enforcement
- **Section 8.11**: Memory privacy tiers

## Usage

```typescript
import { ContentAgent, createContentAgent } from '@ownyou/agents-content';
import { MemoryStore } from '@ownyou/memory-store';
import { createLLMClient } from '@ownyou/llm-client';

// Create agent
const agent = createContentAgent(store, llmClient);

// Run agent for a mission
const result = await agent.run({
  userId: 'user_123',
  missionId: 'mission_456',
  task: 'Recommend articles about sustainable travel',
});

// Use tools directly
import { summarizeArticle, recommendContent } from '@ownyou/agents-content';

const summary = await summarizeArticle({
  url: 'https://example.com/article',
  userId: 'user_123',
  store,
  llm,
});

const recommendations = await recommendContent({
  query: 'sustainable travel tips',
  userId: 'user_123',
  store,
  llm,
  options: { limit: 5 },
});
```

## Agent Configuration

```typescript
const agent = new ContentAgent({
  store,
  llm,
  level: 'L2',
  permissions: CONTENT_PERMISSIONS,
});
```

## Privacy Tier Awareness

The agent respects privacy tiers when accessing memories:
- **public**: Full access (travel, shopping, dining)
- **sensitive**: Requires justification (health, finance)
- **private**: No cross-agent access (medical, legal)

## Tools

### summarizeArticle
Fetches and summarizes web content.

### recommendContent
Recommends content based on user interests and episodic history.

## Tests

```bash
pnpm test  # 11 tests
```
