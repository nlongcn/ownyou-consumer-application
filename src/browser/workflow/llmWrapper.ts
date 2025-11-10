/**
 * LLM Wrapper for Analyzer Nodes
 *
 * TypeScript port of: src/email_parser/workflow/llm_wrapper.py
 * Python file: 403 lines
 * TypeScript file: ~650 lines (expanded with async/await and Google support)
 *
 * Elements ported: 21/21 + Google support added
 * - 1 class: AnalyzerLLMClient
 * - 6 methods (all async where needed)
 * - Multi-provider support (OpenAI, Claude, Google, Ollama)
 * - Retry logic with exponential backoff
 * - Cost tracking integration
 * - JSON parsing with edge case handling
 *
 * Provides unified interface for calling LLM clients in workflow.
 * Handles retries, error handling, and response parsing.
 */

// Python lines 13-17: Imports
import { BaseLLMClient } from '../llm/base'
import type { LLMRequest } from '../llm/base'
import { ClaudeClient } from '../llm/claudeClient'
import { OpenAIClient } from '../llm/openaiClient'
import { GoogleClient } from '../llm/googleClient'
import { OllamaClient } from '../llm/ollamaClient'
import { CostTracker } from '../agents/iab-classifier/costTracker'

// Python lines 19-20: Logging
export interface Logger {
  info: (message: string, extra?: any) => void
  error: (message: string, extra?: any) => void
  warning: (message: string, extra?: any) => void
  debug: (message: string, extra?: any) => void
}

// Workflow tracker interface (for dashboard analytics)
export interface WorkflowTracker {
  recordCost: (params: {
    provider: string
    cost: number
    model_name: string
    input_tokens: number
    output_tokens: number
  }) => void
}

/**
 * Unified LLM client for analyzer nodes with retry logic.
 *
 * Python lines 22-403: Full AnalyzerLLMClient class
 *
 * Key features:
 * - Multi-provider support (OpenAI, Claude, Google, Ollama)
 * - Automatic retry with exponential backoff (3 attempts)
 * - Cost tracking integration (CostTracker + WorkflowTracker)
 * - JSON response parsing with cleanup
 * - Two interfaces: analyzeEmail() and callJson()
 */
export class AnalyzerLLMClient {
  private provider: string
  private maxRetries: number
  private costTracker?: CostTracker
  private workflowTracker?: WorkflowTracker
  private client: BaseLLMClient
  private model: string
  private logger?: Logger

  /**
   * Initialize LLM client for analyzer use.
   *
   * Python lines 25-72: __init__ method
   *
   * Browser adaptations:
   * - Environment variables via import.meta.env
   * - Async client creation
   * - Google client support added
   *
   * @param options - Configuration options
   * @param options.provider - "claude", "openai", "google", or "ollama"
   * @param options.model - Specific model name (optional)
   * @param options.maxRetries - Number of retry attempts (default: 3)
   * @param options.costTracker - Optional CostTracker instance
   * @param options.workflowTracker - Optional WorkflowTracker instance
   * @param options.logger - Optional logger instance
   */
  constructor(options: {
    provider?: string
    model?: string
    maxRetries?: number
    costTracker?: CostTracker
    workflowTracker?: WorkflowTracker
    logger?: Logger
  } = {}) {
    let provider = options.provider
    let model = options.model

    // Python lines 50-55: Parse model spec if it contains provider (format: "provider:model")
    if (model && model.includes(':')) {
      const [providerFromModel, modelName] = model.split(':', 2)
      if (!provider) {
        provider = providerFromModel
      }
      model = modelName

      if (options.logger) {
        options.logger.debug(`Parsed model spec: provider=${provider}, model=${model}`)
      }
    }

    // Python lines 58-60: Default to LLM_PROVIDER from environment, or "openai" as fallback
    if (!provider) {
      provider =
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LLM_PROVIDER) || 'openai'
    }

    // Python lines 61-64: Set instance variables
    // Type assertion: provider is always defined after the above check
    this.provider = (provider as string).toLowerCase()
    this.maxRetries = options.maxRetries ?? 3
    this.costTracker = options.costTracker
    this.workflowTracker = options.workflowTracker
    this.logger = options.logger

    // Python lines 66-67: Initialize appropriate client
    this.client = this._createClient()

    // Python lines 69-70: Use provided model or fallback to client's default model
    this.model = model || (this.client as any).defaultModel || ''

    // Python line 72: Log initialization
    if (this.logger) {
      this.logger.info(
        `Initialized ${this.provider} LLM client for analyzers (model: ${this.model})`
      )
    }
  }

  /**
   * Create the appropriate LLM client instance.
   *
   * Python lines 74-96: _create_client method
   *
   * Browser adaptation: Added Google client support
   *
   * @returns Initialized LLM client
   * @throws Error if provider is unknown
   */
  private _createClient(): BaseLLMClient {
    // Python line 84: Empty config (clients load from environment)
    const config = {}

    // Python lines 86-96: Provider switch + Google added
    if (this.provider === 'claude') {
      // Python line 87
      return new ClaudeClient(config)
    } else if (this.provider === 'openai') {
      // Python line 89
      return new OpenAIClient(config)
    } else if (this.provider === 'google') {
      // NEW: Google client support
      return new GoogleClient(config)
    } else if (this.provider === 'ollama') {
      // Python line 91
      return new OllamaClient(config)
    } else {
      // Python lines 93-96: Unknown provider error
      throw new Error(
        `Unknown provider: ${this.provider}. Must be 'claude', 'openai', 'google', or 'ollama'`
      )
    }
  }

  /**
   * Analyze email using LLM with retry logic.
   *
   * Python lines 98-214: analyze_email method
   *
   * Browser adaptation: Async with await, setTimeout for delays
   *
   * @param prompt - Complete prompt with email content and instructions
   * @param maxTokens - Maximum response tokens (default: undefined → client decides)
   * @param temperature - Sampling temperature (default: 0.1)
   * @returns Parsed JSON response with classifications array
   */
  async analyzeEmail(
    prompt: string,
    maxTokens?: number,
    temperature: number = 0.1
  ): Promise<{ classifications: any[] }> {
    // Python line 119: Log parameters
    if (this.logger) {
      this.logger.info(
        `analyzeEmail: max_tokens=${maxTokens} (will be auto-adjusted by client)`
      )
    }

    // Python lines 121-127: Create request
    const request: LLMRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
      max_tokens: maxTokens,
      temperature: temperature,
      json_mode: true, // Request JSON response
    }

    // Python lines 129-214: Retry loop
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Python line 131: Log attempt
        if (this.logger) {
          this.logger.debug(`LLM call attempt ${attempt}/${this.maxRetries}`)
        }

        // Python lines 133-134: Call LLM
        const response = await this.client.generate(request)

        // Python lines 136-137: Check success
        if (!response.success) {
          throw new Error(`LLM call failed: ${JSON.stringify(response.error)}`)
        }

        // Python lines 139-140: Parse JSON response
        const result = this._parseJsonResponse(response.content)

        // Python lines 142-148: Validate structure
        if (typeof result !== 'object' || result === null || Array.isArray(result)) {
          throw new Error('Response is not a JSON object')
        }

        if (!('classifications' in result)) {
          if (this.logger) {
            this.logger.warning("Response missing 'classifications' key, adding empty array")
          }
          result.classifications = []
        }

        // Python lines 150-172: Track costs if tracker provided
        if (this.costTracker && response.usage) {
          const promptTokens = response.usage.prompt_tokens || 0
          const completionTokens = response.usage.completion_tokens || 0

          if (promptTokens > 0 || completionTokens > 0) {
            const cost = this.costTracker.trackCall(
              this.provider,
              this.model,
              promptTokens,
              completionTokens
            )

            if (this.logger) {
              this.logger.debug(`Tracked LLM cost: $${cost.toFixed(6)} USD`)
            }

            // Also track to WorkflowTracker if available
            if (this.workflowTracker) {
              this.workflowTracker.recordCost({
                provider: this.provider,
                cost: cost,
                model_name: this.model,
                input_tokens: promptTokens,
                output_tokens: completionTokens,
              })
            }
          }
        }

        // Python lines 174-183: Log success
        if (this.logger) {
          this.logger.info('LLM call successful', {
            provider: this.provider,
            attempt: attempt,
            tokens: response.usage?.total_tokens || 0,
            classifications: result.classifications?.length || 0,
          })
        }

        // Python line 185: Return result
        return result as { classifications: any[] }
      } catch (error: any) {
        // Python lines 187-211: Error handling

        // Check if it's a JSON parse error
        if (error instanceof SyntaxError || error.message?.includes('JSON')) {
          // Python lines 188-198: JSON parse error
          if (this.logger) {
            this.logger.warning(
              `JSON parse error (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
              {
                response_preview: error.response?.substring(0, 200),
              }
            )
          }

          if (attempt < this.maxRetries) {
            // Python line 194: Exponential backoff: 1s, 2s, 4s
            await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 1000))
            continue
          } else {
            // Python lines 197-198: All retries failed
            if (this.logger) {
              this.logger.error('All retry attempts failed due to JSON parsing errors')
            }
            return { classifications: [] }
          }
        } else {
          // Python lines 200-211: Other exception
          if (this.logger) {
            this.logger.error(
              `LLM call error (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
              { stack: error.stack }
            )
          }

          if (attempt < this.maxRetries) {
            // Python line 207: Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 1000))
            continue
          } else {
            // Python lines 210-211: All retries exhausted - re-throw
            if (this.logger) {
              this.logger.error('All retry attempts exhausted')
            }
            throw error
          }
        }
      }
    }

    // Python lines 213-214: Safety fallback (should not reach here)
    return { classifications: [] }
  }

  /**
   * Call LLM and parse JSON response without enforcing specific structure.
   *
   * Python lines 216-321: call_json method
   *
   * This is useful for LLM-as-Judge and other tasks that don't return
   * classifications. Unlike analyzeEmail(), this doesn't normalize
   * the response to have a "classifications" key.
   *
   * Browser adaptation: Async with await, setTimeout for delays
   *
   * @param prompt - Complete prompt
   * @param maxTokens - Maximum response tokens (default: undefined → 100000 ceiling)
   * @param temperature - Sampling temperature (default: 0.1)
   * @returns Parsed JSON response as-is
   */
  async callJson(
    prompt: string,
    maxTokens?: number,
    temperature: number = 0.1
  ): Promise<Record<string, any>> {
    // Python lines 242-247: Handle max_tokens
    let effectiveMaxTokens = maxTokens
    if (effectiveMaxTokens === undefined) {
      effectiveMaxTokens = 100000 // High ceiling, will be adjusted by client
      if (this.logger) {
        this.logger.info(
          `call_json: max_tokens=None, using ceiling of ${effectiveMaxTokens} (will be auto-adjusted by client)`
        )
      }
    } else {
      if (this.logger) {
        this.logger.info(`call_json: max_tokens=${effectiveMaxTokens} (explicitly requested)`)
      }
    }

    // Python lines 249-255: Create request
    const request: LLMRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
      max_tokens: effectiveMaxTokens,
      temperature: temperature,
      json_mode: true,
    }

    // Python lines 257-321: Retry loop
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Python line 259: Log attempt
        if (this.logger) {
          this.logger.debug(`LLM call_json attempt ${attempt}/${this.maxRetries}`)
        }

        // Python lines 261-262: Call LLM
        const response = await this.client.generate(request)

        // Python lines 264-265: Check success
        if (!response.success) {
          throw new Error(`LLM call failed: ${JSON.stringify(response.error)}`)
        }

        // Python lines 267-268: Parse JSON response
        const result = this._parseJsonResponse(response.content)

        // Python lines 270-272: Validate structure (just check it's a dict)
        if (typeof result !== 'object' || result === null || Array.isArray(result)) {
          throw new Error('Response is not a JSON object')
        }

        // Python lines 274-295: Track costs if tracker provided
        if (this.costTracker && response.usage) {
          const promptTokens = response.usage.prompt_tokens || 0
          const completionTokens = response.usage.completion_tokens || 0

          if (promptTokens > 0 || completionTokens > 0) {
            const cost = this.costTracker.trackCall(
              this.provider,
              this.model,
              promptTokens,
              completionTokens
            )

            if (this.logger) {
              this.logger.debug(`Tracked LLM cost: $${cost.toFixed(6)} USD`)
            }

            if (this.workflowTracker) {
              this.workflowTracker.recordCost({
                provider: this.provider,
                cost: cost,
                model_name: this.model,
                input_tokens: promptTokens,
                output_tokens: completionTokens,
              })
            }
          }
        }

        // Python line 297: Log success
        if (this.logger) {
          this.logger.debug(`call_json successful (keys: ${Object.keys(result).join(', ')})`)
        }

        // Python line 298: Return result
        return result as Record<string, any>
      } catch (error: any) {
        // Python lines 300-318: Error handling

        // Check if it's a JSON parse error
        if (error instanceof SyntaxError || error.message?.includes('JSON')) {
          // Python lines 301-308: JSON parse error
          if (this.logger) {
            this.logger.warning(`JSON parse error (attempt ${attempt}/${this.maxRetries}): ${error.message}`)
          }

          if (attempt < this.maxRetries) {
            // Python line 304: Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 1000))
            continue
          } else {
            // Python lines 307-308: All retries failed - raise
            if (this.logger) {
              this.logger.error('All retry attempts failed due to JSON parsing errors')
            }
            throw error
          }
        } else {
          // Python lines 310-318: Other exception
          if (this.logger) {
            this.logger.error(
              `call_json error (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
              { stack: error.stack }
            )
          }

          if (attempt < this.maxRetries) {
            // Python line 314: Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 1000))
            continue
          } else {
            // Python lines 317-318: All retries exhausted - raise
            if (this.logger) {
              this.logger.error('All retry attempts exhausted')
            }
            throw error
          }
        }
      }
    }

    // Python lines 320-321: Should not reach here
    throw new Error('call_json: max retries exceeded')
  }

  /**
   * Parse JSON from LLM response, handling common formatting issues.
   *
   * Python lines 323-361: _parse_json_response method
   *
   * Handles:
   * - Markdown code blocks: ```json\n{...}\n```
   * - Text wrappers: "Here's the analysis:\n{...}"
   * - Extra whitespace
   *
   * @param content - Raw LLM response content
   * @returns Parsed JSON object
   * @throws SyntaxError if parsing fails after cleanup attempts
   */
  private _parseJsonResponse(content: string): Record<string, any> {
    // Python lines 337-346: Remove markdown code blocks if present
    let cleaned = content.trim()

    if (cleaned.startsWith('```json')) {
      // Python line 340: Remove ```json
      cleaned = cleaned.substring(7)
    }
    if (cleaned.startsWith('```')) {
      // Python line 342: Remove ```
      cleaned = cleaned.substring(3)
    }
    if (cleaned.endsWith('```')) {
      // Python line 344: Remove trailing ```
      cleaned = cleaned.substring(0, cleaned.length - 3)
    }

    cleaned = cleaned.trim()

    // Python lines 348-361: Parse JSON with extraction fallback
    try {
      // Python line 350: Try direct parse
      return JSON.parse(cleaned)
    } catch (error) {
      // Python lines 352-361: Try to extract JSON from text
      // Look for first { and last }
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')

      if (start !== -1 && end !== -1 && end > start) {
        // Python lines 358-359: Extract and parse
        const extracted = cleaned.substring(start, end + 1)
        return JSON.parse(extracted)
      } else {
        // Python line 361: Re-throw original error
        throw error
      }
    }
  }

  /**
   * Estimate cost of LLM call (if applicable).
   *
   * Python lines 363-400: estimate_cost method
   *
   * Browser adaptation: Added Google pricing
   *
   * @param promptTokens - Number of tokens in prompt
   * @param responseTokens - Number of tokens in response
   * @returns Estimated cost in USD, or undefined if not applicable
   */
  estimateCost(promptTokens: number, responseTokens: number): number | undefined {
    // Python lines 378-392: Approximate pricing (as of 2024)
    const pricing: Record<string, { prompt: number; response: number }> = {
      claude: {
        prompt: 3.0 / 1_000_000, // $3 per 1M input tokens
        response: 15.0 / 1_000_000, // $15 per 1M output tokens
      },
      openai: {
        prompt: 5.0 / 1_000_000, // $5 per 1M tokens (GPT-4)
        response: 15.0 / 1_000_000, // $15 per 1M tokens
      },
      google: {
        // NEW: Google pricing added
        prompt: 1.25 / 1_000_000, // $1.25 per 1M (Gemini 1.5 Pro)
        response: 5.0 / 1_000_000, // $5 per 1M
      },
      ollama: {
        prompt: 0.0, // Free (local)
        response: 0.0,
      },
    }

    // Python lines 394-395: Check if provider has pricing
    if (!(this.provider in pricing)) {
      return undefined
    }

    // Python lines 397-400: Calculate cost
    const rates = pricing[this.provider]
    const cost = promptTokens * rates.prompt + responseTokens * rates.response

    return cost
  }
}

/**
 * Migration Summary:
 *
 * Python: 403 lines, 21 elements
 * TypeScript: 650+ lines (expanded with async/await and Google support)
 *
 * All 21 elements ported + Google support added:
 * - 1 class (AnalyzerLLMClient)
 * - 6 methods (all async where needed)
 * - Multi-provider support (4 providers: OpenAI, Claude, Google, Ollama)
 * - Retry logic with exponential backoff (1s, 2s, 4s)
 * - Cost tracking integration (CostTracker + WorkflowTracker)
 * - JSON parsing with edge case handling
 *
 * Key Adaptations:
 * - All methods async with await
 * - setTimeout for exponential backoff delays
 * - Environment variables via import.meta.env
 * - Google client support added (was missing in Python)
 * - Google pricing added to estimateCost()
 *
 * Key Features:
 * - Unified interface for all LLM providers
 * - Automatic retry (3 attempts) with exponential backoff
 * - Cost tracking (CostTracker + WorkflowTracker)
 * - JSON cleanup (markdown code blocks, text wrappers)
 * - Two modes:
 *   - analyzeEmail() - Forgiving (returns empty on failure)
 *   - callJson() - Strict (raises on failure)
 *
 * FULL PORT - All 403 lines ported per mandate "Always Full Port, No Compromises"
 * PLUS Google support enhancement
 */
