import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncProvider, useSync } from '../../src/contexts/SyncContext';
import { AuthProvider } from '../../src/contexts/AuthContext';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../src/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

// Test component that uses the sync context
function TestComponent() {
  const { status, lastSynced, pendingChanges, connectedDevices, error, sync, pauseSync, resumeSync } = useSync();

  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="lastSynced">{lastSynced?.toISOString() ?? 'never'}</div>
      <div data-testid="pendingChanges">{pendingChanges}</div>
      <div data-testid="connectedDevices">{connectedDevices}</div>
      <div data-testid="error">{error ?? 'none'}</div>
      <button onClick={sync}>Sync</button>
      <button onClick={pauseSync}>Pause</button>
      <button onClick={resumeSync}>Resume</button>
    </div>
  );
}

describe('SyncContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('provides idle status when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      wallet: null,
    });

    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('idle');
  });

  it('shows 0 connected devices when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      wallet: null,
    });

    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    expect(screen.getByTestId('connectedDevices')).toHaveTextContent('0');
  });

  it('initializes when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x123' },
    });

    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('connectedDevices')).toHaveTextContent('1');
    });
  });

  it('updates lastSynced after sync', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x123' },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    await user.click(screen.getByText('Sync'));

    // Advance timers for the mock sync delay
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(screen.getByTestId('lastSynced')).not.toHaveTextContent('never');
    });
  });

  it('shows syncing status during sync', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x123' },
    });

    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    act(() => {
      screen.getByText('Sync').click();
    });

    // Should be syncing immediately after click
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('syncing');
    });
  });

  it('returns to idle after sync completes', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x123' },
    });

    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    act(() => {
      screen.getByText('Sync').click();
    });

    // Advance timers for the mock sync delay
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('idle');
    });
  });

  it('clears pending changes after sync', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x123' },
    });

    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    act(() => {
      screen.getByText('Sync').click();
    });

    // Advance timers for the mock sync delay
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(screen.getByTestId('pendingChanges')).toHaveTextContent('0');
    });
  });
});

describe('SyncContext online/offline', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x123' },
    });
  });

  it('shows offline status when offline', async () => {
    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    // Simulate going offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('offline');
    });
  });

  it('recovers when coming back online', async () => {
    render(
      <SyncProvider>
        <TestComponent />
      </SyncProvider>
    );

    // Go offline then online
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('offline');
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('idle');
    });
  });
});

describe('useSync hook', () => {
  it('throws error when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useSync must be used within a SyncProvider');

    spy.mockRestore();
  });
});
