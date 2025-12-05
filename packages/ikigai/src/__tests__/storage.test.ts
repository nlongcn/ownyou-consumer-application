/**
 * Storage Tests - v13 Section 2.9
 *
 * Tests for profile storage, evidence storage, and entity sync.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeIkigaiProfile,
  getExistingProfile,
  getIkigaiContextForAgent,
} from '../storage/profile-store';
import {
  storeEvidence,
  getEvidenceByDimension,
  getRecentEvidence,
  getEvidenceSummary,
} from '../storage/evidence-store';
import {
  syncPeopleToEntities,
  getKnownPeople,
  getPersonByName,
  getPeopleByRelationship,
  getClosestPeople,
} from '../storage/entity-sync';
import type { IkigaiProfile, IkigaiEvidence, Person } from '../types';

// In-memory mock store
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
    getData() {
      return data;
    },
  };
}

// Create test profile
function createTestProfile(userId: string = 'test-user'): IkigaiProfile {
  return {
    userId,
    updatedAt: Date.now(),
    experiences: {
      preferredTypes: ['travel', 'dining'],
      frequency: 'frequent',
      recentActivities: [
        { type: 'travel', description: 'Trip to Paris', date: Date.now(), evidence: 'email-1' },
      ],
      patterns: { timing: 'weekends' },
      confidence: 0.8,
    },
    relationships: {
      keyPeople: [
        {
          name: 'Sarah Jones',
          relationshipType: 'partner',
          interactionFrequency: 'daily',
          sharedInterests: ['travel', 'cooking'],
          sharedActivities: ['dining', 'travel'],
          relationshipStrength: 0.95,
          evidence: 'email-2',
        },
        {
          name: 'Mom',
          relationshipType: 'family',
          interactionFrequency: 'weekly',
          sharedInterests: [],
          sharedActivities: ['calls'],
          relationshipStrength: 0.9,
          evidence: 'email-3',
        },
      ],
      socialFrequency: 'social',
      relationshipInvestmentPatterns: 'Regular quality time',
      confidence: 0.9,
    },
    interests: {
      genuineInterests: [
        { topic: 'photography', evidenceType: 'purchases', engagementDepth: 'deep', evidence: 'trans-1' },
        { topic: 'hiking', evidenceType: 'activities', engagementDepth: 'moderate', evidence: 'cal-1' },
      ],
      hobbies: ['photography', 'hiking'],
      learningInterests: ['machine learning'],
      confidence: 0.7,
    },
    giving: {
      charitableGiving: [
        { cause: 'Environmental', frequency: 'monthly', evidence: 'email-4' },
      ],
      giftGiving: { frequency: 'frequent', recipients: ['Sarah', 'Mom'] },
      volunteering: ['Local food bank'],
      carePatterns: 'Thoughtful gifts',
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

describe('Profile Store', () => {
  describe('storeIkigaiProfile', () => {
    it('should store profile in semantic memory', async () => {
      const store = createMockStore();
      const profile = createTestProfile();

      await storeIkigaiProfile('test-user', profile, store);

      const stored = await store.get(['ownyou.semantic', 'test-user'], 'ikigai_profile');
      expect(stored).not.toBeNull();
      expect((stored!.value as any).userId).toBe('test-user');
    });

    it('should store IAB-derived categories when interests exist', async () => {
      const store = createMockStore();
      const profile = createTestProfile();

      await storeIkigaiProfile('test-user', profile, store);

      const iabDerived = await store.get(['ownyou.iab', 'test-user'], 'ikigai_derived');
      expect(iabDerived).not.toBeNull();
      expect((iabDerived!.value as any).categories).toContain('photography');
    });
  });

  describe('getExistingProfile', () => {
    it('should return undefined when no profile exists', async () => {
      const store = createMockStore();

      const profile = await getExistingProfile('nonexistent', store);

      expect(profile).toBeUndefined();
    });

    it('should return stored profile', async () => {
      const store = createMockStore();
      const profile = createTestProfile();
      await storeIkigaiProfile('test-user', profile, store);

      const retrieved = await getExistingProfile('test-user', store);

      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe('test-user');
      expect(retrieved?.experiences.preferredTypes).toContain('travel');
    });
  });

  describe('getIkigaiContextForAgent', () => {
    it('should return message when no profile exists', async () => {
      const store = createMockStore();

      const context = await getIkigaiContextForAgent('nonexistent', store);

      expect(context).toBe('No Ikigai profile available yet.');
    });

    it('should return formatted context when profile exists', async () => {
      const store = createMockStore();
      const profile = createTestProfile();
      await storeIkigaiProfile('test-user', profile, store);

      const context = await getIkigaiContextForAgent('test-user', store);

      expect(context).toContain('travel');
      expect(context).toContain('Sarah Jones');
      expect(context).toContain('photography');
      expect(context).toContain('Environmental');
    });
  });
});

describe('Evidence Store', () => {
  describe('storeEvidence', () => {
    it('should store evidence items', async () => {
      const store = createMockStore();
      const evidence: IkigaiEvidence[] = [
        {
          dimension: 'experiences',
          sourceType: 'email',
          sourceId: 'email-1',
          signalStrength: 0.8,
          extractedAt: Date.now(),
          summary: 'Trip booking',
        },
        {
          dimension: 'relationships',
          sourceType: 'email',
          sourceId: 'email-2',
          signalStrength: 0.9,
          extractedAt: Date.now(),
          summary: 'Partner mention',
        },
      ];

      await storeEvidence('test-user', evidence, store);

      const summary = await getEvidenceSummary('test-user', store);
      expect(summary.totalCount).toBe(2);
    });

    it('should store latest batch summary', async () => {
      const store = createMockStore();
      const evidence: IkigaiEvidence[] = [
        {
          dimension: 'experiences',
          sourceType: 'email',
          sourceId: 'email-1',
          signalStrength: 0.8,
          extractedAt: Date.now(),
          summary: 'Trip booking',
        },
      ];

      await storeEvidence('test-user', evidence, store);

      const latestBatch = await store.get(['ownyou.ikigai_evidence', 'test-user'], 'latest_batch');
      expect(latestBatch).not.toBeNull();
      expect((latestBatch!.value as any).count).toBe(1);
    });
  });

  describe('getEvidenceByDimension', () => {
    it('should filter evidence by dimension', async () => {
      const store = createMockStore();
      const evidence: IkigaiEvidence[] = [
        {
          dimension: 'experiences',
          sourceType: 'email',
          sourceId: 'email-1',
          signalStrength: 0.8,
          extractedAt: Date.now(),
          summary: 'Trip',
        },
        {
          dimension: 'relationships',
          sourceType: 'email',
          sourceId: 'email-2',
          signalStrength: 0.9,
          extractedAt: Date.now(),
          summary: 'Person',
        },
      ];

      await storeEvidence('test-user', evidence, store);

      const experiencesEvidence = await getEvidenceByDimension('test-user', 'experiences', store);
      expect(experiencesEvidence.length).toBe(1);
      expect(experiencesEvidence[0].summary).toBe('Trip');
    });
  });

  describe('getEvidenceSummary', () => {
    it('should return counts by dimension', async () => {
      const store = createMockStore();
      const evidence: IkigaiEvidence[] = [
        { dimension: 'experiences', sourceType: 'email', sourceId: '1', signalStrength: 0.8, extractedAt: Date.now(), summary: '' },
        { dimension: 'experiences', sourceType: 'email', sourceId: '2', signalStrength: 0.7, extractedAt: Date.now(), summary: '' },
        { dimension: 'interests', sourceType: 'email', sourceId: '3', signalStrength: 0.6, extractedAt: Date.now(), summary: '' },
      ];

      await storeEvidence('test-user', evidence, store);

      const summary = await getEvidenceSummary('test-user', store);
      expect(summary.byDimension.experiences).toBe(2);
      expect(summary.byDimension.interests).toBe(1);
    });
  });
});

describe('Entity Sync', () => {
  describe('syncPeopleToEntities', () => {
    it('should sync people to entities namespace', async () => {
      const store = createMockStore();
      const profile = createTestProfile();

      await syncPeopleToEntities('test-user', profile.relationships.keyPeople, store);

      const entities = await store.list(['ownyou.entities', 'test-user'], { prefix: 'person:' });
      expect(entities.length).toBe(2);
    });
  });

  describe('getKnownPeople', () => {
    it('should return all synced people', async () => {
      const store = createMockStore();
      const profile = createTestProfile();
      await syncPeopleToEntities('test-user', profile.relationships.keyPeople, store);

      const people = await getKnownPeople('test-user', store);

      expect(people.length).toBe(2);
      expect(people.some((p) => p.name === 'Sarah Jones')).toBe(true);
    });
  });

  describe('getPersonByName', () => {
    it('should find person by name', async () => {
      const store = createMockStore();
      const profile = createTestProfile();
      await syncPeopleToEntities('test-user', profile.relationships.keyPeople, store);

      const person = await getPersonByName('test-user', 'Sarah Jones', store);

      expect(person).toBeDefined();
      expect(person?.relationshipType).toBe('partner');
    });

    it('should return undefined for unknown name', async () => {
      const store = createMockStore();

      const person = await getPersonByName('test-user', 'Unknown Person', store);

      expect(person).toBeUndefined();
    });
  });

  describe('getPeopleByRelationship', () => {
    it('should filter by relationship type', async () => {
      const store = createMockStore();
      const profile = createTestProfile();
      await syncPeopleToEntities('test-user', profile.relationships.keyPeople, store);

      const family = await getPeopleByRelationship('test-user', 'family', store);

      expect(family.length).toBe(1);
      expect(family[0].name).toBe('Mom');
    });
  });

  describe('getClosestPeople', () => {
    it('should return people sorted by relationship strength', async () => {
      const store = createMockStore();
      const profile = createTestProfile();
      await syncPeopleToEntities('test-user', profile.relationships.keyPeople, store);

      const closest = await getClosestPeople('test-user', store, 5);

      expect(closest.length).toBe(2);
      expect(closest[0].name).toBe('Sarah Jones'); // Highest strength
    });
  });
});
