/**
 * IAB Full Taxonomy Types
 *
 * Complete IAB Audience Taxonomy 1.1 with 1,558 entries.
 * 5-tier hierarchical structure for demographic, household, interests, and purchase intent.
 *
 * Based on IABTL-Audience-Taxonomy-1.1-Final.xlsx
 */

/**
 * IAB Taxonomy Section Types
 */
export enum TaxonomySection {
  DEMOGRAPHICS = 'demographics',
  HOUSEHOLD_DATA = 'household_data',
  PERSONAL_ATTRIBUTES = 'personal_attributes',
  PERSONAL_FINANCE = 'personal_finance',
  INTERESTS = 'interests',
  PURCHASE_INTENT = 'purchase_intent',
}

/**
 * Grouping tier key (tier_2 or tier_3 depending on hierarchy depth)
 */
export type GroupingTierKey = 'tier_2' | 'tier_3'

/**
 * IAB Taxonomy Entry - Full 5-tier hierarchical structure
 *
 * Example:
 * ID 20: Demographic | Education & Occupation | Education (Highest Level) | College Education | Bachelor's Degree
 * - tier_1: "Demographic"
 * - tier_2: "Education & Occupation"
 * - tier_3: "Education (Highest Level)"
 * - tier_4: "College Education"
 * - tier_5: "Bachelor's Degree"
 */
export interface IABTaxonomyEntry {
  /** Unique taxonomy ID */
  id: number

  /** Parent taxonomy ID (null for root entries) */
  parent_id: number | null

  /** Full condensed name (e.g., "Demographic | Gender | Male") */
  name: string

  /** Tier 1: Top-level category (Demographic, Household, Interests, Purchase Intent) */
  tier_1: string

  /** Tier 2: Second-level category */
  tier_2: string

  /** Tier 3: Third-level category (may be empty) */
  tier_3: string

  /** Tier 4: Fourth-level category (may be empty) */
  tier_4: string

  /** Tier 5: Fifth-level category (may be empty) */
  tier_5: string

  /** Original Excel row number (for debugging) */
  excel_row: number

  /** Which tier to use for grouping (tier_2 or tier_3) */
  grouping_tier_key: GroupingTierKey

  /** The actual value to group by */
  grouping_value: string

  /** Whether this entry is a grouping root */
  is_grouping_root: boolean
}

/**
 * Purchase Intent Classification Code
 *
 * Codes like PIPR1, PIPF2, PIPV3, PIFI1 that describe purchase intent timing/confidence
 */
export interface PurchaseClassification {
  code: string
  description: string
}

/**
 * Section Index - Maps section name to taxonomy IDs
 */
export type SectionIndex = Record<TaxonomySection, number[]>

/**
 * IAB Classification Result with Full Taxonomy
 *
 * Extends the simplified IABClassification with full 5-tier taxonomy data
 */
export interface IABFullTaxonomyClassification {
  /** Unique identifier for this classification */
  id: string

  /** User ID this classification belongs to */
  userId: string

  /** Taxonomy ID (1-1558) */
  taxonomy_id: number

  /** Full 5-tier hierarchy */
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4: string
  tier_5: string

  /** Category path (e.g., "Demographic | Gender | Male") */
  category_path: string

  /** The deepest classification value (tier_5 > tier_4 > tier_3) */
  classification_value: string

  /** Confidence score (0.0 to 1.0) */
  confidence: number

  /** Source data type */
  source: string

  /** Original source item ID */
  sourceItemId: string

  /** Text preview */
  textPreview?: string

  /** ISO 8601 timestamp when classified */
  timestamp: string

  /** Evidence/reasoning for classification */
  reasoning?: string

  /** Grouping metadata */
  grouping_tier_key: GroupingTierKey
  grouping_value: string

  /** Purchase intent classification code (if applicable) */
  purchase_classification?: string
}

/**
 * Taxonomy Search Options
 */
export interface TaxonomySearchOptions {
  /** Section to search within */
  section?: TaxonomySection

  /** Tier level to match */
  tier?: 1 | 2 | 3 | 4 | 5

  /** Include parent entries in results */
  include_parents?: boolean

  /** Maximum number of results */
  limit?: number
}

/**
 * Taxonomy Lookup Result
 */
export interface TaxonomyLookupResult {
  /** The found entry */
  entry: IABTaxonomyEntry

  /** Path from root to this entry */
  path: IABTaxonomyEntry[]

  /** Direct children of this entry */
  children: IABTaxonomyEntry[]

  /** Sibling entries (same parent) */
  siblings: IABTaxonomyEntry[]
}

/**
 * Helper function to get the deepest classification value from a taxonomy entry
 *
 * Returns tier_5 if present, else tier_4, else tier_3, etc.
 */
export function getTaxonomyValue(entry: IABTaxonomyEntry): string {
  if (entry.tier_5) return entry.tier_5
  if (entry.tier_4) return entry.tier_4
  if (entry.tier_3) return entry.tier_3
  if (entry.tier_2) return entry.tier_2
  return entry.tier_1
}

/**
 * Helper function to build category path from taxonomy entry
 */
export function buildCategoryPath(entry: IABTaxonomyEntry): string {
  const parts: string[] = []
  if (entry.tier_1) parts.push(entry.tier_1)
  if (entry.tier_2) parts.push(entry.tier_2)
  if (entry.tier_3) parts.push(entry.tier_3)
  if (entry.tier_4) parts.push(entry.tier_4)
  if (entry.tier_5) parts.push(entry.tier_5)
  return parts.join(' | ')
}

/**
 * Helper function to get tier depth (1-5)
 */
export function getTierDepth(entry: IABTaxonomyEntry): number {
  if (entry.tier_5) return 5
  if (entry.tier_4) return 4
  if (entry.tier_3) return 3
  if (entry.tier_2) return 2
  return 1
}

/**
 * Helper to check if entry is a leaf node (no children)
 */
export function isLeafNode(entry: IABTaxonomyEntry, allEntries: IABTaxonomyEntry[]): boolean {
  return !allEntries.some(e => e.parent_id === entry.id)
}
