/**
 * OAuthCallback - Handles OAuth redirect callback
 * v13 Section 4.4 - Connection Components
 *
 * This page receives the OAuth redirect and exchanges the authorization code
 * for an access token using PKCE, then sends the token back to the opener window.
 */

import { useEffect, useState } from 'react';

/**
 * Parse OAuth response from URL query params
 * Authorization code flow returns code in query params
 */
function parseOAuthResponse(): {
  code: string | null;
  error: string | null;
  state: string | null;
} {
  const query = window.location.search.substring(1);
  const queryParams = new URLSearchParams(query);

  // Check for errors first
  const error = queryParams.get('error');
  const errorDescription = queryParams.get('error_description');

  if (error) {
    return {
      code: null,
      error: errorDescription || error,
      state: queryParams.get('state'),
    };
  }

  // Get authorization code
  const code = queryParams.get('code');
  return {
    code,
    error: null,
    state: queryParams.get('state'),
  };
}

/**
 * Exchange authorization code for access token using PKCE
 *
 * For Tauri OAuth flow:
 * - PKCE verifier is stored in localStorage (shared between Tauri webview and system browser)
 * - Result is stored in localStorage for Tauri to poll
 */
async function exchangeCodeForToken(
  code: string,
  provider: string
): Promise<string> {
  // Get PKCE verifier - stored in localStorage because OAuth callback may happen
  // in a popup window which has isolated sessionStorage from the main window.
  // localStorage is shared across all same-origin windows.
  const codeVerifier = localStorage.getItem(`oauth_code_verifier_${provider}`)
    || sessionStorage.getItem(`oauth_code_verifier_${provider}`);
  if (!codeVerifier) {
    throw new Error('PKCE code verifier not found. Please try again.');
  }

  // Clean up verifier immediately after retrieval (one-time use for security)
  localStorage.removeItem(`oauth_code_verifier_${provider}`);
  sessionStorage.removeItem(`oauth_code_verifier_${provider}`);

  // Use same redirect URI as the authorization request
  // Must match exactly - use the actual path we're currently on
  const redirectUri = `${window.location.origin}${window.location.pathname}`;

  if (provider === 'gmail' || provider === 'google-calendar') {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
    if (!clientId) {
      throw new Error('Google client ID not configured');
    }

    // Exchange code for token with Google
    const tokenParams: Record<string, string> = {
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };

    // Include client_secret if available (required for Web Application type OAuth clients)
    if (clientSecret) {
      tokenParams.client_secret = clientSecret;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OAuth] Token exchange failed:', errorData);
      throw new Error(errorData.error_description || errorData.error || 'Failed to exchange code for token');
    }

    const data = await response.json();
    return data.access_token;
  }

  if (provider === 'outlook' || provider === 'microsoft-calendar') {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_MICROSOFT_CLIENT_SECRET;
    if (!clientId) {
      throw new Error('Microsoft client ID not configured');
    }

    // Exchange code for token with Microsoft
    const tokenParams: Record<string, string> = {
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };

    // Include client_secret if available
    if (clientSecret) {
      tokenParams.client_secret = clientSecret;
    }

    // Use 'consumers' endpoint for personal Microsoft accounts (matches tauri-oauth.ts)
    const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OAuth] Token exchange failed:', errorData);
      throw new Error(errorData.error_description || errorData.error || 'Failed to exchange code for token');
    }

    const data = await response.json();
    return data.access_token;
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export function OAuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { code, error, state } = parseOAuthResponse();

        console.log('[OAuthCallback] Received:', { code: code ? 'yes' : 'no', error, state });

        if (error) {
          throw new Error(error);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        if (!state) {
          throw new Error('No state parameter received');
        }

        // State contains the provider (gmail, outlook, etc.)
        const provider = state;

        setMessage('Exchanging authorization code for token...');

        // Exchange code for access token using PKCE
        const accessToken = await exchangeCodeForToken(code, provider);

        // Clean up PKCE verifier from both storage types
        sessionStorage.removeItem(`oauth_code_verifier_${provider}`);
        localStorage.removeItem(`oauth_code_verifier_${provider}`);

        console.log('[OAuthCallback] Token exchange successful');

        // Check if this is a Tauri cross-context flow (verifier was in localStorage)
        const isTauriFlow = localStorage.getItem(`oauth_pending_${provider}`);

        if (isTauriFlow) {
          // Tauri flow: Store result in localStorage for Tauri app to poll
          console.log('[OAuthCallback] Tauri flow detected - storing result in localStorage');
          localStorage.setItem(
            `oauth_result_${provider}`,
            JSON.stringify({
              success: true,
              accessToken,
              timestamp: Date.now(),
            })
          );
          // Clean up pending marker
          localStorage.removeItem(`oauth_pending_${provider}`);

          setStatus('success');
          setMessage('Authentication successful! You can return to the OwnYou app.');
        } else if (window.opener) {
          // PWA popup flow: Send message to opener window
          window.opener.postMessage(
            {
              type: 'oauth_callback',
              sourceId: provider,
              accessToken,
              success: true,
            },
            window.location.origin
          );

          setStatus('success');
          setMessage('Authentication successful! This window will close automatically.');

          // Close this window after a short delay
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          // No opener, no Tauri - regular redirect flow
          // Store token and redirect back to app
          sessionStorage.setItem('oauth_token', accessToken);
          sessionStorage.setItem('oauth_provider', provider);

          setStatus('success');
          setMessage('Authentication successful! Redirecting...');

          // Redirect to settings data tab
          setTimeout(() => {
            window.location.href = '/settings?tab=data';
          }, 500);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        console.error('[OAuthCallback] Error:', errorMessage);

        // Get provider from state for error reporting
        const { state } = parseOAuthResponse();
        const provider = state || 'unknown';

        // Check if this is a Tauri flow
        const isTauriFlow = localStorage.getItem(`oauth_pending_${provider}`);

        if (isTauriFlow) {
          // Store error in localStorage for Tauri app to poll
          localStorage.setItem(
            `oauth_result_${provider}`,
            JSON.stringify({
              success: false,
              error: errorMessage,
              timestamp: Date.now(),
            })
          );
          localStorage.removeItem(`oauth_pending_${provider}`);
        } else if (window.opener) {
          // Send error to opener if exists
          window.opener.postMessage(
            {
              type: 'oauth_callback',
              error: errorMessage,
              success: false,
            },
            window.location.origin
          );
        }

        setStatus('error');
        setMessage(errorMessage);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full mx-4 text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-gray-800 font-medium">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-red-700 font-medium mb-2">Authentication Failed</p>
            <p className="text-gray-600 text-sm">{message}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default OAuthCallback;
