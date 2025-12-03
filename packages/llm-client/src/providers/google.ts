/**
 * Google (Gemini) LLM Provider - v13 Section 6.10-6.11
 *
 * Provider for Google's Gemini models.
 *
 * Key features:
 * - 1M token context window
 * - Multimodal support (text, images, video)
 * - Competitive pricing
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import { BaseLLMProvider, LLMProviderType } from './base';
import type { ProviderConfig } from './base';
import type { LLMRequest, LLMResponse, ChatMessage } from './types';
import { getMaxCompletionTokens, calculateCost } from './registry';

/**
 * Google provider configuration
 */
export interface GoogleProviderConfig extends ProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Google (Gemini) LLM Provider
 */
export class GoogleProvider extends BaseLLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: GoogleProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Google API key is required');
    }

    this.apiKey = config.apiKey;
    this.defaultModel = config.model ?? 'gemini-2.0-flash';
    this.defaultMaxTokens = config.maxTokens ?? 8192;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  getProviderType(): LLMProviderType {
    return LLMProviderType.GOOGLE;
  }

  getSupportedModels(): string[] {
    return [
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${this.apiKey}`
      );
      return response.ok;
    } catch (error) {
      this.logger.debug(`Google availability check failed: ${error}`);
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

    // Convert to Gemini format
    const { contents, systemInstruction } = this.formatMessagesForGemini(request.messages);

    this.logger.info(`Using model: ${model} for Google request`);
    const startTime = Date.now();

    try {
      const requestBody: any = {
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      };

      if (systemInstruction) {
        requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const processingTime = (Date.now() - startTime) / 1000;

      // Extract content from Gemini response
      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.map((p: any) => p.text).join('\n') ?? '';

      // Gemini uses different token field names
      const usage = data.usageMetadata ?? {};
      const inputTokens = usage.promptTokenCount ?? 0;
      const outputTokens = usage.candidatesTokenCount ?? 0;
      const totalTokens = usage.totalTokenCount ?? inputTokens + outputTokens;
      const costUsd = calculateCost(model, inputTokens, outputTokens);

      this.logger.debug('Received response from Google', {
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
        finishReason: candidate?.finishReason === 'STOP' ? 'stop' : 'stop',
      };
    } catch (error) {
      const processingTime = (Date.now() - startTime) / 1000;
      const errorMsg = `Google API error: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error('Google generation failed', { model, error: errorMsg, processingTime });
      return this.createErrorResponse(errorMsg, model);
    }
  }

  /**
   * Convert messages to Gemini format
   */
  private formatMessagesForGemini(messages: ChatMessage[]): {
    contents: any[];
    systemInstruction: string | null;
  } {
    let systemInstruction: string | null = null;
    const contents: any[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Combine system messages
        systemInstruction = systemInstruction
          ? `${systemInstruction}\n\n${message.content}`
          : message.content;
      } else {
        // Map user/assistant to Gemini's user/model
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        });
      }
    }

    return { contents, systemInstruction };
  }
}
