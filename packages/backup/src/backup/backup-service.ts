/**
 * Backup Service - v13 Section 5.4
 *
 * Orchestrates E2EE cloud backup operations.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.4
 */

import type {
  BackupConfig,
  BackupResult,
  BackupManifest,
  BackupStatus,
  BackupHistoryEntry,
  CloudProvider,
  Store,
} from '../types.js';
import { DEFAULT_BACKUP_CONFIG, DEFAULT_BACKUP_POLICY } from '../types.js';
import { getSyncableNamespaces } from '@ownyou/sync';

/**
 * Backup service configuration
 */
export interface BackupServiceConfig {
  /** Backup configuration */
  backupConfig: BackupConfig;
  /** Cloud provider implementation */
  cloudProvider: CloudProvider;
  /** Encryption key for backup */
  encryptionKey: CryptoKey;
  /** Device ID */
  deviceId: string;
  /** Wallet address */
  walletAddress: string;
}

/**
 * Internal backup service state
 */
interface BackupServiceState {
  store: Store | null;
  status: BackupStatus;
  lastManifest: BackupManifest | null;
}

/**
 * Create a backup service instance
 */
export function createBackupService(config: BackupServiceConfig) {
  const state: BackupServiceState = {
    store: null,
    status: {
      lastBackupTime: null,
      lastBackupId: null,
      backupCount: 0,
      storageUsed: 0,
      state: 'idle',
    },
    lastManifest: null,
  };

  /**
   * Initialize the backup service with a store
   */
  async function initialize(store: Store): Promise<void> {
    state.store = store;

    // Load backup history
    try {
      const history = await config.cloudProvider.list();
      state.status.backupCount = history.length;

      if (history.length > 0) {
        const latest = history.sort((a, b) => b.timestamp - a.timestamp)[0];
        state.status.lastBackupTime = latest.timestamp;
        state.status.lastBackupId = latest.backupId;
      }

      const usage = await config.cloudProvider.getStorageUsage();
      state.status.storageUsed = usage.used;
    } catch {
      // Fresh start - no existing backups
    }
  }

  /**
   * Create a backup
   */
  async function createBackup(options: { incremental?: boolean } = {}): Promise<BackupResult> {
    const { incremental = true } = options;

    if (!state.store) {
      throw new Error('Backup service not initialized');
    }

    if (state.status.state === 'backing_up') {
      throw new Error('Backup already in progress');
    }

    state.status.state = 'backing_up';

    try {
      // 1. Collect data from syncable namespaces
      const data = await collectBackupData(incremental);

      // 2. Create manifest
      const backupId = generateBackupId();
      const manifest = createManifest(backupId, data, incremental);

      // 3. Serialize and compress
      const serialized = serializeBackupData(data);
      const compressed = await compress(serialized);

      // 4. Encrypt
      const encrypted = await encrypt(compressed, config.encryptionKey);

      // 5. Calculate checksum
      const checksum = await calculateChecksum(encrypted);
      manifest.checksum = checksum;

      // 6. Upload
      await config.cloudProvider.upload(backupId, encrypted, manifest);

      // 7. Update status
      state.status.lastBackupTime = Date.now();
      state.status.lastBackupId = backupId;
      state.status.backupCount++;
      state.status.storageUsed += encrypted.byteLength;
      state.status.state = 'idle';
      state.lastManifest = manifest;

      // 8. Cleanup old backups
      await cleanupOldBackups();

      return {
        backupId,
        timestamp: manifest.createdAt,
        size: encrypted.byteLength,
        namespaces: manifest.namespaces,
        isIncremental: incremental,
        checksum,
      };
    } catch (err) {
      state.status.state = 'error';
      state.status.error = err instanceof Error ? err.message : 'Unknown backup error';
      throw err;
    }
  }

  /**
   * Restore from a backup
   */
  async function restore(backupId: string): Promise<{ success: boolean; recordCount: number; restoredNamespaces: string[] }> {
    if (!state.store) {
      throw new Error('Backup service not initialized');
    }

    if (state.status.state === 'restoring') {
      throw new Error('Restore already in progress');
    }

    state.status.state = 'restoring';

    try {
      // 1. Download encrypted backup
      const { data: encrypted, manifest } = await config.cloudProvider.download(backupId);

      // 2. Verify checksum
      const checksum = await calculateChecksum(encrypted);
      if (checksum !== manifest.checksum) {
        throw new Error('Backup integrity check failed');
      }

      // 3. Decrypt
      const compressed = await decrypt(encrypted, config.encryptionKey);

      // 4. Decompress
      const serialized = await decompress(compressed);

      // 5. Deserialize
      const data = deserializeBackupData(serialized);

      // 6. Restore to store
      let recordCount = 0;
      const restoredNamespaces: string[] = [];

      for (const [namespace, records] of Object.entries(data)) {
        restoredNamespaces.push(namespace);

        for (const record of records as Array<{ key: string; value: unknown }>) {
          await state.store.put([namespace], record.key, record.value);
          recordCount++;
        }
      }

      state.status.state = 'idle';

      return {
        success: true,
        recordCount,
        restoredNamespaces,
      };
    } catch (err) {
      state.status.state = 'error';
      state.status.error = err instanceof Error ? err.message : 'Unknown restore error';
      throw err;
    }
  }

  /**
   * Collect data for backup
   */
  async function collectBackupData(
    incremental: boolean
  ): Promise<Record<string, Array<{ key: string; value: unknown }>>> {
    const data: Record<string, Array<{ key: string; value: unknown }>> = {};
    const namespaces = getSyncableNamespaces();

    for (const namespace of namespaces) {
      try {
        const records = await state.store!.list([namespace]);

        if (incremental && state.lastManifest) {
          // Filter to only records updated since last backup
          const lastBackupTime = state.lastManifest.createdAt;
          const newRecords = records.filter((r) => {
            const timestamp = (r.value as Record<string, unknown>)?.timestamp as number;
            return !timestamp || timestamp > lastBackupTime;
          });

          if (newRecords.length > 0) {
            data[namespace] = newRecords;
          }
        } else {
          if (records.length > 0) {
            data[namespace] = records;
          }
        }
      } catch {
        // Skip namespaces that don't exist
      }
    }

    return data;
  }

  /**
   * Create backup manifest
   */
  function createManifest(
    backupId: string,
    data: Record<string, Array<{ key: string; value: unknown }>>,
    incremental: boolean
  ): BackupManifest {
    const recordCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (const [namespace, records] of Object.entries(data)) {
      recordCounts[namespace] = records.length;
      totalRecords += records.length;
    }

    const serialized = JSON.stringify(data);
    const uncompressedSize = new TextEncoder().encode(serialized).byteLength;

    return {
      version: 1,
      backupId,
      createdAt: Date.now(),
      deviceId: config.deviceId,
      walletAddress: config.walletAddress,
      namespaces: Object.keys(data),
      recordCounts,
      uncompressedSize,
      compressedSize: 0, // Set after compression
      isIncremental: incremental,
      parentBackupId: incremental ? state.lastManifest?.backupId : undefined,
      checksum: '', // Set after encryption
    };
  }

  /**
   * Cleanup old backups based on retention policy
   */
  async function cleanupOldBackups(): Promise<void> {
    const policy = config.backupConfig.policy;
    const history = await config.cloudProvider.list();

    if (history.length <= policy.retention.snapshots) {
      return;
    }

    // Sort by timestamp descending
    const sorted = history.sort((a, b) => b.timestamp - a.timestamp);

    // Delete backups beyond retention limit
    const toDelete = sorted.slice(policy.retention.snapshots);

    // Also delete backups older than maxAgeDays
    const cutoff = Date.now() - policy.retention.maxAgeDays * 24 * 60 * 60 * 1000;

    for (const backup of toDelete) {
      if (backup.timestamp < cutoff) {
        await config.cloudProvider.delete(backup.backupId);
        state.status.backupCount--;
      }
    }
  }

  /**
   * Get backup status
   */
  function getStatus(): BackupStatus {
    return { ...state.status };
  }

  /**
   * Get backup history
   */
  async function getHistory(): Promise<BackupHistoryEntry[]> {
    return config.cloudProvider.list();
  }

  return {
    initialize,
    createBackup,
    restore,
    getStatus,
    getHistory,
  };
}

// Helper functions

function generateBackupId(): string {
  return `backup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function serializeBackupData(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}

function deserializeBackupData(data: Uint8Array): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(data));
}

async function compress(data: Uint8Array): Promise<Uint8Array> {
  // Use CompressionStream if available (modern browsers)
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();

    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  // Fallback: no compression
  return data;
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
  // Use DecompressionStream if available
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  // Fallback: assume not compressed
  return data;
}

async function encrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  return result;
}

async function decrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(decrypted);
}

async function calculateChecksum(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
