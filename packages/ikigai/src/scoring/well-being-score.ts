/**
 * Well-Being Scoring - v13 Section 2.6
 *
 * Calculates well-being scores for missions based on Ikigai profile alignment.
 * Missions are ranked by well-being value, not just utility.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.6
 */

import type {
  MissionWellBeingScore,
  IkigaiProfile,
  Person,
  WellBeingConfig,
} from '../types';
import { DEFAULT_WELLBEING_CONFIG } from '../types';
import { getExistingProfile, type MemoryStore } from '../storage/profile-store';
import { getKnownPeople } from '../storage/entity-sync';

/**
 * Mission card interface - minimal subset for scoring
 *
 * NOTE: This is a deliberate subset of the full MissionCard from @ownyou/shared-types.
 * Using a minimal interface here avoids importing the full agent types (which include
 * MissionStatus, MissionAction, AgentType, etc.) just for scoring purposes.
 *
 * The full MissionCard includes ikigaiDimensions, ikigaiAlignmentBoost, etc.
 * which are computed BY the scoring functions and not required as inputs.
 *
 * @see @ownyou/shared-types/agent.ts for full MissionCard definition
 */
export interface MissionCard {
  id: string;
  type: string;
  title: string;
  summary: string;
  utilityScore?: number;
}

// Module-level config, can be updated via setWellBeingConfig()
let wellBeingConfig: WellBeingConfig = DEFAULT_WELLBEING_CONFIG;

/**
 * Set well-being configuration - v13 Section 2.6
 *
 * Allows runtime configuration of scoring parameters.
 */
export function setWellBeingConfig(config: Partial<WellBeingConfig>): void {
  wellBeingConfig = {
    ...DEFAULT_WELLBEING_CONFIG,
    ...config,
    boosts: {
      ...DEFAULT_WELLBEING_CONFIG.boosts,
      ...config.boosts,
    },
  };
}

/**
 * Get current well-being configuration
 */
export function getWellBeingConfig(): WellBeingConfig {
  return wellBeingConfig;
}

/**
 * Calculate Well-Being Score - v13 Section 2.6
 *
 * Missions are ranked by well-being value, not just utility.
 */
export async function calculateWellBeingScore(
  mission: MissionCard,
  userId: string,
  store: MemoryStore
): Promise<MissionWellBeingScore> {
  const profile = await getExistingProfile(userId, store);
  const knownPeople = await getKnownPeople(userId, store);

  // Start with base utility score
  const utilityScore = mission.utilityScore ?? 0.5;

  // Calculate boosts
  const experienceBoost = calculateExperienceBoost(mission, profile);
  const relationshipBoost = calculateRelationshipBoost(
    mission,
    profile,
    knownPeople
  );
  const interestAlignment = calculateInterestAlignment(mission, profile);
  const givingBoost = calculateGivingBoost(mission, profile);

  // Calculate total (capped at configurable max)
  const totalScore = Math.min(
    wellBeingConfig.maxTotalScore,
    utilityScore +
      experienceBoost +
      relationshipBoost +
      interestAlignment +
      givingBoost
  );

  return {
    utilityScore,
    experienceBoost,
    relationshipBoost,
    interestAlignment,
    givingBoost,
    totalScore,
  };
}

/**
 * Experience boost - v13 2.6
 *
 * Does this mission create an experience?
 */
function calculateExperienceBoost(
  mission: MissionCard,
  profile?: IkigaiProfile
): number {
  if (!profile) return 0;

  // Check if mission type aligns with experience preferences
  const experienceTypes = ['travel', 'restaurant', 'events'];
  if (!experienceTypes.includes(mission.type)) {
    return 0;
  }

  // Check for preferred experience types
  const missionType = mission.type;
  const typeMapping: Record<string, string[]> = {
    travel: ['travel', 'adventure', 'outdoor'],
    restaurant: ['dining', 'social_gatherings'],
    events: ['entertainment', 'social_gatherings', 'creative'],
  };

  const relevantTypes = typeMapping[missionType] ?? [];
  const hasMatch = profile.experiences.preferredTypes.some((t) =>
    relevantTypes.includes(t)
  );

  if (hasMatch) {
    // Full boost for matching preferences
    return wellBeingConfig.boosts.experienceFull * profile.dimensionWeights.experiences;
  }

  // Partial boost for experience-type missions
  return wellBeingConfig.boosts.experiencePartial * profile.dimensionWeights.experiences;
}

/**
 * Relationship boost - v13 2.6
 *
 * Does this mission involve key people?
 */
function calculateRelationshipBoost(
  mission: MissionCard,
  profile?: IkigaiProfile,
  knownPeople?: Person[]
): number {
  if (!profile || !knownPeople || knownPeople.length === 0) return 0;

  // Check if mission mentions any known people
  const missionText = `${mission.title} ${mission.summary}`.toLowerCase();

  for (const person of knownPeople) {
    if (missionText.includes(person.name.toLowerCase())) {
      // Full boost for key person involvement
      return (
        wellBeingConfig.boosts.relationshipFull *
        profile.dimensionWeights.relationships *
        person.relationshipStrength
      );
    }
  }

  // Check for gift-related missions for known recipients
  if (mission.type === 'shopping') {
    const giftKeywords = ['gift', 'birthday', 'present', 'surprise'];
    const isGiftMission = giftKeywords.some((k) => missionText.includes(k));
    if (isGiftMission) {
      return wellBeingConfig.boosts.relationshipGift * profile.dimensionWeights.relationships;
    }
  }

  return 0;
}

/**
 * Interest alignment - v13 2.6
 *
 * Does this match their interests?
 */
function calculateInterestAlignment(
  mission: MissionCard,
  profile?: IkigaiProfile
): number {
  if (!profile || profile.interests.genuineInterests.length === 0) return 0;

  const missionText = `${mission.title} ${mission.summary}`.toLowerCase();

  for (const interest of profile.interests.genuineInterests) {
    if (missionText.includes(interest.topic.toLowerCase())) {
      // Scale by engagement depth using config values
      const depthMultiplier =
        interest.engagementDepth === 'deep'
          ? wellBeingConfig.boosts.interestDeep
          : interest.engagementDepth === 'moderate'
            ? wellBeingConfig.boosts.interestModerate
            : wellBeingConfig.boosts.interestCasual;

      return wellBeingConfig.boosts.interestBase * profile.dimensionWeights.interests * depthMultiplier;
    }
  }

  return 0;
}

/**
 * Giving boost - v13 2.6
 *
 * Is this charitable or gift-related?
 */
function calculateGivingBoost(
  mission: MissionCard,
  profile?: IkigaiProfile
): number {
  if (!profile) return 0;

  const missionText = `${mission.title} ${mission.summary}`.toLowerCase();

  // Check for charitable keywords
  const charityKeywords = [
    'donate',
    'charity',
    'volunteer',
    'help',
    'support cause',
  ];
  const isCharity = charityKeywords.some((k) => missionText.includes(k));
  if (isCharity) {
    return wellBeingConfig.boosts.givingCharity * profile.dimensionWeights.giving;
  }

  // Check for gift keywords
  const giftKeywords = ['gift', 'present', 'birthday', 'anniversary'];
  const isGift = giftKeywords.some((k) => missionText.includes(k));
  if (isGift && profile.giving.giftGiving.frequency !== 'rare') {
    return wellBeingConfig.boosts.givingGift * profile.dimensionWeights.giving;
  }

  return 0;
}

/**
 * Sort missions by well-being score - v13 2.6
 */
export async function sortMissionsByWellBeing(
  missions: MissionCard[],
  userId: string,
  store: MemoryStore
): Promise<Array<MissionCard & { wellBeingScore: MissionWellBeingScore }>> {
  const scored = await Promise.all(
    missions.map(async (mission) => ({
      ...mission,
      wellBeingScore: await calculateWellBeingScore(mission, userId, store),
    }))
  );

  // Sort by total score descending
  return scored.sort(
    (a, b) => b.wellBeingScore.totalScore - a.wellBeingScore.totalScore
  );
}

/**
 * Calculate well-being alignment summary for a mission
 */
export function getWellBeingAlignmentSummary(
  score: MissionWellBeingScore
): string {
  const parts: string[] = [];

  if (score.experienceBoost > 0) {
    parts.push('experience');
  }
  if (score.relationshipBoost > 0) {
    parts.push('relationship');
  }
  if (score.interestAlignment > 0) {
    parts.push('interest');
  }
  if (score.givingBoost > 0) {
    parts.push('giving');
  }

  if (parts.length === 0) {
    return 'utility';
  }

  return parts.join(' + ');
}
