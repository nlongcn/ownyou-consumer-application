import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings } from '../../src/routes/Settings';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { StoreProvider } from '../../src/contexts/StoreContext';

// Track navigate calls for Bug 4 navigation tests
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock SyncContext - external sync service dependency
vi.mock('../../src/contexts/SyncContext', () => ({
  useSync: () => ({
    syncStatus: 'idle',
    lastSynced: new Date(),
  }),
}));

// Mock DataSourceContext - used by DataSettings
vi.mock('../../src/contexts/DataSourceContext', () => ({
  useDataSource: () => ({
    dataSources: [
      { id: 'gmail', provider: 'google', type: 'email', status: 'disconnected' },
      { id: 'outlook', provider: 'microsoft', type: 'email', status: 'disconnected' },
      { id: 'google-calendar', provider: 'google', type: 'calendar', status: 'disconnected' },
    ],
    connectSource: vi.fn(),
    disconnectSource: vi.fn(),
    syncSource: vi.fn(),
    isSyncing: false,
  }),
}));

// Mock useGDPR hook - used by DataSettings
vi.mock('../../src/hooks/useGDPR', () => ({
  useGDPR: () => ({
    downloadExport: vi.fn(),
    deleteAllDataAndLogout: vi.fn(),
    isExporting: false,
    isDeleting: false,
    isReady: true,
  }),
}));

// Mock SyncStatusDetails component
vi.mock('../../src/components/SyncStatusIndicator', () => ({
  SyncStatusDetails: () => <div data-testid="sync-status-details">Sync Status Details</div>,
}));

// Mock ui-components
vi.mock('@ownyou/ui-components', () => ({
  Header: ({ title }: { title: string }) => <header data-testid="header">{title}</header>,
}));

vi.mock('@ownyou/ui-design-system', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  colors: {},
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <StoreProvider forceInMemory>
            {ui}
          </StoreProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Settings Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up authenticated wallet in localStorage
    localStorage.setItem('ownyou_wallet', JSON.stringify({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      publicKey: 'test-public-key',
    }));
  });

  afterEach(() => {
    localStorage.clear();
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
  it('shows Gmail data source', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('Data'));
    expect(screen.getByText('Gmail')).toBeInTheDocument();
  });

  it('shows Outlook data source', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('Data'));
    expect(screen.getByText('Outlook')).toBeInTheDocument();
  });

  it('shows Calendar data source', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('Data'));
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('shows export data button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('Data'));
    // The GDPR export button with icon
    expect(screen.getByText(/Export All Data/)).toBeInTheDocument();
  });

  it('shows delete data button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('Data'));
    // The GDPR delete button with icon
    expect(screen.getByText(/Delete All Data/)).toBeInTheDocument();
  });
});

describe('Settings About Section', () => {
  it('shows app version', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('About'));
    // Version is dynamic from BUILD_INFO, just check the pattern exists
    expect(screen.getByText(/Version \d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  it('shows privacy policy link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('About'));
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
  });

  it('shows terms of service link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);
    await user.click(screen.getByText('About'));
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });
});

/**
 * Bug 4: Navigation Button Tests
 *
 * These tests verify that navigation buttons call navigate() correctly.
 * Bug 4 was caused by state corruption (Bug 1) potentially interfering with navigation.
 * With Bug 1 fixed, navigation should work correctly.
 *
 * Note: Only testing buttons that are always visible regardless of connection state.
 * The "View Classification Results" button only shows when sources are connected.
 */
describe('Settings Navigation (Bug 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('ownyou_wallet', JSON.stringify({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      publicKey: 'test-public-key',
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Emails button navigates to /data/emails', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    // Go to Data section
    await user.click(screen.getByText('Data'));

    // Click Emails button
    const button = screen.getByText('Emails');
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/data/emails');
  });

  it('Transactions button navigates to /data/transactions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    // Go to Data section
    await user.click(screen.getByText('Data'));

    // Click Transactions button
    const button = screen.getByText('Transactions');
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/data/transactions');
  });

  it('Calendar Events button navigates to /data/calendar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    // Go to Data section
    await user.click(screen.getByText('Data'));

    // Click Calendar Events button
    const button = screen.getByText('Calendar Events');
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/data/calendar');
  });
});
