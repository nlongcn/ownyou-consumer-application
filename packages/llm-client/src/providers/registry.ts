/**
 * Model Registry - v13 Section 6.10-6.11
 *
 * Comprehensive model metadata including:
 * - Context windows (input token limits)
 * - Max completion tokens (output limits)
 * - Pricing per 1K tokens
 * - Model tiers for budget management
 *
 * Consolidated from @ownyou/iab-classifier modelRegistry.ts for Sprint 2.
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import type { Logger } from './base';
import { LLMProviderType } from './base';

// ============================================================================
// MODEL METADATA TYPES
// ============================================================================

/**
 * Complete model metadata
 */
export interface ModelMetadata {
  provider: LLMProviderType;
  contextWindow: number;
  maxCompletionTokens: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
  tier: 'fast' | 'standard' | 'quality' | 'local';
  zeroDataRetention: boolean;
  description?: string;
}

/**
 * Model pricing (per 1K tokens)
 */
export interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
}

/**
 * Model tier classification
 */
export type ModelTier = 'fast' | 'standard' | 'quality' | 'local';

// ============================================================================
// MODEL REGISTRY - Comprehensive model database
// ============================================================================

/**
 * MODEL_REGISTRY - Complete model metadata for all supported models
 *
 * Sources:
 * - OpenAI: https://platform.openai.com/docs/models
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models
 * - Google: https://ai.google.dev/gemini-api/docs/models
 * - Groq: https://console.groq.com/docs/models
 * - DeepInfra: https://deepinfra.com/models
 *
 * Last updated: 2025-01-09
 */
export const MODEL_REGISTRY: Record<string, ModelMetadata> = {
  // -------------------------------------------------------------------------
  // OpenAI Models
  // -------------------------------------------------------------------------
  'gpt-4o': {
    provider: LLMProviderType.OPENAI,
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    inputPricePer1k: 0.0025,
    outputPricePer1k: 0.01,
    tier: 'quality',
    zeroDataRetention: false,
    description: 'GPT-4o - Latest flagship model',
  },
  'gpt-4o-mini': {
    provider: LLMProviderType.OPENAI,
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    inputPricePer1k: 0.00015,
    outputPricePer1k: 0.0006,
    tier: 'fast',
    zeroDataRetention: false,
    description: 'GPT-4o Mini - Cost-effective for most tasks',
  },
  'gpt-4-turbo': {
    provider: LLMProviderType.OPENAI,
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    inputPricePer1k: 0.01,
    outputPricePer1k: 0.03,
    tier: 'quality',
    zeroDataRetention: false,
    description: 'GPT-4 Turbo - Previous generation flagship',
  },
  'o1-preview': {
    provider: LLMProviderType.OPENAI,
    contextWindow: 128000,
    maxCompletionTokens: 32768,
    inputPricePer1k: 0.015,
    outputPricePer1k: 0.06,
    tier: 'quality',
    zeroDataRetention: false,
    description: 'o1-preview - Advanced reasoning model',
  },
  'o1-mini': {
    provider: LLMProviderType.OPENAI,
    contextWindow: 128000,
    maxCompletionTokens: 65536,
    inputPricePer1k: 0.003,
    outputPricePer1k: 0.012,
    tier: 'standard',
    zeroDataRetention: false,
    description: 'o1-mini - Efficient reasoning model',
  },

  // -------------------------------------------------------------------------
  // Anthropic Claude Models
  // -------------------------------------------------------------------------
  'claude-3-5-sonnet-20241022': {
    provider: LLMProviderType.ANTHROPIC,
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.003,
    outputPricePer1k: 0.015,
    tier: 'quality',
    zeroDataRetention: false,
    description: 'Claude 3.5 Sonnet - Best balance of capability and speed',
  },
  'claude-3-5-haiku-20241022': {
    provider: LLMProviderType.ANTHROPIC,
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.0008,
    outputPricePer1k: 0.004,
    tier: 'fast',
    zeroDataRetention: false,
    description: 'Claude 3.5 Haiku - Fastest Claude model',
  },
  'claude-3-haiku-20240307': {
    provider: LLMProviderType.ANTHROPIC,
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    inputPricePer1k: 0.00025,
    outputPricePer1k: 0.00125,
    tier: 'fast',
    zeroDataRetention: false,
    description: 'Claude 3 Haiku - Budget option',
  },
  'claude-sonnet-4-20250514': {
    provider: LLMProviderType.ANTHROPIC,
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.003,
    outputPricePer1k: 0.015,
    tier: 'quality',
    zeroDataRetention: false,
    description: 'Claude Sonnet 4 - Latest Sonnet',
  },

  // -------------------------------------------------------------------------
  // Google Gemini Models
  // -------------------------------------------------------------------------
  'gemini-2.0-flash': {
    provider: LLMProviderType.GOOGLE,
    contextWindow: 1000000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00015,
    outputPricePer1k: 0.0006,
    tier: 'fast',
    zeroDataRetention: false,
    description: 'Gemini 2.0 Flash - Fast with 1M context',
  },
  'gemini-2.0-flash-exp': {
    provider: LLMProviderType.GOOGLE,
    contextWindow: 1000000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00015,
    outputPricePer1k: 0.0006,
    tier: 'fast',
    zeroDataRetention: false,
    description: 'Gemini 2.0 Flash Experimental',
  },
  'gemini-1.5-pro': {
    provider: LLMProviderType.GOOGLE,
    contextWindow: 1000000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00125,
    outputPricePer1k: 0.005,
    tier: 'quality',
    zeroDataRetention: false,
    description: 'Gemini 1.5 Pro - Previous generation flagship',
  },
  'gemini-1.5-flash': {
    provider: LLMProviderType.GOOGLE,
    contextWindow: 1000000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.000075,
    outputPricePer1k: 0.0003,
    tier: 'fast',
    zeroDataRetention: false,
    description: 'Gemini 1.5 Flash - Budget option with 1M context',
  },

  // -------------------------------------------------------------------------
  // Groq Models (Zero Data Retention)
  // -------------------------------------------------------------------------
  'llama-3.3-70b-versatile': {
    provider: LLMProviderType.GROQ,
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00059,
    outputPricePer1k: 0.00079,
    tier: 'standard',
    zeroDataRetention: true,
    description: 'Llama 3.3 70B on Groq - Fast inference with ZDR',
  },
  'llama-3.1-70b-versatile': {
    provider: LLMProviderType.GROQ,
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00059,
    outputPricePer1k: 0.00079,
    tier: 'standard',
    zeroDataRetention: true,
    description: 'Llama 3.1 70B on Groq - Fast inference with ZDR',
  },
  'llama-3.1-8b-instant': {
    provider: LLMProviderType.GROQ,
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00005,
    outputPricePer1k: 0.00008,
    tier: 'fast',
    zeroDataRetention: true,
    description: 'Llama 3.1 8B on Groq - Fastest option with ZDR',
  },
  'mixtral-8x7b-32768': {
    provider: LLMProviderType.GROQ,
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    inputPricePer1k: 0.00024,
    outputPricePer1k: 0.00024,
    tier: 'fast',
    zeroDataRetention: true,
    description: 'Mixtral 8x7B on Groq - MoE model with ZDR',
  },

  // -------------------------------------------------------------------------
  // DeepInfra Models (Zero Data Retention by default)
  // -------------------------------------------------------------------------
  'meta-llama/Llama-3.3-70B-Instruct': {
    provider: LLMProviderType.DEEPINFRA,
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00035,
    outputPricePer1k: 0.0004,
    tier: 'standard',
    zeroDataRetention: true,
    description: 'Llama 3.3 70B on DeepInfra - Best price/performance with ZDR',
  },
  'meta-llama/Llama-3.1-8B-Instruct': {
    provider: LLMProviderType.DEEPINFRA,
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00006,
    outputPricePer1k: 0.00006,
    tier: 'fast',
    zeroDataRetention: true,
    description: 'Llama 3.1 8B on DeepInfra - Ultra cheap with ZDR',
  },
  'Qwen/Qwen2.5-72B-Instruct': {
    provider: LLMProviderType.DEEPINFRA,
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    inputPricePer1k: 0.00035,
    outputPricePer1k: 0.0004,
    tier: 'standard',
    zeroDataRetention: true,
    description: 'Qwen 2.5 72B on DeepInfra - Strong multilingual with ZDR',
  },

  // -------------------------------------------------------------------------
  // Local Models (Ollama)
  // -------------------------------------------------------------------------
  'llama3.2': {
    provider: LLMProviderType.OLLAMA,
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    inputPricePer1k: 0,
    outputPricePer1k: 0,
    tier: 'local',
    zeroDataRetention: true,
    description: 'Llama 3.2 via Ollama - Free local inference',
  },
  'mistral': {
    provider: LLMProviderType.OLLAMA,
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    inputPricePer1k: 0,
    outputPricePer1k: 0,
    tier: 'local',
    zeroDataRetention: true,
    description: 'Mistral via Ollama - Free local inference',
  },
  'qwen2.5': {
    provider: LLMProviderType.OLLAMA,
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    inputPricePer1k: 0,
    outputPricePer1k: 0,
    tier: 'local',
    zeroDataRetention: true,
    description: 'Qwen 2.5 via Ollama - Free local inference',
  },

  // -------------------------------------------------------------------------
  // WebLLM Models (Browser-local)
  // -------------------------------------------------------------------------
  'Llama-3.2-3B-Instruct-q4f16_1-MLC': {
    provider: LLMProviderType.WEBLLM,
    contextWindow: 4096,
    maxCompletionTokens: 2048,
    inputPricePer1k: 0,
    outputPricePer1k: 0,
    tier: 'local',
    zeroDataRetention: true,
    description: 'Llama 3.2 3B via WebLLM - Browser-local inference',
  },
  'Phi-3.5-mini-instruct-q4f16_1-MLC': {
    provider: LLMProviderType.WEBLLM,
    contextWindow: 4096,
    maxCompletionTokens: 2048,
    inputPricePer1k: 0,
    outputPricePer1k: 0,
    tier: 'local',
    zeroDataRetention: true,
    description: 'Phi 3.5 Mini via WebLLM - Browser-local inference',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get model metadata by name with fallback
 */
export function getModelMetadata(modelName: string): ModelMetadata | null {
  // Exact match
  if (modelName in MODEL_REGISTRY) {
    return MODEL_REGISTRY[modelName];
  }

  // Prefix match for versioned models
  for (const [registeredName, metadata] of Object.entries(MODEL_REGISTRY)) {
    if (modelName.startsWith(registeredName) || registeredName.startsWith(modelName)) {
      return metadata;
    }
  }

  return null;
}

/**
 * Get context window for a model
 */
export function getContextWindow(modelName: string, logger?: Logger): number {
  const metadata = getModelMetadata(modelName);
  if (metadata) {
    return metadata.contextWindow;
  }

  // Default fallback
  logger?.warn(`Unknown model '${modelName}' - using default 32K context window`);
  return 32768;
}

/**
 * Get max completion tokens for a model
 */
export function getMaxCompletionTokens(modelName: string, logger?: Logger): number {
  const metadata = getModelMetadata(modelName);
  if (metadata) {
    return metadata.maxCompletionTokens;
  }

  // Default fallback
  logger?.warn(`Unknown model '${modelName}' - using default 4K max completion`);
  return 4096;
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number {
  const metadata = getModelMetadata(modelName);
  if (metadata) {
    return (
      (inputTokens * metadata.inputPricePer1k + outputTokens * metadata.outputPricePer1k) / 1000
    );
  }

  // Fallback to gpt-4o-mini pricing
  return (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
}

/**
 * Get model pricing
 */
export function getModelPricing(modelName: string): ModelPricing {
  const metadata = getModelMetadata(modelName);
  if (metadata) {
    return {
      inputPer1k: metadata.inputPricePer1k,
      outputPer1k: metadata.outputPricePer1k,
    };
  }

  // Fallback to gpt-4o-mini pricing
  return { inputPer1k: 0.00015, outputPer1k: 0.0006 };
}

/**
 * Get all models for a provider
 */
export function getModelsForProvider(provider: LLMProviderType): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, metadata]) => metadata.provider === provider)
    .map(([name]) => name);
}

/**
 * Get all models for a tier
 */
export function getModelsForTier(tier: ModelTier): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, metadata]) => metadata.tier === tier)
    .map(([name]) => name);
}

/**
 * Get all zero data retention models
 */
export function getZDRModels(): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, metadata]) => metadata.zeroDataRetention)
    .map(([name]) => name);
}

/**
 * Check if a model supports zero data retention
 */
export function isZDRModel(modelName: string): boolean {
  const metadata = getModelMetadata(modelName);
  return metadata?.zeroDataRetention ?? false;
}

/**
 * Get recommended model for a tier and provider preference
 */
export function getRecommendedModel(
  tier: ModelTier,
  preferZDR: boolean = false,
  preferredProvider?: LLMProviderType
): string | null {
  const candidates = Object.entries(MODEL_REGISTRY).filter(([_, metadata]) => {
    if (metadata.tier !== tier) return false;
    if (preferZDR && !metadata.zeroDataRetention) return false;
    if (preferredProvider && metadata.provider !== preferredProvider) return false;
    return true;
  });

  if (candidates.length === 0) {
    // Fall back without ZDR requirement
    if (preferZDR) {
      return getRecommendedModel(tier, false, preferredProvider);
    }
    // Fall back without provider preference
    if (preferredProvider) {
      return getRecommendedModel(tier, false);
    }
    return null;
  }

  // Sort by cost (cheapest first)
  candidates.sort((a, b) => {
    const costA = a[1].inputPricePer1k + a[1].outputPricePer1k;
    const costB = b[1].inputPricePer1k + b[1].outputPricePer1k;
    return costA - costB;
  });

  return candidates[0][0];
}

// ============================================================================
// TIER CONFIGURATION (v13 Section 6.10)
// ============================================================================

/**
 * Model tier configuration with budget thresholds
 */
export const MODEL_TIERS: Record<ModelTier, {
  models: string[];
  avgCostPer1k: number;
  description: string;
}> = {
  fast: {
    models: getModelsForTier('fast'),
    avgCostPer1k: 0.00035,
    description: 'Fastest models for simple tasks (gpt-4o-mini, claude-3-haiku, etc.)',
  },
  standard: {
    models: getModelsForTier('standard'),
    avgCostPer1k: 0.001,
    description: 'Balanced models for most tasks (llama-3.3-70b, o1-mini, etc.)',
  },
  quality: {
    models: getModelsForTier('quality'),
    avgCostPer1k: 0.008,
    description: 'Best models for complex tasks (gpt-4o, claude-3.5-sonnet, etc.)',
  },
  local: {
    models: getModelsForTier('local'),
    avgCostPer1k: 0,
    description: 'Local/browser models with zero cost (ollama, webllm)',
  },
};
