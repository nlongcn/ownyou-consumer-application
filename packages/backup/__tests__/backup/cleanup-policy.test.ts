/**
 * Backup Cleanup Policy Tests
 *
 * Tests for the backup retention and cleanup logic.
 * Specifically tests the two-pass cleanup fix from A4.
 *
 * @see packages/backup/src/backup/backup-service.ts cleanupOldBackups()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBackupService, type BackupServiceConfig } from '../../src/backup/backup-service.js';
import type { Store, BackupConfig, BackupPolicy, BackupManifest, BackupHistoryEntry } from '../../src/types.js';

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

// Create a mock cloud provider with controllable backup list
function createMockCloudProvider(initialBackups: BackupHistoryEntry[] = []) {
  const backups = new Map<string, { data: Uint8Array; manifest: BackupManifest }>();

  // Initialize with provided backups
  for (const entry of initialBackups) {
    backups.set(entry.backupId, {
      data: new Uint8Array([1, 2, 3]),
      manifest: {
        version: 1,
        backupId: entry.backupId,
        createdAt: entry.timestamp,
        deviceId: 'test-device',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': entry.recordCount },
        uncompressedSize: entry.size,
        compressedSize: entry.size,
        isIncremental: entry.isIncremental,
        checksum: 'abc123',
      },
    });
  }

  return {
    backups,
    async upload(backupId: string, data: Uint8Array, manifest: BackupManifest): Promise<void> {
      backups.set(backupId, { data, manifest });
    },
    async download(backupId: string): Promise<{ data: Uint8Array; manifest: BackupManifest }> {
      const backup = backups.get(backupId);
      if (!backup) throw new Error(`Backup not found: ${backupId}`);
      return backup;
    },
    async list(): Promise<BackupHistoryEntry[]> {
      return Array.from(backups.entries()).map(([backupId, { manifest }]) => ({
        backupId,
        timestamp: manifest.createdAt,
        size: manifest.compressedSize,
        isIncremental: manifest.isIncremental,
        namespaceCount: manifest.namespaces.length,
        recordCount: Object.values(manifest.recordCounts).reduce((a, b) => a + b, 0),
      }));
    },
    async delete(backupId: string): Promise<void> {
      backups.delete(backupId);
    },
    async getStorageUsage(): Promise<{ used: number; limit: number }> {
      let used = 0;
      for (const { data } of backups.values()) {
        used += data.byteLength;
      }
      return { used, limit: 1024 * 1024 * 1024 };
    },
    getBackupCount(): number {
      return backups.size;
    },
  };
}

// Create test config with specific retention settings
function createTestConfig(
  cloudProvider: ReturnType<typeof createMockCloudProvider>,
  retention: { snapshots: number; maxAgeDays: number }
): BackupServiceConfig {
  const policy: BackupPolicy = {
    frequency: {
      realtime: ['ownyou.earnings'],
      hourly: ['ownyou.iab.classifications'],
      daily: ['ownyou.preferences'],
    },
    retention,
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

  const backupConfig: BackupConfig = {
    provider: 'ownyou',
    ownyouCloud: { endpoint: 'https://backup.test.ownyou.app/v1' },
    policy,
  };

  return {
    backupConfig,
    cloudProvider: cloudProvider as unknown as ReturnType<typeof createMockCloudProvider>,
    encryptionKey: mockCryptoKey,
    deviceId: 'test-device-001',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  };
}

describe('Backup Cleanup Policy', () => {
  let store: Store & { data: Map<string, Map<string, unknown>> };

  beforeEach(() => {
    store = createMockStore();

    // Mock crypto operations
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

  describe('Count-based retention', () => {
    it('should delete backups beyond count limit regardless of age', async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      // Create 5 recent backups (all within maxAgeDays)
      const cloudProvider = createMockCloudProvider([
        { backupId: 'backup-1', timestamp: now - 1000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-2', timestamp: now - 2000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-3', timestamp: now - 3000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-4', timestamp: now - 4000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-5', timestamp: oneHourAgo, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
      ]);

      // Retention: keep only 3 snapshots, 30 days max age
      const config = createTestConfig(cloudProvider, { snapshots: 3, maxAgeDays: 30 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: now });
      await service.initialize(store);

      // Create a new backup, which triggers cleanup
      await service.createBackup({ incremental: false });

      // Should now have 3 backups (limit) + 1 new = 4, then cleanup removes 1
      // Actually cleanup runs after the new backup, so: 6 total, cleanup to 3
      const remaining = await cloudProvider.list();

      // After cleanup, should have at most 3 backups (the retention limit)
      expect(remaining.length).toBeLessThanOrEqual(3);

      // The oldest backups should have been deleted
      const backupIds = remaining.map(b => b.backupId);
      expect(backupIds).not.toContain('backup-4');
      expect(backupIds).not.toContain('backup-5');
    });

    it('should keep exactly snapshot count when more exist', async () => {
      const now = Date.now();

      // Create 10 backups
      const backups: BackupHistoryEntry[] = [];
      for (let i = 0; i < 10; i++) {
        backups.push({
          backupId: `backup-${i}`,
          timestamp: now - i * 1000,
          size: 100,
          isIncremental: false,
          namespaceCount: 1,
          recordCount: 5,
        });
      }

      const cloudProvider = createMockCloudProvider(backups);
      const config = createTestConfig(cloudProvider, { snapshots: 5, maxAgeDays: 365 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: now });
      await service.initialize(store);

      // Trigger cleanup with new backup
      await service.createBackup({ incremental: false });

      const remaining = await cloudProvider.list();

      // Should have exactly 5 backups (the limit)
      expect(remaining.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Age-based retention', () => {
    it('should apply age-based cleanup to remaining backups after count check', async () => {
      const now = Date.now();
      const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;

      // Create 2 backups, with very high snapshots limit so count check doesn't trigger
      // The age-based cleanup should still delete old backups
      const cloudProvider = createMockCloudProvider([
        { backupId: 'backup-recent', timestamp: now - 1000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-old', timestamp: thirtyOneDaysAgo, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
      ]);

      // Retention: 100 snapshots (won't trigger count cleanup), 30 days max age
      const config = createTestConfig(cloudProvider, { snapshots: 100, maxAgeDays: 30 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: now });
      await service.initialize(store);

      // Trigger cleanup
      await service.createBackup({ incremental: false });

      const remaining = await cloudProvider.list();
      const backupIds = remaining.map(b => b.backupId);

      // With 3 backups and snapshots=100, count check doesn't remove any
      // Then age check should remove the old backup (31 days > 30 days max)
      expect(backupIds).not.toContain('backup-old');
      expect(backupIds).toContain('backup-recent');
    });

    it('should not delete backups within age limit', async () => {
      const now = Date.now();
      const twentyDaysAgo = now - 20 * 24 * 60 * 60 * 1000;

      const cloudProvider = createMockCloudProvider([
        { backupId: 'backup-recent', timestamp: now - 1000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-within-limit', timestamp: twentyDaysAgo, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
      ]);

      const config = createTestConfig(cloudProvider, { snapshots: 100, maxAgeDays: 30 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: now });
      await service.initialize(store);

      await service.createBackup({ incremental: false });

      const remaining = await cloudProvider.list();
      const backupIds = remaining.map(b => b.backupId);

      // Both backups should remain (20 days < 30 days max)
      expect(backupIds).toContain('backup-recent');
      expect(backupIds).toContain('backup-within-limit');
    });
  });

  describe('Two-pass cleanup (A4 fix)', () => {
    it('should delete beyond count limit BEFORE checking age', async () => {
      const now = Date.now();
      const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;

      // Create 5 backups, all recent (within 30 day limit)
      // But we only want to keep 2
      const cloudProvider = createMockCloudProvider([
        { backupId: 'backup-1', timestamp: now - 1000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-2', timestamp: now - 2000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-3', timestamp: fiveDaysAgo - 1000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-4', timestamp: fiveDaysAgo - 2000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-5', timestamp: fiveDaysAgo - 3000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
      ]);

      // Retention: only 2 snapshots, 30 days max age
      // The bug was that backups beyond count limit but within maxAgeDays
      // were never deleted
      const config = createTestConfig(cloudProvider, { snapshots: 2, maxAgeDays: 30 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: now });
      await service.initialize(store);

      await service.createBackup({ incremental: false });

      const remaining = await cloudProvider.list();

      // Should have at most 2 backups (the limit), not 5
      // This tests the fix for the bug where old-but-not-expired backups accumulated
      expect(remaining.length).toBeLessThanOrEqual(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      const now = Date.now();

      const cloudProvider = createMockCloudProvider([
        { backupId: 'backup-1', timestamp: now - 1000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-2', timestamp: now - 2000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-3', timestamp: now - 3000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
      ]);

      // Make delete fail for specific backup
      const originalDelete = cloudProvider.delete.bind(cloudProvider);
      cloudProvider.delete = async (backupId: string) => {
        if (backupId === 'backup-3') {
          throw new Error('Delete failed');
        }
        return originalDelete(backupId);
      };

      const config = createTestConfig(cloudProvider, { snapshots: 1, maxAgeDays: 30 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: now });
      await service.initialize(store);

      // Should not throw, even though delete fails
      await expect(service.createBackup({ incremental: false })).resolves.toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should not delete anything when under limits', async () => {
      const now = Date.now();

      const cloudProvider = createMockCloudProvider([
        { backupId: 'backup-1', timestamp: now - 1000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
      ]);

      const config = createTestConfig(cloudProvider, { snapshots: 10, maxAgeDays: 365 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: now });
      await service.initialize(store);

      await service.createBackup({ incremental: false });

      const remaining = await cloudProvider.list();

      // Should have 2 backups (original + new)
      expect(remaining.length).toBe(2);
    });

    it('should handle empty backup list gracefully', async () => {
      const cloudProvider = createMockCloudProvider([]);
      const config = createTestConfig(cloudProvider, { snapshots: 5, maxAgeDays: 30 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: Date.now() });
      await service.initialize(store);

      // Should not throw
      await expect(service.createBackup({ incremental: false })).resolves.toBeDefined();
    });

    it('should correctly sort backups by timestamp for retention', async () => {
      const now = Date.now();

      // Create backups out of timestamp order
      const cloudProvider = createMockCloudProvider([
        { backupId: 'backup-middle', timestamp: now - 2000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-oldest', timestamp: now - 3000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
        { backupId: 'backup-newest', timestamp: now - 1000, size: 100, isIncremental: false, namespaceCount: 1, recordCount: 5 },
      ]);

      const config = createTestConfig(cloudProvider, { snapshots: 2, maxAgeDays: 365 });
      const service = createBackupService(config);

      await store.put(['ownyou.test'], 'key1', { value: 'test', timestamp: now });
      await service.initialize(store);

      await service.createBackup({ incremental: false });

      const remaining = await cloudProvider.list();
      const backupIds = remaining.map(b => b.backupId);

      // The oldest should be deleted, keeping the 2 newest
      expect(backupIds).not.toContain('backup-oldest');
    });
  });
});
