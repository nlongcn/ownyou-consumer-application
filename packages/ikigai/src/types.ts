/**
 * Ikigai Types - v13 Section 2
 *
 * Types for the Ikigai Intelligence Layer including:
 * - 4 inference dimensions (Experiences, Relationships, Interests, Giving)
 * - 6 storage dimensions (Passion, Mission, Vocation, Profession, Relationships, Well-being)
 * - Evidence chains for transparency
 * - Well-being scoring for mission prioritization
 * - Ikigai rewards system
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2
 * @see docs/sprints/ownyou-sprint6-spec.md
 */

import type { PrivacyTier } from '@ownyou/shared-types';

// ============================================================================
// Ikigai Profile (v13 Section 2.3 + 2.9)
// ============================================================================

/**
 * IkigaiProfile - Complete well-being profile
 *
 * v13 2.9 Storage Flow:
 * - Core profile -> semanticMemory (NS.semanticMemory(userId), "ikigai_profile")
 * - Key people -> entities (NS.entities(userId), "person:*")
 * - Professional -> iab_classifications (NS.iabClassifications(userId), "ikigai_derived")
 */
export interface IkigaiProfile {
  userId: string;
  updatedAt: number;

  // Inferred from data via LLM prompts (v13 2.2 - 4 dimensions)
  experiences: ExperiencesDimension;
  relationships: RelationshipsDimension;
  interests: InterestsDimension;
  giving: GivingDimension;

  // v13 2.9 additional mapped dimensions
  passion?: PassionDimension;
  mission?: MissionDimension;
  vocation?: VocationDimension;
  profession?: ProfessionDimension;
  wellBeing?: WellBeingDimension;

  // Weights for mission ranking (v13 2.6)
  dimensionWeights: DimensionWeights;

  // Evidence chain for transparency (v13 2.3)
  evidence: IkigaiEvidence[];

  // Overall profile confidence
  confidence: number;
}

// ============================================================================
// Inference Dimensions (v13 Section 2.2)
// ============================================================================

/**
 * Experiences Dimension - Activities that bring joy
 */
export interface ExperiencesDimension {
  preferredTypes: ExperienceType[];
  frequency: 'rare' | 'occasional' | 'frequent';
  recentActivities: Activity[];
  patterns: ExperiencePatterns;
  confidence: number;
}

export type ExperienceType =
  | 'travel'
  | 'entertainment'
  | 'dining'
  | 'adventure'
  | 'learning'
  | 'creative'
  | 'social_gatherings'
  | 'outdoor'
  | 'wellness';

export interface Activity {
  type: ExperienceType;
  description: string;
  date: number;
  evidence: string;
}

export interface ExperiencePatterns {
  timing?: string;
  companions?: string[];
  locations?: string[];
}

/**
 * Relationships Dimension - People who matter
 */
export interface RelationshipsDimension {
  keyPeople: Person[];
  socialFrequency: 'solo' | 'couple' | 'social' | 'very_social';
  relationshipInvestmentPatterns: string;
  confidence: number;
}

/**
 * Person entity - v13 Section 2.3
 */
export interface Person {
  name: string;
  relationshipType: 'family' | 'friend' | 'colleague' | 'partner' | 'other';
  interactionFrequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  sharedInterests: string[];
  sharedActivities: string[];
  relationshipStrength: number;
  lastInteraction?: number;
  evidence: string;
}

/**
 * Interests Dimension - Recurring passions
 */
export interface InterestsDimension {
  genuineInterests: Interest[];
  hobbies: string[];
  learningInterests: string[];
  confidence: number;
}

export interface Interest {
  topic: string;
  evidenceType: 'purchases' | 'content' | 'activities' | 'emails';
  engagementDepth: 'casual' | 'moderate' | 'deep';
  evidence: string;
}

/**
 * Giving Dimension - Contribution to others
 */
export interface GivingDimension {
  charitableGiving: CharitableActivity[];
  giftGiving: GiftGivingPattern;
  volunteering: string[];
  carePatterns: string;
  confidence: number;
}

export interface CharitableActivity {
  cause: string;
  frequency: string;
  evidence: string;
}

export interface GiftGivingPattern {
  frequency: 'rare' | 'occasional' | 'frequent';
  recipients: string[];
}

// ============================================================================
// Storage Dimensions (v13 Section 2.9)
// ============================================================================

/**
 * Passion dimension - mapped from interests + experiences
 */
export interface PassionDimension {
  interests: string[];
  hobbies: string[];
  creativeOutlets: string[];
}

/**
 * Mission dimension - mapped from giving
 */
export interface MissionDimension {
  causes: string[];
  values: string[];
  impactAreas: string[];
}

/**
 * Vocation dimension
 */
export interface VocationDimension {
  skills: string[];
  expertise: string[];
  certifications: string[];
}

/**
 * Profession dimension
 */
export interface ProfessionDimension {
  jobTitle?: string;
  industry?: string;
  incomeBracket?: 'low' | 'medium' | 'high' | 'unknown';
  confidence: number;
}

/**
 * Well-being dimension (privacy-protected)
 */
export interface WellBeingDimension {
  healthGoals: string[];
  stressIndicators: string[];
  privacyTier: 'private';
}

// ============================================================================
// Dimension Weights & Evidence (v13 Section 2.3, 2.6)
// ============================================================================

/**
 * Dimension Weights - for mission ranking
 */
export interface DimensionWeights {
  experiences: number;
  relationships: number;
  interests: number;
  giving: number;
}

/**
 * Evidence Chain - v13 2.3
 */
export interface IkigaiEvidence {
  dimension: 'experiences' | 'relationships' | 'interests' | 'giving';
  sourceType: 'email' | 'transaction' | 'calendar' | 'browser';
  sourceId: string;
  signalStrength: number;
  extractedAt: number;
  summary: string;
}

// ============================================================================
// Inference Configuration (v13 Section 2.5)
// ============================================================================

/**
 * Model tier type - matches llm-client ModelTier
 * NOTE: These are CONFIGURABLE defaults. v13 tiers are placeholders.
 * Users MUST be able to override with specific model names.
 */
export type ModelTier = 'fast' | 'standard' | 'quality' | 'local';

/**
 * Model configuration - allows overriding default tier models
 *
 * v13 Section 6.10: Model selection MUST be configurable.
 * Tiers in v13 are PLACEHOLDERS - actual models should come from:
 * 1. User configuration (highest priority)
 * 2. llm-client registry via getRecommendedModel()
 * 3. Never hardcoded model names in business logic
 */
export interface ModelConfig {
  /** The tier to use for this operation */
  tier: ModelTier;
  /**
   * Optional model override - if provided, uses this model
   * instead of looking up from tier
   */
  model?: string;
  /** Whether to prefer zero-data-retention models */
  preferZDR?: boolean;
}

/**
 * Inference Configuration
 */
export interface IkigaiInferenceConfig {
  batchWindow: 'daily' | 'weekly';
  minItemsThreshold: number;
  parallelInference: boolean;
  dataWindowDays: number;
  /**
   * Model tier for inference operations.
   * NOTE: This is a CONFIGURABLE default. To override with specific models,
   * provide modelOverrides instead.
   */
  modelTier: ModelTier;
  /**
   * Optional model overrides by tier.
   * These take precedence over default tier lookups.
   * Example: { standard: 'gpt-4o', fast: 'gpt-4o-mini' }
   */
  modelOverrides?: Partial<Record<ModelTier, string>>;
  /**
   * Whether to prefer zero-data-retention models when using tier defaults.
   * Recommended for privacy-sensitive operations.
   */
  preferZDR?: boolean;
}

export const DEFAULT_INFERENCE_CONFIG: IkigaiInferenceConfig = {
  batchWindow: 'daily',
  minItemsThreshold: 10,
  parallelInference: true,
  dataWindowDays: 90,
  modelTier: 'standard',
  // No modelOverrides by default - uses llm-client registry
  preferZDR: true, // Default to preferring ZDR models for privacy
};

// ============================================================================
// Scoring Configuration (v13 Section 2.6-2.7)
// ============================================================================

/**
 * Well-Being Scoring Configuration - v13 Section 2.6
 *
 * All boost values and thresholds are configurable.
 * Defaults are based on v13 recommendations but can be tuned.
 */
export interface WellBeingConfig {
  /** Maximum total score cap */
  maxTotalScore: number;
  /** Boost multipliers by category */
  boosts: {
    /** Full boost for matching experience preferences */
    experienceFull: number;
    /** Partial boost for experience-type missions */
    experiencePartial: number;
    /** Full boost for key person involvement */
    relationshipFull: number;
    /** Boost for gift-related missions */
    relationshipGift: number;
    /** Interest alignment by depth */
    interestDeep: number;
    interestModerate: number;
    interestCasual: number;
    /** Base interest multiplier */
    interestBase: number;
    /** Charitable giving boost */
    givingCharity: number;
    /** Gift giving boost */
    givingGift: number;
  };
}

export const DEFAULT_WELLBEING_CONFIG: WellBeingConfig = {
  maxTotalScore: 2.0,
  boosts: {
    experienceFull: 0.5,
    experiencePartial: 0.25,
    relationshipFull: 0.5,
    relationshipGift: 0.3,
    interestDeep: 1.0,
    interestModerate: 0.7,
    interestCasual: 0.4,
    interestBase: 0.3,
    givingCharity: 0.3,
    givingGift: 0.2,
  },
};

/**
 * Rewards Configuration - v13 Section 2.7
 */
export interface RewardsConfig {
  /** Base points for completing a mission */
  basePoints: number;
  /** Multipliers by category */
  multipliers: {
    experience: number;
    relationship: number;
    giving: number;
  };
  /** Tier thresholds for gamification */
  tierThresholds: TierThreshold[];
}

export interface TierThreshold {
  name: string;
  threshold: number;
}

export const DEFAULT_REWARDS_CONFIG: RewardsConfig = {
  basePoints: 100,
  multipliers: {
    experience: 2.0,
    relationship: 1.5,
    giving: 2.5,
  },
  tierThresholds: [
    { name: 'Bronze', threshold: 0 },
    { name: 'Silver', threshold: 1000 },
    { name: 'Gold', threshold: 5000 },
    { name: 'Platinum', threshold: 15000 },
    { name: 'Diamond', threshold: 50000 },
  ],
};

// ============================================================================
// Mission Well-Being Score (v13 Section 2.6)
// ============================================================================

/**
 * Mission Well-Being Score
 */
export interface MissionWellBeingScore {
  utilityScore: number;
  experienceBoost: number;
  relationshipBoost: number;
  interestAlignment: number;
  givingBoost: number;
  totalScore: number;
}

// ============================================================================
// Ikigai Rewards (v13 Section 2.7)
// ============================================================================

/**
 * Ikigai Rewards
 */
export interface IkigaiRewards {
  basePoints: number;
  experienceMultiplier: number;
  relationshipMultiplier: number;
  givingMultiplier: number;
  categories: {
    explorer: number;
    connector: number;
    helper: number;
    achiever: number;
  };
}

export const DEFAULT_REWARDS: Omit<IkigaiRewards, 'categories'> = {
  basePoints: 100,
  experienceMultiplier: 2.0,
  relationshipMultiplier: 1.5,
  givingMultiplier: 2.5,
};

// ============================================================================
// User Data Bundle (for inference)
// ============================================================================

export interface UserDataBundle {
  iabClassifications: Array<{ key: string; value: unknown }>;
  emails: Array<{ key: string; value: unknown }>;
  financial?: Array<{ key: string; value: unknown }>;
  calendar?: Array<{ key: string; value: unknown }>;
}

// ============================================================================
// Mission Feedback Context (v13 Section 2.4)
// ============================================================================

/**
 * Mission Feedback Context - for synthesis prompt
 */
export interface MissionFeedbackContext {
  lovedMissions: string[];
  likedMissions: string[];
  dismissedMissions: string[];
  patterns?: string;
}

// ============================================================================
// Synthesis Result
// ============================================================================

export interface SynthesisResult {
  dimensionWeights: DimensionWeights;
  overallConfidence: number;
  changesSinceLastUpdate: string;
  dailyJoy?: string;
  keyPeopleInsight?: string;
  passionInsight?: string;
  contributionInsight?: string;
}

// ============================================================================
// User Points
// ============================================================================

export interface UserPoints {
  total: number;
  explorer: number;
  connector: number;
  helper: number;
  achiever: number;
  lastUpdated?: number;
}

export const DEFAULT_USER_POINTS: UserPoints = {
  total: 0,
  explorer: 0,
  connector: 0,
  helper: 0,
  achiever: 0,
};
