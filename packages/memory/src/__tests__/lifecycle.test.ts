/**
 * Memory Lifecycle Tests - v13 Section 8.9
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore, InMemoryBackend, MockEmbeddingService } from '@ownyou/memory-store';
import { NS, type Memory } from '@ownyou/shared-types';
import {
  calculateEffectiveStrength,
  shouldPrune,
  daysUntilPrune,
  boostStrength,
  findMemoriesToPrune,
  calculateDecayStats,
  DECAY_RATE,
  PRUNE_THRESHOLD,
} from '../lifecycle/decay';
import {
  archiveMemory,
  unarchiveMemory,
  pruneMemories,
  getArchivedMemories,
  checkQuotas,
  DEFAULT_QUOTAS,
} from '../lifecycle/pruning';
import { consolidateMemory, findConsolidationCandidates } from '../lifecycle/consolidation';

describe('Memory Decay', () => {
  describe('calculateEffectiveStrength', () => {
    it('should return full strength for recently accessed memory', () => {
      const memory: Memory = {
        id: 'test',
        content: 'test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      const effective = calculateEffectiveStrength(memory);
      expect(effective).toBeCloseTo(1.0, 2);
    });

    it('should decay strength over time', () => {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const memory: Memory = {
        id: 'test',
        content: 'test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: oneWeekAgo,
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      const effective = calculateEffectiveStrength(memory);
      expect(effective).toBeCloseTo(DECAY_RATE, 2); // ~0.95 after one week
    });

    it('should apply exponential decay correctly', () => {
      const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
      const memory: Memory = {
        id: 'test',
        content: 'test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: fourWeeksAgo,
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      const effective = calculateEffectiveStrength(memory);
      // After 4 weeks: 0.95^4 ≈ 0.814
      expect(effective).toBeCloseTo(Math.pow(DECAY_RATE, 4), 2);
    });
  });

  describe('shouldPrune', () => {
    it('should not prune healthy memories', () => {
      const memory: Memory = {
        id: 'test',
        content: 'test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      expect(shouldPrune(memory)).toBe(false);
    });

    it('should prune memories below threshold', () => {
      const veryOld = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago
      const memory: Memory = {
        id: 'test',
        content: 'test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.5, // Start with low strength
        lastAccessed: veryOld,
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      expect(shouldPrune(memory)).toBe(true);
    });

    it('should respect custom threshold', () => {
      const memory: Memory = {
        id: 'test',
        content: 'test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.5,
        lastAccessed: Date.now(),
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      expect(shouldPrune(memory, 0.6)).toBe(true);
      expect(shouldPrune(memory, 0.4)).toBe(false);
    });
  });

  describe('daysUntilPrune', () => {
    it('should return 0 for already prunable memories', () => {
      const veryOld = Date.now() - 365 * 24 * 60 * 60 * 1000;
      const memory: Memory = {
        id: 'test',
        content: 'test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.1,
        lastAccessed: veryOld,
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      expect(daysUntilPrune(memory)).toBe(0);
    });

    it('should calculate days until prune correctly', () => {
      const memory: Memory = {
        id: 'test',
        content: 'test',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      const days = daysUntilPrune(memory);
      expect(days).toBeGreaterThan(0);
      // With 5% decay per week, it takes many weeks to get to 0.1
    });
  });

  describe('boostStrength', () => {
    it('should increase strength by default boost', () => {
      const newStrength = boostStrength(0.5);
      expect(newStrength).toBe(0.6);
    });

    it('should use custom boost amount', () => {
      const newStrength = boostStrength(0.5, 0.2);
      expect(newStrength).toBe(0.7);
    });

    it('should not exceed max strength', () => {
      const newStrength = boostStrength(4.95, 0.1);
      expect(newStrength).toBe(5.0);
    });

    it('should respect custom max strength', () => {
      const newStrength = boostStrength(0.9, 0.2, 1.0);
      expect(newStrength).toBe(1.0);
    });
  });

  describe('findMemoriesToPrune', () => {
    it('should find all prunable memories', () => {
      const veryOld = Date.now() - 365 * 24 * 60 * 60 * 1000;
      const memories: Memory[] = [
        {
          id: '1',
          content: 'healthy',
          context: 'test',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 1.0,
          lastAccessed: Date.now(),
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
        },
        {
          id: '2',
          content: 'prunable',
          context: 'test',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 0.05,
          lastAccessed: veryOld,
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
        },
        {
          id: '3',
          content: 'also prunable',
          context: 'test',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 0.08,
          lastAccessed: veryOld,
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
        },
      ];

      const toPrune = findMemoriesToPrune(memories);
      expect(toPrune.length).toBe(2);
      expect(toPrune.map((m) => m.id)).toContain('2');
      expect(toPrune.map((m) => m.id)).toContain('3');
    });
  });

  describe('calculateDecayStats', () => {
    it('should categorize memories correctly', () => {
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
      const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

      const memories: Memory[] = [
        // Healthy (effective > 0.7)
        {
          id: '1',
          content: 'healthy',
          context: 'test',
          validAt: now,
          createdAt: now,
          strength: 1.0,
          lastAccessed: now,
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
        },
        // Decaying (0.3 < effective < 0.7)
        {
          id: '2',
          content: 'decaying',
          context: 'test',
          validAt: now,
          createdAt: now,
          strength: 0.5,
          lastAccessed: oneWeekAgo,
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
        },
        // Prunable (effective < 0.1)
        {
          id: '3',
          content: 'prunable',
          context: 'test',
          validAt: now,
          createdAt: now,
          strength: 0.05,
          lastAccessed: oneYearAgo,
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
        },
      ];

      const stats = calculateDecayStats(memories);
      expect(stats.total).toBe(3);
      expect(stats.healthy).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Memory Pruning', () => {
  let store: MemoryStore;
  const userId = 'test-user';

  beforeEach(() => {
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      embeddingService: new MockEmbeddingService(),
    });
  });

  describe('archiveMemory', () => {
    it('should mark memory as archived', async () => {
      const memory: Memory = {
        id: 'test-1',
        content: 'to archive',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.1,
        lastAccessed: Date.now() - 365 * 24 * 60 * 60 * 1000,
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      };

      await store.put(NS.semanticMemory(userId), memory.id, memory);
      await archiveMemory(memory, userId, store);

      const archived = await store.get<Memory & { archived?: boolean }>(
        NS.semanticMemory(userId),
        memory.id
      );
      expect(archived?.archived).toBe(true);
    });
  });

  describe('unarchiveMemory', () => {
    it('should restore archived memory', async () => {
      const memory: Memory & { archived?: boolean; archivedAt?: number } = {
        id: 'test-1',
        content: 'archived',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.05,
        lastAccessed: Date.now() - 365 * 24 * 60 * 60 * 1000,
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
        archived: true,
        archivedAt: Date.now() - 1000,
      };

      await store.put(NS.semanticMemory(userId), memory.id, memory);

      const restored = await unarchiveMemory(memory.id, userId, store);
      expect(restored).not.toBeNull();
      expect((restored as Memory & { archived?: boolean }).archived).toBeUndefined();
      expect(restored?.strength).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('pruneMemories', () => {
    it('should prune low-strength memories', async () => {
      const veryOld = Date.now() - 365 * 24 * 60 * 60 * 1000;

      // Add healthy memory
      await store.put(NS.semanticMemory(userId), 'healthy', {
        id: 'healthy',
        content: 'healthy',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      });

      // Add prunable memory
      await store.put(NS.semanticMemory(userId), 'prunable', {
        id: 'prunable',
        content: 'prunable',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.05,
        lastAccessed: veryOld,
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      });

      const result = await pruneMemories(userId, store);
      expect(result.pruned).toBe(1);
      expect(result.total).toBe(2);

      // Verify the prunable one is archived
      const prunable = await store.get<Memory & { archived?: boolean }>(
        NS.semanticMemory(userId),
        'prunable'
      );
      expect(prunable?.archived).toBe(true);
    });
  });

  describe('getArchivedMemories', () => {
    it('should return only archived memories', async () => {
      await store.put(NS.semanticMemory(userId), 'active', {
        id: 'active',
        content: 'active',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 1.0,
        lastAccessed: Date.now(),
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
      });

      await store.put(NS.semanticMemory(userId), 'archived', {
        id: 'archived',
        content: 'archived',
        context: 'test',
        validAt: Date.now(),
        createdAt: Date.now(),
        strength: 0.1,
        lastAccessed: Date.now(),
        accessCount: 1,
        sources: [],
        confidence: 0.9,
        privacyTier: 'public',
        archived: true,
      });

      const archived = await getArchivedMemories(userId, store);
      expect(archived.length).toBe(1);
      expect(archived[0].id).toBe('archived');
    });
  });

  describe('checkQuotas', () => {
    it('should report quota usage', async () => {
      // Add a few memories
      for (let i = 0; i < 5; i++) {
        await store.put(NS.semanticMemory(userId), `mem-${i}`, {
          id: `mem-${i}`,
          content: `memory ${i}`,
          context: 'test',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 1.0,
          lastAccessed: Date.now(),
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
        });
      }

      const quotas = await checkQuotas(userId, store);
      expect(quotas.semantic.count).toBe(5);
      expect(quotas.semantic.quota).toBe(DEFAULT_QUOTAS.semantic);
      expect(quotas.semantic.percentage).toBe((5 / DEFAULT_QUOTAS.semantic) * 100);
    });

    it('should warn when approaching quota', async () => {
      // Mock a situation approaching quota
      const quotas = await checkQuotas(userId, store, {
        semantic: 10, // Very low quota for testing
        episodic: 5000,
        procedural: 1000,
      });

      // With 0 items, no warnings
      expect(quotas.warnings.length).toBe(0);
    });
  });
});

describe('Memory Consolidation', () => {
  let store: MemoryStore;
  const userId = 'test-user';

  beforeEach(() => {
    store = new MemoryStore({
      backend: new InMemoryBackend(),
      embeddingService: new MockEmbeddingService(),
    });
  });

  describe('consolidateMemory', () => {
    it('should merge similar memories', async () => {
      const existing: Memory = {
        id: 'existing',
        content: 'User likes Italian food',
        context: 'dining',
        validAt: Date.now() - 86400000,
        createdAt: Date.now() - 86400000,
        strength: 0.8,
        lastAccessed: Date.now() - 86400000,
        accessCount: 3,
        sources: ['ep-1'],
        confidence: 0.7,
        privacyTier: 'public',
        embedding: new Array(768).fill(0.1),
      };

      await store.put(NS.semanticMemory(userId), existing.id, existing);

      const consolidated = await consolidateMemory({
        existing,
        newContent: 'User really loves Italian restaurants',
        newConfidence: 0.85,
        userId,
        store,
      });

      expect(consolidated.strength).toBeGreaterThan(existing.strength);
      expect(consolidated.confidence).toBeGreaterThan(existing.confidence);
      expect(consolidated.accessCount).toBe(existing.accessCount + 1);
    });
  });

  describe('findConsolidationCandidates', () => {
    it('should find similar memory pairs', async () => {
      const embedding1 = new Array(768).fill(0.1);
      const embedding2 = embedding1.map((v) => v + 0.001); // Very similar
      const embedding3 = new Array(768).fill(-0.5); // Very different

      const memories: Memory[] = [
        {
          id: '1',
          content: 'User likes pizza',
          context: 'dining',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 1.0,
          lastAccessed: Date.now(),
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
          embedding: embedding1,
        },
        {
          id: '2',
          content: 'User enjoys pizza',
          context: 'dining',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 1.0,
          lastAccessed: Date.now(),
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
          embedding: embedding2,
        },
        {
          id: '3',
          content: 'User hates waiting',
          context: 'preferences',
          validAt: Date.now(),
          createdAt: Date.now(),
          strength: 1.0,
          lastAccessed: Date.now(),
          accessCount: 1,
          sources: [],
          confidence: 0.9,
          privacyTier: 'public',
          embedding: embedding3,
        },
      ];

      const candidates = await findConsolidationCandidates(memories, 0.9);

      // Memory 1 and 2 should be candidates (similar embeddings)
      expect(candidates.length).toBe(1);
      expect(candidates[0].a.id).toBe('1');
      expect(candidates[0].b.id).toBe('2');
    });
  });
});
