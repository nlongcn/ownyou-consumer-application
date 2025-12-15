/**
 * OAuthFlow - OAuth authentication flow UI
 * v13 Section 4.4 - Connection Components
 *
 * Implements real OAuth popup flow for Google, Microsoft, and Apple.
 * Uses popup window for authentication and message passing for token retrieval.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@ownyou/ui-design-system';

export type OAuthProvider = 'google' | 'microsoft' | 'apple';

export interface OAuthConfig {
  /** OAuth client ID */
  clientId: string;
  /** OAuth redirect URI (must match OAuth app configuration) */
  redirectUri: string;
  /** OAuth scopes to request */
  scopes: string[];
}

export interface OAuthFlowProps {
  /** OAuth provider */
  provider: OAuthProvider;
  /** Service being connected (e.g., "Gmail", "Outlook") */
  serviceName: string;
  /** OAuth configuration (if not provided, uses environment variables) */
  config?: Partial<OAuthConfig>;
  /** Callback when OAuth completes successfully */
  onSuccess?: (token: string, provider: OAuthProvider) => void;
  /** Callback when OAuth fails */
  onError?: (error: Error) => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/** Default OAuth scopes per provider */
const DEFAULT_SCOPES: Record<OAuthProvider, string[]> = {
  google: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
  microsoft: ['openid', 'profile', 'email', 'Mail.Read'],
  apple: ['email', 'name'],
};

/** OAuth authorization endpoints */
const OAUTH_ENDPOINTS: Record<OAuthProvider, string> = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
  microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  apple: 'https://appleid.apple.com/auth/authorize',
};

/** Provider styling configuration using design tokens */
const providerConfig = {
  google: {
    name: 'Google',
    // Google uses white background with border per brand guidelines
    className: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  microsoft: {
    name: 'Microsoft',
    className: `bg-brand-microsoft text-white hover:opacity-90`,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 21 21" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
    ),
  },
  apple: {
    name: 'Apple',
    // Using design token via Tailwind class
    className: `bg-brand-apple text-white hover:opacity-90`,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
  },
} as const;

/**
 * Generate OAuth authorization URL
 */
function generateAuthUrl(
  provider: OAuthProvider,
  config: OAuthConfig,
  state: string,
  nonce: string
): string {
  const params = new URLSearchParams();

  switch (provider) {
    case 'google':
      params.set('client_id', config.clientId);
      params.set('redirect_uri', config.redirectUri);
      params.set('response_type', 'token');
      params.set('scope', config.scopes.join(' '));
      params.set('state', state);
      params.set('include_granted_scopes', 'true');
      break;

    case 'microsoft':
      params.set('client_id', config.clientId);
      params.set('redirect_uri', config.redirectUri);
      params.set('response_type', 'token');
      params.set('scope', config.scopes.join(' '));
      params.set('state', state);
      params.set('nonce', nonce);
      params.set('response_mode', 'fragment');
      break;

    case 'apple':
      params.set('client_id', config.clientId);
      params.set('redirect_uri', config.redirectUri);
      params.set('response_type', 'code id_token');
      params.set('scope', config.scopes.join(' '));
      params.set('state', state);
      params.set('nonce', nonce);
      params.set('response_mode', 'fragment');
      break;
  }

  return `${OAUTH_ENDPOINTS[provider]}?${params.toString()}`;
}

/**
 * Parse token from OAuth redirect URL
 */
function parseTokenFromUrl(url: string, expectedState: string): string | null {
  try {
    const hashParams = new URLSearchParams(url.split('#')[1] || '');
    const queryParams = new URLSearchParams(url.split('?')[1]?.split('#')[0] || '');

    // Check state matches
    const state = hashParams.get('state') || queryParams.get('state');
    if (state !== expectedState) {
      console.error('OAuth state mismatch');
      return null;
    }

    // Try to get access_token from hash (implicit flow)
    const accessToken = hashParams.get('access_token');
    if (accessToken) {
      return accessToken;
    }

    // For Apple, we might get id_token
    const idToken = hashParams.get('id_token');
    if (idToken) {
      return idToken;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generate cryptographically secure random string
 */
function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * OAuth flow component with real popup-based authentication
 */
export function OAuthFlow({
  provider,
  serviceName,
  config: userConfig,
  onSuccess,
  onError,
  onCancel,
  className,
}: OAuthFlowProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const stateRef = useRef<string>('');

  const providerInfo = providerConfig[provider];

  // Get OAuth config from environment or props
  const getOAuthConfig = useCallback((): OAuthConfig | null => {
    // Environment variable names for each provider
    const envPrefix = {
      google: 'VITE_GOOGLE',
      microsoft: 'VITE_MICROSOFT',
      apple: 'VITE_APPLE',
    }[provider];

    const clientId = userConfig?.clientId ||
      (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.[`${envPrefix}_CLIENT_ID`]) ||
      '';

    const redirectUri = userConfig?.redirectUri ||
      (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.[`${envPrefix}_REDIRECT_URI`]) ||
      `${window.location.origin}/oauth/callback`;

    const scopes = userConfig?.scopes || DEFAULT_SCOPES[provider];

    if (!clientId) {
      return null;
    }

    return { clientId, redirectUri, scopes };
  }, [provider, userConfig]);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      if (event.origin !== window.location.origin) {
        return;
      }

      // Check if this is an OAuth callback
      if (event.data?.type === 'oauth-callback' && event.data?.provider === provider) {
        if (event.data.token) {
          setIsLoading(false);
          onSuccess?.(event.data.token, provider);
        } else if (event.data.error) {
          setIsLoading(false);
          setError(event.data.error);
          onError?.(new Error(event.data.error));
        }
        popupRef.current?.close();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [provider, onSuccess, onError]);

  // Poll for popup closure (user cancelled)
  useEffect(() => {
    if (!isLoading || !popupRef.current) return;

    const pollTimer = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(pollTimer);
        setIsLoading(false);
        // Only trigger cancel if we didn't get a success/error
        if (!error) {
          onCancel?.();
        }
      }
    }, 500);

    return () => clearInterval(pollTimer);
  }, [isLoading, error, onCancel]);

  const handleClick = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const oauthConfig = getOAuthConfig();

      if (!oauthConfig) {
        throw new Error(
          `OAuth not configured for ${provider}. ` +
          `Please set ${provider.toUpperCase()}_CLIENT_ID environment variable.`
        );
      }

      // Generate state and nonce for security
      const state = generateSecureRandom();
      const nonce = generateSecureRandom();
      stateRef.current = state;

      // Store state for callback verification
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_provider', provider);

      // Generate auth URL
      const authUrl = generateAuthUrl(provider, oauthConfig, state, nonce);

      // Calculate popup position (centered)
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open OAuth popup
      popupRef.current = window.open(
        authUrl,
        `oauth_${provider}`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popupRef.current) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Start polling for redirect
      const pollInterval = setInterval(() => {
        try {
          if (popupRef.current?.closed) {
            clearInterval(pollInterval);
            return;
          }

          // Try to access popup location (will throw if cross-origin)
          const popupUrl = popupRef.current?.location?.href;
          if (popupUrl && popupUrl.includes(oauthConfig.redirectUri.split('//')[1]?.split('/')[0] || '')) {
            // We're on our redirect URI - extract token
            const token = parseTokenFromUrl(popupUrl, state);

            if (token) {
              clearInterval(pollInterval);
              popupRef.current?.close();
              setIsLoading(false);
              onSuccess?.(token, provider);
            }
          }
        } catch {
          // Cross-origin - popup is still on OAuth provider page
        }
      }, 100);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
          setIsLoading(false);
          setError('Authentication timed out');
          onError?.(new Error('Authentication timed out'));
        }
      }, 5 * 60 * 1000);

    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'OAuth failed';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [provider, getOAuthConfig, onSuccess, onError]);

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-sm text-gray-600 text-center">
        Sign in with {providerInfo.name} to connect {serviceName}
      </p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg font-medium transition-colors',
          providerInfo.className,
          isLoading && 'opacity-50 cursor-not-allowed',
        )}
        aria-label={`Sign in with ${providerInfo.name}`}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          providerInfo.icon
        )}
        <span>
          {isLoading ? 'Connecting...' : `Continue with ${providerInfo.name}`}
        </span>
      </button>

      {onCancel && (
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="w-full text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

export default OAuthFlow;
