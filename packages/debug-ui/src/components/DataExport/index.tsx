/**
 * Data Export Components - v13 Section 10.6
 *
 * UI components for GDPR-compliant data export and deletion.
 */
import React, { useState, useCallback } from 'react';
import { DataExporter } from '@ownyou/observability';
import type { DataExportResult, DataDeletionResult } from '@ownyou/observability';
import type { ExportCategory } from '../../types';

// All exportable categories
const ALL_CATEGORIES: { id: ExportCategory; label: string }[] = [
  { id: 'memories', label: 'Memories' },
  { id: 'profile', label: 'Profile' },
  { id: 'missions', label: 'Missions' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'consents', label: 'Consents' },
  { id: 'agent_traces', label: 'Agent Traces' },
  { id: 'sync_logs', label: 'Sync Logs' },
  { id: 'llm_usage', label: 'LLM Usage' },
];

// ============================================================================
// ExportOptions Component
// ============================================================================

export interface ExportOptionsProps {
  selected: ExportCategory[];
  onChange: (selected: ExportCategory[]) => void;
}

export function ExportOptions({
  selected,
  onChange,
}: ExportOptionsProps): React.ReactElement {
  const toggleCategory = (category: ExportCategory) => {
    if (selected.includes(category)) {
      onChange(selected.filter((c) => c !== category));
    } else {
      onChange([...selected, category]);
    }
  };

  const selectAll = () => {
    onChange(ALL_CATEGORIES.map((c) => c.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="export-options" data-testid="export-options">
      <div className="options-header">
        <h4>Select Data to Export</h4>
        <div className="quick-actions">
          <button onClick={selectAll} className="select-all" aria-label="Select all categories">
            Select All
          </button>
          <button onClick={clearAll} className="clear-all" aria-label="Clear selection">
            Clear
          </button>
        </div>
      </div>

      <div className="category-list">
        {ALL_CATEGORIES.map((category) => (
          <label key={category.id} className="category-item">
            <input
              type="checkbox"
              checked={selected.includes(category.id)}
              onChange={() => toggleCategory(category.id)}
              aria-label={category.label}
            />
            <span>{category.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DeleteDataModal Component
// ============================================================================

export interface DeleteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteDataModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteDataModalProps): React.ReactElement | null {
  const [confirmationText, setConfirmationText] = useState('');
  const REQUIRED_TEXT = 'DELETE MY DATA';

  const isConfirmEnabled = confirmationText.toUpperCase() === REQUIRED_TEXT;

  const handleConfirm = () => {
    if (isConfirmEnabled) {
      onConfirm();
      setConfirmationText('');
    }
  };

  const handleClose = () => {
    setConfirmationText('');
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" data-testid="delete-modal">
      <div className="modal-content">
        <h2>Delete All Data</h2>

        <div className="warning-section">
          <span className="warning-icon">⚠️</span>
          <p>
            This action is <strong>irreversible</strong>. All your personal data will be
            permanently deleted in compliance with GDPR Article 17 (Right to Erasure).
          </p>
        </div>

        <div className="data-list">
          <p>The following data will be deleted:</p>
          <ul>
            {ALL_CATEGORIES.map((cat) => (
              <li key={cat.id}>{cat.label}</li>
            ))}
          </ul>
        </div>

        <div className="confirmation-section">
          <label htmlFor="confirm-input">
            Type <strong>{REQUIRED_TEXT}</strong> to confirm:
          </label>
          <input
            id="confirm-input"
            type="text"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="DELETE MY DATA"
          />
        </div>

        <div className="modal-actions">
          <button onClick={handleClose} className="cancel-button" aria-label="Cancel deletion">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="confirm-button"
            disabled={!isConfirmEnabled}
            aria-label="Confirm deletion"
          >
            Confirm Deletion
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DataExport Main Component
// ============================================================================

export interface DataExportProps {
  userId: string;
  className?: string;
  onExportComplete?: (result: DataExportResult) => void;
  onDeleteComplete?: (result: DataDeletionResult) => void;
}

export function DataExport({
  userId,
  className,
  onExportComplete,
  onDeleteComplete,
}: DataExportProps): React.ReactElement {
  const [selectedCategories, setSelectedCategories] = useState<ExportCategory[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (selectedCategories.length === 0) return;

    setIsExporting(true);
    try {
      const exporter = new DataExporter(userId);
      const result = exporter.generateExport();

      // Download the JSON
      const json = exporter.toJSON(result);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ownyou-export-${userId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      onExportComplete?.(result);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [userId, selectedCategories, onExportComplete]);

  const handleDelete = useCallback(async () => {
    try {
      const exporter = new DataExporter(userId);
      const result = exporter.generateDeletionConfirmation();

      setIsDeleteModalOpen(false);
      onDeleteComplete?.(result);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, [userId, onDeleteComplete]);

  return (
    <div className={`data-export ${className ?? ''}`} data-testid="data-export">
      <h2>Data Export</h2>
      <p className="user-id">User: {userId}</p>

      <div className="gdpr-notice">
        <span className="notice-icon">🛡️</span>
        <p>
          Under GDPR, you have the right to access and download your personal data,
          as well as the right to request deletion of all your data.
        </p>
      </div>

      <div className="export-section">
        <h3>Export Your Data</h3>
        <ExportOptions selected={selectedCategories} onChange={setSelectedCategories} />

        <div className="export-actions">
          <button
            onClick={handleExport}
            disabled={selectedCategories.length === 0 || isExporting}
            className="download-button"
            aria-label="Download selected data"
          >
            {isExporting ? 'Exporting...' : 'Download Export'}
          </button>
        </div>
      </div>

      <div className="delete-section">
        <h3>Delete Your Data</h3>
        <p className="delete-warning">
          This action is permanent and cannot be undone. All your personal data
          will be permanently removed.
        </p>
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="delete-button"
          aria-label="Delete all data"
        >
          Delete All Data
        </button>
      </div>

      <DeleteDataModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default DataExport;
