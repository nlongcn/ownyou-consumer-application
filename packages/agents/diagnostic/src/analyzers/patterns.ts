/**
 * Pattern Analyzer - Sprint 8
 *
 * Detects behavioral patterns across data sources.
 */

import type {
  DiscoveredPattern,
  PatternEvidence,
  PatternType,
  AnalysisContext,
  AnalyzerResult,
} from '../types.js';

/**
 * Analyze patterns across all data sources
 */
export function analyzePatterns(context: AnalysisContext): AnalyzerResult<DiscoveredPattern[]> {
  try {
    const patterns: DiscoveredPattern[] = [];

    // Analyze spending patterns
    const spendingPatterns = analyzeSpendingPatterns(context);
    patterns.push(...spendingPatterns);

    // Analyze social patterns
    const socialPatterns = analyzeSocialPatterns(context);
    patterns.push(...socialPatterns);

    // Analyze interest patterns
    const interestPatterns = analyzeInterestPatterns(context);
    patterns.push(...interestPatterns);

    // Analyze cross-source patterns
    const crossSourcePatterns = analyzeCrossSourcePatterns(context);
    patterns.push(...crossSourcePatterns);

    // Mark new patterns
    const patternsWithNewFlag = markNewPatterns(patterns, context.previousReport?.patterns);

    return {
      success: true,
      data: patternsWithNewFlag,
    };
  } catch (error) {
    return {
      success: false,
      error: `Pattern analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Analyze spending patterns from financial data
 */
function analyzeSpendingPatterns(context: AnalysisContext): DiscoveredPattern[] {
  const patterns: DiscoveredPattern[] = [];

  if (!context.financialData?.transactions) {
    return patterns;
  }

  const transactions = context.financialData.transactions as Array<{
    merchant?: string;
    category?: string;
    amount?: number;
    date?: string;
  }>;

  if (transactions.length === 0) {
    return patterns;
  }

  // Group by category
  const categoryTotals = new Map<string, number>();
  const categoryTransactions = new Map<string, typeof transactions>();

  for (const tx of transactions) {
    const category = tx.category || 'uncategorized';
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + (tx.amount || 0));

    if (!categoryTransactions.has(category)) {
      categoryTransactions.set(category, []);
    }
    categoryTransactions.get(category)!.push(tx);
  }

  // Find dominant spending categories
  const sortedCategories = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]);

  if (sortedCategories.length > 0) {
    const [topCategory, topAmount] = sortedCategories[0];
    const totalSpending = Array.from(categoryTotals.values()).reduce((a, b) => a + b, 0);
    const percentage = totalSpending > 0 ? (topAmount / totalSpending) * 100 : 0;

    if (percentage > 20) {
      const evidence: PatternEvidence[] = (categoryTransactions.get(topCategory) || [])
        .slice(0, 5)
        .map((tx) => ({
          source: 'financial' as const,
          type: 'transaction',
          value: `${tx.merchant || 'Unknown'}: $${tx.amount?.toFixed(2) || '0.00'}`,
          timestamp: tx.date ? new Date(tx.date).getTime() : Date.now(),
        }));

      patterns.push({
        id: `spending_${topCategory}_${Date.now()}`,
        type: 'spending_habit',
        title: `Frequent ${topCategory} spending`,
        description: `${percentage.toFixed(0)}% of your spending is on ${topCategory}`,
        evidence,
        confidence: Math.min(0.9, percentage / 100 + 0.3),
        newSinceLastReport: false,
      });
    }
  }

  // Detect subscription patterns (recurring similar amounts)
  const merchantAmounts = new Map<string, number[]>();
  for (const tx of transactions) {
    const merchant = tx.merchant || 'unknown';
    if (!merchantAmounts.has(merchant)) {
      merchantAmounts.set(merchant, []);
    }
    merchantAmounts.get(merchant)!.push(tx.amount || 0);
  }

  for (const [merchant, amounts] of merchantAmounts.entries()) {
    if (amounts.length >= 2) {
      // Check if amounts are similar (potential subscription)
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const allSimilar = amounts.every((a) => Math.abs(a - avg) < avg * 0.1);

      if (allSimilar && avg > 5) {
        patterns.push({
          id: `subscription_${merchant}_${Date.now()}`,
          type: 'spending_habit',
          title: `Recurring ${merchant} payment`,
          description: `You have a recurring payment of ~$${avg.toFixed(2)} to ${merchant}`,
          evidence: [
            {
              source: 'financial',
              type: 'recurring',
              value: `${amounts.length} payments averaging $${avg.toFixed(2)}`,
              timestamp: Date.now(),
            },
          ],
          confidence: 0.85,
          newSinceLastReport: false,
        });
      }
    }
  }

  return patterns;
}

/**
 * Analyze social patterns from calendar data
 */
function analyzeSocialPatterns(context: AnalysisContext): DiscoveredPattern[] {
  const patterns: DiscoveredPattern[] = [];

  if (!context.calendarData?.events) {
    return patterns;
  }

  const events = context.calendarData.events as Array<{
    title?: string;
    type?: string;
    attendees?: Array<{ email?: string; name?: string }>;
    startTime?: string;
  }>;

  if (events.length === 0) {
    return patterns;
  }

  // Analyze meeting frequency
  const meetingEvents = events.filter((e) => e.type === 'meeting' || e.attendees?.length);
  const socialEvents = events.filter((e) => e.type === 'social');

  if (meetingEvents.length > 5) {
    patterns.push({
      id: `social_meetings_${Date.now()}`,
      type: 'social_rhythm',
      title: 'Active meeting schedule',
      description: `You have ${meetingEvents.length} meetings scheduled`,
      evidence: meetingEvents.slice(0, 3).map((e) => ({
        source: 'calendar' as const,
        type: 'meeting',
        value: e.title || 'Meeting',
        timestamp: e.startTime ? new Date(e.startTime).getTime() : Date.now(),
      })),
      confidence: 0.8,
      newSinceLastReport: false,
    });
  }

  // Analyze frequent contacts
  const contactCounts = new Map<string, number>();
  for (const event of events) {
    for (const attendee of event.attendees || []) {
      const key = attendee.email || attendee.name || 'unknown';
      contactCounts.set(key, (contactCounts.get(key) || 0) + 1);
    }
  }

  const frequentContacts = Array.from(contactCounts.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  if (frequentContacts.length > 0) {
    const [topContact, count] = frequentContacts[0];
    patterns.push({
      id: `relationship_${topContact.replace(/[^a-z0-9]/gi, '')}_${Date.now()}`,
      type: 'relationship_change',
      title: `Frequent contact: ${topContact.split('@')[0]}`,
      description: `You've had ${count} events with this contact recently`,
      evidence: [
        {
          source: 'calendar',
          type: 'contact_frequency',
          value: `${count} shared events`,
          timestamp: Date.now(),
        },
      ],
      confidence: Math.min(0.9, 0.5 + count * 0.1),
      newSinceLastReport: false,
    });
  }

  // Social activity pattern
  if (socialEvents.length > 0) {
    patterns.push({
      id: `social_events_${Date.now()}`,
      type: 'social_rhythm',
      title: 'Social activities detected',
      description: `You have ${socialEvents.length} social events planned`,
      evidence: socialEvents.slice(0, 3).map((e) => ({
        source: 'calendar' as const,
        type: 'social_event',
        value: e.title || 'Social Event',
        timestamp: e.startTime ? new Date(e.startTime).getTime() : Date.now(),
      })),
      confidence: 0.75,
      newSinceLastReport: false,
    });
  }

  return patterns;
}

/**
 * Analyze interest patterns from email data
 */
function analyzeInterestPatterns(context: AnalysisContext): DiscoveredPattern[] {
  const patterns: DiscoveredPattern[] = [];

  if (!context.emailData?.classifications) {
    return patterns;
  }

  const classifications = context.emailData.classifications as Array<{
    category?: string;
    subcategory?: string;
    confidence?: number;
    emailId?: string;
    timestamp?: number;
  }>;

  if (classifications.length === 0) {
    return patterns;
  }

  // Group by category
  const categoryCounts = new Map<string, number>();
  for (const c of classifications) {
    const category = c.category || 'unknown';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  // Find growing interests (top categories)
  const sortedCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [category, count] of sortedCategories) {
    if (count >= 3) {
      patterns.push({
        id: `interest_${category.replace(/[^a-z0-9]/gi, '')}_${Date.now()}`,
        type: 'interest_growth',
        title: `Interest in ${category}`,
        description: `${count} emails related to ${category}`,
        evidence: [
          {
            source: 'email',
            type: 'category_frequency',
            value: `${count} related emails`,
            timestamp: Date.now(),
          },
        ],
        confidence: Math.min(0.85, 0.4 + count * 0.1),
        newSinceLastReport: false,
      });
    }
  }

  return patterns;
}

/**
 * Analyze cross-source patterns
 */
function analyzeCrossSourcePatterns(context: AnalysisContext): DiscoveredPattern[] {
  const patterns: DiscoveredPattern[] = [];

  // Cross-reference financial and calendar data
  const hasFinancial = !!context.financialData?.transactions;
  const hasCalendar = !!context.calendarData?.events;
  const hasEmail = !!context.emailData?.classifications;

  if (hasFinancial && hasCalendar) {
    // Look for travel-related spending and travel events
    const financialTx = context.financialData!.transactions as Array<{
      category?: string;
      merchant?: string;
      amount?: number;
    }>;
    const calendarEvents = context.calendarData!.events as Array<{
      type?: string;
      title?: string;
    }>;

    const travelSpending = financialTx.filter(
      (tx) =>
        tx.category?.toLowerCase().includes('travel') ||
        tx.merchant?.toLowerCase().includes('airline') ||
        tx.merchant?.toLowerCase().includes('hotel')
    );

    const travelEvents = calendarEvents.filter(
      (e) => e.type === 'travel' || e.title?.toLowerCase().includes('trip')
    );

    if (travelSpending.length > 0 && travelEvents.length > 0) {
      const totalTravelSpend = travelSpending.reduce((sum, tx) => sum + (tx.amount || 0), 0);

      patterns.push({
        id: `cross_travel_${Date.now()}`,
        type: 'cross_source',
        title: 'Travel activity detected',
        description: `${travelEvents.length} travel events with $${totalTravelSpend.toFixed(2)} in related spending`,
        evidence: [
          {
            source: 'financial',
            type: 'travel_spending',
            value: `$${totalTravelSpend.toFixed(2)} on travel`,
            timestamp: Date.now(),
          },
          {
            source: 'calendar',
            type: 'travel_events',
            value: `${travelEvents.length} travel events`,
            timestamp: Date.now(),
          },
        ],
        confidence: 0.9,
        newSinceLastReport: false,
      });
    }
  }

  // Cross-reference email interests with calendar/financial
  if (hasEmail && (hasFinancial || hasCalendar)) {
    const emailClassifications = context.emailData!.classifications as Array<{
      category?: string;
    }>;

    // Find dominant email category
    const emailCategories = new Map<string, number>();
    for (const c of emailClassifications) {
      if (c.category) {
        emailCategories.set(c.category, (emailCategories.get(c.category) || 0) + 1);
      }
    }

    const topEmailCategory = Array.from(emailCategories.entries()).sort((a, b) => b[1] - a[1])[0];

    if (topEmailCategory && topEmailCategory[1] >= 5) {
      patterns.push({
        id: `cross_interest_${topEmailCategory[0].replace(/[^a-z0-9]/gi, '')}_${Date.now()}`,
        type: 'cross_source',
        title: `Strong ${topEmailCategory[0]} interest`,
        description: `High engagement with ${topEmailCategory[0]} content across multiple sources`,
        evidence: [
          {
            source: 'email',
            type: 'interest_signal',
            value: `${topEmailCategory[1]} related emails`,
            timestamp: Date.now(),
          },
        ],
        confidence: 0.75,
        newSinceLastReport: false,
      });
    }
  }

  return patterns;
}

/**
 * Mark patterns as new since last report
 */
function markNewPatterns(
  patterns: DiscoveredPattern[],
  previousPatterns?: DiscoveredPattern[]
): DiscoveredPattern[] {
  if (!previousPatterns || previousPatterns.length === 0) {
    // All patterns are new if no previous report
    return patterns.map((p) => ({ ...p, newSinceLastReport: true }));
  }

  const previousTypes = new Set(previousPatterns.map((p) => p.type));

  return patterns.map((p) => ({
    ...p,
    newSinceLastReport: !previousTypes.has(p.type),
  }));
}

/**
 * Calculate pattern confidence score
 */
export function calculatePatternConfidence(pattern: DiscoveredPattern): number {
  // Base confidence from evidence count
  const evidenceBoost = Math.min(0.2, pattern.evidence.length * 0.05);

  // Boost for cross-source patterns
  const crossSourceBoost = pattern.type === 'cross_source' ? 0.1 : 0;

  return Math.min(1, pattern.confidence + evidenceBoost + crossSourceBoost);
}

/**
 * Filter patterns by minimum confidence
 */
export function filterByConfidence(
  patterns: DiscoveredPattern[],
  minConfidence: number = 0.5
): DiscoveredPattern[] {
  return patterns.filter((p) => p.confidence >= minConfidence);
}
