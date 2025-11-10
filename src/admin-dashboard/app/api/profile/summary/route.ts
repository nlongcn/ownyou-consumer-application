/**
 * Profile Summary API Route
 *
 * GET /api/profile/summary
 *
 * Returns user profile summary with classification counts.
 *
 * This is a migration from Flask dashboard backend/api/profile.py
 * to TypeScript Next.js API route with IndexedDB storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStoreClient } from '@/lib/store-client'

export const runtime = 'edge' // Use Edge Runtime for better performance

/**
 * GET /api/profile/summary
 *
 * Get user profile summary with classification counts.
 *
 * Returns:
 *   200: Profile summary
 *   {
 *     "user_id": "user_123",
 *     "demographics": 5,
 *     "household": 8,
 *     "interests": 15,
 *     "purchase_intent": 7,
 *     "actual_purchases": 2,
 *     "total_classifications": 37
 *   }
 *
 *   500: Server error
 *   {
 *     "error": "Server error",
 *     "message": "Failed to retrieve profile summary"
 *   }
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get user ID from authentication (browser extension OAuth)
    // For now, use a hardcoded user ID for POC
    const userId = request.nextUrl.searchParams.get('user_id') || 'default_user'

    // Get StoreClient instance
    const storeClient = getStoreClient(userId)

    // Get profile summary from IndexedDB Store
    const summary = await storeClient.getProfileSummary(userId)

    // Close store connection
    await storeClient.close()

    return NextResponse.json(summary, { status: 200 })
  } catch (error) {
    console.error('Error getting profile summary:', error)

    return NextResponse.json(
      {
        error: 'Server error',
        message: 'Failed to retrieve profile summary',
      },
      { status: 500 }
    )
  }
}
