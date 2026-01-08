/**
 * OpenRouter Data Source - v13 Section 6.10
 *
 * Fallback source for LLM pricing data.
 * Real-time, 400+ models, CORS-friendly.
 *
 * @see https://openrouter.ai/docs/api/api-reference/models/get-models
 */

import type {
  LLMProviderConfig,
  OpenRouterResponse,
  ModelMetadata,
  FallbackModel,
  Provider,
} from '../types';
import { BUNDLED_DEFAULTS, OPENROUTER_URL } from '../defaults';

/**
 * Extract provider from OpenRouter model ID (format: "provider/model")
 */
const extractProvider = (modelId: string): Provider | null => {
  const prefix = modelId.split('/')[0]?.toLowerCase();

  const prefixToProvider: Record<string, Provider> = {
    openai: 'openai',
    anthropic: 'anthropic',
    google: 'google',
    'meta-llama': 'deepinfra',
    mistralai: 'deepinfra',
    qwen: 'deepinfra',
    deepseek: 'deepinfra',
    groq: 'groq',
  };

  return prefixToProvider[prefix] ?? null;
};

/**
 * Extract model name from OpenRouter ID
 */
const extractModelName = (modelId: string): string => {
  // OpenRouter format: "provider/model-name"
  const parts = modelId.split('/');
  return parts[parts.length - 1] ?? modelId;
};

/**
 * Get context window (OpenRouter provides this)
 */
const getContextWindow = (contextLength: number | undefined, modelId: string): number => {
  if (contextLength && contextLength > 0) {
    return contextLength;
  }

  // Check bundled defaults
  const shortId = extractModelName(modelId);
  if (BUNDLED_DEFAULTS.models[shortId]) {
    return BUNDLED_DEFAULTS.models[shortId].contextWindow;
  }

  return 32000;
};

/**
 * Get max completion tokens
 */
const getMaxCompletionTokens = (modelId: string): number => {
  const shortId = extractModelName(modelId);
  if (BUNDLED_DEFAULTS.models[shortId]) {
    return BUNDLED_DEFAULTS.models[shortId].maxCompletionTokens;
  }

  if (modelId.includes('o1') || modelId.includes('o3')) return 65536;
  if (modelId.includes('gpt-4o')) return 16384;
  if (modelId.includes('claude')) return 8192;

  return 4096;
};

/**
 * Determine if model is a reasoning model
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
 * Parse pricing string to number (OpenRouter uses strings)
 */
const parsePricing = (priceStr: string): number => {
  const price = parseFloat(priceStr);
  if (isNaN(price)) return 0;
  // OpenRouter pricing is per token, convert to per 1M tokens
  return price * 1_000_000;
};

/**
 * Transform OpenRouter response to our config format
 */
const transformOpenRouterResponse = (response: OpenRouterResponse): LLMProviderConfig => {
  const models: Record<string, ModelMetadata> = {};
  const fallbackModels: FallbackModel[] = [];
  const providerModels: Record<string, string[]> = {};

  for (const model of response.data) {
    const provider = extractProvider(model.id);
    if (!provider) continue; // Skip unknown providers

    // Use short model name as key (e.g., "gpt-4o-mini" not "openai/gpt-4o-mini")
    const shortId = extractModelName(model.id);

    models[shortId] = {
      id: shortId,
      provider,
      displayName: model.name || shortId,
      contextWindow: getContextWindow(model.context_length, model.id),
      maxCompletionTokens: getMaxCompletionTokens(model.id),
      pricing: {
        inputPer1M: parsePricing(model.pricing?.prompt ?? '0'),
        outputPer1M: parsePricing(model.pricing?.completion ?? '0'),
      },
      capabilities: [],
      zeroDataRetention: isZeroDataRetention(provider),
      isReasoningModel: isReasoningModel(model.id),
    };

    // Track for fallback selection
    if (!providerModels[provider]) {
      providerModels[provider] = [];
    }
    providerModels[provider].push(shortId);
  }

  // Pick first model from each provider for fallbacks
  for (const [provider, modelIds] of Object.entries(providerModels)) {
    if (modelIds.length > 0) {
      const modelId = modelIds[0];
      const metadata = models[modelId];
      if (metadata) {
        fallbackModels.push({
          provider,
          model: modelId,
          displayName: metadata.displayName,
        });
      }
    }
  }

  return {
    timestamp: Date.now(),
    source: 'openrouter',
    models,
    tiers: BUNDLED_DEFAULTS.tiers,
    fallbackModels:
      fallbackModels.length > 0 ? fallbackModels : BUNDLED_DEFAULTS.fallbackModels,
  };
};

/**
 * Fetch configuration from OpenRouter
 *
 * @throws Error if fetch fails
 */
export const fetchFromOpenRouter = async (): Promise<LLMProviderConfig> => {
  const response = await fetch(OPENROUTER_URL, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}: ${response.statusText}`);
  }

  const data: OpenRouterResponse = await response.json();

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('Invalid response format from OpenRouter');
  }

  return transformOpenRouterResponse(data);
};
