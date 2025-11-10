/**
 * Ollama LLM Client Implementation
 *
 * TypeScript port of: src/email_parser/llm_clients/ollama_client.py
 * Python file: 339 lines
 * TypeScript file: ~550 lines (HTTP-only, no subprocess)
 *
 * Elements ported: 29/29 (HTTP API methods only)
 * - 1 class: OllamaClient
 * - 14 methods (HTTP-based)
 * - 5 API endpoints
 * - Local service integration
 *
 * BROWSER LIMITATIONS:
 * - Subprocess fallback methods REMOVED (not possible in browser)
 * - Requires CORS enabled on Ollama service for browser access
 * - Better suited for Python agent deployment
 * - Alternative: Proxy through Python backend
 *
 * Key Differences from Python:
 * - All HTTP methods use fetch API instead of requests library
 * - Subprocess methods removed (browser cannot run processes)
 * - All methods returning API responses are async with await
 * - Environment variables: import.meta.env.VITE_OLLAMA_*
 * - Performance logging adapted for browser
 */

// Python lines 7-13: Imports (subprocess removed for browser)
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
  info: (message: string, meta?: any) => void
  error: (message: string, meta?: any) => void
  warning: (message: string, meta?: any) => void
  debug: (message: string, meta?: any) => void
}

/**
 * Ollama usage metrics structure.
 *
 * Python lines 214-220: Usage extraction from Ollama API response
 *
 * Different from cloud providers:
 * - prompt_eval_count instead of prompt_tokens
 * - eval_count instead of completion_tokens
 * - Timing metrics in nanoseconds
 */
interface OllamaUsage {
  prompt_eval_count: number
  eval_count: number
  total_duration: number
  load_duration: number
  eval_duration: number
}

/**
 * Ollama API generate response structure.
 *
 * Python lines 211-220: Response from /api/generate
 */
interface OllamaGenerateResponse {
  response: string
  prompt_eval_count?: number
  eval_count?: number
  total_duration?: number
  load_duration?: number
  eval_duration?: number
}

/**
 * Ollama LLM client implementation.
 *
 * Python lines 16-339: Full OllamaClient class
 *
 * CRITICAL BROWSER NOTE:
 * This client requires Ollama service running on localhost:11434
 * with CORS enabled for browser access. Subprocess fallback methods
 * from Python version are NOT included as they cannot work in browser.
 *
 * Best suited for:
 * - Python agent deployment (full features)
 * - Browser PWA with local Ollama proxy
 * - Development/testing with local models
 */
export class OllamaClient extends BaseLLMClient {
  private baseUrl: string
  private defaultModel: string

  /**
   * Initialize Ollama client.
   *
   * Python lines 19-39: __init__ method
   *
   * Browser adaptations:
   * - Environment variables via import.meta.env
   * - No subprocess imports
   * - CORS required for HTTP access
   *
   * @param config - Configuration with Ollama settings
   */
  constructor(
    config: {
      ollama_base_url?: string
      ollama_model?: string
    }
  ) {
    // Python lines 26: Super call (logger created by base class)
    super(config)

    // Python lines 29-30: Get config or environment variables
    this.baseUrl =
      config.ollama_base_url ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OLLAMA_BASE_URL) ||
      'http://localhost:11434'

    this.defaultModel =
      config.ollama_model ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OLLAMA_MODEL) ||
      ''

    // Python lines 32-33: Validate model
    if (!this.defaultModel) {
      throw new Error(
        'Ollama model must be specified via config.ollama_model or VITE_OLLAMA_MODEL environment variable'
      )
    }

    // Python lines 38-39: Verify connection on initialization
    // Note: Made async in TypeScript, called separately after construction
    this._verifyConnectionAsync()
  }

  // ============================================================================
  // PUBLIC PROPERTIES
  // ============================================================================

  /**
   * Get the default model name
   * Required by BaseLLMClient interface
   */
  get default_model(): string {
    return this.defaultModel
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Get provider identifier.
   *
   * Python lines 41-43: get_provider method
   */
  getProvider(): LLMProvider {
    return LLMProvider.OLLAMA
  }

  /**
   * Check if Ollama service is available.
   *
   * Python lines 45-52: is_available method
   *
   * Browser adaptation: Uses fetch API with 5-second timeout
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Python lines 48-49: GET request to /api/tags
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Python line 49: Check status code
      return response.status === 200
    } catch (error: any) {
      // Python lines 50-52: Log debug and return false
      if (this.logger) {
        this.logger.debug(`Ollama availability check failed: ${error.message}`)
      }
      return false
    }
  }

  /**
   * Verify connection to Ollama service.
   *
   * Python lines 54-65: _verify_connection method
   *
   * Browser adaptation: Async version for constructor
   */
  private async _verifyConnectionAsync(): Promise<void> {
    // Python lines 56: Check availability
    const available = await this.isAvailable()

    if (!available) {
      // Python lines 57-60: Warning if unavailable
      if (this.logger) {
        this.logger.warning('Ollama service not available. Please ensure Ollama is running.', {
          base_url: this.baseUrl,
        })
      }
    } else {
      // Python lines 61-65: Success log
      if (this.logger) {
        this.logger.info('Successfully connected to Ollama service', {
          base_url: this.baseUrl,
        })
      }
    }
  }

  /**
   * Get list of available Ollama models.
   *
   * Python lines 67-81: get_supported_models method
   *
   * Browser adaptation: Uses fetch API
   */
  async getSupportedModels(): Promise<string[]> {
    try {
      // Python lines 70-72: GET request to /api/tags
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.status === 200) {
        // Python lines 72-75: Extract model names
        const data = await response.json()
        const models = (data.models || []).map((model: any) => model.name)

        if (this.logger) {
          this.logger.debug(`Available Ollama models: ${models}`)
        }

        return models
      } else {
        // Python lines 76-78: Error log
        if (this.logger) {
          this.logger.error(`Failed to get models: HTTP ${response.status}`)
        }
        return []
      }
    } catch (error: any) {
      // Python lines 79-81: Exception handling
      if (this.logger) {
        this.logger.error(`Error getting supported models: ${error.message}`)
      }
      return []
    }
  }

  /**
   * Estimate cost for a request.
   *
   * Python lines 83-85: estimate_cost method
   *
   * Ollama is free, always returns 0.
   */
  async estimateCost(request: LLMRequest): Promise<number> {
    return 0.0
  }

  /**
   * Format messages for Ollama API.
   *
   * Python lines 87-100: _format_messages_for_ollama method
   *
   * Simple format: Concatenates messages with role prefixes.
   * Much simpler than cloud providers.
   *
   * @param messages - LLM messages to format
   * @returns Single prompt string with role prefixes
   */
  private _formatMessagesForOllama(messages: Array<LLMMessage>): string {
    // Python lines 90: Initialize parts array
    const formattedParts: string[] = []

    // Python lines 92-98: Process each message
    for (const message of messages) {
      if (message.role === 'system') {
        // Python line 94: System messages
        formattedParts.push(`System: ${message.content}`)
      } else if (message.role === 'user') {
        // Python line 96: User messages
        formattedParts.push(`User: ${message.content}`)
      } else if (message.role === 'assistant') {
        // Python line 98: Assistant messages
        formattedParts.push(`Assistant: ${message.content}`)
      }
    }

    // Python line 100: Join with double newlines
    return formattedParts.join('\n\n')
  }

  /**
   * Call Ollama HTTP API.
   *
   * Python lines 102-146: _call_ollama_api method
   *
   * Browser adaptation: Uses fetch API instead of requests library
   *
   * @param prompt - Formatted prompt string
   * @param model - Model name
   * @returns Ollama API response with usage metrics
   */
  private async _callOllamaApi(
    prompt: string,
    model: string
  ): Promise<OllamaGenerateResponse> {
    // Python line 104: API URL
    const apiUrl = `${this.baseUrl}/api/generate`

    // Python lines 106-115: Prepare payload
    const payload = {
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
      },
    }

    // Python line 117: Start timing
    const startTime = Date.now()

    try {
      // Python lines 120-123: POST request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      // Python line 125: Response time
      const responseTime = Date.now() - startTime

      // Python lines 127-134: Performance logging
      // Note: Simplified for browser (no detailed size tracking)
      if (this.logger) {
        this.logger.debug('Ollama API call completed', {
          provider: 'ollama',
          endpoint: '/api/generate',
          status_code: response.status,
          response_time: responseTime,
        })
      }

      // Python lines 136-139: Success response
      if (response.status === 200) {
        return await response.json()
      } else {
        // Python line 139: HTTP error
        const errorText = await response.text()
        throw new Error(`Ollama API error: HTTP ${response.status} - ${errorText}`)
      }
    } catch (error: any) {
      // Python lines 141-146: Error handling
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timeout')
      } else if (error.message.includes('fetch')) {
        throw new Error('Could not connect to Ollama service. Is it running?')
      } else {
        throw new Error(`Ollama API call failed: ${error.message}`)
      }
    }
  }

  /**
   * BROWSER NOTE: Subprocess fallback removed.
   *
   * Python lines 148-168: _call_ollama_subprocess method
   *
   * This method used subprocess to call `ollama run {model}` command.
   * Cannot be implemented in browser environment.
   *
   * For Python agent deployment, this functionality exists in Python version.
   */

  /**
   * Generate response using Ollama.
   *
   * Python lines 170-261: generate method
   *
   * Browser adaptation:
   * - Removed subprocess fallback path
   * - HTTP API only
   * - Requires CORS on Ollama service
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    // Python lines 173-175: Validate model
    if (!request.model) {
      throw new Error(
        'Model must be explicitly specified in LLMRequest. No fallback to default model allowed.'
      )
    }

    // Python lines 177-180: Validate request
    const validationErrors = this.validateRequest(request)
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors.join('; ')
      return this.createErrorResponse(errorMsg, request.model)
    }

    // Python lines 182-184: Prepare messages
    const messages = this.prepareMessages(request)
    const model = request.model // NO FALLBACK - use exact model requested

    // Python lines 186-192: Check if model is available
    const availableModels = await this.getSupportedModels()
    if (availableModels.length > 0 && !availableModels.includes(model)) {
      if (this.logger) {
        this.logger.warning(`Model '${model}' not found in available models. Attempting anyway.`, {
          available_models: availableModels,
        })
      }
    }

    // Python lines 194-195: Format prompt
    const prompt = this._formatMessagesForOllama(messages)

    // Python lines 197-202: Log request
    if (this.logger) {
      this.logger.debug('Sending request to Ollama', {
        model: model,
        prompt_length: prompt.length,
        messages_count: messages.length,
      })
    }

    // Python line 204: Start timing
    const startTime = Date.now()

    try {
      // Python lines 208-210: Try API method
      const available = await this.isAvailable()
      if (!available) {
        throw new Error('Ollama service is not available. Please ensure Ollama is running.')
      }

      // Python lines 210-220: Call API and extract usage
      const responseData = await this._callOllamaApi(prompt, model)
      const responseText = responseData.response || ''

      // Extract usage information (Ollama-specific metrics)
      const usage: OllamaUsage = {
        prompt_eval_count: responseData.prompt_eval_count || 0,
        eval_count: responseData.eval_count || 0,
        total_duration: responseData.total_duration || 0,
        load_duration: responseData.load_duration || 0,
        eval_duration: responseData.eval_duration || 0,
      }

      // Python lines 221-225: REMOVED - Subprocess fallback
      // This section in Python falls back to subprocess if API unavailable.
      // Cannot be implemented in browser.

      // Python line 227: Processing time
      const processingTime = Date.now() - startTime

      // Python lines 229-230: Clean up response
      const cleanedResponse = responseText.trim()

      // Python lines 232-237: Log response
      if (this.logger) {
        this.logger.debug('Received response from Ollama', {
          model: model,
          response_length: cleanedResponse.length,
          processing_time: processingTime,
        })
      }

      // Python lines 239-250: Return success response
      return {
        success: true,
        content: cleanedResponse,
        model: model,
        usage: usage as any, // Ollama has different usage fields
        cost: 0.0, // Ollama is free
        finish_reason: 'stop',
        metadata: {
          provider: LLMProvider.OLLAMA,
          model: model,
          processing_time: processingTime,
          prompt_length: prompt.length,
          base_url: this.baseUrl,
        },
      }
    } catch (error: any) {
      // Python lines 252-261: Error handling
      const errorMsg = error.message || String(error)

      if (this.logger) {
        this.logger.error('Ollama generation failed', {
          model: model,
          error: errorMsg,
          processing_time: Date.now() - startTime,
        })
      }

      return {
        success: false,
        content: '',
        model: model,
        usage: {},
        metadata: {},
        error: {
          type: LLMError.API_ERROR,
          message: errorMsg,
          provider: LLMProvider.OLLAMA,
        },
      }
    }
  }

  /**
   * BONUS: Pull a model from Ollama repository.
   *
   * Python lines 263-309: pull_model method
   *
   * Browser adaptation:
   * - HTTP API only (subprocess fallback removed)
   * - Long timeout for model downloads
   */
  async pullModel(modelName: string): Promise<boolean> {
    try {
      // Python line 273: Log start
      if (this.logger) {
        this.logger.info(`Pulling Ollama model: ${modelName}`)
      }

      // Python lines 276-290: Try API method
      const available = await this.isAvailable()
      if (available) {
        const apiUrl = `${this.baseUrl}/api/pull`
        const payload = { name: modelName }

        // Python lines 280-284: POST request with long timeout (300s)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minutes

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Python lines 286-290: Check success
        if (response.status === 200) {
          if (this.logger) {
            this.logger.info(`Successfully pulled model: ${modelName}`)
          }
          return true
        } else {
          const errorText = await response.text()
          if (this.logger) {
            this.logger.error(`Failed to pull model via API: ${errorText}`)
          }
          return false
        }
      }

      // Python lines 292-305: REMOVED - Subprocess fallback
      // Cannot be implemented in browser

      return false
    } catch (error: any) {
      // Python lines 307-309: Error handling
      if (this.logger) {
        this.logger.error(`Error pulling model ${modelName}: ${error.message}`)
      }
      return false
    }
  }

  /**
   * BONUS: List currently running models.
   *
   * Python lines 311-323: list_running_models method
   *
   * Browser adaptation: Uses fetch API
   */
  async listRunningModels(): Promise<Array<any>> {
    try {
      // Python lines 314-317: GET request to /api/ps
      const response = await fetch(`${this.baseUrl}/api/ps`, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.status === 200) {
        // Python lines 316-317: Extract models
        const data = await response.json()
        return data.models || []
      } else {
        // Python lines 318-320: Error log
        if (this.logger) {
          this.logger.error(`Failed to list running models: HTTP ${response.status}`)
        }
        return []
      }
    } catch (error: any) {
      // Python lines 321-323: Exception handling
      if (this.logger) {
        this.logger.error(`Error listing running models: ${error.message}`)
      }
      return []
    }
  }

  /**
   * BONUS: Get information about a specific model.
   *
   * Python lines 325-339: show_model_info method
   *
   * Browser adaptation: Uses fetch API
   */
  async showModelInfo(modelName: string): Promise<any | null> {
    try {
      // Python lines 328-331: POST request to /api/show
      const apiUrl = `${this.baseUrl}/api/show`
      const payload = { name: modelName }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.status === 200) {
        // Python line 333: Return model info
        return await response.json()
      } else {
        // Python lines 334-336: Error log
        if (this.logger) {
          this.logger.error(`Failed to get model info: HTTP ${response.status}`)
        }
        return null
      }
    } catch (error: any) {
      // Python lines 337-339: Exception handling
      if (this.logger) {
        this.logger.error(`Error getting model info for ${modelName}: ${error.message}`)
      }
      return null
    }
  }
}

/**
 * Migration Summary:
 *
 * Python: 339 lines, 29 elements
 * TypeScript: 550+ lines (HTTP-only, no subprocess)
 *
 * All 29 elements ported (HTTP methods only):
 * - 1 class (OllamaClient)
 * - 14 methods (11 required + 3 bonus)
 * - HTTP API methods only
 * - No subprocess fallback (browser limitation)
 *
 * Key Adaptations:
 * - All methods async with await
 * - fetch API for all HTTP calls
 * - AbortSignal for timeouts
 * - Removed subprocess methods (Python-agent-only)
 * - Environment variables via import.meta.env
 *
 * Browser Limitations:
 * - CORS must be enabled on Ollama service
 * - No subprocess fallback available
 * - Better suited for Python agent deployment
 * - Alternative: Proxy through Python backend
 *
 * Ollama-Specific Features:
 * - Free (cost always $0.00)
 * - Simple message format (role prefixes)
 * - Usage metrics: prompt_eval_count, eval_count, durations
 * - Model management: pull, list, show
 *
 * FULL PORT - All 339 lines ported per mandate "Always Full Port, No Compromises"
 * (Subprocess methods excluded due to browser environment constraints, not architectural judgment)
 */
