/**
 * Types Tests - Sprint 8
 *
 * Tests for financial data types and default configurations.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FINANCIAL_CONFIG,
  type Transaction,
  type FinancialProfile,
  type RecurringMerchant,
  type TransactionCategory,
  type CategorySpending,
  type UnusualTransaction,
  type FinancialSyncResult,
  type PlaidAccount,
  type FinancialPipelineConfig,
} from '../types.js';

describe('DEFAULT_FINANCIAL_CONFIG', () => {
  it('should have sensible default values', () => {
    expect(DEFAULT_FINANCIAL_CONFIG.plaidEnvironment).toBe('sandbox');
    expect(DEFAULT_FINANCIAL_CONFIG.useMock).toBe(true);
    expect(DEFAULT_FINANCIAL_CONFIG.transactionDays).toBe(90);
    expect(DEFAULT_FINANCIAL_CONFIG.iabConfidenceThreshold).toBe(0.7);
    expect(DEFAULT_FINANCIAL_CONFIG.highAmountThreshold).toBe(3.0);
    expect(DEFAULT_FINANCIAL_CONFIG.recurringMinOccurrences).toBe(2);
    expect(DEFAULT_FINANCIAL_CONFIG.modelTier).toBe('standard');
  });

  it('should not have model overrides by default', () => {
    expect(DEFAULT_FINANCIAL_CONFIG.modelOverrides).toBeUndefined();
  });

  it('should have confidence threshold in valid range', () => {
    expect(DEFAULT_FINANCIAL_CONFIG.iabConfidenceThreshold).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_FINANCIAL_CONFIG.iabConfidenceThreshold).toBeLessThanOrEqual(1);
  });
});

describe('Transaction type structure', () => {
  it('should create a valid transaction object', () => {
    const transaction: Transaction = {
      id: 'txn_001',
      providerTransactionId: 'plaid_txn_abc123',
      accountId: 'acc_001',
      amount: 42.50,
      currency: 'USD',
      date: '2025-01-15',
      merchantName: 'Starbucks',
      merchantCategory: 'Food and Drink',
      merchantCategoryCode: '5812',
      normalizedCategory: 'food_dining',
      pending: false,
      paymentChannel: 'in_store',
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(transaction.id).toBe('txn_001');
    expect(transaction.amount).toBe(42.50);
    expect(transaction.normalizedCategory).toBe('food_dining');
    expect(transaction.pending).toBe(false);
  });

  it('should allow optional fields to be undefined', () => {
    const transaction: Transaction = {
      id: 'txn_002',
      providerTransactionId: 'plaid_txn_def456',
      accountId: 'acc_001',
      amount: 100.00,
      currency: 'USD',
      date: '2025-01-16',
      merchantName: null,
      merchantCategory: null,
      merchantCategoryCode: null,
      normalizedCategory: 'other',
      pending: true,
      paymentChannel: 'online',
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(transaction.iabClassification).toBeUndefined();
    expect(transaction.location).toBeUndefined();
    expect(transaction.merchantName).toBeNull();
  });

  it('should include location when provided', () => {
    const transaction: Transaction = {
      id: 'txn_003',
      providerTransactionId: 'plaid_txn_ghi789',
      accountId: 'acc_001',
      amount: 75.00,
      currency: 'USD',
      date: '2025-01-17',
      merchantName: 'Local Restaurant',
      merchantCategory: 'Restaurants',
      merchantCategoryCode: '5812',
      normalizedCategory: 'food_dining',
      pending: false,
      paymentChannel: 'in_store',
      location: {
        city: 'San Francisco',
        region: 'CA',
        country: 'US',
        lat: 37.7749,
        lon: -122.4194,
      },
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(transaction.location?.city).toBe('San Francisco');
    expect(transaction.location?.lat).toBeCloseTo(37.7749);
  });
});

describe('TransactionCategory type', () => {
  it('should accept all valid categories', () => {
    const categories: TransactionCategory[] = [
      'food_dining',
      'shopping',
      'entertainment',
      'travel',
      'health_fitness',
      'education',
      'gifts_donations',
      'personal_care',
      'home',
      'transportation',
      'subscriptions',
      'financial',
      'income',
      'other',
    ];

    expect(categories).toHaveLength(14);
    categories.forEach(cat => {
      expect(typeof cat).toBe('string');
    });
  });
});

describe('FinancialProfile type structure', () => {
  it('should create a valid financial profile', () => {
    const profile: FinancialProfile = {
      userId: 'user_123',
      lastSync: Date.now(),
      transactionCount: 150,
      dateRange: {
        earliest: '2024-10-15',
        latest: '2025-01-15',
      },
      spendingByCategory: {
        food_dining: { total: 500, count: 25, average: 20, percentage: 0.25 },
        shopping: { total: 300, count: 10, average: 30, percentage: 0.15 },
        entertainment: { total: 0, count: 0, average: 0, percentage: 0 },
        travel: { total: 0, count: 0, average: 0, percentage: 0 },
        health_fitness: { total: 0, count: 0, average: 0, percentage: 0 },
        education: { total: 0, count: 0, average: 0, percentage: 0 },
        gifts_donations: { total: 0, count: 0, average: 0, percentage: 0 },
        personal_care: { total: 0, count: 0, average: 0, percentage: 0 },
        home: { total: 0, count: 0, average: 0, percentage: 0 },
        transportation: { total: 0, count: 0, average: 0, percentage: 0 },
        subscriptions: { total: 0, count: 0, average: 0, percentage: 0 },
        financial: { total: 0, count: 0, average: 0, percentage: 0 },
        income: { total: 0, count: 0, average: 0, percentage: 0 },
        other: { total: 0, count: 0, average: 0, percentage: 0 },
      },
      recurringMerchants: [],
      unusualSpending: [],
      giftPurchases: [],
      experienceSpending: [],
      hobbySpending: [],
      topMerchants: [],
    };

    expect(profile.userId).toBe('user_123');
    expect(profile.transactionCount).toBe(150);
    expect(profile.spendingByCategory.food_dining.total).toBe(500);
  });

  it('should include recurring merchants', () => {
    const recurring: RecurringMerchant = {
      name: 'Netflix',
      frequency: 'monthly',
      averageAmount: 15.99,
      currency: 'USD',
      category: 'subscriptions',
      lastTransaction: '2025-01-01',
      occurrences: 12,
      confidence: 0.95,
    };

    expect(recurring.name).toBe('Netflix');
    expect(recurring.frequency).toBe('monthly');
    expect(recurring.confidence).toBeGreaterThan(0.9);
  });

  it('should include unusual spending with anomaly scores', () => {
    const unusual: UnusualTransaction = {
      transactionId: 'txn_unusual_001',
      reason: 'high_amount',
      amount: 500.00,
      merchantName: 'Electronics Store',
      date: '2025-01-10',
      anomalyScore: 0.85,
    };

    expect(unusual.reason).toBe('high_amount');
    expect(unusual.anomalyScore).toBeGreaterThan(0.8);
  });
});

describe('CategorySpending type', () => {
  it('should calculate percentages correctly', () => {
    const spending: CategorySpending = {
      total: 250,
      count: 10,
      average: 25,
      percentage: 0.25,
      trend: 0.1, // 10% increase
    };

    expect(spending.total).toBe(250);
    expect(spending.average).toBe(spending.total / spending.count);
    expect(spending.percentage).toBe(0.25);
    expect(spending.trend).toBe(0.1);
  });

  it('should allow trend to be undefined', () => {
    const spending: CategorySpending = {
      total: 100,
      count: 5,
      average: 20,
      percentage: 0.10,
    };

    expect(spending.trend).toBeUndefined();
  });
});

describe('FinancialSyncResult type', () => {
  it('should represent a successful sync', () => {
    const result: FinancialSyncResult = {
      success: true,
      newTransactions: 25,
      updatedTransactions: 3,
      removedTransactions: 1,
      classifiedCount: 23,
      syncedAt: Date.now(),
    };

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.classifiedCount).toBeLessThanOrEqual(
      result.newTransactions + result.updatedTransactions
    );
  });

  it('should represent a failed sync with error', () => {
    const result: FinancialSyncResult = {
      success: false,
      newTransactions: 0,
      updatedTransactions: 0,
      removedTransactions: 0,
      classifiedCount: 0,
      error: 'PLAID_ERROR: Invalid access token',
      syncedAt: Date.now(),
    };

    expect(result.success).toBe(false);
    expect(result.error).toContain('PLAID_ERROR');
  });
});

describe('PlaidAccount type', () => {
  it('should create a valid checking account', () => {
    const account: PlaidAccount = {
      accountId: 'acc_checking_001',
      name: 'Checking',
      officialName: 'Premium Checking Account',
      type: 'depository',
      subtype: 'checking',
      currentBalance: 5000.00,
      availableBalance: 4500.00,
      mask: '1234',
      currency: 'USD',
    };

    expect(account.type).toBe('depository');
    expect(account.currentBalance).toBe(5000.00);
    expect(account.mask).toBe('1234');
  });

  it('should create a valid credit card account', () => {
    const account: PlaidAccount = {
      accountId: 'acc_credit_001',
      name: 'Credit Card',
      officialName: 'Rewards Credit Card',
      type: 'credit',
      subtype: 'credit card',
      currentBalance: -250.00, // Negative for credit
      availableBalance: null,
      mask: '5678',
      currency: 'USD',
    };

    expect(account.type).toBe('credit');
    expect(account.currentBalance).toBeLessThan(0);
  });

  it('should handle accounts with missing balances', () => {
    const account: PlaidAccount = {
      accountId: 'acc_investment_001',
      name: 'Investment',
      officialName: null,
      type: 'investment',
      subtype: 'brokerage',
      currentBalance: null,
      availableBalance: null,
      mask: '9012',
      currency: 'USD',
    };

    expect(account.currentBalance).toBeNull();
    expect(account.availableBalance).toBeNull();
    expect(account.officialName).toBeNull();
  });
});

describe('FinancialPipelineConfig customization', () => {
  it('should allow custom configuration', () => {
    const customConfig: FinancialPipelineConfig = {
      ...DEFAULT_FINANCIAL_CONFIG,
      plaidEnvironment: 'production',
      useMock: false,
      transactionDays: 180,
      iabConfidenceThreshold: 0.8,
      modelTier: 'quality',
      modelOverrides: {
        quality: 'claude-3-opus-20240229',
      },
    };

    expect(customConfig.plaidEnvironment).toBe('production');
    expect(customConfig.useMock).toBe(false);
    expect(customConfig.transactionDays).toBe(180);
    expect(customConfig.modelOverrides?.quality).toBe('claude-3-opus-20240229');
  });

  it('should preserve defaults when partially overriding', () => {
    const partialConfig: FinancialPipelineConfig = {
      ...DEFAULT_FINANCIAL_CONFIG,
      useMock: false,
    };

    expect(partialConfig.useMock).toBe(false);
    expect(partialConfig.plaidEnvironment).toBe('sandbox'); // Preserved default
    expect(partialConfig.transactionDays).toBe(90); // Preserved default
  });
});
