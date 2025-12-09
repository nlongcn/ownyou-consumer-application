import { useQuery } from '@tanstack/react-query';
import type { FilterTab } from '../routes/Home';

export interface Mission {
  id: string;
  type: 'shopping' | 'savings' | 'consumables' | 'content' | 'travel' | 'entertainment' | 'food' | 'people' | 'health';
  title: string;
  description?: string;
  imageUrl?: string;
  brandName?: string;
  brandLogoUrl?: string;
  price?: number;
  originalPrice?: number;
  savings?: number;
  actionUrl?: string;
  actionLabel?: string;
  reason?: string;
  tags?: string[];
  evidenceChain?: string[];
  relatedMissionIds?: string[];
  createdAt: Date;
  priority: number;
}

// Mock data for development - replace with real store queries
const MOCK_MISSIONS: Mission[] = [
  {
    id: '1',
    type: 'shopping',
    title: 'Sony WH-1000XM5 Headphones',
    description: 'Premium noise-cancelling headphones with exceptional sound quality',
    imageUrl: 'https://via.placeholder.com/360x400',
    brandName: 'Sony',
    price: 298.00,
    originalPrice: 399.99,
    savings: 25,
    actionUrl: 'https://example.com/product/1',
    actionLabel: 'View Deal',
    reason: 'Based on your interest in audio equipment and work-from-home setup',
    tags: ['Electronics', 'Audio', 'Work from Home'],
    evidenceChain: [
      'You searched for "noise cancelling headphones" last week',
      'You work from home and value quiet focus time',
      'This model matches your preference for premium quality',
    ],
    createdAt: new Date(),
    priority: 1,
  },
  {
    id: '2',
    type: 'savings',
    title: 'Switch to Green Energy',
    description: 'Save up to 15% on your energy bills by switching to a renewable provider',
    imageUrl: 'https://via.placeholder.com/360x284',
    brandName: 'Octopus Energy',
    actionUrl: 'https://example.com/switch',
    actionLabel: 'Get Quote',
    reason: 'Your current provider may be charging above market rates',
    tags: ['Utility', 'Savings', 'Green'],
    createdAt: new Date(),
    priority: 2,
  },
  {
    id: '3',
    type: 'content',
    title: 'The Tim Ferriss Show',
    description: 'Episode: How to Optimize Your Morning Routine',
    imageUrl: 'https://via.placeholder.com/360x284',
    brandName: 'Podcast',
    actionUrl: 'https://example.com/podcast',
    actionLabel: 'Listen Now',
    reason: 'Matches your interest in productivity and self-improvement',
    tags: ['Podcast', 'Productivity'],
    createdAt: new Date(),
    priority: 3,
  },
  {
    id: '4',
    type: 'travel',
    title: 'Weekend in Barcelona',
    description: 'Discover hidden gems in the Gothic Quarter',
    imageUrl: 'https://via.placeholder.com/360x208',
    actionUrl: 'https://example.com/travel',
    actionLabel: 'Explore',
    reason: 'You mentioned wanting to visit Spain this year',
    tags: ['Travel', 'Europe', 'Weekend Trip'],
    createdAt: new Date(),
    priority: 4,
  },
  {
    id: '5',
    type: 'health',
    title: 'Sleep Score: 72',
    description: 'Your sleep quality has been declining. Here are 3 tips to improve it.',
    imageUrl: 'https://via.placeholder.com/360x180',
    actionLabel: 'View Tips',
    tags: ['Health', 'Sleep', 'Wellness'],
    createdAt: new Date(),
    priority: 5,
  },
  {
    id: '6',
    type: 'food',
    title: 'Mediterranean Salmon Bowl',
    description: 'A healthy dinner idea based on your dietary preferences',
    imageUrl: 'https://via.placeholder.com/360x287',
    actionLabel: 'View Recipe',
    reason: 'Matches your preference for high-protein, pescatarian meals',
    tags: ['Recipe', 'Healthy', 'Dinner'],
    createdAt: new Date(),
    priority: 6,
  },
  {
    id: '7',
    type: 'entertainment',
    title: 'Hamilton at the West End',
    description: 'Limited tickets available for next month',
    imageUrl: 'https://via.placeholder.com/360x207',
    price: 85.00,
    actionUrl: 'https://example.com/tickets',
    actionLabel: 'Get Tickets',
    reason: 'You enjoyed musicals in the past',
    tags: ['Theatre', 'Musical', 'London'],
    createdAt: new Date(),
    priority: 7,
  },
  {
    id: '8',
    type: 'people',
    title: 'Catch up with Sarah',
    description: "It's been 3 months since you last connected",
    imageUrl: 'https://via.placeholder.com/360x210',
    actionLabel: 'Send Message',
    tags: ['Relationships', 'Friends'],
    createdAt: new Date(),
    priority: 8,
  },
];

function filterMissions(missions: Mission[], filter: FilterTab): Mission[] {
  switch (filter) {
    case 'savings':
      return missions.filter(m => m.type === 'savings' || m.type === 'shopping');
    case 'ikigai':
      return missions.filter(m => ['content', 'travel', 'entertainment', 'food', 'people'].includes(m.type));
    case 'health':
      return missions.filter(m => m.type === 'health');
    case 'all':
    default:
      return missions;
  }
}

async function fetchMissions(filter: FilterTab): Promise<Mission[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // In production, this would query the LangGraph Store
  // const store = await getStore();
  // const missions = await store.search(NS.missions(userId), { filter });

  return filterMissions(MOCK_MISSIONS, filter);
}

export function useMissions(filter: FilterTab = 'all') {
  const query = useQuery({
    queryKey: ['missions', filter],
    queryFn: () => fetchMissions(filter),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    missions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
