/**
 * CronScheduler - v13 Section 3.2
 *
 * Cron-style scheduling for scheduled triggers.
 */

import type { ScheduledTrigger, ScheduleCallback } from '../types';

/**
 * Schedule definition
 */
export interface Schedule {
  /** Schedule ID */
  id: string;
  /** Cron expression or interval */
  expression: string;
  /** Type of schedule */
  type: 'cron' | 'interval' | 'daily';
  /** Enabled state */
  enabled: boolean;
  /** Next scheduled run */
  nextRun: number;
  /** Last run time */
  lastRun?: number;
}

/**
 * Generate unique trigger ID
 */
function generateTriggerId(): string {
  return `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse cron expression to calculate next run time
 * Simplified implementation supporting: minute, hour, day, month, weekday
 */
function parseNextCronRun(expression: string, from: Date = new Date()): number {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) {
    console.warn(`[CronScheduler] Invalid cron expression: "${expression}", defaulting to next minute`);
    return from.getTime() + 60000;
  }

  const [minute, hour, _day, _month, _weekday] = parts;

  const next = new Date(from);
  next.setSeconds(0, 0);

  // Simple parsing for common patterns
  if (minute === '*' && hour === '*') {
    // Every minute
    next.setMinutes(next.getMinutes() + 1);
  } else if (minute !== '*' && hour !== '*') {
    // Specific time each day
    const targetMinute = parseInt(minute, 10);
    const targetHour = parseInt(hour, 10);

    next.setHours(targetHour, targetMinute, 0, 0);

    // If we've passed this time today, move to tomorrow
    if (next <= from) {
      next.setDate(next.getDate() + 1);
    }
  } else if (minute !== '*') {
    // Specific minute each hour
    const targetMinute = parseInt(minute, 10);
    next.setMinutes(targetMinute);
    if (next <= from) {
      next.setHours(next.getHours() + 1);
    }
  } else if (hour !== '*') {
    // Specific hour each day
    const targetHour = parseInt(hour, 10);
    next.setHours(targetHour, 0, 0, 0);
    if (next <= from) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next.getTime();
}

/**
 * CronScheduler - Cron-style scheduling for triggers
 *
 * @example
 * ```typescript
 * const scheduler = new CronScheduler({
 *   daily_digest: '0 9 * * *',     // 9 AM daily
 *   weekly_review: '0 10 * * 1',   // 10 AM Mondays
 * });
 *
 * scheduler.onTrigger(async (trigger) => {
 *   console.log('Schedule triggered:', trigger.scheduleId);
 *   await coordinator.routeTrigger(trigger, context);
 * });
 *
 * scheduler.start();
 * ```
 */
export class CronScheduler {
  private schedules: Map<string, Schedule> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private callbacks: ScheduleCallback[] = [];
  private running = false;

  constructor(schedules?: Record<string, string>) {
    if (schedules) {
      for (const [id, expression] of Object.entries(schedules)) {
        this.register(id, expression);
      }
    }
  }

  /**
   * Register a schedule
   */
  register(id: string, expression: string): void {
    const type = this.detectType(expression);
    const nextRun = this.calculateNextRun(expression, type);

    const schedule: Schedule = {
      id,
      expression,
      type,
      enabled: true,
      nextRun,
    };

    this.schedules.set(id, schedule);

    // Start timer if running
    if (this.running && schedule.enabled) {
      this.scheduleTimer(schedule);
    }
  }

  /**
   * Unregister a schedule
   */
  unregister(id: string): boolean {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    return this.schedules.delete(id);
  }

  /**
   * Enable/disable a schedule
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const schedule = this.schedules.get(id);
    if (!schedule) return false;

    schedule.enabled = enabled;

    if (enabled && this.running) {
      this.scheduleTimer(schedule);
    } else {
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
    }

    return true;
  }

  /**
   * Register callback for triggers
   */
  onTrigger(callback: ScheduleCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Unregister callback
   */
  offTrigger(callback: ScheduleCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    for (const schedule of this.schedules.values()) {
      if (schedule.enabled) {
        this.scheduleTimer(schedule);
      }
    }

    console.log('[CronScheduler] Started with', this.schedules.size, 'schedules');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    console.log('[CronScheduler] Stopped');
  }

  /**
   * Schedule timer for a schedule
   */
  private scheduleTimer(schedule: Schedule): void {
    // Clear existing timer
    const existing = this.timers.get(schedule.id);
    if (existing) {
      clearTimeout(existing);
    }

    const delay = Math.max(0, schedule.nextRun - Date.now());

    const timer = setTimeout(() => {
      this.handleTrigger(schedule);
    }, delay);

    this.timers.set(schedule.id, timer);
  }

  /**
   * Handle schedule trigger
   */
  private async handleTrigger(schedule: Schedule): Promise<void> {
    const trigger: ScheduledTrigger = {
      id: generateTriggerId(),
      mode: 'scheduled',
      scheduleId: schedule.id,
      scheduledAt: schedule.nextRun,
      scheduleExpr: schedule.expression,
      createdAt: Date.now(),
    };

    // Update schedule timing
    schedule.lastRun = Date.now();
    schedule.nextRun = this.calculateNextRun(schedule.expression, schedule.type);

    // Notify callbacks
    for (const callback of this.callbacks) {
      try {
        await callback(trigger);
      } catch (error) {
        console.error('[CronScheduler] Callback error:', error);
      }
    }

    // Reschedule if still running
    if (this.running && schedule.enabled) {
      this.scheduleTimer(schedule);
    }
  }

  /**
   * Detect schedule type from expression
   */
  private detectType(expression: string): 'cron' | 'interval' | 'daily' {
    // Check for interval format (e.g., "every 4h", "every 30m")
    if (expression.startsWith('every ')) {
      return 'interval';
    }

    // Check for daily format (e.g., "daily 9:00")
    if (expression.startsWith('daily ')) {
      return 'daily';
    }

    // Default to cron
    return 'cron';
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(expression: string, type: 'cron' | 'interval' | 'daily'): number {
    const now = new Date();

    switch (type) {
      case 'interval':
        return this.parseIntervalNextRun(expression, now);

      case 'daily':
        return this.parseDailyNextRun(expression, now);

      case 'cron':
      default:
        return parseNextCronRun(expression, now);
    }
  }

  /**
   * Parse interval expression (e.g., "every 4h", "every 30m")
   */
  private parseIntervalNextRun(expression: string, from: Date): number {
    const match = expression.match(/every\s+(\d+)([hms])/i);
    if (!match) {
      console.warn(`[CronScheduler] Invalid interval expression: "${expression}", defaulting to 1 hour`);
      return from.getTime() + 60 * 60 * 1000;
    }

    const [, amount, unit] = match;
    const value = parseInt(amount, 10);

    let ms: number;
    switch (unit.toLowerCase()) {
      case 'h':
        ms = value * 60 * 60 * 1000;
        break;
      case 'm':
        ms = value * 60 * 1000;
        break;
      case 's':
        ms = value * 1000;
        break;
      default:
        ms = 60 * 60 * 1000;
    }

    return from.getTime() + ms;
  }

  /**
   * Parse daily expression (e.g., "daily 9:00")
   */
  private parseDailyNextRun(expression: string, from: Date): number {
    const match = expression.match(/daily\s+(\d+):(\d+)/i);
    if (!match) {
      console.warn(`[CronScheduler] Invalid daily expression: "${expression}", defaulting to 9:00 AM`);
      const next = new Date(from);
      next.setHours(9, 0, 0, 0);
      if (next <= from) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }

    const [, hour, minute] = match;
    const next = new Date(from);
    next.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);

    if (next <= from) {
      next.setDate(next.getDate() + 1);
    }

    return next.getTime();
  }

  /**
   * Get all schedules
   */
  getSchedules(): Schedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get a specific schedule
   */
  getSchedule(id: string): Schedule | undefined {
    return this.schedules.get(id);
  }

  /**
   * Trigger a schedule immediately (for testing)
   */
  async triggerNow(id: string): Promise<ScheduledTrigger | null> {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;

    const trigger: ScheduledTrigger = {
      id: generateTriggerId(),
      mode: 'scheduled',
      scheduleId: schedule.id,
      scheduledAt: Date.now(),
      scheduleExpr: schedule.expression,
      createdAt: Date.now(),
    };

    // Notify callbacks
    for (const callback of this.callbacks) {
      try {
        await callback(trigger);
      } catch (error) {
        console.error('[CronScheduler] Callback error:', error);
      }
    }

    return trigger;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }
}
