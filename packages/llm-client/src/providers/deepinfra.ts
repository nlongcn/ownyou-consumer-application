/**
 * DeepInfra LLM Provider - v13 Section 6.10-6.11
 *
 * Provider for DeepInfra's cost-effective LLM inference.
 *
 * Key features:
 * - Zero Data Retention by DEFAULT
 * - SOC 2 + ISO 27001 certified
 * - ~10x cheaper than OpenAI
 * - OpenAI-compatible API format
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import { BaseLLMProvider, LLMProviderType } from './base';
import type { ProviderConfig } from './base';
import type { LLMRequest, LLMResponse } from './types';
import { getMaxCompletionTokens, calculateCost } from './registry';

/**
 * DeepInfra provider configuration
 */
export interface DeepInfraProviderConfig extends ProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * DeepInfra LLM Provider - Uses OpenAI-compatible API
 */
export class DeepInfraProvider extends BaseLLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: DeepInfraProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('DeepInfra API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.deepinfra.com/v1/openai';
    this.defaultModel = config.model ?? 'meta-llama/Llama-3.3-70B-Instruct';
    this.defaultMaxTokens = config.maxTokens ?? 4096;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  getProviderType(): LLMProviderType {
    return LLMProviderType.DEEPINFRA;
  }

  getSupportedModels(): string[] {
    return [
      'meta-llama/Llama-3.3-70B-Instruct',
      'meta-llama/Llama-3.1-70B-Instruct',
      'meta-llama/Llama-3.1-8B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen2.5-7B-Instruct',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'google/gemma-2-9b-it',
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
      this.logger.debug(`DeepInfra availability check failed: ${error}`);
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

    this.logger.info(`Using model: ${model} for DeepInfra request`);
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
        throw new Error(`DeepInfra API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const processingTime = (Date.now() - startTime) / 1000;

      const content = data.choices?.[0]?.message?.content ?? '';
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? 0;
      const costUsd = calculateCost(model, inputTokens, outputTokens);

      this.logger.debug('Received response from DeepInfra', {
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
      const errorMsg = `DeepInfra API error: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('DeepInfra generation failed', { model, error: errorMsg, processingTime });
      return this.createErrorResponse(errorMsg, model);
    }
  }
}
