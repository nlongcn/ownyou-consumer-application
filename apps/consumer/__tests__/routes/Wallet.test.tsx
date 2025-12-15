import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Wallet } from '../../src/routes/Wallet';

// Mock useAuth with different states
const mockUseAuth = vi.fn();

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useIkigaiRewards - Wallet uses this for points and tier
const mockUseIkigaiRewards = vi.fn();

vi.mock('../../src/contexts/IkigaiContext', () => ({
  useIkigaiRewards: () => mockUseIkigaiRewards(),
}));

// Mock useStore - Wallet uses this for transaction history
const mockUseStore = vi.fn();

vi.mock('../../src/contexts/StoreContext', () => ({
  useStore: () => mockUseStore(),
}));

// Mock ui-components
vi.mock('@ownyou/ui-components', () => ({
  Header: ({ title }: { title: string }) => <header data-testid="header">{title}</header>,
  TokenBalance: ({ balance = 0 }: { balance?: number }) => (
    <div data-testid="token-balance">{balance.toFixed(2)} OWN</div>
  ),
}));

vi.mock('@ownyou/ui-design-system', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Wallet Route - Unauthenticated', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      wallet: null,
      connect: vi.fn(),
      isLoading: false,
    });
    // IkigaiRewards mock - needed even when unauthenticated
    mockUseIkigaiRewards.mockReturnValue({
      points: { total: 0, explorer: 0, connector: 0, helper: 0, achiever: 0 },
      tier: { tier: 'Bronze', nextTierAt: 100, progress: 0 },
      refresh: vi.fn(),
      awardPoints: vi.fn(),
    });
    // Store mock
    mockUseStore.mockReturnValue({
      store: null,
      isReady: false,
      error: null,
      backendType: null,
    });
  });

  it('shows connect wallet prompt when not authenticated', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
  });

  it('shows connect wallet button', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows explanation text', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText(/Connect your wallet to start earning/i)).toBeInTheDocument();
  });
});

describe('Wallet Route - Authenticated', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef1234567890abcdef12345678' },
      connect: vi.fn(),
      isLoading: false,
    });
    // IkigaiRewards mock with sample data
    mockUseIkigaiRewards.mockReturnValue({
      points: { total: 1250, explorer: 400, connector: 300, helper: 350, achiever: 200 },
      tier: { tier: 'Silver', nextTierAt: 2000, progress: 0.625 },
      refresh: vi.fn(),
      awardPoints: vi.fn(),
    });
    // Store mock with list method
    mockUseStore.mockReturnValue({
      store: {
        list: vi.fn().mockResolvedValue({ items: [] }),
      },
      isReady: true,
      error: null,
      backendType: 'memory',
    });
  });

  it('shows header with title', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByTestId('header')).toHaveTextContent('Wallet');
  });

  it('shows total points', () => {
    renderWithProviders(<Wallet />);
    // The actual component shows "Total Points" label
    expect(screen.getByText('Total Points')).toBeInTheDocument();
  });

  it('shows truncated wallet address', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText(/0x1234...5678/)).toBeInTheDocument();
  });

  it('shows refresh button', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('shows history button', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('History')).toBeInTheDocument();
  });
});

describe('Wallet Points Breakdown', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef1234567890abcdef12345678' },
      connect: vi.fn(),
      isLoading: false,
    });
    mockUseIkigaiRewards.mockReturnValue({
      points: { total: 1250, explorer: 400, connector: 300, helper: 350, achiever: 200 },
      tier: { tier: 'Silver', nextTierAt: 2000, progress: 0.625 },
      refresh: vi.fn(),
      awardPoints: vi.fn(),
    });
    mockUseStore.mockReturnValue({
      store: {
        list: vi.fn().mockResolvedValue({ items: [] }),
      },
      isReady: true,
      error: null,
      backendType: 'memory',
    });
  });

  it('shows points breakdown section', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Points Breakdown')).toBeInTheDocument();
  });

  it('shows explorer category', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('shows connector category', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Connector')).toBeInTheDocument();
  });

  it('shows helper category', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Helper')).toBeInTheDocument();
  });

  it('shows achiever category', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Achiever')).toBeInTheDocument();
  });
});

describe('Wallet Transaction History', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef1234567890abcdef12345678' },
      connect: vi.fn(),
      isLoading: false,
    });
    mockUseIkigaiRewards.mockReturnValue({
      points: { total: 1250, explorer: 400, connector: 300, helper: 350, achiever: 200 },
      tier: { tier: 'Silver', nextTierAt: 2000, progress: 0.625 },
      refresh: vi.fn(),
      awardPoints: vi.fn(),
    });
    mockUseStore.mockReturnValue({
      store: {
        list: vi.fn().mockResolvedValue({ items: [] }),
      },
      isReady: true,
      error: null,
      backendType: 'memory',
    });
  });

  it('shows recent activity section', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows empty state when no transactions', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });
});

// Note: Withdraw functionality is planned for future sprint
// The current Wallet component shows Points breakdown (not token-based withdrawal)
