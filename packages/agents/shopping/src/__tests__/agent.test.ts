/**
 * Shopping Agent Tests - v13 Section 3.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShoppingAgent } from '../agent';
import type { AgentContext, AgentStore } from '@ownyou/agents-base';
import type { ShoppingTriggerData, PurchaseIntent } from '../types';
import {
  detectPurchaseIntentWithLLM,
  purchaseIntentToTriggerResult,
  evaluateTriggerHybrid,
} from '../triggers';
import type { LLMClient, LLMResponse } from '@ownyou/llm-client';

// Mock store
const createMockStore = (): AgentStore => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue([]),
  list: vi.fn().mockResolvedValue([]),
});

// Mock LLM client factory
const createMockLLMClient = (response: string): LLMClient => ({
  complete: vi.fn().mockResolvedValue({
    content: response,
    model: 'mock-model',
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      costUsd: 0.001,
    },
  } as LLMResponse),
  completeWithFallback: vi.fn().mockResolvedValue({
    content: response,
    model: 'mock-model',
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      costUsd: 0.001,
    },
  }),
  getUsage: vi.fn().mockResolvedValue({
    totalCostUsd: 0.001,
    monthlyBudgetUsd: 10,
    budgetPercent: 0.01,
  }),
  setUsageForTesting: vi.fn(),
  resetUsage: vi.fn(),
  getCache: vi.fn().mockReturnValue(null),
  getProviders: vi.fn().mockReturnValue(new Map()),
  registerProvider: vi.fn(),
} as unknown as LLMClient);

describe('ShoppingAgent', () => {
  let agent: ShoppingAgent;
  let mockStore: AgentStore;
  let context: AgentContext;

  beforeEach(() => {
    agent = new ShoppingAgent();
    mockStore = createMockStore();
    context = {
      userId: 'test-user',
      store: mockStore,
      tools: [],
    };
  });

  describe('agent properties', () => {
    it('should be a shopping agent', () => {
      expect(agent.agentType).toBe('shopping');
    });

    it('should be L2 level', () => {
      expect(agent.level).toBe('L2');
    });
  });

  describe('trigger validation', () => {
    it('should fail without trigger data', async () => {
      const result = await agent.run(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid trigger data');
    });

    it('should fail with invalid trigger data', async () => {
      context.triggerData = { invalid: 'data' };

      const result = await agent.run(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing or invalid trigger data');
    });
  });

  describe('trigger evaluation', () => {
    it('should not trigger for low confidence', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Shopping',
          confidence: 0.5, // Below threshold
        },
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Not triggered');
      expect(result.missionCard).toBeUndefined();
    });

    it('should not trigger for non-shopping categories', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'News & Politics',
          confidence: 0.9,
        },
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Not triggered');
    });
  });

  describe('shopping flow', () => {
    it('should generate mission card for shopping trigger', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Shopping',
          tier2: 'Consumer Electronics',
          confidence: 0.85,
        },
        productKeywords: ['laptop', 'macbook'],
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.missionCard).toBeDefined();
      expect(result.missionCard?.type).toBe('shopping');
      expect(result.missionCard?.status).toBe('CREATED');
    });

    it('should store mission card', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Shopping',
          confidence: 0.85,
        },
        productKeywords: ['headphones'],
      };
      context.triggerData = trigger;

      await agent.run(context);

      expect(mockStore.put).toHaveBeenCalled();
    });

    it('should include deals in response', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Technology & Computing',
          confidence: 0.9,
        },
        productKeywords: ['laptop'],
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.response).toContain('deals');
    });
  });

  describe('mission card generation', () => {
    it('should set correct urgency based on category', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Technology & Computing',
          tier2: 'Consumer Electronics',
          confidence: 0.9,
        },
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.missionCard?.urgency).toBe('medium');
    });

    it('should include primary action', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Shopping',
          confidence: 0.85,
        },
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.missionCard?.primaryAction).toBeDefined();
      expect(result.missionCard?.primaryAction.label).toBe('View Deals');
      expect(result.missionCard?.primaryAction.type).toBe('navigate');
    });

    it('should include secondary actions', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Shopping',
          confidence: 0.85,
        },
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.missionCard?.secondaryActions).toBeDefined();
      expect(result.missionCard?.secondaryActions?.length).toBeGreaterThan(0);
    });
  });

  describe('resource tracking', () => {
    it('should track tool calls', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Shopping',
          confidence: 0.85,
        },
        productKeywords: ['laptop'],
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      // Should have at least 1 search_deals call
      expect(result.usage.toolCalls).toBeGreaterThanOrEqual(1);
    });

    it('should track memory operations', async () => {
      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Shopping',
          confidence: 0.85,
        },
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      // Should have at least 1 write for mission card
      expect(result.usage.memoryWrites).toBeGreaterThanOrEqual(1);
    });
  });

  describe('LLM-based intent detection', () => {
    it('should use LLM when available and content provided', async () => {
      const llmResponse = JSON.stringify({
        hasPurchaseIntent: true,
        confidence: 0.92,
        productCategory: 'Electronics',
        products: ['MacBook Pro', 'laptop'],
        priceSensitivity: 'medium',
        urgencyIndicators: [],
        reasoning: 'User is comparing laptop prices and specifications',
      });

      const mockLLM = createMockLLMClient(llmResponse);
      context.llm = mockLLM;

      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Technology & Computing',
          confidence: 0.7,
        },
        originalContent: 'Looking for the best MacBook Pro deals this week',
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(mockLLM.complete).toHaveBeenCalled();
      expect(result.missionCard).toBeDefined();
    });

    it('should fall back to rules when LLM fails', async () => {
      const mockLLM = {
        ...createMockLLMClient(''),
        complete: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
      } as unknown as LLMClient;
      context.llm = mockLLM;

      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Shopping',
          confidence: 0.85,
        },
        originalContent: 'Looking for deals on headphones',
      };
      context.triggerData = trigger;

      // Should not throw, should fall back to rule-based
      const result = await agent.run(context);

      expect(result.success).toBe(true);
      // Rule-based trigger should work
      expect(result.missionCard).toBeDefined();
    });

    it('should track LLM calls when LLM is used', async () => {
      const llmResponse = JSON.stringify({
        hasPurchaseIntent: true,
        confidence: 0.85,
        products: ['camera'],
        reasoning: 'Shopping intent detected',
      });

      const mockLLM = createMockLLMClient(llmResponse);
      context.llm = mockLLM;

      const trigger: ShoppingTriggerData = {
        classification: {
          tier1: 'Consumer Electronics',
          confidence: 0.8,
        },
        originalContent: 'What camera should I buy for travel photography?',
      };
      context.triggerData = trigger;

      const result = await agent.run(context);

      expect(result.success).toBe(true);
      expect(result.usage.llmCalls).toBeGreaterThanOrEqual(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Trigger Function Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('LLM Intent Detection Functions', () => {
  describe('detectPurchaseIntentWithLLM', () => {
    it('should parse valid JSON response', async () => {
      const llmResponse = JSON.stringify({
        hasPurchaseIntent: true,
        confidence: 0.9,
        productCategory: 'Electronics',
        products: ['iPhone', 'AirPods'],
        priceSensitivity: 'high',
        urgencyIndicators: ['limited time offer'],
        reasoning: 'User is comparing iPhone models',
      });

      const mockLLM = createMockLLMClient(llmResponse);

      const result = await detectPurchaseIntentWithLLM(
        mockLLM,
        'test-user',
        'Comparing iPhone 15 vs iPhone 14, which is better value?'
      );

      expect(result.hasPurchaseIntent).toBe(true);
      expect(result.confidence).toBe(0.9);
      expect(result.products).toContain('iPhone');
      expect(result.products).toContain('AirPods');
      expect(result.priceSensitivity).toBe('high');
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockLLM = createMockLLMClient('This is not valid JSON');

      const result = await detectPurchaseIntentWithLLM(
        mockLLM,
        'test-user',
        'Some content'
      );

      expect(result.hasPurchaseIntent).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Failed to parse');
    });

    it('should validate required fields', async () => {
      // Missing hasPurchaseIntent
      const llmResponse = JSON.stringify({
        confidence: 0.8,
        products: [],
        reasoning: 'test',
      });

      const mockLLM = createMockLLMClient(llmResponse);

      const result = await detectPurchaseIntentWithLLM(
        mockLLM,
        'test-user',
        'Some content'
      );

      expect(result.hasPurchaseIntent).toBe(false);
      expect(result.reasoning).toContain('Invalid response');
    });
  });

  describe('purchaseIntentToTriggerResult', () => {
    it('should convert high confidence intent to trigger', () => {
      const intent: PurchaseIntent = {
        hasPurchaseIntent: true,
        confidence: 0.85,
        products: ['laptop', 'keyboard'],
        reasoning: 'User wants to buy a laptop',
      };

      const result = purchaseIntentToTriggerResult(intent);

      expect(result.shouldTrigger).toBe(true);
      expect(result.confidence).toBe(0.85);
      expect(result.productKeywords).toContain('laptop');
      expect(result.productKeywords).toContain('keyboard');
    });

    it('should not trigger for low confidence', () => {
      const intent: PurchaseIntent = {
        hasPurchaseIntent: true,
        confidence: 0.5, // Below threshold
        products: ['laptop'],
        reasoning: 'Maybe interested',
      };

      const result = purchaseIntentToTriggerResult(intent);

      expect(result.shouldTrigger).toBe(false);
    });

    it('should not trigger when no purchase intent', () => {
      const intent: PurchaseIntent = {
        hasPurchaseIntent: false,
        confidence: 0.9,
        products: [],
        reasoning: 'Just reading news',
      };

      const result = purchaseIntentToTriggerResult(intent);

      expect(result.shouldTrigger).toBe(false);
    });

    it('should set high urgency for urgency indicators', () => {
      const intent: PurchaseIntent = {
        hasPurchaseIntent: true,
        confidence: 0.9,
        products: ['TV'],
        urgencyIndicators: ['sale ending soon', 'limited stock'],
        reasoning: 'Time-sensitive deal',
      };

      const result = purchaseIntentToTriggerResult(intent);

      expect(result.urgency).toBe('high');
    });

    it('should set medium urgency for high price sensitivity', () => {
      const intent: PurchaseIntent = {
        hasPurchaseIntent: true,
        confidence: 0.8,
        products: ['headphones'],
        priceSensitivity: 'high',
        reasoning: 'Looking for deals',
      };

      const result = purchaseIntentToTriggerResult(intent);

      expect(result.urgency).toBe('medium');
    });
  });

  describe('evaluateTriggerHybrid', () => {
    it('should use LLM when available with content', async () => {
      const llmResponse = JSON.stringify({
        hasPurchaseIntent: true,
        confidence: 0.88,
        products: ['tablet'],
        reasoning: 'Wants to buy tablet',
      });

      const mockLLM = createMockLLMClient(llmResponse);

      const result = await evaluateTriggerHybrid(
        { tier1: 'News', confidence: 0.6 },
        'Which tablet is best for reading?',
        mockLLM,
        'test-user'
      );

      // Should trigger based on LLM result, not rule-based
      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toContain('LLM detected');
    });

    it('should fall back to rules when no content', async () => {
      const mockLLM = createMockLLMClient('{}');

      const result = await evaluateTriggerHybrid(
        { tier1: 'Shopping', confidence: 0.85 },
        undefined, // No content
        mockLLM,
        'test-user'
      );

      // Should use rule-based
      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).not.toContain('LLM');
    });

    it('should fall back to rules when no LLM', async () => {
      const result = await evaluateTriggerHybrid(
        { tier1: 'Shopping', confidence: 0.85 },
        'Looking for deals',
        undefined, // No LLM
        'test-user'
      );

      // Should use rule-based
      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).not.toContain('LLM');
    });

    it('should fall back to rules when content too short', async () => {
      const mockLLM = createMockLLMClient('{}');

      const result = await evaluateTriggerHybrid(
        { tier1: 'Shopping', confidence: 0.85 },
        'Hi', // Too short
        mockLLM,
        'test-user'
      );

      // Should use rule-based (content < 10 chars)
      expect(result.shouldTrigger).toBe(true);
      expect(mockLLM.complete).not.toHaveBeenCalled();
    });
  });
});
