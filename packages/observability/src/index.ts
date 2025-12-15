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
  // Sprint 9: Enhanced AgentStep Types (v13 Section 10.2)
  type AgentStepType,
  type AgentStep,
  type LLMStepDetail,
  type ToolStepDetail,
  type MemoryStepDetail,
  type ExternalApiStepDetail,
  type DecisionStepDetail,
  type TraceResourceSummary,
  type RecordStepOptions,
} from './traces';

// Sprint 9: Privacy-preserving debugging (v13 Section 10.8)
export {
  sanitizeForTrace,
  createSanitizer,
  DEFAULT_SANITIZE_CONFIG,
  type SanitizeConfig,
} from './privacy';

// Sprint 9: Sync debugging (v13 Section 10.3)
export {
  SyncLogger,
  CONFLICT_NOTIFICATION_RULES,
  type SyncLog,
  type SyncEventType,
  type SyncDirection,
  type ConnectionType,
  type ConflictResolution,
  type ConflictNotificationLevel,
  type SyncDetails,
  type ConflictDetails,
  type ConnectionDetails,
  type ErrorDetails,
  type SyncStats,
  type SyncLogQueryOptions,
} from './sync';

// Sprint 9: LLM cost metering (v13 Section 10.4)
export {
  LLMMetricsCollector,
  type LLMMetrics,
  type LLMMetricsConfig,
  type LLMUsageRecord,
  type ThrottleState,
  type AlertType,
  type RecommendationType,
  type CurrentPeriodMetrics,
  type AggregatedMetrics,
  type DailyUsage,
  type UsageProjections,
  type Alert,
} from './llm';

// Sprint 9: Retention management (v13 Section 10)
export {
  RetentionManager,
  DEFAULT_RETENTION_POLICIES,
  type RetentionPolicy,
} from './retention';

// Sprint 9: GDPR data export (v13 Section 10.6)
export {
  DataExporter,
  type ExportableNamespace,
  type ExportOptions,
  type ExportMetadata,
  type DataExportResult,
  type DeletionAuditTrail,
  type DataDeletionResult,
} from './export';
