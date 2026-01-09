import { useState, useRef, useMemo } from 'react'
import { PreprocessedEmail, ModelConfig, StageStatus, Stage2Export, AVAILABLE_MODELS } from '../../lib/ab-testing/types'
import { exportStage2, importStage2 } from '../../lib/ab-testing/export-import'

interface Stage2PanelProps {
  status: StageStatus
  emails: PreprocessedEmail[]
  config: {
    summarizerModel: string
    summarizerProvider: string
  }
  sourceEmailCount: number
  onConfigChange: (config: { summarizerModel: string; summarizerProvider: string }) => void
  onPreprocess: () => Promise<void>
  onImport: (data: Stage2Export) => void
  onExport: () => void
  disabled?: boolean
  availableModels?: ModelConfig[]  // Dynamic models from API
  modelsLoading?: boolean
}

export function Stage2Panel({
  status,
  emails,
  config,
  sourceEmailCount,
  onConfigChange,
  onPreprocess,
  onImport,
  onExport,
  disabled = false,
  availableModels = AVAILABLE_MODELS,
  modelsLoading = false,
}: Stage2PanelProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get unique providers from available models (dynamic)
  const providers = useMemo(
    () => [...new Set(availableModels.map(m => m.provider))],
    [availableModels]
  )

  // Get models for a specific provider (dynamic)
  const getModelsForProvider = (provider: string) =>
    availableModels.filter(m => m.provider === provider)

  const handlePreprocess = async () => {
    setError(null)
    setIsProcessing(true)
    try {
      await onPreprocess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pre-processing failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    try {
      const data = await importStage2(file)
      onImport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExport = () => {
    exportStage2(emails, config)
    onExport()
  }

  const handleProviderChange = (provider: string) => {
    const models = getModelsForProvider(provider)
    onConfigChange({
      summarizerProvider: provider,
      summarizerModel: models[0]?.model || '',
    })
  }

  // Models for the currently selected provider
  const modelsForCurrentProvider = getModelsForProvider(config.summarizerProvider)

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${disabled ? 'opacity-50' : ''}`}>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">Stage 2</span>
        Pre-processing
      </h2>

      {disabled && (
        <div className="text-gray-500 mb-4">
          Complete Stage 1 to enable pre-processing
        </div>
      )}

      {!disabled && (
        <>
          {/* Summarizer configuration */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summarizer Provider
              </label>
              <select
                value={config.summarizerProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                disabled={status === 'running'}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              >
                {providers.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summarizer Model
              </label>
              <select
                value={config.summarizerModel}
                onChange={(e) => onConfigChange({ ...config, summarizerModel: e.target.value })}
                disabled={status === 'running' || modelsLoading}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
              >
                {modelsLoading ? (
                  <option>Loading models...</option>
                ) : (
                  modelsForCurrentProvider.map(m => (
                    <option key={m.model} value={m.model}>{m.displayName}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Source info */}
          {sourceEmailCount > 0 && emails.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
              <span className="text-gray-600">{sourceEmailCount} emails ready for summarization</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handlePreprocess}
              disabled={isProcessing || sourceEmailCount === 0}
              className="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Run Pre-processing'}
            </button>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="stage2-upload"
              />
              <label
                htmlFor="stage2-upload"
                className="block px-4 py-2 border-2 border-dashed rounded cursor-pointer text-center border-gray-300 hover:border-purple-500 text-gray-600 hover:text-purple-500"
              >
                Upload JSON
              </label>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          {/* Status display */}
          {emails.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-green-700 font-medium">{emails.length} emails with summaries</span>
                  <p className="text-sm text-green-600 mt-1">
                    Ready for classification
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="text-green-600 hover:text-green-800 underline text-sm"
                >
                  Export Stage 2 JSON
                </button>
              </div>
            </div>
          )}

          {/* Running indicator */}
          {status === 'running' && (
            <div className="flex items-center gap-2 text-purple-600">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Summarizing emails...
            </div>
          )}
        </>
      )}
    </div>
  )
}
