/**
 * Search Deals Tool - Mock Implementation for Sprint 3
 *
 * Returns mock deal data. Real implementation will integrate with
 * external APIs when BBS+ is ready.
 */

import type { AgentTool } from '@ownyou/agents-base';
import type { DealResult } from '../types';

export interface SearchDealsInput {
  keywords: string[];
  maxPrice?: number;
  category?: string;
}

export interface SearchDealsOutput {
  deals: DealResult[];
  totalFound: number;
}

/**
 * Mock deal database
 */
const MOCK_DEALS: DealResult[] = [
  {
    id: 'deal-1',
    productName: 'MacBook Air M3 13"',
    originalPrice: 1099,
    dealPrice: 949,
    discountPercent: 14,
    retailer: 'BestBuy',
    url: 'https://example.com/deal/1',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'deal-2',
    productName: 'Sony WH-1000XM5 Headphones',
    originalPrice: 399,
    dealPrice: 299,
    discountPercent: 25,
    retailer: 'Amazon',
    url: 'https://example.com/deal/2',
    expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'deal-3',
    productName: 'Samsung 65" OLED TV',
    originalPrice: 1799,
    dealPrice: 1299,
    discountPercent: 28,
    retailer: 'Costco',
    url: 'https://example.com/deal/3',
  },
  {
    id: 'deal-4',
    productName: 'Nike Air Max 270',
    originalPrice: 150,
    dealPrice: 89,
    discountPercent: 41,
    retailer: 'Nike',
    url: 'https://example.com/deal/4',
    expiresAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'deal-5',
    productName: 'Dyson V15 Detect',
    originalPrice: 749,
    dealPrice: 549,
    discountPercent: 27,
    retailer: 'Target',
    url: 'https://example.com/deal/5',
  },
];

/**
 * Search for deals matching keywords
 */
function searchDeals(input: SearchDealsInput): SearchDealsOutput {
  const { keywords, maxPrice } = input;

  // Filter deals based on keywords
  let results = MOCK_DEALS.filter((deal) => {
    const productLower = deal.productName.toLowerCase();
    return keywords.some((kw) => productLower.includes(kw.toLowerCase()));
  });

  // Filter by max price
  if (maxPrice !== undefined) {
    results = results.filter((deal) => deal.dealPrice <= maxPrice);
  }

  // Sort by discount percentage (best deals first)
  results.sort((a, b) => b.discountPercent - a.discountPercent);

  return {
    deals: results.slice(0, 5), // Return top 5
    totalFound: results.length,
  };
}

/**
 * Create the search deals tool
 */
export function createSearchDealsTool(): AgentTool<SearchDealsInput, SearchDealsOutput> {
  return {
    name: 'search_deals',
    description: 'Search for deals matching product keywords. Returns deals sorted by discount percentage.',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product keywords to search for',
        },
        maxPrice: {
          type: 'number',
          description: 'Maximum price filter',
        },
        category: {
          type: 'string',
          description: 'Product category filter',
        },
      },
      required: ['keywords'],
    },
    execute: async (input: SearchDealsInput): Promise<SearchDealsOutput> => {
      // Simulate API latency
      await new Promise((resolve) => setTimeout(resolve, 100));
      return searchDeals(input);
    },
  };
}
