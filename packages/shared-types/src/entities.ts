/**
 * Entity Types - v13 Section 8.4.4-8.4.5
 *
 * Relational memory structures for entities and relationships.
 * MVP uses LangGraph Store namespaces (no separate graph database).
 * Post-MVP will upgrade to Kuzu for graph traversal.
 *
 * @see docs/architecture/extracts/memory-types-8.4.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 8.4.4
 */

/**
 * Entity type classification
 */
export type EntityType =
  | 'person'
  | 'place'
  | 'product'
  | 'company'
  | 'event'
  | 'concept';

/**
 * Relationship type classification
 */
export type RelationshipType =
  | 'KNOWS'
  | 'WORKS_AT'
  | 'LIVES_IN'
  | 'PURCHASED_FROM'
  | 'VISITED'
  | 'INTERESTED_IN';

/**
 * Entity - v13 Section 8.4.4
 *
 * Represents people, places, products, companies, events, or concepts
 * mentioned in memories.
 */
export interface Entity {
  /** Unique identifier */
  id: string;

  /** Display name: "Sarah", "Delta Airlines", "Olive Garden" */
  name: string;

  /** Entity classification */
  type: EntityType;

  /** Flexible properties: { "relationship": "partner", "dietary": "vegetarian" } */
  properties: Record<string, unknown>;

  // Temporal (bi-temporal model)
  /** When entity became relevant */
  validAt: number;

  /** When entity stopped being relevant (undefined = still valid) */
  invalidAt?: number;

  /** When system first learned about this entity */
  createdAt: number;

  /** Memory IDs where this entity was mentioned */
  sourceMemories: string[];

  /** Vector embedding for semantic search */
  embedding?: number[];
}

/**
 * Relationship - v13 Section 8.4.4
 *
 * Represents connections between entities (usually user-centric).
 */
export interface Relationship {
  /** Unique identifier */
  id: string;

  /** Source entity ID (usually "USER" for user-centric) */
  fromEntityId: string;

  /** Target entity ID */
  toEntityId: string;

  /** Relationship classification */
  type: RelationshipType;

  // Temporal (bi-temporal model)
  /** When relationship became true */
  validAt: number;

  /** When relationship ended (undefined = still valid) */
  invalidAt?: number;

  /** When system learned about this relationship */
  createdAt: number;

  /** Additional properties: { "strength": 0.8, "context": "dining" } */
  properties: Record<string, unknown>;

  /** Memory IDs that support this relationship */
  sourceMemories: string[];
}
