/**
 * Transaction Classifier - Sprint 8
 *
 * Classifies transactions with IAB categories for advertising insights.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 */

import type { Transaction, TransactionCategory } from '../types.js';

/**
 * IAB Category mapping (simplified for transactions)
 */
export interface IABCategory {
  tier1Id: string;
  tier1Name: string;
  tier2Id?: string;
  tier2Name?: string;
}

/**
 * IAB Classification result
 */
export interface IABClassification {
  id: string;
  userId: string;
  category: IABCategory;
  confidence: number;
  source: 'transaction';
  sourceItemId: string;
  textPreview?: string;
  timestamp: string;
  reasoning?: string;
}

/**
 * Classifier configuration
 */
export interface ClassifierConfig {
  /** Minimum confidence threshold for classification */
  confidenceThreshold?: number;

  /** Model tier for LLM classification */
  modelTier?: 'fast' | 'standard' | 'quality';

  /** Minimum transaction amount for classification */
  minAmountForClassification?: number;
}

/**
 * Mapping from transaction category to IAB categories
 */
const CATEGORY_TO_IAB: Record<TransactionCategory, IABCategory> = {
  food_dining: {
    tier1Id: 'IAB8',
    tier1Name: 'Food & Drink',
    tier2Id: 'IAB8-1',
    tier2Name: 'Restaurants',
  },
  shopping: {
    tier1Id: 'IAB18',
    tier1Name: 'Style & Fashion',
    tier2Id: 'IAB18-5',
    tier2Name: 'Shopping',
  },
  entertainment: {
    tier1Id: 'IAB1',
    tier1Name: 'Arts & Entertainment',
    tier2Id: 'IAB1-6',
    tier2Name: 'Movies',
  },
  travel: {
    tier1Id: 'IAB20',
    tier1Name: 'Travel',
    tier2Id: 'IAB20-1',
    tier2Name: 'Adventure Travel',
  },
  health_fitness: {
    tier1Id: 'IAB7',
    tier1Name: 'Health & Fitness',
    tier2Id: 'IAB7-1',
    tier2Name: 'Exercise',
  },
  education: {
    tier1Id: 'IAB5',
    tier1Name: 'Education',
    tier2Id: 'IAB5-1',
    tier2Name: 'Online Learning',
  },
  gifts_donations: {
    tier1Id: 'IAB18',
    tier1Name: 'Style & Fashion',
    tier2Id: 'IAB18-3',
    tier2Name: 'Gifts',
  },
  personal_care: {
    tier1Id: 'IAB18',
    tier1Name: 'Style & Fashion',
    tier2Id: 'IAB18-1',
    tier2Name: 'Beauty',
  },
  home: {
    tier1Id: 'IAB10',
    tier1Name: 'Home & Garden',
    tier2Id: 'IAB10-1',
    tier2Name: 'Home Improvement',
  },
  transportation: {
    tier1Id: 'IAB2',
    tier1Name: 'Automotive',
    tier2Id: 'IAB2-1',
    tier2Name: 'Auto Parts',
  },
  subscriptions: {
    tier1Id: 'IAB19',
    tier1Name: 'Technology & Computing',
    tier2Id: 'IAB19-1',
    tier2Name: 'Software',
  },
  financial: {
    tier1Id: 'IAB13',
    tier1Name: 'Personal Finance',
    tier2Id: 'IAB13-1',
    tier2Name: 'Banking',
  },
  income: {
    tier1Id: 'IAB13',
    tier1Name: 'Personal Finance',
    tier2Id: 'IAB13-3',
    tier2Name: 'Financial Planning',
  },
  other: {
    tier1Id: 'IAB24',
    tier1Name: 'Uncategorized',
  },
};

/**
 * Transaction classifier for IAB categorization
 */
export class TransactionClassifier {
  private config: Required<ClassifierConfig>;

  constructor(config: ClassifierConfig = {}) {
    this.config = {
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      modelTier: config.modelTier ?? 'fast',
      minAmountForClassification: config.minAmountForClassification ?? 10.0,
    };
  }

  /**
   * Classify a single transaction
   */
  async classify(transaction: Transaction, userId: string): Promise<Transaction> {
    // Skip classification for low-value transactions
    if (Math.abs(transaction.amount) < this.config.minAmountForClassification) {
      return transaction;
    }

    // Skip income transactions (they're not useful for advertising)
    if (transaction.normalizedCategory === 'income') {
      return transaction;
    }

    // Map transaction category to IAB
    const iabCategory = CATEGORY_TO_IAB[transaction.normalizedCategory];

    // Calculate confidence based on category certainty
    let confidence = 0.8; // Base confidence

    // Boost confidence if merchant name is present
    if (transaction.merchantName) {
      confidence += 0.1;
    }

    // Boost confidence if category is specific (not 'other')
    if (transaction.normalizedCategory !== 'other') {
      confidence += 0.05;
    }

    // Cap at 0.95
    confidence = Math.min(0.95, confidence);

    // Only classify if above threshold
    if (confidence < this.config.confidenceThreshold) {
      return transaction;
    }

    const classification: IABClassification = {
      id: `iab_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId,
      category: iabCategory,
      confidence,
      source: 'transaction',
      sourceItemId: transaction.id,
      textPreview: transaction.merchantName
        ? `${transaction.merchantName} - $${transaction.amount}`
        : `$${transaction.amount} - ${transaction.normalizedCategory}`,
      timestamp: new Date().toISOString(),
      reasoning: `Classified from ${transaction.normalizedCategory} transaction at ${transaction.merchantName || 'unknown merchant'}`,
    };

    return {
      ...transaction,
      iabClassification: classification,
    };
  }

  /**
   * Classify multiple transactions in batch
   */
  async classifyBatch(transactions: Transaction[], userId: string): Promise<Transaction[]> {
    const results: Transaction[] = [];

    for (const txn of transactions) {
      const classified = await this.classify(txn, userId);
      results.push(classified);
    }

    return results;
  }

  /**
   * Get classification statistics
   */
  getStatistics(transactions: Transaction[]): {
    total: number;
    classified: number;
    skipped: number;
    byCategory: Record<string, number>;
  } {
    const classified = transactions.filter(t => t.iabClassification);
    const skipped = transactions.filter(t => !t.iabClassification);

    const byCategory: Record<string, number> = {};
    for (const txn of classified) {
      if (txn.iabClassification) {
        const catName = txn.iabClassification.category.tier1Name;
        byCategory[catName] = (byCategory[catName] || 0) + 1;
      }
    }

    return {
      total: transactions.length,
      classified: classified.length,
      skipped: skipped.length,
      byCategory,
    };
  }
}

/**
 * Create a transaction classifier with the given configuration
 */
export function createTransactionClassifier(config?: ClassifierConfig): TransactionClassifier {
  return new TransactionClassifier(config);
}
