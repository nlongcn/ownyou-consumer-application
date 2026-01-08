/**
 * llm-prices.com Data Source - v13 Section 6.10
 *
 * Primary source for LLM pricing data.
 * Community-maintained, CORS-friendly, no auth required.
 *
 * @see https://www.llm-prices.com/
 * @see https://github.com/simonw/llm-prices
 */

import type {
  LLMProviderConfig,
  LLMPricesResponse,
  ModelMetadata,
  FallbackModel,
  Provider,
} from '../types';
import { BUNDLED_DEFAULTS, LLM_PRICES_URL } from '../defaults';

/**
 * Map vendor names from llm-prices.com to our Provider type
 */
const VENDOR_TO_PROVIDER: Record<string, Provider> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  groq: 'groq',
  deepinfra: 'deepinfra',
  together: 'deepinfra', // Map Together AI to deepinfra for simplicity
  mistral: 'deepinfra',
  cohere: 'deepinfra',
};

/**
 * Known context windows (llm-prices.com doesn't provide this)
 * Fallback to bundled defaults or 32k
 */
const getContextWindow = (modelId: string): number => {
  // Check bundled defaults first
  if (BUNDLED_DEFAULTS.models[modelId]) {
    return BUNDLED_DEFAULTS.models[modelId].contextWindow;
  }

  // Provider-specific defaults
  if (modelId.includes('gemini')) return 1000000;
  if (modelId.includes('claude')) return 200000;
  if (modelId.includes('gpt-4o') || modelId.includes('o1') || modelId.includes('o3')) return 128000;
  if (modelId.includes('llama')) return 128000;

  return 32000; // Safe fallback
};

/**
 * Get max completion tokens for a model
 */
const getMaxCompletionTokens = (modelId: string): number => {
  if (BUNDLED_DEFAULTS.models[modelId]) {
    return BUNDLED_DEFAULTS.models[modelId].maxCompletionTokens;
  }

  if (modelId.includes('o1') || modelId.includes('o3')) return 65536;
  if (modelId.includes('gpt-4o')) return 16384;
  if (modelId.includes('claude')) return 8192;

  return 4096;
};

/**
 * Determine if a model is a reasoning model
 */
const isReasoningModel = (modelId: string): boolean => {
  return (
    modelId.includes('o1') ||
    modelId.includes('o3') ||
    modelId.includes('deepseek-r1') ||
    modelId.includes('reasoning')
  );
};

/**
 * Determine if provider has zero data retention
 */
const isZeroDataRetention = (provider: Provider): boolean => {
  return provider === 'groq' || provider === 'deepinfra' || provider === 'ollama';
};

/**
 * Create display name from model ID
 */
const createDisplayName = (modelId: string, _vendor: string): string => {
  // Use bundled display name if available
  if (BUNDLED_DEFAULTS.models[modelId]) {
    return BUNDLED_DEFAULTS.models[modelId].displayName;
  }

  // Generate from model ID
  const cleaned = modelId
    .replace(/^(openai\/|anthropic\/|google\/|meta-llama\/)/, '')
    .replace(/-/g, ' ')
    .replace(/(\d+)b/gi, '$1B')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return cleaned;
};

/**
 * Transform llm-prices.com response to our config format
 */
const transformLLMPricesResponse = (response: LLMPricesResponse): LLMProviderConfig => {
  const models: Record<string, ModelMetadata> = {};
  const fallbackModels: FallbackModel[] = [];

  for (const price of response.prices) {
    const provider = VENDOR_TO_PROVIDER[price.vendor];
    if (!provider) continue; // Skip unknown vendors

    const modelId = price.id;
    const displayName = createDisplayName(modelId, price.vendor);

    models[modelId] = {
      id: modelId,
      provider,
      displayName,
      contextWindow: getContextWindow(modelId),
      maxCompletionTokens: getMaxCompletionTokens(modelId),
      pricing: {
        inputPer1M: price.input,
        outputPer1M: price.output,
        cachedInputPer1M: price.input_cached ?? undefined,
      },
      capabilities: [], // Not provided by llm-prices.com
      zeroDataRetention: isZeroDataRetention(provider),
      isReasoningModel: isReasoningModel(modelId),
    };
  }

  // Create fallback models from top models per provider
  const providerModels: Record<string, string[]> = {};
  for (const [modelId, metadata] of Object.entries(models)) {
    if (!providerModels[metadata.provider]) {
      providerModels[metadata.provider] = [];
    }
    providerModels[metadata.provider].push(modelId);
  }

  // Pick first model from each provider for fallbacks
  for (const [provider, modelIds] of Object.entries(providerModels)) {
    if (modelIds.length > 0) {
      const modelId = modelIds[0];
      fallbackModels.push({
        provider,
        model: modelId,
        displayName: models[modelId].displayName,
      });
    }
  }

  return {
    timestamp: new Date(response.updated_at).getTime(),
    source: 'llm-prices.com',
    models,
    tiers: BUNDLED_DEFAULTS.tiers, // Use bundled tier config
    fallbackModels:
      fallbackModels.length > 0 ? fallbackModels : BUNDLED_DEFAULTS.fallbackModels,
  };
};

/**
 * Fetch configuration from llm-prices.com
 *
 * @throws Error if fetch fails
 */
export const fetchFromLLMPrices = async (): Promise<LLMProviderConfig> => {
  const response = await fetch(LLM_PRICES_URL, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`llm-prices.com returned ${response.status}: ${response.statusText}`);
  }

  const data: LLMPricesResponse = await response.json();

  if (!data.prices || !Array.isArray(data.prices)) {
    throw new Error('Invalid response format from llm-prices.com');
  }

  return transformLLMPricesResponse(data);
};
