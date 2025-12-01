# Memory Types (v13 Section 8.4)

*Extracted from OwnYou_architecture_v13.md for AI assistant context loading*

## 8.4.1 Base Memory Structure

Every memory includes temporal tracking, provenance, and strength:

```typescript
interface Memory {
  id: string;
  content: string;                    // Natural language, agent-written
  context: string;                    // Domain hint: "travel", "shopping", "dining", etc.

  // Bi-temporal model (when was this true vs when did we learn it)
  valid_at: timestamp;                // When fact became true in reality
  invalid_at?: timestamp;             // When fact stopped being true (null = still valid)
  created_at: timestamp;              // When system learned this

  // Strength & decay
  strength: number;                   // Starts at 1.0, increases on access/confirmation
  last_accessed: timestamp;           // For decay calculation
  access_count: number;               // How often retrieved

  // Provenance (for transparency and BBS+ authenticity)
  sources: string[];                  // Episode IDs or data source refs that contributed
  confidence: number;                 // 0.0-1.0, based on confirmation frequency
  contradictions?: string[];          // Any conflicting observations

  // Privacy tier
  privacy_tier: "public" | "sensitive" | "private";
}
```

## 8.4.2 Episodic Memory Structure

Episodes capture complete interactions for few-shot learning:

```typescript
interface Episode {
  id: string;

  // The interaction record
  situation: string;      // What was the user trying to do
  reasoning: string;      // How the agent approached it
  action: string;         // What solution was provided
  outcome: string;        // What happened (success/failure/partial)
  user_feedback?: string; // Explicit feedback or inferred satisfaction

  // Metadata
  agent_type: string;     // "travel", "shopping", "restaurant", etc.
  mission_id: string;     // Link to mission card
  timestamp: timestamp;

  // For few-shot retrieval
  tags: string[];         // Searchable tags: ["booking", "flight", "negative_outcome"]
}
```

## 8.4.3 Procedural Memory Structure

Agent-specific behavioral rules that evolve:

```typescript
interface ProceduralRule {
  id: string;
  agent_type: string;                 // Which agent this applies to
  rule: string;                       // Natural language instruction

  // Evidence
  derived_from: string[];             // Episode IDs that led to this rule
  confidence: number;                 // How strongly supported by evidence

  // Lifecycle
  created_at: timestamp;
  last_validated: timestamp;          // Last time episodes confirmed this
  override_count: number;             // Times user overrode this behavior
}

// Example procedural rules:
const travelAgentRules = [
  {
    rule: "Always filter for direct flights first - user has strong aversion to layovers",
    derived_from: ["episode_123", "episode_456"],
    confidence: 0.95
  },
  {
    rule: "Suggest mid-range options before budget - user returned budget items twice",
    derived_from: ["episode_789"],
    confidence: 0.8
  }
];
```

## 8.4.4 Relational Memory Structure (MVP)

For MVP, entities and relationships are stored in LangGraph Store namespaces (no separate graph database). Post-MVP will upgrade to Graphiti-style temporal knowledge graph with Kuzu.

```typescript
// === ENTITY SCHEMA ===
interface Entity {
  id: string;
  name: string;                       // "Sarah", "Delta Airlines", "Olive Garden"
  type: "person" | "organization" | "place" | "product" | "event";

  // Properties (flexible, agent-written)
  properties: Record<string, unknown>; // { "relationship": "partner", "dietary": "vegetarian" }

  // Temporal
  first_seen: timestamp;
  last_mentioned: timestamp;
  mention_count: number;

  // Provenance
  source_memories: string[];          // Memory IDs where this entity was mentioned
}

// === RELATIONSHIP SCHEMA ===
interface Relationship {
  id: string;
  from_entity: string;                // Entity ID (usually "USER" for user-centric)
  to_entity: string;                  // Entity ID
  type: string;                       // "KNOWS", "PREFERS", "VISITED", "PURCHASED"

  // Temporal (bi-temporal for history)
  valid_at: timestamp;                // When relationship became true
  invalid_at?: timestamp;             // When relationship ended (null = still valid)
  created_at: timestamp;              // When system learned this

  // Properties
  properties: Record<string, unknown>; // { "strength": 0.8, "context": "dining" }

  // Provenance
  source_memories: string[];
}
```

## MVP Store Operations

```typescript
// Store entities in namespace
const storeEntity = async (userId: string, entity: Entity) => {
  await store.put(["entities", userId], entity.id, entity);
};

// Store relationships in namespace
const storeRelationship = async (userId: string, rel: Relationship) => {
  await store.put(["relationships", userId], rel.id, rel);
};

// MVP lookup: by entity name or type (no graph traversal)
const findEntitiesByType = async (userId: string, type: Entity["type"]) => {
  const all = await store.list(["entities", userId]);
  return all.filter(e => e.value.type === type);
};

const findRelationshipsFor = async (userId: string, entityId: string) => {
  const all = await store.list(["relationships", userId]);
  return all.filter(r =>
    r.value.from_entity === entityId || r.value.to_entity === entityId
  );
};
```

**Post-MVP Enhancement:** Replace Store-based lookups with Kuzu graph database for BFS/DFS traversal, edge scoring, and complex graph queries.
