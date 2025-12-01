// Parallel classification module for A/B Testing Framework
//
// IMPORTANT: This module uses the EXACT same tier selection logic as /emails page.
// The applyTieredClassification function from tierSelector.ts handles:
// - REQ-1.4: Filtering "Unknown X" classifications in mutually-exclusive categories
// - Primary vs alternative classification selection
// - Granularity scoring

import {
  PreprocessedEmail,
  ModelConfig,
  ModelResults,
  Classification,
  IABSection,
} from './types'

// Import the EXACT same tier selection functions used by /emails and /profile pages
// This ensures A/B testing uses identical code paths for valid comparison
import {
  applyTieredClassification,
  type TaxonomySelection,
} from '@browser/agents/iab-classifier/tierSelector'

// Progress callback type
export type ProgressCallback = (modelKey: string, status: 'started' | 'completed' | 'error', message?: string) => void

/**
 * Transform API response from /api/classify to ModelResults
 *
 * The /api/classify endpoint returns:
 * {
 *   success: boolean,
 *   classification: { category, confidence, reasoning, section, taxonomy_id },
 *   all_classifications: Array<{ section, value, confidence, taxonomy_id, reasoning, email_ids }>,
 *   emails_processed: number,
 *   per_email_classifications: Array<{ email_id, classification, all_classifications }>
 * }
 *
 * CRITICAL: This function uses the EXACT same applyTieredClassification() function
 * from tierSelector.ts that /emails and /profile pages use. This includes:
 * - REQ-1.4: Filtering "Unknown X" classifications in mutually-exclusive categories
 * - Primary vs alternative selection with granularity scoring
 * - Proper grouping by section (demographics, household, interests, purchase_intent)
 *
 * Using the same code path ensures A/B testing results are directly comparable.
 */
function transformApiResponseToResults(
  modelKey: string,
  apiResponse: any,
  startTime: Date,
  endTime: Date
): ModelResults {
  const classifications: Classification[] = []

  console.log(`[A/B Testing] Transforming API response for ${modelKey}`)

  // Extract from all_classifications (new batch format)
  if (!apiResponse.all_classifications || !Array.isArray(apiResponse.all_classifications)) {
    console.log(`[A/B Testing] No classifications in response`)
    return buildEmptyResults(modelKey, startTime, endTime)
  }

  console.log(`[A/B Testing] Found ${apiResponse.all_classifications.length} raw classifications`)

  // Group classifications by section for tiered processing
  // This mirrors what profileTierFormatter.ts does
  const classificationsBySection: Record<string, TaxonomySelection[]> = {
    demographics: [],
    household: [],
    interests: [],
    purchase_intent: [],
  }

  for (const c of apiResponse.all_classifications) {
    // Map section names
    let section = c.section as string
    if (section === 'purchase') section = 'purchase_intent'

    // Convert to TaxonomySelection format (required by applyTieredClassification)
    const taxonomySelection: TaxonomySelection = {
      taxonomy_id: c.taxonomy_id || 0,
      section: section,
      value: c.value || c.category || 'Unknown',
      confidence: c.confidence || 0,
      tier_1: c.tier_1 || '',
      tier_2: c.tier_2 || '',
      tier_3: c.tier_3 || '',
      tier_4: c.tier_4 || '',
      tier_5: c.tier_5 || '',
      tier_path: c.tier_path || c.category_path || '',
      category_path: c.category_path || '',
      grouping_tier_key: c.grouping_tier_key || '',
      grouping_value: c.grouping_value || '',
      reasoning: c.reasoning || '',
    }

    if (classificationsBySection[section]) {
      classificationsBySection[section].push(taxonomySelection)
    }
  }

  // Apply tiered classification to EACH section using the EXACT same function
  // that /emails and /profile pages use (from tierSelector.ts)
  let totalFiltered = 0
  let totalKept = 0

  for (const [section, sectionClassifications] of Object.entries(classificationsBySection)) {
    if (sectionClassifications.length === 0) continue

    console.log(`[A/B Testing] Applying tiered classification to ${section}: ${sectionClassifications.length} raw`)

    // Use the EXACT same applyTieredClassification function from tierSelector.ts
    // This applies REQ-1.4 filtering (Unknown X) and primary/alternative selection
    const tieredResults = applyTieredClassification(
      sectionClassifications,
      section,
      0.5,  // minConfidence (same as tierSelector.ts default)
      0.3   // confidenceDeltaThreshold (same as tierSelector.ts default)
    )

    const filteredCount = sectionClassifications.length - Object.keys(tieredResults).length
    totalFiltered += filteredCount

    // Extract primary classifications from tiered results
    for (const [tierGroup, tieredResult] of Object.entries(tieredResults)) {
      const primary = tieredResult.primary

      // Get email IDs from original classification
      const originalClassification = sectionClassifications.find(
        c => c.taxonomy_id === primary.taxonomy_id && c.value === primary.value
      )
      const emailIds = (originalClassification as any)?.email_ids || apiResponse.all_classifications
        .find((c: any) => c.taxonomy_id === primary.taxonomy_id && c.value === primary.value)?.email_ids || []

      // Add to results (one per email ID)
      if (emailIds.length > 0) {
        for (const emailId of emailIds) {
          classifications.push({
            emailId,
            category: primary.value,
            taxonomyId: String(primary.taxonomy_id || ''),
            confidence: primary.confidence || 0,
            reasoning: primary.reasoning || '',
            section: section as IABSection,
          })
          totalKept++
        }
      } else {
        classifications.push({
          emailId: 'batch',
          category: primary.value,
          taxonomyId: String(primary.taxonomy_id || ''),
          confidence: primary.confidence || 0,
          reasoning: primary.reasoning || '',
          section: section as IABSection,
        })
        totalKept++
      }

      // Also include alternatives for A/B testing comparison
      for (const alt of tieredResult.alternatives) {
        const altEmailIds = apiResponse.all_classifications
          .find((c: any) => c.taxonomy_id === alt.taxonomy_id && c.value === alt.value)?.email_ids || []

        if (altEmailIds.length > 0) {
          for (const emailId of altEmailIds) {
            classifications.push({
              emailId,
              category: alt.value,
              taxonomyId: String(alt.taxonomy_id || ''),
              confidence: alt.confidence || 0,
              reasoning: alt.reasoning || '',
              section: section as IABSection,
            })
            totalKept++
          }
        }
      }
    }

    console.log(`[A/B Testing] ${section}: ${Object.keys(tieredResults).length} tier groups, ${filteredCount} filtered (likely "Unknown X")`)
  }

  console.log(`[A/B Testing] Tiered classification complete for ${modelKey}: ${totalKept} kept, ~${totalFiltered} filtered`)

  // Compute stats
  const confidences = classifications.map(c => c.confidence)
  const uniqueCategories = [...new Set(classifications.map(c => c.category))]

  return {
    modelKey,
    classifications,
    stats: {
      avgConfidence: confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0,
      minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
      maxConfidence: confidences.length > 0 ? Math.max(...confidences) : 0,
      totalClassifications: classifications.length,
      uniqueCategories,
    },
    timing: {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
    },
  }
}

/**
 * Build empty results object for error cases
 */
function buildEmptyResults(
  modelKey: string,
  startTime: Date,
  endTime: Date
): ModelResults {
  return {
    modelKey,
    classifications: [],
    stats: {
      avgConfidence: 0,
      minConfidence: 0,
      maxConfidence: 0,
      totalClassifications: 0,
      uniqueCategories: [],
    },
    timing: {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
    },
  }
}

// DEPRECATED: Old transform function for legacy API response format
function transformToModelResults(
  modelKey: string,
  apiResponse: ClassifyAPIResponse,
  startTime: Date,
  endTime: Date
): ModelResults {
  const classifications: Classification[] = []

  // Extract classifications from the API response
  if (apiResponse.results) {
    for (const result of apiResponse.results) {
      if (result.classifications) {
        for (const section of Object.keys(result.classifications) as IABSection[]) {
          const sectionClassifications = result.classifications[section]
          if (Array.isArray(sectionClassifications)) {
            for (const c of sectionClassifications) {
              classifications.push({
                emailId: result.email_id,
                category: c.category || c.name || 'Unknown',
                taxonomyId: c.taxonomy_id || c.id || '',
                confidence: c.confidence || 0,
                reasoning: c.reasoning || c.evidence || '',
                section,
              })
            }
          }
        }
      }
    }
  }

  // Compute stats
  const confidences = classifications.map(c => c.confidence)
  const uniqueCategories = [...new Set(classifications.map(c => c.category))]

  return {
    modelKey,
    classifications,
    stats: {
      avgConfidence: confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0,
      minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
      maxConfidence: confidences.length > 0 ? Math.max(...confidences) : 0,
      totalClassifications: classifications.length,
      uniqueCategories,
    },
    timing: {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
    },
  }
}

// API Response types (matching the classify endpoint)
interface ClassifyAPIResponse {
  success: boolean
  results?: Array<{
    email_id: string
    classifications?: {
      demographics?: Array<{
        category?: string
        name?: string
        taxonomy_id?: string
        id?: string
        confidence?: number
        reasoning?: string
        evidence?: string
      }>
      household?: Array<{
        category?: string
        name?: string
        taxonomy_id?: string
        id?: string
        confidence?: number
        reasoning?: string
        evidence?: string
      }>
      interests?: Array<{
        category?: string
        name?: string
        taxonomy_id?: string
        id?: string
        confidence?: number
        reasoning?: string
        evidence?: string
      }>
      purchase_intent?: Array<{
        category?: string
        name?: string
        taxonomy_id?: string
        id?: string
        confidence?: number
        reasoning?: string
        evidence?: string
      }>
    }
  }>
  error?: string
}

// Run classification for a single model
async function classifyWithModel(
  emails: PreprocessedEmail[],
  model: ModelConfig,
  userId: string,
  onProgress?: ProgressCallback
): Promise<ModelResults> {
  const modelKey = `${model.provider}:${model.model}`
  const startTime = new Date()

  console.log(`[A/B Testing] Starting classification with ${modelKey} for ${emails.length} emails`)
  onProgress?.(modelKey, 'started')

  try {
    const requestBody = {
      user_id: userId,
      emails: emails.map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        body: e.body,
        summary: e.summary,
      })),
      source: 'ab_testing',
      llm_provider: model.provider,
      llm_model: model.model,
      skip_store_write: true,  // Don't pollute profile store with test data
    }

    console.log(`[A/B Testing] Request body:`, {
      user_id: requestBody.user_id,
      email_count: requestBody.emails.length,
      llm_provider: requestBody.llm_provider,
      llm_model: requestBody.llm_model,
    })

    const response = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    console.log(`[A/B Testing] Response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[A/B Testing] HTTP error:`, errorText)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const endTime = new Date()

    console.log(`[A/B Testing] Response for ${modelKey}:`, {
      success: data.success,
      classification: data.classification,
      all_classifications_count: data.all_classifications?.length || 0,
      emails_processed: data.emails_processed,
      per_email_count: data.per_email_classifications?.length || 0,
      error: data.error,
    })

    if (!data.success) {
      console.error(`[A/B Testing] Classification failed for ${modelKey}:`, data.error)
      throw new Error(data.error || 'Classification failed')
    }

    onProgress?.(modelKey, 'completed')
    return transformApiResponseToResults(modelKey, data, startTime, endTime)

  } catch (error) {
    const endTime = new Date()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[A/B Testing] Error classifying with ${modelKey}:`, errorMessage)
    onProgress?.(modelKey, 'error', errorMessage)

    // Return empty results on error
    return {
      modelKey,
      classifications: [],
      stats: {
        avgConfidence: 0,
        minConfidence: 0,
        maxConfidence: 0,
        totalClassifications: 0,
        uniqueCategories: [],
      },
      timing: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs: endTime.getTime() - startTime.getTime(),
      },
    }
  }
}

// Run classification across all selected models in parallel
export async function runParallelClassification(
  preprocessedEmails: PreprocessedEmail[],
  selectedModels: ModelConfig[],
  userId: string,
  onProgress?: ProgressCallback
): Promise<Map<string, ModelResults>> {
  console.log(`[A/B Testing] ===== Starting Parallel Classification =====`)
  console.log(`[A/B Testing] Emails: ${preprocessedEmails.length}`)
  console.log(`[A/B Testing] Models: ${selectedModels.map(m => `${m.provider}:${m.model}`).join(', ')}`)
  console.log(`[A/B Testing] User ID: ${userId}`)

  const results = new Map<string, ModelResults>()

  // Create promises for all models
  const promises = selectedModels.map(model =>
    classifyWithModel(preprocessedEmails, model, userId, onProgress)
  )

  // Wait for all models to complete
  console.log(`[A/B Testing] Waiting for ${promises.length} models to complete...`)
  const allResults = await Promise.all(promises)

  // Store results in map
  for (const result of allResults) {
    results.set(result.modelKey, result)
    console.log(`[A/B Testing] Model ${result.modelKey}: ${result.stats.totalClassifications} classifications, avg confidence: ${(result.stats.avgConfidence * 100).toFixed(1)}%`)
  }

  console.log(`[A/B Testing] ===== Parallel Classification Complete =====`)
  console.log(`[A/B Testing] Total models: ${results.size}`)
  const totalClassifications = Array.from(results.values()).reduce((sum, r) => sum + r.stats.totalClassifications, 0)
  console.log(`[A/B Testing] Total classifications: ${totalClassifications}`)

  return results
}

/**
 * Run LLM summarization for Stage 2 pre-processing
 *
 * Calls /api/summarize to process emails with the selected LLM model.
 * Uses concurrent processing (5 workers) like the Python implementation.
 */
export async function runSummarization(
  emails: Array<{ id: string; subject: string; from: string; body: string; date?: string }>,
  provider: string,
  model: string,
  userId: string
): Promise<PreprocessedEmail[]> {
  console.log(`[A/B Testing] ===== Starting LLM Pre-processing =====`)
  console.log(`[A/B Testing] Emails: ${emails.length}`)
  console.log(`[A/B Testing] Summarizer model: ${provider}:${model}`)

  try {
    // Call the summarization API
    const response = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emails: emails.map(e => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          body: e.body,
          date: e.date,
        })),
        provider,
        model,
        max_concurrent: 5, // Match Python's ThreadPoolExecutor max_workers
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[A/B Testing] Summarize API error:`, errorText)
      throw new Error(`Summarization failed: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      console.error(`[A/B Testing] Summarization failed:`, data.error)
      throw new Error(data.error || 'Summarization failed')
    }

    console.log(`[A/B Testing] Summarization stats:`, data.stats)

    // Transform to PreprocessedEmail format
    const processed: PreprocessedEmail[] = data.emails.map((email: any) => {
      const summary = email.summary || email.body?.substring(0, 500) || ''
      const tokenCount = Math.ceil(summary.length / 4)

      return {
        id: email.id,
        subject: email.subject,
        from: email.from,
        body: email.body,
        date: email.date || new Date().toISOString(),
        summary,
        summaryTokenCount: tokenCount,
      }
    })

    console.log(`[A/B Testing] ===== LLM Pre-processing Complete =====`)
    console.log(`[A/B Testing] Processed ${processed.length} emails in ${data.stats.duration_ms}ms`)
    console.log(`[A/B Testing] LLM summaries: ${data.stats.llm_summaries}, Fallbacks: ${data.stats.fallback_summaries}`)

    return processed

  } catch (error: any) {
    console.error(`[A/B Testing] Summarization error:`, error)

    // Fallback to substring truncation if API fails
    console.warn(`[A/B Testing] Falling back to substring summarization`)
    const processed: PreprocessedEmail[] = emails.map((email) => {
      const body = email.body || ''
      const summary = body.substring(0, 500)
      const tokenCount = Math.ceil(summary.length / 4)

      return {
        ...email,
        date: email.date || new Date().toISOString(),
        summary,
        summaryTokenCount: tokenCount,
      }
    })

    console.log(`[A/B Testing] ===== Fallback Pre-processing Complete =====`)
    console.log(`[A/B Testing] Processed ${processed.length} emails (using substring fallback)`)

    return processed
  }
}
