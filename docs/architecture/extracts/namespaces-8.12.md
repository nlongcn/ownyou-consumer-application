# Namespace Schema (v13 Section 8.12)

*Extracted from OwnYou_architecture_v13.md for AI assistant context loading*

All memory is organized into typed namespaces following the LangGraph Store pattern:

```typescript
// Namespace factory functions for type-safe access
const STORE_NAMESPACES = {
  // === SEMANTIC MEMORY (Facts & Knowledge) ===
  semantic_memory: (userId: string) => ["ownyou.semantic", userId],
  community_summaries: (userId: string) => ["ownyou.summaries", userId],

  // === EPISODIC MEMORY (Interaction History) ===
  episodic_memory: (userId: string) => ["ownyou.episodes", userId],

  // === PROCEDURAL MEMORY (Agent Rules) ===
  procedural_memory: (userId: string, agentType: string) =>
    ["ownyou.procedural", userId, agentType],

  // === RELATIONAL MEMORY (Entity Graph) ===
  entities: (userId: string) => ["ownyou.entities", userId],
  relationships: (userId: string) => ["ownyou.relationships", userId],

  // === IAB CLASSIFICATION (Advertising Profile) ===
  iab_classifications: (userId: string) => ["ownyou.iab", userId],
  iab_evidence: (userId: string) => ["ownyou.iab_evidence", userId],

  // === IKIGAI (Well-Being Profile) ===
  ikigai_profile: (userId: string) => ["ownyou.ikigai", userId],
  ikigai_dimensions: (userId: string) => ["ownyou.ikigai_dims", userId],

  // === MISSION STATE ===
  mission_cards: (userId: string) => ["ownyou.missions", userId],
  mission_feedback: (userId: string, missionId: string) =>
    ["ownyou.feedback", userId, missionId],

  // === BBS+ IDENTITY ===
  pseudonyms: (userId: string) => ["ownyou.pseudonyms", userId],
  disclosure_history: (userId: string) => ["ownyou.disclosures", userId],
  earnings: (userId: string) => ["ownyou.earnings", userId],
  tracking_consents: (userId: string) => ["ownyou.consents", userId],

  // === SYNC & ARCHIVAL ===
  archived: (namespace: string) => ["ownyou.archived", namespace],
  yearly_summaries: (userId: string, context: string) =>
    ["ownyou.yearly_summaries", userId, context],
  sync_metadata: (deviceId: string) => ["ownyou.sync", deviceId],
} as const;

// Usage example:
// await store.put(STORE_NAMESPACES.semantic_memory(userId), memoryId, memory);
// await store.search({ namespace: STORE_NAMESPACES.episodic_memory(userId), query });
```

## Namespace Categories

| Category | Namespaces | Purpose |
|----------|------------|---------|
| **Semantic** | `semantic_memory`, `community_summaries` | Facts & knowledge about user |
| **Episodic** | `episodic_memory` | Interaction history for learning |
| **Procedural** | `procedural_memory` | Agent-specific rules |
| **Relational** | `entities`, `relationships` | Entity graph (MVP: Store-based) |
| **IAB** | `iab_classifications`, `iab_evidence` | Advertising profile |
| **Ikigai** | `ikigai_profile`, `ikigai_dimensions` | Well-being profile |
| **Mission** | `mission_cards`, `mission_feedback` | Active missions |
| **Identity** | `pseudonyms`, `disclosure_history`, `earnings`, `tracking_consents` | BBS+ identity |
| **System** | `archived`, `yearly_summaries`, `sync_metadata` | Housekeeping |
