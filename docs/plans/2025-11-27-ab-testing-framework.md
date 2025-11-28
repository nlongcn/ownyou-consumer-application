# A/B Model Testing Framework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 3-stage pipeline UI for comparing multiple LLM models on IAB classification tasks.

**Architecture:** Pipeline-based page with progressive stage unlocking. Stage 1 downloads emails, Stage 2 pre-processes (summarizes), Stage 3 runs multiple models in parallel. Each stage's output is exportable/importable as JSON for reproducible testing.

**Tech Stack:** Next.js 14, React, TypeScript, TailwindCSS, existing LLM clients (OpenAI, Claude, Gemini, Groq, DeepInfra)

**Reference:** [A/B Testing Framework Specification](../architecture/a_b_testing/AB_TESTING_FRAMEWORK_SPEC.md)

---

## Task 1: Create Type Definitions

**Files:**
- Create: `src/admin-dashboard/lib/ab-testing/types.ts`

**Step 1: Create the ab-testing directory**

```bash
mkdir -p src/admin-dashboard/lib/ab-testing
```

**Step 2: Write the type definitions file**

```typescript
// src/admin-dashboard/lib/ab-testing/types.ts

/**
 * A/B Testing Framework Type Definitions
 *
 * Reference: docs/architecture/a_b_testing/AB_TESTING_FRAMEWORK_SPEC.md
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export interface Email {
  id: string
  subject: string
  from: string
  body: string
  date: string
  provider?: 'gmail' | 'outlook'
}

export interface PreprocessedEmail extends Email {
  summary: string
  summaryTokenCount: number
}

export interface ModelConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'groq' | 'deepinfra'
  model: string
  displayName: string
}

export interface Classification {
  emailId: string
  category: string
  taxonomyId: string
  confidence: number
  reasoning: string
  section: 'demographics' | 'household' | 'interests' | 'purchase_intent'
}

export interface ModelResults {
  modelKey: string  // "provider:model"
  classifications: Classification[]
  stats: {
    avgConfidence: number
    minConfidence: number
    maxConfidence: number
    totalClassifications: number
    uniqueCategories: string[]
  }
  timing: {
    startTime: string
    endTime: string
    durationMs: number
  }
}

// ============================================================================
// PIPELINE STATE
// ============================================================================

export type StageStatus = 'idle' | 'running' | 'completed' | 'error'

export interface ABTestingState {
  currentStage: 1 | 2 | 3
  stageStatus: {
    download: StageStatus
    preprocess: StageStatus
    classify: StageStatus
  }

  // Stage 1
  downloadedEmails: Email[]
  downloadConfig: {
    provider: 'gmail' | 'outlook' | 'both'
    maxEmails: number
    userId: string
  }

  // Stage 2
  preprocessedEmails: PreprocessedEmail[]
  preprocessConfig: {
    summarizerProvider: string
    summarizerModel: string
  }

  // Stage 3
  selectedModels: ModelConfig[]
  classificationResults: Map<string, ModelResults>

  // Computed
  comparisonMetrics: ComparisonMetrics | null
}

// ============================================================================
// EXPORT/IMPORT FORMATS
// ============================================================================

export interface Stage1Export {
  version: '1.0'
  exportedAt: string
  downloadConfig: {
    provider: 'gmail' | 'outlook' | 'both'
    maxEmails: number
    userId: string
  }
  emails: Email[]
}

export interface Stage2Export {
  version: '1.0'
  exportedAt: string
  preprocessConfig: {
    summarizerProvider: string
    summarizerModel: string
    sourceStage1File?: string
  }
  emails: PreprocessedEmail[]
}

export interface Stage3Export {
  version: '1.0'
  exportedAt: string
  sourceStage2File?: string
  models: ModelConfig[]
  results: Record<string, ModelResults>
  comparisonMetrics: ComparisonMetrics
}

// ============================================================================
// COMPARISON METRICS
// ============================================================================

export interface ModelStats {
  avgConfidence: number
  minConfidence: number
  maxConfidence: number
  stdDevConfidence: number
  totalClassifications: number
  uniqueCategories: string[]
  classificationRate: number
  durationMs: number
}

export interface AgreementMetrics {
  fullAgreementCount: number
  partialAgreementCount: number
  noAgreementCount: number
  agreementRate: number
  pairwiseAgreement: Record<string, Record<string, number>>
}

export interface CoverageMetrics {
  categoriesByModel: Record<string, string[]>
  commonCategories: string[]
  uniqueCategories: Record<string, string[]>
  categoryFrequency: Record<string, number>
}

export interface ComparisonMetrics {
  modelStats: Record<string, ModelStats>
  agreement: AgreementMetrics
  coverage: CoverageMetrics
}

// ============================================================================
// AVAILABLE MODELS (for UI)
// ============================================================================

export const AVAILABLE_MODELS: ModelConfig[] = [
  // OpenAI
  { provider: 'openai', model: 'gpt-4o-mini', displayName: 'GPT-4o-mini' },
  { provider: 'openai', model: 'gpt-4o', displayName: 'GPT-4o' },
  // Claude
  { provider: 'claude', model: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet' },
  { provider: 'claude', model: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku' },
  // Gemini
  { provider: 'gemini', model: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
  { provider: 'gemini', model: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash' },
  // Groq
  { provider: 'groq', model: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B (Groq)' },
  // DeepInfra
  { provider: 'deepinfra', model: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B (DeepInfra)' },
]
```

**Step 3: Verify file was created**

```bash
ls -la src/admin-dashboard/lib/ab-testing/types.ts
```

**Step 4: Commit**

```bash
git add src/admin-dashboard/lib/ab-testing/types.ts
git commit -m "feat(ab-testing): add type definitions for A/B testing framework"
```

---

## Task 2: Create Export/Import Utilities

**Files:**
- Create: `src/admin-dashboard/lib/ab-testing/export-import.ts`

**Step 1: Write the export/import utilities**

```typescript
// src/admin-dashboard/lib/ab-testing/export-import.ts

/**
 * Export/Import utilities for A/B Testing Framework
 *
 * Enables saving and loading pipeline stage outputs as JSON files
 * for reproducible testing with different model configurations.
 */

import type {
  Email,
  PreprocessedEmail,
  ModelConfig,
  ModelResults,
  ComparisonMetrics,
  Stage1Export,
  Stage2Export,
  Stage3Export,
} from './types'

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export Stage 1 (downloaded emails) to JSON file
 */
export function exportStage1(
  emails: Email[],
  config: { provider: 'gmail' | 'outlook' | 'both'; maxEmails: number; userId: string }
): void {
  const exportData: Stage1Export = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    downloadConfig: config,
    emails,
  }

  const filename = `downloaded_emails_${Date.now()}.json`
  downloadJSON(exportData, filename)
}

/**
 * Export Stage 2 (preprocessed emails) to JSON file
 */
export function exportStage2(
  emails: PreprocessedEmail[],
  config: { summarizerProvider: string; summarizerModel: string },
  sourceStage1File?: string
): void {
  const exportData: Stage2Export = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    preprocessConfig: {
      ...config,
      sourceStage1File,
    },
    emails,
  }

  const filename = `preprocessed_emails_${Date.now()}.json`
  downloadJSON(exportData, filename)
}

/**
 * Export Stage 3 (classification results) to JSON file
 */
export function exportStage3(
  models: ModelConfig[],
  results: Map<string, ModelResults>,
  metrics: ComparisonMetrics,
  sourceStage2File?: string
): void {
  // Convert Map to plain object for JSON serialization
  const resultsObj: Record<string, ModelResults> = {}
  results.forEach((value, key) => {
    resultsObj[key] = value
  })

  const exportData: Stage3Export = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sourceStage2File,
    models,
    results: resultsObj,
    comparisonMetrics: metrics,
  }

  const filename = `classification_results_${Date.now()}.json`
  downloadJSON(exportData, filename)
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Import Stage 1 JSON file
 */
export async function importStage1(file: File): Promise<Stage1Export> {
  const text = await file.text()
  const data = JSON.parse(text) as Stage1Export

  // Validate version
  if (data.version !== '1.0') {
    throw new Error(`Unsupported Stage 1 export version: ${data.version}`)
  }

  // Validate required fields
  if (!data.emails || !Array.isArray(data.emails)) {
    throw new Error('Invalid Stage 1 export: missing emails array')
  }

  if (!data.downloadConfig) {
    throw new Error('Invalid Stage 1 export: missing downloadConfig')
  }

  return data
}

/**
 * Import Stage 2 JSON file
 */
export async function importStage2(file: File): Promise<Stage2Export> {
  const text = await file.text()
  const data = JSON.parse(text) as Stage2Export

  // Validate version
  if (data.version !== '1.0') {
    throw new Error(`Unsupported Stage 2 export version: ${data.version}`)
  }

  // Validate required fields
  if (!data.emails || !Array.isArray(data.emails)) {
    throw new Error('Invalid Stage 2 export: missing emails array')
  }

  if (!data.preprocessConfig) {
    throw new Error('Invalid Stage 2 export: missing preprocessConfig')
  }

  // Validate emails have summaries
  const missingCount = data.emails.filter(e => !e.summary).length
  if (missingCount > 0) {
    console.warn(`Stage 2 import: ${missingCount} emails missing summaries`)
  }

  return data
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Trigger browser download of JSON data
 */
function downloadJSON(data: object, filename: string): void {
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

/**
 * Read file as text (for file input handling)
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/lib/ab-testing/export-import.ts
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/lib/ab-testing/export-import.ts
git commit -m "feat(ab-testing): add export/import utilities for pipeline stages"
```

---

## Task 3: Create Metrics Computation Module

**Files:**
- Create: `src/admin-dashboard/lib/ab-testing/metrics.ts`

**Step 1: Write the metrics computation module**

```typescript
// src/admin-dashboard/lib/ab-testing/metrics.ts

/**
 * Metrics computation for A/B Testing Framework
 *
 * Computes confidence distribution, agreement rates, and coverage analysis
 * from multi-model classification results.
 */

import type {
  ModelResults,
  ComparisonMetrics,
  ModelStats,
  AgreementMetrics,
  CoverageMetrics,
  Classification,
} from './types'

/**
 * Compute all comparison metrics from classification results
 */
export function computeComparisonMetrics(
  results: Map<string, ModelResults>,
  totalEmails: number
): ComparisonMetrics {
  const modelStats = computeModelStats(results)
  const agreement = computeAgreementMetrics(results, totalEmails)
  const coverage = computeCoverageMetrics(results)

  return { modelStats, agreement, coverage }
}

/**
 * Compute per-model statistics
 */
function computeModelStats(results: Map<string, ModelResults>): Record<string, ModelStats> {
  const stats: Record<string, ModelStats> = {}

  results.forEach((modelResult, modelKey) => {
    const confidences = modelResult.classifications.map(c => c.confidence)
    const categories = [...new Set(modelResult.classifications.map(c => c.category))]
    const emailsClassified = new Set(modelResult.classifications.map(c => c.emailId)).size

    stats[modelKey] = {
      avgConfidence: mean(confidences),
      minConfidence: Math.min(...confidences),
      maxConfidence: Math.max(...confidences),
      stdDevConfidence: stdDev(confidences),
      totalClassifications: modelResult.classifications.length,
      uniqueCategories: categories,
      classificationRate: emailsClassified / (modelResult.stats?.totalClassifications || emailsClassified),
      durationMs: modelResult.timing.durationMs,
    }
  })

  return stats
}

/**
 * Compute cross-model agreement metrics
 */
function computeAgreementMetrics(
  results: Map<string, ModelResults>,
  totalEmails: number
): AgreementMetrics {
  // Build email -> model -> top category mapping
  const emailCategories: Map<string, Map<string, string>> = new Map()

  results.forEach((modelResult, modelKey) => {
    // Group by email, get highest confidence category
    const emailTopCategory: Map<string, { category: string; confidence: number }> = new Map()

    for (const c of modelResult.classifications) {
      const existing = emailTopCategory.get(c.emailId)
      if (!existing || c.confidence > existing.confidence) {
        emailTopCategory.set(c.emailId, { category: c.category, confidence: c.confidence })
      }
    }

    emailTopCategory.forEach((value, emailId) => {
      if (!emailCategories.has(emailId)) {
        emailCategories.set(emailId, new Map())
      }
      emailCategories.get(emailId)!.set(modelKey, value.category)
    })
  })

  // Count agreement types
  let fullAgreement = 0
  let partialAgreement = 0
  let noAgreement = 0
  const modelKeys = Array.from(results.keys())

  emailCategories.forEach((modelCats) => {
    const categories = Array.from(modelCats.values())
    const uniqueCats = [...new Set(categories)]

    if (uniqueCats.length === 1 && categories.length === modelKeys.length) {
      // All models agree on same category
      fullAgreement++
    } else if (uniqueCats.length === 1 || hasMajority(categories)) {
      // Majority agree
      partialAgreement++
    } else {
      // No majority
      noAgreement++
    }
  })

  // Compute pairwise agreement
  const pairwiseAgreement: Record<string, Record<string, number>> = {}

  for (let i = 0; i < modelKeys.length; i++) {
    const modelA = modelKeys[i]
    pairwiseAgreement[modelA] = {}

    for (let j = i + 1; j < modelKeys.length; j++) {
      const modelB = modelKeys[j]
      let agreementCount = 0
      let comparisonCount = 0

      emailCategories.forEach((modelCats) => {
        const catA = modelCats.get(modelA)
        const catB = modelCats.get(modelB)
        if (catA && catB) {
          comparisonCount++
          if (catA === catB) agreementCount++
        }
      })

      const rate = comparisonCount > 0 ? agreementCount / comparisonCount : 0
      pairwiseAgreement[modelA][modelB] = rate
    }
  }

  return {
    fullAgreementCount: fullAgreement,
    partialAgreementCount: partialAgreement,
    noAgreementCount: noAgreement,
    agreementRate: totalEmails > 0 ? fullAgreement / totalEmails : 0,
    pairwiseAgreement,
  }
}

/**
 * Compute category coverage metrics
 */
function computeCoverageMetrics(results: Map<string, ModelResults>): CoverageMetrics {
  const categoriesByModel: Record<string, string[]> = {}
  const allCategories: Set<string> = new Set()

  // Collect categories per model
  results.forEach((modelResult, modelKey) => {
    const cats = [...new Set(modelResult.classifications.map(c => c.category))]
    categoriesByModel[modelKey] = cats
    cats.forEach(c => allCategories.add(c))
  })

  // Find common categories (found by ALL models)
  const modelKeys = Array.from(results.keys())
  const commonCategories = [...allCategories].filter(cat =>
    modelKeys.every(key => categoriesByModel[key]?.includes(cat))
  )

  // Find unique categories (found by ONLY ONE model)
  const uniqueCategories: Record<string, string[]> = {}
  modelKeys.forEach(key => {
    uniqueCategories[key] = categoriesByModel[key].filter(cat => {
      const otherModels = modelKeys.filter(k => k !== key)
      return otherModels.every(other => !categoriesByModel[other]?.includes(cat))
    })
  })

  // Category frequency (how many models found it)
  const categoryFrequency: Record<string, number> = {}
  allCategories.forEach(cat => {
    categoryFrequency[cat] = modelKeys.filter(key => categoriesByModel[key]?.includes(cat)).length
  })

  return {
    categoriesByModel,
    commonCategories,
    uniqueCategories,
    categoryFrequency,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = mean(values)
  const squareDiffs = values.map(v => Math.pow(v - avg, 2))
  return Math.sqrt(mean(squareDiffs))
}

function hasMajority(values: string[]): boolean {
  const counts: Record<string, number> = {}
  values.forEach(v => {
    counts[v] = (counts[v] || 0) + 1
  })
  const threshold = values.length / 2
  return Object.values(counts).some(count => count > threshold)
}
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/lib/ab-testing/metrics.ts
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/lib/ab-testing/metrics.ts
git commit -m "feat(ab-testing): add metrics computation module"
```

---

## Task 4: Create Parallel Classification Module

**Files:**
- Create: `src/admin-dashboard/lib/ab-testing/parallel-classify.ts`

**Step 1: Write the parallel classification module**

```typescript
// src/admin-dashboard/lib/ab-testing/parallel-classify.ts

/**
 * Parallel Classification for A/B Testing Framework
 *
 * Runs multiple models concurrently using Promise.all()
 */

import type {
  PreprocessedEmail,
  ModelConfig,
  ModelResults,
  Classification,
} from './types'

export interface ClassifyProgress {
  modelKey: string
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

/**
 * Run classification for multiple models in parallel
 */
export async function runParallelClassification(
  preprocessedEmails: PreprocessedEmail[],
  selectedModels: ModelConfig[],
  userId: string,
  onProgress?: (progress: ClassifyProgress[]) => void
): Promise<Map<string, ModelResults>> {
  const results = new Map<string, ModelResults>()

  // Initialize progress tracking
  const progressMap: Map<string, ClassifyProgress> = new Map()
  selectedModels.forEach(model => {
    const key = `${model.provider}:${model.model}`
    progressMap.set(key, { modelKey: key, status: 'pending' })
  })

  // Create promises for all models
  const promises = selectedModels.map(async (model) => {
    const modelKey = `${model.provider}:${model.model}`
    const startTime = new Date()

    try {
      // Update progress
      progressMap.set(modelKey, { modelKey, status: 'running' })
      onProgress?.(Array.from(progressMap.values()))

      // Call classify API
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          emails: preprocessedEmails.map(e => ({
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
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const endTime = new Date()

      // Extract classifications from response
      const classifications = extractClassifications(data, preprocessedEmails)

      // Compute stats
      const confidences = classifications.map(c => c.confidence)
      const categories = [...new Set(classifications.map(c => c.category))]

      const modelResult: ModelResults = {
        modelKey,
        classifications,
        stats: {
          avgConfidence: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
          minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
          maxConfidence: confidences.length > 0 ? Math.max(...confidences) : 0,
          totalClassifications: classifications.length,
          uniqueCategories: categories,
        },
        timing: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMs: endTime.getTime() - startTime.getTime(),
        },
      }

      // Update progress
      progressMap.set(modelKey, { modelKey, status: 'completed' })
      onProgress?.(Array.from(progressMap.values()))

      return { modelKey, result: modelResult }

    } catch (error: any) {
      const endTime = new Date()

      // Update progress with error
      progressMap.set(modelKey, { modelKey, status: 'error', error: error.message })
      onProgress?.(Array.from(progressMap.values()))

      // Return empty result on error
      return {
        modelKey,
        result: {
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
        } as ModelResults,
        error: error.message,
      }
    }
  })

  // Wait for all models to complete
  const allResults = await Promise.all(promises)

  // Populate results map
  for (const { modelKey, result } of allResults) {
    results.set(modelKey, result)
  }

  return results
}

/**
 * Extract classifications from API response
 */
function extractClassifications(
  data: any,
  emails: PreprocessedEmail[]
): Classification[] {
  const classifications: Classification[] = []

  if (!data.success) {
    return classifications
  }

  // Handle per_email_classifications format
  if (data.per_email_classifications) {
    for (const emailResult of data.per_email_classifications) {
      if (emailResult.all_classifications) {
        for (const c of emailResult.all_classifications) {
          classifications.push({
            emailId: emailResult.email_id,
            category: c.value || c.category,
            taxonomyId: c.taxonomy_id?.toString() || '',
            confidence: c.confidence || 0,
            reasoning: c.reasoning || '',
            section: c.section || 'interests',
          })
        }
      }
    }
  }

  // Fallback to all_classifications format
  if (data.all_classifications && classifications.length === 0) {
    for (const c of data.all_classifications) {
      const emailIds = c.email_ids || [c.email_id]
      for (const emailId of emailIds) {
        classifications.push({
          emailId,
          category: c.value || c.category,
          taxonomyId: c.taxonomy_id?.toString() || '',
          confidence: c.confidence || 0,
          reasoning: c.reasoning || '',
          section: c.section || 'interests',
        })
      }
    }
  }

  return classifications
}
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/lib/ab-testing/parallel-classify.ts
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/lib/ab-testing/parallel-classify.ts
git commit -m "feat(ab-testing): add parallel classification module"
```

---

## Task 5: Create Index File for ab-testing Library

**Files:**
- Create: `src/admin-dashboard/lib/ab-testing/index.ts`

**Step 1: Write the index file**

```typescript
// src/admin-dashboard/lib/ab-testing/index.ts

/**
 * A/B Testing Framework Library
 *
 * Exports all types, utilities, and functions for the A/B testing feature.
 */

// Types
export * from './types'

// Export/Import utilities
export {
  exportStage1,
  exportStage2,
  exportStage3,
  importStage1,
  importStage2,
  readFileAsText,
} from './export-import'

// Metrics computation
export { computeComparisonMetrics } from './metrics'

// Parallel classification
export { runParallelClassification } from './parallel-classify'
export type { ClassifyProgress } from './parallel-classify'
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/lib/ab-testing/index.ts
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/lib/ab-testing/index.ts
git commit -m "feat(ab-testing): add library index file"
```

---

## Task 6: Create Stage Indicator Component

**Files:**
- Create: `src/admin-dashboard/components/ab-testing/StageIndicator.tsx`

**Step 1: Create the components directory**

```bash
mkdir -p src/admin-dashboard/components/ab-testing
```

**Step 2: Write the StageIndicator component**

```typescript
// src/admin-dashboard/components/ab-testing/StageIndicator.tsx

'use client'

import type { StageStatus } from '@/lib/ab-testing/types'

interface StageIndicatorProps {
  currentStage: 1 | 2 | 3
  stageStatus: {
    download: StageStatus
    preprocess: StageStatus
    classify: StageStatus
  }
}

const stages = [
  { id: 1, name: 'Download', key: 'download' as const },
  { id: 2, name: 'Pre-process', key: 'preprocess' as const },
  { id: 3, name: 'Classify & Compare', key: 'classify' as const },
]

export function StageIndicator({ currentStage, stageStatus }: StageIndicatorProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const status = stageStatus[stage.key]
          const isActive = stage.id === currentStage
          const isCompleted = status === 'completed'
          const isRunning = status === 'running'
          const isError = status === 'error'

          return (
            <div key={stage.id} className="flex items-center flex-1">
              {/* Stage circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isRunning
                      ? 'bg-blue-500 text-white animate-pulse'
                      : isError
                      ? 'bg-red-500 text-white'
                      : isActive
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? '✓' : isError ? '!' : stage.id}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isActive || isCompleted
                      ? 'text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  {stage.name}
                </span>
                {isRunning && (
                  <span className="text-xs text-blue-600 mt-1">Running...</span>
                )}
                {isError && (
                  <span className="text-xs text-red-600 mt-1">Error</span>
                )}
              </div>

              {/* Connector line */}
              {index < stages.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-4 rounded ${
                    stageStatus[stages[index + 1].key] !== 'idle' ||
                    status === 'completed'
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 3: Verify file was created**

```bash
ls -la src/admin-dashboard/components/ab-testing/StageIndicator.tsx
```

**Step 4: Commit**

```bash
git add src/admin-dashboard/components/ab-testing/StageIndicator.tsx
git commit -m "feat(ab-testing): add StageIndicator component"
```

---

## Task 7: Create Stage 1 Panel Component (Download)

**Files:**
- Create: `src/admin-dashboard/components/ab-testing/Stage1Panel.tsx`

**Step 1: Write the Stage1Panel component**

```typescript
// src/admin-dashboard/components/ab-testing/Stage1Panel.tsx

'use client'

import { useState, useRef } from 'react'
import type { Email, StageStatus, Stage1Export } from '@/lib/ab-testing/types'
import { exportStage1, importStage1 } from '@/lib/ab-testing/export-import'

interface Stage1PanelProps {
  status: StageStatus
  emails: Email[]
  config: {
    provider: 'gmail' | 'outlook' | 'both'
    maxEmails: number
    userId: string
  }
  authStatus: { gmail: boolean; outlook: boolean }
  onConfigChange: (config: Partial<Stage1PanelProps['config']>) => void
  onDownload: () => Promise<void>
  onImport: (data: Stage1Export) => void
  disabled: boolean
}

export function Stage1Panel({
  status,
  emails,
  config,
  authStatus,
  onConfigChange,
  onDownload,
  onImport,
  disabled,
}: Stage1PanelProps) {
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImportError(null)
      const data = await importStage1(file)
      onImport(data)
    } catch (err: any) {
      setImportError(err.message || 'Failed to import file')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExport = () => {
    exportStage1(emails, config)
  }

  const isCompleted = status === 'completed'
  const isRunning = status === 'running'

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Stage 1: Email Download
        </h3>
        {isCompleted && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
            ✓ {emails.length} emails loaded
          </span>
        )}
      </div>

      {/* OAuth Status */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${authStatus.gmail ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm text-gray-600">Gmail</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${authStatus.outlook ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm text-gray-600">Outlook</span>
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider
          </label>
          <select
            value={config.provider}
            onChange={(e) => onConfigChange({ provider: e.target.value as any })}
            disabled={disabled || isRunning}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
            <option value="both">Both</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Emails
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={config.maxEmails}
            onChange={(e) => onConfigChange({ maxEmails: parseInt(e.target.value) || 10 })}
            disabled={disabled || isRunning}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onDownload}
          disabled={disabled || isRunning}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
            isRunning
              ? 'bg-blue-100 text-blue-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRunning ? 'Downloading...' : 'Download Emails'}
        </button>

        <span className="text-gray-400 self-center">or</span>

        <label className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            disabled={disabled || isRunning}
            className="hidden"
          />
          <span
            className={`block text-center px-4 py-2 rounded-md text-sm font-medium border border-gray-300 ${
              disabled || isRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 cursor-pointer'
            }`}
          >
            Upload JSON
          </span>
        </label>
      </div>

      {/* Import Error */}
      {importError && (
        <div className="mt-2 text-sm text-red-600">
          {importError}
        </div>
      )}

      {/* Export Button */}
      {isCompleted && emails.length > 0 && (
        <button
          onClick={handleExport}
          className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Export Stage 1 JSON
        </button>
      )}

      {/* Email Preview */}
      {emails.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Preview ({emails.length} emails)
          </p>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
            {emails.slice(0, 5).map((email, i) => (
              <div key={email.id} className="px-3 py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {email.subject}
                </p>
                <p className="text-xs text-gray-500">{email.from}</p>
              </div>
            ))}
            {emails.length > 5 && (
              <div className="px-3 py-2 text-xs text-gray-500 text-center">
                ... and {emails.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/components/ab-testing/Stage1Panel.tsx
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/components/ab-testing/Stage1Panel.tsx
git commit -m "feat(ab-testing): add Stage1Panel component for email download"
```

---

## Task 8: Create Stage 2 Panel Component (Pre-process)

**Files:**
- Create: `src/admin-dashboard/components/ab-testing/Stage2Panel.tsx`

**Step 1: Write the Stage2Panel component**

```typescript
// src/admin-dashboard/components/ab-testing/Stage2Panel.tsx

'use client'

import { useState, useRef } from 'react'
import type { PreprocessedEmail, StageStatus, Stage2Export } from '@/lib/ab-testing/types'
import { exportStage2, importStage2 } from '@/lib/ab-testing/export-import'

interface Stage2PanelProps {
  status: StageStatus
  emails: PreprocessedEmail[]
  config: {
    summarizerProvider: string
    summarizerModel: string
  }
  onConfigChange: (config: Partial<Stage2PanelProps['config']>) => void
  onPreprocess: () => Promise<void>
  onImport: (data: Stage2Export) => void
  disabled: boolean
  inputEmailCount: number
}

const SUMMARIZER_OPTIONS = [
  { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o-mini (Fast)' },
  { provider: 'openai', model: 'gpt-4o', label: 'GPT-4o' },
  { provider: 'gemini', model: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fastest)' },
  { provider: 'gemini', model: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
]

export function Stage2Panel({
  status,
  emails,
  config,
  onConfigChange,
  onPreprocess,
  onImport,
  disabled,
  inputEmailCount,
}: Stage2PanelProps) {
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImportError(null)
      const data = await importStage2(file)
      onImport(data)
    } catch (err: any) {
      setImportError(err.message || 'Failed to import file')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExport = () => {
    exportStage2(emails, config)
  }

  const handleModelChange = (value: string) => {
    const [provider, model] = value.split(':')
    onConfigChange({ summarizerProvider: provider, summarizerModel: model })
  }

  const isCompleted = status === 'completed'
  const isRunning = status === 'running'
  const selectedValue = `${config.summarizerProvider}:${config.summarizerModel}`

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Stage 2: Pre-processing
        </h3>
        {isCompleted && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
            ✓ {emails.length} emails summarized
          </span>
        )}
      </div>

      {/* Input info */}
      {!disabled && inputEmailCount > 0 && (
        <p className="text-sm text-gray-600 mb-4">
          Ready to summarize {inputEmailCount} emails
        </p>
      )}

      {/* Configuration */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Summarization Model
        </label>
        <select
          value={selectedValue}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={disabled || isRunning}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          {SUMMARIZER_OPTIONS.map((opt) => (
            <option key={`${opt.provider}:${opt.model}`} value={`${opt.provider}:${opt.model}`}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Fast model recommended for email summarization
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPreprocess}
          disabled={disabled || isRunning}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
            isRunning
              ? 'bg-blue-100 text-blue-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRunning ? 'Summarizing...' : 'Run Pre-processing'}
        </button>

        <span className="text-gray-400 self-center">or</span>

        <label className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            disabled={disabled || isRunning}
            className="hidden"
          />
          <span
            className={`block text-center px-4 py-2 rounded-md text-sm font-medium border border-gray-300 ${
              disabled || isRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 cursor-pointer'
            }`}
          >
            Upload JSON
          </span>
        </label>
      </div>

      {/* Import Error */}
      {importError && (
        <div className="mt-2 text-sm text-red-600">
          {importError}
        </div>
      )}

      {/* Export Button */}
      {isCompleted && emails.length > 0 && (
        <button
          onClick={handleExport}
          className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Export Stage 2 JSON
        </button>
      )}

      {/* Summary Preview */}
      {emails.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Summaries Preview
          </p>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
            {emails.slice(0, 3).map((email) => (
              <div key={email.id} className="px-3 py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm font-medium text-gray-900 truncate mb-1">
                  {email.subject}
                </p>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {email.summary}
                </p>
              </div>
            ))}
            {emails.length > 3 && (
              <div className="px-3 py-2 text-xs text-gray-500 text-center">
                ... and {emails.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/components/ab-testing/Stage2Panel.tsx
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/components/ab-testing/Stage2Panel.tsx
git commit -m "feat(ab-testing): add Stage2Panel component for pre-processing"
```

---

## Task 9: Create Stage 3 Panel Component (Classification)

**Files:**
- Create: `src/admin-dashboard/components/ab-testing/Stage3Panel.tsx`

**Step 1: Write the Stage3Panel component**

```typescript
// src/admin-dashboard/components/ab-testing/Stage3Panel.tsx

'use client'

import { useState } from 'react'
import type { ModelConfig, StageStatus } from '@/lib/ab-testing/types'
import { AVAILABLE_MODELS } from '@/lib/ab-testing/types'
import type { ClassifyProgress } from '@/lib/ab-testing/parallel-classify'

interface Stage3PanelProps {
  status: StageStatus
  selectedModels: ModelConfig[]
  progress: ClassifyProgress[]
  onModelToggle: (model: ModelConfig) => void
  onClassify: () => Promise<void>
  disabled: boolean
  inputEmailCount: number
}

export function Stage3Panel({
  status,
  selectedModels,
  progress,
  onModelToggle,
  onClassify,
  disabled,
  inputEmailCount,
}: Stage3PanelProps) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'

  const isModelSelected = (model: ModelConfig) => {
    return selectedModels.some(
      m => m.provider === model.provider && m.model === model.model
    )
  }

  // Group models by provider
  const modelsByProvider = AVAILABLE_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = []
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, ModelConfig[]>)

  const providerLabels: Record<string, string> = {
    openai: 'OpenAI',
    claude: 'Anthropic (Claude)',
    gemini: 'Google (Gemini)',
    groq: 'Groq',
    deepinfra: 'DeepInfra',
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Stage 3: Classification & Compare
        </h3>
        {isCompleted && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
            ✓ Complete
          </span>
        )}
      </div>

      {/* Input info */}
      {!disabled && inputEmailCount > 0 && (
        <p className="text-sm text-gray-600 mb-4">
          Ready to classify {inputEmailCount} emails with {selectedModels.length} model(s)
        </p>
      )}

      {/* Model Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Models to Compare
        </label>
        <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
          {Object.entries(modelsByProvider).map(([provider, models]) => (
            <div key={provider}>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                {providerLabels[provider] || provider}
              </p>
              <div className="space-y-1">
                {models.map((model) => (
                  <label
                    key={`${model.provider}:${model.model}`}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={isModelSelected(model)}
                      onChange={() => onModelToggle(model)}
                      disabled={disabled || isRunning}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{model.displayName}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {selectedModels.length} model(s) selected
        </p>
      </div>

      {/* Run Button */}
      <button
        onClick={onClassify}
        disabled={disabled || isRunning || selectedModels.length === 0}
        className={`w-full px-4 py-2 rounded-md text-sm font-medium ${
          isRunning
            ? 'bg-blue-100 text-blue-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isRunning
          ? 'Running Classification...'
          : `Run ${selectedModels.length} Model(s) in Parallel`}
      </button>

      {/* Progress */}
      {isRunning && progress.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Progress</p>
          {progress.map((p) => (
            <div
              key={p.modelKey}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-600">{p.modelKey}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  p.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : p.status === 'running'
                    ? 'bg-blue-100 text-blue-800'
                    : p.status === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/components/ab-testing/Stage3Panel.tsx
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/components/ab-testing/Stage3Panel.tsx
git commit -m "feat(ab-testing): add Stage3Panel component for classification"
```

---

## Task 10: Create Results Dashboard Component

**Files:**
- Create: `src/admin-dashboard/components/ab-testing/ResultsDashboard.tsx`

**Step 1: Write the ResultsDashboard component**

```typescript
// src/admin-dashboard/components/ab-testing/ResultsDashboard.tsx

'use client'

import { useState } from 'react'
import type { ModelConfig, ModelResults, ComparisonMetrics } from '@/lib/ab-testing/types'
import { exportStage3 } from '@/lib/ab-testing/export-import'

interface ResultsDashboardProps {
  models: ModelConfig[]
  results: Map<string, ModelResults>
  metrics: ComparisonMetrics | null
}

type Tab = 'overview' | 'confidence' | 'agreement' | 'coverage'

export function ResultsDashboard({ models, results, metrics }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  if (!metrics || results.size === 0) {
    return null
  }

  const handleExport = () => {
    exportStage3(models, results, metrics)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'confidence', label: 'Confidence' },
    { id: 'agreement', label: 'Agreement' },
    { id: 'coverage', label: 'Coverage' },
  ]

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Results: {models.length} models compared
        </h3>
        <button
          onClick={handleExport}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Export Results
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex px-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab metrics={metrics} results={results} />
        )}
        {activeTab === 'confidence' && (
          <ConfidenceTab metrics={metrics} />
        )}
        {activeTab === 'agreement' && (
          <AgreementTab metrics={metrics} />
        )}
        {activeTab === 'coverage' && (
          <CoverageTab metrics={metrics} />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// TAB COMPONENTS
// ============================================================================

function OverviewTab({
  metrics,
  results,
}: {
  metrics: ComparisonMetrics
  results: Map<string, ModelResults>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Model
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Avg Confidence
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Classifications
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Categories
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Object.entries(metrics.modelStats).map(([modelKey, stats]) => {
            const result = results.get(modelKey)
            return (
              <tr key={modelKey}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {modelKey}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {(stats.avgConfidence * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {stats.totalClassifications}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {stats.uniqueCategories.length}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {(stats.durationMs / 1000).toFixed(1)}s
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ConfidenceTab({ metrics }: { metrics: ComparisonMetrics }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Confidence distribution across models
      </p>

      {Object.entries(metrics.modelStats).map(([modelKey, stats]) => (
        <div key={modelKey} className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">{modelKey}</p>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Min</p>
              <p className="font-medium">{(stats.minConfidence * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-gray-500">Avg</p>
              <p className="font-medium">{(stats.avgConfidence * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-gray-500">Max</p>
              <p className="font-medium">{(stats.maxConfidence * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-gray-500">Std Dev</p>
              <p className="font-medium">{(stats.stdDevConfidence * 100).toFixed(1)}%</p>
            </div>
          </div>
          {/* Simple bar visualization */}
          <div className="mt-3 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${stats.avgConfidence * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function AgreementTab({ metrics }: { metrics: ComparisonMetrics }) {
  const { agreement } = metrics
  const total = agreement.fullAgreementCount + agreement.partialAgreementCount + agreement.noAgreementCount

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {agreement.fullAgreementCount}
          </p>
          <p className="text-sm text-green-600">Full Agreement</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">
            {agreement.partialAgreementCount}
          </p>
          <p className="text-sm text-yellow-600">Partial Agreement</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-700">
            {agreement.noAgreementCount}
          </p>
          <p className="text-sm text-red-600">No Agreement</p>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Agreement Rate: <span className="font-medium">{(agreement.agreementRate * 100).toFixed(1)}%</span>
        {' '}({agreement.fullAgreementCount}/{total} emails)
      </p>

      {/* Pairwise Agreement */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Pairwise Agreement</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <tbody>
              {Object.entries(agreement.pairwiseAgreement).map(([modelA, pairs]) => (
                Object.entries(pairs).map(([modelB, rate]) => (
                  <tr key={`${modelA}-${modelB}`} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-600">{modelA}</td>
                    <td className="py-2 px-2 text-gray-400">↔</td>
                    <td className="py-2 pl-4 text-gray-600">{modelB}</td>
                    <td className="py-2 pl-4 text-right font-medium">
                      {(rate * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CoverageTab({ metrics }: { metrics: ComparisonMetrics }) {
  const { coverage } = metrics

  return (
    <div className="space-y-6">
      {/* Common Categories */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Common Categories (found by all models)
        </p>
        <div className="flex flex-wrap gap-2">
          {coverage.commonCategories.length > 0 ? (
            coverage.commonCategories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded"
              >
                {cat}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-500">No common categories</span>
          )}
        </div>
      </div>

      {/* Unique Categories */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Unique Categories (found by only one model)
        </p>
        {Object.entries(coverage.uniqueCategories).map(([modelKey, cats]) => (
          cats.length > 0 && (
            <div key={modelKey} className="mb-3">
              <p className="text-xs text-gray-500 mb-1">{modelKey}</p>
              <div className="flex flex-wrap gap-2">
                {cats.map((cat) => (
                  <span
                    key={cat}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {/* Category Frequency */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Category Frequency (how many models found each)
        </p>
        <div className="max-h-48 overflow-y-auto">
          {Object.entries(coverage.categoryFrequency)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => (
              <div
                key={cat}
                className="flex items-center justify-between py-1 border-b border-gray-100"
              >
                <span className="text-sm text-gray-700">{cat}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {count} model(s)
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/components/ab-testing/ResultsDashboard.tsx
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/components/ab-testing/ResultsDashboard.tsx
git commit -m "feat(ab-testing): add ResultsDashboard component with tabs"
```

---

## Task 11: Create Component Index File

**Files:**
- Create: `src/admin-dashboard/components/ab-testing/index.ts`

**Step 1: Write the index file**

```typescript
// src/admin-dashboard/components/ab-testing/index.ts

export { StageIndicator } from './StageIndicator'
export { Stage1Panel } from './Stage1Panel'
export { Stage2Panel } from './Stage2Panel'
export { Stage3Panel } from './Stage3Panel'
export { ResultsDashboard } from './ResultsDashboard'
```

**Step 2: Verify file was created**

```bash
ls -la src/admin-dashboard/components/ab-testing/index.ts
```

**Step 3: Commit**

```bash
git add src/admin-dashboard/components/ab-testing/index.ts
git commit -m "feat(ab-testing): add component index file"
```

---

## Task 12: Create A/B Testing Page

**Files:**
- Create: `src/admin-dashboard/app/ab-testing/page.tsx`

**Step 1: Create the app directory**

```bash
mkdir -p src/admin-dashboard/app/ab-testing
```

**Step 2: Write the main page component**

```typescript
// src/admin-dashboard/app/ab-testing/page.tsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  StageIndicator,
  Stage1Panel,
  Stage2Panel,
  Stage3Panel,
  ResultsDashboard,
} from '@/components/ab-testing'
import {
  type Email,
  type PreprocessedEmail,
  type ModelConfig,
  type ModelResults,
  type ComparisonMetrics,
  type StageStatus,
  type Stage1Export,
  type Stage2Export,
  AVAILABLE_MODELS,
} from '@/lib/ab-testing'
import { runParallelClassification, type ClassifyProgress } from '@/lib/ab-testing/parallel-classify'
import { computeComparisonMetrics } from '@/lib/ab-testing/metrics'
import { getGmailOAuthClient } from '@/lib/gmail-oauth-client'
import { getOutlookOAuthClient } from '@/lib/outlook-oauth-client'
import { getLLMConfig } from '@/lib/llm-config'
import { OpenAIClient } from '@browser/llm/openaiClient'
import { GoogleClient } from '@browser/llm/googleClient'

export default function ABTestingPage() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('user_id') || 'default_user'

  // Stage status
  const [stageStatus, setStageStatus] = useState<{
    download: StageStatus
    preprocess: StageStatus
    classify: StageStatus
  }>({
    download: 'idle',
    preprocess: 'idle',
    classify: 'idle',
  })

  // Stage 1 state
  const [downloadedEmails, setDownloadedEmails] = useState<Email[]>([])
  const [downloadConfig, setDownloadConfig] = useState({
    provider: 'gmail' as 'gmail' | 'outlook' | 'both',
    maxEmails: 20,
    userId,
  })
  const [authStatus, setAuthStatus] = useState({ gmail: false, outlook: false })

  // Stage 2 state
  const [preprocessedEmails, setPreprocessedEmails] = useState<PreprocessedEmail[]>([])
  const [preprocessConfig, setPreprocessConfig] = useState({
    summarizerProvider: 'openai',
    summarizerModel: 'gpt-4o-mini',
  })

  // Stage 3 state
  const [selectedModels, setSelectedModels] = useState<ModelConfig[]>([
    AVAILABLE_MODELS[0], // GPT-4o-mini by default
  ])
  const [classificationResults, setClassificationResults] = useState<Map<string, ModelResults>>(new Map())
  const [classifyProgress, setClassifyProgress] = useState<ClassifyProgress[]>([])

  // Results
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetrics | null>(null)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Check OAuth status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const gmailClient = getGmailOAuthClient()
      const outlookClient = getOutlookOAuthClient()

      const [gmailAuth, outlookAuth] = await Promise.all([
        gmailClient.isAuthorized().catch(() => false),
        outlookClient.isAuthorized().catch(() => false),
      ])

      setAuthStatus({ gmail: gmailAuth, outlook: outlookAuth })
    } catch (err) {
      console.error('Failed to check auth status:', err)
    }
  }

  // Compute current stage
  const currentStage = stageStatus.classify !== 'idle'
    ? 3
    : stageStatus.preprocess !== 'idle'
    ? 2
    : 1

  // ============================================================================
  // STAGE 1: Download
  // ============================================================================

  const handleDownload = async () => {
    setError(null)
    setStageStatus(prev => ({ ...prev, download: 'running' }))

    try {
      const emails: Email[] = []

      if (downloadConfig.provider === 'gmail' || downloadConfig.provider === 'both') {
        const gmailOAuth = getGmailOAuthClient()
        const isAuth = await gmailOAuth.isAuthorized()
        if (!isAuth) {
          await gmailOAuth.authorize()
          return // Will redirect
        }

        const client = await gmailOAuth.getClient()
        const response = await client.listMessages(undefined, downloadConfig.maxEmails)

        if (response.messages) {
          const messages = await Promise.all(
            response.messages.map(m => client.getMessage(m.id, 'full'))
          )
          emails.push(...messages.map(msg => ({
            id: `gmail_${msg.id}`,
            subject: client.getHeader(msg, 'Subject') || 'No Subject',
            from: client.getHeader(msg, 'From') || 'Unknown',
            body: client.getPlainTextBody(msg) || client.getHtmlBody(msg) || '',
            date: client.getHeader(msg, 'Date') || '',
            provider: 'gmail' as const,
          })))
        }
      }

      if (downloadConfig.provider === 'outlook' || downloadConfig.provider === 'both') {
        const outlookOAuth = getOutlookOAuthClient()
        const isAuth = await outlookOAuth.isAuthorized()
        if (!isAuth) {
          await outlookOAuth.authorize()
          return
        }

        const client = await outlookOAuth.getClient()
        const response = await client.listMessages(undefined, downloadConfig.maxEmails)

        if (response.value) {
          emails.push(...response.value.map(msg => ({
            id: `outlook_${msg.id}`,
            subject: msg.subject || 'No Subject',
            from: msg.from?.emailAddress?.address || 'Unknown',
            body: msg.body?.content || '',
            date: msg.receivedDateTime || '',
            provider: 'outlook' as const,
          })))
        }
      }

      setDownloadedEmails(emails)
      setStageStatus(prev => ({ ...prev, download: 'completed' }))

    } catch (err: any) {
      console.error('Download error:', err)
      setError(err.message || 'Failed to download emails')
      setStageStatus(prev => ({ ...prev, download: 'error' }))
    }
  }

  const handleStage1Import = (data: Stage1Export) => {
    setDownloadedEmails(data.emails)
    setDownloadConfig(data.downloadConfig)
    setStageStatus(prev => ({ ...prev, download: 'completed' }))
  }

  // ============================================================================
  // STAGE 2: Pre-process
  // ============================================================================

  const handlePreprocess = async () => {
    setError(null)
    setStageStatus(prev => ({ ...prev, preprocess: 'running' }))

    try {
      const config = getLLMConfig()
      const { summarizerProvider, summarizerModel } = preprocessConfig

      // Validate API key
      if (summarizerProvider === 'openai' && !config.openai.api_key) {
        throw new Error('OpenAI API key required')
      }
      if (summarizerProvider === 'google' && !config.google.api_key) {
        throw new Error('Google API key required')
      }

      // Create client
      let client: any
      if (summarizerProvider === 'openai') {
        client = new OpenAIClient({ openai_api_key: config.openai.api_key })
      } else if (summarizerProvider === 'google' || summarizerProvider === 'gemini') {
        client = new GoogleClient({ google_api_key: config.google.api_key })
      } else {
        throw new Error(`Unsupported provider: ${summarizerProvider}`)
      }

      // Summarize emails (5 at a time)
      const summarized: PreprocessedEmail[] = []
      const BATCH_SIZE = 5

      for (let i = 0; i < downloadedEmails.length; i += BATCH_SIZE) {
        const batch = downloadedEmails.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async (email) => {
            try {
              const response = await client.generate({
                messages: [{
                  role: 'user',
                  content: `Summarize this email in 2-3 sentences:\n\nSubject: ${email.subject}\nFrom: ${email.from}\n\n${email.body}`,
                }],
                model: summarizerModel,
              })

              return {
                ...email,
                summary: response.success ? response.content : email.body.substring(0, 500),
                summaryTokenCount: response.content?.length || 0,
              }
            } catch {
              return {
                ...email,
                summary: email.body.substring(0, 500),
                summaryTokenCount: 0,
              }
            }
          })
        )

        summarized.push(...batchResults)
      }

      setPreprocessedEmails(summarized)
      setStageStatus(prev => ({ ...prev, preprocess: 'completed' }))

    } catch (err: any) {
      console.error('Preprocess error:', err)
      setError(err.message || 'Failed to preprocess emails')
      setStageStatus(prev => ({ ...prev, preprocess: 'error' }))
    }
  }

  const handleStage2Import = (data: Stage2Export) => {
    setPreprocessedEmails(data.emails)
    setPreprocessConfig(data.preprocessConfig)
    setStageStatus(prev => ({
      ...prev,
      download: 'completed',
      preprocess: 'completed',
    }))
  }

  // ============================================================================
  // STAGE 3: Classification
  // ============================================================================

  const handleModelToggle = (model: ModelConfig) => {
    setSelectedModels(prev => {
      const exists = prev.some(m => m.provider === model.provider && m.model === model.model)
      if (exists) {
        return prev.filter(m => !(m.provider === model.provider && m.model === model.model))
      }
      return [...prev, model]
    })
  }

  const handleClassify = async () => {
    setError(null)
    setStageStatus(prev => ({ ...prev, classify: 'running' }))
    setClassifyProgress([])

    try {
      const results = await runParallelClassification(
        preprocessedEmails,
        selectedModels,
        userId,
        setClassifyProgress
      )

      setClassificationResults(results)

      // Compute metrics
      const metrics = computeComparisonMetrics(results, preprocessedEmails.length)
      setComparisonMetrics(metrics)

      setStageStatus(prev => ({ ...prev, classify: 'completed' }))

    } catch (err: any) {
      console.error('Classification error:', err)
      setError(err.message || 'Failed to run classification')
      setStageStatus(prev => ({ ...prev, classify: 'error' }))
    }
  }

  // ============================================================================
  // RESET
  // ============================================================================

  const handleReset = () => {
    setDownloadedEmails([])
    setPreprocessedEmails([])
    setClassificationResults(new Map())
    setComparisonMetrics(null)
    setClassifyProgress([])
    setError(null)
    setStageStatus({
      download: 'idle',
      preprocess: 'idle',
      classify: 'idle',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">A/B Model Testing</h1>
          <p className="text-gray-600 mt-1">
            Compare multiple LLM models on IAB classification
          </p>
        </div>
        {(stageStatus.download !== 'idle' || stageStatus.preprocess !== 'idle') && (
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Stage Indicator */}
      <StageIndicator currentStage={currentStage} stageStatus={stageStatus} />

      {/* Stage Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Stage1Panel
          status={stageStatus.download}
          emails={downloadedEmails}
          config={downloadConfig}
          authStatus={authStatus}
          onConfigChange={(c) => setDownloadConfig(prev => ({ ...prev, ...c }))}
          onDownload={handleDownload}
          onImport={handleStage1Import}
          disabled={false}
        />

        <Stage2Panel
          status={stageStatus.preprocess}
          emails={preprocessedEmails}
          config={preprocessConfig}
          onConfigChange={(c) => setPreprocessConfig(prev => ({ ...prev, ...c }))}
          onPreprocess={handlePreprocess}
          onImport={handleStage2Import}
          disabled={stageStatus.download !== 'completed'}
          inputEmailCount={downloadedEmails.length}
        />

        <Stage3Panel
          status={stageStatus.classify}
          selectedModels={selectedModels}
          progress={classifyProgress}
          onModelToggle={handleModelToggle}
          onClassify={handleClassify}
          disabled={stageStatus.preprocess !== 'completed'}
          inputEmailCount={preprocessedEmails.length}
        />
      </div>

      {/* Results Dashboard */}
      {stageStatus.classify === 'completed' && comparisonMetrics && (
        <ResultsDashboard
          models={selectedModels}
          results={classificationResults}
          metrics={comparisonMetrics}
        />
      )}
    </div>
  )
}
```

**Step 3: Verify file was created**

```bash
ls -la src/admin-dashboard/app/ab-testing/page.tsx
```

**Step 4: Commit**

```bash
git add src/admin-dashboard/app/ab-testing/page.tsx
git commit -m "feat(ab-testing): add main A/B testing page"
```

---

## Task 13: Add Navigation Link to Layout

**Files:**
- Modify: `src/admin-dashboard/app/layout.tsx`

**Step 1: Read the current layout file**

```bash
# Read first 100 lines to find navigation section
head -100 src/admin-dashboard/app/layout.tsx
```

**Step 2: Add navigation link for A/B Testing**

Find the navigation section and add:

```typescript
{
  name: 'A/B Testing',
  href: '/ab-testing',
  icon: '🔬',
},
```

**Step 3: Verify the change**

```bash
grep -n "ab-testing" src/admin-dashboard/app/layout.tsx
```

**Step 4: Commit**

```bash
git add src/admin-dashboard/app/layout.tsx
git commit -m "feat(ab-testing): add navigation link to layout"
```

---

## Task 14: Run Type Check and Fix Any Errors

**Step 1: Run TypeScript compilation**

```bash
cd src/admin-dashboard && npx tsc --noEmit
```

**Step 2: Fix any type errors that appear**

Common fixes needed:
- Import path aliases (`@/lib/...`, `@browser/...`)
- Missing type exports
- Undefined properties

**Step 3: Run again to verify**

```bash
cd src/admin-dashboard && npx tsc --noEmit
```

Expected: Zero errors

**Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix(ab-testing): resolve TypeScript errors"
```

---

## Task 15: Test the Page in Browser

**Step 1: Start the dev server**

```bash
cd src/admin-dashboard && npm run dev
```

**Step 2: Open browser and navigate to**

```
http://localhost:3000/ab-testing
```

**Step 3: Verify functionality**

- [ ] Page loads without errors
- [ ] Stage indicator shows 3 stages
- [ ] Stage 1 panel has provider/maxEmails inputs
- [ ] Stage 2 panel is disabled initially
- [ ] Stage 3 panel is disabled initially
- [ ] Navigation link appears in sidebar

**Step 4: Test Stage 1 import/export**

- Create a test JSON file with sample emails
- Test the Upload JSON button
- Test the Export JSON button

**Step 5: Commit if everything works**

```bash
git add -A
git commit -m "test(ab-testing): verify page renders correctly"
```

---

## Task 16: Final Verification and Push

**Step 1: Run full test suite**

```bash
npm test
```

**Step 2: Run linting**

```bash
npm run lint
```

**Step 3: Create final commit if needed**

```bash
git status
git add -A
git commit -m "chore(ab-testing): final cleanup"
```

**Step 4: Push to remote**

```bash
git push origin feature/browser-pwa-dashboard-integration
```

---

## Summary

This plan implements the A/B Testing Framework with:

| Task | Component | Description |
|------|-----------|-------------|
| 1 | types.ts | Type definitions for pipeline, exports, metrics |
| 2 | export-import.ts | JSON export/import for Stage 1 & 2 |
| 3 | metrics.ts | Confidence, agreement, coverage computation |
| 4 | parallel-classify.ts | Multi-model parallel execution |
| 5 | index.ts (lib) | Library exports |
| 6 | StageIndicator | 3-step progress indicator |
| 7 | Stage1Panel | Download + import/export |
| 8 | Stage2Panel | Pre-processing + import/export |
| 9 | Stage3Panel | Model selection + classification |
| 10 | ResultsDashboard | Tabbed results with metrics |
| 11 | index.ts (components) | Component exports |
| 12 | page.tsx | Main page with state management |
| 13 | layout.tsx | Navigation link |
| 14 | Type check | Fix any TS errors |
| 15 | Browser test | Manual verification |
| 16 | Push | Final verification and push |

**Total: 16 tasks, ~45-60 minutes estimated**
