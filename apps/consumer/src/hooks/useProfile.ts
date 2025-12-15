/**
 * useProfile Hook - Fetches profile data from LangGraph Store
 * v13 Section 4.4 - Profile Components
 *
 * This hook queries the real store for profile data including:
 * - Ikigai scores
 * - IAB classifications
 * - User statistics
 *
 * Returns default/empty values for new users until real data is collected
 * through data source sync and IAB classification.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { NS } from '@ownyou/shared-types';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';

export interface IkigaiScores {
  passion: number;    // 0-100: What you love
  mission: number;    // 0-100: What the world needs
  vocation: number;   // 0-100: What you can be paid for
  profession: number; // 0-100: What you're good at
}

/** Evidence entry for IAB classification - Sprint 11b Bugfix 9 */
export interface EvidenceEntry {
  sourceType: string;  // 'email' | 'calendar' | 'financial'
  extractedText: string;
  date: string;
  sourceId?: string;
}

export interface IABCategory {
  id: string;
  name: string;
  tier1: string;
  tier2?: string;
  confidence: number; // 0-1
  evidenceCount: number;
  /** Evidence chain for this classification - Sprint 11b Bugfix 9 */
  evidence?: EvidenceEntry[];
  /** Is this classification disputed by user? */
  disputed?: boolean;
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

/** Default Ikigai scores for new users (all zeros until computed from real data) */
const DEFAULT_IKIGAI: IkigaiScores = {
  passion: 0,
  mission: 0,
  vocation: 0,
  profession: 0,
};

/**
 * useProfile - Fetches and manages profile data from store
 *
 * Queries the LangGraph Store for profile, Ikigai, and IAB data.
 * Returns empty/default values for new users until real data is collected.
 */
export function useProfile() {
  const { store, isReady } = useStore();
  const { wallet } = useAuth();

  const userId = wallet?.address ?? 'anonymous';

  // Query profile data from store
  const query = useQuery({
    queryKey: ['profile', userId, isReady],
    queryFn: async (): Promise<{
      profile: Profile;
      ikigaiScores: IkigaiScores;
      iabCategories: IABCategory[];
    }> => {
      if (!store || !isReady) {
        return {
          profile: {
            userId,
            overallConfidence: 0,
            emailsAnalyzed: 0,
            missionsGenerated: 0,
            feedbackGiven: 0,
            dataSourcesConnected: 0,
            lastUpdated: new Date(),
          },
          ikigaiScores: DEFAULT_IKIGAI,
          iabCategories: [],
        };
      }

      try {
        // Fetch Ikigai scores
        const ikigaiNamespace = NS.ikigaiProfile(userId);
        const ikigaiScores = await store.get<IkigaiScores>(ikigaiNamespace, 'scores') ?? DEFAULT_IKIGAI;

        // Fetch profile stats
        const stats = await store.get<{
          emailsAnalyzed: number;
          missionsGenerated: number;
          feedbackGiven: number;
          dataSourcesConnected: number;
          lastUpdated: string;
        }>(ikigaiNamespace, 'stats');

        // Fetch IAB categories
        const iabNamespace = NS.iabClassifications(userId);
        const iabResult = await store.list<IABCategory>(iabNamespace, { limit: 50, offset: 0 });
        const iabCategories = iabResult.items.sort((a, b) => b.confidence - a.confidence);

        // Calculate overall confidence from IAB categories
        const overallConfidence = iabCategories.length > 0
          ? iabCategories.reduce((sum, cat) => sum + cat.confidence, 0) / iabCategories.length
          : 0;

        const profile: Profile = {
          userId,
          overallConfidence,
          emailsAnalyzed: stats?.emailsAnalyzed ?? 0,
          missionsGenerated: stats?.missionsGenerated ?? 0,
          feedbackGiven: stats?.feedbackGiven ?? 0,
          dataSourcesConnected: stats?.dataSourcesConnected ?? 0,
          lastUpdated: stats?.lastUpdated ? new Date(stats.lastUpdated) : new Date(),
        };

        return {
          profile,
          ikigaiScores,
          iabCategories,
        };
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        throw error;
      }
    },
    enabled: isReady,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const queryClient = useQueryClient();

  /** Dispute an IAB classification - Sprint 11b Bugfix 9 */
  const disputeCategory = useCallback(async (categoryId: string) => {
    if (!store || !isReady || !wallet) {
      throw new Error('Store not ready or not authenticated');
    }

    const namespace = NS.iabClassifications(wallet.address);
    const current = await store.get<IABCategory>(namespace, categoryId);

    if (!current) {
      throw new Error(`Category ${categoryId} not found`);
    }

    // Mark the category as disputed
    const updated = {
      ...current,
      disputed: true,
      disputedAt: new Date().toISOString(),
    };

    await store.put(namespace, categoryId, updated);

    // Also store dispute in a separate namespace for re-evaluation
    // Use type assertion since iabDisputes may not exist in all NS versions
    type NSWithDisputes = typeof NS & { iabDisputes?: (addr: string) => readonly string[] };
    const disputeNamespace = ((NS as NSWithDisputes).iabDisputes?.(wallet.address) ?? ['ownyou', 'iab_disputes', wallet.address]) as readonly [string, ...string[]];
    await store.put(disputeNamespace, categoryId, {
      categoryId,
      categoryName: current.name,
      confidence: current.confidence,
      disputedAt: new Date().toISOString(),
      status: 'pending_review',
    });

    // Invalidate to refetch
    queryClient.invalidateQueries({ queryKey: ['profile'] });

    return updated;
  }, [store, isReady, wallet, queryClient]);

  // Map categories to UI format with evidence
  // Handle undefined/NaN confidence values to avoid rendering "NaN%" in UI
  const mappedCategories = (query.data?.iabCategories ?? [])
    .filter(cat => cat && typeof cat.confidence === 'number' && !isNaN(cat.confidence))
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      score: Math.round((cat.confidence ?? 0) * 100),
      evidence: cat.evidence,
      subcategories: cat.tier2 ? [{ name: cat.tier2, score: Math.round((cat.confidence ?? 0) * 100) }] : undefined,
    }));

  return {
    profile: query.data?.profile ?? null,
    ikigaiScores: query.data?.ikigaiScores ?? DEFAULT_IKIGAI,
    iabCategories: mappedCategories,
    isLoading: query.isLoading || !isReady,
    error: query.error as Error | null,
    refetch: query.refetch,
    /** Whether profile data is from store (true) or pending (false) */
    isStoreReady: isReady,
    /** Dispute an IAB classification - Sprint 11b Bugfix 9 */
    disputeCategory,
  };
}

/**
 * Hook to update Ikigai scores
 */
export function useUpdateIkigai() {
  const { store, isReady } = useStore();
  const { wallet } = useAuth();
  const queryClient = useQueryClient();

  const updateIkigai = useCallback(async (scores: Partial<IkigaiScores>) => {
    if (!store || !isReady || !wallet) {
      throw new Error('Store not ready or not authenticated');
    }

    const namespace = NS.ikigaiProfile(wallet.address);
    const current = await store.get<IkigaiScores>(namespace, 'scores') ?? DEFAULT_IKIGAI;

    const updated: IkigaiScores = {
      ...current,
      ...scores,
    };

    await store.put(namespace, 'scores', updated);

    // Invalidate to refetch
    queryClient.invalidateQueries({ queryKey: ['profile'] });

    return updated;
  }, [store, isReady, wallet, queryClient]);

  return { updateIkigai, isReady };
}

/**
 * Hook to increment profile statistics
 */
export function useIncrementProfileStats() {
  const { store, isReady } = useStore();
  const { wallet } = useAuth();
  const queryClient = useQueryClient();

  const incrementStat = useCallback(async (
    stat: 'emailsAnalyzed' | 'missionsGenerated' | 'feedbackGiven' | 'dataSourcesConnected',
    amount: number = 1
  ) => {
    if (!store || !isReady || !wallet) {
      throw new Error('Store not ready or not authenticated');
    }

    const namespace = NS.ikigaiProfile(wallet.address);
    const current = await store.get<{
      emailsAnalyzed: number;
      missionsGenerated: number;
      feedbackGiven: number;
      dataSourcesConnected: number;
      lastUpdated: string;
    }>(namespace, 'stats') ?? {
      emailsAnalyzed: 0,
      missionsGenerated: 0,
      feedbackGiven: 0,
      dataSourcesConnected: 0,
      lastUpdated: new Date().toISOString(),
    };

    const updated = {
      ...current,
      [stat]: (current[stat] ?? 0) + amount,
      lastUpdated: new Date().toISOString(),
    };

    await store.put(namespace, 'stats', updated);

    // Invalidate to refetch
    queryClient.invalidateQueries({ queryKey: ['profile'] });

    return updated;
  }, [store, isReady, wallet, queryClient]);

  return { incrementStat, isReady };
}
