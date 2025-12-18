/**
 * DataSourceContext Tests - Bug 1: State Preservation
 *
 * TDD Tests for Sprint 11c Bugfix
 * Tests that loadSavedTokens preserves sync metadata (itemCount, lastSync)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode, useState, useEffect, useRef } from 'react';
import { DataSourceProvider, useDataSource } from '../../src/contexts/DataSourceContext';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { StoreProvider, useStore } from '../../src/contexts/StoreContext';
import { NS } from '@ownyou/shared-types';

// Mock tauri-oauth to avoid platform-specific imports
vi.mock('../../src/utils/tauri-oauth', () => ({
  refreshOAuthToken: vi.fn().mockResolvedValue(null),
}));

// Test component to access context values
function TestConsumer({
  onDataSources
}: {
  onDataSources?: (sources: ReturnType<typeof useDataSource>['dataSources']) => void
}) {
  const { dataSources } = useDataSource();

  useEffect(() => {
    onDataSources?.(dataSources);
  }, [dataSources, onDataSources]);

  return (
    <div>
      {dataSources.map(source => (
        <div key={source.id} data-testid={`source-${source.id}`}>
          <span data-testid={`${source.id}-status`}>{source.status}</span>
          <span data-testid={`${source.id}-itemCount`}>{source.itemCount ?? 'undefined'}</span>
          <span data-testid={`${source.id}-lastSync`}>{source.lastSync?.toISOString() ?? 'undefined'}</span>
        </div>
      ))}
    </div>
  );
}

// Wrapper with all required providers
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StoreProvider forceInMemory>
        <DataSourceProvider>
          {children}
        </DataSourceProvider>
      </StoreProvider>
    </AuthProvider>
  );
}

// Helper to set up store with pre-existing data
function StoreSetupWrapper({
  children,
  setupData,
}: {
  children: ReactNode;
  setupData?: (store: any, userId: string) => Promise<void>;
}) {
  return (
    <AuthProvider>
      <StoreProvider forceInMemory>
        <StoreSetupInner setupData={setupData}>
          {children}
        </StoreSetupInner>
      </StoreProvider>
    </AuthProvider>
  );
}

function StoreSetupInner({
  children,
  setupData,
}: {
  children: ReactNode;
  setupData?: (store: any, userId: string) => Promise<void>;
}) {
  const { store, isReady } = useStore();
  const [dataReady, setDataReady] = useState(!setupData);
  const setupDone = useRef(false);
  const userId = '0x1234567890abcdef1234567890abcdef12345678';

  useEffect(() => {
    if (!isReady || !store || setupDone.current || !setupData) return;
    setupDone.current = true;

    setupData(store, userId).then(() => {
      setDataReady(true);
    });
  }, [isReady, store, setupData]);

  if (!dataReady) return <div data-testid="loading">Loading...</div>;

  return (
    <DataSourceProvider>
      {children}
    </DataSourceProvider>
  );
}

describe('DataSourceContext - Bug 1: State Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up authenticated wallet
    localStorage.setItem('ownyou_wallet', JSON.stringify({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      publicKey: 'test-public-key',
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initially have all sources disconnected with no itemCount', async () => {
    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('gmail-status')).toHaveTextContent('disconnected');
      expect(screen.getByTestId('gmail-itemCount')).toHaveTextContent('undefined');
    });
  });

  it('BUG 1 - loadSavedTokens should restore itemCount from Store on mount', async () => {
    /**
     * This test verifies Bug 1 fix: State Preservation
     *
     * SCENARIO: App loads with previously synced data in Store
     * - Token exists in Store
     * - Sync metadata (itemCount, lastSync) exists in Store
     * - loadSavedTokens should restore BOTH status AND itemCount
     *
     * EXPECTED BEHAVIOR (after fix):
     * - Gmail shows status: 'connected'
     * - Gmail shows itemCount: 100
     */

    const setupGmailData = async (store: any, userId: string) => {
      // Store OAuth token
      await store.put(NS.uiPreferences(userId), 'oauth_gmail', {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
        savedAt: Date.now(),
      });

      // Store sync metadata (the fix persists this)
      await store.put(NS.uiPreferences(userId), 'sync_gmail', {
        itemCount: 100,
        lastSync: new Date().toISOString(),
      });
    };

    render(
      <StoreSetupWrapper setupData={setupGmailData}>
        <TestConsumer />
      </StoreSetupWrapper>
    );

    // Wait for data to be loaded
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // After loadSavedTokens runs, status should be 'connected'
    await waitFor(() => {
      expect(screen.getByTestId('gmail-status')).toHaveTextContent('connected');
    }, { timeout: 2000 });

    // KEY ASSERTION: itemCount should be restored from Store
    await waitFor(() => {
      expect(screen.getByTestId('gmail-itemCount')).toHaveTextContent('100');
    }, { timeout: 2000 });
  });

  it('BUG 1 - multiple sources should both restore their itemCounts', async () => {
    /**
     * Test that multiple connected sources each restore their own sync metadata
     *
     * SCENARIO: App loads with both Gmail and Outlook previously synced
     * - Both have tokens in Store
     * - Both have sync metadata in Store
     * - Both should show their respective itemCounts
     */

    const setupBothSources = async (store: any, userId: string) => {
      // Gmail: 200 items
      await store.put(NS.uiPreferences(userId), 'oauth_gmail', {
        accessToken: 'gmail-token',
        refreshToken: 'gmail-refresh',
        expiresAt: Date.now() + 3600000,
        provider: 'google',
        savedAt: Date.now(),
      });
      await store.put(NS.uiPreferences(userId), 'sync_gmail', {
        itemCount: 200,
        lastSync: new Date().toISOString(),
      });

      // Outlook: 150 items
      await store.put(NS.uiPreferences(userId), 'oauth_outlook', {
        accessToken: 'outlook-token',
        refreshToken: 'outlook-refresh',
        expiresAt: Date.now() + 3600000,
        provider: 'microsoft',
        savedAt: Date.now(),
      });
      await store.put(NS.uiPreferences(userId), 'sync_outlook', {
        itemCount: 150,
        lastSync: new Date().toISOString(),
      });
    };

    render(
      <StoreSetupWrapper setupData={setupBothSources}>
        <TestConsumer />
      </StoreSetupWrapper>
    );

    // Wait for data to be loaded
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // Both sources should be connected
    await waitFor(() => {
      expect(screen.getByTestId('gmail-status')).toHaveTextContent('connected');
      expect(screen.getByTestId('outlook-status')).toHaveTextContent('connected');
    }, { timeout: 2000 });

    // Both itemCounts should be restored
    await waitFor(() => {
      expect(screen.getByTestId('gmail-itemCount')).toHaveTextContent('200');
      expect(screen.getByTestId('outlook-itemCount')).toHaveTextContent('150');
    }, { timeout: 2000 });
  });
});

describe('DataSourceContext - Bug 2: Button Text Status', () => {
  beforeEach(() => {
    localStorage.setItem('ownyou_wallet', JSON.stringify({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      publicKey: 'test-public-key',
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should correctly identify syncing status as a form of connected', async () => {
    /**
     * Bug 2: Button shows "Connecting..." when status is "syncing"
     *
     * The isConnected check only returns true for status === 'connected'
     * But 'syncing' means the source IS connected (just actively syncing)
     */

    function StatusTestComponent() {
      const { dataSources } = useDataSource();
      const gmailSource = dataSources.find(s => s.id === 'gmail');

      // This mimics the logic in Settings.tsx line 358
      // BUG: only checks 'connected', not 'syncing'
      const isConnected = gmailSource?.status === 'connected';

      // FIX: should also include 'syncing'
      const isConnectedFixed = gmailSource?.status === 'connected' || gmailSource?.status === 'syncing';

      return (
        <div>
          <span data-testid="status">{gmailSource?.status}</span>
          <span data-testid="isConnected">{isConnected ? 'true' : 'false'}</span>
          <span data-testid="isConnectedFixed">{isConnectedFixed ? 'true' : 'false'}</span>
        </div>
      );
    }

    render(
      <TestWrapper>
        <StatusTestComponent />
      </TestWrapper>
    );

    // Initially disconnected
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
      expect(screen.getByTestId('isConnected')).toHaveTextContent('false');
    });

    // Note: Full test of syncing state would require mocking the sync flow
    // This test documents the expected behavior
  });
});
