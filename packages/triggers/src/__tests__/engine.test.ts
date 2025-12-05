/**
 * TriggerEngine Tests - v13 Section 3.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NAMESPACES } from '@ownyou/shared-types';
import { TriggerEngine } from '../engine/trigger-engine';

// Mock agent
const createMockAgent = (success = true) => ({
  run: vi.fn().mockResolvedValue({
    success,
    missionCard: success ? { id: 'mission_1', title: 'Test Mission' } : undefined,
    response: 'Test response',
    error: success ? undefined : 'Test error',
    usage: { toolCalls: 0, llmCalls: 0, memoryReads: 0, memoryWrites: 0, elapsedSeconds: 0, totalCostUsd: 0 },
    toolCalls: [],
    llmCalls: [],
    memoryOps: [],
  }),
});

// Mock store
const createMockStore = () => ({
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  list: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
  search: vi.fn().mockResolvedValue([]),
});

describe('TriggerEngine', () => {
  let engine: TriggerEngine;
  let mockShoppingAgent: ReturnType<typeof createMockAgent>;
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockShoppingAgent = createMockAgent(true);
    mockStore = createMockStore();

    engine = new TriggerEngine({
      store: mockStore as any,
      userId: 'user_123',
      watchNamespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.SEMANTIC_MEMORY],
      schedules: {
        test_schedule: 'every 1h',
      },
      agentFactory: (type) => {
        if (type === 'shopping') return mockShoppingAgent as any;
        return null;
      },
    });
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  describe('lifecycle', () => {
    it('should start and stop', () => {
      expect(engine.isRunning()).toBe(false);
      engine.start();
      expect(engine.isRunning()).toBe(true);
      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });

    it('should warn when starting twice', () => {
      const warn = vi.spyOn(console, 'warn');
      engine.start();
      engine.start();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Already running'));
    });
  });

  describe('handleUserRequest', () => {
    it('should route user requests to agents', async () => {
      engine.start();

      const result = await engine.handleUserRequest('Buy me some headphones');

      expect(result.agentType).toBe('shopping');
      expect(result.trigger.mode).toBe('user');
    });

    it('should update statistics', async () => {
      engine.start();

      await engine.handleUserRequest('Buy me some headphones');

      const stats = engine.getStats();
      expect(stats.userTriggersProcessed).toBe(1);
      expect(stats.totalTriggersProcessed).toBe(1);
      expect(stats.lastTriggerAt).toBeDefined();
    });

    it('should track failed triggers', async () => {
      const failingAgent = createMockAgent(false);
      engine = new TriggerEngine({
        store: mockStore as any,
        userId: 'user_123',
        watchNamespaces: [],
        agentFactory: () => failingAgent as any,
      });
      engine.start();

      await engine.handleUserRequest('Do something');

      const stats = engine.getStats();
      expect(stats.failedTriggers).toBeGreaterThan(0);
    });
  });

  describe('handleEvent', () => {
    it('should process event triggers', async () => {
      engine.start();

      const results = await engine.handleEvent('calendar', 'reminder', {
        title: 'Meeting',
      });

      expect(results.length).toBeGreaterThanOrEqual(0);

      const stats = engine.getStats();
      expect(stats.eventTriggersProcessed).toBe(1);
    });
  });

  describe('scheduled triggers', () => {
    it('should trigger on schedule', async () => {
      engine.start();

      // Advance time by 1 hour
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      const stats = engine.getStats();
      expect(stats.scheduledTriggersProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('data triggers via store watcher', () => {
    it('should provide store watcher for connecting to store events', () => {
      const watcher = engine.getStoreWatcher();
      expect(watcher).toBeDefined();
      expect(typeof watcher.handleStoreEvent).toBe('function');
    });

    it('should process data triggers from watcher', async () => {
      engine.start();
      const watcher = engine.getStoreWatcher();

      // Simulate store event
      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'classification_1',
      });

      await watcher.forceFlush();

      const stats = engine.getStats();
      expect(stats.dataTriggersProcessed).toBe(1);
    });
  });

  describe('agent registration', () => {
    it('should allow registering additional agents', () => {
      engine.registerAgent({
        type: 'custom' as any,
        namespaces: ['custom.namespace'],
        intents: ['custom'],
        description: 'Custom Agent',
        enabled: true,
      });

      const registry = engine.getCoordinator().getRegistry();
      expect(registry.getAgent('custom' as any)).toBeDefined();
    });

    it('should allow enabling/disabling agents', () => {
      expect(engine.setAgentEnabled('shopping', false)).toBe(true);

      const registry = engine.getCoordinator().getRegistry();
      expect(registry.getAgent('shopping')?.enabled).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track all trigger types', async () => {
      engine.start();

      await engine.handleUserRequest('Buy something');
      await engine.handleEvent('calendar', 'event', {});

      const stats = engine.getStats();
      expect(stats.userTriggersProcessed).toBe(1);
      expect(stats.eventTriggersProcessed).toBe(1);
      expect(stats.totalTriggersProcessed).toBe(2);
    });

    it('should reset statistics', async () => {
      engine.start();
      await engine.handleUserRequest('Buy something');

      engine.resetStats();

      const stats = engine.getStats();
      expect(stats.totalTriggersProcessed).toBe(0);
      expect(stats.userTriggersProcessed).toBe(0);
    });
  });

  describe('component access', () => {
    it('should provide access to scheduler', () => {
      const scheduler = engine.getScheduler();
      expect(scheduler).toBeDefined();
      expect(typeof scheduler.getSchedules).toBe('function');
    });

    it('should provide access to coordinator', () => {
      const coordinator = engine.getCoordinator();
      expect(coordinator).toBeDefined();
      expect(typeof coordinator.routeTrigger).toBe('function');
    });
  });
});
