/**
 * Insights Generator Tests - Sprint 8
 */

import { describe, it, expect } from 'vitest';
import {
  generateInsights,
  filterByCategory,
  getActionableInsights,
} from '../analyzers/insights.js';
import type { AnalysisContext, DiscoveredPattern, ProfileCompleteness } from '../types.js';

describe('Insights Generator', () => {
  const baseCompleteness: ProfileCompleteness = {
    overall: 50,
    bySource: {
      email: { connected: true, lastSync: Date.now(), itemCount: 100, coverage: 50 },
      financial: { connected: true, lastSync: Date.now(), itemCount: 50, coverage: 25 },
      calendar: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
      browser: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
    },
    byDimension: {
      experiences: 40,
      relationships: 30,
      interests: 50,
      giving: 20,
    },
    missingData: ['calendar', 'browser'],
  };

  const baseContext: AnalysisContext = {
    userId: 'test-user',
    analysisType: 'manual',
  };

  describe('generateInsights', () => {
    it('should return success with empty patterns', () => {
      const result = generateInsights([], baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should generate financial insights from spending patterns', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'spending_1',
          type: 'spending_habit',
          title: 'Frequent dining spending',
          description: '30% of spending on dining',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: true,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      const financialInsights = result.data!.filter((i) => i.category === 'financial');
      expect(financialInsights.length).toBeGreaterThan(0);
    });

    it('should generate relationship insights from social patterns', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'social_1',
          type: 'social_rhythm',
          title: 'Active meeting schedule',
          description: '10 meetings this week',
          evidence: [],
          confidence: 0.75,
          newSinceLastReport: false,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      const relationshipInsights = result.data!.filter((i) => i.category === 'relationship');
      expect(relationshipInsights.length).toBeGreaterThan(0);
    });

    it('should generate subscription insights from recurring patterns', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'sub_1',
          type: 'spending_habit',
          title: 'Recurring Netflix payment',
          description: '$15.99/month to Netflix',
          evidence: [],
          confidence: 0.85,
          newSinceLastReport: false,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      const subInsight = result.data!.find((i) => i.title === 'Subscription detected');
      expect(subInsight).toBeDefined();
      expect(subInsight!.actionable).toBe(true);
    });

    it('should generate connection suggestion for low completeness', () => {
      const lowCompleteness: ProfileCompleteness = {
        ...baseCompleteness,
        overall: 20,
      };

      const result = generateInsights([], lowCompleteness, baseContext);

      expect(result.success).toBe(true);
      const buildProfileInsight = result.data!.find((i) => i.title === 'Build your profile');
      expect(buildProfileInsight).toBeDefined();
      expect(buildProfileInsight!.actionable).toBe(true);
    });

    it('should generate achievement insight for high completeness', () => {
      const highCompleteness: ProfileCompleteness = {
        ...baseCompleteness,
        overall: 75,
      };

      const result = generateInsights([], highCompleteness, baseContext);

      expect(result.success).toBe(true);
      const achievementInsight = result.data!.find((i) => i.title === 'Great profile coverage!');
      expect(achievementInsight).toBeDefined();
      expect(achievementInsight!.category).toBe('achievement');
    });

    it('should generate well-being insights from interest patterns', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'interest_1',
          type: 'interest_growth',
          title: 'Interest in Technology',
          description: '10 technology-related emails',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: true,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      const wellBeingInsights = result.data!.filter((i) => i.category === 'well_being');
      expect(wellBeingInsights.length).toBeGreaterThan(0);
    });

    it('should generate cross-source insights', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'cross_1',
          type: 'cross_source',
          title: 'Travel activity detected',
          description: 'Travel spending and calendar events',
          evidence: [
            { source: 'financial', type: 'spending', value: '$800', timestamp: Date.now() },
            { source: 'calendar', type: 'event', value: 'Trip', timestamp: Date.now() },
          ],
          confidence: 0.9,
          newSinceLastReport: true,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      const crossInsight = result.data!.find((i) => i.title === 'Multi-source pattern');
      expect(crossInsight).toBeDefined();
    });

    it('should generate opportunity insights from high confidence interests', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'interest_high',
          type: 'interest_growth',
          title: 'Interest in Cooking',
          description: 'Strong interest in cooking',
          evidence: [],
          confidence: 0.85,
          newSinceLastReport: true,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      const opportunityInsights = result.data!.filter((i) => i.category === 'opportunity');
      expect(opportunityInsights.length).toBeGreaterThan(0);
    });

    it('should prioritize actionable insights', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'actionable',
          type: 'spending_habit',
          title: 'Recurring Spotify',
          description: 'Subscription detected',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: false,
        },
        {
          id: 'non_actionable',
          type: 'social_rhythm',
          title: 'Social pattern',
          description: 'Regular social activity',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: false,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      // Actionable insights should come first
      const actionableIndex = result.data!.findIndex((i) => i.actionable);
      const nonActionableIndex = result.data!.findIndex((i) => !i.actionable);

      if (actionableIndex !== -1 && nonActionableIndex !== -1) {
        expect(actionableIndex).toBeLessThan(nonActionableIndex);
      }
    });

    it('should deduplicate similar insights', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'spending_1',
          type: 'spending_habit',
          title: 'Spending pattern A',
          description: 'Pattern A',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: false,
        },
        {
          id: 'spending_2',
          type: 'spending_habit',
          title: 'Spending pattern B',
          description: 'Pattern B',
          evidence: [],
          confidence: 0.7,
          newSinceLastReport: false,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      // Should not have duplicate "Spending pattern" insights
      const spendingInsights = result.data!.filter((i) => i.title === 'Spending pattern');
      expect(spendingInsights.length).toBeLessThanOrEqual(1);
    });

    it('should generate achievement milestones for large email data', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        emailData: {
          classifications: new Array(150).fill({ category: 'test' }),
          profile: {},
        },
      };

      const result = generateInsights([], baseCompleteness, context);

      expect(result.success).toBe(true);
      const milestone = result.data!.find((i) => i.title === 'Email analysis milestone');
      expect(milestone).toBeDefined();
      expect(milestone!.category).toBe('achievement');
    });

    it('should generate achievement milestones for large transaction data', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        financialData: {
          transactions: new Array(75).fill({ amount: 50 }),
          profile: {},
        },
      };

      const result = generateInsights([], baseCompleteness, context);

      expect(result.success).toBe(true);
      const milestone = result.data!.find((i) => i.title === 'Financial insight milestone');
      expect(milestone).toBeDefined();
    });

    it('should link insights to related patterns', () => {
      const patterns: DiscoveredPattern[] = [
        {
          id: 'pattern_123',
          type: 'spending_habit',
          title: 'Dining spending',
          description: 'Test',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: false,
        },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      const insight = result.data!.find((i) => i.relatedPatterns.includes('pattern_123'));
      expect(insight).toBeDefined();
    });
  });

  describe('filterByCategory', () => {
    it('should filter insights by category', () => {
      const patterns: DiscoveredPattern[] = [
        { id: '1', type: 'spending_habit', title: 'Spending', description: '', evidence: [], confidence: 0.8, newSinceLastReport: false },
        { id: '2', type: 'social_rhythm', title: 'Social', description: '', evidence: [], confidence: 0.8, newSinceLastReport: false },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);
      expect(result.success).toBe(true);

      const financialOnly = filterByCategory(result.data!, 'financial');
      for (const insight of financialOnly) {
        expect(insight.category).toBe('financial');
      }
    });
  });

  describe('getActionableInsights', () => {
    it('should return only actionable insights', () => {
      const patterns: DiscoveredPattern[] = [
        { id: '1', type: 'spending_habit', title: 'Recurring Sub', description: '', evidence: [], confidence: 0.8, newSinceLastReport: false },
        { id: '2', type: 'social_rhythm', title: 'Social', description: '', evidence: [], confidence: 0.8, newSinceLastReport: false },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);
      expect(result.success).toBe(true);

      const actionable = getActionableInsights(result.data!);
      for (const insight of actionable) {
        expect(insight.actionable).toBe(true);
      }
    });
  });
});
