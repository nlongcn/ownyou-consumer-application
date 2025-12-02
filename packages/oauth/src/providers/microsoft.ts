/**
 * Microsoft OAuth Provider - Sprint 1b
 *
 * Implements OAuth 2.0 flow for Microsoft Graph API access.
 * Supports 90-day offline_access tokens.
 *
 * @see https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
 * @see docs/sprints/ownyou-sprint1b-spec.md
 */

import type { OAuthProviderClient, MicrosoftOAuthConfig, StoredTokens } from '../types';

/**
 * Microsoft OAuth endpoints
 */
const MICROSOFT_AUTH_BASE = 'https://login.microsoftonline.com';
const MICROSOFT_TOKEN_PATH = '/oauth2/v2.0/token';
const MICROSOFT_AUTH_PATH = '/oauth2/v2.0/authorize';

/**
 * Microsoft OAuth Provider implementation
 */
export class MicrosoftOAuthProvider implements OAuthProviderClient {
  readonly provider = 'microsoft' as const;
  private config: MicrosoftOAuthConfig;

  constructor(config: MicrosoftOAuthConfig) {
    this.config = config;
  }

  /**
   * Get the tenant for the OAuth URL
   * Defaults to 'common' for multi-tenant apps
   */
  private get tenant(): string {
    return this.config.tenantId ?? 'common';
  }

  /**
   * Get authorization URL base
   */
  private get authBaseUrl(): string {
    return `${MICROSOFT_AUTH_BASE}/${this.tenant}`;
  }

  /**
   * Generate authorization URL for Microsoft OAuth
   *
   * @param state - Random state string for CSRF protection
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
      response_mode: 'query',
    });

    return `${this.authBaseUrl}${MICROSOFT_AUTH_PATH}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code from callback
   * @returns Stored tokens with access, refresh, and expiry
   */
  async exchangeCode(code: string): Promise<StoredTokens> {
    const tokenUrl = `${this.authBaseUrl}${MICROSOFT_TOKEN_PATH}`;

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft token exchange failed: ${error}`);
    }

    const data = await response.json();
    return this.parseTokenResponse(data);
  }

  /**
   * Refresh expired tokens
   *
   * @param refreshToken - Valid refresh token
   * @returns New tokens with updated access token and expiry
   */
  async refreshTokens(refreshToken: string): Promise<StoredTokens> {
    const tokenUrl = `${this.authBaseUrl}${MICROSOFT_TOKEN_PATH}`;

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: this.config.scopes.join(' '),
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft token refresh failed: ${error}`);
    }

    const data = await response.json();
    return this.parseTokenResponse(data);
  }

  /**
   * Revoke tokens (Microsoft doesn't have a direct revoke endpoint for public clients)
   * The tokens will expire naturally
   */
  async revokeTokens(_tokens: StoredTokens): Promise<void> {
    // Microsoft doesn't support token revocation for public clients
    // Tokens will expire based on their expiry time
    // For enhanced security, tokens should be deleted from storage
  }

  /**
   * Parse Microsoft token response into StoredTokens format
   */
  private parseTokenResponse(data: Record<string, unknown>): StoredTokens {
    const expiresIn = (data.expires_in as number) ?? 3600;

    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresAt: Date.now() + expiresIn * 1000,
      scope: (data.scope as string) ?? this.config.scopes.join(' '),
      tokenType: (data.token_type as string) ?? 'Bearer',
    };
  }
}
