/**
 * OpenAI LLM Provider - v13 Section 6.10-6.11
 *
 * Provider implementation for OpenAI GPT models.
 * Extracted from @ownyou/iab-classifier for Sprint 2 consolidation.
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import OpenAI from 'openai';
import { BaseLLMProvider, LLMProviderType } from './base';
import type { ProviderConfig } from './base';
import type { LLMRequest, LLMResponse } from './types';
import { getContextWindow, getMaxCompletionTokens, calculateCost } from './registry';

/**
 * Detect if running in Tauri environment
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' &&
         window.location?.protocol === 'tauri:' &&
         !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

/**
 * Get fetch function - uses Tauri's HTTP plugin when in Tauri to bypass CORS
 */
async function getTauriFetch(): Promise<typeof fetch | undefined> {
  if (!isTauri()) return undefined;

  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    console.log('[OpenAI Provider] Using Tauri HTTP plugin for CORS-free requests');
    return tauriFetch as typeof fetch;
  } catch (e) {
    console.warn('[OpenAI Provider] Tauri HTTP plugin not available:', e);
    return undefined;
  }
}

/**
 * OpenAI provider configuration
 */
export interface OpenAIProviderConfig extends ProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  organization?: string;
}

/**
 * OpenAI LLM Provider
 */
export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI | null = null;
  private clientPromise: Promise<OpenAI> | null = null;
  private openaiConfig: OpenAIProviderConfig;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: OpenAIProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openaiConfig = config;
    this.defaultModel = config.model ?? 'gpt-4o-mini';
    this.defaultMaxTokens = config.maxTokens ?? 16384;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  /**
   * Get or create the OpenAI client (lazy initialization for Tauri fetch support)
   */
  private async getClient(): Promise<OpenAI> {
    if (this.client) return this.client;

    // Prevent multiple initializations
    if (this.clientPromise) return this.clientPromise;

    this.clientPromise = (async () => {
      // Try to get Tauri's fetch for CORS-free requests
      const customFetch = await getTauriFetch();

      this.client = new OpenAI({
        apiKey: this.openaiConfig.apiKey,
        organization: this.openaiConfig.organization,
        dangerouslyAllowBrowser: true,
        timeout: this.openaiConfig.timeout ?? 120000,
        maxRetries: this.openaiConfig.maxRetries ?? 2,
        fetch: customFetch,
      });

      return this.client;
    })();

    return this.clientPromise;
  }

  getProviderType(): LLMProviderType {
    return LLMProviderType.OPENAI;
  }

  getSupportedModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-preview',
      'o1-mini',
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const models = await client.models.list();
      return models.data.length > 0;
    } catch (error) {
      this.logger.debug(`OpenAI availability check failed: ${error}`);
      return false;
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model ?? this.defaultModel;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;
    const temperature = request.temperature ?? this.defaultTemperature;

    // Validate request
    const errors = this.validateRequest(request);
    if (errors.length > 0) {
      return this.createErrorResponse(errors.join('; '), model);
    }

    // Format messages for OpenAI
    const messages = request.messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    // Adjust tokens for context window
    const adjustedMaxTokens = this.adjustTokensForContext(messages, model, maxTokens);

    this.logger.info(`Using model: ${model} for OpenAI request`);

    const startTime = Date.now();

    try {
      // Build request parameters
      const params: OpenAI.ChatCompletionCreateParams = {
        model,
        messages,
      };

      // Handle parameter differences between model versions
      if (model.toLowerCase().includes('o1')) {
        // o1 models use max_completion_tokens
        params.max_completion_tokens = adjustedMaxTokens;
      } else {
        params.max_tokens = adjustedMaxTokens;
        params.temperature = temperature;
      }

      const client = await this.getClient();
      const response = await client.chat.completions.create(params);

      const processingTime = (Date.now() - startTime) / 1000;
      const content = response.choices[0]?.message?.content ?? '';

      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const totalTokens = response.usage?.total_tokens ?? 0;
      const costUsd = calculateCost(model, inputTokens, outputTokens);

      this.logger.debug('Received response from OpenAI', {
        model,
        content_length: content.length,
        processing_time: processingTime,
        tokens_used: totalTokens,
        cost: costUsd,
      });

      return {
        content,
        model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd,
        },
        finishReason: response.choices[0]?.finish_reason as 'stop' | 'length' | 'content_filter',
      };
    } catch (error) {
      return this.handleError(error, model, startTime);
    }
  }

  /**
   * Handle OpenAI-specific errors with retry logic
   */
  private handleError(error: unknown, model: string, startTime: number): LLMResponse {
    const processingTime = (Date.now() - startTime) / 1000;

    if (error instanceof OpenAI.RateLimitError) {
      const errorMsg = `OpenAI rate limit exceeded: ${error.message}`;
      this.logger.error('OpenAI rate limit exceeded', { model, error: errorMsg, processingTime });
      return this.createErrorResponse(errorMsg, model);
    }

    if (error instanceof OpenAI.AuthenticationError) {
      const errorMsg = `OpenAI authentication failed: ${error.message}`;
      this.logger.error('OpenAI authentication failed', { error: errorMsg });
      return this.createErrorResponse(errorMsg, model);
    }

    if (error instanceof OpenAI.BadRequestError) {
      const errorMsg = `OpenAI bad request: ${error.message}`;
      this.logger.error('OpenAI bad request', { model, error: errorMsg });
      return this.createErrorResponse(errorMsg, model);
    }

    const errorMsg = `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`;
    this.logger.error('OpenAI generation failed', { model, error: errorMsg, processingTime });
    return this.createErrorResponse(errorMsg, model);
  }

  /**
   * Adjust max tokens based on input size and model limits
   */
  private adjustTokensForContext(
    messages: Array<{ role: string; content: string }>,
    model: string,
    requestedTokens: number
  ): number {
    const contextLimit = getContextWindow(model, this.logger);
    const maxCompletion = getMaxCompletionTokens(model, this.logger);

    // Estimate input tokens
    const inputText = messages.map((msg) => msg.content).join('\n');
    const estimatedInputTokens = this.estimateTokens(inputText);

    // Safety margin
    const safetyMargin = 200;
    const availableTokens = contextLimit - estimatedInputTokens - safetyMargin;

    // Cap at available tokens and model's max completion
    let adjustedTokens = Math.min(requestedTokens, availableTokens, maxCompletion);

    // Ensure minimum
    if (adjustedTokens < 100) {
      this.logger.warn(`Very limited tokens available: ${adjustedTokens}`);
      adjustedTokens = Math.max(100, Math.floor(availableTokens / 2));
    }

    if (adjustedTokens !== requestedTokens) {
      this.logger.info(
        `Adjusted max_tokens from ${requestedTokens} to ${adjustedTokens} ` +
          `(input: ~${estimatedInputTokens}, context: ${contextLimit}, max_completion: ${maxCompletion})`
      );
    }

    return adjustedTokens;
  }
}
