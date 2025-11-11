/**
 * API Route for Evidence & Reasoning Data
 *
 * Returns detailed classification evidence including LLM reasoning,
 * supporting/contradicting evidence, and metadata.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/shared-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id') || 'default_user'
    const section = searchParams.get('section') || 'all'
    const sort = searchParams.get('sort') || 'confidence_desc'
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    // Get store for this user
    const store = getStore(user_id)

    // Read semantic memories (IAB classifications)
    const semanticPrefix = [user_id, 'iab_taxonomy_profile']
    const semanticItems = await store.search(semanticPrefix)

    const evidence: any[] = []

    for (const item of semanticItems) {
      const value = item.value

      // Parse key to extract section and taxonomy_id
      // Key format: semantic_{section}_{taxonomy_id}_{name}
      const key = item.key
      const keyParts = key.split('_')

      // Extract section
      let itemSection = 'unknown'
      if (keyParts.length >= 2) {
        itemSection = keyParts[1]
      }

      // Normalize purchase section names
      if (itemSection === 'purchase' || itemSection === 'purchase_intent') {
        itemSection = 'purchase_intent'
      }

      // Filter by section if specified
      if (section !== 'all' && itemSection !== section) {
        continue
      }

      // Extract taxonomy_id
      let taxonomyId: number | null = null
      if (keyParts.length >= 3) {
        const parsedId = parseInt(keyParts[2], 10)
        if (!isNaN(parsedId)) {
          taxonomyId = parsedId
        }
      }

      evidence.push({
        taxonomy_id: taxonomyId || 0,
        category_path: value.category_path || value.tier_path || value.value || 'Unknown',
        value: value.value || value.tier_3 || 'Unknown',
        confidence: value.confidence || 0,
        evidence_count: value.evidence_count || value.supporting_evidence?.length || 0,
        reasoning: value.reasoning || 'No reasoning provided',
        supporting_evidence: value.supporting_evidence || [],
        contradicting_evidence: value.contradicting_evidence || [],
        first_observed: value.first_observed || item.createdAt || new Date().toISOString(),
        last_updated: value.last_updated || item.updatedAt || new Date().toISOString(),
        section: itemSection,
        purchase_intent_flag: value.purchase_intent_flag,
      })
    }

    // Sort evidence
    if (sort === 'confidence_desc') {
      evidence.sort((a, b) => b.confidence - a.confidence)
    } else if (sort === 'confidence_asc') {
      evidence.sort((a, b) => a.confidence - b.confidence)
    } else if (sort === 'recent') {
      evidence.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    } else if (sort === 'oldest') {
      evidence.sort((a, b) => new Date(a.first_observed).getTime() - new Date(b.first_observed).getTime())
    }

    // Apply limit
    const limitedEvidence = evidence.slice(0, limit)

    return NextResponse.json({
      success: true,
      user_id,
      evidence: limitedEvidence,
      total: limitedEvidence.length,
    })

  } catch (error: any) {
    console.error('Evidence error:', error)
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
