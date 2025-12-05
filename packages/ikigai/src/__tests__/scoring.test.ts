/**
 * Scoring Tests - v13 Section 2.6-2.7
 *
 * Tests for well-being scoring and rewards system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateWellBeingScore,
  sortMissionsByWellBeing,
  getWellBeingAlignmentSummary,
  type MissionCard,
} from '../scoring/well-being-score';
import {
  calculateMissionRewards,
  awardMissionPoints,
  getUserPoints,
  getDominantCategory,
  getIkigaiTier,
} from '../scoring/rewards';
import type { IkigaiProfile, Person } from '../types';

// Mock store
function createMockStore(profile?: IkigaiProfile, people?: Person[]) {
  const data: Record<string, Record<string, unknown>> = {};

  if (profile) {
    data['ownyou.semantic:test-user'] = {
      ikigai_profile: profile,
    };
  }

  if (people) {
    people.forEach((p, i) => {
      const key = `person:${p.name.toLowerCase().replace(/\s+/g, '_')}`;
      data[`ownyou.entities:test-user`] = {
        ...data[`ownyou.entities:test-user`],
        [key]: {
          name: p.name,
          relationship: p.relationshipType,
          interactionFrequency: p.interactionFrequency,
          sharedActivities: p.sharedActivities,
          relationshipStrength: p.relationshipStrength,
        },
      };
    });
  }

  return {
    async get(namespace: readonly string[], key: string) {
      const nsKey = namespace.join(':');
      return data[nsKey]?.[key] ? { key, value: data[nsKey][key] } : null;
    },
    async list(namespace: readonly string[], options?: { prefix?: string }) {
      const nsKey = namespace.join(':');
      const items = data[nsKey] || {};
      return Object.entries(items)
        .filter(([key]) => !options?.prefix || key.startsWith(options.prefix))
        .map(([key, value]) => ({ key, value }));
    },
    async put(namespace: readonly string[], key: string, value: Record<string, unknown>) {
      const nsKey = namespace.join(':');
      if (!data[nsKey]) data[nsKey] = {};
      data[nsKey][key] = value;
    },
  };
}

// Create test profile
function createTestProfile(): IkigaiProfile {
  return {
    userId: 'test-user',
    updatedAt: Date.now(),
    experiences: {
      preferredTypes: ['travel', 'dining'],
      frequency: 'frequent',
      recentActivities: [],
      patterns: {},
      confidence: 0.8,
    },
    relationships: {
      keyPeople: [
        {
          name: 'Sarah',
          relationshipType: 'partner',
          interactionFrequency: 'daily',
          sharedInterests: [],
          sharedActivities: ['travel'],
          relationshipStrength: 0.95,
          evidence: '',
        },
      ],
      socialFrequency: 'social',
      relationshipInvestmentPatterns: '',
      confidence: 0.9,
    },
    interests: {
      genuineInterests: [
        {
          topic: 'photography',
          evidenceType: 'purchases',
          engagementDepth: 'deep',
          evidence: '',
        },
      ],
      hobbies: ['hiking'],
      learningInterests: [],
      confidence: 0.7,
    },
    giving: {
      charitableGiving: [{ cause: 'Environmental', frequency: 'monthly', evidence: '' }],
      giftGiving: { frequency: 'frequent', recipients: ['Sarah'] },
      volunteering: [],
      carePatterns: '',
      confidence: 0.6,
    },
    dimensionWeights: {
      experiences: 0.3,
      relationships: 0.3,
      interests: 0.2,
      giving: 0.2,
    },
    evidence: [],
    confidence: 0.75,
  };
}

describe('Well-Being Scoring', () => {
  describe('calculateWellBeingScore', () => {
    it('should return base utility score when no profile exists', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'shopping',
        title: 'Buy groceries',
        summary: 'Weekly grocery shopping',
        utilityScore: 0.6,
      };

      const store = createMockStore();
      const score = await calculateWellBeingScore(mission, 'test-user', store);

      expect(score.utilityScore).toBe(0.6);
      expect(score.experienceBoost).toBe(0);
      expect(score.relationshipBoost).toBe(0);
      expect(score.totalScore).toBe(0.6);
    });

    it('should add experience boost for travel missions', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'travel',
        title: 'Book hotel',
        summary: 'Hotel in Paris',
        utilityScore: 0.5,
      };

      const profile = createTestProfile();
      const store = createMockStore(profile);
      const score = await calculateWellBeingScore(mission, 'test-user', store);

      expect(score.experienceBoost).toBeGreaterThan(0);
      expect(score.totalScore).toBeGreaterThan(0.5);
    });

    it('should add relationship boost when key person mentioned', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'shopping',
        title: 'Birthday gift for Sarah',
        summary: 'Find a nice gift',
        utilityScore: 0.5,
      };

      const profile = createTestProfile();
      const people: Person[] = profile.relationships.keyPeople;
      const store = createMockStore(profile, people);
      const score = await calculateWellBeingScore(mission, 'test-user', store);

      expect(score.relationshipBoost).toBeGreaterThan(0);
    });

    it('should add interest alignment for matching interests', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'shopping',
        title: 'New photography lens',
        summary: 'Camera equipment',
        utilityScore: 0.5,
      };

      const profile = createTestProfile();
      const store = createMockStore(profile);
      const score = await calculateWellBeingScore(mission, 'test-user', store);

      expect(score.interestAlignment).toBeGreaterThan(0);
    });

    it('should add giving boost for charitable missions', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'shopping',
        title: 'Donate to charity',
        summary: 'Environmental cause',
        utilityScore: 0.5,
      };

      const profile = createTestProfile();
      const store = createMockStore(profile);
      const score = await calculateWellBeingScore(mission, 'test-user', store);

      expect(score.givingBoost).toBeGreaterThan(0);
    });

    it('should cap total score at 2.0', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'travel',
        title: 'Photography trip with Sarah for charity',
        summary: 'All dimensions',
        utilityScore: 1.5,
      };

      const profile = createTestProfile();
      const people: Person[] = profile.relationships.keyPeople;
      const store = createMockStore(profile, people);
      const score = await calculateWellBeingScore(mission, 'test-user', store);

      expect(score.totalScore).toBeLessThanOrEqual(2.0);
    });
  });

  describe('sortMissionsByWellBeing', () => {
    it('should sort missions by total score descending', async () => {
      const missions: MissionCard[] = [
        { id: '1', type: 'shopping', title: 'Generic', summary: 'Basic', utilityScore: 0.3 },
        { id: '2', type: 'travel', title: 'Travel', summary: 'Adventure', utilityScore: 0.5 },
        { id: '3', type: 'shopping', title: 'Gift', summary: 'For Sarah', utilityScore: 0.4 },
      ];

      const profile = createTestProfile();
      const people: Person[] = profile.relationships.keyPeople;
      const store = createMockStore(profile, people);

      const sorted = await sortMissionsByWellBeing(missions, 'test-user', store);

      expect(sorted[0].id).toBe('2'); // Travel gets experience boost
      expect(sorted[sorted.length - 1].id).toBe('1'); // Generic has lowest score
    });
  });

  describe('getWellBeingAlignmentSummary', () => {
    it('should return utility for no boosts', () => {
      const score = {
        utilityScore: 0.5,
        experienceBoost: 0,
        relationshipBoost: 0,
        interestAlignment: 0,
        givingBoost: 0,
        totalScore: 0.5,
      };

      expect(getWellBeingAlignmentSummary(score)).toBe('utility');
    });

    it('should list active boost types', () => {
      const score = {
        utilityScore: 0.5,
        experienceBoost: 0.1,
        relationshipBoost: 0.2,
        interestAlignment: 0,
        givingBoost: 0,
        totalScore: 0.8,
      };

      const summary = getWellBeingAlignmentSummary(score);
      expect(summary).toContain('experience');
      expect(summary).toContain('relationship');
      expect(summary).not.toContain('giving');
    });
  });
});

describe('Rewards System', () => {
  describe('calculateMissionRewards', () => {
    it('should give base achiever points for any mission', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'shopping',
        title: 'Basic task',
        summary: 'Simple',
      };

      const store = createMockStore();
      const rewards = await calculateMissionRewards(mission, 'test-user', store);

      expect(rewards.categories.achiever).toBe(100); // Base points
    });

    it('should give explorer points for experience missions', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'travel',
        title: 'Book trip',
        summary: 'Adventure',
      };

      const store = createMockStore();
      const rewards = await calculateMissionRewards(mission, 'test-user', store);

      expect(rewards.categories.explorer).toBe(200); // 2x multiplier
    });

    it('should give connector points when key person involved', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'events',
        title: 'Dinner with Sarah',
        summary: 'Date night',
      };

      const profile = createTestProfile();
      const store = createMockStore(profile);
      const rewards = await calculateMissionRewards(mission, 'test-user', store);

      expect(rewards.categories.connector).toBe(150); // 1.5x multiplier
    });

    it('should give helper points for giving missions', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'shopping',
        title: 'Buy a gift',
        summary: 'For mom',
      };

      const store = createMockStore();
      const rewards = await calculateMissionRewards(mission, 'test-user', store);

      expect(rewards.categories.helper).toBe(250); // 2.5x multiplier
    });
  });

  describe('awardMissionPoints', () => {
    it('should update user points', async () => {
      const mission: MissionCard = {
        id: '1',
        type: 'travel',
        title: 'Book trip',
        summary: 'Adventure',
      };

      const store = createMockStore();
      const pointsAwarded = await awardMissionPoints(mission, 'test-user', store);

      expect(pointsAwarded).toBe(200);

      const userPoints = await getUserPoints('test-user', store);
      expect(userPoints.total).toBe(200);
      expect(userPoints.explorer).toBe(200);
    });

    it('should accumulate points across missions', async () => {
      const store = createMockStore();

      await awardMissionPoints(
        { id: '1', type: 'travel', title: 'Trip 1', summary: '' },
        'test-user',
        store
      );
      await awardMissionPoints(
        { id: '2', type: 'shopping', title: 'Gift', summary: '' },
        'test-user',
        store
      );

      const userPoints = await getUserPoints('test-user', store);
      expect(userPoints.total).toBe(450); // 200 + 250
    });
  });

  describe('getDominantCategory', () => {
    it('should return category with highest points', async () => {
      const store = createMockStore();

      // Award more helper points
      await awardMissionPoints(
        { id: '1', type: 'shopping', title: 'Gift 1', summary: '' },
        'test-user',
        store
      );
      await awardMissionPoints(
        { id: '2', type: 'shopping', title: 'Gift 2', summary: '' },
        'test-user',
        store
      );

      const category = await getDominantCategory('test-user', store);
      expect(category).toBe('helper');
    });
  });

  describe('getIkigaiTier', () => {
    it('should return Bronze for low points', () => {
      const tier = getIkigaiTier(500);
      expect(tier.tier).toBe('Bronze');
      expect(tier.nextTierAt).toBe(1000);
      expect(tier.progress).toBeCloseTo(0.5);
    });

    it('should return Silver for 1000+ points', () => {
      const tier = getIkigaiTier(2500);
      expect(tier.tier).toBe('Silver');
      expect(tier.nextTierAt).toBe(5000);
    });

    it('should return Gold for 5000+ points', () => {
      const tier = getIkigaiTier(10000);
      expect(tier.tier).toBe('Gold');
    });

    it('should return Diamond for 50000+ points', () => {
      const tier = getIkigaiTier(100000);
      expect(tier.tier).toBe('Diamond');
      expect(tier.progress).toBe(1);
    });
  });
});
