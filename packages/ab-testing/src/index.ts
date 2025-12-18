/**
 * @ownyou/ab-testing
 *
 * A/B Testing types, metrics, and utilities for OwnYou consumer app.
 * Provides the foundation for multi-model classification comparison.
 *
 * @example
 * ```typescript
 * import {
 *   computeComparisonMetrics,
 *   FALLBACK_MODELS,
 *   type ABTestingState,
 * } from '@ownyou/ab-testing';
 *
 * // Compute metrics from results
 * const metrics = computeComparisonMetrics(resultsMap, emailIds);
 * ```
 */

// Types
export type {
  StageStatus,
  EmailProvider,
  LLMProvider,
  IABSection,
  Email,
  PreprocessedEmail,
  ModelConfig,
  Classification,
  ModelResults,
  Stage1Export,
  Stage2Export,
  Stage3Export,
  ModelStats,
  AgreementMetrics,
  CoverageMetrics,
  ComparisonMetrics,
  ABTestingState,
  ABTestingConfig,
} from './types';

export { FALLBACK_MODELS, AVAILABLE_MODELS, DEFAULT_ABTESTING_CONFIG } from './types';

// Metrics
export {
  computeModelStats,
  computeAgreementMetrics,
  computeCoverageMetrics,
  computeComparisonMetrics,
  getDisagreements,
  getTopCategories,
} from './metrics';

// Export/Import
export {
  exportStage1,
  createStage1Export,
  importStage1,
  parseStage1,
  exportStage2,
  createStage2Export,
  importStage2,
  parseStage2,
  exportStage3,
  createStage3Export,
  importStage3,
  parseStage3,
  resultsRecordToMap,
  serializeState,
  deserializeState,
} from './export-import';
