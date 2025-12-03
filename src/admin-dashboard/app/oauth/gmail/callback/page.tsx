/**
 * Gmail OAuth Callback Page
 *
 * Handles the OAuth 2.0 callback from Google after user authorizes the app.
 * Extracts authorization code from URL and exchanges it for access token.
 *
 * Flow:
 * 1. User clicks "Connect Gmail" → redirected to Google OAuth
 * 2. User authorizes → Google redirects to this page with ?code=...
 * 3. This page exchanges code for access token
 * 4. Tokens stored in IndexedDB
 * 5. Redirect to /emails page
 */

'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getGmailOAuthClient } from '@/lib/gmail-oauth-client'

// Loading component for Suspense fallback
function GmailCallbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading...
          </h2>
        </div>
      </div>
    </div>
  )
}

// Main page wrapper with Suspense
export default function GmailCallbackPage() {
  return (
    <Suspense fallback={<GmailCallbackLoading />}>
      <GmailCallbackPageContent />
    </Suspense>
  )
}

function GmailCallbackPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code from URL
        const code = searchParams.get('code')
        const errorParam = searchParams.get('error')

        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`)
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        console.log('[Gmail OAuth] Received authorization code, exchanging for token...')

        // Exchange code for token
        const client = getGmailOAuthClient()
        const tokens = await client.handleCallback(code)

        console.log('[Gmail OAuth] Token exchange successful')
        console.log('[Gmail OAuth] Access token expires at:', new Date(tokens.expires_at).toISOString())

        setStatus('success')

        // Redirect to emails page after short delay
        setTimeout(() => {
          router.push('/emails')
        }, 2000)
      } catch (err) {
        console.error('[Gmail OAuth] Callback error:', err)
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    }

    handleCallback()
  }, [searchParams, router])

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
              Redirecting to emails page...
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
              onClick={() => router.push('/emails')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Emails
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
