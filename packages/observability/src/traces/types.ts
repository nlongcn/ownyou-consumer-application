/**
 * Trace Types - v13 Section 10.2
 *
 * Type definitions for agent traces and observability.
 */

import type { AgentType } from '@ownyou/shared-types';

/**
 * Trace log levels
 */
export enum TraceLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Trace status
 */
export type TraceStatus = 'running' | 'success' | 'error' | 'cancelled';

/**
 * Agent trace - v13 Section 10.2
 */
export interface AgentTrace {
  id: string;
  userId: string;
  agentType: AgentType | string;
  missionId?: string;

  status: TraceStatus;
  startTime: number;
  endTime?: number;
  duration?: number;

  spans: TraceSpan[];
  events: TraceEvent[];

  // Sprint 9: Enhanced step tracking (v13 Section 10.2)
  steps: AgentStep[];
  resources: TraceResourceSummary;

  // Cost tracking (legacy - kept for backwards compatibility)
  totalCostUsd: number;
  llmCalls: number;
  toolCalls: number;

  // Memory operations
  memoryOps: {
    get: number;
    put: number;
    search: number;
    delete: number;
  };

  // Error info
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Trace span - represents a unit of work
 */
export interface TraceSpan {
  id: string;
  name: string;
  parentSpanId?: string;

  startTime: number;
  endTime?: number;
  duration?: number;

  attributes: Record<string, unknown>;
}

/**
 * Trace event - log entry
 */
export interface TraceEvent {
  timestamp: number;
  level: TraceLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Cost record
 */
export interface CostRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/**
 * Tool call record
 */
export interface ToolCallRecord {
  tool: string;
  input: unknown;
  output: unknown;
  duration: number;
}

/**
 * Memory operation record
 */
export interface MemoryOpRecord {
  operation: 'get' | 'put' | 'search' | 'delete';
  namespace: string;
  count: number;
  duration: number;
}

/**
 * Trace start options
 */
export interface TraceStartOptions {
  userId: string;
  agentType: AgentType | string;
  missionId?: string;
}

/**
 * Span start options
 */
export interface SpanStartOptions {
  name: string;
  parentSpanId?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Trace end options
 */
export interface TraceEndOptions {
  status: 'success' | 'error' | 'cancelled';
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Event log options
 */
export interface EventLogOptions {
  level: TraceLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Trace query options
 */
export interface TraceQueryOptions {
  userId: string;
  agentType?: AgentType | string;
  status?: TraceStatus;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
}

/**
 * Cost summary
 */
export interface CostSummary {
  totalCostUsd: number;
  traceCount: number;
  byModel: Record<string, { cost: number; calls: number }>;
  byAgent: Record<string, { cost: number; calls: number }>;
}

// ========== Sprint 9: Enhanced AgentStep Types (v13 Section 10.2) ==========

/**
 * Step types for agent execution tracing
 */
export type AgentStepType =
  | 'llm_call'
  | 'tool_call'
  | 'memory_read'
  | 'memory_write'
  | 'decision'
  | 'external_api';

/**
 * LLM call step detail - v13 Section 10.2
 */
export interface LLMStepDetail {
  model: string;
  promptPreview: string;
  responsePreview: string;
  tokens: {
    input: number;
    output: number;
  };
  costUsd: number;
}

/**
 * Tool call step detail - v13 Section 10.2
 */
export interface ToolStepDetail {
  name: string;
  args: Record<string, unknown>;
  resultPreview: string;
  success: boolean;
  error?: string;
}

/**
 * Memory operation step detail - v13 Section 10.2
 */
export interface MemoryStepDetail {
  operation: 'read' | 'write' | 'search' | 'delete';
  namespace: string;
  key?: string;
  query?: string;
  resultCount?: number;
}

/**
 * External API call step detail - v13 Section 10.2
 */
export interface ExternalApiStepDetail {
  service: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  cached: boolean;
}

/**
 * Decision step detail - v13 Section 10.2
 */
export interface DecisionStepDetail {
  decisionPoint: string;
  optionsConsidered: string[];
  selected: string;
  reasoning: string;
}

/**
 * Agent step - v13 Section 10.2
 *
 * Represents a single step in agent execution with full detail
 */
export interface AgentStep {
  stepIndex: number;
  stepType: AgentStepType;
  timestamp: number;
  durationMs?: number;

  // Type-specific detail (only one will be set based on stepType)
  llm?: LLMStepDetail;
  tool?: ToolStepDetail;
  memory?: MemoryStepDetail;
  externalApi?: ExternalApiStepDetail;
  decision?: DecisionStepDetail;
}

/**
 * Resource summary for a trace - v13 Section 10.2
 *
 * Aggregated resource usage from all steps
 */
export interface TraceResourceSummary {
  llmCalls: number;
  llmTokens: {
    input: number;
    output: number;
  };
  llmCostUsd: number;
  toolCalls: number;
  memoryReads: number;
  memoryWrites: number;
  externalApiCalls: number;
}

/**
 * Step recording options - v13 Section 10.2
 */
export interface RecordStepOptions {
  stepType: AgentStepType;
  durationMs?: number;
  llm?: LLMStepDetail;
  tool?: ToolStepDetail;
  memory?: MemoryStepDetail;
  externalApi?: ExternalApiStepDetail;
  decision?: DecisionStepDetail;
}
