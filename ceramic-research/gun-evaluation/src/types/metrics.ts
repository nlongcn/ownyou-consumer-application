/**
 * Latency Metrics Types
 *
 * For tracking and analyzing performance metrics during experiments
 */

export interface LatencyMetrics {
  p50: number; // Median latency (ms)
  p95: number; // 95th percentile latency (ms)
  p99: number; // 99th percentile latency (ms)
  min: number; // Minimum latency (ms)
  max: number; // Maximum latency (ms)
  mean: number; // Average latency (ms)
  count: number; // Total samples
}

export interface ExperimentResult {
  experimentName: string;
  timestamp: number;
  metrics: LatencyMetrics;
  rawSamples: number[];
  success: boolean;
  error?: string;
}
