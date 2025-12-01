/**
 * Structured Logging Utility
 *
 * Simple logger for experiment output
 */

export const logger = {
  info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  },

  success(message: string, ...args: any[]) {
    console.log(`[✓] ${message}`, ...args);
  },

  error(message: string, ...args: any[]) {
    console.error(`[✗] ${message}`, ...args);
  },

  metric(label: string, value: string | number) {
    console.log(`[METRIC] ${label}: ${value}`);
  },

  section(title: string) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${"=".repeat(60)}\n`);
  },
};
