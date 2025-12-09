import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { HeartState } from '@ownyou/ui-components';

interface FeedbackEntry {
  missionId: string;
  state: HeartState;
  timestamp: number;
  source: 'explicit_tap' | 'implicit';
}

// In-memory store for development - replace with LangGraph Store
const feedbackStore = new Map<string, FeedbackEntry>();

async function saveFeedback(entry: FeedbackEntry): Promise<void> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // In production, this would write to the LangGraph Store
  // ALWAYS write, including 'meh' state (per v13 compliance)
  // const store = await getStore();
  // await store.put(NS.missionsFeedback(userId), entry.missionId, entry);

  feedbackStore.set(entry.missionId, entry);
}

export function useFeedback() {
  const queryClient = useQueryClient();
  const [localState, setLocalState] = useState<Map<string, HeartState>>(new Map());

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
    // Check local state first, then persisted state
    if (localState.has(missionId)) {
      return localState.get(missionId)!;
    }

    const stored = feedbackStore.get(missionId);
    return stored?.state ?? 'meh';
  }, [localState]);

  return {
    updateFeedback,
    getFeedbackState,
    isUpdating: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
