/**
 * Transaction Normalizer - Sprint 8
 *
 * Normalizes Plaid transactions to OwnYou format and detects patterns.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 */

import type {
  Transaction,
  TransactionCategory,
  RecurringMerchant,
  UnusualTransaction,
  CategorySpending,
  UnusualReason,
  PaymentChannel,
} from '../types.js';
import type { PlaidRawTransaction } from '../plaid/mock.js';

/**
 * Map Plaid category to OwnYou normalized category
 */
export function normalizePlaidCategory(plaidCategory: string | null): TransactionCategory {
  if (!plaidCategory) return 'other';

  const categoryMap: Record<string, TransactionCategory> = {
    // Food & Drink
    FOOD_AND_DRINK: 'food_dining',
    FOOD_AND_DRINK_COFFEE: 'food_dining',
    FOOD_AND_DRINK_RESTAURANTS: 'food_dining',
    FOOD_AND_DRINK_GROCERIES: 'food_dining',
    FOOD_AND_DRINK_FAST_FOOD: 'food_dining',
    FOOD_AND_DRINK_DELIVERY: 'food_dining',

    // Shopping
    SHOPPING: 'shopping',
    SHOPPING_ONLINE: 'shopping',
    SHOPPING_ELECTRONICS: 'shopping',
    SHOPPING_CLOTHING: 'shopping',

    // Entertainment
    ENTERTAINMENT: 'entertainment',
    ENTERTAINMENT_MUSIC: 'entertainment',
    ENTERTAINMENT_MOVIES: 'entertainment',
    ENTERTAINMENT_GAMES: 'entertainment',
    ENTERTAINMENT_SPORTS: 'entertainment',

    // Travel
    TRAVEL: 'travel',
    TRAVEL_FLIGHTS: 'travel',
    TRAVEL_LODGING: 'travel',
    TRAVEL_RENTAL_CARS: 'travel',
    TRAVEL_TRANSPORTATION: 'travel',
    TRAVEL_GAS: 'transportation',

    // Health
    HEALTH_AND_FITNESS: 'health_fitness',
    HEALTH_AND_FITNESS_GYM: 'health_fitness',
    HEALTH_AND_FITNESS_PHARMACY: 'health_fitness',
    HEALTH_AND_FITNESS_MEDICAL: 'health_fitness',

    // Education
    EDUCATION: 'education',
    EDUCATION_TUITION: 'education',
    EDUCATION_BOOKS: 'education',

    // Donations
    DONATIONS: 'gifts_donations',
    CHARITY: 'gifts_donations',

    // Personal Care
    PERSONAL_CARE: 'personal_care',
    PERSONAL_CARE_SALON: 'personal_care',
    PERSONAL_CARE_SPA: 'personal_care',

    // Home
    HOME_IMPROVEMENT: 'home',
    HOME_FURNISHING: 'home',
    UTILITIES: 'home',

    // Transportation
    TRANSPORTATION: 'transportation',
    TRANSPORTATION_GAS: 'transportation',
    TRANSPORTATION_PARKING: 'transportation',
    TRANSPORTATION_PUBLIC: 'transportation',
    TRANSPORTATION_RIDESHARE: 'transportation',

    // Financial
    BANK_FEES: 'financial',
    FEES: 'financial',
    TRANSFER: 'financial',
    LOAN_PAYMENTS: 'financial',
    PAYMENT: 'financial',

    // Income
    INCOME: 'income',
    INCOME_PAYCHECK: 'income',
    INCOME_INTEREST: 'income',
    INCOME_REFUND: 'income',

    // Software/Subscriptions
    SOFTWARE: 'subscriptions',
    SUBSCRIPTION: 'subscriptions',
  };

  // Check exact match first
  if (categoryMap[plaidCategory]) {
    return categoryMap[plaidCategory];
  }

  // Check prefix match
  for (const [key, value] of Object.entries(categoryMap)) {
    if (plaidCategory.startsWith(key)) {
      return value;
    }
  }

  return 'other';
}

/**
 * Normalize Plaid payment channel to OwnYou format
 */
function normalizePaymentChannel(channel: string): PaymentChannel {
  switch (channel) {
    case 'online':
      return 'online';
    case 'in store':
      return 'in_store';
    default:
      return 'other';
  }
}

/**
 * Normalize a single Plaid transaction to OwnYou format
 */
export function normalizeTransaction(
  plaidTxn: PlaidRawTransaction,
  _userId: string
): Transaction {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10);

  return {
    id: `txn_${timestamp}_${randomPart}`,
    providerTransactionId: plaidTxn.transaction_id,
    accountId: plaidTxn.account_id,
    amount: plaidTxn.amount,
    currency: plaidTxn.iso_currency_code || 'USD',
    date: plaidTxn.date,
    merchantName: plaidTxn.merchant_name,
    merchantCategory: plaidTxn.personal_finance_category?.primary || null,
    merchantCategoryCode: plaidTxn.personal_finance_category?.detailed || null,
    normalizedCategory: normalizePlaidCategory(plaidTxn.personal_finance_category?.primary || null),
    pending: plaidTxn.pending,
    paymentChannel: normalizePaymentChannel(plaidTxn.payment_channel),
    location: plaidTxn.location ? {
      city: plaidTxn.location.city || undefined,
      region: plaidTxn.location.region || undefined,
      country: plaidTxn.location.country || undefined,
      lat: plaidTxn.location.lat || undefined,
      lon: plaidTxn.location.lon || undefined,
    } : undefined,
    fetchedAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Transaction normalizer class for batch operations
 */
export class TransactionNormalizer {
  /**
   * Normalize a batch of Plaid transactions
   */
  normalizeBatch(plaidTxns: PlaidRawTransaction[], userId: string): Transaction[] {
    return plaidTxns.map(txn => normalizeTransaction(txn, userId));
  }
}

/**
 * Detect recurring merchants from transaction history
 */
export function detectRecurringMerchants(
  transactions: Transaction[],
  minOccurrences: number = 2
): RecurringMerchant[] {
  // Group by merchant name
  const merchantTxns = new Map<string, Transaction[]>();

  for (const txn of transactions) {
    if (!txn.merchantName) continue;

    const existing = merchantTxns.get(txn.merchantName) || [];
    existing.push(txn);
    merchantTxns.set(txn.merchantName, existing);
  }

  const recurring: RecurringMerchant[] = [];

  for (const [merchantName, txns] of merchantTxns) {
    if (txns.length < minOccurrences) continue;

    // Sort by date
    txns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate intervals between transactions
    const intervals: number[] = [];
    for (let i = 1; i < txns.length; i++) {
      const prevDate = new Date(txns[i - 1].date);
      const currDate = new Date(txns[i].date);
      const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
      intervals.push(daysDiff);
    }

    if (intervals.length === 0) continue;

    // Calculate average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Detect frequency
    let frequency: RecurringMerchant['frequency'];
    if (avgInterval <= 10) {
      frequency = 'weekly';
    } else if (avgInterval <= 20) {
      frequency = 'biweekly';
    } else if (avgInterval <= 45) {
      frequency = 'monthly';
    } else if (avgInterval <= 120) {
      frequency = 'quarterly';
    } else {
      frequency = 'yearly';
    }

    // Calculate average amount
    const totalAmount = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgAmount = totalAmount / txns.length;

    // Calculate confidence based on consistency
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = avgInterval > 0 ? stdDev / avgInterval : 1;
    const confidence = Math.max(0, Math.min(1, 1 - coefficient));

    recurring.push({
      name: merchantName,
      frequency,
      averageAmount: Math.round(avgAmount * 100) / 100,
      currency: txns[0].currency,
      category: txns[0].normalizedCategory,
      lastTransaction: txns[txns.length - 1].date,
      occurrences: txns.length,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  // Sort by occurrences descending
  return recurring.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Detect unusual spending patterns
 */
export function detectUnusualSpending(
  transactions: Transaction[],
  highAmountThreshold: number = 3.0
): UnusualTransaction[] {
  const unusual: UnusualTransaction[] = [];

  // Calculate category averages
  const categoryTotals = new Map<TransactionCategory, { sum: number; count: number }>();

  for (const txn of transactions) {
    if (txn.amount < 0) continue; // Skip income

    const existing = categoryTotals.get(txn.normalizedCategory) || { sum: 0, count: 0 };
    existing.sum += txn.amount;
    existing.count += 1;
    categoryTotals.set(txn.normalizedCategory, existing);
  }

  const categoryAverages = new Map<TransactionCategory, number>();
  for (const [cat, totals] of categoryTotals) {
    categoryAverages.set(cat, totals.count > 0 ? totals.sum / totals.count : 0);
  }

  // Track seen merchants
  const seenMerchants = new Set<string>();
  const merchantFirstSeen = new Map<string, string>(); // merchant -> date

  // Sort by date to process in order
  const sortedTxns = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const txn of sortedTxns) {
    if (txn.merchantName) {
      if (!seenMerchants.has(txn.merchantName)) {
        merchantFirstSeen.set(txn.merchantName, txn.date);
      }
      seenMerchants.add(txn.merchantName);
    }
  }

  // Check each transaction for unusual patterns
  for (const txn of transactions) {
    if (txn.amount < 0) continue; // Skip income

    const reasons: { reason: UnusualReason; score: number }[] = [];

    // High amount check
    const categoryAvg = categoryAverages.get(txn.normalizedCategory) || 0;
    if (categoryAvg > 0 && txn.amount > categoryAvg * highAmountThreshold) {
      const ratio = txn.amount / categoryAvg;
      reasons.push({
        reason: 'high_amount',
        score: Math.min(1, (ratio - highAmountThreshold) / highAmountThreshold),
      });
    }

    // New merchant check (only flag if it's a recent transaction and this is first occurrence)
    if (txn.merchantName) {
      const firstSeen = merchantFirstSeen.get(txn.merchantName);
      if (firstSeen === txn.date) {
        // This is the first transaction at this merchant
        // Only flag if there are enough other merchants in history
        if (seenMerchants.size > 5) {
          reasons.push({
            reason: 'new_merchant',
            score: 0.5,
          });
        }
      }
    }

    // Add to unusual if any reason found
    if (reasons.length > 0) {
      // Pick the highest scoring reason
      const topReason = reasons.sort((a, b) => b.score - a.score)[0];

      unusual.push({
        transactionId: txn.id,
        reason: topReason.reason,
        amount: txn.amount,
        merchantName: txn.merchantName,
        date: txn.date,
        anomalyScore: topReason.score,
      });
    }
  }

  // Sort by anomaly score descending
  return unusual.sort((a, b) => b.anomalyScore - a.anomalyScore);
}

/**
 * Aggregate spending by category
 */
export function aggregateSpendingByCategory(
  transactions: Transaction[]
): Record<TransactionCategory, CategorySpending> {
  const categories: TransactionCategory[] = [
    'food_dining', 'shopping', 'entertainment', 'travel', 'health_fitness',
    'education', 'gifts_donations', 'personal_care', 'home', 'transportation',
    'subscriptions', 'financial', 'income', 'other',
  ];

  // Initialize all categories
  const result: Record<TransactionCategory, CategorySpending> = {} as Record<TransactionCategory, CategorySpending>;

  for (const cat of categories) {
    result[cat] = {
      total: 0,
      count: 0,
      average: 0,
      percentage: 0,
    };
  }

  // Calculate totals
  let totalSpending = 0;

  for (const txn of transactions) {
    result[txn.normalizedCategory].total += txn.amount;
    result[txn.normalizedCategory].count += 1;

    // Only count positive amounts toward spending total
    if (txn.amount > 0) {
      totalSpending += txn.amount;
    }
  }

  // Calculate averages and percentages
  for (const cat of categories) {
    if (result[cat].count > 0) {
      result[cat].average = Math.round((result[cat].total / result[cat].count) * 100) / 100;
    }

    if (totalSpending > 0 && result[cat].total > 0) {
      result[cat].percentage = Math.round((result[cat].total / totalSpending) * 100) / 100;
    }

    // Round totals
    result[cat].total = Math.round(result[cat].total * 100) / 100;
  }

  return result;
}
