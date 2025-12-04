/**
 * Temporal Validation - v13 Section 8.10
 *
 * Validates memories based on temporal patterns.
 * Marks outdated facts as invalid when contradictions are detected.
 */

import type { Memory } from '@ownyou/shared-types';
import type { MemoryStore } from '@ownyou/memory-store';
import { NS } from '@ownyou/shared-types';
import { invalidateMemory } from '@ownyou/memory';
import type { TemporalValidationResult } from './types';

// Contexts where facts commonly become outdated
const VOLATILE_CONTEXTS = ['location', 'employment', 'relationship_status', 'living_situation'];

// How old a memory needs to be before validation considers it potentially stale
const STALE_THRESHOLD_DAYS = 365; // 1 year

/**
 * Validate temporal facts and mark outdated ones as invalid
 *
 * Looks for contradictions and time-sensitive facts that may
 * no longer be accurate.
 */
export async function validateTemporalFacts(
  userId: string,
  store: MemoryStore
): Promise<number> {
  const allMemories = await store.list<Memory>(NS.semanticMemory(userId));
  const validMemories = allMemories.items.filter((m) => !m.invalidAt);

  let invalidatedCount = 0;

  // Group memories by context for contradiction detection
  const byContext = groupByContext(validMemories);

  // Check for contradictions within each context
  for (const [context, memories] of Object.entries(byContext)) {
    const results = await validateContextMemories(context, memories, userId, store);
    invalidatedCount += results.filter((r) => r.invalidated).length;
  }

  // Check for stale volatile facts
  const staleResults = await validateStaleFacts(validMemories, userId, store);
  invalidatedCount += staleResults.filter((r) => r.invalidated).length;

  return invalidatedCount;
}

/**
 * Group memories by their context
 */
function groupByContext(memories: Memory[]): Record<string, Memory[]> {
  const groups: Record<string, Memory[]> = {};

  for (const memory of memories) {
    const context = memory.context || 'general';
    if (!groups[context]) {
      groups[context] = [];
    }
    groups[context].push(memory);
  }

  return groups;
}

/**
 * Validate memories within a single context for contradictions
 */
async function validateContextMemories(
  context: string,
  memories: Memory[],
  userId: string,
  store: MemoryStore
): Promise<TemporalValidationResult[]> {
  const results: TemporalValidationResult[] = [];

  // Sort by validAt descending (newest first)
  const sorted = [...memories].sort((a, b) => b.validAt - a.validAt);

  // Look for potential contradictions
  for (let i = 0; i < sorted.length; i++) {
    const newer = sorted[i];

    for (let j = i + 1; j < sorted.length; j++) {
      const older = sorted[j];

      // Check if memories might contradict
      if (mightContradict(newer, older)) {
        // Invalidate the older memory
        try {
          await invalidateMemory(
            {
              memoryId: older.id,
              reason: `Superseded by newer fact: "${newer.content.substring(0, 50)}..."`,
            },
            { userId, store }
          );

          results.push({
            memoryId: older.id,
            invalidated: true,
            reason: 'Contradicted by newer memory',
          });
        } catch {
          results.push({
            memoryId: older.id,
            invalidated: false,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Check if two memories might contradict each other
 *
 * Uses simple heuristics - a more sophisticated implementation
 * would use embeddings or LLM analysis
 */
function mightContradict(newer: Memory, older: Memory): boolean {
  const newerLower = newer.content.toLowerCase();
  const olderLower = older.content.toLowerCase();

  // Check for explicit negation patterns
  const negationPatterns = [
    // "User lives in X" vs "User used to live in X"
    { current: /lives in (.+)/, past: /used to live|previously lived|formerly lived/ },
    // "User works at X" vs "User left X"
    { current: /works at|employed at/, past: /left|quit|no longer works/ },
    // "User prefers X" vs "User no longer prefers X"
    { current: /prefers (.+)/, past: /no longer prefers|stopped preferring/ },
    // "User is married" vs "User divorced"
    { current: /is married|has a partner/, past: /divorced|separated|single again/ },
  ];

  for (const pattern of negationPatterns) {
    if (pattern.current.test(newerLower) && pattern.past.test(olderLower)) {
      return true;
    }
    if (pattern.current.test(olderLower) && pattern.past.test(newerLower)) {
      return true;
    }
  }

  // Check for same-subject different-value pattern
  // e.g., "User's favorite color is blue" vs "User's favorite color is red"
  const favoritePattern = /favorite (\w+) is (\w+)/;
  const newerMatch = newerLower.match(favoritePattern);
  const olderMatch = olderLower.match(favoritePattern);

  if (newerMatch && olderMatch && newerMatch[1] === olderMatch[1] && newerMatch[2] !== olderMatch[2]) {
    return true;
  }

  return false;
}

/**
 * Validate potentially stale facts in volatile contexts
 */
async function validateStaleFacts(
  memories: Memory[],
  userId: string,
  store: MemoryStore
): Promise<TemporalValidationResult[]> {
  const results: TemporalValidationResult[] = [];
  const now = Date.now();
  const staleThreshold = now - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  for (const memory of memories) {
    // Only check volatile contexts
    if (!VOLATILE_CONTEXTS.includes(memory.context || '')) {
      continue;
    }

    // Check if memory is old enough to be potentially stale
    if (memory.validAt < staleThreshold) {
      // Mark as potentially stale (don't auto-invalidate, just flag)
      // A more sophisticated implementation would ask for user confirmation
      results.push({
        memoryId: memory.id,
        invalidated: false, // Don't auto-invalidate, just flag
        reason: `Potentially stale - ${memory.context} fact from ${Math.floor((now - memory.validAt) / (24 * 60 * 60 * 1000))} days ago`,
      });
    }
  }

  return results;
}

/**
 * Get memories that might need user verification
 *
 * Returns memories in volatile contexts that are potentially stale
 */
export async function getMemoriesNeedingVerification(
  userId: string,
  store: MemoryStore
): Promise<Memory[]> {
  const allMemories = await store.list<Memory>(NS.semanticMemory(userId));
  const validMemories = allMemories.items.filter((m) => !m.invalidAt);

  const now = Date.now();
  const staleThreshold = now - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  return validMemories.filter(
    (m) => VOLATILE_CONTEXTS.includes(m.context || '') && m.validAt < staleThreshold
  );
}
