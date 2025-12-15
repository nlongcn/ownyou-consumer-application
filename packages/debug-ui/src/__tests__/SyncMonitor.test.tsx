/**
 * Sync Monitor Tests - v13 Section 10.5.2
 *
 * Tests for the Sync Monitor UI component (placeholder for Sprint 10).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  SyncMonitor,
  ConnectionStatus,
  PendingQueue,
  ConflictResolver,
} from '../components/SyncMonitor';

describe('SyncMonitor (v13 Section 10.5.2 - Placeholder)', () => {
  describe('ConnectionStatus', () => {
    it('should show disconnected by default', () => {
      render(<ConnectionStatus status="disconnected" peerCount={0} />);

      expect(screen.getByText(/disconnected/i)).toBeDefined();
    });

    it('should show connected status', () => {
      render(<ConnectionStatus status="connected" peerCount={2} />);

      expect(screen.getByText('connected')).toBeDefined();
    });

    it('should display peer count when connected', () => {
      render(<ConnectionStatus status="connected" peerCount={3} />);

      expect(screen.getByText(/3 peers/i)).toBeDefined();
    });

    it('should show syncing status', () => {
      render(<ConnectionStatus status="syncing" peerCount={1} />);

      expect(screen.getByText(/syncing/i)).toBeDefined();
    });
  });

  describe('PendingQueue', () => {
    it('should show pending operations count', () => {
      render(<PendingQueue pendingCount={5} lastSyncTime={Date.now() - 60000} />);

      expect(screen.getByText(/5 pending/i)).toBeDefined();
    });

    it('should show last sync time', () => {
      render(<PendingQueue pendingCount={0} lastSyncTime={Date.now() - 120000} />);

      expect(screen.getByText(/2 minutes ago/i)).toBeDefined();
    });

    it('should show empty queue message', () => {
      render(<PendingQueue pendingCount={0} lastSyncTime={Date.now()} />);

      expect(screen.getByText(/no pending/i)).toBeDefined();
    });
  });

  describe('ConflictResolver', () => {
    it('should show placeholder message for Sprint 10', () => {
      render(<ConflictResolver conflicts={[]} onResolve={() => {}} />);

      expect(screen.getByText(/conflict resolution.*sprint 10/i)).toBeDefined();
    });

    it('should render without conflicts', () => {
      render(<ConflictResolver conflicts={[]} onResolve={() => {}} />);

      expect(screen.getByText(/no conflicts/i)).toBeDefined();
    });
  });

  describe('SyncMonitor (main component)', () => {
    it('should render placeholder UI', () => {
      render(<SyncMonitor userId="user_123" deviceId="device_1" />);

      expect(screen.getByText(/sync monitor/i)).toBeDefined();
    });

    it('should show "sync not yet enabled" message', () => {
      render(<SyncMonitor userId="user_123" deviceId="device_1" />);

      expect(screen.getByText(/sync not yet enabled/i)).toBeDefined();
    });

    it('should display device ID', () => {
      render(<SyncMonitor userId="user_123" deviceId="device_1" />);

      expect(screen.getByText(/device_1/i)).toBeDefined();
    });

    it('should show connection status as disconnected', () => {
      render(<SyncMonitor userId="user_123" deviceId="device_1" />);

      expect(screen.getByText(/disconnected/i)).toBeDefined();
    });

    it('should show Sprint 10 notice', () => {
      render(<SyncMonitor userId="user_123" deviceId="device_1" />);

      expect(screen.getAllByText(/sprint 10/i).length).toBeGreaterThan(0);
    });
  });
});
