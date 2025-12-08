/**
 * Diagnostic Agent Types - Sprint 8
 *
 * Type definitions for profile analysis, pattern detection, and insight generation.
 */

/**
 * Pattern types for behavioral analysis
 */
export type PatternType =
  | 'spending_habit' // Regular spending patterns
  | 'social_rhythm' // Social activity patterns
  | 'interest_growth' // Growing interest in topic
  | 'interest_decline' // Declining interest
  | 'relationship_change' // Relationship intensity changes
  | 'lifestyle_shift' // Major behavior changes
  | 'cross_source'; // Pattern spanning multiple sources

/**
 * Insight categories
 */
export type InsightCategory =
  | 'well_being' // "You've been spending more on experiences"
  | 'relationship' // "You haven't seen Sarah in 3 weeks"
  | 'financial' // "Subscription costs increased 15%"
  | 'opportunity' // "Concert matching your interests this weekend"
  | 'achievement'; // "You've completed 5 travel missions"

/**
 * Data source types
 */
export type DataSource = 'email' | 'financial' | 'calendar' | 'browser';

/**
 * Source completeness information
 */
export interface SourceCompleteness {
  connected: boolean;
  lastSync: number | null;
  itemCount: number;
  coverage: number; // 0-100%
}

/**
 * Profile completeness analysis
 */
export interface ProfileCompleteness {
  overall: number; // 0-100%
  bySource: {
    email: SourceCompleteness;
    financial: SourceCompleteness;
    calendar: SourceCompleteness;
    browser: SourceCompleteness;
  };
  byDimension: {
    experiences: number;
    relationships: number;
    interests: number;
    giving: number;
  };
  missingData: string[]; // What to connect next
}

/**
 * Evidence supporting a discovered pattern
 */
export interface PatternEvidence {
  source: DataSource;
  type: string;
  value: string;
  timestamp: number;
}

/**
 * Discovered behavioral pattern
 */
export interface DiscoveredPattern {
  id: string;
  type: PatternType;
  title: string;
  description: string;
  evidence: PatternEvidence[];
  confidence: number; // 0-1
  newSinceLastReport: boolean;
}

/**
 * Actionable insight
 */
export interface Insight {
  id: string;
  category: InsightCategory;
  title: string;
  body: string;
  actionable: boolean;
  suggestedAction?: string;
  relatedPatterns: string[]; // Pattern IDs
}

/**
 * Data source connection suggestion
 */
export interface DataSuggestion {
  source: DataSource | 'health';
  reason: string;
  benefit: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Complete diagnostic report
 */
export interface DiagnosticReport {
  id: string;
  userId: string;
  generatedAt: number;

  // Profile analysis
  completeness: ProfileCompleteness;

  // Pattern analysis
  patterns: DiscoveredPattern[];

  // Insights
  insights: Insight[];

  // Suggestions
  suggestions: DataSuggestion[];

  // Metadata
  version: string;
  analysisType: 'scheduled' | 'new_source' | 'manual';
}

/**
 * Diagnostic agent configuration
 */
export interface DiagnosticAgentConfig {
  agentType: 'diagnostic';
  level: 'L2';

  memoryAccess: {
    read: string[];
    write: string[];
    search: string[];
  };

  limits: {
    maxToolCalls: number;
    maxLlmCalls: number;
    timeoutSeconds: number;
    maxMemoryReads: number;
    maxMemoryWrites: number;
  };
}

/**
 * Default agent configuration
 */
export const DEFAULT_DIAGNOSTIC_CONFIG: DiagnosticAgentConfig = {
  agentType: 'diagnostic',
  level: 'L2',

  memoryAccess: {
    read: ['*'], // Can read ALL namespaces
    write: ['diagnosticReports'], // Can ONLY write reports
    search: ['*'],
  },

  limits: {
    maxToolCalls: 10,
    maxLlmCalls: 5,
    timeoutSeconds: 120,
    maxMemoryReads: 25,
    maxMemoryWrites: 10,
  },
};

/**
 * Analysis context passed to analyzers
 */
export interface AnalysisContext {
  userId: string;
  analysisType: DiagnosticReport['analysisType'];
  previousReport?: DiagnosticReport;
  financialData?: {
    transactions: unknown[];
    profile: unknown;
  };
  calendarData?: {
    events: unknown[];
    profile: unknown;
  };
  emailData?: {
    classifications: unknown[];
    profile: unknown;
  };
  ikigaiProfile?: unknown;
}

/**
 * Analyzer result
 */
export interface AnalyzerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
