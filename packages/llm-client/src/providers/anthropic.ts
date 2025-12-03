/**
 * Anthropic (Claude) LLM Provider - v13 Section 6.10-6.11
 *
 * Provider implementation for Anthropic Claude models.
 * Extracted from @ownyou/iab-classifier for Sprint 2 consolidation.
 *
 * BROWSER SUPPORT:
 * - Uses `dangerouslyAllowBrowser: true` for browser/PWA/Tauri usage
 * - Anthropic added CORS support via header in Aug 2024
 * - Safe for OwnYou because users bring their own API keys (BYOKey pattern)
 * - API keys are stored locally on user's device, never exposed externally
 *
 * KEY DIFFERENCES FROM OPENAI:
 * - System messages extracted to separate 'system' parameter
 * - Response content is array of blocks with .text property
 * - Uses input_tokens/output_tokens (not prompt_tokens/completion_tokens)
 * - Token estimation: 3.5 chars/token (vs 4 for OpenAI)
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 * @see https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider, LLMProviderType } from './base';
import type { ProviderConfig } from './base';
import type { LLMRequest, LLMResponse, ChatMessage } from './types';
import { getMaxCompletionTokens, calculateCost } from './registry';

/**
 * Anthropic provider configuration
 */
export interface AnthropicProviderConfig extends ProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Anthropic (Claude) LLM Provider
 */
export class AnthropicProvider extends BaseLLMProvider {
  private client: Anthropic;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: AnthropicProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.defaultModel = config.model ?? 'claude-3-5-sonnet-20241022';
    this.defaultMaxTokens = config.maxTokens ?? 8192;
    this.defaultTemperature = config.temperature ?? 0.7;

    this.client = new Anthropic({
      apiKey: config.apiKey,
      // Required for browser-based usage (PWA, Tauri app)
      // Safe in this context because:
      // 1. API keys are stored locally on user's device
      // 2. OwnYou is a self-sovereign app where users bring their own keys
      // 3. No keys are exposed to external servers
      dangerouslyAllowBrowser: true,
    });
  }

  getProviderType(): LLMProviderType {
    return LLMProviderType.ANTHROPIC;
  }

  getSupportedModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-haiku-20240307',
      'claude-sonnet-4-20250514',
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Test' }],
      });
      return true;
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionError) {
        return false;
      }
      if (error instanceof Anthropic.AuthenticationError) {
        return false;
      }
      // Other errors mean service is available but request had issues
      return true;
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

    // Format messages for Claude (extract system message)
    const { messages, systemPrompt } = this.formatMessagesForClaude(request.messages);

    // Ensure at least one user message
    if (messages.length === 0 || messages[0].role !== 'user') {
      return this.createErrorResponse('Claude requires at least one user message', model);
    }

    this.logger.debug('Sending request to Claude', {
      model,
      messages_count: messages.length,
      has_system: !!systemPrompt,
      max_tokens: maxTokens,
    });

    const startTime = Date.now();

    try {
      // Build request params
      const params: Anthropic.MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages,
      };

      if (systemPrompt) {
        params.system = systemPrompt;
      }

      const response = await this.client.messages.create(params);

      const processingTime = (Date.now() - startTime) / 1000;

      // Extract content from Claude's block format
      const content = response.content
        .filter((block) => 'text' in block)
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n');

      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const costUsd = calculateCost(model, inputTokens, outputTokens);

      this.logger.debug('Received response from Claude', {
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
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'stop',
      };
    } catch (error) {
      return this.handleError(error, model, startTime);
    }
  }

  /**
   * Format messages for Claude API (extract system message)
   */
  private formatMessagesForClaude(messages: ChatMessage[]): {
    messages: Anthropic.MessageParam[];
    systemPrompt: string | null;
  } {
    let systemPrompt: string | null = null;
    const formattedMessages: Anthropic.MessageParam[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Combine multiple system messages
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n${message.content}`
          : message.content;
      } else {
        formattedMessages.push({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        });
      }
    }

    return { messages: formattedMessages, systemPrompt };
  }

  /**
   * Handle Anthropic-specific errors
   */
  private handleError(error: unknown, model: string, startTime: number): LLMResponse {
    const processingTime = (Date.now() - startTime) / 1000;

    if (error instanceof Anthropic.RateLimitError) {
      const errorMsg = `Claude rate limit exceeded: ${error.message}`;
      this.logger.error('Claude rate limit exceeded', { model, error: errorMsg, processingTime });
      return this.createErrorResponse(errorMsg, model);
    }

    if (error instanceof Anthropic.AuthenticationError) {
      const errorMsg = `Claude authentication failed: ${error.message}`;
      this.logger.error('Claude authentication failed', { error: errorMsg });
      return this.createErrorResponse(errorMsg, model);
    }

    if (error instanceof Anthropic.BadRequestError) {
      const errorMsg = `Claude bad request: ${error.message}`;
      this.logger.error('Claude bad request', { model, error: errorMsg });
      return this.createErrorResponse(errorMsg, model);
    }

    if (error instanceof Anthropic.APIConnectionError) {
      const errorMsg = `Claude connection error: ${error.message}`;
      this.logger.error('Claude connection error', { error: errorMsg });
      return this.createErrorResponse(errorMsg, model);
    }

    const errorMsg = `Claude API error: ${error instanceof Error ? error.message : String(error)}`;
    this.logger.error('Claude generation failed', { model, error: errorMsg, processingTime });
    return this.createErrorResponse(errorMsg, model);
  }

  /**
   * Estimate token count for Claude (3.5 chars per token)
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }
}
