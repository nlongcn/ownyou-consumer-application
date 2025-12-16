import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Profile } from '../../src/routes/Profile';

// Mock useProfile hook
vi.mock('../../src/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: {
      userId: 'test-user',
      overallConfidence: 0.78,
      emailsAnalyzed: 1247,
      missionsGenerated: 156,
      feedbackGiven: 42,
      dataSourcesConnected: 2,
      lastUpdated: new Date(),
    },
    ikigaiScores: {
      passion: 78,
      mission: 65,
      vocation: 82,
      profession: 71,
    },
    iabCategories: [
      { id: '1', name: 'Technology', tier1: 'Technology', confidence: 0.92, evidenceCount: 47 },
      { id: '2', name: 'Finance', tier1: 'Finance', confidence: 0.85, evidenceCount: 32 },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    disputeCategory: vi.fn(),
  }),
}));

// Mock useIkigai - Profile.tsx uses this for dimension detail views
vi.mock('../../src/contexts/IkigaiContext', () => ({
  useIkigai: () => ({
    profile: null, // No detailed profile for tests
    isProfileLoading: false,
    runInference: vi.fn(),
    getContextForAgent: vi.fn(),
    scoreMission: vi.fn(),
    sortMissions: vi.fn(),
    awardPoints: vi.fn(),
    getPoints: vi.fn(),
    getTier: vi.fn(),
    isInferring: false,
    inferenceError: null,
  }),
}));

// Mock ui-components
vi.mock('@ownyou/ui-components', () => ({
  Header: ({ title }: { title: string }) => <header data-testid="header">{title}</header>,
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  IkigaiWheel: ({ dimensions, onDimensionSelect }: { dimensions?: { name: string; label: string; score: number; color: string }[]; onDimensionSelect?: (name: string) => void }) => (
    <div data-testid="ikigai-wheel">
      {dimensions?.map((d) => (
        <span key={d.name} data-testid={d.name} onClick={() => onDimensionSelect?.(d.name)}>{d.score}</span>
      ))}
    </div>
  ),
  IABCategories: ({ categories, onDispute }: { categories: { id: string; name: string }[]; onDispute?: (id: string) => void }) => (
    <div data-testid="iab-categories">
      {categories.map(c => (
        <div key={c.id}>
          {c.name}
          {onDispute && <button onClick={() => onDispute(c.id)}>Dispute</button>}
        </div>
      ))}
    </div>
  ),
  ConfidenceGauge: ({ value }: { value: number }) => (
    <div data-testid="confidence-gauge">{value}</div>
  ),
}));

// Mock design system
vi.mock('@ownyou/ui-design-system', () => ({
  radius: { card: '12px' },
  ikigaiColors: {
    experiences: '#FF6B6B',
    relationships: '#4ECDC4',
    interests: '#45B7D1',
    giving: '#96CEB4',
  },
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

describe('Profile Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the profile page with header', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveTextContent('Profile');
  });

  it('renders the Ikigai wheel with scores', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByTestId('ikigai-wheel')).toBeInTheDocument();
    expect(screen.getByTestId('passion')).toHaveTextContent('78');
    expect(screen.getByTestId('mission')).toHaveTextContent('65');
    expect(screen.getByTestId('vocation')).toHaveTextContent('82');
    expect(screen.getByTestId('profession')).toHaveTextContent('71');
  });

  it('renders IAB categories', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByTestId('iab-categories')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('renders confidence gauge', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByTestId('confidence-gauge')).toBeInTheDocument();
    // Profile.tsx converts overallConfidence (0.78) to percentage: 0.78 * 100 = 78
    expect(screen.getByTestId('confidence-gauge')).toHaveTextContent('78');
  });

  it('displays data summary stats', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByText('1247')).toBeInTheDocument(); // emails
    expect(screen.getByText('156')).toBeInTheDocument(); // missions
    expect(screen.getByText('42')).toBeInTheDocument(); // feedback
    expect(screen.getByText('2')).toBeInTheDocument(); // data sources
  });

  it('shows correct labels for stats', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByText('Emails Analyzed')).toBeInTheDocument();
    expect(screen.getByText('Missions Generated')).toBeInTheDocument();
    expect(screen.getByText('Feedback Given')).toBeInTheDocument();
    expect(screen.getByText('Data Sources')).toBeInTheDocument();
  });
});

describe('Profile Route Sections', () => {
  it('renders Your Ikigai section', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByText('Your Ikigai')).toBeInTheDocument();
  });

  it('renders Your Interests section', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByText('Your Interests')).toBeInTheDocument();
  });

  it('renders Data Summary section', () => {
    renderWithProviders(<Profile />);
    expect(screen.getByText('Data Summary')).toBeInTheDocument();
  });
});
