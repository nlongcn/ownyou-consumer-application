/**
 * @ownyou/shared-types
 *
 * OwnYou shared type definitions - v13 architecture aligned.
 *
 * This package provides all type definitions for the OwnYou system,
 * including memory types, entity types, identity stubs, Ikigai profile,
 * agent configuration, namespace constants, and sync types.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md
 */

// Memory types (v13 Section 8.4)
export type {
  Memory,
  PrivacyTier,
  Episode,
  AgentType,
  ProceduralRule,
  SyncableMemory,
  ConflictStrategy,
} from './memory';

// Entity types (v13 Section 8.4.4)
export type {
  Entity,
  EntityType,
  Relationship,
  RelationshipType,
} from './entities';

// Identity types (v13 Section 7.x - BBS+ stubs)
export type { Pseudonym, DisclosureProof, TrackingId } from './identity';

// Ikigai types (v13 Section 2)
export type {
  IkigaiProfile,
  ExperienceType,
  Activity,
  Person,
  TopicScore,
  IkigaiEvidence,
} from './ikigai';

// Agent types (v13 Section 3.6)
export type {
  AgentPermissions,
  ExternalApiConfig,
  ToolDefinition,
  AgentLevel,
  AgentLimits,
  MissionCard,
  MissionStatus,
  MissionAction,
} from './agent';
export { AGENT_LIMITS } from './agent';

// Namespace constants (v13 Section 8.12)
export type { Namespace } from './namespaces';
export { NAMESPACES, NS, NAMESPACE_PRIVACY, NAMESPACE_SYNC_SCOPE } from './namespaces';

// Sync types (v13 Section 8.14)
export type {
  SyncPayload,
  VectorClock,
  SyncConflictStrategy,
  ConflictResolution,
  SyncState,
  SyncConfig,
} from './sync';
export { CONFLICT_STRATEGIES } from './sync';
