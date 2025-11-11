/**
 * OAuth Status Check Route
 *
 * Checks if Gmail and Outlook OAuth tokens exist in cookies
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()

    // Check for OAuth tokens in cookies
    const gmailToken = cookieStore.get('gmail_access_token')
    const outlookToken = cookieStore.get('outlook_access_token')

    return NextResponse.json({
      gmail: !!gmailToken?.value,
      outlook: !!outlookToken?.value,
    })
  } catch (error) {
    console.error('Error checking auth status:', error)
    return NextResponse.json(
      { error: 'Failed to check auth status' },
      { status: 500 }
    )
  }
}
