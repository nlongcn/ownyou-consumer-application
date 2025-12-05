/**
 * Integration Tests - v13 Section 2.1-2.9
 *
 * End-to-end integration tests for the Ikigai Intelligence Layer.
 * Tests the complete inference pipeline, configuration, and data flow.
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/bugfixing/SPRINT6_IKIGAI_BUGFIX_REPORT.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NS } from '@ownyou/shared-types';
import {
  IkigaiInferenceEngine,
  createIkigaiEngine,
  type LLMClient,
} from '../engine/inference-engine';
import {
  storeIkigaiProfile,
  getExistingProfile,
  getIkigaiContextForAgent,
} from '../storage/profile-store';
import {
  storeEvidence,
  getEvidenceByDimension,
  getEvidenceSummary,
} from '../storage/evidence-store';
import {
  syncPeopleToEntities,
  getKnownPeople,
  getClosestPeople,
} from '../storage/entity-sync';
import {
  calculateWellBeingScore,
  setWellBeingConfig,
  getWellBeingConfig,
  type MissionCard,
} from '../scoring/well-being-score';
import {
  calculateMissionRewards,
  awardMissionPoints,
  getUserPoints,
  getIkigaiTier,
  setRewardsConfig,
  getRewardsConfig,
} from '../scoring/rewards';
import type {
  IkigaiProfile,
  IkigaiEvidence,
  WellBeingConfig,
  RewardsConfig,
} from '../types';
import { DEFAULT_WELLBEING_CONFIG, DEFAULT_REWARDS_CONFIG } from '../types';

/**
 * Creates a mock LangGraph Store for testing
 * Uses NS.* factory functions for v13 compliance
 */
function createMockStore() {
  const data: Record<string, Record<string, unknown>> = {};

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
        .map(([key, value]) => ({ key, value: value as Record<string, unknown> }));
    },
    async put(namespace: readonly string[], key: string, value: Record<string, unknown>) {
      const nsKey = namespace.join(':');
      if (!data[nsKey]) data[nsKey] = {};
      data[nsKey][key] = value;
    },
    async delete(namespace: readonly string[], key: string) {
      const nsKey = namespace.join(':');
      if (data[nsKey]) delete data[nsKey][key];
    },
    // Test helper to inspect data
    getData() {
      return data;
    },
    // Test helper to seed data
    seedData(nsKey: string, items: Record<string, unknown>) {
      data[nsKey] = { ...data[nsKey], ...items };
    },
  };
}

/**
 * Creates a mock LLM client that returns structured responses
 */
function createMockLLMClient(responses?: Record<string, string>): LLMClient {
  return {
    async complete({ messages }) {
      const content = messages[0]?.content ?? '';

      // Match actual prompt patterns from the prompts/*.ts files
      // Experiences prompt: "analyzing a user's data to understand what experiences"
      if (content.includes('what experiences bring them joy')) {
        return {
          content: JSON.stringify({
            preferredTypes: ['travel', 'dining'],
            frequency: 'frequent',
            recentActivities: [
              {
                type: 'travel',
                description: 'Trip to Paris',
                date: Date.now(),
                evidence: 'email-001',
              },
            ],
            patterns: { timing: 'weekends' },
            confidence: 0.85,
          }),
        };
      }

      // Relationships prompt: "analyzing a user's data to understand their important relationships"
      if (content.includes('important relationships')) {
        return {
          content: JSON.stringify({
            keyPeople: [
              {
                name: 'Sarah Jones',
                relationshipType: 'partner',
                interactionFrequency: 'daily',
                sharedInterests: ['travel', 'cooking'],
                sharedActivities: ['dining'],
                relationshipStrength: 0.95,
                lastInteraction: Date.now(),
                evidence: 'email-002',
              },
            ],
            socialFrequency: 'social',
            relationshipInvestmentPatterns: 'Regular quality time',
            confidence: 0.9,
          }),
        };
      }

      // Interests prompt: "analyzing a user's data to understand their genuine interests"
      if (content.includes('genuine interests')) {
        return {
          content: JSON.stringify({
            genuineInterests: [
              {
                topic: 'photography',
                evidenceType: 'purchases',
                engagementDepth: 'deep',
                evidence: 'trans-001',
              },
            ],
            hobbies: ['photography', 'hiking'],
            learningInterests: ['machine learning'],
            confidence: 0.75,
          }),
        };
      }

      // Giving prompt: "analyzing a user's data to understand how they contribute to others"
      if (content.includes('contribute to others') || content.includes('giving patterns')) {
        return {
          content: JSON.stringify({
            charitableGiving: [
              { cause: 'Environmental', frequency: 'monthly', evidence: 'email-003' },
            ],
            giftGiving: { frequency: 'frequent', recipients: ['Sarah'] },
            volunteering: ['Local food bank'],
            carePatterns: 'Thoughtful gifts',
            confidence: 0.7,
          }),
        };
      }

      // Synthesis prompt: Contains "Synthesize" or "dimension weights"
      if (content.includes('Synthesize') || content.includes('dimension weights') || content.includes('overall profile')) {
        return {
          content: JSON.stringify({
            dimensionWeights: {
              experiences: 0.3,
              relationships: 0.3,
              interests: 0.2,
              giving: 0.2,
            },
            overallConfidence: 0.8,
            insights: 'Active lifestyle with strong relationships',
          }),
        };
      }

      // Default response
      return { content: '{}' };
    },
  };
}

/**
 * Creates a test profile with all required fields
 */
function createTestProfile(userId: string = 'test-user'): IkigaiProfile {
  return {
    userId,
    updatedAt: Date.now(),
    experiences: {
      preferredTypes: ['travel', 'dining'],
      frequency: 'frequent',
      recentActivities: [
        {
          type: 'travel',
          description: 'Trip to Paris',
          date: Date.now(),
          evidence: 'email-001',
        },
      ],
      patterns: { timing: 'weekends' },
      confidence: 0.85,
    },
    relationships: {
      keyPeople: [
        {
          name: 'Sarah Jones',
          relationshipType: 'partner',
          interactionFrequency: 'daily',
          sharedInterests: ['travel'],
          sharedActivities: ['dining'],
          relationshipStrength: 0.95,
          evidence: 'email-002',
        },
      ],
      socialFrequency: 'social',
      relationshipInvestmentPatterns: 'Regular quality time',
      confidence: 0.9,
    },
    interests: {
      genuineInterests: [
        {
          topic: 'photography',
          evidenceType: 'purchases',
          engagementDepth: 'deep',
          evidence: 'trans-001',
        },
      ],
      hobbies: ['photography', 'hiking'],
      learningInterests: ['machine learning'],
      confidence: 0.75,
    },
    giving: {
      charitableGiving: [
        { cause: 'Environmental', frequency: 'monthly', evidence: 'email-003' },
      ],
      giftGiving: { frequency: 'frequent', recipients: ['Sarah'] },
      volunteering: ['Local food bank'],
      carePatterns: 'Thoughtful gifts',
      confidence: 0.7,
    },
    dimensionWeights: {
      experiences: 0.3,
      relationships: 0.3,
      interests: 0.2,
      giving: 0.2,
    },
    evidence: [],
    confidence: 0.8,
  };
}

describe('Integration: Inference Pipeline', () => {
  let store: ReturnType<typeof createMockStore>;
  let llm: LLMClient;

  beforeEach(() => {
    store = createMockStore();
    llm = createMockLLMClient();
  });

  describe('Full Inference Flow', () => {
    it('should complete full inference pipeline and store results', async () => {
      // Seed some IAB data to trigger inference
      const iabNs = NS.iabClassifications('test-user').join(':');
      store.seedData(iabNs, {
        'iab-001': {
          taxonomy_id: 'Travel/Hotels',
          confidence: 0.9,
          date: Date.now(),
        },
      });

      const engine = createIkigaiEngine(llm, store, {
        modelTier: 'standard',
      });

      const profile = await engine.runInference('test-user', { force: true });

      // Verify profile was created
      expect(profile.userId).toBe('test-user');
      expect(profile.experiences.preferredTypes).toContain('travel');
      expect(profile.relationships.keyPeople.length).toBeGreaterThan(0);
      expect(profile.interests.genuineInterests.length).toBeGreaterThan(0);
      expect(profile.giving.charitableGiving.length).toBeGreaterThan(0);

      // Verify profile was stored
      const storedProfile = await getExistingProfile('test-user', store);
      expect(storedProfile).toBeDefined();
      expect(storedProfile?.userId).toBe('test-user');

      // Verify entities were synced
      const people = await getKnownPeople('test-user', store);
      expect(people.length).toBe(1);
      expect(people[0].name).toBe('Sarah Jones');
    });

    it('should store evidence during inference (I5 fix verification)', async () => {
      const engine = createIkigaiEngine(llm, store, {
        modelTier: 'standard',
      });

      await engine.runInference('test-user', { force: true });

      // Verify evidence was stored
      const summary = await getEvidenceSummary('test-user', store);
      expect(summary.totalCount).toBeGreaterThan(0);

      // Check specific dimensions have evidence
      const experienceEvidence = await getEvidenceByDimension(
        'test-user',
        'experiences',
        store
      );
      expect(experienceEvidence.length).toBeGreaterThan(0);
    });

    it('should include evidence in profile (I5 fix verification)', async () => {
      const engine = createIkigaiEngine(llm, store, {
        modelTier: 'standard',
      });

      const profile = await engine.runInference('test-user', { force: true });

      // Profile should include evidence from the start
      expect(profile.evidence).toBeDefined();
      expect(Array.isArray(profile.evidence)).toBe(true);
      expect(profile.evidence.length).toBeGreaterThan(0);
    });
  });

  describe('Model Configuration (I1 fix verification)', () => {
    it('should use model from modelOverrides when provided', async () => {
      const modelUsed: string[] = [];
      const trackingLLM: LLMClient = {
        async complete({ model }) {
          modelUsed.push(model);
          return { content: '{}' };
        },
      };

      const engine = createIkigaiEngine(trackingLLM, store, {
        modelTier: 'standard',
        modelOverrides: {
          standard: 'custom-model-v1',
        },
      });

      try {
        await engine.runInference('test-user', { force: true });
      } catch {
        // Expected to fail due to empty responses, but model should be used
      }

      expect(modelUsed.length).toBeGreaterThan(0);
      expect(modelUsed[0]).toBe('custom-model-v1');
    });

    it('should fall back to llm-client registry when no override', async () => {
      const modelUsed: string[] = [];
      const trackingLLM: LLMClient = {
        async complete({ model }) {
          modelUsed.push(model);
          return { content: '{}' };
        },
      };

      const engine = createIkigaiEngine(trackingLLM, store, {
        modelTier: 'standard',
        // No modelOverrides - should use registry
      });

      try {
        await engine.runInference('test-user', { force: true });
      } catch {
        // Expected to fail due to empty responses
      }

      // Model should be from registry, not hardcoded
      expect(modelUsed.length).toBeGreaterThan(0);
      // Just verify it's a string (actual model comes from registry)
      expect(typeof modelUsed[0]).toBe('string');
    });
  });

  describe('Namespace Compliance (C1 fix verification)', () => {
    it('should use NS.semanticMemory for profile storage', async () => {
      const profile = createTestProfile('ns-test-user');
      await storeIkigaiProfile('ns-test-user', profile, store);

      // Verify stored in correct namespace
      const data = store.getData();
      const nsKey = NS.semanticMemory('ns-test-user').join(':');
      expect(data[nsKey]).toBeDefined();
      expect(data[nsKey]['ikigai_profile']).toBeDefined();
    });

    it('should use NS.entities for people sync', async () => {
      await syncPeopleToEntities(
        'ns-test-user',
        [
          {
            name: 'Test Person',
            relationshipType: 'friend',
            interactionFrequency: 'weekly',
            sharedInterests: [],
            sharedActivities: [],
            relationshipStrength: 0.8,
            evidence: '',
          },
        ],
        store
      );

      const data = store.getData();
      const nsKey = NS.entities('ns-test-user').join(':');
      expect(data[nsKey]).toBeDefined();
    });

    it('should use NS.ikigaiEvidence for evidence storage', async () => {
      const evidence: IkigaiEvidence[] = [
        {
          dimension: 'experiences',
          sourceType: 'email',
          sourceId: 'test-001',
          signalStrength: 0.8,
          extractedAt: Date.now(),
          summary: 'Test evidence',
        },
      ];

      await storeEvidence('ns-test-user', evidence, store);

      const data = store.getData();
      const nsKey = NS.ikigaiEvidence('ns-test-user').join(':');
      expect(data[nsKey]).toBeDefined();
    });

    it('should use NS.iabClassifications for IAB derived storage (C2 fix)', async () => {
      const profile = createTestProfile('iab-test-user');
      await storeIkigaiProfile('iab-test-user', profile, store);

      const data = store.getData();
      const nsKey = NS.iabClassifications('iab-test-user').join(':');
      expect(data[nsKey]).toBeDefined();
      expect(data[nsKey]['ikigai_derived']).toBeDefined();
    });
  });
});

describe('Integration: Scoring Configuration', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    // Reset configs to defaults
    setWellBeingConfig(DEFAULT_WELLBEING_CONFIG);
    setRewardsConfig(DEFAULT_REWARDS_CONFIG);
  });

  describe('WellBeing Config (I2 fix verification)', () => {
    it('should use configurable boost values', async () => {
      const profile = createTestProfile();
      await storeIkigaiProfile('config-test', profile, store);
      await syncPeopleToEntities('config-test', profile.relationships.keyPeople, store);

      // Get baseline score with default config
      const mission: MissionCard = {
        id: '1',
        type: 'travel',
        title: 'Trip to Paris',
        summary: 'Adventure travel',
        utilityScore: 0.5,
      };

      const baselineScore = await calculateWellBeingScore(mission, 'config-test', store);

      // Update config with higher boost values
      setWellBeingConfig({
        boosts: {
          experienceFull: 0.5, // Higher than default
          experiencePartial: 0.2,
          relationshipFull: 0.4,
          relationshipGift: 0.25,
          interestBase: 0.3,
          interestDeep: 1.5,
          interestModerate: 1.0,
          interestCasual: 0.7,
          givingCharity: 0.4,
          givingGift: 0.25,
        },
      });

      const boostedScore = await calculateWellBeingScore(mission, 'config-test', store);

      // Score should be higher with increased boosts
      expect(boostedScore.experienceBoost).toBeGreaterThanOrEqual(baselineScore.experienceBoost);
    });

    it('should respect configurable max total score', async () => {
      setWellBeingConfig({
        maxTotalScore: 1.0, // Lower cap
      });

      const profile = createTestProfile();
      await storeIkigaiProfile('cap-test', profile, store);

      const mission: MissionCard = {
        id: '1',
        type: 'travel',
        title: 'Photography trip for charity',
        summary: 'All dimensions',
        utilityScore: 0.9,
      };

      const score = await calculateWellBeingScore(mission, 'cap-test', store);
      expect(score.totalScore).toBeLessThanOrEqual(1.0);
    });

    it('should allow getting current config', () => {
      const customConfig: Partial<WellBeingConfig> = {
        maxTotalScore: 3.0,
      };
      setWellBeingConfig(customConfig);

      const config = getWellBeingConfig();
      expect(config.maxTotalScore).toBe(3.0);
    });
  });

  describe('Rewards Config (M2 fix verification)', () => {
    it('should use configurable tier thresholds', () => {
      // Custom tier thresholds
      setRewardsConfig({
        tierThresholds: [
          { name: 'Starter', threshold: 0 },
          { name: 'Pro', threshold: 500 },
          { name: 'Elite', threshold: 2000 },
        ],
      });

      const tier = getIkigaiTier(1000);
      expect(tier.tier).toBe('Pro');
      expect(tier.nextTierAt).toBe(2000);
    });

    it('should use configurable multipliers', async () => {
      // Higher multipliers
      setRewardsConfig({
        basePoints: 200, // Higher base
        multipliers: {
          experience: 3.0,
          relationship: 2.0,
          giving: 3.5,
        },
      });

      const mission = {
        id: '1',
        type: 'travel',
        title: 'Adventure trip',
        summary: '',
      };

      const rewards = await calculateMissionRewards(mission, 'test-user', store);
      expect(rewards.categories.explorer).toBe(600); // 200 * 3.0
    });

    it('should allow getting current config', () => {
      setRewardsConfig({
        basePoints: 150,
      });

      const config = getRewardsConfig();
      expect(config.basePoints).toBe(150);
    });
  });
});

describe('Integration: Profile and Entity Flow', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  describe('Profile Context for Agents', () => {
    it('should provide formatted context when profile exists', async () => {
      const profile = createTestProfile('context-user');
      await storeIkigaiProfile('context-user', profile, store);

      const context = await getIkigaiContextForAgent('context-user', store);

      expect(context).toContain('travel');
      expect(context).toContain('Sarah Jones');
      expect(context).toContain('photography');
      expect(context).toContain('Environmental');
    });

    it('should return message when no profile exists', async () => {
      const context = await getIkigaiContextForAgent('unknown-user', store);
      expect(context).toBe('No Ikigai profile available yet.');
    });
  });

  describe('Entity Sync and Retrieval', () => {
    it('should sync people and allow retrieval by relationship strength', async () => {
      const profile = createTestProfile('entity-user');
      // Add more people with varying strength
      profile.relationships.keyPeople.push(
        {
          name: 'Mom',
          relationshipType: 'family',
          interactionFrequency: 'weekly',
          sharedInterests: [],
          sharedActivities: ['calls'],
          relationshipStrength: 0.85,
          evidence: 'email-003',
        },
        {
          name: 'Work Colleague',
          relationshipType: 'colleague',
          interactionFrequency: 'daily',
          sharedInterests: ['tech'],
          sharedActivities: ['meetings'],
          relationshipStrength: 0.6,
          evidence: 'email-004',
        }
      );

      await syncPeopleToEntities('entity-user', profile.relationships.keyPeople, store);

      const closest = await getClosestPeople('entity-user', store, 2);
      expect(closest.length).toBe(2);
      expect(closest[0].name).toBe('Sarah Jones'); // Highest strength (0.95)
      expect(closest[1].name).toBe('Mom'); // Second highest (0.85)
    });
  });

  describe('Evidence Aggregation', () => {
    it('should aggregate evidence across dimensions', async () => {
      const evidence: IkigaiEvidence[] = [
        {
          dimension: 'experiences',
          sourceType: 'email',
          sourceId: 'e1',
          signalStrength: 0.8,
          extractedAt: Date.now(),
          summary: 'Trip',
        },
        {
          dimension: 'experiences',
          sourceType: 'email',
          sourceId: 'e2',
          signalStrength: 0.7,
          extractedAt: Date.now(),
          summary: 'Restaurant',
        },
        {
          dimension: 'relationships',
          sourceType: 'email',
          sourceId: 'r1',
          signalStrength: 0.9,
          extractedAt: Date.now(),
          summary: 'Person mention',
        },
        {
          dimension: 'interests',
          sourceType: 'browser',
          sourceId: 'i1',
          signalStrength: 0.6,
          extractedAt: Date.now(),
          summary: 'Topic research',
        },
      ];

      await storeEvidence('agg-user', evidence, store);

      const summary = await getEvidenceSummary('agg-user', store);
      expect(summary.totalCount).toBe(4);
      expect(summary.byDimension.experiences).toBe(2);
      expect(summary.byDimension.relationships).toBe(1);
      expect(summary.byDimension.interests).toBe(1);
    });
  });
});

describe('Integration: Points and Tier Progression', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    setRewardsConfig(DEFAULT_REWARDS_CONFIG);
  });

  describe('Point Accumulation', () => {
    it('should accumulate points across multiple missions', async () => {
      // Award points for different mission types
      await awardMissionPoints(
        { id: '1', type: 'travel', title: 'Trip', summary: '' },
        'prog-user',
        store
      );
      await awardMissionPoints(
        { id: '2', type: 'shopping', title: 'Gift for Mom', summary: '' },
        'prog-user',
        store
      );
      await awardMissionPoints(
        { id: '3', type: 'events', title: 'Concert', summary: '' },
        'prog-user',
        store
      );

      const points = await getUserPoints('prog-user', store);
      expect(points.total).toBeGreaterThan(0);
      expect(points.explorer).toBeGreaterThan(0); // From travel + events
      expect(points.helper).toBeGreaterThan(0); // From gift
    });

    it('should track tier progression based on points', async () => {
      // Award enough points to progress tiers
      for (let i = 0; i < 10; i++) {
        await awardMissionPoints(
          { id: `t${i}`, type: 'travel', title: 'Trip', summary: '' },
          'tier-user',
          store
        );
      }

      const points = await getUserPoints('tier-user', store);
      const tier = getIkigaiTier(points.total);

      // With 10 travel missions at 200 points each = 2000 points
      // Should be in Silver tier (1000-5000)
      expect(tier.tier).toBe('Silver');
    });
  });
});
