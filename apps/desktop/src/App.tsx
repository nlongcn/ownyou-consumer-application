/**
 * OwnYou Desktop App - Sprint 1b
 *
 * Main application with OAuth integration for Microsoft and Google.
 * Uses deep links (ownyou://) for 90-day token refresh.
 */

import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { Store } from '@tauri-apps/plugin-store';

// OAuth configuration - use environment variables in production
const OAUTH_CONFIG = {
  microsoft: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'fb33f128-2613-47d2-a551-9552446705b7',
    redirectUri: 'ownyou://oauth/callback',
  },
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: 'ownyou://oauth/callback',
  },
};

// Token types matching Rust backend
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

type OAuthProvider = 'microsoft' | 'google';

interface OAuthStatus {
  microsoft: {
    connected: boolean;
    expiresAt?: number;
    error?: string;
  };
  google: {
    connected: boolean;
    expiresAt?: number;
    error?: string;
  };
}

// Persistent store for tokens
let tokenStore: Store | null = null;

async function getTokenStore(): Promise<Store> {
  if (!tokenStore) {
    tokenStore = await Store.load('oauth-tokens.json');
  }
  return tokenStore;
}

function App() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus>({
    microsoft: { connected: false },
    google: { connected: false },
  });
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);

  // Handle OAuth callback from deep link
  const handleOAuthCallback = useCallback(async (url: string) => {
    console.log('[OAuth] Handling callback URL:', url);

    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const error = urlObj.searchParams.get('error');

      if (error) {
        const errorDesc = urlObj.searchParams.get('error_description') || error;
        throw new Error(`OAuth error: ${errorDesc}`);
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Determine provider from pending state
      const provider = pendingProvider;
      if (!provider) {
        throw new Error('No pending OAuth flow');
      }

      setStatus(`Exchanging code for ${provider} tokens...`);

      const config = OAUTH_CONFIG[provider];
      const tokens = await invoke<TokenData>('complete_oauth', {
        provider,
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        code,
        receivedState: state,
      });

      console.log('[OAuth] Token exchange successful:', provider);
      console.log('[OAuth] Token expires at:', new Date(tokens.expiresAt).toISOString());

      // Store tokens in persistent store
      const store = await getTokenStore();
      await store.set(`tokens_${provider}`, tokens);
      await store.save();

      // Update status
      setOAuthStatus((prev) => ({
        ...prev,
        [provider]: {
          connected: true,
          expiresAt: tokens.expiresAt,
        },
      }));

      setPendingProvider(null);
      setStatus(`${provider} connected successfully!`);
    } catch (err) {
      console.error('[OAuth] Callback error:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (pendingProvider) {
        setOAuthStatus((prev) => ({
          ...prev,
          [pendingProvider]: {
            connected: false,
            error: errorMsg,
          },
        }));
      }

      setPendingProvider(null);
      setStatus(`OAuth error: ${errorMsg}`);
    }
  }, [pendingProvider]);

  // Start OAuth flow
  const startOAuth = async (provider: OAuthProvider) => {
    try {
      const config = OAUTH_CONFIG[provider];

      if (!config.clientId) {
        throw new Error(`No client ID configured for ${provider}`);
      }

      setStatus(`Starting ${provider} OAuth...`);
      setPendingProvider(provider);

      // Get authorization URL from Rust backend
      const authUrl = await invoke<string>('start_oauth', {
        provider,
        clientId: config.clientId,
        redirectUri: config.redirectUri,
      });

      console.log('[OAuth] Opening auth URL:', authUrl.substring(0, 100) + '...');

      // Open system browser
      await openUrl(authUrl);

      setStatus(`Waiting for ${provider} authorization...`);
    } catch (err) {
      console.error('[OAuth] Start error:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setOAuthStatus((prev) => ({
        ...prev,
        [provider]: {
          connected: false,
          error: errorMsg,
        },
      }));
      setPendingProvider(null);
      setStatus(`OAuth error: ${errorMsg}`);
    }
  };

  // Disconnect provider
  const disconnect = async (provider: OAuthProvider) => {
    const store = await getTokenStore();
    await store.delete(`tokens_${provider}`);
    await store.save();

    setOAuthStatus((prev) => ({
      ...prev,
      [provider]: { connected: false },
    }));
    setStatus(`${provider} disconnected`);
  };

  // Load existing tokens on startup
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const store = await getTokenStore();

        for (const provider of ['microsoft', 'google'] as OAuthProvider[]) {
          const tokens = await store.get<TokenData>(`tokens_${provider}`);
          if (tokens) {
            // Check if expired
            const isExpired = await invoke<boolean>('check_token_expiration', {
              tokenData: tokens,
            });

            setOAuthStatus((prev) => ({
              ...prev,
              [provider]: {
                connected: !isExpired,
                expiresAt: tokens.expiresAt,
                error: isExpired ? 'Token expired - please reconnect' : undefined,
              },
            }));
          }
        }

        setStatus('Ready');
      } catch (err) {
        console.error('[OAuth] Failed to load tokens:', err);
        setStatus('Ready');
      }
    };

    loadTokens();
  }, []);

  // Setup deep link handler
  useEffect(() => {
    // Check if app was launched via deep link
    const checkInitialDeepLink = async () => {
      try {
        const urls = await getCurrent();
        if (urls && urls.length > 0) {
          const callbackUrl = urls.find((u) => u.includes('oauth/callback'));
          if (callbackUrl) {
            await handleOAuthCallback(callbackUrl);
          }
        }
      } catch (err) {
        console.error('Failed to get initial deep link:', err);
      }
    };

    // Listen for new deep links while app is running
    const setupDeepLinkListener = async () => {
      try {
        await onOpenUrl((urls) => {
          console.log('Deep link received:', urls);
          const callbackUrl = urls.find((u) => u.includes('oauth/callback'));
          if (callbackUrl) {
            handleOAuthCallback(callbackUrl);
          }
        });
      } catch (err) {
        console.error('Failed to setup deep link listener:', err);
      }
    };

    checkInitialDeepLink();
    setupDeepLinkListener();
  }, [handleOAuthCallback]);

  // Format expiry date
  const formatExpiry = (expiresAt?: number) => {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `Expires in ${diffDays} days`;
  };

  return (
    <div className="container">
      <h1>OwnYou Desktop</h1>

      <div className="status-card">
        <h2>Status</h2>
        <p>{status}</p>
      </div>

      <div className="oauth-card">
        <h2>Email Connections</h2>
        <p>Connect your email for 90-day access (auto-refresh)</p>

        {/* Microsoft/Outlook */}
        <div className="provider-row">
          <div className="provider-info">
            <span className="provider-name">Outlook / Microsoft</span>
            {oauthStatus.microsoft.connected ? (
              <span className="status-connected">
                Connected {formatExpiry(oauthStatus.microsoft.expiresAt)}
              </span>
            ) : oauthStatus.microsoft.error ? (
              <span className="status-error">{oauthStatus.microsoft.error}</span>
            ) : (
              <span className="status-disconnected">Not connected</span>
            )}
          </div>
          <div className="provider-actions">
            {oauthStatus.microsoft.connected ? (
              <button onClick={() => disconnect('microsoft')} className="btn-disconnect">
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => startOAuth('microsoft')}
                disabled={pendingProvider === 'microsoft'}
                className="btn-connect"
              >
                {pendingProvider === 'microsoft' ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {/* Google/Gmail */}
        <div className="provider-row">
          <div className="provider-info">
            <span className="provider-name">Gmail / Google</span>
            {oauthStatus.google.connected ? (
              <span className="status-connected">
                Connected {formatExpiry(oauthStatus.google.expiresAt)}
              </span>
            ) : oauthStatus.google.error ? (
              <span className="status-error">{oauthStatus.google.error}</span>
            ) : OAUTH_CONFIG.google.clientId ? (
              <span className="status-disconnected">Not connected</span>
            ) : (
              <span className="status-warning">Not configured</span>
            )}
          </div>
          <div className="provider-actions">
            {oauthStatus.google.connected ? (
              <button onClick={() => disconnect('google')} className="btn-disconnect">
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => startOAuth('google')}
                disabled={pendingProvider === 'google' || !OAUTH_CONFIG.google.clientId}
                className="btn-connect"
              >
                {pendingProvider === 'google' ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="info-card">
        <h2>About Desktop OAuth</h2>
        <p>
          Desktop uses the <code>ownyou://</code> protocol for OAuth callbacks.
          This enables 90-day refresh tokens (vs 24 hours in browser).
        </p>
        <ul>
          <li>Microsoft: 90-day refresh tokens</li>
          <li>Google: Long-lived refresh tokens</li>
          <li>Tokens stored securely in OS keychain</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
