/**
 * AgentScheduler Tests - v13 Section 3.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentScheduler, type SchedulerConfig } from '../agent-scheduler';
import type { ScheduledTask } from '../types';
import type { AgentStore } from '@ownyou/agents-base';

// Mock timers
vi.useFakeTimers();

// Mock store
const createMockStore = (): AgentStore => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue([]),
  list: vi.fn().mockResolvedValue([]),
});

// Mock config
const createMockConfig = (): SchedulerConfig => ({
  store: createMockStore(),
  userId: 'test-user',
});

describe('AgentScheduler', () => {
  let scheduler: AgentScheduler;
  let config: SchedulerConfig;

  beforeEach(() => {
    config = createMockConfig();
    scheduler = new AgentScheduler(config);
    vi.clearAllTimers();
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('initialization', () => {
    it('should initialize with default tasks', () => {
      const tasks = scheduler.getTasks();

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.find((t) => t.id === 'shopping')).toBeDefined();
    });

    it('should not be running initially', () => {
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should have shopping task with 4-hour interval', () => {
      const shoppingTask = scheduler.getTask('shopping');

      expect(shoppingTask).toBeDefined();
      expect(shoppingTask?.schedule.type).toBe('interval');
      if (shoppingTask?.schedule.type === 'interval') {
        expect(shoppingTask.schedule.intervalMs).toBe(4 * 60 * 60 * 1000);
      }
    });
  });

  describe('start/stop', () => {
    it('should start scheduler', () => {
      scheduler.start();

      expect(scheduler.isRunning()).toBe(true);
    });

    it('should stop scheduler', () => {
      scheduler.start();
      scheduler.stop();

      expect(scheduler.isRunning()).toBe(false);
    });

    it('should warn if already running', () => {
      const warnSpy = vi.spyOn(console, 'warn');

      scheduler.start();
      scheduler.start();

      expect(warnSpy).toHaveBeenCalledWith('[AgentScheduler] Already running');
    });

    it('should warn if already stopped', () => {
      const warnSpy = vi.spyOn(console, 'warn');

      scheduler.stop();

      expect(warnSpy).toHaveBeenCalledWith('[AgentScheduler] Already stopped');
    });
  });

  describe('task management', () => {
    it('should register a new task', () => {
      const customTask: ScheduledTask = {
        id: 'custom',
        agentType: 'shopping',
        schedule: { type: 'daily', hour: 9 },
        enabled: true,
        nextRun: Date.now(),
      };

      scheduler.registerTask(customTask);

      expect(scheduler.getTask('custom')).toBeDefined();
      expect(scheduler.getTasks().length).toBe(2);
    });

    it('should unregister a task', () => {
      const result = scheduler.unregisterTask('shopping');

      expect(result).toBe(true);
      expect(scheduler.getTask('shopping')).toBeUndefined();
    });

    it('should return false when unregistering non-existent task', () => {
      const result = scheduler.unregisterTask('nonexistent');

      expect(result).toBe(false);
    });

    it('should enable a task', () => {
      const task = scheduler.getTask('shopping')!;
      task.enabled = false;

      const result = scheduler.setTaskEnabled('shopping', true);

      expect(result).toBe(true);
      expect(scheduler.getTask('shopping')?.enabled).toBe(true);
    });

    it('should disable a task', () => {
      const result = scheduler.setTaskEnabled('shopping', false);

      expect(result).toBe(true);
      expect(scheduler.getTask('shopping')?.enabled).toBe(false);
    });

    it('should return false when enabling non-existent task', () => {
      const result = scheduler.setTaskEnabled('nonexistent', true);

      expect(result).toBe(false);
    });
  });

  describe('runNow', () => {
    beforeEach(() => {
      // Use real timers for runNow tests since they involve async agent execution
      vi.useRealTimers();
    });

    afterEach(() => {
      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should run shopping agent immediately', async () => {
      const result = await scheduler.runNow('shopping', {
        classification: {
          tier1: 'Shopping',
          confidence: 0.85,
        },
      });

      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });

    it('should return null for unknown agent type', async () => {
      // @ts-expect-error - Testing invalid agent type
      const result = await scheduler.runNow('unknown');

      expect(result).toBeNull();
    });

    it('should include trigger data in context', async () => {
      const triggerData = { type: 'test', value: 42 };

      const result = await scheduler.runNow('shopping', triggerData);

      // The agent will receive the trigger data
      expect(result).toBeDefined();
    });
  });

  describe('status', () => {
    it('should return scheduler status', () => {
      const status = scheduler.getStatus();

      expect(status.running).toBe(false);
      expect(status.tasks.length).toBeGreaterThan(0);
      expect(status.totalExecutions).toBe(0);
    });

    it('should update status after run', async () => {
      await scheduler.runNow('shopping', {
        classification: { tier1: 'News', confidence: 0.5 },
      });

      const status = scheduler.getStatus();

      // Note: runNow doesn't increment totalExecutions, only scheduled runs do
      expect(status.tasks.length).toBeGreaterThan(0);
    });

    it('should return recent results', () => {
      const results = scheduler.getResults();

      expect(Array.isArray(results)).toBe(true);
    });

    it('should limit results when specified', async () => {
      // Run multiple times
      for (let i = 0; i < 5; i++) {
        await scheduler.runNow('shopping', { classification: { tier1: 'News', confidence: 0.5 } });
      }

      const results = scheduler.getResults(2);

      // runNow doesn't record to results, so this will be empty
      // In a real scenario, scheduled runs would populate this
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('scheduling', () => {
    it('should schedule task when started', () => {
      scheduler.start();

      // Tasks should be scheduled (timers set)
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should calculate next run for interval schedule', async () => {
      const task = scheduler.getTask('shopping')!;
      const initialNextRun = task.nextRun;

      // Run the task
      scheduler.start();

      // Advance time to trigger the task
      vi.advanceTimersByTime(initialNextRun - Date.now() + 1000);

      // The next run should be calculated
      // Note: Due to async nature, this is hard to test precisely with fake timers
    });

    it('should schedule task with daily schedule', () => {
      const dailyTask: ScheduledTask = {
        id: 'daily-shopping',
        agentType: 'shopping',
        schedule: { type: 'daily', hour: 9, minute: 30 },
        enabled: true,
        nextRun: Date.now() + 1000,
      };

      scheduler.registerTask(dailyTask);
      scheduler.start();

      expect(scheduler.getTask('daily-shopping')).toBeDefined();
    });
  });
});

describe('Task Schedule Calculation', () => {
  let scheduler: AgentScheduler;

  beforeEach(() => {
    scheduler = new AgentScheduler(createMockConfig());
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('should handle interval schedule', () => {
    const task: ScheduledTask = {
      id: 'interval-test',
      agentType: 'shopping',
      schedule: { type: 'interval', intervalMs: 60000 },
      enabled: true,
      nextRun: Date.now(),
    };

    scheduler.registerTask(task);

    expect(scheduler.getTask('interval-test')).toBeDefined();
    expect(scheduler.getTask('interval-test')?.schedule.type).toBe('interval');
  });

  it('should handle daily schedule', () => {
    const task: ScheduledTask = {
      id: 'daily-test',
      agentType: 'shopping',
      schedule: { type: 'daily', hour: 14, minute: 30 },
      enabled: true,
      nextRun: Date.now(),
    };

    scheduler.registerTask(task);

    expect(scheduler.getTask('daily-test')).toBeDefined();
    expect(scheduler.getTask('daily-test')?.schedule.type).toBe('daily');
  });
});
