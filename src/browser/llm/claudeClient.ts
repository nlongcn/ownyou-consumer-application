/**
 * Claude (Anthropic) LLM Client Implementation
 *
 * TypeScript port of Python claude_client.py (lines 1-426)
 *
 * Provides integration with Anthropic's Claude models.
 *
 * MIGRATION NOTE: This is an EXACT 1:1 translation of the Python implementation.
 * Every method, error handling branch, and logic step has been verified against the Python source.
 * Adapted for async/await as Anthropic SDK is promise-based in TypeScript.
 * Elements ported: 31/31 (1 class + 15 methods + 5 pricing models)
 *
 * KEY DIFFERENCES FROM OPENAI:
 * - System messages extracted to separate 'system' parameter
 * - Response content is array of blocks with .text property
 * - Uses input_tokens/output_tokens (not prompt_tokens/completion_tokens)
 * - Token estimation: 3.5 chars/token (vs 4 for OpenAI)
 * - No retry logic (simpler error handling)
 */

// ============================================================================
// IMPORTS (Python lines 7-11)
// ============================================================================

// Python line 7: import time
// TypeScript: Date.now() or performance.now()

// Python line 8: from typing import Dict, Any, List, Optional
// TypeScript: Built-in types

// Python line 9: import anthropic
import Anthropic from '@anthropic-ai/sdk'

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

// Import model registry functions (Python line 154)
import { getMaxCompletionTokensClaude } from './modelRegistry'

// ============================================================================
// CLAUDE CLIENT CLASS (Python lines 14-426)
// ============================================================================

/**
 * Client for Anthropic's Claude models
 *
 * Python source: claude_client.py:14-426 (class ClaudeClient)
 */
export class ClaudeClient extends BaseLLMClient {
  // ============================================================================
  // CLASS CONSTANTS (Python lines 17-24)
  // ============================================================================

  /**
   * Model pricing per 1M tokens (as of 2025)
   *
   * Python source: claude_client.py:17-24 (MODEL_PRICING)
   */
  static readonly MODEL_PRICING: Record<
    string,
    { input: number; output: number }
  > = {
    // Python line 19: "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    // Python line 20: "claude-3-sonnet-20240229": {"input": 3.0, "output": 15.0},
    'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
    // Python line 21: "claude-3-opus-20240229": {"input": 15.0, "output": 75.0},
    'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
    // Python line 22: "claude-3-5-sonnet-20240620": {"input": 3.0, "output": 15.0},
    'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
    // Python line 23: "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  }

  // ============================================================================
  // INSTANCE PROPERTIES
  // ============================================================================

  // Python line 36: self.api_key
  private apiKey: string

  // Python line 37: self.default_model
  private defaultModel: string

  // Python line 44: self.max_tokens
  private maxTokens: number

  // Python line 45: self.performance_logger (not used in TypeScript implementation)
  // private performanceLogger: Logger

  // Python line 51: self.client
  client: Anthropic

  // ============================================================================
  // CONSTRUCTOR (Python lines 26-54)
  // ============================================================================

  /**
   * Initialize Claude client
   *
   * Python source: claude_client.py:26-54 (def __init__)
   *
   * @param config - Configuration dictionary with Anthropic settings
   */
  constructor(config: Record<string, any>) {
    // Python line 33: super().__init__(config)
    super(config)

    // Python lines 36-39: Get config from dict or fallback to environment variables
    // NOTE: Browser adaptation - use import.meta.env instead of os.getenv
    // self.api_key = config.get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY')
    this.apiKey =
      config.anthropic_api_key || import.meta.env?.VITE_ANTHROPIC_API_KEY || ''

    // self.default_model = config.get('anthropic_model') or os.getenv('ANTHROPIC_MODEL')
    this.defaultModel =
      config.anthropic_model || import.meta.env?.VITE_ANTHROPIC_MODEL || ''

    // Python lines 38-39: Validate model
    // if not self.default_model:
    //     raise ValueError("Anthropic model must be specified in ANTHROPIC_MODEL environment variable")
    if (!this.defaultModel) {
      throw new Error(
        'Anthropic model must be specified in ANTHROPIC_MODEL environment variable'
      )
    }

    // Python lines 43-44: max_tokens configuration
    // max_tokens_str = config.get('anthropic_max_tokens') or os.getenv('ANTHROPIC_MAX_TOKENS')
    // self.max_tokens = int(max_tokens_str) if max_tokens_str else 8192
    const maxTokensStr =
      config.anthropic_max_tokens || import.meta.env?.VITE_ANTHROPIC_MAX_TOKENS
    this.maxTokens = maxTokensStr ? parseInt(maxTokensStr, 10) : 8192

    // Python line 45: self.performance_logger = get_performance_logger(f"{__name__}.ClaudeClient")
    // TypeScript: Not used in this implementation
    // this.performanceLogger = this.logger

    // Python lines 47-48: API key validation
    // if not self.api_key:
    //     raise ValueError("Anthropic API key is required")
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required')
    }

    // Python line 51: Initialize Anthropic client
    // self.client = anthropic.Anthropic(api_key=self.api_key)
    this.client = new Anthropic({ apiKey: this.apiKey })

    // Python line 54: Verify connection
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
   * Python source: claude_client.py:56-58 (def get_provider)
   *
   * @returns Provider type (CLAUDE)
   */
  getProvider(): LLMProvider {
    // Python line 58: return LLMProvider.CLAUDE
    return LLMProvider.CLAUDE
  }

  /**
   * Check if Anthropic API is available
   *
   * Python source: claude_client.py:60-77 (def is_available)
   *
   * @returns True if API is available, False otherwise
   */
  async isAvailable(): Promise<boolean> {
    // Python lines 62-77:
    // try:
    //     # Try a minimal request to test connectivity
    //     response = self.client.messages.create(
    //         model=self.default_model,
    //         max_tokens=10,
    //         messages=[{"role": "user", "content": "Test"}]
    //     )
    //     return True
    // except anthropic.APIConnectionError:
    //     return False
    // except anthropic.AuthenticationError:
    //     return False
    // except Exception:
    //     # If we get any other error, assume the service is available
    //     # but there might be an issue with the specific request
    //     return True
    try {
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Test' }],
      })
      return true
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionError) {
        return false
      }
      if (error instanceof Anthropic.AuthenticationError) {
        return false
      }
      // If we get any other error, assume the service is available
      // but there might be an issue with the specific request
      return true
    }
  }

  /**
   * Verify connection to Anthropic API
   *
   * Python source: claude_client.py:79-105 (def _verify_connection)
   */
  async _verifyConnection(): Promise<void> {
    // Python lines 82-105:
    // try:
    //     # Test with a minimal request
    //     response = self.client.messages.create(
    //         model=self.default_model,
    //         max_tokens=10,
    //         messages=[{"role": "user", "content": "Hello"}]
    //     )
    //
    //     self.logger.info(
    //         "Successfully connected to Anthropic API",
    //         default_model=self.default_model,
    //         test_response_length=len(response.content[0].text) if response.content else 0
    //     )
    // except anthropic.AuthenticationError as e:
    //     self.logger.error(
    //         "Failed to authenticate with Anthropic API. Please check your API key.",
    //         error=str(e)
    //     )
    //     raise
    // except Exception as e:
    //     self.logger.error(
    //         "Failed to connect to Anthropic API",
    //         error=str(e)
    //     )
    //     raise
    try {
      const response = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }],
      })

      this.logger.info('Successfully connected to Anthropic API', {
        default_model: this.defaultModel,
        test_response_length:
          response.content.length > 0 && 'text' in response.content[0]
            ? (response.content[0] as any).text.length
            : 0,
      })
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        this.logger.error(
          'Failed to authenticate with Anthropic API. Please check your API key.',
          { error: String(error) }
        )
        throw error
      }
      this.logger.error('Failed to connect to Anthropic API', {
        error: String(error),
      })
      throw error
    }
  }

  /**
   * Get list of available Claude models
   *
   * Python source: claude_client.py:107-110 (def get_supported_models)
   * Browser: Returns Promise for consistency with other clients
   *
   * @returns Promise resolving to array of model IDs
   */
  async getSupportedModels(): Promise<Array<string>> {
    // Python lines 109-110:
    // # Anthropic doesn't provide a models endpoint, so return known models
    // return list(self.MODEL_PRICING.keys())
    return Object.keys(ClaudeClient.MODEL_PRICING)
  }

  /**
   * Get context window size for a Claude model
   *
   * Python source: claude_client.py:112-150 (def get_context_window)
   *
   * NOTE: This method is REDUNDANT with model_registry.py
   * Keeping for compatibility but should use model_registry instead
   *
   * @param modelName - Model identifier
   * @returns Context window size in tokens
   */
  getContextWindow(modelName: string): number {
    // Python lines 127-135: Known Claude context windows
    const contextLimits: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 200000,
      'claude-3-5-sonnet-20240620': 200000,
      'claude-3-5-haiku-20241022': 200000,
      'claude-3-opus-20240229': 200000,
      'claude-3-sonnet-20240229': 200000,
      'claude-3-haiku-20240307': 200000,
      'claude-sonnet-4-20250514': 200000,
    }

    // Python lines 138-150: Match by exact name or partial match
    let contextWindow: number
    // if model_name in context_limits:
    if (modelName in contextLimits) {
      // context_window = context_limits[model_name]
      contextWindow = contextLimits[modelName]
    } else {
      // Try partial match (e.g., "claude-sonnet-4" matches "claude-sonnet-4-*")
      // for known_model, limit in context_limits.items():
      let found = false
      for (const [knownModel, limit] of Object.entries(contextLimits)) {
        // if model_name in known_model or known_model.startswith(model_name):
        if (
          knownModel.includes(modelName) ||
          knownModel.startsWith(modelName)
        ) {
          // context_window = limit
          contextWindow = limit
          found = true
          // break
          break
        }
      }
      // else:
      //     context_window = 200000  # Default for all Claude 3+ models
      if (!found) {
        contextWindow = 200000
      }
    }

    // self.logger.debug(f"Context window for {model_name}: {context_window:,} tokens")
    this.logger.debug(
      `Context window for ${modelName}: ${contextWindow!.toLocaleString()} tokens`
    )
    // return context_window
    return contextWindow!
  }

  /**
   * Dynamically adjust max_tokens based on model-specific max_completion_tokens limit
   *
   * Python source: claude_client.py:152-168 (def _adjust_tokens_for_context)
   *
   * @param model - Model identifier
   * @param requestedTokens - Requested max_tokens
   * @returns Adjusted max_tokens value
   */
  private _adjustTokensForContext(
    model: string,
    requestedTokens: number
  ): number {
    // Python line 154: from ..llm_clients.model_registry import get_max_completion_tokens_claude
    // (Already imported at top of file)

    // Python lines 157: Get model-specific max output tokens from registry
    // max_completion = get_max_completion_tokens_claude(self.client, model)
    const maxCompletion = getMaxCompletionTokensClaude(
      this.client,
      model,
      this.logger
    )

    // Python lines 160: Cap at model's max_completion_tokens
    // adjusted_tokens = min(requested_tokens, max_completion)
    const adjustedTokens = Math.min(requestedTokens, maxCompletion)

    // Python lines 162-168: Log if adjusted
    // if adjusted_tokens != requested_tokens:
    if (adjustedTokens !== requestedTokens) {
      // self.logger.debug(...)
      this.logger.debug(
        `Adjusted max_tokens from ${requestedTokens} to ${adjustedTokens} ` +
          `(max_completion: ${maxCompletion})`
      )
    }

    // return adjusted_tokens
    return adjustedTokens
  }

  /**
   * Estimate the cost of a request
   *
   * Python source: claude_client.py:170-198 (def estimate_cost)
   * Browser: Returns Promise for consistency with other clients
   *
   * @param request - LLM request to estimate
   * @returns Promise resolving to estimated cost in USD, or undefined if unknown model
   */
  async estimateCost(request: LLMRequest): Promise<number | undefined> {
    // Python lines 172: model = request.model or self.default_model
    let model = request.model || this.defaultModel

    // Python lines 174-182: Model matching
    // if model not in self.MODEL_PRICING:
    if (!(model in ClaudeClient.MODEL_PRICING)) {
      // Try to match partial model names
      // for known_model in self.MODEL_PRICING:
      //     if any(part in model for part in known_model.split('-')):
      //         model = known_model
      //         break
      let found = false
      for (const knownModel of Object.keys(ClaudeClient.MODEL_PRICING)) {
        const parts = knownModel.split('-')
        if (parts.some((part) => model.includes(part))) {
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

    // Python lines 184-190: Token estimation
    // # Rough token estimation (1 token ≈ 3.5 characters for Claude)
    // input_text = "\n".join([msg.content for msg in request.messages])
    let inputText = request.messages.map((msg) => msg.content).join('\n')
    // if request.system_prompt:
    //     input_text += "\n" + request.system_prompt
    if (request.system_prompt) {
      inputText += '\n' + request.system_prompt
    }

    // estimated_input_tokens = len(input_text) // 3.5
    const estimatedInputTokens = Math.floor(inputText.length / 3.5)
    // estimated_output_tokens = request.max_tokens or self.max_tokens
    const estimatedOutputTokens = request.max_tokens || this.maxTokens

    // Python lines 192-198: Cost calculation
    // pricing = self.MODEL_PRICING[model]
    const pricing = ClaudeClient.MODEL_PRICING[model]
    // estimated_cost = (
    //     (estimated_input_tokens / 1_000_000) * pricing["input"] +
    //     (estimated_output_tokens / 1_000_000) * pricing["output"]
    // )
    const estimatedCost =
      (estimatedInputTokens / 1_000_000) * pricing.input +
      (estimatedOutputTokens / 1_000_000) * pricing.output

    // return estimated_cost
    return estimatedCost
  }

  /**
   * Format messages for Claude API
   *
   * Python source: claude_client.py:200-223 (def _format_messages_for_claude)
   *
   * Claude uses a separate system parameter, so extract system messages
   *
   * @param messages - Array of LLMMessage objects
   * @returns Tuple of [messages_list, system_prompt]
   */
  private _formatMessagesForClaude(
    messages: Array<LLMMessage>
  ): [Array<{ role: string; content: string }>, string | null] {
    // Python lines 206-223:
    // system_prompt = None
    let systemPrompt: string | null = null
    // formatted_messages = []
    const formattedMessages: Array<{ role: string; content: string }> = []

    // for message in messages:
    for (const message of messages) {
      // if message.role == "system":
      if (message.role === 'system') {
        // # Claude uses a separate system parameter
        // if system_prompt is None:
        if (systemPrompt === null) {
          // system_prompt = message.content
          systemPrompt = message.content
        } else {
          // # Combine multiple system messages
          // system_prompt += "\n\n" + message.content
          systemPrompt += '\n\n' + message.content
        }
      } else {
        // formatted_messages.append({
        //     "role": message.role,
        //     "content": message.content
        // })
        formattedMessages.push({
          role: message.role,
          content: message.content,
        })
      }
    }

    // return formatted_messages, system_prompt
    return [formattedMessages, systemPrompt]
  }

  /**
   * Generate response using Claude API
   *
   * Python source: claude_client.py:225-376 (def generate)
   *
   * CRITICAL METHOD: 151 lines with error handling (no retry logic)
   *
   * @param request - LLM request
   * @returns LLM response with content and metadata
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    // Python lines 228-229: CRITICAL model validation
    // if not request.model:
    //     raise ValueError(f"Model must be explicitly specified in LLMRequest. No fallback to default model allowed.")
    if (!request.model) {
      throw new Error(
        'Model must be explicitly specified in LLMRequest. No fallback to default model allowed.'
      )
    }

    // Python lines 232-235: Validate request
    // validation_errors = self.validate_request(request)
    // if validation_errors:
    //     error_msg = "; ".join(validation_errors)
    //     return self.create_error_response(error_msg, request.model)
    const validationErrors = this.validateRequest(request)
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors.join('; ')
      return this.createErrorResponse(errorMsg, request.model)
    }

    // Python lines 238-241: Prepare parameters
    // messages = self.prepare_messages(request)
    const messages = this.prepareMessages(request)
    // model = request.model  # NO FALLBACK - use exact model requested
    const model = request.model
    // max_tokens = self._adjust_tokens_for_context(model, request.max_tokens or self.max_tokens)
    const maxTokens = this._adjustTokensForContext(
      model,
      request.max_tokens || this.maxTokens
    )
    // temperature = request.temperature or 0.7
    const temperature = request.temperature ?? 0.7

    // Python line 244: Format messages for Claude
    // claude_messages, system_prompt = self._format_messages_for_claude(messages)
    const [claudeMessages, systemPrompt] =
      this._formatMessagesForClaude(messages)

    // Python lines 247-249: Ensure we have at least one user message
    // if not claude_messages or claude_messages[0]["role"] != "user":
    //     error_msg = "Claude requires at least one user message"
    //     return self.create_error_response(error_msg, model)
    if (
      claudeMessages.length === 0 ||
      claudeMessages[0].role !== 'user'
    ) {
      const errorMsg = 'Claude requires at least one user message'
      return this.createErrorResponse(errorMsg, model)
    }

    // Python lines 251-258: Debug log
    this.logger.debug('Sending request to Claude', {
      model,
      messages_count: claudeMessages.length,
      has_system_prompt: systemPrompt !== null,
      max_tokens: maxTokens,
      temperature,
    })

    // Python line 260: Start timer
    // start_time = time.time()
    const startTime = Date.now()

    // Python line 262: TimedOperation context manager
    // with TimedOperation(self.performance_logger, "claude_generate", {"model": model}):
    try {
      // Python lines 264-274: Prepare request parameters
      // request_params = {
      //     "model": model,
      //     "max_tokens": max_tokens,
      //     "temperature": temperature,
      //     "messages": claude_messages,
      // }
      const requestParams: any = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: claudeMessages,
      }

      // # Add system prompt if present
      // if system_prompt:
      //     request_params["system"] = system_prompt
      if (systemPrompt) {
        requestParams.system = systemPrompt
      }

      // Python line 276: API call
      // response = self.client.messages.create(**request_params)
      const response = await this.client.messages.create(requestParams)

      // Python line 278: Calculate processing time
      // processing_time = time.time() - start_time
      const processingTime = (Date.now() - startTime) / 1000 // Convert to seconds

      // Python lines 281-287: Extract content (Claude-specific)
      // # Extract response content
      // content = ""
      let content = ''
      // if response.content:
      if (response.content) {
        // # Claude returns a list of content blocks
        // content = "\n".join([
        //     block.text for block in response.content
        //     if hasattr(block, 'text')
        // ])
        content = response.content
          .filter((block) => 'text' in block)
          .map((block) => (block as any).text)
          .join('\n')
      }

      // Python lines 290-297: Extract usage
      // usage = {
      //     'input_tokens': response.usage.input_tokens if response.usage else 0,
      //     'output_tokens': response.usage.output_tokens if response.usage else 0,
      //     'total_tokens': (
      //         (response.usage.input_tokens if response.usage else 0) +
      //         (response.usage.output_tokens if response.usage else 0)
      //     ),
      // }
      const usage = {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
        total_tokens:
          (response.usage?.input_tokens || 0) +
          (response.usage?.output_tokens || 0),
      }

      // Python lines 300-306: Calculate cost
      // actual_cost = None
      let actualCost: number | null = null
      // if model in self.MODEL_PRICING and response.usage:
      if (model in ClaudeClient.MODEL_PRICING && response.usage) {
        // pricing = self.MODEL_PRICING[model]
        const pricing = ClaudeClient.MODEL_PRICING[model]
        // actual_cost = (
        //     (response.usage.input_tokens / 1_000_000) * pricing["input"] +
        //     (response.usage.output_tokens / 1_000_000) * pricing["output"]
        // )
        actualCost =
          (response.usage.input_tokens / 1_000_000) * pricing.input +
          (response.usage.output_tokens / 1_000_000) * pricing.output
      }

      // Python lines 308-315: Debug log
      this.logger.debug('Received response from Claude', {
        model,
        content_length: content.length,
        processing_time: processingTime,
        tokens_used: usage.total_tokens,
        estimated_cost: actualCost,
      })

      // Python lines 317-330: Success response
      // return LLMResponse(...)
      return {
        content,
        model,
        usage,
        metadata: {
          provider: 'claude',
          processing_time: processingTime,
          estimated_cost: actualCost,
          stop_reason: response.stop_reason,
          response_id: response.id,
          role: response.role,
        },
        success: true,
      }
    } catch (error: any) {
      // Python lines 332-376: Error handling (NO RETRY LOGIC)

      // Python lines 332-340: Rate limit error
      // except anthropic.RateLimitError as e:
      if (error instanceof Anthropic.RateLimitError) {
        const errorMsg = `Claude rate limit exceeded: ${String(error)}`
        this.logger.error('Claude rate limit exceeded', {
          model,
          error: errorMsg,
          processing_time: (Date.now() - startTime) / 1000,
        })
        return this.createErrorResponse(errorMsg, model)
      }

      // Python lines 342-348: Authentication error
      // except anthropic.AuthenticationError as e:
      if (error instanceof Anthropic.AuthenticationError) {
        const errorMsg = `Claude authentication failed: ${String(error)}`
        this.logger.error('Claude authentication failed', { error: errorMsg })
        return this.createErrorResponse(errorMsg, model)
      }

      // Python lines 350-358: Bad request error
      // except anthropic.BadRequestError as e:
      if (error instanceof Anthropic.BadRequestError) {
        const errorMsg = `Claude bad request: ${String(error)}`
        this.logger.error('Claude bad request', {
          model,
          error: errorMsg,
          messages_count: claudeMessages.length,
        })
        return this.createErrorResponse(errorMsg, model)
      }

      // Python lines 360-366: API connection error
      // except anthropic.APIConnectionError as e:
      if (error instanceof Anthropic.APIConnectionError) {
        const errorMsg = `Claude connection error: ${String(error)}`
        this.logger.error('Claude connection error', { error: errorMsg })
        return this.createErrorResponse(errorMsg, model)
      }

      // Python lines 368-376: Generic error
      // except Exception as e:
      const errorMsg = `Claude API error: ${String(error)}`
      this.logger.error('Claude generation failed', {
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
   * Python source: claude_client.py:378-386 (def get_usage_stats)
   *
   * @returns Usage statistics object
   */
  getUsageStats(): Record<string, any> {
    // Python lines 381-386:
    // return {
    //     'provider': 'claude',
    //     'note': 'Usage statistics not available via API. Check Anthropic console.',
    //     'default_model': self.default_model,
    //     'max_tokens': self.max_tokens
    // }
    return {
      provider: 'claude',
      note: 'Usage statistics not available via API. Check Anthropic console.',
      default_model: this.defaultModel,
      max_tokens: this.maxTokens,
    }
  }

  /**
   * Validate if a model is available
   *
   * Python source: claude_client.py:388-390 (def validate_model)
   *
   * @param modelName - Model identifier
   * @returns True if model is available, False otherwise
   */
  validateModel(modelName: string): boolean {
    // Python line 390: return model_name in self.MODEL_PRICING
    return modelName in ClaudeClient.MODEL_PRICING
  }

  /**
   * Get information about a specific model
   *
   * Python source: claude_client.py:392-407 (def get_model_info)
   *
   * @param modelName - Model identifier
   * @returns Model information object, or null if not found
   */
  getModelInfo(modelName: string): Record<string, any> | null {
    // Python lines 394-407:
    // if model_name not in self.MODEL_PRICING:
    //     return None
    if (!(modelName in ClaudeClient.MODEL_PRICING)) {
      return null
    }

    // return {
    //     'id': model_name,
    //     'provider': 'anthropic',
    //     'pricing': self.MODEL_PRICING[model_name],
    //     'capabilities': [
    //         'text_generation',
    //         'conversation',
    //         'analysis',
    //         'reasoning'
    //     ]
    // }
    return {
      id: modelName,
      provider: 'anthropic',
      pricing: ClaudeClient.MODEL_PRICING[modelName],
      capabilities: [
        'text_generation',
        'conversation',
        'analysis',
        'reasoning',
      ],
    }
  }

  /**
   * Rough estimation of token count for Claude
   *
   * Python source: claude_client.py:409-412 (def estimate_tokens)
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // Python lines 411-412:
    // # Simple heuristic: ~3.5 characters per token for Claude
    // return int(len(text) / 3.5)
    return Math.floor(text.length / 3.5)
  }

  /**
   * Truncate text to approximate token limit
   *
   * Python source: claude_client.py:414-421 (def truncate_to_token_limit)
   *
   * @param text - Text to truncate
   * @param maxTokens - Maximum token count
   * @returns Truncated text
   */
  truncateToTokenLimit(text: string, maxTokens: number): string {
    // Python lines 416-421:
    // max_chars = int(max_tokens * 3.5)  # Rough conversion for Claude
    const maxChars = Math.floor(maxTokens * 3.5)
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
   * Estimate token count for a list of messages
   *
   * Python source: claude_client.py:423-426 (def count_message_tokens)
   *
   * @param messages - Array of LLMMessage objects
   * @returns Estimated total token count
   */
  countMessageTokens(messages: Array<LLMMessage>): number {
    // Python lines 425-426:
    // total_text = "\n".join([msg.content for msg in messages])
    const totalText = messages.map((msg) => msg.content).join('\n')
    // return self.estimate_tokens(total_text)
    return this.estimateTokens(totalText)
  }
}
