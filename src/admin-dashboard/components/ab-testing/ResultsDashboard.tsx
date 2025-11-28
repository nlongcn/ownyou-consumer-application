'use client'

import { useState } from 'react'
import { ComparisonMetrics, ModelResults } from '@/lib/ab-testing/types'

interface ResultsDashboardProps {
  metrics: ComparisonMetrics
  results: Map<string, ModelResults>
}

type TabId = 'overview' | 'confidence' | 'agreement' | 'coverage'

const tabs: { id: TabId; name: string }[] = [
  { id: 'overview', name: 'Overview' },
  { id: 'confidence', name: 'Confidence' },
  { id: 'agreement', name: 'Agreement' },
  { id: 'coverage', name: 'Coverage' },
]

export function ResultsDashboard({ metrics, results }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const modelKeys = Array.from(results.keys())

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tab navigation */}
      <div className="border-b">
        <nav className="flex -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab metrics={metrics} modelKeys={modelKeys} />
        )}
        {activeTab === 'confidence' && (
          <ConfidenceTab metrics={metrics} modelKeys={modelKeys} />
        )}
        {activeTab === 'agreement' && (
          <AgreementTab metrics={metrics} modelKeys={modelKeys} />
        )}
        {activeTab === 'coverage' && (
          <CoverageTab metrics={metrics} modelKeys={modelKeys} />
        )}
      </div>
    </div>
  )
}

// Overview Tab - Summary table
function OverviewTab({ metrics, modelKeys }: { metrics: ComparisonMetrics; modelKeys: string[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Model Comparison Summary</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classifications</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categories</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coverage</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {modelKeys.map(modelKey => {
              const stats = metrics.modelStats[modelKey]
              if (!stats) return null
              return (
                <tr key={modelKey} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{formatModelName(modelKey)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-medium ${getConfidenceColor(stats.avgConfidence)}`}>
                      {(stats.avgConfidence * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {stats.totalClassifications}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {stats.uniqueCategories.length}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {(stats.durationMs / 1000).toFixed(1)}s
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-medium ${getConfidenceColor(stats.classificationRate)}`}>
                      {(stats.classificationRate * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Confidence Tab - Distribution visualization
function ConfidenceTab({ metrics, modelKeys }: { metrics: ComparisonMetrics; modelKeys: string[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Confidence Distribution</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modelKeys.map(modelKey => {
          const stats = metrics.modelStats[modelKey]
          if (!stats) return null
          return (
            <div key={modelKey} className="border rounded p-4">
              <h4 className="font-medium mb-3">{formatModelName(modelKey)}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Average</span>
                  <span className="font-medium">{(stats.avgConfidence * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Minimum</span>
                  <span>{(stats.minConfidence * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Maximum</span>
                  <span>{(stats.maxConfidence * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Std Dev</span>
                  <span>{(stats.stdDevConfidence * 100).toFixed(1)}%</span>
                </div>
                {/* Visual bar */}
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-gray-500 mb-1">Distribution</div>
                  <div className="relative h-4 bg-gray-200 rounded">
                    <div
                      className="absolute h-full bg-blue-500 rounded"
                      style={{
                        left: `${stats.minConfidence * 100}%`,
                        width: `${(stats.maxConfidence - stats.minConfidence) * 100}%`,
                      }}
                    />
                    <div
                      className="absolute w-1 h-6 -top-1 bg-blue-700 rounded"
                      style={{ left: `${stats.avgConfidence * 100}%` }}
                      title="Average"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Agreement Tab - Pairwise agreement heatmap
function AgreementTab({ metrics, modelKeys }: { metrics: ComparisonMetrics; modelKeys: string[] }) {
  const { agreement } = metrics

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Cross-Model Agreement</h3>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{agreement.fullAgreementCount}</div>
          <div className="text-sm text-green-600">Full Agreement</div>
        </div>
        <div className="bg-yellow-50 rounded p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{agreement.partialAgreementCount}</div>
          <div className="text-sm text-yellow-600">Partial Agreement</div>
        </div>
        <div className="bg-red-50 rounded p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{agreement.noAgreementCount}</div>
          <div className="text-sm text-red-600">No Agreement</div>
        </div>
      </div>

      <div className="text-center mb-6">
        <span className="text-lg">Agreement Rate: </span>
        <span className={`text-xl font-bold ${getConfidenceColor(agreement.agreementRate)}`}>
          {(agreement.agreementRate * 100).toFixed(1)}%
        </span>
      </div>

      {/* Pairwise agreement matrix */}
      <h4 className="font-medium mb-3">Pairwise Agreement Matrix</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-2 py-1 bg-gray-50 text-xs"></th>
              {modelKeys.map(key => (
                <th key={key} className="border px-2 py-1 bg-gray-50 text-xs truncate max-w-24" title={key}>
                  {formatModelName(key).split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modelKeys.map(rowKey => (
              <tr key={rowKey}>
                <td className="border px-2 py-1 bg-gray-50 text-xs font-medium truncate max-w-24" title={rowKey}>
                  {formatModelName(rowKey).split(' ')[0]}
                </td>
                {modelKeys.map(colKey => {
                  const value = agreement.pairwiseAgreement[rowKey]?.[colKey] || 0
                  return (
                    <td
                      key={colKey}
                      className="border px-2 py-1 text-center text-xs"
                      style={{ backgroundColor: getHeatmapColor(value) }}
                    >
                      {(value * 100).toFixed(0)}%
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Coverage Tab - Category analysis
function CoverageTab({ metrics, modelKeys }: { metrics: ComparisonMetrics; modelKeys: string[] }) {
  const { coverage } = metrics

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Category Coverage Analysis</h3>

      {/* Common categories */}
      <div className="mb-6">
        <h4 className="font-medium mb-2">Common Categories (all models)</h4>
        {coverage.commonCategories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {coverage.commonCategories.map(cat => (
              <span key={cat} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                {cat}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No categories found in all models</p>
        )}
      </div>

      {/* Unique categories per model */}
      <div className="mb-6">
        <h4 className="font-medium mb-2">Unique Categories (only in one model)</h4>
        <div className="space-y-3">
          {modelKeys.map(modelKey => {
            const unique = coverage.uniqueCategories[modelKey] || []
            if (unique.length === 0) return null
            return (
              <div key={modelKey}>
                <span className="text-sm font-medium text-gray-700">{formatModelName(modelKey)}:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {unique.map(cat => (
                    <span key={cat} className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top categories by frequency */}
      <div>
        <h4 className="font-medium mb-2">Top Categories by Frequency</h4>
        <div className="space-y-2">
          {Object.entries(coverage.categoryFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([category, count]) => (
              <div key={category} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-sm">{category}</div>
                  <div className="h-2 bg-gray-200 rounded">
                    <div
                      className="h-full bg-blue-500 rounded"
                      style={{
                        width: `${(count / Math.max(...Object.values(coverage.categoryFrequency))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// Helper functions
function formatModelName(modelKey: string): string {
  const [provider, model] = modelKey.split(':')
  const shortModel = model?.split('/').pop() || model
  return `${provider?.charAt(0).toUpperCase()}${provider?.slice(1)} ${shortModel}`
}

function getConfidenceColor(value: number): string {
  if (value >= 0.8) return 'text-green-600'
  if (value >= 0.6) return 'text-yellow-600'
  return 'text-red-600'
}

function getHeatmapColor(value: number): string {
  // Green gradient from light to dark
  const intensity = Math.floor(value * 255)
  return `rgb(${255 - intensity}, 255, ${255 - intensity})`
}
