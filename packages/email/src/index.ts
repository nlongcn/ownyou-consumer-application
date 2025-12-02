/**
 * @ownyou/email - Sprint 1b
 *
 * Email fetching and IAB classification pipeline for Microsoft and Google providers
 */

// Types
export type {
  Email,
  EmailProvider,
  EmailProviderClient,
  FetchOptions,
  FetchResult,
  IABClassification,
  PipelineConfig,
  PipelineResult,
} from './types';

// Providers
export {
  MicrosoftEmailProvider,
  GoogleEmailProvider,
  createEmailProvider,
} from './providers';

// Pipeline
export {
  EmailPipeline,
  createPipeline,
  sanitizeEmailForClassification,
  batchEmails,
} from './pipeline';
