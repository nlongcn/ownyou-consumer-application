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

  // Data Source Configuration (v13 Section 5 - User-configurable sync settings)
  DATA_SOURCE_CONFIGS: 'ownyou.data_source_configs',

  // Observability (Section 10)
  AGENT_TRACES: 'ownyou.traces',
  LLM_USAGE: 'ownyou.llm_usage',
  SYNC_LOGS: 'ownyou.sync_logs',

  // LLM Budget (v13 Section 6.10 - Budget Enforcement)
  LLM_BUDGET: 'ownyou.llm_budget',

  // LLM Cache (v13 Section 6.11.3 - Fallback Chain Step 5)
  LLM_CACHE: 'ownyou.llm_cache',

  // Restaurant Agent (Sprint 7)
  DINING_RESERVATIONS: 'ownyou.dining_reservations',
  RESTAURANT_FAVORITES: 'ownyou.restaurant_favorites',

  // Events Agent (Sprint 7)
  EVENT_TICKETS: 'ownyou.event_tickets',
  EVENT_FAVORITES: 'ownyou.event_favorites',

  // Travel Agent (Sprint 7)
  TRAVEL_ITINERARIES: 'ownyou.travel_itineraries',
  TRAVEL_PREFERENCES: 'ownyou.travel_preferences',

  // Calendar (Sprint 7 - Events & Travel Agents)
  CALENDAR: 'ownyou.calendar',

  // Financial Profile (Sprint 7 - Travel Agent)
  FINANCIAL_PROFILE: 'ownyou.financial_profile',

  // Interests (Sprint 7 - Events Agent)
  INTERESTS: 'ownyou.interests',

  // Reflection (v13 Section 8.12 - Reflection State)
  REFLECTION_STATE: 'ownyou.reflection',

  // Sprint 8: Financial Data
  FINANCIAL_TRANSACTIONS: 'ownyou.financial_transactions',

  // Sprint 8: Calendar Data
  CALENDAR_EVENTS: 'ownyou.calendar_events',
  CALENDAR_PROFILE: 'ownyou.calendar_profile',
  CALENDAR_CONTACTS: 'ownyou.calendar_contacts', // Relationship extraction from attendees

  // Sprint 8: Diagnostic Agent
  DIAGNOSTIC_REPORTS: 'ownyou.diagnostic_reports',

  // Sprint 10: Cross-Device Sync (v13 Section 5.2, 8.14)
  SYNC_STATE: 'ownyou.sync_state', // Vector clocks, conflict resolution state
  SYNC_PEERS: 'ownyou.sync_peers', // Known peer devices
  DEVICE_REGISTRY: 'ownyou.devices', // Registered devices for this wallet

  // Sprint 10: E2EE Backup (v13 Section 5.3, 5.4)
  BACKUP_MANIFEST: 'ownyou.backup_manifest', // Backup metadata, checksums
  BACKUP_HISTORY: 'ownyou.backup_history', // Backup/restore history
  RECOVERY_KEY_HASH: 'ownyou.recovery_key_hash', // Hash of recovery key for verification

  // Sprint 11: UI State (Consumer App)
  UI_PREFERENCES: 'ownyou.ui.preferences', // Theme, display settings
  UI_FILTER_STATE: 'ownyou.ui.filterState', // Current filter tab, view state
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

  /** Mission feedback namespace: [namespace, userId] */
  missionFeedback: (userId: string) =>
    [NAMESPACES.MISSION_FEEDBACK, userId] as const,

  /** Pseudonyms namespace: [namespace, userId] */
  pseudonyms: (userId: string) => [NAMESPACES.PSEUDONYMS, userId] as const,

  /** Earnings namespace: [namespace, userId] */
  earnings: (userId: string) => [NAMESPACES.EARNINGS, userId] as const,

  /** Data source configs namespace: [namespace, userId] - Sprint 11b Deviation 1 fix */
  dataSourceConfigs: (userId: string) => [NAMESPACES.DATA_SOURCE_CONFIGS, userId] as const,

  /** Agent traces namespace: [namespace, userId] */
  agentTraces: (userId: string) => [NAMESPACES.AGENT_TRACES, userId] as const,

  /** LLM usage namespace: [namespace, userId, period] */
  llmUsage: (userId: string, period: 'daily' | 'monthly') =>
    [NAMESPACES.LLM_USAGE, userId, period] as const,

  /** LLM budget namespace: [namespace, userId] - for budget tracking (v13 6.10) */
  llmBudget: (userId: string) => [NAMESPACES.LLM_BUDGET, userId] as const,

  /** LLM cache namespace: [namespace, userId] - for response caching (v13 6.11.3) */
  llmCache: (userId: string) => [NAMESPACES.LLM_CACHE, userId] as const,

  // Sprint 7: Restaurant Agent namespaces
  /** Dining reservations namespace: [namespace, userId] */
  diningReservations: (userId: string) =>
    [NAMESPACES.DINING_RESERVATIONS, userId] as const,

  /** Restaurant favorites namespace: [namespace, userId] */
  restaurantFavorites: (userId: string) =>
    [NAMESPACES.RESTAURANT_FAVORITES, userId] as const,

  // Sprint 7: Events Agent namespaces
  /** Event tickets namespace: [namespace, userId] */
  eventTickets: (userId: string) =>
    [NAMESPACES.EVENT_TICKETS, userId] as const,

  /** Event favorites namespace: [namespace, userId] */
  eventFavorites: (userId: string) =>
    [NAMESPACES.EVENT_FAVORITES, userId] as const,

  // Sprint 7: Travel Agent namespaces
  /** Travel itineraries namespace: [namespace, userId] */
  travelItineraries: (userId: string) =>
    [NAMESPACES.TRAVEL_ITINERARIES, userId] as const,

  /** Travel preferences namespace: [namespace, userId] */
  travelPreferences: (userId: string) =>
    [NAMESPACES.TRAVEL_PREFERENCES, userId] as const,

  // Sprint 7: Calendar namespace (Events & Travel Agents)
  /** Calendar namespace: [namespace, userId] */
  calendar: (userId: string) => [NAMESPACES.CALENDAR, userId] as const,

  // Sprint 7: Financial profile namespace (Travel Agent)
  /** Financial profile namespace: [namespace, userId] */
  financialProfile: (userId: string) =>
    [NAMESPACES.FINANCIAL_PROFILE, userId] as const,

  // Sprint 7: Interests namespace (Events Agent)
  /** Interests namespace: [namespace, userId] */
  interests: (userId: string) => [NAMESPACES.INTERESTS, userId] as const,

  // Reflection State (v13 Section 8.12)
  /** Reflection state namespace: [namespace, userId] */
  reflectionState: (userId: string) =>
    [NAMESPACES.REFLECTION_STATE, userId] as const,

  /** Community summaries namespace: [namespace, userId] */
  communitySummaries: (userId: string) =>
    [NAMESPACES.COMMUNITY_SUMMARIES, userId] as const,

  // Sprint 8: Financial Data namespaces
  /** Financial transactions namespace: [namespace, userId] */
  financialTransactions: (userId: string) =>
    [NAMESPACES.FINANCIAL_TRANSACTIONS, userId] as const,

  // Sprint 8: Calendar Data namespaces
  /** Calendar events namespace: [namespace, userId] */
  calendarEvents: (userId: string) =>
    [NAMESPACES.CALENDAR_EVENTS, userId] as const,

  /** Calendar profile namespace: [namespace, userId] */
  calendarProfile: (userId: string) =>
    [NAMESPACES.CALENDAR_PROFILE, userId] as const,

  /** Calendar contacts namespace: [namespace, userId] - relationship extraction */
  calendarContacts: (userId: string) =>
    [NAMESPACES.CALENDAR_CONTACTS, userId] as const,

  // Sprint 8: Diagnostic Agent namespace
  /** Diagnostic reports namespace: [namespace, userId] */
  diagnosticReports: (userId: string) =>
    [NAMESPACES.DIAGNOSTIC_REPORTS, userId] as const,

  // Sprint 10: Cross-Device Sync namespaces
  /** Sync state namespace: [namespace, userId] - vector clocks, conflict resolution */
  syncState: (userId: string) => [NAMESPACES.SYNC_STATE, userId] as const,

  /** Sync peers namespace: [namespace, userId] - known peer devices */
  syncPeers: (userId: string) => [NAMESPACES.SYNC_PEERS, userId] as const,

  /** Device registry namespace: [namespace, userId] - registered devices */
  deviceRegistry: (userId: string) =>
    [NAMESPACES.DEVICE_REGISTRY, userId] as const,

  // Sprint 10: E2EE Backup namespaces
  /** Backup manifest namespace: [namespace, userId] - backup metadata */
  backupManifest: (userId: string) =>
    [NAMESPACES.BACKUP_MANIFEST, userId] as const,

  /** Backup history namespace: [namespace, userId] - backup/restore history */
  backupHistory: (userId: string) =>
    [NAMESPACES.BACKUP_HISTORY, userId] as const,

  /** Recovery key hash namespace: [namespace, userId] - for key verification */
  recoveryKeyHash: (userId: string) =>
    [NAMESPACES.RECOVERY_KEY_HASH, userId] as const,

  // Sprint 11: UI State namespaces
  /** UI preferences namespace: [namespace, userId] */
  uiPreferences: (userId: string) =>
    [NAMESPACES.UI_PREFERENCES, userId] as const,

  /** UI filter state namespace: [namespace, userId] */
  uiFilterState: (userId: string) =>
    [NAMESPACES.UI_FILTER_STATE, userId] as const,
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
  [NAMESPACES.DATA_SOURCE_CONFIGS]: 'private', // User data source configs - device-local
  [NAMESPACES.AGENT_TRACES]: 'private',
  [NAMESPACES.LLM_USAGE]: 'private',
  [NAMESPACES.SYNC_LOGS]: 'private',
  [NAMESPACES.LLM_BUDGET]: 'private', // User's LLM budget tracking
  [NAMESPACES.LLM_CACHE]: 'private', // Cached LLM responses - device-local

  // Sprint 7: Restaurant Agent namespaces
  [NAMESPACES.DINING_RESERVATIONS]: 'sensitive', // Reservation details
  [NAMESPACES.RESTAURANT_FAVORITES]: 'public', // Public preferences

  // Sprint 7: Events Agent namespaces
  [NAMESPACES.EVENT_TICKETS]: 'sensitive', // Ticket purchase info
  [NAMESPACES.EVENT_FAVORITES]: 'public', // Public preferences

  // Sprint 7: Travel Agent namespaces
  [NAMESPACES.TRAVEL_ITINERARIES]: 'sensitive', // Travel plans
  [NAMESPACES.TRAVEL_PREFERENCES]: 'public', // Public preferences

  // Sprint 7: Additional namespaces
  [NAMESPACES.CALENDAR]: 'private', // Calendar is private
  [NAMESPACES.FINANCIAL_PROFILE]: 'private', // Financial data is private
  [NAMESPACES.INTERESTS]: 'public', // Interests are public preferences

  // Reflection State (v13 Section 8.12)
  [NAMESPACES.REFLECTION_STATE]: 'private', // Reflection triggers are device-internal

  // Sprint 8: Financial Data
  [NAMESPACES.FINANCIAL_TRANSACTIONS]: 'private', // Financial transactions are private

  // Sprint 8: Calendar Data
  [NAMESPACES.CALENDAR_EVENTS]: 'private', // Calendar events are private
  [NAMESPACES.CALENDAR_PROFILE]: 'private', // Calendar profile is private
  [NAMESPACES.CALENDAR_CONTACTS]: 'sensitive', // Relationship data is sensitive

  // Sprint 8: Diagnostic Agent
  [NAMESPACES.DIAGNOSTIC_REPORTS]: 'private', // Diagnostic reports are private

  // Sprint 10: Cross-Device Sync
  [NAMESPACES.SYNC_STATE]: 'private', // Internal sync state
  [NAMESPACES.SYNC_PEERS]: 'private', // Peer device list
  [NAMESPACES.DEVICE_REGISTRY]: 'private', // Device registration

  // Sprint 10: E2EE Backup
  [NAMESPACES.BACKUP_MANIFEST]: 'private', // Backup metadata
  [NAMESPACES.BACKUP_HISTORY]: 'private', // Backup history
  [NAMESPACES.RECOVERY_KEY_HASH]: 'private', // Recovery key verification

  // Sprint 11: UI State
  [NAMESPACES.UI_PREFERENCES]: 'private', // User preferences are private
  [NAMESPACES.UI_FILTER_STATE]: 'private', // Filter state is private
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
  [NAMESPACES.DATA_SOURCE_CONFIGS]: 'none', // Device-local data source configs
  [NAMESPACES.AGENT_TRACES]: 'none', // Device-local
  [NAMESPACES.LLM_USAGE]: 'none', // Device-local
  [NAMESPACES.SYNC_LOGS]: 'none', // Device-local
  [NAMESPACES.LLM_BUDGET]: 'full', // Budget syncs across devices (per-user limit)
  [NAMESPACES.LLM_CACHE]: 'none', // Device-local cache, never syncs

  // Sprint 7: Restaurant Agent namespaces
  [NAMESPACES.DINING_RESERVATIONS]: 'full', // Reservations sync
  [NAMESPACES.RESTAURANT_FAVORITES]: 'full', // Favorites sync

  // Sprint 7: Events Agent namespaces
  [NAMESPACES.EVENT_TICKETS]: 'full', // Tickets sync
  [NAMESPACES.EVENT_FAVORITES]: 'full', // Favorites sync

  // Sprint 7: Travel Agent namespaces
  [NAMESPACES.TRAVEL_ITINERARIES]: 'full', // Itineraries sync
  [NAMESPACES.TRAVEL_PREFERENCES]: 'full', // Preferences sync

  // Sprint 7: Additional namespaces
  [NAMESPACES.CALENDAR]: 'full', // Calendar syncs across devices
  [NAMESPACES.FINANCIAL_PROFILE]: 'full', // Financial profile syncs
  [NAMESPACES.INTERESTS]: 'full', // Interests sync

  // Reflection State (v13 Section 8.12 / 8.14.1)
  [NAMESPACES.REFLECTION_STATE]: 'full', // Reflection triggers must be consistent

  // Sprint 8: Financial Data
  [NAMESPACES.FINANCIAL_TRANSACTIONS]: 'selective', // Recent transactions sync

  // Sprint 8: Calendar Data
  [NAMESPACES.CALENDAR_EVENTS]: 'selective', // Recent events sync
  [NAMESPACES.CALENDAR_PROFILE]: 'full', // Profile syncs across devices
  [NAMESPACES.CALENDAR_CONTACTS]: 'full', // Relationship data syncs

  // Sprint 8: Diagnostic Agent
  [NAMESPACES.DIAGNOSTIC_REPORTS]: 'full', // Reports sync across devices

  // Sprint 10: Cross-Device Sync
  [NAMESPACES.SYNC_STATE]: 'full', // Sync state must be consistent across devices
  [NAMESPACES.SYNC_PEERS]: 'full', // Peer list syncs so devices know each other
  [NAMESPACES.DEVICE_REGISTRY]: 'full', // Device registry syncs

  // Sprint 10: E2EE Backup
  [NAMESPACES.BACKUP_MANIFEST]: 'full', // Manifest syncs so all devices know backup status
  [NAMESPACES.BACKUP_HISTORY]: 'full', // History syncs for audit
  [NAMESPACES.RECOVERY_KEY_HASH]: 'full', // Key hash syncs for verification

  // Sprint 11: UI State
  [NAMESPACES.UI_PREFERENCES]: 'full', // Theme preferences sync across devices
  [NAMESPACES.UI_FILTER_STATE]: 'none', // Device-local filter state (doesn't sync)
};
