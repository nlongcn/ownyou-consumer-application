/**
 * Agent Types - v13 Section 3.6
 *
 * Types for agent permissions, limits, and mission cards.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 3.6
 */

import type { AgentType } from './memory';

/**
 * External API configuration for agent permissions
 */
export interface ExternalApiConfig {
  /** API name */
  name: string;

  /** Rate limit specification (e.g., "100/hour") */
  rateLimit: string;

  /** Whether user consent is required */
  requiresUserConsent: boolean;
}

/**
 * Tool definition for agent capabilities
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Tool parameters schema */
  parameters?: Record<string, unknown>;
}

/**
 * AgentPermissions - v13 Section 3.6.2
 *
 * Defines what an agent can access and do.
 */
export interface AgentPermissions {
  /** Which agent type these permissions apply to */
  agentType: AgentType;

  /** Memory namespace access permissions */
  memoryAccess: {
    /** Namespaces the agent can read from */
    read: string[];

    /** Namespaces the agent can write to */
    write: string[];

    /** Namespaces the agent can search */
    search: string[];
  };

  /** External APIs the agent can call */
  externalApis: ExternalApiConfig[];

  /** Tools available to the agent */
  toolDefinitions: ToolDefinition[];
}

/**
 * Agent level classification - v13 Section 3.6.3
 */
export type AgentLevel = 'L1' | 'L2' | 'L3';

/**
 * Resource limits for an agent level
 */
export interface AgentLimits {
  /** Maximum tool calls per invocation */
  maxToolCalls: number;

  /** Maximum LLM calls per invocation */
  maxLlmCalls: number;

  /** Maximum execution time in seconds */
  timeoutSeconds: number;

  /** Maximum memory reads per invocation */
  maxMemoryReads: number;

  /** Maximum memory writes per invocation */
  maxMemoryWrites: number;
}

/**
 * AGENT_LIMITS - v13 Section 3.6.3
 *
 * Predefined limits for each agent level.
 */
export const AGENT_LIMITS: Record<AgentLevel, AgentLimits> = {
  L1: {
    maxToolCalls: 3,
    maxLlmCalls: 2,
    timeoutSeconds: 30,
    maxMemoryReads: 10,
    maxMemoryWrites: 3,
  },
  L2: {
    maxToolCalls: 10,
    maxLlmCalls: 5,
    timeoutSeconds: 120,
    maxMemoryReads: 25,
    maxMemoryWrites: 10,
  },
  L3: {
    maxToolCalls: 25,
    maxLlmCalls: 10,
    timeoutSeconds: 300,
    maxMemoryReads: 50,
    maxMemoryWrites: 20,
  },
};

/**
 * Mission status progression
 */
export type MissionStatus =
  | 'CREATED'
  | 'PRESENTED'
  | 'ACTIVE'
  | 'SNOOZED'
  | 'DISMISSED'
  | 'COMPLETED';

/**
 * Mission action type
 */
export interface MissionAction {
  /** Button/action label */
  label: string;

  /** Action type */
  type: 'navigate' | 'confirm' | 'input' | 'external' | 'action';

  /** Action-specific payload */
  payload: unknown;
}

/**
 * MissionCard - v13 Section 3.4
 *
 * A proactive suggestion presented to the user.
 */
export interface MissionCard {
  /** Unique identifier */
  id: string;

  /** Agent type that handles this mission */
  type: AgentType;

  /** Mission title */
  title: string;

  /** Brief description */
  summary: string;

  /** Urgency level */
  urgency: 'low' | 'medium' | 'high';

  /** Current status */
  status: MissionStatus;

  /** When mission was created */
  createdAt: number;

  /** When mission expires (optional) */
  expiresAt?: number;

  /** If snoozed, when to resurface */
  snoozedUntil?: number;

  /** Which Ikigai dimensions this aligns with */
  ikigaiDimensions: string[];

  /** Boost to mission score based on Ikigai alignment */
  ikigaiAlignmentBoost: number;

  /** Primary action button */
  primaryAction: MissionAction;

  /** Additional action buttons */
  secondaryActions?: MissionAction[];

  /** Associated agent conversation thread */
  agentThreadId: string;

  /** Memory/episode references supporting this mission */
  evidenceRefs: string[];

  /** User rating after completion (1-5) */
  userRating?: 1 | 2 | 3 | 4 | 5;

  /** User feedback after completion */
  completionFeedback?: string;
}

// Re-export AgentType for convenience
export type { AgentType } from './memory';
