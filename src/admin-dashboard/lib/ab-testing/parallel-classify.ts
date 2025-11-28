// Parallel classification module for A/B Testing Framework

import {
  PreprocessedEmail,
  ModelConfig,
  ModelResults,
  Classification,
  IABSection,
} from './types'

// Progress callback type
export type ProgressCallback = (modelKey: string, status: 'started' | 'completed' | 'error', message?: string) => void

// Transform API response to ModelResults
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

  onProgress?.(modelKey, 'started')

  try {
    const response = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json() as ClassifyAPIResponse
    const endTime = new Date()

    if (!data.success) {
      throw new Error(data.error || 'Classification failed')
    }

    onProgress?.(modelKey, 'completed')
    return transformToModelResults(modelKey, data, startTime, endTime)

  } catch (error) {
    const endTime = new Date()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
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
  const results = new Map<string, ModelResults>()

  // Create promises for all models
  const promises = selectedModels.map(model =>
    classifyWithModel(preprocessedEmails, model, userId, onProgress)
  )

  // Wait for all models to complete
  const allResults = await Promise.all(promises)

  // Store results in map
  for (const result of allResults) {
    results.set(result.modelKey, result)
  }

  return results
}

// Run summarization only (for Stage 2 pre-processing)
export async function runSummarization(
  emails: Array<{ id: string; subject: string; from: string; body: string }>,
  provider: string,
  model: string,
  userId: string
): Promise<PreprocessedEmail[]> {
  const response = await fetch('/api/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      emails,
      source: 'ab_testing',
      llm_provider: provider,
      llm_model: model,
      summarize_only: true,  // Just summarize, don't classify
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Summarization failed')
  }

  // Transform response to PreprocessedEmail[]
  return emails.map((email, index) => ({
    ...email,
    date: new Date().toISOString(),
    summary: data.emails?.[index]?.summary || '',
    summaryTokenCount: data.emails?.[index]?.token_count || 0,
  }))
}
