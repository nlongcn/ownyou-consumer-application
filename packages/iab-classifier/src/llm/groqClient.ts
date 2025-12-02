/**
 * Groq LLM Client Implementation
 *
 * Groq provides the fastest LLM inference using custom LPU hardware.
 * API is OpenAI-compatible with zero data retention option.
 *
 * Key features:
 * - Fastest inference in market (~10x faster than competitors)
 * - Zero Data Retention toggle available in Console
 * - OpenAI-compatible API format
 * - Function calling support on Llama 3.x models
 *
 * Privacy: Enable ZDR in Groq Console -> Settings -> Data Controls
 *
 * Pricing (Nov 2025): https://console.groq.com/docs/pricing
 */

import {
  BaseLLMClient,
  LLMProvider,
  type LLMRequest,
  type LLMResponse,
  type LLMMessage,
} from './base'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Groq model pricing per 1M tokens (as of Nov 2025)
 * Source: https://console.groq.com/docs/pricing
 */
const GROQ_PRICING: Record<string, { input: number; output: number }> = {
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'llama3-70b-8192': { input: 0.59, output: 0.79 },
  'llama3-8b-8192': { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  'gemma2-9b-it': { input: 0.20, output: 0.20 },
  'llama-guard-3-8b': { input: 0.20, output: 0.20 },
}

/**
 * Groq model context windows
 */
const GROQ_CONTEXT_WINDOWS: Record<string, number> = {
  'llama-3.3-70b-versatile': 128000,
  'llama-3.1-70b-versatile': 128000,
  'llama-3.1-8b-instant': 128000,
  'llama3-70b-8192': 8192,
  'llama3-8b-8192': 8192,
  'mixtral-8x7b-32768': 32768,
  'gemma2-9b-it': 8192,
  'llama-guard-3-8b': 8192,
}

/**
 * Default max completion tokens by model
 */
const GROQ_MAX_COMPLETION: Record<string, number> = {
  'llama-3.3-70b-versatile': 8192,
  'llama-3.1-70b-versatile': 8192,
  'llama-3.1-8b-instant': 8192,
  'llama3-70b-8192': 8192,
  'llama3-8b-8192': 8192,
  'mixtral-8x7b-32768': 4096,
  'gemma2-9b-it': 4096,
  'llama-guard-3-8b': 4096,
}

// ============================================================================
// GROQ CLIENT CLASS
// ============================================================================

/**
 * Client for Groq LLM API
 *
 * Uses OpenAI-compatible API format for easy migration.
 */
export class GroqClient extends BaseLLMClient {
  // Instance properties
  private apiKey: string
  private baseUrl: string
  private defaultModel: string
  private maxTokens: number
  private defaultTemperature: number

  /**
   * Initialize Groq client
   *
   * @param config - Configuration dictionary with Groq settings
   */
  constructor(config: Record<string, any>) {
    super(config)

    // Extract configuration - support both groq_ prefix and generic names
    // Self-sovereign: API keys provided via config, NOT bundled in client
    this.apiKey =
      config.groq_api_key ||
      config.api_key ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GROQ_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.GROQ_API_KEY) ||
      ''

    this.defaultModel =
      config.groq_model ||
      config.model ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GROQ_MODEL) ||
      (typeof process !== 'undefined' && process.env?.GROQ_MODEL) ||
      'llama-3.3-70b-versatile'

    this.baseUrl =
      config.groq_base_url ||
      config.base_url ||
      'https://api.groq.com/openai/v1'

    // Max tokens configuration
    const maxTokensStr =
      config.groq_max_tokens ||
      config.max_tokens
    this.maxTokens = maxTokensStr ? parseInt(String(maxTokensStr), 10) : 4096

    // Temperature configuration
    const temperatureVal = config.groq_temperature ?? config.temperature
    this.defaultTemperature = temperatureVal !== undefined
      ? parseFloat(String(temperatureVal))
      : 0.7

    if (!this.apiKey) {
      throw new Error(
        'Groq API key is required. Set groq_api_key in config or NEXT_PUBLIC_GROQ_API_KEY env var.'
      )
    }

    this.logger.info(`GroqClient initialized with model: ${this.defaultModel}`)
  }

  /**
   * Get the default model name
   */
  get default_model(): string {
    return this.defaultModel
  }

  /**
   * Get the provider type
   */
  getProvider(): LLMProvider {
    return LLMProvider.GROQ
  }

  /**
   * Check if Groq API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })
      return response.ok
    } catch (error) {
      this.logger.debug(`Groq availability check failed: ${error}`)
      return false
    }
  }

  /**
   * Get list of available Groq models
   */
  async getSupportedModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`)
      }

      const data = await response.json()
      return data.data?.map((m: any) => m.id) || Object.keys(GROQ_PRICING)
    } catch (error) {
      this.logger.warning(`Error fetching Groq models, using defaults: ${error}`)
      return Object.keys(GROQ_PRICING)
    }
  }

  /**
   * Estimate the cost of a request
   */
  async estimateCost(request: LLMRequest): Promise<number | undefined> {
    const model = request.model || this.defaultModel
    const pricing = GROQ_PRICING[model]

    if (!pricing) {
      this.logger.warning(`Unknown model for cost estimation: ${model}`)
      return undefined
    }

    // Estimate tokens (rough: 4 chars per token)
    const inputText = request.messages.map(m => m.content).join(' ')
    const estimatedInputTokens = Math.ceil(inputText.length / 4)
    const estimatedOutputTokens = request.max_tokens || this.maxTokens

    return this._calculateCost(model, estimatedInputTokens, estimatedOutputTokens)
  }

  /**
   * Generate response using Groq API
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    // Validate request
    const validationErrors = this.validateRequest(request)
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors.join('; ')
      return this.createErrorResponse(errorMsg, request.model || this.defaultModel)
    }

    // Prepare parameters
    const messages = this.prepareMessages(request)
    const model = request.model || this.defaultModel
    const maxTokens = this._adjustMaxTokens(request.max_tokens || this.maxTokens, model)
    const temperature = request.temperature ?? this.defaultTemperature

    this.logger.info(`Using model: ${model} for Groq request`)

    // Format messages for OpenAI-compatible API
    const groqMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    const startTime = Date.now()

    try {
      // Build request body (OpenAI-compatible format)
      const requestBody: Record<string, any> = {
        model,
        messages: groqMessages,
        max_tokens: maxTokens,
        temperature,
      }

      // Add JSON mode if requested
      if (request.json_mode) {
        requestBody.response_format = { type: 'json_object' }
      }

      this.logger.debug(`Groq request: model=${model}, max_tokens=${maxTokens}, temp=${temperature}`)

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`
        throw new Error(`Groq API error: ${errorMsg}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      const usage = data.usage || {}
      const processingTime = (Date.now() - startTime) / 1000

      // Calculate cost
      const cost = this._calculateCost(
        model,
        usage.prompt_tokens || 0,
        usage.completion_tokens || 0
      )

      this.logger.debug('Received response from Groq', {
        model,
        content_length: content.length,
        processing_time: processingTime,
        tokens_used: usage.total_tokens,
        estimated_cost: cost,
      })

      return {
        content,
        model: data.model || model,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
        },
        metadata: {
          provider: 'groq',
          processing_time: processingTime,
          estimated_cost: cost,
          finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
          response_id: data.id,
        },
        success: true,
        cost,
        finish_reason: data.choices?.[0]?.finish_reason,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Groq generate error: ${errorMsg}`)
      return this.createErrorResponse(errorMsg, model)
    }
  }

  /**
   * Get context window for a model
   */
  getContextWindow(model?: string): number {
    const m = model || this.defaultModel
    return GROQ_CONTEXT_WINDOWS[m] || 32768
  }

  /**
   * Get max completion tokens for a model
   */
  getMaxCompletionTokens(model?: string): number {
    const m = model || this.defaultModel
    return GROQ_MAX_COMPLETION[m] || 4096
  }

  /**
   * Adjust max tokens to model limits
   */
  private _adjustMaxTokens(requested: number, model: string): number {
    const maxAllowed = GROQ_MAX_COMPLETION[model] || 4096
    return Math.min(requested, maxAllowed)
  }

  /**
   * Calculate cost based on token usage
   */
  private _calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = GROQ_PRICING[model]
    if (!pricing) {
      return 0
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input
    const outputCost = (outputTokens / 1_000_000) * pricing.output
    return inputCost + outputCost
  }
}
