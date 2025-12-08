/**
 * Mock Plaid Client - Sprint 8
 *
 * Mock implementation of Plaid API for development and testing.
 * Generates realistic transaction data without requiring Plaid credentials.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 */

import type {
  PlaidLinkToken,
  PlaidAccessToken,
  PlaidAccount,
  TransactionCategory,
} from '../types.js';

/**
 * Mock Plaid configuration
 */
export interface MockPlaidConfig {
  /** Number of transactions to generate */
  transactionCount?: number;

  /** Number of accounts to generate */
  accountCount?: number;

  /** Days of transaction history */
  daysBack?: number;

  /** Simulated failure rate (0-1) */
  failureRate?: number;

  /** Simulated latency in ms */
  latencyMs?: number;

  /** Whether to throw on invalid tokens */
  invalidTokenError?: boolean;
}

/**
 * Mock merchant data structure
 */
export interface MockMerchant {
  name: string;
  category: string;
  categoryCode: string;
  amountRange: [number, number];
}

/**
 * Mock merchants by category
 */
export const MOCK_MERCHANTS: Record<TransactionCategory, MockMerchant[]> = {
  food_dining: [
    { name: 'Starbucks', category: 'FOOD_AND_DRINK', categoryCode: '13005000', amountRange: [3, 15] },
    { name: 'Chipotle Mexican Grill', category: 'FOOD_AND_DRINK', categoryCode: '13005000', amountRange: [10, 20] },
    { name: "McDonald's", category: 'FOOD_AND_DRINK', categoryCode: '13005000', amountRange: [5, 15] },
    { name: 'Whole Foods Market', category: 'FOOD_AND_DRINK', categoryCode: '19047000', amountRange: [30, 200] },
    { name: 'Trader Joe\'s', category: 'FOOD_AND_DRINK', categoryCode: '19047000', amountRange: [25, 150] },
    { name: 'DoorDash', category: 'FOOD_AND_DRINK', categoryCode: '13005000', amountRange: [15, 50] },
    { name: 'Uber Eats', category: 'FOOD_AND_DRINK', categoryCode: '13005000', amountRange: [15, 50] },
    { name: 'The Cheesecake Factory', category: 'FOOD_AND_DRINK', categoryCode: '13005000', amountRange: [30, 80] },
  ],
  shopping: [
    { name: 'Amazon', category: 'SHOPPING', categoryCode: '19013000', amountRange: [10, 500] },
    { name: 'Target', category: 'SHOPPING', categoryCode: '19013000', amountRange: [20, 200] },
    { name: 'Walmart', category: 'SHOPPING', categoryCode: '19013000', amountRange: [20, 300] },
    { name: 'Best Buy', category: 'SHOPPING', categoryCode: '19013000', amountRange: [50, 1000] },
    { name: 'Apple Store', category: 'SHOPPING', categoryCode: '19013000', amountRange: [50, 2000] },
    { name: 'Costco', category: 'SHOPPING', categoryCode: '19013000', amountRange: [100, 500] },
  ],
  entertainment: [
    { name: 'AMC Theatres', category: 'ENTERTAINMENT', categoryCode: '17001000', amountRange: [15, 50] },
    { name: 'Spotify', category: 'ENTERTAINMENT', categoryCode: '17001000', amountRange: [10, 20] },
    { name: 'PlayStation Network', category: 'ENTERTAINMENT', categoryCode: '17001000', amountRange: [10, 70] },
    { name: 'Steam Games', category: 'ENTERTAINMENT', categoryCode: '17001000', amountRange: [5, 60] },
  ],
  travel: [
    { name: 'United Airlines', category: 'TRAVEL', categoryCode: '22001000', amountRange: [200, 1500] },
    { name: 'Delta Air Lines', category: 'TRAVEL', categoryCode: '22001000', amountRange: [200, 1500] },
    { name: 'Marriott Hotels', category: 'TRAVEL', categoryCode: '22001000', amountRange: [100, 500] },
    { name: 'Airbnb', category: 'TRAVEL', categoryCode: '22001000', amountRange: [80, 400] },
    { name: 'Uber', category: 'TRAVEL', categoryCode: '22016000', amountRange: [10, 80] },
    { name: 'Lyft', category: 'TRAVEL', categoryCode: '22016000', amountRange: [10, 80] },
  ],
  health_fitness: [
    { name: 'Planet Fitness', category: 'HEALTH_AND_FITNESS', categoryCode: '18000000', amountRange: [10, 50] },
    { name: 'CVS Pharmacy', category: 'HEALTH_AND_FITNESS', categoryCode: '18000000', amountRange: [10, 100] },
    { name: 'Walgreens', category: 'HEALTH_AND_FITNESS', categoryCode: '18000000', amountRange: [10, 100] },
  ],
  education: [
    { name: 'Udemy', category: 'EDUCATION', categoryCode: '12000000', amountRange: [10, 200] },
    { name: 'Coursera', category: 'EDUCATION', categoryCode: '12000000', amountRange: [40, 80] },
    { name: 'Amazon Books', category: 'EDUCATION', categoryCode: '12000000', amountRange: [10, 50] },
  ],
  gifts_donations: [
    { name: 'American Red Cross', category: 'DONATIONS', categoryCode: '19000000', amountRange: [25, 200] },
    { name: 'GoFundMe', category: 'DONATIONS', categoryCode: '19000000', amountRange: [20, 100] },
    { name: 'Etsy', category: 'SHOPPING', categoryCode: '19013000', amountRange: [20, 150] },
  ],
  personal_care: [
    { name: 'Sephora', category: 'PERSONAL_CARE', categoryCode: '18024000', amountRange: [30, 200] },
    { name: 'Great Clips', category: 'PERSONAL_CARE', categoryCode: '18024000', amountRange: [15, 50] },
  ],
  home: [
    { name: 'Home Depot', category: 'HOME_IMPROVEMENT', categoryCode: '18000000', amountRange: [20, 500] },
    { name: 'IKEA', category: 'HOME_IMPROVEMENT', categoryCode: '18000000', amountRange: [50, 500] },
    { name: 'PG&E', category: 'UTILITIES', categoryCode: '18068000', amountRange: [50, 200] },
  ],
  transportation: [
    { name: 'Shell', category: 'TRANSPORTATION', categoryCode: '22009000', amountRange: [30, 80] },
    { name: 'Chevron', category: 'TRANSPORTATION', categoryCode: '22009000', amountRange: [30, 80] },
    { name: 'SFMTA', category: 'TRANSPORTATION', categoryCode: '22016000', amountRange: [3, 20] },
  ],
  subscriptions: [
    { name: 'Netflix', category: 'ENTERTAINMENT', categoryCode: '17001000', amountRange: [15, 25] },
    { name: 'Disney+', category: 'ENTERTAINMENT', categoryCode: '17001000', amountRange: [8, 15] },
    { name: 'HBO Max', category: 'ENTERTAINMENT', categoryCode: '17001000', amountRange: [15, 20] },
    { name: 'Adobe Creative Cloud', category: 'SOFTWARE', categoryCode: '12000000', amountRange: [50, 60] },
    { name: 'Microsoft 365', category: 'SOFTWARE', categoryCode: '12000000', amountRange: [10, 15] },
    { name: 'Dropbox', category: 'SOFTWARE', categoryCode: '12000000', amountRange: [10, 15] },
  ],
  financial: [
    { name: 'Chase Bank Fee', category: 'BANK_FEES', categoryCode: '10000000', amountRange: [5, 35] },
    { name: 'Venmo', category: 'TRANSFER', categoryCode: '21000000', amountRange: [10, 500] },
  ],
  income: [
    { name: 'Direct Deposit', category: 'INCOME', categoryCode: '21011000', amountRange: [-5000, -2000] },
    { name: 'Refund', category: 'INCOME', categoryCode: '21011000', amountRange: [-100, -10] },
  ],
  other: [
    { name: 'Unknown Merchant', category: 'OTHER', categoryCode: '00000000', amountRange: [5, 100] },
  ],
};

/**
 * Raw Plaid transaction structure (as returned by Plaid API)
 */
export interface PlaidRawTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string;
  date: string;
  merchant_name: string | null;
  name: string;
  pending: boolean;
  payment_channel: 'online' | 'in store' | 'other';
  personal_finance_category: {
    primary: string;
    detailed: string;
  } | null;
  location: {
    city: string | null;
    region: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
  } | null;
}

/**
 * Plaid transactionsSync response structure
 */
export interface PlaidTransactionsSyncResponse {
  added: PlaidRawTransaction[];
  modified: PlaidRawTransaction[];
  removed: { transaction_id: string }[];
  hasMore: boolean;
  nextCursor: string;
}

/**
 * Mock Plaid Client for development and testing
 */
export class MockPlaidClient {
  private config: Required<MockPlaidConfig>;
  private cursors: Map<string, number> = new Map();

  constructor(config: MockPlaidConfig = {}) {
    this.config = {
      transactionCount: config.transactionCount ?? 100,
      accountCount: config.accountCount ?? 2,
      daysBack: config.daysBack ?? 90,
      failureRate: config.failureRate ?? 0,
      latencyMs: config.latencyMs ?? 0,
      invalidTokenError: config.invalidTokenError ?? false,
    };
  }

  private async simulateLatency(): Promise<void> {
    if (this.config.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.latencyMs));
    }
  }

  private checkFailure(): void {
    if (this.config.failureRate > 0 && Math.random() < this.config.failureRate) {
      throw new Error('PLAID_ERROR: Simulated failure');
    }
  }

  private validateToken(token: string): void {
    if (this.config.invalidTokenError && (!token || token.length === 0)) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
  }

  /**
   * Create a link token for Plaid Link
   */
  async createLinkToken(userId: string): Promise<PlaidLinkToken> {
    await this.simulateLatency();
    this.checkFailure();

    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 15);

    return {
      linkToken: `link-sandbox-${randomPart}-${timestamp}`,
      expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      requestId: `req-${randomPart}`,
    };
  }

  /**
   * Exchange public token for access token
   */
  async exchangePublicToken(publicToken: string): Promise<PlaidAccessToken> {
    await this.simulateLatency();
    this.checkFailure();

    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 15);

    const institutions = [
      { id: 'ins_1', name: 'Chase' },
      { id: 'ins_2', name: 'Bank of America' },
      { id: 'ins_3', name: 'Wells Fargo' },
      { id: 'ins_4', name: 'Citibank' },
    ];

    const institution = institutions[Math.floor(Math.random() * institutions.length)];

    return {
      accessToken: `access-sandbox-${randomPart}-${timestamp}`,
      itemId: `item-sandbox-${randomPart}`,
      institutionId: institution.id,
      institutionName: institution.name,
      createdAt: timestamp,
    };
  }

  /**
   * Get accounts for an item
   */
  async getAccounts(accessToken: string): Promise<PlaidAccount[]> {
    await this.simulateLatency();
    this.checkFailure();
    this.validateToken(accessToken);

    return generateMockAccounts(this.config.accountCount);
  }

  /**
   * Sync transactions (incremental fetch)
   */
  async transactionsSync(
    accessToken: string,
    cursor?: string
  ): Promise<PlaidTransactionsSyncResponse> {
    await this.simulateLatency();
    this.checkFailure();
    this.validateToken(accessToken);

    // Generate accounts first to get account IDs
    const accounts = generateMockAccounts(this.config.accountCount);
    const accountIds = accounts.map(a => a.accountId);

    // Track cursor position for pagination
    const cursorKey = accessToken;
    let offset = cursor ? (this.cursors.get(cursorKey) || 0) : 0;

    const pageSize = 50;
    const totalTransactions = this.config.transactionCount;

    // Generate transactions for this page
    const transactionsToGenerate = Math.min(pageSize, totalTransactions - offset);
    const transactions: PlaidRawTransaction[] = [];

    for (let i = 0; i < transactionsToGenerate; i++) {
      const accountId = accountIds[Math.floor(Math.random() * accountIds.length)];
      const txns = generateMockTransactions(1, accountId, this.config.daysBack);
      transactions.push(txns[0]);
    }

    // Update cursor
    const newOffset = offset + transactionsToGenerate;
    this.cursors.set(cursorKey, newOffset);

    const hasMore = newOffset < totalTransactions;

    return {
      added: transactions,
      modified: [],
      removed: [],
      hasMore,
      nextCursor: hasMore ? `cursor-${newOffset}` : '',
    };
  }
}

/**
 * Generate mock transactions
 */
export function generateMockTransactions(
  count: number,
  accountId: string,
  daysBack: number = 90
): PlaidRawTransaction[] {
  const transactions: PlaidRawTransaction[] = [];
  const now = new Date();

  // Weight categories by realistic frequency
  const categoryWeights: { category: TransactionCategory; weight: number }[] = [
    { category: 'food_dining', weight: 30 },
    { category: 'shopping', weight: 20 },
    { category: 'transportation', weight: 15 },
    { category: 'subscriptions', weight: 10 },
    { category: 'entertainment', weight: 8 },
    { category: 'health_fitness', weight: 5 },
    { category: 'home', weight: 4 },
    { category: 'travel', weight: 3 },
    { category: 'personal_care', weight: 2 },
    { category: 'gifts_donations', weight: 2 },
    { category: 'education', weight: 1 },
  ];

  const totalWeight = categoryWeights.reduce((sum, cw) => sum + cw.weight, 0);

  for (let i = 0; i < count; i++) {
    // Pick a category based on weights
    let random = Math.random() * totalWeight;
    let selectedCategory: TransactionCategory = 'other';

    for (const cw of categoryWeights) {
      random -= cw.weight;
      if (random <= 0) {
        selectedCategory = cw.category;
        break;
      }
    }

    // Pick a merchant from the category
    const merchants = MOCK_MERCHANTS[selectedCategory];
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];

    // Generate random amount within range
    const [minAmount, maxAmount] = merchant.amountRange;
    let amount = minAmount + Math.random() * (maxAmount - minAmount);
    amount = Math.round(amount * 100) / 100; // Round to cents

    // Make income negative (credit to account)
    if (selectedCategory === 'income') {
      amount = -Math.abs(amount);
    }

    // Generate random date within range
    const daysAgo = Math.floor(Math.random() * daysBack);
    const txnDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const dateStr = txnDate.toISOString().split('T')[0];

    // Determine if pending (only recent transactions)
    const pending = daysAgo < 3 && Math.random() < 0.2;

    // Payment channel
    const channelOptions: ('online' | 'in store' | 'other')[] = ['online', 'in store', 'other'];
    const paymentChannel = selectedCategory === 'shopping' && Math.random() < 0.6
      ? 'online'
      : channelOptions[Math.floor(Math.random() * 2)]; // Exclude 'other' mostly

    transactions.push({
      transaction_id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      account_id: accountId,
      amount,
      iso_currency_code: 'USD',
      date: dateStr,
      merchant_name: merchant.name,
      name: merchant.name,
      pending,
      payment_channel: paymentChannel,
      personal_finance_category: {
        primary: merchant.category,
        detailed: merchant.category,
      },
      location: Math.random() < 0.3 ? {
        city: 'San Francisco',
        region: 'CA',
        country: 'US',
        lat: 37.7749 + (Math.random() - 0.5) * 0.1,
        lon: -122.4194 + (Math.random() - 0.5) * 0.1,
      } : null,
    });
  }

  return transactions;
}

/**
 * Generate mock accounts
 */
export function generateMockAccounts(count: number = 2): PlaidAccount[] {
  const accounts: PlaidAccount[] = [];

  // Always include a checking account
  accounts.push({
    accountId: `acc_checking_${Math.random().toString(36).substring(2, 10)}`,
    name: 'Checking',
    officialName: 'Premium Checking Account',
    type: 'depository',
    subtype: 'checking',
    currentBalance: 3000 + Math.random() * 7000,
    availableBalance: 2500 + Math.random() * 5000,
    mask: String(Math.floor(Math.random() * 9000) + 1000),
    currency: 'USD',
  });

  // Add credit card if more than 1 account
  if (count > 1) {
    accounts.push({
      accountId: `acc_credit_${Math.random().toString(36).substring(2, 10)}`,
      name: 'Credit Card',
      officialName: 'Rewards Credit Card',
      type: 'credit',
      subtype: 'credit card',
      currentBalance: -(500 + Math.random() * 2000),
      availableBalance: null,
      mask: String(Math.floor(Math.random() * 9000) + 1000),
      currency: 'USD',
    });
  }

  // Add savings if more than 2 accounts
  if (count > 2) {
    accounts.push({
      accountId: `acc_savings_${Math.random().toString(36).substring(2, 10)}`,
      name: 'Savings',
      officialName: 'High Yield Savings',
      type: 'depository',
      subtype: 'savings',
      currentBalance: 5000 + Math.random() * 20000,
      availableBalance: 5000 + Math.random() * 20000,
      mask: String(Math.floor(Math.random() * 9000) + 1000),
      currency: 'USD',
    });
  }

  return accounts.slice(0, count);
}

/**
 * Create a mock Plaid client with optional configuration
 */
export function createMockPlaidClient(config?: MockPlaidConfig): MockPlaidClient {
  return new MockPlaidClient(config);
}
