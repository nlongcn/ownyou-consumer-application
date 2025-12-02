/**
 * Gmail OAuth Client
 *
 * Extends GmailClient with OAuth 2.0 PKCE flow capabilities.
 * Handles token storage, refresh, and automatic token management.
 *
 * Architecture:
 * - GmailClient: Low-level Gmail API calls (existing)
 * - GmailOAuthClient: OAuth flow + token management (this file)
 *
 * Usage:
 * 1. const client = new GmailOAuthClient()
 * 2. await client.authorize() // Redirects to Google OAuth
 * 3. await client.handleCallback(code) // After OAuth callback
 * 4. const messages = await client.listMessages() // Use Gmail API
 */

'use client'

import { GmailClient, type GmailMessage } from './gmail-client'
import { generatePKCEPair, storeCodeVerifier, getStoredCodeVerifier, clearCodeVerifier } from './oauth/pkce'
import { IndexedDBStore } from '@browser/store/IndexedDBStore'

export interface GmailOAuthConfig {
  client_id: string
  // SECURITY: client_secret intentionally omitted - never exposed to browser
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
 */
export class GmailOAuthClient {
  private config: GmailOAuthConfig | null = null
  private gmailClient: GmailClient | null = null
  private store: IndexedDBStore
  private userId: string

  constructor(userId: string = 'default_user') {
    this.userId = userId
    this.store = new IndexedDBStore('ownyou_store')
  }

  /**
   * Initialize Gmail OAuth configuration from server
   */
  async initialize(): Promise<void> {
    const response = await fetch('/api/oauth/gmail-config')

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch Gmail OAuth configuration')
    }

    this.config = await response.json()
  }

  /**
   * Build Gmail OAuth authorization URL with PKCE
   */
  async buildAuthorizationUrl(): Promise<string> {
    if (!this.config) {
      await this.initialize()
    }

    if (!this.config) {
      throw new Error('Gmail OAuth configuration not initialized')
    }

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = await generatePKCEPair()

    // Store code_verifier in sessionStorage for callback
    storeCodeVerifier(codeVerifier, 'gmail')

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent to get refresh token
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: crypto.randomUUID(), // CSRF protection
    })

    return `${this.config.auth_uri}?${params.toString()}`
  }

  /**
   * Initiate Gmail OAuth flow (redirect to Google)
   */
  async authorize(): Promise<void> {
    const authUrl = await this.buildAuthorizationUrl()
    window.location.href = authUrl
  }

  /**
   * Handle OAuth callback
   *
   * NOTE: Token exchange happens SERVER-SIDE in /api/auth/gmail/callback
   * This method is called AFTER the server has already exchanged the code
   * and stored tokens in HTTP-only cookies.
   *
   * The browser just needs to verify the connection was successful.
   */
  async handleCallback(_code: string): Promise<GmailTokens> {
    // Clear code_verifier (one-time use)
    clearCodeVerifier('gmail')

    // Token exchange already happened server-side
    // Tokens are now stored in HTTP-only cookies
    // We just need to verify the connection and get token info

    // Check if we have a valid session by calling a server endpoint
    const response = await fetch('/api/gmail/status')

    if (!response.ok) {
      throw new Error('Gmail OAuth callback failed - no valid session')
    }

    const status = await response.json()

    if (!status.connected) {
      throw new Error('Gmail not connected after callback')
    }

    // Return token info from server (tokens themselves are in HTTP-only cookies)
    const gmailTokens: GmailTokens = {
      access_token: '[stored-in-httponly-cookie]', // Actual token in cookie
      refresh_token: status.hasRefreshToken ? '[stored-in-httponly-cookie]' : undefined,
      expires_in: status.expiresIn || 3600,
      token_type: 'Bearer',
      scope: status.scope || '',
      expires_at: status.expiresAt || Date.now() + 3600 * 1000,
    }

    // Store minimal token info in IndexedDB (not actual tokens)
    await this.storeTokens(gmailTokens)

    return gmailTokens
  }

  /**
   * Refresh access token using refresh token
   *
   * NOTE: Token refresh happens SERVER-SIDE in /api/gmail/refresh
   * This keeps client_secret secure on the server.
   */
  async refreshAccessToken(): Promise<GmailTokens> {
    // Call server endpoint to refresh token
    // Server has access to client_secret and refresh_token (in HTTP-only cookie)
    const response = await fetch('/api/gmail/refresh', {
      method: 'POST',
      credentials: 'include', // Include HTTP-only cookies
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || 'Token refresh failed - user needs to re-authorize')
    }

    const status = await response.json()

    const gmailTokens: GmailTokens = {
      access_token: '[stored-in-httponly-cookie]',
      refresh_token: status.hasRefreshToken ? '[stored-in-httponly-cookie]' : undefined,
      expires_in: status.expiresIn || 3600,
      token_type: 'Bearer',
      scope: status.scope || '',
      expires_at: status.expiresAt || Date.now() + 3600 * 1000,
    }

    // Update stored token info
    await this.storeTokens(gmailTokens)

    return gmailTokens
  }

  /**
   * Get valid access token (refreshes if expired)
   */
  async getValidAccessToken(): Promise<string> {
    const tokens = await this.getStoredTokens()

    if (!tokens) {
      throw new Error('No tokens available - user needs to authorize')
    }

    // Check if token is expired (with 5 minute buffer)
    if (Date.now() >= tokens.expires_at - 5 * 60 * 1000) {
      console.log('[Gmail OAuth] Access token expired, refreshing...')
      const newTokens = await this.refreshAccessToken()
      return newTokens.access_token
    }

    return tokens.access_token
  }

  /**
   * Get initialized Gmail client (with auto token refresh)
   */
  async getClient(): Promise<GmailClient> {
    if (!this.gmailClient) {
      const accessToken = await this.getValidAccessToken()
      this.gmailClient = new GmailClient(accessToken)
    } else {
      // Ensure token is still valid
      const accessToken = await this.getValidAccessToken()
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
   */
  async isAuthorized(): Promise<boolean> {
    const tokens = await this.getStoredTokens()
    return !!tokens?.access_token
  }

  /**
   * Revoke Gmail authorization (clear tokens)
   */
  async revokeAuthorization(): Promise<void> {
    const namespace = [this.userId, 'oauth_tokens']
    await this.store.delete(namespace, 'gmail')
    this.gmailClient = null
  }

  /**
   * Store tokens in IndexedDB
   */
  private async storeTokens(tokens: GmailTokens): Promise<void> {
    const namespace = [this.userId, 'oauth_tokens']
    await this.store.put(namespace, 'gmail', tokens)
  }

  /**
   * Retrieve tokens from IndexedDB
   */
  private async getStoredTokens(): Promise<GmailTokens | null> {
    const namespace = [this.userId, 'oauth_tokens']
    const item = await this.store.get(namespace, 'gmail')
    return (item?.value as GmailTokens) || null
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
