/**
 * LLM Wrapper for Analyzer Nodes
 *
 * Provides unified interface for calling LLM clients in workflow.
 * Handles retries, error handling, and response parsing.
 *
 * 1:1 Port of: src/email_parser/workflow/llm_wrapper.py (403 lines)
 */

import { OpenAIClient } from '@browser/llm/openaiClient'
import { ClaudeClient } from '@browser/llm/claudeClient'
import { OllamaClient } from '@browser/llm/ollamaClient'

// Import LLM types from base (shared across all clients)
import type {
  LLMRequest,
  LLMResponse,
} from '@browser/llm/base'

// Cost tracker interface (stub for now - will be implemented with full cost tracking)
export interface CostTracker {
  track_call(params: {
    provider: string
    model: string
    prompt_tokens: number
    completion_tokens: number
  }): number
}

// Workflow tracker interface (stub for dashboard analytics)
export interface WorkflowTracker {
  record_cost(params: {
    provider: string
    cost: number
    model_name: string
    input_tokens: number
    output_tokens: number
  }): void
}

// Base LLM Client interface
export interface BaseLLMClient {
  default_model: string
  generate(request: LLMRequest): Promise<LLMResponse>
}

/**
 * Unified LLM client for analyzer nodes with retry logic.
 *
 * Python lines 22-401
 */
export class AnalyzerLLMClient {                                                 // Python line 22
  provider: string                                                               // Python line 61
  max_retries: number                                                            // Python line 62
  cost_tracker: CostTracker | null                                               // Python line 63
  workflow_tracker: WorkflowTracker | null                                       // Python line 64
  client: ClaudeClient | OpenAIClient | OllamaClient                             // Python line 67
  model: string                                                                  // Python line 70

  /**
   * Initialize LLM client for analyzer use.
   *
   * Python lines 25-72
   *
   * @param provider - "openai", "claude", or "ollama" (defaults to env LLM_PROVIDER)
   * @param model - Specific model name (optional, uses default from client)
   * @param max_retries - Number of retry attempts on failure (default: 3)
   * @param cost_tracker - Optional CostTracker instance to track API costs
   * @param workflow_tracker - Optional WorkflowTracker instance for dashboard analytics
   *
   * @example
   * const client = new AnalyzerLLMClient({ provider: "openai" })
   * const response = await client.analyze_email(prompt)
   */
  constructor(params: {                                                          // Python line 25
    provider?: string | null
    model?: string | null
    max_retries?: number
    cost_tracker?: CostTracker | null
    workflow_tracker?: WorkflowTracker | null
  } = {}) {
    // Parse model spec if it contains provider (format: "provider:model")     // Python line 49
    let provider = params.provider
    let model = params.model

    if (model && model.includes(':')) {                                          // Python line 50
      const [provider_from_model, model_name] = model.split(':', 2)             // Python line 51
      if (provider === null || provider === undefined) {                         // Python line 52
        provider = provider_from_model                                           // Python line 53
      }
      model = model_name                                                         // Python line 54
      console.debug(`Parsed model spec: provider=${provider}, model=${model}`)  // Python line 55
    }

    // Default to LLM_PROVIDER from environment, or "openai" as fallback        // Python line 57
    if (provider === null || provider === undefined) {                           // Python line 58
      provider = (globalThis as any).process?.env?.LLM_PROVIDER || 'openai'     // Python line 59
    }

    this.provider = provider!.toLowerCase()                                       // Python line 61
    this.max_retries = params.max_retries ?? 3                                   // Python line 62
    this.cost_tracker = params.cost_tracker ?? null                              // Python line 63
    this.workflow_tracker = params.workflow_tracker ?? null                      // Python line 64

    // Initialize appropriate client                                             // Python line 66
    this.client = this._createClient()                                           // Python line 67

    // Use provided model or fallback to client's default model                  // Python line 69
    this.model = model || this.client.default_model                              // Python line 70

    console.info(                                                                // Python line 72
      `Initialized ${this.provider} LLM client for analyzers (model: ${this.model})`
    )
  }

  /**
   * Create the appropriate LLM client instance.
   *
   * Python lines 74-96
   *
   * @returns Initialized LLM client
   * @throws Error if provider is unknown
   */
  private _createClient(): ClaudeClient | OpenAIClient | OllamaClient {          // Python line 74
    // Clients load config from environment                                      // Python line 84

    if (this.provider === 'claude') {                                            // Python line 86
      // Use ClaudeClient from src/browser/llm/                                 // Python line 87
      const config = {
        anthropic_api_key: import.meta.env?.VITE_ANTHROPIC_API_KEY,
        anthropic_model: this.model,
      }
      return new ClaudeClient(config)
    } else if (this.provider === 'openai') {                                     // Python line 88
      // Use OpenAIClient from src/browser/llm/                                 // Python line 89
      const config = {
        openai_api_key: import.meta.env?.VITE_OPENAI_API_KEY,
        openai_model: this.model,
      }
      return new OpenAIClient(config)
    } else if (this.provider === 'ollama') {                                     // Python line 90
      // Use OllamaClient from src/browser/llm/                                 // Python line 91
      const config = {
        ollama_host: import.meta.env?.VITE_OLLAMA_HOST || 'http://localhost:11434',
        ollama_model: this.model,
      }
      return new OllamaClient(config)
    } else {                                                                     // Python line 92
      throw new Error(                                                           // Python line 93
        `Unknown provider: ${this.provider}. Must be 'claude', 'openai', or 'ollama'`
      )
    }
  }

  /**
   * Analyze email using LLM with retry logic.
   *
   * Python lines 98-214
   *
   * @param prompt - Complete prompt with email content and instructions
   * @param max_tokens - Maximum response tokens (default: 1000)
   * @param temperature - Sampling temperature, lower = more deterministic (default: 0.1)
   * @returns Parsed JSON response with classifications array
   *
   * @example
   * const response = await client.analyze_email(prompt)
   * const classifications = response.classifications
   */
  async analyze_email(params: {                                                  // Python line 98
    prompt: string
    max_tokens?: number | null
    temperature?: number
  }): Promise<Record<string, any>> {
    const { prompt, max_tokens = null, temperature = 0.1 } = params             // Python line 102

    console.info(                                                                // Python line 119
      `analyze_email: max_tokens=${max_tokens} (will be auto-adjusted by client)`
    )

    console.debug('[DEBUG] Prompt length:', prompt.length, 'characters')
    console.debug('[DEBUG] First 1000 chars of prompt:', prompt.substring(0, 1000))

    const request: LLMRequest = {                                                // Python line 121
      messages: [{ role: 'user', content: prompt }],                             // Python line 122
      model: this.model,                                                         // Python line 123
      max_tokens: max_tokens ?? undefined,                                       // Python line 124 (convert null to undefined)
      temperature,                                                               // Python line 125
      json_mode: true,  // Request JSON response                                // Python line 126
    }

    for (let attempt = 1; attempt <= this.max_retries; attempt++) {              // Python line 129
      try {                                                                      // Python line 130
        console.debug(`LLM call attempt ${attempt}/${this.max_retries}`)        // Python line 131

        // Call LLM                                                              // Python line 133
        const response = await this.client.generate(request)                     // Python line 134

        if (!response.success) {                                                 // Python line 136
          throw new Error(`LLM call failed: ${response.error}`)                  // Python line 137
        }

        // Parse JSON response                                                   // Python line 139
        console.debug('[DEBUG] Raw LLM response content:', response.content.substring(0, 500))
        const result = this._parseJsonResponse(response.content)                 // Python line 140
        console.debug('[DEBUG] Parsed result:', JSON.stringify(result).substring(0, 500))

        // Validate structure                                                    // Python line 142
        if (typeof result !== 'object' || result === null || Array.isArray(result)) { // Python line 143
          throw new Error('Response is not a JSON object')                       // Python line 144
        }

        if (!('classifications' in result)) {                                    // Python line 146
          console.warn('Response missing "classifications" key, adding empty array') // Python line 147
          result.classifications = []                                            // Python line 148
        }
        console.debug('[DEBUG] Classifications count:', result.classifications?.length || 0)

        // Track costs if tracker provided                                       // Python line 150
        if (this.cost_tracker && response.usage) {                               // Python line 151
          const prompt_tokens = response.usage.prompt_tokens || 0                // Python line 152
          const completion_tokens = response.usage.completion_tokens || 0        // Python line 153

          if (prompt_tokens > 0 || completion_tokens > 0) {                      // Python line 155
            const cost = this.cost_tracker.track_call({                          // Python line 156
              provider: this.provider,                                           // Python line 157
              model: this.model,                                                 // Python line 158
              prompt_tokens,                                                     // Python line 159
              completion_tokens,                                                 // Python line 160
            })
            console.debug(`Tracked LLM cost: $${cost.toFixed(6)} USD`)          // Python line 162

            // Also track to WorkflowTracker if available in state               // Python line 164
            if (this.workflow_tracker) {                                         // Python line 165
              this.workflow_tracker.record_cost({                                // Python line 166
                provider: this.provider,                                         // Python line 167
                cost,                                                            // Python line 168
                model_name: this.model,                                          // Python line 169
                input_tokens: prompt_tokens,                                     // Python line 170
                output_tokens: completion_tokens,                                // Python line 171
              })
            }
          }
        }

        // Log success                                                           // Python line 174
        console.info('LLM call successful', {                                    // Python line 175
          provider: this.provider,                                               // Python line 178
          attempt,                                                               // Python line 179
          tokens: response.usage.total_tokens || 0,                              // Python line 180
          classifications: (result.classifications || []).length,                // Python line 181
        })

        return result                                                            // Python line 185

      } catch (error) {                                                          // Python line 187
        if (error instanceof SyntaxError || (error as any).name === 'SyntaxError') {      // Python line 187
          console.warn(                                                          // Python line 188
            `JSON parse error (attempt ${attempt}/${this.max_retries}): ${error}`,
            { response_preview: 'response' in (error as any) ? (error as any).response?.content?.slice(0, 200) : null }
          )

          if (attempt < this.max_retries) {                                      // Python line 193
            await this._sleep(2 ** (attempt - 1) * 1000)  // Exponential backoff: 1s, 2s, 4s // Python line 194
            continue                                                             // Python line 195
          } else {                                                               // Python line 196
            console.error('All retry attempts failed due to JSON parsing errors') // Python line 197
            return { classifications: [] }                                       // Python line 198
          }
        }

        console.error(                                                           // Python line 200
          `LLM call error (attempt ${attempt}/${this.max_retries}): ${error}`,
          error
        )

        if (attempt < this.max_retries) {                                        // Python line 206
          await this._sleep(2 ** (attempt - 1) * 1000)                           // Python line 207
          continue                                                               // Python line 208
        } else {                                                                 // Python line 209
          console.error('All retry attempts exhausted')                          // Python line 210
          throw error                                                            // Python line 211
        }
      }
    }

    // Should not reach here, but safety fallback                               // Python line 213
    return { classifications: [] }                                               // Python line 214
  }

  /**
   * Call LLM and parse JSON response without enforcing specific structure.
   *
   * This is useful for LLM-as-Judge and other tasks that don't return
   * classifications. Unlike analyze_email(), this doesn't normalize
   * the response to have a "classifications" key.
   *
   * Python lines 216-321
   *
   * @param prompt - Complete prompt
   * @param max_tokens - Maximum response tokens (default: null, uses model's max_completion_tokens)
   * @param temperature - Sampling temperature (default: 0.1)
   * @returns Parsed JSON response as-is
   *
   * @example
   * const response = await client.call_json({ prompt: judge_prompt })
   * const quality_score = response.quality_score
   */
  async call_json(params: {                                                      // Python line 216
    prompt: string
    max_tokens?: number | null
    temperature?: number
  }): Promise<Record<string, any>> {
    const { prompt, temperature = 0.1 } = params                                 // Python line 221
    let { max_tokens = null } = params                                           // Python line 219

    // If max_tokens not provided, use a high value so _adjust_tokens_for_context // Python line 241
    // can calculate the optimal value based on context window and input size   // Python line 242
    if (max_tokens === null || max_tokens === undefined) {                       // Python line 243
      max_tokens = 100000  // High ceiling, will be adjusted by client          // Python line 244
      console.info(                                                              // Python line 245
        `call_json: max_tokens=null, using ceiling of ${max_tokens} (will be auto-adjusted by client)`
      )
    } else {                                                                     // Python line 247
      console.info(`call_json: max_tokens=${max_tokens} (explicitly requested)`) // Python line 248
    }

    const request: LLMRequest = {                                                // Python line 249
      messages: [{ role: 'user', content: prompt }],                             // Python line 250
      model: this.model,                                                         // Python line 251
      max_tokens,                                                                // Python line 252
      temperature,                                                               // Python line 253
      json_mode: true,                                                           // Python line 254
    }

    for (let attempt = 1; attempt <= this.max_retries; attempt++) {              // Python line 257
      try {                                                                      // Python line 258
        console.debug(`LLM call_json attempt ${attempt}/${this.max_retries}`)   // Python line 259

        // Call LLM                                                              // Python line 261
        const response = await this.client.generate(request)                     // Python line 262

        if (!response.success) {                                                 // Python line 264
          throw new Error(`LLM call failed: ${response.error}`)                  // Python line 265
        }

        // Parse JSON response                                                   // Python line 267
        const result = this._parseJsonResponse(response.content)                 // Python line 268

        // Validate structure (just check it's a dict)                           // Python line 270
        if (typeof result !== 'object' || result === null || Array.isArray(result)) { // Python line 271
          throw new Error('Response is not a JSON object')                       // Python line 272
        }

        // Track costs if tracker provided                                       // Python line 274
        if (this.cost_tracker && response.usage) {                               // Python line 275
          const prompt_tokens = response.usage.prompt_tokens || 0                // Python line 276
          const completion_tokens = response.usage.completion_tokens || 0        // Python line 277

          if (prompt_tokens > 0 || completion_tokens > 0) {                      // Python line 279
            const cost = this.cost_tracker.track_call({                          // Python line 280
              provider: this.provider,                                           // Python line 281
              model: this.model,                                                 // Python line 282
              prompt_tokens,                                                     // Python line 283
              completion_tokens,                                                 // Python line 284
            })
            console.debug(`Tracked LLM cost: $${cost.toFixed(6)} USD`)          // Python line 286

            if (this.workflow_tracker) {                                         // Python line 288
              this.workflow_tracker.record_cost({                                // Python line 289
                provider: this.provider,                                         // Python line 290
                cost,                                                            // Python line 291
                model_name: this.model,                                          // Python line 292
                input_tokens: prompt_tokens,                                     // Python line 293
                output_tokens: completion_tokens,                                // Python line 294
              })
            }
          }
        }

        console.debug(`call_json successful (keys: ${Object.keys(result).join(', ')})`) // Python line 297
        return result                                                            // Python line 298

      } catch (error) {                                                          // Python line 300
        if (error instanceof SyntaxError || (error as any).name === 'SyntaxError') {      // Python line 300
          console.warn(`JSON parse error (attempt ${attempt}/${this.max_retries}): ${error}`) // Python line 301

          if (attempt < this.max_retries) {                                      // Python line 303
            await this._sleep(2 ** (attempt - 1) * 1000)                         // Python line 304
            continue                                                             // Python line 305
          } else {                                                               // Python line 306
            console.error('All retry attempts failed due to JSON parsing errors') // Python line 307
            throw error                                                          // Python line 308
          }
        }

        console.error(                                                           // Python line 310
          `call_json error (attempt ${attempt}/${this.max_retries}): ${error}`,
          error
        )

        if (attempt < this.max_retries) {                                        // Python line 313
          await this._sleep(2 ** (attempt - 1) * 1000)                           // Python line 314
          continue                                                               // Python line 315
        } else {                                                                 // Python line 316
          console.error('All retry attempts exhausted')                          // Python line 317
          throw error                                                            // Python line 318
        }
      }
    }

    // Should not reach here                                                     // Python line 320
    throw new Error('call_json: max retries exceeded')                           // Python line 321
  }

  /**
   * Parse JSON from LLM response, handling common formatting issues.
   *
   * Python lines 323-361
   *
   * @param content - Raw LLM response content
   * @returns Parsed JSON object
   * @throws SyntaxError if parsing fails after cleanup attempts
   */
  private _parseJsonResponse(content: string): Record<string, any> {             // Python line 323
    // Remove markdown code blocks if present                                    // Python line 336
    content = content.trim()                                                     // Python line 337

    if (content.startsWith('```json')) {                                         // Python line 339
      content = content.slice(7)  // Remove ```json                             // Python line 340
    }
    if (content.startsWith('```')) {                                             // Python line 341
      content = content.slice(3)  // Remove ```                                 // Python line 342
    }
    if (content.endsWith('```')) {                                               // Python line 343
      content = content.slice(0, -3)  // Remove trailing ```                    // Python line 344
    }

    content = content.trim()                                                     // Python line 346

    // Parse JSON                                                                // Python line 348
    try {                                                                        // Python line 349
      return JSON.parse(content)                                                 // Python line 350
    } catch (error) {                                                            // Python line 351
      // Try to extract JSON from text                                           // Python line 352
      // Look for first { and last }                                             // Python line 353
      const start = content.indexOf('{')                                         // Python line 354
      const end = content.lastIndexOf('}')                                       // Python line 355

      if (start !== -1 && end !== -1) {                                          // Python line 357
        content = content.slice(start, end + 1)                                  // Python line 358
        return JSON.parse(content)                                               // Python line 359
      } else {                                                                   // Python line 360
        throw error                                                              // Python line 361
      }
    }
  }

  /**
   * Estimate cost of LLM call (if applicable).
   *
   * Python lines 363-400
   *
   * @param prompt_tokens - Number of tokens in prompt
   * @param response_tokens - Number of tokens in response
   * @returns Estimated cost in USD, or null if not applicable
   *
   * @example
   * const cost = client.estimate_cost(1000, 500)
   * console.log(`Estimated cost: $${cost.toFixed(4)}`)
   */
  estimate_cost(params: {                                                        // Python line 363
    prompt_tokens: number
    response_tokens: number
  }): number | null {
    const { prompt_tokens, response_tokens } = params                            // Python line 369

    // Approximate pricing (as of 2024)                                          // Python line 378
    const pricing: Record<string, { prompt: number; response: number }> = {      // Python line 379
      claude: {                                                                  // Python line 380
        prompt: 3.0 / 1_000_000,  // $3 per 1M input tokens                     // Python line 381
        response: 15.0 / 1_000_000,  // $15 per 1M output tokens                // Python line 382
      },
      openai: {                                                                  // Python line 384
        prompt: 5.0 / 1_000_000,  // $5 per 1M tokens (GPT-4)                   // Python line 385
        response: 15.0 / 1_000_000,  // $15 per 1M tokens                       // Python line 386
      },
      ollama: {                                                                  // Python line 388
        prompt: 0.0,  // Free (local)                                           // Python line 389
        response: 0.0,                                                           // Python line 390
      },
    }

    if (!(this.provider in pricing)) {                                           // Python line 394
      return null                                                                // Python line 395
    }

    const rates = pricing[this.provider]                                         // Python line 397
    const cost = prompt_tokens * rates.prompt + response_tokens * rates.response // Python line 398

    return cost                                                                  // Python line 400
  }

  /**
   * Sleep for specified milliseconds (utility for exponential backoff).
   *
   * @param ms - Milliseconds to sleep
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export default AnalyzerLLMClient
