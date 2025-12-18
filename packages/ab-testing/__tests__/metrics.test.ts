/**
 * Tests for A/B Testing metrics
 */

import { describe, it, expect } from 'vitest';
import {
  computeModelStats,
  computeAgreementMetrics,
  computeCoverageMetrics,
  computeComparisonMetrics,
  getDisagreements,
  getTopCategories,
  type ModelResults,
  type Classification,
} from '../src';

// Helper to create test classifications
function createClassification(
  emailId: string,
  category: string,
  confidence = 0.8
): Classification {
  return {
    emailId,
    category,
    taxonomyId: `IAB-${category.substring(0, 3).toUpperCase()}`,
    confidence,
    reasoning: `Classified as ${category}`,
    section: 'interests',
  };
}

// Helper to create test model results
function createModelResults(
  modelKey: string,
  classifications: Classification[]
): ModelResults {
  const confidences = classifications.map(c => c.confidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  return {
    modelKey,
    classifications,
    stats: {
      avgConfidence,
      minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
      maxConfidence: confidences.length > 0 ? Math.max(...confidences) : 0,
      totalClassifications: classifications.length,
      uniqueCategories: [...new Set(classifications.map(c => c.category))],
    },
    timing: {
      startTime: '2025-01-01T00:00:00Z',
      endTime: '2025-01-01T00:01:00Z',
      durationMs: 60000,
    },
  };
}

describe('computeModelStats', () => {
  it('should compute correct average confidence', () => {
    const results = createModelResults('test:model', [
      createClassification('e1', 'Shopping', 0.8),
      createClassification('e2', 'Travel', 0.9),
      createClassification('e3', 'Sports', 0.7),
    ]);

    const stats = computeModelStats(results, 3);
    expect(stats.avgConfidence).toBeCloseTo(0.8, 5);
  });

  it('should compute correct min/max confidence', () => {
    const results = createModelResults('test:model', [
      createClassification('e1', 'Shopping', 0.5),
      createClassification('e2', 'Travel', 0.9),
      createClassification('e3', 'Sports', 0.7),
    ]);

    const stats = computeModelStats(results, 3);
    expect(stats.minConfidence).toBe(0.5);
    expect(stats.maxConfidence).toBe(0.9);
  });

  it('should compute classification rate', () => {
    const results = createModelResults('test:model', [
      createClassification('e1', 'Shopping', 0.8),
      createClassification('e2', 'Travel', 0.9),
    ]);

    const stats = computeModelStats(results, 4);
    expect(stats.classificationRate).toBe(0.5);
  });

  it('should handle empty classifications', () => {
    const results = createModelResults('test:model', []);
    const stats = computeModelStats(results, 10);
    expect(stats.avgConfidence).toBe(0);
    expect(stats.classificationRate).toBe(0);
  });

  it('should compute standard deviation', () => {
    const results = createModelResults('test:model', [
      createClassification('e1', 'A', 0.6),
      createClassification('e2', 'B', 0.8),
      createClassification('e3', 'C', 1.0),
    ]);

    const stats = computeModelStats(results, 3);
    expect(stats.stdDevConfidence).toBeGreaterThan(0);
    expect(stats.stdDevConfidence).toBeLessThan(1);
  });
});

describe('computeAgreementMetrics', () => {
  it('should count full agreement when all models agree', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Shopping'),
    ]));
    results.set('model3', createModelResults('model3', [
      createClassification('e1', 'Shopping'),
    ]));

    const metrics = computeAgreementMetrics(results, ['e1']);
    expect(metrics.fullAgreementCount).toBe(1);
    expect(metrics.partialAgreementCount).toBe(0);
    expect(metrics.noAgreementCount).toBe(0);
    expect(metrics.agreementRate).toBe(1.0);
  });

  it('should count partial agreement when majority agrees', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Shopping'),
    ]));
    results.set('model3', createModelResults('model3', [
      createClassification('e1', 'Travel'),
    ]));

    const metrics = computeAgreementMetrics(results, ['e1']);
    expect(metrics.partialAgreementCount).toBe(1);
    expect(metrics.fullAgreementCount).toBe(0);
  });

  it('should count no agreement when models all differ', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Travel'),
    ]));
    results.set('model3', createModelResults('model3', [
      createClassification('e1', 'Sports'),
    ]));
    results.set('model4', createModelResults('model4', [
      createClassification('e1', 'News'),
    ]));

    const metrics = computeAgreementMetrics(results, ['e1']);
    expect(metrics.noAgreementCount).toBe(1);
  });

  it('should compute pairwise agreement', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'Travel'),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'Travel'),
    ]));

    const metrics = computeAgreementMetrics(results, ['e1', 'e2']);
    expect(metrics.pairwiseAgreement['model1']['model2']).toBe(1.0);
    expect(metrics.pairwiseAgreement['model2']['model1']).toBe(1.0);
  });

  it('should skip emails classified by only one model', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
    ]));
    results.set('model2', createModelResults('model2', []));

    const metrics = computeAgreementMetrics(results, ['e1']);
    // e1 is only classified by one model, so no agreement can be measured
    expect(metrics.fullAgreementCount).toBe(0);
    expect(metrics.partialAgreementCount).toBe(0);
    expect(metrics.noAgreementCount).toBe(0);
  });
});

describe('computeCoverageMetrics', () => {
  it('should find common categories', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'Travel'),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'Sports'),
    ]));

    const metrics = computeCoverageMetrics(results);
    expect(metrics.commonCategories).toContain('Shopping');
    expect(metrics.commonCategories).not.toContain('Travel');
    expect(metrics.commonCategories).not.toContain('Sports');
  });

  it('should find unique categories per model', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'UniqueA'),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'UniqueB'),
    ]));

    const metrics = computeCoverageMetrics(results);
    expect(metrics.uniqueCategories['model1']).toContain('UniqueA');
    expect(metrics.uniqueCategories['model2']).toContain('UniqueB');
  });

  it('should compute category frequency per model (not per email)', () => {
    const results = new Map<string, ModelResults>();
    // Model 1 classifies 3 emails as "Shopping"
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'Shopping'),
      createClassification('e3', 'Shopping'),
    ]));
    // Model 2 classifies 2 emails as "Shopping"
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'Shopping'),
    ]));

    const metrics = computeCoverageMetrics(results);
    // Frequency should be 2 (both models found Shopping), not 5 (total occurrences)
    expect(metrics.categoryFrequency['Shopping']).toBe(2);
  });
});

describe('computeComparisonMetrics', () => {
  it('should compute all metrics together', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping', 0.8),
      createClassification('e2', 'Travel', 0.9),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Shopping', 0.7),
      createClassification('e2', 'Travel', 0.85),
    ]));

    const metrics = computeComparisonMetrics(results, ['e1', 'e2']);

    expect(metrics.modelStats['model1']).toBeDefined();
    expect(metrics.modelStats['model2']).toBeDefined();
    expect(metrics.agreement).toBeDefined();
    expect(metrics.coverage).toBeDefined();
  });
});

describe('getDisagreements', () => {
  it('should find emails where models disagree', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
      createClassification('e2', 'Travel'),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Travel'), // Disagrees
      createClassification('e2', 'Travel'),
    ]));

    const disagreements = getDisagreements(results, ['e1', 'e2']);
    expect(disagreements.length).toBe(1);
    expect(disagreements[0].emailId).toBe('e1');
  });

  it('should not include emails where models agree', () => {
    const results = new Map<string, ModelResults>();
    results.set('model1', createModelResults('model1', [
      createClassification('e1', 'Shopping'),
    ]));
    results.set('model2', createModelResults('model2', [
      createClassification('e1', 'Shopping'),
    ]));

    const disagreements = getDisagreements(results, ['e1']);
    expect(disagreements.length).toBe(0);
  });
});

describe('getTopCategories', () => {
  it('should return categories sorted by frequency', () => {
    const coverage = {
      categoriesByModel: {},
      commonCategories: [],
      uniqueCategories: {},
      categoryFrequency: {
        'Shopping': 5,
        'Travel': 3,
        'Sports': 1,
      },
    };

    const top = getTopCategories(coverage, 10);
    expect(top[0].category).toBe('Shopping');
    expect(top[0].frequency).toBe(5);
    expect(top[1].category).toBe('Travel');
    expect(top[2].category).toBe('Sports');
  });

  it('should respect limit', () => {
    const coverage = {
      categoriesByModel: {},
      commonCategories: [],
      uniqueCategories: {},
      categoryFrequency: {
        'A': 5,
        'B': 4,
        'C': 3,
        'D': 2,
        'E': 1,
      },
    };

    const top = getTopCategories(coverage, 3);
    expect(top.length).toBe(3);
  });
});
