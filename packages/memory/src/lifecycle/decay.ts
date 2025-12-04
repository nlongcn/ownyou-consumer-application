/**
 * Memory Decay - v13 Section 8.9.2
 *
 * Memories that aren't accessed gradually fade.
 * Rate: 5% per week (configurable)
 */

import type { Memory } from '@ownyou/shared-types';

/**
 * Default decay rate: 5% per week
 */
export const DECAY_RATE = 0.95;

/**
 * Default prune threshold
 */
export const PRUNE_THRESHOLD = 0.1;

/**
 * Calculate effective strength after decay
 */
export function calculateEffectiveStrength(memory: Memory): number {
  const weeksSinceAccess = (Date.now() - memory.lastAccessed) / (7 * 24 * 60 * 60 * 1000);

  return memory.strength * Math.pow(DECAY_RATE, weeksSinceAccess);
}

/**
 * Check if memory should be pruned
 */
export function shouldPrune(memory: Memory, threshold: number = PRUNE_THRESHOLD): boolean {
  const effectiveStrength = calculateEffectiveStrength(memory);
  return effectiveStrength < threshold;
}

/**
 * Calculate days until memory would be pruned
 */
export function daysUntilPrune(
  memory: Memory,
  threshold: number = PRUNE_THRESHOLD
): number | null {
  const effectiveStrength = calculateEffectiveStrength(memory);

  if (effectiveStrength < threshold) {
    return 0; // Already below threshold
  }

  // Solve: strength * DECAY_RATE^(weeks) = threshold
  // weeks = log(threshold/strength) / log(DECAY_RATE)
  const weeksUntilPrune = Math.log(threshold / memory.strength) / Math.log(DECAY_RATE);

  if (weeksUntilPrune <= 0) {
    return null; // Won't be pruned
  }

  // Calculate weeks from now (subtract elapsed time)
  const weeksSinceAccess = (Date.now() - memory.lastAccessed) / (7 * 24 * 60 * 60 * 1000);
  const weeksRemaining = weeksUntilPrune - weeksSinceAccess;

  if (weeksRemaining <= 0) {
    return 0;
  }

  return weeksRemaining * 7; // Convert to days
}

/**
 * Boost memory strength (called on access or confirmation)
 */
export function boostStrength(
  currentStrength: number,
  boostAmount: number = 0.1,
  maxStrength: number = 5.0
): number {
  return Math.min(currentStrength + boostAmount, maxStrength);
}

/**
 * Apply decay to a list of memories and return those that need pruning
 */
export function findMemoriesToPrune(
  memories: Memory[],
  threshold: number = PRUNE_THRESHOLD
): Memory[] {
  return memories.filter((m) => shouldPrune(m, threshold));
}

/**
 * Calculate decay statistics for a list of memories
 */
export function calculateDecayStats(memories: Memory[]): {
  total: number;
  healthy: number;
  decaying: number;
  critical: number;
  prunable: number;
} {
  let healthy = 0;
  let decaying = 0;
  let critical = 0;
  let prunable = 0;

  for (const memory of memories) {
    const effectiveStrength = calculateEffectiveStrength(memory);

    if (effectiveStrength >= 0.7) {
      healthy++;
    } else if (effectiveStrength >= 0.3) {
      decaying++;
    } else if (effectiveStrength >= PRUNE_THRESHOLD) {
      critical++;
    } else {
      prunable++;
    }
  }

  return {
    total: memories.length,
    healthy,
    decaying,
    critical,
    prunable,
  };
}
