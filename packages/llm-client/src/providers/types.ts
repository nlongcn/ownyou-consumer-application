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
 * Model pricing (per 1K tokens)
 */
export interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
}

/**
 * Model registry with pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4o': { inputPer1k: 0.0025, outputPer1k: 0.01 },
  'claude-3-haiku-20240307': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'claude-3-5-sonnet-20241022': { inputPer1k: 0.003, outputPer1k: 0.015 },
  local: { inputPer1k: 0, outputPer1k: 0 },
};

/**
 * Model tiers (v13 Section 6.10)
 */
export const MODEL_TIERS: Record<ModelTier, { models: string[]; avgCostPer1k: number }> = {
  fast: {
    models: ['gpt-4o-mini'],
    avgCostPer1k: 0.000375,
  },
  standard: {
    models: ['gpt-4o-mini', 'claude-3-haiku-20240307'],
    avgCostPer1k: 0.00075,
  },
  quality: {
    models: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
    avgCostPer1k: 0.00625,
  },
  local: {
    models: ['local'],
    avgCostPer1k: 0,
  },
};

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

/**
 * Calculate cost from token usage
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['gpt-4o-mini'];
  return (inputTokens * pricing.inputPer1k + outputTokens * pricing.outputPer1k) / 1000;
}
