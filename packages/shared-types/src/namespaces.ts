/**
 * Namespace Schema - v13 Section 8.12
 *
 * All namespaces follow LangGraph Store pattern: [namespace, userId, subkey?]
 *
 * @see docs/architecture/extracts/namespaces-8.12.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 8.12
 */

/**
 * NAMESPACES - All v13 namespace string constants
 *
 * Namespaces are used to organize data in the LangGraph Store.
 */
export const NAMESPACES = {
  // Core memory (Section 8.4)
  SEMANTIC_MEMORY: 'ownyou.semantic',
  EPISODIC_MEMORY: 'ownyou.episodic',
  PROCEDURAL_MEMORY: 'ownyou.procedural',

  // Relational (Section 8.4.4)
  ENTITIES: 'ownyou.entities',
  RELATIONSHIPS: 'ownyou.relationships',
  COMMUNITY_SUMMARIES: 'ownyou.summaries',

  // Classifications
  IAB_CLASSIFICATIONS: 'ownyou.iab',

  // Ikigai (Section 2)
  IKIGAI_PROFILE: 'ownyou.ikigai',
  IKIGAI_EVIDENCE: 'ownyou.ikigai_evidence',

  // Missions (Section 3)
  MISSION_CARDS: 'ownyou.missions',
  MISSION_FEEDBACK: 'ownyou.mission_feedback',

  // Identity (Section 7)
  PSEUDONYMS: 'ownyou.pseudonyms',
  DISCLOSURE_HISTORY: 'ownyou.disclosures',
  TRACKING_CONSENTS: 'ownyou.tracking_consents',

  // Financial
  EARNINGS: 'ownyou.earnings',

  // Observability (Section 10)
  AGENT_TRACES: 'ownyou.traces',
  LLM_USAGE: 'ownyou.llm_usage',
  SYNC_LOGS: 'ownyou.sync_logs',

  // LLM Budget (v13 Section 6.10 - Budget Enforcement)
  LLM_BUDGET: 'ownyou.llm_budget',

  // LLM Cache (v13 Section 6.11.3 - Fallback Chain Step 5)
  LLM_CACHE: 'ownyou.llm_cache',
} as const;

/**
 * Namespace type - union of all namespace values
 */
export type Namespace = (typeof NAMESPACES)[keyof typeof NAMESPACES];

/**
 * Namespace tuple type - used for LangGraph Store operations
 */
export type NamespaceTuple = readonly [string, ...string[]];

/**
 * NS - Namespace tuple factory functions
 *
 * Creates properly typed namespace tuples for LangGraph Store operations.
 */
export const NS = {
  /** Semantic memory namespace: [namespace, userId] */
  semanticMemory: (userId: string) =>
    [NAMESPACES.SEMANTIC_MEMORY, userId] as const,

  /** Episodic memory namespace: [namespace, userId] */
  episodicMemory: (userId: string) =>
    [NAMESPACES.EPISODIC_MEMORY, userId] as const,

  /** Procedural memory namespace: [namespace, userId, agentType] */
  proceduralMemory: (userId: string, agentType: string) =>
    [NAMESPACES.PROCEDURAL_MEMORY, userId, agentType] as const,

  /** Entities namespace: [namespace, userId] */
  entities: (userId: string) => [NAMESPACES.ENTITIES, userId] as const,

  /** Relationships namespace: [namespace, userId] */
  relationships: (userId: string) =>
    [NAMESPACES.RELATIONSHIPS, userId] as const,

  /** IAB classifications namespace: [namespace, userId] */
  iabClassifications: (userId: string) =>
    [NAMESPACES.IAB_CLASSIFICATIONS, userId] as const,

  /** Ikigai profile namespace: [namespace, userId] */
  ikigaiProfile: (userId: string) =>
    [NAMESPACES.IKIGAI_PROFILE, userId] as const,

  /** Ikigai evidence namespace: [namespace, userId] */
  ikigaiEvidence: (userId: string) =>
    [NAMESPACES.IKIGAI_EVIDENCE, userId] as const,

  /** Mission cards namespace: [namespace, userId] */
  missionCards: (userId: string) =>
    [NAMESPACES.MISSION_CARDS, userId] as const,

  /** Pseudonyms namespace: [namespace, userId] */
  pseudonyms: (userId: string) => [NAMESPACES.PSEUDONYMS, userId] as const,

  /** Earnings namespace: [namespace, userId] */
  earnings: (userId: string) => [NAMESPACES.EARNINGS, userId] as const,

  /** Agent traces namespace: [namespace, userId] */
  agentTraces: (userId: string) => [NAMESPACES.AGENT_TRACES, userId] as const,

  /** LLM usage namespace: [namespace, userId, period] */
  llmUsage: (userId: string, period: 'daily' | 'monthly') =>
    [NAMESPACES.LLM_USAGE, userId, period] as const,

  /** LLM budget namespace: [namespace, userId] - for budget tracking (v13 6.10) */
  llmBudget: (userId: string) => [NAMESPACES.LLM_BUDGET, userId] as const,

  /** LLM cache namespace: [namespace, userId] - for response caching (v13 6.11.3) */
  llmCache: (userId: string) => [NAMESPACES.LLM_CACHE, userId] as const,
} as const;

/**
 * NAMESPACE_PRIVACY - Privacy tier by namespace (v13 Section 8.11)
 *
 * Defines the privacy classification for each namespace.
 */
export const NAMESPACE_PRIVACY: Record<Namespace, 'public' | 'sensitive' | 'private'> = {
  [NAMESPACES.SEMANTIC_MEMORY]: 'public',
  [NAMESPACES.EPISODIC_MEMORY]: 'public',
  [NAMESPACES.PROCEDURAL_MEMORY]: 'public',
  [NAMESPACES.ENTITIES]: 'public',
  [NAMESPACES.RELATIONSHIPS]: 'sensitive',
  [NAMESPACES.COMMUNITY_SUMMARIES]: 'public',
  [NAMESPACES.IAB_CLASSIFICATIONS]: 'public',
  [NAMESPACES.IKIGAI_PROFILE]: 'sensitive',
  [NAMESPACES.IKIGAI_EVIDENCE]: 'sensitive',
  [NAMESPACES.MISSION_CARDS]: 'public',
  [NAMESPACES.MISSION_FEEDBACK]: 'public',
  [NAMESPACES.PSEUDONYMS]: 'private',
  [NAMESPACES.DISCLOSURE_HISTORY]: 'private',
  [NAMESPACES.TRACKING_CONSENTS]: 'private',
  [NAMESPACES.EARNINGS]: 'sensitive',
  [NAMESPACES.AGENT_TRACES]: 'private',
  [NAMESPACES.LLM_USAGE]: 'private',
  [NAMESPACES.SYNC_LOGS]: 'private',
  [NAMESPACES.LLM_BUDGET]: 'private', // User's LLM budget tracking
  [NAMESPACES.LLM_CACHE]: 'private', // Cached LLM responses - device-local
};

/**
 * NAMESPACE_SYNC_SCOPE - Sync scope by namespace (v13 Section 8.14.1)
 *
 * Defines what data syncs across devices.
 * - 'full': All data syncs
 * - 'selective': Only recent/important data syncs
 * - 'none': Device-local only, never syncs
 */
export const NAMESPACE_SYNC_SCOPE: Record<Namespace, 'full' | 'selective' | 'none'> = {
  [NAMESPACES.SEMANTIC_MEMORY]: 'full',
  [NAMESPACES.EPISODIC_MEMORY]: 'selective', // Recent 30 days + strong signals
  [NAMESPACES.PROCEDURAL_MEMORY]: 'full',
  [NAMESPACES.ENTITIES]: 'full',
  [NAMESPACES.RELATIONSHIPS]: 'full',
  [NAMESPACES.COMMUNITY_SUMMARIES]: 'full',
  [NAMESPACES.IAB_CLASSIFICATIONS]: 'full',
  [NAMESPACES.IKIGAI_PROFILE]: 'full',
  [NAMESPACES.IKIGAI_EVIDENCE]: 'selective',
  [NAMESPACES.MISSION_CARDS]: 'full',
  [NAMESPACES.MISSION_FEEDBACK]: 'full',
  [NAMESPACES.PSEUDONYMS]: 'full',
  [NAMESPACES.DISCLOSURE_HISTORY]: 'full',
  [NAMESPACES.TRACKING_CONSENTS]: 'full',
  [NAMESPACES.EARNINGS]: 'full',
  [NAMESPACES.AGENT_TRACES]: 'none', // Device-local
  [NAMESPACES.LLM_USAGE]: 'none', // Device-local
  [NAMESPACES.SYNC_LOGS]: 'none', // Device-local
  [NAMESPACES.LLM_BUDGET]: 'full', // Budget syncs across devices (per-user limit)
  [NAMESPACES.LLM_CACHE]: 'none', // Device-local cache, never syncs
};
