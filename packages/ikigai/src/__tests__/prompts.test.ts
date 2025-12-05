/**
 * Prompts Tests - v13 Section 2.4
 *
 * Tests for all 4 dimension prompts + synthesis.
 */

import { describe, it, expect } from 'vitest';
import {
  experiencesPrompt,
  parseExperiencesResponse,
} from '../prompts/experiences';
import {
  relationshipsPrompt,
  parseRelationshipsResponse,
} from '../prompts/relationships';
import {
  interestsPrompt,
  parseInterestsResponse,
} from '../prompts/interests';
import {
  givingPrompt,
  parseGivingResponse,
} from '../prompts/giving';
import {
  synthesisPrompt,
  parseSynthesisResponse,
} from '../prompts/synthesis';

describe('Experiences Prompt', () => {
  describe('experiencesPrompt', () => {
    it('should generate prompt with sanitized data', () => {
      const prompt = experiencesPrompt('Test data about travel');

      expect(prompt).toContain('Test data about travel');
      expect(prompt).toContain('experiences bring them joy');
      expect(prompt).toContain('No previous profile exists');
    });

    it('should include previous profile context when available', () => {
      const previousProfile = {
        preferredTypes: ['travel', 'dining'] as const,
        frequency: 'frequent' as const,
        recentActivities: [
          { type: 'travel' as const, description: 'Trip to Paris', date: Date.now(), evidence: 'email-1' },
        ],
        patterns: { timing: 'weekends' },
        confidence: 0.8,
      };

      const prompt = experiencesPrompt('Test data', previousProfile);

      expect(prompt).toContain('travel, dining');
      expect(prompt).toContain('frequent');
    });
  });

  describe('parseExperiencesResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        preferredTypes: ['travel', 'dining'],
        frequency: 'frequent',
        recentActivities: [
          { type: 'travel', description: 'Trip to Paris', date: 1700000000000, evidence: 'email-1' },
        ],
        patterns: { timing: 'weekends', companions: ['Sarah'] },
        confidence: 0.85,
      });

      const result = parseExperiencesResponse(response);

      expect(result.preferredTypes).toContain('travel');
      expect(result.frequency).toBe('frequent');
      expect(result.recentActivities).toHaveLength(1);
      expect(result.confidence).toBe(0.85);
    });

    it('should handle invalid JSON gracefully', () => {
      const result = parseExperiencesResponse('not valid json');

      expect(result.preferredTypes).toEqual([]);
      expect(result.frequency).toBe('occasional');
      expect(result.confidence).toBe(0);
    });

    it('should filter invalid experience types', () => {
      const response = JSON.stringify({
        preferredTypes: ['travel', 'invalid_type', 'dining'],
        frequency: 'frequent',
        recentActivities: [],
        patterns: {},
        confidence: 0.7,
      });

      const result = parseExperiencesResponse(response);

      expect(result.preferredTypes).toContain('travel');
      expect(result.preferredTypes).toContain('dining');
      expect(result.preferredTypes).not.toContain('invalid_type');
    });

    it('should clamp confidence to valid range', () => {
      const response = JSON.stringify({
        preferredTypes: [],
        frequency: 'occasional',
        recentActivities: [],
        patterns: {},
        confidence: 1.5, // Over max
      });

      const result = parseExperiencesResponse(response);
      expect(result.confidence).toBe(1);
    });
  });
});

describe('Relationships Prompt', () => {
  describe('relationshipsPrompt', () => {
    it('should generate prompt with sanitized data', () => {
      const prompt = relationshipsPrompt('Test data about relationships');

      expect(prompt).toContain('Test data about relationships');
      expect(prompt).toContain('important relationships');
    });
  });

  describe('parseRelationshipsResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        keyPeople: [
          {
            name: 'Sarah',
            relationshipType: 'partner',
            interactionFrequency: 'daily',
            sharedInterests: ['hiking', 'cooking'],
            sharedActivities: ['travel', 'dining'],
            relationshipStrength: 0.95,
            evidence: 'email-1',
          },
        ],
        socialFrequency: 'social',
        relationshipInvestmentPatterns: 'Regular quality time',
        confidence: 0.9,
      });

      const result = parseRelationshipsResponse(response);

      expect(result.keyPeople).toHaveLength(1);
      expect(result.keyPeople[0].name).toBe('Sarah');
      expect(result.keyPeople[0].relationshipType).toBe('partner');
      expect(result.socialFrequency).toBe('social');
    });

    it('should handle invalid JSON gracefully', () => {
      const result = parseRelationshipsResponse('not valid json');

      expect(result.keyPeople).toEqual([]);
      expect(result.socialFrequency).toBe('social');
      expect(result.confidence).toBe(0);
    });
  });
});

describe('Interests Prompt', () => {
  describe('interestsPrompt', () => {
    it('should generate prompt with sanitized data', () => {
      const prompt = interestsPrompt('Test data about interests');

      expect(prompt).toContain('Test data about interests');
      expect(prompt).toContain('genuine interests');
    });
  });

  describe('parseInterestsResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        genuineInterests: [
          {
            topic: 'Photography',
            evidenceType: 'purchases',
            engagementDepth: 'deep',
            evidence: 'email-1',
          },
        ],
        hobbies: ['hiking', 'reading'],
        learningInterests: ['machine learning'],
        confidence: 0.8,
      });

      const result = parseInterestsResponse(response);

      expect(result.genuineInterests).toHaveLength(1);
      expect(result.genuineInterests[0].topic).toBe('Photography');
      expect(result.hobbies).toContain('hiking');
    });

    it('should handle invalid JSON gracefully', () => {
      const result = parseInterestsResponse('not valid json');

      expect(result.genuineInterests).toEqual([]);
      expect(result.hobbies).toEqual([]);
      expect(result.confidence).toBe(0);
    });
  });
});

describe('Giving Prompt', () => {
  describe('givingPrompt', () => {
    it('should generate prompt with sanitized data', () => {
      const prompt = givingPrompt('Test data about giving');

      expect(prompt).toContain('Test data about giving');
      expect(prompt).toContain('contribute to others');
    });
  });

  describe('parseGivingResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        charitableGiving: [
          { cause: 'Environmental', frequency: 'monthly', evidence: 'email-1' },
        ],
        giftGiving: {
          frequency: 'frequent',
          recipients: ['Sarah', 'Mom'],
        },
        volunteering: ['Local food bank'],
        carePatterns: 'Thoughtful gifts for occasions',
        confidence: 0.75,
      });

      const result = parseGivingResponse(response);

      expect(result.charitableGiving).toHaveLength(1);
      expect(result.charitableGiving[0].cause).toBe('Environmental');
      expect(result.giftGiving.frequency).toBe('frequent');
      expect(result.volunteering).toContain('Local food bank');
    });

    it('should handle invalid JSON gracefully', () => {
      const result = parseGivingResponse('not valid json');

      expect(result.charitableGiving).toEqual([]);
      expect(result.giftGiving.frequency).toBe('occasional');
      expect(result.confidence).toBe(0);
    });
  });
});

describe('Synthesis Prompt', () => {
  const mockDimensions = {
    experiences: {
      preferredTypes: ['travel'] as const,
      frequency: 'frequent' as const,
      recentActivities: [],
      patterns: {},
      confidence: 0.8,
    },
    relationships: {
      keyPeople: [],
      socialFrequency: 'social' as const,
      relationshipInvestmentPatterns: '',
      confidence: 0.7,
    },
    interests: {
      genuineInterests: [],
      hobbies: [],
      learningInterests: [],
      confidence: 0.6,
    },
    giving: {
      charitableGiving: [],
      giftGiving: { frequency: 'occasional' as const, recipients: [] },
      volunteering: [],
      carePatterns: '',
      confidence: 0.5,
    },
  };

  describe('synthesisPrompt', () => {
    it('should generate synthesis prompt', () => {
      const prompt = synthesisPrompt(
        mockDimensions.experiences,
        mockDimensions.relationships,
        mockDimensions.interests,
        mockDimensions.giving
      );

      expect(prompt).toContain('synthesizing');
      expect(prompt).toContain('Experiences analysis');
      expect(prompt).toContain('Relationships analysis');
    });

    it('should include mission feedback when provided', () => {
      const feedback = {
        lovedMissions: ['Travel deals'],
        likedMissions: ['Restaurant suggestions'],
        dismissedMissions: ['Shopping alerts'],
      };

      const prompt = synthesisPrompt(
        mockDimensions.experiences,
        mockDimensions.relationships,
        mockDimensions.interests,
        mockDimensions.giving,
        undefined,
        feedback
      );

      expect(prompt).toContain('Travel deals');
      expect(prompt).toContain('Shopping alerts');
    });
  });

  describe('parseSynthesisResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        dimensionWeights: {
          experiences: 0.4,
          relationships: 0.3,
          interests: 0.2,
          giving: 0.1,
        },
        overallConfidence: 0.75,
        changesSinceLastUpdate: 'Increased travel interest',
        dailyJoy: 'Morning coffee and reading',
      });

      const result = parseSynthesisResponse(response);

      expect(result.dimensionWeights.experiences).toBeCloseTo(0.4, 1);
      expect(result.overallConfidence).toBe(0.75);
      expect(result.changesSinceLastUpdate).toBe('Increased travel interest');
    });

    it('should normalize weights to sum to 1', () => {
      const response = JSON.stringify({
        dimensionWeights: {
          experiences: 0.8,
          relationships: 0.6,
          interests: 0.4,
          giving: 0.2,
        },
        overallConfidence: 0.7,
        changesSinceLastUpdate: '',
      });

      const result = parseSynthesisResponse(response);
      const sum =
        result.dimensionWeights.experiences +
        result.dimensionWeights.relationships +
        result.dimensionWeights.interests +
        result.dimensionWeights.giving;

      expect(sum).toBeCloseTo(1, 2);
    });

    it('should handle invalid JSON gracefully', () => {
      const result = parseSynthesisResponse('not valid json');

      expect(result.dimensionWeights.experiences).toBe(0.25);
      expect(result.overallConfidence).toBe(0.5);
    });
  });
});
