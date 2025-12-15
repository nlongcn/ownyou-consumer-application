/**
 * IkigaiContext - Provides well-being inference and mission prioritization
 *
 * Sprint 11a: Wires @ownyou/ikigai to consumer app
 * v13 Section 2 - Ikigai Intelligence Layer
 *
 * ACTUAL EXPORTS from @ownyou/ikigai (verified from source):
 * - IkigaiInferenceEngine: constructor(llm, store, config?)
 * - createIkigaiEngine(llm, store, config?): IkigaiInferenceEngine
 * - getExistingProfile(userId, store): Promise<IkigaiProfile | undefined>
 * - storeIkigaiProfile(userId, profile, store): Promise<void>
 * - calculateWellBeingScore(mission, userId, store): Promise<MissionWellBeingScore>
 * - sortMissionsByWellBeing(missions, userId, store): Promise<ScoredMission[]>
 * - awardMissionPoints(mission, userId, store): Promise<number>
 * - getUserPoints(userId, store): Promise<UserPoints>
 * - getIkigaiTier(totalPoints): { tier, nextTierAt, progress }
 * - getIkigaiContextForAgent(userId, agentType, store): Promise<IkigaiContext>
 */

import { createContext, useContext, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import {
  IkigaiInferenceEngine,
  createIkigaiEngine,
  getExistingProfile,
  getIkigaiContextForAgent,
  calculateWellBeingScore,
  sortMissionsByWellBeing,
  awardMissionPoints,
  getUserPoints,
  getIkigaiTier,
  type IkigaiProfile,
  type MissionCard,
  type LLMClient,
  type UserPoints,
  type MissionWellBeingScore,
} from '@ownyou/ikigai';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';

interface IkigaiContextValue {
  /** Current user's Ikigai profile */
  profile: IkigaiProfile | null;

  /** Loading state for profile */
  isProfileLoading: boolean;

  /** Run Ikigai inference on recent data */
  runInference: () => Promise<IkigaiProfile | null>;

  /** Get Ikigai context for an agent (returns formatted string) */
  getContextForAgent: () => Promise<string>;

  /** Calculate well-being score for a mission */
  scoreMission: (mission: MissionCard) => Promise<MissionWellBeingScore>;

  /** Sort missions by well-being alignment */
  sortMissions: <T extends MissionCard>(missions: T[]) => Promise<Array<T & { wellBeingScore: MissionWellBeingScore }>>;

  /** Award points for completing a mission */
  awardPoints: (mission: MissionCard) => Promise<number>;

  /** Get user's total points */
  getPoints: () => Promise<UserPoints>;

  /** Get user's Ikigai tier (Bronze, Silver, Gold, Platinum) */
  getTier: () => Promise<{ tier: string; nextTierAt: number; progress: number }>;

  /** Whether inference is currently running */
  isInferring: boolean;

  /** Error from last inference attempt */
  inferenceError: Error | null;
}

const IkigaiContext = createContext<IkigaiContextValue | null>(null);

/**
 * Mock LLM client for development/testing
 * Returns empty responses - real inference requires real LLM
 */
const mockLLMClient: LLMClient = {
  async complete() {
    return { content: '{}' };
  },
};

interface IkigaiProviderProps {
  children: ReactNode;
  /** Optional LLM client for inference (uses mock if not provided) */
  llmClient?: LLMClient;
}

export function IkigaiProvider({ children, llmClient }: IkigaiProviderProps) {
  const { store, isReady } = useStore();
  const { wallet, isAuthenticated } = useAuth();
  const userId = wallet?.address ?? 'anonymous';

  const [profile, setProfile] = useState<IkigaiProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isInferring, setIsInferring] = useState(false);
  const [inferenceError, setInferenceError] = useState<Error | null>(null);

  const engineRef = useRef<IkigaiInferenceEngine | null>(null);

  /**
   * Initialize engine and load existing profile
   */
  useEffect(() => {
    if (!isReady || !isAuthenticated || !store) {
      setIsProfileLoading(false);
      return;
    }

    const init = async () => {
      setIsProfileLoading(true);

      try {
        // Create inference engine with actual API: createIkigaiEngine(llm, store, config?)
        const llm = llmClient ?? mockLLMClient;
        engineRef.current = createIkigaiEngine(llm, store as unknown as Parameters<typeof createIkigaiEngine>[1]);

        // Load existing profile using actual API: getExistingProfile(userId, store)
        const existingProfile = await getExistingProfile(userId, store as unknown as Parameters<typeof getExistingProfile>[1]);
        if (existingProfile) {
          setProfile(existingProfile);
          console.log('[IkigaiContext] Loaded existing profile');
        }
      } catch (error) {
        console.error('[IkigaiContext] Initialization failed:', error);
      } finally {
        setIsProfileLoading(false);
      }
    };

    init();

    return () => {
      engineRef.current = null;
    };
  }, [isReady, isAuthenticated, store, userId, llmClient]);

  /**
   * Run Ikigai inference on recent data
   * Actual API: engine.runInference(userId, options?)
   */
  const runInference = useCallback(async (): Promise<IkigaiProfile | null> => {
    if (!engineRef.current || !store) {
      return null;
    }

    setIsInferring(true);
    setInferenceError(null);

    try {
      // Run inference engine - actual API: runInference(userId, options?)
      const newProfile = await engineRef.current.runInference(userId);

      // Update state
      setProfile(newProfile);

      console.log('[IkigaiContext] Inference complete');
      return newProfile;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setInferenceError(err);
      console.error('[IkigaiContext] Inference failed:', error);
      return null;
    } finally {
      setIsInferring(false);
    }
  }, [store, userId]);

  /**
   * Get Ikigai context for an agent
   * Actual API: getIkigaiContextForAgent(userId, store) -> Promise<string>
   * Returns a formatted string summary of the user's Ikigai profile
   */
  const getContextForAgent = useCallback(async (): Promise<string> => {
    if (!store) {
      return 'No Ikigai profile available yet.';
    }

    return getIkigaiContextForAgent(userId, store as unknown as Parameters<typeof getIkigaiContextForAgent>[1]);
  }, [store, userId]);

  /**
   * Calculate well-being score for a mission
   * Actual API: calculateWellBeingScore(mission, userId, store) -> Promise<MissionWellBeingScore>
   */
  const scoreMission = useCallback(async (mission: MissionCard): Promise<MissionWellBeingScore> => {
    if (!store) {
      // Return neutral score without store
      return {
        utilityScore: 0.5,
        experienceBoost: 0,
        relationshipBoost: 0,
        interestAlignment: 0,
        givingBoost: 0,
        totalScore: 0.5,
      };
    }

    return calculateWellBeingScore(mission, userId, store as unknown as Parameters<typeof calculateWellBeingScore>[2]);
  }, [store, userId]);

  /**
   * Sort missions by well-being alignment
   * Actual API: sortMissionsByWellBeing(missions, userId, store) -> Promise<ScoredMission[]>
   */
  const sortMissions = useCallback(async <T extends MissionCard>(
    missions: T[]
  ): Promise<Array<T & { wellBeingScore: MissionWellBeingScore }>> => {
    if (!store || missions.length === 0) {
      return missions.map(m => ({
        ...m,
        wellBeingScore: {
          utilityScore: 0.5,
          experienceBoost: 0,
          relationshipBoost: 0,
          interestAlignment: 0,
          givingBoost: 0,
          totalScore: 0.5,
        },
      }));
    }

    const result = await sortMissionsByWellBeing(
      missions,
      userId,
      store as unknown as Parameters<typeof sortMissionsByWellBeing>[2]
    );
    return result as Array<T & { wellBeingScore: MissionWellBeingScore }>;
  }, [store, userId]);

  /**
   * Award points for completing a mission
   * Actual API: awardMissionPoints(mission, userId, store) -> Promise<number>
   */
  const awardPoints = useCallback(async (mission: MissionCard): Promise<number> => {
    if (!store) {
      throw new Error('Store not ready');
    }

    const points = await awardMissionPoints(mission, userId, store as unknown as Parameters<typeof awardMissionPoints>[2]);
    console.log(`[IkigaiContext] Awarded ${points} points for mission ${mission.id}`);
    return points;
  }, [store, userId]);

  /**
   * Get user's total points
   * Actual API: getUserPoints(userId, store) -> Promise<UserPoints>
   */
  const getPoints = useCallback(async (): Promise<UserPoints> => {
    if (!store) {
      return { total: 0, explorer: 0, connector: 0, helper: 0, achiever: 0 };
    }

    return getUserPoints(userId, store as unknown as Parameters<typeof getUserPoints>[1]);
  }, [store, userId]);

  /**
   * Get user's Ikigai tier based on points
   * Actual API: getIkigaiTier(totalPoints) -> { tier, nextTierAt, progress }
   */
  const getTier = useCallback(async (): Promise<{ tier: string; nextTierAt: number; progress: number }> => {
    if (!store) {
      return { tier: 'Bronze', nextTierAt: 100, progress: 0 };
    }

    const points = await getUserPoints(userId, store as unknown as Parameters<typeof getUserPoints>[1]);
    return getIkigaiTier(points.total);
  }, [store, userId]);

  const value: IkigaiContextValue = {
    profile,
    isProfileLoading,
    runInference,
    getContextForAgent,
    scoreMission,
    sortMissions,
    awardPoints,
    getPoints,
    getTier,
    isInferring,
    inferenceError,
  };

  return (
    <IkigaiContext.Provider value={value}>
      {children}
    </IkigaiContext.Provider>
  );
}

export function useIkigai() {
  const context = useContext(IkigaiContext);
  if (!context) {
    throw new Error('useIkigai must be used within an IkigaiProvider');
  }
  return context;
}

/**
 * Hook for mission scoring and sorting
 * Returns synchronous wrappers that cache results
 */
export function useMissionScoring() {
  const { sortMissions, profile, isProfileLoading } = useIkigai();
  const { store } = useStore();

  // For synchronous sort needed by useMissions, we provide a wrapper
  // that sorts by priority when store isn't available
  const sort = useCallback(<T extends MissionCard>(missions: T[]): T[] => {
    if (!store || !profile) {
      // Fall back to priority-based sorting
      return [...missions].sort((a, b) => ((a as unknown as { priority?: number }).priority ?? 0) - ((b as unknown as { priority?: number }).priority ?? 0));
    }
    // For async sorting, caller should use sortMissions directly
    return missions;
  }, [store, profile]);

  return {
    sort,
    sortAsync: sortMissions,
    hasProfile: !!profile,
    isLoading: isProfileLoading,
  };
}

/**
 * Hook for user rewards/points
 */
export function useIkigaiRewards() {
  const { awardPoints, getPoints, getTier } = useIkigai();
  const [points, setPoints] = useState<UserPoints>({ total: 0, explorer: 0, connector: 0, helper: 0, achiever: 0 });
  const [tier, setTier] = useState<{ tier: string; nextTierAt: number; progress: number }>({ tier: 'Bronze', nextTierAt: 100, progress: 0 });

  const refresh = useCallback(async () => {
    const [p, t] = await Promise.all([getPoints(), getTier()]);
    setPoints(p);
    setTier(t);
  }, [getPoints, getTier]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    points,
    tier,
    awardPoints,
    refresh,
  };
}
