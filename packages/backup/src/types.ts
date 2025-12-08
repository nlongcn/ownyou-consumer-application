/**
 * Backup Types - v13 Section 5.4
 *
 * Types for E2EE cloud backup system.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.4
 */

/**
 * Cloud storage provider types
 */
export type BackupProvider = 'ownyou' | 's3' | 'gcs' | 'azure';

/**
 * Encrypted credentials for self-hosted storage
 */
export interface EncryptedCredentials {
  /** Encrypted access key */
  encryptedAccessKey: Uint8Array;
  /** Encrypted secret key */
  encryptedSecretKey: Uint8Array;
  /** IV used for encryption */
  iv: Uint8Array;
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  /** Storage provider */
  provider: BackupProvider;

  /** OwnYou managed storage (default) */
  ownyouCloud?: {
    endpoint: string;
  };

  /** Self-hosted storage (power users) */
  selfHosted?: {
    credentials: EncryptedCredentials;
    bucket: string;
    region: string;
  };

  /** Backup policy */
  policy: BackupPolicy;
}

/**
 * Backup policy configuration
 */
export interface BackupPolicy {
  /** Backup frequency by namespace category */
  frequency: {
    /** Namespaces backed up immediately */
    realtime: string[];
    /** Namespaces backed up hourly */
    hourly: string[];
    /** Namespaces backed up daily */
    daily: string[];
  };

  /** Backup retention settings */
  retention: {
    /** Number of daily snapshots to keep */
    snapshots: number;
    /** Maximum age in days before deletion */
    maxAgeDays: number;
  };

  /** Backup triggers */
  triggers: {
    /** Background sync when online */
    automatic: boolean;
    /** Force backup before signing out */
    beforeLogout: boolean;
    /** User can trigger anytime */
    manual: boolean;
  };

  /** Optimization settings */
  optimization: {
    /** Compression algorithm */
    compression: 'gzip' | 'none';
    /** Enable content deduplication */
    deduplication: boolean;
    /** Enable incremental/delta sync */
    deltaSync: boolean;
  };
}

/**
 * Default backup policy
 */
export const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  frequency: {
    realtime: ['ownyou.earnings', 'ownyou.missions.completions'],
    hourly: ['ownyou.iab', 'ownyou.ikigai'],
    daily: ['ownyou.preferences', 'ownyou.semantic', 'ownyou.episodic'],
  },
  retention: {
    snapshots: 7,
    maxAgeDays: 90,
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

/**
 * Default backup configuration
 */
export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  provider: 'ownyou',
  ownyouCloud: {
    endpoint: 'https://backup.ownyou.app/v1',
  },
  policy: DEFAULT_BACKUP_POLICY,
};

/**
 * Backup result
 */
export interface BackupResult {
  /** Unique backup identifier */
  backupId: string;
  /** Backup timestamp */
  timestamp: number;
  /** Backup size in bytes */
  size: number;
  /** Namespaces included in backup */
  namespaces: string[];
  /** Whether this is an incremental backup */
  isIncremental: boolean;
  /** Checksum for integrity verification */
  checksum: string;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Whether recovery succeeded */
  success: boolean;
  /** Namespaces that were restored */
  restoredNamespaces: string[];
  /** Number of records restored */
  recordCount: number;
  /** Recovery timestamp */
  timestamp: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Backup manifest (stored with each backup)
 */
export interface BackupManifest {
  /** Schema version */
  version: number;
  /** Backup ID */
  backupId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Device that created the backup */
  deviceId: string;
  /** Wallet address (user identity) */
  walletAddress: string;
  /** Included namespaces */
  namespaces: string[];
  /** Record counts per namespace */
  recordCounts: Record<string, number>;
  /** Total uncompressed size */
  uncompressedSize: number;
  /** Total compressed size */
  compressedSize: number;
  /** Is incremental */
  isIncremental: boolean;
  /** Parent backup ID (for incremental) */
  parentBackupId?: string;
  /** SHA-256 checksum of encrypted payload */
  checksum: string;
}

/**
 * Backup status
 */
export interface BackupStatus {
  /** Last successful backup timestamp */
  lastBackupTime: number | null;
  /** Last successful backup ID */
  lastBackupId: string | null;
  /** Number of backups stored */
  backupCount: number;
  /** Total storage used (bytes) */
  storageUsed: number;
  /** Current backup state */
  state: 'idle' | 'backing_up' | 'restoring' | 'error';
  /** Error message if state is error */
  error?: string;
}

/**
 * Backup history entry
 */
export interface BackupHistoryEntry {
  /** Backup ID */
  backupId: string;
  /** Creation timestamp */
  timestamp: number;
  /** Size in bytes */
  size: number;
  /** Whether incremental */
  isIncremental: boolean;
  /** Namespace count */
  namespaceCount: number;
  /** Record count */
  recordCount: number;
}

/**
 * Cloud provider interface
 */
export interface CloudProvider {
  /** Upload encrypted backup */
  upload(backupId: string, data: Uint8Array, manifest: BackupManifest): Promise<void>;
  /** Download encrypted backup */
  download(backupId: string): Promise<{ data: Uint8Array; manifest: BackupManifest }>;
  /** List all backups */
  list(): Promise<BackupHistoryEntry[]>;
  /** Delete a backup */
  delete(backupId: string): Promise<void>;
  /** Get storage usage */
  getStorageUsage(): Promise<{ used: number; limit: number }>;
}

/**
 * Store interface (abstracted to avoid circular dependency)
 */
export interface Store {
  get(namespace: readonly string[], key: string): Promise<unknown>;
  put(namespace: readonly string[], key: string, value: unknown): Promise<void>;
  delete(namespace: readonly string[], key: string): Promise<void>;
  list(namespace: readonly string[]): Promise<Array<{ key: string; value: unknown }>>;
}
