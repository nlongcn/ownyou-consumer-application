/**
 * Lifecycle Module - v13 Section 8.9
 *
 * Memory decay, consolidation, and pruning.
 */

export {
  calculateEffectiveStrength,
  shouldPrune,
  daysUntilPrune,
  boostStrength,
  findMemoriesToPrune,
  calculateDecayStats,
  DECAY_RATE,
  PRUNE_THRESHOLD,
} from './decay';

export { consolidateMemory, findConsolidationCandidates } from './consolidation';

export {
  archiveMemory,
  unarchiveMemory,
  pruneMemories,
  getArchivedMemories,
  purgeOldArchives,
  checkQuotas,
  DEFAULT_QUOTAS,
  ARCHIVED_NAMESPACE,
  type MemoryQuotas,
} from './pruning';
