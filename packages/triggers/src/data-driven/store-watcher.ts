/**
 * StoreWatcher - v13 Section 3.2
 *
 * Monitors Store namespaces for changes and emits data-driven triggers.
 */

import type { DataTrigger, ChangeCallback } from '../types';

/**
 * Store subscription interface
 * This defines what we expect from a store that supports subscriptions
 */
export interface SubscribableStore {
  /** Subscribe to changes in a namespace */
  subscribe?(
    namespace: string,
    callback: (key: string, value: unknown, changeType: 'create' | 'update' | 'delete') => void
  ): () => void;

  /** Alternative: onEvent callback from MemoryStore */
  onEvent?: (event: { type: string; namespace: readonly string[]; key?: string }) => void;
}

/**
 * StoreWatcher configuration
 */
export interface StoreWatcherConfig {
  /** Namespaces to watch */
  namespaces: string[];
  /** Debounce time in ms (default: 1000) */
  debounceMs?: number;
  /** Maximum batch size before immediate flush (default: 10) */
  batchSize?: number;
}

/**
 * Generate unique trigger ID
 */
function generateTriggerId(): string {
  return `data_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * StoreWatcher - Monitors Store namespaces for changes
 *
 * Watches configured namespaces and triggers agents when data changes occur.
 * Supports debouncing and batching to prevent trigger storms.
 *
 * @example
 * ```typescript
 * const watcher = new StoreWatcher({
 *   namespaces: ['ownyou.iab', 'ownyou.semantic'],
 * });
 *
 * watcher.onNamespaceChange('ownyou.iab', async (trigger) => {
 *   console.log('IAB classification changed:', trigger.key);
 *   await coordinator.routeTrigger(trigger, context);
 * });
 *
 * watcher.start();
 * ```
 */
export class StoreWatcher {
  private config: Required<StoreWatcherConfig>;
  private callbacks: Map<string, ChangeCallback[]> = new Map();
  private changeBuffer: DataTrigger[] = [];
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private running = false;

  /** Track values for detecting create vs update */
  private knownKeys: Map<string, Set<string>> = new Map();

  constructor(config: StoreWatcherConfig) {
    this.config = {
      debounceMs: 1000,
      batchSize: 10,
      ...config,
    };

    // Initialize known keys sets
    for (const ns of this.config.namespaces) {
      this.knownKeys.set(ns, new Set());
    }
  }

  /**
   * Start watching (for subscription-based stores)
   *
   * Note: Since MemoryStore doesn't have a built-in subscription system,
   * this is primarily for stores that implement the subscribe method.
   * For MemoryStore, use handleStoreEvent with the onEvent callback.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[StoreWatcher] Started watching:', this.config.namespaces);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    // Flush any remaining changes
    if (this.changeBuffer.length > 0) {
      this.flush();
    }

    console.log('[StoreWatcher] Stopped');
  }

  /**
   * Handle a store event (for use with MemoryStore's onEvent callback)
   *
   * @example
   * ```typescript
   * const watcher = new StoreWatcher({ namespaces: ['ownyou.iab'] });
   * const store = new MemoryStore({
   *   backend,
   *   onEvent: (event) => watcher.handleStoreEvent(event),
   * });
   * ```
   */
  handleStoreEvent(event: {
    type: 'put' | 'get' | 'delete' | 'list' | 'search';
    namespace: readonly string[];
    key?: string;
  }): void {
    if (!this.running) return;

    // Only process put and delete events
    if (event.type !== 'put' && event.type !== 'delete') return;

    const [ns] = event.namespace;

    // Only watch configured namespaces
    if (!this.config.namespaces.includes(ns)) return;

    // Need a key for data triggers
    if (!event.key) return;

    // Determine change type
    let changeType: 'create' | 'update' | 'delete';
    const knownKeysForNs = this.knownKeys.get(ns) ?? new Set();

    if (event.type === 'delete') {
      changeType = 'delete';
      knownKeysForNs.delete(event.key);
    } else if (knownKeysForNs.has(event.key)) {
      changeType = 'update';
    } else {
      changeType = 'create';
      knownKeysForNs.add(event.key);
    }

    this.onStoreChange(ns, event.key, undefined, changeType);
  }

  /**
   * Register callback for namespace changes
   */
  onNamespaceChange(namespace: string, callback: ChangeCallback): void {
    const existing = this.callbacks.get(namespace) ?? [];
    existing.push(callback);
    this.callbacks.set(namespace, existing);
  }

  /**
   * Unregister callback for namespace
   */
  offNamespaceChange(namespace: string, callback: ChangeCallback): void {
    const existing = this.callbacks.get(namespace) ?? [];
    const index = existing.indexOf(callback);
    if (index !== -1) {
      existing.splice(index, 1);
      this.callbacks.set(namespace, existing);
    }
  }

  /**
   * Clear all callbacks for a namespace
   */
  clearNamespaceCallbacks(namespace: string): void {
    this.callbacks.delete(namespace);
  }

  /**
   * Handle store change (internal)
   */
  private onStoreChange(
    namespace: string,
    key: string,
    value: unknown,
    changeType: 'create' | 'update' | 'delete'
  ): void {
    const trigger: DataTrigger = {
      id: generateTriggerId(),
      mode: 'data',
      namespace,
      key,
      value,
      changeType,
      createdAt: Date.now(),
    };

    this.changeBuffer.push(trigger);
    this.scheduleFlush();
  }

  /**
   * Schedule buffer flush with debouncing
   */
  private scheduleFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Flush immediately if buffer is full
    if (this.changeBuffer.length >= this.config.batchSize) {
      this.flush();
      return;
    }

    // Otherwise debounce
    this.debounceTimer = setTimeout(() => this.flush(), this.config.debounceMs);
  }

  /**
   * Flush change buffer
   */
  private async flush(): Promise<void> {
    if (this.changeBuffer.length === 0) return;

    const triggers = [...this.changeBuffer];
    this.changeBuffer = [];

    for (const trigger of triggers) {
      const callbacks = this.callbacks.get(trigger.namespace) ?? [];
      for (const callback of callbacks) {
        try {
          await callback(trigger);
        } catch (error) {
          console.error('[StoreWatcher] Callback error:', error);
        }
      }
    }
  }

  /**
   * Get pending trigger count
   */
  getPendingCount(): number {
    return this.changeBuffer.length;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Force flush pending triggers
   */
  async forceFlush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    await this.flush();
  }
}
