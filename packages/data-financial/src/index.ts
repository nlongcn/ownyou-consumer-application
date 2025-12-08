/**
 * @ownyou/data-financial - Financial Data Connector
 *
 * Sprint 8 package for connecting to financial data sources (Plaid),
 * normalizing transactions, and classifying them for advertising insights.
 *
 * @see docs/sprints/ownyou-sprint8-spec.md
 */

// Types
export type {
  Transaction,
  TransactionCategory,
  PaymentChannel,
  TransactionLocation,
  RecurringMerchant,
  FinancialProfile,
  CategorySpending,
  UnusualTransaction,
  UnusualReason,
  TransactionSummary,
  MerchantSummary,
  FinancialPipelineConfig,
  FinancialSyncResult,
  PlaidLinkToken,
  PlaidAccessToken,
  PlaidAccount,
} from './types.js';

export { DEFAULT_FINANCIAL_CONFIG } from './types.js';

// Plaid Client (Mock)
export {
  MockPlaidClient,
  createMockPlaidClient,
  generateMockTransactions,
  generateMockAccounts,
  MOCK_MERCHANTS,
  type MockPlaidConfig,
  type MockMerchant,
  type PlaidRawTransaction,
  type PlaidTransactionsSyncResponse,
} from './plaid/mock.js';

// Pipeline - Normalizer
export {
  TransactionNormalizer,
  normalizeTransaction,
  normalizePlaidCategory,
  detectRecurringMerchants,
  detectUnusualSpending,
  aggregateSpendingByCategory,
} from './pipeline/normalizer.js';

// Pipeline - Fetcher
export {
  TransactionFetcher,
  createTransactionFetcher,
  type FetcherConfig,
  type FetchResult,
} from './pipeline/fetcher.js';

// Pipeline - Classifier
export {
  TransactionClassifier,
  createTransactionClassifier,
  type ClassifierConfig,
  type IABCategory,
  type IABClassification,
} from './pipeline/classifier.js';

// Store
export {
  FinancialStore,
  createFinancialStore,
  type Store,
  type PersistenceConfig,
} from './store/persistence.js';
