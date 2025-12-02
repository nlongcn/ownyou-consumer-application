/**
 * Gmail OAuth Configuration API Route (Server-Side Only)
 *
 * CRITICAL: This route provides OAuth client ID without exposing it in client bundle.
 * Following same security pattern as /api/llm-config.
 *
 * SECURITY:
 * - Client ID is NOT a secret (it's public in OAuth spec)
 * - However, we avoid NEXT_PUBLIC_* to keep consistent pattern
 * - Client SECRET must NEVER be used in browser OAuth (use PKCE instead)
 *
 * Phase 1.5 (Development):
 * - Gmail client ID from .env.local (server-side only)
 * - Used for admin dashboard testing
 *
 * Phase 5 (Production):
 * - Users will use OwnYou's registered app (same client ID)
 * - Or users register their own app (advanced users)
 */

import { NextResponse } from 'next/server'

export async function GET() {
  // Read Gmail OAuth configuration from server-side environment variables
  // SECURITY NOTE: Token exchange happens server-side in /api/auth/gmail/callback
  // Client secret is NEVER exposed to the browser - only used server-side
  // See: https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code
  const config = {
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    // SECURITY: client_secret intentionally omitted - never expose to browser
    // Token exchange happens server-side in /api/auth/gmail/callback
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/oauth/gmail/callback',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly', // Read-only access to Gmail
      'https://www.googleapis.com/auth/userinfo.email', // User email address (for identification)
    ],
    auth_uri: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  }

  if (!config.client_id) {
    return NextResponse.json(
      {
        error: 'Gmail OAuth not configured',
        message: 'GOOGLE_CLIENT_ID environment variable not set',
        instructions: [
          '1. Go to Google Cloud Console (https://console.cloud.google.com)',
          '2. Create a project or select existing project',
          '3. Enable Gmail API',
          '4. Create OAuth 2.0 credentials (Web application)',
          '5. Add redirect URI: http://localhost:3001/oauth/gmail/callback',
          '6. Copy Client ID to .env.local as GOOGLE_CLIENT_ID',
        ],
      },
      { status: 500 }
    )
  }

  return NextResponse.json(config)
}
