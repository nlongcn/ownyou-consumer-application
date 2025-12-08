/**
 * Completeness Analyzer Tests - Sprint 8
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeProfileCompleteness,
  generateCompletenessSuggestions,
  calculateProfileScore,
} from '../analyzers/completeness.js';
import type { AnalysisContext, ProfileCompleteness } from '../types.js';

describe('Completeness Analyzer', () => {
  describe('analyzeProfileCompleteness', () => {
    it('should return zero completeness for empty context', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
      };

      const result = analyzeProfileCompleteness(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.overall).toBe(0);
      expect(result.data!.bySource.email.connected).toBe(false);
      expect(result.data!.bySource.financial.connected).toBe(false);
      expect(result.data!.bySource.calendar.connected).toBe(false);
      expect(result.data!.bySource.browser.connected).toBe(false);
    });

    it('should calculate email completeness', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        emailData: {
          classifications: new Array(250).fill({ category: 'test' }),
          profile: { lastSync: Date.now() },
        },
      };

      const result = analyzeProfileCompleteness(context);

      expect(result.success).toBe(true);
      expect(result.data!.bySource.email.connected).toBe(true);
      expect(result.data!.bySource.email.itemCount).toBe(250);
      expect(result.data!.bySource.email.coverage).toBe(50); // 250/500 * 100
    });

    it('should calculate financial completeness', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        financialData: {
          transactions: new Array(100).fill({ amount: 50 }),
          profile: { lastSync: Date.now() },
        },
      };

      const result = analyzeProfileCompleteness(context);

      expect(result.success).toBe(true);
      expect(result.data!.bySource.financial.connected).toBe(true);
      expect(result.data!.bySource.financial.itemCount).toBe(100);
      expect(result.data!.bySource.financial.coverage).toBe(50); // 100/200 * 100
    });

    it('should calculate calendar completeness', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        calendarData: {
          events: new Array(75).fill({ title: 'Meeting' }),
          profile: { lastSync: Date.now() },
        },
      };

      const result = analyzeProfileCompleteness(context);

      expect(result.success).toBe(true);
      expect(result.data!.bySource.calendar.connected).toBe(true);
      expect(result.data!.bySource.calendar.itemCount).toBe(75);
      expect(result.data!.bySource.calendar.coverage).toBe(75); // 75/100 * 100
    });

    it('should cap coverage at 100%', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        emailData: {
          classifications: new Array(1000).fill({ category: 'test' }),
          profile: {},
        },
      };

      const result = analyzeProfileCompleteness(context);

      expect(result.success).toBe(true);
      expect(result.data!.bySource.email.coverage).toBe(100);
    });

    it('should analyze dimension completeness from ikigai profile', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        ikigaiProfile: {
          dimensions: {
            experiences: { score: 0.8 },
            relationships: { score: 0.6 },
            interests: { score: 0.4 },
            giving: { score: 0.2 },
          },
        },
      };

      const result = analyzeProfileCompleteness(context);

      expect(result.success).toBe(true);
      expect(result.data!.byDimension.experiences).toBe(80);
      expect(result.data!.byDimension.relationships).toBe(60);
      expect(result.data!.byDimension.interests).toBe(40);
      expect(result.data!.byDimension.giving).toBe(20);
    });

    it('should identify missing data sources', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        emailData: {
          classifications: [{ category: 'test' }],
          profile: {},
        },
      };

      const result = analyzeProfileCompleteness(context);

      expect(result.success).toBe(true);
      expect(result.data!.missingData).toContain('financial');
      expect(result.data!.missingData).toContain('calendar');
      expect(result.data!.missingData).toContain('browser');
      expect(result.data!.missingData).not.toContain('email');
    });

    it('should calculate weighted overall score', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        emailData: {
          classifications: new Array(500).fill({ category: 'test' }),
          profile: {},
        },
        financialData: {
          transactions: new Array(200).fill({ amount: 50 }),
          profile: {},
        },
        calendarData: {
          events: new Array(100).fill({ title: 'Event' }),
          profile: {},
        },
        ikigaiProfile: {
          dimensions: {
            experiences: { score: 1.0 },
            relationships: { score: 1.0 },
            interests: { score: 1.0 },
            giving: { score: 1.0 },
          },
        },
      };

      const result = analyzeProfileCompleteness(context);

      expect(result.success).toBe(true);
      // With all sources at 100% and dimensions at 100%
      // Source contribution: (100*0.3 + 100*0.3 + 100*0.25 + 0*0.15) * 0.7 = 59.5
      // Dimension contribution: 100 * 0.3 = 30
      // Total: 89.5, rounded to 90 (approximately, due to browser being 0)
      expect(result.data!.overall).toBeGreaterThan(80);
    });
  });

  describe('generateCompletenessSuggestions', () => {
    it('should suggest connecting financial data when missing', () => {
      const completeness: ProfileCompleteness = {
        overall: 20,
        bySource: {
          email: { connected: true, lastSync: Date.now(), itemCount: 100, coverage: 50 },
          financial: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
          calendar: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
          browser: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
        },
        byDimension: {
          experiences: 30,
          relationships: 20,
          interests: 40,
          giving: 10,
        },
        missingData: ['financial', 'calendar', 'browser'],
      };

      const suggestions = generateCompletenessSuggestions(completeness);

      expect(suggestions.length).toBeGreaterThan(0);
      const financialSuggestion = suggestions.find((s) => s.source === 'financial');
      expect(financialSuggestion).toBeDefined();
      expect(financialSuggestion!.priority).toBe('high');
    });

    it('should suggest connecting calendar data when missing', () => {
      const completeness: ProfileCompleteness = {
        overall: 30,
        bySource: {
          email: { connected: true, lastSync: Date.now(), itemCount: 200, coverage: 40 },
          financial: { connected: true, lastSync: Date.now(), itemCount: 50, coverage: 25 },
          calendar: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
          browser: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
        },
        byDimension: {
          experiences: 50,
          relationships: 30,
          interests: 60,
          giving: 20,
        },
        missingData: ['calendar', 'browser'],
      };

      const suggestions = generateCompletenessSuggestions(completeness);

      const calendarSuggestion = suggestions.find((s) => s.source === 'calendar');
      expect(calendarSuggestion).toBeDefined();
      expect(calendarSuggestion!.priority).toBe('high');
    });

    it('should suggest health data when multiple sources connected', () => {
      const completeness: ProfileCompleteness = {
        overall: 60,
        bySource: {
          email: { connected: true, lastSync: Date.now(), itemCount: 300, coverage: 60 },
          financial: { connected: true, lastSync: Date.now(), itemCount: 150, coverage: 75 },
          calendar: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
          browser: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
        },
        byDimension: {
          experiences: 70,
          relationships: 50,
          interests: 80,
          giving: 30,
        },
        missingData: ['calendar', 'browser'],
      };

      const suggestions = generateCompletenessSuggestions(completeness);

      const healthSuggestion = suggestions.find((s) => s.source === 'health');
      expect(healthSuggestion).toBeDefined();
      expect(healthSuggestion!.priority).toBe('medium');
    });

    it('should prioritize suggestions correctly', () => {
      const completeness: ProfileCompleteness = {
        overall: 10,
        bySource: {
          email: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
          financial: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
          calendar: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
          browser: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
        },
        byDimension: {
          experiences: 0,
          relationships: 0,
          interests: 0,
          giving: 0,
        },
        missingData: ['email', 'financial', 'calendar', 'browser'],
      };

      const suggestions = generateCompletenessSuggestions(completeness);

      // Financial and calendar should be high priority
      const highPriority = suggestions.filter((s) => s.priority === 'high');
      expect(highPriority.length).toBe(2);

      // Browser should be low priority
      const browserSuggestion = suggestions.find((s) => s.source === 'browser');
      expect(browserSuggestion?.priority).toBe('low');
    });
  });

  describe('calculateProfileScore', () => {
    it('should return overall score from completeness', () => {
      const completeness: ProfileCompleteness = {
        overall: 75,
        bySource: {
          email: { connected: true, lastSync: Date.now(), itemCount: 300, coverage: 60 },
          financial: { connected: true, lastSync: Date.now(), itemCount: 150, coverage: 75 },
          calendar: { connected: true, lastSync: Date.now(), itemCount: 80, coverage: 80 },
          browser: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
        },
        byDimension: {
          experiences: 70,
          relationships: 60,
          interests: 80,
          giving: 50,
        },
        missingData: ['browser'],
      };

      const score = calculateProfileScore(completeness);

      expect(score).toBe(75);
    });
  });
});
