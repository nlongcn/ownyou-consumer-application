/**
 * Data Exporter Tests - v13 Section 10.6
 *
 * Tests for GDPR-compliant data export and deletion.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DataExporter,
  type DataExportResult,
  type DataDeletionResult,
  type ExportableNamespace,
} from '../export';

describe('DataExporter (v13 Section 10.6)', () => {
  let exporter: DataExporter;
  const userId = 'user_123';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    exporter = new DataExporter(userId);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GDPR Right to Access (Data Export)', () => {
    it('should generate export metadata', () => {
      const result = exporter.generateExport();

      expect(result.exportId).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.requestedAt).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should include all exportable namespaces', () => {
      const result = exporter.generateExport();

      expect(result.namespaces).toBeDefined();
      expect(result.namespaces.length).toBeGreaterThan(0);
    });

    it('should format export as JSON', () => {
      const result = exporter.generateExport();
      const json = exporter.toJSON(result);

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.userId).toBe(userId);
    });

    it('should include export metadata', () => {
      const result = exporter.generateExport();

      expect(result.metadata).toBeDefined();
      expect(result.metadata.format).toBe('json');
      expect(result.metadata.version).toBe('1.0');
      expect(result.metadata.gdprCompliant).toBe(true);
    });
  });

  describe('GDPR Right to be Forgotten (Data Deletion)', () => {
    it('should generate deletion confirmation', () => {
      const result = exporter.generateDeletionConfirmation();

      expect(result.deletionId).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.requestedAt).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should list deleted namespaces', () => {
      const result = exporter.generateDeletionConfirmation();

      expect(result.deletedNamespaces).toBeDefined();
      expect(result.deletedNamespaces.length).toBeGreaterThan(0);
    });

    it('should include audit trail', () => {
      const result = exporter.generateDeletionConfirmation();

      expect(result.auditTrail).toBeDefined();
      expect(result.auditTrail.deletedAt).toBeDefined();
      expect(result.auditTrail.method).toBe('complete_deletion');
      expect(result.auditTrail.verifiedBy).toBe('system');
    });

    it('should provide legal acknowledgment text', () => {
      const result = exporter.generateDeletionConfirmation();

      expect(result.legalAcknowledgment).toBeDefined();
      expect(result.legalAcknowledgment).toContain('GDPR');
    });
  });

  describe('Exportable Namespaces', () => {
    it('should define exportable namespaces', () => {
      const namespaces = exporter.getExportableNamespaces();

      expect(namespaces.length).toBeGreaterThan(0);
      expect(namespaces).toContain('ownyou.semantic');
      expect(namespaces).toContain('ownyou.episodic');
      expect(namespaces).toContain('ownyou.ikigai');
    });

    it('should not include debug namespaces in user export', () => {
      const namespaces = exporter.getExportableNamespaces();

      expect(namespaces).not.toContain('ownyou.debug.traces');
      expect(namespaces).not.toContain('ownyou.debug.sync');
    });

    it('should not include system-only namespaces', () => {
      const namespaces = exporter.getExportableNamespaces();

      expect(namespaces).not.toContain('ownyou.llm_usage');
    });
  });

  describe('Data Integrity', () => {
    it('should generate checksum for export', () => {
      const result = exporter.generateExport();

      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe('string');
    });

    it('should verify checksum', () => {
      const result = exporter.generateExport();
      const isValid = exporter.verifyChecksum(result);

      expect(isValid).toBe(true);
    });

    it('should detect tampered export', () => {
      const result = exporter.generateExport();
      result.userId = 'tampered_user';

      const isValid = exporter.verifyChecksum(result);

      expect(isValid).toBe(false);
    });
  });

  describe('Export Filtering', () => {
    it('should allow filtering by namespace', () => {
      const result = exporter.generateExport({
        namespaces: ['ownyou.semantic', 'ownyou.episodic'],
      });

      expect(result.namespaces.length).toBe(2);
      expect(result.namespaces).toContain('ownyou.semantic');
    });

    it('should allow filtering by date range', () => {
      const startDate = new Date('2024-01-01T00:00:00Z').getTime();
      const endDate = new Date('2024-01-10T23:59:59Z').getTime();

      const result = exporter.generateExport({
        dateRange: { start: startDate, end: endDate },
      });

      expect(result.filters).toBeDefined();
      expect(result.filters?.dateRange).toBeDefined();
    });
  });

  describe('Export Format Options', () => {
    it('should support JSON format by default', () => {
      const result = exporter.generateExport();

      expect(result.metadata.format).toBe('json');
    });

    it('should include schema version', () => {
      const result = exporter.generateExport();

      expect(result.metadata.schemaVersion).toBeDefined();
    });
  });
});
