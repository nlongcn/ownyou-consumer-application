/**
 * Groq LLM Provider - v13 Section 6.10-6.11
 *
 * Provider for Groq's ultra-fast LLM inference.
 *
 * Key features:
 * - Fastest inference in market (~10x faster)
 * - Zero Data Retention option in Console
 * - OpenAI-compatible API format
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import { BaseLLMProvider, LLMProviderType } from './base';
import type { ProviderConfig } from './base';
import type { LLMRequest, LLMResponse } from './types';
import { getMaxCompletionTokens, calculateCost } from './registry';

/**
 * Groq provider configuration
 */
export interface GroqProviderConfig extends ProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Groq LLM Provider - Uses OpenAI-compatible API
 */
export class GroqProvider extends BaseLLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: GroqProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Groq API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.groq.com/openai/v1';
    this.defaultModel = config.model ?? 'llama-3.3-70b-versatile';
    this.defaultMaxTokens = config.maxTokens ?? 4096;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  getProviderType(): LLMProviderType {
    return LLMProviderType.GROQ;
  }

  /**
   * Get supported models (sync, uses bundled defaults)
   * @deprecated For dynamic model list, use: configService.getModelsByProvider('groq')
   */
  getSupportedModels(): string[] {
    // Bundled defaults - for current list use ConfigService
    return [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      this.logger.debug(`Groq availability check failed: ${error}`);
      return false;
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model ?? this.defaultModel;
    const maxTokens = Math.min(
      request.maxTokens ?? this.defaultMaxTokens,
      getMaxCompletionTokens(model, this.logger)
    );
    const temperature = request.temperature ?? this.defaultTemperature;

    // Validate request
    const errors = this.validateRequest(request);
    if (errors.length > 0) {
      return this.createErrorResponse(errors.join('; '), model);
    }

    const messages = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    this.logger.info(`Using model: ${model} for Groq request`);
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const processingTime = (Date.now() - startTime) / 1000;

      const content = data.choices?.[0]?.message?.content ?? '';
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? 0;
      const costUsd = calculateCost(model, inputTokens, outputTokens);

      this.logger.debug('Received response from Groq', {
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
        finishReason: data.choices?.[0]?.finish_reason as 'stop' | 'length' | 'content_filter',
      };
    } catch (error) {
      const processingTime = (Date.now() - startTime) / 1000;
      const errorMsg = `Groq API error: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('Groq generation failed', { model, error: errorMsg, processingTime });
      return this.createErrorResponse(errorMsg, model);
    }
  }
}
