/**
 * Intent Classifier - v13 Section 3.5
 *
 * Classifies user natural language requests into intents.
 */

import type { IntentClassification } from '../types';

/**
 * Intent patterns with keywords
 */
const INTENT_PATTERNS: Record<string, string[]> = {
  shopping: [
    'buy', 'purchase', 'shop', 'deal', 'price', 'discount', 'sale',
    'compare', 'cheaper', 'expensive', 'cost', 'amazon', 'order',
  ],
  content: [
    'read', 'article', 'news', 'blog', 'recommend', 'watch', 'video',
    'listen', 'podcast', 'learn', 'tutorial', 'guide', 'how to',
  ],
  travel: [
    'travel', 'flight', 'hotel', 'vacation', 'trip', 'book', 'booking',
    'destination', 'visit', 'tour', 'airline', 'airport',
  ],
  restaurant: [
    'restaurant', 'food', 'eat', 'dinner', 'lunch', 'breakfast',
    'reservation', 'dining', 'cuisine', 'menu', 'delivery',
  ],
};

/**
 * Entity extraction patterns
 */
const ENTITY_PATTERNS: Record<string, RegExp[]> = {
  price: [
    /\$\d+(?:\.\d{2})?/,
    /under \$?\d+/i,
    /less than \$?\d+/i,
    /around \$?\d+/i,
  ],
  date: [
    /\b(today|tomorrow|yesterday)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
  ],
  time: [
    /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i,
    /\b(morning|afternoon|evening|night)\b/i,
  ],
  location: [
    /\b(near|in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
  ],
  quantity: [
    /\b(\d+)\s+(?:items?|pieces?|units?)/i,
  ],
};

/**
 * Classify user request into intent
 *
 * @param request - Natural language request
 * @returns Intent classification with entities
 *
 * @example
 * ```typescript
 * const result = classifyIntent("Find me a good deal on headphones under $100");
 * // { intent: 'shopping', entities: { price: 'under $100' }, confidence: 0.85 }
 * ```
 */
export function classifyIntent(request: string): IntentClassification {
  const lowerRequest = request.toLowerCase();
  const scores: Record<string, number> = {};

  // Score each intent based on keyword matches
  for (const [intent, keywords] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerRequest.includes(keyword)) {
        score += 1;
        // Bonus for exact word match
        if (new RegExp(`\\b${keyword}\\b`, 'i').test(request)) {
          score += 0.5;
        }
      }
    }
    if (score > 0) {
      scores[intent] = score;
    }
  }

  // Find winning intent
  let bestIntent = 'shopping'; // Default
  let bestScore = 0;
  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestIntent = intent;
      bestScore = score;
    }
  }

  // Calculate confidence (normalized)
  const maxPossibleScore = INTENT_PATTERNS[bestIntent]?.length ?? 1;
  const confidence = Math.min(0.95, 0.4 + (bestScore / maxPossibleScore) * 0.55);

  // Extract entities
  const entities = extractEntities(request);

  return {
    intent: bestIntent,
    entities,
    confidence,
  };
}

/**
 * Extract entities from request
 */
function extractEntities(request: string): Record<string, string> {
  const entities: Record<string, string> = {};

  for (const [entityType, patterns] of Object.entries(ENTITY_PATTERNS)) {
    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match) {
        entities[entityType] = match[0];
        break;
      }
    }
  }

  return entities;
}

/**
 * Get intent from keywords (faster, no NLU)
 */
export function getIntentFromKeywords(text: string): string | undefined {
  const lowerText = text.toLowerCase();

  for (const [intent, keywords] of Object.entries(INTENT_PATTERNS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return intent;
      }
    }
  }

  return undefined;
}

/**
 * Check if request likely matches an intent
 */
export function matchesIntent(request: string, intent: string): boolean {
  const keywords = INTENT_PATTERNS[intent];
  if (!keywords) return false;

  const lowerRequest = request.toLowerCase();
  return keywords.some(keyword => lowerRequest.includes(keyword));
}
