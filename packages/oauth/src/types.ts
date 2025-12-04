/**
 * OAuth Types - Sprint 1b
 *
 * Unified OAuth types for browser and desktop platforms.
 *
 * @see docs/sprints/ownyou-sprint1b-spec.md
 */

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'microsoft' | 'google';

/**
 * Platform where OAuth is running
 */
export type Platform = 'browser' | 'desktop';

/**
 * Stored OAuth tokens
 */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  scope: string;
  tokenType: string;
}

/**
 * Token storage interface - implemented by BrowserStorage and KeychainStorage
 */
export interface TokenStorage {
  /**
   * Store tokens for a user and provider
   */
  store(userId: string, provider: OAuthProvider, tokens: StoredTokens): Promise<void>;

  /**
   * Get stored tokens
   */
  get(userId: string, provider: OAuthProvider): Promise<StoredTokens | null>;

  /**
   * Delete stored tokens
   */
  delete(userId: string, provider: OAuthProvider): Promise<void>;

  /**
   * Check if tokens exist
   */
  exists(userId: string, provider: OAuthProvider): Promise<boolean>;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  platform: Platform;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Microsoft-specific OAuth config
 */
export interface MicrosoftOAuthConfig extends OAuthConfig {
  provider: 'microsoft';
  tenantId?: string; // 'common' | 'organizations' | 'consumers' | specific tenant
}

/**
 * Google-specific OAuth config
 */
export interface GoogleOAuthConfig extends OAuthConfig {
  provider: 'google';
}

/**
 * Authorization URL result (may include PKCE code verifier)
 */
export interface AuthorizationUrlResult {
  url: string;
  codeVerifier?: string;
}

/**
 * OAuth provider interface
 */
export interface OAuthProviderClient {
  /**
   * Provider name
   */
  readonly provider: OAuthProvider;

  /**
   * Generate authorization URL
   * Returns string for simple OAuth, or { url, codeVerifier } for PKCE flows
   */
  getAuthorizationUrl(state: string): string | Promise<AuthorizationUrlResult>;

  /**
   * Exchange authorization code for tokens
   * @param code - Authorization code from callback
   * @param codeVerifier - Optional PKCE code verifier (required for Microsoft SPA)
   */
  exchangeCode(code: string, codeVerifier?: string): Promise<StoredTokens>;

  /**
   * Refresh expired tokens
   */
  refreshTokens(refreshToken: string): Promise<StoredTokens>;

  /**
   * Revoke tokens (logout)
   */
  revokeTokens(tokens: StoredTokens): Promise<void>;
}

/**
 * Token manager events
 */
export interface TokenManagerEvents {
  onTokenRefreshed: (provider: OAuthProvider, tokens: StoredTokens) => void;
  onTokenRefreshFailed: (provider: OAuthProvider, error: Error) => void;
  onTokenExpiring: (provider: OAuthProvider, expiresIn: number) => void;
}

/**
 * OAuth client interface
 */
export interface OAuthClient {
  /**
   * Start OAuth flow for a provider
   */
  authorize(provider: OAuthProvider): Promise<void>;

  /**
   * Handle OAuth callback (code exchange)
   */
  handleCallback(provider: OAuthProvider, code: string): Promise<StoredTokens>;

  /**
   * Get current valid access token (auto-refreshes if needed)
   */
  getAccessToken(userId: string, provider: OAuthProvider): Promise<string | null>;

  /**
   * Check if user has valid tokens for a provider
   */
  isAuthorized(userId: string, provider: OAuthProvider): Promise<boolean>;

  /**
   * Revoke authorization for a provider
   */
  logout(userId: string, provider: OAuthProvider): Promise<void>;

  /**
   * Subscribe to token events
   */
  on<K extends keyof TokenManagerEvents>(
    event: K,
    handler: TokenManagerEvents[K]
  ): () => void;
}

/**
 * Token refresh margin (refresh 5 minutes before expiry)
 */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Default scopes for Microsoft Graph API
 */
export const MICROSOFT_DEFAULT_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'User.Read',
  'Mail.Read',
];

/**
 * Default scopes for Google Gmail API
 */
export const GOOGLE_DEFAULT_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
];
