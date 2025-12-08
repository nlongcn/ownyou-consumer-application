/**
 * Pattern Analyzer Tests - Sprint 8
 */

import { describe, it, expect } from 'vitest';
import {
  analyzePatterns,
  calculatePatternConfidence,
  filterByConfidence,
} from '../analyzers/patterns.js';
import type { AnalysisContext, DiscoveredPattern } from '../types.js';

describe('Pattern Analyzer', () => {
  describe('analyzePatterns', () => {
    it('should return empty patterns for empty context', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(0);
    });

    it('should detect spending patterns from financial data', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        financialData: {
          transactions: [
            { merchant: 'Grocery Store', category: 'food', amount: 100, date: '2024-01-01' },
            { merchant: 'Grocery Store', category: 'food', amount: 80, date: '2024-01-08' },
            { merchant: 'Grocery Store', category: 'food', amount: 120, date: '2024-01-15' },
            { merchant: 'Restaurant', category: 'dining', amount: 50, date: '2024-01-02' },
            { merchant: 'Gas Station', category: 'transportation', amount: 40, date: '2024-01-05' },
          ],
          profile: {},
        },
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);

      const spendingPatterns = result.data!.filter((p) => p.type === 'spending_habit');
      expect(spendingPatterns.length).toBeGreaterThan(0);
    });

    it('should detect recurring subscription patterns', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        financialData: {
          transactions: [
            { merchant: 'Netflix', category: 'entertainment', amount: 15.99, date: '2024-01-01' },
            { merchant: 'Netflix', category: 'entertainment', amount: 15.99, date: '2024-02-01' },
            { merchant: 'Netflix', category: 'entertainment', amount: 15.99, date: '2024-03-01' },
          ],
          profile: {},
        },
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      const subscriptionPatterns = result.data!.filter((p) => p.title.includes('Recurring'));
      expect(subscriptionPatterns.length).toBeGreaterThan(0);
    });

    it('should detect social patterns from calendar data', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        calendarData: {
          events: [
            { title: 'Team Meeting', type: 'meeting', attendees: [{ email: 'alice@example.com' }], startTime: '2024-01-01T10:00:00Z' },
            { title: 'Project Review', type: 'meeting', attendees: [{ email: 'bob@example.com' }], startTime: '2024-01-02T14:00:00Z' },
            { title: 'Sprint Planning', type: 'meeting', attendees: [{ email: 'alice@example.com' }], startTime: '2024-01-03T09:00:00Z' },
            { title: '1:1 with Alice', type: 'meeting', attendees: [{ email: 'alice@example.com' }], startTime: '2024-01-04T11:00:00Z' },
            { title: 'Design Review', type: 'meeting', attendees: [{ email: 'alice@example.com' }], startTime: '2024-01-05T15:00:00Z' },
            { title: 'Standup', type: 'meeting', attendees: [{ email: 'team@example.com' }], startTime: '2024-01-06T09:00:00Z' },
          ],
          profile: {},
        },
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      const socialPatterns = result.data!.filter((p) => p.type === 'social_rhythm' || p.type === 'relationship_change');
      expect(socialPatterns.length).toBeGreaterThan(0);
    });

    it('should detect frequent contacts', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        calendarData: {
          events: [
            { title: 'Meeting 1', attendees: [{ email: 'frequent@example.com' }], startTime: '2024-01-01T10:00:00Z' },
            { title: 'Meeting 2', attendees: [{ email: 'frequent@example.com' }], startTime: '2024-01-02T10:00:00Z' },
            { title: 'Meeting 3', attendees: [{ email: 'frequent@example.com' }], startTime: '2024-01-03T10:00:00Z' },
            { title: 'Meeting 4', attendees: [{ email: 'frequent@example.com' }], startTime: '2024-01-04T10:00:00Z' },
          ],
          profile: {},
        },
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      const relationshipPatterns = result.data!.filter((p) => p.type === 'relationship_change');
      expect(relationshipPatterns.length).toBeGreaterThan(0);
    });

    it('should detect interest patterns from email data', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        emailData: {
          classifications: [
            { category: 'Technology', subcategory: 'Software', confidence: 0.9 },
            { category: 'Technology', subcategory: 'AI', confidence: 0.85 },
            { category: 'Technology', subcategory: 'Cloud', confidence: 0.8 },
            { category: 'Technology', subcategory: 'Mobile', confidence: 0.75 },
            { category: 'Travel', subcategory: 'Hotels', confidence: 0.7 },
          ],
          profile: {},
        },
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      const interestPatterns = result.data!.filter((p) => p.type === 'interest_growth');
      expect(interestPatterns.length).toBeGreaterThan(0);
    });

    it('should detect cross-source travel patterns', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        financialData: {
          transactions: [
            { merchant: 'United Airlines', category: 'travel', amount: 500, date: '2024-01-10' },
            { merchant: 'Hilton Hotel', category: 'travel', amount: 300, date: '2024-01-12' },
          ],
          profile: {},
        },
        calendarData: {
          events: [
            { title: 'Trip to NYC', type: 'travel', startTime: '2024-01-12T08:00:00Z' },
          ],
          profile: {},
        },
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      const crossSourcePatterns = result.data!.filter((p) => p.type === 'cross_source');
      expect(crossSourcePatterns.length).toBeGreaterThan(0);
    });

    it('should mark patterns as new when no previous report', () => {
      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        financialData: {
          transactions: [
            { merchant: 'Store', category: 'shopping', amount: 100, date: '2024-01-01' },
            { merchant: 'Store', category: 'shopping', amount: 150, date: '2024-01-08' },
            { merchant: 'Store', category: 'shopping', amount: 120, date: '2024-01-15' },
          ],
          profile: {},
        },
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      // All patterns should be marked as new
      for (const pattern of result.data!) {
        expect(pattern.newSinceLastReport).toBe(true);
      }
    });

    it('should mark patterns as not new when type exists in previous report', () => {
      const previousPatterns: DiscoveredPattern[] = [
        {
          id: 'old_pattern',
          type: 'spending_habit',
          title: 'Old spending',
          description: 'Previous spending pattern',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: false,
        },
      ];

      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'scheduled',
        previousReport: {
          id: 'prev_report',
          userId: 'test-user',
          generatedAt: Date.now() - 86400000,
          completeness: {
            overall: 50,
            bySource: {
              email: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
              financial: { connected: true, lastSync: Date.now(), itemCount: 10, coverage: 50 },
              calendar: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
              browser: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
            },
            byDimension: { experiences: 0, relationships: 0, interests: 0, giving: 0 },
            missingData: [],
          },
          patterns: previousPatterns,
          insights: [],
          suggestions: [],
          version: '1.0.0',
          analysisType: 'scheduled',
        },
        financialData: {
          transactions: [
            { merchant: 'Store', category: 'shopping', amount: 100, date: '2024-01-01' },
            { merchant: 'Store', category: 'shopping', amount: 150, date: '2024-01-08' },
          ],
          profile: {},
        },
      };

      const result = analyzePatterns(context);

      expect(result.success).toBe(true);
      const spendingPatterns = result.data!.filter((p) => p.type === 'spending_habit');
      // Spending patterns should NOT be new since type existed before
      for (const pattern of spendingPatterns) {
        expect(pattern.newSinceLastReport).toBe(false);
      }
    });
  });

  describe('calculatePatternConfidence', () => {
    it('should add evidence boost to confidence', () => {
      const pattern: DiscoveredPattern = {
        id: 'test',
        type: 'spending_habit',
        title: 'Test',
        description: 'Test pattern',
        evidence: [
          { source: 'financial', type: 'transaction', value: 'test', timestamp: Date.now() },
          { source: 'financial', type: 'transaction', value: 'test2', timestamp: Date.now() },
          { source: 'financial', type: 'transaction', value: 'test3', timestamp: Date.now() },
        ],
        confidence: 0.7,
        newSinceLastReport: false,
      };

      const boostedConfidence = calculatePatternConfidence(pattern);

      expect(boostedConfidence).toBeGreaterThan(0.7);
      expect(boostedConfidence).toBeLessThanOrEqual(1);
    });

    it('should add cross-source boost for cross_source patterns', () => {
      const pattern: DiscoveredPattern = {
        id: 'test',
        type: 'cross_source',
        title: 'Test',
        description: 'Cross source pattern',
        evidence: [
          { source: 'financial', type: 'spending', value: 'test', timestamp: Date.now() },
        ],
        confidence: 0.7,
        newSinceLastReport: false,
      };

      const boostedConfidence = calculatePatternConfidence(pattern);

      expect(boostedConfidence).toBeGreaterThan(0.75); // 0.7 + 0.05 (evidence) + 0.1 (cross_source)
    });

    it('should cap confidence at 1.0', () => {
      const pattern: DiscoveredPattern = {
        id: 'test',
        type: 'cross_source',
        title: 'Test',
        description: 'High confidence pattern',
        evidence: new Array(10).fill({
          source: 'financial',
          type: 'test',
          value: 'test',
          timestamp: Date.now(),
        }),
        confidence: 0.95,
        newSinceLastReport: false,
      };

      const boostedConfidence = calculatePatternConfidence(pattern);

      expect(boostedConfidence).toBe(1);
    });
  });

  describe('filterByConfidence', () => {
    it('should filter patterns below threshold', () => {
      const patterns: DiscoveredPattern[] = [
        { id: '1', type: 'spending_habit', title: 'High', description: '', evidence: [], confidence: 0.9, newSinceLastReport: false },
        { id: '2', type: 'spending_habit', title: 'Medium', description: '', evidence: [], confidence: 0.6, newSinceLastReport: false },
        { id: '3', type: 'spending_habit', title: 'Low', description: '', evidence: [], confidence: 0.3, newSinceLastReport: false },
      ];

      const filtered = filterByConfidence(patterns, 0.5);

      expect(filtered.length).toBe(2);
      expect(filtered.find((p) => p.id === '3')).toBeUndefined();
    });

    it('should use default threshold of 0.5', () => {
      const patterns: DiscoveredPattern[] = [
        { id: '1', type: 'spending_habit', title: 'Above', description: '', evidence: [], confidence: 0.51, newSinceLastReport: false },
        { id: '2', type: 'spending_habit', title: 'Below', description: '', evidence: [], confidence: 0.49, newSinceLastReport: false },
      ];

      const filtered = filterByConfidence(patterns);

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('1');
    });
  });
});
