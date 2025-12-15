/**
 * Tauri OAuth Module - Uses Rust backend for token exchange to avoid CORS
 *
 * Flow:
 * 1. Call Rust `start_oauth` to generate auth URL (PKCE stored in Rust)
 * 2. Open system browser with OAuth authorize URL
 * 3. System browser redirects to ownyou://oauth/callback?code=...
 * 4. OS opens Tauri app, triggering deep link handler
 * 5. Call Rust `complete_oauth` to exchange code for token (no CORS issues)
 */

import { getPlatform } from './platform';
import { invoke } from '@tauri-apps/api/core';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';

// OAuth redirect URI - uses custom protocol scheme
const REDIRECT_URI = 'ownyou://oauth/callback';

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
 * Token data returned from Rust backend
 */
interface TokenData {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

/**
 * Initialize OAuth listener (called on app start)
 */
export async function initOAuthListener(): Promise<void> {
  if (getPlatform() === 'tauri') {
    console.log('[TauriOAuth] Deep link system ready (Rust-based token exchange)');
  }
}

/**
 * Start OAuth flow for a data source using Rust backend
 * Opens browser with OAuth URL and waits for deep link callback
 */
export async function startTauriOAuth(sourceId: string): Promise<string | null> {
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

  // Call Rust backend to start OAuth (generates auth URL, stores PKCE verifier)
  console.log('[TauriOAuth] Calling Rust start_oauth...');
  const authUrl = await invoke<string>('start_oauth', {
    provider,
    clientId,
    redirectUri: REDIRECT_URI,
    scopes,
  });

  console.log('[TauriOAuth] Auth URL from Rust:', authUrl.substring(0, 100) + '...');

  return new Promise(async (resolve, reject) => {
    let unlisten: (() => void) | undefined;
    let completed = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      completed = true;
      oauthInProgress = false; // Clear flag so App.tsx can handle future callbacks
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
          if (url.startsWith('ownyou://oauth/callback')) {
            try {
              const urlObj = new URL(url);
              const params = urlObj.searchParams;

              const code = params.get('code');
              const error = params.get('error');

              if (error) {
                throw new Error(params.get('error_description') || error);
              }

              if (code) {
                console.log('[TauriOAuth] Authorization code received, calling Rust complete_oauth...');

                // Call Rust backend to exchange code for token (no CORS issues!)
                const tokenData = await invoke<TokenData>('complete_oauth', {
                  provider,
                  clientId,
                  redirectUri: REDIRECT_URI,
                  code,
                  receivedState: null, // CSRF state is validated in Rust
                });

                console.log('[TauriOAuth] Token exchange successful via Rust!');
                cleanup();
                resolve(tokenData.accessToken);
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
      console.log('[TauriOAuth] Opening browser with URL:', authUrl.substring(0, 100) + '...');
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
 * Get the OAuth redirect URI (for display/configuration purposes)
 */
export function getOAuthRedirectUri(): string {
  return REDIRECT_URI;
}

/**
 * Handle OAuth callback from App.tsx deep link handler (fallback)
 * Uses Rust backend for token exchange
 */
export async function handleOAuthCallbackFromApp(callbackUrl: string): Promise<string | null> {
  console.log('[TauriOAuth] handleOAuthCallbackFromApp called with:', callbackUrl);

  try {
    const urlObj = new URL(callbackUrl);
    const params = urlObj.searchParams;

    const code = params.get('code');
    const error = params.get('error');
    const state = params.get('state'); // This is the provider (e.g., 'outlook', 'gmail')

    if (error) {
      console.error('[TauriOAuth] OAuth error:', error, params.get('error_description'));
      throw new Error(params.get('error_description') || error);
    }

    if (!code) {
      console.error('[TauriOAuth] No authorization code in callback URL');
      return null;
    }

    // Determine provider from state or URL pattern
    const provider = state && SOURCE_TO_PROVIDER[state]
      ? SOURCE_TO_PROVIDER[state]
      : 'microsoft'; // Default to Microsoft

    const clientId = provider === 'microsoft'
      ? import.meta.env.VITE_MICROSOFT_CLIENT_ID
      : import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.error('[TauriOAuth] Client ID not configured');
      return null;
    }

    console.log('[TauriOAuth] Calling Rust complete_oauth...');

    // Call Rust backend to exchange code for token
    const tokenData = await invoke<TokenData>('complete_oauth', {
      provider,
      clientId,
      redirectUri: REDIRECT_URI,
      code,
      receivedState: null,
    });

    console.log('[TauriOAuth] Token exchange successful via Rust!');
    return tokenData.accessToken;

  } catch (err) {
    console.error('[TauriOAuth] handleOAuthCallbackFromApp error:', err);
    return null;
  }
}
