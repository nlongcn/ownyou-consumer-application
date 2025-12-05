/**
 * @ownyou/ikigai - Ikigai Intelligence Layer
 *
 * Well-being inference and mission prioritization for OwnYou.
 *
 * Main exports:
 * - IkigaiInferenceEngine: Main inference orchestrator
 * - Well-being scoring: Mission prioritization by Ikigai alignment
 * - Rewards: Point system for completed missions
 * - Storage: Profile, evidence, and entity persistence
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2
 */

// Types
export * from './types';

// Engine
export {
  IkigaiInferenceEngine,
  createIkigaiEngine,
  BatchProcessor,
  createBatchProcessor,
  sanitizeDataForLLM,
  sanitizePII,
  type LLMClient,
  type BatchState,
  type BatchReadiness,
  type SanitizeConfig,
} from './engine';

// Prompts
export {
  experiencesPrompt,
  parseExperiencesResponse,
  relationshipsPrompt,
  parseRelationshipsResponse,
  interestsPrompt,
  parseInterestsResponse,
  givingPrompt,
  parseGivingResponse,
  synthesisPrompt,
  parseSynthesisResponse,
} from './prompts';

// Storage
export {
  storeIkigaiProfile,
  getExistingProfile,
  getIkigaiContextForAgent,
  deleteIkigaiProfile,
  storeEvidence,
  getEvidenceByDimension,
  getRecentEvidence,
  getEvidenceSummary,
  syncPeopleToEntities,
  getKnownPeople,
  getPersonByName,
  getPeopleByRelationship,
  getClosestPeople,
  type MemoryStore,
} from './storage';

// Scoring
export {
  calculateWellBeingScore,
  sortMissionsByWellBeing,
  getWellBeingAlignmentSummary,
  calculateMissionRewards,
  awardMissionPoints,
  getUserPoints,
  getDominantCategory,
  getIkigaiTier,
  type MissionCard,
} from './scoring';
