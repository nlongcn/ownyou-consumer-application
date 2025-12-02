import { NextRequest, NextResponse } from 'next/server'

/**
 * Gmail Token Refresh API Endpoint
 *
 * Refreshes the Gmail access token using the refresh token.
 * SECURITY: client_secret is only used server-side, never exposed to browser.
 */
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('gmail_refresh_token')?.value

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available', message: 'User needs to re-authorize' },
        { status: 401 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'OAuth not configured', message: 'Gmail OAuth credentials not set' },
        { status: 500 }
      )
    }

    console.log('[Gmail Refresh] Refreshing access token')

    // Exchange refresh token for new access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[Gmail Refresh] Token refresh failed:', errorData)
      return NextResponse.json(
        { error: 'Token refresh failed', message: 'User needs to re-authorize' },
        { status: 401 }
      )
    }

    const tokens = await tokenResponse.json()

    console.log('[Gmail Refresh] Successfully refreshed access token')

    // Create response with updated cookies
    const response = NextResponse.json({
      success: true,
      hasRefreshToken: true,
      expiresIn: tokens.expires_in,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    })

    // SECURITY: Store tokens in HTTP-only cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60, // 1 hour
      path: '/',
    }

    response.cookies.set('gmail_access_token', tokens.access_token, cookieOptions)

    // Update token expiry
    const expiryTime = Date.now() + tokens.expires_in * 1000
    response.cookies.set('gmail_token_expiry', expiryTime.toString(), cookieOptions)

    // Keep refresh token (usually not returned on refresh)
    // Google only returns refresh_token on initial authorization

    return response
  } catch (error: any) {
    console.error('[Gmail Refresh] Error:', error)
    return NextResponse.json(
      { error: 'Token refresh failed', message: error.message },
      { status: 500 }
    )
  }
}
