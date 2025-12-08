/**
 * Tiered Classification Selector
 *
 * TypeScript port of Python classification_tier_selector.py
 * Source: src/email_parser/utils/classification_tier_selector.py (lines 1-399)
 *
 * Implements tiered confidence classification system that distinguishes between:
 * - Primary Classification: Highest confidence within mutually-exclusive tier groups
 * - Alternative Classifications: Lower confidence viable alternatives
 *
 * This enables:
 * - Conflict resolution in mutually-exclusive categories (Male vs Female, age ranges)
 * - Granularity prioritization (tier_4/tier_5 over tier_2/tier_3 when high confidence)
 * - Uncertainty preservation (keeping alternative classifications)
 * - Profile evolution tracking (smooth transitions when evidence shifts)
 *
 * Reference: docs/TIERED_CONFIDENCE_CLASSIFICATION_PROPOSAL.md
 *
 * MIGRATION NOTE: This is an EXACT 1:1 port of the Python implementation.
 * Every function and algorithm has been verified against the Python source.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * TaxonomySelection - Raw classification from analyzer
 *
 * This is the INPUT to tier selection (from semantic memory)
 */
export interface TaxonomySelection {
  taxonomy_id: number
  section: string
  value: string
  confidence: number
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4: string
  tier_5: string
  tier_path: string
  category_path: string
  grouping_tier_key: string
  grouping_value: string
  reasoning: string
  evidence_count?: number
  last_validated?: string
  days_since_validation?: number
  supporting_evidence?: Array<{
    content: string
    source: string
    confidence: number
  }>
  purchase_intent_flag?: string
}

/**
 * TieredClassification - Result of tier selection
 *
 * Python source: classification_tier_selector.py:25-48 (class TieredClassification)
 *
 * This is the OUTPUT from tier selection
 */
export interface TieredClassification {
  primary: TaxonomySelection & {
    granularity_score: number
    tier_depth: number
    classification_type: 'primary'
  }
  alternatives: Array<
    TaxonomySelection & {
      granularity_score: number
      tier_depth: number
      classification_type: 'alternative'
      confidence_delta: number
    }
  >
  tier_group: string
  selection_method: 'highest_confidence' | 'granularity_weighted' | 'non_exclusive'
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate tier depth (number of non-empty tiers).
 *
 * Python source: classification_tier_selector.py:51-74
 *
 * @param classification - Classification dict with tier_1, tier_2, etc.
 * @returns Number of non-empty tiers (1-5)
 *
 * @example
 * calculateTierDepth({
 *   tier_1: "Interest",
 *   tier_2: "Technology",
 *   tier_3: "",
 *   tier_4: "",
 *   tier_5: ""
 * }) // Returns 2
 *
 * @example
 * calculateTierDepth({
 *   tier_1: "Interest",
 *   tier_2: "Careers",
 *   tier_3: "Remote Working",
 *   tier_4: "",
 *   tier_5: ""
 * }) // Returns 3
 */
export function calculateTierDepth(classification: TaxonomySelection): number {
  // Python lines 67-73
  const tiers = [
    classification.tier_1 || '',
    classification.tier_2 || '',
    classification.tier_3 || '',
    classification.tier_4 || '',
    classification.tier_5 || '',
  ]

  // Python line 74
  return tiers.filter((t) => t && t.trim()).length
}

/**
 * Calculate granularity-weighted score.
 *
 * Python source: classification_tier_selector.py:77-112
 *
 * Formula:
 *   score = confidence + (tier_depth * granularity_bonus) if confidence >= 0.7 else confidence
 *
 * This prioritizes more specific (deeper) classifications when confidence is high.
 *
 * @param classification - Classification dict with confidence and tier info
 * @param granularityBonus - Bonus per tier level (default: 0.05)
 * @returns Granularity-weighted score
 *
 * @example
 * calculateGranularityScore({
 *   confidence: 0.95,
 *   tier_1: "Interest",
 *   tier_2: "Careers",
 *   tier_3: "Remote Working"
 * }) // Returns 1.10 (0.95 + 3 * 0.05)
 *
 * @example
 * calculateGranularityScore({
 *   confidence: 0.65,
 *   tier_1: "Interest",
 *   tier_2: "Technology"
 * }) // Returns 0.65 (below 0.7 threshold, no bonus)
 */
export function calculateGranularityScore(
  classification: TaxonomySelection,
  granularityBonus: number = 0.05
): number {
  // Python line 103
  const confidence = classification.confidence || 0.0

  // Python lines 105-110
  if (confidence >= 0.7) {
    // Python line 107
    const depth = calculateTierDepth(classification)
    // Python line 108
    const score = confidence + depth * granularityBonus
    return score
  } else {
    // Python line 110
    return confidence
  }
}

/**
 * Select primary classification and alternatives from a tier group.
 *
 * Python source: classification_tier_selector.py:115-221
 *
 * Selection Algorithm:
 * 1. Filter by minimum confidence threshold (default: 0.5)
 * 2. Calculate granularity scores (confidence + depth bonus if confidence >= 0.7)
 * 3. Select highest scoring classification as primary
 * 4. Select alternatives within confidence delta threshold (default: 0.3)
 *
 * @param classifications - List of classification dicts from semantic memory
 * @param tierGroup - Tier group identifier (e.g., "demographics.gender")
 * @param minConfidence - Minimum confidence threshold (default: 0.5)
 * @param confidenceDeltaThreshold - Max delta for alternatives (default: 0.3)
 * @param granularityBonus - Bonus per tier level (default: 0.05)
 * @returns TieredClassification or null if no viable classifications
 *
 * @example
 * const classifications = [
 *   {taxonomy_id: 21, value: "Female", confidence: 0.99, tier_1: "Demographic", tier_2: "Female"},
 *   {taxonomy_id: 20, value: "Male", confidence: 0.89, tier_1: "Demographic", tier_2: "Male"}
 * ]
 * const result = selectPrimaryAndAlternatives(classifications, "demographics.gender")
 * result.primary.value // "Female"
 * result.alternatives[0].value // "Male"
 */
export function selectPrimaryAndAlternatives(
  classifications: TaxonomySelection[],
  tierGroup: string,
  minConfidence: number = 0.5,
  confidenceDeltaThreshold: number = 0.3,
  granularityBonus: number = 0.05
): TieredClassification | null {
  // Python lines 154-155
  if (!classifications || classifications.length === 0) {
    return null
  }

  // Python lines 157-158: Step 1 - Filter by minimum confidence
  const viable = classifications.filter((c) => (c.confidence || 0.0) >= minConfidence)

  // Python lines 160-162
  if (viable.length === 0) {
    console.debug(`No viable classifications for ${tierGroup} (min_confidence=${minConfidence})`)
    return null
  }

  // Python lines 164-174: Step 2 - Calculate granularity scores
  const scored: Array<{
    classification: TaxonomySelection
    granularity_score: number
    tier_depth: number
  }> = []

  for (const c of viable) {
    // Python line 167
    const score = calculateGranularityScore(c, granularityBonus)
    // Python line 168
    const tier_depth = calculateTierDepth(c)

    // Python lines 170-174
    scored.push({
      classification: c,
      granularity_score: score,
      tier_depth: tier_depth,
    })
  }

  // Python lines 176-177: Step 3 - Sort by granularity score (highest first)
  scored.sort((a, b) => b.granularity_score - a.granularity_score)

  // REQ-1.4: Filter out "Unknown" classifications in mutually-exclusive tiers
  // For mutually-exclusive tier groups (Gender, Age, Education, etc.), if the highest
  // confidence classification value starts with "Unknown ", discard the entire tier group.
  // Rationale: "Unknown [Field]" indicates inability to classify, not a valid classification.
  if (scored.length > 0 && scored[0].classification.value?.startsWith('Unknown ')) {
    console.warn(
      `[REQ-1.4] Filtered tier group '${tierGroup}' - ` +
        `highest confidence classification is '${scored[0].classification.value || 'Unknown'}' ` +
        `(confidence: ${((scored[0].classification.confidence || 0) * 100).toFixed(1)}%)`
    )
    return null
  }

  // Python lines 179-184: Step 4 - Select primary
  const primaryEntry = scored[0]
  const primary = { ...primaryEntry.classification } as TaxonomySelection & {
    granularity_score: number
    tier_depth: number
    classification_type: 'primary'
  }
  primary.granularity_score = primaryEntry.granularity_score
  primary.tier_depth = primaryEntry.tier_depth
  primary.classification_type = 'primary'

  // Python lines 186-189: Step 5 - Select alternatives (within confidence delta threshold)
  const primary_score = primaryEntry.granularity_score
  const primary_confidence = primary.confidence || 0.0
  const alternatives: Array<
    TaxonomySelection & {
      granularity_score: number
      tier_depth: number
      classification_type: 'alternative'
      confidence_delta: number
    }
  > = []

  // Python lines 191-205
  for (const entry of scored.slice(1)) {
    const score = entry.granularity_score
    const confidence = entry.classification.confidence || 0.0

    // Python lines 195-196: Calculate confidence delta (use raw confidence, not granularity score)
    const confidence_delta = primary_confidence - confidence

    // Python lines 198-205: Include if confidence delta within threshold and above min confidence
    if (confidence_delta <= confidenceDeltaThreshold && confidence >= minConfidence) {
      const alt = { ...entry.classification } as TaxonomySelection & {
        granularity_score: number
        tier_depth: number
        classification_type: 'alternative'
        confidence_delta: number
      }
      alt.granularity_score = score
      alt.tier_depth = entry.tier_depth
      alt.classification_type = 'alternative'
      alt.confidence_delta = Math.round(confidence_delta * 1000) / 1000 // Python line 204
      alternatives.push(alt)
    }
  }

  // Python line 207-208: Determine selection method
  const selection_method =
    primary.confidence >= 0.7 ? 'granularity_weighted' : 'highest_confidence'

  // Python lines 210-214: Debug logging
  console.debug(
    `Selected primary for ${tierGroup}: ${primary.value} ` +
      `(score=${primary.granularity_score.toFixed(3)}, method=${selection_method}), ` +
      `${alternatives.length} alternatives`
  )

  // Python lines 216-221: Return TieredClassification
  return {
    primary,
    alternatives,
    tier_group: tierGroup,
    selection_method: selection_method as 'highest_confidence' | 'granularity_weighted',
  }
}

/**
 * Group classifications by pre-computed grouping_value from taxonomy.
 *
 * Python source: classification_tier_selector.py:224-284
 *
 * The grouping_value is determined by the IAB taxonomy structure and parent relationships:
 * - For entries where parent has no tier_3: grouped by tier_2 (e.g., "Gender")
 * - For entries where parent has tier_3: grouped by tier_3 (e.g., "Education (Highest Level)")
 *
 * This handles complex cases like "Education & Occupation" which contains both:
 * - "Education (Highest Level)" group (tier_3) for education levels
 * - "Employment Status" group (tier_3) for employment status
 *
 * @param classifications - List of classification dicts with grouping_value field
 * @param section - Section name (demographics, household, interests, purchase_intent)
 * @returns Dict mapping grouping_value to list of classifications
 *
 * @example
 * const classifications = [
 *   {grouping_value: "Gender", value: "Female", confidence: 0.99},
 *   {grouping_value: "Gender", value: "Male", confidence: 0.89},
 *   {grouping_value: "Education (Highest Level)", value: "College", confidence: 0.85}
 * ]
 * const groups = groupClassificationsByTier(classifications, "demographics")
 * Object.keys(groups) // ['Gender', 'Education (Highest Level)']
 */
export function groupClassificationsByTier(
  classifications: TaxonomySelection[],
  section: string
): Record<string, TaxonomySelection[]> {
  // Python line 257
  const groups: Record<string, TaxonomySelection[]> = {}

  // Python lines 259-282
  for (const c of classifications) {
    // For demographics/household (mutually exclusive), use grouping_tier_key (e.g., "Gender")
    // For interests/purchase_intent (non-exclusive), use grouping_value (e.g., "Technology")
    const isMutuallyExclusive = section === 'demographics' || section === 'household'
    const groupingKey = isMutuallyExclusive
      ? c.grouping_tier_key || c.grouping_value || ''
      : c.grouping_value || ''

    // Python lines 261-266
    if (!groupingKey) {
      console.warn(
        `Classification missing grouping key: ` +
          `taxonomy_id=${c.taxonomy_id}, value=${c.value}`
      )
      continue
    }

    // Python lines 268-270
    if (!(groupingKey in groups)) {
      groups[groupingKey] = []
      console.debug(`[${section}] Created new group: '${groupingKey}'`)
    }

    // Python lines 272-276
    groups[groupingKey].push(c)
    console.debug(
      `[${section}] Added to group '${groupingKey}': ${c.value} ` +
        `(ID ${c.taxonomy_id}, confidence ${(c.confidence || 0).toFixed(2)})`
    )
  }

  // Python lines 278-282: Log final grouping summary
  console.log(
    `[${section}] Grouped ${classifications.length} classifications ` +
      `into ${Object.keys(groups).length} groups:`
  )
  for (const [groupKey, items] of Object.entries(groups)) {
    const values = items
      .slice(0, 5)
      .map((item) => `${item.value}(${(item.confidence || 0).toFixed(2)})`)
      .join(', ')
    console.log(`  '${groupKey}': ${items.length} items - ${values}`)
  }

  // Python line 284
  return groups
}

/**
 * Determine if a grouping value represents mutually exclusive categories.
 *
 * Python source: classification_tier_selector.py:287-319
 *
 * Most grouping values are mutually exclusive (you can only be in one category).
 * Notable exceptions are listed below.
 *
 * Mutually Exclusive Examples:
 * - "Gender": Male XOR Female
 * - "Age": Age ranges are mutually exclusive
 * - "Education (Highest Level)": Education levels are mutually exclusive
 * - "Marital Status": Single XOR Married XOR Divorced
 * - "Income": Income ranges are mutually exclusive
 *
 * Non-Exclusive Examples:
 * - "Employment Status": Can be employed AND educated (separate groups)
 * - Interests: All interest categories are non-exclusive
 * - Purchase Intent: Can have multiple purchase intents
 *
 * @param groupingValue - The grouping value to check
 * @returns True if mutually exclusive, False otherwise
 */
export function isMutuallyExclusiveTier(groupingValue: string): boolean {
  // Python lines 314-316: Most grouping values are mutually exclusive
  // Only explicitly list the NON-exclusive ones
  const nonExclusiveGroups = [
    'Employment Status', // Can be employed AND have education level
    // Interests and Purchase Intent are handled by section logic in apply_tiered_classification
  ]

  // Python line 319
  return !nonExclusiveGroups.includes(groupingValue)
}

/**
 * Apply tiered classification logic to a section's classifications.
 *
 * Python source: classification_tier_selector.py:322-398
 *
 * This is the main entry point for applying primary/alternative selection.
 *
 * @param classifications - List of classification dicts from semantic memory
 * @param section - Section name (demographics, household, interests, purchase_intent)
 * @param minConfidence - Minimum confidence threshold
 * @param confidenceDeltaThreshold - Max delta for alternatives
 * @returns Dict mapping tier_2 groups to TieredClassification objects
 *
 * @example
 * const classifications = [
 *   {tier_2: "Female", value: "Female", confidence: 0.99, grouping_value: "Gender"},
 *   {tier_2: "Male", value: "Male", confidence: 0.89, grouping_value: "Gender"}
 * ]
 * const tiered = applyTieredClassification(classifications, "demographics")
 * tiered['Gender'].primary.value // "Female"
 */
export function applyTieredClassification(
  classifications: TaxonomySelection[],
  section: string,
  minConfidence: number = 0.5,
  confidenceDeltaThreshold: number = 0.3
): Record<string, TieredClassification> {
  // Python line 351-352: Group by tier (tier_3 for demographics/household, tier_2 for interests/purchase_intent)
  const groups = groupClassificationsByTier(classifications, section)

  // Python line 354
  const tieredResults: Record<string, TieredClassification> = {}

  // Python lines 356-397
  for (const [tierValue, groupClassifications] of Object.entries(groups)) {
    // Python lines 357-358: Check if mutually exclusive (tierValue is the grouping_value)
    const isExclusive = isMutuallyExclusiveTier(tierValue)

    // Python lines 360-371
    if (isExclusive) {
      // Select primary and alternatives
      // Python line 362: Create tier_group identifier
      const tierGroup = `${section}.${tierValue
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/\(/g, '')
        .replace(/\)/g, '')}`

      // Python lines 363-368
      const tiered = selectPrimaryAndAlternatives(
        groupClassifications,
        tierGroup,
        minConfidence,
        confidenceDeltaThreshold
      )

      // Python lines 370-371
      if (tiered) {
        tieredResults[tierValue] = tiered
      }
    } else {
      // Python lines 372-396: Non-exclusive: treat all as primaries (interests, purchase intent, employment status)
      // Still apply granularity scoring for ranking
      for (const c of groupClassifications) {
        // Python line 376
        const tierGroup = `${section}.${tierValue
          .toLowerCase()
          .replace(/ /g, '_')
          .replace(/\(/g, '')
          .replace(/\)/g, '')}`

        // Python lines 378-385: Each classification is its own "primary" with no alternatives
        const score = calculateGranularityScore(c)
        const depth = calculateTierDepth(c)

        const primary = { ...c } as TaxonomySelection & {
          granularity_score: number
          tier_depth: number
          classification_type: 'primary'
        }
        primary.granularity_score = score
        primary.tier_depth = depth
        primary.classification_type = 'primary'

        // Python lines 387-392
        const tiered: TieredClassification = {
          primary,
          alternatives: [],
          tier_group: tierGroup,
          selection_method: 'non_exclusive',
        }

        // Python lines 394-396: Use taxonomy_id as key for non-exclusive groups
        const key = `${tierValue}_${c.taxonomy_id}`
        tieredResults[key] = tiered
      }
    }
  }

  // Python line 398
  return tieredResults
}
