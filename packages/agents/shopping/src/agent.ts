/**
 * Shopping Agent - v13 Section 3.6
 *
 * Detects purchase intent and generates shopping-related mission cards.
 */

import { BaseAgent, type AgentContext, type AgentResult } from '@ownyou/agents-base';
import type { MissionCard } from '@ownyou/shared-types';
import { NAMESPACES, NS } from '@ownyou/shared-types';
import { SHOPPING_PERMISSIONS, type ShoppingTriggerData, type DealResult } from './types';
import { evaluateTrigger, evaluateTriggerHybrid, type TriggerResult } from './triggers';
import { createSearchDealsTool, createPriceCheckTool } from './tools';

/**
 * ShoppingAgent - L2 agent for purchase intent detection and deal finding
 *
 * @example
 * ```typescript
 * const agent = new ShoppingAgent();
 * const result = await agent.run({
 *   userId: 'user_123',
 *   store: memoryStore,
 *   tools: [],
 *   triggerData: {
 *     classification: { tier1: 'Shopping', confidence: 0.85 },
 *   },
 * });
 * ```
 */
export class ShoppingAgent extends BaseAgent {
  readonly agentType = 'shopping' as const;
  readonly level = 'L2' as const;

  constructor() {
    super(SHOPPING_PERMISSIONS);
  }

  /**
   * Execute the shopping agent logic
   */
  protected async execute(context: AgentContext): Promise<AgentResult> {
    const { userId, store, triggerData, llm } = context;

    // Validate trigger data
    if (!triggerData || !this.isShoppingTrigger(triggerData)) {
      return {
        success: false,
        error: 'Missing or invalid trigger data - expected ShoppingTriggerData',
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }

    const shoppingTrigger = triggerData as ShoppingTriggerData;

    // Evaluate trigger using hybrid LLM/rule-based approach
    // LLM is used when available and content is present
    const triggerResult = await evaluateTriggerHybrid(
      shoppingTrigger.classification,
      shoppingTrigger.originalContent,
      llm,
      userId
    );

    // Track LLM call if it was used
    if (llm && shoppingTrigger.originalContent) {
      // The LLM call is tracked inside the LLMClient, but we record it here too
      // for agent-level usage tracking
      this.recordLlmCall(
        'shopping_intent_detection',
        { content: shoppingTrigger.originalContent.slice(0, 100) + '...' },
        triggerResult.reason,
        { input: 500, output: 100 }, // Estimated tokens
        0.001, // Estimated cost for fast tier
        100 // Estimated duration
      );
    }

    if (!triggerResult.shouldTrigger) {
      return {
        success: true,
        response: `Not triggered: ${triggerResult.reason}`,
        usage: this.limitsEnforcer.getUsage(),
        toolCalls: [],
        llmCalls: [],
        memoryOps: [],
      };
    }

    // Search for deals
    const keywords = shoppingTrigger.productKeywords || triggerResult.productKeywords;
    const deals = await this.searchDeals(keywords, shoppingTrigger.priceRange?.max);

    // Check prices for top deals
    const priceChecks = await this.checkPrices(deals.slice(0, 3));

    // Generate mission card
    const missionCard = this.generateMissionCard(
      userId,
      triggerResult,
      deals,
      priceChecks
    );

    // Store mission card
    await this.storeMissionCard(store, userId, missionCard);

    return {
      success: true,
      missionCard,
      response: `Found ${deals.length} deals for "${keywords.join(', ')}"`,
      usage: this.limitsEnforcer.getUsage(),
      toolCalls: [],
      llmCalls: [],
      memoryOps: [],
    };
  }

  /**
   * Type guard for ShoppingTriggerData
   */
  private isShoppingTrigger(data: unknown): data is ShoppingTriggerData {
    if (typeof data !== 'object' || data === null) return false;
    const trigger = data as Record<string, unknown>;
    if (typeof trigger.classification !== 'object' || trigger.classification === null) return false;
    const classification = trigger.classification as Record<string, unknown>;
    return (
      typeof classification.tier1 === 'string' &&
      typeof classification.confidence === 'number'
    );
  }

  /**
   * Search for deals using the search_deals tool
   */
  private async searchDeals(keywords: string[], maxPrice?: number): Promise<DealResult[]> {
    const tool = createSearchDealsTool();

    const startTime = Date.now();
    const result = await tool.execute({ keywords, maxPrice });
    const durationMs = Date.now() - startTime;

    this.recordToolCall('search_deals', { keywords, maxPrice }, result, durationMs);

    return result.deals;
  }

  /**
   * Check prices for deals
   */
  private async checkPrices(deals: DealResult[]): Promise<Map<string, string>> {
    const tool = createPriceCheckTool();
    const priceChecks = new Map<string, string>();

    for (const deal of deals) {
      const startTime = Date.now();
      const result = await tool.execute({ productName: deal.productName });
      const durationMs = Date.now() - startTime;

      this.recordToolCall('check_price', { productName: deal.productName }, result, durationMs);
      priceChecks.set(deal.id, result.recommendation);
    }

    return priceChecks;
  }

  /**
   * Generate a mission card from trigger and deals
   */
  private generateMissionCard(
    _userId: string,
    triggerResult: TriggerResult,
    deals: DealResult[],
    priceChecks: Map<string, string>
  ): MissionCard {
    const now = Date.now();
    const missionId = `mission_shopping_${now}_${Math.random().toString(36).slice(2, 8)}`;

    // Find best deal (highest discount with buy_now recommendation)
    const bestDeal = deals.find(
      (d) => priceChecks.get(d.id) === 'buy_now'
    ) || deals[0];

    const title = bestDeal
      ? `Deal Alert: ${bestDeal.discountPercent}% off ${bestDeal.productName}`
      : `Shopping Opportunity: ${triggerResult.productKeywords.join(', ')}`;

    const summary = bestDeal
      ? `Save $${(bestDeal.originalPrice - bestDeal.dealPrice).toFixed(0)} on ${bestDeal.productName} at ${bestDeal.retailer}. ${deals.length} deals found.`
      : `We found ${deals.length} deals matching your interests.`;

    return {
      id: missionId,
      type: 'shopping',
      title,
      summary,
      urgency: triggerResult.urgency,
      status: 'CREATED',
      createdAt: now,
      expiresAt: bestDeal?.expiresAt,
      ikigaiDimensions: ['productivity', 'savings'],
      ikigaiAlignmentBoost: triggerResult.confidence * 0.5,
      primaryAction: {
        label: 'View Deals',
        type: 'navigate',
        payload: {
          route: '/deals',
          dealIds: deals.map((d) => d.id),
        },
      },
      secondaryActions: [
        {
          label: 'Dismiss',
          type: 'confirm',
          payload: { action: 'dismiss' },
        },
        {
          label: 'Snooze 1 day',
          type: 'confirm',
          payload: { action: 'snooze', duration: 24 * 60 * 60 * 1000 },
        },
      ],
      agentThreadId: `thread_${missionId}`,
      evidenceRefs: [],
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
}
