/**
 * Scheduled triggers exports
 */

export {
  CronScheduler,
  type Schedule,
} from './cron-scheduler';

/**
 * Default schedules for OwnYou - v13 Section 3.2
 *
 * These are predefined schedule configurations that can be registered
 * with the CronScheduler.
 */
export const DEFAULT_SCHEDULES = {
  /**
   * Daily Ikigai inference - v13 Section 2.5
   * Runs at 3 AM daily to process accumulated data into profile updates.
   * Off-peak timing to minimize impact on user experience.
   */
  IKIGAI_DAILY: {
    id: 'ikigai_daily_inference',
    expression: '0 3 * * *', // 3:00 AM daily
    description: 'Daily Ikigai profile inference from accumulated data',
  },

  /**
   * Weekly profile synthesis - deeper analysis
   * Runs Sunday at 4 AM for comprehensive profile review.
   */
  IKIGAI_WEEKLY: {
    id: 'ikigai_weekly_synthesis',
    expression: '0 4 * * 0', // 4:00 AM Sundays
    description: 'Weekly Ikigai profile deep synthesis',
  },

  /**
   * Hourly mission generation - v13 Section 3.3
   * Checks for new mission opportunities based on recent data.
   */
  MISSIONS_HOURLY: {
    id: 'missions_hourly_check',
    expression: 'every 1h',
    description: 'Hourly check for new mission opportunities',
  },
} as const;

/**
 * Create a scheduler with default OwnYou schedules
 */
export function createDefaultScheduler(): import('./cron-scheduler').CronScheduler {
  const { CronScheduler } = require('./cron-scheduler');
  const scheduler = new CronScheduler();

  // Register default schedules
  for (const schedule of Object.values(DEFAULT_SCHEDULES)) {
    scheduler.register(schedule.id, schedule.expression);
  }

  return scheduler;
}
