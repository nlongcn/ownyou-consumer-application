import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Wallet } from '../../src/routes/Wallet';

// Mock useAuth with different states
const mockUseAuth = vi.fn();

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock ui-components
vi.mock('@ownyou/ui-components', () => ({
  Header: ({ title }: { title: string }) => <header data-testid="header">{title}</header>,
  TokenBalance: ({ amount }: { amount: number }) => (
    <div data-testid="token-balance">{amount.toFixed(2)} OWN</div>
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
    });
  });

  it('shows header with title', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByTestId('header')).toHaveTextContent('Wallet');
  });

  it('shows token balance', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByTestId('token-balance')).toBeInTheDocument();
  });

  it('shows truncated wallet address', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText(/0x1234...5678/)).toBeInTheDocument();
  });

  it('shows withdraw button', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Withdraw')).toBeInTheDocument();
  });

  it('shows history button', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('History')).toBeInTheDocument();
  });
});

describe('Wallet Earnings Breakdown', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef' },
    });
  });

  it('shows earnings breakdown section', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Earnings Breakdown')).toBeInTheDocument();
  });

  it('shows data contributions row', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Data Contributions')).toBeInTheDocument();
  });

  it('shows profile completeness row', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Profile Completeness')).toBeInTheDocument();
  });

  it('shows feedback rewards row', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Feedback Rewards')).toBeInTheDocument();
  });

  it('shows referral bonuses row', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Referral Bonuses')).toBeInTheDocument();
  });
});

describe('Wallet Transaction History', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef' },
    });
  });

  it('shows recent activity section', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows transaction descriptions', () => {
    renderWithProviders(<Wallet />);
    expect(screen.getByText('Data contribution reward')).toBeInTheDocument();
    expect(screen.getByText('Profile completion bonus')).toBeInTheDocument();
  });
});

describe('Wallet Withdraw Modal', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef' },
    });
  });

  it('opens withdraw modal when withdraw is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Wallet />);

    await user.click(screen.getByText('Withdraw'));
    expect(screen.getByText('Withdraw OWN')).toBeInTheDocument();
  });

  it('shows available balance in modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Wallet />);

    await user.click(screen.getByText('Withdraw'));
    expect(screen.getByText('Available Balance')).toBeInTheDocument();
  });

  it('shows amount input field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Wallet />);

    await user.click(screen.getByText('Withdraw'));
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
  });

  it('shows max button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Wallet />);

    await user.click(screen.getByText('Withdraw'));
    expect(screen.getByText('Max')).toBeInTheDocument();
  });

  it('closes modal on cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Wallet />);

    await user.click(screen.getByText('Withdraw'));
    await user.click(screen.getByText('Cancel'));

    // Modal should be closed
    expect(screen.queryByText('Withdraw OWN')).not.toBeInTheDocument();
  });
});
