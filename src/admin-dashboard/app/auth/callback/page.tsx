'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { handleOAuthCallback, prepareTokensForStorage } from '@/lib/oauth-pkce';
import { storeTokens } from '@/lib/token-storage';

/**
 * OAuth Callback Page
 *
 * Handles the OAuth redirect from Microsoft after user authentication.
 * Exchanges authorization code for tokens and stores them securely.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    async function processCallback() {
      try {
        // Extract parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle OAuth errors
        if (error) {
          setStatus('error');
          setErrorMessage(
            `OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`
          );
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setStatus('error');
          setErrorMessage('Missing authorization code or state parameter');
          return;
        }

        // Exchange authorization code for tokens
        const tokenResponse = await handleOAuthCallback(code, state);

        // Prepare tokens for storage
        const tokens = prepareTokensForStorage(tokenResponse);

        // Store tokens in encrypted IndexedDB
        await storeTokens('microsoft', tokens);

        // Success!
        setStatus('success');

        // Redirect to home page after 2 seconds
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');

        // Handle specific error cases
        if (err instanceof Error) {
          if (err.message.includes('code has expired') || err.message.includes('AADSTS70000')) {
            setErrorMessage(
              'Authorization code expired. This can happen if you took too long to complete authentication or refreshed the page. Please try again.'
            );
            // Clear stored PKCE values to ensure fresh flow
            sessionStorage.removeItem('pkce_code_verifier');
            sessionStorage.removeItem('oauth_state');
          } else if (err.message.includes('Invalid state parameter')) {
            setErrorMessage(
              'Security validation failed (CSRF protection). Please try authenticating again.'
            );
            sessionStorage.removeItem('pkce_code_verifier');
            sessionStorage.removeItem('oauth_state');
          } else {
            setErrorMessage(err.message);
          }
        } else {
          setErrorMessage('Unknown error occurred during authentication');
        }
      }
    }

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Authentication</h2>
              <p className="text-gray-600">
                Exchanging authorization code for access tokens...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <svg
                className="mx-auto h-16 w-16 text-green-600 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="text-2xl font-bold text-green-900 mb-2">Authentication Successful!</h2>
              <p className="text-gray-600 mb-4">
                Your Microsoft account has been connected successfully.
              </p>
              <p className="text-sm text-gray-500">Redirecting to home page...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <svg
                className="mx-auto h-16 w-16 text-red-600 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="text-2xl font-bold text-red-900 mb-2">Authentication Failed</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-mono">{errorMessage}</p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Return to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
