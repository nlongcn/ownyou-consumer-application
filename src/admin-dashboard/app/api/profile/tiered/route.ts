/**
 * API Route for Tiered IAB Profile Data
 *
 * Returns IAB classifications organized in a tiered structure with:
 * - Demographics: primary + alternatives
 * - Household: primary + alternatives
 * - Interests: ranked by granularity
 * - Purchase Intent: ranked by granularity
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/shared-store'

interface TierEntry {
  value: string
  tier_path: string
  confidence: number
  evidence_count: number
  tier_depth: number
}

interface TieredGroup {
  primary: TierEntry
  alternatives: TierEntry[]
}

interface TieredInterest {
  primary: TierEntry
  granularity_score: number
}

interface TieredPurchaseIntent {
  primary: TierEntry
  granularity_score: number
  purchase_intent_flag?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id') || 'default_user'

    // Get store for this user
    const store = getStore(user_id)

    // Read semantic memories (IAB classifications)
    const semanticPrefix = [user_id, 'iab_taxonomy_profile']
    const semanticItems = await store.search(semanticPrefix)

    const demographics: Record<string, TieredGroup> = {}
    const household: Record<string, TieredGroup> = {}
    const interests: TieredInterest[] = []
    const purchase_intent: TieredPurchaseIntent[] = []

    for (const item of semanticItems) {
      const value = item.value

      // Parse key to extract section
      const key = item.key
      const keyParts = key.split('_')
      let section = 'unknown'
      if (keyParts.length >= 2) {
        section = keyParts[1]
      }

      // Normalize purchase section
      if (section === 'purchase') {
        section = 'purchase_intent'
      }

      // Calculate tier depth (count number of tiers in path)
      const tierPath = value.category_path || value.tier_path || value.value || 'Unknown'
      const tierDepth = tierPath.split('>').length

      // Create tier entry
      const tierEntry: TierEntry = {
        value: value.value || value.tier_3 || 'Unknown',
        tier_path: tierPath,
        confidence: value.confidence || 0,
        evidence_count: value.evidence_count || value.supporting_evidence?.length || 0,
        tier_depth: tierDepth,
      }

      // Organize by section
      if (section === 'demographics') {
        // Group by field name (extract from tier_path)
        const fieldName = value.grouping_value || 'demographic'
        if (!demographics[fieldName]) {
          demographics[fieldName] = {
            primary: tierEntry,
            alternatives: [],
          }
        } else {
          // Add as alternative if lower confidence
          if (tierEntry.confidence > demographics[fieldName].primary.confidence) {
            demographics[fieldName].alternatives.push(demographics[fieldName].primary)
            demographics[fieldName].primary = tierEntry
          } else {
            demographics[fieldName].alternatives.push(tierEntry)
          }
        }
      } else if (section === 'household') {
        // Group by field name
        const fieldName = value.grouping_value || 'household'
        if (!household[fieldName]) {
          household[fieldName] = {
            primary: tierEntry,
            alternatives: [],
          }
        } else {
          if (tierEntry.confidence > household[fieldName].primary.confidence) {
            household[fieldName].alternatives.push(household[fieldName].primary)
            household[fieldName].primary = tierEntry
          } else {
            household[fieldName].alternatives.push(tierEntry)
          }
        }
      } else if (section === 'interests') {
        // Calculate granularity score (higher tier depth = more granular)
        const granularity_score = tierDepth / 5.0 // Normalize to 0-1 range (max 5 tiers)
        interests.push({
          primary: tierEntry,
          granularity_score,
        })
      } else if (section === 'purchase_intent') {
        // Calculate granularity score
        const granularity_score = tierDepth / 5.0
        purchase_intent.push({
          primary: tierEntry,
          granularity_score,
          purchase_intent_flag: value.purchase_intent_flag,
        })
      }
    }

    // Sort interests and purchase_intent by granularity (descending)
    interests.sort((a, b) => b.granularity_score - a.granularity_score)
    purchase_intent.sort((a, b) => b.granularity_score - a.granularity_score)

    // Sort alternatives by confidence
    Object.values(demographics).forEach(group => {
      group.alternatives.sort((a, b) => b.confidence - a.confidence)
    })
    Object.values(household).forEach(group => {
      group.alternatives.sort((a, b) => b.confidence - a.confidence)
    })

    return NextResponse.json({
      schema_version: '2.0',
      demographics,
      household,
      interests,
      purchase_intent,
    })

  } catch (error: any) {
    console.error('Tiered profile error:', error)
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
