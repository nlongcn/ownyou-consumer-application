/**
 * Dynamic Model Fetching for A/B Testing
 *
 * Fetches available models from LLM provider APIs.
 * - In Tauri mode: Direct API calls (no CORS restrictions)
 * - In PWA mode: Falls back to static list (CORS blocks provider APIs)
 *
 * Matches admin dashboard behavior from /api/analyze/models
 */

import type { ModelConfig, LLMProvider } from '@ownyou/ab-testing';
import { FALLBACK_MODELS } from '@ownyou/ab-testing';
import { getPlatform } from './platform';

// 5-minute cache (same as admin dashboard)
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedModels {
  models: ModelConfig[];
  timestamp: number;
}

let modelsCache: CachedModels | null = null;

/**
 * Fallback model lists per provider (from admin dashboard)
 * Used when API fetch fails or in PWA mode
 */
const PROVIDER_FALLBACKS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
  deepinfra: ['meta-llama/Llama-3.3-70B-Instruct', 'meta-llama/Llama-3.1-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'],
  ollama: [], // Only populated if Ollama is running locally
};

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
      return PROVIDER_FALLBACKS.openai;
    }

    const data = await response.json();
    const models = data.data
      .filter((m: { id: string }) =>
        m.id.includes('gpt') &&
        !m.id.includes('instruct') &&
        !m.id.includes('realtime') &&
        !m.id.includes('audio')
      )
      .map((m: { id: string }) => m.id)
      .sort()
      .reverse(); // Newest first

    console.log('[FetchModels] OpenAI models loaded:', models.length);
    return models.length > 0 ? models : PROVIDER_FALLBACKS.openai;
  } catch (error) {
    console.warn('[FetchModels] OpenAI fetch error:', error);
    return PROVIDER_FALLBACKS.openai;
  }
}

async function fetchAnthropicModels(): Promise<string[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  // Anthropic's API doesn't support CORS - browser requests are always blocked
  // Even Tauri's webview triggers CORS preflight checks that Anthropic rejects
  // So we always use the fallback list when API key is configured
  console.log('[FetchModels] Anthropic: Using fallback (API does not support CORS)');
  return PROVIDER_FALLBACKS.anthropic;
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
      return PROVIDER_FALLBACKS.groq;
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
    return models.length > 0 ? models : PROVIDER_FALLBACKS.groq;
  } catch (error) {
    console.warn('[FetchModels] Groq fetch error:', error);
    return PROVIDER_FALLBACKS.groq;
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
      return PROVIDER_FALLBACKS.deepinfra;
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
    return models.length > 0 ? models : PROVIDER_FALLBACKS.deepinfra;
  } catch (error) {
    console.warn('[FetchModels] DeepInfra fetch error:', error);
    return PROVIDER_FALLBACKS.deepinfra;
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

// Google doesn't have a public models API, so we use fallback
function getGoogleModels(): string[] {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  if (!apiKey) return [];
  return PROVIDER_FALLBACKS.google;
}

/**
 * Fetch all available models from configured providers
 */
async function fetchFromProviderAPIs(): Promise<ModelConfig[]> {
  const configured = getConfiguredProviders();
  const models: ModelConfig[] = [];

  console.log('[FetchModels] Configured providers:', configured);

  // Fetch from all configured providers in parallel
  const results = await Promise.allSettled([
    configured.openai ? fetchOpenAIModels() : Promise.resolve([]),
    configured.anthropic ? fetchAnthropicModels() : Promise.resolve([]),
    configured.groq ? fetchGroqModels() : Promise.resolve([]),
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

  // Google models (no API, use fallback if key exists)
  if (configured.google) {
    for (const model of getGoogleModels()) {
      models.push({
        provider: 'gemini' as LLMProvider,
        model,
        displayName: getDisplayName('google', model),
      });
    }
  }

  // Groq models
  if (results[2].status === 'fulfilled' && results[2].value.length > 0) {
    for (const model of results[2].value) {
      models.push({
        provider: 'groq' as LLMProvider,
        model,
        displayName: getDisplayName('groq', model),
      });
    }
  }

  // DeepInfra models
  if (results[3].status === 'fulfilled' && results[3].value.length > 0) {
    for (const model of results[3].value) {
      models.push({
        provider: 'deepinfra' as LLMProvider,
        model,
        displayName: getDisplayName('deepinfra', model),
      });
    }
  }

  // Ollama models
  if (results[4].status === 'fulfilled' && results[4].value.length > 0) {
    for (const model of results[4].value) {
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
 * Main function: Fetch available models with platform awareness
 *
 * - Tauri: Direct API calls to providers
 * - PWA: Returns fallback models (CORS blocks direct API calls)
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

  const platform = getPlatform();
  console.log('[FetchModels] Fetching models for platform:', platform);

  let models: ModelConfig[];

  if (platform === 'tauri') {
    // Tauri: Direct API calls work
    try {
      models = await fetchFromProviderAPIs();
      if (models.length === 0) {
        console.warn('[FetchModels] No models from APIs, using fallback');
        models = FALLBACK_MODELS;
      }
    } catch (error) {
      console.error('[FetchModels] API fetch failed, using fallback:', error);
      models = FALLBACK_MODELS;
    }
  } else {
    // PWA: CORS blocks direct API calls
    // Filter FALLBACK_MODELS to only include providers with API keys configured
    const configured = getConfiguredProviders();
    models = FALLBACK_MODELS.filter(m => {
      const providerKey = m.provider === 'claude' ? 'anthropic' :
                          m.provider === 'gemini' ? 'google' : m.provider;
      return configured[providerKey];
    });

    if (models.length === 0) {
      console.warn('[FetchModels] No providers configured, using full fallback');
      models = FALLBACK_MODELS;
    }

    console.log('[FetchModels] PWA mode - using filtered fallback models:', models.length);
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
