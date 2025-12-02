/**
 * Email Package Types - Sprint 1b
 *
 * Types for email fetching and classification pipeline
 */

/**
 * Email provider types
 */
export type EmailProvider = 'microsoft' | 'google';

/**
 * Email message structure
 */
export interface Email {
  /** Unique email ID from provider */
  id: string;
  /** Email subject line */
  subject: string;
  /** Sender email address */
  from: string;
  /** Recipient email addresses */
  to: string[];
  /** Email body (text) */
  body: string;
  /** Email body (HTML) */
  bodyHtml?: string;
  /** Email date */
  date: Date;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Email fetch options
 */
export interface FetchOptions {
  /** Maximum number of emails to fetch */
  maxResults?: number;
  /** Only fetch emails after this date */
  after?: Date;
  /** Only fetch emails before this date */
  before?: Date;
  /** Only fetch from specific folders/labels */
  folders?: string[];
  /** Skip already processed email IDs */
  skipIds?: string[];
}

/**
 * Email fetch result
 */
export interface FetchResult {
  /** Fetched emails */
  emails: Email[];
  /** Next page token (for pagination) */
  nextPageToken?: string;
  /** Total count available */
  totalCount?: number;
  /** Errors encountered during fetch */
  errors?: string[];
}

/**
 * IAB classification result
 */
export interface IABClassification {
  /** Email ID this classification belongs to */
  emailId: string;
  /** IAB Tier 1 category (e.g., "Travel") */
  tier1Category: string;
  /** IAB Tier 1 ID (e.g., "IAB20") */
  tier1Id: string;
  /** IAB Tier 2 category (e.g., "Air Travel") */
  tier2Category?: string;
  /** IAB Tier 2 ID (e.g., "IAB20-1") */
  tier2Id?: string;
  /** Classification confidence (0-1) */
  confidence: number;
  /** Reasoning for classification */
  reasoning?: string;
  /** Timestamp of classification */
  classifiedAt: Date;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** User ID for memory store operations */
  userId: string;
  /** Email provider */
  provider: EmailProvider;
  /** Fetch options */
  fetchOptions?: FetchOptions;
  /** Whether to store raw emails (privacy consideration) */
  storeRawEmails?: boolean;
  /** Whether to run IAB classification */
  runClassification?: boolean;
}

/**
 * Pipeline result
 */
export interface PipelineResult {
  /** Number of emails fetched */
  emailsFetched: number;
  /** Number of emails classified */
  emailsClassified: number;
  /** Number of classifications stored */
  classificationsStored: number;
  /** Processing duration in milliseconds */
  durationMs: number;
  /** Errors encountered */
  errors: string[];
  /** Whether pipeline completed successfully */
  success: boolean;
}

/**
 * Email provider client interface
 */
export interface EmailProviderClient {
  /** Provider type */
  readonly provider: EmailProvider;

  /**
   * Fetch emails from provider
   * @param accessToken OAuth access token
   * @param options Fetch options
   * @returns Fetch result with emails
   */
  fetchEmails(accessToken: string, options?: FetchOptions): Promise<FetchResult>;

  /**
   * Test connection to provider
   * @param accessToken OAuth access token
   * @returns True if connection successful
   */
  testConnection(accessToken: string): Promise<boolean>;
}
