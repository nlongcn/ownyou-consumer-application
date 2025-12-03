/**
 * Ollama LLM Provider - v13 Section 6.10-6.11
 *
 * Provider for local LLM inference via Ollama.
 *
 * Key features:
 * - 100% local inference (zero cost)
 * - Zero data retention (runs locally)
 * - Wide model support (Llama, Mistral, Qwen, etc.)
 * - OpenAI-compatible API format
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import { BaseLLMProvider, LLMProviderType } from './base';
import type { ProviderConfig } from './base';
import type { LLMRequest, LLMResponse } from './types';

/**
 * Ollama provider configuration
 */
export interface OllamaProviderConfig extends ProviderConfig {
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Ollama LLM Provider - Local inference
 */
export class OllamaProvider extends BaseLLMProvider {
  private baseUrl: string;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: OllamaProviderConfig) {
    super(config);

    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
    this.defaultModel = config.model ?? 'llama3.2';
    this.defaultMaxTokens = config.maxTokens ?? 4096;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  getProviderType(): LLMProviderType {
    return LLMProviderType.OLLAMA;
  }

  getSupportedModels(): string[] {
    // Return commonly available models - actual availability depends on local install
    return ['llama3.2', 'llama3.1', 'mistral', 'qwen2.5', 'phi3', 'gemma2'];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      this.logger.debug(`Ollama availability check failed: ${error}`);
      return false;
    }
  }

  /**
   * Get locally installed models
   */
  async getInstalledModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.models?.map((m: any) => m.name) ?? [];
    } catch (error) {
      this.logger.debug(`Failed to get installed models: ${error}`);
      return [];
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

    // Format messages
    const messages = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    this.logger.info(`Using model: ${model} for Ollama request`);
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            num_predict: maxTokens,
            temperature,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const processingTime = (Date.now() - startTime) / 1000;

      const content = data.message?.content ?? '';

      // Ollama provides token counts
      const inputTokens = data.prompt_eval_count ?? 0;
      const outputTokens = data.eval_count ?? 0;
      const totalTokens = inputTokens + outputTokens;

      this.logger.debug('Received response from Ollama', {
        model,
        content_length: content.length,
        processing_time: processingTime,
        tokens_used: totalTokens,
      });

      return {
        content,
        model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd: 0, // Local inference is free
        },
        finishReason: data.done ? 'stop' : 'stop',
      };
    } catch (error) {
      const processingTime = (Date.now() - startTime) / 1000;

      // Check if Ollama is not running
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const errorMsg = 'Ollama is not running. Start it with: ollama serve';
        this.logger.error('Ollama not available', { error: errorMsg });
        return this.createErrorResponse(errorMsg, model);
      }

      const errorMsg = `Ollama API error: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('Ollama generation failed', { model, error: errorMsg, processingTime });
      return this.createErrorResponse(errorMsg, model);
    }
  }
}
