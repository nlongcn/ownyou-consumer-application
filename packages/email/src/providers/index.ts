/**
 * Email Providers - Sprint 1b
 *
 * Re-exports all email provider implementations
 */

export { MicrosoftEmailProvider } from './microsoft';
export { GoogleEmailProvider } from './google';

// Re-export types
export type { EmailProviderClient } from '../types';

import type { EmailProvider, EmailProviderClient } from '../types';
import { MicrosoftEmailProvider } from './microsoft';
import { GoogleEmailProvider } from './google';

/**
 * Create email provider client for given provider type
 *
 * @param provider Provider type
 * @returns Email provider client
 */
export function createEmailProvider(provider: EmailProvider): EmailProviderClient {
  switch (provider) {
    case 'microsoft':
      return new MicrosoftEmailProvider();
    case 'google':
      return new GoogleEmailProvider();
    default:
      throw new Error(`Unknown email provider: ${provider}`);
  }
}
