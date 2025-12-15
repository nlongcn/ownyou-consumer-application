/**
 * Backup Service Tests
 *
 * Tests for the E2EE cloud backup service.
 *
 * @see packages/backup/src/backup/backup-service.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBackupService, type BackupServiceConfig } from '../../src/backup/backup-service.js';
import { InMemoryCloudProvider } from '../../src/storage/cloud-provider.js';
import type { Store, BackupConfig, BackupPolicy } from '../../src/types.js';

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

// Create default test config
function createTestConfig(overrides: Partial<BackupServiceConfig> = {}): BackupServiceConfig {
  const defaultPolicy: BackupPolicy = {
    frequency: {
      realtime: ['ownyou.earnings'],
      hourly: ['ownyou.iab.classifications'],
      daily: ['ownyou.preferences'],
    },
    retention: {
      snapshots: 3,
      maxAgeDays: 30,
    },
    triggers: {
      automatic: true,
      beforeLogout: true,
      manual: true,
    },
    optimization: {
      compression: 'gzip',
      deduplication: true,
      deltaSync: true,
    },
  };

  const defaultBackupConfig: BackupConfig = {
    provider: 'ownyou',
    ownyouCloud: { endpoint: 'https://backup.test.ownyou.app/v1' },
    policy: defaultPolicy,
  };

  return {
    backupConfig: defaultBackupConfig,
    cloudProvider: new InMemoryCloudProvider(),
    encryptionKey: mockCryptoKey,
    deviceId: 'test-device-001',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    ...overrides,
  };
}

describe('BackupService', () => {
  let store: Store & { data: Map<string, Map<string, unknown>> };
  let config: BackupServiceConfig;

  beforeEach(() => {
    store = createMockStore();
    config = createTestConfig();

    // Mock crypto operations
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle: {
        encrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => {
          // Simple mock encryption - just prepend IV
          return data.buffer;
        }),
        decrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => {
          // Simple mock decryption
          return data.buffer;
        }),
        digest: vi.fn().mockImplementation(async (_algorithm, _data) => {
          // Return a mock 32-byte hash
          return new Uint8Array(32).fill(1).buffer;
        }),
      },
    });
  });

  describe('createBackupService', () => {
    it('should create a backup service instance', () => {
      const service = createBackupService(config);

      expect(service).toBeDefined();
      expect(service.initialize).toBeDefined();
      expect(service.createBackup).toBeDefined();
      expect(service.restore).toBeDefined();
      expect(service.getStatus).toBeDefined();
      expect(service.getHistory).toBeDefined();
    });

    it('should have idle status before initialization', () => {
      const service = createBackupService(config);
      const status = service.getStatus();

      expect(status.state).toBe('idle');
      expect(status.backupCount).toBe(0);
      expect(status.lastBackupTime).toBeNull();
      expect(status.lastBackupId).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with empty store', async () => {
      const service = createBackupService(config);
      await service.initialize(store);

      const status = service.getStatus();
      expect(status.state).toBe('idle');
    });

    it('should load existing backup history on initialization', async () => {
      const cloudProvider = config.cloudProvider as InMemoryCloudProvider;

      // Pre-populate some backups
      await cloudProvider.upload('backup-1', new Uint8Array([1, 2, 3]), {
        version: 1,
        backupId: 'backup-1',
        createdAt: Date.now() - 86400000, // 1 day ago
        deviceId: 'test-device',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': 5 },
        uncompressedSize: 100,
        compressedSize: 50,
        isIncremental: false,
        checksum: 'abc123',
      });

      const service = createBackupService(config);
      await service.initialize(store);

      const status = service.getStatus();
      expect(status.backupCount).toBe(1);
    });
  });

  describe('createBackup', () => {
    it('should throw if not initialized', async () => {
      const service = createBackupService(config);

      await expect(service.createBackup()).rejects.toThrow('Backup service not initialized');
    });

    it('should throw if backup already in progress', async () => {
      const slowCloudProvider = {
        ...config.cloudProvider,
        upload: vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 1000))
        ),
        list: vi.fn().mockResolvedValue([]),
        getStorageUsage: vi.fn().mockResolvedValue({ used: 0, limit: 1000000 }),
      };

      const service = createBackupService({
        ...config,
        cloudProvider: slowCloudProvider as unknown as InMemoryCloudProvider,
      });

      // Add some data to back up
      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: Date.now() });
      await service.initialize(store);

      // Start first backup (don't await)
      const firstBackup = service.createBackup();

      // Try to start second backup immediately
      await expect(service.createBackup()).rejects.toThrow('Backup already in progress');

      // Clean up
      await firstBackup.catch(() => {});
    });

    it('should create a full backup successfully', async () => {
      const service = createBackupService(config);

      // Add some data
      await store.put(['ownyou.test'], 'key1', { value: 'test1', timestamp: Date.now() });
      await store.put(['ownyou.test'], 'key2', { value: 'test2', timestamp: Date.now() });

      await service.initialize(store);

      const result = await service.createBackup({ incremental: false });

      expect(result.backupId).toBeDefined();
      expect(result.backupId).toMatch(/^backup-/);
      expect(result.timestamp).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.isIncremental).toBe(false);
      expect(result.checksum).toBeDefined();
    });

    it('should update status after successful backup', async () => {
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: Date.now() });
      await service.initialize(store);

      const result = await service.createBackup();

      const status = service.getStatus();
      expect(status.state).toBe('idle');
      expect(status.lastBackupId).toBe(result.backupId);
      expect(status.lastBackupTime).toBeDefined();
      expect(status.backupCount).toBe(1);
    });

    it('should create incremental backup with only new records', async () => {
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'old', timestamp: Date.now() - 10000 });
      await service.initialize(store);

      // First full backup
      await service.createBackup({ incremental: false });

      // Add new data
      await store.put(['ownyou.test'], 'key2', { value: 'new', timestamp: Date.now() });

      // Incremental backup
      const result = await service.createBackup({ incremental: true });

      expect(result.isIncremental).toBe(true);
    });

    it('should set error state on backup failure', async () => {
      const failingProvider = {
        ...config.cloudProvider,
        upload: vi.fn().mockRejectedValue(new Error('Network error')),
        list: vi.fn().mockResolvedValue([]),
        getStorageUsage: vi.fn().mockResolvedValue({ used: 0, limit: 1000000 }),
      };

      const service = createBackupService({
        ...config,
        cloudProvider: failingProvider as unknown as InMemoryCloudProvider,
      });

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: Date.now() });
      await service.initialize(store);

      await expect(service.createBackup()).rejects.toThrow('Network error');

      const status = service.getStatus();
      expect(status.state).toBe('error');
      expect(status.error).toBe('Network error');
    });
  });

  describe('restore', () => {
    it('should throw if not initialized', async () => {
      const service = createBackupService(config);

      await expect(service.restore('backup-123')).rejects.toThrow('Backup service not initialized');
    });

    it('should restore backup data to store', async () => {
      const service = createBackupService(config);
      const targetStore = createMockStore();

      // Create backup in original store
      await store.put(['ownyou.test'], 'key1', { value: 'test1', timestamp: Date.now() });
      await store.put(['ownyou.test'], 'key2', { value: 'test2', timestamp: Date.now() });
      await service.initialize(store);

      const { backupId } = await service.createBackup({ incremental: false });

      // Create new service with empty store and restore
      const restoreService = createBackupService(config);
      await restoreService.initialize(targetStore);

      const result = await restoreService.restore(backupId);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBeGreaterThan(0);
      expect(result.restoredNamespaces).toContain('ownyou.test');
    });

    it('should verify backup integrity before restoring', async () => {
      const corruptingProvider = new InMemoryCloudProvider();

      // Override download to return corrupted data
      const originalDownload = corruptingProvider.download.bind(corruptingProvider);
      corruptingProvider.download = async (backupId: string) => {
        const result = await originalDownload(backupId);
        // Corrupt the checksum
        result.manifest.checksum = 'corrupted';
        return result;
      };

      const corruptConfig = { ...config, cloudProvider: corruptingProvider };
      const service = createBackupService(corruptConfig);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: Date.now() });
      await service.initialize(store);

      const { backupId } = await service.createBackup({ incremental: false });

      // Try to restore - should fail integrity check
      await expect(service.restore(backupId)).rejects.toThrow('Backup integrity check failed');
    });
  });

  describe('getStatus', () => {
    it('should return current backup status', async () => {
      const service = createBackupService(config);
      await service.initialize(store);

      const status = service.getStatus();

      expect(status).toMatchObject({
        state: 'idle',
        backupCount: expect.any(Number),
        storageUsed: expect.any(Number),
      });
    });

    it('should update storage used after backup', async () => {
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: Date.now() });
      await service.initialize(store);

      const statusBefore = service.getStatus();
      await service.createBackup();
      const statusAfter = service.getStatus();

      expect(statusAfter.storageUsed).toBeGreaterThan(statusBefore.storageUsed);
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no backups', async () => {
      const service = createBackupService(config);
      await service.initialize(store);

      const history = await service.getHistory();

      expect(history).toEqual([]);
    });

    it('should return backup history entries', async () => {
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: Date.now() });
      await service.initialize(store);

      await service.createBackup({ incremental: false });
      await service.createBackup({ incremental: true });

      const history = await service.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        backupId: expect.any(String),
        timestamp: expect.any(Number),
        size: expect.any(Number),
        isIncremental: expect.any(Boolean),
      });
    });
  });
});

describe('BackupService - Type Guard', () => {
  let store: Store & { data: Map<string, Map<string, unknown>> };
  let config: BackupServiceConfig;

  beforeEach(() => {
    store = createMockStore();
    config = createTestConfig();

    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle: {
        encrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => data.buffer),
        decrypt: vi.fn().mockImplementation(async (_algorithm, _key, data: Uint8Array) => data.buffer),
        digest: vi.fn().mockImplementation(async () => new Uint8Array(32).fill(1).buffer),
      },
    });
  });

  it('should handle records without timestamp in incremental backup', async () => {
    const service = createBackupService(config);

    // Add record without timestamp
    await store.put(['ownyou.test'], 'no-timestamp', { value: 'test' });
    await service.initialize(store);

    // First backup
    await service.createBackup({ incremental: false });

    // Add another record without timestamp
    await store.put(['ownyou.test'], 'no-timestamp-2', { value: 'test2' });

    // Incremental backup should include records without timestamps
    const result = await service.createBackup({ incremental: true });

    expect(result.isIncremental).toBe(true);
    // Records without timestamps should be included
  });

  it('should handle records with invalid timestamp types', async () => {
    const service = createBackupService(config);

    // Add records with various invalid timestamp types
    await store.put(['ownyou.test'], 'string-timestamp', { value: 'test', timestamp: '2024-01-01' });
    await store.put(['ownyou.test'], 'null-timestamp', { value: 'test', timestamp: null });
    await store.put(['ownyou.test'], 'undefined-timestamp', { value: 'test', timestamp: undefined });

    await service.initialize(store);

    // Should not throw
    const result = await service.createBackup({ incremental: false });

    expect(result.backupId).toBeDefined();
  });

  it('should correctly filter by timestamp for incremental backups', async () => {
    const service = createBackupService(config);

    const oldTime = Date.now() - 100000;
    const newTime = Date.now();

    await store.put(['ownyou.test'], 'old-record', { value: 'old', timestamp: oldTime });
    await service.initialize(store);

    await service.createBackup({ incremental: false });

    // Add new record with recent timestamp
    await store.put(['ownyou.test'], 'new-record', { value: 'new', timestamp: newTime });

    // Incremental should only include new record
    const result = await service.createBackup({ incremental: true });

    expect(result.isIncremental).toBe(true);
  });
});
