/**
 * Browser-Based Profile Reader
 *
 * Reads IAB classifications from IndexedDB and builds tiered profile.
 * Replaces server-side /api/profile/tiered route for pure browser PWA architecture.
 *
 * Ported from: app/api/profile/tiered/route.ts
 */

'use client'

import { IndexedDBStore } from '@browser/store/IndexedDBStore'

export interface TierEntry {
  value: string
  tier_path: string
  confidence: number
  evidence_count: number
  tier_depth: number
}

export interface TieredGroup {
  primary: TierEntry
  alternatives: TierEntry[]
}

export interface TieredInterest {
  primary: TierEntry
  granularity_score: number
}

export interface TieredPurchaseIntent {
  primary: TierEntry
  granularity_score: number
  purchase_intent_flag?: string
}

export interface TieredProfile {
  schema_version: string
  demographics: Record<string, TieredGroup>
  household: Record<string, TieredGroup>
  interests: TieredInterest[]
  purchase_intent: TieredPurchaseIntent[]
}

export interface ProfileCounts {
  total: number
  demographics: number
  household: number
  interests: number
  purchaseIntent: number
  actualPurchases: number
}

/**
 * Browser-based profile reader
 * Reads from IndexedDB instead of server InMemoryStore
 */
export class BrowserProfileReader {
  private store: IndexedDBStore

  constructor(dbName: string = 'ownyou_store') {
    this.store = new IndexedDBStore(dbName)
  }

  /**
   * Get tiered profile for user
   * Same logic as /api/profile/tiered but runs in browser
   */
  async getTieredProfile(userId: string = 'default_user'): Promise<TieredProfile> {
    console.log(`📂 Reading tiered profile for ${userId} from IndexedDB...`)

    // Read semantic memories (IAB classifications)
    const semanticPrefix = [userId, 'iab_taxonomy_profile']
    const semanticItems = await this.store.search(semanticPrefix, { limit: 1000 })

    console.log(`   Found ${semanticItems.length} classifications in IndexedDB`)

    const demographics: Record<string, TieredGroup> = {}
    const household: Record<string, TieredGroup> = {}
    const interests: TieredInterest[] = []
    const purchase_intent: TieredPurchaseIntent[] = []

    for (const item of semanticItems) {
      const value = item.value

      // BUGFIX: Use section from value object instead of parsing from key
      // The reconcile node stores section in value.section
      let section = value.section || 'unknown'

      // DEBUG: Log section detection
      console.log(`[DEBUG] Key: ${item.key}, Section: ${section}`)

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

    // REQ-1.4: Handle "Unknown [Field]" classifications
    // If the highest confidence is "Unknown X", promote the best non-Unknown alternative to primary
    // Only filter the tier group if ALL classifications are Unknown
    for (const [fieldName, group] of Object.entries(demographics)) {
      if (group.primary.value.startsWith('Unknown ')) {
        // Find best non-Unknown alternative
        const validAlt = group.alternatives.find(alt => !alt.value.startsWith('Unknown '))
        if (validAlt) {
          console.log(`[REQ-1.4] Promoting "${validAlt.value}" over "${group.primary.value}" for demographics.${fieldName}`)
          // Demote Unknown to alternatives, promote valid classification
          group.alternatives = group.alternatives.filter(alt => alt !== validAlt)
          group.alternatives.push(group.primary) // Unknown becomes alternative
          group.primary = validAlt
        } else {
          console.warn(`[REQ-1.4] Filtering demographics.${fieldName} - only Unknown classifications available`)
          delete demographics[fieldName]
        }
      }
    }
    for (const [fieldName, group] of Object.entries(household)) {
      if (group.primary.value.startsWith('Unknown ')) {
        const validAlt = group.alternatives.find(alt => !alt.value.startsWith('Unknown '))
        if (validAlt) {
          console.log(`[REQ-1.4] Promoting "${validAlt.value}" over "${group.primary.value}" for household.${fieldName}`)
          group.alternatives = group.alternatives.filter(alt => alt !== validAlt)
          group.alternatives.push(group.primary)
          group.primary = validAlt
        } else {
          console.warn(`[REQ-1.4] Filtering household.${fieldName} - only Unknown classifications available`)
          delete household[fieldName]
        }
      }
    }

    console.log(`✅ Tiered profile built:`)
    console.log(`   Demographics: ${Object.keys(demographics).length}`)
    console.log(`   Household: ${Object.keys(household).length}`)
    console.log(`   Interests: ${interests.length}`)
    console.log(`   Purchase Intent: ${purchase_intent.length}`)

    return {
      schema_version: '2.0',
      demographics,
      household,
      interests,
      purchase_intent,
    }
  }

  /**
   * Get classification counts for dashboard
   * Faster than getTieredProfile() when only counts are needed
   */
  async getCounts(userId: string = 'default_user'): Promise<ProfileCounts> {
    console.log(`📊 Counting classifications for ${userId} from IndexedDB...`)

    const profile = await this.getTieredProfile(userId)

    const counts: ProfileCounts = {
      demographics: Object.keys(profile.demographics).length,
      household: Object.keys(profile.household).length,
      interests: profile.interests.length,
      purchaseIntent: profile.purchase_intent.filter(
        p => p.purchase_intent_flag !== 'ACTUAL_PURCHASE'
      ).length,
      actualPurchases: profile.purchase_intent.filter(
        p => p.purchase_intent_flag === 'ACTUAL_PURCHASE'
      ).length,
      total: 0,
    }

    counts.total = counts.demographics + counts.household + counts.interests +
                   counts.purchaseIntent + counts.actualPurchases

    console.log(`✅ Counts: ${counts.total} total classifications`)

    return counts
  }

  /**
   * Clear all classifications for user
   * Useful for testing and user-initiated profile reset
   */
  async clearProfile(userId: string = 'default_user'): Promise<void> {
    console.log(`🗑️ Clearing profile for ${userId}...`)

    const semanticPrefix = [userId, 'iab_taxonomy_profile']
    const items = await this.store.search(semanticPrefix)

    console.log(`   Found ${items.length} items to delete`)

    // Delete all items
    for (const item of items) {
      await this.store.delete(item.namespace, item.key)
    }

    console.log(`✅ Profile cleared`)
  }

  /**
   * Get the IndexedDB store instance
   * For advanced queries or debugging
   */
  getStore(): IndexedDBStore {
    return this.store
  }
}

/**
 * Get a BrowserProfileReader instance
 * Singleton pattern for efficiency
 */
let _profileReader: BrowserProfileReader | null = null

export function getBrowserProfileReader(userId?: string): BrowserProfileReader {
  if (!_profileReader) {
    _profileReader = new BrowserProfileReader()
  }
  return _profileReader
}
