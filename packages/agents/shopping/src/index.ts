/**
 * @ownyou/agents-shopping - v13 Section 3.6
 *
 * Shopping agent for purchase intent detection and deal finding.
 *
 * @example
 * ```typescript
 * import { ShoppingAgent, SHOPPING_PERMISSIONS } from '@ownyou/agents-shopping';
 *
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

// Agent
export { ShoppingAgent } from './agent';

// Types
export type {
  IABTrigger,
  ShoppingTriggerData,
  DealResult,
  PriceCheckResult,
  PurchaseIntent,
} from './types';

export {
  SHOPPING_PERMISSIONS,
  PURCHASE_INTENT_CATEGORIES,
  PURCHASE_INTENT_THRESHOLD,
} from './types';

// Triggers
export {
  evaluateTrigger,
  evaluateTriggers,
  findBestTrigger,
  evaluateTriggerHybrid,
  detectPurchaseIntentWithLLM,
  purchaseIntentToTriggerResult,
  type TriggerResult,
} from './triggers';

// Tools
export {
  createSearchDealsTool,
  createPriceCheckTool,
  type SearchDealsInput,
  type SearchDealsOutput,
  type PriceCheckInput,
} from './tools';
