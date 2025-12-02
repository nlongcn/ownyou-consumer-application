/**
 * IAB Taxonomy Loader
 *
 * Loads and indexes the full IAB Audience Taxonomy 1.1 for fast lookups.
 * Provides search, hierarchy traversal, and classification helpers.
 *
 * Usage:
 * ```typescript
 * import { IABTaxonomyLoader } from '@browser/taxonomy'
 *
 * const loader = IABTaxonomyLoader.getInstance()
 * const entry = loader.getById(50) // Get "Male" taxonomy entry
 * const children = loader.getChildren(48) // Get children of "Gender"
 * ```
 */

import taxonomyData from '../data/iab_taxonomy.json'
import purchaseData from '../data/iab_purchase_classifications.json'
import sectionsData from '../data/iab_sections.json'
import {
  IABTaxonomyEntry,
  TaxonomySection,
  SectionIndex,
  TaxonomySearchOptions,
  TaxonomyLookupResult,
  getTaxonomyValue,
  buildCategoryPath,
  getTierDepth,
  isLeafNode,
} from '../types/iab-full-taxonomy'

/**
 * IAB Taxonomy Loader (Singleton)
 *
 * Loads 1,558 taxonomy entries and provides fast lookup/search.
 */
export class IABTaxonomyLoader {
  private static instance: IABTaxonomyLoader | null = null

  /** All taxonomy entries */
  private readonly entries: IABTaxonomyEntry[]

  /** Fast lookup by taxonomy ID */
  private readonly byId: Map<number, IABTaxonomyEntry>

  /** Fast lookup by section */
  private readonly bySection: Map<TaxonomySection, IABTaxonomyEntry[]>

  /** Parent → Children mapping */
  private readonly parentChildMap: Map<number, IABTaxonomyEntry[]>

  /** Purchase intent classifications */
  private readonly purchaseClassifications: Map<string, string>

  /** Section index (section → taxonomy IDs) */
  private readonly sectionIndex: SectionIndex

  private constructor() {
    console.info('🔧 Loading IAB Taxonomy (1,558 entries)...')

    this.entries = taxonomyData as IABTaxonomyEntry[]
    this.byId = new Map()
    this.bySection = new Map()
    this.parentChildMap = new Map()
    this.purchaseClassifications = new Map(Object.entries(purchaseData))
    this.sectionIndex = sectionsData as SectionIndex

    this._buildIndexes()

    console.info(`✅ IAB Taxonomy loaded: ${this.entries.length} entries`)
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): IABTaxonomyLoader {
    if (!IABTaxonomyLoader.instance) {
      IABTaxonomyLoader.instance = new IABTaxonomyLoader()
    }
    return IABTaxonomyLoader.instance
  }

  /**
   * Build fast lookup indexes
   */
  private _buildIndexes(): void {
    // Index by ID
    for (const entry of this.entries) {
      this.byId.set(entry.id, entry)
    }

    // Build parent-child map
    for (const entry of this.entries) {
      if (entry.parent_id !== null) {
        if (!this.parentChildMap.has(entry.parent_id)) {
          this.parentChildMap.set(entry.parent_id, [])
        }
        this.parentChildMap.get(entry.parent_id)!.push(entry)
      }
    }

    // Index by section using section index
    for (const [section, ids] of Object.entries(this.sectionIndex)) {
      const sectionEntries = ids
        .map(id => this.byId.get(id))
        .filter(e => e !== undefined) as IABTaxonomyEntry[]

      this.bySection.set(section as TaxonomySection, sectionEntries)
    }

    console.info('📊 Taxonomy indexes built:')
    console.info(`   - ${this.byId.size} entries by ID`)
    console.info(`   - ${this.parentChildMap.size} parent-child relationships`)
    console.info(`   - ${this.bySection.size} sections`)
  }

  /**
   * Get taxonomy entry by ID
   */
  public getById(taxonomyId: number): IABTaxonomyEntry | undefined {
    return this.byId.get(taxonomyId)
  }

  /**
   * Get all entries in a section
   */
  public getBySection(section: TaxonomySection): IABTaxonomyEntry[] {
    return this.bySection.get(section) || []
  }

  /**
   * Get all child entries for a parent taxonomy ID
   */
  public getChildren(parentId: number): IABTaxonomyEntry[] {
    return this.parentChildMap.get(parentId) || []
  }

  /**
   * Get parent entry
   */
  public getParent(entry: IABTaxonomyEntry): IABTaxonomyEntry | undefined {
    if (entry.parent_id === null) return undefined
    return this.byId.get(entry.parent_id)
  }

  /**
   * Get full path from root to entry
   */
  public getPath(entry: IABTaxonomyEntry): IABTaxonomyEntry[] {
    const path: IABTaxonomyEntry[] = [entry]
    let current = entry

    while (current.parent_id !== null) {
      const parent = this.byId.get(current.parent_id)
      if (!parent) break
      path.unshift(parent)
      current = parent
    }

    return path
  }

  /**
   * Get sibling entries (same parent)
   */
  public getSiblings(entry: IABTaxonomyEntry): IABTaxonomyEntry[] {
    if (entry.parent_id === null) return []

    const siblings = this.getChildren(entry.parent_id)
    return siblings.filter(s => s.id !== entry.id)
  }

  /**
   * Get full lookup result with path, children, and siblings
   */
  public lookup(taxonomyId: number): TaxonomyLookupResult | undefined {
    const entry = this.getById(taxonomyId)
    if (!entry) return undefined

    return {
      entry,
      path: this.getPath(entry),
      children: this.getChildren(entry.id),
      siblings: this.getSiblings(entry),
    }
  }

  /**
   * Search taxonomy entries by name (case-insensitive)
   */
  public searchByName(
    searchTerm: string,
    options: TaxonomySearchOptions = {}
  ): IABTaxonomyEntry[] {
    const searchLower = searchTerm.toLowerCase()
    let results = this.entries.filter(entry =>
      entry.name.toLowerCase().includes(searchLower)
    )

    // Filter by section
    if (options.section) {
      const sectionIds = new Set(this.sectionIndex[options.section])
      results = results.filter(entry => sectionIds.has(entry.id))
    }

    // Filter by tier
    if (options.tier) {
      results = results.filter(entry => getTierDepth(entry) === options.tier)
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  /**
   * Get all leaf nodes (entries with no children)
   */
  public getLeafNodes(section?: TaxonomySection): IABTaxonomyEntry[] {
    const entries = section ? this.getBySection(section) : this.entries
    return entries.filter(entry => isLeafNode(entry, this.entries))
  }

  /**
   * Get purchase intent classification description
   */
  public getPurchaseClassification(code: string): string | undefined {
    return this.purchaseClassifications.get(code)
  }

  /**
   * Get all purchase classifications
   */
  public getAllPurchaseClassifications(): Map<string, string> {
    return new Map(this.purchaseClassifications)
  }

  /**
   * Get taxonomy statistics
   */
  public getStatistics() {
    return {
      total_entries: this.entries.length,
      sections: {
        demographics: this.getBySection(TaxonomySection.DEMOGRAPHICS).length,
        household_data: this.getBySection(TaxonomySection.HOUSEHOLD_DATA).length,
        personal_attributes: this.getBySection(TaxonomySection.PERSONAL_ATTRIBUTES).length,
        personal_finance: this.getBySection(TaxonomySection.PERSONAL_FINANCE).length,
        interests: this.getBySection(TaxonomySection.INTERESTS).length,
        purchase_intent: this.getBySection(TaxonomySection.PURCHASE_INTENT).length,
      },
      purchase_classifications: this.purchaseClassifications.size,
    }
  }

  /**
   * Find entries by tier value
   */
  public findByTierValue(
    tier: 1 | 2 | 3 | 4 | 5,
    value: string,
    options: TaxonomySearchOptions = {}
  ): IABTaxonomyEntry[] {
    const tierKey = `tier_${tier}` as keyof IABTaxonomyEntry
    let results = this.entries.filter(
      entry => entry[tierKey] === value
    )

    if (options.section) {
      const sectionIds = new Set(this.sectionIndex[options.section])
      results = results.filter(entry => sectionIds.has(entry.id))
    }

    if (options.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }
}

/**
 * Export singleton instance getter
 */
export function getTaxonomyLoader(): IABTaxonomyLoader {
  return IABTaxonomyLoader.getInstance()
}

/**
 * Export helper functions
 */
export {
  getTaxonomyValue,
  buildCategoryPath,
  getTierDepth,
  isLeafNode,
}
