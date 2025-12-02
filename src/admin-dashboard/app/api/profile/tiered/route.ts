/**
 * API Route for Tiered IAB Profile Data
 *
 * Returns IAB classifications organized in a tiered structure with:
 * - Demographics: primary + alternatives (using proper tier selection)
 * - Household: primary + alternatives (using proper tier selection)
 * - Interests: ranked by granularity (non-exclusive)
 * - Purchase Intent: ranked by granularity (non-exclusive)
 *
 * Updated: 2025-01-12 - Now uses tierSelector.ts for proper classification logic
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/shared-store'
import {
  formatTieredDemographics,
  formatTieredHousehold,
  formatTieredInterests,
  formatTieredPurchaseIntent,
  type TaxonomySelection,
} from '@ownyou/iab-classifier'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id') || 'default_user'

    // Get store for this user
    const store = getStore(user_id)

    // Read semantic memories (IAB classifications)
    const semanticPrefix = [user_id, 'iab_taxonomy_profile']
    const semanticItems = await store.search(semanticPrefix)

    // Parse memories by section
    const demographicsMemories: TaxonomySelection[] = []
    const householdMemories: TaxonomySelection[] = []
    const interestsMemories: TaxonomySelection[] = []
    const purchaseMemories: TaxonomySelection[] = []

    for (const item of semanticItems) {
      const value = item.value as any

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

      // Create TaxonomySelection object
      const selection: TaxonomySelection = {
        taxonomy_id: value.taxonomy_id || 0,
        section: section,
        value: value.value || '',
        confidence: value.confidence || 0,
        tier_1: value.tier_1 || '',
        tier_2: value.tier_2 || '',
        tier_3: value.tier_3 || '',
        tier_4: value.tier_4 || '',
        tier_5: value.tier_5 || '',
        tier_path: value.tier_path || value.category_path || '',
        category_path: value.category_path || value.tier_path || '',
        grouping_tier_key: value.grouping_tier_key || '',
        grouping_value: value.grouping_value || '',
        reasoning: value.reasoning || '',
        evidence_count: value.evidence_count || value.supporting_evidence?.length || 0,
        last_validated: value.last_validated || '',
        days_since_validation: value.days_since_validation || 0,
        supporting_evidence: value.supporting_evidence || [],
        purchase_intent_flag: value.purchase_intent_flag,
      }

      // Organize by section
      if (section === 'demographics') {
        demographicsMemories.push(selection)
      } else if (section === 'household') {
        householdMemories.push(selection)
      } else if (section === 'interests') {
        interestsMemories.push(selection)
      } else if (section === 'purchase_intent') {
        purchaseMemories.push(selection)
      }
    }

    // Apply proper tier selection using formatters
    const tieredDemographics = formatTieredDemographics(demographicsMemories)
    const tieredHousehold = formatTieredHousehold(householdMemories)
    const tieredInterests = formatTieredInterests(interestsMemories)
    const tieredPurchase = formatTieredPurchaseIntent(purchaseMemories)

    return NextResponse.json({
      schema_version: '2.0',
      demographics: tieredDemographics,
      household: tieredHousehold,
      interests: tieredInterests,
      purchase_intent: tieredPurchase,
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
