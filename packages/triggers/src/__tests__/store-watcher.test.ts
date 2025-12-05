/**
 * StoreWatcher Tests - v13 Section 3.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NAMESPACES } from '@ownyou/shared-types';
import { StoreWatcher } from '../data-driven/store-watcher';
import type { DataTrigger } from '../types';

describe('StoreWatcher', () => {
  let watcher: StoreWatcher;

  beforeEach(() => {
    watcher = new StoreWatcher({
      namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.SEMANTIC_MEMORY],
      debounceMs: 10, // Short for testing
      batchSize: 5,
    });
  });

  afterEach(() => {
    watcher.stop();
  });

  describe('lifecycle', () => {
    it('should start and stop', () => {
      expect(watcher.isRunning()).toBe(false);
      watcher.start();
      expect(watcher.isRunning()).toBe(true);
      watcher.stop();
      expect(watcher.isRunning()).toBe(false);
    });
  });

  describe('handleStoreEvent', () => {
    it('should create data trigger from store event', async () => {
      const callback = vi.fn();
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.start();

      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'classification_1',
      });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledTimes(1);
      const trigger = callback.mock.calls[0][0] as DataTrigger;
      expect(trigger.mode).toBe('data');
      expect(trigger.namespace).toBe(NAMESPACES.IAB_CLASSIFICATIONS);
      expect(trigger.key).toBe('classification_1');
      expect(trigger.changeType).toBe('create');
    });

    it('should detect update vs create', async () => {
      const callback = vi.fn();
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.start();

      // First event - should be create
      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'classification_1',
      });

      await watcher.forceFlush();

      const firstTrigger = callback.mock.calls[0][0] as DataTrigger;
      expect(firstTrigger.changeType).toBe('create');

      // Second event - should be update
      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'classification_1',
      });

      await watcher.forceFlush();

      const secondTrigger = callback.mock.calls[1][0] as DataTrigger;
      expect(secondTrigger.changeType).toBe('update');
    });

    it('should detect delete', async () => {
      const callback = vi.fn();
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.start();

      watcher.handleStoreEvent({
        type: 'delete',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'classification_1',
      });

      await watcher.forceFlush();

      const trigger = callback.mock.calls[0][0] as DataTrigger;
      expect(trigger.changeType).toBe('delete');
    });

    it('should ignore unwatched namespaces', async () => {
      const callback = vi.fn();
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.start();

      watcher.handleStoreEvent({
        type: 'put',
        namespace: ['ownyou.other', 'user_123'],
        key: 'item_1',
      });

      await watcher.forceFlush();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should ignore non-put/delete events', async () => {
      const callback = vi.fn();
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.start();

      watcher.handleStoreEvent({
        type: 'get',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'item_1',
      });

      watcher.handleStoreEvent({
        type: 'list',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
      });

      watcher.handleStoreEvent({
        type: 'search',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
      });

      await watcher.forceFlush();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('batching', () => {
    it('should batch changes before flushing', async () => {
      const callback = vi.fn();
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.start();

      // Add multiple events quickly
      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'item_1',
      });
      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'item_2',
      });

      expect(watcher.getPendingCount()).toBe(2);

      await watcher.forceFlush();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(watcher.getPendingCount()).toBe(0);
    });

    it('should flush immediately when batch size reached', async () => {
      const callback = vi.fn();
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.start();

      // Add 5 events (batch size) - should flush immediately
      for (let i = 0; i < 5; i++) {
        watcher.handleStoreEvent({
          type: 'put',
          namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
          key: `item_${i}`,
        });
      }

      // Allow microtask queue to process
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalledTimes(5);
    });
  });

  describe('callbacks', () => {
    it('should support multiple callbacks per namespace', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback1);
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback2);
      watcher.start();

      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'item_1',
      });

      await watcher.forceFlush();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should allow unregistering callbacks', async () => {
      const callback = vi.fn();
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.offNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, callback);
      watcher.start();

      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'item_1',
      });

      await watcher.forceFlush();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = vi.fn().mockRejectedValue(new Error('Callback error'));
      const goodCallback = vi.fn();

      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, errorCallback);
      watcher.onNamespaceChange(NAMESPACES.IAB_CLASSIFICATIONS, goodCallback);
      watcher.start();

      watcher.handleStoreEvent({
        type: 'put',
        namespace: [NAMESPACES.IAB_CLASSIFICATIONS, 'user_123'],
        key: 'item_1',
      });

      await watcher.forceFlush();

      // Error callback was called
      expect(errorCallback).toHaveBeenCalledTimes(1);
      // Good callback still called despite error
      expect(goodCallback).toHaveBeenCalledTimes(1);
    });
  });
});
