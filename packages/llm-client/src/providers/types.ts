/**
 * LLM Provider Types - v13 Section 6.10-6.11
 *
 * Type definitions for LLM providers and requests.
 */

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Model tier for budget management
 */
export type ModelTier = 'fast' | 'standard' | 'quality' | 'local';

/**
 * Operation type for budget limits
 */
export type OperationType =
  | 'ikigai_inference'
  | 'mission_agent'
  | 'iab_classification'
  | 'reflection_node'
  | 'embedding_generation'
  | 'test';

/**
 * LLM request configuration
 */
export interface LLMRequest {
  messages: ChatMessage[];
  model?: string;
  modelTier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
  operation?: OperationType;
  urgent?: boolean;
}

/**
 * Token usage details
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

/**
 * LLM response
 */
export interface LLMResponse {
  content: string;
  model: string;
  usage: TokenUsage;
  throttled?: boolean;
  finishReason?: 'stop' | 'length' | 'content_filter';
  error?: string;
}

/**
 * LLM provider interface
 */
export interface LLMProvider {
  /**
   * Complete a chat request
   */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Get supported models
   */
  getSupportedModels(): string[];

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Operation limits (v13 Section 6.10)
 */
export const OPERATION_LIMITS: Record<
  OperationType,
  {
    maxInputTokens: number;
    maxOutputTokens: number;
    modelTier: ModelTier;
  }
> = {
  ikigai_inference: {
    maxInputTokens: 4000,
    maxOutputTokens: 2000,
    modelTier: 'standard',
  },
  mission_agent: {
    maxInputTokens: 3000,
    maxOutputTokens: 1500,
    modelTier: 'standard',
  },
  iab_classification: {
    maxInputTokens: 2000,
    maxOutputTokens: 500,
    modelTier: 'fast',
  },
  reflection_node: {
    maxInputTokens: 8000,
    maxOutputTokens: 2000,
    modelTier: 'standard',
  },
  embedding_generation: {
    maxInputTokens: 8000,
    maxOutputTokens: 0,
    modelTier: 'fast',
  },
  test: {
    maxInputTokens: 1000,
    maxOutputTokens: 500,
    modelTier: 'fast',
  },
};
