/**
 * @ownyou/backup - E2EE Cloud Backup Package
 *
 * Provides disaster recovery via Signal-style E2EE cloud backup.
 *
 * @see docs/sprints/ownyou-sprint10-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.4
 */

// Types
export type {
  BackupConfig,
  BackupPolicy,
  BackupResult,
  RecoveryResult,
  BackupManifest,
  BackupStatus,
  BackupHistoryEntry,
  CloudProvider,
  Store,
  BackupProvider,
  EncryptedCredentials,
} from './types.js';

// Default configuration
export { DEFAULT_BACKUP_CONFIG, DEFAULT_BACKUP_POLICY } from './types.js';

// Backup service
export {
  createBackupService,
  type BackupServiceConfig,
} from './backup/backup-service.js';

// Cloud providers
export {
  OwnYouCloudProvider,
  InMemoryCloudProvider,
  S3CloudProvider,
} from './storage/cloud-provider.js';

// Recovery
export {
  createRecoveryFlow,
  validateWalletForRecovery,
  type RecoveryFlow,
  type RecoveryFlowState,
  type RecoveryOptions,
} from './recovery/recovery-flow.js';
