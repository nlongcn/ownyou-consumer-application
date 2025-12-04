/**
 * Memory Tools Tests - v13 Section 8.8.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStore, InMemoryBackend, MockEmbeddingService } from '@ownyou/memory-store';
import { NS, type Memory, type Episode } from '@ownyou/shared-types';
import {
  saveObservation,
  saveEpisode,
  updateEpisodeWithFeedback,
  getEpisodesByAgent,
  searchMemories,
  invalidateMemory,
  revalidateMemory,
} from '../tools';

// Mock the local embedder to avoid loading the actual model in tests
vi.mock('../embedding/local-embedder', () => ({
  computeLocalEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  computeQueryEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  cosineSimilarity: vi.fn().mockReturnValue(0.8),
  EMBEDDING_CONFIG: { model: 'test', dimensions: 768, batchSize: 32 },
}));

describe('Memory Tools', () => {
  let store: MemoryStore;
  const userId = 'test-user';

  beforeEach(() => {
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      embeddingService: new MockEmbeddingService(),
    });
  });

  describe('saveObservation', () => {
    it('should save a new observation with default values', async () => {
      const result = await saveObservation(
        {
          content: 'User prefers aisle seats on flights',
          context: 'travel',
          confidence: 0.9,
        },
        { userId, store }
      );

      expect(result.action).toBe('created');
      expect(result.memoryId).toBeDefined();

      // Verify memory was stored
      const memory = await store.get<Memory>(NS.semanticMemory(userId), result.memoryId);
      expect(memory).not.toBeNull();
      expect(memory?.content).toBe('User prefers aisle seats on flights');
      expect(memory?.context).toBe('travel');
      expect(memory?.confidence).toBe(0.9);
      expect(memory?.strength).toBe(1.0);
      expect(memory?.privacyTier).toBe('public');
    });

    it('should respect custom privacy tier', async () => {
      const result = await saveObservation(
        {
          content: 'User has medical condition',
          context: 'health',
          confidence: 0.95,
          privacyTier: 'private',
        },
        { userId, store }
      );

      const memory = await store.get<Memory>(NS.semanticMemory(userId), result.memoryId);
      expect(memory?.privacyTier).toBe('private');
    });

    it('should link to episode when provided', async () => {
      const episodeId = 'ep-123';
      const result = await saveObservation(
        {
          content: 'User likes spicy food',
          context: 'dining',
          confidence: 0.85,
        },
        { userId, store, episodeId }
      );

      const memory = await store.get<Memory>(NS.semanticMemory(userId), result.memoryId);
      expect(memory?.sources).toContain(episodeId);
    });

    it('should set validAt to now if not provided', async () => {
      const before = Date.now();
      const result = await saveObservation(
        {
          content: 'Test observation',
          context: 'test',
          confidence: 0.5,
        },
        { userId, store }
      );
      const after = Date.now();

      const memory = await store.get<Memory>(NS.semanticMemory(userId), result.memoryId);
      expect(memory?.validAt).toBeGreaterThanOrEqual(before);
      expect(memory?.validAt).toBeLessThanOrEqual(after);
    });

    it('should use custom validAt when provided', async () => {
      const customTime = Date.now() - 86400000; // Yesterday
      const result = await saveObservation(
        {
          content: 'Test observation',
          context: 'test',
          confidence: 0.5,
          validAt: customTime,
        },
        { userId, store }
      );

      const memory = await store.get<Memory>(NS.semanticMemory(userId), result.memoryId);
      expect(memory?.validAt).toBe(customTime);
    });
  });

  describe('saveEpisode', () => {
    it('should save a new episode', async () => {
      const result = await saveEpisode(
        {
          situation: 'User wanted to find a hotel in Paris',
          reasoning: 'Searched for highly-rated hotels near Eiffel Tower',
          action: 'Recommended Hotel Le Marais with 4.8 rating',
          outcome: 'success',
        },
        { userId, agentType: 'shopping', missionId: 'mission-1', store }
      );

      expect(result.episodeId).toBeDefined();

      // Verify episode was stored
      const episode = await store.get<Episode>(NS.episodicMemory(userId), result.episodeId);
      expect(episode).not.toBeNull();
      expect(episode?.situation).toBe('User wanted to find a hotel in Paris');
      expect(episode?.outcome).toBe('success');
      expect(episode?.agentType).toBe('shopping');
      expect(episode?.missionId).toBe('mission-1');
      expect(episode?.tags).toContain('shopping');
      expect(episode?.tags).toContain('positive_outcome');
    });

    it('should include feedback when provided', async () => {
      const result = await saveEpisode(
        {
          situation: 'User asked for restaurant recommendation',
          reasoning: 'Found Italian restaurants nearby',
          action: 'Recommended Trattoria Roma',
          outcome: 'success',
          userFeedback: 'love',
        },
        { userId, agentType: 'restaurant', missionId: 'mission-2', store }
      );

      const episode = await store.get<Episode>(NS.episodicMemory(userId), result.episodeId);
      expect(episode?.userFeedback).toBe('love');
    });

    it('should tag negative outcomes correctly', async () => {
      const result = await saveEpisode(
        {
          situation: 'User wanted concert tickets',
          reasoning: 'Searched for available tickets',
          action: 'Found no available tickets',
          outcome: 'failure',
        },
        { userId, agentType: 'events', missionId: 'mission-3', store }
      );

      const episode = await store.get<Episode>(NS.episodicMemory(userId), result.episodeId);
      expect(episode?.tags).toContain('negative_outcome');
    });
  });

  describe('updateEpisodeWithFeedback', () => {
    it('should update episode with user feedback', async () => {
      // First create an episode
      const result = await saveEpisode(
        {
          situation: 'Test situation',
          reasoning: 'Test reasoning',
          action: 'Test action',
          outcome: 'pending',
        },
        { userId, agentType: 'shopping', missionId: 'mission-4', store }
      );

      // Update with feedback
      await updateEpisodeWithFeedback(result.episodeId, 'like', userId, store);

      // Verify
      const episode = await store.get<Episode>(NS.episodicMemory(userId), result.episodeId);
      expect(episode?.userFeedback).toBe('like');
      expect(episode?.outcome).toBe('success');
    });

    it('should mark meh feedback as failure', async () => {
      const result = await saveEpisode(
        {
          situation: 'Test situation',
          reasoning: 'Test reasoning',
          action: 'Test action',
          outcome: 'pending',
        },
        { userId, agentType: 'shopping', missionId: 'mission-5', store }
      );

      await updateEpisodeWithFeedback(result.episodeId, 'meh', userId, store);

      const episode = await store.get<Episode>(NS.episodicMemory(userId), result.episodeId);
      expect(episode?.userFeedback).toBe('meh');
      expect(episode?.outcome).toBe('failure');
    });

    it('should throw if episode not found', async () => {
      await expect(
        updateEpisodeWithFeedback('nonexistent', 'like', userId, store)
      ).rejects.toThrow('Episode not found');
    });
  });

  describe('getEpisodesByAgent', () => {
    it('should filter episodes by agent type', async () => {
      // Create episodes for different agents
      await saveEpisode(
        {
          situation: 'Shopping situation',
          reasoning: 'R',
          action: 'A',
          outcome: 'success',
        },
        { userId, agentType: 'shopping', missionId: 'm1', store }
      );

      await saveEpisode(
        {
          situation: 'Travel situation',
          reasoning: 'R',
          action: 'A',
          outcome: 'success',
        },
        { userId, agentType: 'travel', missionId: 'm2', store }
      );

      await saveEpisode(
        {
          situation: 'Another shopping',
          reasoning: 'R',
          action: 'A',
          outcome: 'success',
        },
        { userId, agentType: 'shopping', missionId: 'm3', store }
      );

      const shoppingEpisodes = await getEpisodesByAgent(userId, 'shopping', store);
      expect(shoppingEpisodes.length).toBe(2);
      expect(shoppingEpisodes.every((e) => e.agentType === 'shopping')).toBe(true);

      const travelEpisodes = await getEpisodesByAgent(userId, 'travel', store);
      expect(travelEpisodes.length).toBe(1);
    });
  });

  describe('invalidateMemory', () => {
    it('should mark memory as invalid with reason', async () => {
      // Create a memory
      const result = await saveObservation(
        {
          content: 'User lives in Paris',
          context: 'location',
          confidence: 0.9,
        },
        { userId, store }
      );

      // Invalidate it
      await invalidateMemory(
        { memoryId: result.memoryId, reason: 'User moved to London' },
        { userId, store }
      );

      // Verify
      const memory = await store.get<Memory & { invalidationReason?: string }>(
        NS.semanticMemory(userId),
        result.memoryId
      );
      expect(memory?.invalidAt).toBeDefined();
      expect(memory?.invalidationReason).toBe('User moved to London');
    });

    it('should throw if memory not found', async () => {
      await expect(
        invalidateMemory({ memoryId: 'nonexistent', reason: 'test' }, { userId, store })
      ).rejects.toThrow('Memory not found');
    });
  });

  describe('revalidateMemory', () => {
    it('should restore previously invalidated memory', async () => {
      // Create and invalidate a memory
      const result = await saveObservation(
        {
          content: 'User likes coffee',
          context: 'preferences',
          confidence: 0.8,
        },
        { userId, store }
      );

      await invalidateMemory(
        { memoryId: result.memoryId, reason: 'Thought they switched to tea' },
        { userId, store }
      );

      // Revalidate
      await revalidateMemory(result.memoryId, { userId, store });

      // Verify
      const memory = await store.get<Memory>(NS.semanticMemory(userId), result.memoryId);
      expect(memory?.invalidAt).toBeUndefined();
      expect(memory?.sources.some((s) => s.startsWith('revalidated:'))).toBe(true);
    });
  });

  describe('searchMemories', () => {
    it('should return scored memories', async () => {
      // Create some memories
      await saveObservation(
        { content: 'User prefers window seats', context: 'travel', confidence: 0.9 },
        { userId, store }
      );
      await saveObservation(
        { content: 'User likes aisle seats sometimes', context: 'travel', confidence: 0.7 },
        { userId, store }
      );
      await saveObservation(
        { content: 'User favorite food is pizza', context: 'dining', confidence: 0.95 },
        { userId, store }
      );

      const results = await searchMemories(
        { query: 'seat preferences for flying', limit: 5 },
        { userId, store }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].finalScore).toBeDefined();
      expect(results[0].matchType).toBeDefined();
    });

    it('should filter by context when provided', async () => {
      await saveObservation(
        { content: 'Travel memory', context: 'travel', confidence: 0.9 },
        { userId, store }
      );
      await saveObservation(
        { content: 'Dining memory', context: 'dining', confidence: 0.9 },
        { userId, store }
      );

      const results = await searchMemories(
        { query: 'memory', context: 'travel', limit: 10 },
        { userId, store }
      );

      // Should only return travel context (or general)
      results.forEach((r) => {
        expect(['travel', 'general']).toContain(r.context);
      });
    });
  });
});
