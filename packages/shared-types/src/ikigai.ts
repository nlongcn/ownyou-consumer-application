/**
 * Ikigai Types - v13 Section 2
 *
 * Types for the user's well-being profile based on experiences,
 * relationships, interests, and giving.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2
 */

/**
 * Experience type classification
 */
export type ExperienceType =
  | 'travel'
  | 'entertainment'
  | 'dining'
  | 'adventure'
  | 'learning'
  | 'creative'
  | 'social'
  | 'outdoor'
  | 'wellness';

/**
 * Activity record with evidence reference
 */
export interface Activity {
  /** Type of activity */
  type: ExperienceType;

  /** Description of the activity */
  description: string;

  /** When the activity occurred */
  date: number;

  /** Reference to supporting evidence */
  evidenceRef: string;
}

/**
 * Person in the user's relationship network
 */
export interface Person {
  /** Person's name */
  name: string;

  /** Relationship strength (0.0-1.0) */
  relationshipStrength: number;

  /** Interests shared with this person */
  sharedInterests: string[];

  /** When user last interacted with this person */
  lastInteraction: number;
}

/**
 * Topic interest score linked to IAB category
 */
export interface TopicScore {
  /** IAB category ID */
  iabCategoryId: string;

  /** Interest score (0.0-1.0) */
  score: number;

  /** Level of engagement with this topic */
  engagementDepth: 'casual' | 'moderate' | 'deep';
}

/**
 * Evidence supporting an Ikigai dimension
 */
export interface IkigaiEvidence {
  /** Which dimension this evidence supports */
  dimension: 'experiences' | 'relationships' | 'interests' | 'giving';

  /** Source type of the evidence */
  sourceType: 'email' | 'transaction' | 'calendar' | 'browser';

  /** Reference to source record */
  sourceId: string;

  /** Strength of the signal (0.0-1.0) */
  signalStrength: number;

  /** When this evidence was extracted */
  extractedAt: number;
}

/**
 * IkigaiProfile - v13 Section 2.3
 *
 * Complete well-being profile with four dimensions:
 * experiences, relationships, interests, and giving.
 */
export interface IkigaiProfile {
  /** User identifier */
  userId: string;

  /** Last update timestamp */
  updatedAt: number;

  /** Experiences dimension */
  experiences: {
    /** Preferred experience types */
    preferredTypes: ExperienceType[];

    /** How often user seeks experiences */
    frequency: 'rare' | 'occasional' | 'frequent';

    /** Recent activities with evidence */
    recentActivities: Activity[];
  };

  /** Relationships dimension */
  relationships: {
    /** Important people in user's life */
    keyPeople: Person[];

    /** How social the user is */
    socialFrequency: 'solo' | 'couple' | 'social' | 'very_social';
  };

  /** Interests dimension */
  interests: {
    /** Topic scores linked to IAB categories */
    topics: TopicScore[];

    /** Hobbies and activities */
    hobbies: string[];
  };

  /** Giving dimension */
  giving: {
    /** Causes the user cares about */
    causes: string[];

    /** How often user gives gifts (times per year) */
    giftGivingFrequency: number;
  };

  /** Weights for each dimension (should sum to 1.0) */
  dimensionWeights: {
    experiences: number;
    relationships: number;
    interests: number;
    giving: number;
  };

  /** Supporting evidence for profile */
  evidence: IkigaiEvidence[];
}
