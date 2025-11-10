import { NextRequest, NextResponse } from 'next/server'

/**
 * Gmail OAuth Authorization Endpoint
 *
 * Initiates OAuth 2.0 flow by redirecting user to Google's consent screen
 *
 * Scope: https://www.googleapis.com/auth/gmail.readonly
 * Documentation: https://developers.google.com/identity/protocols/oauth2/web-server
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gmail OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI in .env.local'
        },
        { status: 500 }
      )
    }

    // Gmail API scope for reading emails
    const scope = 'https://www.googleapis.com/auth/gmail.readonly'

    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7)
    })).toString('base64')

    // Build Google OAuth authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('scope', scope)
    authUrl.searchParams.append('access_type', 'offline') // Request refresh token
    authUrl.searchParams.append('prompt', 'consent') // Force consent screen to get refresh token
    authUrl.searchParams.append('state', state)

    console.log('[Gmail OAuth] Redirecting to Google consent screen')
    console.log('[Gmail OAuth] Redirect URI:', redirectUri)

    // Redirect to Google's OAuth consent screen
    return NextResponse.redirect(authUrl.toString())

  } catch (error: any) {
    console.error('[Gmail OAuth] Authorization error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate Gmail OAuth flow',
        details: error.message
      },
      { status: 500 }
    )
  }
}
