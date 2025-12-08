/**
 * Diagnostic Agent - Sprint 8
 *
 * L2 Agent that analyzes user profile, finds patterns, and generates insights.
 * v13 architecture: Uses LLM-based agentic processes for insight generation.
 */

import type {
  DiagnosticReport,
  DiagnosticAgentConfig,
  AnalysisContext,
  CompletenessConfig,
} from './types.js';

import { DEFAULT_COMPLETENESS_CONFIG } from './types.js';

import {
  analyzeProfileCompleteness,
  generateCompletenessSuggestions,
  analyzePatterns,
  generateInsights,
  generateInsightsAsync,
  filterByConfidence,
  setInsightLLMClient,
  setCompletenessConfig,
} from './analyzers/index.js';

import type { LLMClient } from '@ownyou/llm-client';

/**
 * Diagnostic Agent configuration
 */
export interface DiagnosticAgentOptions {
  config?: Partial<DiagnosticAgentConfig>;
  minPatternConfidence?: number;
  maxInsights?: number;
  maxPatterns?: number;
  /** LLM client for agentic insight generation */
  llmClient?: LLMClient;
  /** Completeness analysis configuration */
  completenessConfig?: Partial<CompletenessConfig>;
}

/**
 * Diagnostic Agent - Analyzes profile and generates insights
 */
export class DiagnosticAgent {
  private config: DiagnosticAgentConfig;
  private minPatternConfidence: number;
  private maxInsights: number;
  private maxPatterns: number;
  private llmClient: LLMClient | null;
  private completenessConfig: CompletenessConfig;

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
    this.llmClient = options.llmClient ?? null;
    this.completenessConfig = {
      ...DEFAULT_COMPLETENESS_CONFIG,
      ...options.completenessConfig,
      sourceWeights: {
        ...DEFAULT_COMPLETENESS_CONFIG.sourceWeights,
        ...options.completenessConfig?.sourceWeights,
      },
      coverageThresholds: {
        ...DEFAULT_COMPLETENESS_CONFIG.coverageThresholds,
        ...options.completenessConfig?.coverageThresholds,
      },
    };

    // Set module-level configs for analyzers
    if (this.llmClient) {
      setInsightLLMClient(this.llmClient);
    }
    setCompletenessConfig(this.completenessConfig);
  }

  /**
   * Run full diagnostic analysis
   * Uses LLM-based agentic insight generation when LLM client is available
   */
  async runDiagnostic(context: AnalysisContext): Promise<DiagnosticReport> {
    const reportId = `diag_${context.userId}_${Date.now()}`;

    // Step 1: Analyze profile completeness (using configurable thresholds)
    const completenessResult = analyzeProfileCompleteness(context, this.completenessConfig);
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

    // Step 3: Generate insights using LLM-based agentic process
    let insights;
    if (this.llmClient) {
      // Use async LLM-based insight generation (preferred)
      const insightsResult = await generateInsightsAsync(patterns, completeness, context, {
        llmClient: this.llmClient,
        maxInsights: this.maxInsights,
        userId: context.userId,
      });
      if (!insightsResult.success || !insightsResult.data) {
        throw new Error(insightsResult.error || 'LLM insight generation failed');
      }
      insights = insightsResult.data;
    } else {
      // Fallback to basic structural insights (no complex rules)
      const insightsResult = generateInsights(patterns, completeness, context);
      if (!insightsResult.success || !insightsResult.data) {
        throw new Error(insightsResult.error || 'Insight generation failed');
      }
      insights = insightsResult.data.slice(0, this.maxInsights);
    }

    // Step 4: Generate suggestions
    const suggestions = generateCompletenessSuggestions(completeness);

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
    const completenessResult = analyzeProfileCompleteness(context, this.completenessConfig);
    if (!completenessResult.success || !completenessResult.data) {
      throw new Error(completenessResult.error || 'Completeness analysis failed');
    }

    const suggestions = generateCompletenessSuggestions(completenessResult.data);

    return {
      completeness: completenessResult.data,
      suggestions,
    };
  }

  /**
   * Set LLM client for agentic insight generation
   */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
    setInsightLLMClient(client);
  }

  /**
   * Check if LLM client is available
   */
  hasLLMClient(): boolean {
    return this.llmClient !== null;
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
