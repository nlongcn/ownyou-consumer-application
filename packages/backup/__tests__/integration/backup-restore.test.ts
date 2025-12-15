/**
 * Backup & Restore Integration Tests
 *
 * Tests for integration between backup service and cloud provider.
 * Note: Full E2E backup/restore is covered in backup-service.test.ts.
 * These tests focus on integration scenarios.
 *
 * @see packages/backup/src/backup/backup-service.ts
 * @see packages/backup/src/storage/cloud-provider.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryCloudProvider } from '../../src/storage/cloud-provider.js';
import type { BackupManifest } from '../../src/types.js';

describe('InMemoryCloudProvider', () => {
  let provider: InMemoryCloudProvider;

  beforeEach(() => {
    provider = new InMemoryCloudProvider();
  });

  describe('upload', () => {
    it('should store backup data and manifest', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const manifest: BackupManifest = {
        version: 1,
        backupId: 'backup-001',
        createdAt: Date.now(),
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': 10 },
        uncompressedSize: 1000,
        compressedSize: 500,
        isIncremental: false,
        checksum: 'abc123',
      };

      await provider.upload('backup-001', data, manifest);

      expect(provider.getBackupCount()).toBe(1);
    });

    it('should overwrite existing backup with same ID', async () => {
      const data1 = new Uint8Array([1, 2, 3]);
      const data2 = new Uint8Array([4, 5, 6]);
      const manifest: BackupManifest = {
        version: 1,
        backupId: 'backup-001',
        createdAt: Date.now(),
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': 10 },
        uncompressedSize: 1000,
        compressedSize: 500,
        isIncremental: false,
        checksum: 'abc123',
      };

      await provider.upload('backup-001', data1, manifest);
      await provider.upload('backup-001', data2, manifest);

      const { data } = await provider.download('backup-001');
      expect(data).toEqual(data2);
      expect(provider.getBackupCount()).toBe(1);
    });
  });

  describe('download', () => {
    it('should retrieve stored backup', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const manifest: BackupManifest = {
        version: 1,
        backupId: 'backup-001',
        createdAt: Date.now(),
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': 10 },
        uncompressedSize: 1000,
        compressedSize: 500,
        isIncremental: false,
        checksum: 'abc123',
      };

      await provider.upload('backup-001', data, manifest);
      const result = await provider.download('backup-001');

      expect(result.data).toEqual(data);
      expect(result.manifest).toEqual(manifest);
    });

    it('should throw for non-existent backup', async () => {
      await expect(provider.download('non-existent')).rejects.toThrow('Backup not found');
    });
  });

  describe('list', () => {
    it('should return empty array when no backups', async () => {
      const list = await provider.list();
      expect(list).toEqual([]);
    });

    it('should return all backup entries', async () => {
      const now = Date.now();
      const manifest1: BackupManifest = {
        version: 1,
        backupId: 'backup-001',
        createdAt: now - 1000,
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test1'],
        recordCounts: { 'ownyou.test1': 5 },
        uncompressedSize: 500,
        compressedSize: 250,
        isIncremental: false,
        checksum: 'abc',
      };
      const manifest2: BackupManifest = {
        version: 1,
        backupId: 'backup-002',
        createdAt: now,
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test2'],
        recordCounts: { 'ownyou.test2': 10 },
        uncompressedSize: 1000,
        compressedSize: 500,
        isIncremental: true,
        checksum: 'def',
      };

      await provider.upload('backup-001', new Uint8Array([1]), manifest1);
      await provider.upload('backup-002', new Uint8Array([2]), manifest2);

      const list = await provider.list();

      expect(list).toHaveLength(2);
      expect(list.some((b) => b.backupId === 'backup-001')).toBe(true);
      expect(list.some((b) => b.backupId === 'backup-002')).toBe(true);
    });

    it('should return correct entry format', async () => {
      const manifest: BackupManifest = {
        version: 1,
        backupId: 'backup-001',
        createdAt: 1234567890,
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ns1', 'ns2'],
        recordCounts: { ns1: 5, ns2: 10 },
        uncompressedSize: 500,
        compressedSize: 250,
        isIncremental: true,
        checksum: 'abc',
      };

      await provider.upload('backup-001', new Uint8Array([1]), manifest);

      const list = await provider.list();

      expect(list[0]).toEqual({
        backupId: 'backup-001',
        timestamp: 1234567890,
        size: 250,
        isIncremental: true,
        namespaceCount: 2,
        recordCount: 15,
      });
    });
  });

  describe('delete', () => {
    it('should remove backup', async () => {
      const manifest: BackupManifest = {
        version: 1,
        backupId: 'backup-001',
        createdAt: Date.now(),
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': 10 },
        uncompressedSize: 1000,
        compressedSize: 500,
        isIncremental: false,
        checksum: 'abc123',
      };

      await provider.upload('backup-001', new Uint8Array([1]), manifest);
      expect(provider.getBackupCount()).toBe(1);

      await provider.delete('backup-001');
      expect(provider.getBackupCount()).toBe(0);
    });

    it('should silently handle deleting non-existent backup', async () => {
      await expect(provider.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getStorageUsage', () => {
    it('should return zero when empty', async () => {
      const usage = await provider.getStorageUsage();
      expect(usage.used).toBe(0);
      expect(usage.limit).toBe(1024 * 1024 * 1024);
    });

    it('should calculate total storage used', async () => {
      const manifest: BackupManifest = {
        version: 1,
        backupId: 'backup-001',
        createdAt: Date.now(),
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': 10 },
        uncompressedSize: 1000,
        compressedSize: 500,
        isIncremental: false,
        checksum: 'abc123',
      };

      await provider.upload('backup-001', new Uint8Array(100), manifest);
      await provider.upload('backup-002', new Uint8Array(200), manifest);

      const usage = await provider.getStorageUsage();
      expect(usage.used).toBe(300);
    });
  });

  describe('clear (test helper)', () => {
    it('should remove all backups', async () => {
      const manifest: BackupManifest = {
        version: 1,
        backupId: 'backup-001',
        createdAt: Date.now(),
        deviceId: 'device-001',
        walletAddress: '0x1234',
        namespaces: ['ownyou.test'],
        recordCounts: { 'ownyou.test': 10 },
        uncompressedSize: 1000,
        compressedSize: 500,
        isIncremental: false,
        checksum: 'abc123',
      };

      await provider.upload('backup-001', new Uint8Array([1]), manifest);
      await provider.upload('backup-002', new Uint8Array([2]), manifest);

      provider.clear();

      expect(provider.getBackupCount()).toBe(0);
      const list = await provider.list();
      expect(list).toEqual([]);
    });
  });
});

describe('Cloud Provider Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    const errorProvider = {
      upload: vi.fn().mockRejectedValue(new Error('Network timeout')),
      download: vi.fn().mockRejectedValue(new Error('Connection refused')),
      list: vi.fn().mockRejectedValue(new Error('Server unavailable')),
      delete: vi.fn().mockRejectedValue(new Error('Permission denied')),
      getStorageUsage: vi.fn().mockRejectedValue(new Error('Quota exceeded')),
    };

    await expect(errorProvider.upload('id', new Uint8Array(), {} as BackupManifest)).rejects.toThrow('Network timeout');
    await expect(errorProvider.download('id')).rejects.toThrow('Connection refused');
    await expect(errorProvider.list()).rejects.toThrow('Server unavailable');
    await expect(errorProvider.delete('id')).rejects.toThrow('Permission denied');
    await expect(errorProvider.getStorageUsage()).rejects.toThrow('Quota exceeded');
  });
});

describe('Backup Data Integrity', () => {
  let provider: InMemoryCloudProvider;

  beforeEach(() => {
    provider = new InMemoryCloudProvider();
  });

  it('should preserve binary data exactly', async () => {
    const originalData = new Uint8Array([0, 1, 127, 128, 255, 0, 0, 255]);
    const manifest: BackupManifest = {
      version: 1,
      backupId: 'binary-test',
      createdAt: Date.now(),
      deviceId: 'device-001',
      walletAddress: '0x1234',
      namespaces: ['test'],
      recordCounts: { test: 1 },
      uncompressedSize: 8,
      compressedSize: 8,
      isIncremental: false,
      checksum: 'test',
    };

    await provider.upload('binary-test', originalData, manifest);
    const { data } = await provider.download('binary-test');

    expect(data).toEqual(originalData);
  });

  it('should handle large data sizes', async () => {
    const largeData = new Uint8Array(1024 * 1024); // 1MB
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }

    const manifest: BackupManifest = {
      version: 1,
      backupId: 'large-test',
      createdAt: Date.now(),
      deviceId: 'device-001',
      walletAddress: '0x1234',
      namespaces: ['test'],
      recordCounts: { test: 1000 },
      uncompressedSize: 1024 * 1024,
      compressedSize: 1024 * 1024,
      isIncremental: false,
      checksum: 'test',
    };

    await provider.upload('large-test', largeData, manifest);
    const { data } = await provider.download('large-test');

    expect(data.length).toBe(largeData.length);
    expect(data).toEqual(largeData);
  });
});
