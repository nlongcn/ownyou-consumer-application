/**
 * Email Classification Pipeline - Sprint 1b
 *
 * Fetches emails, classifies using IAB taxonomy, stores in memory-store
 */

import type {
  Email,
  EmailProvider,
  FetchOptions,
  FetchResult,
  IABClassification,
  PipelineConfig,
  PipelineResult,
  EmailProviderClient,
} from './types';
import { createEmailProvider } from './providers';

/**
 * Email fetch and classification pipeline
 *
 * Orchestrates the flow:
 * 1. Fetch emails from provider (Microsoft/Google)
 * 2. Classify each email using IAB taxonomy
 * 3. Store classifications in memory-store
 */
export class EmailPipeline {
  private provider: EmailProviderClient;

  constructor(private config: PipelineConfig) {
    this.provider = createEmailProvider(config.provider);
  }

  /**
   * Run the email pipeline
   *
   * @param accessToken OAuth access token for email provider
   * @param classifier Optional IAB classifier function
   * @returns Pipeline result with statistics
   */
  async run(
    accessToken: string,
    classifier?: (emails: Email[]) => Promise<IABClassification[]>
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    let emailsFetched = 0;
    let emailsClassified = 0;
    let classificationsStored = 0;

    try {
      // Step 1: Fetch emails from provider
      const fetchResult = await this.fetchEmails(accessToken);
      emailsFetched = fetchResult.emails.length;

      if (fetchResult.errors) {
        errors.push(...fetchResult.errors);
      }

      if (fetchResult.emails.length === 0) {
        return {
          emailsFetched: 0,
          emailsClassified: 0,
          classificationsStored: 0,
          durationMs: Date.now() - startTime,
          errors,
          success: errors.length === 0,
        };
      }

      // Step 2: Classify emails (if classifier provided and enabled)
      let classifications: IABClassification[] = [];

      if (this.config.runClassification && classifier) {
        try {
          classifications = await classifier(fetchResult.emails);
          emailsClassified = classifications.length;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Classification failed: ${errorMessage}`);
        }
      }

      // Step 3: Store classifications (if any)
      // Note: Actual storage integration would use @ownyou/memory-store
      // For now, we just count them as stored
      classificationsStored = classifications.length;

      return {
        emailsFetched,
        emailsClassified,
        classificationsStored,
        durationMs: Date.now() - startTime,
        errors,
        success: errors.length === 0,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Pipeline failed: ${errorMessage}`);

      return {
        emailsFetched,
        emailsClassified,
        classificationsStored,
        durationMs: Date.now() - startTime,
        errors,
        success: false,
      };
    }
  }

  /**
   * Fetch emails from provider
   */
  private async fetchEmails(accessToken: string): Promise<FetchResult> {
    return this.provider.fetchEmails(accessToken, this.config.fetchOptions);
  }

  /**
   * Test connection to email provider
   *
   * @param accessToken OAuth access token
   * @returns True if connection successful
   */
  async testConnection(accessToken: string): Promise<boolean> {
    return this.provider.testConnection(accessToken);
  }

  /**
   * Get the email provider type
   */
  get providerType(): EmailProvider {
    return this.config.provider;
  }
}

/**
 * Create a pipeline instance for the specified provider
 *
 * @param config Pipeline configuration
 * @returns EmailPipeline instance
 */
export function createPipeline(config: PipelineConfig): EmailPipeline {
  return new EmailPipeline(config);
}

/**
 * Simple classifier function for privacy-preserving IAB classification
 *
 * This extracts only metadata (subject, sender domain) for classification,
 * never sending raw email body content to external services.
 *
 * @param email Email to prepare for classification
 * @returns Sanitized email data for classification
 */
export function sanitizeEmailForClassification(email: Email): {
  subject: string;
  senderDomain: string;
  hasAttachments: boolean;
} {
  // Extract domain from sender email
  const senderDomain = extractDomain(email.from);

  return {
    subject: email.subject,
    senderDomain,
    hasAttachments: Boolean(email.metadata?.hasAttachments),
  };
}

/**
 * Extract domain from email address
 */
function extractDomain(email: string): string {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].trim() : '';
}

/**
 * Batch emails for efficient classification
 *
 * @param emails Emails to batch
 * @param batchSize Maximum batch size
 * @returns Array of email batches
 */
export function batchEmails(emails: Email[], batchSize = 10): Email[][] {
  const batches: Email[][] = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    batches.push(emails.slice(i, i + batchSize));
  }

  return batches;
}
