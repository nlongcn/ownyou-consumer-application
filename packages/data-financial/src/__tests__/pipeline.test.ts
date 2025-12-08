/**
 * Pipeline Tests - Sprint 8
 *
 * Tests for the financial data pipeline: fetcher, normalizer, classifier.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TransactionNormalizer,
  normalizeTransaction,
  normalizePlaidCategory,
  detectRecurringMerchants,
  detectUnusualSpending,
  aggregateSpendingByCategory,
} from '../pipeline/normalizer.js';
import {
  TransactionFetcher,
  createTransactionFetcher,
} from '../pipeline/fetcher.js';
import {
  TransactionClassifier,
  createTransactionClassifier,
  type ClassifierConfig,
} from '../pipeline/classifier.js';
import {
  generateMockTransactions,
  createMockPlaidClient,
  type PlaidRawTransaction,
} from '../plaid/mock.js';
import type {
  Transaction,
  TransactionCategory,
  RecurringMerchant,
  CategorySpending,
} from '../types.js';

describe('TransactionNormalizer', () => {
  describe('normalizeTransaction', () => {
    it('should normalize a Plaid transaction to OwnYou format', () => {
      const plaidTxn: PlaidRawTransaction = {
        transaction_id: 'plaid_txn_001',
        account_id: 'acc_001',
        amount: 42.50,
        iso_currency_code: 'USD',
        date: '2025-01-15',
        merchant_name: 'Starbucks',
        name: 'STARBUCKS STORE #12345',
        pending: false,
        payment_channel: 'in store',
        personal_finance_category: {
          primary: 'FOOD_AND_DRINK',
          detailed: 'FOOD_AND_DRINK_COFFEE',
        },
        location: {
          city: 'San Francisco',
          region: 'CA',
          country: 'US',
          lat: 37.7749,
          lon: -122.4194,
        },
      };

      const normalized = normalizeTransaction(plaidTxn, 'user_123');

      expect(normalized.id).toBeDefined();
      expect(normalized.providerTransactionId).toBe('plaid_txn_001');
      expect(normalized.accountId).toBe('acc_001');
      expect(normalized.amount).toBe(42.50);
      expect(normalized.currency).toBe('USD');
      expect(normalized.date).toBe('2025-01-15');
      expect(normalized.merchantName).toBe('Starbucks');
      expect(normalized.normalizedCategory).toBe('food_dining');
      expect(normalized.pending).toBe(false);
      expect(normalized.paymentChannel).toBe('in_store');
      expect(normalized.location?.city).toBe('San Francisco');
    });

    it('should handle missing merchant name', () => {
      const plaidTxn: PlaidRawTransaction = {
        transaction_id: 'plaid_txn_002',
        account_id: 'acc_001',
        amount: 100.00,
        iso_currency_code: 'USD',
        date: '2025-01-16',
        merchant_name: null,
        name: 'ACH TRANSFER',
        pending: false,
        payment_channel: 'other',
        personal_finance_category: null,
        location: null,
      };

      const normalized = normalizeTransaction(plaidTxn, 'user_123');

      expect(normalized.merchantName).toBeNull();
      expect(normalized.normalizedCategory).toBe('other');
    });

    it('should handle pending transactions', () => {
      const plaidTxn: PlaidRawTransaction = {
        transaction_id: 'plaid_txn_003',
        account_id: 'acc_001',
        amount: 25.00,
        iso_currency_code: 'USD',
        date: '2025-01-17',
        merchant_name: 'Amazon',
        name: 'AMAZON.COM',
        pending: true,
        payment_channel: 'online',
        personal_finance_category: {
          primary: 'SHOPPING',
          detailed: 'SHOPPING_ONLINE',
        },
        location: null,
      };

      const normalized = normalizeTransaction(plaidTxn, 'user_123');

      expect(normalized.pending).toBe(true);
      expect(normalized.normalizedCategory).toBe('shopping');
    });

    it('should generate unique transaction IDs', () => {
      const plaidTxn: PlaidRawTransaction = {
        transaction_id: 'plaid_txn_004',
        account_id: 'acc_001',
        amount: 10.00,
        iso_currency_code: 'USD',
        date: '2025-01-18',
        merchant_name: 'Test',
        name: 'TEST',
        pending: false,
        payment_channel: 'online',
        personal_finance_category: null,
        location: null,
      };

      const normalized1 = normalizeTransaction(plaidTxn, 'user_123');
      const normalized2 = normalizeTransaction(plaidTxn, 'user_123');

      expect(normalized1.id).not.toBe(normalized2.id);
    });
  });

  describe('normalizePlaidCategory', () => {
    it('should map FOOD_AND_DRINK to food_dining', () => {
      expect(normalizePlaidCategory('FOOD_AND_DRINK')).toBe('food_dining');
    });

    it('should map SHOPPING to shopping', () => {
      expect(normalizePlaidCategory('SHOPPING')).toBe('shopping');
    });

    it('should map ENTERTAINMENT to entertainment', () => {
      expect(normalizePlaidCategory('ENTERTAINMENT')).toBe('entertainment');
    });

    it('should map TRAVEL to travel', () => {
      expect(normalizePlaidCategory('TRAVEL')).toBe('travel');
    });

    it('should map HEALTH_AND_FITNESS to health_fitness', () => {
      expect(normalizePlaidCategory('HEALTH_AND_FITNESS')).toBe('health_fitness');
    });

    it('should map EDUCATION to education', () => {
      expect(normalizePlaidCategory('EDUCATION')).toBe('education');
    });

    it('should map DONATIONS to gifts_donations', () => {
      expect(normalizePlaidCategory('DONATIONS')).toBe('gifts_donations');
    });

    it('should map PERSONAL_CARE to personal_care', () => {
      expect(normalizePlaidCategory('PERSONAL_CARE')).toBe('personal_care');
    });

    it('should map HOME_IMPROVEMENT to home', () => {
      expect(normalizePlaidCategory('HOME_IMPROVEMENT')).toBe('home');
    });

    it('should map TRANSPORTATION to transportation', () => {
      expect(normalizePlaidCategory('TRANSPORTATION')).toBe('transportation');
    });

    it('should map INCOME to income', () => {
      expect(normalizePlaidCategory('INCOME')).toBe('income');
    });

    it('should map BANK_FEES to financial', () => {
      expect(normalizePlaidCategory('BANK_FEES')).toBe('financial');
    });

    it('should map unknown categories to other', () => {
      expect(normalizePlaidCategory('UNKNOWN_CATEGORY')).toBe('other');
      expect(normalizePlaidCategory('')).toBe('other');
    });
  });
});

describe('detectRecurringMerchants', () => {
  it('should detect Netflix as recurring monthly', () => {
    const transactions: Transaction[] = [];

    // Generate 3 months of Netflix charges
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      transactions.push({
        id: `txn_netflix_${i}`,
        providerTransactionId: `plaid_txn_netflix_${i}`,
        accountId: 'acc_001',
        amount: 15.99,
        currency: 'USD',
        date: date.toISOString().split('T')[0],
        merchantName: 'Netflix',
        merchantCategory: 'ENTERTAINMENT',
        merchantCategoryCode: '17001000',
        normalizedCategory: 'subscriptions',
        pending: false,
        paymentChannel: 'online',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const recurring = detectRecurringMerchants(transactions, 2);

    expect(recurring.length).toBe(1);
    expect(recurring[0].name).toBe('Netflix');
    expect(recurring[0].frequency).toBe('monthly');
    expect(recurring[0].averageAmount).toBeCloseTo(15.99);
    expect(recurring[0].occurrences).toBe(3);
  });

  it('should detect weekly patterns', () => {
    const transactions: Transaction[] = [];

    // Generate 4 weeks of Starbucks
    for (let i = 0; i < 4; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i * 7);

      transactions.push({
        id: `txn_starbucks_${i}`,
        providerTransactionId: `plaid_txn_starbucks_${i}`,
        accountId: 'acc_001',
        amount: 5.50 + Math.random() * 2, // Some variance
        currency: 'USD',
        date: date.toISOString().split('T')[0],
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

    const recurring = detectRecurringMerchants(transactions, 2);

    const starbucks = recurring.find(r => r.name === 'Starbucks');
    expect(starbucks).toBeDefined();
    expect(starbucks?.frequency).toBe('weekly');
  });

  it('should require minimum occurrences', () => {
    const transactions: Transaction[] = [{
      id: 'txn_single',
      providerTransactionId: 'plaid_txn_single',
      accountId: 'acc_001',
      amount: 50.00,
      currency: 'USD',
      date: '2025-01-15',
      merchantName: 'One Time Shop',
      merchantCategory: 'SHOPPING',
      merchantCategoryCode: '19013000',
      normalizedCategory: 'shopping',
      pending: false,
      paymentChannel: 'online',
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    }];

    const recurring = detectRecurringMerchants(transactions, 2);

    expect(recurring.length).toBe(0);
  });

  it('should calculate confidence based on consistency', () => {
    const transactions: Transaction[] = [];

    // 6 months of consistent Netflix
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      date.setDate(15); // Same day each month

      transactions.push({
        id: `txn_netflix_${i}`,
        providerTransactionId: `plaid_txn_netflix_${i}`,
        accountId: 'acc_001',
        amount: 15.99,
        currency: 'USD',
        date: date.toISOString().split('T')[0],
        merchantName: 'Netflix',
        merchantCategory: 'ENTERTAINMENT',
        merchantCategoryCode: '17001000',
        normalizedCategory: 'subscriptions',
        pending: false,
        paymentChannel: 'online',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const recurring = detectRecurringMerchants(transactions, 2);

    expect(recurring[0].confidence).toBeGreaterThan(0.8);
  });
});

describe('detectUnusualSpending', () => {
  it('should flag high amount transactions', () => {
    const transactions: Transaction[] = [];

    // Normal grocery transactions
    for (let i = 0; i < 10; i++) {
      transactions.push({
        id: `txn_grocery_${i}`,
        providerTransactionId: `plaid_txn_grocery_${i}`,
        accountId: 'acc_001',
        amount: 50 + Math.random() * 50, // $50-$100
        currency: 'USD',
        date: '2025-01-15',
        merchantName: 'Whole Foods',
        merchantCategory: 'FOOD_AND_DRINK',
        merchantCategoryCode: '19047000',
        normalizedCategory: 'food_dining',
        pending: false,
        paymentChannel: 'in_store',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Add a very high amount transaction
    transactions.push({
      id: 'txn_high',
      providerTransactionId: 'plaid_txn_high',
      accountId: 'acc_001',
      amount: 500.00, // Much higher than usual
      currency: 'USD',
      date: '2025-01-16',
      merchantName: 'Whole Foods',
      merchantCategory: 'FOOD_AND_DRINK',
      merchantCategoryCode: '19047000',
      normalizedCategory: 'food_dining',
      pending: false,
      paymentChannel: 'in_store',
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    });

    const unusual = detectUnusualSpending(transactions, 2.0);

    const highAmount = unusual.find(u => u.transactionId === 'txn_high');
    expect(highAmount).toBeDefined();
    expect(highAmount?.reason).toBe('high_amount');
    expect(highAmount?.anomalyScore).toBeGreaterThan(0.5);
  });

  it('should not flag merchants with insufficient history', () => {
    // New merchant detection requires > 5 unique merchants in history
    // With fewer merchants, no new_merchant flags should be generated
    const transactions: Transaction[] = [];

    // Only 3 merchants - below the threshold
    const merchants = ['Store A', 'Store B', 'Store C'];

    for (const merchant of merchants) {
      transactions.push({
        id: `txn_${merchant}`,
        providerTransactionId: `plaid_${merchant}`,
        accountId: 'acc_001',
        amount: 25.00,
        currency: 'USD',
        date: '2025-01-15',
        merchantName: merchant,
        merchantCategory: 'SHOPPING',
        merchantCategoryCode: '19013000',
        normalizedCategory: 'shopping',
        pending: false,
        paymentChannel: 'online',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const unusual = detectUnusualSpending(transactions, 2.0);

    // No new_merchant flags should be present since we have <= 5 merchants
    const newMerchantFlags = unusual.filter(u => u.reason === 'new_merchant');
    expect(newMerchantFlags.length).toBe(0);
  });
});

describe('aggregateSpendingByCategory', () => {
  it('should aggregate spending by category', () => {
    const transactions: Transaction[] = [
      {
        id: 'txn_1',
        providerTransactionId: 'plaid_1',
        accountId: 'acc_001',
        amount: 50.00,
        currency: 'USD',
        date: '2025-01-15',
        merchantName: 'Restaurant',
        merchantCategory: 'FOOD_AND_DRINK',
        merchantCategoryCode: '13005000',
        normalizedCategory: 'food_dining',
        pending: false,
        paymentChannel: 'in_store',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'txn_2',
        providerTransactionId: 'plaid_2',
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
      {
        id: 'txn_3',
        providerTransactionId: 'plaid_3',
        accountId: 'acc_001',
        amount: 100.00,
        currency: 'USD',
        date: '2025-01-17',
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

    const spending = aggregateSpendingByCategory(transactions);

    expect(spending.food_dining.total).toBe(80.00);
    expect(spending.food_dining.count).toBe(2);
    expect(spending.food_dining.average).toBe(40.00);

    expect(spending.shopping.total).toBe(100.00);
    expect(spending.shopping.count).toBe(1);
    expect(spending.shopping.average).toBe(100.00);
  });

  it('should calculate percentages correctly', () => {
    const transactions: Transaction[] = [
      {
        id: 'txn_1',
        providerTransactionId: 'plaid_1',
        accountId: 'acc_001',
        amount: 75.00,
        currency: 'USD',
        date: '2025-01-15',
        merchantName: 'Food',
        merchantCategory: 'FOOD_AND_DRINK',
        merchantCategoryCode: '13005000',
        normalizedCategory: 'food_dining',
        pending: false,
        paymentChannel: 'in_store',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'txn_2',
        providerTransactionId: 'plaid_2',
        accountId: 'acc_001',
        amount: 25.00,
        currency: 'USD',
        date: '2025-01-16',
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

    const spending = aggregateSpendingByCategory(transactions);

    // 75 / 100 = 0.75
    expect(spending.food_dining.percentage).toBeCloseTo(0.75);
    // 25 / 100 = 0.25
    expect(spending.shopping.percentage).toBeCloseTo(0.25);
  });

  it('should handle empty transactions', () => {
    const spending = aggregateSpendingByCategory([]);

    expect(spending.food_dining.total).toBe(0);
    expect(spending.food_dining.count).toBe(0);
    expect(spending.food_dining.percentage).toBe(0);
  });

  it('should exclude income from spending', () => {
    const transactions: Transaction[] = [
      {
        id: 'txn_1',
        providerTransactionId: 'plaid_1',
        accountId: 'acc_001',
        amount: 100.00,
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
        id: 'txn_income',
        providerTransactionId: 'plaid_income',
        accountId: 'acc_001',
        amount: -2000.00, // Income (negative)
        currency: 'USD',
        date: '2025-01-15',
        merchantName: 'Direct Deposit',
        merchantCategory: 'INCOME',
        merchantCategoryCode: '21011000',
        normalizedCategory: 'income',
        pending: false,
        paymentChannel: 'other',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const spending = aggregateSpendingByCategory(transactions);

    // Percentages should be based on spending only
    expect(spending.shopping.percentage).toBe(1.0);
    expect(spending.income.total).toBe(-2000.00);
  });
});

describe('TransactionFetcher', () => {
  it('should fetch transactions using mock client', async () => {
    const fetcher = createTransactionFetcher({
      useMock: true,
      transactionDays: 30,
    });

    const result = await fetcher.fetchTransactions('access-sandbox-test', 'user_123');

    expect(result.transactions.length).toBeGreaterThan(0);
    expect(result.transactions[0].normalizedCategory).toBeDefined();
  });

  it('should handle pagination', async () => {
    const fetcher = createTransactionFetcher({
      useMock: true,
      transactionDays: 90,
    });

    const result = await fetcher.fetchAllTransactions('access-sandbox-test', 'user_123');

    expect(result.transactions.length).toBeGreaterThan(0);
  });
});

describe('TransactionClassifier', () => {
  it('should classify transactions with IAB categories', async () => {
    const classifier = createTransactionClassifier({
      confidenceThreshold: 0.5,
      modelTier: 'fast',
    });

    const transaction: Transaction = {
      id: 'txn_classify_1',
      providerTransactionId: 'plaid_txn_classify_1',
      accountId: 'acc_001',
      amount: 250.00,
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
    };

    const classified = await classifier.classify(transaction, 'user_123');

    expect(classified.iabClassification).toBeDefined();
    expect(classified.iabClassification?.source).toBe('transaction');
    expect(classified.iabClassification?.sourceItemId).toBe('txn_classify_1');
  });

  it('should skip classification for low-value transactions', async () => {
    const classifier = createTransactionClassifier({
      confidenceThreshold: 0.5,
      modelTier: 'fast',
      minAmountForClassification: 10.00,
    });

    const transaction: Transaction = {
      id: 'txn_low_value',
      providerTransactionId: 'plaid_txn_low',
      accountId: 'acc_001',
      amount: 2.50, // Below threshold
      currency: 'USD',
      date: '2025-01-15',
      merchantName: 'Vending Machine',
      merchantCategory: 'FOOD_AND_DRINK',
      merchantCategoryCode: '13005000',
      normalizedCategory: 'food_dining',
      pending: false,
      paymentChannel: 'in_store',
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    const classified = await classifier.classify(transaction, 'user_123');

    // Classification should be skipped or minimal
    expect(classified.iabClassification).toBeUndefined();
  });

  it('should batch classify multiple transactions', async () => {
    const classifier = createTransactionClassifier({
      confidenceThreshold: 0.5,
      modelTier: 'fast',
    });

    const transactions: Transaction[] = [
      {
        id: 'txn_batch_1',
        providerTransactionId: 'plaid_batch_1',
        accountId: 'acc_001',
        amount: 50.00,
        currency: 'USD',
        date: '2025-01-15',
        merchantName: 'Amazon',
        merchantCategory: 'SHOPPING',
        merchantCategoryCode: '19013000',
        normalizedCategory: 'shopping',
        pending: false,
        paymentChannel: 'online',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'txn_batch_2',
        providerTransactionId: 'plaid_batch_2',
        accountId: 'acc_001',
        amount: 75.00,
        currency: 'USD',
        date: '2025-01-16',
        merchantName: 'Best Buy',
        merchantCategory: 'SHOPPING',
        merchantCategoryCode: '19013000',
        normalizedCategory: 'shopping',
        pending: false,
        paymentChannel: 'in_store',
        fetchedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const classified = await classifier.classifyBatch(transactions, 'user_123');

    expect(classified.length).toBe(2);
    classified.forEach(txn => {
      if (txn.amount >= 10) {
        expect(txn.iabClassification).toBeDefined();
      }
    });
  });
});
