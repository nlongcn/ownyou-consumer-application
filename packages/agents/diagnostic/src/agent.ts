/**
 * Diagnostic Agent - Sprint 8
 *
 * L2 Agent that analyzes user profile, finds patterns, and generates insights.
 */

import type {
  DiagnosticReport,
  DiagnosticAgentConfig,
  AnalysisContext,
  DEFAULT_DIAGNOSTIC_CONFIG,
} from './types.js';

import {
  analyzeProfileCompleteness,
  generateCompletnessSuggestions,
  analyzePatterns,
  generateInsights,
  filterByConfidence,
} from './analyzers/index.js';

/**
 * Diagnostic Agent configuration
 */
export interface DiagnosticAgentOptions {
  config?: Partial<DiagnosticAgentConfig>;
  minPatternConfidence?: number;
  maxInsights?: number;
  maxPatterns?: number;
}

/**
 * Diagnostic Agent - Analyzes profile and generates insights
 */
export class DiagnosticAgent {
  private config: DiagnosticAgentConfig;
  private minPatternConfidence: number;
  private maxInsights: number;
  private maxPatterns: number;

  constructor(options: DiagnosticAgentOptions = {}) {
    this.config = {
      agentType: 'diagnostic',
      level: 'L2',
      memoryAccess: {
        read: ['*'],
        write: ['diagnosticReports'],
        search: ['*'],
      },
      limits: {
        maxToolCalls: 10,
        maxLlmCalls: 5,
        timeoutSeconds: 120,
        maxMemoryReads: 25,
        maxMemoryWrites: 10,
      },
      ...options.config,
    };

    this.minPatternConfidence = options.minPatternConfidence ?? 0.5;
    this.maxInsights = options.maxInsights ?? 10;
    this.maxPatterns = options.maxPatterns ?? 15;
  }

  /**
   * Run full diagnostic analysis
   */
  async runDiagnostic(context: AnalysisContext): Promise<DiagnosticReport> {
    const reportId = `diag_${context.userId}_${Date.now()}`;

    // Step 1: Analyze profile completeness
    const completenessResult = analyzeProfileCompleteness(context);
    if (!completenessResult.success || !completenessResult.data) {
      throw new Error(completenessResult.error || 'Completeness analysis failed');
    }
    const completeness = completenessResult.data;

    // Step 2: Discover patterns
    const patternsResult = analyzePatterns(context);
    if (!patternsResult.success || !patternsResult.data) {
      throw new Error(patternsResult.error || 'Pattern analysis failed');
    }
    const allPatterns = patternsResult.data;

    // Filter by confidence and limit
    const patterns = filterByConfidence(allPatterns, this.minPatternConfidence).slice(
      0,
      this.maxPatterns
    );

    // Step 3: Generate insights
    const insightsResult = generateInsights(patterns, completeness, context);
    if (!insightsResult.success || !insightsResult.data) {
      throw new Error(insightsResult.error || 'Insight generation failed');
    }
    const insights = insightsResult.data.slice(0, this.maxInsights);

    // Step 4: Generate suggestions
    const suggestions = generateCompletnessSuggestions(completeness);

    // Build report
    const report: DiagnosticReport = {
      id: reportId,
      userId: context.userId,
      generatedAt: Date.now(),
      completeness,
      patterns,
      insights,
      suggestions,
      version: '1.0.0',
      analysisType: context.analysisType,
    };

    return report;
  }

  /**
   * Quick analysis - just completeness
   */
  async quickAnalysis(context: AnalysisContext): Promise<Pick<DiagnosticReport, 'completeness' | 'suggestions'>> {
    const completenessResult = analyzeProfileCompleteness(context);
    if (!completenessResult.success || !completenessResult.data) {
      throw new Error(completenessResult.error || 'Completeness analysis failed');
    }

    const suggestions = generateCompletnessSuggestions(completenessResult.data);

    return {
      completeness: completenessResult.data,
      suggestions,
    };
  }

  /**
   * Get agent configuration
   */
  getConfig(): DiagnosticAgentConfig {
    return { ...this.config };
  }

  /**
   * Check if agent can access a namespace
   */
  canReadNamespace(namespace: string): boolean {
    return this.config.memoryAccess.read.includes('*') || this.config.memoryAccess.read.includes(namespace);
  }

  /**
   * Check if agent can write to a namespace
   */
  canWriteNamespace(namespace: string): boolean {
    return this.config.memoryAccess.write.includes('*') || this.config.memoryAccess.write.includes(namespace);
  }
}

/**
 * Create a diagnostic agent with default configuration
 */
export function createDiagnosticAgent(options?: DiagnosticAgentOptions): DiagnosticAgent {
  return new DiagnosticAgent(options);
}
