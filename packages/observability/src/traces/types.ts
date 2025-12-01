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

  // Cost tracking
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
