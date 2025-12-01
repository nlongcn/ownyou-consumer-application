/**
 * @ownyou/observability - v13 Section 10
 *
 * Observability package for agent traces and cost metering.
 *
 * @example
 * ```typescript
 * import { AgentTracer, TraceLevel } from '@ownyou/observability';
 *
 * const tracer = new AgentTracer();
 *
 * const trace = tracer.startTrace({
 *   userId: 'user_123',
 *   agentType: 'mission_agent',
 *   missionId: 'mission_1',
 * });
 *
 * const spanId = tracer.startSpan(trace.id, { name: 'llm_call' });
 * tracer.recordCost(trace.id, { model: 'gpt-4o-mini', inputTokens: 100, outputTokens: 50, costUsd: 0.0001 });
 * tracer.endSpan(trace.id, spanId);
 *
 * tracer.endTrace(trace.id, { status: 'success' });
 * ```
 */

export {
  AgentTracer,
  TraceLevel,
  type AgentTrace,
  type TraceSpan,
  type TraceEvent,
  type TraceStatus,
  type CostRecord,
  type ToolCallRecord,
  type MemoryOpRecord,
  type TraceStartOptions,
  type SpanStartOptions,
  type TraceEndOptions,
  type EventLogOptions,
  type TraceQueryOptions,
  type CostSummary,
} from './traces';
