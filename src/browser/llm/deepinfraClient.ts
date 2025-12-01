/**
 * DeepInfra LLM Client Implementation
 *
 * DeepInfra provides cost-effective inference with zero data retention by default.
 * SOC 2 + ISO 27001 certified. API is OpenAI-compatible.
 *
 * Key features:
 * - Zero data retention by DEFAULT (no opt-in required)
 * - SOC 2 + ISO 27001 certified
 * - Competitive pricing (~10x cheaper than OpenAI for comparable models)
 * - OpenAI-compatible API format
 * - Function calling support
 *
 * Privacy: Zero retention by default - inputs, outputs, user data stay private.
 *
 * Pricing (Nov 2025): https://deepinfra.com/pricing
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
 * DeepInfra model pricing per 1M tokens (as of Nov 2025)
 * Source: https://deepinfra.com/pricing
 */
const DEEPINFRA_PRICING: Record<string, { input: number; output: number }> = {
  'meta-llama/Llama-3.3-70B-Instruct': { input: 0.35, output: 0.40 },
  'meta-llama/Llama-3.1-70B-Instruct': { input: 0.35, output: 0.40 },
  'meta-llama/Llama-3.1-8B-Instruct': { input: 0.05, output: 0.05 },
  'meta-llama/Meta-Llama-3-70B-Instruct': { input: 0.35, output: 0.40 },
  'meta-llama/Meta-Llama-3-8B-Instruct': { input: 0.05, output: 0.05 },
  'Qwen/Qwen2.5-72B-Instruct': { input: 0.35, output: 0.40 },
  'Qwen/Qwen2.5-7B-Instruct': { input: 0.05, output: 0.05 },
  'mistralai/Mixtral-8x22B-Instruct-v0.1': { input: 0.65, output: 0.65 },
  'mistralai/Mixtral-8x7B-Instruct-v0.1': { input: 0.24, output: 0.24 },
  'mistralai/Mistral-7B-Instruct-v0.3': { input: 0.06, output: 0.06 },
  'microsoft/WizardLM-2-8x22B': { input: 0.65, output: 0.65 },
  'google/gemma-2-27b-it': { input: 0.27, output: 0.27 },
  'google/gemma-2-9b-it': { input: 0.08, output: 0.08 },
}

/**
 * DeepInfra model context windows
 */
const DEEPINFRA_CONTEXT_WINDOWS: Record<string, number> = {
  'meta-llama/Llama-3.3-70B-Instruct': 128000,
  'meta-llama/Llama-3.1-70B-Instruct': 128000,
  'meta-llama/Llama-3.1-8B-Instruct': 128000,
  'meta-llama/Meta-Llama-3-70B-Instruct': 8192,
  'meta-llama/Meta-Llama-3-8B-Instruct': 8192,
  'Qwen/Qwen2.5-72B-Instruct': 128000,
  'Qwen/Qwen2.5-7B-Instruct': 128000,
  'mistralai/Mixtral-8x22B-Instruct-v0.1': 65536,
  'mistralai/Mixtral-8x7B-Instruct-v0.1': 32768,
  'mistralai/Mistral-7B-Instruct-v0.3': 32768,
  'microsoft/WizardLM-2-8x22B': 65536,
  'google/gemma-2-27b-it': 8192,
  'google/gemma-2-9b-it': 8192,
}

/**
 * Default max completion tokens by model
 */
const DEEPINFRA_MAX_COMPLETION: Record<string, number> = {
  'meta-llama/Llama-3.3-70B-Instruct': 8192,
  'meta-llama/Llama-3.1-70B-Instruct': 8192,
  'meta-llama/Llama-3.1-8B-Instruct': 8192,
  'meta-llama/Meta-Llama-3-70B-Instruct': 4096,
  'meta-llama/Meta-Llama-3-8B-Instruct': 4096,
  'Qwen/Qwen2.5-72B-Instruct': 8192,
  'Qwen/Qwen2.5-7B-Instruct': 8192,
  'mistralai/Mixtral-8x22B-Instruct-v0.1': 4096,
  'mistralai/Mixtral-8x7B-Instruct-v0.1': 4096,
  'mistralai/Mistral-7B-Instruct-v0.3': 4096,
  'microsoft/WizardLM-2-8x22B': 4096,
  'google/gemma-2-27b-it': 4096,
  'google/gemma-2-9b-it': 4096,
}

// ============================================================================
// DEEPINFRA CLIENT CLASS
// ============================================================================

/**
 * Client for DeepInfra LLM API
 *
 * Uses OpenAI-compatible API format for easy migration.
 */
export class DeepInfraClient extends BaseLLMClient {
  // Instance properties
  private apiKey: string
  private baseUrl: string
  private defaultModel: string
  private maxTokens: number
  private defaultTemperature: number

  /**
   * Initialize DeepInfra client
   *
   * @param config - Configuration dictionary with DeepInfra settings
   */
  constructor(config: Record<string, any>) {
    super(config)

    // Extract configuration - support both deepinfra_ prefix and generic names
    // Self-sovereign: API keys provided via config, NOT bundled in client
    this.apiKey =
      config.deepinfra_api_key ||
      config.api_key ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DEEPINFRA_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.DEEPINFRA_API_KEY) ||
      ''

    this.defaultModel =
      config.deepinfra_model ||
      config.model ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DEEPINFRA_MODEL) ||
      (typeof process !== 'undefined' && process.env?.DEEPINFRA_MODEL) ||
      'meta-llama/Llama-3.3-70B-Instruct'

    this.baseUrl =
      config.deepinfra_base_url ||
      config.base_url ||
      'https://api.deepinfra.com/v1/openai'

    // Max tokens configuration
    const maxTokensStr =
      config.deepinfra_max_tokens ||
      config.max_tokens
    this.maxTokens = maxTokensStr ? parseInt(String(maxTokensStr), 10) : 4096

    // Temperature configuration
    const temperatureVal = config.deepinfra_temperature ?? config.temperature
    this.defaultTemperature = temperatureVal !== undefined
      ? parseFloat(String(temperatureVal))
      : 0.7

    if (!this.apiKey) {
      throw new Error(
        'DeepInfra API key is required. Set deepinfra_api_key in config or NEXT_PUBLIC_DEEPINFRA_API_KEY env var.'
      )
    }

    this.logger.info(`DeepInfraClient initialized with model: ${this.defaultModel}`)
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
    return LLMProvider.DEEPINFRA
  }

  /**
   * Check if DeepInfra API is available
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
      this.logger.debug(`DeepInfra availability check failed: ${error}`)
      return false
    }
  }

  /**
   * Get list of available DeepInfra models
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
      // Filter to chat/instruct models
      const chatModels = data.data?.filter((m: any) =>
        m.id.includes('Instruct') || m.id.includes('Chat') || m.id.includes('it')
      ).map((m: any) => m.id) || []

      return chatModels.length > 0 ? chatModels : Object.keys(DEEPINFRA_PRICING)
    } catch (error) {
      this.logger.warning(`Error fetching DeepInfra models, using defaults: ${error}`)
      return Object.keys(DEEPINFRA_PRICING)
    }
  }

  /**
   * Estimate the cost of a request
   */
  async estimateCost(request: LLMRequest): Promise<number | undefined> {
    const model = request.model || this.defaultModel
    const pricing = DEEPINFRA_PRICING[model]

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
   * Generate response using DeepInfra API
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

    this.logger.info(`Using model: ${model} for DeepInfra request`)

    // Format messages for OpenAI-compatible API
    const deepinfraMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    const startTime = Date.now()

    try {
      // Build request body (OpenAI-compatible format)
      const requestBody: Record<string, any> = {
        model,
        messages: deepinfraMessages,
        max_tokens: maxTokens,
        temperature,
      }

      // Add JSON mode if requested (DeepInfra supports this for some models)
      if (request.json_mode) {
        requestBody.response_format = { type: 'json_object' }
      }

      this.logger.debug(`DeepInfra request: model=${model}, max_tokens=${maxTokens}, temp=${temperature}`)

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
        throw new Error(`DeepInfra API error: ${errorMsg}`)
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

      this.logger.debug('Received response from DeepInfra', {
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
          provider: 'deepinfra',
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
      this.logger.error(`DeepInfra generate error: ${errorMsg}`)
      return this.createErrorResponse(errorMsg, model)
    }
  }

  /**
   * Get context window for a model
   */
  getContextWindow(model?: string): number {
    const m = model || this.defaultModel
    return DEEPINFRA_CONTEXT_WINDOWS[m] || 32768
  }

  /**
   * Get max completion tokens for a model
   */
  getMaxCompletionTokens(model?: string): number {
    const m = model || this.defaultModel
    return DEEPINFRA_MAX_COMPLETION[m] || 4096
  }

  /**
   * Adjust max tokens to model limits
   */
  private _adjustMaxTokens(requested: number, model: string): number {
    const maxAllowed = DEEPINFRA_MAX_COMPLETION[model] || 4096
    return Math.min(requested, maxAllowed)
  }

  /**
   * Calculate cost based on token usage
   */
  private _calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = DEEPINFRA_PRICING[model]
    if (!pricing) {
      return 0
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input
    const outputCost = (outputTokens / 1_000_000) * pricing.output
    return inputCost + outputCost
  }
}
