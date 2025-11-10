import { NextRequest, NextResponse } from 'next/server'

/**
 * Outlook OAuth Callback Endpoint
 *
 * Handles OAuth 2.0 callback from Microsoft after user grants consent
 * Exchanges authorization code for access token and refresh token
 * Stores tokens in HTTP-only cookies
 *
 * Documentation: https://learn.microsoft.com/en-us/graph/auth-v2-user#2-get-authorization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const state = searchParams.get('state')

    // Handle OAuth errors
    if (error) {
      console.error('[Outlook OAuth] Authorization error:', error, errorDescription)
      return NextResponse.redirect(
        new URL(`/emails?error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/emails?error=no_code', request.url)
      )
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL('/emails?error=oauth_not_configured', request.url)
      )
    }

    console.log('[Outlook OAuth] Exchanging authorization code for tokens')

    // Exchange authorization code for access token
    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'Mail.Read offline_access',
        }),
      }
    )

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[Outlook OAuth] Token exchange failed:', errorData)
      return NextResponse.redirect(
        new URL('/emails?error=token_exchange_failed', request.url)
      )
    }

    const tokens = await tokenResponse.json()

    console.log('[Outlook OAuth] Successfully obtained tokens')
    console.log('[Outlook OAuth] Access token:', tokens.access_token ? 'present' : 'missing')
    console.log('[Outlook OAuth] Refresh token:', tokens.refresh_token ? 'present' : 'missing')
    console.log('[Outlook OAuth] Expires in:', tokens.expires_in, 'seconds')

    // Create response with redirect
    const response = NextResponse.redirect(
      new URL('/emails?outlook_connected=true', request.url)
    )

    // Store tokens in HTTP-only cookies (expires in 1 hour)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60, // 1 hour
      path: '/',
    }

    response.cookies.set('outlook_access_token', tokens.access_token, cookieOptions)

    if (tokens.refresh_token) {
      // Refresh token should persist longer
      response.cookies.set('outlook_refresh_token', tokens.refresh_token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    // Store token expiry time
    const expiryTime = Date.now() + (tokens.expires_in * 1000)
    response.cookies.set('outlook_token_expiry', expiryTime.toString(), cookieOptions)

    return response

  } catch (error: any) {
    console.error('[Outlook OAuth] Callback error:', error)
    return NextResponse.redirect(
      new URL(`/emails?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }
}
