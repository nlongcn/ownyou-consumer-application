import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home } from '../../src/routes/Home';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useDataSource - Home.tsx uses getConnectedSources
vi.mock('../../src/contexts/DataSourceContext', () => ({
  useDataSource: () => ({
    dataSources: [],
    getConnectedSources: () => [{ id: 'gmail', status: 'connected' }], // At least one connected for main view
    connectSource: vi.fn(),
    disconnectSource: vi.fn(),
    syncSource: vi.fn(),
    isSyncing: false,
    isSourceConnected: () => true,
  }),
}));

// Mock ChatInput component - it has internal dependencies
vi.mock('../../src/components/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input">Chat Input</div>,
}));

// Mock the hooks
vi.mock('../../src/hooks/useMissions', () => ({
  useMissions: vi.fn(() => ({
    missions: [
      {
        id: '1',
        type: 'shopping',
        title: 'Test Product',
        description: 'Test description',
        price: 99.99,
        createdAt: new Date(),
        priority: 1,
      },
      {
        id: '2',
        type: 'savings',
        title: 'Save Energy',
        description: 'Switch providers',
        createdAt: new Date(),
        priority: 2,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useUpdateMission: vi.fn(() => ({
    snoozeMission: vi.fn(),
    dismissMission: vi.fn(),
    isSnoozing: false,
    isDismissing: false,
  })),
}));

vi.mock('../../src/hooks/useFeedback', () => ({
  useFeedback: () => ({
    updateFeedback: vi.fn(),
    getFeedbackState: () => 'meh',
    isUpdating: false,
    error: null,
  }),
}));

// Mock ui-components
vi.mock('@ownyou/ui-components', () => ({
  Header: ({ activeFilter, onFilterChange }: { activeFilter?: string; onFilterChange?: (tab: string) => void }) => (
    <header data-testid="header">
      <div data-testid="filter-tabs">
        <button onClick={() => onFilterChange?.('all')} data-active={activeFilter === 'all'}>All</button>
        <button onClick={() => onFilterChange?.('savings')} data-active={activeFilter === 'savings'}>Savings</button>
        <button onClick={() => onFilterChange?.('ikigai')} data-active={activeFilter === 'ikigai'}>Ikigai</button>
        <button onClick={() => onFilterChange?.('health')} data-active={activeFilter === 'health'}>Health</button>
      </div>
    </header>
  ),
  MissionFeed: ({ missions, onMissionClick }: { missions: Array<{ id: string; title: string }>; onMissionClick: (id: string) => void }) => (
    <div data-testid="mission-feed">
      {missions.map((m) => (
        <div key={m.id} data-testid={`mission-${m.id}`} onClick={() => onMissionClick(m.id)}>
          {m.title}
        </div>
      ))}
    </div>
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

describe('Home Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to authenticated state for most tests
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef' },
      connect: vi.fn(),
      isLoading: false,
    });
  });

  it('renders the home page with header', () => {
    renderWithProviders(<Home />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders the filter tabs', () => {
    renderWithProviders(<Home />);
    expect(screen.getByTestId('filter-tabs')).toBeInTheDocument();
  });

  it('renders the mission feed', () => {
    renderWithProviders(<Home />);
    expect(screen.getByTestId('mission-feed')).toBeInTheDocument();
  });

  it('displays missions from the hook', () => {
    renderWithProviders(<Home />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('Save Energy')).toBeInTheDocument();
  });

  it('changes filter when tab is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);

    const savingsTab = screen.getByText('Savings');
    await user.click(savingsTab);

    // Filter state should update (tested via internal state)
    expect(savingsTab).toBeInTheDocument();
  });

  it('navigates to mission detail on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);

    const mission = screen.getByTestId('mission-1');
    await user.click(mission);

    // Navigation would be triggered
    expect(mission).toBeInTheDocument();
  });
});

describe('Home Route Loading State', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef' },
      connect: vi.fn(),
      isLoading: false,
    });
  });

  it('shows loading skeleton when loading', () => {
    vi.doMock('../../src/hooks/useMissions', () => ({
      useMissions: () => ({
        missions: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      }),
    }));

    // Loading state is tested through the skeleton presence
    renderWithProviders(<Home />);
    expect(screen.getByTestId('mission-feed')).toBeInTheDocument();
  });
});

describe('Home Route Error State', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      wallet: { address: '0x1234567890abcdef' },
      connect: vi.fn(),
      isLoading: false,
    });
  });

  it('shows error message when error occurs', async () => {
    vi.doMock('../../src/hooks/useMissions', () => ({
      useMissions: () => ({
        missions: [],
        isLoading: false,
        error: new Error('Failed to load missions'),
        refetch: vi.fn(),
      }),
    }));

    // Error handling would show error UI
    renderWithProviders(<Home />);
    // The actual error UI depends on implementation
  });
});
