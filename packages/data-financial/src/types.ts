/**
 * Financial Data Types - Sprint 8
 *
 * Types for transaction data, financial profiles, and spending analysis.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 3.6.1
 */

import type { IABClassification } from '@ownyou/iab-classifier';

/**
 * Normalized transaction from Plaid or other financial providers
 */
export interface Transaction {
  /** Unique internal identifier */
  id: string;

  /** Provider's transaction ID (e.g., Plaid transaction_id) */
  providerTransactionId: string;

  /** Account ID this transaction belongs to */
  accountId: string;

  /** Transaction amount (positive for debits/purchases, negative for credits/refunds) */
  amount: number;

  /** ISO 4217 currency code (e.g., 'USD', 'EUR') */
  currency: string;

  /** Transaction date in ISO 8601 format (YYYY-MM-DD) */
  date: string;

  /** Merchant name as reported by provider */
  merchantName: string | null;

  /** Provider's merchant category (e.g., Plaid's personal_finance_category) */
  merchantCategory: string | null;

  /** Provider's detailed merchant category code */
  merchantCategoryCode: string | null;

  /** Our normalized spending category */
  normalizedCategory: TransactionCategory;

  /** IAB classification for advertising insights */
  iabClassification?: IABClassification;

  /** Whether transaction is pending (not yet posted) */
  pending: boolean;

  /** Payment channel */
  paymentChannel: PaymentChannel;

  /** Transaction location if available */
  location?: TransactionLocation;

  /** Unix timestamp when transaction was fetched */
  fetchedAt: number;

  /** Unix timestamp when transaction was last updated */
  updatedAt: number;
}

/**
 * Normalized transaction categories for OwnYou analysis
 */
export type TransactionCategory =
  | 'food_dining'         // Restaurants, groceries, food delivery
  | 'shopping'            // Retail, online shopping
  | 'entertainment'       // Movies, concerts, streaming
  | 'travel'              // Flights, hotels, transportation
  | 'health_fitness'      // Gym, medical, pharmacy
  | 'education'           // Courses, books, tuition
  | 'gifts_donations'     // Charity, gifts for others
  | 'personal_care'       // Salon, spa, personal products
  | 'home'                // Home improvement, utilities
  | 'transportation'      // Gas, parking, public transit
  | 'subscriptions'       // Recurring subscriptions
  | 'financial'           // Banking fees, transfers
  | 'income'              // Deposits, refunds
  | 'other';              // Uncategorized

/**
 * Payment channel for transaction
 */
export type PaymentChannel =
  | 'online'       // Online/e-commerce
  | 'in_store'     // Physical store purchase
  | 'other';       // ATM, check, etc.

/**
 * Transaction location data
 */
export interface TransactionLocation {
  /** City name */
  city?: string;

  /** State/region */
  region?: string;

  /** Country (ISO 3166-1 alpha-2) */
  country?: string;

  /** Latitude */
  lat?: number;

  /** Longitude */
  lon?: number;
}

/**
 * Recurring merchant pattern detected from transactions
 */
export interface RecurringMerchant {
  /** Merchant name */
  name: string;

  /** Detected frequency of charges */
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

  /** Average transaction amount */
  averageAmount: number;

  /** Currency */
  currency: string;

  /** Normalized category */
  category: TransactionCategory;

  /** ISO date of last transaction */
  lastTransaction: string;

  /** Number of occurrences detected */
  occurrences: number;

  /** Confidence in recurrence pattern (0-1) */
  confidence: number;
}

/**
 * Aggregated financial profile for a user
 */
export interface FinancialProfile {
  /** User ID this profile belongs to */
  userId: string;

  /** Unix timestamp of last sync */
  lastSync: number;

  /** Total transactions analyzed */
  transactionCount: number;

  /** Date range of analyzed transactions */
  dateRange: {
    earliest: string;  // ISO date
    latest: string;    // ISO date
  };

  /** Spending aggregated by category */
  spendingByCategory: Record<TransactionCategory, CategorySpending>;

  /** Detected recurring merchants/subscriptions */
  recurringMerchants: RecurringMerchant[];

  /** Transactions flagged as unusual spending */
  unusualSpending: UnusualTransaction[];

  /** Gift purchases (for Ikigai "Giving" dimension) */
  giftPurchases: TransactionSummary[];

  /** Experience spending - concerts, travel, dining out (for Ikigai "Experiences") */
  experienceSpending: TransactionSummary[];

  /** Hobby spending - sports, crafts, hobbies (for Ikigai "Interests") */
  hobbySpending: TransactionSummary[];

  /** Top merchants by spend */
  topMerchants: MerchantSummary[];
}

/**
 * Spending summary for a category
 */
export interface CategorySpending {
  /** Total amount spent in this category */
  total: number;

  /** Number of transactions */
  count: number;

  /** Average transaction amount */
  average: number;

  /** Percentage of total spending */
  percentage: number;

  /** Month-over-month change (-1 to 1, where 0.1 = 10% increase) */
  trend?: number;
}

/**
 * Transaction flagged as unusual
 */
export interface UnusualTransaction {
  /** Transaction ID */
  transactionId: string;

  /** Reason flagged as unusual */
  reason: UnusualReason;

  /** Transaction amount */
  amount: number;

  /** Merchant name */
  merchantName: string | null;

  /** Date */
  date: string;

  /** How unusual (0-1, 1 = very unusual) */
  anomalyScore: number;
}

/**
 * Reasons a transaction might be flagged as unusual
 */
export type UnusualReason =
  | 'high_amount'           // Much higher than typical for this category
  | 'new_merchant'          // First time at this merchant
  | 'unusual_category'      // Category user doesn't typically use
  | 'unusual_location'      // Transaction in unusual location
  | 'unusual_time';         // Unusual time of day/week

/**
 * Summary of a transaction for profile aggregation
 */
export interface TransactionSummary {
  /** Transaction ID */
  transactionId: string;

  /** Amount */
  amount: number;

  /** Merchant name */
  merchantName: string | null;

  /** Date */
  date: string;

  /** Category */
  category: TransactionCategory;
}

/**
 * Summary of spending at a merchant
 */
export interface MerchantSummary {
  /** Merchant name */
  name: string;

  /** Total amount spent */
  totalSpent: number;

  /** Number of transactions */
  transactionCount: number;

  /** Primary category */
  category: TransactionCategory;

  /** Last transaction date */
  lastTransaction: string;
}

/**
 * Configuration for financial data pipeline
 */
export interface FinancialPipelineConfig {
  /** Plaid environment */
  plaidEnvironment: 'sandbox' | 'development' | 'production';

  /** Use mock data instead of real Plaid */
  useMock: boolean;

  /** Number of days of transactions to fetch */
  transactionDays: number;

  /** Minimum confidence for IAB classification */
  iabConfidenceThreshold: number;

  /** Threshold for flagging high amount transactions (multiplier of category average) */
  highAmountThreshold: number;

  /** Minimum occurrences to detect recurring merchant */
  recurringMinOccurrences: number;

  /** Model tier for classification */
  modelTier: 'fast' | 'standard' | 'quality';

  /** Optional model overrides by tier */
  modelOverrides?: Partial<Record<'fast' | 'standard' | 'quality', string>>;
}

/**
 * Default configuration values
 */
export const DEFAULT_FINANCIAL_CONFIG: FinancialPipelineConfig = {
  plaidEnvironment: 'sandbox',
  useMock: true,
  transactionDays: 90,
  iabConfidenceThreshold: 0.7,
  highAmountThreshold: 3.0,  // 3x the category average
  recurringMinOccurrences: 2,
  modelTier: 'standard',
};

/**
 * Result of syncing financial data
 */
export interface FinancialSyncResult {
  /** Whether sync was successful */
  success: boolean;

  /** Number of new transactions */
  newTransactions: number;

  /** Number of updated transactions */
  updatedTransactions: number;

  /** Number of removed transactions */
  removedTransactions: number;

  /** Number of transactions classified by IAB */
  classifiedCount: number;

  /** Error message if failed */
  error?: string;

  /** Unix timestamp when sync completed */
  syncedAt: number;
}

/**
 * Plaid Link token response
 */
export interface PlaidLinkToken {
  /** Link token for Plaid Link */
  linkToken: string;

  /** Expiration timestamp */
  expiration: string;

  /** Request ID for debugging */
  requestId: string;
}

/**
 * Plaid access token (stored securely)
 */
export interface PlaidAccessToken {
  /** Access token for Plaid API */
  accessToken: string;

  /** Item ID */
  itemId: string;

  /** Institution ID */
  institutionId: string;

  /** Institution name */
  institutionName: string;

  /** Unix timestamp when token was obtained */
  createdAt: number;
}

/**
 * Plaid account information
 */
export interface PlaidAccount {
  /** Plaid account ID */
  accountId: string;

  /** Account name */
  name: string;

  /** Official account name */
  officialName: string | null;

  /** Account type */
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';

  /** Account subtype */
  subtype: string | null;

  /** Current balance */
  currentBalance: number | null;

  /** Available balance */
  availableBalance: number | null;

  /** Account mask (last 4 digits) */
  mask: string | null;

  /** Currency */
  currency: string;
}
