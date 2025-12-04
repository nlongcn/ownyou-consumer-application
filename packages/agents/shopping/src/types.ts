/**
 * Shopping Agent Types - v13 Section 3.6
 *
 * Types for shopping agent execution and triggers.
 */

import type { AgentPermissions } from '@ownyou/shared-types';
import { NAMESPACES } from '@ownyou/shared-types';

/**
 * IAB Classification that triggered the agent
 */
export interface IABTrigger {
  /** IAB Tier 1 category */
  tier1: string;

  /** IAB Tier 2 category (optional) */
  tier2?: string;

  /** Classification confidence 0-1 */
  confidence: number;

  /** Source email/content ID */
  sourceId?: string;
}

/**
 * Shopping agent trigger data
 */
export interface ShoppingTriggerData {
  /** IAB classification that triggered the agent */
  classification: IABTrigger;

  /** Original content for LLM analysis (if available) */
  originalContent?: string;

  /** Extracted product keywords */
  productKeywords?: string[];

  /** Price range if mentioned */
  priceRange?: {
    min?: number;
    max?: number;
    currency: string;
  };
}

/**
 * Deal search result (mock for Sprint 3)
 */
export interface DealResult {
  /** Deal ID */
  id: string;

  /** Product name */
  productName: string;

  /** Original price */
  originalPrice: number;

  /** Deal price */
  dealPrice: number;

  /** Discount percentage */
  discountPercent: number;

  /** Retailer name */
  retailer: string;

  /** Deal URL (mock) */
  url: string;

  /** Expiration timestamp */
  expiresAt?: number;
}

/**
 * Price check result (mock for Sprint 3)
 */
export interface PriceCheckResult {
  /** Product name */
  productName: string;

  /** Current lowest price */
  lowestPrice: number;

  /** Average price over last 30 days */
  averagePrice: number;

  /** Price 30 days ago */
  price30DaysAgo: number;

  /** Price trend */
  trend: 'rising' | 'stable' | 'falling';

  /** Recommendation */
  recommendation: 'buy_now' | 'wait' | 'neutral';
}

/**
 * LLM-detected purchase intent (v13 Section 3.6.2)
 */
export interface PurchaseIntent {
  /** Whether purchase intent was detected */
  hasPurchaseIntent: boolean;

  /** Confidence score 0-1 */
  confidence: number;

  /** Detected product category */
  productCategory?: string;

  /** Specific products mentioned */
  products: string[];

  /** Price sensitivity indicators */
  priceSensitivity?: 'low' | 'medium' | 'high';

  /** Urgency indicators from content */
  urgencyIndicators?: string[];

  /** Raw reasoning from LLM */
  reasoning: string;
}

/**
 * Shopping agent permissions - v13 Section 3.6.2
 */
export const SHOPPING_PERMISSIONS: AgentPermissions = {
  agentType: 'shopping',
  memoryAccess: {
    read: [
      NAMESPACES.SEMANTIC_MEMORY,
      NAMESPACES.IAB_CLASSIFICATIONS,
      NAMESPACES.IKIGAI_PROFILE,
      NAMESPACES.MISSION_CARDS,
      NAMESPACES.EPISODIC_MEMORY,
    ],
    write: [
      NAMESPACES.MISSION_CARDS,
      NAMESPACES.EPISODIC_MEMORY,
    ],
    search: [
      NAMESPACES.SEMANTIC_MEMORY,
      NAMESPACES.IAB_CLASSIFICATIONS,
    ],
  },
  externalApis: [
    {
      name: 'deals-api',
      rateLimit: '100/hour',
      requiresUserConsent: false,
    },
  ],
  toolDefinitions: [
    {
      name: 'search_deals',
      description: 'Search for deals matching product keywords',
      parameters: {
        type: 'object',
        properties: {
          keywords: { type: 'array', items: { type: 'string' } },
          maxPrice: { type: 'number' },
          category: { type: 'string' },
        },
        required: ['keywords'],
      },
    },
    {
      name: 'check_price',
      description: 'Check price history and trend for a product',
      parameters: {
        type: 'object',
        properties: {
          productName: { type: 'string' },
        },
        required: ['productName'],
      },
    },
  ],
};

/**
 * IAB categories that indicate purchase intent
 */
export const PURCHASE_INTENT_CATEGORIES = {
  // Primary shopping categories
  SHOPPING: 'Shopping',
  CONSUMER_ELECTRONICS: 'Consumer Electronics',

  // Technology categories with high purchase intent
  TECHNOLOGY: 'Technology & Computing',
  MOBILE_DEVICES: 'Mobile Phones',

  // Fashion categories
  FASHION: 'Style & Fashion',
  CLOTHING: 'Clothing',

  // Home categories
  HOME: 'Home & Garden',
  APPLIANCES: 'Appliances',
} as const;

/**
 * Minimum confidence threshold for triggering agent
 */
export const PURCHASE_INTENT_THRESHOLD = 0.7;
