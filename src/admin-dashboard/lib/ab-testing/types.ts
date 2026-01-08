// A/B Testing Framework Type Definitions

// Stage status tracking
export type StageStatus = 'idle' | 'running' | 'completed' | 'error'

// Email providers
export type EmailProvider = 'gmail' | 'outlook' | 'both'

// LLM Providers
export type LLMProvider = 'openai' | 'claude' | 'gemini' | 'groq' | 'deepinfra'

// IAB Classification sections
export type IABSection = 'demographics' | 'household' | 'interests' | 'purchase_intent'

// Core Email interface
export interface Email {
  id: string
  subject: string
  from: string
  body: string
  date: string  // ISO date string
}

// Pre-processed email with summary
export interface PreprocessedEmail extends Email {
  summary: string
  summaryTokenCount: number
}

// Model configuration
export interface ModelConfig {
  provider: LLMProvider
  model: string
  displayName: string
}

// Individual classification result
export interface Classification {
  emailId: string
  category: string
  taxonomyId: string
  confidence: number
  reasoning: string
  section: IABSection
}

// Results for a single model
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
    startTime: string  // ISO date string
    endTime: string    // ISO date string
    durationMs: number
  }
}

// Stage 1 export format
export interface Stage1Export {
  version: '1.0'
  exportedAt: string
  downloadConfig: {
    provider: EmailProvider
    maxEmails: number
    userId: string
  }
  emails: Email[]
}

// Stage 2 export format
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

// Stage 3 export format
export interface Stage3Export {
  version: '1.0'
  exportedAt: string
  sourceStage2File?: string
  models: ModelConfig[]
  results: Record<string, ModelResults>
  comparisonMetrics: ComparisonMetrics
}

// Per-model statistics
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

// Cross-model agreement metrics
export interface AgreementMetrics {
  fullAgreementCount: number
  partialAgreementCount: number
  noAgreementCount: number
  agreementRate: number
  pairwiseAgreement: Record<string, Record<string, number>>
}

// Category coverage metrics
export interface CoverageMetrics {
  categoriesByModel: Record<string, string[]>
  commonCategories: string[]
  uniqueCategories: Record<string, string[]>
  categoryFrequency: Record<string, number>
}

// Complete comparison metrics
export interface ComparisonMetrics {
  modelStats: Record<string, ModelStats>
  agreement: AgreementMetrics
  coverage: CoverageMetrics
}

// Main page state
export interface ABTestingState {
  // Stage tracking
  currentStage: 1 | 2 | 3
  stageStatus: {
    download: StageStatus
    preprocess: StageStatus
    classify: StageStatus
  }

  // Stage 1: Downloaded emails
  downloadedEmails: Email[]
  downloadConfig: {
    provider: EmailProvider
    maxEmails: number
  }

  // Stage 2: Pre-processed emails
  preprocessedEmails: PreprocessedEmail[]
  preprocessConfig: {
    summarizerModel: string
    summarizerProvider: string
  }

  // Stage 3: Classification results
  selectedModels: ModelConfig[]
  classificationResults: Map<string, ModelResults>

  // Comparison metrics
  comparisonMetrics: ComparisonMetrics | null
}

/**
 * Fallback models for selection (used when API is not available)
 *
 * @deprecated Bundled fallback - for dynamic fallbacks use:
 * ```typescript
 * import { configService } from '@ownyou/llm-client';
 * const fallbackModels = await configService.getFallbackModels();
 * ```
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */
export const FALLBACK_MODELS: ModelConfig[] = [
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

/**
 * @deprecated Use configService.getFallbackModels() instead.
 * This alias exists for backwards compatibility.
 */
export const AVAILABLE_MODELS = FALLBACK_MODELS

// API response type for /api/analyze/models
export interface ModelsAPIResponse {
  openai: string[]
  anthropic: string[]
  google: string[]
  ollama?: string[]
  groq?: string[]
  deepinfra?: string[]
  last_email_model?: string
  last_taxonomy_model?: string
}

// Map API provider names to internal provider names
const providerNameMap: Record<string, LLMProvider> = {
  openai: 'openai',
  anthropic: 'claude',
  google: 'gemini',
  ollama: 'openai', // Use OpenAI-compatible format
  groq: 'groq',
  deepinfra: 'deepinfra',
}

// Map provider to display name prefix
const providerDisplayPrefix: Record<string, string> = {
  openai: '',
  anthropic: '',
  google: '',
  groq: '(Groq) ',
  deepinfra: '(DeepInfra) ',
}

/**
 * Fetch available models from the API
 * Returns models grouped by provider, suitable for 4x dropdowns
 */
export async function fetchAvailableModels(forceRefresh = false): Promise<ModelConfig[]> {
  try {
    console.log('[A/B Testing] Fetching models from /api/analyze/models...')
    const url = `/api/analyze/models${forceRefresh ? '?refresh=true' : ''}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`)
    }

    const data: ModelsAPIResponse = await response.json()
    const models: ModelConfig[] = []

    // OpenAI models
    if (data.openai?.length > 0) {
      data.openai.forEach(model => {
        models.push({
          provider: 'openai',
          model,
          displayName: model,
        })
      })
      console.log(`[A/B Testing] Loaded ${data.openai.length} OpenAI models`)
    }

    // Anthropic/Claude models
    if (data.anthropic?.length > 0) {
      data.anthropic.forEach(model => {
        // Format: claude-3-5-sonnet-20241022 -> Claude 3.5 Sonnet
        const displayName = model
          .replace('claude-', 'Claude ')
          .replace(/-(\d{8})$/, '')
          .replace(/-/g, ' ')
          .replace(/(\d+) (\d+)/, '$1.$2')
        models.push({
          provider: 'claude',
          model,
          displayName: displayName || model,
        })
      })
      console.log(`[A/B Testing] Loaded ${data.anthropic.length} Claude models`)
    }

    // Google/Gemini models
    if (data.google?.length > 0) {
      data.google.forEach(model => {
        // Format: gemini-2.0-flash -> Gemini 2.0 Flash
        const displayName = model
          .replace('gemini-', 'Gemini ')
          .replace(/-/g, ' ')
          .replace(/(\d+)\.(\d+)/, '$1.$2')
        models.push({
          provider: 'gemini',
          model,
          displayName: displayName || model,
        })
      })
      console.log(`[A/B Testing] Loaded ${data.google.length} Google models`)
    }

    // Groq models
    if (data.groq && data.groq.length > 0) {
      data.groq.forEach(model => {
        models.push({
          provider: 'groq',
          model,
          displayName: `${model} (Groq)`,
        })
      })
      console.log(`[A/B Testing] Loaded ${data.groq.length} Groq models`)
    }

    // DeepInfra models
    if (data.deepinfra && data.deepinfra.length > 0) {
      data.deepinfra.forEach(model => {
        // Format: meta-llama/Llama-3.3-70B-Instruct -> Llama 3.3 70B
        const shortName = model.split('/').pop() || model
        const displayName = shortName
          .replace(/-Instruct$/, '')
          .replace(/-/g, ' ')
        models.push({
          provider: 'deepinfra',
          model,
          displayName: `${displayName} (DeepInfra)`,
        })
      })
      console.log(`[A/B Testing] Loaded ${data.deepinfra.length} DeepInfra models`)
    }

    // Ollama models (if any local models)
    if (data.ollama && data.ollama.length > 0) {
      data.ollama.forEach(model => {
        models.push({
          provider: 'openai', // Ollama uses OpenAI-compatible format
          model,
          displayName: `${model} (Ollama)`,
        })
      })
      console.log(`[A/B Testing] Loaded ${data.ollama.length} Ollama models`)
    }

    console.log(`[A/B Testing] Total models loaded: ${models.length}`)
    return models.length > 0 ? models : FALLBACK_MODELS

  } catch (error) {
    console.error('[A/B Testing] Failed to fetch models, using fallback:', error)
    return FALLBACK_MODELS
  }
}
