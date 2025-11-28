// Export/Import utilities for A/B Testing Framework

import {
  Email,
  PreprocessedEmail,
  ModelConfig,
  ModelResults,
  ComparisonMetrics,
  Stage1Export,
  Stage2Export,
  Stage3Export,
  EmailProvider,
} from './types'

// Generate timestamp for filenames
function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

// Download JSON data as a file
function downloadJson(data: object, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Stage 1: Export downloaded emails
export function exportStage1(
  emails: Email[],
  config: { provider: EmailProvider; maxEmails: number; userId: string }
): void {
  const exportData: Stage1Export = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    downloadConfig: config,
    emails,
  }
  downloadJson(exportData, `downloaded_emails_${getTimestamp()}.json`)
}

// Stage 1: Import downloaded emails
export async function importStage1(file: File): Promise<Stage1Export> {
  const text = await file.text()
  const data = JSON.parse(text) as Stage1Export

  // Validate structure
  if (data.version !== '1.0') {
    throw new Error(`Unsupported version: ${data.version}`)
  }
  if (!Array.isArray(data.emails)) {
    throw new Error('Invalid Stage 1 export: missing emails array')
  }
  if (!data.downloadConfig) {
    throw new Error('Invalid Stage 1 export: missing downloadConfig')
  }

  return data
}

// Stage 2: Export pre-processed emails
export function exportStage2(
  emails: PreprocessedEmail[],
  config: { summarizerProvider: string; summarizerModel: string; sourceStage1File?: string }
): void {
  const exportData: Stage2Export = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    preprocessConfig: config,
    emails,
  }
  downloadJson(exportData, `preprocessed_emails_${getTimestamp()}.json`)
}

// Stage 2: Import pre-processed emails
export async function importStage2(file: File): Promise<Stage2Export> {
  const text = await file.text()
  const data = JSON.parse(text) as Stage2Export

  // Validate structure
  if (data.version !== '1.0') {
    throw new Error(`Unsupported version: ${data.version}`)
  }
  if (!Array.isArray(data.emails)) {
    throw new Error('Invalid Stage 2 export: missing emails array')
  }
  if (!data.preprocessConfig) {
    throw new Error('Invalid Stage 2 export: missing preprocessConfig')
  }

  // Validate that emails have summaries
  for (const email of data.emails) {
    if (typeof email.summary !== 'string') {
      throw new Error(`Invalid Stage 2 export: email ${email.id} missing summary`)
    }
  }

  return data
}

// Stage 3: Export classification results
export function exportStage3(
  models: ModelConfig[],
  results: Map<string, ModelResults>,
  comparisonMetrics: ComparisonMetrics,
  sourceStage2File?: string
): void {
  // Convert Map to Record for JSON serialization
  const resultsRecord: Record<string, ModelResults> = {}
  results.forEach((value, key) => {
    resultsRecord[key] = value
  })

  const exportData: Stage3Export = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sourceStage2File,
    models,
    results: resultsRecord,
    comparisonMetrics,
  }
  downloadJson(exportData, `classification_results_${getTimestamp()}.json`)
}

// Stage 3: Import classification results (for viewing/comparison)
export async function importStage3(file: File): Promise<Stage3Export> {
  const text = await file.text()
  const data = JSON.parse(text) as Stage3Export

  // Validate structure
  if (data.version !== '1.0') {
    throw new Error(`Unsupported version: ${data.version}`)
  }
  if (!Array.isArray(data.models)) {
    throw new Error('Invalid Stage 3 export: missing models array')
  }
  if (!data.results || typeof data.results !== 'object') {
    throw new Error('Invalid Stage 3 export: missing results')
  }
  if (!data.comparisonMetrics) {
    throw new Error('Invalid Stage 3 export: missing comparisonMetrics')
  }

  return data
}

// Convert Stage3Export results Record back to Map
export function resultsRecordToMap(results: Record<string, ModelResults>): Map<string, ModelResults> {
  return new Map(Object.entries(results))
}
