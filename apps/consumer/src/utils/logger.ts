/**
 * Persistent Logger for OwnYou Consumer App
 *
 * Captures ALL console output and forwards to Tauri's log plugin,
 * which persists to ~/Library/Logs/ai.ownyou.consumer/OwnYou.log
 *
 * This ensures logs survive app crashes and hangs.
 */

import { trace, debug, info, warn, error, attachConsole } from '@tauri-apps/plugin-log';

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// Format arguments for logging
function formatArgs(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(' ');
}

// Track initialization state
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the persistent logger.
 * Call this once at app startup.
 */
export async function initLogger(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Check if we're in Tauri environment
      const isTauri = typeof window !== 'undefined' &&
                      window.location?.protocol === 'tauri:' &&
                      !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;

      if (!isTauri) {
        originalConsole.info('[Logger] Not in Tauri environment, using console only');
        isInitialized = true;
        return;
      }

      // Attach console to forward webview logs to Rust
      // This captures console.log/warn/error etc automatically
      // Note: detach function returned but not used - we want logging for app lifetime
      await attachConsole();

      // Override console methods to also write to Tauri log
      console.log = (...args: unknown[]) => {
        originalConsole.log(...args);
        const message = formatArgs(args);
        info(`[JS] ${message}`).catch(() => {});
      };

      console.debug = (...args: unknown[]) => {
        originalConsole.debug(...args);
        const message = formatArgs(args);
        debug(`[JS] ${message}`).catch(() => {});
      };

      console.info = (...args: unknown[]) => {
        originalConsole.info(...args);
        const message = formatArgs(args);
        info(`[JS] ${message}`).catch(() => {});
      };

      console.warn = (...args: unknown[]) => {
        originalConsole.warn(...args);
        const message = formatArgs(args);
        warn(`[JS] ${message}`).catch(() => {});
      };

      console.error = (...args: unknown[]) => {
        originalConsole.error(...args);
        const message = formatArgs(args);
        error(`[JS] ${message}`).catch(() => {});
      };

      // Log initialization success
      await info('[Logger] Persistent logging initialized - logs at apps/consumer/logs/ownyou.log');

      isInitialized = true;
      originalConsole.info('[Logger] Persistent logging initialized');
    } catch (err) {
      originalConsole.error('[Logger] Failed to initialize:', err);
      isInitialized = true; // Mark as initialized even on failure to prevent retry loops
    }
  })();

  return initPromise;
}

// Export direct log functions for explicit logging
export { trace, debug, info, warn, error };

// Export a function to get the log file path
export function getLogPath(): string {
  return 'apps/consumer/logs/ownyou.log';
}
