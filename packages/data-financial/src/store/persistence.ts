/**
 * Store Persistence - Sprint 8
 *
 * Persists financial data to LangGraph Store using v13 namespaces.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 * @see docs/architecture/extracts/namespaces-8.12.md
 */

import { NS } from '@ownyou/shared-types';
import type {
  Transaction,
  FinancialProfile,
  FinancialSyncResult,
  CategorySpending,
  TransactionCategory,
} from '../types.js';
import {
  detectRecurringMerchants,
  detectUnusualSpending,
  aggregateSpendingByCategory,
} from '../pipeline/normalizer.js';

/**
 * Store interface (compatible with LangGraph Store)
 */
export interface Store {
  put(namespace: readonly string[], key: string, value: unknown): Promise<void>;
  get(namespace: readonly string[], key: string): Promise<unknown | null>;
  search(namespace: readonly string[], query?: string): Promise<{ key: string; value: unknown }[]>;
  delete(namespace: readonly string[], key: string): Promise<void>;
}

/**
 * Financial data persistence configuration
 */
export interface PersistenceConfig {
  /** High amount threshold for unusual spending detection */
  highAmountThreshold?: number;

  /** Minimum occurrences for recurring merchant detection */
  recurringMinOccurrences?: number;

  /** Number of top merchants to track */
  topMerchantsCount?: number;
}

/**
 * Default persistence configuration
 */
const DEFAULT_CONFIG: Required<PersistenceConfig> = {
  highAmountThreshold: 3.0,
  recurringMinOccurrences: 2,
  topMerchantsCount: 10,
};

/**
 * Financial data store for persistence operations
 */
export class FinancialStore {
  private store: Store;
  private config: Required<PersistenceConfig>;

  constructor(store: Store, config: PersistenceConfig = {}) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Save transactions to store
   */
  async saveTransactions(userId: string, transactions: Transaction[]): Promise<void> {
    // v13 Compliance: Always write, even when empty (C2 pattern)
    const namespace = NS.financialTransactions(userId);

    // Group transactions by date for efficient storage
    const byDate = new Map<string, Transaction[]>();
    for (const txn of transactions) {
      const existing = byDate.get(txn.date) || [];
      existing.push(txn);
      byDate.set(txn.date, existing);
    }

    // Store transactions by date
    for (const [date, txns] of byDate) {
      await this.store.put(namespace, `date_${date}`, {
        transactions: txns,
        updatedAt: Date.now(),
      });
    }

    // Store latest batch metadata
    await this.store.put(namespace, 'latest', {
      transactionCount: transactions.length,
      isEmpty: transactions.length === 0,
      dateRange: transactions.length > 0 ? {
        earliest: transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date),
        latest: transactions.reduce((max, t) => t.date > max ? t.date : max, transactions[0].date),
      } : null,
      updatedAt: Date.now(),
    });
  }

  /**
   * Get all transactions for a user
   */
  async getTransactions(userId: string): Promise<Transaction[]> {
    const namespace = NS.financialTransactions(userId);
    const results = await this.store.search(namespace);

    const transactions: Transaction[] = [];
    for (const result of results) {
      if (result.key.startsWith('date_') && result.value) {
        const data = result.value as { transactions: Transaction[] };
        transactions.push(...data.transactions);
      }
    }

    return transactions;
  }

  /**
   * Build and save financial profile
   */
  async saveProfile(userId: string, transactions: Transaction[]): Promise<FinancialProfile> {
    // Calculate spending by category
    const spendingByCategory = aggregateSpendingByCategory(transactions);

    // Detect recurring merchants
    const recurringMerchants = detectRecurringMerchants(
      transactions,
      this.config.recurringMinOccurrences
    );

    // Detect unusual spending
    const unusualSpending = detectUnusualSpending(
      transactions,
      this.config.highAmountThreshold
    );

    // Extract Ikigai-relevant transactions
    const giftPurchases = transactions
      .filter(t => t.normalizedCategory === 'gifts_donations')
      .map(t => ({
        transactionId: t.id,
        amount: t.amount,
        merchantName: t.merchantName,
        date: t.date,
        category: t.normalizedCategory,
      }));

    const experienceSpending = transactions
      .filter(t =>
        t.normalizedCategory === 'travel' ||
        t.normalizedCategory === 'entertainment' ||
        (t.normalizedCategory === 'food_dining' && t.amount > 50) // Dining out experiences
      )
      .map(t => ({
        transactionId: t.id,
        amount: t.amount,
        merchantName: t.merchantName,
        date: t.date,
        category: t.normalizedCategory,
      }));

    const hobbySpending = transactions
      .filter(t =>
        t.normalizedCategory === 'entertainment' ||
        t.normalizedCategory === 'health_fitness' ||
        t.normalizedCategory === 'education'
      )
      .map(t => ({
        transactionId: t.id,
        amount: t.amount,
        merchantName: t.merchantName,
        date: t.date,
        category: t.normalizedCategory,
      }));

    // Calculate top merchants
    const merchantTotals = new Map<string, { total: number; count: number; category: TransactionCategory; lastDate: string }>();
    for (const txn of transactions) {
      if (!txn.merchantName || txn.amount < 0) continue;

      const existing = merchantTotals.get(txn.merchantName) || {
        total: 0,
        count: 0,
        category: txn.normalizedCategory,
        lastDate: txn.date,
      };

      existing.total += txn.amount;
      existing.count += 1;
      if (txn.date > existing.lastDate) {
        existing.lastDate = txn.date;
      }

      merchantTotals.set(txn.merchantName, existing);
    }

    const topMerchants = Array.from(merchantTotals.entries())
      .map(([name, data]) => ({
        name,
        totalSpent: Math.round(data.total * 100) / 100,
        transactionCount: data.count,
        category: data.category,
        lastTransaction: data.lastDate,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, this.config.topMerchantsCount);

    // Calculate date range
    let earliest = '';
    let latest = '';
    if (transactions.length > 0) {
      earliest = transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date);
      latest = transactions.reduce((max, t) => t.date > max ? t.date : max, transactions[0].date);
    }

    const profile: FinancialProfile = {
      userId,
      lastSync: Date.now(),
      transactionCount: transactions.length,
      dateRange: {
        earliest,
        latest,
      },
      spendingByCategory,
      recurringMerchants,
      unusualSpending,
      giftPurchases,
      experienceSpending,
      hobbySpending,
      topMerchants,
    };

    // v13 Compliance: Use NS.* factory function
    await this.store.put(NS.financialProfile(userId), 'profile', {
      ...profile,
      isEmpty: transactions.length === 0,
      updatedAt: Date.now(),
    });

    return profile;
  }

  /**
   * Get financial profile
   */
  async getProfile(userId: string): Promise<FinancialProfile | null> {
    const result = await this.store.get(NS.financialProfile(userId), 'profile');
    if (!result) return null;

    return result as FinancialProfile;
  }

  /**
   * Record a sync operation
   */
  async recordSync(userId: string, result: FinancialSyncResult): Promise<void> {
    const namespace = NS.financialTransactions(userId);

    // Get existing sync history
    const existing = await this.store.get(namespace, 'sync_history');
    const history = (existing as { syncs: FinancialSyncResult[] })?.syncs || [];

    // Add new sync result (keep last 10)
    history.unshift(result);
    if (history.length > 10) {
      history.pop();
    }

    await this.store.put(namespace, 'sync_history', {
      syncs: history,
      lastSync: result.syncedAt,
      updatedAt: Date.now(),
    });
  }

  /**
   * Get sync history
   */
  async getSyncHistory(userId: string): Promise<FinancialSyncResult[]> {
    const namespace = NS.financialTransactions(userId);
    const result = await this.store.get(namespace, 'sync_history');

    if (!result) return [];
    return (result as { syncs: FinancialSyncResult[] }).syncs;
  }
}

/**
 * Create a financial store instance
 */
export function createFinancialStore(store: Store, config?: PersistenceConfig): FinancialStore {
  return new FinancialStore(store, config);
}
