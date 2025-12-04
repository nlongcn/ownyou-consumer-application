/**
 * Shopping Agent Triggers - v13 Section 3.6
 *
 * Detects purchase intent from IAB classifications.
 * Supports both rule-based and LLM-based detection.
 */

import type { LLMClient } from '@ownyou/llm-client';
import type { IABTrigger, PurchaseIntent } from './types';
import { PURCHASE_INTENT_CATEGORIES, PURCHASE_INTENT_THRESHOLD } from './types';

/**
 * Result of trigger evaluation
 */
export interface TriggerResult {
  /** Whether agent should be triggered */
  shouldTrigger: boolean;

  /** Confidence score 0-1 */
  confidence: number;

  /** Reason for triggering (or not) */
  reason: string;

  /** Extracted product keywords (if any) */
  productKeywords: string[];

  /** Suggested urgency for mission card */
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Evaluate whether IAB classification indicates purchase intent
 */
export function evaluateTrigger(classification: IABTrigger): TriggerResult {
  const { tier1, tier2, confidence } = classification;

  // Check confidence threshold
  if (confidence < PURCHASE_INTENT_THRESHOLD) {
    return {
      shouldTrigger: false,
      confidence,
      reason: `Confidence ${confidence.toFixed(2)} below threshold ${PURCHASE_INTENT_THRESHOLD}`,
      productKeywords: [],
      urgency: 'low',
    };
  }

  // Check for primary shopping intent
  const categories = Object.values(PURCHASE_INTENT_CATEGORIES);
  const tier1Match = categories.some(
    (cat) => tier1.toLowerCase().includes(cat.toLowerCase())
  );
  const tier2Match = tier2
    ? categories.some((cat) => tier2.toLowerCase().includes(cat.toLowerCase()))
    : false;

  if (!tier1Match && !tier2Match) {
    return {
      shouldTrigger: false,
      confidence,
      reason: `Category "${tier1}" / "${tier2 || 'none'}" does not indicate purchase intent`,
      productKeywords: [],
      urgency: 'low',
    };
  }

  // Extract product keywords from category
  const keywords = extractKeywords(tier1, tier2);

  // Determine urgency based on category
  const urgency = determineUrgency(tier1, tier2);

  return {
    shouldTrigger: true,
    confidence,
    reason: `Purchase intent detected: ${tier1}${tier2 ? ' > ' + tier2 : ''}`,
    productKeywords: keywords,
    urgency,
  };
}

/**
 * Extract product keywords from IAB category
 */
function extractKeywords(tier1: string, tier2?: string): string[] {
  const keywords: string[] = [];

  // Map categories to keywords
  const categoryKeywords: Record<string, string[]> = {
    'consumer electronics': ['electronics', 'tech', 'gadgets'],
    'mobile phones': ['phone', 'smartphone', 'mobile'],
    'technology': ['tech', 'computer', 'laptop'],
    'shopping': ['deals', 'products'],
    'clothing': ['clothes', 'fashion', 'apparel'],
    'fashion': ['style', 'fashion', 'accessories'],
    'home': ['home', 'furniture', 'decor'],
    'appliances': ['appliance', 'kitchen', 'home'],
  };

  // Check tier1
  for (const [cat, kws] of Object.entries(categoryKeywords)) {
    if (tier1.toLowerCase().includes(cat)) {
      keywords.push(...kws);
    }
  }

  // Check tier2
  if (tier2) {
    for (const [cat, kws] of Object.entries(categoryKeywords)) {
      if (tier2.toLowerCase().includes(cat)) {
        keywords.push(...kws);
      }
    }
  }

  // Remove duplicates
  return [...new Set(keywords)];
}

/**
 * Determine urgency based on category
 */
function determineUrgency(tier1: string, tier2?: string): 'low' | 'medium' | 'high' {
  const tier1Lower = tier1.toLowerCase();
  const tier2Lower = tier2?.toLowerCase() || '';

  // High urgency: time-sensitive categories
  if (
    tier1Lower.includes('flash') ||
    tier1Lower.includes('limited') ||
    tier2Lower.includes('flash') ||
    tier2Lower.includes('limited')
  ) {
    return 'high';
  }

  // Medium urgency: electronics, fashion
  if (
    tier1Lower.includes('electronics') ||
    tier1Lower.includes('fashion') ||
    tier1Lower.includes('technology')
  ) {
    return 'medium';
  }

  // Low urgency: general shopping
  return 'low';
}

/**
 * Batch evaluate multiple classifications
 */
export function evaluateTriggers(classifications: IABTrigger[]): TriggerResult[] {
  return classifications.map(evaluateTrigger);
}

/**
 * Find the best trigger from multiple classifications
 */
export function findBestTrigger(classifications: IABTrigger[]): TriggerResult | null {
  const results = evaluateTriggers(classifications);
  const triggered = results.filter((r) => r.shouldTrigger);

  if (triggered.length === 0) {
    return null;
  }

  // Return highest confidence trigger
  return triggered.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM-Based Intent Detection (v13 Section 3.6.2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * System prompt for purchase intent detection
 */
const PURCHASE_INTENT_SYSTEM_PROMPT = `You are an AI assistant that analyzes text content to detect purchase intent.
Your task is to determine if the content indicates the user is interested in buying products or services.

Analyze the content for:
1. Direct mentions of products, brands, or shopping
2. Price comparisons or deal hunting
3. Research behavior indicating purchase consideration
4. Wish lists or saved items
5. Urgency indicators (limited time, sale ending, etc.)

Respond ONLY with a valid JSON object in this exact format:
{
  "hasPurchaseIntent": boolean,
  "confidence": number (0-1),
  "productCategory": string or null,
  "products": string[],
  "priceSensitivity": "low" | "medium" | "high" | null,
  "urgencyIndicators": string[],
  "reasoning": string
}`;

/**
 * Detect purchase intent using LLM analysis
 *
 * @param llm - LLM client configured with user's provider preferences
 * @param userId - User ID for budget tracking
 * @param content - Text content to analyze
 * @returns Purchase intent analysis
 */
export async function detectPurchaseIntentWithLLM(
  llm: LLMClient,
  userId: string,
  content: string
): Promise<PurchaseIntent> {
  const response = await llm.complete(userId, {
    messages: [
      { role: 'system', content: PURCHASE_INTENT_SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this content for purchase intent:\n\n${content}` },
    ],
    operation: 'shopping_intent_detection',
    temperature: 0.1, // Low temperature for consistent JSON output
  });

  try {
    // Parse the JSON response
    const parsed = JSON.parse(response.content) as PurchaseIntent;

    // Validate required fields
    if (typeof parsed.hasPurchaseIntent !== 'boolean') {
      throw new Error('Invalid response: hasPurchaseIntent must be boolean');
    }
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
      throw new Error('Invalid response: confidence must be number between 0 and 1');
    }
    if (!Array.isArray(parsed.products)) {
      parsed.products = [];
    }
    if (typeof parsed.reasoning !== 'string') {
      parsed.reasoning = 'No reasoning provided';
    }

    return parsed;
  } catch (error) {
    // Return a safe default on parse failure
    return {
      hasPurchaseIntent: false,
      confidence: 0,
      products: [],
      reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

/**
 * Convert LLM purchase intent to TriggerResult format
 *
 * @param intent - LLM-detected purchase intent
 * @returns TriggerResult compatible with rule-based flow
 */
export function purchaseIntentToTriggerResult(intent: PurchaseIntent): TriggerResult {
  // Determine urgency from indicators
  let urgency: 'low' | 'medium' | 'high' = 'low';
  if (intent.urgencyIndicators && intent.urgencyIndicators.length > 0) {
    urgency = 'high';
  } else if (intent.priceSensitivity === 'high') {
    urgency = 'medium';
  }

  return {
    shouldTrigger: intent.hasPurchaseIntent && intent.confidence >= PURCHASE_INTENT_THRESHOLD,
    confidence: intent.confidence,
    reason: intent.hasPurchaseIntent
      ? `LLM detected purchase intent: ${intent.reasoning.slice(0, 100)}`
      : `No purchase intent: ${intent.reasoning.slice(0, 100)}`,
    productKeywords: intent.products,
    urgency,
  };
}

/**
 * Hybrid evaluation: LLM-based with rule-based fallback
 *
 * Uses LLM when available for more nuanced detection,
 * falls back to rule-based for reliability.
 *
 * @param classification - IAB classification trigger
 * @param content - Original content (if available)
 * @param llm - Optional LLM client
 * @param userId - User ID for LLM budget tracking
 * @returns TriggerResult from either LLM or rule-based detection
 */
export async function evaluateTriggerHybrid(
  classification: IABTrigger,
  content: string | undefined,
  llm: LLMClient | undefined,
  userId: string
): Promise<TriggerResult> {
  // Try LLM-based detection if content and client are available
  if (llm && content && content.length > 10) {
    try {
      const intent = await detectPurchaseIntentWithLLM(llm, userId, content);
      return purchaseIntentToTriggerResult(intent);
    } catch (error) {
      // Log and fall through to rule-based
      console.warn('LLM intent detection failed, falling back to rules:', error);
    }
  }

  // Fall back to rule-based evaluation
  return evaluateTrigger(classification);
}
