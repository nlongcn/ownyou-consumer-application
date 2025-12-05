/**
 * CronScheduler Tests - v13 Section 3.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CronScheduler } from '../scheduled/cron-scheduler';
import type { ScheduledTrigger } from '../types';

describe('CronScheduler', () => {
  let scheduler: CronScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new CronScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  describe('registration', () => {
    it('should register schedules', () => {
      scheduler.register('test', 'every 1h');
      const schedule = scheduler.getSchedule('test');

      expect(schedule).toBeDefined();
      expect(schedule?.id).toBe('test');
      expect(schedule?.expression).toBe('every 1h');
      expect(schedule?.enabled).toBe(true);
    });

    it('should unregister schedules', () => {
      scheduler.register('test', 'every 1h');
      expect(scheduler.getSchedule('test')).toBeDefined();

      scheduler.unregister('test');
      expect(scheduler.getSchedule('test')).toBeUndefined();
    });

    it('should register from constructor', () => {
      scheduler = new CronScheduler({
        daily: 'daily 9:00',
        hourly: 'every 1h',
      });

      expect(scheduler.getSchedules()).toHaveLength(2);
      expect(scheduler.getSchedule('daily')).toBeDefined();
      expect(scheduler.getSchedule('hourly')).toBeDefined();
    });
  });

  describe('schedule parsing', () => {
    it('should parse interval expressions', () => {
      scheduler.register('hourly', 'every 4h');
      const schedule = scheduler.getSchedule('hourly');

      expect(schedule?.type).toBe('interval');
      // Next run should be ~4 hours from now
      const expectedDelay = 4 * 60 * 60 * 1000;
      expect(schedule?.nextRun).toBeCloseTo(Date.now() + expectedDelay, -3);
    });

    it('should parse daily expressions', () => {
      scheduler.register('morning', 'daily 9:00');
      const schedule = scheduler.getSchedule('morning');

      expect(schedule?.type).toBe('daily');
    });

    it('should parse cron expressions', () => {
      scheduler.register('cron', '30 9 * * *');
      const schedule = scheduler.getSchedule('cron');

      expect(schedule?.type).toBe('cron');
    });
  });

  describe('enabling/disabling', () => {
    it('should disable schedules', () => {
      scheduler.register('test', 'every 1h');
      expect(scheduler.getSchedule('test')?.enabled).toBe(true);

      scheduler.setEnabled('test', false);
      expect(scheduler.getSchedule('test')?.enabled).toBe(false);
    });

    it('should re-enable schedules', () => {
      scheduler.register('test', 'every 1h');
      scheduler.setEnabled('test', false);
      scheduler.setEnabled('test', true);

      expect(scheduler.getSchedule('test')?.enabled).toBe(true);
    });
  });

  describe('triggering', () => {
    it('should trigger at scheduled time', async () => {
      const callback = vi.fn();
      scheduler.onTrigger(callback);
      scheduler.register('test', 'every 1h');
      scheduler.start();

      // Fast forward 1 hour
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);
      const trigger = callback.mock.calls[0][0] as ScheduledTrigger;
      expect(trigger.mode).toBe('scheduled');
      expect(trigger.scheduleId).toBe('test');
    });

    it('should reschedule after trigger', async () => {
      const callback = vi.fn();
      scheduler.onTrigger(callback);
      scheduler.register('test', 'every 1h');
      scheduler.start();

      // First trigger
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);

      // Second trigger
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should trigger immediately with triggerNow', async () => {
      const callback = vi.fn();
      scheduler.onTrigger(callback);
      scheduler.register('test', 'every 1h');

      const trigger = await scheduler.triggerNow('test');

      expect(trigger).toBeDefined();
      expect(trigger?.scheduleId).toBe('test');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger disabled schedules', async () => {
      const callback = vi.fn();
      scheduler.onTrigger(callback);
      scheduler.register('test', 'every 1h');
      scheduler.setEnabled('test', false);
      scheduler.start();

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('should start and stop', () => {
      expect(scheduler.isRunning()).toBe(false);
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should not trigger after stop', async () => {
      const callback = vi.fn();
      scheduler.onTrigger(callback);
      scheduler.register('test', 'every 1h');
      scheduler.start();
      scheduler.stop();

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('should support multiple callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      scheduler.onTrigger(callback1);
      scheduler.onTrigger(callback2);
      scheduler.register('test', 'every 1h');
      scheduler.start();

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = vi.fn().mockRejectedValue(new Error('Error'));
      const goodCallback = vi.fn();

      scheduler.onTrigger(errorCallback);
      scheduler.onTrigger(goodCallback);
      scheduler.register('test', 'every 1h');
      scheduler.start();

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });

    it('should unregister callbacks', async () => {
      const callback = vi.fn();
      scheduler.onTrigger(callback);
      scheduler.offTrigger(callback);
      scheduler.register('test', 'every 1h');
      scheduler.start();

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('invalid expression warnings', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should warn on invalid cron expression', () => {
      scheduler.register('invalid-cron', '* *');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[CronScheduler] Invalid cron expression: "* *", defaulting to next minute'
      );
    });

    it('should warn on invalid interval expression', () => {
      scheduler.register('invalid-interval', 'every hour');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[CronScheduler] Invalid interval expression: "every hour", defaulting to 1 hour'
      );
    });

    it('should warn on invalid daily expression', () => {
      scheduler.register('invalid-daily', 'daily morning');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[CronScheduler] Invalid daily expression: "daily morning", defaulting to 9:00 AM'
      );
    });

    it('should not warn on valid expressions', () => {
      scheduler.register('valid-cron', '0 9 * * *');
      scheduler.register('valid-interval', 'every 4h');
      scheduler.register('valid-daily', 'daily 9:00');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
