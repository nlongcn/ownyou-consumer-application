/**
 * Data Export Tests - v13 Section 10.6
 *
 * Tests for the Data Export UI component (GDPR compliance).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  DataExport,
  ExportOptions,
  DeleteDataModal,
} from '../components/DataExport';

describe('DataExport (v13 Section 10.6)', () => {
  describe('ExportOptions', () => {
    it('should render category checkboxes', () => {
      render(<ExportOptions selected={[]} onChange={() => {}} />);

      expect(screen.getByLabelText(/memories/i)).toBeDefined();
      expect(screen.getByLabelText(/profile/i)).toBeDefined();
      expect(screen.getByLabelText(/missions/i)).toBeDefined();
    });

    it('should show all exportable categories', () => {
      render(<ExportOptions selected={[]} onChange={() => {}} />);

      expect(screen.getByLabelText(/preferences/i)).toBeDefined();
      expect(screen.getByLabelText(/earnings/i)).toBeDefined();
      expect(screen.getByLabelText(/agent traces/i)).toBeDefined();
    });

    it('should call onChange when checkbox toggled', () => {
      const onChange = vi.fn();
      render(<ExportOptions selected={[]} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText(/memories/i));

      expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['memories']));
    });

    it('should show selected options as checked', () => {
      render(<ExportOptions selected={['memories', 'profile']} onChange={() => {}} />);

      expect(screen.getByLabelText(/memories/i)).toBeChecked();
      expect(screen.getByLabelText(/profile/i)).toBeChecked();
    });

    it('should have "select all" option', () => {
      const onChange = vi.fn();
      render(<ExportOptions selected={[]} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: /select all/i }));

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('DeleteDataModal', () => {
    it('should not render when closed', () => {
      render(
        <DeleteDataModal
          isOpen={false}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      expect(screen.queryByText(/delete all data/i)).toBeNull();
    });

    it('should render when open', () => {
      render(
        <DeleteDataModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      expect(screen.getByText(/delete all data/i)).toBeDefined();
    });

    it('should show warning message', () => {
      render(
        <DeleteDataModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      expect(screen.getByText(/irreversible/i)).toBeDefined();
    });

    it('should require confirmation text', () => {
      render(
        <DeleteDataModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      expect(screen.getByPlaceholderText(/delete my data/i)).toBeDefined();
    });

    it('should disable confirm button until confirmation typed', () => {
      render(
        <DeleteDataModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });
      expect(confirmButton).toBeDisabled();
    });

    it('should enable confirm button when correct text typed', () => {
      render(
        <DeleteDataModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/delete my data/i), {
        target: { value: 'DELETE MY DATA' },
      });

      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });
      expect(confirmButton).not.toBeDisabled();
    });

    it('should call onConfirm when confirmed', () => {
      const onConfirm = vi.fn();
      render(
        <DeleteDataModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={onConfirm}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/delete my data/i), {
        target: { value: 'DELETE MY DATA' },
      });
      fireEvent.click(screen.getByRole('button', { name: /confirm deletion/i }));

      expect(onConfirm).toHaveBeenCalled();
    });

    it('should call onClose when cancelled', () => {
      const onClose = vi.fn();
      render(
        <DeleteDataModal
          isOpen={true}
          onClose={onClose}
          onConfirm={() => {}}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('DataExport (main component)', () => {
    it('should render export UI', () => {
      render(<DataExport userId="user_123" />);

      expect(screen.getByText(/data export/i)).toBeDefined();
    });

    it('should show GDPR notice', () => {
      render(<DataExport userId="user_123" />);

      expect(screen.getByText(/gdpr/i)).toBeDefined();
    });

    it('should have download button', () => {
      render(<DataExport userId="user_123" />);

      expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
    });

    it('should disable download when no options selected', () => {
      render(<DataExport userId="user_123" />);

      // Initially no options selected
      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeDisabled();
    });

    it('should enable download when options selected', () => {
      render(<DataExport userId="user_123" />);

      fireEvent.click(screen.getByLabelText(/memories/i));

      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).not.toBeDisabled();
    });

    it('should have delete all data button', () => {
      render(<DataExport userId="user_123" />);

      expect(screen.getByRole('button', { name: /delete all data/i })).toBeDefined();
    });

    it('should open delete modal when delete clicked', () => {
      render(<DataExport userId="user_123" />);

      fireEvent.click(screen.getByRole('button', { name: /delete all data/i }));

      expect(screen.getByText(/irreversible/i)).toBeDefined();
    });

    it('should have download button working when options selected', () => {
      render(<DataExport userId="user_123" />);

      fireEvent.click(screen.getByLabelText(/memories/i));

      // Button should be enabled and clickable
      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).not.toBeDisabled();

      // Click should not throw
      expect(() => fireEvent.click(downloadButton)).not.toThrow();
    });
  });
});
