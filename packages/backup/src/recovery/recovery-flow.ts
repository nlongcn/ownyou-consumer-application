/**
 * Recovery Flow - v13 Section 5.3
 *
 * Handles wallet recovery and data restoration.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.3
 */

import type {
  RecoveryResult,
  BackupHistoryEntry,
  CloudProvider,
  Store,
} from '../types.js';

/**
 * Recovery options
 */
export interface RecoveryOptions {
  /** Specific backup ID to restore (defaults to latest) */
  backupId?: string;
  /** Namespaces to restore (defaults to all) */
  namespaces?: string[];
  /** Whether to merge with existing data or replace */
  mergeStrategy: 'replace' | 'merge_prefer_backup' | 'merge_prefer_local';
}

/**
 * Recovery flow state
 */
export interface RecoveryFlowState {
  /** Current step */
  step: 'idle' | 'verifying_wallet' | 'fetching_backups' | 'downloading' | 'restoring' | 'complete' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current operation description */
  message: string;
  /** Error if step is 'error' */
  error?: string;
  /** Available backups (after fetching) */
  availableBackups?: BackupHistoryEntry[];
  /** Result (after complete) */
  result?: RecoveryResult;
}

/**
 * Recovery flow controller
 */
export interface RecoveryFlow {
  /** Get current state */
  getState(): RecoveryFlowState;
  /** Subscribe to state changes */
  subscribe(callback: (state: RecoveryFlowState) => void): () => void;
  /** Start recovery process */
  startRecovery(options?: RecoveryOptions): Promise<RecoveryResult>;
  /** Cancel recovery */
  cancel(): void;
}

/**
 * Create a recovery flow
 */
export function createRecoveryFlow(
  cloudProvider: CloudProvider,
  encryptionKey: CryptoKey,
  store: Store
): RecoveryFlow {
  let state: RecoveryFlowState = {
    step: 'idle',
    progress: 0,
    message: 'Ready',
  };

  const listeners = new Set<(state: RecoveryFlowState) => void>();
  let cancelled = false;

  function updateState(updates: Partial<RecoveryFlowState>) {
    state = { ...state, ...updates };
    for (const listener of listeners) {
      listener(state);
    }
  }

  function getState(): RecoveryFlowState {
    return { ...state };
  }

  function subscribe(callback: (state: RecoveryFlowState) => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function cancel(): void {
    cancelled = true;
    updateState({ step: 'idle', progress: 0, message: 'Cancelled' });
  }

  async function startRecovery(options: RecoveryOptions = { mergeStrategy: 'replace' }): Promise<RecoveryResult> {
    cancelled = false;

    try {
      // Step 1: Fetch available backups
      updateState({
        step: 'fetching_backups',
        progress: 10,
        message: 'Fetching available backups...',
      });

      if (cancelled) throw new Error('Recovery cancelled');

      const backups = await cloudProvider.list();
      if (backups.length === 0) {
        throw new Error('No backups found for this wallet');
      }

      updateState({
        availableBackups: backups,
        progress: 20,
      });

      // Step 2: Select backup to restore
      let targetBackupId = options.backupId;
      if (!targetBackupId) {
        // Use most recent backup
        const sorted = backups.sort((a, b) => b.timestamp - a.timestamp);
        targetBackupId = sorted[0].backupId;
      }

      // Step 3: Download backup
      updateState({
        step: 'downloading',
        progress: 30,
        message: `Downloading backup ${targetBackupId}...`,
      });

      if (cancelled) throw new Error('Recovery cancelled');

      const { data: encrypted, manifest } = await cloudProvider.download(targetBackupId);

      updateState({ progress: 50 });

      // Step 4: Verify and decrypt
      updateState({
        message: 'Verifying and decrypting...',
        progress: 60,
      });

      const checksum = await calculateChecksum(encrypted);
      if (checksum !== manifest.checksum) {
        throw new Error('Backup integrity verification failed');
      }

      const decrypted = await decrypt(encrypted, encryptionKey);
      const decompressed = await decompress(decrypted);
      const data = JSON.parse(new TextDecoder().decode(decompressed)) as Record<
        string,
        Array<{ key: string; value: unknown }>
      >;

      updateState({ progress: 70 });

      // Step 5: Restore data
      updateState({
        step: 'restoring',
        progress: 75,
        message: 'Restoring data...',
      });

      if (cancelled) throw new Error('Recovery cancelled');

      const restoredNamespaces: string[] = [];
      let recordCount = 0;

      const namespaces = options.namespaces || Object.keys(data);
      const total = namespaces.length;
      let completed = 0;

      for (const namespace of namespaces) {
        const records = data[namespace];
        if (!records) continue;

        for (const record of records) {
          if (options.mergeStrategy === 'replace') {
            await store.put([namespace], record.key, record.value);
          } else if (options.mergeStrategy === 'merge_prefer_backup') {
            // Backup wins on conflict
            await store.put([namespace], record.key, record.value);
          } else {
            // merge_prefer_local - only write if not exists
            const existing = await store.get([namespace], record.key);
            if (!existing) {
              await store.put([namespace], record.key, record.value);
            }
          }
          recordCount++;
        }

        restoredNamespaces.push(namespace);
        completed++;
        updateState({
          progress: 75 + Math.floor((completed / total) * 20),
        });
      }

      // Step 6: Complete
      const result: RecoveryResult = {
        success: true,
        restoredNamespaces,
        recordCount,
        timestamp: Date.now(),
      };

      updateState({
        step: 'complete',
        progress: 100,
        message: `Recovery complete. Restored ${recordCount} records.`,
        result,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      updateState({
        step: 'error',
        error,
        message: `Recovery failed: ${error}`,
      });

      return {
        success: false,
        restoredNamespaces: [],
        recordCount: 0,
        timestamp: Date.now(),
        error,
      };
    }
  }

  return {
    getState,
    subscribe,
    startRecovery,
    cancel,
  };
}

// Helper functions

async function decrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(decrypted);
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
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

  return data;
}

async function calculateChecksum(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate wallet can access backup
 *
 * Attempts to derive the same encryption key and verify it can decrypt backup header.
 */
export async function validateWalletForRecovery(
  cloudProvider: CloudProvider,
  encryptionKey: CryptoKey
): Promise<{ valid: boolean; backupCount: number; error?: string }> {
  try {
    const backups = await cloudProvider.list();

    if (backups.length === 0) {
      return { valid: true, backupCount: 0 };
    }

    // Try to decrypt the most recent backup to verify key
    const latest = backups.sort((a, b) => b.timestamp - a.timestamp)[0];
    const { data: encrypted, manifest } = await cloudProvider.download(latest.backupId);

    // Verify checksum first
    const checksum = await calculateChecksum(encrypted);
    if (checksum !== manifest.checksum) {
      return { valid: false, backupCount: backups.length, error: 'Backup integrity check failed' };
    }

    // Try to decrypt
    await decrypt(encrypted, encryptionKey);

    return { valid: true, backupCount: backups.length };
  } catch (err) {
    return {
      valid: false,
      backupCount: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
