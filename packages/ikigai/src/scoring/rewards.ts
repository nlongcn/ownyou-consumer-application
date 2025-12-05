/**
 * Ikigai Rewards - v13 Section 2.7
 *
 * Calculates and awards Ikigai points for completed missions.
 * Point multipliers:
 * - Experience missions: 2x
 * - Relationship missions: 1.5x
 * - Giving missions: 2.5x
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.7
 */

import { NS } from '@ownyou/shared-types';
import type { IkigaiRewards, UserPoints, RewardsConfig } from '../types';
import { DEFAULT_REWARDS_CONFIG } from '../types';
import { getExistingProfile, type MemoryStore } from '../storage/profile-store';

/**
 * Mission card interface - minimal subset for rewards
 *
 * NOTE: This is a deliberate subset of the full MissionCard from @ownyou/shared-types.
 * Using a minimal interface here avoids importing the full agent types just for
 * rewards calculation. Only the fields needed for reward computation are included.
 *
 * @see @ownyou/shared-types/agent.ts for full MissionCard definition
 */
export interface MissionCard {
  id: string;
  type: string;
  title: string;
  summary: string;
}

// Module-level config, can be updated via setRewardsConfig()
let rewardsConfig: RewardsConfig = DEFAULT_REWARDS_CONFIG;

/**
 * Set rewards configuration - v13 Section 2.7
 *
 * Allows runtime configuration of reward parameters.
 */
export function setRewardsConfig(config: Partial<RewardsConfig>): void {
  rewardsConfig = {
    ...DEFAULT_REWARDS_CONFIG,
    ...config,
    multipliers: {
      ...DEFAULT_REWARDS_CONFIG.multipliers,
      ...config.multipliers,
    },
    tierThresholds: config.tierThresholds ?? DEFAULT_REWARDS_CONFIG.tierThresholds,
  };
}

/**
 * Get current rewards configuration
 */
export function getRewardsConfig(): RewardsConfig {
  return rewardsConfig;
}

/**
 * Calculate Ikigai rewards for completed mission - v13 Section 2.7
 */
export async function calculateMissionRewards(
  mission: MissionCard,
  userId: string,
  store: MemoryStore
): Promise<IkigaiRewards> {
  const profile = await getExistingProfile(userId, store);

  const basePoints = rewardsConfig.basePoints;

  const categories = {
    explorer: 0,
    connector: 0,
    helper: 0,
    achiever: 0,
  };

  // Determine category and multiplier
  const missionText = `${mission.title} ${mission.summary}`.toLowerCase();

  // Experience missions (explorer)
  const experienceTypes = ['travel', 'restaurant', 'events'];
  if (experienceTypes.includes(mission.type)) {
    categories.explorer = Math.round(
      basePoints * rewardsConfig.multipliers.experience
    );
  }

  // Relationship missions (connector)
  if (profile) {
    const involvesKeyPerson = profile.relationships.keyPeople.some((p) =>
      missionText.includes(p.name.toLowerCase())
    );
    if (involvesKeyPerson) {
      categories.connector = Math.round(
        basePoints * rewardsConfig.multipliers.relationship
      );
    }
  }

  // Giving missions (helper)
  const givingKeywords = ['gift', 'donate', 'charity', 'volunteer', 'help'];
  const isGiving = givingKeywords.some((k) => missionText.includes(k));
  if (isGiving) {
    categories.helper = Math.round(
      basePoints * rewardsConfig.multipliers.giving
    );
  }

  // Utility missions (achiever) - always gets base points
  categories.achiever = basePoints;

  return {
    basePoints,
    experienceMultiplier: rewardsConfig.multipliers.experience,
    relationshipMultiplier: rewardsConfig.multipliers.relationship,
    givingMultiplier: rewardsConfig.multipliers.giving,
    categories,
  };
}

/**
 * Award points for completed mission - v13 Section 2.7
 */
export async function awardMissionPoints(
  mission: MissionCard,
  userId: string,
  store: MemoryStore
): Promise<number> {
  const rewards = await calculateMissionRewards(mission, userId, store);

  // Get total points (highest category)
  const totalPoints = Math.max(
    rewards.categories.explorer,
    rewards.categories.connector,
    rewards.categories.helper,
    rewards.categories.achiever
  );

  // Update user's Ikigai points
  const currentPoints = await getUserPoints(userId, store);
  const newPoints: UserPoints = {
    total: currentPoints.total + totalPoints,
    explorer: currentPoints.explorer + rewards.categories.explorer,
    connector: currentPoints.connector + rewards.categories.connector,
    helper: currentPoints.helper + rewards.categories.helper,
    achiever: currentPoints.achiever + rewards.categories.achiever,
    lastUpdated: Date.now(),
  };

  await store.put(NS.semanticMemory(userId), 'ikigai_points', newPoints as unknown as Record<string, unknown>);

  return totalPoints;
}

/**
 * Get user's current Ikigai points
 */
export async function getUserPoints(
  userId: string,
  store: MemoryStore
): Promise<UserPoints> {
  try {
    const result = await store.get(NS.semanticMemory(userId), 'ikigai_points');
    if (!result) {
      return {
        total: 0,
        explorer: 0,
        connector: 0,
        helper: 0,
        achiever: 0,
      };
    }
    return result.value as unknown as UserPoints;
  } catch {
    return {
      total: 0,
      explorer: 0,
      connector: 0,
      helper: 0,
      achiever: 0,
    };
  }
}

/**
 * Get user's dominant Ikigai category
 */
export async function getDominantCategory(
  userId: string,
  store: MemoryStore
): Promise<'explorer' | 'connector' | 'helper' | 'achiever'> {
  const points = await getUserPoints(userId, store);

  const categories = [
    { name: 'explorer' as const, value: points.explorer },
    { name: 'connector' as const, value: points.connector },
    { name: 'helper' as const, value: points.helper },
    { name: 'achiever' as const, value: points.achiever },
  ];

  // Sort by points descending
  categories.sort((a, b) => b.value - a.value);

  return categories[0].name;
}

/**
 * Get user's Ikigai tier based on total points
 */
export function getIkigaiTier(totalPoints: number): {
  tier: string;
  nextTierAt: number;
  progress: number;
} {
  // Use configurable tier thresholds
  const tiers = rewardsConfig.tierThresholds;

  let currentTier = tiers[0];
  let nextTier: typeof tiers[0] | null = tiers[1] ?? null;

  for (let i = 0; i < tiers.length; i++) {
    if (totalPoints >= tiers[i].threshold) {
      currentTier = tiers[i];
      nextTier = tiers[i + 1] ?? null;
    }
  }

  const progress = nextTier
    ? (totalPoints - currentTier.threshold) /
      (nextTier.threshold - currentTier.threshold)
    : 1;

  return {
    tier: currentTier.name,
    nextTierAt: nextTier?.threshold ?? currentTier.threshold,
    progress: Math.min(1, progress),
  };
}
