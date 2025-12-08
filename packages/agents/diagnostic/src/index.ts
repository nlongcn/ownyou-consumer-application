/**
 * @ownyou/agents-diagnostic - Sprint 8
 *
 * Diagnostic Agent for OwnYou - Analyzes complete user profile,
 * finds patterns, and generates insights.
 */

// Types
export type {
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
  DiagnosticAgentConfig,
  AnalysisContext,
  AnalyzerResult,
  SourceWeights,
  CoverageThresholds,
  CompletenessConfig,
} from './types.js';

export { DEFAULT_DIAGNOSTIC_CONFIG, DEFAULT_COMPLETENESS_CONFIG } from './types.js';

// Agent
export { DiagnosticAgent, createDiagnosticAgent } from './agent.js';
export type { DiagnosticAgentOptions } from './agent.js';

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
