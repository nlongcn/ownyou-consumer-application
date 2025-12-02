/**
 * Google OAuth Provider - Sprint 1b
 *
 * Implements OAuth 2.0 flow for Google Gmail API access.
 * Supports refresh tokens with offline access.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/web-server
 * @see docs/sprints/ownyou-sprint1b-spec.md
 */

import type { OAuthProviderClient, GoogleOAuthConfig, StoredTokens } from '../types';

/**
 * Google OAuth endpoints
 */
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/**
 * Google OAuth Provider implementation
 */
export class GoogleOAuthProvider implements OAuthProviderClient {
  readonly provider = 'google' as const;
  private config: GoogleOAuthConfig;

  constructor(config: GoogleOAuthConfig) {
    this.config = config;
  }

  /**
   * Generate authorization URL for Google OAuth
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
      access_type: 'offline', // Required for refresh token
      prompt: 'consent', // Force consent to ensure refresh token is returned
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code from callback
   * @returns Stored tokens with access, refresh, and expiry
   */
  async exchangeCode(code: string): Promise<StoredTokens> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token exchange failed: ${error}`);
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
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token refresh failed: ${error}`);
    }

    const data = await response.json();

    // Google doesn't return a new refresh token on refresh
    // Keep the existing refresh token
    return {
      ...this.parseTokenResponse(data),
      refreshToken,
    };
  }

  /**
   * Revoke tokens
   *
   * @param tokens - Tokens to revoke
   */
  async revokeTokens(tokens: StoredTokens): Promise<void> {
    const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${tokens.accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      // Revocation may fail if token is already expired/invalid
      // This is not critical, just log and continue
      console.warn('Google token revocation failed:', await response.text());
    }
  }

  /**
   * Parse Google token response into StoredTokens format
   */
  private parseTokenResponse(data: Record<string, unknown>): StoredTokens {
    const expiresIn = (data.expires_in as number) ?? 3600;

    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) ?? '',
      expiresAt: Date.now() + expiresIn * 1000,
      scope: (data.scope as string) ?? this.config.scopes.join(' '),
      tokenType: (data.token_type as string) ?? 'Bearer',
    };
  }
}
