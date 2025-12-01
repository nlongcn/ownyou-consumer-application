'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserProfileReader } from '@/lib/profile-reader'

interface Classification {
  value: string
  tier_path: string
  confidence: number
  section: string
  evidence_count: number
}

export default function ConfidencePage() {
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        // Use client-side profile reader (IndexedDB directly)
        const profileReader = getBrowserProfileReader()
        const profile = await profileReader.getTieredProfile('default_user')

        const allClassifications: Classification[] = []

        // Extract demographics
        Object.entries(profile.demographics).forEach(([fieldName, group]) => {
          allClassifications.push({
            value: group.primary.value,
            tier_path: group.primary.tier_path,
            confidence: group.primary.confidence,
            section: 'demographics',
            evidence_count: group.primary.evidence_count
          })
          // Include alternatives
          group.alternatives.forEach(alt => {
            allClassifications.push({
              value: alt.value,
              tier_path: alt.tier_path,
              confidence: alt.confidence,
              section: 'demographics',
              evidence_count: alt.evidence_count
            })
          })
        })

        // Extract household
        Object.entries(profile.household).forEach(([fieldName, group]) => {
          allClassifications.push({
            value: group.primary.value,
            tier_path: group.primary.tier_path,
            confidence: group.primary.confidence,
            section: 'household',
            evidence_count: group.primary.evidence_count
          })
          // Include alternatives
          group.alternatives.forEach(alt => {
            allClassifications.push({
              value: alt.value,
              tier_path: alt.tier_path,
              confidence: alt.confidence,
              section: 'household',
              evidence_count: alt.evidence_count
            })
          })
        })

        // Extract interests
        profile.interests.forEach(interest => {
          allClassifications.push({
            value: interest.primary.value,
            tier_path: interest.primary.tier_path,
            confidence: interest.primary.confidence,
            section: 'interests',
            evidence_count: interest.primary.evidence_count
          })
        })

        // Extract purchase intent
        profile.purchase_intent.forEach(purchase => {
          allClassifications.push({
            value: purchase.primary.value,
            tier_path: purchase.primary.tier_path,
            confidence: purchase.primary.confidence,
            section: purchase.purchase_intent_flag === 'ACTUAL_PURCHASE' ? 'actual_purchases' : 'purchase_intent',
            evidence_count: purchase.primary.evidence_count
          })
        })

        // Sort by confidence descending
        allClassifications.sort((a, b) => b.confidence - a.confidence)
        setClassifications(allClassifications)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load confidence data'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading confidence data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-lg shadow p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    )
  }

  // Group by confidence level
  const highConfidence = classifications.filter(c => c.confidence >= 0.8)
  const mediumConfidence = classifications.filter(c => c.confidence >= 0.5 && c.confidence < 0.8)
  const lowConfidence = classifications.filter(c => c.confidence < 0.5)

  const ConfidenceCard = ({ title, items, color, bgColor, progressColor }: {
    title: string
    items: Classification[]
    color: string
    bgColor: string
    progressColor: string
  }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="text-2xl font-bold text-gray-900">{items.length}</span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        {items.length === 0 ? 'No classifications' : `${items.length} classification${items.length !== 1 ? 's' : ''}`}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No classifications in this confidence range</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.value}</div>
                <div className="text-xs text-gray-600">{item.tier_path}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {item.evidence_count} evidence item{item.evidence_count !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <span className={`text-sm font-semibold ${color}`}>
                  {(item.confidence * 100).toFixed(1)}%
                </span>
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${progressColor}`}
                    style={{ width: `${item.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Confidence Analysis
          </h1>
          <p className="text-gray-600 mt-1">
            Classification confidence scores grouped by reliability
          </p>
        </div>
        <button
          onClick={() => router.push('/emails')}
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-gray-700"
        >
          Back to Emails
        </button>
      </div>

      {classifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">
            No classifications found. Download and classify emails to see confidence analysis.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Total Classifications</h3>
              <div className="text-2xl font-bold text-gray-900">{classifications.length}</div>
              <p className="text-xs text-gray-500 mt-1">Across all categories</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Average Confidence</h3>
              <div className="text-2xl font-bold text-gray-900">
                {(classifications.reduce((sum, c) => sum + c.confidence, 0) / classifications.length * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Mean confidence score</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">High Confidence</h3>
              <div className="text-2xl font-bold text-gray-900">{highConfidence.length}</div>
              <p className="text-xs text-gray-500 mt-1">≥80% confidence</p>
            </div>
          </div>

          {/* Confidence Groups */}
          <div className="space-y-6">
            <ConfidenceCard
              title="High Confidence (≥80%)"
              items={highConfidence}
              color="text-green-600"
              bgColor="bg-green-50"
              progressColor="bg-green-500"
            />
            <ConfidenceCard
              title="Medium Confidence (50-79%)"
              items={mediumConfidence}
              color="text-yellow-600"
              bgColor="bg-yellow-50"
              progressColor="bg-yellow-500"
            />
            <ConfidenceCard
              title="Low Confidence (<50%)"
              items={lowConfidence}
              color="text-red-600"
              bgColor="bg-red-50"
              progressColor="bg-red-500"
            />
          </div>
        </>
      )}
    </div>
  )
}
