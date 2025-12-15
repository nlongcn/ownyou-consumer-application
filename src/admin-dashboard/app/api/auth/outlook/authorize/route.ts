import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { cookies } from 'next/headers'

/**
 * Generate PKCE code verifier (43-128 chars)
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url').substring(0, 128)
}

/**
 * Generate PKCE code challenge from verifier using SHA256
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

/**
 * Outlook OAuth Authorization Endpoint
 *
 * Initiates OAuth 2.0 flow with PKCE by redirecting user to Microsoft's consent screen
 *
 * Scopes: Mail.Read (read emails), offline_access (refresh token)
 * Documentation: https://learn.microsoft.com/en-us/graph/auth-v2-user
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          success: false,
          error: 'Outlook OAuth not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI in .env.local'
        },
        { status: 500 }
      )
    }

    // Microsoft Graph scopes for reading emails
    const scopes = [
      'Mail.Read',         // Read user's mail
      'offline_access',    // Get refresh token
    ]

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7)
    })).toString('base64')

    // Build Microsoft OAuth authorization URL with PKCE
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('response_mode', 'query')
    authUrl.searchParams.append('scope', scopes.join(' '))
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('code_challenge', codeChallenge)
    authUrl.searchParams.append('code_challenge_method', 'S256')
    authUrl.searchParams.append('prompt', 'consent') // Force consent screen

    console.log('[Outlook OAuth] Redirecting to Microsoft consent screen')
    console.log('[Outlook OAuth] Redirect URI:', redirectUri)
    console.log('[Outlook OAuth] Scopes:', scopes.join(', '))
    console.log('[Outlook OAuth] PKCE code_challenge:', codeChallenge.substring(0, 20) + '...')

    // Store code verifier in cookie for callback to use
    const cookieStore = await cookies()
    cookieStore.set('outlook_pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    // Redirect to Microsoft's OAuth consent screen
    return NextResponse.redirect(authUrl.toString())

  } catch (error: any) {
    console.error('[Outlook OAuth] Authorization error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate Outlook OAuth flow',
        details: error.message
      },
      { status: 500 }
    )
  }
}
