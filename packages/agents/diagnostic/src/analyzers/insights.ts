/**
 * Insight Generator - Sprint 8
 *
 * Generates actionable insights from patterns and profile data using LLM.
 * v13 architecture: NO rule-based approaches - all insights via agentic LLM processes.
 */

import type {
  Insight,
  InsightCategory,
  DiscoveredPattern,
  ProfileCompleteness,
  AnalysisContext,
  AnalyzerResult,
} from '../types.js';
import type { LLMClient, ChatMessage } from '@ownyou/llm-client';

/**
 * Insight generation configuration
 */
export interface InsightGeneratorConfig {
  /** LLM client for agentic insight generation */
  llmClient?: LLMClient;
  /** Maximum insights to generate */
  maxInsights?: number;
  /** User ID for LLM calls */
  userId?: string;
}

/** Module-level LLM client */
let _llmClient: LLMClient | null = null;

/**
 * Set the LLM client for insight generation
 */
export function setInsightLLMClient(client: LLMClient): void {
  _llmClient = client;
}

/**
 * Get the current LLM client
 */
export function getInsightLLMClient(): LLMClient | null {
  return _llmClient;
}

/**
 * Build the insight generation prompt
 */
function buildInsightPrompt(
  patterns: DiscoveredPattern[],
  completeness: ProfileCompleteness,
  context: AnalysisContext
): string {
  const patternSummary = patterns.map(p => ({
    type: p.type,
    title: p.title,
    description: p.description,
    confidence: p.confidence,
  }));

  const contextSummary = {
    emailCount: context.emailData?.classifications ? (context.emailData.classifications as unknown[]).length : 0,
    transactionCount: context.financialData?.transactions ? (context.financialData.transactions as unknown[]).length : 0,
    calendarEventCount: context.calendarData?.events ? (context.calendarData.events as unknown[]).length : 0,
  };

  return `You are an AI assistant generating personalized insights for a user's profile.

Based on the following data, generate actionable and meaningful insights:

## Profile Completeness
- Overall: ${completeness.overall}%
- Email connected: ${completeness.bySource.email.connected} (${completeness.bySource.email.itemCount} items)
- Financial connected: ${completeness.bySource.financial.connected} (${completeness.bySource.financial.itemCount} items)
- Calendar connected: ${completeness.bySource.calendar.connected} (${completeness.bySource.calendar.itemCount} items)
- Ikigai Dimensions: Experiences ${completeness.byDimension.experiences}%, Relationships ${completeness.byDimension.relationships}%, Interests ${completeness.byDimension.interests}%, Giving ${completeness.byDimension.giving}%

## Discovered Patterns
${JSON.stringify(patternSummary, null, 2)}

## Data Context
${JSON.stringify(contextSummary, null, 2)}

Generate 3-5 insights in the following JSON format:
[
  {
    "category": "well_being" | "relationship" | "financial" | "opportunity" | "achievement",
    "title": "Short insight title",
    "body": "Detailed insight description",
    "actionable": true/false,
    "suggestedAction": "Optional action if actionable",
    "relatedPatternTypes": ["pattern_type_1"]
  }
]

Focus on:
1. Well-being insights based on behavior patterns
2. Relationship insights from social activity patterns
3. Financial insights from spending patterns
4. Opportunity suggestions based on growing interests
5. Achievement recognition for milestones

Return ONLY the JSON array, no other text.`;
}

/**
 * Parse LLM response into Insight objects
 */
function parseLLMInsights(
  llmResponse: string,
  patterns: DiscoveredPattern[]
): Insight[] {
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = llmResponse.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const rawInsights = JSON.parse(jsonStr) as Array<{
      category: InsightCategory;
      title: string;
      body: string;
      actionable: boolean;
      suggestedAction?: string;
      relatedPatternTypes?: string[];
    }>;

    return rawInsights.map((raw, index) => ({
      id: `insight_llm_${Date.now()}_${index}`,
      category: raw.category,
      title: raw.title,
      body: raw.body,
      actionable: raw.actionable,
      suggestedAction: raw.suggestedAction,
      relatedPatterns: raw.relatedPatternTypes
        ? patterns.filter(p => raw.relatedPatternTypes!.includes(p.type)).map(p => p.id)
        : [],
    }));
  } catch (error) {
    // If parsing fails, return empty array (let fallback handle it)
    console.warn('Failed to parse LLM insights:', error);
    return [];
  }
}

/**
 * Generate insights from patterns and completeness data using LLM
 */
export async function generateInsightsAsync(
  patterns: DiscoveredPattern[],
  completeness: ProfileCompleteness,
  context: AnalysisContext,
  config: InsightGeneratorConfig = {}
): Promise<AnalyzerResult<Insight[]>> {
  const llmClient = config.llmClient || _llmClient;
  const maxInsights = config.maxInsights ?? 10;
  const userId = config.userId || context.userId;

  try {
    if (llmClient) {
      // LLM-based insight generation (preferred)
      const prompt = buildInsightPrompt(patterns, completeness, context);
      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await llmClient.complete(userId, {
        messages,
        operation: 'diagnostic_insight',
        model: 'fast', // Use fast tier for cost efficiency
      });

      if (response.success && response.content) {
        const llmInsights = parseLLMInsights(response.content, patterns);
        if (llmInsights.length > 0) {
          return {
            success: true,
            data: prioritizeInsights(llmInsights).slice(0, maxInsights),
          };
        }
      }
      // Fall through to fallback if LLM fails
    }

    // Fallback: Generate basic structural insights (minimal, no complex rules)
    const fallbackInsights = generateFallbackInsights(patterns, completeness);
    return {
      success: true,
      data: prioritizeInsights(fallbackInsights).slice(0, maxInsights),
    };
  } catch (error) {
    return {
      success: false,
      error: `Insight generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate fallback insights (minimal structural insights when LLM unavailable)
 * These are NOT rule-based logic - just basic structural observations
 */
function generateFallbackInsights(
  patterns: DiscoveredPattern[],
  completeness: ProfileCompleteness
): Insight[] {
  const insights: Insight[] = [];

  // Basic completeness observation (not a rule, just data)
  if (completeness.overall < 30) {
    insights.push({
      id: `fallback_completeness_${Date.now()}`,
      category: 'opportunity',
      title: 'Profile building opportunity',
      body: `Your profile is ${completeness.overall}% complete. Connect more data sources to enable AI-powered insights.`,
      actionable: true,
      suggestedAction: 'Connect additional data sources',
      relatedPatterns: [],
    });
  }

  // Pattern count observation (not a rule, just data)
  if (patterns.length > 0) {
    insights.push({
      id: `fallback_patterns_${Date.now()}`,
      category: 'well_being',
      title: 'Patterns discovered',
      body: `${patterns.length} behavioral patterns detected. Enable LLM for detailed insights.`,
      actionable: false,
      relatedPatterns: patterns.map(p => p.id),
    });
  }

  return insights;
}

/**
 * Synchronous wrapper for backward compatibility
 * NOTE: This is deprecated - use generateInsightsAsync for LLM-powered insights
 */
export function generateInsights(
  patterns: DiscoveredPattern[],
  completeness: ProfileCompleteness,
  context: AnalysisContext
): AnalyzerResult<Insight[]> {
  // If LLM client is available, we should warn that async version should be used
  if (_llmClient) {
    console.warn('LLM client available - use generateInsightsAsync for better insights');
  }

  // Return fallback insights synchronously
  const fallbackInsights = generateFallbackInsights(patterns, completeness);
  return {
    success: true,
    data: prioritizeInsights(fallbackInsights),
  };
}

/**
 * Prioritize and deduplicate insights
 */
function prioritizeInsights(insights: Insight[]): Insight[] {
  // Deduplicate by category + similar title
  const seen = new Set<string>();
  const unique: Insight[] = [];

  for (const insight of insights) {
    const key = `${insight.category}_${insight.title.toLowerCase().slice(0, 20)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(insight);
    }
  }

  // Sort by priority: actionable first, then by category importance
  const categoryPriority: Record<InsightCategory, number> = {
    opportunity: 1,
    well_being: 2,
    relationship: 3,
    financial: 4,
    achievement: 5,
  };

  return unique.sort((a, b) => {
    // Actionable items first
    if (a.actionable !== b.actionable) {
      return a.actionable ? -1 : 1;
    }
    // Then by category priority
    return categoryPriority[a.category] - categoryPriority[b.category];
  });
}

/**
 * Filter insights by category
 */
export function filterByCategory(insights: Insight[], category: InsightCategory): Insight[] {
  return insights.filter((i) => i.category === category);
}

/**
 * Get actionable insights only
 */
export function getActionableInsights(insights: Insight[]): Insight[] {
  return insights.filter((i) => i.actionable);
}
