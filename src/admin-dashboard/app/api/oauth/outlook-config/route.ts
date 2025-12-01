/**
 * Outlook OAuth Configuration API Route (Server-Side Only)
 *
 * CRITICAL: This route provides OAuth client ID without exposing it in client bundle.
 * Following same security pattern as /api/oauth/gmail-config.
 *
 * SECURITY:
 * - Client ID is NOT a secret (it's public in OAuth spec)
 * - However, we avoid NEXT_PUBLIC_* to keep consistent pattern
 * - Client SECRET must NEVER be used in browser OAuth (use PKCE instead)
 *
 * Phase 1.5 (Development):
 * - Outlook client ID from .env.local (server-side only)
 * - Used for admin dashboard testing
 *
 * Phase 5 (Production):
 * - Users will use OwnYou's registered app (same client ID)
 * - Or users register their own app (advanced users)
 */

import { NextResponse } from 'next/server'

export async function GET() {
  // Read Outlook OAuth configuration from server-side environment variables
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common'

  const config = {
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/oauth/outlook/callback',
    scopes: [
      'https://graph.microsoft.com/Mail.Read', // Read-only access to Outlook
      'https://graph.microsoft.com/User.Read', // User profile (for identification)
      'openid',
      'profile',
      'offline_access', // Required for refresh token
    ],
    auth_uri: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    token_uri: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    tenant,
  }

  if (!config.client_id) {
    return NextResponse.json(
      {
        error: 'Outlook OAuth not configured',
        message: 'MICROSOFT_CLIENT_ID environment variable not set',
        instructions: [
          '1. Go to Azure Portal (https://portal.azure.com)',
          '2. Navigate to Azure Active Directory > App registrations',
          '3. Create a new registration or select existing',
          '4. Add redirect URI: http://localhost:3001/oauth/outlook/callback',
          '5. Add API permissions: Mail.Read, User.Read (delegated)',
          '6. Create client secret',
          '7. Copy Client ID to .env.local as MICROSOFT_CLIENT_ID',
          '8. Copy Client Secret to .env.local as MICROSOFT_CLIENT_SECRET',
          '9. Copy Tenant ID to .env.local as MICROSOFT_TENANT_ID',
        ],
      },
      { status: 500 }
    )
  }

  return NextResponse.json(config)
}
