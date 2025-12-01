/**
 * Metrics Calculation Utilities
 *
 * Calculate P50/P95/P99 latency percentiles from sample data
 */

import type { LatencyMetrics } from "../types/metrics.js";

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;

  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedArray[lower];
  }

  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * Calculate latency metrics from raw samples
 *
 * @param samples - Array of latency measurements in milliseconds
 * @returns Calculated metrics (P50, P95, P99, min, max, mean)
 */
export function calculateMetrics(samples: number[]): LatencyMetrics {
  if (samples.length === 0) {
    return {
      p50: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0,
      mean: 0,
      count: 0,
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);

  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: samples.reduce((sum, val) => sum + val, 0) / samples.length,
    count: samples.length,
  };
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: LatencyMetrics): string {
  return [
    `Samples: ${metrics.count}`,
    `P50: ${metrics.p50.toFixed(1)}ms`,
    `P95: ${metrics.p95.toFixed(1)}ms`,
    `P99: ${metrics.p99.toFixed(1)}ms`,
    `Min: ${metrics.min.toFixed(1)}ms`,
    `Max: ${metrics.max.toFixed(1)}ms`,
    `Mean: ${metrics.mean.toFixed(1)}ms`,
  ].join(" | ");
}
