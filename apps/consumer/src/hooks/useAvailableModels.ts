/**
 * useAvailableModels Hook
 *
 * React hook for fetching and caching available LLM models.
 * Fetches dynamically from provider APIs (in Tauri) or uses
 * filtered fallback (in PWA).
 *
 * Features:
 * - Automatic loading on mount
 * - 5-minute cache (handled by fetch-models.ts)
 * - Loading and error states
 * - Manual refresh capability
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ModelConfig, LLMProvider } from '@ownyou/ab-testing';
import { FALLBACK_MODELS } from '@ownyou/ab-testing';
import {
  fetchAvailableModels,
  clearModelsCache,
  getConfiguredProviders,
  groupModelsByProvider,
} from '../utils/fetch-models';

interface UseAvailableModelsResult {
  /** Available models (filtered by configured API keys) */
  models: ModelConfig[];
  /** Models grouped by provider */
  modelsByProvider: Record<LLMProvider, ModelConfig[]>;
  /** List of providers with available models */
  providers: LLMProvider[];
  /** Whether models are currently being fetched */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Which providers have API keys configured */
  configuredProviders: Record<string, boolean>;
  /** Manually refresh the models list */
  refresh: () => Promise<void>;
  /** Get models for a specific provider */
  getModelsForProvider: (provider: LLMProvider) => ModelConfig[];
}

export function useAvailableModels(): UseAvailableModelsResult {
  const [models, setModels] = useState<ModelConfig[]>(FALLBACK_MODELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configuredProviders = useMemo(() => getConfiguredProviders(), []);

  const loadModels = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      if (forceRefresh) {
        clearModelsCache();
      }
      const fetched = await fetchAvailableModels(forceRefresh);
      setModels(fetched);
      console.log('[useAvailableModels] Loaded', fetched.length, 'models');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch models';
      setError(message);
      console.error('[useAvailableModels] Error:', message);
      // Keep using current models (either previous fetch or FALLBACK_MODELS)
    } finally {
      setLoading(false);
    }
  }, []);

  // Load models on mount
  useEffect(() => {
    loadModels(false);
  }, [loadModels]);

  // Memoized derived data
  const modelsByProvider = useMemo(
    () => groupModelsByProvider(models),
    [models]
  );

  const providers = useMemo(
    () => [...new Set(models.map(m => m.provider))] as LLMProvider[],
    [models]
  );

  const getModelsForProvider = useCallback(
    (provider: LLMProvider) => models.filter(m => m.provider === provider),
    [models]
  );

  const refresh = useCallback(async () => {
    await loadModels(true);
  }, [loadModels]);

  return {
    models,
    modelsByProvider,
    providers,
    loading,
    error,
    configuredProviders,
    refresh,
    getModelsForProvider,
  };
}
