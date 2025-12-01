/**
 * Profile Tier Formatter
 *
 * TypeScript port of Python profile_tier_formatter.py
 * Source: src/email_parser/utils/profile_tier_formatter.py (lines 1-254)
 *
 * Transforms flat classification lists into tiered structure (primary/alternatives)
 * for JSON output while maintaining backward compatibility with existing Pydantic models.
 *
 * This is a presentation-layer transformation that doesn't affect storage or memory models.
 *
 * MIGRATION NOTE: This is an EXACT 1:1 port of the Python implementation.
 * Every function has been verified against the Python source.
 */

import {
  applyTieredClassification,
  type TaxonomySelection,
  type TieredClassification,
} from './tierSelector'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * TieredGroup - Demographics/Household format (mutually exclusive groups)
 */
export interface TieredGroup {
  primary: {
    taxonomy_id?: number
    tier_path: string
    value: string
    confidence: number
    evidence_count: number
    last_validated?: string
    days_since_validation?: number
    tier_depth: number
    granularity_score: number
    classification_type: 'primary'
  }
  alternatives: Array<{
    taxonomy_id?: number
    tier_path: string
    value: string
    confidence: number
    evidence_count: number
    last_validated?: string
    days_since_validation?: number
    tier_depth: number
    granularity_score: number
    classification_type: 'alternative'
    confidence_delta: number
  }>
  selection_method: string
}

/**
 * TieredInterest - Interests format (non-exclusive)
 */
export interface TieredInterest {
  primary: {
    taxonomy_id?: number
    tier_path: string
    value: string
    confidence: number
    evidence_count: number
    last_validated?: string
    days_since_validation?: number
    tier_depth: number
    granularity_score: number
    classification_type: 'primary'
  }
  alternatives: [] // Always empty for non-exclusive
  selection_method: 'non_exclusive'
  granularity_score: number
}

/**
 * TieredPurchaseIntent - Purchase Intent format
 */
export interface TieredPurchaseIntent extends TieredInterest {
  purchase_intent_flag?: string
}

// ============================================================================
// FORMATTER FUNCTIONS
// ============================================================================

/**
 * Format demographics memories into tiered structure.
 *
 * Python source: profile_tier_formatter.py:18-66
 *
 * @param demographicsMemories - List of demographic classification dicts from memory
 * @returns Dict with tiered demographics (age_range, gender, etc. with primary/alternatives)
 */
export function formatTieredDemographics(
  demographicsMemories: TaxonomySelection[]
): Record<string, TieredGroup> {
  // Python lines 28-29
  if (!demographicsMemories || demographicsMemories.length === 0) {
    return {}
  }

  // Python lines 31-32: Apply tiered classification
  const tiered = applyTieredClassification(demographicsMemories, 'demographics')

  // Python line 34
  const result: Record<string, TieredGroup> = {}

  // Python lines 36-45: Map grouping_value to demographic fields
  // Based on IAB Audience Taxonomy 1.1 (dynamic tier-based grouping)
  const groupingToField: Record<string, string> = {
    Gender: 'gender',
    Age: 'age_range',
    'Education (Highest Level)': 'education',
    'Employment Status': 'occupation',
    'Marital Status': 'marital_status',
    Language: 'language',
  }

  // Python lines 47-65
  for (const [tierGroupKey, tierResult] of Object.entries(tiered)) {
    // Python lines 48-49: Determine field name from grouping_value (pre-computed by taxonomy loader)
    const groupingValue = tierResult.primary.grouping_value || ''

    // Python lines 51-52: Look up field name from grouping_value
    let fieldName = groupingToField[groupingValue]

    // Python lines 54-57
    if (!fieldName) {
      // If no mapping, use grouping_value as field name (sanitized)
      fieldName = groupingValue
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/\(/g, '')
        .replace(/\)/g, '')
        .replace(/-/g, '_')
      console.debug(
        `Using sanitized grouping_value as field name: ${groupingValue} -> ${fieldName}`
      )
    }

    // Python lines 59-64: Format primary and alternatives
    result[fieldName] = {
      primary: _formatSelection(tierResult.primary),
      alternatives: tierResult.alternatives.map((alt) => _formatSelection(alt)),
      selection_method: tierResult.selection_method,
    }
  }

  // Python line 66
  return result
}

/**
 * Format household memories into tiered structure.
 *
 * Python source: profile_tier_formatter.py:69-124
 *
 * @param householdMemories - List of household classification dicts from memory
 * @returns Dict with tiered household data (income, property_type, etc. with primary/alternatives)
 */
export function formatTieredHousehold(
  householdMemories: TaxonomySelection[]
): Record<string, TieredGroup> {
  // Python lines 79-80
  if (!householdMemories || householdMemories.length === 0) {
    return {}
  }

  // Python lines 82-83: Apply tiered classification
  const tiered = applyTieredClassification(householdMemories, 'household')

  // Python line 85
  const result: Record<string, TieredGroup> = {}

  // Python lines 87-103: Map grouping_value to household fields (based on IAB Audience Taxonomy 1.1)
  // grouping_value is pre-computed by IABTaxonomyLoader based on parent relationships
  const groupingToField: Record<string, string> = {
    'Home Location': 'location',
    'Household Income (USD)': 'income',
    'Length of Residence': 'length_of_residence',
    'Life Stage': 'life_stage',
    'Median Home Value (USD)': 'median_home_value',
    'Monthly Housing Payment (USD)': 'monthly_housing_payment',
    'Number of Adults': 'number_of_adults',
    'Number of Children': 'number_of_children',
    'Number of Individuals': 'number_of_individuals',
    Ownership: 'ownership',
    'Property Type': 'property_type',
    Urbanization: 'urbanization',
    Language: 'language',
  }

  // Python lines 105-123: Map tier groups to household fields
  for (const [tierGroupKey, tierResult] of Object.entries(tiered)) {
    // Python lines 107-108: Use pre-computed grouping_value (same approach as demographics)
    const groupingValue = tierResult.primary.grouping_value || ''

    // Python lines 110-111: Look up field name from grouping_value
    let fieldName = groupingToField[groupingValue]

    // Python lines 113-116
    if (!fieldName) {
      // Fallback: sanitize grouping_value as field name
      fieldName = groupingValue
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/\(/g, '')
        .replace(/\)/g, '')
        .replace(/-/g, '_')
      console.debug(
        `Using sanitized grouping_value as field name: ${groupingValue} -> ${fieldName}`
      )
    }

    // Python lines 118-122
    result[fieldName] = {
      primary: _formatSelection(tierResult.primary),
      alternatives: tierResult.alternatives.map((alt) => _formatSelection(alt)),
      selection_method: tierResult.selection_method,
    }
  }

  // Python line 124
  return result
}

/**
 * Format interest memories into tiered structure.
 *
 * Python source: profile_tier_formatter.py:127-160
 *
 * For interests (non-exclusive), each classification is its own "primary"
 * but we still rank by granularity score.
 *
 * @param interestMemories - List of interest classification dicts from memory
 * @returns List of tiered interests, sorted by granularity score
 */
export function formatTieredInterests(interestMemories: TaxonomySelection[]): TieredInterest[] {
  // Python lines 140-141
  if (!interestMemories || interestMemories.length === 0) {
    return []
  }

  // Python lines 143-144: Apply tiered classification
  const tiered = applyTieredClassification(interestMemories, 'interests')

  // Python lines 146-147: Convert to list and sort by granularity score
  const result: TieredInterest[] = []

  // Python lines 148-155
  for (const tierResult of Object.values(tiered)) {
    const primary = tierResult.primary
    result.push({
      primary: _formatSelection(primary),
      alternatives: [], // Interests are non-exclusive, no alternatives
      selection_method: tierResult.selection_method as 'non_exclusive',
      granularity_score: primary.granularity_score || 0.0,
    })
  }

  // Python lines 157-158: Sort by granularity score (descending)
  result.sort((a, b) => b.granularity_score - a.granularity_score)

  // Python line 160
  return result
}

/**
 * Format purchase intent memories into tiered structure.
 *
 * Python source: profile_tier_formatter.py:163-196
 *
 * Similar to interests, purchase intent is non-exclusive.
 *
 * @param purchaseMemories - List of purchase intent classification dicts from memory
 * @returns List of tiered purchase intent, sorted by granularity score
 */
export function formatTieredPurchaseIntent(
  purchaseMemories: TaxonomySelection[]
): TieredPurchaseIntent[] {
  // Python lines 175-176
  if (!purchaseMemories || purchaseMemories.length === 0) {
    return []
  }

  // Python lines 178-179: Apply tiered classification
  const tiered = applyTieredClassification(purchaseMemories, 'purchase_intent')

  // Python lines 181-182: Convert to list and sort by granularity score
  const result: TieredPurchaseIntent[] = []

  // Python lines 183-191
  for (const tierResult of Object.values(tiered)) {
    const primary = tierResult.primary
    result.push({
      primary: _formatSelection(primary),
      alternatives: [], // Purchase intent is non-exclusive
      selection_method: tierResult.selection_method as 'non_exclusive',
      granularity_score: primary.granularity_score || 0.0,
      purchase_intent_flag: primary.purchase_intent_flag,
    })
  }

  // Python lines 193-194: Sort by granularity score (descending)
  result.sort((a, b) => b.granularity_score - a.granularity_score)

  // Python line 196
  return result
}

/**
 * Add tiered classification structure to profile dict.
 *
 * Python source: profile_tier_formatter.py:224-253
 *
 * This modifies the profile dict to include tiered_classifications section
 * while preserving the original flat structure for backward compatibility.
 *
 * @param profileDict - Original profile dict
 * @param memories - Dict of memories by section (demographics, household, interests, purchase_intent)
 * @returns Enhanced profile dict with tiered_classifications section
 */
export function addTieredStructureToProfile(
  profileDict: Record<string, any>,
  memories: {
    demographics: TaxonomySelection[]
    household: TaxonomySelection[]
    interests: TaxonomySelection[]
    purchase_intent: TaxonomySelection[]
  }
): Record<string, any> {
  // Python line 238-239: Add schema version
  profileDict.schema_version = '2.0'

  // Python lines 241-247: Add tiered_classifications section
  profileDict.tiered_classifications = {
    demographics: formatTieredDemographics(memories.demographics || []),
    household: formatTieredHousehold(memories.household || []),
    interests: formatTieredInterests(memories.interests || []),
    purchase_intent: formatTieredPurchaseIntent(memories.purchase_intent || []),
  }

  // Python lines 249-251: Log summary
  console.log(
    `Added tiered classifications: ` +
      `${Object.keys(profileDict.tiered_classifications.demographics).length} demographics groups, ` +
      `${profileDict.tiered_classifications.interests.length} interests`
  )

  // Python line 253
  return profileDict
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a single selection dict for JSON output.
 *
 * Python source: profile_tier_formatter.py:199-221
 *
 * @param selection - Classification dict
 * @returns Formatted dict with standard fields
 */
function _formatSelection(selection: any): any {
  // Python lines 209-220
  return {
    taxonomy_id: selection.taxonomy_id,
    tier_path: selection.tier_path || selection.category_path || '',
    value: selection.value,
    confidence: selection.confidence,
    evidence_count: selection.evidence_count || 1,
    last_validated: selection.last_validated || '',
    days_since_validation: selection.days_since_validation || 0,
    tier_depth: selection.tier_depth || 0,
    granularity_score: selection.granularity_score || 0.0,
    classification_type: selection.classification_type || 'primary',
    confidence_delta:
      selection.classification_type === 'alternative' ? selection.confidence_delta || 0.0 : null,
  }
}
