/**
 * Well-Being Scoring - v13 Section 2.6
 *
 * Calculates well-being scores for missions based on Ikigai profile alignment.
 * Missions are ranked by well-being value, not just utility.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.6
 */

import type { MissionWellBeingScore, IkigaiProfile, Person } from '../types';
import { getExistingProfile, type MemoryStore } from '../storage/profile-store';
import { getKnownPeople } from '../storage/entity-sync';

/**
 * Mission card interface - minimal for scoring
 * Avoids circular dependency with shared-types
 */
export interface MissionCard {
  id: string;
  type: string;
  title: string;
  summary: string;
  utilityScore?: number;
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

  // Calculate total (capped at 2.0)
  const totalScore = Math.min(
    2.0,
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
    return 0.5 * profile.dimensionWeights.experiences;
  }

  // Partial boost for experience-type missions
  return 0.25 * profile.dimensionWeights.experiences;
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
        0.5 *
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
      return 0.3 * profile.dimensionWeights.relationships;
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
      // Scale by engagement depth
      const depthMultiplier =
        interest.engagementDepth === 'deep'
          ? 1.0
          : interest.engagementDepth === 'moderate'
            ? 0.7
            : 0.4;

      return 0.3 * profile.dimensionWeights.interests * depthMultiplier;
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
    return 0.3 * profile.dimensionWeights.giving;
  }

  // Check for gift keywords
  const giftKeywords = ['gift', 'present', 'birthday', 'anniversary'];
  const isGift = giftKeywords.some((k) => missionText.includes(k));
  if (isGift && profile.giving.giftGiving.frequency !== 'rare') {
    return 0.2 * profile.dimensionWeights.giving;
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
