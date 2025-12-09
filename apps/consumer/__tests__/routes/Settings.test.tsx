import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings } from '../../src/routes/Settings';

// Mock contexts
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    wallet: { address: '0x1234567890abcdef' },
  }),
}));

vi.mock('../../src/contexts/SyncContext', () => ({
  useSync: () => ({
    syncStatus: 'idle',
    lastSynced: new Date(),
  }),
}));

// Mock ui-components
vi.mock('@ownyou/ui-components', () => ({
  Header: ({ title }: { title: string }) => <header data-testid="header">{title}</header>,
}));

vi.mock('@ownyou/ui-design-system', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
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

describe('Settings Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the settings page with header', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveTextContent('Settings');
  });

  it('renders all section tabs', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Privacy')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('Sync')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('shows privacy section by default', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Privacy Controls')).toBeInTheDocument();
  });

  it('switches to data section when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByText('Data'));
    expect(screen.getByText('Data Sources')).toBeInTheDocument();
  });

  it('switches to wallet section when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByText('Wallet'));
    // When authenticated, shows wallet info
    expect(screen.getByText('Wallet Address')).toBeInTheDocument();
  });

  it('switches to sync section when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByText('Sync'));
    expect(screen.getByText('Cross-Device Sync')).toBeInTheDocument();
  });

  it('switches to about section when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByText('About'));
    expect(screen.getByText('About OwnYou')).toBeInTheDocument();
  });
});

describe('Settings Privacy Section', () => {
  it('shows local processing toggle', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Local Processing Only')).toBeInTheDocument();
  });

  it('shows share anonymized toggle', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Share Anonymized Insights')).toBeInTheDocument();
  });

  it('shows data retention selector', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Data Retention')).toBeInTheDocument();
  });
});

describe('Settings Data Section', () => {
  beforeEach(async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('Data'));
  });

  it('shows email data source', () => {
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows calendar data source', () => {
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('shows browser history data source', () => {
    expect(screen.getByText('Browser History')).toBeInTheDocument();
  });

  it('shows export data button', () => {
    expect(screen.getByText('Export All Data')).toBeInTheDocument();
  });

  it('shows delete data button', () => {
    expect(screen.getByText('Delete All Data')).toBeInTheDocument();
  });
});

describe('Settings About Section', () => {
  beforeEach(async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('About'));
  });

  it('shows app version', () => {
    expect(screen.getByText('Version 0.1.0')).toBeInTheDocument();
  });

  it('shows privacy policy link', () => {
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
  });

  it('shows terms of service link', () => {
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });
});
