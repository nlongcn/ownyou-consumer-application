/**
 * Metrics computation for A/B Testing Framework
 *
 * Pure functions for statistical analysis of multi-model classification results.
 * Ported from admin-dashboard - no server dependencies.
 */

import type {
  ModelResults,
  ModelStats,
  AgreementMetrics,
  CoverageMetrics,
  ComparisonMetrics,
  Classification,
} from './types';

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Compute statistics for a single model
 */
export function computeModelStats(
  results: ModelResults,
  totalEmails: number
): ModelStats {
  const confidences = results.classifications.map((c) => c.confidence);
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  const uniqueEmailIds = new Set(results.classifications.map((c) => c.emailId));

  return {
    avgConfidence,
    minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
    maxConfidence: confidences.length > 0 ? Math.max(...confidences) : 0,
    stdDevConfidence: calculateStdDev(confidences, avgConfidence),
    totalClassifications: results.classifications.length,
    uniqueCategories: results.stats.uniqueCategories,
    classificationRate: totalEmails > 0 ? uniqueEmailIds.size / totalEmails : 0,
    durationMs: results.timing.durationMs,
  };
}

/**
 * Get the primary classification for an email (highest confidence)
 */
function getPrimaryClassification(
  classifications: Classification[],
  emailId: string
): Classification | null {
  const emailClassifications = classifications.filter(
    (c) => c.emailId === emailId
  );
  if (emailClassifications.length === 0) return null;
  return emailClassifications.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}

/**
 * Compute agreement metrics across models
 *
 * Measures how often models agree on classifications:
 * - Full agreement: All models classify same category
 * - Partial agreement: Majority agrees
 * - No agreement: No majority consensus
 */
export function computeAgreementMetrics(
  results: Map<string, ModelResults>,
  emailIds: string[]
): AgreementMetrics {
  const modelKeys = Array.from(results.keys());

  let fullAgreementCount = 0;
  let partialAgreementCount = 0;
  let noAgreementCount = 0;

  // For each email, check if models agree
  // IMPORTANT: We only count agreement for emails classified by MULTIPLE models
  // An email classified by only one model has no "agreement" to measure
  for (const emailId of emailIds) {
    const categories: string[] = [];

    for (const modelKey of modelKeys) {
      const modelResults = results.get(modelKey);
      if (!modelResults) continue;

      const primary = getPrimaryClassification(
        modelResults.classifications,
        emailId
      );
      if (primary) {
        categories.push(primary.category);
      }
    }

    // Skip emails not classified by any model
    if (categories.length === 0) continue;

    // Skip emails classified by only ONE model - can't measure agreement with only 1 classification
    if (categories.length < 2) continue;

    // Count frequency of each category
    const categoryCount = new Map<string, number>();
    for (const cat of categories) {
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
    }

    const maxCount = Math.max(...categoryCount.values());
    const totalModels = categories.length;

    if (maxCount === totalModels) {
      fullAgreementCount++;
    } else if (maxCount > totalModels / 2) {
      partialAgreementCount++;
    } else {
      noAgreementCount++;
    }
  }

  const totalClassified =
    fullAgreementCount + partialAgreementCount + noAgreementCount;

  // Compute pairwise agreement
  const pairwiseAgreement: Record<string, Record<string, number>> = {};

  for (let i = 0; i < modelKeys.length; i++) {
    const modelA = modelKeys[i];
    pairwiseAgreement[modelA] = {};

    for (let j = 0; j < modelKeys.length; j++) {
      const modelB = modelKeys[j];
      if (i === j) {
        pairwiseAgreement[modelA][modelB] = 1.0;
        continue;
      }

      let agreements = 0;
      let comparisons = 0;

      const resultsA = results.get(modelA);
      const resultsB = results.get(modelB);

      if (!resultsA || !resultsB) continue;

      for (const emailId of emailIds) {
        const primaryA = getPrimaryClassification(
          resultsA.classifications,
          emailId
        );
        const primaryB = getPrimaryClassification(
          resultsB.classifications,
          emailId
        );

        if (primaryA && primaryB) {
          comparisons++;
          if (primaryA.category === primaryB.category) {
            agreements++;
          }
        }
      }

      pairwiseAgreement[modelA][modelB] =
        comparisons > 0 ? agreements / comparisons : 0;
    }
  }

  return {
    fullAgreementCount,
    partialAgreementCount,
    noAgreementCount,
    agreementRate:
      totalClassified > 0 ? fullAgreementCount / totalClassified : 0,
    pairwiseAgreement,
  };
}

/**
 * Compute coverage metrics
 *
 * Analyzes category distribution across models:
 * - Which categories each model finds
 * - Common categories (found by all models)
 * - Unique categories (found by only one model)
 * - Category frequency (how many models found each category)
 *
 * FIXED: categoryFrequency now counts unique category occurrences per model,
 * not duplicates across all email classifications
 */
export function computeCoverageMetrics(
  results: Map<string, ModelResults>
): CoverageMetrics {
  const categoriesByModel: Record<string, string[]> = {};
  const allCategories = new Set<string>();
  const categoryFrequency: Record<string, number> = {};

  // Collect categories per model
  // Fixed: Count each unique category ONCE per model (not once per email)
  results.forEach((modelResults, modelKey) => {
    const modelCategories = new Set<string>();

    for (const classification of modelResults.classifications) {
      modelCategories.add(classification.category);
      allCategories.add(classification.category);
    }

    // Count category frequency based on unique categories per model
    // This means if 3 models all find "Shopping", frequency = 3 (not 30 if each found it 10 times)
    for (const category of modelCategories) {
      categoryFrequency[category] = (categoryFrequency[category] || 0) + 1;
    }

    categoriesByModel[modelKey] = Array.from(modelCategories).sort();
  });

  // Find common categories (present in ALL models)
  const modelKeys = Array.from(results.keys());
  const commonCategories = Array.from(allCategories)
    .filter((category) =>
      modelKeys.every((key) => categoriesByModel[key]?.includes(category))
    )
    .sort();

  // Find unique categories per model (only in that model)
  const uniqueCategories: Record<string, string[]> = {};
  for (const modelKey of modelKeys) {
    uniqueCategories[modelKey] =
      categoriesByModel[modelKey]
        ?.filter((category) =>
          modelKeys
            .filter((k) => k !== modelKey)
            .every((k) => !categoriesByModel[k]?.includes(category))
        )
        .sort() || [];
  }

  return {
    categoriesByModel,
    commonCategories,
    uniqueCategories,
    categoryFrequency,
  };
}

/**
 * Compute all comparison metrics
 *
 * Main entry point for computing complete analysis of multi-model results.
 */
export function computeComparisonMetrics(
  results: Map<string, ModelResults>,
  emailIds: string[]
): ComparisonMetrics {
  const totalEmails = emailIds.length;

  // Compute per-model stats
  const modelStats: Record<string, ModelStats> = {};
  results.forEach((modelResults, modelKey) => {
    modelStats[modelKey] = computeModelStats(modelResults, totalEmails);
  });

  // Compute agreement metrics
  const agreement = computeAgreementMetrics(results, emailIds);

  // Compute coverage metrics
  const coverage = computeCoverageMetrics(results);

  return {
    modelStats,
    agreement,
    coverage,
  };
}

/**
 * Get classification disagreements between models
 *
 * Returns emails where models disagree on category.
 * Useful for identifying edge cases and improving classification.
 */
export function getDisagreements(
  results: Map<string, ModelResults>,
  emailIds: string[]
): Array<{
  emailId: string;
  classifications: Record<string, Classification>;
}> {
  const disagreements: Array<{
    emailId: string;
    classifications: Record<string, Classification>;
  }> = [];

  for (const emailId of emailIds) {
    const classifications: Record<string, Classification> = {};
    const categories = new Set<string>();

    results.forEach((modelResults, modelKey) => {
      const primary = getPrimaryClassification(
        modelResults.classifications,
        emailId
      );
      if (primary) {
        classifications[modelKey] = primary;
        categories.add(primary.category);
      }
    });

    // Only include if there are multiple models with different categories
    if (Object.keys(classifications).length >= 2 && categories.size > 1) {
      disagreements.push({ emailId, classifications });
    }
  }

  return disagreements;
}

/**
 * Get top categories across all models
 *
 * Returns categories sorted by frequency (how many models found them).
 */
export function getTopCategories(
  coverage: CoverageMetrics,
  limit = 10
): Array<{ category: string; frequency: number }> {
  return Object.entries(coverage.categoryFrequency)
    .map(([category, frequency]) => ({ category, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
}
