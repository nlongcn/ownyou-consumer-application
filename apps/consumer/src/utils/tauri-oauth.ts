/**
 * Tauri OAuth Module - Uses Cloudflare Worker for token exchange
 *
 * Flow:
 * 1. Build OAuth authorization URL with Cloudflare Worker as redirect_uri
 * 2. Open system browser with OAuth authorize URL
 * 3. User authenticates with Microsoft/Google
 * 4. OAuth provider redirects to Cloudflare Worker with authorization code
 * 5. Cloudflare Worker exchanges code for tokens (has client_secret)
 * 6. Worker shows success page and redirects to ownyou://oauth/callback?access_token=...
 * 7. OS opens Tauri app, triggering deep link handler with tokens
 */

import { getPlatform } from './platform';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { getCurrentWindow } from '@tauri-apps/api/window';

// OAuth redirect URI - Cloudflare Worker handles token exchange with client_secret
// The worker then redirects to the app with tokens via deep link
const WEB_CALLBACK_URL = 'https://ownyou-oauth-callback.nlongcroft.workers.dev/callback';

// Deep link URI - what the worker redirects to after token exchange
const DEEP_LINK_URI = 'ownyou://oauth/callback';

// Flag to indicate OAuth is in progress (prevents duplicate handling from App.tsx)
let oauthInProgress = false;

/**
 * Check if OAuth flow is currently in progress
 * Used by App.tsx to avoid duplicate handling of OAuth callbacks
 */
export function isOAuthInProgress(): boolean {
  return oauthInProgress;
}

// Provider mapping for Rust backend
type RustOAuthProvider = 'microsoft' | 'google';

const SOURCE_TO_PROVIDER: Record<string, RustOAuthProvider> = {
  'outlook': 'microsoft',
  'microsoft-calendar': 'microsoft',
  'gmail': 'google',
  'google-calendar': 'google',
};

const SOURCE_TO_SCOPES: Record<string, string[]> = {
  'outlook': ['Mail.Read', 'offline_access'],
  'microsoft-calendar': ['Calendars.Read', 'offline_access'],
  'gmail': ['https://www.googleapis.com/auth/gmail.readonly'],
  'google-calendar': ['https://www.googleapis.com/auth/calendar.readonly'],
};

/**
 * Initialize OAuth listener (called on app start)
 */
export async function initOAuthListener(): Promise<void> {
  if (getPlatform() === 'tauri') {
    console.log('[TauriOAuth] Deep link system ready (Cloudflare Worker token exchange)');
  }
}

/**
 * OAuth token data returned from the OAuth flow
 */
export interface OAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp when token expires
  provider: 'google' | 'microsoft';
}

/**
 * Start OAuth flow for a data source
 * Token exchange happens in Cloudflare Worker (has client_secret)
 * Worker redirects to app with access_token + refresh_token via deep link
 */
export async function startTauriOAuth(sourceId: string): Promise<OAuthTokenData | null> {
  if (getPlatform() !== 'tauri') {
    throw new Error('startTauriOAuth can only be used in Tauri');
  }

  // Set flag to prevent duplicate handling from App.tsx
  oauthInProgress = true;
  console.log('[TauriOAuth] Starting OAuth for:', sourceId);

  const provider = SOURCE_TO_PROVIDER[sourceId];
  if (!provider) {
    throw new Error(`Unsupported source: ${sourceId}`);
  }

  const scopes = SOURCE_TO_SCOPES[sourceId];
  if (!scopes) {
    throw new Error(`No scopes defined for source: ${sourceId}`);
  }

  // Get client ID from environment
  const clientId = provider === 'microsoft'
    ? import.meta.env.VITE_MICROSOFT_CLIENT_ID
    : import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error(`Client ID not configured for ${provider}`);
  }

  // Build OAuth authorization URL
  // Microsoft redirects to Cloudflare Worker, which does token exchange and redirects to app
  const authUrl = buildAuthUrl(provider, clientId, scopes, sourceId);
  console.log('[TauriOAuth] Auth URL:', authUrl.substring(0, 100) + '...');

  return new Promise(async (resolve, reject) => {
    let unlisten: (() => void) | undefined;
    let completed = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      completed = true;
      oauthInProgress = false;
      if (unlisten) unlisten();
      if (timeoutId) clearTimeout(timeoutId);
    };

    try {
      // Set up Deep Link Listener
      console.log('[TauriOAuth] Setting up deep link listener...');
      unlisten = await onOpenUrl(async (urls) => {
        console.log('[TauriOAuth] *** DEEP LINK RECEIVED *** urls:', urls);
        if (completed) {
          console.log('[TauriOAuth] Already completed, ignoring');
          return;
        }

        for (const url of urls) {
          if (url.startsWith(DEEP_LINK_URI)) {
            try {
              const urlObj = new URL(url);
              const params = urlObj.searchParams;

              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              const expiresIn = params.get('expires_in');
              const state = params.get('state');
              const error = params.get('error');

              if (error) {
                throw new Error(params.get('error_description') || error);
              }

              if (accessToken) {
                console.log('[TauriOAuth] Access token received from Cloudflare Worker!');
                console.log('[TauriOAuth] Refresh token:', refreshToken ? 'present' : 'not present');
                console.log('[TauriOAuth] Expires in:', expiresIn, 'seconds');

                // Calculate expiration timestamp
                const expiresAt = expiresIn
                  ? Date.now() + (parseInt(expiresIn, 10) * 1000)
                  : undefined;

                // Determine provider from state
                const isGoogle = state === 'gmail' || state === 'google-calendar';
                const providerType: 'google' | 'microsoft' = isGoogle ? 'google' : 'microsoft';

                // Bring app window to focus
                try {
                  const window = getCurrentWindow();
                  await window.setFocus();
                  console.log('[TauriOAuth] Window focused after OAuth success');
                } catch (focusErr) {
                  console.warn('[TauriOAuth] Could not focus window:', focusErr);
                }

                cleanup();
                resolve({
                  accessToken,
                  refreshToken: refreshToken || undefined,
                  expiresAt,
                  provider: providerType,
                });
                return;
              }
            } catch (err) {
              console.error('[TauriOAuth] Error processing deep link:', err);
              cleanup();
              reject(err);
              return;
            }
          }
        }
      });

      // Open System Browser
      const { open } = await import('@tauri-apps/plugin-shell');
      console.log('[TauriOAuth] Opening browser...');
      await open(authUrl);

      // Set timeout (5 minutes)
      timeoutId = setTimeout(() => {
        if (!completed) {
          console.log('[TauriOAuth] OAuth timed out');
          cleanup();
          resolve(null);
        }
      }, 300000);

    } catch (err) {
      console.error('[TauriOAuth] Setup failed:', err);
      cleanup();
      reject(err);
    }
  });
}

/**
 * Build OAuth authorization URL
 */
function buildAuthUrl(provider: RustOAuthProvider, clientId: string, scopes: string[], state: string): string {
  if (provider === 'microsoft') {
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: WEB_CALLBACK_URL,
      scope: scopes.join(' '),
      state: state,
      response_mode: 'query',
      prompt: 'consent',  // Force consent screen to show every time
    });
    return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params.toString()}`;
  } else {
    // Google
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: WEB_CALLBACK_URL,
      scope: scopes.join(' '),
      state: state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
}

/**
 * Get the OAuth redirect URI (for display/configuration purposes)
 */
export function getOAuthRedirectUri(): string {
  return WEB_CALLBACK_URL;
}

/**
 * Handle OAuth callback from App.tsx deep link handler (fallback)
 * Cloudflare Worker has already exchanged the code for tokens
 * Deep link contains access_token + refresh_token directly
 */
export async function handleOAuthCallbackFromApp(callbackUrl: string): Promise<OAuthTokenData | null> {
  console.log('[TauriOAuth] handleOAuthCallbackFromApp called with:', callbackUrl);

  try {
    const urlObj = new URL(callbackUrl);
    const params = urlObj.searchParams;

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      console.error('[TauriOAuth] OAuth error:', error, params.get('error_description'));
      throw new Error(params.get('error_description') || error);
    }

    if (accessToken) {
      console.log('[TauriOAuth] Access token received from Cloudflare Worker (via fallback handler)');

      // Calculate expiration timestamp
      const expiresAt = expiresIn
        ? Date.now() + (parseInt(expiresIn, 10) * 1000)
        : undefined;

      // Determine provider from state
      const isGoogle = state === 'gmail' || state === 'google-calendar';
      const providerType: 'google' | 'microsoft' = isGoogle ? 'google' : 'microsoft';

      return {
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresAt,
        provider: providerType,
      };
    }

    console.error('[TauriOAuth] No access token in callback URL');
    return null;

  } catch (err) {
    console.error('[TauriOAuth] handleOAuthCallbackFromApp error:', err);
    return null;
  }
}

/**
 * Refresh an OAuth token using the Cloudflare Worker
 * @param refreshToken - The refresh token to use
 * @param provider - 'google' or 'microsoft'
 * @returns New token data or null if refresh fails
 */
export async function refreshOAuthToken(
  refreshToken: string,
  provider: 'google' | 'microsoft'
): Promise<OAuthTokenData | null> {
  const REFRESH_URL = 'https://ownyou-oauth-callback.nlongcroft.workers.dev/refresh';

  try {
    console.log(`[TauriOAuth] Refreshing ${provider} token...`);

    const url = new URL(REFRESH_URL);
    url.searchParams.set('refresh_token', refreshToken);
    url.searchParams.set('provider', provider);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      console.error('[TauriOAuth] Token refresh failed:', data.error);
      return null;
    }

    console.log('[TauriOAuth] Token refreshed successfully');

    // Calculate expiration timestamp
    const expiresAt = data.expiresIn
      ? Date.now() + (data.expiresIn * 1000)
      : undefined;

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken, // Keep old if not returned
      expiresAt,
      provider,
    };
  } catch (err) {
    console.error('[TauriOAuth] Token refresh error:', err);
    return null;
  }
}
