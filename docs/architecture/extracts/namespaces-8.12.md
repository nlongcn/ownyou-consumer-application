# Namespace Schema (v13 Section 8.12)

*Extracted from OwnYou_architecture_v13.md for AI assistant context loading*

All memory is organized into typed namespaces following the LangGraph Store pattern:

```typescript
// Namespace factory functions for type-safe access
// Import: import { NS } from '@ownyou/shared-types';

const NS = {
  // === SEMANTIC MEMORY (Facts & Knowledge) ===
  semanticMemory: (userId: string) => ["ownyou.semantic", userId],
  communitySummaries: (userId: string) => ["ownyou.summaries", userId],

  // === EPISODIC MEMORY (Interaction History) ===
  episodicMemory: (userId: string) => ["ownyou.episodic", userId],

  // === PROCEDURAL MEMORY (Agent Rules) ===
  proceduralMemory: (userId: string, agentType: string) =>
    ["ownyou.procedural", userId, agentType],

  // === RELATIONAL MEMORY (Entity Graph) ===
  entities: (userId: string) => ["ownyou.entities", userId],
  relationships: (userId: string) => ["ownyou.relationships", userId],

  // === IAB CLASSIFICATION (Advertising Profile) ===
  iabClassifications: (userId: string) => ["ownyou.iab", userId],
  iabEvidence: (userId: string) => ["ownyou.iab_evidence", userId],

  // === IKIGAI (Well-Being Profile) ===
  ikigaiProfile: (userId: string) => ["ownyou.ikigai", userId],
  ikigaiDimensions: (userId: string) => ["ownyou.ikigai_dims", userId],

  // === MISSION STATE ===
  missionCards: (userId: string) => ["ownyou.missions", userId],
  missionFeedback: (userId: string, missionId: string) =>
    ["ownyou.feedback", userId, missionId],

  // === BBS+ IDENTITY ===
  pseudonyms: (userId: string) => ["ownyou.pseudonyms", userId],
  disclosureHistory: (userId: string) => ["ownyou.disclosures", userId],
  earnings: (userId: string) => ["ownyou.earnings", userId],
  trackingConsents: (userId: string) => ["ownyou.consents", userId],

  // === SYNC & ARCHIVAL ===
  archived: (namespace: string) => ["ownyou.archived", namespace],
  yearlySummaries: (userId: string, context: string) =>
    ["ownyou.yearly_summaries", userId, context],
  syncMetadata: (deviceId: string) => ["ownyou.sync", deviceId],

  // === LLM CACHE ===
  llmCache: (userId: string) => ["ownyou.llm_cache", userId],

  // === LLM BUDGET ===
  llmBudget: (userId: string) => ["ownyou.llm_budget", userId],

  // === AGENT TRACES ===
  agentTraces: (userId: string) => ["ownyou.traces", userId],
} as const;

// Usage example:
// await store.put(NS.semanticMemory(userId), memoryId, memory);
// await store.search({ namespace: NS.episodicMemory(userId), query });
```

## Namespace Categories

| Category | Namespaces | Purpose |
|----------|------------|---------|
| **Semantic** | `semanticMemory`, `communitySummaries` | Facts & knowledge about user |
| **Episodic** | `episodicMemory` | Interaction history for learning |
| **Procedural** | `proceduralMemory` | Agent-specific rules |
| **Relational** | `entities`, `relationships` | Entity graph (MVP: Store-based) |
| **IAB** | `iabClassifications`, `iabEvidence` | Advertising profile |
| **Ikigai** | `ikigaiProfile`, `ikigaiDimensions` | Well-being profile |
| **Mission** | `missionCards`, `missionFeedback` | Active missions |
| **Identity** | `pseudonyms`, `disclosureHistory`, `earnings`, `trackingConsents` | BBS+ identity |
| **System** | `archived`, `yearlySummaries`, `syncMetadata` | Housekeeping |
