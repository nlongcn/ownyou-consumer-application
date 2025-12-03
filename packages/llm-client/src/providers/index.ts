/**
 * LLM Providers - v13 Section 6.10-6.11
 *
 * Exports LLM provider implementations.
 * Sprint 2: Consolidated from @ownyou/iab-classifier
 */

// Types
export type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ChatMessage,
  TokenUsage,
  ModelTier,
  OperationType,
} from './types';

export { OPERATION_LIMITS } from './types';

// Re-export from registry (consolidated in Sprint 2)
// NOTE: MODEL_PRICING removed - use MODEL_REGISTRY or getModelPricing() instead
export { MODEL_TIERS, calculateCost } from './registry';

// Base class and utilities
export {
  LLMProviderType,
  BaseLLMProvider,
  createLogger,
  createSimpleRequest,
  createConversationRequest,
} from './base';
export type { ProviderConfig, Logger, LLMResponseWithError } from './base';

// Model registry
export {
  MODEL_REGISTRY,
  getModelMetadata,
  getContextWindow,
  getMaxCompletionTokens,
  calculateCost as calculateModelCost,
  getModelPricing,
  getModelsForProvider,
  getModelsForTier,
  getZDRModels,
  isZDRModel,
  getRecommendedModel,
} from './registry';
export type { ModelMetadata, ModelPricing as RegistryModelPricing } from './registry';

// Provider implementations
export { MockLLMProvider } from './mock';
export { OpenAIProvider } from './openai';
export type { OpenAIProviderConfig } from './openai';
export { AnthropicProvider } from './anthropic';
export type { AnthropicProviderConfig } from './anthropic';
export { GoogleProvider } from './google';
export type { GoogleProviderConfig } from './google';
export { GroqProvider } from './groq';
export type { GroqProviderConfig } from './groq';
export { DeepInfraProvider } from './deepinfra';
export type { DeepInfraProviderConfig } from './deepinfra';
export { OllamaProvider } from './ollama';
export type { OllamaProviderConfig } from './ollama';
export { WebLLMProvider } from './webllm';
export type { WebLLMProviderConfig } from './webllm';

// High-level client with budget management and fallback chain
export {
  LLMClient,
  BudgetExceededError,
  RequestDeferredError,
  AllFallbacksExhaustedError,
} from './client';
export type { ClientRequest, FallbackResponse, LLMClientConfig } from './client';
