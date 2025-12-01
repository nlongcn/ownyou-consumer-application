/**
 * Agent Trace Tests - v13 Section 10.2
 *
 * Tests for agent trace recording and querying
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentTracer,
  type AgentTrace,
  type TraceSpan,
  type TraceEvent,
  TraceLevel,
} from '../traces';

describe('AgentTracer (v13 Section 10.2)', () => {
  let tracer: AgentTracer;
  const userId = 'user_123';

  beforeEach(() => {
    tracer = new AgentTracer();
  });

  describe('Trace Creation', () => {
    it('should create a new trace', () => {
      const trace = tracer.startTrace({
        userId,
        agentType: 'mission_agent',
        missionId: 'mission_1',
      });

      expect(trace.id).toBeDefined();
      expect(trace.userId).toBe(userId);
      expect(trace.agentType).toBe('mission_agent');
      expect(trace.status).toBe('running');
      expect(trace.startTime).toBeDefined();
    });

    it('should generate unique trace IDs', () => {
      const trace1 = tracer.startTrace({ userId, agentType: 'shopping' });
      const trace2 = tracer.startTrace({ userId, agentType: 'shopping' });

      expect(trace1.id).not.toBe(trace2.id);
    });
  });

  describe('Span Recording', () => {
    it('should add spans to trace', () => {
      const trace = tracer.startTrace({ userId, agentType: 'travel' });

      tracer.startSpan(trace.id, {
        name: 'llm_call',
        attributes: { model: 'gpt-4o-mini' },
      });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.spans.length).toBe(1);
      expect(updated?.spans[0].name).toBe('llm_call');
    });

    it('should track span duration', () => {
      const trace = tracer.startTrace({ userId, agentType: 'shopping' });

      const spanId = tracer.startSpan(trace.id, { name: 'memory_search' });
      tracer.endSpan(trace.id, spanId);

      const updated = tracer.getTrace(trace.id);
      expect(updated?.spans[0].endTime).toBeDefined();
      expect(updated?.spans[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should support nested spans', () => {
      const trace = tracer.startTrace({ userId, agentType: 'events' });

      const parentSpanId = tracer.startSpan(trace.id, { name: 'agent_step' });
      tracer.startSpan(trace.id, { name: 'llm_call', parentSpanId });
      tracer.startSpan(trace.id, { name: 'tool_call', parentSpanId });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.spans.length).toBe(3);
      expect(updated?.spans[1].parentSpanId).toBe(parentSpanId);
      expect(updated?.spans[2].parentSpanId).toBe(parentSpanId);
    });
  });

  describe('Event Logging', () => {
    it('should log events to trace', () => {
      const trace = tracer.startTrace({ userId, agentType: 'content' });

      tracer.logEvent(trace.id, {
        level: TraceLevel.INFO,
        message: 'Starting agent execution',
      });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.events.length).toBe(1);
      expect(updated?.events[0].message).toBe('Starting agent execution');
    });

    it('should support different log levels', () => {
      const trace = tracer.startTrace({ userId, agentType: 'diagnostic' });

      tracer.logEvent(trace.id, { level: TraceLevel.DEBUG, message: 'Debug msg' });
      tracer.logEvent(trace.id, { level: TraceLevel.INFO, message: 'Info msg' });
      tracer.logEvent(trace.id, { level: TraceLevel.WARN, message: 'Warn msg' });
      tracer.logEvent(trace.id, { level: TraceLevel.ERROR, message: 'Error msg' });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.events.length).toBe(4);
    });

    it('should attach metadata to events', () => {
      const trace = tracer.startTrace({ userId, agentType: 'restaurant' });

      tracer.logEvent(trace.id, {
        level: TraceLevel.INFO,
        message: 'LLM call completed',
        metadata: {
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
        },
      });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.events[0].metadata?.model).toBe('gpt-4o-mini');
    });
  });

  describe('Trace Completion', () => {
    it('should mark trace as completed', () => {
      const trace = tracer.startTrace({ userId, agentType: 'shopping' });

      tracer.endTrace(trace.id, { status: 'success' });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.status).toBe('success');
      expect(updated?.endTime).toBeDefined();
      expect(updated?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should mark trace as failed with error', () => {
      const trace = tracer.startTrace({ userId, agentType: 'travel' });

      tracer.endTrace(trace.id, {
        status: 'error',
        error: { message: 'API timeout', code: 'TIMEOUT' },
      });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.status).toBe('error');
      expect(updated?.error?.message).toBe('API timeout');
    });
  });

  describe('Cost Tracking', () => {
    it('should track LLM costs in trace', () => {
      const trace = tracer.startTrace({ userId, agentType: 'mission_agent' });

      tracer.recordCost(trace.id, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0005,
      });

      tracer.recordCost(trace.id, {
        model: 'gpt-4o-mini',
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.00025,
      });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.totalCostUsd).toBe(0.00075);
      expect(updated?.llmCalls).toBe(2);
    });

    it('should track tool calls', () => {
      const trace = tracer.startTrace({ userId, agentType: 'shopping' });

      tracer.recordToolCall(trace.id, {
        tool: 'search_products',
        input: { query: 'laptop' },
        output: { results: 10 },
        duration: 150,
      });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.toolCalls).toBe(1);
    });
  });

  describe('Trace Querying', () => {
    beforeEach(() => {
      // Create multiple traces
      for (let i = 0; i < 5; i++) {
        const trace = tracer.startTrace({
          userId,
          agentType: i % 2 === 0 ? 'shopping' : 'travel',
        });
        tracer.endTrace(trace.id, { status: 'success' });
      }
    });

    it('should list traces for user', () => {
      const traces = tracer.listTraces({ userId });
      expect(traces.length).toBe(5);
    });

    it('should filter by agent type', () => {
      const traces = tracer.listTraces({ userId, agentType: 'shopping' });
      expect(traces.length).toBe(3);
    });

    it('should paginate results', () => {
      const page1 = tracer.listTraces({ userId, limit: 2 });
      const page2 = tracer.listTraces({ userId, limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
    });
  });

  describe('Memory Integration', () => {
    it('should track memory operations', () => {
      const trace = tracer.startTrace({ userId, agentType: 'diagnostic' });

      tracer.recordMemoryOp(trace.id, {
        operation: 'search',
        namespace: 'ownyou.semantic',
        count: 10,
        duration: 25,
      });

      tracer.recordMemoryOp(trace.id, {
        operation: 'put',
        namespace: 'ownyou.episodic',
        count: 1,
        duration: 5,
      });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.memoryOps.search).toBe(10);
      expect(updated?.memoryOps.put).toBe(1);
    });
  });
});

describe('CostMeter (v13 Section 10.4)', () => {
  it('should aggregate costs over time period', async () => {
    const tracer = new AgentTracer();
    const userId = 'user_123';

    // Create traces with costs
    for (let i = 0; i < 3; i++) {
      const trace = tracer.startTrace({ userId, agentType: 'mission_agent' });
      tracer.recordCost(trace.id, {
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.001,
      });
      tracer.endTrace(trace.id, { status: 'success' });
    }

    const summary = tracer.getCostSummary(userId);

    expect(summary.totalCostUsd).toBe(0.003);
    expect(summary.traceCount).toBe(3);
  });
});
