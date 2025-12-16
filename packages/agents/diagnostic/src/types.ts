/**
 * Diagnostic Agent Types - Sprint 8
 *
 * Type definitions for profile analysis, pattern detection, and insight generation.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 */

import type { AgentPermissions } from '@ownyou/shared-types';
import { NAMESPACES } from '@ownyou/shared-types';

// ─────────────────────────────────────────────────────────────────────────────
// Trigger Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger data for diagnostic agent activation
 */
export interface DiagnosticTriggerData {
  /** Type of analysis to perform */
  analysisType: 'scheduled' | 'new_source' | 'manual';

  /** Focus on specific data source (optional) */
  focusSource?: DataSource;

  /** Include pattern analysis */
  includePatterns?: boolean;

  /** Include insight generation */
  includeInsights?: boolean;

  /** Previous report ID for comparison (optional) */
  previousReportId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Permissions (v13 Section 3.6.1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diagnostic agent permissions
 * v13: Read ALL namespaces, write only diagnosticReports
 */
export const DIAGNOSTIC_PERMISSIONS: AgentPermissions = {
  agentType: 'diagnostic',
  memoryAccess: {
    read: [
      // ALL namespaces - diagnostic can read everything
      NAMESPACES.IKIGAI_PROFILE,
      NAMESPACES.IAB_CLASSIFICATIONS,
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.PROCEDURAL_MEMORY,
      NAMESPACES.SEMANTIC_MEMORY,
      NAMESPACES.ENTITIES,
      NAMESPACES.RELATIONSHIPS,
      NAMESPACES.FINANCIAL_PROFILE,
      NAMESPACES.FINANCIAL_TRANSACTIONS,
      NAMESPACES.CALENDAR_EVENTS,
      NAMESPACES.CALENDAR_PROFILE,
      NAMESPACES.CALENDAR_CONTACTS,
      // Note: EMAIL_CLASSIFICATIONS was renamed to IAB_CLASSIFICATIONS in v13
      NAMESPACES.MISSION_CARDS,
      NAMESPACES.DIAGNOSTIC_REPORTS,
    ],
    write: [
      // ONLY diagnostic reports
      NAMESPACES.DIAGNOSTIC_REPORTS,
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.MISSION_CARDS,
    ],
    search: [
      NAMESPACES.EPISODIC_MEMORY,
      NAMESPACES.SEMANTIC_MEMORY,
      NAMESPACES.ENTITIES,
    ],
  },
  externalApis: [], // Diagnostic agent has no external APIs
  toolDefinitions: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pattern Types
// ─────────────────────────────────────────────────────────────────────────────

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
 * Source weights for completeness calculation
 */
export interface SourceWeights {
  email: number;
  financial: number;
  calendar: number;
  browser: number;
}

/**
 * Coverage thresholds - item counts at which source reaches 100% coverage
 */
export interface CoverageThresholds {
  emailFullCoverage: number;
  financialFullCoverage: number;
  calendarFullCoverage: number;
}

/**
 * Completeness analysis configuration
 */
export interface CompletenessConfig {
  /** Weights for each data source (should sum to 1.0) */
  sourceWeights: SourceWeights;
  /** Item counts at which each source reaches 100% coverage */
  coverageThresholds: CoverageThresholds;
  /** Weight for source coverage in overall score (0-1) */
  sourceCoverageWeight: number;
  /** Weight for dimension coverage in overall score (0-1) */
  dimensionCoverageWeight: number;
}

/**
 * Default completeness configuration
 */
export const DEFAULT_COMPLETENESS_CONFIG: CompletenessConfig = {
  sourceWeights: {
    email: 0.3,
    financial: 0.3,
    calendar: 0.25,
    browser: 0.15,
  },
  coverageThresholds: {
    emailFullCoverage: 500,
    financialFullCoverage: 200,
    calendarFullCoverage: 100,
  },
  sourceCoverageWeight: 0.7,
  dimensionCoverageWeight: 0.3,
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration (v13 Compliant - Configurable Thresholds)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Urgency thresholds for diagnostic insights
 */
export interface DiagnosticUrgencyThresholds {
  /** Days since last report for high urgency */
  highDaysSinceReport: number;
  /** Days since last report for medium urgency */
  mediumDaysSinceReport: number;
  /** Completeness threshold below which is high urgency */
  lowCompletenessThreshold: number;
}

/**
 * Default urgency thresholds
 */
export const DEFAULT_URGENCY_THRESHOLDS: DiagnosticUrgencyThresholds = {
  highDaysSinceReport: 30,
  mediumDaysSinceReport: 14,
  lowCompletenessThreshold: 30,
};

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Context
// ─────────────────────────────────────────────────────────────────────────────

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
