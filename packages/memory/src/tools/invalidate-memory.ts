/**
 * Invalidate Memory Tool - v13 Section 8.8.1
 *
 * Marks a fact as no longer true (don't delete - preserve history).
 * This supports bi-temporal modeling: we remember when things changed.
 */

import type { Memory } from '@ownyou/shared-types';
import { NS } from '@ownyou/shared-types';
import type { InvalidateMemoryParams, InvalidateMemoryContext } from '../types';

/**
 * Extended memory type with invalidation fields
 */
interface MemoryWithInvalidation extends Memory {
  invalidationReason?: string;
}

/**
 * Invalidate a memory - mark as no longer true
 */
export async function invalidateMemory(
  params: InvalidateMemoryParams,
  context: InvalidateMemoryContext
): Promise<void> {
  const { memoryId, reason } = params;
  const { userId, store } = context;

  const memory = await store.get<MemoryWithInvalidation>(NS.semanticMemory(userId), memoryId);

  if (!memory) {
    throw new Error(`Memory not found: ${memoryId}`);
  }

  const updatedMemory: MemoryWithInvalidation = {
    ...memory,
    invalidAt: Date.now(),
    invalidationReason: reason,
  };

  await store.put(NS.semanticMemory(userId), memoryId, updatedMemory);
}

/**
 * Revalidate a previously invalidated memory
 */
export async function revalidateMemory(
  memoryId: string,
  context: InvalidateMemoryContext
): Promise<void> {
  const { userId, store } = context;

  const memory = await store.get<MemoryWithInvalidation>(NS.semanticMemory(userId), memoryId);

  if (!memory) {
    throw new Error(`Memory not found: ${memoryId}`);
  }

  // Remove invalidation but keep history via sources
  const updatedMemory: Memory = {
    ...memory,
    invalidAt: undefined,
    lastAccessed: Date.now(),
    // Add note about revalidation to sources
    sources: [...memory.sources, `revalidated:${Date.now()}`],
  };

  // Remove the extra field
  delete (updatedMemory as MemoryWithInvalidation).invalidationReason;

  await store.put(NS.semanticMemory(userId), memoryId, updatedMemory);
}

/**
 * Get invalidated memories
 */
export async function getInvalidatedMemories(
  userId: string,
  store: InvalidateMemoryContext['store'],
  limit: number = 50
): Promise<MemoryWithInvalidation[]> {
  const allMemories = await store.list<MemoryWithInvalidation>(NS.semanticMemory(userId));

  return allMemories.items
    .filter((m) => m.invalidAt !== undefined)
    .sort((a, b) => (b.invalidAt ?? 0) - (a.invalidAt ?? 0))
    .slice(0, limit);
}

/**
 * Check if a memory is invalidated
 */
export async function isMemoryInvalidated(
  memoryId: string,
  context: InvalidateMemoryContext
): Promise<boolean> {
  const { userId, store } = context;

  const memory = await store.get<Memory>(NS.semanticMemory(userId), memoryId);

  if (!memory) {
    return false;
  }

  return memory.invalidAt !== undefined;
}

/**
 * Invalidate memories containing specific content
 * Useful when a fact is known to be wrong
 */
export async function invalidateMemoriesContaining(
  searchTerm: string,
  reason: string,
  context: InvalidateMemoryContext
): Promise<number> {
  const { userId, store } = context;

  const allMemories = await store.list<Memory>(NS.semanticMemory(userId));
  const searchLower = searchTerm.toLowerCase();

  let invalidated = 0;

  for (const memory of allMemories.items) {
    if (
      memory.content.toLowerCase().includes(searchLower) &&
      memory.invalidAt === undefined
    ) {
      await invalidateMemory({ memoryId: memory.id, reason }, context);
      invalidated++;
    }
  }

  return invalidated;
}
