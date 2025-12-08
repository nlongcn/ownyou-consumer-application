/**
 * Insight Generator - Sprint 8
 *
 * Generates actionable insights from patterns and profile data.
 */

import type {
  Insight,
  InsightCategory,
  DiscoveredPattern,
  ProfileCompleteness,
  AnalysisContext,
  AnalyzerResult,
} from '../types.js';

/**
 * Generate insights from patterns and completeness data
 */
export function generateInsights(
  patterns: DiscoveredPattern[],
  completeness: ProfileCompleteness,
  context: AnalysisContext
): AnalyzerResult<Insight[]> {
  try {
    const insights: Insight[] = [];

    // Generate pattern-based insights
    const patternInsights = generatePatternInsights(patterns);
    insights.push(...patternInsights);

    // Generate completeness-based insights
    const completenessInsights = generateCompletenessInsights(completeness);
    insights.push(...completenessInsights);

    // Generate well-being insights
    const wellBeingInsights = generateWellBeingInsights(patterns, context);
    insights.push(...wellBeingInsights);

    // Generate opportunity insights
    const opportunityInsights = generateOpportunityInsights(patterns, context);
    insights.push(...opportunityInsights);

    // Deduplicate and prioritize
    const prioritizedInsights = prioritizeInsights(insights);

    return {
      success: true,
      data: prioritizedInsights,
    };
  } catch (error) {
    return {
      success: false,
      error: `Insight generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate insights from discovered patterns
 */
function generatePatternInsights(patterns: DiscoveredPattern[]): Insight[] {
  const insights: Insight[] = [];

  for (const pattern of patterns) {
    switch (pattern.type) {
      case 'spending_habit':
        if (pattern.title.includes('Recurring')) {
          insights.push({
            id: `insight_${pattern.id}`,
            category: 'financial',
            title: 'Subscription detected',
            body: pattern.description,
            actionable: true,
            suggestedAction: 'Review if this subscription is still valuable to you',
            relatedPatterns: [pattern.id],
          });
        } else {
          insights.push({
            id: `insight_${pattern.id}`,
            category: 'financial',
            title: 'Spending pattern',
            body: pattern.description,
            actionable: true,
            suggestedAction: 'Consider if this spending aligns with your goals',
            relatedPatterns: [pattern.id],
          });
        }
        break;

      case 'social_rhythm':
        insights.push({
          id: `insight_${pattern.id}`,
          category: 'relationship',
          title: 'Social activity',
          body: pattern.description,
          actionable: false,
          relatedPatterns: [pattern.id],
        });
        break;

      case 'relationship_change':
        insights.push({
          id: `insight_${pattern.id}`,
          category: 'relationship',
          title: 'Connection highlight',
          body: pattern.description,
          actionable: true,
          suggestedAction: 'Consider scheduling a catch-up',
          relatedPatterns: [pattern.id],
        });
        break;

      case 'interest_growth':
        insights.push({
          id: `insight_${pattern.id}`,
          category: 'well_being',
          title: 'Growing interest',
          body: pattern.description,
          actionable: true,
          suggestedAction: 'Explore more content related to this interest',
          relatedPatterns: [pattern.id],
        });
        break;

      case 'interest_decline':
        insights.push({
          id: `insight_${pattern.id}`,
          category: 'well_being',
          title: 'Changing interest',
          body: pattern.description,
          actionable: false,
          relatedPatterns: [pattern.id],
        });
        break;

      case 'cross_source':
        insights.push({
          id: `insight_${pattern.id}`,
          category: 'well_being',
          title: 'Multi-source pattern',
          body: pattern.description,
          actionable: true,
          suggestedAction: 'This interest spans multiple areas of your life',
          relatedPatterns: [pattern.id],
        });
        break;

      case 'lifestyle_shift':
        insights.push({
          id: `insight_${pattern.id}`,
          category: 'well_being',
          title: 'Lifestyle change detected',
          body: pattern.description,
          actionable: true,
          suggestedAction: 'Reflect on this change and whether it aligns with your goals',
          relatedPatterns: [pattern.id],
        });
        break;
    }
  }

  return insights;
}

/**
 * Generate insights from profile completeness
 */
function generateCompletenessInsights(completeness: ProfileCompleteness): Insight[] {
  const insights: Insight[] = [];

  // Overall completeness insight
  if (completeness.overall < 30) {
    insights.push({
      id: `completeness_low_${Date.now()}`,
      category: 'opportunity',
      title: 'Build your profile',
      body: `Your profile is ${completeness.overall}% complete. Connect more data sources for better insights.`,
      actionable: true,
      suggestedAction: 'Connect your calendar or financial data',
      relatedPatterns: [],
    });
  } else if (completeness.overall >= 70) {
    insights.push({
      id: `completeness_high_${Date.now()}`,
      category: 'achievement',
      title: 'Great profile coverage!',
      body: `Your profile is ${completeness.overall}% complete. You're getting comprehensive insights.`,
      actionable: false,
      relatedPatterns: [],
    });
  }

  // Dimension-specific insights
  const { byDimension } = completeness;

  if (byDimension.relationships < 20 && byDimension.experiences > 50) {
    insights.push({
      id: `dimension_relationships_${Date.now()}`,
      category: 'opportunity',
      title: 'Strengthen relationship insights',
      body: 'Connect your calendar to better understand your social patterns.',
      actionable: true,
      suggestedAction: 'Connect Google or Microsoft Calendar',
      relatedPatterns: [],
    });
  }

  if (byDimension.interests < 30) {
    insights.push({
      id: `dimension_interests_${Date.now()}`,
      category: 'opportunity',
      title: 'Discover your interests',
      body: 'Connect more data sources to uncover your true interests.',
      actionable: true,
      suggestedAction: 'Connect email or browser history',
      relatedPatterns: [],
    });
  }

  return insights;
}

/**
 * Generate well-being focused insights
 */
function generateWellBeingInsights(
  patterns: DiscoveredPattern[],
  context: AnalysisContext
): Insight[] {
  const insights: Insight[] = [];

  // Check for work-life balance indicators
  const socialPatterns = patterns.filter(
    (p) => p.type === 'social_rhythm' || p.type === 'relationship_change'
  );
  const workPatterns = patterns.filter(
    (p) => p.title.toLowerCase().includes('meeting') || p.title.toLowerCase().includes('work')
  );

  if (workPatterns.length > socialPatterns.length * 2) {
    insights.push({
      id: `wellbeing_balance_${Date.now()}`,
      category: 'well_being',
      title: 'Work-life balance check',
      body: 'Your calendar shows more work activities than social events.',
      actionable: true,
      suggestedAction: 'Consider scheduling time for social activities',
      relatedPatterns: workPatterns.map((p) => p.id),
    });
  }

  // Check for spending on experiences vs things
  const experiencePatterns = patterns.filter(
    (p) =>
      p.type === 'spending_habit' &&
      (p.title.toLowerCase().includes('travel') ||
        p.title.toLowerCase().includes('entertainment') ||
        p.title.toLowerCase().includes('dining'))
  );

  if (experiencePatterns.length > 0) {
    insights.push({
      id: `wellbeing_experiences_${Date.now()}`,
      category: 'well_being',
      title: 'Investing in experiences',
      body: "You're spending on experiences, which research shows contributes to happiness.",
      actionable: false,
      relatedPatterns: experiencePatterns.map((p) => p.id),
    });
  }

  return insights;
}

/**
 * Generate opportunity insights
 */
function generateOpportunityInsights(
  patterns: DiscoveredPattern[],
  context: AnalysisContext
): Insight[] {
  const insights: Insight[] = [];

  // Look for interest patterns that could lead to opportunities
  const interestPatterns = patterns.filter(
    (p) => p.type === 'interest_growth' || p.type === 'cross_source'
  );

  for (const pattern of interestPatterns.slice(0, 2)) {
    if (pattern.confidence > 0.7) {
      insights.push({
        id: `opportunity_${pattern.id}`,
        category: 'opportunity',
        title: `Explore ${pattern.title.replace('Interest in ', '')}`,
        body: `Based on your activity, you might enjoy exploring this interest further.`,
        actionable: true,
        suggestedAction: 'Check out local events or online communities',
        relatedPatterns: [pattern.id],
      });
    }
  }

  // Achievement insights based on data volume
  if (context.emailData?.classifications) {
    const count = (context.emailData.classifications as unknown[]).length;
    if (count >= 100) {
      insights.push({
        id: `achievement_emails_${Date.now()}`,
        category: 'achievement',
        title: 'Email analysis milestone',
        body: `${count} emails analyzed for interest patterns.`,
        actionable: false,
        relatedPatterns: [],
      });
    }
  }

  if (context.financialData?.transactions) {
    const count = (context.financialData.transactions as unknown[]).length;
    if (count >= 50) {
      insights.push({
        id: `achievement_transactions_${Date.now()}`,
        category: 'achievement',
        title: 'Financial insight milestone',
        body: `${count} transactions analyzed for spending patterns.`,
        actionable: false,
        relatedPatterns: [],
      });
    }
  }

  return insights;
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
