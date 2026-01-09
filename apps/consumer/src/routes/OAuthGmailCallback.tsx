/**
 * Gmail OAuth Callback Route
 *
 * Handles the OAuth 2.0 callback from Google after user authorizes the app.
 * Uses @ownyou/oauth package for token exchange and storage.
 *
 * Flow:
 * 1. User clicks "Connect Gmail" → redirected to Google OAuth
 * 2. User authorizes → Google redirects to this page with ?code=...
 * 3. This page uses @ownyou/oauth to exchange code for tokens
 * 4. Tokens stored in IndexedDB (BrowserTokenStorage)
 * 5. Redirect to /ab-testing page
 *
 * @see packages/oauth/src/index.ts
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { handleGoogleCallback, getOAuthReturnUrl } from '../lib/oauth-integration'

export default function OAuthGmailCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string>('')
  const processedRef = useRef(false)

  useEffect(() => {
    const processCallback = async () => {
      // Prevent double execution in React StrictMode
      if (processedRef.current) {
        console.log('[Gmail OAuth] Callback already processed, skipping...')
        return
      }
      processedRef.current = true

      try {
        // Get authorization code and state from URL
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`)
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        if (!state) {
          throw new Error('No state parameter received')
        }

        console.log('[Gmail OAuth] Received authorization code, exchanging for token using @ownyou/oauth...')

        // Exchange code for token using @ownyou/oauth package
        const tokens = await handleGoogleCallback(code, state)

        console.log('[Gmail OAuth] Token exchange successful via @ownyou/oauth')
        console.log('[Gmail OAuth] Access token expires at:', new Date(tokens.expiresAt).toISOString())

        setStatus('success')

        // Redirect to the page user came from (stored before OAuth started)
        const returnUrl = getOAuthReturnUrl()
        console.log('[Gmail OAuth] Redirecting to:', returnUrl)
        setTimeout(() => {
          navigate(returnUrl)
        }, 1500)
      } catch (err) {
        console.error('[Gmail OAuth] Callback error:', err)
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    }

    processCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        {status === 'processing' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connecting to Gmail...
            </h2>
            <p className="text-gray-600">
              Please wait while we complete the authorization.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="rounded-full bg-green-100 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Gmail Connected Successfully!
            </h2>
            <p className="text-gray-600 mb-4">
              You can now download and classify your emails.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="rounded-full bg-red-100 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authorization Failed
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/ab-testing')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to A/B Testing
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
