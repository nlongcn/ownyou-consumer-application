/**
 * Insights Generator Tests - Sprint 8
 *
 * Tests for LLM-based agentic insight generation.
 * v13 architecture: No rule-based approaches - all detailed insights via LLM.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateInsights,
  generateInsightsAsync,
  setInsightLLMClient,
  filterByCategory,
  getActionableInsights,
} from '../analyzers/insights.js';
import type { AnalysisContext, DiscoveredPattern, ProfileCompleteness } from '../types.js';
import type { LLMClient, LLMResponse } from '@ownyou/llm-client';

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

  describe('generateInsights (synchronous fallback)', () => {
    it('should return success with empty patterns', () => {
      const result = generateInsights([], baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return fallback insights when patterns exist', () => {
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
      expect(result.data).toBeDefined();
      // Fallback includes a "Patterns discovered" insight when patterns exist
      const patternInsight = result.data!.find((i) => i.title === 'Patterns discovered');
      expect(patternInsight).toBeDefined();
      expect(patternInsight!.body).toContain('1 behavioral patterns detected');
    });

    it('should generate profile building suggestion for low completeness', () => {
      const lowCompleteness: ProfileCompleteness = {
        ...baseCompleteness,
        overall: 20,
      };

      const result = generateInsights([], lowCompleteness, baseContext);

      expect(result.success).toBe(true);
      const buildProfileInsight = result.data!.find((i) => i.title === 'Profile building opportunity');
      expect(buildProfileInsight).toBeDefined();
      expect(buildProfileInsight!.actionable).toBe(true);
    });

    it('should not generate low completeness insight when completeness is high', () => {
      const highCompleteness: ProfileCompleteness = {
        ...baseCompleteness,
        overall: 75,
      };

      const result = generateInsights([], highCompleteness, baseContext);

      expect(result.success).toBe(true);
      const buildProfileInsight = result.data!.find((i) => i.title === 'Profile building opportunity');
      expect(buildProfileInsight).toBeUndefined();
    });

    it('should include all related pattern IDs in fallback insights', () => {
      const patterns: DiscoveredPattern[] = [
        { id: 'pattern_1', type: 'spending_habit', title: 'Test 1', description: '', evidence: [], confidence: 0.8, newSinceLastReport: false },
        { id: 'pattern_2', type: 'social_rhythm', title: 'Test 2', description: '', evidence: [], confidence: 0.7, newSinceLastReport: false },
      ];

      const result = generateInsights(patterns, baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      const patternInsight = result.data!.find((i) => i.title === 'Patterns discovered');
      expect(patternInsight).toBeDefined();
      expect(patternInsight!.relatedPatterns).toContain('pattern_1');
      expect(patternInsight!.relatedPatterns).toContain('pattern_2');
    });
  });

  describe('generateInsightsAsync (LLM-based)', () => {
    it('should generate insights using mock LLM client', async () => {
      const mockLLMResponse: LLMResponse = {
        success: true,
        content: JSON.stringify([
          {
            category: 'financial',
            title: 'Spending pattern detected',
            body: 'You have a recurring dining spending pattern',
            actionable: true,
            suggestedAction: 'Review your dining budget',
            relatedPatternTypes: ['spending_habit'],
          },
          {
            category: 'well_being',
            title: 'Balanced lifestyle',
            body: 'Your spending shows variety in experiences',
            actionable: false,
          },
        ]),
        usage: { inputTokens: 100, outputTokens: 50 },
      };

      const mockLLMClient = {
        complete: vi.fn().mockResolvedValue(mockLLMResponse),
      } as unknown as LLMClient;

      const patterns: DiscoveredPattern[] = [
        {
          id: 'spending_1',
          type: 'spending_habit',
          title: 'Dining spending',
          description: 'Regular dining expenses',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: true,
        },
      ];

      const result = await generateInsightsAsync(patterns, baseCompleteness, baseContext, {
        llmClient: mockLLMClient,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(2);
      expect(mockLLMClient.complete).toHaveBeenCalled();

      // Check insights are parsed correctly
      const financialInsight = result.data!.find((i) => i.category === 'financial');
      expect(financialInsight).toBeDefined();
      expect(financialInsight!.title).toBe('Spending pattern detected');
      expect(financialInsight!.actionable).toBe(true);
    });

    it('should fallback to structural insights when LLM fails', async () => {
      const mockLLMClient = {
        complete: vi.fn().mockResolvedValue({
          success: false,
          error: 'API error',
        }),
      } as unknown as LLMClient;

      const patterns: DiscoveredPattern[] = [
        {
          id: 'spending_1',
          type: 'spending_habit',
          title: 'Test',
          description: 'Test',
          evidence: [],
          confidence: 0.8,
          newSinceLastReport: true,
        },
      ];

      const result = await generateInsightsAsync(patterns, baseCompleteness, baseContext, {
        llmClient: mockLLMClient,
      });

      expect(result.success).toBe(true);
      // Should get fallback insights
      expect(result.data).toBeDefined();
    });

    it('should use module-level LLM client when set', async () => {
      const mockLLMResponse: LLMResponse = {
        success: true,
        content: JSON.stringify([
          {
            category: 'opportunity',
            title: 'Connect more sources',
            body: 'Add calendar for better insights',
            actionable: true,
          },
        ]),
        usage: { inputTokens: 50, outputTokens: 25 },
      };

      const mockLLMClient = {
        complete: vi.fn().mockResolvedValue(mockLLMResponse),
      } as unknown as LLMClient;

      setInsightLLMClient(mockLLMClient);

      const result = await generateInsightsAsync([], baseCompleteness, baseContext);

      expect(result.success).toBe(true);
      expect(mockLLMClient.complete).toHaveBeenCalled();

      // Reset for other tests
      setInsightLLMClient(null as unknown as LLMClient);
    });

    it('should handle malformed LLM JSON response', async () => {
      const mockLLMClient = {
        complete: vi.fn().mockResolvedValue({
          success: true,
          content: 'This is not valid JSON',
        }),
      } as unknown as LLMClient;

      const result = await generateInsightsAsync([], baseCompleteness, baseContext, {
        llmClient: mockLLMClient,
      });

      // Should fallback to structural insights when JSON parsing fails
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle markdown-wrapped JSON response', async () => {
      const mockLLMResponse: LLMResponse = {
        success: true,
        content: '```json\n[{"category":"achievement","title":"Great progress","body":"Test","actionable":false}]\n```',
        usage: { inputTokens: 50, outputTokens: 25 },
      };

      const mockLLMClient = {
        complete: vi.fn().mockResolvedValue(mockLLMResponse),
      } as unknown as LLMClient;

      const result = await generateInsightsAsync([], baseCompleteness, baseContext, {
        llmClient: mockLLMClient,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(1);
      expect(result.data![0].title).toBe('Great progress');
    });

    it('should respect maxInsights config', async () => {
      const mockLLMResponse: LLMResponse = {
        success: true,
        content: JSON.stringify([
          { category: 'financial', title: 'Insight 1', body: 'Body 1', actionable: false },
          { category: 'financial', title: 'Insight 2', body: 'Body 2', actionable: false },
          { category: 'financial', title: 'Insight 3', body: 'Body 3', actionable: false },
          { category: 'financial', title: 'Insight 4', body: 'Body 4', actionable: false },
          { category: 'financial', title: 'Insight 5', body: 'Body 5', actionable: false },
        ]),
        usage: { inputTokens: 100, outputTokens: 100 },
      };

      const mockLLMClient = {
        complete: vi.fn().mockResolvedValue(mockLLMResponse),
      } as unknown as LLMClient;

      const result = await generateInsightsAsync([], baseCompleteness, baseContext, {
        llmClient: mockLLMClient,
        maxInsights: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeLessThanOrEqual(3);
    });
  });

  describe('filterByCategory', () => {
    it('should filter insights by category', () => {
      const insights = [
        { id: '1', category: 'financial' as const, title: 'F1', body: '', actionable: true, relatedPatterns: [] },
        { id: '2', category: 'well_being' as const, title: 'W1', body: '', actionable: false, relatedPatterns: [] },
        { id: '3', category: 'financial' as const, title: 'F2', body: '', actionable: false, relatedPatterns: [] },
      ];

      const financialOnly = filterByCategory(insights, 'financial');
      expect(financialOnly.length).toBe(2);
      for (const insight of financialOnly) {
        expect(insight.category).toBe('financial');
      }
    });

    it('should return empty array when no insights match', () => {
      const insights = [
        { id: '1', category: 'financial' as const, title: 'F1', body: '', actionable: true, relatedPatterns: [] },
      ];

      const wellBeingOnly = filterByCategory(insights, 'well_being');
      expect(wellBeingOnly.length).toBe(0);
    });
  });

  describe('getActionableInsights', () => {
    it('should return only actionable insights', () => {
      const insights = [
        { id: '1', category: 'financial' as const, title: 'A1', body: '', actionable: true, relatedPatterns: [] },
        { id: '2', category: 'well_being' as const, title: 'N1', body: '', actionable: false, relatedPatterns: [] },
        { id: '3', category: 'opportunity' as const, title: 'A2', body: '', actionable: true, relatedPatterns: [] },
      ];

      const actionable = getActionableInsights(insights);
      expect(actionable.length).toBe(2);
      for (const insight of actionable) {
        expect(insight.actionable).toBe(true);
      }
    });

    it('should return empty array when no actionable insights exist', () => {
      const insights = [
        { id: '1', category: 'achievement' as const, title: 'N1', body: '', actionable: false, relatedPatterns: [] },
      ];

      const actionable = getActionableInsights(insights);
      expect(actionable.length).toBe(0);
    });
  });
});
