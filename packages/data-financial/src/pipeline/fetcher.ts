/**
 * Transaction Fetcher - Sprint 8
 *
 * Fetches transactions from Plaid (or mock) and normalizes them.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 */

import type { Transaction, FinancialPipelineConfig, PlaidAccount } from '../types.js';
import { createMockPlaidClient, type MockPlaidClient } from '../plaid/mock.js';
import { normalizeTransaction } from './normalizer.js';

/**
 * Fetcher configuration
 */
export interface FetcherConfig {
  /** Use mock Plaid client */
  useMock?: boolean;

  /** Days of transactions to fetch */
  transactionDays?: number;

  /** Page size for pagination */
  pageSize?: number;

  /** Maximum transactions to fetch (safety limit to prevent infinite loops) */
  maxTransactions?: number;
}

/**
 * Fetch result
 */
export interface FetchResult {
  /** Normalized transactions */
  transactions: Transaction[];

  /** Accounts fetched from */
  accounts: PlaidAccount[];

  /** Whether there are more transactions to fetch */
  hasMore: boolean;

  /** Cursor for pagination */
  nextCursor?: string;
}

/**
 * Transaction fetcher for getting financial data from Plaid
 */
export class TransactionFetcher {
  private config: Required<FetcherConfig>;
  private mockClient: MockPlaidClient | null = null;

  constructor(config: FetcherConfig = {}) {
    this.config = {
      useMock: config.useMock ?? true,
      transactionDays: config.transactionDays ?? 90,
      pageSize: config.pageSize ?? 100,
      maxTransactions: config.maxTransactions ?? 10000,
    };

    if (this.config.useMock) {
      this.mockClient = createMockPlaidClient({
        transactionCount: this.config.pageSize * 2, // Enough for testing pagination
        daysBack: this.config.transactionDays,
      });
    }
  }

  /**
   * Fetch a page of transactions
   */
  async fetchTransactions(
    accessToken: string,
    userId: string,
    cursor?: string
  ): Promise<FetchResult> {
    if (this.config.useMock && this.mockClient) {
      return this.fetchFromMock(accessToken, userId, cursor);
    }

    // Real Plaid implementation would go here
    throw new Error('Real Plaid client not implemented. Set useMock: true');
  }

  /**
   * Fetch from mock client
   */
  private async fetchFromMock(
    accessToken: string,
    userId: string,
    cursor?: string
  ): Promise<FetchResult> {
    if (!this.mockClient) {
      throw new Error('Mock client not initialized');
    }

    // Get accounts
    const accounts = await this.mockClient.getAccounts(accessToken);

    // Get transactions
    const response = await this.mockClient.transactionsSync(accessToken, cursor);

    // Normalize transactions
    const transactions = response.added.map(txn => normalizeTransaction(txn, userId));

    return {
      transactions,
      accounts,
      hasMore: response.hasMore,
      nextCursor: response.nextCursor || undefined,
    };
  }

  /**
   * Fetch all transactions (handles pagination)
   */
  async fetchAllTransactions(
    accessToken: string,
    userId: string
  ): Promise<FetchResult> {
    const allTransactions: Transaction[] = [];
    let accounts: PlaidAccount[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetchTransactions(accessToken, userId, cursor);

      allTransactions.push(...result.transactions);
      accounts = result.accounts;
      hasMore = result.hasMore;
      cursor = result.nextCursor;

      // Safety limit to prevent infinite loops (configurable)
      if (allTransactions.length >= this.config.maxTransactions) {
        break;
      }
    }

    return {
      transactions: allTransactions,
      accounts,
      hasMore: false,
    };
  }

  /**
   * Get accounts for an access token
   */
  async getAccounts(accessToken: string): Promise<PlaidAccount[]> {
    if (this.config.useMock && this.mockClient) {
      return this.mockClient.getAccounts(accessToken);
    }

    throw new Error('Real Plaid client not implemented. Set useMock: true');
  }
}

/**
 * Create a transaction fetcher with the given configuration
 */
export function createTransactionFetcher(config?: FetcherConfig): TransactionFetcher {
  return new TransactionFetcher(config);
}
