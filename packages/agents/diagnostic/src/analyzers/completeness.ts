/**
 * Profile Completeness Analyzer - Sprint 8
 *
 * Analyzes the completeness of user's profile across data sources and Ikigai dimensions.
 */

import type {
  ProfileCompleteness,
  SourceCompleteness,
  AnalysisContext,
  AnalyzerResult,
  DataSuggestion,
  CompletenessConfig,
} from '../types.js';

import { DEFAULT_COMPLETENESS_CONFIG } from '../types.js';

/** Module-level config that can be set for analysis */
let _completenessConfig: CompletenessConfig = DEFAULT_COMPLETENESS_CONFIG;

/**
 * Set the completeness configuration for subsequent analyses
 */
export function setCompletenessConfig(config: Partial<CompletenessConfig>): void {
  _completenessConfig = {
    ...DEFAULT_COMPLETENESS_CONFIG,
    ...config,
    sourceWeights: {
      ...DEFAULT_COMPLETENESS_CONFIG.sourceWeights,
      ...config.sourceWeights,
    },
    coverageThresholds: {
      ...DEFAULT_COMPLETENESS_CONFIG.coverageThresholds,
      ...config.coverageThresholds,
    },
  };
}

/**
 * Get the current completeness configuration
 */
export function getCompletenessConfig(): CompletenessConfig {
  return { ..._completenessConfig };
}

/**
 * Analyze profile completeness across all data sources
 */
export function analyzeProfileCompleteness(
  context: AnalysisContext,
  config: CompletenessConfig = _completenessConfig
): AnalyzerResult<ProfileCompleteness> {
  try {
    const bySource = {
      email: analyzeSourceCompleteness('email', context, config),
      financial: analyzeSourceCompleteness('financial', context, config),
      calendar: analyzeSourceCompleteness('calendar', context, config),
      browser: analyzeSourceCompleteness('browser', context, config),
    };

    const byDimension = analyzeDimensionCompleteness(context);
    const missingData = identifyMissingData(bySource);

    // Calculate overall completeness using configurable weights
    const { sourceWeights, sourceCoverageWeight, dimensionCoverageWeight } = config;
    let overall = 0;

    for (const [source, data] of Object.entries(bySource)) {
      const weight = sourceWeights[source as keyof typeof sourceWeights];
      if (data.connected) {
        overall += data.coverage * weight;
      }
    }

    // Boost for dimension coverage using configurable weights
    const dimensionAvg =
      (byDimension.experiences + byDimension.relationships + byDimension.interests + byDimension.giving) / 4;
    overall = overall * sourceCoverageWeight + dimensionAvg * dimensionCoverageWeight;

    return {
      success: true,
      data: {
        overall: Math.round(overall),
        bySource,
        byDimension,
        missingData,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Completeness analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Analyze completeness of a single data source
 */
function analyzeSourceCompleteness(
  source: 'email' | 'financial' | 'calendar' | 'browser',
  context: AnalysisContext,
  config: CompletenessConfig
): SourceCompleteness {
  switch (source) {
    case 'email':
      return analyzeEmailCompleteness(context, config);
    case 'financial':
      return analyzeFinancialCompleteness(context, config);
    case 'calendar':
      return analyzeCalendarCompleteness(context, config);
    case 'browser':
      return analyzeBrowserCompleteness(context);
    default:
      return { connected: false, lastSync: null, itemCount: 0, coverage: 0 };
  }
}

/**
 * Analyze email data completeness
 */
function analyzeEmailCompleteness(
  context: AnalysisContext,
  config: CompletenessConfig
): SourceCompleteness {
  if (!context.emailData) {
    return { connected: false, lastSync: null, itemCount: 0, coverage: 0 };
  }

  const { classifications, profile } = context.emailData;
  const itemCount = Array.isArray(classifications) ? classifications.length : 0;

  // Coverage based on item count using configurable threshold
  const threshold = config.coverageThresholds.emailFullCoverage;
  const coverage = Math.min(100, Math.round((itemCount / threshold) * 100));

  return {
    connected: true,
    lastSync: (profile as { lastSync?: number })?.lastSync || Date.now(),
    itemCount,
    coverage,
  };
}

/**
 * Analyze financial data completeness
 */
function analyzeFinancialCompleteness(
  context: AnalysisContext,
  config: CompletenessConfig
): SourceCompleteness {
  if (!context.financialData) {
    return { connected: false, lastSync: null, itemCount: 0, coverage: 0 };
  }

  const { transactions, profile } = context.financialData;
  const itemCount = Array.isArray(transactions) ? transactions.length : 0;

  // Coverage based on transaction count using configurable threshold
  const threshold = config.coverageThresholds.financialFullCoverage;
  const coverage = Math.min(100, Math.round((itemCount / threshold) * 100));

  return {
    connected: true,
    lastSync: (profile as { lastSync?: number })?.lastSync || Date.now(),
    itemCount,
    coverage,
  };
}

/**
 * Analyze calendar data completeness
 */
function analyzeCalendarCompleteness(
  context: AnalysisContext,
  config: CompletenessConfig
): SourceCompleteness {
  if (!context.calendarData) {
    return { connected: false, lastSync: null, itemCount: 0, coverage: 0 };
  }

  const { events, profile } = context.calendarData;
  const itemCount = Array.isArray(events) ? events.length : 0;

  // Coverage based on event count using configurable threshold
  const threshold = config.coverageThresholds.calendarFullCoverage;
  const coverage = Math.min(100, Math.round((itemCount / threshold) * 100));

  return {
    connected: true,
    lastSync: (profile as { lastSync?: number })?.lastSync || Date.now(),
    itemCount,
    coverage,
  };
}

/**
 * Analyze browser data completeness
 */
function analyzeBrowserCompleteness(_context: AnalysisContext): SourceCompleteness {
  // Browser data via Chrome extension - check if profile exists
  // For now, return as not connected
  return { connected: false, lastSync: null, itemCount: 0, coverage: 0 };
}

/**
 * Analyze completeness across Ikigai dimensions
 */
function analyzeDimensionCompleteness(
  context: AnalysisContext
): ProfileCompleteness['byDimension'] {
  const profile = context.ikigaiProfile as {
    dimensions?: {
      experiences?: { score: number };
      relationships?: { score: number };
      interests?: { score: number };
      giving?: { score: number };
    };
  };

  if (!profile?.dimensions) {
    return {
      experiences: 0,
      relationships: 0,
      interests: 0,
      giving: 0,
    };
  }

  return {
    experiences: Math.round((profile.dimensions.experiences?.score || 0) * 100),
    relationships: Math.round((profile.dimensions.relationships?.score || 0) * 100),
    interests: Math.round((profile.dimensions.interests?.score || 0) * 100),
    giving: Math.round((profile.dimensions.giving?.score || 0) * 100),
  };
}

/**
 * Identify missing data sources
 */
function identifyMissingData(bySource: ProfileCompleteness['bySource']): string[] {
  const missing: string[] = [];

  if (!bySource.email.connected) {
    missing.push('email');
  }
  if (!bySource.financial.connected) {
    missing.push('financial');
  }
  if (!bySource.calendar.connected) {
    missing.push('calendar');
  }
  if (!bySource.browser.connected) {
    missing.push('browser');
  }

  return missing;
}

/**
 * Generate suggestions for improving profile completeness
 */
export function generateCompletenessSuggestions(
  completeness: ProfileCompleteness
): DataSuggestion[] {
  const suggestions: DataSuggestion[] = [];

  // Suggest connecting missing data sources
  if (!completeness.bySource.financial.connected) {
    suggestions.push({
      source: 'financial',
      reason: 'Financial data helps understand your spending patterns and interests',
      benefit: 'Discover spending patterns and get personalized savings suggestions',
      priority: 'high',
    });
  }

  if (!completeness.bySource.calendar.connected) {
    suggestions.push({
      source: 'calendar',
      reason: 'Calendar data reveals your social patterns and activities',
      benefit: 'Get event recommendations and relationship insights',
      priority: 'high',
    });
  }

  if (!completeness.bySource.email.connected) {
    suggestions.push({
      source: 'email',
      reason: 'Email data provides rich context about your interests',
      benefit: 'Receive personalized recommendations based on your communications',
      priority: 'medium',
    });
  }

  if (!completeness.bySource.browser.connected) {
    suggestions.push({
      source: 'browser',
      reason: 'Browser history shows your online interests',
      benefit: 'Get more accurate interest-based recommendations',
      priority: 'low',
    });
  }

  // Health suggestion if other sources connected
  const connectedCount = Object.values(completeness.bySource).filter(s => s.connected).length;
  if (connectedCount >= 2) {
    suggestions.push({
      source: 'health',
      reason: 'Health data completes your well-being picture',
      benefit: 'Track wellness patterns alongside your activities',
      priority: 'medium',
    });
  }

  return suggestions;
}

/**
 * Calculate profile score for comparison
 */
export function calculateProfileScore(completeness: ProfileCompleteness): number {
  return completeness.overall;
}
