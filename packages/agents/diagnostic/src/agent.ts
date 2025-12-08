/**
 * Diagnostic Agent - Sprint 8
 *
 * L2 agent for profile analysis, pattern detection, and insight generation.
 * Conforms to BaseAgent pattern per v13 Section 3.6.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 */

import { BaseAgent, type AgentContext, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NAMESPACES, NS } from '@ownyou/shared-types';
import {
  DIAGNOSTIC_PERMISSIONS,
  type DiagnosticTriggerData,
  type DiagnosticReport,
  type ProfileCompleteness,
  type DiscoveredPattern,
  type Insight,
  type CompletenessConfig,
  type DiagnosticUrgencyThresholds,
  DEFAULT_COMPLETENESS_CONFIG,
  DEFAULT_URGENCY_THRESHOLDS,
} from './types.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DiagnosticAgent configuration options
 * v13 compliant - all magic numbers extracted to config
 */
export interface DiagnosticAgentConfig {
  /** Minimum pattern confidence threshold */
  minPatternConfidence?: number;
  /** Maximum insights to generate */
  maxInsights?: number;
  /** Maximum patterns to include */
  maxPatterns?: number;
  /** Completeness analysis configuration */
  completenessConfig?: Partial<CompletenessConfig>;
  /** Urgency thresholds for mission cards */
  urgencyThresholds?: DiagnosticUrgencyThresholds;
  /** Ikigai alignment boost for diagnostic mission cards */
  ikigaiAlignmentBoost?: number;
}

const DEFAULT_CONFIG: Required<DiagnosticAgentConfig> = {
  minPatternConfidence: 0.5,
  maxInsights: 10,
  maxPatterns: 15,
  completenessConfig: DEFAULT_COMPLETENESS_CONFIG,
  urgencyThresholds: DEFAULT_URGENCY_THRESHOLDS,
  ikigaiAlignmentBoost: 0.2,
};

// ─────────────────────────────────────────────────────────────────────────────
// DiagnosticAgent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DiagnosticAgent - L2 agent for profile analysis and insights
 *
 * Capabilities:
 * - Analyzes profile completeness across all data sources
 * - Discovers behavioral patterns using LLM
 * - Generates actionable insights
 * - Creates mission cards for profile improvements
 *
 * @example
 * ```typescript
 * const agent = new DiagnosticAgent();
 * const result = await agent.run({
 *   userId: 'user_123',
 *   store: memoryStore,
 *   tools: [],
 *   triggerData: {
 *     analysisType: 'scheduled',
 *     includePatterns: true,
 *     includeInsights: true,
 *   },
 * });
 * ```
 */
export class DiagnosticAgent extends BaseAgent {
  readonly agentType = 'diagnostic' as const;
  readonly level = 'L2' as const;

  private config: Required<DiagnosticAgentConfig>;
  private completenessConfig: CompletenessConfig;

  constructor(config: DiagnosticAgentConfig = {}) {
    super(DIAGNOSTIC_PERMISSIONS);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.completenessConfig = {
      ...DEFAULT_COMPLETENESS_CONFIG,
      ...config.completenessConfig,
      sourceWeights: {
        ...DEFAULT_COMPLETENESS_CONFIG.sourceWeights,
        ...config.completenessConfig?.sourceWeights,
      },
      coverageThresholds: {
        ...DEFAULT_COMPLETENESS_CONFIG.coverageThresholds,
        ...config.completenessConfig?.coverageThresholds,
      },
    };

    // Set module-level config for analyzers
    setCompletenessConfig(this.completenessConfig);
  }

  /**
   * Execute the diagnostic agent logic
   */
  protected async execute(context: AgentContext): Promise<AgentResult> {
    const { userId, store, triggerData, llm } = context;

    // Validate trigger data
    if (!triggerData || !this.isDiagnosticTrigger(triggerData)) {
      return {
        success: false,
        error: 'Missing or invalid trigger data - expected DiagnosticTriggerData',
      } as AgentResult;
    }

    const trigger = triggerData as DiagnosticTriggerData;

    // Set LLM client if available
    if (llm) {
      setInsightLLMClient(llm);
    }

    // Track evidence refs for v13 compliance
    const evidenceRefs: string[] = [];

    try {
      // 1. Load data from all sources
      const analysisContext = await this.loadAnalysisContext(store, userId, trigger);
      evidenceRefs.push(`ikigai:${userId}`);

      // 2. Analyze profile completeness
      const completenessResult = analyzeProfileCompleteness(analysisContext, this.completenessConfig);
      if (!completenessResult.success || !completenessResult.data) {
        throw new Error(completenessResult.error || 'Completeness analysis failed');
      }
      const completeness = completenessResult.data;
      this.recordToolCall('analyze_profile', { userId }, { completeness: completeness.overall }, 0);

      // 3. Discover patterns (if requested)
      let patterns: DiscoveredPattern[] = [];
      if (trigger.includePatterns !== false) {
        const patternsResult = analyzePatterns(analysisContext);
        if (patternsResult.success && patternsResult.data) {
          patterns = filterByConfidence(patternsResult.data, this.config.minPatternConfidence)
            .slice(0, this.config.maxPatterns);
          this.recordToolCall('find_patterns', { userId }, { patternCount: patterns.length }, 0);
        }
      }

      // 4. Generate insights (if requested)
      let insights: Insight[] = [];
      if (trigger.includeInsights !== false) {
        if (llm) {
          // LLM-based insight generation (preferred)
          const insightsResult = await generateInsightsAsync(patterns, completeness, analysisContext, {
            llmClient: llm,
            maxInsights: this.config.maxInsights,
            userId,
          });
          if (insightsResult.success && insightsResult.data) {
            insights = insightsResult.data;
          }
        } else {
          // Fallback to basic structural insights
          const insightsResult = generateInsights(patterns, completeness, analysisContext);
          if (insightsResult.success && insightsResult.data) {
            insights = insightsResult.data.slice(0, this.config.maxInsights);
          }
        }
        this.recordToolCall('generate_insights', { userId }, { insightCount: insights.length }, 0);
      }

      // 5. Generate suggestions
      const suggestions = generateCompletenessSuggestions(completeness);
      this.recordToolCall('suggest_connections', { userId }, { suggestionCount: suggestions.length }, 0);

      // 6. Build diagnostic report
      const report = this.buildReport(userId, trigger.analysisType, completeness, patterns, insights, suggestions);

      // 7. Store report
      await this.storeReport(store, userId, report);
      evidenceRefs.push(`diagnostic:${report.id}`);

      // 8. Determine urgency based on profile state
      const urgency = this.determineUrgency(completeness, analysisContext.previousReport);

      // 9. Generate mission card
      const missionCard = this.generateMissionCard(
        userId,
        report,
        urgency,
        evidenceRefs
      );

      // 10. Store mission card
      await this.storeMissionCard(store, userId, missionCard);

      return {
        success: true,
        missionCard,
        response: `Profile analysis complete: ${completeness.overall}% complete, ${patterns.length} patterns, ${insights.length} insights`,
      } as AgentResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Diagnostic analysis failed: ${errorMessage}`,
      } as AgentResult;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Type guard for DiagnosticTriggerData
   */
  private isDiagnosticTrigger(data: unknown): data is DiagnosticTriggerData {
    if (typeof data !== 'object' || data === null) return false;
    const trigger = data as Record<string, unknown>;
    return typeof trigger.analysisType === 'string' &&
      ['scheduled', 'new_source', 'manual'].includes(trigger.analysisType);
  }

  /**
   * Load analysis context from store
   */
  private async loadAnalysisContext(
    store: AgentContext['store'],
    userId: string,
    trigger: DiagnosticTriggerData
  ): Promise<import('./types.js').AnalysisContext> {
    const context: import('./types.js').AnalysisContext = {
      userId,
      analysisType: trigger.analysisType,
    };

    // Load previous report if requested
    if (trigger.previousReportId) {
      try {
        const prevReport = await store.get(NS.diagnosticReports(userId), trigger.previousReportId);
        this.recordMemoryOp('read', NAMESPACES.DIAGNOSTIC_REPORTS, trigger.previousReportId);
        if (prevReport) {
          context.previousReport = prevReport as DiagnosticReport;
        }
      } catch {
        // Previous report not found - continue without it
      }
    }

    // Load Ikigai profile
    try {
      const ikigaiProfile = await store.get(NS.ikigaiProfile(userId), 'profile');
      this.recordMemoryOp('read', NAMESPACES.IKIGAI_PROFILE, 'profile');
      if (ikigaiProfile) {
        context.ikigaiProfile = ikigaiProfile;
      }
    } catch {
      // Profile not found
    }

    // Load financial data
    try {
      const financialProfile = await store.get(NS.financialProfile(userId), 'profile');
      this.recordMemoryOp('read', NAMESPACES.FINANCIAL_PROFILE, 'profile');
      const transactions = await store.list(NS.financialTransactions(userId), { limit: 100 });
      this.recordMemoryOp('read', NAMESPACES.FINANCIAL_TRANSACTIONS);
      context.financialData = {
        profile: financialProfile,
        transactions: transactions.map(t => t.value),
      };
    } catch {
      // Financial data not found
    }

    // Load calendar data
    try {
      const calendarProfile = await store.get(NS.calendarProfile(userId), 'profile');
      this.recordMemoryOp('read', NAMESPACES.CALENDAR_PROFILE, 'profile');
      const events = await store.list(NS.calendarEvents(userId), { limit: 100 });
      this.recordMemoryOp('read', NAMESPACES.CALENDAR_EVENTS);
      context.calendarData = {
        profile: calendarProfile,
        events: events.map(e => e.value),
      };
    } catch {
      // Calendar data not found
    }

    // Load email classifications
    try {
      const classifications = await store.list(NS.iabClassifications(userId), { limit: 100 });
      this.recordMemoryOp('read', NAMESPACES.IAB_CLASSIFICATIONS);
      context.emailData = {
        profile: null,
        classifications: classifications.map(c => c.value),
      };
    } catch {
      // Email data not found
    }

    return context;
  }

  /**
   * Build diagnostic report
   */
  private buildReport(
    userId: string,
    analysisType: DiagnosticReport['analysisType'],
    completeness: ProfileCompleteness,
    patterns: DiscoveredPattern[],
    insights: Insight[],
    suggestions: import('./types.js').DataSuggestion[]
  ): DiagnosticReport {
    const now = Date.now();
    return {
      id: `diag_${userId}_${now}`,
      userId,
      generatedAt: now,
      completeness,
      patterns,
      insights,
      suggestions,
      version: '1.0.0',
      analysisType,
    };
  }

  /**
   * Store diagnostic report
   */
  private async storeReport(
    store: AgentContext['store'],
    userId: string,
    report: DiagnosticReport
  ): Promise<void> {
    const namespace = NS.diagnosticReports(userId);
    this.recordMemoryOp('write', NAMESPACES.DIAGNOSTIC_REPORTS, report.id);
    await store.put(namespace, report.id, report);

    // Also store as 'latest' for easy retrieval
    await store.put(namespace, 'latest', report);
  }

  /**
   * Determine urgency based on profile completeness and time since last report
   */
  private determineUrgency(
    completeness: ProfileCompleteness,
    previousReport?: DiagnosticReport
  ): 'low' | 'medium' | 'high' {
    const thresholds = this.config.urgencyThresholds;

    // Low completeness = high urgency
    if (completeness.overall < thresholds.lowCompletenessThreshold) {
      return 'high';
    }

    // Check time since last report
    if (previousReport) {
      const daysSinceReport = (Date.now() - previousReport.generatedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceReport > thresholds.highDaysSinceReport) return 'high';
      if (daysSinceReport > thresholds.mediumDaysSinceReport) return 'medium';
    }

    return 'low';
  }

  /**
   * Generate mission card from diagnostic report
   */
  private generateMissionCard(
    userId: string,
    report: DiagnosticReport,
    urgency: 'low' | 'medium' | 'high',
    evidenceRefs: string[]
  ): MissionCard {
    const now = Date.now();
    const missionId = `mission_diagnostic_${now}_${Math.random().toString(36).slice(2, 8)}`;

    // Determine title and summary based on report
    let title: string;
    let summary: string;

    if (report.completeness.overall < 30) {
      title = 'Build Your Profile';
      summary = `Your profile is ${report.completeness.overall}% complete. Connect more data sources to unlock personalized insights.`;
    } else if (report.patterns.length > 0) {
      title = `${report.patterns.length} Patterns Discovered`;
      summary = `We found ${report.patterns.length} behavioral patterns in your data. ${report.insights.length} insights generated.`;
    } else {
      title = 'Profile Analysis Complete';
      summary = `Profile ${report.completeness.overall}% complete. ${report.suggestions.length} suggestions for improvement.`;
    }

    // Determine ikigai dimensions
    const ikigaiDimensions: Array<'passion' | 'mission' | 'profession' | 'vocation' | 'relationships' | 'wellbeing' | 'growth' | 'contribution'> = ['growth'];
    if (report.completeness.byDimension.relationships > 50) {
      ikigaiDimensions.push('relationships');
    }
    if (report.completeness.byDimension.experiences > 50) {
      ikigaiDimensions.push('wellbeing');
    }

    return {
      id: missionId,
      type: 'diagnostic',
      title,
      summary,
      urgency,
      status: 'CREATED',
      createdAt: now,
      ikigaiDimensions,
      ikigaiAlignmentBoost: this.config.ikigaiAlignmentBoost,
      primaryAction: {
        label: 'View Report',
        type: 'navigate',
        payload: {
          route: '/diagnostic',
          reportId: report.id,
        },
      },
      secondaryActions: [
        ...(report.suggestions.length > 0 ? [{
          label: 'Connect Data Source',
          type: 'navigate' as const,
          payload: {
            route: '/settings/data-sources',
            suggested: report.suggestions[0]?.source,
          },
        }] : []),
        {
          label: 'Dismiss',
          type: 'confirm' as const,
          payload: { action: 'dismiss' },
        },
      ],
      agentThreadId: `thread_${missionId}`,
      evidenceRefs,
    };
  }

  /**
   * Store mission card in memory
   */
  private async storeMissionCard(
    store: AgentContext['store'],
    userId: string,
    missionCard: MissionCard
  ): Promise<void> {
    const namespace = NS.missionCards(userId);
    this.recordMemoryOp('write', NAMESPACES.MISSION_CARDS, missionCard.id);
    await store.put(namespace, missionCard.id, missionCard);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Episode Recording Overrides (v13 Section 8.4.2)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Override describeTrigger for diagnostic-specific episode situation
   */
  protected override describeTrigger(trigger: unknown): string {
    if (!trigger || !this.isDiagnosticTrigger(trigger)) {
      return 'Diagnostic analysis without specific trigger';
    }

    const t = trigger as DiagnosticTriggerData;
    const parts: string[] = [`${t.analysisType} analysis`];

    if (t.focusSource) parts.push(`focused on ${t.focusSource}`);
    if (t.includePatterns) parts.push('with pattern analysis');
    if (t.includeInsights) parts.push('with insight generation');

    return `User triggered diagnostic: ${parts.join(', ')}`;
  }

  /**
   * Override extractTags for diagnostic-specific episode tags
   */
  protected override extractTags(trigger: unknown, mission: MissionCard): string[] {
    const baseTags = super.extractTags(trigger, mission);

    if (trigger && this.isDiagnosticTrigger(trigger)) {
      const t = trigger as DiagnosticTriggerData;
      baseTags.push(`analysis:${t.analysisType}`);
      if (t.focusSource) baseTags.push(`source:${t.focusSource}`);
    }

    return [...new Set(baseTags)]; // Remove duplicates
  }
}

/**
 * Create a diagnostic agent with default configuration
 */
export function createDiagnosticAgent(config?: DiagnosticAgentConfig): DiagnosticAgent {
  return new DiagnosticAgent(config);
}
