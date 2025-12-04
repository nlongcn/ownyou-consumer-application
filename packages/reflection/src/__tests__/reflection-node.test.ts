/**
 * Reflection Node Tests - v13 Section 8.10
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStore, InMemoryBackend, MockEmbeddingService } from '@ownyou/memory-store';
import { NS, type Episode } from '@ownyou/shared-types';
import { saveObservation, saveEpisode } from '@ownyou/memory';
import {
  runReflection,
  shouldTriggerReflection,
  DEFAULT_REFLECTION_CONFIG,
  createNegativeFeedbackTrigger,
} from '../reflection-node';

// Mock LLM client
const mockLLM = {
  complete: vi.fn().mockResolvedValue({ content: '[]' }),
};

// Mock the local embedder
vi.mock('@ownyou/memory', async () => {
  const actual = await vi.importActual('@ownyou/memory');
  return {
    ...actual,
    computeLocalEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
    computeQueryEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  };
});

describe('Reflection Node', () => {
  let store: MemoryStore;
  const userId = 'test-user';

  beforeEach(() => {
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      embeddingService: new MockEmbeddingService(),
    });
    vi.clearAllMocks();
  });

  describe('runReflection', () => {
    it('should run reflection and return results', async () => {
      // Create some test data
      await saveObservation(
        { content: 'User prefers window seats', context: 'travel', confidence: 0.9 },
        { userId, store }
      );

      const result = await runReflection(
        userId,
        { type: 'after_episodes', count: 5 },
        store,
        mockLLM as any
      );

      expect(result).toBeDefined();
      expect(result.trigger.type).toBe('after_episodes');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.memoriesPruned).toBe('number');
      expect(typeof result.rulesGenerated).toBe('number');
      expect(typeof result.factsInvalidated).toBe('number');
      expect(typeof result.entitiesExtracted).toBe('number');
    });

    it('should handle empty store gracefully', async () => {
      const result = await runReflection(
        userId,
        { type: 'daily_idle' },
        store,
        mockLLM as any
      );

      expect(result).toBeDefined();
      expect(result.memoriesPruned).toBe(0);
      expect(result.rulesGenerated).toBe(0);
    });

    it('should process negative feedback trigger', async () => {
      const result = await runReflection(
        userId,
        { type: 'after_negative_feedback', episodeId: 'ep-123' },
        store,
        mockLLM as any
      );

      expect(result.trigger.type).toBe('after_negative_feedback');
    });
  });

  describe('shouldTriggerReflection', () => {
    it('should trigger after episode threshold', () => {
      const result = shouldTriggerReflection(5, DEFAULT_REFLECTION_CONFIG);

      expect(result.shouldRun).toBe(true);
      expect(result.trigger?.type).toBe('after_episodes');
    });

    it('should not trigger below threshold', () => {
      const result = shouldTriggerReflection(3, DEFAULT_REFLECTION_CONFIG);

      expect(result.shouldRun).toBe(false);
    });

    it('should use custom config', () => {
      const customConfig = { ...DEFAULT_REFLECTION_CONFIG, afterEpisodes: 10 };
      const result = shouldTriggerReflection(7, customConfig);

      expect(result.shouldRun).toBe(false);
    });
  });

  describe('createNegativeFeedbackTrigger', () => {
    it('should create correct trigger type', () => {
      const trigger = createNegativeFeedbackTrigger('ep-456');

      expect(trigger.type).toBe('after_negative_feedback');
      expect(trigger.episodeId).toBe('ep-456');
    });
  });
});
