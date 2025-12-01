/**
 * Traces Module - v13 Section 10.2
 *
 * Exports agent tracing functionality.
 */

export { TraceLevel } from './types';
export type {
  AgentTrace,
  TraceSpan,
  TraceEvent,
  TraceStatus,
  CostRecord,
  ToolCallRecord,
  MemoryOpRecord,
  TraceStartOptions,
  SpanStartOptions,
  TraceEndOptions,
  EventLogOptions,
  TraceQueryOptions,
  CostSummary,
} from './types';

export { AgentTracer } from './tracer';
