import { useQuery } from '@tanstack/react-query';

export interface IkigaiScores {
  passion: number;    // 0-100: What you love
  mission: number;    // 0-100: What the world needs
  vocation: number;   // 0-100: What you can be paid for
  profession: number; // 0-100: What you're good at
}

export interface IABCategory {
  id: string;
  name: string;
  tier1: string;
  tier2?: string;
  confidence: number; // 0-1
  evidenceCount: number;
}

export interface Profile {
  userId: string;
  overallConfidence: number;
  emailsAnalyzed: number;
  missionsGenerated: number;
  feedbackGiven: number;
  dataSourcesConnected: number;
  lastUpdated: Date;
}

// Mock data for development
const MOCK_IKIGAI: IkigaiScores = {
  passion: 78,
  mission: 65,
  vocation: 82,
  profession: 71,
};

const MOCK_IAB_CATEGORIES: IABCategory[] = [
  { id: '1', name: 'Technology & Computing', tier1: 'Technology & Computing', confidence: 0.92, evidenceCount: 47 },
  { id: '2', name: 'Personal Finance', tier1: 'Personal Finance', tier2: 'Investing', confidence: 0.85, evidenceCount: 32 },
  { id: '3', name: 'Travel', tier1: 'Travel', tier2: 'Adventure Travel', confidence: 0.78, evidenceCount: 24 },
  { id: '4', name: 'Health & Fitness', tier1: 'Health & Fitness', tier2: 'Nutrition', confidence: 0.72, evidenceCount: 19 },
  { id: '5', name: 'Food & Drink', tier1: 'Food & Drink', tier2: 'Cooking', confidence: 0.68, evidenceCount: 15 },
  { id: '6', name: 'Books & Literature', tier1: 'Books & Literature', confidence: 0.61, evidenceCount: 12 },
];

const MOCK_PROFILE: Profile = {
  userId: 'mock-user-123',
  overallConfidence: 0.78,
  emailsAnalyzed: 1247,
  missionsGenerated: 156,
  feedbackGiven: 42,
  dataSourcesConnected: 2,
  lastUpdated: new Date(),
};

async function fetchProfile(): Promise<{
  profile: Profile;
  ikigaiScores: IkigaiScores;
  iabCategories: IABCategory[];
}> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // In production, this would query the LangGraph Store
  // const store = await getStore();
  // const profile = await store.get(NS.profile(userId));
  // const ikigai = await store.get(NS.ikigai(userId));
  // const iab = await store.search(NS.iabCategories(userId));

  return {
    profile: MOCK_PROFILE,
    ikigaiScores: MOCK_IKIGAI,
    iabCategories: MOCK_IAB_CATEGORIES,
  };
}

export function useProfile() {
  const query = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    profile: query.data?.profile ?? null,
    ikigaiScores: query.data?.ikigaiScores ?? { passion: 0, mission: 0, vocation: 0, profession: 0 },
    iabCategories: query.data?.iabCategories ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
