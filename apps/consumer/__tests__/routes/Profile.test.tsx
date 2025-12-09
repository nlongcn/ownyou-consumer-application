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
  }),
}));

// Mock ui-components
vi.mock('@ownyou/ui-components', () => ({
  Header: ({ title }: { title: string }) => <header data-testid="header">{title}</header>,
  IkigaiWheel: ({ passion, mission, vocation, profession }: { passion: number; mission: number; vocation: number; profession: number }) => (
    <div data-testid="ikigai-wheel">
      <span data-testid="passion">{passion}</span>
      <span data-testid="mission">{mission}</span>
      <span data-testid="vocation">{vocation}</span>
      <span data-testid="profession">{profession}</span>
    </div>
  ),
  IABCategories: ({ categories }: { categories: { id: string; name: string }[] }) => (
    <div data-testid="iab-categories">
      {categories.map(c => <div key={c.id}>{c.name}</div>)}
    </div>
  ),
  ConfidenceGauge: ({ confidence }: { confidence: number }) => (
    <div data-testid="confidence-gauge">{confidence}</div>
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
    expect(screen.getByTestId('confidence-gauge')).toHaveTextContent('0.78');
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
