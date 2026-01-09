import { useState, useMemo } from 'react'
import { ModelConfig, ModelResults, StageStatus, AVAILABLE_MODELS } from '../../lib/ab-testing/types'

interface Stage3PanelProps {
  status: StageStatus
  selectedModels: ModelConfig[]
  results: Map<string, ModelResults>
  sourceEmailCount: number
  onModelToggle: (model: ModelConfig) => void
  onClassify: () => Promise<void>
  onExport: () => void
  disabled?: boolean
  progress?: Map<string, 'started' | 'completed' | 'error'>
  availableModels?: ModelConfig[]  // Dynamic models from API
  modelsLoading?: boolean
}

export function Stage3Panel({
  status,
  selectedModels,
  results,
  sourceEmailCount,
  onModelToggle,
  onClassify,
  onExport,
  disabled = false,
  progress,
  availableModels = AVAILABLE_MODELS,
  modelsLoading: _modelsLoading = false,
}: Stage3PanelProps) {
  const [isClassifying, setIsClassifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Group models by provider (dynamic)
  const modelsByProvider = useMemo(() => {
    return availableModels.reduce((acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = []
      acc[model.provider].push(model)
      return acc
    }, {} as Record<string, ModelConfig[]>)
  }, [availableModels])

  const handleClassify = async () => {
    if (selectedModels.length === 0) {
      setError('Please select at least one model')
      return
    }

    setError(null)
    setIsClassifying(true)
    try {
      await onClassify()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed')
    } finally {
      setIsClassifying(false)
    }
  }

  const isModelSelected = (model: ModelConfig) =>
    selectedModels.some(m => m.provider === model.provider && m.model === model.model)

  const getModelKey = (model: ModelConfig) => `${model.provider}:${model.model}`

  const getModelProgress = (model: ModelConfig) => {
    if (!progress) return null
    return progress.get(getModelKey(model))
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${disabled ? 'opacity-50' : ''}`}>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">Stage 3</span>
        Classification & Comparison
      </h2>

      {disabled && (
        <div className="text-gray-500 mb-4">
          Complete Stage 2 to enable classification
        </div>
      )}

      {!disabled && (
        <>
          {/* Source info */}
          {sourceEmailCount > 0 && results.size === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
              <span className="text-gray-600">{sourceEmailCount} preprocessed emails ready for classification</span>
            </div>
          )}

          {/* Model selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Models to Compare ({selectedModels.length} selected)
            </label>
            <div className="space-y-4">
              {Object.entries(modelsByProvider).map(([provider, models]) => (
                <div key={provider} className="border rounded p-3">
                  <div className="font-medium text-gray-700 mb-2 capitalize">{provider}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {models.map(model => {
                      const modelProgress = getModelProgress(model)
                      return (
                        <label
                          key={model.model}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer
                            ${isModelSelected(model) ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 hover:bg-gray-100'}
                            ${status === 'running' ? 'cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isModelSelected(model)}
                            onChange={() => onModelToggle(model)}
                            disabled={status === 'running'}
                            className="rounded text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm">{model.displayName}</span>
                          {modelProgress === 'started' && (
                            <svg className="animate-spin h-4 w-4 text-orange-500 ml-auto" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                          {modelProgress === 'completed' && (
                            <svg className="h-4 w-4 text-green-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {modelProgress === 'error' && (
                            <svg className="h-4 w-4 text-red-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleClassify}
              disabled={isClassifying || selectedModels.length === 0}
              className="flex-1 bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isClassifying
                ? `Running ${selectedModels.length} models sequentially...`
                : `Run Classification (${selectedModels.length} models)`}
            </button>
          </div>

          {/* Mode indicator */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-700">
            <strong>Full Workflow Mode (Sprint 11d):</strong> Uses complete IAB classifier with
            Evidence Judge validation, 4 specialized analyzers, and Bayesian reconciliation.
            Models run sequentially for fair comparison.
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          {/* Results summary */}
          {results.size > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-green-700 font-medium">{results.size} models completed</span>
                  <p className="text-sm text-green-600 mt-1">
                    View results in the dashboard below
                  </p>
                </div>
                <button
                  onClick={onExport}
                  className="text-green-600 hover:text-green-800 underline text-sm"
                >
                  Export Stage 3 JSON
                </button>
              </div>
            </div>
          )}

          {/* Running indicator */}
          {status === 'running' && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running {selectedModels.length} models sequentially (full workflow)...
              </div>
              <div className="text-sm text-orange-600">
                Each model runs the complete 6-node classifier with Evidence Judge.
                This ensures fair comparison but takes longer than simple classification.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
