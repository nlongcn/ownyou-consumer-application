/**
 * ModelSelector - Multi-model selection for A/B testing
 *
 * Matches admin dashboard Stage3Panel style:
 * - Models grouped by provider in expanded grid
 * - Progress indicators per model
 * - No accordions - all visible
 * - Dynamic models from provider APIs
 */

import { useMemo } from 'react';
import type { ModelConfig, LLMProvider } from '@ownyou/ab-testing';
import { FALLBACK_MODELS } from '@ownyou/ab-testing';

interface ModelSelectorProps {
  selectedModels: ModelConfig[];
  onModelsChange: (models: ModelConfig[]) => void;
  /** Available models from dynamic fetching */
  availableModels?: ModelConfig[];
  /** Whether models are currently being fetched */
  modelsLoading?: boolean;
  maxSelection?: number;
  /** Progress per model: 'started' | 'completed' | 'error' */
  progress?: Map<string, 'started' | 'completed' | 'error'>;
  /** Disable all inputs when running */
  disabled?: boolean;
}

const providerNames: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  claude: 'Anthropic',
  gemini: 'Google',
  groq: 'Groq',
  deepinfra: 'DeepInfra',
  ollama: 'Ollama',
  webllm: 'WebLLM',
};

export function ModelSelector({
  selectedModels,
  onModelsChange,
  availableModels,
  modelsLoading = false,
  maxSelection = 4,
  progress,
  disabled = false,
}: ModelSelectorProps) {
  // Use dynamic models or fall back to static list
  const models = availableModels && availableModels.length > 0 ? availableModels : FALLBACK_MODELS;

  // Group models by provider dynamically
  const modelsByProvider = useMemo(() => {
    return models.reduce<Record<LLMProvider, ModelConfig[]>>(
      (acc, model) => {
        const provider = model.provider;
        if (!acc[provider]) {
          acc[provider] = [];
        }
        acc[provider].push(model);
        return acc;
      },
      {} as Record<LLMProvider, ModelConfig[]>
    );
  }, [models]);

  const isSelected = (model: ModelConfig) =>
    selectedModels.some(
      (m) => m.provider === model.provider && m.model === model.model
    );

  const toggleModel = (model: ModelConfig) => {
    if (disabled) return;

    if (isSelected(model)) {
      onModelsChange(
        selectedModels.filter(
          (m) => !(m.provider === model.provider && m.model === model.model)
        )
      );
    } else if (selectedModels.length < maxSelection) {
      onModelsChange([...selectedModels, model]);
    }
  };

  const getModelKey = (model: ModelConfig) => `${model.provider}:${model.model}`;

  const getModelProgress = (model: ModelConfig) => {
    if (!progress) return null;
    return progress.get(getModelKey(model));
  };

  // Get list of providers that have models
  const providers = Object.keys(modelsByProvider) as LLMProvider[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Select Models to Compare ({selectedModels.length} selected)
        </h3>
        <span className="text-xs text-gray-500">
          Max {maxSelection} models
        </span>
      </div>

      {/* Loading state */}
      {modelsLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading available models from providers...
        </div>
      )}

      {/* Models grouped by provider - expanded grid (admin dashboard style) */}
      <div className="space-y-4">
        {providers.map((provider) => {
          const providerModels = modelsByProvider[provider];
          if (!providerModels || providerModels.length === 0) return null;

          return (
            <div
              key={provider}
              className="border border-gray-200 rounded-lg p-3"
            >
              <div className="font-medium text-gray-700 mb-2">
                {providerNames[provider] || provider}
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({providerModels.length} model{providerModels.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {providerModels.map((model) => {
                  const modelProgress = getModelProgress(model);
                  const selected = isSelected(model);
                  return (
                    <label
                      key={getModelKey(model)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors
                        ${selected ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 hover:bg-gray-100'}
                        ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleModel(model)}
                        disabled={disabled || (!selected && selectedModels.length >= maxSelection)}
                        className="rounded text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm flex-1">{model.displayName}</span>

                      {/* Progress indicators */}
                      {modelProgress === 'started' && (
                        <svg className="animate-spin h-4 w-4 text-orange-500" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {modelProgress === 'completed' && (
                        <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {modelProgress === 'error' && (
                        <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* No models available */}
      {!modelsLoading && providers.length === 0 && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          No models available. Please configure API keys in your .env file.
        </div>
      )}
    </div>
  );
}
