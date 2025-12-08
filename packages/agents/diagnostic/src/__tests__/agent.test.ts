/**
 * Diagnostic Agent Tests - Sprint 8
 */

import { describe, it, expect } from 'vitest';
import { DiagnosticAgent, createDiagnosticAgent } from '../agent.js';
import type { AnalysisContext } from '../types.js';

describe('DiagnosticAgent', () => {
  describe('constructor', () => {
    it('should create agent with default config', () => {
      const agent = new DiagnosticAgent();
      const config = agent.getConfig();

      expect(config.agentType).toBe('diagnostic');
      expect(config.level).toBe('L2');
      expect(config.memoryAccess.read).toContain('*');
      expect(config.memoryAccess.write).toContain('diagnosticReports');
    });

    it('should accept custom options', () => {
      const agent = new DiagnosticAgent({
        minPatternConfidence: 0.7,
        maxInsights: 5,
        maxPatterns: 10,
      });

      // The agent should use these values internally
      expect(agent).toBeDefined();
    });

    it('should allow overriding config limits', () => {
      const agent = new DiagnosticAgent({
        config: {
          limits: {
            maxToolCalls: 20,
            maxLlmCalls: 10,
            timeoutSeconds: 300,
            maxMemoryReads: 50,
            maxMemoryWrites: 20,
          },
        },
      });

      const config = agent.getConfig();
      expect(config.limits.maxToolCalls).toBe(20);
      expect(config.limits.maxLlmCalls).toBe(10);
    });
  });

  describe('runDiagnostic', () => {
    it('should generate complete diagnostic report', async () => {
      const agent = new DiagnosticAgent();

      const context: AnalysisContext = {
        userId: 'test-user-123',
        analysisType: 'manual',
        emailData: {
          classifications: [
            { category: 'Technology', confidence: 0.9 },
            { category: 'Technology', confidence: 0.85 },
            { category: 'Travel', confidence: 0.8 },
          ],
          profile: { lastSync: Date.now() },
        },
        financialData: {
          transactions: [
            { merchant: 'Amazon', category: 'shopping', amount: 100 },
            { merchant: 'Netflix', category: 'entertainment', amount: 15.99 },
            { merchant: 'Netflix', category: 'entertainment', amount: 15.99 },
          ],
          profile: { lastSync: Date.now() },
        },
      };

      const report = await agent.runDiagnostic(context);

      expect(report.id).toMatch(/^diag_test-user-123_/);
      expect(report.userId).toBe('test-user-123');
      expect(report.generatedAt).toBeLessThanOrEqual(Date.now());
      expect(report.version).toBe('1.0.0');
      expect(report.analysisType).toBe('manual');

      // Should have completeness data
      expect(report.completeness).toBeDefined();
      expect(report.completeness.overall).toBeGreaterThanOrEqual(0);
      expect(report.completeness.bySource.email.connected).toBe(true);
      expect(report.completeness.bySource.financial.connected).toBe(true);

      // Should have patterns array
      expect(Array.isArray(report.patterns)).toBe(true);

      // Should have insights array
      expect(Array.isArray(report.insights)).toBe(true);

      // Should have suggestions array
      expect(Array.isArray(report.suggestions)).toBe(true);
    });

    it('should generate report for empty context', async () => {
      const agent = new DiagnosticAgent();

      const context: AnalysisContext = {
        userId: 'empty-user',
        analysisType: 'scheduled',
      };

      const report = await agent.runDiagnostic(context);

      expect(report.userId).toBe('empty-user');
      expect(report.completeness.overall).toBe(0);
      expect(report.completeness.missingData.length).toBe(4); // All sources missing
      expect(report.patterns.length).toBe(0);
    });

    it('should filter patterns by confidence', async () => {
      const agent = new DiagnosticAgent({
        minPatternConfidence: 0.8,
      });

      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        financialData: {
          transactions: [
            { merchant: 'Store', category: 'shopping', amount: 50 },
          ],
          profile: {},
        },
      };

      const report = await agent.runDiagnostic(context);

      // All patterns should have confidence >= 0.8
      for (const pattern of report.patterns) {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });

    it('should limit number of insights', async () => {
      const agent = new DiagnosticAgent({
        maxInsights: 3,
      });

      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        emailData: {
          classifications: new Array(200).fill({ category: 'Tech' }),
          profile: {},
        },
        financialData: {
          transactions: new Array(100).fill({ merchant: 'Store', category: 'shopping', amount: 50 }),
          profile: {},
        },
        calendarData: {
          events: new Array(50).fill({ title: 'Meeting', type: 'meeting', attendees: [{ email: 'test@test.com' }] }),
          profile: {},
        },
      };

      const report = await agent.runDiagnostic(context);

      expect(report.insights.length).toBeLessThanOrEqual(3);
    });

    it('should limit number of patterns', async () => {
      const agent = new DiagnosticAgent({
        maxPatterns: 5,
      });

      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'manual',
        emailData: {
          classifications: new Array(500).fill({ category: 'Various' }),
          profile: {},
        },
        financialData: {
          transactions: new Array(200).fill({ merchant: 'Various', category: 'various', amount: 100 }),
          profile: {},
        },
      };

      const report = await agent.runDiagnostic(context);

      expect(report.patterns.length).toBeLessThanOrEqual(5);
    });

    it('should handle different analysis types', async () => {
      const agent = new DiagnosticAgent();

      const scheduledContext: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'scheduled',
      };

      const newSourceContext: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'new_source',
      };

      const scheduledReport = await agent.runDiagnostic(scheduledContext);
      const newSourceReport = await agent.runDiagnostic(newSourceContext);

      expect(scheduledReport.analysisType).toBe('scheduled');
      expect(newSourceReport.analysisType).toBe('new_source');
    });

    it('should include previous report context when provided', async () => {
      const agent = new DiagnosticAgent();

      const context: AnalysisContext = {
        userId: 'test-user',
        analysisType: 'scheduled',
        previousReport: {
          id: 'prev_report',
          userId: 'test-user',
          generatedAt: Date.now() - 86400000,
          completeness: {
            overall: 30,
            bySource: {
              email: { connected: true, lastSync: Date.now(), itemCount: 50, coverage: 10 },
              financial: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
              calendar: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
              browser: { connected: false, lastSync: null, itemCount: 0, coverage: 0 },
            },
            byDimension: { experiences: 20, relationships: 10, interests: 30, giving: 5 },
            missingData: ['financial', 'calendar', 'browser'],
          },
          patterns: [],
          insights: [],
          suggestions: [],
          version: '1.0.0',
          analysisType: 'scheduled',
        },
        emailData: {
          classifications: new Array(100).fill({ category: 'Tech' }),
          profile: {},
        },
      };

      const report = await agent.runDiagnostic(context);

      // Should complete successfully with previous report context
      expect(report.id).toBeDefined();
      expect(report.completeness.bySource.email.connected).toBe(true);
    });
  });

  describe('quickAnalysis', () => {
    it('should return only completeness and suggestions', async () => {
      const agent = new DiagnosticAgent();

      const context: AnalysisContext = {
        userId: 'quick-test',
        analysisType: 'manual',
        emailData: {
          classifications: [{ category: 'Test' }],
          profile: {},
        },
      };

      const result = await agent.quickAnalysis(context);

      expect(result.completeness).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect((result as Record<string, unknown>).patterns).toBeUndefined();
      expect((result as Record<string, unknown>).insights).toBeUndefined();
    });

    it('should suggest missing data sources', async () => {
      const agent = new DiagnosticAgent();

      const context: AnalysisContext = {
        userId: 'quick-test',
        analysisType: 'manual',
      };

      const result = await agent.quickAnalysis(context);

      expect(result.suggestions.length).toBeGreaterThan(0);
      // Should suggest connecting data sources
      const sources = result.suggestions.map((s) => s.source);
      expect(sources).toContain('financial');
    });
  });

  describe('canReadNamespace / canWriteNamespace', () => {
    it('should allow reading all namespaces by default', () => {
      const agent = new DiagnosticAgent();

      expect(agent.canReadNamespace('emailClassifications')).toBe(true);
      expect(agent.canReadNamespace('financialData')).toBe(true);
      expect(agent.canReadNamespace('anyNamespace')).toBe(true);
    });

    it('should only allow writing to diagnosticReports', () => {
      const agent = new DiagnosticAgent();

      expect(agent.canWriteNamespace('diagnosticReports')).toBe(true);
      expect(agent.canWriteNamespace('emailClassifications')).toBe(false);
      expect(agent.canWriteNamespace('financialData')).toBe(false);
    });

    it('should respect custom memory access config', () => {
      const agent = new DiagnosticAgent({
        config: {
          memoryAccess: {
            read: ['specific_namespace'],
            write: ['custom_write'],
            search: ['*'],
          },
        },
      });

      expect(agent.canReadNamespace('specific_namespace')).toBe(true);
      expect(agent.canReadNamespace('other_namespace')).toBe(false);
      expect(agent.canWriteNamespace('custom_write')).toBe(true);
      expect(agent.canWriteNamespace('diagnosticReports')).toBe(false);
    });
  });

  describe('createDiagnosticAgent factory', () => {
    it('should create agent with defaults', () => {
      const agent = createDiagnosticAgent();

      expect(agent).toBeInstanceOf(DiagnosticAgent);
      expect(agent.getConfig().agentType).toBe('diagnostic');
    });

    it('should pass options to constructor', () => {
      const agent = createDiagnosticAgent({
        minPatternConfidence: 0.9,
      });

      expect(agent).toBeInstanceOf(DiagnosticAgent);
    });
  });
});
