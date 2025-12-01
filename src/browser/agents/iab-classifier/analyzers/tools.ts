/**
 * Agent Tools for IAB Classification
 *
 * 1:1 Port of Python tools.py from:
 * src/email_parser/agents/tools.py (lines 1-368)
 *
 * Provides taxonomy search and validation tools for ReAct agents.
 * Each analyzer agent uses these tools to search the IAB taxonomy
 * and validate classifications.
 */

import { IABTaxonomyLoader, TaxonomySection } from '@browser/taxonomy'
import type { IABTaxonomyEntry } from '@shared/types/iab-full-taxonomy'

/**
 * Tool result type (for agent tool calls)
 */
export interface ToolResult {
  success: boolean
  result?: string
  error?: string
}

/**
 * Helper Functions
 */

/**
 * Get taxonomy loader instance (cached)
 *
 * Python source: tools.py:27-29 (_get_taxonomy_loader)
 */
let _taxonomyLoader: IABTaxonomyLoader | null = null

function getTaxonomyLoader(): IABTaxonomyLoader {
  // Python lines 28-29
  if (_taxonomyLoader === null) {
    _taxonomyLoader = IABTaxonomyLoader.getInstance()
  }
  return _taxonomyLoader
}

/**
 * Get taxonomy value from entry
 *
 * Python source: analyzers.py:70-100 (get_taxonomy_value)
 *
 * Extracts the actual classification value (deepest non-empty tier).
 * Priority: tier_5 > tier_4 > tier_3 > tier_2
 */
function getTaxonomyValue(entry: IABTaxonomyEntry): string {
  // Python lines 93-97: Check from deepest to shallowest
  const tiers = ['tier_5', 'tier_4', 'tier_3'] as const
  for (const tierKey of tiers) {
    const value = entry[tierKey]?.trim() || ''
    if (value) {
      return value
    }
  }

  // Python line 100: Fallback to tier_2
  return entry.tier_2?.trim() || ''
}

/**
 * Build category_path from taxonomy entry tiers
 *
 * Python source: analyzers.py:162-164
 * Joins all non-empty tiers with " | " separator
 */
function buildCategoryPath(entry: IABTaxonomyEntry): string {
  const tiers = [entry.tier_1, entry.tier_2, entry.tier_3, entry.tier_4, entry.tier_5]
  const nonEmptyTiers = tiers.filter((t) => t && t.trim())
  return nonEmptyTiers.join(' | ')
}

/**
 * Taxonomy Search Tools
 *
 * These tools are called by ReAct agents during classification.
 */

/**
 * Search demographics taxonomy for keyword
 *
 * Python source: tools.py:32-65 (search_demographics_taxonomy)
 *
 * @param keyword Search keyword
 * @returns JSON string with matching taxonomy entries
 */
export function searchDemographicsTaxonomy(keyword: string): ToolResult {
  try {
    // Python line 49
    const loader = getTaxonomyLoader()

    // Python line 50
    const section = loader.getBySection(TaxonomySection.DEMOGRAPHICS)

    // Python lines 52-53
    const matches: Array<{
      taxonomy_id: number
      tier_path: string
      value: string
      grouping_tier: string
    }> = []

    // Python line 54
    const keywordLower = keyword.toLowerCase()

    // Python lines 56-65: Search through section entries
    for (const entry of section) {
      // Build searchable text from all tiers
      const searchableText = [
        entry.tier_2 || '',
        entry.tier_3 || '',
        entry.tier_4 || '',
        entry.tier_5 || '',
      ]
        .join(' ')
        .toLowerCase()

      // Python line 59: Check if keyword matches
      if (searchableText.includes(keywordLower)) {
        matches.push({
          taxonomy_id: entry.id,
          tier_path: buildCategoryPath(entry),
          value: getTaxonomyValue(entry),
          grouping_tier: entry.grouping_tier_key || 'tier_2',
        })
      }
    }

    // Python line 63: Return top 10 matches
    return {
      success: true,
      result: JSON.stringify(matches.slice(0, 10)),
    }
  } catch (error) {
    // Python lines 64-65
    console.error(`Error searching demographics taxonomy: ${error}`)
    return {
      success: false,
      error: String(error),
      result: JSON.stringify([]),
    }
  }
}

/**
 * Search household taxonomy for keyword
 *
 * Python source: tools.py:68-101 (search_household_taxonomy)
 *
 * @param keyword Search keyword
 * @returns JSON string with matching taxonomy entries
 */
export function searchHouseholdTaxonomy(keyword: string): ToolResult {
  try {
    // Python line 85
    const loader = getTaxonomyLoader()

    // Python line 86: Get household_data section
    const section = loader.getBySection(TaxonomySection.HOUSEHOLD_DATA)

    // Python lines 88-89
    const matches: Array<{
      taxonomy_id: number
      tier_path: string
      value: string
      grouping_tier: string
    }> = []

    // Python line 90
    const keywordLower = keyword.toLowerCase()

    // Python lines 92-101: Search through section entries
    for (const entry of section) {
      const searchableText = [
        entry.tier_2 || '',
        entry.tier_3 || '',
        entry.tier_4 || '',
        entry.tier_5 || '',
      ]
        .join(' ')
        .toLowerCase()

      if (searchableText.includes(keywordLower)) {
        matches.push({
          taxonomy_id: entry.id,
          tier_path: buildCategoryPath(entry),
          value: getTaxonomyValue(entry),
          grouping_tier: entry.grouping_tier_key || 'tier_2',
        })
      }
    }

    // Python line 99: Return top 10 matches
    return {
      success: true,
      result: JSON.stringify(matches.slice(0, 10)),
    }
  } catch (error) {
    // Python lines 100-101
    console.error(`Error searching household taxonomy: ${error}`)
    return {
      success: false,
      error: String(error),
      result: JSON.stringify([]),
    }
  }
}

/**
 * Search interests taxonomy for keyword
 *
 * Python source: tools.py:104-137 (search_interests_taxonomy)
 *
 * @param keyword Search keyword
 * @returns JSON string with matching taxonomy entries
 */
export function searchInterestsTaxonomy(keyword: string): ToolResult {
  try {
    // Python line 121
    const loader = getTaxonomyLoader()

    // Python line 122
    const section = loader.getBySection(TaxonomySection.INTERESTS)

    // Python lines 124-125
    const matches: Array<{
      taxonomy_id: number
      tier_path: string
      value: string
      grouping_tier: string
    }> = []

    // Python line 126
    const keywordLower = keyword.toLowerCase()

    // Python lines 128-137: Search through section entries
    for (const entry of section) {
      const searchableText = [
        entry.tier_2 || '',
        entry.tier_3 || '',
        entry.tier_4 || '',
        entry.tier_5 || '',
      ]
        .join(' ')
        .toLowerCase()

      if (searchableText.includes(keywordLower)) {
        matches.push({
          taxonomy_id: entry.id,
          tier_path: buildCategoryPath(entry),
          value: getTaxonomyValue(entry),
          grouping_tier: entry.grouping_tier_key || 'tier_2',
        })
      }
    }

    // Python line 135: Return top 10 matches
    return {
      success: true,
      result: JSON.stringify(matches.slice(0, 10)),
    }
  } catch (error) {
    // Python lines 136-137
    console.error(`Error searching interests taxonomy: ${error}`)
    return {
      success: false,
      error: String(error),
      result: JSON.stringify([]),
    }
  }
}

/**
 * Search purchase intent taxonomy for keyword
 *
 * Python source: tools.py:140-173 (search_purchase_taxonomy)
 *
 * @param keyword Search keyword
 * @returns JSON string with matching taxonomy entries
 */
export function searchPurchaseTaxonomy(keyword: string): ToolResult {
  try {
    // Python line 157
    const loader = getTaxonomyLoader()

    // Python line 158
    const section = loader.getBySection(TaxonomySection.PURCHASE_INTENT)

    // Python lines 160-161
    const matches: Array<{
      taxonomy_id: number
      tier_path: string
      value: string
      grouping_tier: string
    }> = []

    // Python line 162
    const keywordLower = keyword.toLowerCase()

    // Python lines 164-173: Search through section entries
    for (const entry of section) {
      const searchableText = [
        entry.tier_2 || '',
        entry.tier_3 || '',
        entry.tier_4 || '',
        entry.tier_5 || '',
      ]
        .join(' ')
        .toLowerCase()

      if (searchableText.includes(keywordLower)) {
        matches.push({
          taxonomy_id: entry.id,
          tier_path: buildCategoryPath(entry),
          value: getTaxonomyValue(entry),
          grouping_tier: entry.grouping_tier_key || 'tier_2',
        })
      }
    }

    // Python line 171: Return top 10 matches
    return {
      success: true,
      result: JSON.stringify(matches.slice(0, 10)),
    }
  } catch (error) {
    // Python lines 172-173
    console.error(`Error searching purchase taxonomy: ${error}`)
    return {
      success: false,
      error: String(error),
      result: JSON.stringify([]),
    }
  }
}

/**
 * Taxonomy Validation Tools
 */

/**
 * Lookup taxonomy entry by ID
 *
 * Python source: analyzers.py:30-67 (lookup_taxonomy_entry)
 *
 * @param taxonomyId IAB Taxonomy ID
 * @returns Taxonomy entry with all tier information, or null if not found
 */
export function lookupTaxonomyEntry(
  taxonomyId: number
): {
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4: string
  tier_5: string
  category_path: string
  name: string
  grouping_tier_key: string
  grouping_value: string
} | null {
  try {
    // Python line 42
    const loader = getTaxonomyLoader()

    // Python line 43
    const entry = loader.getById(taxonomyId)

    // Python lines 45-47
    if (!entry) {
      console.warn(`Taxonomy ID ${taxonomyId} not found in IAB taxonomy`)
      return null
    }

    // Python lines 49-52: Build category_path from tiers
    const tiers = [entry.tier_1, entry.tier_2, entry.tier_3, entry.tier_4, entry.tier_5]
    const nonEmptyTiers = tiers.filter((t) => t && t.trim())
    const categoryPath = nonEmptyTiers.join(' | ')

    // Python lines 54-64: Return entry with metadata
    return {
      tier_1: entry.tier_1 || '',
      tier_2: entry.tier_2 || '',
      tier_3: entry.tier_3 || '',
      tier_4: entry.tier_4 || '',
      tier_5: entry.tier_5 || '',
      category_path: categoryPath,
      name: entry.name || '',
      grouping_tier_key: entry.grouping_tier_key || 'tier_2',
      grouping_value: entry.grouping_value || entry.tier_2 || '',
    }
  } catch (error) {
    // Python lines 65-67
    console.error(`Error looking up taxonomy ${taxonomyId}: ${error}`)
    return null
  }
}

/**
 * Normalize taxonomy value for flexible comparison
 *
 * Enhanced normalization to handle common LLM formatting variations:
 * - Comma removal: $50,000 → $50000
 * - Hyphen spacing: " - " → "-"
 * - Whitespace normalization
 * - Case insensitivity
 * - Tier path extraction: "Business | Finance" → "Finance"
 *
 * Fix for: /bugfix/2025-01-12-taxonomy-validation-formatting-bug.md
 *
 * @param value Raw value from LLM or taxonomy
 * @returns Normalized value for comparison
 */
function normalizeValue(value: string): string {
  let normalized = value.trim().toLowerCase()

  // Extract final tier if full path provided (handles "Business | Finance" → "Finance")
  if (normalized.includes('|')) {
    const parts = normalized.split('|')
    normalized = parts[parts.length - 1].trim()
  }

  // Format normalization
  return normalized
    .replace(/,/g, '')               // Remove commas: $50,000 → $50000
    .replace(/\s*-\s*/g, '-')        // Normalize hyphens: " - " → "-", "- " → "-"
    .replace(/\s+/g, ' ')            // Normalize spaces: "  " → " "
    .trim()                          // Final trim
}

/**
 * Validate taxonomy classification
 *
 * Python source: analyzers.py:103-162 (validate_taxonomy_classification)
 * Enhanced with normalizeValue() to handle common LLM formatting variations
 *
 * Prevents data corruption from LLM errors where wrong taxonomy IDs
 * are paired with incorrect values.
 *
 * @param taxonomyId IAB Taxonomy ID from LLM
 * @param llmValue Classification value from LLM
 * @param taxonomyEntry Taxonomy entry from lookupTaxonomyEntry
 * @returns True if valid (value matches taxonomy), False if mismatch
 */
export function validateTaxonomyClassification(
  taxonomyId: number,
  llmValue: string,
  taxonomyEntry: ReturnType<typeof lookupTaxonomyEntry>
): boolean {
  if (!taxonomyEntry) {
    return false
  }

  // Python line 133: Get expected value from taxonomy
  const expectedValue = getTaxonomyValue({
    id: taxonomyId,
    tier_1: taxonomyEntry.tier_1,
    tier_2: taxonomyEntry.tier_2,
    tier_3: taxonomyEntry.tier_3,
    tier_4: taxonomyEntry.tier_4,
    tier_5: taxonomyEntry.tier_5,
  } as IABTaxonomyEntry)

  // Python lines 135-147: Handle asterisk placeholders
  // For entries like "*Country Extension", "*Language", LLM provides actual value
  if (expectedValue.startsWith('*')) {
    // Python lines 139-145: Asterisk entries must have non-empty LLM value
    if (!llmValue || !llmValue.trim()) {
      console.warn(
        `VALIDATION FAILED: Taxonomy ID ${taxonomyId} with placeholder '${expectedValue}' ` +
          `received empty value from LLM`
      )
      return false
    }
    // Valid: LLM provided actual value for placeholder entry
    return true
  }

  // Python lines 149-160: Non-asterisk entries must match (enhanced with normalization)
  // FIX 2025-01-13: Use enhanced normalization to handle formatting variations
  const llmNormalized = normalizeValue(llmValue)
  const expectedNormalized = normalizeValue(expectedValue)

  // Python lines 154-160
  if (llmNormalized !== expectedNormalized) {
    console.warn(
      `VALIDATION FAILED: Taxonomy ID ${taxonomyId} mismatch - ` +
        `LLM returned value '${llmValue}' (normalized: '${llmNormalized}') ` +
        `but taxonomy defines '${expectedValue}' (normalized: '${expectedNormalized}'). ` +
        `Skipping this classification to prevent data corruption.`
    )
    return false
  }

  // Python line 162
  return true
}

/**
 * Validate classification tool
 *
 * Python source: tools.py:176-222 (validate_classification)
 *
 * Agent tool wrapper around validateTaxonomyClassification.
 *
 * @param taxonomyId IAB Taxonomy ID
 * @param value Classification value
 * @returns JSON string with validation result
 */
export function validateClassification(taxonomyId: number, value: string): ToolResult {
  try {
    // Python lines 197-198
    const taxonomyEntry = lookupTaxonomyEntry(taxonomyId)

    // Python lines 200-205
    if (!taxonomyEntry) {
      return {
        success: false,
        error: `Taxonomy ID ${taxonomyId} not found`,
        result: JSON.stringify({
          valid: false,
          reason: 'Invalid taxonomy ID',
        }),
      }
    }

    // Python lines 207-208: Validate
    const isValid = validateTaxonomyClassification(taxonomyId, value, taxonomyEntry)

    // Python lines 210-219
    if (isValid) {
      return {
        success: true,
        result: JSON.stringify({
          valid: true,
          taxonomy_id: taxonomyId,
          value: value,
          tier_path: taxonomyEntry.category_path,
        }),
      }
    } else {
      return {
        success: false,
        error: 'Value does not match taxonomy',
        result: JSON.stringify({
          valid: false,
          reason: 'Value mismatch',
        }),
      }
    }
  } catch (error) {
    // Python lines 220-222
    console.error(`Error validating classification: ${error}`)
    return {
      success: false,
      error: String(error),
      result: JSON.stringify({ valid: false, reason: 'Validation error' }),
    }
  }
}

/**
 * Get tier details for taxonomy ID
 *
 * Python source: tools.py:225-264 (get_tier_details)
 *
 * Agent tool to retrieve full tier hierarchy for a taxonomy ID.
 *
 * @param taxonomyId IAB Taxonomy ID
 * @returns JSON string with tier details
 */
export function getTierDetails(taxonomyId: number): ToolResult {
  try {
    // Python line 245
    const taxonomyEntry = lookupTaxonomyEntry(taxonomyId)

    // Python lines 247-252
    if (!taxonomyEntry) {
      return {
        success: false,
        error: `Taxonomy ID ${taxonomyId} not found`,
        result: JSON.stringify({}),
      }
    }

    // Python lines 254-262: Return all tier details
    return {
      success: true,
      result: JSON.stringify({
        taxonomy_id: taxonomyId,
        tier_1: taxonomyEntry.tier_1,
        tier_2: taxonomyEntry.tier_2,
        tier_3: taxonomyEntry.tier_3,
        tier_4: taxonomyEntry.tier_4,
        tier_5: taxonomyEntry.tier_5,
        category_path: taxonomyEntry.category_path,
        name: taxonomyEntry.name,
        grouping_tier_key: taxonomyEntry.grouping_tier_key,
        grouping_value: taxonomyEntry.grouping_value,
      }),
    }
  } catch (error) {
    // Python lines 263-264
    console.error(`Error getting tier details: ${error}`)
    return {
      success: false,
      error: String(error),
      result: JSON.stringify({}),
    }
  }
}

/**
 * Tool Registry for ReAct Agents
 *
 * Python source: tools.py:267-368 (TOOL_REGISTRY, format_tool_for_llm, get_tools_for_section)
 */

export interface AgentTool {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  function: (arg: string) => ToolResult
}

/**
 * All available tools for agents
 *
 * Python source: tools.py:267-330 (TOOL_REGISTRY)
 */
export const TOOL_REGISTRY: Record<string, AgentTool> = {
  search_demographics_taxonomy: {
    name: 'search_demographics_taxonomy',
    description:
      'Search demographics taxonomy for keyword. Returns taxonomy IDs and values matching the keyword.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Keyword to search for in demographics taxonomy',
        },
      },
      required: ['keyword'],
    },
    function: searchDemographicsTaxonomy,
  },
  search_household_taxonomy: {
    name: 'search_household_taxonomy',
    description:
      'Search household taxonomy for keyword. Returns taxonomy IDs and values matching the keyword.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Keyword to search for in household taxonomy',
        },
      },
      required: ['keyword'],
    },
    function: searchHouseholdTaxonomy,
  },
  search_interests_taxonomy: {
    name: 'search_interests_taxonomy',
    description:
      'Search interests taxonomy for keyword. Returns taxonomy IDs and values matching the keyword.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Keyword to search for in interests taxonomy',
        },
      },
      required: ['keyword'],
    },
    function: searchInterestsTaxonomy,
  },
  search_purchase_taxonomy: {
    name: 'search_purchase_taxonomy',
    description:
      'Search purchase intent taxonomy for keyword. Returns taxonomy IDs and values matching the keyword.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Keyword to search for in purchase taxonomy',
        },
      },
      required: ['keyword'],
    },
    function: searchPurchaseTaxonomy,
  },
  validate_classification: {
    name: 'validate_classification',
    description:
      'Validate that a taxonomy ID and value match. Use this to verify your classifications are correct.',
    parameters: {
      type: 'object',
      properties: {
        taxonomy_id: {
          type: 'number',
          description: 'IAB Taxonomy ID to validate',
        },
        value: {
          type: 'string',
          description: 'Classification value to validate',
        },
      },
      required: ['taxonomy_id', 'value'],
    },
    function: (args: string) => {
      const { taxonomy_id, value } = JSON.parse(args)
      return validateClassification(taxonomy_id, value)
    },
  },
  get_tier_details: {
    name: 'get_tier_details',
    description:
      'Get full tier hierarchy for a taxonomy ID. Returns all tier levels and category path.',
    parameters: {
      type: 'object',
      properties: {
        taxonomy_id: {
          type: 'number',
          description: 'IAB Taxonomy ID to get details for',
        },
      },
      required: ['taxonomy_id'],
    },
    function: (args: string) => {
      const { taxonomy_id } = JSON.parse(args)
      return getTierDetails(taxonomy_id)
    },
  },
}

/**
 * Get tools for specific section
 *
 * Python source: tools.py:352-368 (get_tools_for_section)
 *
 * Returns appropriate tools for a section (e.g., demographics analyzer
 * gets search_demographics_taxonomy tool).
 *
 * @param section Section name (demographics, household, interests, purchase_intent)
 * @returns Array of tools for that section
 */
export function getToolsForSection(section: string): AgentTool[] {
  // Python lines 362-368
  const toolMap: Record<string, string[]> = {
    demographics: ['search_demographics_taxonomy', 'validate_classification', 'get_tier_details'],
    household: ['search_household_taxonomy', 'validate_classification', 'get_tier_details'],
    interests: ['search_interests_taxonomy', 'validate_classification', 'get_tier_details'],
    purchase_intent: ['search_purchase_taxonomy', 'validate_classification', 'get_tier_details'],
  }

  const toolNames = toolMap[section] || []
  return toolNames.map((name) => TOOL_REGISTRY[name]).filter(Boolean)
}
