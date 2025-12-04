# @ownyou/agents-base

Base agent framework for OwnYou mission agents.

## v13 Architecture Reference

- **Section 3.6.1**: Agent Types (shopping, travel, restaurant, events, content, diagnostic)
- **Section 3.6.2**: Agent Permissions (namespace access control)
- **Section 3.6.3**: Agent Levels (L1/L2/L3 resource limits)
- **Section 8.4.2**: Episode recording for few-shot learning

## Components

### LimitsEnforcer

Enforces L1/L2/L3 resource limits:
- L1: 3 tool calls, 2 LLM calls, 30s timeout
- L2: 10 tool calls, 5 LLM calls, 120s timeout
- L3: 25 tool calls, 10 LLM calls, 300s timeout

### PrivacyGuard

Controls namespace access based on agent permissions:
- Validates read/write/search operations against agent permissions
- Enforces privacy tier restrictions (public/sensitive/private)

### BaseAgent

Abstract base class for all agents:
- Integrates LimitsEnforcer and PrivacyGuard
- Records episodes for procedural memory
- Integrates with AgentTracer for observability
- Manages tool execution and LLM calls

## Usage

```typescript
import { BaseAgent, LimitsEnforcer, PrivacyGuard } from '@ownyou/agents-base';
import type { AgentContext, AgentResult } from '@ownyou/agents-base';

class ShoppingAgent extends BaseAgent {
  readonly agentType = 'shopping';
  readonly level = 'L2';

  protected async execute(context: AgentContext): Promise<AgentResult> {
    // Agent implementation
  }
}
```

## Dependencies

- `@ownyou/shared-types` - Agent types, limits, mission cards
- `@ownyou/observability` - AgentTracer for traces
- `@ownyou/llm-client` - LLM calls with budget enforcement
