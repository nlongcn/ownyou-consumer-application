/**
 * Data Export Types - v13 Section 10.6
 *
 * Type definitions for GDPR-compliant data export and deletion.
 *
 * ## Export Format Support
 *
 * Currently supported formats:
 * - `json` - Full JSON export (implemented)
 *
 * Planned formats (TODO):
 * - `csv` - CSV export for tabular data (Sprint 9 spec mentions this)
 *
 * CSV export would require flattening nested structures and handling
 * multi-valued fields. Consider adding when users request tabular exports
 * for spreadsheet analysis.
 */

/**
 * Exportable namespaces (user data only)
 *
 * This list must be kept in sync with ALL_EXPORTABLE_NAMESPACES in exporter.ts
 * and NAMESPACES in @ownyou/shared-types.
 */
export type ExportableNamespace =
  // Core memory (Section 8.4)
  | 'ownyou.semantic'
  | 'ownyou.episodic'
  | 'ownyou.procedural'
  | 'ownyou.entities'
  | 'ownyou.relationships'
  | 'ownyou.summaries'
  // Classifications
  | 'ownyou.iab'
  // Ikigai (Section 2)
  | 'ownyou.ikigai'
  | 'ownyou.ikigai_evidence'
  // Missions (Section 3)
  | 'ownyou.missions'
  | 'ownyou.mission_feedback'
  // Identity (Section 7)
  | 'ownyou.pseudonyms'
  | 'ownyou.disclosures'
  | 'ownyou.tracking_consents'
  // Financial
  | 'ownyou.earnings'
  // Sprint 7: Restaurant Agent
  | 'ownyou.dining_reservations'
  | 'ownyou.restaurant_favorites'
  // Sprint 7: Events Agent
  | 'ownyou.event_tickets'
  | 'ownyou.event_favorites'
  // Sprint 7: Travel Agent
  | 'ownyou.travel_itineraries'
  | 'ownyou.travel_preferences'
  // Sprint 7: Additional namespaces
  | 'ownyou.calendar'
  | 'ownyou.financial_profile'
  | 'ownyou.interests'
  // Sprint 8: Financial Data
  | 'ownyou.financial_transactions'
  // Sprint 8: Calendar Data
  | 'ownyou.calendar_events'
  | 'ownyou.calendar_profile'
  | 'ownyou.calendar_contacts'
  // Sprint 8: Diagnostic Agent
  | 'ownyou.diagnostic_reports';

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
