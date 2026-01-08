'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * LLM Cost Management Component
 *
 * Provides visibility into dynamic LLM configuration and cost tracking.
 * Uses ConfigService from @ownyou/llm-client for pricing data.
 *
 * Features:
 * - View current pricing config
 * - Force config refresh
 * - Cache status indicator
 * - Cost summary per provider
 *
 * @see docs/architecture/extracts/llm-cost-6.10.md
 */

// Types for the component (matching ConfigService types from @ownyou/llm-client)
interface ModelPricing {
  inputPer1M: number   // per 1M tokens (ConfigService format)
  outputPer1M: number  // per 1M tokens (ConfigService format)
}

interface ModelMetadata {
  displayName: string
  provider: string
  contextWindow: number
  maxCompletionTokens: number
  pricing: ModelPricing
  isReasoningModel?: boolean
  zeroDataRetention?: boolean
}

/**
 * CacheStatus from ConfigService
 * @see packages/llm-client/src/config/types.ts
 */
interface CacheStatus {
  cached: boolean
  expiry: Date | null
  source: string  // 'llm-prices.com' | 'openrouter' | 'bundled' | 'none'
}

interface ConfigStatus {
  isLoading: boolean
  error: string | null
  cacheStatus: CacheStatus | null
  modelCount: number
  providerCounts: Record<string, number>
  lastRefreshed: Date | null
}

// Pricing display component
function PricingCard({ model, metadata }: { model: string; metadata: ModelMetadata }) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-sm">{metadata.displayName || model}</h4>
          <p className="text-xs text-gray-500">{model}</p>
        </div>
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
          {metadata.provider}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Input:</span>
          <span className="ml-1 font-mono">${(metadata.pricing.inputPer1M / 1000).toFixed(6)}/1K</span>
        </div>
        <div>
          <span className="text-gray-500">Output:</span>
          <span className="ml-1 font-mono">${(metadata.pricing.outputPer1M / 1000).toFixed(6)}/1K</span>
        </div>
        <div>
          <span className="text-gray-500">Context:</span>
          <span className="ml-1 font-mono">{metadata.contextWindow.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500">Max Output:</span>
          <span className="ml-1 font-mono">{metadata.maxCompletionTokens.toLocaleString()}</span>
        </div>
      </div>
      {metadata.zeroDataRetention && (
        <div className="mt-2 text-xs">
          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">Zero Data Retention</span>
        </div>
      )}
      {metadata.isReasoningModel && (
        <div className="mt-2 text-xs">
          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">Reasoning Model</span>
        </div>
      )}
    </div>
  )
}

// Cache status indicator
function CacheStatusIndicator({ status }: { status: CacheStatus | null }) {
  if (!status) {
    return (
      <div className="text-xs text-gray-400">
        Cache: Unknown
      </div>
    )
  }

  const getSourceColor = (source: string) => {
    if (source.includes('llm-prices')) return 'text-purple-600 bg-purple-100'
    if (source.includes('openrouter')) return 'text-blue-600 bg-blue-100'
    if (source === 'bundled') return 'text-orange-600 bg-orange-100'
    if (source === 'none') return 'text-gray-600 bg-gray-100'
    return 'text-green-600 bg-green-100'
  }

  const formatExpiry = (expiry: Date | null) => {
    if (!expiry) return 'N/A'
    const now = Date.now()
    const expiryTime = expiry.getTime()
    if (expiryTime < now) return 'Expired'
    const remaining = Math.round((expiryTime - now) / 1000 / 60) // minutes
    if (remaining < 60) return `${remaining}m`
    return `${Math.round(remaining / 60)}h ${remaining % 60}m`
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <div>
        <span className="text-gray-500">Source:</span>
        <span className={`ml-1 px-2 py-0.5 rounded ${getSourceColor(status.source)}`}>
          {status.source || 'None'}
        </span>
      </div>
      <div>
        <span className="text-gray-500">Cached:</span>
        <span className={`ml-1 ${status.cached ? 'text-green-600' : 'text-gray-400'}`}>
          {status.cached ? 'Yes' : 'No'}
        </span>
      </div>
      <div>
        <span className="text-gray-500">Expires:</span>
        <span className="ml-1">{formatExpiry(status.expiry)}</span>
      </div>
    </div>
  )
}

export function LLMCostManagement() {
  const [status, setStatus] = useState<ConfigStatus>({
    isLoading: true,
    error: null,
    cacheStatus: null,
    modelCount: 0,
    providerCounts: {},
    lastRefreshed: null,
  })
  const [models, setModels] = useState<Record<string, ModelMetadata>>({})
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load config on mount
  const loadConfig = useCallback(async (forceRefresh = false) => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }))

      // Dynamic import to avoid SSR issues
      const { configService } = await import('@ownyou/llm-client')

      let config
      if (forceRefresh) {
        setIsRefreshing(true)
        config = await configService.forceRefresh()
      } else {
        config = await configService.getConfig()
      }

      const cacheStatus = configService.getCacheStatus()

      // Count models per provider
      const providerCounts: Record<string, number> = {}
      for (const metadata of Object.values(config.models)) {
        const provider = metadata.provider
        providerCounts[provider] = (providerCounts[provider] || 0) + 1
      }

      setModels(config.models)
      setStatus({
        isLoading: false,
        error: null,
        cacheStatus,
        modelCount: Object.keys(config.models).length,
        providerCounts,
        lastRefreshed: new Date(),
      })
    } catch (error) {
      console.error('[LLMCostManagement] Failed to load config:', error)
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load configuration',
      }))
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Get filtered models
  const filteredModels = Object.entries(models).filter(([_, metadata]) => {
    if (selectedProvider === 'all') return true
    return metadata.provider === selectedProvider
  })

  // Get unique providers
  const providers = ['all', ...Object.keys(status.providerCounts).sort()]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">LLM Cost Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Dynamic pricing and model configuration from ConfigService
          </p>
        </div>
        <button
          onClick={() => loadConfig(true)}
          disabled={isRefreshing}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors
            ${isRefreshing
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {isRefreshing ? 'Refreshing...' : 'Force Refresh'}
        </button>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        {status.isLoading ? (
          <div className="text-sm text-gray-500">Loading configuration...</div>
        ) : status.error ? (
          <div className="text-sm text-red-600">Error: {status.error}</div>
        ) : (
          <>
            <div className="text-sm">
              <span className="font-medium">{status.modelCount}</span>
              <span className="text-gray-500 ml-1">models loaded</span>
            </div>
            <CacheStatusIndicator status={status.cacheStatus} />
            {status.lastRefreshed && (
              <div className="text-xs text-gray-400">
                Last updated: {status.lastRefreshed.toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Provider Counts */}
      {Object.keys(status.providerCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {providers.map(provider => (
            <button
              key={provider}
              onClick={() => setSelectedProvider(provider)}
              className={`px-3 py-1.5 text-sm rounded transition-colors
                ${selectedProvider === provider
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {provider === 'all' ? 'All' : provider}
              {provider !== 'all' && (
                <span className="ml-1 opacity-75">({status.providerCounts[provider]})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Models Grid */}
      {!status.isLoading && !status.error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
          {filteredModels.map(([model, metadata]) => (
            <PricingCard key={model} model={model} metadata={metadata} />
          ))}
          {filteredModels.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No models found for selected provider
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t text-xs text-gray-400">
        <p>
          Pricing data from{' '}
          <a
            href="https://www.llm-prices.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            llm-prices.com
          </a>
          {' '}with OpenRouter fallback. See{' '}
          <code className="px-1 py-0.5 bg-gray-100 rounded">docs/architecture/extracts/llm-cost-6.10.md</code>
          {' '}for details.
        </p>
      </div>
    </div>
  )
}

export default LLMCostManagement
