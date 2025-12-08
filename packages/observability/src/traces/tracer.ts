/**
 * Agent Tracer - v13 Section 10.2
 *
 * Records and manages agent execution traces.
 */

import type {
  AgentTrace,
  TraceSpan,
  TraceEvent,
  TraceStartOptions,
  SpanStartOptions,
  TraceEndOptions,
  EventLogOptions,
  CostRecord,
  ToolCallRecord,
  MemoryOpRecord,
  TraceQueryOptions,
  CostSummary,
  RecordStepOptions,
  AgentStep,
  TraceResourceSummary,
} from './types';

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * AgentTracer - Records agent execution traces
 */
export class AgentTracer {
  private traces: Map<string, AgentTrace> = new Map();
  private costByModel: Map<string, { cost: number; calls: number }> = new Map();
  private costByAgent: Map<string, { cost: number; calls: number }> = new Map();

  /**
   * Start a new trace
   */
  startTrace(options: TraceStartOptions): AgentTrace {
    const trace: AgentTrace = {
      id: generateId('trace'),
      userId: options.userId,
      agentType: options.agentType,
      missionId: options.missionId,
      status: 'running',
      startTime: Date.now(),
      spans: [],
      events: [],
      // Sprint 9: Enhanced step tracking (v13 Section 10.2)
      steps: [],
      resources: {
        llmCalls: 0,
        llmTokens: { input: 0, output: 0 },
        llmCostUsd: 0,
        toolCalls: 0,
        memoryReads: 0,
        memoryWrites: 0,
        externalApiCalls: 0,
      },
      // Legacy cost tracking
      totalCostUsd: 0,
      llmCalls: 0,
      toolCalls: 0,
      memoryOps: {
        get: 0,
        put: 0,
        search: 0,
        delete: 0,
      },
    };

    this.traces.set(trace.id, trace);
    return trace;
  }

  /**
   * Get a trace by ID
   */
  getTrace(traceId: string): AgentTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Start a span within a trace
   */
  startSpan(traceId: string, options: SpanStartOptions): string {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    const span: TraceSpan = {
      id: generateId('span'),
      name: options.name,
      parentSpanId: options.parentSpanId,
      startTime: Date.now(),
      attributes: options.attributes ?? {},
    };

    trace.spans.push(span);
    return span.id;
  }

  /**
   * End a span
   */
  endSpan(traceId: string, spanId: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find((s) => s.id === spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
    }
  }

  /**
   * Log an event to a trace
   */
  logEvent(traceId: string, options: EventLogOptions): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    const event: TraceEvent = {
      timestamp: Date.now(),
      level: options.level,
      message: options.message,
      metadata: options.metadata,
    };

    trace.events.push(event);
  }

  /**
   * End a trace
   */
  endTrace(traceId: string, options: TraceEndOptions): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.status = options.status;
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;

    if (options.error) {
      trace.error = options.error;
    }
  }

  /**
   * Record LLM cost
   */
  recordCost(traceId: string, record: CostRecord): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.totalCostUsd += record.costUsd;
    trace.llmCalls++;

    // Track by model
    const modelStats = this.costByModel.get(record.model) ?? { cost: 0, calls: 0 };
    modelStats.cost += record.costUsd;
    modelStats.calls++;
    this.costByModel.set(record.model, modelStats);

    // Track by agent
    const agentStats = this.costByAgent.get(trace.agentType) ?? { cost: 0, calls: 0 };
    agentStats.cost += record.costUsd;
    agentStats.calls++;
    this.costByAgent.set(trace.agentType, agentStats);
  }

  /**
   * Record tool call
   */
  recordToolCall(traceId: string, record: ToolCallRecord): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.toolCalls++;

    // Log as event
    this.logEvent(traceId, {
      level: 'info' as any, // Will be converted to TraceLevel.INFO
      message: `Tool call: ${record.tool}`,
      metadata: {
        tool: record.tool,
        duration: record.duration,
        input: record.input,
        output: record.output,
      },
    });
  }

  /**
   * Record memory operation
   */
  recordMemoryOp(traceId: string, record: MemoryOpRecord): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.memoryOps[record.operation] += record.count;
  }

  // ========== Sprint 9: Enhanced Step Recording (v13 Section 10.2) ==========

  /**
   * Record an agent step with full detail
   */
  recordStep(traceId: string, options: RecordStepOptions): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    const step: AgentStep = {
      stepIndex: trace.steps.length,
      stepType: options.stepType,
      timestamp: Date.now(),
      durationMs: options.durationMs,
      llm: options.llm,
      tool: options.tool,
      memory: options.memory,
      externalApi: options.externalApi,
      decision: options.decision,
    };

    trace.steps.push(step);

    // Update resource summary based on step type
    this.updateResourceSummary(trace, options);
  }

  /**
   * Update trace resource summary based on step
   */
  private updateResourceSummary(trace: AgentTrace, step: RecordStepOptions): void {
    switch (step.stepType) {
      case 'llm_call':
        if (step.llm) {
          trace.resources.llmCalls++;
          trace.resources.llmTokens.input += step.llm.tokens.input;
          trace.resources.llmTokens.output += step.llm.tokens.output;
          trace.resources.llmCostUsd += step.llm.costUsd;
          // Also update legacy tracking
          trace.totalCostUsd += step.llm.costUsd;
          trace.llmCalls++;
        }
        break;

      case 'tool_call':
        trace.resources.toolCalls++;
        trace.toolCalls++;
        break;

      case 'memory_read':
        trace.resources.memoryReads++;
        break;

      case 'memory_write':
        trace.resources.memoryWrites++;
        break;

      case 'external_api':
        trace.resources.externalApiCalls++;
        break;

      case 'decision':
        // Decisions don't have resource impact
        break;
    }
  }

  /**
   * List traces with filtering
   */
  listTraces(options: TraceQueryOptions): AgentTrace[] {
    let traces = Array.from(this.traces.values());

    // Filter by userId
    traces = traces.filter((t) => t.userId === options.userId);

    // Filter by agentType
    if (options.agentType) {
      traces = traces.filter((t) => t.agentType === options.agentType);
    }

    // Filter by status
    if (options.status) {
      traces = traces.filter((t) => t.status === options.status);
    }

    // Filter by time range
    if (options.startTime) {
      traces = traces.filter((t) => t.startTime >= options.startTime!);
    }
    if (options.endTime) {
      traces = traces.filter((t) => t.startTime <= options.endTime!);
    }

    // Sort by start time descending
    traces.sort((a, b) => b.startTime - a.startTime);

    // Paginate
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    return traces.slice(offset, offset + limit);
  }

  /**
   * Get cost summary for a user
   */
  getCostSummary(userId: string): CostSummary {
    const traces = this.listTraces({ userId });

    let totalCostUsd = 0;
    for (const trace of traces) {
      totalCostUsd += trace.totalCostUsd;
    }

    return {
      totalCostUsd,
      traceCount: traces.length,
      byModel: Object.fromEntries(this.costByModel),
      byAgent: Object.fromEntries(this.costByAgent),
    };
  }

  /**
   * Clear all traces (for testing)
   */
  clear(): void {
    this.traces.clear();
    this.costByModel.clear();
    this.costByAgent.clear();
  }
}
