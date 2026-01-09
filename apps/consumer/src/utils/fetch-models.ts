/**
 * Dynamic Model Fetching for A/B Testing
 *
 * Fetches available models DIRECTLY from LLM provider APIs.
 * This ensures we always have correct, up-to-date model IDs that work with the APIs.
 *
 * Provider API endpoints:
 * - OpenAI: GET /v1/models
 * - Anthropic: GET /v1/models (requires anthropic-dangerous-direct-browser-access header)
 * - Google: GET /v1beta/models
 * - Groq: GET /openai/v1/models
 * - DeepSeek: GET /v1/models
 *
 * Pricing data comes separately from llm-prices.com via ConfigService.
 * Model IDs from provider APIs are authoritative - no static lists maintained.
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

import type { ModelConfig, LLMProvider } from '@ownyou/ab-testing';
import { configService, type Provider } from '@ownyou/llm-client';

// 5-minute cache for API-fetched models (ConfigService has its own 24h cache)
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedModels {
  models: ModelConfig[];
  timestamp: number;
}

let modelsCache: CachedModels | null = null;

/**
 * Get fallback models from ConfigService
 * Dynamic data from llm-prices.com/OpenRouter, with bundled defaults offline
 */
async function getProviderFallbacks(provider: string): Promise<string[]> {
  const configProvider = mapToConfigProvider(provider);
  if (!configProvider) return [];

  try {
    return await configService.getModelsByProvider(configProvider);
  } catch (error) {
    console.warn(`[FetchModels] ConfigService fallback failed for ${provider}:`, error);
    return [];
  }
}

/**
 * Map provider names to ConfigService Provider type
 */
function mapToConfigProvider(provider: string): Provider | null {
  const mapping: Record<string, Provider> = {
    openai: 'openai',
    anthropic: 'anthropic',
    google: 'google',
    groq: 'groq',
    deepinfra: 'deepinfra',
    ollama: 'ollama',
  };
  return mapping[provider] ?? null;
}

/**
 * Get display name for a model
 */
function getDisplayName(provider: string, modelId: string): string {
  // Handle common model name transformations
  const id = modelId.toLowerCase();

  // OpenAI
  if (id.includes('gpt-4o-mini')) return 'GPT-4o Mini';
  if (id.includes('gpt-4o')) return 'GPT-4o';
  if (id.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
  if (id.includes('gpt-4')) return 'GPT-4';
  if (id.includes('gpt-3.5-turbo')) return 'GPT-3.5 Turbo';

  // Anthropic
  if (id.includes('claude-sonnet-4')) return 'Claude Sonnet 4';
  if (id.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet';
  if (id.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet';
  if (id.includes('claude-3-5-haiku')) return 'Claude 3.5 Haiku';
  if (id.includes('claude-3-opus')) return 'Claude 3 Opus';

  // Google
  if (id.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro';
  if (id.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  if (id.includes('gemini-2.0-flash')) return 'Gemini 2.0 Flash';
  if (id.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro';
  if (id.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash';

  // Groq/DeepInfra - Llama models
  if (id.includes('llama-3.3-70b')) return `Llama 3.3 70B (${provider})`;
  if (id.includes('llama-3.1-70b')) return `Llama 3.1 70B (${provider})`;
  if (id.includes('mixtral')) return `Mixtral 8x7B (${provider})`;
  if (id.includes('qwen')) return `Qwen 2.5 72B (${provider})`;

  // Default: capitalize and clean up
  return modelId
    .split(/[-_/]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Check which API keys are configured
 */
export function getConfiguredProviders(): Record<string, boolean> {
  return {
    openai: !!import.meta.env.VITE_OPENAI_API_KEY,
    anthropic: !!import.meta.env.VITE_ANTHROPIC_API_KEY,
    google: !!import.meta.env.VITE_GOOGLE_API_KEY,
    groq: !!import.meta.env.VITE_GROQ_API_KEY,
    deepseek: !!import.meta.env.VITE_DEEPSEEK_API_KEY,
    deepinfra: !!import.meta.env.VITE_DEEPINFRA_API_KEY,
    ollama: !!import.meta.env.VITE_OLLAMA_BASE_URL,
  };
}

// --- Provider-specific fetch functions ---

async function fetchOpenAIModels(): Promise<string[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('[FetchModels] OpenAI API failed:', response.status);
      return getProviderFallbacks('openai');
    }

    const data = await response.json();
    // Use WHITELIST approach - only include CURRENT chat model patterns
    // OpenAI has many model types (TTS, STT, image, embedding, etc.)
    // We ONLY want current chat model families (no deprecated/legacy models):
    const CHAT_MODEL_PATTERNS = [
      'gpt-4o-mini',        // GPT-4o Mini (current)
      'gpt-4o-2',           // GPT-4o dated versions (gpt-4o-2024-*, gpt-4o-2025-*)
      'gpt-4o',             // GPT-4o base (current)
      'chatgpt-4o',         // ChatGPT variant (current)
      'o1-',                // O1 reasoning models (o1-preview, o1-mini)
      'o3-',                // O3 reasoning models
      'o4-',                // O4 reasoning models (future-proofing)
    ];
    // REMOVED (deprecated/legacy):
    // - 'gpt-4-turbo'     - superseded by gpt-4o
    // - 'gpt-4-0'         - old dated versions (gpt-4-0613, etc.)
    // - 'gpt-4-1'         - old dated versions (gpt-4-1106-preview, etc.)
    // - 'gpt-3.5-turbo'   - deprecated by OpenAI

    // Non-chat model types to exclude (even if they match whitelist patterns)
    const NON_CHAT_EXCLUSIONS = [
      'tts',          // Text-to-speech (gpt-4o-mini-tts-*)
      'transcribe',   // Speech-to-text (gpt-4o-mini-transcribe-*)
      'realtime',     // Realtime API models
      'audio',        // Audio models
      'image',        // Image generation
      'whisper',      // Speech recognition
      'embedding',    // Embedding models
      'search',       // Search preview models (gpt-4o-mini-search-preview-*)
    ];

    const models = data.data
      .filter((m: { id: string }) => {
        const id = m.id.toLowerCase();
        // Must match one of our known chat model patterns
        if (!CHAT_MODEL_PATTERNS.some(pattern => id.includes(pattern))) {
          return false;
        }
        // Exclude non-chat model types even if they match patterns above
        if (NON_CHAT_EXCLUSIONS.some(excl => id.includes(excl))) {
          return false;
        }
        return true;
      })
      .map((m: { id: string }) => m.id)
      .sort()
      .reverse(); // Newest first

    console.log('[FetchModels] OpenAI models loaded:', models.length);
    if (models.length > 0) return models;
    return getProviderFallbacks('openai');
  } catch (error) {
    console.warn('[FetchModels] OpenAI fetch error:', error);
    return getProviderFallbacks('openai');
  }
}

async function fetchAnthropicModels(): Promise<string[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  try {
    // Anthropic supports CORS with the anthropic-dangerous-direct-browser-access header
    // This is safe for OwnYou because users bring their own API keys (BYOKey pattern)
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('[FetchModels] Anthropic API failed:', response.status);
      return [];
    }

    const data = await response.json();
    // Filter to chat models only (exclude legacy completion models)
    const models = data.data
      .filter((m: { id: string; type?: string }) =>
        m.id.includes('claude') &&
        !m.id.includes('instant') // exclude legacy instant models
      )
      .map((m: { id: string }) => m.id)
      .sort()
      .reverse(); // Newest first

    console.log('[FetchModels] Anthropic models loaded:', models.length, models);
    return models;
  } catch (error) {
    console.warn('[FetchModels] Anthropic fetch error:', error);
    return [];
  }
}

async function fetchGroqModels(): Promise<string[]> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('[FetchModels] Groq API failed:', response.status);
      return getProviderFallbacks('groq');
    }

    const data = await response.json();
    const models = data.data
      .map((m: { id: string }) => m.id)
      .filter((id: string) =>
        id.includes('llama') ||
        id.includes('mixtral') ||
        id.includes('gemma')
      )
      .sort();

    console.log('[FetchModels] Groq models loaded:', models.length);
    if (models.length > 0) return models;
    return getProviderFallbacks('groq');
  } catch (error) {
    console.warn('[FetchModels] Groq fetch error:', error);
    return getProviderFallbacks('groq');
  }
}

async function fetchDeepInfraModels(): Promise<string[]> {
  const apiKey = import.meta.env.VITE_DEEPINFRA_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.deepinfra.com/v1/openai/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('[FetchModels] DeepInfra API failed:', response.status);
      return getProviderFallbacks('deepinfra');
    }

    const data = await response.json();
    const models = data.data
      .map((m: { id: string }) => m.id)
      .filter((id: string) =>
        id.includes('Llama') ||
        id.includes('Qwen') ||
        id.includes('Mixtral') ||
        id.includes('DeepSeek')
      )
      .sort();

    console.log('[FetchModels] DeepInfra models loaded:', models.length);
    if (models.length > 0) return models;
    return getProviderFallbacks('deepinfra');
  } catch (error) {
    console.warn('[FetchModels] DeepInfra fetch error:', error);
    return getProviderFallbacks('deepinfra');
  }
}

async function fetchOllamaModels(): Promise<string[]> {
  const baseUrl = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000), // Shorter timeout for local service
    });

    if (!response.ok) {
      console.warn('[FetchModels] Ollama not available');
      return [];
    }

    const data = await response.json();
    const models = data.models?.map((m: { name: string }) => m.name) || [];

    console.log('[FetchModels] Ollama models loaded:', models.length);
    return models;
  } catch (error) {
    // Ollama is optional - don't log as error
    console.log('[FetchModels] Ollama not running (this is OK)');
    return [];
  }
}

async function fetchGoogleModels(): Promise<string[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  if (!apiKey) return [];

  try {
    // Google Generative AI models API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      console.warn('[FetchModels] Google API failed:', response.status);
      return [];
    }

    const data = await response.json();
    // Filter to generative models that support generateContent
    const models = data.models
      .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
        m.name.includes('gemini') &&
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: { name: string }) => m.name.replace('models/', '')) // Remove 'models/' prefix
      .sort()
      .reverse();

    console.log('[FetchModels] Google models loaded:', models.length, models);
    return models;
  } catch (error) {
    console.warn('[FetchModels] Google fetch error:', error);
    return [];
  }
}

async function fetchDeepSeekModels(): Promise<string[]> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey) return [];

  try {
    // DeepSeek uses OpenAI-compatible API
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('[FetchModels] DeepSeek API failed:', response.status);
      return [];
    }

    const data = await response.json();
    const models = data.data
      .filter((m: { id: string }) =>
        m.id.includes('deepseek') &&
        !m.id.includes('code') // Filter out code-specific models for chat
      )
      .map((m: { id: string }) => m.id)
      .sort()
      .reverse();

    console.log('[FetchModels] DeepSeek models loaded:', models.length, models);
    return models;
  } catch (error) {
    console.warn('[FetchModels] DeepSeek fetch error:', error);
    return [];
  }
}

/**
 * Fetch all available models from configured providers
 * All providers support browser CORS - no need for Tauri/PWA distinction
 */
async function fetchFromProviderAPIs(): Promise<ModelConfig[]> {
  const configured = getConfiguredProviders();
  const models: ModelConfig[] = [];

  console.log('[FetchModels] Configured providers:', configured);

  // Fetch from all configured providers in parallel
  // All providers support browser CORS (Anthropic requires special header, which we handle)
  const results = await Promise.allSettled([
    configured.openai ? fetchOpenAIModels() : Promise.resolve([]),
    configured.anthropic ? fetchAnthropicModels() : Promise.resolve([]),
    configured.google ? fetchGoogleModels() : Promise.resolve([]),
    configured.groq ? fetchGroqModels() : Promise.resolve([]),
    configured.deepseek ? fetchDeepSeekModels() : Promise.resolve([]),
    configured.deepinfra ? fetchDeepInfraModels() : Promise.resolve([]),
    configured.ollama ? fetchOllamaModels() : Promise.resolve([]),
  ]);

  // OpenAI models
  if (results[0].status === 'fulfilled' && results[0].value.length > 0) {
    for (const model of results[0].value) {
      models.push({
        provider: 'openai' as LLMProvider,
        model,
        displayName: getDisplayName('openai', model),
      });
    }
  }

  // Anthropic models
  if (results[1].status === 'fulfilled' && results[1].value.length > 0) {
    for (const model of results[1].value) {
      models.push({
        provider: 'claude' as LLMProvider,
        model,
        displayName: getDisplayName('anthropic', model),
      });
    }
  }

  // Google models
  if (results[2].status === 'fulfilled' && results[2].value.length > 0) {
    for (const model of results[2].value) {
      models.push({
        provider: 'gemini' as LLMProvider,
        model,
        displayName: getDisplayName('google', model),
      });
    }
  }

  // Groq models
  if (results[3].status === 'fulfilled' && results[3].value.length > 0) {
    for (const model of results[3].value) {
      models.push({
        provider: 'groq' as LLMProvider,
        model,
        displayName: getDisplayName('groq', model),
      });
    }
  }

  // DeepSeek models
  if (results[4].status === 'fulfilled' && results[4].value.length > 0) {
    for (const model of results[4].value) {
      models.push({
        provider: 'deepseek' as LLMProvider,
        model,
        displayName: getDisplayName('deepseek', model),
      });
    }
  }

  // DeepInfra models
  if (results[5].status === 'fulfilled' && results[5].value.length > 0) {
    for (const model of results[5].value) {
      models.push({
        provider: 'deepinfra' as LLMProvider,
        model,
        displayName: getDisplayName('deepinfra', model),
      });
    }
  }

  // Ollama models
  if (results[6].status === 'fulfilled' && results[6].value.length > 0) {
    for (const model of results[6].value) {
      models.push({
        provider: 'ollama' as LLMProvider,
        model,
        displayName: getDisplayName('ollama', model),
      });
    }
  }

  return models;
}

/**
 * Convert ConfigService fallback model to ModelConfig
 */
function toModelConfig(fallback: { provider: string; model: string; displayName: string }): ModelConfig {
  // Map ConfigService provider names to LLMProvider
  const providerMap: Record<string, LLMProvider> = {
    openai: 'openai',
    anthropic: 'claude',
    google: 'gemini',
    groq: 'groq',
    deepinfra: 'deepinfra',
    ollama: 'ollama',
    webllm: 'webllm',
  };

  return {
    provider: providerMap[fallback.provider] ?? (fallback.provider as LLMProvider),
    model: fallback.model,
    displayName: fallback.displayName,
  };
}

/**
 * Get ConfigService fallback models as ModelConfig[] (curated list of 8)
 * Exported for potential future use in tests or other modules.
 */
export async function getConfigFallbackModels(): Promise<ModelConfig[]> {
  try {
    const fallbacks = await configService.getFallbackModels();
    return fallbacks.map(toModelConfig);
  } catch (error) {
    console.error('[FetchModels] Failed to get ConfigService fallbacks:', error);
    return [];
  }
}

/**
 * Get ALL models from ConfigService (100+ models from llm-prices.com or OpenRouter)
 * This returns ALL models in config.models, not just the curated fallbackModels list.
 */
async function getAllConfigServiceModels(): Promise<ModelConfig[]> {
  try {
    const config = await configService.getConfig();
    const models: ModelConfig[] = [];

    // Map ConfigService provider names to LLMProvider
    const providerMap: Record<string, LLMProvider> = {
      openai: 'openai',
      anthropic: 'claude',
      google: 'gemini',
      groq: 'groq',
      deepinfra: 'deepinfra',
      ollama: 'ollama',
    };

    for (const [modelId, metadata] of Object.entries(config.models)) {
      const provider = providerMap[metadata.provider] ?? (metadata.provider as LLMProvider);
      models.push({
        provider,
        model: modelId,
        displayName: metadata.displayName || getDisplayName(metadata.provider, modelId),
      });
    }

    console.log(`[FetchModels] ConfigService has ${models.length} models from ${config.source}`);
    return models;
  } catch (error) {
    console.error('[FetchModels] Failed to get ConfigService models:', error);
    return [];
  }
}

/**
 * Main function: Fetch available models from ConfigService (OpenRouter) + local providers
 *
 * ConfigService fetches from OpenRouter which has 400+ models with real-time
 * pricing data. We also fetch from Groq and Ollama directly since they're not
 * in OpenRouter but user may have API keys/local instance.
 *
 * Results are cached for 5 minutes.
 */
export async function fetchAvailableModels(forceRefresh = false): Promise<ModelConfig[]> {
  // Check cache
  if (!forceRefresh && modelsCache) {
    const age = Date.now() - modelsCache.timestamp;
    if (age < CACHE_TTL_MS) {
      console.log('[FetchModels] Using cached models (age: ' + Math.round(age / 1000) + 's)');
      return modelsCache.models;
    }
  }

  console.log('[FetchModels] Fetching models from ConfigService (OpenRouter) + Groq/Ollama');

  let models: ModelConfig[] = [];

  try {
    // PRIMARY: Use ConfigService which fetches from OpenRouter (dynamic, 400+ models)
    const configModels = await getAllConfigServiceModels();
    models.push(...configModels);
  } catch (error) {
    console.error('[FetchModels] ConfigService failed:', error);
  }

  // ALSO fetch from Groq and Ollama directly (not in OpenRouter)
  const configured = getConfiguredProviders();

  // Groq - separate API, not in OpenRouter
  if (configured.groq) {
    try {
      const groqModels = await fetchGroqModels();
      for (const model of groqModels) {
        models.push({
          provider: 'groq' as LLMProvider,
          model,
          displayName: getDisplayName('groq', model),
        });
      }
    } catch (error) {
      console.warn('[FetchModels] Groq fetch failed:', error);
    }
  }

  // Ollama - local instance, not in OpenRouter
  if (configured.ollama) {
    try {
      const ollamaModels = await fetchOllamaModels();
      for (const model of ollamaModels) {
        models.push({
          provider: 'ollama' as LLMProvider,
          model,
          displayName: getDisplayName('ollama', model),
        });
      }
    } catch (error) {
      console.warn('[FetchModels] Ollama fetch failed:', error);
    }
  }

  // Fallback to full provider API fetch if we got nothing
  if (models.length === 0) {
    console.warn('[FetchModels] No models from any source, falling back to provider APIs');
    models = await fetchFromProviderAPIs();
  }

  // Update cache
  modelsCache = {
    models,
    timestamp: Date.now(),
  };

  console.log('[FetchModels] Total models available:', models.length);
  return models;
}

/**
 * Clear the models cache
 */
export function clearModelsCache(): void {
  modelsCache = null;
  console.log('[FetchModels] Cache cleared');
}

/**
 * Get models grouped by provider
 */
export function groupModelsByProvider(models: ModelConfig[]): Record<LLMProvider, ModelConfig[]> {
  return models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<LLMProvider, ModelConfig[]>);
}
