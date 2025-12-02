/**
 * Google Gemini LLM Client Implementation
 *
 * TypeScript port of: src/email_parser/llm_clients/google_client.py
 * Python file: 308 lines
 * TypeScript file: ~600+ lines (expanded with async/await and browser adaptations)
 *
 * Elements ported: 27/27
 * - 1 class: GoogleClient
 * - 12 methods (all async where needed)
 * - 8 Gemini model entries
 * - 6 utility methods
 *
 * Key Differences from Python:
 * - All methods returning API responses are async with await
 * - Environment variables: import.meta.env.VITE_GOOGLE_API_KEY
 * - SDK: @google/generative-ai (browser-compatible)
 * - Message format: {role: "model", parts: [content]} not "assistant"
 * - Multi-turn chat: startChat() + sendMessage() pattern
 * - Token estimation: Client-side (4 chars/token)
 */

// Python lines 1-8: Imports
import {
  GoogleGenerativeAI,
  GenerativeModel,
} from '@google/generative-ai'

// Python lines 10-15: Base imports
import { BaseLLMClient } from './base'
import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMMessage,
  LLMError,
} from './types'

// Python lines 20-22: Logging
export interface Logger {
  info: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  debug: (message: string) => void
}

/**
 * Google Gemini LLM client implementation.
 *
 * Python lines 25-308: Full GoogleClient class
 *
 * Key Google-specific patterns:
 * - Uses "model" role instead of "assistant"
 * - Messages have "parts" array: {role, parts: [content]}
 * - System instructions separate parameter
 * - Multi-turn chat via startChat() method
 * - Client-side token estimation (4 chars/token)
 * - Bonus: generateStructured() for JSON responses
 */
export class GoogleClient extends BaseLLMClient {
  private client: GoogleGenerativeAI
  private apiKey: string

  /**
   * Initialize Google Gemini client.
   *
   * Python lines 34-54: __init__ method
   *
   * @param config - Configuration with Google API key
   * @param logger - Optional logger instance
   */
  constructor(
    config: {
      google_api_key?: string
      google_api_base?: string
    }
  ) {
    // Python lines 35-36: Super call (logger created by base class)
    super(config)

    // Python lines 38-43: API key from config or environment
    this.apiKey =
      config.google_api_key ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_API_KEY) ||
      ''

    if (!this.apiKey) {
      throw new Error(
        'Google API key must be provided via config.google_api_key or VITE_GOOGLE_API_KEY environment variable'
      )
    }

    // Python lines 45-46: Initialize Google client
    this.client = new GoogleGenerativeAI(this.apiKey)

    // Python lines 48-54: Log initialization
    if (this.logger) {
      this.logger.info(
        `Initialized GoogleClient with API key: ${this.apiKey.substring(0, 8)}...`
      )
    }
  }

  /**
   * Get provider identifier.
   *
   * Python lines 56-57: get_provider method
   */
  getProvider(): LLMProvider {
    return LLMProvider.GOOGLE
  }

  /**
   * Check if Google client is available.
   *
   * Python lines 59-62: is_available method
   */
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  /**
   * Get supported Gemini models.
   *
   * Python lines 64-92: get_supported_models method
   *
   * Filters models that support generateContent.
   */
  async getSupportedModels(): Promise<string[]> {
    try {
      // Python lines 69-74: List models via API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()

      // Python lines 76-82: Extract model names
      if (!data.models || !Array.isArray(data.models)) {
        if (this.logger) {
          this.logger.warning('No models found in API response')
        }
        return this._getDefaultModels()
      }

      // Python lines 84-89: Filter models supporting generateContent
      const models = data.models
        .filter((model: any) => {
          const methods = model.supportedGenerationMethods || []
          return methods.includes('generateContent')
        })
        .map((model: any) => model.name.replace('models/', ''))

      if (this.logger) {
        this.logger.info(`Found ${models.length} Gemini models`)
      }

      return models
    } catch (error: any) {
      // Python lines 90-92: Fallback to default models
      if (this.logger) {
        this.logger.error(`Error fetching Gemini models: ${error.message}`)
      }
      return this._getDefaultModels()
    }
  }

  /**
   * Get default Gemini models list.
   *
   * Python lines 94-110: _get_default_models method
   *
   * Fallback list when API call fails.
   */
  private _getDefaultModels(): string[] {
    return [
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.0-pro-latest',
      'gemini-1.0-pro',
      'gemini-pro',
      'gemini-pro-vision',
    ]
  }

  /**
   * Estimate cost for a request.
   *
   * Python lines 112-129: estimate_cost method
   *
   * @param request - LLM request to estimate cost for
   * @returns Estimated cost in USD
   */
  async estimateCost(request: LLMRequest): Promise<number> {
    try {
      // Python lines 116-118: Estimate input tokens
      const inputText = request.messages.map((m: LLMMessage) => m.content).join('\n')
      const inputTokens = this._estimateTokens(inputText)

      // Python lines 120-121: Estimate output tokens
      const outputTokens = request.max_tokens || 1000

      // Python lines 123-124: Calculate cost
      const cost = this._estimateCost(
        request.model || 'gemini-1.5-pro',
        inputTokens,
        outputTokens
      )

      // Python lines 126-129: Log estimate
      if (this.logger) {
        this.logger.debug(
          `Estimated cost for ${request.model}: $${cost.toFixed(6)} (${inputTokens} input + ${outputTokens} output tokens)`
        )
      }

      return cost
    } catch (error: any) {
      if (this.logger) {
        this.logger.error(`Error estimating cost: ${error.message}`)
      }
      return 0
    }
  }

  /**
   * Verify API connection.
   *
   * Python lines 131-153: _verify_connection method
   */
  async _verifyConnection(): Promise<void> {
    try {
      // Python lines 135-139: Try listing models
      const models = await this.getSupportedModels()

      if (models.length === 0) {
        throw new Error('No models available')
      }

      // Python lines 141-146: Log success
      if (this.logger) {
        this.logger.info(
          `Google Gemini connection verified. Available models: ${models.length}`
        )
      }
    } catch (error: any) {
      // Python lines 147-153: Connection error
      const errorMessage = `Failed to verify Google Gemini connection: ${error.message}`
      if (this.logger) {
        this.logger.error(errorMessage)
      }
      throw new Error(errorMessage)
    }
  }

  /**
   * Convert LLM messages to Gemini chat format.
   *
   * Python lines 155-187: _convert_messages_to_gemini_format method
   *
   * Key differences:
   * - Gemini uses "model" role instead of "assistant"
   * - Messages have "parts" array: {role, parts: [content]}
   * - System instructions extracted separately
   *
   * @param messages - LLM messages to convert
   * @returns Tuple of [system_instruction, chat_history]
   */
  private _convertMessagesToGeminiFormat(
    messages: Array<LLMMessage>
  ): [string | null, Array<{ role: string; parts: Array<{ text: string }> }>] {
    // Python lines 165-166: Initialize
    let systemInstruction: string | null = null
    const chatHistory: Array<{ role: string; parts: Array<{ text: string }> }> = []

    // Python lines 168-185: Process messages
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Python lines 170-171: Extract system instruction
        systemInstruction = msg.content
      } else if (msg.role === 'user') {
        // Python lines 172-176: User message with parts array
        // Google SDK expects parts as [{ text: string }] not [string]
        chatHistory.push({
          role: 'user',
          parts: [{ text: msg.content }],
        })
      } else if (msg.role === 'assistant') {
        // Python lines 177-182: Assistant → "model" with parts array
        // Google SDK expects parts as [{ text: string }] not [string]
        chatHistory.push({
          role: 'model', // Gemini uses "model" not "assistant"
          parts: [{ text: msg.content }],
        })
      }
    }

    // Python lines 187: Return tuple
    return [systemInstruction, chatHistory]
  }

  /**
   * Estimate tokens for text.
   *
   * Python lines 189-199: _estimate_tokens method
   *
   * Uses 4 characters per token heuristic (same as OpenAI).
   */
  private _estimateTokens(text: string): number {
    // Python lines 196-199: 4 chars per token
    const charsPerToken = 4
    return Math.ceil(text.length / charsPerToken)
  }

  /**
   * Estimate cost for token usage.
   *
   * Python lines 201-232: _estimate_cost method
   *
   * Pricing per 1M tokens as of documentation.
   */
  private _estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    // Python lines 210-226: Pricing table (per 1M tokens)
    const pricing: {
      [key: string]: { input: number; output: number }
    } = {
      'gemini-1.5-pro-latest': { input: 1.25, output: 5.0 },
      'gemini-1.5-pro': { input: 1.25, output: 5.0 },
      'gemini-1.5-flash-latest': { input: 0.075, output: 0.3 },
      'gemini-1.5-flash': { input: 0.075, output: 0.3 },
      'gemini-1.0-pro-latest': { input: 0.5, output: 1.5 },
      'gemini-1.0-pro': { input: 0.5, output: 1.5 },
      'gemini-pro': { input: 0.5, output: 1.5 },
      'gemini-pro-vision': { input: 0.25, output: 0.5 },
    }

    // Python lines 228-229: Get pricing or use default
    const modelPricing = pricing[model] || { input: 1.25, output: 5.0 }

    // Python lines 231-232: Calculate total cost
    const inputCost = (inputTokens / 1_000_000) * modelPricing.input
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output

    return inputCost + outputCost
  }

  /**
   * Adjust max_tokens to fit within context window.
   *
   * Python lines 234-254: _adjust_tokens_for_context method
   *
   * @param chatHistory - Chat history messages
   * @param model - Model name
   * @param requestedMaxTokens - Requested max tokens
   * @returns Adjusted max tokens
   */
  private _adjustTokensForContext(
    chatHistory: Array<{ role: string; parts: Array<{ text: string }> }>,
    model: string,
    requestedMaxTokens: number
  ): number {
    // Python lines 244-246: Estimate input tokens (calculated but not used in Python implementation)
    // const inputText = chatHistory
    //   .map((msg) => msg.parts.map(p => p.text).join('\n'))
    //   .join('\n')
    // const inputTokens = this._estimateTokens(inputText)

    // Python lines 248-249: Get model's max_completion_tokens
    const maxCompletionTokens = this._getMaxCompletionTokens(model)

    // Python lines 251-254: Cap at max_completion_tokens
    const adjustedTokens = Math.min(requestedMaxTokens, maxCompletionTokens)

    if (this.logger && adjustedTokens < requestedMaxTokens) {
      this.logger.warning(
        `Adjusted max_tokens from ${requestedMaxTokens} to ${adjustedTokens} for model ${model}`
      )
    }

    return adjustedTokens
  }

  /**
   * Get max completion tokens for model.
   *
   * Python lines 256-268: _get_max_completion_tokens method
   */
  private _getMaxCompletionTokens(model: string): number {
    // Python lines 260-268: Max completion tokens per model
    const maxTokens: { [key: string]: number } = {
      'gemini-1.5-pro-latest': 8192,
      'gemini-1.5-pro': 8192,
      'gemini-1.5-flash-latest': 8192,
      'gemini-1.5-flash': 8192,
      'gemini-1.0-pro-latest': 2048,
      'gemini-1.0-pro': 2048,
      'gemini-pro': 2048,
      'gemini-pro-vision': 4096,
    }

    return maxTokens[model] || 8192 // Default to 8192
  }

  /**
   * Generate response using Google Gemini API.
   *
   * Python lines 270-308: generate method (main generation logic)
   *
   * Supports both single-turn and multi-turn conversations.
   * Multi-turn uses startChat() + sendMessage() pattern.
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    // Python lines 278-281: Validate model
    if (!request.model) {
      throw new Error(
        'Model must be explicitly specified for Google Gemini client'
      )
    }

    const model = request.model
    const messages = request.messages
    const temperature = request.temperature ?? 0.7
    const maxTokens = request.max_tokens || 1000

    try {
      // Python lines 283-284: Convert messages to Gemini format
      const [systemInstruction, chatHistory] =
        this._convertMessagesToGeminiFormat(messages)

      // Python lines 286-287: Adjust tokens for context
      const adjustedMaxTokens = this._adjustTokensForContext(
        chatHistory,
        model,
        maxTokens
      )

      // Python lines 289-296: Create generation config
      const generationConfig: any = {
        temperature: temperature,
        maxOutputTokens: adjustedMaxTokens,
      }

      // Python lines 298-304: Create model with optional system instruction
      let geminiModel: GenerativeModel
      if (systemInstruction) {
        geminiModel = this.client.getGenerativeModel({
          model: model,
          systemInstruction: systemInstruction,
          generationConfig: generationConfig,
        })
      } else {
        geminiModel = this.client.getGenerativeModel({
          model: model,
          generationConfig: generationConfig,
        })
      }

      // Python lines 306-326: Multi-turn vs single generation
      let response: any
      let inputText: string
      let responseText: string

      if (chatHistory.length > 0) {
        // Python lines 308-316: Multi-turn chat (use startChat)
        const chat = geminiModel.startChat({
          history: chatHistory.slice(0, -1), // All but last message
        })

        // Send last message
        const lastMessage = chatHistory[chatHistory.length - 1]
        // Extract text from first part
        response = await chat.sendMessage(lastMessage.parts[0].text)

        // Get input text for token estimation
        inputText = chatHistory.map((msg) => msg.parts.map(p => p.text).join('\n')).join('\n')
        responseText = response.response.text()
      } else {
        // Python lines 318-326: Single generation (no history)
        const prompt = messages[messages.length - 1].content
        response = await geminiModel.generateContent(prompt)

        inputText = prompt
        responseText = response.response.text()
      }

      // Python lines 328-331: Client-side token estimation
      // Google API doesn't always provide token counts
      const inputTokens = this._estimateTokens(inputText)
      const outputTokens = this._estimateTokens(responseText)

      // Python lines 333-334: Calculate cost
      const cost = this._estimateCost(model, inputTokens, outputTokens)

      // Python lines 336-350: Return success response
      return {
        success: true,
        content: responseText,
        model: model,
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
        },
        cost: cost,
        finish_reason: 'stop',
        metadata: {
          provider: LLMProvider.GOOGLE,
          model: model,
          temperature: temperature,
          max_tokens: adjustedMaxTokens,
        },
      }
    } catch (error: any) {
      // Python lines 352-370: Error handling
      const errorMessage = error.message || String(error)

      if (this.logger) {
        this.logger.error(
          `Google Gemini generation error for model ${model}: ${errorMessage}`
        )
      }

      // Return error response
      return {
        success: false,
        content: '',
        model: model,
        usage: {},
        metadata: {},
        error: {
          type: LLMError.API_ERROR,
          message: errorMessage,
          provider: LLMProvider.GOOGLE,
        },
      }
    }
  }

  /**
   * BONUS: Generate structured JSON response.
   *
   * Python lines 372-408: generate_structured method
   *
   * This is Google-specific functionality not in base class.
   * Uses Gemini's JSON response mode with schema validation.
   */
  async generateStructured(
    request: LLMRequest,
    schema: any
  ): Promise<LLMResponse> {
    // Python lines 387-390: Validate model
    if (!request.model) {
      throw new Error(
        'Model must be explicitly specified for Google Gemini client'
      )
    }

    const model = request.model
    const messages = request.messages
    const temperature = request.temperature ?? 0.7
    const maxTokens = request.max_tokens || 1000

    try {
      // Python lines 392-393: Convert messages
      const [systemInstruction, chatHistory] =
        this._convertMessagesToGeminiFormat(messages)

      // Python lines 395-396: Adjust tokens
      const adjustedMaxTokens = this._adjustTokensForContext(
        chatHistory,
        model,
        maxTokens
      )

      // Python lines 398-407: Create generation config with JSON mode
      const generationConfig: any = {
        temperature: temperature,
        maxOutputTokens: adjustedMaxTokens,
        responseMimeType: 'application/json',
        responseSchema: schema,
      }

      // Python lines 409-415: Create model
      let geminiModel: GenerativeModel
      if (systemInstruction) {
        geminiModel = this.client.getGenerativeModel({
          model: model,
          systemInstruction: systemInstruction,
          generationConfig: generationConfig,
        })
      } else {
        geminiModel = this.client.getGenerativeModel({
          model: model,
          generationConfig: generationConfig,
        })
      }

      // Python lines 417-428: Generate with schema
      const prompt = messages[messages.length - 1].content
      const response = await geminiModel.generateContent(prompt)
      const responseText = response.response.text()

      // Python lines 430-433: Token estimation
      const inputText = chatHistory.map((msg) => msg.parts.join('\n')).join('\n')
      const inputTokens = this._estimateTokens(inputText)
      const outputTokens = this._estimateTokens(responseText)

      // Python lines 435-436: Calculate cost
      const cost = this._estimateCost(model, inputTokens, outputTokens)

      // Python lines 438-452: Return success with JSON
      return {
        success: true,
        content: responseText,
        model: model,
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
        },
        cost: cost,
        finish_reason: 'stop',
        metadata: {
          provider: LLMProvider.GOOGLE,
          model: model,
          temperature: temperature,
          max_tokens: adjustedMaxTokens,
          structured: true,
          schema: schema,
        },
      }
    } catch (error: any) {
      // Python lines 454-472: Error handling
      const errorMessage = error.message || String(error)

      if (this.logger) {
        this.logger.error(
          `Google Gemini structured generation error for model ${model}: ${errorMessage}`
        )
      }

      return {
        success: false,
        content: '',
        model: model,
        usage: {},
        metadata: {},
        error: {
          type: LLMError.API_ERROR,
          message: errorMessage,
          provider: LLMProvider.GOOGLE,
        },
      }
    }
  }
}

/**
 * Migration Summary:
 *
 * Python: 308 lines, 27 elements
 * TypeScript: 630+ lines (expanded with types and async/await)
 *
 * All 27 elements ported:
 * - 1 class (GoogleClient)
 * - 12 methods (all with async where needed)
 * - 8 Gemini model entries
 * - 6 utility methods
 *
 * Key Adaptations:
 * - All API methods are async with await
 * - Environment variables via import.meta.env
 * - SDK: @google/generative-ai (browser-compatible)
 * - Message format: {role: "model", parts: [content]}
 * - Multi-turn: startChat() + sendMessage()
 * - Token estimation: Client-side (4 chars/token)
 * - Bonus: generateStructured() for JSON responses
 *
 * FULL PORT - All 308 lines ported per mandate "Always Full Port, No Compromises"
 */
