/**
 * Model Registry - v13 Section 6.10-6.11
 *
 * ⚠️ DEPRECATION NOTICE:
 * This file contains BUNDLED DEFAULTS for backward compatibility.
 * For dynamic, up-to-date pricing and model data, use ConfigService:
 *
 * ```typescript
 * import { configService } from '@ownyou/llm-client';
 *
 * // Dynamic pricing (recommended)
 * const pricing = await configService.getPricing('gpt-4o-mini');
 *
 * // Dynamic model list
 * const models = await configService.getModelsByProvider('openai');
 * ```
 *
 * The sync functions in this file use bundled defaults and may have stale pricing.
 * Use the async versions (suffixed with 'Async') for current data.
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import type { Logger } from './base';
import { LLMProviderType } from './base';
import { configService } from '../config';
import type { ModelMetadata as ConfigModelMetadata } from '../config';
import { BUNDLED_DEFAULTS } from '../config/defaults';

// ============================================================================
// MODEL METADATA TYPES
// ============================================================================

/**
 * Complete model metadata (legacy format)
 * @deprecated Use ModelMetadata from '../config' for new code
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
  isReasoningModel?: boolean;
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
// PROVIDER TYPE MAPPING
// ============================================================================

const providerToLLMType: Record<string, LLMProviderType> = {
  openai: LLMProviderType.OPENAI,
  anthropic: LLMProviderType.ANTHROPIC,
  google: LLMProviderType.GOOGLE,
  groq: LLMProviderType.GROQ,
  deepinfra: LLMProviderType.DEEPINFRA,
  ollama: LLMProviderType.OLLAMA,
  webllm: LLMProviderType.WEBLLM,
};

/**
 * Convert ConfigService metadata to legacy format
 */
function tolegacyMetadata(metadata: ConfigModelMetadata): ModelMetadata {
  return {
    provider: providerToLLMType[metadata.provider] ?? LLMProviderType.OPENAI,
    contextWindow: metadata.contextWindow,
    maxCompletionTokens: metadata.maxCompletionTokens,
    inputPricePer1k: metadata.pricing.inputPer1M / 1000,
    outputPricePer1k: metadata.pricing.outputPer1M / 1000,
    tier: determineTier(metadata),
    zeroDataRetention: metadata.zeroDataRetention,
    description: metadata.displayName,
    isReasoningModel: metadata.isReasoningModel,
  };
}

/**
 * Determine tier from metadata
 */
function determineTier(metadata: ConfigModelMetadata): ModelTier {
  const costPer1k = (metadata.pricing.inputPer1M + metadata.pricing.outputPer1M) / 2000;

  if (metadata.provider === 'ollama' || metadata.provider === 'webllm') return 'local';
  if (costPer1k < 0.0005) return 'fast';
  if (costPer1k < 0.005) return 'standard';
  return 'quality';
}

// ============================================================================
// MODEL REGISTRY - Bundled Defaults (Backward Compatibility)
// ============================================================================

/**
 * @deprecated Use ConfigService for dynamic pricing
 *
 * This is a bundled snapshot of model data for:
 * - Backward compatibility with existing code
 * - Offline operation
 * - Synchronous access when async is not possible
 *
 * For current pricing, use: await configService.getPricing(modelId)
 */
export const MODEL_REGISTRY: Record<string, ModelMetadata> = Object.fromEntries(
  Object.entries(BUNDLED_DEFAULTS.models).map(([id, metadata]) => [
    id,
    tolegacyMetadata(metadata),
  ])
);

// ============================================================================
// SYNC HELPER FUNCTIONS (Use Bundled Defaults)
// ============================================================================

/**
 * Get model metadata by name (sync, uses bundled defaults)
 * @deprecated Use configService.getModelMetadata() for dynamic data
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
 * Get context window for a model (sync, uses bundled defaults)
 */
export function getContextWindow(modelName: string, logger?: Logger): number {
  const metadata = getModelMetadata(modelName);
  if (metadata) {
    return metadata.contextWindow;
  }

  logger?.warn(`Unknown model '${modelName}' - using default 32K context window`);
  return 32768;
}

/**
 * Get max completion tokens for a model (sync, uses bundled defaults)
 */
export function getMaxCompletionTokens(modelName: string, logger?: Logger): number {
  const metadata = getModelMetadata(modelName);
  if (metadata) {
    return metadata.maxCompletionTokens;
  }

  logger?.warn(`Unknown model '${modelName}' - using default 4K max completion`);
  return 4096;
}

/**
 * Calculate cost from token usage (sync, uses bundled defaults)
 * @deprecated Use configService.getPricing() for current pricing
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
 * Get model pricing (sync, uses bundled defaults)
 * @deprecated Use configService.getPricing() for current pricing
 */
export function getModelPricing(modelName: string): ModelPricing {
  const metadata = getModelMetadata(modelName);
  if (metadata) {
    return {
      inputPer1k: metadata.inputPricePer1k,
      outputPer1k: metadata.outputPricePer1k,
    };
  }

  return { inputPer1k: 0.00015, outputPer1k: 0.0006 };
}

/**
 * Get all models for a provider (sync, uses bundled defaults)
 */
export function getModelsForProvider(provider: LLMProviderType): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, metadata]) => metadata.provider === provider)
    .map(([name]) => name);
}

/**
 * Get all models for a tier (sync, uses bundled defaults)
 */
export function getModelsForTier(tier: ModelTier): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([_, metadata]) => metadata.tier === tier)
    .map(([name]) => name);
}

/**
 * Get all zero data retention models (sync, uses bundled defaults)
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
 * Check if a model is a reasoning model
 */
export function isReasoningModel(modelName: string): boolean {
  const metadata = getModelMetadata(modelName);
  return metadata?.isReasoningModel ?? false;
}

/**
 * Get recommended model for a tier (sync, uses bundled defaults)
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
    if (preferZDR) {
      return getRecommendedModel(tier, false, preferredProvider);
    }
    if (preferredProvider) {
      return getRecommendedModel(tier, false);
    }
    return null;
  }

  candidates.sort((a, b) => {
    const costA = a[1].inputPricePer1k + a[1].outputPricePer1k;
    const costB = b[1].inputPricePer1k + b[1].outputPricePer1k;
    return costA - costB;
  });

  return candidates[0][0];
}

// ============================================================================
// ASYNC HELPER FUNCTIONS (Use ConfigService - Recommended)
// ============================================================================

/**
 * Get model metadata (async, uses ConfigService)
 */
export async function getModelMetadataAsync(modelName: string): Promise<ModelMetadata | null> {
  const metadata = await configService.getModelMetadata(modelName);
  if (!metadata) return null;
  return tolegacyMetadata(metadata);
}

/**
 * Calculate cost with current pricing (async, uses ConfigService)
 */
export async function calculateCostAsync(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const pricing = await configService.getPricing(modelName);
  return (inputTokens * pricing.inputPer1M + outputTokens * pricing.outputPer1M) / 1_000_000;
}

/**
 * Get model pricing (async, uses ConfigService)
 */
export async function getModelPricingAsync(modelName: string): Promise<ModelPricing> {
  const pricing = await configService.getPricing(modelName);
  return {
    inputPer1k: pricing.inputPer1M / 1000,
    outputPer1k: pricing.outputPer1M / 1000,
  };
}

/**
 * Get all models for a provider (async, uses ConfigService)
 */
export async function getModelsForProviderAsync(provider: string): Promise<string[]> {
  return configService.getModelsByProvider(provider as any);
}

// ============================================================================
// TIER CONFIGURATION (v13 Section 6.10)
// ============================================================================

/**
 * Model tier configuration (uses bundled defaults)
 * @deprecated Use configService.getConfig().tiers for dynamic configuration
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
