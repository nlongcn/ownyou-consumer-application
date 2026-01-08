/**
 * LLM Configuration Types - v13 Section 6.10
 *
 * Dynamic configuration for LLM models and pricing.
 * See docs/architecture/extracts/llm-cost-6.10.md for full specification.
 */

/**
 * Supported LLM providers
 */
export type Provider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'deepinfra'
  | 'ollama'
  | 'webllm';

/**
 * Model tier for budget management
 */
export type Tier = 'fast' | 'standard' | 'quality' | 'local';

/**
 * Pricing information for a model (per 1M tokens)
 */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
}

/**
 * Complete metadata for a model
 */
export interface ModelMetadata {
  id: string;
  provider: Provider;
  displayName: string;
  contextWindow: number;
  maxCompletionTokens: number;
  pricing: ModelPricing;
  capabilities: string[];
  zeroDataRetention: boolean;
  isReasoningModel: boolean;
}

/**
 * Tier configuration
 */
export interface TierConfig {
  primaryModel: string;
  fallbackModels: string[];
  avgCostPer1k: number;
  description: string;
}

/**
 * Fallback model for UI (when API unavailable)
 */
export interface FallbackModel {
  provider: string;
  model: string;
  displayName: string;
}

/**
 * Complete LLM configuration
 */
export interface LLMProviderConfig {
  timestamp: number;
  source: 'llm-prices.com' | 'openrouter' | 'bundled';
  models: Record<string, ModelMetadata>;
  tiers: Record<Tier, TierConfig>;
  fallbackModels: FallbackModel[];
}

/**
 * Cache entry for stored configuration
 */
export interface CachedConfig {
  config: LLMProviderConfig;
  expiry: number;
}

/**
 * Cache status information
 */
export interface CacheStatus {
  cached: boolean;
  expiry: Date | null;
  source: string;
}

/**
 * Raw response from llm-prices.com
 */
export interface LLMPricesResponse {
  updated_at: string;
  prices: Array<{
    id: string;
    vendor: string;
    name: string;
    input: number;
    output: number;
    input_cached: number | null;
  }>;
}

/**
 * Raw response from OpenRouter
 */
export interface OpenRouterResponse {
  data: Array<{
    id: string;
    name: string;
    context_length: number;
    pricing: {
      prompt: string;
      completion: string;
    };
  }>;
}
