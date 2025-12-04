/**
 * Gmail OAuth Client - Sprint 1b Migration
 *
 * Now uses @ownyou/oauth package for OAuth flow and token management.
 * Extends GmailClient with OAuth 2.0 flow capabilities.
 *
 * Architecture:
 * - @ownyou/oauth: OAuth flow + token storage (Sprint 1b)
 * - GmailClient: Low-level Gmail API calls
 * - GmailOAuthClient: Integration layer (this file)
 *
 * Usage:
 * 1. const client = new GmailOAuthClient()
 * 2. await client.authorize() // Redirects to Google OAuth
 * 3. // Callback handled by /oauth/gmail/callback page using @ownyou/oauth
 * 4. const messages = await client.listMessages() // Use Gmail API
 *
 * @see packages/oauth/src/index.ts
 * @see docs/sprints/ownyou-sprint1b-spec.md
 */

'use client'

import { GmailClient, type GmailMessage } from './gmail-client'
import {
  startGoogleAuth,
  isGoogleConnected,
  getGoogleAccessToken,
  disconnectGoogle,
} from './oauth-integration'

export interface GmailOAuthConfig {
  client_id: string
  redirect_uri: string
  scopes: string[]
  auth_uri: string
  token_uri: string
}

export interface GmailTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
  expires_at: number
}

/**
 * Gmail OAuth Client with automatic token management
 *
 * Now delegates to @ownyou/oauth package via oauth-integration.ts
 */
export class GmailOAuthClient {
  private gmailClient: GmailClient | null = null

  constructor(_userId: string = 'default_user') {
    // userId is now handled by oauth-integration.ts
  }

  /**
   * Initiate Gmail OAuth flow (redirect to Google)
   * Uses @ownyou/oauth package via oauth-integration.ts
   */
  async authorize(): Promise<void> {
    await startGoogleAuth()
  }

  /**
   * Handle OAuth callback
   *
   * NOTE: Callback is now handled by /oauth/gmail/callback page
   * using @ownyou/oauth package directly. This method is deprecated.
   */
  async handleCallback(_code: string): Promise<GmailTokens> {
    // Callback is handled by the callback page using @ownyou/oauth
    // This method should not be called directly anymore
    throw new Error('handleCallback is deprecated - callback is handled by /oauth/gmail/callback page')
  }

  /**
   * Get valid access token (auto-refreshes if needed)
   * Uses @ownyou/oauth package via oauth-integration.ts
   */
  async getValidAccessToken(): Promise<string> {
    return await getGoogleAccessToken()
  }

  /**
   * Get initialized Gmail client (with auto token refresh)
   */
  async getClient(): Promise<GmailClient> {
    const accessToken = await this.getValidAccessToken()

    if (!this.gmailClient) {
      this.gmailClient = new GmailClient(accessToken)
    } else {
      this.gmailClient.updateAccessToken(accessToken)
    }

    return this.gmailClient
  }

  /**
   * List Gmail messages (with auto token refresh)
   */
  async listMessages(
    query?: string,
    maxResults: number = 100,
    pageToken?: string
  ): Promise<any> {
    const client = await this.getClient()
    return client.listMessages(query, maxResults, pageToken)
  }

  /**
   * Get single message (with auto token refresh)
   */
  async getMessage(messageId: string, format?: 'full' | 'metadata' | 'minimal' | 'raw'): Promise<GmailMessage> {
    const client = await this.getClient()
    return client.getMessage(messageId, format)
  }

  /**
   * Check if user has authorized Gmail access
   * Uses @ownyou/oauth package via oauth-integration.ts
   */
  async isAuthorized(): Promise<boolean> {
    return await isGoogleConnected()
  }

  /**
   * Revoke Gmail authorization (clear tokens)
   * Uses @ownyou/oauth package via oauth-integration.ts
   */
  async revokeAuthorization(): Promise<void> {
    await disconnectGoogle()
    this.gmailClient = null
  }
}

/**
 * Get GmailOAuthClient instance (singleton)
 */
let _gmailOAuthClient: GmailOAuthClient | null = null

export function getGmailOAuthClient(userId: string = 'default_user'): GmailOAuthClient {
  if (!_gmailOAuthClient) {
    _gmailOAuthClient = new GmailOAuthClient(userId)
  }
  return _gmailOAuthClient
}
