import { useQuery } from '@tanstack/react-query';
import type { Mission } from './useMissions';

async function fetchMission(id: string): Promise<Mission | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));

  // In production, this would query the LangGraph Store
  // const store = await getStore();
  // const mission = await store.get(NS.missions(userId), id);

  // Mock data for development
  const mockMission: Mission = {
    id,
    type: 'shopping',
    title: 'Sony WH-1000XM5 Headphones',
    description: 'Premium noise-cancelling headphones with exceptional sound quality. Industry-leading noise cancellation with eight microphones and Auto NC Optimizer. Crystal-clear hands-free calling with four beamforming microphones and advanced audio signal processing.',
    imageUrl: 'https://via.placeholder.com/600x400',
    brandName: 'Sony',
    price: 298.00,
    originalPrice: 399.99,
    savings: 25,
    actionUrl: 'https://example.com/product/1',
    actionLabel: 'View Deal',
    reason: 'Based on your interest in audio equipment and work-from-home setup',
    tags: ['Electronics', 'Audio', 'Work from Home', 'Noise Cancelling'],
    evidenceChain: [
      'You searched for "noise cancelling headphones" last week',
      'You work from home and value quiet focus time',
      'Your calendar shows many video calls',
      'This model matches your preference for premium quality',
    ],
    relatedMissionIds: ['2', '3'],
    createdAt: new Date(),
    priority: 1,
  };

  return mockMission;
}

export function useMission(id: string) {
  const query = useQuery({
    queryKey: ['mission', id],
    queryFn: () => fetchMission(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    mission: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
