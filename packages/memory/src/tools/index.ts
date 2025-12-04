/**
 * Memory Tools - v13 Section 8.8.1
 *
 * Agent-callable memory operations.
 */

export { saveObservation, saveObservations } from './save-observation';

export {
  saveEpisode,
  updateEpisodeWithFeedback,
  getEpisodesByAgent,
  getRecentNegativeEpisodes,
  countEpisodesSinceReflection,
} from './save-episode';

export {
  searchMemories,
  searchMemoriesWithPrivacy,
  getMemoriesByContext,
  getStrongestMemories,
  getRecentMemories,
} from './search-memories';

export {
  invalidateMemory,
  revalidateMemory,
  getInvalidatedMemories,
  isMemoryInvalidated,
  invalidateMemoriesContaining,
} from './invalidate-memory';
