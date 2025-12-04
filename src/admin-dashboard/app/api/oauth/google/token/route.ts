/**
 * Google OAuth Token Exchange API
 *
 * Server-side proxy for exchanging authorization code for tokens.
 * Required because Google web OAuth needs client_secret which must stay server-side.
 *
 * Sprint 1b: Works with @ownyou/oauth package for client-side token management.
 *
 * @see packages/oauth/src/providers/google.ts
 * @see docs/sprints/ownyou-sprint1b-spec.md
 */

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, redirectUri } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth not configured on server' },
        { status: 500 }
      )
    }

    // Use provided redirectUri or fall back to env
    const finalRedirectUri = redirectUri || process.env.GOOGLE_REDIRECT_URI

    console.log('[Google Token API] Exchanging code for tokens')
    console.log('[Google Token API] Redirect URI:', finalRedirectUri)

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: finalRedirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[Google Token API] Token exchange failed:', errorData)
      return NextResponse.json(
        { error: 'Token exchange failed', details: errorData },
        { status: tokenResponse.status }
      )
    }

    const tokens = await tokenResponse.json()

    console.log('[Google Token API] Token exchange successful')
    console.log('[Google Token API] Access token:', tokens.access_token ? 'present' : 'missing')
    console.log('[Google Token API] Refresh token:', tokens.refresh_token ? 'present' : 'missing')

    // Return tokens to client for storage via @ownyou/oauth
    return NextResponse.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      scope: tokens.scope,
    })
  } catch (error: unknown) {
    console.error('[Google Token API] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Token exchange error', details: message },
      { status: 500 }
    )
  }
}
