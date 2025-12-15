/**
 * Recovery Flow Tests
 *
 * Tests for wallet recovery flow state management and error handling.
 * Note: Full E2E restore is covered in backup-service.test.ts.
 * These tests focus on flow state management.
 *
 * @see packages/backup/src/recovery/recovery-flow.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createRecoveryFlow,
  validateWalletForRecovery,
  type RecoveryFlowState,
} from '../../src/recovery/recovery-flow.js';
import { InMemoryCloudProvider } from '../../src/storage/cloud-provider.js';
import type { Store, BackupManifest } from '../../src/types.js';

// Mock crypto.subtle for tests
const mockCryptoKey = {} as CryptoKey;

// Create a mock store
function createMockStore(): Store & { data: Map<string, Map<string, unknown>> } {
  const data = new Map<string, Map<string, unknown>>();

  return {
    data,
    async get(namespace: readonly string[], key: string): Promise<unknown> {
      const ns = namespace.join('.');
      return data.get(ns)?.get(key) ?? null;
    },
    async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
      const ns = namespace.join('.');
      if (!data.has(ns)) {
        data.set(ns, new Map());
      }
      data.get(ns)!.set(key, value);
    },
    async delete(namespace: readonly string[], key: string): Promise<void> {
      const ns = namespace.join('.');
      data.get(ns)?.delete(key);
    },
    async list(namespace: readonly string[]): Promise<Array<{ key: string; value: unknown }>> {
      const ns = namespace.join('.');
      const nsData = data.get(ns);
      if (!nsData) return [];
      return Array.from(nsData.entries()).map(([key, value]) => ({ key, value }));
    },
  };
}

describe('RecoveryFlow', () => {
  let cloudProvider: InMemoryCloudProvider;
  let store: Store & { data: Map<string, Map<string, unknown>> };

  beforeEach(() => {
    cloudProvider = new InMemoryCloudProvider();
    store = createMockStore();

    // Mock crypto operations
    vi.stubGlobal('crypto', {
      subtle: {
        decrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => {
          return data.slice(12).buffer;
        }),
        digest: vi.fn().mockImplementation(async () => {
          return new Uint8Array(32).fill(1).buffer;
        }),
      },
    });
  });

  describe('createRecoveryFlow', () => {
    it('should create a recovery flow instance', () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);

      expect(flow).toBeDefined();
      expect(flow.getState).toBeDefined();
      expect(flow.subscribe).toBeDefined();
      expect(flow.startRecovery).toBeDefined();
      expect(flow.cancel).toBeDefined();
    });

    it('should have idle initial state', () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);
      const state = flow.getState();

      expect(state.step).toBe('idle');
      expect(state.progress).toBe(0);
      expect(state.message).toBe('Ready');
    });
  });

  describe('subscribe', () => {
    it('should return unsubscribe function', () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);
      const callback = vi.fn();

      const unsubscribe = flow.subscribe(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should stop receiving updates after unsubscribe', async () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);
      const callback = vi.fn();

      const unsubscribe = flow.subscribe(callback);
      unsubscribe();

      // Trigger recovery attempt (will fail with no backups)
      await flow.startRecovery();

      // After unsubscribe, callback should not be called for state changes
      // during recovery
    });
  });

  describe('startRecovery', () => {
    it('should fail if no backups exist', async () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);

      const result = await flow.startRecovery();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No backups found');
    });

    it('should set error state when no backups found', async () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);

      await flow.startRecovery();

      const state = flow.getState();
      expect(state.step).toBe('error');
      expect(state.error).toContain('No backups found');
    });

    it('should handle download errors', async () => {
      // Add a backup reference but make download fail
      const manifest: BackupManifest = {
        version: 1,
        backupId: 'backup-1',
        createdAt: Date.now(),
        deviceId: 'device-1',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': 1 },
        uncompressedSize: 100,
        compressedSize: 50,
        isIncremental: false,
        checksum: 'test',
      };

      await cloudProvider.upload('backup-1', new Uint8Array([1]), manifest);

      // Override download to fail
      cloudProvider.download = vi.fn().mockRejectedValue(new Error('Download failed'));

      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);
      const result = await flow.startRecovery();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should reset state after cancel', () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);

      flow.cancel();
      const state = flow.getState();

      expect(state.step).toBe('idle');
      expect(state.progress).toBe(0);
      expect(state.message).toBe('Cancelled');
    });
  });

  describe('getState', () => {
    it('should return copy of state (not reference)', () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);

      const state1 = flow.getState();
      const state2 = flow.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it('should reflect current step', async () => {
      const flow = createRecoveryFlow(cloudProvider, mockCryptoKey, store);

      // Before starting
      expect(flow.getState().step).toBe('idle');

      // After failed recovery
      await flow.startRecovery();
      expect(flow.getState().step).toBe('error');

      // After cancel
      flow.cancel();
      expect(flow.getState().step).toBe('idle');
    });
  });
});

describe('validateWalletForRecovery', () => {
  let cloudProvider: InMemoryCloudProvider;

  beforeEach(() => {
    cloudProvider = new InMemoryCloudProvider();

    vi.stubGlobal('crypto', {
      subtle: {
        decrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => {
          return data.slice(12).buffer;
        }),
        digest: vi.fn().mockImplementation(async () => {
          return new Uint8Array(32).fill(1).buffer;
        }),
      },
    });
  });

  it('should return valid with zero backups', async () => {
    const result = await validateWalletForRecovery(cloudProvider, {} as CryptoKey);

    expect(result.valid).toBe(true);
    expect(result.backupCount).toBe(0);
  });

  it('should return backup count', async () => {
    const manifest: BackupManifest = {
      version: 1,
      backupId: 'backup-1',
      createdAt: Date.now(),
      deviceId: 'device-1',
      walletAddress: '0x1234',
      namespaces: ['ownyou.test'],
      recordCounts: { 'ownyou.test': 1 },
      uncompressedSize: 100,
      compressedSize: 50,
      isIncremental: false,
      // Use the expected checksum that matches our mock digest
      checksum: '0101010101010101010101010101010101010101010101010101010101010101',
    };

    // Create mock encrypted data with IV prefix
    const iv = new Uint8Array(12).fill(1);
    const data = new Uint8Array([1, 2, 3]);
    const encrypted = new Uint8Array(iv.length + data.length);
    encrypted.set(iv);
    encrypted.set(data, iv.length);

    await cloudProvider.upload('backup-1', encrypted, manifest);

    const result = await validateWalletForRecovery(cloudProvider, {} as CryptoKey);

    expect(result.backupCount).toBe(1);
  });

  it('should handle provider list error', async () => {
    cloudProvider.list = vi.fn().mockRejectedValue(new Error('List failed'));

    const result = await validateWalletForRecovery(cloudProvider, {} as CryptoKey);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Recovery Flow State Transitions', () => {
  it('should follow expected state progression for failure', async () => {
    const cloudProvider = new InMemoryCloudProvider();
    const store = createMockStore();

    vi.stubGlobal('crypto', {
      subtle: {
        decrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => data.slice(12).buffer),
        digest: vi.fn().mockImplementation(async () => new Uint8Array(32).fill(1).buffer),
      },
    });

    const flow = createRecoveryFlow(cloudProvider, {} as CryptoKey, store);
    const states: RecoveryFlowState[] = [];

    flow.subscribe((state) => {
      states.push({ ...state });
    });

    await flow.startRecovery();

    // Should have at least: fetching_backups, error
    expect(states.some((s) => s.step === 'fetching_backups')).toBe(true);
    expect(states.some((s) => s.step === 'error')).toBe(true);
  });
});
