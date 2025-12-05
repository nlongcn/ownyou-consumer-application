/**
 * Intent Classifier - v13 Section 3.5
 *
 * Classifies user natural language requests into intents.
 * Patterns are configurable via IntentClassifierConfig.
 */

import type { IntentClassification } from '../types';

/**
 * Configuration for intent classifier
 */
export interface IntentClassifierConfig {
  /** Intent patterns: intent name -> keywords */
  intentPatterns?: Record<string, string[]>;
  /** Entity patterns: entity type -> regex patterns */
  entityPatterns?: Record<string, RegExp[]>;
  /** Default intent when no match found */
  defaultIntent?: string;
}

/**
 * Default intent patterns with keywords
 */
export const DEFAULT_INTENT_PATTERNS: Record<string, string[]> = {
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
 * Default entity extraction patterns
 */
export const DEFAULT_ENTITY_PATTERNS: Record<string, RegExp[]> = {
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
 * IntentClassifier - Configurable intent classification
 *
 * @example
 * ```typescript
 * // Use defaults
 * const classifier = new IntentClassifier();
 *
 * // Custom patterns
 * const classifier = new IntentClassifier({
 *   intentPatterns: {
 *     ...DEFAULT_INTENT_PATTERNS,
 *     fitness: ['workout', 'exercise', 'gym', 'health'],
 *   },
 * });
 *
 * // Runtime updates
 * classifier.registerIntent('events', ['concert', 'show', 'ticket']);
 * ```
 */
export class IntentClassifier {
  private intentPatterns: Record<string, string[]>;
  private entityPatterns: Record<string, RegExp[]>;
  private defaultIntent: string;

  constructor(config: IntentClassifierConfig = {}) {
    this.intentPatterns = { ...DEFAULT_INTENT_PATTERNS, ...config.intentPatterns };
    this.entityPatterns = { ...DEFAULT_ENTITY_PATTERNS, ...config.entityPatterns };
    this.defaultIntent = config.defaultIntent ?? 'shopping';
  }

  /**
   * Register a new intent with keywords (runtime update)
   */
  registerIntent(intent: string, keywords: string[]): void {
    this.intentPatterns[intent] = keywords;
  }

  /**
   * Add keywords to an existing intent
   */
  addKeywords(intent: string, keywords: string[]): void {
    const existing = this.intentPatterns[intent] ?? [];
    this.intentPatterns[intent] = [...existing, ...keywords];
  }

  /**
   * Register a new entity pattern (runtime update)
   */
  registerEntityPattern(entityType: string, patterns: RegExp[]): void {
    this.entityPatterns[entityType] = patterns;
  }

  /**
   * Get all registered intents
   */
  getIntents(): string[] {
    return Object.keys(this.intentPatterns);
  }

  /**
   * Get keywords for an intent
   */
  getKeywords(intent: string): string[] | undefined {
    return this.intentPatterns[intent];
  }

  /**
   * Classify user request into intent
   */
  classify(request: string): IntentClassification {
    const lowerRequest = request.toLowerCase();
    const scores: Record<string, number> = {};

    // Score each intent based on keyword matches
    for (const [intent, keywords] of Object.entries(this.intentPatterns)) {
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
    let bestIntent = this.defaultIntent;
    let bestScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestIntent = intent;
        bestScore = score;
      }
    }

    // Calculate confidence (normalized)
    const maxPossibleScore = this.intentPatterns[bestIntent]?.length ?? 1;
    const confidence = Math.min(0.95, 0.4 + (bestScore / maxPossibleScore) * 0.55);

    // Extract entities
    const entities = this.extractEntities(request);

    return {
      intent: bestIntent,
      entities,
      confidence,
    };
  }

  /**
   * Extract entities from request
   */
  private extractEntities(request: string): Record<string, string> {
    const entities: Record<string, string> = {};

    for (const [entityType, patterns] of Object.entries(this.entityPatterns)) {
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
   * Get intent from keywords (faster, no scoring)
   */
  getIntentFromKeywords(text: string): string | undefined {
    const lowerText = text.toLowerCase();

    for (const [intent, keywords] of Object.entries(this.intentPatterns)) {
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
  matchesIntent(request: string, intent: string): boolean {
    const keywords = this.intentPatterns[intent];
    if (!keywords) return false;

    const lowerRequest = request.toLowerCase();
    return keywords.some(keyword => lowerRequest.includes(keyword));
  }
}

// Default singleton instance for backward compatibility
const defaultClassifier = new IntentClassifier();

/**
 * Classify user request into intent (uses default classifier)
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
  return defaultClassifier.classify(request);
}

/**
 * Get intent from keywords (faster, no scoring) - uses default classifier
 */
export function getIntentFromKeywords(text: string): string | undefined {
  return defaultClassifier.getIntentFromKeywords(text);
}

/**
 * Check if request likely matches an intent - uses default classifier
 */
export function matchesIntent(request: string, intent: string): boolean {
  return defaultClassifier.matchesIntent(request, intent);
}

/**
 * Get the default classifier instance (for runtime updates)
 */
export function getDefaultClassifier(): IntentClassifier {
  return defaultClassifier;
}
