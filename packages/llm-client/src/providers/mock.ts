/**
 * Mock LLM Provider - For Testing
 *
 * Simulates LLM responses for unit tests.
 */

import type { LLMProvider, LLMRequest, LLMResponse } from './types';
import { calculateCost } from './registry';

/**
 * MockLLMProvider - Deterministic responses for testing
 */
export class MockLLMProvider implements LLMProvider {
  private responses: Map<string, string> = new Map();
  private shouldFail = false;
  private failureError?: Error;

  /**
   * Set a canned response for a query
   */
  setResponse(query: string, response: string): void {
    this.responses.set(query, response);
  }

  /**
   * Configure provider to fail
   */
  setFailure(error?: Error): void {
    this.shouldFail = true;
    this.failureError = error;
  }

  /**
   * Reset failure mode
   */
  clearFailure(): void {
    this.shouldFail = false;
    this.failureError = undefined;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (this.shouldFail) {
      throw this.failureError ?? new Error('Mock provider failure');
    }

    const model = request.model ?? 'gpt-4o-mini';
    const maxOutputTokens = request.maxTokens ?? 100;

    // Get user message
    const userMessage = request.messages.find((m) => m.role === 'user')?.content ?? '';

    // Generate response
    let content = this.responses.get(userMessage);
    if (!content) {
      content = `Mock response to: ${userMessage.slice(0, 50)}`;
    }

    // Simulate token counts
    const inputTokens = this.estimateTokens(
      request.messages.map((m) => m.content).join(' ')
    );
    const outputTokens = Math.min(this.estimateTokens(content), maxOutputTokens);

    const costUsd = calculateCost(model, inputTokens, outputTokens);

    return {
      content,
      model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd,
      },
      finishReason: 'stop',
    };
  }

  getSupportedModels(): string[] {
    return ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'];
  }

  async isAvailable(): Promise<boolean> {
    return !this.shouldFail;
  }

  /**
   * Estimate token count from text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
