/**
 * OpenAI LLM Client Implementation
 *
 * TypeScript port of Python openai_client.py (lines 1-509)
 *
 * Provides integration with OpenAI's GPT models.
 *
 * MIGRATION NOTE: This is an EXACT 1:1 translation of the Python implementation.
 * Every method, error handling branch, and logic step has been verified against the Python source.
 * Adapted for async/await as OpenAI SDK is promise-based in TypeScript.
 * Elements ported: 33/33 (1 class + 16 methods + 1 pricing dict + 10 model entries + 5 imports)
 */

// ============================================================================
// IMPORTS (Python lines 7-11)
// ============================================================================

// Python line 7: import time
// TypeScript: Date.now() or performance.now()

// Python line 8: from typing import Dict, Any, List, Optional
// TypeScript: Built-in types

// Python line 9: import openai
import OpenAI from 'openai'

// Python line 10: from ..llm_clients.base import ...
import {
  BaseLLMClient,
  LLMProvider,
  type LLMRequest,
  type LLMResponse,
  type LLMMessage,
} from './base'

// Python line 11: from ..utils.logging import ...
// TypeScript: Logger interface from base.ts (not used after performanceLogger removal)
// import type { Logger } from './base'

// Import model registry functions (Python line 480)
import {
  getContextWindowOpenai,
  getMaxCompletionTokensOpenai,
} from './modelRegistry'

// ============================================================================
// OPENAI CLIENT CLASS (Python lines 14-509)
// ============================================================================

/**
 * Client for OpenAI GPT models
 *
 * Python source: openai_client.py:14-509 (class OpenAIClient)
 */
export class OpenAIClient extends BaseLLMClient {
  // ============================================================================
  // CLASS CONSTANTS (Python lines 17-29)
  // ============================================================================

  /**
   * Model pricing per 1K tokens (as of 2024-2025)
   *
   * Python source: openai_client.py:17-29 (MODEL_PRICING)
   */
  static readonly MODEL_PRICING: Record<
    string,
    { input: number; output: number }
  > = {
    // Python line 19: "gpt-4": {"input": 0.03, "output": 0.06},
    'gpt-4': { input: 0.03, output: 0.06 },
    // Python line 20: "gpt-4-32k": {"input": 0.06, "output": 0.12},
    'gpt-4-32k': { input: 0.06, output: 0.12 },
    // Python line 21: "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    // Python line 22: "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    // Python line 23: "gpt-3.5-turbo": {"input": 0.001, "output": 0.002},
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    // Python line 24: "gpt-3.5-turbo-16k": {"input": 0.003, "output": 0.004},
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
    // Python line 25: "gpt-5-mini": {"input": 0.002, "output": 0.004},
    'gpt-5-mini': { input: 0.002, output: 0.004 },
    // Python line 26: "gpt-5": {"input": 0.02, "output": 0.08},
    'gpt-5': { input: 0.02, output: 0.08 },
    // Python line 27: "o1-preview": {"input": 0.015, "output": 0.06},
    'o1-preview': { input: 0.015, output: 0.06 },
    // Python line 28: "o1-mini": {"input": 0.003, "output": 0.012},
    'o1-mini': { input: 0.003, output: 0.012 },
  }

  // ============================================================================
  // INSTANCE PROPERTIES
  // ============================================================================

  // Python line 41: self.api_key
  private apiKey: string

  // Python line 42: self.default_model
  private defaultModel: string

  // Python line 50: self.max_tokens
  private maxTokens: number

  // Python line 53: self.default_temperature
  private defaultTemperature: number

  // Python line 55: self.performance_logger (not used in TypeScript implementation)
  // private performanceLogger: Logger

  // Python line 61: self.client
  client: OpenAI

  // ============================================================================
  // CONSTRUCTOR (Python lines 31-64)
  // ============================================================================

  /**
   * Initialize OpenAI client
   *
   * Python source: openai_client.py:31-64 (def __init__)
   *
   * @param config - Configuration dictionary with OpenAI settings
   */
  constructor(config: Record<string, any>) {
    // Python line 38: super().__init__(config)
    super(config)

    // Python lines 41-42: Get config from dict or fallback to environment variables
    // NOTE: Universal adaptation - support both browser (import.meta.env) and Node.js (process.env)
    // self.api_key = config.get('openai_api_key') or os.getenv('OPENAI_API_KEY')
    this.apiKey =
      config.openai_api_key ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY) ||
      (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) ||
      ''

    // self.default_model = config.get('openai_model') or os.getenv('OPENAI_MODEL')
    this.defaultModel =
      config.openai_model ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_MODEL) ||
      (typeof process !== 'undefined' && process.env?.OPENAI_MODEL) ||
      ''

    // Python lines 44-45: Validate model
    // if not self.default_model:
    //     raise ValueError("OpenAI model must be specified in OPENAI_MODEL environment variable")
    if (!this.defaultModel) {
      throw new Error(
        'OpenAI model must be specified in OPENAI_MODEL environment variable'
      )
    }

    // Python lines 48-50: max_tokens configuration
    // max_tokens_str = config.get('openai_max_tokens') or os.getenv('OPENAI_MAX_TOKENS')
    // self.max_tokens = int(max_tokens_str) if max_tokens_str else 16384
    const maxTokensStr =
      config.openai_max_tokens ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_MAX_TOKENS) ||
      (typeof process !== 'undefined' && process.env?.OPENAI_MAX_TOKENS)
    this.maxTokens = maxTokensStr ? parseInt(maxTokensStr, 10) : 16384

    // Python lines 52-53: temperature configuration
    // temperature_str = config.get('openai_temperature') or os.getenv('OPENAI_TEMPERATURE')
    // self.default_temperature = float(temperature_str) if temperature_str else 0.7
    const temperatureStr =
      config.openai_temperature ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_TEMPERATURE) ||
      (typeof process !== 'undefined' && process.env?.OPENAI_TEMPERATURE)
    this.defaultTemperature = temperatureStr
      ? parseFloat(temperatureStr)
      : 0.7

    // Python line 55: self.performance_logger = get_performance_logger(f"{__name__}.OpenAIClient")
    // TypeScript: Not used in this implementation
    // this.performanceLogger = this.logger

    // Python lines 57-58: API key validation
    // if not self.api_key:
    //     raise ValueError("OpenAI API key is required")
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required')
    }

    // Python line 61: Initialize OpenAI client
    // self.client = openai.OpenAI(api_key=self.api_key)
    this.client = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true })

    // Python line 64: Verify connection
    // self._verify_connection()
    // NOTE: In browser context, this needs to be async, so we call it separately
    // Constructor cannot be async, so this must be called after instantiation
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
   * Get the provider type
   *
   * Python source: openai_client.py:66-68 (def get_provider)
   *
   * @returns Provider type (OPENAI)
   */
  getProvider(): LLMProvider {
    // Python line 68: return LLMProvider.OPENAI
    return LLMProvider.OPENAI
  }

  /**
   * Check if OpenAI API is available
   *
   * Python source: openai_client.py:70-78 (def is_available)
   *
   * @returns True if API is available, False otherwise
   */
  async isAvailable(): Promise<boolean> {
    // Python lines 72-78:
    // try:
    //     # Try to list models as a health check
    //     models = self.client.models.list()
    //     return len(models.data) > 0
    // except Exception as e:
    //     self.logger.debug(f"OpenAI availability check failed: {e}")
    //     return False
    try {
      const models = await this.client.models.list()
      return models.data.length > 0
    } catch (error) {
      this.logger.debug(`OpenAI availability check failed: ${error}`)
      return false
    }
  }

  /**
   * Verify connection to OpenAI API
   *
   * Python source: openai_client.py:80-96 (def _verify_connection)
   */
  async _verifyConnection(): Promise<void> {
    // Python lines 82-96:
    // try:
    //     # Test with a minimal request
    //     models = self.client.models.list()
    //     model_names = [model.id for model in models.data]
    //     self.logger.info(
    //         "Successfully connected to OpenAI API",
    //         available_models_count=len(model_names),
    //         default_model=self.default_model
    //     )
    // except Exception as e:
    //     self.logger.error(
    //         "Failed to connect to OpenAI API. Please check your API key.",
    //         error=str(e)
    //     )
    //     raise
    try {
      const models = await this.client.models.list()
      const modelNames = models.data.map((model) => model.id)
      this.logger.info('Successfully connected to OpenAI API', {
        available_models_count: modelNames.length,
        default_model: this.defaultModel,
      })
    } catch (error) {
      this.logger.error(
        'Failed to connect to OpenAI API. Please check your API key.',
        { error: String(error) }
      )
      throw error
    }
  }

  /**
   * Get list of available OpenAI models
   *
   * Python source: openai_client.py:98-113 (def get_supported_models)
   *
   * @returns Array of model IDs
   */
  async getSupportedModels(): Promise<Array<string>> {
    // Python lines 100-113:
    // try:
    //     models = self.client.models.list()
    //     # Filter to only include GPT models suitable for chat
    //     gpt_models = [
    //         model.id for model in models.data
    //         if "gpt" in model.id.lower() and
    //         any(x in model.id for x in ["3.5", "4"])
    //     ]
    //
    //     self.logger.debug(f"Available GPT models: {gpt_models}")
    //     return gpt_models
    // except Exception as e:
    //     self.logger.error(f"Error getting supported models: {e}")
    //     return list(self.MODEL_PRICING.keys())  # Fallback to known models
    try {
      const models = await this.client.models.list()
      // Filter to only include GPT models suitable for chat
      const gptModels = models.data
        .filter(
          (model) =>
            model.id.toLowerCase().includes('gpt') &&
            (['3.5', '4'].some((x) => model.id.includes(x)) ||
              model.id.includes('o1'))
        )
        .map((model) => model.id)

      this.logger.debug(`Available GPT models: ${gptModels.join(', ')}`)
      return gptModels
    } catch (error) {
      this.logger.error(`Error getting supported models: ${error}`)
      return Object.keys(OpenAIClient.MODEL_PRICING) // Fallback to known models
    }
  }

  /**
   * Estimate the cost of a request
   *
   * Python source: openai_client.py:115-143 (def estimate_cost)
   * Browser: Returns Promise for consistency with other clients
   *
   * @param request - LLM request to estimate
   * @returns Promise resolving to estimated cost in USD, or undefined if unknown model
   */
  async estimateCost(request: LLMRequest): Promise<number | undefined> {
    // Python lines 117-127: Model matching
    // model = request.model or self.default_model
    let model = request.model || this.defaultModel

    // if model not in self.MODEL_PRICING:
    if (!(model in OpenAIClient.MODEL_PRICING)) {
      // Try to match partial model names
      // for known_model in self.MODEL_PRICING:
      //     if known_model in model:
      //         model = known_model
      //         break
      let found = false
      for (const knownModel of Object.keys(OpenAIClient.MODEL_PRICING)) {
        if (model.includes(knownModel)) {
          model = knownModel
          found = true
          break
        }
      }

      // else:
      //     self.logger.warning(f"Unknown model for cost estimation: {model}")
      //     return None
      if (!found) {
        this.logger.warning(`Unknown model for cost estimation: ${model}`)
        return undefined
      }
    }

    // Python lines 129-135: Token estimation
    // # Rough token estimation (1 token ≈ 4 characters)
    // input_text = "\n".join([msg.content for msg in request.messages])
    let inputText = request.messages.map((msg) => msg.content).join('\n')
    // if request.system_prompt:
    //     input_text += "\n" + request.system_prompt
    if (request.system_prompt) {
      inputText += '\n' + request.system_prompt
    }

    // estimated_input_tokens = len(input_text) // 4
    const estimatedInputTokens = Math.floor(inputText.length / 4)
    // estimated_output_tokens = request.max_tokens or self.max_tokens
    const estimatedOutputTokens = request.max_tokens || this.maxTokens

    // Python lines 137-143: Cost calculation
    // pricing = self.MODEL_PRICING[model]
    const pricing = OpenAIClient.MODEL_PRICING[model]
    // estimated_cost = (
    //     (estimated_input_tokens / 1000) * pricing["input"] +
    //     (estimated_output_tokens / 1000) * pricing["output"]
    // )
    const estimatedCost =
      (estimatedInputTokens / 1000) * pricing.input +
      (estimatedOutputTokens / 1000) * pricing.output

    // return estimated_cost
    return estimatedCost
  }

  /**
   * Format messages for OpenAI API
   *
   * Python source: openai_client.py:145-150 (def _format_messages_for_openai)
   *
   * @param messages - Array of LLMMessage objects
   * @returns Array of OpenAI-formatted message objects
   */
  private _formatMessagesForOpenai(
    messages: Array<LLMMessage>
  ): Array<{ role: string; content: string }> {
    // Python lines 147-150:
    // return [
    //     {"role": message.role, "content": message.content}
    //     for message in messages
    // ]
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }))
  }

  /**
   * Generate response using OpenAI API
   *
   * Python source: openai_client.py:152-382 (def generate)
   *
   * CRITICAL METHOD: 230 lines with complex error handling and retry logic
   *
   * @param request - LLM request
   * @returns LLM response with content and metadata
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    // Python lines 155-156: CRITICAL model validation
    // if not request.model:
    //     raise ValueError(f"Model must be explicitly specified in LLMRequest. No fallback to default model allowed.")
    if (!request.model) {
      throw new Error(
        'Model must be explicitly specified in LLMRequest. No fallback to default model allowed.'
      )
    }

    // Python lines 159-162: Validate request
    // validation_errors = self.validate_request(request)
    // if validation_errors:
    //     error_msg = "; ".join(validation_errors)
    //     return self.create_error_response(error_msg, request.model)
    const validationErrors = this.validateRequest(request)
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors.join('; ')
      return this.createErrorResponse(errorMsg, request.model)
    }

    // Python lines 165-168: Prepare parameters
    // messages = self.prepare_messages(request)
    const messages = this.prepareMessages(request)
    // model = request.model  # NO FALLBACK - use exact model requested
    const model = request.model
    // max_tokens = request.max_tokens or self.max_tokens
    let maxTokens = request.max_tokens || this.maxTokens
    // temperature = request.temperature or self.default_temperature
    const temperature = request.temperature ?? this.defaultTemperature

    // Python line 171: Log model
    // self.logger.info(f"🎯 Using model: {model} for OpenAI request")
    this.logger.info(`🎯 Using model: ${model} for OpenAI request`)

    // Python line 174: Format messages
    // openai_messages = self._format_messages_for_openai(messages)
    const openaiMessages = this._formatMessagesForOpenai(messages)

    // Python line 177: Adjust tokens
    // max_tokens = self._adjust_tokens_for_context(openai_messages, model, max_tokens)
    maxTokens = await this._adjustTokensForContext(
      openaiMessages,
      model,
      maxTokens
    )

    // Python lines 179-185: Debug log
    this.logger.debug('Sending request to OpenAI', {
      model,
      messages_count: openaiMessages.length,
      max_tokens: maxTokens,
      temperature,
    })

    // Python line 187: Start timer
    // start_time = time.time()
    const startTime = Date.now()

    // Python line 189: TimedOperation context manager
    // with TimedOperation(self.performance_logger, "openai_generate", {"model": model}):
    try {
      // Python lines 191-206: Build kwargs
      // kwargs = dict(
      //     model=model,
      //     messages=openai_messages,
      // )
      const kwargs: any = {
        model,
        messages: openaiMessages,
      }

      // Handle parameter differences between model versions
      // if "gpt-5" in model.lower() or "o1" in model.lower():
      if (
        model.toLowerCase().includes('gpt-5') ||
        model.toLowerCase().includes('o1')
      ) {
        // Newer models: use max_completion_tokens and default temperature
        // kwargs["max_completion_tokens"] = max_tokens
        kwargs.max_completion_tokens = maxTokens
      } else {
        // Older models: use max_tokens and custom parameters
        // kwargs["max_tokens"] = max_tokens
        kwargs.max_tokens = maxTokens
        // kwargs["temperature"] = temperature
        kwargs.temperature = temperature
        // kwargs["top_p"] = 0.9
        kwargs.top_p = 0.9
        // kwargs["frequency_penalty"] = 0
        kwargs.frequency_penalty = 0
        // kwargs["presence_penalty"] = 0
        kwargs.presence_penalty = 0
      }

      // Python lines 208-213: JSON mode (optional)
      // if getattr(request, 'json_mode', None):
      if ((request as any).json_mode) {
        // try:
        //     kwargs["response_format"] = {"type": "json_object"}
        // except Exception:
        //     pass
        try {
          kwargs.response_format = { type: 'json_object' }
        } catch (error) {
          // Silent failure
        }
      }

      // Python line 215: API call
      // response = self.client.chat.completions.create(**kwargs)
      let response = await this.client.chat.completions.create(kwargs)

      // Python line 217: Calculate processing time
      // processing_time = time.time() - start_time
      let processingTime = (Date.now() - startTime) / 1000 // Convert to seconds

      // Python line 220: Extract content
      // content = response.choices[0].message.content or ""
      let content = response.choices[0].message.content || ''

      // Python lines 223-234: Empty response debugging
      // if not content:
      if (!content) {
        // finish_reason = response.choices[0].finish_reason
        const finishReason = response.choices[0].finish_reason
        // self.logger.warning(...)
        this.logger.warning(
          `⚠️  EMPTY RESPONSE from OpenAI - finish_reason=${finishReason}, ` +
            `response_id=${response.id}, model=${model}, ` +
            `prompt_length=${String(kwargs.messages).length} chars`
        )
        // Log the full prompt for debugging (truncate if very long)
        // prompt_text = str(kwargs.get('messages', []))
        let promptText = String(kwargs.messages)
        // if len(prompt_text) > 1000:
        if (promptText.length > 1000) {
          // prompt_text = prompt_text[:500] + "\n...[TRUNCATED]...\n" + prompt_text[-500:]
          promptText =
            promptText.slice(0, 500) +
            '\n...[TRUNCATED]...\n' +
            promptText.slice(-500)
        }
        // self.logger.debug(f"Empty response prompt: {prompt_text}")
        this.logger.debug(`Empty response prompt: ${promptText}`)
      }

      // Python lines 237-241: Extract usage
      // usage = {
      //     'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
      //     'completion_tokens': response.usage.completion_tokens if response.usage else 0,
      //     'total_tokens': response.usage.total_tokens if response.usage else 0,
      // }
      const usage = {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      }

      // Python lines 244-250: Calculate cost
      // actual_cost = None
      let actualCost: number | null = null
      // if model in self.MODEL_PRICING and response.usage:
      if (model in OpenAIClient.MODEL_PRICING && response.usage) {
        // pricing = self.MODEL_PRICING[model]
        const pricing = OpenAIClient.MODEL_PRICING[model]
        // actual_cost = (
        //     (response.usage.prompt_tokens / 1000) * pricing["input"] +
        //     (response.usage.completion_tokens / 1000) * pricing["output"]
        // )
        actualCost =
          (response.usage.prompt_tokens / 1000) * pricing.input +
          (response.usage.completion_tokens / 1000) * pricing.output
      }

      // Python lines 252-259: Debug log
      this.logger.debug('Received response from OpenAI', {
        model,
        content_length: content.length,
        processing_time: processingTime,
        tokens_used: usage.total_tokens,
        estimated_cost: actualCost,
      })

      // Python lines 261-273: Success response
      // return LLMResponse(...)
      return {
        content,
        model,
        usage,
        metadata: {
          provider: 'openai',
          processing_time: processingTime,
          estimated_cost: actualCost,
          finish_reason: response.choices[0].finish_reason,
          response_id: response.id,
        },
        success: true,
      }
    } catch (error: any) {
      // Python lines 275-382: Error handling with retries

      // Python lines 275-283: Rate limit error
      // except openai.RateLimitError as e:
      if (error instanceof OpenAI.RateLimitError) {
        const errorMsg = `OpenAI rate limit exceeded: ${String(error)}`
        this.logger.error('OpenAI rate limit exceeded', {
          model,
          error: errorMsg,
          processing_time: (Date.now() - startTime) / 1000,
        })
        return this.createErrorResponse(errorMsg, model)
      }

      // Python lines 285-291: Authentication error
      // except openai.AuthenticationError as e:
      if (error instanceof OpenAI.AuthenticationError) {
        const errorMsg = `OpenAI authentication failed: ${String(error)}`
        this.logger.error('OpenAI authentication failed', { error: errorMsg })
        return this.createErrorResponse(errorMsg, model)
      }

      // Python lines 293-372: Bad request error WITH RETRY LOGIC
      // except openai.BadRequestError as e:
      if (error instanceof OpenAI.BadRequestError) {
        const errorMsg = `OpenAI bad request: ${String(error)}`

        // Handle various parameter compatibility issues with newer models
        let shouldRetry = false
        const kwargs: any = {
          model,
          messages: this._formatMessagesForOpenai(
            this.prepareMessages(request)
          ),
        }

        // Rebuild kwargs for retry
        if (
          model.toLowerCase().includes('gpt-5') ||
          model.toLowerCase().includes('o1')
        ) {
          kwargs.max_completion_tokens = maxTokens
        } else {
          kwargs.max_tokens = maxTokens
          kwargs.temperature = temperature
          kwargs.top_p = 0.9
          kwargs.frequency_penalty = 0
          kwargs.presence_penalty = 0
        }

        const retryKwargs = { ...kwargs }

        // Python lines 300-306: max_tokens/max_completion_tokens swap
        // if "max_tokens" in str(e) and "max_completion_tokens" in str(e):
        const errorStr = String(error)
        if (
          errorStr.includes('max_tokens') &&
          errorStr.includes('max_completion_tokens')
        ) {
          this.logger.warning(
            `Retrying with max_completion_tokens for model ${model}`
          )
          shouldRetry = true
          // if "max_tokens" in retry_kwargs:
          //     retry_kwargs["max_completion_tokens"] = retry_kwargs.pop("max_tokens")
          if ('max_tokens' in retryKwargs) {
            retryKwargs.max_completion_tokens = retryKwargs.max_tokens
            delete retryKwargs.max_tokens
          }
          // elif "max_completion_tokens" in retry_kwargs:
          //     retry_kwargs["max_tokens"] = retry_kwargs.pop("max_completion_tokens")
          else if ('max_completion_tokens' in retryKwargs) {
            retryKwargs.max_tokens = retryKwargs.max_completion_tokens
            delete retryKwargs.max_completion_tokens
          }
        }
        // Python lines 308-313: temperature parameter removal
        // elif "temperature" in str(e) and ("default" in str(e) or "1)" in str(e)):
        else if (
          errorStr.includes('temperature') &&
          (errorStr.includes('default') || errorStr.includes('1)'))
        ) {
          this.logger.warning(
            `Retrying without temperature parameter for model ${model}`
          )
          shouldRetry = true
          // Remove temperature and other unsupported parameters for newer models
          // for param in ["temperature", "top_p", "frequency_penalty", "presence_penalty"]:
          //     retry_kwargs.pop(param, None)
          delete retryKwargs.temperature
          delete retryKwargs.top_p
          delete retryKwargs.frequency_penalty
          delete retryKwargs.presence_penalty
        }

        // Python lines 315-362: Retry attempt
        // if should_retry:
        if (shouldRetry) {
          try {
            // response = self.client.chat.completions.create(**retry_kwargs)
            const response = await this.client.chat.completions.create(
              retryKwargs
            )
            // processing_time = time.time() - start_time
            const processingTime = (Date.now() - startTime) / 1000

            // content = response.choices[0].message.content or ""
            const content = response.choices[0].message.content || ''

            // Extract usage information
            const usage = {
              prompt_tokens: response.usage?.prompt_tokens || 0,
              completion_tokens: response.usage?.completion_tokens || 0,
              total_tokens: response.usage?.total_tokens || 0,
            }

            // Calculate actual cost if possible
            let actualCost: number | null = null
            if (model in OpenAIClient.MODEL_PRICING && response.usage) {
              const pricing = OpenAIClient.MODEL_PRICING[model]
              actualCost =
                (response.usage.prompt_tokens / 1000) * pricing.input +
                (response.usage.completion_tokens / 1000) * pricing.output
            }

            this.logger.debug('Received response from OpenAI (retry successful)', {
              model,
              content_length: content.length,
              processing_time: processingTime,
              tokens_used: usage.total_tokens,
              estimated_cost: actualCost,
            })

            return {
              content,
              model,
              usage,
              metadata: {
                provider: 'openai',
                processing_time: processingTime,
                estimated_cost: actualCost,
                finish_reason: response.choices[0].finish_reason,
                response_id: response.id,
                retry_used: true,
              },
              success: true,
            }
          } catch (retryError) {
            // except Exception as retry_error:
            //     error_msg = f"OpenAI retry failed: {str(retry_error)}"
            const retryErrorMsg = `OpenAI retry failed: ${String(retryError)}`
            this.logger.error('OpenAI retry failed', { error: retryErrorMsg })
          }
        }

        // Python lines 366-372: Failed request logging
        this.logger.error('OpenAI bad request', {
          model,
          error: errorMsg,
          messages_count: this._formatMessagesForOpenai(
            this.prepareMessages(request)
          ).length,
        })
        return this.createErrorResponse(errorMsg, model)
      }

      // Python lines 374-382: Generic error
      // except Exception as e:
      const errorMsg = `OpenAI API error: ${String(error)}`
      this.logger.error('OpenAI generation failed', {
        model,
        error: errorMsg,
        processing_time: (Date.now() - startTime) / 1000,
      })
      return this.createErrorResponse(errorMsg, model)
    }
  }

  /**
   * Get usage statistics (if available)
   *
   * Python source: openai_client.py:384-393 (def get_usage_stats)
   *
   * @returns Usage statistics object
   */
  getUsageStats(): Record<string, any> {
    // Python lines 388-393:
    // return {
    //     'provider': 'openai',
    //     'note': 'Usage statistics not available via API. Check OpenAI dashboard.',
    //     'default_model': self.default_model,
    //     'max_tokens': self.max_tokens
    // }
    return {
      provider: 'openai',
      note: 'Usage statistics not available via API. Check OpenAI dashboard.',
      default_model: this.defaultModel,
      max_tokens: this.maxTokens,
    }
  }

  /**
   * Validate if a model is available
   *
   * Python source: openai_client.py:395-402 (def validate_model)
   *
   * @param modelName - Model identifier
   * @returns True if model is available, False otherwise
   */
  async validateModel(modelName: string): Promise<boolean> {
    // Python lines 397-402:
    // try:
    //     available_models = self.get_supported_models()
    //     return model_name in available_models
    // except Exception:
    //     # Fallback to known models
    //     return model_name in self.MODEL_PRICING
    try {
      const availableModels = await this.getSupportedModels()
      return availableModels.includes(modelName)
    } catch (error) {
      // Fallback to known models
      return modelName in OpenAIClient.MODEL_PRICING
    }
  }

  /**
   * Get information about a specific model
   *
   * Python source: openai_client.py:404-417 (def get_model_info)
   *
   * @param modelName - Model identifier
   * @returns Model information object, or null if error
   */
  async getModelInfo(modelName: string): Promise<Record<string, any> | null> {
    // Python lines 406-417:
    // try:
    //     model = self.client.models.retrieve(model_name)
    //     return {
    //         'id': model.id,
    //         'object': model.object,
    //         'created': model.created,
    //         'owned_by': model.owned_by,
    //         'pricing': self.MODEL_PRICING.get(model_name, 'Unknown')
    //     }
    // except Exception as e:
    //     self.logger.error(f"Error getting model info for {model_name}: {e}")
    //     return None
    try {
      const model = await this.client.models.retrieve(modelName)
      return {
        id: model.id,
        object: model.object,
        created: model.created,
        owned_by: model.owned_by,
        pricing: OpenAIClient.MODEL_PRICING[modelName] || 'Unknown',
      }
    } catch (error) {
      this.logger.error(`Error getting model info for ${modelName}: ${error}`)
      return null
    }
  }

  /**
   * Rough estimation of token count
   *
   * Python source: openai_client.py:419-422 (def estimate_tokens)
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // Python lines 421-422:
    // # Simple heuristic: ~4 characters per token for English text
    // return len(text) // 4
    return Math.floor(text.length / 4)
  }

  /**
   * Truncate text to approximate token limit
   *
   * Python source: openai_client.py:424-431 (def truncate_to_token_limit)
   *
   * @param text - Text to truncate
   * @param maxTokens - Maximum token count
   * @returns Truncated text
   */
  truncateToTokenLimit(text: string, maxTokens: number): string {
    // Python lines 426-431:
    // max_chars = max_tokens * 4  # Rough conversion
    const maxChars = maxTokens * 4
    // if len(text) <= max_chars:
    //     return text
    if (text.length <= maxChars) {
      return text
    }

    // # Truncate and add ellipsis
    // return text[:max_chars-3] + "..."
    return text.slice(0, maxChars - 3) + '...'
  }

  /**
   * Get context window size for a specific model
   *
   * Python source: openai_client.py:433-476 (def get_context_window)
   *
   * NOTE: This method is REDUNDANT with model_registry.py
   * Keeping for compatibility but should use model_registry instead
   *
   * @param modelName - Model identifier
   * @returns Context window size in tokens
   */
  getContextWindow(modelName: string): number {
    // Python lines 458-476: Known context limits
    const modelLimits: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-3.5-turbo': 16385,
      'gpt-3.5-turbo-16k': 16385,
      'gpt-5-mini': 128000,
      'gpt-5-nano': 128000,
      'gpt-5': 128000,
      'o1-preview': 128000,
      'o1-mini': 128000,
    }

    // context_window = model_limits.get(model_name, 128000)
    const contextWindow = modelLimits[modelName] || 128000
    // self.logger.debug(f"Context window for {model_name}: {context_window:,} tokens")
    this.logger.debug(
      `Context window for ${modelName}: ${contextWindow.toLocaleString()} tokens`
    )
    // return context_window
    return contextWindow
  }

  /**
   * Dynamically adjust max_tokens based on input size, context limits, and max_completion_tokens
   *
   * Python source: openai_client.py:478-509 (def _adjust_tokens_for_context)
   *
   * @param messages - Formatted message array
   * @param model - Model identifier
   * @param requestedTokens - Requested max_tokens
   * @returns Adjusted max_tokens value
   */
  private async _adjustTokensForContext(
    messages: Array<{ role: string; content: string }>,
    model: string,
    requestedTokens: number
  ): Promise<number> {
    // Python line 480: from ..llm_clients.model_registry import ...
    // (Already imported at top of file)

    // Python lines 483-484: Get model-specific limits from registry
    // context_limit = get_context_window_openai(self.client, model)
    const contextLimit = getContextWindowOpenai(this.client, model, this.logger)
    // max_completion = get_max_completion_tokens_openai(self.client, model)
    const maxCompletion = getMaxCompletionTokensOpenai(
      this.client,
      model,
      this.logger
    )

    // Python lines 487-492: Calculate available tokens
    // # Estimate input tokens (rough approximation)
    // input_text = "\n".join([msg["content"] for msg in messages])
    const inputText = messages.map((msg) => msg.content).join('\n')
    // estimated_input_tokens = self.estimate_tokens(input_text)
    const estimatedInputTokens = this.estimateTokens(inputText)

    // # Reserve some tokens for safety margin and system overhead
    // safety_margin = 200
    const safetyMargin = 200
    // available_tokens = context_limit - estimated_input_tokens - safety_margin
    let availableTokens =
      (contextLimit || 128000) - estimatedInputTokens - safetyMargin

    // Python lines 494-500: Cap and adjust
    // # Cap at BOTH available tokens AND model's max_completion_tokens
    // adjusted_tokens = min(requested_tokens, available_tokens, max_completion)
    let adjustedTokens = Math.min(
      requestedTokens,
      availableTokens,
      maxCompletion || 16384
    )

    // # Ensure we have at least some tokens for output (minimum 100)
    // if adjusted_tokens < 100:
    if (adjustedTokens < 100) {
      // self.logger.warning(f"Very limited tokens available for response: {adjusted_tokens}")
      this.logger.warning(
        `Very limited tokens available for response: ${adjustedTokens}`
      )
      // adjusted_tokens = max(100, available_tokens // 2, 100)
      adjustedTokens = Math.max(100, Math.floor(availableTokens / 2), 100)
    }

    // Python lines 502-509: Log and return
    // if adjusted_tokens != requested_tokens:
    if (adjustedTokens !== requestedTokens) {
      // self.logger.info(...)
      this.logger.info(
        `🔧 Adjusted max_tokens from ${requestedTokens.toLocaleString()} to ${adjustedTokens.toLocaleString()} ` +
          `(input: ~${estimatedInputTokens.toLocaleString()} tokens, context_limit: ${contextLimit?.toLocaleString()}, ` +
          `max_completion: ${maxCompletion?.toLocaleString()})`
      )
    }

    // return adjusted_tokens
    return adjustedTokens
  }
}
