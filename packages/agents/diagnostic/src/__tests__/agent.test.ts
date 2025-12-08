/**
 * Diagnostic Agent Tests - Sprint 8
 *
 * Tests for DiagnosticAgent conforming to BaseAgent pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagnosticAgent, createDiagnosticAgent } from '../agent.js';
import type { DiagnosticTriggerData } from '../types.js';
import type { AgentContext, AgentStore } from '@ownyou/agents-base';

// Mock store implementation
function createMockStore(): AgentStore {
  const data = new Map<string, Map<string, unknown>>();

  const getNamespaceKey = (ns: readonly string[]): string => ns.join(':');

  return {
    async get(namespace: readonly string[], key: string): Promise<unknown | null> {
      const nsKey = getNamespaceKey(namespace);
      const nsData = data.get(nsKey);
      return nsData?.get(key) ?? null;
    },
    async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
      const nsKey = getNamespaceKey(namespace);
      if (!data.has(nsKey)) {
        data.set(nsKey, new Map());
      }
      data.get(nsKey)!.set(key, value);
    },
    async delete(namespace: readonly string[], key: string): Promise<void> {
      const nsKey = getNamespaceKey(namespace);
      data.get(nsKey)?.delete(key);
    },
    async search(): Promise<Array<{ key: string; value: unknown; score?: number }>> {
      return [];
    },
    async list(namespace: readonly string[]): Promise<Array<{ key: string; value: unknown }>> {
      const nsKey = getNamespaceKey(namespace);
      const nsData = data.get(nsKey);
      if (!nsData) return [];
      return Array.from(nsData.entries()).map(([key, value]) => ({ key, value }));
    },
  };
}

describe('DiagnosticAgent', () => {
  let mockStore: AgentStore;

  beforeEach(() => {
    mockStore = createMockStore();
  });

  describe('constructor', () => {
    it('should create agent with default config', () => {
      const agent = new DiagnosticAgent();

      expect(agent.agentType).toBe('diagnostic');
      expect(agent.level).toBe('L2');
    });

    it('should accept custom options', () => {
      const agent = new DiagnosticAgent({
        minPatternConfidence: 0.7,
        maxInsights: 5,
        maxPatterns: 10,
      });

      expect(agent).toBeDefined();
      expect(agent.agentType).toBe('diagnostic');
    });

    it('should accept custom urgency thresholds', () => {
      const agent = new DiagnosticAgent({
        urgencyThresholds: {
          highDaysSinceReport: 60,
          mediumDaysSinceReport: 30,
          lowCompletenessThreshold: 20,
        },
      });

      expect(agent).toBeDefined();
    });

    it('should accept custom completeness config', () => {
      const agent = new DiagnosticAgent({
        completenessConfig: {
          sourceWeights: {
            email: 0.5,
            financial: 0.2,
            calendar: 0.2,
            browser: 0.1,
          },
        },
      });

      expect(agent).toBeDefined();
    });
  });

  describe('run (BaseAgent pattern)', () => {
    it('should return error for missing trigger data', async () => {
      const agent = new DiagnosticAgent();

      const context: AgentContext = {
        userId: 'test-user-123',
        store: mockStore,
        tools: [],
      };

      const result = await agent.run(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid trigger data');
    });

    it('should return error for invalid trigger data', async () => {
      const agent = new DiagnosticAgent();

      const context: AgentContext = {
        userId: 'test-user-123',
        store: mockStore,
        tools: [],
        triggerData: { invalid: true },
      };

      const result = await agent.run(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid trigger data');
    });

    it('should generate mission card on success', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
        includePatterns: true,
        includeInsights: true,
      };

      const context: AgentContext = {
        userId: 'test-user-123',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      };

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      expect(result.missionCard?.type).toBe('diagnostic');
      expect(result.missionCard?.status).toBe('CREATED');
    });

    it('should store diagnostic report', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'scheduled',
      };

      const context: AgentContext = {
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      };

      await agent.run(context);

      // Check that report was stored
      const storedReport = await mockStore.get(
        ['users', 'test-user', 'diagnosticReports'],
        'latest'
      );
      expect(storedReport).toBeDefined();
    });

    it('should store mission card', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
      };

      const context: AgentContext = {
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      };

      const result = await agent.run(context);

      // Check that mission card was stored
      if (result.missionCard) {
        const storedCard = await mockStore.get(
          ['users', 'test-user', 'missionCards'],
          result.missionCard.id
        );
        expect(storedCard).toBeDefined();
      }
    });

    it('should handle different analysis types', async () => {
      const agent = new DiagnosticAgent();

      const scheduledTrigger: DiagnosticTriggerData = {
        analysisType: 'scheduled',
      };

      const newSourceTrigger: DiagnosticTriggerData = {
        analysisType: 'new_source',
      };

      const manualTrigger: DiagnosticTriggerData = {
        analysisType: 'manual',
      };

      const scheduledResult = await agent.run({
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: scheduledTrigger,
      });

      const newSourceResult = await agent.run({
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: newSourceTrigger,
      });

      const manualResult = await agent.run({
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: manualTrigger,
      });

      expect(scheduledResult.success).toBe(true);
      expect(newSourceResult.success).toBe(true);
      expect(manualResult.success).toBe(true);
    });

    it('should return usage stats', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
        includePatterns: true,
        includeInsights: true,
      };

      const context: AgentContext = {
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      };

      const result = await agent.run(context);

      expect(result.usage).toBeDefined();
      expect(result.toolCalls).toBeDefined();
      expect(result.memoryOps).toBeDefined();
    });

    it('should record tool calls for each analysis step', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
        includePatterns: true,
        includeInsights: true,
      };

      const context: AgentContext = {
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      };

      const result = await agent.run(context);

      // Should have tool calls for analyze_profile, find_patterns, generate_insights, suggest_connections
      const toolNames = result.toolCalls.map(tc => tc.name);
      expect(toolNames).toContain('analyze_profile');
      expect(toolNames).toContain('find_patterns');
      expect(toolNames).toContain('generate_insights');
      expect(toolNames).toContain('suggest_connections');
    });

    it('should skip patterns when includePatterns is false', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
        includePatterns: false,
        includeInsights: true,
      };

      const context: AgentContext = {
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      };

      const result = await agent.run(context);

      const toolNames = result.toolCalls.map(tc => tc.name);
      expect(toolNames).not.toContain('find_patterns');
    });

    it('should skip insights when includeInsights is false', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
        includePatterns: true,
        includeInsights: false,
      };

      const context: AgentContext = {
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      };

      const result = await agent.run(context);

      const toolNames = result.toolCalls.map(tc => tc.name);
      expect(toolNames).not.toContain('generate_insights');
    });
  });

  describe('urgency determination', () => {
    it('should return high urgency for low completeness', async () => {
      const agent = new DiagnosticAgent({
        urgencyThresholds: {
          highDaysSinceReport: 30,
          mediumDaysSinceReport: 14,
          lowCompletenessThreshold: 50,
        },
      });

      // Empty store = low completeness
      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
      };

      const result = await agent.run({
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      });

      expect(result.missionCard?.urgency).toBe('high');
    });
  });

  describe('mission card content', () => {
    it('should generate "Build Your Profile" title for low completeness', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
      };

      const result = await agent.run({
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      });

      // With empty store, completeness should be low
      expect(result.missionCard?.title).toBe('Build Your Profile');
    });

    it('should include primary action to view report', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
      };

      const result = await agent.run({
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      });

      expect(result.missionCard?.primaryAction).toBeDefined();
      expect(result.missionCard?.primaryAction.label).toBe('View Report');
      expect(result.missionCard?.primaryAction.type).toBe('navigate');
    });

    it('should include evidence refs', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
      };

      const result = await agent.run({
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      });

      expect(result.missionCard?.evidenceRefs).toBeDefined();
      expect(result.missionCard?.evidenceRefs?.length).toBeGreaterThan(0);
    });
  });

  describe('episode recording', () => {
    it('should record episode when mission card is created', async () => {
      const agent = new DiagnosticAgent();

      const trigger: DiagnosticTriggerData = {
        analysisType: 'manual',
        includePatterns: true,
      };

      const result = await agent.run({
        userId: 'test-user',
        store: mockStore,
        tools: [],
        triggerData: trigger,
      });

      // BaseAgent records episode automatically when mission card is created
      expect(result.episode).toBeDefined();
      expect(result.episode?.agentType).toBe('diagnostic');
    });
  });

  describe('createDiagnosticAgent factory', () => {
    it('should create agent with defaults', () => {
      const agent = createDiagnosticAgent();

      expect(agent).toBeInstanceOf(DiagnosticAgent);
      expect(agent.agentType).toBe('diagnostic');
    });

    it('should pass options to constructor', () => {
      const agent = createDiagnosticAgent({
        minPatternConfidence: 0.9,
      });

      expect(agent).toBeInstanceOf(DiagnosticAgent);
    });
  });
});
