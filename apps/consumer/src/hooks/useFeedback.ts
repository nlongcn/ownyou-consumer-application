/**
 * useFeedback Hook - Manages mission feedback state
 * v13 Section 4.5 - Mission Card Specifications
 *
 * Handles feedback state (meh/like/love) for missions.
 * Data persists to LangGraph Store when ready, with fallback for testing.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { HeartState } from '@ownyou/ui-components';
import { NS } from '@ownyou/shared-types';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { useMemory } from '../contexts/MemoryContext';

interface FeedbackEntry {
  missionId: string;
  state: HeartState;
  timestamp: number;
  source: 'explicit_tap' | 'implicit';
}

// Fallback in-memory store for when store is not ready or for testing
const fallbackStore = new Map<string, FeedbackEntry>();

export function useFeedback() {
  const queryClient = useQueryClient();
  const { wallet } = useAuth();
  const { store, isReady: storeReady } = useStore();
  const { recordFeedback, isReady: memoryReady } = useMemory();
  const [localState, setLocalState] = useState<Map<string, HeartState>>(new Map());
  const loadedRef = useRef(false);
  const syncedFallbackRef = useRef(false);

  // Sync fallback data to store when it becomes ready
  useEffect(() => {
    if (!storeReady || !store || !wallet || syncedFallbackRef.current) return;
    if (fallbackStore.size === 0) {
      syncedFallbackRef.current = true;
      return;
    }

    const syncFallbackToStore = async () => {
      try {
        const namespace = NS.missionFeedback(wallet.address);

        // Sync all fallback entries to the persistent store
        for (const [missionId, entry] of fallbackStore.entries()) {
          await store.put(namespace, missionId, entry);
        }

        // Clear fallback store after successful sync
        fallbackStore.clear();
        syncedFallbackRef.current = true;

        console.log('Synced fallback feedback to persistent store');
      } catch (error) {
        console.error('Failed to sync fallback feedback:', error);
      }
    };

    syncFallbackToStore();
  }, [storeReady, store, wallet]);

  // Load persisted feedback on mount when store is ready
  useEffect(() => {
    if (!storeReady || !store || !wallet || loadedRef.current) return;

    const loadFeedback = async () => {
      try {
        const namespace = NS.missionFeedback(wallet.address);
        const result = await store.list<FeedbackEntry>(namespace, { limit: 1000, offset: 0 });

        if (result.items.length > 0) {
          const loaded = new Map<string, HeartState>();
          for (const item of result.items) {
            // Item is the entry directly from store.list
            const entry = item as unknown as FeedbackEntry;
            if (entry.missionId && entry.state) {
              loaded.set(entry.missionId, entry.state);
            }
          }
          setLocalState(loaded);
        }
        loadedRef.current = true;
      } catch (error) {
        console.error('Failed to load feedback:', error);
      }
    };

    loadFeedback();
  }, [storeReady, store, wallet]);

  const saveFeedback = useCallback(async (entry: FeedbackEntry): Promise<void> => {
    // v13 compliance: ALWAYS write feedback, including 'meh' state
    if (storeReady && store && wallet) {
      // Write to LangGraph Store
      const namespace = NS.missionFeedback(wallet.address);
      await store.put(namespace, entry.missionId, entry);

      // Trigger reflection via MemoryContext for episodic learning
      // recordFeedback triggers immediate reflection for 'meh' (negative) feedback
      if (memoryReady) {
        try {
          await recordFeedback(entry.missionId, entry.state);
        } catch (error) {
          // Don't fail the feedback save if reflection fails
          console.warn('[useFeedback] recordFeedback failed:', error);
        }
      }
    } else {
      // Fallback to in-memory store (for tests or before auth)
      fallbackStore.set(entry.missionId, entry);
    }
  }, [store, storeReady, wallet, memoryReady, recordFeedback]);

  const mutation = useMutation({
    mutationFn: saveFeedback,
    onSuccess: () => {
      // Invalidate missions query to reflect feedback changes
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });

  const updateFeedback = useCallback((missionId: string, state: HeartState) => {
    // Update local state immediately for responsive UI
    setLocalState(prev => {
      const next = new Map(prev);
      next.set(missionId, state);
      return next;
    });

    // ALWAYS write feedback, including 'meh' state (v13 compliance)
    mutation.mutate({
      missionId,
      state,
      timestamp: Date.now(),
      source: 'explicit_tap',
    });
  }, [mutation]);

  const getFeedbackState = useCallback((missionId: string): HeartState => {
    // Check local state first
    if (localState.has(missionId)) {
      return localState.get(missionId)!;
    }

    // Check fallback store (for non-authenticated state)
    const stored = fallbackStore.get(missionId);
    return stored?.state ?? 'meh';
  }, [localState]);

  return {
    updateFeedback,
    getFeedbackState,
    isUpdating: mutation.isPending,
    error: mutation.error as Error | null,
    /** Whether feedback data has been loaded from store */
    isLoaded: loadedRef.current,
  };
}
