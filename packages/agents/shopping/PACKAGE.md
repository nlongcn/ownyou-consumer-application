# @ownyou/agents-shopping

Shopping Agent for OwnYou - detects purchase intent and generates shopping-related mission cards.

## v13 Architecture Reference

- **Section 3.6.1**: Agent Type = 'shopping'
- **Section 3.6.3**: Agent Level = L2 (up to 10 tool calls, 5 LLM calls, 120s timeout)
- **Section 3.4**: Mission Card generation

## Features

### Purchase Intent Detection

Scans IAB classifications for shopping-related categories:
- IAB-22: Shopping (primary trigger)
- IAB-19: Technology & Computing (electronics shopping)
- IAB-18: Style & Fashion (clothing shopping)

### Mock Tools (Sprint 3)

- `search-deals.ts` - Returns mock deal data
- `price-check.ts` - Returns mock price comparisons

Real integrations come in later sprints when BBS+ is ready.

## Agent Permissions

```typescript
const shoppingPermissions: AgentPermissions = {
  agentType: 'shopping',
  memoryAccess: {
    read: [
      'ownyou.semantic',      // User preferences
      'ownyou.iab',           // IAB classifications (trigger source)
      'ownyou.ikigai',        // Ikigai alignment
      'ownyou.missions',      // Existing missions
    ],
    write: [
      'ownyou.missions',      // Create/update mission cards
      'ownyou.episodic',      // Record episodes
    ],
    search: [
      'ownyou.semantic',      // Search preferences
      'ownyou.iab',           // Search classifications
    ],
  },
  externalApis: [
    { name: 'deals-api', rateLimit: '100/hour', requiresUserConsent: false },
  ],
  toolDefinitions: [
    { name: 'search_deals', description: 'Search for deals' },
    { name: 'check_price', description: 'Check price history' },
  ],
};
```

## Usage

```typescript
import { ShoppingAgent, SHOPPING_PERMISSIONS } from '@ownyou/agents-shopping';

const agent = new ShoppingAgent();
const result = await agent.run({
  userId: 'user_123',
  store: memoryStore,
  tools: [],
  triggerData: {
    classification: {
      tier1: 'Shopping',
      tier2: 'Consumer Electronics',
      confidence: 0.85,
    },
  },
});
```

## Dependencies

- `@ownyou/agents-base` - BaseAgent, LimitsEnforcer, PrivacyGuard
- `@ownyou/shared-types` - Types and NAMESPACES
- `@ownyou/llm-client` - LLM calls for mission generation
