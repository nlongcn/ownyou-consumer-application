/**
 * Memory Types - v13 Section 8.4
 *
 * Core memory structures for OwnYou's LangGraph Store-based memory system.
 * All memory types support bi-temporal tracking, strength decay, and provenance.
 *
 * @see docs/architecture/extracts/memory-types-8.4.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 8.4
 */

/**
 * Privacy tier for memory classification - v13 Section 8.11
 */
export type PrivacyTier = 'public' | 'sensitive' | 'private';

/**
 * Agent types supported by the system - v13 Section 3.6
 */
export type AgentType =
  | 'shopping'
  | 'travel'
  | 'restaurant'
  | 'events'
  | 'content'
  | 'diagnostic';

/**
 * Conflict resolution strategies for sync - v13 Section 8.14.4
 */
export type ConflictStrategy = 'latest_wins' | 'merge' | 'manual' | 'sum';

/**
 * Base Memory - v13 Section 8.4.1
 *
 * Semantic memory representing facts and knowledge about the user.
 * Supports bi-temporal model (validAt/invalidAt) and strength decay.
 */
export interface Memory {
  /** Unique identifier */
  id: string;

  /** Natural language content, agent-written */
  content: string;

  /** Domain hint: "travel", "shopping", "dining", etc. */
  context: string;

  // Bi-temporal model (v13 Section 8.6)
  /** When fact became true in reality */
  validAt: number;

  /** When fact stopped being true (undefined = still valid) */
  invalidAt?: number;

  /** When system learned this */
  createdAt: number;

  // Strength & decay (v13 Section 8.9)
  /** Starts at 1.0, decays 5%/week, increases on access/confirmation */
  strength: number;

  /** For decay calculation */
  lastAccessed: number;

  /** How often retrieved */
  accessCount: number;

  // Provenance
  /** Episode IDs or data source refs that contributed */
  sources: string[];

  /** 0.0-1.0, based on confirmation frequency */
  confidence: number;

  /** Any conflicting observations */
  contradictions?: string[];

  // Privacy (v13 Section 8.11)
  privacyTier: PrivacyTier;

  // Vector (v13 Section 8.5)
  /** Vector embedding for semantic search (768 dims for nomic-embed-text-v1.5) */
  embedding?: number[];
}

/**
 * Episode - v13 Section 8.4.2
 *
 * Episodic memory capturing complete interactions for few-shot learning.
 * Records situation, reasoning, action, and outcome.
 */
export interface Episode {
  /** Unique identifier */
  id: string;

  // The interaction record
  /** What was the user trying to do */
  situation: string;

  /** How the agent approached it */
  reasoning: string;

  /** What solution was provided */
  action: string;

  /** What happened (success/failure/partial) */
  outcome: string;

  /** Explicit feedback or inferred satisfaction */
  userFeedback?: 'love' | 'like' | 'meh';

  // Metadata
  /** Which agent type handled this */
  agentType: AgentType;

  /** Link to mission card */
  missionId: string;

  /** When this episode occurred */
  timestamp: number;

  /** Searchable tags: ["booking", "flight", "negative_outcome"] */
  tags: string[];

  /** Vector embedding for retrieval */
  embedding?: number[];
}

/**
 * ProceduralRule - v13 Section 8.4.3
 *
 * Agent-specific behavioral rules that evolve based on episodes.
 */
export interface ProceduralRule {
  /** Unique identifier */
  id: string;

  /** Which agent this rule applies to */
  agentType: AgentType;

  /** Natural language instruction */
  rule: string;

  /** Episode IDs that led to this rule */
  derivedFrom: string[];

  /** When rule was created */
  createdAt: number;

  /** How strongly supported by evidence (0.0-1.0) */
  confidence: number;

  /** How often this rule has been applied */
  applicationCount: number;

  /** Times user overrode this behavior */
  overrideCount: number;

  /** Vector embedding for retrieval */
  embedding?: number[];
}

/**
 * Sync-compatible wrapper - v13 Section 8.14
 *
 * Wraps any memory type with sync metadata for OrbitDB replication.
 */
export interface SyncableMemory<T> {
  /** The wrapped data */
  data: T;

  // Sync metadata
  /** Unique sync identifier */
  syncId: string;

  /** Device that created/modified this */
  deviceId: string;

  /** Vector clock for causality tracking */
  vectorClock: Record<string, number>;

  /** Last successful sync timestamp */
  lastSyncedAt?: number;

  // Conflict resolution
  /** Strategy for resolving conflicts */
  conflictStrategy: ConflictStrategy;
}
