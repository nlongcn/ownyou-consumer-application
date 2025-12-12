import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings } from '../../src/routes/Settings';
import * as platformUtils from '../../src/utils/platform';

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

// Mock DataSourceContext
vi.mock('../../src/contexts/DataSourceContext', () => ({
  useDataSource: () => ({
    dataSources: [
      { id: 'outlook', provider: 'microsoft', type: 'email', status: 'disconnected' },
    ],
    connectSource: vi.fn(),
    disconnectSource: vi.fn(),
    syncSource: vi.fn(),
    isSyncing: false,
  }),
}));

// Mock useGDPR hook
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
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Settings Download Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getPlatform to return 'pwa'
    vi.spyOn(platformUtils, 'getPlatform').mockReturnValue('pwa');
    
    // Mock window.open
    vi.spyOn(window, 'open').mockReturnValue({} as Window);
    
    // Mock window.location.href setter (optional, but good to have if fallback is tested)
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens download dialog and opens release page in new tab', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    
    renderWithProviders(<Settings />);

    // Navigate to Data tab
    await user.click(screen.getByText('Data'));
    
    // Click Connect on Outlook
    const connectButtons = screen.getAllByText('Connect');
    await user.click(connectButtons[0]);

    // Verify dialog appears
    expect(screen.getByText('Connect Outlook')).toBeInTheDocument();
    expect(screen.getByText('Open Download Page')).toBeInTheDocument();

    // Click Download Desktop App
    await user.click(screen.getByText('Open Download Page'));

    // Verify window.open was called with the Release Tag URL (not the file download)
    expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/nlongcn/ownyou-consumer-application/releases/tag/v0.1.0'),
        '_blank',
        'noopener,noreferrer'
    );
  });
});
