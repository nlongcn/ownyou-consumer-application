/**
 * Price Check Tool - Mock Implementation for Sprint 3
 *
 * Returns mock price history data. Real implementation will integrate
 * with price tracking APIs when BBS+ is ready.
 */

import type { AgentTool } from '@ownyou/agents-base';
import type { PriceCheckResult } from '../types';

export interface PriceCheckInput {
  productName: string;
}

/**
 * Mock price history database
 */
const MOCK_PRICE_HISTORY: Record<string, PriceCheckResult> = {
  macbook: {
    productName: 'MacBook Air M3',
    lowestPrice: 899,
    averagePrice: 1049,
    price30DaysAgo: 1099,
    trend: 'falling',
    recommendation: 'buy_now',
  },
  headphones: {
    productName: 'Sony WH-1000XM5',
    lowestPrice: 279,
    averagePrice: 349,
    price30DaysAgo: 349,
    trend: 'stable',
    recommendation: 'neutral',
  },
  tv: {
    productName: 'Samsung OLED TV',
    lowestPrice: 1199,
    averagePrice: 1499,
    price30DaysAgo: 1399,
    trend: 'falling',
    recommendation: 'wait',
  },
  shoes: {
    productName: 'Nike Air Max',
    lowestPrice: 79,
    averagePrice: 120,
    price30DaysAgo: 150,
    trend: 'falling',
    recommendation: 'buy_now',
  },
  vacuum: {
    productName: 'Dyson V15',
    lowestPrice: 499,
    averagePrice: 649,
    price30DaysAgo: 599,
    trend: 'rising',
    recommendation: 'wait',
  },
};

/**
 * Check price history for a product
 */
function checkPrice(input: PriceCheckInput): PriceCheckResult {
  const { productName } = input;
  const productLower = productName.toLowerCase();

  // Find matching product
  for (const [key, result] of Object.entries(MOCK_PRICE_HISTORY)) {
    if (productLower.includes(key) || key.includes(productLower)) {
      return result;
    }
  }

  // Default response for unknown products
  return {
    productName,
    lowestPrice: 0,
    averagePrice: 0,
    price30DaysAgo: 0,
    trend: 'stable',
    recommendation: 'neutral',
  };
}

/**
 * Create the price check tool
 */
export function createPriceCheckTool(): AgentTool<PriceCheckInput, PriceCheckResult> {
  return {
    name: 'check_price',
    description: 'Check price history and trend for a product. Returns recommendation on whether to buy now or wait.',
    parameters: {
      type: 'object',
      properties: {
        productName: {
          type: 'string',
          description: 'Name of the product to check',
        },
      },
      required: ['productName'],
    },
    execute: async (input: PriceCheckInput): Promise<PriceCheckResult> => {
      // Simulate API latency
      await new Promise((resolve) => setTimeout(resolve, 50));
      return checkPrice(input);
    },
  };
}
