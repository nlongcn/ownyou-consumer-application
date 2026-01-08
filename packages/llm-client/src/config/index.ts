/**
 * LLM Configuration Module - v13 Section 6.10
 *
 * Dynamic configuration for LLM models and pricing.
 *
 * @example
 * ```typescript
 * import { configService, type ModelMetadata } from '@ownyou/llm-client';
 *
 * const pricing = await configService.getPricing('gpt-4o-mini');
 * const models = await configService.getModelsByProvider('openai');
 * ```
 */

// Main service (singleton)
export { configService, ConfigServiceImpl } from './ConfigService';

// Types
export type {
  Provider,
  Tier,
  ModelPricing,
  ModelMetadata,
  TierConfig,
  FallbackModel,
  LLMProviderConfig,
  CacheStatus,
  CachedConfig,
} from './types';

// Constants (for testing/reference only)
export { DEFAULT_CACHE_TTL_MS, LLM_PRICES_URL, OPENROUTER_URL } from './defaults';

// Source fetchers (for testing/advanced use)
export { fetchFromLLMPrices } from './sources/llmPrices';
export { fetchFromOpenRouter } from './sources/openRouter';
