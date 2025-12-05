# @ownyou/triggers

4-mode trigger system for OwnYou Mission Agents.

**v13 Architecture Reference:** Section 3.1-3.5 (Mission Agent System)

---

## Overview

This package implements the complete trigger architecture:

1. **Data-Driven Triggers** - Store watches that fire on data changes
2. **Scheduled Triggers** - Cron-style recurring triggers
3. **Event-Driven Triggers** - External events (calendar, location, webhooks)
4. **User-Driven Triggers** - Natural language request routing

---

## Architecture

```
@ownyou/triggers
├── engine/
│   └── trigger-engine.ts    # Central orchestrator (v13 3.2)
├── data-driven/
│   └── store-watcher.ts     # Store change monitoring
├── scheduled/
│   └── cron-scheduler.ts    # Cron-style scheduling
├── coordinator/
│   ├── agent-coordinator.ts # Trigger-to-agent routing (v13 3.5)
│   ├── agent-registry.ts    # Agent registration
│   └── intent-classifier.ts # NLU intent classification
└── types.ts
```

---

## Usage

### TriggerEngine (Main Entry Point)

```typescript
import { TriggerEngine } from '@ownyou/triggers';

const engine = new TriggerEngine({
  store: memoryStore,
  llm: llmClient,
  userId: 'user_123',
  watchNamespaces: ['ownyou.iab', 'ownyou.semantic'],
  schedules: {
    daily_digest: '0 9 * * *',
    weekly_review: '0 10 * * 1',
  },
  agentFactory: (type) => {
    switch (type) {
      case 'shopping': return new ShoppingAgent();
      case 'content': return new ContentAgent();
      default: return null;
    }
  },
});

// Register agents
engine.registerAgent({
  type: 'shopping',
  namespaces: ['ownyou.iab', 'ownyou.semantic'],
  intents: ['shopping', 'buy', 'deal'],
  description: 'Shopping Agent',
  enabled: true,
});

// Start listening
engine.start();

// Handle user request
const result = await engine.handleUserRequest("Find me a good deal on headphones");
console.log(result.agentType); // 'shopping'
console.log(result.mission);   // MissionCard or undefined

// Handle external event
await engine.handleEvent('calendar', 'upcoming_trip', { destination: 'Paris' });

// Stop engine
engine.stop();
```

### StoreWatcher (Data-Driven)

```typescript
import { StoreWatcher } from '@ownyou/triggers';

const watcher = new StoreWatcher({
  namespaces: ['ownyou.iab', 'ownyou.entities'],
  debounceMs: 1000,
  batchSize: 10,
});

// Register callbacks
watcher.onNamespaceChange('ownyou.iab', async (trigger) => {
  console.log(`IAB classification changed: ${trigger.key}`);
  // Trigger shopping agent...
});

// Connect to store events
store.on('change', (ns, key, value, type) => {
  watcher.handleChange(ns, key, value, type);
});

watcher.start();
```

### CronScheduler (Scheduled)

```typescript
import { CronScheduler } from '@ownyou/triggers';

const scheduler = new CronScheduler({
  daily_digest: '0 9 * * *',      // 9 AM daily
  weekly_review: '0 10 * * 1',    // 10 AM Mondays
  monthly_planning: '0 9 1 * *',  // 9 AM first of month
});

scheduler.onTrigger(async (trigger) => {
  console.log(`Schedule fired: ${trigger.scheduleId}`);
});

// Runtime schedule management
scheduler.addSchedule('custom', '0 12 * * *');
scheduler.setEnabled('daily_digest', false);
scheduler.removeSchedule('custom');

scheduler.start();
```

### AgentCoordinator (Routing)

```typescript
import { AgentCoordinator } from '@ownyou/triggers';

const coordinator = new AgentCoordinator({
  agentFactory: (type) => createAgent(type),
  scheduleAgents: {
    daily_digest: ['shopping', 'content'],
    weekly_review: ['shopping'],
  },
  eventAgents: {
    calendar: ['travel', 'shopping'],
    location: ['restaurant'],
  },
});

// Route a trigger
const results = await coordinator.routeTrigger(trigger, context);

// Route user request (with intent classification)
const result = await coordinator.routeUserRequest("Find cheap flights to Paris", context);

// Validate mappings
const validation = coordinator.validateScheduleMappings(['daily_digest', 'custom']);
if (!validation.valid) {
  console.warn('Unmapped schedules:', validation.unmappedSchedules);
}
```

### IntentClassifier

```typescript
import { IntentClassifier, classifyIntent } from '@ownyou/triggers';

// Use default classifier
const result = classifyIntent("Find me a good deal on headphones under $100");
console.log(result.intent);     // 'shopping'
console.log(result.entities);   // { price: 'under $100' }
console.log(result.confidence); // 0.85

// Custom classifier
const classifier = new IntentClassifier({
  intentPatterns: {
    fitness: ['workout', 'exercise', 'gym', 'health'],
  },
  defaultIntent: 'general',
});

// Runtime updates
classifier.registerIntent('events', ['concert', 'show', 'ticket']);
classifier.addKeywords('shopping', ['bargain', 'clearance']);
```

---

## API Reference

### TriggerEngine

| Method | Description |
|--------|-------------|
| `start()` | Start all trigger listeners |
| `stop()` | Stop all trigger listeners |
| `handleUserRequest(request)` | Route natural language request |
| `handleEvent(source, type, data)` | Handle external event |
| `registerAgent(entry)` | Register an agent |
| `setAgentEnabled(type, enabled)` | Enable/disable agent |
| `getStats()` | Get processing statistics |

### StoreWatcher

| Method | Description |
|--------|-------------|
| `start()` | Start watching namespaces |
| `stop()` | Stop watching |
| `onNamespaceChange(ns, callback)` | Register change callback |
| `handleChange(ns, key, value, type)` | Process a change event |

### CronScheduler

| Method | Description |
|--------|-------------|
| `start()` | Start scheduler |
| `stop()` | Stop scheduler |
| `onTrigger(callback)` | Register trigger callback |
| `addSchedule(id, expression)` | Add schedule at runtime |
| `removeSchedule(id)` | Remove schedule |
| `setEnabled(id, enabled)` | Enable/disable schedule |
| `getSchedules()` | Get all schedules |
| `getNextRun(id)` | Get next run time |

### AgentCoordinator

| Method | Description |
|--------|-------------|
| `routeTrigger(trigger, context)` | Route trigger to agents |
| `routeUserRequest(request, context)` | Route with intent classification |
| `registerAgent(entry)` | Register agent |
| `setScheduleAgents(id, agents)` | Configure schedule mapping |
| `setEventAgents(source, agents)` | Configure event mapping |
| `validateScheduleMappings(ids)` | Validate mappings |

### IntentClassifier

| Method | Description |
|--------|-------------|
| `classify(request)` | Classify intent with confidence |
| `registerIntent(intent, keywords)` | Add new intent |
| `addKeywords(intent, keywords)` | Add keywords to intent |
| `getIntents()` | Get all registered intents |
| `matchesIntent(request, intent)` | Quick intent check |

---

## Trigger Types

```typescript
type TriggerMode = 'data' | 'scheduled' | 'event' | 'user';

interface DataTrigger {
  mode: 'data';
  namespace: string;
  key: string;
  value: unknown;
  changeType: 'create' | 'update' | 'delete';
}

interface ScheduledTrigger {
  mode: 'scheduled';
  scheduleId: string;
  scheduledAt: number;
}

interface EventTrigger {
  mode: 'event';
  eventSource: string;
  eventType: string;
  eventData: unknown;
}

interface UserTrigger {
  mode: 'user';
  request: string;
  intent: string;
  entities: Record<string, string>;
  confidence: number;
}
```

---

## v13 Compliance

| Section | Requirement | Implementation |
|---------|-------------|----------------|
| 3.1 | Four-Mode Trigger System | All 4 modes in `TriggerEngine` |
| 3.2 | Trigger Architecture | `StoreWatcher`, `CronScheduler`, event handlers |
| 3.5 | Agent Coordinator | `AgentCoordinator` with intent routing |

---

## Testing

```bash
npm test -- --run packages/triggers
```

**Test Coverage:** 63 tests across 4 test files
