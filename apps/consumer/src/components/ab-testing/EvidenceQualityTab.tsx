/**
 * Evidence Quality Tab for A/B Testing ResultsDashboard
 *
 * Sprint 11d: Displays evidence quality metrics from the Evidence Judge.
 *
 * v13 Architecture Compliance:
 * - Section 5.3: Evidence Judge validation results
 * - Section 5.4: Quality scores from reconciliation
 *
 * Evidence Types:
 * - Explicit (1.0): Direct statement (e.g., "I am 35 years old")
 * - Contextual (0.7): Strong inference (e.g., "my kids" implies parent)
 * - Weak (0.4): Indirect signal (e.g., single mention)
 * - Inappropriate (0.0): Wrong evidence type (e.g., products -> age)
 *
 * @see docs/sprints/ownyou-sprint11d-spec.md
 */

import { useMemo } from 'react'
import type { ModelResults, EvidenceType } from '../../lib/ab-testing/types'

interface EvidenceQualityTabProps {
  results: Map<string, ModelResults>
}

/**
 * Format model name for display
 */
function formatModelName(modelKey: string): string {
  const [provider, model] = modelKey.split(':')
  const shortModel = model?.split('/').pop() || model
  return `${provider?.charAt(0).toUpperCase()}${provider?.slice(1)} ${shortModel}`
}

/**
 * Get color class for evidence quality percentage
 */
function getQualityColor(value: number): string {
  if (value >= 0.8) return 'text-green-600'
  if (value >= 0.6) return 'text-yellow-600'
  if (value >= 0.4) return 'text-orange-600'
  return 'text-red-600'
}

/**
 * Get background color for quality bar
 */
function getQualityBgColor(value: number): string {
  if (value >= 0.8) return 'bg-green-500'
  if (value >= 0.6) return 'bg-yellow-500'
  if (value >= 0.4) return 'bg-orange-500'
  return 'bg-red-500'
}

export function EvidenceQualityTab({ results }: EvidenceQualityTabProps) {
  const models = useMemo(() => Array.from(results.entries()), [results])

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    let totalClassifications = 0
    let totalBlockedCount = 0
    const allDistributions: Record<EvidenceType, number> = {
      explicit: 0,
      contextual: 0,
      weak: 0,
      inappropriate: 0,
    }

    for (const [, modelResults] of models) {
      totalClassifications += modelResults.stats.totalClassifications
      const dist = modelResults.stats.evidenceTypeDistribution
      if (dist) {
        for (const [key, value] of Object.entries(dist)) {
          if (key in allDistributions) {
            allDistributions[key as EvidenceType] += value
          }
        }
      }
      // Count blocked classifications (<0.15 evidence quality)
      const blocked = modelResults.classifications.filter(
        (c) => c.evidenceQuality !== undefined && c.evidenceQuality < 0.15
      ).length
      totalBlockedCount += blocked
    }

    return {
      totalClassifications,
      totalBlockedCount,
      blockRate: totalClassifications > 0 ? totalBlockedCount / totalClassifications : 0,
      distributions: allDistributions,
    }
  }, [models])

  // Check if evidence quality data is available
  const hasEvidenceData = models.some(
    ([, r]) => r.stats.avgEvidenceQuality !== undefined && r.stats.avgEvidenceQuality > 0
  )

  if (!hasEvidenceData) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Evidence Quality Comparison</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-yellow-800 font-medium mb-2">
            Evidence Quality Data Not Available
          </div>
          <p className="text-yellow-700 text-sm">
            Evidence quality metrics require the full IAB classifier workflow (Sprint 11d).
            <br />
            The current results were generated using simple prompt classification.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Evidence Quality Comparison</h3>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">
            {aggregateStats.distributions.explicit}
          </div>
          <div className="text-sm text-green-600">Explicit</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">
            {aggregateStats.distributions.contextual}
          </div>
          <div className="text-sm text-blue-600">Contextual</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">
            {aggregateStats.distributions.weak}
          </div>
          <div className="text-sm text-yellow-600">Weak</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-700">
            {aggregateStats.totalBlockedCount}
          </div>
          <div className="text-sm text-red-600">Blocked</div>
        </div>
      </div>

      {/* Model comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left font-medium text-gray-700">Model</th>
              <th className="p-3 text-right font-medium text-gray-700">Avg Quality</th>
              <th className="p-3 text-right font-medium text-gray-700">Explicit</th>
              <th className="p-3 text-right font-medium text-gray-700">Contextual</th>
              <th className="p-3 text-right font-medium text-gray-700">Weak</th>
              <th className="p-3 text-right font-medium text-gray-700">Inappropriate</th>
              <th className="p-3 text-right font-medium text-gray-700">Blocked (&lt;0.15)</th>
            </tr>
          </thead>
          <tbody>
            {models.map(([modelKey, modelResults]) => {
              const dist = modelResults.stats.evidenceTypeDistribution as Record<EvidenceType, number> | undefined
              const blocked = modelResults.classifications.filter(
                (c) => c.evidenceQuality !== undefined && c.evidenceQuality < 0.15
              ).length
              const avgQuality = modelResults.stats.avgEvidenceQuality || 0

              return (
                <tr key={modelKey} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{formatModelName(modelKey)}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded overflow-hidden">
                        <div
                          className={`h-full ${getQualityBgColor(avgQuality)}`}
                          style={{ width: `${avgQuality * 100}%` }}
                        />
                      </div>
                      <span className={`font-medium ${getQualityColor(avgQuality)}`}>
                        {(avgQuality * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-green-600 font-medium">
                    {dist?.explicit || 0}
                  </td>
                  <td className="p-3 text-right text-blue-600 font-medium">
                    {dist?.contextual || 0}
                  </td>
                  <td className="p-3 text-right text-yellow-600 font-medium">
                    {dist?.weak || 0}
                  </td>
                  <td className="p-3 text-right text-red-600 font-medium">
                    {dist?.inappropriate || 0}
                  </td>
                  <td className="p-3 text-right">
                    <span className={`font-semibold ${blocked > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {blocked}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Evidence Type Legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="font-semibold text-green-700 mb-1">
            Explicit (1.0)
          </div>
          <p className="text-green-600 text-xs">
            Direct statement of fact in the email.
            <br />
            Example: "I am 35 years old"
          </p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="font-semibold text-blue-700 mb-1">
            Contextual (0.7)
          </div>
          <p className="text-blue-600 text-xs">
            Strong inference from context.
            <br />
            Example: "my kids" implies parent
          </p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="font-semibold text-yellow-700 mb-1">
            Weak (0.4)
          </div>
          <p className="text-yellow-600 text-xs">
            Tenuous connection, barely supports claim.
            <br />
            Example: Single mention of product
          </p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="font-semibold text-red-700 mb-1">
            Inappropriate (0.0)
          </div>
          <p className="text-red-600 text-xs">
            Wrong evidence type for classification.
            <br />
            Example: Inferring age from products
          </p>
        </div>
      </div>

      {/* Blocked classifications detail */}
      {aggregateStats.totalBlockedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-700 mb-2">
            Blocked Classifications ({aggregateStats.totalBlockedCount} total)
          </h4>
          <p className="text-red-600 text-sm mb-3">
            Classifications with evidence quality below 0.15 are blocked from entering memory.
            This prevents inappropriate inferences from affecting the user profile.
          </p>
          <div className="space-y-2">
            {models.map(([modelKey, modelResults]) => {
              const blockedClassifications = modelResults.classifications.filter(
                (c) => c.evidenceQuality !== undefined && c.evidenceQuality < 0.15
              )
              if (blockedClassifications.length === 0) return null
              return (
                <div key={modelKey} className="bg-white rounded p-3">
                  <div className="font-medium text-sm text-gray-700 mb-1">
                    {formatModelName(modelKey)} ({blockedClassifications.length} blocked)
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    {blockedClassifications.slice(0, 5).map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                          {c.section}
                        </span>
                        <span className="font-medium">{c.category}</span>
                        <span className="text-gray-400">-</span>
                        <span className="text-red-600">
                          Quality: {((c.evidenceQuality || 0) * 100).toFixed(0)}%
                        </span>
                        {c.evidenceType && (
                          <span className="text-gray-500">({c.evidenceType})</span>
                        )}
                      </div>
                    ))}
                    {blockedClassifications.length > 5 && (
                      <div className="text-gray-500">
                        ...and {blockedClassifications.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
