/**
 * Ikigai Types Tests - v13 Section 2
 *
 * Tests that IkigaiProfile and related types are correctly defined
 * per the v13 architecture specification.
 */
import { describe, it, expect } from 'vitest';
import type {
  IkigaiProfile,
  ExperienceType,
  Activity,
  Person,
  TopicScore,
  IkigaiEvidence,
} from '../ikigai';

describe('Ikigai Types (v13 Section 2)', () => {
  describe('IkigaiProfile interface', () => {
    it('should have all required fields per v13 Section 2.3', () => {
      const profile: IkigaiProfile = {
        userId: 'user_123',
        updatedAt: Date.now(),
        experiences: {
          preferredTypes: ['travel', 'dining'],
          frequency: 'occasional',
          recentActivities: [],
        },
        relationships: {
          keyPeople: [],
          socialFrequency: 'social',
        },
        interests: {
          topics: [],
          hobbies: ['hiking', 'reading'],
        },
        giving: {
          causes: ['environment'],
          giftGivingFrequency: 3,
        },
        dimensionWeights: {
          experiences: 0.3,
          relationships: 0.25,
          interests: 0.25,
          giving: 0.2,
        },
        evidence: [],
      };

      expect(profile.userId).toBe('user_123');
      expect(profile.experiences.preferredTypes).toContain('travel');
      expect(profile.relationships.socialFrequency).toBe('social');
      expect(profile.interests.hobbies).toContain('hiking');
      expect(profile.giving.causes).toContain('environment');
      expect(profile.dimensionWeights.experiences).toBe(0.3);
    });

    it('should include recent activities with evidence refs', () => {
      const activity: Activity = {
        type: 'travel',
        description: 'Trip to Paris',
        date: Date.now(),
        evidenceRef: 'evidence_123',
      };

      const profile: IkigaiProfile = {
        userId: 'user_456',
        updatedAt: Date.now(),
        experiences: {
          preferredTypes: ['travel'],
          frequency: 'frequent',
          recentActivities: [activity],
        },
        relationships: {
          keyPeople: [],
          socialFrequency: 'couple',
        },
        interests: {
          topics: [],
          hobbies: [],
        },
        giving: {
          causes: [],
          giftGivingFrequency: 1,
        },
        dimensionWeights: {
          experiences: 0.4,
          relationships: 0.3,
          interests: 0.2,
          giving: 0.1,
        },
        evidence: [],
      };

      expect(profile.experiences.recentActivities[0].evidenceRef).toBe('evidence_123');
    });

    it('should include key people with relationship strength', () => {
      const person: Person = {
        name: 'Sarah',
        relationshipStrength: 0.95,
        sharedInterests: ['hiking', 'travel'],
        lastInteraction: Date.now(),
      };

      const profile: IkigaiProfile = {
        userId: 'user_789',
        updatedAt: Date.now(),
        experiences: {
          preferredTypes: [],
          frequency: 'rare',
          recentActivities: [],
        },
        relationships: {
          keyPeople: [person],
          socialFrequency: 'very_social',
        },
        interests: {
          topics: [],
          hobbies: [],
        },
        giving: {
          causes: [],
          giftGivingFrequency: 0,
        },
        dimensionWeights: {
          experiences: 0.25,
          relationships: 0.25,
          interests: 0.25,
          giving: 0.25,
        },
        evidence: [],
      };

      expect(profile.relationships.keyPeople[0].relationshipStrength).toBe(0.95);
    });

    it('should include topic scores with IAB category links', () => {
      const topic: TopicScore = {
        iabCategoryId: 'IAB-372',
        score: 0.85,
        engagementDepth: 'deep',
      };

      const profile: IkigaiProfile = {
        userId: 'user_abc',
        updatedAt: Date.now(),
        experiences: {
          preferredTypes: [],
          frequency: 'occasional',
          recentActivities: [],
        },
        relationships: {
          keyPeople: [],
          socialFrequency: 'solo',
        },
        interests: {
          topics: [topic],
          hobbies: ['photography'],
        },
        giving: {
          causes: [],
          giftGivingFrequency: 2,
        },
        dimensionWeights: {
          experiences: 0.25,
          relationships: 0.25,
          interests: 0.25,
          giving: 0.25,
        },
        evidence: [],
      };

      expect(profile.interests.topics[0].iabCategoryId).toBe('IAB-372');
      expect(profile.interests.topics[0].engagementDepth).toBe('deep');
    });

    it('should include evidence with source tracking', () => {
      const evidence: IkigaiEvidence = {
        dimension: 'experiences',
        sourceType: 'email',
        sourceId: 'email_123',
        signalStrength: 0.8,
        extractedAt: Date.now(),
      };

      const profile: IkigaiProfile = {
        userId: 'user_def',
        updatedAt: Date.now(),
        experiences: {
          preferredTypes: ['travel'],
          frequency: 'frequent',
          recentActivities: [],
        },
        relationships: {
          keyPeople: [],
          socialFrequency: 'social',
        },
        interests: {
          topics: [],
          hobbies: [],
        },
        giving: {
          causes: [],
          giftGivingFrequency: 0,
        },
        dimensionWeights: {
          experiences: 0.25,
          relationships: 0.25,
          interests: 0.25,
          giving: 0.25,
        },
        evidence: [evidence],
      };

      expect(profile.evidence[0].dimension).toBe('experiences');
      expect(profile.evidence[0].sourceType).toBe('email');
    });
  });

  describe('ExperienceType type', () => {
    it('should include all v13 experience types', () => {
      const types: ExperienceType[] = [
        'travel',
        'entertainment',
        'dining',
        'adventure',
        'learning',
        'creative',
        'social',
        'outdoor',
        'wellness',
      ];
      expect(types).toHaveLength(9);
    });
  });
});
