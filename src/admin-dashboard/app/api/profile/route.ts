/**
 * Server-side API Route for IAB Profile Data
 *
 * Reads IAB taxonomy profile from the shared in-memory store.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/shared-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id') || 'default_user'

    // Get store for this user
    const store = getStore(user_id)

    // Read semantic memories (IAB classifications)
    // MemoryManager stores with namespace [user_id, 'iab_taxonomy_profile']
    const semanticPrefix = [user_id, 'iab_taxonomy_profile']
    const semanticItems = await store.search(semanticPrefix)

    // Count by section
    let totalClassifications = 0
    let demographics = 0
    let household = 0
    let interests = 0
    let purchaseIntent = 0
    let actualPurchases = 0

    const classifications: any[] = []

    for (const item of semanticItems) {
      const value = item.value

      // Parse key to extract section and taxonomy_id
      // Key format: semantic_{section}_{taxonomy_id}_{name}
      // Example: semantic_interests_688_artificial_intelligence
      const key = item.key
      const keyParts = key.split('_')

      // Extract section (e.g., "interests")
      let section = 'unknown'
      if (keyParts.length >= 2) {
        section = keyParts[1] // Second part after "semantic"
      }

      // Extract taxonomy_id (e.g., "688")
      let taxonomyId: number | null = null
      if (keyParts.length >= 3) {
        const parsedId = parseInt(keyParts[2], 10)
        if (!isNaN(parsedId)) {
          taxonomyId = parsedId
        }
      }

      // Count by section
      if (section === 'demographics') {
        demographics++
      } else if (section === 'household') {
        household++
      } else if (section === 'interests') {
        interests++
      } else if (section === 'purchase' || section === 'purchase_intent') {
        if (value.purchase_intent_flag === 'ACTUAL_PURCHASE') {
          actualPurchases++
        } else {
          purchaseIntent++
        }
        section = 'purchase_intent' // Normalize to purchase_intent
      }

      totalClassifications++

      classifications.push({
        taxonomy_id: taxonomyId,
        value: value.value || value.tier_3 || 'Unknown',
        confidence: value.confidence || 0,
        section,
        evidence_count: value.evidence?.length || 0,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })
    }

    return NextResponse.json({
      success: true,
      user_id,
      summary: {
        total: totalClassifications,
        demographics,
        household,
        interests,
        purchase_intent: purchaseIntent,
        actual_purchases: actualPurchases,
      },
      classifications: classifications.sort((a, b) => b.confidence - a.confidence),
    })

  } catch (error: any) {
    console.error('Profile error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
