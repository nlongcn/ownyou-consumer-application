import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Outlook OAuth Status Endpoint
 *
 * Returns the current OAuth status and access token for cross-app communication
 * Used by consumer app (Tauri) to poll for OAuth completion after browser redirect
 *
 * CORS headers allow cross-origin requests from consumer app
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    const accessToken = cookieStore.get('outlook_access_token')?.value
    const refreshToken = cookieStore.get('outlook_refresh_token')?.value
    const tokenExpiry = cookieStore.get('outlook_token_expiry')?.value

    // Check if tokens exist and are valid
    const isConnected = !!accessToken
    const isExpired = tokenExpiry ? Date.now() > parseInt(tokenExpiry) : false

    // Build response with CORS headers
    const response = NextResponse.json({
      connected: isConnected && !isExpired,
      hasRefreshToken: !!refreshToken,
      expiresAt: tokenExpiry ? parseInt(tokenExpiry) : null,
      // Only return access token if requested explicitly and connected
      accessToken: request.nextUrl.searchParams.get('includeToken') === 'true' && isConnected && !isExpired
        ? accessToken
        : undefined,
    })

    // Add CORS headers for cross-origin requests
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.set('Access-Control-Allow-Credentials', 'true')

    return response
  } catch (error: any) {
    console.error('[Outlook Status] Error:', error)
    return NextResponse.json(
      { connected: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}
