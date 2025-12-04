/**
 * Agent Framework Types - v13 Section 3.6
 *
 * Types for agent execution, context, and results.
 */

import type {
  AgentType,
  AgentLevel,
  AgentLimits,
  AgentPermissions,
  MissionCard,
} from '@ownyou/shared-types';
import type { Episode } from '@ownyou/shared-types';
import type { LLMClient } from '@ownyou/llm-client';

/**
 * Store interface for agent memory operations
 */
export interface AgentStore {
  /** Get item by namespace and key */
  get(namespace: readonly string[], key: string): Promise<unknown | null>;

  /** Put item in namespace with key */
  put(namespace: readonly string[], key: string, value: unknown): Promise<void>;

  /** Delete item from namespace */
  delete(namespace: readonly string[], key: string): Promise<void>;

  /** Search namespace with query */
  search(
    namespace: readonly string[],
    query: string,
    options?: { limit?: number }
  ): Promise<Array<{ key: string; value: unknown; score?: number }>>;

  /** List items in namespace */
  list(
    namespace: readonly string[],
    options?: { prefix?: string; limit?: number; offset?: number }
  ): Promise<Array<{ key: string; value: unknown }>>;
}

/**
 * Tool definition for agent capabilities
 */
export interface AgentTool<TInput = unknown, TOutput = unknown> {
  /** Tool name */
  name: string;

  /** Tool description for LLM */
  description: string;

  /** JSON schema for parameters */
  parameters?: Record<string, unknown>;

  /** Execute the tool */
  execute(input: TInput): Promise<TOutput>;
}

/**
 * Tool call record during agent execution
 */
export interface ToolCall {
  /** Tool name */
  name: string;

  /** Input parameters */
  input: unknown;

  /** Output result */
  output: unknown;

  /** Execution duration in ms */
  durationMs: number;

  /** Timestamp of call */
  timestamp: number;
}

/**
 * LLM call record during agent execution
 */
export interface LlmCall {
  /** Model used */
  model: string;

  /** Input prompt or messages */
  input: unknown;

  /** Output response */
  output: string;

  /** Token usage */
  tokens: {
    input: number;
    output: number;
  };

  /** Cost in USD */
  costUsd: number;

  /** Duration in ms */
  durationMs: number;

  /** Timestamp of call */
  timestamp: number;
}

/**
 * Memory operation record during agent execution
 */
export interface MemoryOp {
  /** Operation type */
  type: 'read' | 'write' | 'search' | 'delete';

  /** Namespace accessed */
  namespace: string;

  /** Key accessed (if applicable) */
  key?: string;

  /** Query used (for search) */
  query?: string;

  /** Timestamp of operation */
  timestamp: number;
}

/**
 * Resource usage counters during agent execution
 */
export interface ResourceUsage {
  /** Number of tool calls made */
  toolCalls: number;

  /** Number of LLM calls made */
  llmCalls: number;

  /** Number of memory reads */
  memoryReads: number;

  /** Number of memory writes */
  memoryWrites: number;

  /** Elapsed time in seconds */
  elapsedSeconds: number;

  /** Total cost in USD */
  totalCostUsd: number;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  /** User ID */
  userId: string;

  /** Triggering mission card (if any) */
  missionCard?: MissionCard;

  /** Trigger data (e.g., IAB classification that triggered the agent) */
  triggerData?: unknown;

  /** Store interface for memory operations */
  store: AgentStore;

  /** Available tools */
  tools: AgentTool[];

  /**
   * LLM client for agent LLM calls (optional)
   * When provided, agents can use LLM for intent detection and reasoning.
   * The provider selection is per-operation based on user settings.
   */
  llm?: LLMClient;

  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Generated or updated mission card */
  missionCard?: MissionCard;

  /** Response message for user */
  response?: string;

  /** Error message if failed */
  error?: string;

  /** Episode recording the interaction */
  episode?: Episode;

  /** Resource usage during execution */
  usage: ResourceUsage;

  /** Detailed tool calls */
  toolCalls: ToolCall[];

  /** Detailed LLM calls */
  llmCalls: LlmCall[];

  /** Memory operations performed */
  memoryOps: MemoryOp[];
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent type */
  agentType: AgentType;

  /** Agent level (L1/L2/L3) */
  level: AgentLevel;

  /** Agent permissions (namespace access) */
  permissions: AgentPermissions;

  /** Custom limits (overrides level defaults) */
  customLimits?: Partial<AgentLimits>;
}

/**
 * Limits violation error
 */
export interface LimitsViolation {
  /** Which limit was violated */
  limit: keyof AgentLimits;

  /** Current value */
  current: number;

  /** Maximum allowed */
  max: number;

  /** Human-readable message */
  message: string;
}

/**
 * Privacy violation error
 */
export interface PrivacyViolation {
  /** Operation that was denied */
  operation: 'read' | 'write' | 'search';

  /** Namespace that was accessed */
  namespace: string;

  /** Human-readable message */
  message: string;
}
