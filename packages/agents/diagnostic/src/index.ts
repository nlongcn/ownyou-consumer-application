/**
 * @ownyou/agents-diagnostic - Sprint 8
 *
 * Diagnostic Agent for OwnYou - Analyzes complete user profile,
 * finds patterns, and generates insights.
 *
 * Conforms to BaseAgent pattern per v13 Section 3.6.
 */

// Types
export type {
  DiagnosticTriggerData,
  PatternType,
  InsightCategory,
  DataSource,
  SourceCompleteness,
  ProfileCompleteness,
  PatternEvidence,
  DiscoveredPattern,
  Insight,
  DataSuggestion,
  DiagnosticReport,
  AnalysisContext,
  AnalyzerResult,
  SourceWeights,
  CoverageThresholds,
  CompletenessConfig,
  DiagnosticUrgencyThresholds,
} from './types.js';

export {
  DIAGNOSTIC_PERMISSIONS,
  DEFAULT_COMPLETENESS_CONFIG,
  DEFAULT_URGENCY_THRESHOLDS,
} from './types.js';

// Agent
export { DiagnosticAgent, createDiagnosticAgent } from './agent.js';
export type { DiagnosticAgentConfig } from './agent.js';

// Analyzers
export {
  analyzeProfileCompleteness,
  generateCompletenessSuggestions,
  calculateProfileScore,
  setCompletenessConfig,
  getCompletenessConfig,
  analyzePatterns,
  calculatePatternConfidence,
  filterByConfidence,
  generateInsights,
  generateInsightsAsync,
  setInsightLLMClient,
  getInsightLLMClient,
  filterByCategory,
  getActionableInsights,
} from './analyzers/index.js';

export type { InsightGeneratorConfig } from './analyzers/index.js';
