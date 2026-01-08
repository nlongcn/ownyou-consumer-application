'use client'

import { useState, useMemo } from 'react'
import { ComparisonMetrics, ModelResults, PreprocessedEmail, Classification } from '@/lib/ab-testing/types'

interface ResultsDashboardProps {
  metrics: ComparisonMetrics
  results: Map<string, ModelResults>
  emails?: PreprocessedEmail[]  // Optional: for showing email context
}

type TabId = 'overview' | 'confidence' | 'agreement' | 'coverage' | 'details' | 'disagreements'

const tabs: { id: TabId; name: string }[] = [
  { id: 'overview', name: 'Overview' },
  { id: 'confidence', name: 'Confidence' },
  { id: 'agreement', name: 'Agreement' },
  { id: 'coverage', name: 'Coverage' },
  { id: 'details', name: 'Details' },
  { id: 'disagreements', name: 'Disagreements' },
]

export function ResultsDashboard({ metrics, results, emails = [] }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const modelKeys = Array.from(results.keys())

  // Create email lookup map for quick access
  const emailMap = useMemo(() => {
    const map = new Map<string, PreprocessedEmail>()
    emails.forEach(e => map.set(e.id, e))
    return map
  }, [emails])

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
        {activeTab === 'details' && (
          <DetailsTab results={results} modelKeys={modelKeys} emailMap={emailMap} />
        )}
        {activeTab === 'disagreements' && (
          <DisagreementsTab results={results} modelKeys={modelKeys} emailMap={emailMap} />
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

// Aggregated classification type for display
interface AggregatedClassification {
  category: string
  taxonomyId: string
  section: string
  emailCount: number
  avgConfidence: number
  minConfidence: number
  maxConfidence: number
  totalConfidence: number  // For weighted average calculation
  emailIds: string[]
  reasonings: string[]
}

// Details Tab - Per-model classification details with email context
// FIXED: Now aggregates classifications by category instead of showing duplicates
function DetailsTab({
  results,
  modelKeys,
  emailMap,
}: {
  results: Map<string, ModelResults>
  modelKeys: string[]
  emailMap: Map<string, PreprocessedEmail>
}) {
  const [selectedModel, setSelectedModel] = useState<string>(modelKeys[0] || '')
  const [expandedClassification, setExpandedClassification] = useState<string | null>(null)
  const [sectionFilter, setSectionFilter] = useState<string>('all')

  const modelResults = results.get(selectedModel)
  const classifications = modelResults?.classifications || []

  // Group classifications by section
  const sections = ['all', 'demographics', 'household', 'interests', 'purchase_intent']

  const filteredClassifications = sectionFilter === 'all'
    ? classifications
    : classifications.filter(c => c.section === sectionFilter)

  // AGGREGATE classifications by category+section (the fix for duplication)
  const aggregatedClassifications = useMemo(() => {
    const aggregateMap = new Map<string, AggregatedClassification>()

    for (const c of filteredClassifications) {
      // Key by section + category to group same classifications
      const key = `${c.section}:${c.category}`

      if (!aggregateMap.has(key)) {
        aggregateMap.set(key, {
          category: c.category,
          taxonomyId: c.taxonomyId,
          section: c.section,
          emailCount: 0,
          avgConfidence: 0,
          minConfidence: c.confidence,
          maxConfidence: c.confidence,
          totalConfidence: 0,
          emailIds: [],
          reasonings: [],
        })
      }

      const agg = aggregateMap.get(key)!
      agg.emailCount++
      agg.totalConfidence += c.confidence
      agg.minConfidence = Math.min(agg.minConfidence, c.confidence)
      agg.maxConfidence = Math.max(agg.maxConfidence, c.confidence)
      if (c.emailId && c.emailId !== 'batch' && !agg.emailIds.includes(c.emailId)) {
        agg.emailIds.push(c.emailId)
      }
      if (c.reasoning && !agg.reasonings.includes(c.reasoning)) {
        agg.reasonings.push(c.reasoning)
      }
    }

    // Calculate average confidence
    for (const agg of aggregateMap.values()) {
      agg.avgConfidence = agg.emailCount > 0 ? agg.totalConfidence / agg.emailCount : 0
    }

    return Array.from(aggregateMap.values())
  }, [filteredClassifications])

  // Sort by unique email count (most supported first), then by confidence
  const sortedClassifications = [...aggregatedClassifications].sort((a, b) => {
    if (b.emailIds.length !== a.emailIds.length) return b.emailIds.length - a.emailIds.length
    return b.avgConfidence - a.avgConfidence
  })

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Classification Details</h3>

      {/* Model and Section selectors */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {modelKeys.map(key => (
              <option key={key} value={key}>{formatModelName(key)}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Section</label>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {sections.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Sections' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats summary */}
      <div className="bg-gray-50 rounded p-3 mb-4">
        <span className="text-sm text-gray-600">
          Showing {sortedClassifications.length} unique classification{sortedClassifications.length !== 1 ? 's' : ''}
          {sectionFilter !== 'all' && ` in ${sectionFilter.replace('_', ' ')}`}
          {' '}(from {filteredClassifications.length} total email-classification pairs)
        </span>
      </div>

      {/* Classifications list - now aggregated */}
      <div className="space-y-3">
        {sortedClassifications.map((agg, idx) => {
          const classificationKey = `${agg.section}-${agg.category}`
          const isExpanded = expandedClassification === classificationKey

          return (
            <div key={idx} className="border rounded overflow-hidden">
              {/* Classification header - clickable */}
              <button
                onClick={() => setExpandedClassification(isExpanded ? null : classificationKey)}
                className="w-full p-3 flex items-center justify-between bg-white hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSectionColor(agg.section)}`}>
                    {agg.section.replace('_', ' ')}
                  </span>
                  <span className="font-medium">{agg.category}</span>
                  {agg.taxonomyId && (
                    <span className="text-xs text-gray-400">({agg.taxonomyId})</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {/* Email count badge */}
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {agg.emailIds.length} email{agg.emailIds.length !== 1 ? 's' : ''}
                  </span>
                  {/* Confidence range */}
                  <span className={`font-medium ${getConfidenceColor(agg.avgConfidence)}`}>
                    {(agg.avgConfidence * 100).toFixed(0)}%
                    {agg.emailIds.length > 1 && agg.minConfidence !== agg.maxConfidence && (
                      <span className="text-xs text-gray-400 ml-1">
                        ({(agg.minConfidence * 100).toFixed(0)}-{(agg.maxConfidence * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-4 space-y-3">
                  {/* Confidence stats */}
                  {agg.emailIds.length > 1 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">CONFIDENCE STATISTICS</div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Average: </span>
                          <span className="font-medium">{(agg.avgConfidence * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Min: </span>
                          <span>{(agg.minConfidence * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Max: </span>
                          <span>{(agg.maxConfidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reasoning(s) */}
                  {agg.reasonings.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        REASONING{agg.reasonings.length > 1 ? 'S' : ''}
                      </div>
                      {agg.reasonings.map((reasoning, rIdx) => (
                        <p key={rIdx} className="text-sm text-gray-700 mb-1">
                          {agg.reasonings.length > 1 && <span className="font-medium">({rIdx + 1}) </span>}
                          {reasoning}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Supporting emails */}
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      SUPPORTING EMAILS ({agg.emailIds.length})
                    </div>
                    {agg.emailIds.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {agg.emailIds.map((emailId, eIdx) => {
                          const email = emailMap.get(emailId)
                          return (
                            <div key={eIdx} className="bg-white rounded border p-2">
                              <div className="flex justify-between items-start">
                                <div className="font-medium text-sm truncate flex-1">
                                  {email?.subject || '(No subject)'}
                                </div>
                                <span className="text-xs text-gray-400 ml-2">
                                  {emailId.substring(0, 15)}...
                                </span>
                              </div>
                              {email && (
                                <div className="text-xs text-gray-500">From: {email.from}</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        Batch classification (no individual email IDs)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {sortedClassifications.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No classifications found for this model/section combination
          </div>
        )}
      </div>
    </div>
  )
}

// Disagreements Tab - Show emails where models disagree
function DisagreementsTab({
  results,
  modelKeys,
  emailMap,
}: {
  results: Map<string, ModelResults>
  modelKeys: string[]
  emailMap: Map<string, PreprocessedEmail>
}) {
  // Build per-email classification map across all models
  const emailClassifications = useMemo(() => {
    const map = new Map<string, Map<string, Classification[]>>() // emailId -> modelKey -> classifications

    for (const [modelKey, modelResults] of results) {
      for (const c of modelResults.classifications) {
        if (!map.has(c.emailId)) {
          map.set(c.emailId, new Map())
        }
        const modelMap = map.get(c.emailId)!
        if (!modelMap.has(modelKey)) {
          modelMap.set(modelKey, [])
        }
        modelMap.get(modelKey)!.push(c)
      }
    }

    return map
  }, [results])

  // Find emails with disagreements (different categories for same section)
  const disagreements = useMemo(() => {
    const result: Array<{
      emailId: string
      email: PreprocessedEmail | undefined
      section: string
      modelClassifications: Array<{ modelKey: string; classification: Classification }>
    }> = []

    for (const [emailId, modelMap] of emailClassifications) {
      // Group by section across models
      const sectionModels = new Map<string, Array<{ modelKey: string; classification: Classification }>>()

      for (const [modelKey, classifications] of modelMap) {
        for (const c of classifications) {
          if (!sectionModels.has(c.section)) {
            sectionModels.set(c.section, [])
          }
          sectionModels.get(c.section)!.push({ modelKey, classification: c })
        }
      }

      // Check for disagreements in each section
      for (const [section, modelClassifications] of sectionModels) {
        if (modelClassifications.length >= 2) {
          const categories = new Set(modelClassifications.map(mc => mc.classification.category))
          if (categories.size > 1) {
            // Models disagree on category
            result.push({
              emailId,
              email: emailMap.get(emailId),
              section,
              modelClassifications,
            })
          }
        }
      }
    }

    return result
  }, [emailClassifications, emailMap])

  const [expandedDisagreement, setExpandedDisagreement] = useState<string | null>(null)

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Model Disagreements</h3>

      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
        <span className="text-yellow-800">
          Found <strong>{disagreements.length}</strong> classification{disagreements.length !== 1 ? 's' : ''} where models disagree on category
        </span>
      </div>

      <div className="space-y-4">
        {disagreements.map((d, idx) => {
          const key = `${d.emailId}-${d.section}`
          const isExpanded = expandedDisagreement === key

          return (
            <div key={idx} className="border rounded overflow-hidden">
              {/* Disagreement header */}
              <button
                onClick={() => setExpandedDisagreement(isExpanded ? null : key)}
                className="w-full p-3 bg-white hover:bg-gray-50 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSectionColor(d.section)}`}>
                      {d.section.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {d.email?.subject?.substring(0, 50) || d.emailId.substring(0, 30)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {d.modelClassifications.length} models
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Quick comparison preview */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {d.modelClassifications.map((mc, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                      <span className="font-medium">{formatModelName(mc.modelKey).split(' ')[1]}:</span>
                      <span>{mc.classification.category}</span>
                      <span className={getConfidenceColor(mc.classification.confidence)}>
                        ({(mc.classification.confidence * 100).toFixed(0)}%)
                      </span>
                    </span>
                  ))}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-4">
                  {/* Email content */}
                  {d.email && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-500 mb-1">EMAIL CONTENT</div>
                      <div className="bg-white rounded border p-3">
                        <div className="font-medium text-sm mb-1">{d.email.subject || '(No subject)'}</div>
                        <div className="text-xs text-gray-500 mb-2">From: {d.email.from}</div>
                        <div className="text-sm text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {d.email.summary || d.email.body?.substring(0, 500) || '(No content)'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Model-by-model comparison */}
                  <div className="text-xs font-medium text-gray-500 mb-2">MODEL CLASSIFICATIONS</div>
                  <div className="grid gap-3">
                    {d.modelClassifications.map((mc, i) => (
                      <div key={i} className="bg-white rounded border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{formatModelName(mc.modelKey)}</span>
                          <span className={`font-medium ${getConfidenceColor(mc.classification.confidence)}`}>
                            {(mc.classification.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Category: </span>
                          {mc.classification.category}
                          {mc.classification.taxonomyId && (
                            <span className="text-gray-400 ml-1">({mc.classification.taxonomyId})</span>
                          )}
                        </div>
                        {mc.classification.reasoning && (
                          <div className="text-sm text-gray-600 mt-2">
                            <span className="font-medium">Reasoning: </span>
                            {mc.classification.reasoning}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {disagreements.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">🎉</div>
            <div>All models agree on their classifications!</div>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper for section colors
function getSectionColor(section: string): string {
  switch (section) {
    case 'demographics': return 'bg-blue-100 text-blue-800'
    case 'household': return 'bg-green-100 text-green-800'
    case 'interests': return 'bg-purple-100 text-purple-800'
    case 'purchase_intent': return 'bg-orange-100 text-orange-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}
