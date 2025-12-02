/**
 * IAB Classifier Helper Functions
 *
 * TypeScript port of Python helper functions from:
 * src/email_parser/workflow/nodes/analyzers.py (lines 30-162)
 *
 * This file provides:
 * - Taxonomy entry lookup
 * - Taxonomy value extraction
 * - Taxonomy classification validation
 *
 * MIGRATION NOTE: This is an EXACT 1:1 translation of the Python implementation.
 * Every function has been verified against the Python source.
 */

import { IABTaxonomyLoader } from './taxonomy'

/**
 * Logger placeholder
 * TODO: Implement proper logging system
 */
const logger = {
  warning: (message: string) => console.warn('[IAB Classifier]', message),
  error: (message: string) => console.error('[IAB Classifier]', message),
}

/**
 * Get taxonomy loader singleton instance
 * Python: analyzers.py:42 - loader = _get_taxonomy_loader()
 */
function getTaxonomyLoader(): IABTaxonomyLoader {
  return IABTaxonomyLoader.getInstance()
}

// ============================================================================
// TAXONOMY LOOKUP
// ============================================================================

/**
 * Taxonomy entry return type (matches Python dict structure)
 * Python: analyzers.py:54-64
 */
export interface TaxonomyLookupResult {
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4: string
  tier_5: string
  category_path: string
  name: string
  grouping_tier_key: string
  grouping_value: string
}

/**
 * Look up taxonomy entry by ID and return tier information
 *
 * Python source: analyzers.py:30-67
 *
 * @param taxonomy_id - IAB Taxonomy ID
 * @returns Dict with tier info and metadata, or undefined if not found
 */
export function lookupTaxonomyEntry(
  taxonomy_id: number
): TaxonomyLookupResult | undefined {
  try {
    // Python line 42: loader = _get_taxonomy_loader()
    const loader = getTaxonomyLoader()

    // Python line 43: entry = loader.taxonomy_by_id.get(taxonomy_id)
    const entry = loader.getById(taxonomy_id)

    // Python lines 45-47: if not entry: ... return None
    if (!entry) {
      logger.warning(`Taxonomy ID ${taxonomy_id} not found in IAB taxonomy`)
      return undefined
    }

    // Python lines 50-52: Build category_path from tiers
    // tiers = [entry['tier_1'], entry['tier_2'], entry['tier_3'], entry['tier_4'], entry['tier_5']]
    const tiers = [entry.tier_1, entry.tier_2, entry.tier_3, entry.tier_4, entry.tier_5]
    // non_empty_tiers = [t for t in tiers if t]
    const nonEmptyTiers = tiers.filter((t) => t)
    // category_path = " | ".join(non_empty_tiers)
    const categoryPath = nonEmptyTiers.join(' | ')

    // Python lines 54-64: return {...}
    return {
      tier_1: entry.tier_1,
      tier_2: entry.tier_2,
      tier_3: entry.tier_3,
      tier_4: entry.tier_4,
      tier_5: entry.tier_5,
      category_path: categoryPath,
      name: entry.name,
      // Python line 62: entry.get('grouping_tier_key', 'tier_2')
      grouping_tier_key: entry.grouping_tier_key || 'tier_2',
      // Python line 63: entry.get('grouping_value', entry['tier_2'])
      grouping_value: entry.grouping_value || entry.tier_2,
    }
  } catch (e) {
    // Python lines 65-67: except Exception as e: ... return None
    logger.error(`Error looking up taxonomy ${taxonomy_id}: ${e}`)
    return undefined
  }
}

// ============================================================================
// TAXONOMY VALUE EXTRACTION
// ============================================================================

/**
 * Extract the actual classification value from a taxonomy entry
 *
 * The value is the deepest non-empty tier (tier_5 > tier_4 > tier_3).
 *
 * Python source: analyzers.py:70-100
 *
 * @param taxonomy_entry - Taxonomy entry from lookupTaxonomyEntry
 * @returns The actual classification value (e.g., "Male", "25-29")
 *
 * @example
 * // ID 50: Demographic | Gender | Male
 * const entry = lookupTaxonomyEntry(50)
 * getTaxonomyValue(entry) // Returns "Male" (tier_3)
 *
 * @example
 * // ID 21: Demographic | ... | College Education | Professional School
 * const entry = lookupTaxonomyEntry(21)
 * getTaxonomyValue(entry) // Returns "Professional School" (tier_5)
 */
export function getTaxonomyValue(taxonomy_entry: TaxonomyLookupResult): string {
  // Python lines 94-97: Check tiers from deepest to shallowest
  // for tier_key in ['tier_5', 'tier_4', 'tier_3']:
  for (const tierKey of ['tier_5', 'tier_4', 'tier_3'] as const) {
    // Python line 95: value = taxonomy_entry.get(tier_key, "").strip()
    const value = (taxonomy_entry[tierKey] || '').trim()

    // Python lines 96-97: if value: return value
    if (value) {
      return value
    }
  }

  // Python line 100: return taxonomy_entry.get('tier_2', "").strip()
  // Fallback to tier_2 if all deeper tiers are empty
  return (taxonomy_entry.tier_2 || '').trim()
}

// ============================================================================
// TAXONOMY VALIDATION
// ============================================================================

/**
 * Validate that LLM's classification value matches the taxonomy entry
 *
 * This prevents data corruption from LLM errors where wrong taxonomy IDs
 * are paired with incorrect values.
 *
 * Python source: analyzers.py:103-162
 *
 * @param taxonomy_id - IAB Taxonomy ID from LLM
 * @param llm_value - Classification value from LLM
 * @param taxonomy_entry - Taxonomy entry from lookupTaxonomyEntry
 * @returns True if valid (value matches taxonomy), False if mismatch
 *
 * @example
 * // Valid: LLM returns ID=50, value="Male"
 * const entry = lookupTaxonomyEntry(50)
 * validateTaxonomyClassification(50, "Male", entry) // Returns true
 *
 * @example
 * // Invalid: LLM returns ID=50, value="Employed Full-Time"
 * const entry = lookupTaxonomyEntry(50)
 * validateTaxonomyClassification(50, "Employed Full-Time", entry) // Returns false, logs warning
 */
export function validateTaxonomyClassification(
  taxonomy_id: number,
  llm_value: string,
  taxonomy_entry: TaxonomyLookupResult
): boolean {
  // Python line 133: expected_value = get_taxonomy_value(taxonomy_entry)
  const expectedValue = getTaxonomyValue(taxonomy_entry)

  // Python lines 138-147: Handle asterisk placeholders
  // if expected_value.startswith("*"):
  if (expectedValue.startsWith('*')) {
    // Python lines 140-145: Asterisk entries: accept any non-empty value
    // if not llm_value or not llm_value.strip():
    if (!llm_value || !llm_value.trim()) {
      logger.warning(
        `VALIDATION FAILED: Taxonomy ID ${taxonomy_id} with placeholder '${expectedValue}' ` +
          `received empty value from LLM`
      )
      return false
    }
    // Python line 147: return True
    // Valid: LLM provided actual value for placeholder entry
    return true
  }

  // Python lines 150-152: Non-asterisk entries: validate exact match
  // Normalize for comparison (case-insensitive, strip whitespace)
  // llm_normalized = llm_value.strip().lower()
  const llmNormalized = llm_value.trim().toLowerCase()
  // expected_normalized = expected_value.strip().lower()
  const expectedNormalized = expectedValue.trim().toLowerCase()

  // Python lines 154-160: Check mismatch
  // if llm_normalized != expected_normalized:
  if (llmNormalized !== expectedNormalized) {
    logger.warning(
      `VALIDATION FAILED: Taxonomy ID ${taxonomy_id} mismatch - ` +
        `LLM returned value '${llm_value}' but taxonomy defines '${expectedValue}'. ` +
        `Skipping this classification to prevent data corruption.`
    )
    return false
  }

  // Python line 162: return True
  return true
}
