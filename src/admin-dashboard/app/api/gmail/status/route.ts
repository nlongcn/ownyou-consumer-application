import { NextRequest, NextResponse } from 'next/server'

/**
 * Gmail Status API Endpoint
 *
 * Returns the current Gmail OAuth connection status.
 * Reads tokens from HTTP-only cookies (never exposes actual tokens).
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('gmail_access_token')?.value
    const refreshToken = request.cookies.get('gmail_refresh_token')?.value
    const tokenExpiry = request.cookies.get('gmail_token_expiry')?.value

    if (!accessToken) {
      return NextResponse.json({
        connected: false,
        hasRefreshToken: false,
      })
    }

    const expiresAt = tokenExpiry ? parseInt(tokenExpiry, 10) : Date.now() + 3600 * 1000
    const expiresIn = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))

    return NextResponse.json({
      connected: true,
      hasRefreshToken: !!refreshToken,
      expiresAt,
      expiresIn,
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
    })
  } catch (error: any) {
    console.error('[Gmail Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get Gmail status', message: error.message },
      { status: 500 }
    )
  }
}
