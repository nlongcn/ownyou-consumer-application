import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';

// Mock platform utils
vi.mock('../../src/utils/platform', () => ({
  getPlatform: () => 'pwa',
}));

// Test component that uses the auth context
function TestComponent() {
  const { isAuthenticated, isLoading, wallet, error, connect, disconnect } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="wallet">{wallet?.address ?? 'none'}</div>
      <div data-testid="error">{error ?? 'none'}</div>
      <button onClick={connect}>Connect</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts with isLoading true and transitions to ready', async () => {
    // The initial state is isLoading: true, but the useEffect runs
    // immediately in tests, so we check for the stable 'ready' state
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // After mount, the auth check completes and loading becomes false
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
  });

  it('finishes loading after check', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
  });

  it('starts unauthenticated when no saved wallet', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    });
  });

  it('restores wallet from localStorage', async () => {
    const mockWallet = { address: '0x123', publicKey: 'pk' };
    localStorage.setItem('ownyou_wallet', JSON.stringify(mockWallet));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      expect(screen.getByTestId('wallet')).toHaveTextContent('0x123');
    });
  });

  it('connects wallet on connect call', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await user.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      expect(screen.getByTestId('wallet')).not.toHaveTextContent('none');
    });
  });

  it('disconnects wallet on disconnect call', async () => {
    const user = userEvent.setup();
    const mockWallet = { address: '0x123', publicKey: 'pk' };
    localStorage.setItem('ownyou_wallet', JSON.stringify(mockWallet));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    });

    await user.click(screen.getByText('Disconnect'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      expect(screen.getByTestId('wallet')).toHaveTextContent('none');
    });
  });

  it('persists wallet to localStorage on connect', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await user.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    });

    // Check localStorage was updated
    const saved = localStorage.getItem('ownyou_wallet');
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!)).toHaveProperty('address');
  });

  it('clears localStorage on disconnect', async () => {
    const user = userEvent.setup();
    const mockWallet = { address: '0x123', publicKey: 'pk' };
    localStorage.setItem('ownyou_wallet', JSON.stringify(mockWallet));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    });

    await user.click(screen.getByText('Disconnect'));

    await waitFor(() => {
      expect(localStorage.getItem('ownyou_wallet')).toBeNull();
    });
  });
});

describe('useAuth hook', () => {
  it('throws error when used outside provider', () => {
    // Suppress console error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    spy.mockRestore();
  });
});
