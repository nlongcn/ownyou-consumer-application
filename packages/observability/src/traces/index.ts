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
  // Sprint 9: Enhanced AgentStep Types (v13 Section 10.2)
  AgentStepType,
  AgentStep,
  LLMStepDetail,
  ToolStepDetail,
  MemoryStepDetail,
  ExternalApiStepDetail,
  DecisionStepDetail,
  TraceResourceSummary,
  RecordStepOptions,
} from './types';

export { AgentTracer } from './tracer';
