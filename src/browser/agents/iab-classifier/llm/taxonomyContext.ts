/**
 * Taxonomy Context Builder
 *
 * Formats IAB Taxonomy categories for LLM prompts.
 * Provides relevant taxonomy sections for each analyzer type.
 * Loads taxonomy dynamically from IAB Audience Taxonomy 1.1 file.
 *
 * 1:1 Port of: src/email_parser/workflow/taxonomy_context.py (377 lines)
 */

import { IABTaxonomyLoader } from '../../../taxonomy/IABTaxonomyLoader'
import type { IABTaxonomyEntry } from '@shared/types/iab-full-taxonomy'
import { TaxonomySection } from '@shared/types/iab-full-taxonomy'

// Singleton taxonomy loader instance                                            // Python line 15
let _taxonomy_loader: IABTaxonomyLoader | null = null                            // Python line 16

/**
 * Get singleton IAB taxonomy loader instance.
 *
 * Python lines 19-30
 *
 * @returns IABTaxonomyLoader instance
 */
export function getTaxonomyLoader(): IABTaxonomyLoader {                         // Python line 19
  if (_taxonomy_loader === null) {                                               // Python line 27
    console.info('Initializing IAB Taxonomy Loader')                             // Python line 28
    _taxonomy_loader = IABTaxonomyLoader.getInstance()                           // Python line 29
  }
  return _taxonomy_loader                                                        // Python line 30
}

/**
 * Format a single taxonomy entry for LLM prompt.
 *
 * Format: ID X: Tier1 | Tier2 | Tier3 | Tier4 | Tier5
 *
 * Python lines 33-57
 *
 * @param entry - Taxonomy entry dict from IABTaxonomyLoader
 * @returns Formatted string
 *
 * @example
 * const entry = {id: 49, tier_1: "Demographic", tier_2: "Gender", tier_3: "Female", ...}
 * format_taxonomy_entry(entry)
 * // => 'ID 49: Demographic | Gender | Female'
 */
export function formatTaxonomyEntry(entry: Record<string, any>): string {        // Python line 33
  const parts: string[] = []                                                     // Python line 50
  for (let tier_num = 1; tier_num <= 5; tier_num++) {                            // Python line 51
    const tier_val = entry[`tier_${tier_num}`] || ''                             // Python line 52
    if (tier_val && tier_val.trim()) {                                           // Python line 53
      parts.push(tier_val)                                                       // Python line 54
    }
  }

  const path = parts.join(' | ')                                                 // Python line 56
  return `ID ${entry.id}: ${path}`                                               // Python line 57
}

/**
 * Get demographics taxonomy formatted for LLM prompt.
 *
 * Loads actual taxonomy entries from IAB Audience Taxonomy 1.1.
 * Groups by tier_2 to show mutually-exclusive categories.
 *
 * Python lines 60-111
 *
 * @returns Formatted string with relevant taxonomy categories
 */
export function getDemographicsTaxonomyContext(): string {                       // Python line 60
  const loader = getTaxonomyLoader()                                             // Python line 70

  // Get demographics section (rows 11-62)                                       // Python line 72
  const demographics_entries_raw = loader.getBySection(TaxonomySection.DEMOGRAPHICS)           // Python line 73

  // FILTER OUT *Extension entries - they are placeholders, not real classifications // Python line 75
  const demographics_entries = demographics_entries_raw.filter((entry: IABTaxonomyEntry) => {      // Python line 76
    for (let tier_num = 1; tier_num <= 5; tier_num++) {                          // Python line 78
      const tier_val = (entry as any)[`tier_${tier_num}`] || ''                           // Python line 81
      if (tier_val && tier_val.includes('*Extension')) {                         // Python line 79
        return false
      }
    }
    return true
  })

  // Group by tier_2 (the mutually-exclusive grouping dimension)                 // Python line 85
  const grouped: Map<string, any[]> = new Map()                                  // Python line 86
  for (const entry of demographics_entries) {                                    // Python line 87
    const tier_2 = entry.tier_2 || ''                                            // Python line 88
    if (!tier_2) {                                                               // Python line 89
      continue                                                                   // Python line 90
    }
    if (!grouped.has(tier_2)) {                                                  // Python line 91
      grouped.set(tier_2, [])                                                    // Python line 92
    }
    grouped.get(tier_2)!.push(entry)                                             // Python line 93
  }

  // Build context                                                               // Python line 95
  const lines: string[] = ['Demographics Categories (IAB Audience Taxonomy 1.1):', ''] // Python line 96
  lines.push('IMPORTANT: Tier 2 represents mutually-exclusive groups (select ONE per group).') // Python line 97
  lines.push("Example: Within 'Gender' group, select either Male OR Female, not both.") // Python line 98
  lines.push('')                                                                 // Python line 99

  // Format each tier_2 group                                                    // Python line 101
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0])) // Python line 102
  for (const [tier_2, entries] of sortedGroups) {                                // Python line 102
    lines.push(`${tier_2} (Tier 2 - mutually exclusive):`)                       // Python line 103
    const sortedEntries = entries.sort((a, b) => a.id - b.id)                    // Python line 104
    for (const entry of sortedEntries) {                                         // Python line 104
      lines.push(`- ${formatTaxonomyEntry(entry)}`)                              // Python line 105
    }
    lines.push('')                                                               // Python line 106
  }

  lines.push('Only select categories where you find strong signals in the email content.') // Python line 108
  lines.push('Always return the taxonomy_id (ID number) in your response.')      // Python line 109

  return lines.join('\n')                                                        // Python line 111
}

/**
 * Get household taxonomy formatted for LLM prompt.
 *
 * Python lines 114-191
 *
 * @returns Formatted string with relevant taxonomy categories
 */
export function getHouseholdTaxonomyContext(): string {                          // Python line 114
  const loader = getTaxonomyLoader()                                             // Python line 121

  // Get household section (rows 64-168)                                         // Python line 123
  const household_entries_raw = loader.getBySection(TaxonomySection.HOUSEHOLD_DATA)            // Python line 124

  // FILTER OUT *Extension entries - they are placeholders, not real classifications // Python line 126
  const household_entries = household_entries_raw.filter((entry: IABTaxonomyEntry) => {            // Python line 127
    for (let tier_num = 1; tier_num <= 5; tier_num++) {                          // Python line 130
      const tier_val = (entry as any)[`tier_${tier_num}`] || ''                           // Python line 132
      if (tier_val && tier_val.includes('*Extension')) {                         // Python line 130
        return false
      }
    }
    return true
  })

  // Group by grouping_value (same as demographics approach)                     // Python line 136
  // This ensures proper grouping by category (Urbanization, Property Type, etc.) // Python line 137
  const grouped: Map<string, any[]> = new Map()                                  // Python line 138
  for (const entry of household_entries) {                                       // Python line 139
    const grouping_value = entry.grouping_value || ''                            // Python line 140
    if (!grouping_value) {                                                       // Python line 141
      continue                                                                   // Python line 142
    }
    if (!grouped.has(grouping_value)) {                                          // Python line 143
      grouped.set(grouping_value, [])                                            // Python line 144
    }
    grouped.get(grouping_value)!.push(entry)                                     // Python line 145
  }

  // Build context                                                               // Python line 147
  const lines: string[] = ['Household Categories (IAB Audience Taxonomy 1.1):', ''] // Python line 148
  lines.push('IMPORTANT: Categories are mutually-exclusive within each group.')  // Python line 149
  lines.push('')                                                                 // Python line 150

  // Prioritize commonly needed household categories                             // Python line 152
  const priority_groups = [                                                      // Python line 153
    'Home Location',                                                             // Python line 154
    'Urbanization',                                                              // Python line 155
    'Property Type',                                                             // Python line 156
    'Ownership',                                                                 // Python line 157
    'Household Income (USD)',                                                    // Python line 158
    'Life Stage',                                                                // Python line 159
    'Number of Adults',                                                          // Python line 160
    'Number of Children',                                                        // Python line 161
  ]

  // Format priority groups first (up to 10 entries each)                        // Python line 164
  let count = 0                                                                  // Python line 165
  const shown_groups = new Set<string>()                                         // Python line 166
  for (const group_name of priority_groups) {                                    // Python line 167
    if (grouped.has(group_name) && count < 80) {  // Increased limit             // Python line 168
      const entries = grouped.get(group_name)!                                   // Python line 169
      lines.push(`${group_name}:`)                                               // Python line 170
      const sortedEntries = entries.sort((a, b) => a.id - b.id).slice(0, 10)     // Python line 171
      for (const entry of sortedEntries) {                                       // Python line 171
        lines.push(`- ${formatTaxonomyEntry(entry)}`)                            // Python line 172
        count++                                                                  // Python line 173
      }
      lines.push('')                                                             // Python line 174
      shown_groups.add(group_name)                                               // Python line 175
    }
  }

  // Add remaining groups if space allows                                        // Python line 177
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0])) // Python line 178
  for (const [group_name, entries] of sortedGroups) {                            // Python line 178
    if (!shown_groups.has(group_name) && count < 100) {                          // Python line 179
      lines.push(`${group_name}:`)                                               // Python line 180
      const sortedEntries = entries.sort((a, b) => a.id - b.id).slice(0, 5)      // Python line 181
      for (const entry of sortedEntries) {                                       // Python line 181
        lines.push(`- ${formatTaxonomyEntry(entry)}`)                            // Python line 182
        count++                                                                  // Python line 183
        if (count >= 100) {                                                      // Python line 184
          break                                                                  // Python line 185
        }
      }
      lines.push('')                                                             // Python line 186
    }
  }

  lines.push('Look for signals in utility bills, service providers, home-related communications.') // Python line 188
  lines.push('Always return the taxonomy_id (ID number) in your response.')      // Python line 189

  return lines.join('\n')                                                        // Python line 191
}

/**
 * Get interests taxonomy formatted for LLM prompt.
 *
 * Python lines 194-249
 *
 * @returns Formatted string with relevant taxonomy categories
 */
export function getInterestsTaxonomyContext(): string {                          // Python line 194
  const loader = getTaxonomyLoader()                                             // Python line 201

  // Get interests section (rows 209-704)                                        // Python line 203
  const interest_entries_raw = loader.getBySection(TaxonomySection.INTERESTS)                  // Python line 204

  // FILTER OUT *Extension entries - they are placeholders, not real classifications // Python line 206
  const interest_entries = interest_entries_raw.filter((entry: IABTaxonomyEntry) => {              // Python line 207
    for (let tier_num = 1; tier_num <= 5; tier_num++) {                          // Python line 210
      const tier_val = (entry as any)[`tier_${tier_num}`] || ''                           // Python line 212
      if (tier_val && tier_val.includes('*Extension')) {                         // Python line 210
        return false
      }
    }
    return true
  })

  // Group by tier_2 for organizational clarity                                  // Python line 216
  const grouped: Map<string, any[]> = new Map()                                  // Python line 217
  for (const entry of interest_entries) {                                        // Python line 218
    const tier_2 = entry.tier_2 || ''                                            // Python line 219
    if (!tier_2) {                                                               // Python line 220
      continue                                                                   // Python line 221
    }
    if (!grouped.has(tier_2)) {                                                  // Python line 222
      grouped.set(tier_2, [])                                                    // Python line 223
    }
    grouped.get(tier_2)!.push(entry)                                             // Python line 224
  }

  // Build context                                                               // Python line 226
  const lines: string[] = ['Interests Categories (IAB Audience Taxonomy 1.1):', ''] // Python line 227
  lines.push('NOTE: Interests are NON-EXCLUSIVE - you can select MULTIPLE interests from the same or different groups.') // Python line 228
  lines.push('Prefer more specific (deeper tier) classifications when confidence is high.') // Python line 229
  lines.push('')                                                                 // Python line 230

  // Format each tier_2 group (limit to avoid token overload)                    // Python line 232
  let count = 0                                                                  // Python line 233
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 20) // Python line 234
  for (const [tier_2, entries] of sortedGroups) {                                // Python line 234
    lines.push(`${tier_2} (Tier 2):`)                                            // Python line 235
    const sortedEntries = entries.sort((a, b) => a.id - b.id).slice(0, 8)        // Python line 236
    for (const entry of sortedEntries) {                                         // Python line 236
      lines.push(`- ${formatTaxonomyEntry(entry)}`)                              // Python line 237
      count++                                                                    // Python line 238
      if (count >= 100) {                                                        // Python line 239
        break                                                                    // Python line 240
      }
    }
    lines.push('')                                                               // Python line 241
    if (count >= 100) {                                                          // Python line 242
      lines.push('... (additional interest categories available)')               // Python line 243
      break                                                                      // Python line 244
    }
  }

  lines.push('Multiple interests are common. Select all that have strong signals.') // Python line 246
  lines.push('Always return the taxonomy_id (ID number) in your response.')      // Python line 247

  return lines.join('\n')                                                        // Python line 249
}

/**
 * Get purchase intent taxonomy formatted for LLM prompt.
 *
 * Python lines 252-310
 *
 * @returns Formatted string with relevant taxonomy categories
 */
export function getPurchaseTaxonomyContext(): string {                           // Python line 252
  const loader = getTaxonomyLoader()                                             // Python line 259

  // Get purchase intent section (rows 707-1568)                                 // Python line 261
  const purchase_entries_raw = loader.getBySection(TaxonomySection.PURCHASE_INTENT)            // Python line 262

  // FILTER OUT *Extension entries - they are placeholders, not real classifications // Python line 264
  const purchase_entries = purchase_entries_raw.filter((entry: IABTaxonomyEntry) => {              // Python line 265
    for (let tier_num = 1; tier_num <= 5; tier_num++) {                          // Python line 268
      const tier_val = (entry as any)[`tier_${tier_num}`] || ''                           // Python line 270
      if (tier_val && tier_val.includes('*Extension')) {                         // Python line 268
        return false
      }
    }
    return true
  })

  // Group by tier_2                                                             // Python line 274
  const grouped: Map<string, any[]> = new Map()                                  // Python line 275
  for (const entry of purchase_entries) {                                        // Python line 276
    const tier_2 = entry.tier_2 || ''                                            // Python line 277
    if (!tier_2) {                                                               // Python line 278
      continue                                                                   // Python line 279
    }
    if (!grouped.has(tier_2)) {                                                  // Python line 280
      grouped.set(tier_2, [])                                                    // Python line 281
    }
    grouped.get(tier_2)!.push(entry)                                             // Python line 282
  }

  // Build context                                                               // Python line 284
  const lines: string[] = ['Purchase Intent Product Categories (IAB Audience Taxonomy 1.1):', ''] // Python line 285
  lines.push('NOTE: For each product category, you MUST also specify a purchase_intent_flag:') // Python line 286
  lines.push('- PIPR_HIGH: Recent purchase or strong intent (< 7 days)')         // Python line 287
  lines.push('- PIPR_MEDIUM: Moderate intent (7-30 days)')                       // Python line 288
  lines.push('- PIPR_LOW: Weak intent (> 30 days)')                              // Python line 289
  lines.push('- ACTUAL_PURCHASE: Confirmed transaction (has receipt, order number, or tracking)') // Python line 290
  lines.push('')                                                                 // Python line 291

  // Format each tier_2 group (limit to avoid token overload)                    // Python line 293
  let count = 0                                                                  // Python line 294
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 25) // Python line 295
  for (const [tier_2, entries] of sortedGroups) {                                // Python line 295
    lines.push(`${tier_2} (Tier 2):`)                                            // Python line 296
    const sortedEntries = entries.sort((a, b) => a.id - b.id).slice(0, 6)        // Python line 297
    for (const entry of sortedEntries) {                                         // Python line 297
      lines.push(`- ${formatTaxonomyEntry(entry)}`)                              // Python line 298
      count++                                                                    // Python line 299
      if (count >= 100) {                                                        // Python line 300
        break                                                                    // Python line 301
      }
    }
    lines.push('')                                                               // Python line 302
    if (count >= 100) {                                                          // Python line 303
      lines.push('... (additional purchase categories available)')               // Python line 304
      break                                                                      // Python line 305
    }
  }

  lines.push('Identify the PRODUCT CATEGORY from the list above and assign the appropriate purchase_intent_flag.') // Python line 307
  lines.push('Always return the taxonomy_id (ID number) in your response.')      // Python line 308

  return lines.join('\n')                                                        // Python line 310
}

/**
 * Get appropriate taxonomy context for an analyzer type.
 *
 * Python lines 313-342
 *
 * @param analyzer_type - "demographics", "household", "interests", or "purchase"
 * @returns Formatted taxonomy context string
 * @throws Error if analyzer_type is unknown
 *
 * @example
 * const context = getTaxonomyContextForAnalyzer("demographics")
 */
export function getTaxonomyContextForAnalyzer(analyzer_type: string): string {   // Python line 313
  const context_map: Record<string, () => string> = {                            // Python line 329
    demographics: getDemographicsTaxonomyContext,                                // Python line 330
    household: getHouseholdTaxonomyContext,                                      // Python line 331
    interests: getInterestsTaxonomyContext,                                      // Python line 332
    purchase: getPurchaseTaxonomyContext,                                        // Python line 333
  }

  if (!(analyzer_type in context_map)) {                                         // Python line 336
    throw new Error(                                                             // Python line 337
      `Unknown analyzer type: ${analyzer_type}. ` +
        `Must be one of: ${Object.keys(context_map).join(', ')}`
    )
  }

  return context_map[analyzer_type]()                                            // Python line 342
}

// Cache taxonomy contexts for performance                                       // Python line 345
const _CONTEXT_CACHE: Map<string, string> = new Map()                            // Python line 346

/**
 * Get taxonomy context with caching for performance.
 *
 * Python lines 349-366
 *
 * @param analyzer_type - "demographics", "household", "interests", or "purchase"
 * @returns Cached or freshly generated taxonomy context
 *
 * @example
 * const context = getCachedTaxonomyContext("interests")
 */
export function getCachedTaxonomyContext(analyzer_type: string): string {        // Python line 349
  if (!_CONTEXT_CACHE.has(analyzer_type)) {                                      // Python line 362
    _CONTEXT_CACHE.set(                                                          // Python line 363
      analyzer_type,
      getTaxonomyContextForAnalyzer(analyzer_type)
    )
    console.debug(`Cached taxonomy context for ${analyzer_type}`)                // Python line 364
  }

  return _CONTEXT_CACHE.get(analyzer_type)!                                      // Python line 366
}
