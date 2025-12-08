/**
 * Store Persistence Tests - Sprint 8
 *
 * Tests for financial data persistence to LangGraph Store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NS } from '@ownyou/shared-types';
import {
  FinancialStore,
  createFinancialStore,
  type Store,
} from '../store/persistence.js';
import type { Transaction, FinancialSyncResult } from '../types.js';

/**
 * Create a mock store for testing
 */
function createMockStore(): Store & {
  data: Map<string, Map<string, unknown>>;
  putCalls: { namespace: readonly string[]; key: string; value: unknown }[];
} {
  const data = new Map<string, Map<string, unknown>>();
  const putCalls: { namespace: readonly string[]; key: string; value: unknown }[] = [];

  return {
    data,
    putCalls,

    async put(namespace: readonly string[], key: string, value: unknown): Promise<void> {
      const nsKey = namespace.join('/');
      if (!data.has(nsKey)) {
        data.set(nsKey, new Map());
      }
      data.get(nsKey)!.set(key, value);
      putCalls.push({ namespace, key, value });
    },

    async get(namespace: readonly string[], key: string): Promise<unknown | null> {
      const nsKey = namespace.join('/');
      return data.get(nsKey)?.get(key) ?? null;
    },

    async search(namespace: readonly string[]): Promise<{ key: string; value: unknown }[]> {
      const nsKey = namespace.join('/');
      const nsData = data.get(nsKey);
      if (!nsData) return [];

      return Array.from(nsData.entries()).map(([key, value]) => ({ key, value }));
    },

    async delete(namespace: readonly string[], key: string): Promise<void> {
      const nsKey = namespace.join('/');
      data.get(nsKey)?.delete(key);
    },
  };
}

describe('FinancialStore', () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let financialStore: FinancialStore;

  beforeEach(() => {
    mockStore = createMockStore();
    financialStore = createFinancialStore(mockStore);
  });

  describe('saveTransactions', () => {
    it('should save transactions using NS.financialTransactions namespace', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn_001',
          providerTransactionId: 'plaid_001',
          accountId: 'acc_001',
          amount: 50.00,
          currency: 'USD',
          date: '2025-01-15',
          merchantName: 'Starbucks',
          merchantCategory: 'FOOD_AND_DRINK',
          merchantCategoryCode: '13005000',
          normalizedCategory: 'food_dining',
          pending: false,
          paymentChannel: 'in_store',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      await financialStore.saveTransactions('user_123', transactions);

      // Verify NS.* factory function was used
      const expectedNamespace = NS.financialTransactions('user_123');
      const putCalls = mockStore.putCalls.filter(
        call => call.namespace[0] === expectedNamespace[0] && call.namespace[1] === expectedNamespace[1]
      );

      expect(putCalls.length).toBeGreaterThan(0);
    });

    it('should group transactions by date', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn_001',
          providerTransactionId: 'plaid_001',
          accountId: 'acc_001',
          amount: 50.00,
          currency: 'USD',
          date: '2025-01-15',
          merchantName: 'Starbucks',
          merchantCategory: 'FOOD_AND_DRINK',
          merchantCategoryCode: '13005000',
          normalizedCategory: 'food_dining',
          pending: false,
          paymentChannel: 'in_store',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'txn_002',
          providerTransactionId: 'plaid_002',
          accountId: 'acc_001',
          amount: 30.00,
          currency: 'USD',
          date: '2025-01-15', // Same date
          merchantName: 'Target',
          merchantCategory: 'SHOPPING',
          merchantCategoryCode: '19013000',
          normalizedCategory: 'shopping',
          pending: false,
          paymentChannel: 'in_store',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'txn_003',
          providerTransactionId: 'plaid_003',
          accountId: 'acc_001',
          amount: 25.00,
          currency: 'USD',
          date: '2025-01-16', // Different date
          merchantName: 'Amazon',
          merchantCategory: 'SHOPPING',
          merchantCategoryCode: '19013000',
          normalizedCategory: 'shopping',
          pending: false,
          paymentChannel: 'online',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      await financialStore.saveTransactions('user_123', transactions);

      // Should have date_2025-01-15, date_2025-01-16, and latest keys
      const putCalls = mockStore.putCalls.filter(c => c.key.startsWith('date_'));
      expect(putCalls.length).toBe(2);
    });

    it('should store metadata with transaction count', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn_001',
          providerTransactionId: 'plaid_001',
          accountId: 'acc_001',
          amount: 50.00,
          currency: 'USD',
          date: '2025-01-15',
          merchantName: 'Shop',
          merchantCategory: 'SHOPPING',
          merchantCategoryCode: '19013000',
          normalizedCategory: 'shopping',
          pending: false,
          paymentChannel: 'online',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      await financialStore.saveTransactions('user_123', transactions);

      const latestCall = mockStore.putCalls.find(c => c.key === 'latest');
      expect(latestCall).toBeDefined();
      expect((latestCall?.value as { transactionCount: number }).transactionCount).toBe(1);
    });

    it('should write even when empty (v13 C2 compliance)', async () => {
      await financialStore.saveTransactions('user_123', []);

      const latestCall = mockStore.putCalls.find(c => c.key === 'latest');
      expect(latestCall).toBeDefined();
      expect((latestCall?.value as { isEmpty: boolean }).isEmpty).toBe(true);
      expect((latestCall?.value as { transactionCount: number }).transactionCount).toBe(0);
    });
  });

  describe('getTransactions', () => {
    it('should retrieve all saved transactions', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn_001',
          providerTransactionId: 'plaid_001',
          accountId: 'acc_001',
          amount: 50.00,
          currency: 'USD',
          date: '2025-01-15',
          merchantName: 'Shop',
          merchantCategory: 'SHOPPING',
          merchantCategoryCode: '19013000',
          normalizedCategory: 'shopping',
          pending: false,
          paymentChannel: 'online',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'txn_002',
          providerTransactionId: 'plaid_002',
          accountId: 'acc_001',
          amount: 30.00,
          currency: 'USD',
          date: '2025-01-16',
          merchantName: 'Cafe',
          merchantCategory: 'FOOD_AND_DRINK',
          merchantCategoryCode: '13005000',
          normalizedCategory: 'food_dining',
          pending: false,
          paymentChannel: 'in_store',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      await financialStore.saveTransactions('user_123', transactions);
      const retrieved = await financialStore.getTransactions('user_123');

      expect(retrieved.length).toBe(2);
      expect(retrieved.map(t => t.id).sort()).toEqual(['txn_001', 'txn_002']);
    });

    it('should return empty array when no transactions', async () => {
      const retrieved = await financialStore.getTransactions('user_no_data');
      expect(retrieved).toEqual([]);
    });
  });

  describe('saveProfile', () => {
    it('should build and save financial profile', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn_001',
          providerTransactionId: 'plaid_001',
          accountId: 'acc_001',
          amount: 50.00,
          currency: 'USD',
          date: '2025-01-15',
          merchantName: 'Starbucks',
          merchantCategory: 'FOOD_AND_DRINK',
          merchantCategoryCode: '13005000',
          normalizedCategory: 'food_dining',
          pending: false,
          paymentChannel: 'in_store',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'txn_002',
          providerTransactionId: 'plaid_002',
          accountId: 'acc_001',
          amount: 100.00,
          currency: 'USD',
          date: '2025-01-16',
          merchantName: 'Amazon',
          merchantCategory: 'SHOPPING',
          merchantCategoryCode: '19013000',
          normalizedCategory: 'shopping',
          pending: false,
          paymentChannel: 'online',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const profile = await financialStore.saveProfile('user_123', transactions);

      expect(profile.userId).toBe('user_123');
      expect(profile.transactionCount).toBe(2);
      expect(profile.spendingByCategory.food_dining.total).toBe(50);
      expect(profile.spendingByCategory.shopping.total).toBe(100);
    });

    it('should detect gift purchases for Ikigai', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn_gift',
          providerTransactionId: 'plaid_gift',
          accountId: 'acc_001',
          amount: 75.00,
          currency: 'USD',
          date: '2025-01-15',
          merchantName: 'Red Cross',
          merchantCategory: 'DONATIONS',
          merchantCategoryCode: '19000000',
          normalizedCategory: 'gifts_donations',
          pending: false,
          paymentChannel: 'online',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const profile = await financialStore.saveProfile('user_123', transactions);

      expect(profile.giftPurchases.length).toBe(1);
      expect(profile.giftPurchases[0].merchantName).toBe('Red Cross');
    });

    it('should detect experience spending for Ikigai', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn_travel',
          providerTransactionId: 'plaid_travel',
          accountId: 'acc_001',
          amount: 300.00,
          currency: 'USD',
          date: '2025-01-15',
          merchantName: 'United Airlines',
          merchantCategory: 'TRAVEL',
          merchantCategoryCode: '22001000',
          normalizedCategory: 'travel',
          pending: false,
          paymentChannel: 'online',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'txn_concert',
          providerTransactionId: 'plaid_concert',
          accountId: 'acc_001',
          amount: 150.00,
          currency: 'USD',
          date: '2025-01-16',
          merchantName: 'Ticketmaster',
          merchantCategory: 'ENTERTAINMENT',
          merchantCategoryCode: '17001000',
          normalizedCategory: 'entertainment',
          pending: false,
          paymentChannel: 'online',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const profile = await financialStore.saveProfile('user_123', transactions);

      expect(profile.experienceSpending.length).toBe(2);
    });

    it('should calculate top merchants', async () => {
      const transactions: Transaction[] = [];

      // Multiple transactions at same merchant
      for (let i = 0; i < 5; i++) {
        transactions.push({
          id: `txn_starbucks_${i}`,
          providerTransactionId: `plaid_starbucks_${i}`,
          accountId: 'acc_001',
          amount: 5.00,
          currency: 'USD',
          date: `2025-01-${10 + i}`,
          merchantName: 'Starbucks',
          merchantCategory: 'FOOD_AND_DRINK',
          merchantCategoryCode: '13005000',
          normalizedCategory: 'food_dining',
          pending: false,
          paymentChannel: 'in_store',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Single large transaction
      transactions.push({
        id: 'txn_apple',
        providerTransactionId: 'plaid_apple',
        accountId: 'acc_001',
        amount: 1000.00,
        currency: 'USD',
        date: '2025-01-20',
        merchantName: 'Apple Store',
        merchantCategory: 'SHOPPING',
        merchantCategoryCode: '19013000',
        normalizedCategory: 'shopping',
        pending: false,
        paymentChannel: 'in_store',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      });

      const profile = await financialStore.saveProfile('user_123', transactions);

      expect(profile.topMerchants.length).toBeGreaterThan(0);
      expect(profile.topMerchants[0].name).toBe('Apple Store');
      expect(profile.topMerchants[0].totalSpent).toBe(1000);
    });

    it('should use NS.financialProfile namespace', async () => {
      const profile = await financialStore.saveProfile('user_123', []);

      const expectedNamespace = NS.financialProfile('user_123');
      const putCall = mockStore.putCalls.find(
        call => call.namespace[0] === expectedNamespace[0] &&
                call.namespace[1] === expectedNamespace[1] &&
                call.key === 'profile'
      );

      expect(putCall).toBeDefined();
    });
  });

  describe('getProfile', () => {
    it('should retrieve saved profile', async () => {
      const transactions: Transaction[] = [
        {
          id: 'txn_001',
          providerTransactionId: 'plaid_001',
          accountId: 'acc_001',
          amount: 50.00,
          currency: 'USD',
          date: '2025-01-15',
          merchantName: 'Shop',
          merchantCategory: 'SHOPPING',
          merchantCategoryCode: '19013000',
          normalizedCategory: 'shopping',
          pending: false,
          paymentChannel: 'online',
          fetchedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      await financialStore.saveProfile('user_123', transactions);
      const profile = await financialStore.getProfile('user_123');

      expect(profile).not.toBeNull();
      expect(profile?.userId).toBe('user_123');
      expect(profile?.transactionCount).toBe(1);
    });

    it('should return null when no profile exists', async () => {
      const profile = await financialStore.getProfile('user_no_profile');
      expect(profile).toBeNull();
    });
  });

  describe('recordSync', () => {
    it('should record sync results', async () => {
      const syncResult: FinancialSyncResult = {
        success: true,
        newTransactions: 25,
        updatedTransactions: 3,
        removedTransactions: 1,
        classifiedCount: 23,
        syncedAt: Date.now(),
      };

      await financialStore.recordSync('user_123', syncResult);

      const history = await financialStore.getSyncHistory('user_123');
      expect(history.length).toBe(1);
      expect(history[0].newTransactions).toBe(25);
    });

    it('should maintain sync history (max 10)', async () => {
      // Record 15 syncs
      for (let i = 0; i < 15; i++) {
        await financialStore.recordSync('user_123', {
          success: true,
          newTransactions: i,
          updatedTransactions: 0,
          removedTransactions: 0,
          classifiedCount: i,
          syncedAt: Date.now() + i,
        });
      }

      const history = await financialStore.getSyncHistory('user_123');
      expect(history.length).toBe(10);
      // Most recent should be first
      expect(history[0].newTransactions).toBe(14);
    });
  });
});

describe('createFinancialStore', () => {
  it('should create a store with default config', () => {
    const mockStore = createMockStore();
    const store = createFinancialStore(mockStore);
    expect(store).toBeInstanceOf(FinancialStore);
  });

  it('should accept custom config', () => {
    const mockStore = createMockStore();
    const store = createFinancialStore(mockStore, {
      highAmountThreshold: 5.0,
      recurringMinOccurrences: 3,
    });
    expect(store).toBeInstanceOf(FinancialStore);
  });
});
