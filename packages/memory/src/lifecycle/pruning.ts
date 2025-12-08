/**
 * Memory Pruning - v13 Section 8.9.3
 *
 * Archive low-strength memories to maintain system performance.
 * Archived memories are not deleted - they can be recovered.
 */

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS, NAMESPACES } from '@ownyou/shared-types';
import { calculateEffectiveStrength, PRUNE_THRESHOLD } from './decay';

/**
 * Archive a single memory
 */
export async function archiveMemory(
  memory: Memory,
  userId: string,
  store: MemoryStore
): Promise<void> {
  // Mark as archived
  const archivedMemory = {
    ...memory,
    archived: true,
    archivedAt: Date.now(),
  };

  // Update in place (keep in same namespace but mark as archived)
  await store.put(NS.semanticMemory(userId), memory.id, archivedMemory);
}

/**
 * Unarchive a memory
 */
export async function unarchiveMemory(
  memoryId: string,
  userId: string,
  store: MemoryStore
): Promise<Memory | null> {
  const memory = await store.get<Memory & { archived?: boolean; archivedAt?: number }>(
    NS.semanticMemory(userId),
    memoryId
  );

  if (!memory || !memory.archived) {
    return null;
  }

  // Remove archive markers and boost strength
  const restored: Memory = {
    ...memory,
    strength: Math.max(memory.strength, 0.3), // Give it a fighting chance
    lastAccessed: Date.now(),
  };

  // Remove archive properties
  delete (restored as Memory & { archived?: boolean; archivedAt?: number }).archived;
  delete (restored as Memory & { archived?: boolean; archivedAt?: number }).archivedAt;

  await store.put(NS.semanticMemory(userId), memoryId, restored);

  return restored;
}

/**
 * Run pruning on all memories for a user
 */
export async function pruneMemories(
  userId: string,
  store: MemoryStore,
  threshold: number = PRUNE_THRESHOLD
): Promise<{ pruned: number; total: number }> {
  const allMemories = await store.list<Memory & { archived?: boolean }>(NS.semanticMemory(userId));

  // Filter to non-archived memories
  const activeMemories = allMemories.items.filter((m) => !m.archived);

  let pruned = 0;

  for (const memory of activeMemories) {
    const effectiveStrength = calculateEffectiveStrength(memory);

    if (effectiveStrength < threshold) {
      await archiveMemory(memory, userId, store);
      pruned++;
    }
  }

  return { pruned, total: activeMemories.length };
}

/**
 * Get archived memories
 */
export async function getArchivedMemories(
  userId: string,
  store: MemoryStore,
  limit: number = 100
): Promise<Memory[]> {
  const allMemories = await store.list<Memory & { archived?: boolean }>(NS.semanticMemory(userId), {
    limit: limit * 10, // Get more since we filter
  });

  return allMemories.items
    .filter((m) => m.archived)
    .slice(0, limit);
}

/**
 * Permanently delete archived memories older than a threshold
 *
 * Use with caution - this is irreversible!
 */
export async function purgeOldArchives(
  userId: string,
  store: MemoryStore,
  olderThanDays: number = 90
): Promise<number> {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const allMemories = await store.list<Memory & { archived?: boolean; archivedAt?: number }>(
    NS.semanticMemory(userId)
  );

  let purged = 0;

  for (const memory of allMemories.items) {
    if (memory.archived && memory.archivedAt && memory.archivedAt < cutoff) {
      await store.delete(NS.semanticMemory(userId), memory.id);
      purged++;
    }
  }

  return purged;
}

/**
 * Memory quota configuration
 */
export interface MemoryQuotas {
  semantic: number;
  episodic: number;
  procedural: number;
}

/**
 * Default quotas (v13 Section 8.15)
 */
export const DEFAULT_QUOTAS: MemoryQuotas = {
  semantic: 10000,
  episodic: 5000,
  procedural: 1000,
};

/**
 * Check memory usage against quotas
 */
export async function checkQuotas(
  userId: string,
  store: MemoryStore,
  quotas: MemoryQuotas = DEFAULT_QUOTAS
): Promise<{
  semantic: { count: number; quota: number; percentage: number };
  episodic: { count: number; quota: number; percentage: number };
  procedural: { count: number; quota: number; percentage: number };
  warnings: string[];
}> {
  const [semantic, episodic, procedural] = await Promise.all([
    store.list(NS.semanticMemory(userId)),
    store.list(NS.episodicMemory(userId)),
    // For procedural, we need to check all agent types
    store.list([NAMESPACES.PROCEDURAL_MEMORY, userId] as const),
  ]);

  const warnings: string[] = [];

  const semanticPct = (semantic.items.length / quotas.semantic) * 100;
  const episodicPct = (episodic.items.length / quotas.episodic) * 100;
  const proceduralPct = (procedural.items.length / quotas.procedural) * 100;

  if (semanticPct >= 80) {
    warnings.push(`Semantic memory at ${semanticPct.toFixed(1)}% capacity`);
  }
  if (episodicPct >= 80) {
    warnings.push(`Episodic memory at ${episodicPct.toFixed(1)}% capacity`);
  }
  if (proceduralPct >= 80) {
    warnings.push(`Procedural memory at ${proceduralPct.toFixed(1)}% capacity`);
  }

  return {
    semantic: {
      count: semantic.items.length,
      quota: quotas.semantic,
      percentage: semanticPct,
    },
    episodic: {
      count: episodic.items.length,
      quota: quotas.episodic,
      percentage: episodicPct,
    },
    procedural: {
      count: procedural.items.length,
      quota: quotas.procedural,
      percentage: proceduralPct,
    },
    warnings,
  };
}
