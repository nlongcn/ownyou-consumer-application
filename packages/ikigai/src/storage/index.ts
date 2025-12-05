/**
 * Ikigai Storage Layer - v13 Section 2.9
 *
 * Exports all storage operations for Ikigai profiles, evidence, and entities.
 */

export {
  storeIkigaiProfile,
  getExistingProfile,
  getIkigaiContextForAgent,
  deleteIkigaiProfile,
  type MemoryStore,
} from './profile-store';

export {
  storeEvidence,
  getEvidenceByDimension,
  getRecentEvidence,
  getEvidenceSummary,
} from './evidence-store';

export {
  syncPeopleToEntities,
  getKnownPeople,
  getPersonByName,
  getPeopleByRelationship,
  getClosestPeople,
} from './entity-sync';
