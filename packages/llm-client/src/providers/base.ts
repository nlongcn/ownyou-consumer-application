/**
 * Base LLM Provider - v13 Section 6.10-6.11
 *
 * Abstract base class and shared utilities for LLM providers.
 * Extracted from @ownyou/iab-classifier for Sprint 2 consolidation.
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import type { LLMRequest, LLMResponse, ChatMessage } from './types';

/**
 * Supported LLM provider identifiers
 */
export enum LLMProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  GROQ = 'groq',
  DEEPINFRA = 'deepinfra',
  OLLAMA = 'ollama',
  WEBLLM = 'webllm',
  MOCK = 'mock',
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
  timeout?: number;
  debug?: boolean;
}

/**
 * Logger interface for provider implementations
 */
export interface Logger {
  error: (message: string, context?: unknown) => void;
  warn: (message: string, context?: unknown) => void;
  info: (message: string, context?: unknown) => void;
  debug: (message: string, context?: unknown) => void;
}

/**
 * Create a console logger with class name prefix
 */
export function createLogger(className: string): Logger {
  const prefix = `[${className}]`;
  return {
    error: (message: string, context?: unknown) =>
      console.error(prefix, message, context ?? ''),
    warn: (message: string, context?: unknown) =>
      console.warn(prefix, message, context ?? ''),
    info: (message: string, context?: unknown) =>
      console.info(prefix, message, context ?? ''),
    debug: (message: string, context?: unknown) =>
      console.debug(prefix, message, context ?? ''),
  };
}

/**
 * Abstract base class for LLM providers
 *
 * Provides shared functionality for request validation, message preparation,
 * and error handling. Concrete providers extend this class.
 */
export abstract class BaseLLMProvider {
  protected config: ProviderConfig;
  protected logger: Logger;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.logger = createLogger(this.constructor.name);
  }

  /**
   * Get the provider type identifier
   */
  abstract getProviderType(): LLMProviderType;

  /**
   * Complete a chat request
   */
  abstract complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Get list of supported models for this provider
   */
  abstract getSupportedModels(): string[];

  /**
   * Check if the provider is available (API key set, service reachable, etc.)
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Validate a request and return list of errors (empty if valid)
   */
  validateRequest(request: LLMRequest): string[] {
    const errors: string[] = [];

    if (!request.messages || request.messages.length === 0) {
      errors.push('At least one message is required');
      return errors;
    }

    for (let i = 0; i < request.messages.length; i++) {
      const message = request.messages[i];

      if (!message.role) {
        errors.push(`Message ${i}: role is required`);
      }

      if (!['system', 'user', 'assistant'].includes(message.role)) {
        errors.push(`Message ${i}: invalid role '${message.role}'`);
      }

      if (!message.content) {
        errors.push(`Message ${i}: content is required`);
      }
    }

    return errors;
  }

  /**
   * Prepare messages for the provider (handle system prompt if separate)
   */
  prepareMessages(
    messages: ChatMessage[],
    systemPrompt?: string
  ): ChatMessage[] {
    const result = [...messages];

    if (systemPrompt) {
      // Prepend system message if not already present
      const hasSystem = result.some((m) => m.role === 'system');
      if (!hasSystem) {
        result.unshift({ role: 'system', content: systemPrompt });
      }
    }

    return result;
  }

  /**
   * Create a standardized error response
   */
  createErrorResponse(error: string, model: string = 'unknown'): LLMResponse {
    return {
      content: '',
      model,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
      },
      finishReason: 'stop',
      error,
    };
  }

  /**
   * Estimate token count from text (rough approximation: ~4 chars per token)
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Sleep for a given number of milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry logic with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `Attempt ${attempt + 1} failed, retrying in ${delay}ms`,
            lastError.message
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if an error should not be retried
   */
  protected isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('invalid api key') ||
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found') ||
      message.includes('invalid request')
    );
  }
}

/**
 * Extended response interface with optional error field
 */
export interface LLMResponseWithError extends LLMResponse {
  error?: string;
}

/**
 * Create a simple LLM request with a single user message
 */
export function createSimpleRequest(
  userMessage: string,
  systemPrompt?: string,
  model?: string,
  maxTokens?: number,
  temperature?: number
): LLMRequest {
  const messages: ChatMessage[] = [{ role: 'user', content: userMessage }];

  if (systemPrompt) {
    messages.unshift({ role: 'system', content: systemPrompt });
  }

  return {
    messages,
    model,
    maxTokens,
    temperature,
  };
}

/**
 * Create an LLM request from a conversation history
 */
export function createConversationRequest(
  conversation: Array<[string, string]>,
  systemPrompt?: string,
  model?: string,
  maxTokens?: number,
  temperature?: number
): LLMRequest {
  const messages: ChatMessage[] = conversation.map(([role, content]) => ({
    role: role as 'system' | 'user' | 'assistant',
    content,
  }));

  if (systemPrompt) {
    const hasSystem = messages.some((m) => m.role === 'system');
    if (!hasSystem) {
      messages.unshift({ role: 'system', content: systemPrompt });
    }
  }

  return {
    messages,
    model,
    maxTokens,
    temperature,
  };
}
