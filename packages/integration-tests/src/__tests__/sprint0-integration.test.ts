/**
 * Sprint 0 Integration Tests
 *
 * Tests that all Sprint 0 packages work together correctly:
 * - shared-types: Type definitions
 * - memory-store: Storage with hybrid search
 * - llm-client: LLM calls with budget tracking
 * - observability: Agent tracing
 *
 * Success Criteria (from sprint spec):
 * "Store a memory, call an LLM with cost tracking, log an agent trace"
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Package imports
import type { Memory, AgentType } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import { MemoryStore, InMemoryBackend, MockEmbeddingService } from '@ownyou/memory-store';
import { LLMClient, MockLLMProvider } from '@ownyou/llm-client';
import { AgentTracer, TraceLevel } from '@ownyou/observability';

describe('Sprint 0 Integration: Store + LLM + Trace', () => {
  let store: MemoryStore;
  let llmClient: LLMClient;
  let tracer: AgentTracer;
  const userId = 'user_integration_test';

  beforeEach(() => {
    // Initialize all packages
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      embeddingService: new MockEmbeddingService(),
    });

    llmClient = new LLMClient({
      provider: new MockLLMProvider(),
      budgetConfig: { monthlyBudgetUsd: 10 },
    });

    tracer = new AgentTracer();
  });

  it('should complete the full Sprint 0 success criteria', async () => {
    // Start an agent trace
    const trace = tracer.startTrace({
      userId,
      agentType: 'shopping' as AgentType,
      missionId: 'mission_integration_1',
    });

    tracer.logEvent(trace.id, {
      level: TraceLevel.INFO,
      message: 'Starting integration test mission',
    });

    // --- Step 1: Store a memory ---
    const memorySpanId = tracer.startSpan(trace.id, { name: 'store_memory' });

    const memory: Memory = {
      id: 'mem_integration_1',
      content: 'User prefers eco-friendly products with sustainable packaging',
      context: 'shopping',
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 1.0,
      lastAccessed: Date.now(),
      accessCount: 0,
      sources: ['integration_test'],
      confidence: 0.95,
      privacyTier: 'public',
    };

    await store.put(NS.semanticMemory(userId), memory.id, memory);
    tracer.recordMemoryOp(trace.id, {
      operation: 'put',
      namespace: 'ownyou.semantic',
      count: 1,
      duration: 5,
    });

    tracer.endSpan(trace.id, memorySpanId);

    // Verify memory was stored
    const retrieved = await store.get<Memory>(NS.semanticMemory(userId), memory.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe(memory.content);
    expect(retrieved!.embedding).toBeDefined(); // Auto-generated

    // --- Step 2: Call LLM with cost tracking ---
    const llmSpanId = tracer.startSpan(trace.id, { name: 'llm_call' });

    const response = await llmClient.complete(userId, {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful shopping assistant.',
        },
        {
          role: 'user',
          content: 'Recommend eco-friendly products.',
        },
      ],
      operation: 'mission_agent',
    });

    tracer.recordCost(trace.id, {
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: response.usage.costUsd,
    });

    tracer.endSpan(trace.id, llmSpanId);

    // Verify LLM response
    expect(response.content).toBeDefined();
    expect(response.usage.costUsd).toBeGreaterThan(0);

    // Verify budget tracking
    const usage = await llmClient.getUsage(userId);
    expect(usage.totalCostUsd).toBeGreaterThan(0);

    // --- Step 3: Complete the trace ---
    tracer.logEvent(trace.id, {
      level: TraceLevel.INFO,
      message: 'Integration test mission completed',
      metadata: {
        memoryId: memory.id,
        llmCost: response.usage.costUsd,
      },
    });

    tracer.endTrace(trace.id, { status: 'success' });

    // Verify trace
    const completedTrace = tracer.getTrace(trace.id);
    expect(completedTrace).toBeDefined();
    expect(completedTrace!.status).toBe('success');
    expect(completedTrace!.llmCalls).toBe(1);
    expect(completedTrace!.totalCostUsd).toBeGreaterThan(0);
    expect(completedTrace!.memoryOps.put).toBe(1);
    expect(completedTrace!.spans.length).toBe(2);
    expect(completedTrace!.events.length).toBe(2);
  });

  it('should search memories with hybrid search', async () => {
    // Store multiple memories
    const memories: Memory[] = [
      {
        id: 'mem_search_1',
        content: 'User loves hiking and outdoor adventures in mountains',
        context: 'interests',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.9,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      },
      {
        id: 'mem_search_2',
        content: 'User prefers vegetarian restaurants with outdoor seating',
        context: 'dining',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.8,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 0.85,
        privacyTier: 'public',
      },
      {
        id: 'mem_search_3',
        content: 'User has a cat named Whiskers',
        context: 'personal',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.7,
        lastAccessed: Date.now(),
        accessCount: 0,
        sources: [],
        confidence: 0.95,
        privacyTier: 'sensitive',
      },
    ];

    for (const mem of memories) {
      await store.put(NS.semanticMemory(userId), mem.id, mem);
    }

    // Search with BM25
    const bm25Results = await store.search<Memory>({
      namespace: NS.semanticMemory(userId),
      query: 'outdoor activities',
      modes: ['bm25'],
      limit: 10,
    });

    expect(bm25Results.length).toBeGreaterThan(0);
    // Should find outdoor-related memories
    expect(
      bm25Results.some((r) => r.item.content.includes('outdoor'))
    ).toBe(true);

    // Search with hybrid (semantic + BM25)
    const hybridResults = await store.search<Memory>({
      namespace: NS.semanticMemory(userId),
      query: 'nature activities',
      modes: ['semantic', 'bm25'],
      limit: 10,
    });

    expect(hybridResults.length).toBeGreaterThan(0);
    expect(hybridResults[0].scores.rrf).toBeDefined();
  });

  it('should enforce budget limits', async () => {
    // Set usage close to limit
    await llmClient.setUsageForTesting(userId, 9.8); // 98%

    // Non-urgent should be deferred
    await expect(
      llmClient.complete(userId, {
        messages: [{ role: 'user', content: 'Hello' }],
        operation: 'test',
        urgent: false,
      })
    ).rejects.toThrow('Request deferred');

    // Urgent should still work
    const response = await llmClient.complete(userId, {
      messages: [{ role: 'user', content: 'Hello' }],
      operation: 'test',
      urgent: true,
    });

    expect(response.content).toBeDefined();
  });

  it('should use correct namespaces', async () => {
    // Test namespace factories
    const semanticNs = NS.semanticMemory(userId);
    const episodicNs = NS.episodicMemory(userId);
    const iabNs = NS.iabClassifications(userId);

    expect(semanticNs).toEqual(['ownyou.semantic', userId]);
    expect(episodicNs).toEqual(['ownyou.episodic', userId]);
    expect(iabNs).toEqual(['ownyou.iab', userId]);

    // Data should be isolated between namespaces
    const memory: Memory = {
      id: 'mem_namespace_test',
      content: 'Test namespace isolation',
      context: 'test',
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 1.0,
      lastAccessed: Date.now(),
      accessCount: 0,
      sources: [],
      confidence: 1.0,
      privacyTier: 'public',
    };

    await store.put(semanticNs, memory.id, memory);

    const fromSemantic = await store.get(semanticNs, memory.id);
    const fromEpisodic = await store.get(episodicNs, memory.id);

    expect(fromSemantic).not.toBeNull();
    expect(fromEpisodic).toBeNull(); // Should not exist in different namespace
  });

  it('should track costs across agent traces', async () => {
    const trace = tracer.startTrace({
      userId,
      agentType: 'diagnostic' as AgentType,
    });

    // Simulate multiple LLM calls
    for (let i = 0; i < 3; i++) {
      const response = await llmClient.complete(userId, {
        messages: [{ role: 'user', content: `Query ${i}` }],
        operation: 'test',
      });

      tracer.recordCost(trace.id, {
        model: response.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: response.usage.costUsd,
      });
    }

    tracer.endTrace(trace.id, { status: 'success' });

    const completedTrace = tracer.getTrace(trace.id);
    expect(completedTrace!.llmCalls).toBe(3);
    expect(completedTrace!.totalCostUsd).toBeGreaterThan(0);

    // Check cost summary
    const summary = tracer.getCostSummary(userId);
    expect(summary.traceCount).toBe(1);
    expect(summary.totalCostUsd).toBeGreaterThan(0);
  });
});

describe('Cross-Package Type Compatibility', () => {
  it('should use shared types across packages', () => {
    // Verify Memory type is consistent
    const memory: Memory = {
      id: 'mem_type_test',
      content: 'Type compatibility test',
      context: 'test',
      validAt: Date.now(),
      createdAt: Date.now(),
      strength: 1.0,
      lastAccessed: Date.now(),
      accessCount: 0,
      sources: [],
      confidence: 1.0,
      privacyTier: 'public',
    };

    // Memory should work with MemoryStore
    expect(memory.id).toBeDefined();
    expect(memory.privacyTier).toBe('public');

    // AgentType should work with tracer
    const tracer = new AgentTracer();
    const trace = tracer.startTrace({
      userId: 'user_type_test',
      agentType: 'shopping' as AgentType,
    });

    expect(trace.agentType).toBe('shopping');
  });

  it('should use namespace factories consistently', () => {
    const userId = 'user_ns_test';

    // All namespace factories should produce valid tuples
    const namespaces = [
      NS.semanticMemory(userId),
      NS.episodicMemory(userId),
      NS.proceduralMemory(userId, 'shopping'),
      NS.entities(userId),
      NS.relationships(userId),
      NS.iabClassifications(userId),
      NS.ikigaiProfile(userId),
      NS.missionCards(userId),
      NS.pseudonyms(userId),
      NS.earnings(userId),
      NS.agentTraces(userId),
      NS.llmUsage(userId, 'monthly'),
    ];

    for (const ns of namespaces) {
      expect(Array.isArray(ns)).toBe(true);
      expect(ns.length).toBeGreaterThanOrEqual(2);
      expect(ns[1]).toBe(userId);
    }
  });
});
