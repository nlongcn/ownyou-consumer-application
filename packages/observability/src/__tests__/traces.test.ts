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

// ========== Sprint 9: Enhanced AgentStep Types (v13 Section 10.2) ==========

import type {
  AgentStep,
  LLMStepDetail,
  ToolStepDetail,
  MemoryStepDetail,
  ExternalApiStepDetail,
  DecisionStepDetail,
} from '../traces';

describe('Enhanced AgentStep Types (v13 Section 10.2)', () => {
  let tracer: AgentTracer;
  const userId = 'user_123';

  beforeEach(() => {
    tracer = new AgentTracer();
  });

  describe('AgentStep Recording', () => {
    it('should record LLM call step with full detail', () => {
      const trace = tracer.startTrace({ userId, agentType: 'shopping' });

      tracer.recordStep(trace.id, {
        stepType: 'llm_call',
        llm: {
          model: 'gpt-4o-mini',
          promptPreview: 'You are a shopping assistant...',
          responsePreview: 'Based on your preferences...',
          tokens: { input: 150, output: 75 },
          costUsd: 0.0005,
        },
      });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.steps.length).toBe(1);

      const step = updated?.steps[0];
      expect(step?.stepType).toBe('llm_call');
      expect(step?.llm?.model).toBe('gpt-4o-mini');
      expect(step?.llm?.tokens.input).toBe(150);
      expect(step?.llm?.costUsd).toBe(0.0005);
    });

    it('should record tool call step with full detail', () => {
      const trace = tracer.startTrace({ userId, agentType: 'restaurant' });

      tracer.recordStep(trace.id, {
        stepType: 'tool_call',
        tool: {
          name: 'search_restaurants',
          args: { cuisine: 'italian', location: 'NYC' },
          resultPreview: '{"results": [{"name": "Bella Italia"...]}',
          success: true,
        },
      });

      const updated = tracer.getTrace(trace.id);
      const step = updated?.steps[0];
      expect(step?.stepType).toBe('tool_call');
      expect(step?.tool?.name).toBe('search_restaurants');
      expect(step?.tool?.success).toBe(true);
    });

    it('should record tool call step with error', () => {
      const trace = tracer.startTrace({ userId, agentType: 'events' });

      tracer.recordStep(trace.id, {
        stepType: 'tool_call',
        tool: {
          name: 'search_events',
          args: { query: 'concerts' },
          resultPreview: '',
          success: false,
          error: 'API rate limit exceeded',
        },
      });

      const updated = tracer.getTrace(trace.id);
      const step = updated?.steps[0];
      expect(step?.tool?.success).toBe(false);
      expect(step?.tool?.error).toBe('API rate limit exceeded');
    });

    it('should record memory read step', () => {
      const trace = tracer.startTrace({ userId, agentType: 'diagnostic' });

      tracer.recordStep(trace.id, {
        stepType: 'memory_read',
        memory: {
          operation: 'search',
          namespace: 'ownyou.semantic',
          query: 'user preferences for dining',
          resultCount: 5,
        },
      });

      const updated = tracer.getTrace(trace.id);
      const step = updated?.steps[0];
      expect(step?.stepType).toBe('memory_read');
      expect(step?.memory?.operation).toBe('search');
      expect(step?.memory?.resultCount).toBe(5);
    });

    it('should record memory write step', () => {
      const trace = tracer.startTrace({ userId, agentType: 'content' });

      tracer.recordStep(trace.id, {
        stepType: 'memory_write',
        memory: {
          operation: 'write',
          namespace: 'ownyou.episodic',
          key: 'ep_1234',
        },
      });

      const updated = tracer.getTrace(trace.id);
      const step = updated?.steps[0];
      expect(step?.stepType).toBe('memory_write');
      expect(step?.memory?.operation).toBe('write');
      expect(step?.memory?.key).toBe('ep_1234');
    });

    it('should record external API call step', () => {
      const trace = tracer.startTrace({ userId, agentType: 'travel' });

      tracer.recordStep(trace.id, {
        stepType: 'external_api',
        externalApi: {
          service: 'Skyscanner',
          endpoint: '/flights/search',
          statusCode: 200,
          latencyMs: 350,
          cached: false,
        },
      });

      const updated = tracer.getTrace(trace.id);
      const step = updated?.steps[0];
      expect(step?.stepType).toBe('external_api');
      expect(step?.externalApi?.service).toBe('Skyscanner');
      expect(step?.externalApi?.statusCode).toBe(200);
      expect(step?.externalApi?.cached).toBe(false);
    });

    it('should record decision step', () => {
      const trace = tracer.startTrace({ userId, agentType: 'shopping' });

      tracer.recordStep(trace.id, {
        stepType: 'decision',
        decision: {
          decisionPoint: 'select_product_recommendation',
          optionsConsidered: ['Product A', 'Product B', 'Product C'],
          selected: 'Product B',
          reasoning: 'Best price-quality ratio based on user preferences',
        },
      });

      const updated = tracer.getTrace(trace.id);
      const step = updated?.steps[0];
      expect(step?.stepType).toBe('decision');
      expect(step?.decision?.selected).toBe('Product B');
      expect(step?.decision?.optionsConsidered).toHaveLength(3);
    });

    it('should auto-increment step index', () => {
      const trace = tracer.startTrace({ userId, agentType: 'restaurant' });

      tracer.recordStep(trace.id, { stepType: 'memory_read', memory: { operation: 'read', namespace: 'ownyou.ikigai' } });
      tracer.recordStep(trace.id, { stepType: 'llm_call', llm: { model: 'gpt-4o', promptPreview: '', responsePreview: '', tokens: { input: 100, output: 50 }, costUsd: 0.001 } });
      tracer.recordStep(trace.id, { stepType: 'tool_call', tool: { name: 'reserve_table', args: {}, resultPreview: '', success: true } });

      const updated = tracer.getTrace(trace.id);
      expect(updated?.steps[0].stepIndex).toBe(0);
      expect(updated?.steps[1].stepIndex).toBe(1);
      expect(updated?.steps[2].stepIndex).toBe(2);
    });

    it('should capture step duration', () => {
      const trace = tracer.startTrace({ userId, agentType: 'events' });

      tracer.recordStep(trace.id, {
        stepType: 'llm_call',
        durationMs: 1250,
        llm: {
          model: 'gpt-4o-mini',
          promptPreview: 'Find events...',
          responsePreview: 'Here are upcoming events...',
          tokens: { input: 200, output: 100 },
          costUsd: 0.0008,
        },
      });

      const updated = tracer.getTrace(trace.id);
      const step = updated?.steps[0];
      expect(step?.durationMs).toBe(1250);
    });
  });

  describe('Step Type Validation', () => {
    it('should only accept valid step types', () => {
      const trace = tracer.startTrace({ userId, agentType: 'shopping' });

      // Valid step types: 'llm_call' | 'tool_call' | 'memory_read' | 'memory_write' | 'decision' | 'external_api'
      const validTypes = ['llm_call', 'tool_call', 'memory_read', 'memory_write', 'decision', 'external_api'];

      for (const stepType of validTypes) {
        expect(() => {
          tracer.recordStep(trace.id, {
            stepType: stepType as AgentStep['stepType'],
            // Minimal data - just validating type acceptance
          });
        }).not.toThrow();
      }
    });
  });

  describe('Resource Summary with Steps', () => {
    it('should update resource summary from steps', () => {
      const trace = tracer.startTrace({ userId, agentType: 'diagnostic' });

      // Record multiple steps
      tracer.recordStep(trace.id, {
        stepType: 'llm_call',
        llm: { model: 'gpt-4o', promptPreview: '', responsePreview: '', tokens: { input: 100, output: 50 }, costUsd: 0.002 },
      });
      tracer.recordStep(trace.id, {
        stepType: 'llm_call',
        llm: { model: 'gpt-4o', promptPreview: '', responsePreview: '', tokens: { input: 150, output: 75 }, costUsd: 0.003 },
      });
      tracer.recordStep(trace.id, {
        stepType: 'tool_call',
        tool: { name: 'analyze_profile', args: {}, resultPreview: '', success: true },
      });
      tracer.recordStep(trace.id, {
        stepType: 'memory_read',
        memory: { operation: 'read', namespace: 'ownyou.ikigai' },
      });
      tracer.recordStep(trace.id, {
        stepType: 'memory_write',
        memory: { operation: 'write', namespace: 'ownyou.diagnostic_reports' },
      });
      tracer.recordStep(trace.id, {
        stepType: 'external_api',
        externalApi: { service: 'internal', endpoint: '/analyze', statusCode: 200, latencyMs: 100, cached: false },
      });

      const updated = tracer.getTrace(trace.id);

      // Resource summary should reflect all steps
      expect(updated?.resources).toBeDefined();
      expect(updated?.resources.llmCalls).toBe(2);
      expect(updated?.resources.llmTokens.input).toBe(250);
      expect(updated?.resources.llmTokens.output).toBe(125);
      expect(updated?.resources.llmCostUsd).toBeCloseTo(0.005);
      expect(updated?.resources.toolCalls).toBe(1);
      expect(updated?.resources.memoryReads).toBe(1);
      expect(updated?.resources.memoryWrites).toBe(1);
      expect(updated?.resources.externalApiCalls).toBe(1);
    });
  });
});
