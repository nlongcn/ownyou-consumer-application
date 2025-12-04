/**
 * Agent Loop Integration Tests - Sprint 3
 *
 * Tests the full flow: IAB Classification -> Agent Trigger -> Mission Card Generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShoppingAgent, evaluateTrigger, SHOPPING_PERMISSIONS } from '@ownyou/agents-shopping';
import type { ShoppingTriggerData } from '@ownyou/agents-shopping';
import { LimitsEnforcer, PrivacyGuard } from '@ownyou/agents-base';
import type { AgentStore } from '@ownyou/agents-base';
import { NAMESPACES, NS } from '@ownyou/shared-types';
import type { MissionCard } from '@ownyou/shared-types';

// In-memory store implementation for testing
class InMemoryStore implements AgentStore {
  private data = new Map<string, Map<string, unknown>>();

  private getNamespaceKey(namespace: readonly string[]): string {
    return namespace.join('.');
  }

  async get(namespace: readonly string[], key: string): Promise<unknown | null> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    return nsData?.get(key) ?? null;
  }

  async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
    const nsKey = this.getNamespaceKey(namespace);
    if (!this.data.has(nsKey)) {
      this.data.set(nsKey, new Map());
    }
    this.data.get(nsKey)!.set(key, value);
  }

  async delete(namespace: readonly string[], key: string): Promise<void> {
    const nsKey = this.getNamespaceKey(namespace);
    this.data.get(nsKey)?.delete(key);
  }

  async search(
    namespace: readonly string[],
    _query: string,
    options?: { limit?: number }
  ): Promise<Array<{ key: string; value: unknown; score?: number }>> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    if (!nsData) return [];

    const results: Array<{ key: string; value: unknown; score?: number }> = [];
    for (const [key, value] of nsData.entries()) {
      results.push({ key, value, score: 1 });
      if (options?.limit && results.length >= options.limit) break;
    }
    return results;
  }

  async list(
    namespace: readonly string[],
    options?: { prefix?: string; limit?: number; offset?: number }
  ): Promise<Array<{ key: string; value: unknown }>> {
    const nsKey = this.getNamespaceKey(namespace);
    const nsData = this.data.get(nsKey);
    if (!nsData) return [];

    let results: Array<{ key: string; value: unknown }> = [];
    for (const [key, value] of nsData.entries()) {
      if (options?.prefix && !key.startsWith(options.prefix)) continue;
      results.push({ key, value });
    }

    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  // Helper to get all data (for testing)
  getAllData(): Map<string, Map<string, unknown>> {
    return this.data;
  }
}

describe('Agent Loop Integration', () => {
  let store: InMemoryStore;
  const userId = 'test-user-123';

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('Full Agent Flow', () => {
    it('should complete IAB -> Trigger -> Mission Card flow', async () => {
      // Step 1: Simulate IAB Classification stored in memory
      const iabClassification = {
        id: 'iab-1',
        tier1: 'Shopping',
        tier2: 'Consumer Electronics',
        confidence: 0.85,
        sourceId: 'email-123',
        timestamp: Date.now(),
      };

      // Store classification (simulating what IAB classifier would do)
      await store.put(
        NS.iabClassifications(userId),
        iabClassification.id,
        iabClassification
      );

      // Step 2: Evaluate trigger
      const triggerResult = evaluateTrigger({
        tier1: iabClassification.tier1,
        tier2: iabClassification.tier2,
        confidence: iabClassification.confidence,
      });

      expect(triggerResult.shouldTrigger).toBe(true);
      expect(triggerResult.confidence).toBe(0.85);
      expect(triggerResult.productKeywords.length).toBeGreaterThan(0);

      // Step 3: Run Shopping Agent
      const agent = new ShoppingAgent();
      const triggerData: ShoppingTriggerData = {
        classification: {
          tier1: iabClassification.tier1,
          tier2: iabClassification.tier2,
          confidence: iabClassification.confidence,
          sourceId: iabClassification.sourceId,
        },
        productKeywords: triggerResult.productKeywords,
      };

      const result = await agent.run({
        userId,
        store,
        tools: [],
        triggerData,
      });

      // Step 4: Verify results
      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      expect(result.missionCard?.type).toBe('shopping');
      expect(result.missionCard?.status).toBe('CREATED');

      // Step 5: Verify mission card was stored
      const storedMission = await store.get(
        NS.missionCards(userId),
        result.missionCard!.id
      ) as MissionCard;

      expect(storedMission).toBeDefined();
      expect(storedMission.id).toBe(result.missionCard!.id);
      expect(storedMission.title).toContain('Shopping');

      // Step 6: Verify resource usage tracking
      expect(result.usage.toolCalls).toBeGreaterThan(0);
      expect(result.usage.memoryWrites).toBeGreaterThan(0);
    });

    it('should NOT trigger for low-confidence classification', async () => {
      const triggerResult = evaluateTrigger({
        tier1: 'Shopping',
        confidence: 0.5, // Below 0.7 threshold
      });

      expect(triggerResult.shouldTrigger).toBe(false);
      expect(triggerResult.reason).toContain('below threshold');
    });

    it('should NOT trigger for non-shopping category', async () => {
      const triggerResult = evaluateTrigger({
        tier1: 'News & Politics',
        confidence: 0.95,
      });

      expect(triggerResult.shouldTrigger).toBe(false);
      expect(triggerResult.reason).toContain('does not indicate purchase intent');
    });
  });

  describe('LimitsEnforcer Integration', () => {
    it('should enforce L2 limits across multiple operations', () => {
      const enforcer = new LimitsEnforcer('L2');

      // L2 allows 10 tool calls
      for (let i = 0; i < 10; i++) {
        enforcer.recordToolCall();
      }

      // 11th should fail
      expect(() => enforcer.recordToolCall()).toThrow();

      const usage = enforcer.getUsage();
      expect(usage.toolCalls).toBe(10);
    });

    it('should track cost across LLM calls', () => {
      const enforcer = new LimitsEnforcer('L2');

      enforcer.recordLlmCall(0.001);
      enforcer.recordLlmCall(0.002);
      enforcer.recordLlmCall(0.003);

      const usage = enforcer.getUsage();
      expect(usage.llmCalls).toBe(3);
      expect(usage.totalCostUsd).toBeCloseTo(0.006);
    });
  });

  describe('PrivacyGuard Integration', () => {
    it('should enforce shopping agent permissions', () => {
      const guard = new PrivacyGuard(SHOPPING_PERMISSIONS);

      // Shopping agent CAN read these
      expect(guard.canRead(NAMESPACES.SEMANTIC_MEMORY)).toBe(true);
      expect(guard.canRead(NAMESPACES.IAB_CLASSIFICATIONS)).toBe(true);
      expect(guard.canRead(NAMESPACES.MISSION_CARDS)).toBe(true);

      // Shopping agent CANNOT read these
      expect(guard.canRead(NAMESPACES.PSEUDONYMS)).toBe(false);
      expect(guard.canRead(NAMESPACES.DISCLOSURE_HISTORY)).toBe(false);

      // Shopping agent CAN write to missions
      expect(guard.canWrite(NAMESPACES.MISSION_CARDS)).toBe(true);
      expect(guard.canWrite(NAMESPACES.EPISODIC_MEMORY)).toBe(true);

      // Shopping agent CANNOT write to semantic memory
      expect(guard.canWrite(NAMESPACES.SEMANTIC_MEMORY)).toBe(false);
    });

    it('should log access attempts', () => {
      const guard = new PrivacyGuard(SHOPPING_PERMISSIONS);

      guard.assertRead(NAMESPACES.SEMANTIC_MEMORY);
      guard.assertWrite(NAMESPACES.MISSION_CARDS);

      const log = guard.getAccessLog();
      expect(log.length).toBe(2);
      expect(log[0].operation).toBe('read');
      expect(log[0].allowed).toBe(true);
      expect(log[1].operation).toBe('write');
      expect(log[1].allowed).toBe(true);
    });
  });

  describe('Multiple Agent Runs', () => {
    it('should handle sequential agent runs independently', async () => {
      const agent = new ShoppingAgent();

      // First run
      const result1 = await agent.run({
        userId,
        store,
        tools: [],
        triggerData: {
          classification: { tier1: 'Shopping', confidence: 0.85 },
          productKeywords: ['laptop'],
        },
      });

      expect(result1.success).toBe(true);

      // Second run with different trigger
      const result2 = await agent.run({
        userId,
        store,
        tools: [],
        triggerData: {
          classification: { tier1: 'Technology & Computing', confidence: 0.9 },
          productKeywords: ['headphones'],
        },
      });

      expect(result2.success).toBe(true);

      // Both should have generated mission cards
      expect(result1.missionCard?.id).not.toBe(result2.missionCard?.id);

      // Both should be in store
      const missions = await store.list(NS.missionCards(userId));
      expect(missions.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing trigger data gracefully', async () => {
      const agent = new ShoppingAgent();

      const result = await agent.run({
        userId,
        store,
        tools: [],
        // No triggerData
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid trigger data');
    });

    it('should handle invalid trigger data gracefully', async () => {
      const agent = new ShoppingAgent();

      const result = await agent.run({
        userId,
        store,
        tools: [],
        triggerData: { invalid: 'data' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid trigger data');
    });
  });
});
