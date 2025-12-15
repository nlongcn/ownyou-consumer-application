/**
 * MemoryContext - Provides memory tools to agents and triggers reflection
 *
 * Sprint 11a: Wires @ownyou/memory and @ownyou/reflection to consumer app
 * v13 Section 8 - Memory Architecture
 *
 * ACTUAL EXPORTS from @ownyou/memory (verified from source):
 * - saveObservation(params: SaveObservationParams, context: SaveObservationContext)
 *   context = { userId, episodeId?, store }
 * - saveEpisode(params: SaveEpisodeParams, context: SaveEpisodeContext)
 *   context = { userId, agentType, missionId, store }
 * - updateEpisodeWithFeedback(episodeId, feedback, userId, store)
 * - searchMemories(params, context) context = { userId, store, requestingAgent? }
 * - countEpisodesSinceReflection(userId, store, lastReflectionTime)
 *
 * ACTUAL EXPORTS from @ownyou/reflection:
 * - ReflectionTriggerManager(userId, store, llm, config?) - llm is REQUIRED
 * - buildAgentContext(userId, agentType, userQuery, store)
 * - createEnrichedSystemPrompt(basePrompt, context)
 * - AgentContext = { semanticMemories, similarEpisodes, proceduralRules }
 */

import { createContext, useContext, useCallback, useRef, useEffect, useState, type ReactNode } from 'react';
import type { AgentType } from '@ownyou/shared-types';
import {
  saveObservation,
  saveEpisode,
  updateEpisodeWithFeedback,
  searchMemories,
  type SaveObservationParams,
  type SaveEpisodeParams,
  type SaveEpisodeContext,
  type ScoredMemory,
} from '@ownyou/memory';
import {
  ReflectionTriggerManager,
  buildAgentContext,
  createEnrichedSystemPrompt,
  type ReflectionResult,
  type AgentContext,
  type TriggerState,
} from '@ownyou/reflection';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';

/**
 * LLM client interface for reflection operations
 * Matches the LLMClient type from @ownyou/llm-client
 */
interface LLMClient {
  complete: (options: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }) => Promise<{ content: string }>;
}

interface MemoryContextValue {
  /** Search for relevant memories using hybrid retrieval */
  search: (query: string, context?: string, limit?: number) => Promise<ScoredMemory[]>;

  /** Save a new observation (semantic memory) */
  saveObs: (params: SaveObservationParams, episodeId?: string) => Promise<string>;

  /** Save a new episode (interaction record) - requires agentType and missionId */
  saveEp: (params: SaveEpisodeParams, agentType: AgentType, missionId: string) => Promise<string>;

  /** Update episode with user feedback (triggers reflection check) */
  recordFeedback: (episodeId: string, feedback: 'love' | 'like' | 'meh') => Promise<void>;

  /** Build context for an agent with memory + procedural rules */
  getAgentContext: (agentType: AgentType, userQuery: string) => Promise<AgentContext>;

  /** Create enriched system prompt with memory context */
  enrichPrompt: (basePrompt: string, context: AgentContext) => string;

  /** Check scheduled reflection triggers (daily/weekly) */
  checkScheduledTriggers: () => Promise<ReflectionResult | null>;

  /** Get trigger state for monitoring */
  getTriggerState: () => TriggerState | null;

  /** Whether reflection system is initialized */
  isReady: boolean;
}

const MemoryContext = createContext<MemoryContextValue | null>(null);

/**
 * Mock LLM client for development/testing
 * Returns empty responses - real inference requires real LLM
 */
const mockLLMClient: LLMClient = {
  async complete() {
    return { content: '{}' };
  },
};

interface MemoryProviderProps {
  children: ReactNode;
  /** Optional LLM client for reflection (uses mock if not provided) */
  llmClient?: LLMClient;
}

export function MemoryProvider({ children, llmClient }: MemoryProviderProps) {
  const { store, isReady: storeReady } = useStore();
  const { wallet, isAuthenticated } = useAuth();
  const userId = wallet?.address ?? 'anonymous';

  // ReflectionTriggerManager manages when reflection runs
  const triggerManagerRef = useRef<ReflectionTriggerManager | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize ReflectionTriggerManager when store is ready
  useEffect(() => {
    if (!storeReady || !isAuthenticated || !store) {
      setIsReady(false);
      return;
    }

    // Create the trigger manager
    // Actual API: ReflectionTriggerManager(userId, store, llm, config?)
    // llm is REQUIRED - pass mock for development
    const llm = llmClient ?? mockLLMClient;
    triggerManagerRef.current = new ReflectionTriggerManager(
      userId,
      store as unknown as ConstructorParameters<typeof ReflectionTriggerManager>[1],
      llm as unknown as ConstructorParameters<typeof ReflectionTriggerManager>[2],
      {
        afterEpisodes: 5,           // Run after 5 episodes
        dailyIdleHour: 3,           // Run at 3 AM
        weeklyMaintenanceDay: 0,    // Run on Sunday (0 = Sunday)
      }
    );

    // Load saved state (episode count, last reflection time, etc.)
    triggerManagerRef.current.loadState()
      .then(() => {
        setIsReady(true);
        console.log('[MemoryContext] Reflection trigger manager initialized');
      })
      .catch(err => {
        console.error('[MemoryContext] Failed to load reflection state:', err);
      });

    return () => {
      triggerManagerRef.current = null;
      setIsReady(false);
    };
  }, [storeReady, isAuthenticated, store, userId, llmClient]);

  /**
   * Search for relevant memories
   * Actual API: searchMemories(params, context) where context = { userId, store, requestingAgent? }
   */
  const search = useCallback(async (
    query: string,
    context?: string,
    limit = 10
  ): Promise<ScoredMemory[]> => {
    if (!store || !storeReady) return [];

    return searchMemories(
      { query, context, limit },
      { userId, store: store as Parameters<typeof searchMemories>[1]['store'] }
    );
  }, [store, storeReady, userId]);

  /**
   * Save a new observation (semantic memory)
   * Actual API: saveObservation(params, { userId, episodeId?, store })
   */
  const saveObs = useCallback(async (
    params: SaveObservationParams,
    episodeId?: string
  ): Promise<string> => {
    if (!store || !storeReady) throw new Error('Store not ready');

    const result = await saveObservation(params, {
      userId,
      episodeId,
      store: store as Parameters<typeof saveObservation>[1]['store'],
    });
    return result.memoryId;
  }, [store, storeReady, userId]);

  /**
   * Save a new episode (interaction record)
   * Actual API: saveEpisode(params, { userId, agentType, missionId, store })
   */
  const saveEp = useCallback(async (
    params: SaveEpisodeParams,
    agentType: AgentType,
    missionId: string
  ): Promise<string> => {
    if (!store || !storeReady) throw new Error('Store not ready');

    const context: SaveEpisodeContext = {
      userId,
      agentType,
      missionId,
      store: store as SaveEpisodeContext['store'],
    };

    const result = await saveEpisode(params, context);

    // Check if we should trigger reflection after saving episode
    if (triggerManagerRef.current) {
      const reflectionResult = await triggerManagerRef.current.onEpisodeSaved();
      if (reflectionResult) {
        console.log('[MemoryContext] Reflection ran after episode threshold:', reflectionResult);
      }
    }

    return result.episodeId;
  }, [store, storeReady, userId]);

  /**
   * Record user feedback on a mission/episode
   * Actual API: updateEpisodeWithFeedback(episodeId, feedback, userId, store)
   * Triggers immediate reflection for 'meh' (negative) feedback
   */
  const recordFeedback = useCallback(async (
    episodeId: string,
    feedback: 'love' | 'like' | 'meh'
  ): Promise<void> => {
    if (!store || !storeReady) throw new Error('Store not ready');

    // Update the episode with feedback
    await updateEpisodeWithFeedback(
      episodeId,
      feedback,
      userId,
      store as Parameters<typeof updateEpisodeWithFeedback>[3]
    );

    // Check if we should trigger immediate reflection for negative feedback
    if (triggerManagerRef.current && feedback === 'meh') {
      console.log('[MemoryContext] Triggering reflection due to negative feedback');
      const result = await triggerManagerRef.current.onNegativeFeedback(episodeId);
      console.log('[MemoryContext] Reflection completed:', result);
    }
  }, [store, storeReady, userId]);

  /**
   * Build context for an agent with memory + procedural rules
   * Actual API: buildAgentContext(userId, agentType, userQuery, store)
   * Returns: { semanticMemories, similarEpisodes, proceduralRules }
   */
  const getAgentContext = useCallback(async (
    agentType: AgentType,
    userQuery: string
  ): Promise<AgentContext> => {
    if (!store) {
      return {
        semanticMemories: [],
        similarEpisodes: [],
        proceduralRules: [],
      };
    }

    return buildAgentContext(
      userId,
      agentType,
      userQuery,
      store as Parameters<typeof buildAgentContext>[3]
    );
  }, [store, userId]);

  /**
   * Create enriched system prompt with memory context
   * Injects relevant memories and procedural rules into agent prompt
   */
  const enrichPrompt = useCallback((
    basePrompt: string,
    context: AgentContext
  ): string => {
    return createEnrichedSystemPrompt(basePrompt, context);
  }, []);

  /**
   * Check scheduled reflection triggers (daily/weekly)
   * Call this periodically (e.g., every hour) to run scheduled reflection
   */
  const checkScheduledTriggers = useCallback(async (): Promise<ReflectionResult | null> => {
    if (!triggerManagerRef.current) return null;
    return triggerManagerRef.current.checkScheduledTriggers();
  }, []);

  /**
   * Get trigger state for monitoring
   */
  const getTriggerState = useCallback((): TriggerState | null => {
    if (!triggerManagerRef.current) return null;
    return triggerManagerRef.current.getState();
  }, []);

  const value: MemoryContextValue = {
    search,
    saveObs,
    saveEp,
    recordFeedback,
    getAgentContext,
    enrichPrompt,
    checkScheduledTriggers,
    getTriggerState,
    isReady: isReady && storeReady && isAuthenticated,
  };

  return (
    <MemoryContext.Provider value={value}>
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemory() {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemory must be used within a MemoryProvider');
  }
  return context;
}

/**
 * Hook for agents to get personalized context
 * Combines memory search with procedural rules
 */
export function useAgentMemory(agentType: AgentType) {
  const { getAgentContext, enrichPrompt, search, isReady } = useMemory();

  const getContext = useCallback(async (userQuery: string) => {
    return getAgentContext(agentType, userQuery);
  }, [agentType, getAgentContext]);

  const searchRelevant = useCallback(async (query: string) => {
    return search(query, agentType);
  }, [agentType, search]);

  return {
    getContext,
    enrichPrompt,
    searchRelevant,
    isReady,
  };
}
