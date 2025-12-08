/**
 * Data Export Types - v13 Section 10.6
 *
 * Type definitions for GDPR-compliant data export and deletion.
 */

/**
 * Exportable namespaces (user data only)
 */
export type ExportableNamespace =
  | 'ownyou.semantic'
  | 'ownyou.episodic'
  | 'ownyou.procedural'
  | 'ownyou.entities'
  | 'ownyou.relationships'
  | 'ownyou.summaries'
  | 'ownyou.iab'
  | 'ownyou.ikigai'
  | 'ownyou.ikigai_evidence'
  | 'ownyou.missions'
  | 'ownyou.mission_feedback'
  | 'ownyou.pseudonyms'
  | 'ownyou.disclosures'
  | 'ownyou.tracking_consents'
  | 'ownyou.earnings';

/**
 * Export options
 */
export interface ExportOptions {
  namespaces?: ExportableNamespace[];
  dateRange?: {
    start: number;
    end: number;
  };
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  format: 'json';
  version: string;
  schemaVersion: string;
  gdprCompliant: boolean;
  exportedAt: number;
}

/**
 * Data export result
 */
export interface DataExportResult {
  exportId: string;
  userId: string;
  requestedAt: number;
  status: 'pending' | 'completed' | 'failed';
  namespaces: ExportableNamespace[];
  metadata: ExportMetadata;
  checksum: string;
  filters?: ExportOptions;
  data?: Record<string, unknown>;
}

/**
 * Audit trail for deletion
 */
export interface DeletionAuditTrail {
  deletedAt: number;
  method: 'complete_deletion' | 'anonymization';
  verifiedBy: 'system' | 'manual';
  retentionExemptions?: string[];
}

/**
 * Data deletion result
 */
export interface DataDeletionResult {
  deletionId: string;
  userId: string;
  requestedAt: number;
  status: 'pending' | 'completed' | 'failed';
  deletedNamespaces: ExportableNamespace[];
  auditTrail: DeletionAuditTrail;
  legalAcknowledgment: string;
}
