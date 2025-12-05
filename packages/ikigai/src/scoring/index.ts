/**
 * Ikigai Scoring Layer - v13 Section 2.6-2.7
 *
 * Exports well-being scoring and rewards functions.
 */

export {
  calculateWellBeingScore,
  sortMissionsByWellBeing,
  getWellBeingAlignmentSummary,
  type MissionCard,
} from './well-being-score';

export {
  calculateMissionRewards,
  awardMissionPoints,
  getUserPoints,
  getDominantCategory,
  getIkigaiTier,
} from './rewards';
