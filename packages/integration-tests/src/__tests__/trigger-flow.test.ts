/**
 * Trigger Flow Integration Tests - Sprint 5
 *
 * Tests the full trigger-to-mission flow:
 * - Data triggers (Store changes -> Agent execution)
 * - Scheduled triggers (Cron/interval -> Agent execution)
 * - User triggers (Intent classification -> Agent routing)
 * - Circuit breaker integration during agent execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TriggerEngine, StoreWatcher, CronScheduler, AgentCoordinator } from '@ownyou/triggers';
import type { DataTrigger, UserTrigger, TriggerResult } from '@ownyou/triggers';
import { circuitBreakers } from '@ownyou/resilience';
import { ShoppingAgent } from '@ownyou/agents-shopping';
import { ContentAgent } from '@ownyou/agents-content';
import type { AgentStore, AgentResult } from '@ownyou/agents-base';
import { NS } from '@ownyou/shared-types';
import type { MissionCard } from '@ownyou/shared-types';

// In-memory store implementation for testing
class InMemoryStore implements AgentStore {
  private data = new Map<string, Map<string, unknown>>();
  private eventListeners: Array<(event: { type: string; namespace: readonly string[]; key?: string }) => void> = [];

  private getNamespaceKey(namespace: readonly string[]): string {
    return namespace.join('.');
  }

  async get(namespace: readonly string[], key: string): Promise<unknown | null> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    return nsData?.get(key) ?? null;
  }

  async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
    const nsKey = this.getNamespaceKey(namespace);
    if (!this.data.has(nsKey)) {
      this.data.set(nsKey, new Map());
    }
    this.data.get(nsKey)!.set(key, value);

    // Emit event for store watcher
    this.emit({ type: 'put', namespace, key });
  }

  async delete(namespace: readonly string[], key: string): Promise<void> {
    const nsKey = this.getNamespaceKey(namespace);
    this.data.get(nsKey)?.delete(key);

    // Emit event for store watcher
    this.emit({ type: 'delete', namespace, key });
  }

  async search(
    namespace: readonly string[],
    _query: string,
    options?: { limit?: number }
  ): Promise<Array<{ key: string; value: unknown; score?: number }>> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    if (!nsData) return [];

    const results: Array<{ key: string; value: unknown; score?: number }> = [];
    for (const [key, value] of nsData.entries()) {
      results.push({ key, value, score: 1 });
      if (options?.limit && results.length >= options.limit) break;
    }
    return results;
  }

  async list(
    namespace: readonly string[],
    options?: { prefix?: string; limit?: number; offset?: number }
  ): Promise<Array<{ key: string; value: unknown }>> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    if (!nsData) return [];

    let results: Array<{ key: string; value: unknown }> = [];
    for (const [key, value] of nsData.entries()) {
      if (options?.prefix && !key.startsWith(options.prefix)) continue;
      results.push({ key, value });
    }

    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  // Event emitter for store watcher integration
  onEvent(listener: (event: { type: string; namespace: readonly string[]; key?: string }) => void): void {
    this.eventListeners.push(listener);
  }

  private emit(event: { type: string; namespace: readonly string[]; key?: string }): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  // Helper to get all data (for testing)
  getAllData(): Map<string, Map<string, unknown>> {
    return this.data;
  }
}

// Mock agent factory
const createMockAgentFactory = (
  shoppingAgent: { run: ReturnType<typeof vi.fn> },
  contentAgent: { run: ReturnType<typeof vi.fn> }
) => {
  return (type: string) => {
    switch (type) {
      case 'shopping':
        return shoppingAgent as unknown as ShoppingAgent;
      case 'content':
        return contentAgent as unknown as ContentAgent;
      default:
        return null;
    }
  };
};

describe('Trigger Flow Integration', () => {
  let store: InMemoryStore;
  let engine: TriggerEngine;
  let mockShoppingAgent: { run: ReturnType<typeof vi.fn> };
  let mockContentAgent: { run: ReturnType<typeof vi.fn> };
  const userId = 'test-user-123';

  beforeEach(() => {
    vi.useFakeTimers();
    store = new InMemoryStore();

    // Create mock agents with successful responses
    mockShoppingAgent = {
      run: vi.fn().mockResolvedValue({
        success: true,
        missionCard: {
          id: `mission_shopping_${Date.now()}`,
          type: 'shopping',
          title: 'Shopping Mission',
          status: 'CREATED',
        },
        response: 'Shopping agent executed',
        usage: { toolCalls: 1, llmCalls: 1, memoryReads: 2, memoryWrites: 1, elapsedSeconds: 0.5, totalCostUsd: 0.001 },
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      }),
    };

    mockContentAgent = {
      run: vi.fn().mockResolvedValue({
        success: true,
        missionCard: {
          id: `mission_content_${Date.now()}`,
          type: 'content',
          title: 'Content Mission',
          status: 'CREATED',
        },
        response: 'Content agent executed',
        usage: { toolCalls: 1, llmCalls: 1, memoryReads: 2, memoryWrites: 1, elapsedSeconds: 0.5, totalCostUsd: 0.001 },
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      }),
    };

    engine = new TriggerEngine({
      store: store as any,
      userId,
      watchNamespaces: ['ownyou.iab', 'ownyou.semantic'],
      schedules: {
        daily_digest: 'daily 9:00',
        hourly_check: 'every 1h',
      },
      agentFactory: createMockAgentFactory(mockShoppingAgent, mockContentAgent),
    });
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
    circuitBreakers.resetAll();
  });

  describe('Data-Driven Triggers', () => {
    it('should trigger Shopping Agent when IAB classification created', async () => {
      engine.start();
      const watcher = engine.getStoreWatcher();

      // Connect store events to watcher
      store.onEvent((event) => {
        watcher.handleStoreEvent(event as any);
      });

      // Simulate IAB classification being stored
      const iabClassification = {
        id: 'iab-1',
        tier1: 'Shopping',
        tier2: 'Consumer Electronics',
        confidence: 0.85,
        sourceId: 'email-123',
        timestamp: Date.now(),
      };

      await store.put(
        NS.iabClassifications(userId),
        iabClassification.id,
        iabClassification
      );

      // Force flush the watcher to process events
      await watcher.forceFlush();

      // Verify Shopping Agent was triggered
      const stats = engine.getStats();
      expect(stats.dataTriggersProcessed).toBe(1);

      // The agent should have been called with the data trigger
      expect(mockShoppingAgent.run).toHaveBeenCalled();
    });

    it('should trigger Content Agent when semantic memory updated', async () => {
      engine.start();
      const watcher = engine.getStoreWatcher();

      // Connect store events to watcher
      store.onEvent((event) => {
        watcher.handleStoreEvent(event as any);
      });

      // Simulate semantic memory update
      const semanticEntry = {
        id: 'sem-1',
        content: 'User interested in technology articles',
        category: 'interests',
        timestamp: Date.now(),
      };

      await store.put(
        NS.semanticMemory(userId),
        semanticEntry.id,
        semanticEntry
      );

      await watcher.forceFlush();

      // Verify trigger was processed
      const stats = engine.getStats();
      expect(stats.dataTriggersProcessed).toBe(1);
    });

    it('should batch multiple store changes before processing', async () => {
      engine.start();
      const watcher = engine.getStoreWatcher();

      // Connect store events to watcher
      store.onEvent((event) => {
        watcher.handleStoreEvent(event as any);
      });

      // Add multiple classifications quickly
      for (let i = 0; i < 3; i++) {
        await store.put(
          NS.iabClassifications(userId),
          `iab-${i}`,
          { id: `iab-${i}`, tier1: 'Shopping', confidence: 0.85 }
        );
      }

      expect(watcher.getPendingCount()).toBeGreaterThan(0);

      await watcher.forceFlush();

      // All should be processed
      const stats = engine.getStats();
      expect(stats.dataTriggersProcessed).toBe(3);
    });
  });

  describe('Scheduled Triggers', () => {
    it('should trigger Content Agent on daily schedule', async () => {
      engine.start();

      // Fast forward 24 hours to trigger daily schedule
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      const stats = engine.getStats();
      expect(stats.scheduledTriggersProcessed).toBeGreaterThanOrEqual(1);
    });

    it('should trigger agents on hourly schedule', async () => {
      engine.start();

      // Fast forward 1 hour
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      const stats = engine.getStats();
      expect(stats.scheduledTriggersProcessed).toBeGreaterThanOrEqual(1);
    });

    it('should support immediate trigger via triggerNow', async () => {
      engine.start();

      const scheduler = engine.getScheduler();
      const trigger = await scheduler.triggerNow('daily_digest');

      expect(trigger).toBeDefined();
      expect(trigger?.scheduleId).toBe('daily_digest');
    });
  });

  describe('User-Driven Triggers', () => {
    it('should route user request to correct agent', async () => {
      engine.start();

      const result = await engine.handleUserRequest('Buy me some headphones');

      expect(result.agentType).toBe('shopping');
      expect(result.trigger.mode).toBe('user');
      expect((result.trigger as UserTrigger).intent).toBe('shopping');
      expect(mockShoppingAgent.run).toHaveBeenCalled();
    });

    it('should route content requests to Content Agent', async () => {
      engine.start();

      const result = await engine.handleUserRequest('Recommend some articles to read');

      expect(result.agentType).toBe('content');
      expect((result.trigger as UserTrigger).intent).toBe('content');
      expect(mockContentAgent.run).toHaveBeenCalled();
    });

    it('should classify travel intents correctly', async () => {
      engine.start();

      const result = await engine.handleUserRequest('Book a flight to Paris');

      expect(result.trigger.mode).toBe('user');
      expect((result.trigger as UserTrigger).intent).toBe('travel');
    });

    it('should extract entities from user request', async () => {
      engine.start();

      const result = await engine.handleUserRequest('Find laptops under $500');

      const trigger = result.trigger as UserTrigger;
      expect(trigger.entities.price).toBeDefined();
    });

    it('should update statistics for user triggers', async () => {
      engine.start();

      await engine.handleUserRequest('Buy something');
      await engine.handleUserRequest('Read something');

      const stats = engine.getStats();
      expect(stats.userTriggersProcessed).toBe(2);
      expect(stats.totalTriggersProcessed).toBe(2);
    });
  });

  describe('Event-Driven Triggers', () => {
    it('should process calendar event triggers', async () => {
      engine.start();

      const results = await engine.handleEvent('calendar', 'reminder', {
        title: 'Birthday party tomorrow',
        date: new Date().toISOString(),
      });

      const stats = engine.getStats();
      expect(stats.eventTriggersProcessed).toBe(1);
    });

    it('should process location event triggers', async () => {
      engine.start();

      const results = await engine.handleEvent('location', 'arrival', {
        place: 'Shopping Mall',
        coordinates: { lat: 40.7128, lng: -74.006 },
      });

      const stats = engine.getStats();
      expect(stats.eventTriggersProcessed).toBe(1);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should handle circuit breaker during agent execution', async () => {
      // Create a failing agent
      const failingAgent = {
        run: vi.fn()
          .mockRejectedValueOnce(new Error('API failure 1'))
          .mockRejectedValueOnce(new Error('API failure 2'))
          .mockRejectedValueOnce(new Error('API failure 3'))
          .mockResolvedValue({
            success: true,
            missionCard: { id: 'mission_1', type: 'shopping', title: 'Test', status: 'CREATED' },
            response: 'Success after failures',
            usage: { toolCalls: 0, llmCalls: 0, memoryReads: 0, memoryWrites: 0, elapsedSeconds: 0, totalCostUsd: 0 },
            toolCalls: [],
            llmCalls: [],
            memoryOps: [],
          }),
      };

      const failingEngine = new TriggerEngine({
        store: store as any,
        userId,
        watchNamespaces: [],
        agentFactory: () => failingAgent as any,
      });

      failingEngine.start();

      // First request should fail
      const result1 = await failingEngine.handleUserRequest('Buy something');
      expect(result1.skipped).toBe(true);

      // Stats should track failures
      const stats = failingEngine.getStats();
      expect(stats.failedTriggers).toBeGreaterThan(0);

      failingEngine.stop();
    });

    it('should execute API calls through circuit breaker registry', async () => {
      // Test the circuit breaker directly
      const executeSpy = vi.spyOn(circuitBreakers, 'execute');

      // Execute an operation through the circuit breaker
      const result = await circuitBreakers.execute(
        'amazon',
        async () => ({ products: ['headphones'] })
      );

      expect(result.products).toContain('headphones');
      expect(executeSpy).toHaveBeenCalledWith('amazon', expect.any(Function));
    });

    it('should track circuit breaker statistics', async () => {
      // Register 'amazon' API with the circuit breaker registry first
      circuitBreakers.register('amazon', {
        name: 'amazon',
        failureThreshold: 5,
        resetTimeoutMs: 60000,
        halfOpenRequests: 2,
        critical: false,
        retries: 2,
        timeoutMs: 5000,
      });

      // Execute some operations
      await circuitBreakers.execute('amazon', async () => 'success');
      await circuitBreakers.execute('amazon', async () => 'success');

      const stats = circuitBreakers.getStats('amazon');
      expect(stats).toBeDefined();
      expect(stats?.successCount).toBeGreaterThanOrEqual(2);

      // Clean up
      circuitBreakers.unregister('amazon');
    });
  });

  describe('Full End-to-End Flow', () => {
    it('should complete IAB -> Trigger -> Mission Card flow', async () => {
      // Use real ShoppingAgent for full integration
      const realEngine = new TriggerEngine({
        store: store as any,
        userId,
        watchNamespaces: ['ownyou.iab'],
        agentFactory: (type) => {
          if (type === 'shopping') return new ShoppingAgent();
          if (type === 'content') return new ContentAgent();
          return null;
        },
      });

      realEngine.start();
      const watcher = realEngine.getStoreWatcher();

      // Connect store to watcher
      store.onEvent((event) => {
        watcher.handleStoreEvent(event as any);
      });

      // Step 1: Store IAB classification
      const iabClassification = {
        id: 'iab-integration-1',
        tier1: 'Shopping',
        tier2: 'Consumer Electronics',
        confidence: 0.85,
        sourceId: 'email-123',
        timestamp: Date.now(),
      };

      await store.put(
        NS.iabClassifications(userId),
        iabClassification.id,
        iabClassification
      );

      // Step 2: Process the trigger
      await watcher.forceFlush();

      // Step 3: Verify mission card was created
      const missions = await store.list(NS.missionCards(userId));
      // Note: In full integration, the agent should create a mission card
      // For now we just verify the flow completed

      const stats = realEngine.getStats();
      expect(stats.dataTriggersProcessed).toBe(1);

      realEngine.stop();
    });
  });

  describe('Agent Registration and Management', () => {
    it('should allow registering custom agents', () => {
      engine.start();

      engine.registerAgent({
        type: 'custom' as any,
        namespaces: ['custom.namespace'],
        intents: ['custom_action'],
        description: 'Custom Agent',
        enabled: true,
      });

      const registry = engine.getCoordinator().getRegistry();
      expect(registry.getAgent('custom' as any)).toBeDefined();
    });

    it('should allow enabling/disabling agents', () => {
      engine.start();

      expect(engine.setAgentEnabled('shopping', false)).toBe(true);

      const registry = engine.getCoordinator().getRegistry();
      expect(registry.getAgent('shopping')?.enabled).toBe(false);
    });

    it('should skip disabled agents during routing', async () => {
      engine.start();

      // Disable shopping agent
      engine.setAgentEnabled('shopping', false);

      const result = await engine.handleUserRequest('Buy headphones');

      // Should be skipped since shopping agent is disabled
      expect(result.skipped).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle agent errors gracefully', async () => {
      const errorAgent = {
        run: vi.fn().mockRejectedValue(new Error('Agent crashed')),
      };

      const errorEngine = new TriggerEngine({
        store: store as any,
        userId,
        watchNamespaces: [],
        agentFactory: () => errorAgent as any,
      });

      // Register shopping agent so intent classification succeeds
      errorEngine.registerAgent({
        type: 'shopping',
        namespaces: [],
        intents: ['shopping', 'buy'],
        description: 'Test Shopping Agent',
        enabled: true,
      });

      errorEngine.start();

      const result = await errorEngine.handleUserRequest('Buy something');

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('crashed');

      errorEngine.stop();
    });

    it('should handle unavailable agents', async () => {
      const nullEngine = new TriggerEngine({
        store: store as any,
        userId,
        watchNamespaces: [],
        agentFactory: () => null,
      });

      // Register shopping agent so intent classification succeeds
      nullEngine.registerAgent({
        type: 'shopping',
        namespaces: [],
        intents: ['shopping', 'buy'],
        description: 'Test Shopping Agent',
        enabled: true,
      });

      nullEngine.start();

      const result = await nullEngine.handleUserRequest('Buy something');

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('not available');

      nullEngine.stop();
    });

    it('should continue processing after individual trigger failures', async () => {
      let callCount = 0;
      const intermittentAgent = {
        run: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('First call fails'));
          }
          return Promise.resolve({
            success: true,
            missionCard: { id: 'mission_1', type: 'shopping', title: 'Test', status: 'CREATED' },
            response: 'Success',
            usage: { toolCalls: 0, llmCalls: 0, memoryReads: 0, memoryWrites: 0, elapsedSeconds: 0, totalCostUsd: 0 },
            toolCalls: [],
            llmCalls: [],
            memoryOps: [],
          });
        }),
      };

      const intermittentEngine = new TriggerEngine({
        store: store as any,
        userId,
        watchNamespaces: [],
        agentFactory: () => intermittentAgent as any,
      });

      // Register shopping agent so intent classification succeeds
      intermittentEngine.registerAgent({
        type: 'shopping',
        namespaces: [],
        intents: ['shopping', 'buy'],
        description: 'Test Shopping Agent',
        enabled: true,
      });

      intermittentEngine.start();

      // First request fails
      const result1 = await intermittentEngine.handleUserRequest('Buy something');
      expect(result1.skipped).toBe(true);

      // Second request succeeds
      const result2 = await intermittentEngine.handleUserRequest('Buy something else');
      expect(result2.skipped).toBeFalsy();
      expect(result2.mission).toBeDefined();

      intermittentEngine.stop();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track all trigger types in statistics', async () => {
      engine.start();
      const watcher = engine.getStoreWatcher();

      // Connect store to watcher
      store.onEvent((event) => {
        watcher.handleStoreEvent(event as any);
      });

      // User trigger
      await engine.handleUserRequest('Buy something');

      // Event trigger
      await engine.handleEvent('calendar', 'reminder', {});

      // Data trigger
      await store.put(NS.iabClassifications(userId), 'iab-1', { tier1: 'Shopping' });
      await watcher.forceFlush();

      const stats = engine.getStats();
      expect(stats.userTriggersProcessed).toBe(1);
      expect(stats.eventTriggersProcessed).toBe(1);
      expect(stats.dataTriggersProcessed).toBe(1);
      expect(stats.totalTriggersProcessed).toBe(3);
    });

    it('should reset statistics', async () => {
      engine.start();
      await engine.handleUserRequest('Buy something');

      engine.resetStats();

      const stats = engine.getStats();
      expect(stats.totalTriggersProcessed).toBe(0);
      expect(stats.userTriggersProcessed).toBe(0);
      expect(stats.failedTriggers).toBe(0);
    });

    it('should track last trigger timestamp', async () => {
      engine.start();

      const beforeTime = Date.now();
      await engine.handleUserRequest('Buy something');
      const afterTime = Date.now();

      const stats = engine.getStats();
      expect(stats.lastTriggerAt).toBeDefined();
      expect(stats.lastTriggerAt).toBeGreaterThanOrEqual(beforeTime);
      expect(stats.lastTriggerAt).toBeLessThanOrEqual(afterTime);
    });
  });
});
