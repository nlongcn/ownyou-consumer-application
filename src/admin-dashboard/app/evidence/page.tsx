'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IndexedDBStore } from '@browser/store/IndexedDBStore'

interface Evidence {
  taxonomy_id: number
  category_path: string
  value: string
  confidence: number
  evidence_count: number
  reasoning: string
  supporting_evidence: string[]
  contradicting_evidence: string[]
  first_observed: string
  last_updated: string
  section: string
  purchase_intent_flag?: string  // PIPR_HIGH, PIPR_MEDIUM, PIPR_LOW, ACTUAL_PURCHASE
}

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('confidence_desc')
  const router = useRouter()

  useEffect(() => {
    loadEvidence()
  }, [selectedSection, sortBy])

  async function loadEvidence() {
    try {
      setLoading(true)
      setError(null)

      // Use IndexedDB directly (client-side only)
      const store = new IndexedDBStore('ownyou_store')
      const userId = 'default_user'

      // Read semantic memories (IAB classifications)
      const semanticPrefix = [userId, 'iab_taxonomy_profile']
      const semanticItems = await store.search(semanticPrefix)

      const evidenceList: Evidence[] = []

      for (const item of semanticItems) {
        const value = item.value

        // Parse key to extract section and taxonomy_id
        const key = item.key
        const keyParts = key.split('_')

        // Extract section
        let itemSection = 'unknown'
        if (keyParts.length >= 2) {
          itemSection = keyParts[1]
        }

        // Normalize purchase section names
        if (itemSection === 'purchase' || itemSection === 'purchase_intent') {
          itemSection = 'purchase_intent'
        }

        // Filter by section if specified
        if (selectedSection !== 'all' && itemSection !== selectedSection) {
          continue
        }

        // Extract taxonomy_id
        let taxonomyId: number = 0
        if (keyParts.length >= 3) {
          const parsedId = parseInt(keyParts[2], 10)
          if (!isNaN(parsedId)) {
            taxonomyId = parsedId
          }
        }

        evidenceList.push({
          taxonomy_id: taxonomyId,
          category_path: value.category_path || value.tier_path || value.value || 'Unknown',
          value: value.value || value.tier_3 || 'Unknown',
          confidence: value.confidence || 0,
          evidence_count: value.evidence_count || value.supporting_evidence?.length || 0,
          reasoning: value.reasoning || 'No reasoning provided',
          supporting_evidence: value.supporting_evidence || [],
          contradicting_evidence: value.contradicting_evidence || [],
          first_observed: value.first_observed || item.createdAt || new Date().toISOString(),
          last_updated: value.last_updated || item.updatedAt || new Date().toISOString(),
          section: itemSection,
          purchase_intent_flag: value.purchase_intent_flag,
        })
      }

      // Sort evidence
      if (sortBy === 'confidence_desc') {
        evidenceList.sort((a, b) => b.confidence - a.confidence)
      } else if (sortBy === 'confidence_asc') {
        evidenceList.sort((a, b) => a.confidence - b.confidence)
      } else if (sortBy === 'recent') {
        evidenceList.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
      } else if (sortBy === 'oldest') {
        evidenceList.sort((a, b) => new Date(a.first_observed).getTime() - new Date(b.first_observed).getTime())
      }

      // Apply limit (100 items)
      const limitedEvidence = evidenceList.slice(0, 100)

      setEvidence(limitedEvidence)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load evidence'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-blue-600'
    if (confidence >= 0.4) return 'text-yellow-600'
    return 'text-orange-600'
  }

  function getConfidenceBg(confidence: number): string {
    if (confidence >= 0.8) return 'bg-green-100'
    if (confidence >= 0.6) return 'bg-blue-100'
    if (confidence >= 0.4) return 'bg-yellow-100'
    return 'bg-orange-100'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading evidence...</p>
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Evidence & Reasoning
          </h1>
          <p className="text-gray-600 mt-1">
            LLM explanations for each IAB taxonomy classification
          </p>
        </div>
        <button
          onClick={() => router.push('/emails')}
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-gray-700"
        >
          Back to Emails
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Filter by Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Sections</option>
              <option value="interests">Interests</option>
              <option value="demographics">Demographics</option>
              <option value="household">Household</option>
              <option value="purchase_intent">Purchase Intent</option>
              <option value="actual_purchases">Actual Purchases</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="confidence_desc">Highest Confidence</option>
              <option value="confidence_asc">Lowest Confidence</option>
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {evidence.length} classification{evidence.length !== 1 ? 's' : ''}
      </div>

      {/* Evidence List */}
      {evidence.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">
            No classifications found. Download and classify emails to generate your profile.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {evidence.map((item) => (
            <div
              key={item.taxonomy_id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.category_path}
                    </h3>
                    {item.purchase_intent_flag && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                        {item.purchase_intent_flag.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="capitalize">{item.section.replace('_', ' ')}</span> •
                    Taxonomy ID: {item.taxonomy_id}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceBg(item.confidence)}`}>
                  <span className={getConfidenceColor(item.confidence)}>
                    {(item.confidence * 100).toFixed(0)}% confident
                  </span>
                </div>
              </div>

              {/* Reasoning */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  LLM Reasoning:
                </h4>
                <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg max-h-[300px] overflow-y-auto">
                  {item.reasoning ? (
                    <div className="space-y-2">
                      {item.reasoning.split(/\[[\d-:TZ.]+\]/).filter(text => text.trim()).map((sentence, idx) => (
                        <p key={idx}>
                          {sentence.trim()}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No reasoning provided</p>
                  )}
                </div>
              </div>

              {/* Evidence Counts */}
              <div className="flex gap-6 text-sm mb-3">
                <div>
                  <span className="text-gray-600">Evidence Count: </span>
                  <span className="font-medium text-gray-900">{item.evidence_count}</span>
                </div>
                <div>
                  <span className="text-gray-600">Supporting: </span>
                  <span className="font-medium text-green-600">{item.supporting_evidence.length}</span>
                </div>
                {item.contradicting_evidence.length > 0 && (
                  <div>
                    <span className="text-gray-600">Contradicting: </span>
                    <span className="font-medium text-red-600">{item.contradicting_evidence.length}</span>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="flex gap-6 text-xs text-gray-500">
                <div>
                  First observed: {new Date(item.first_observed).toLocaleDateString()}
                </div>
                <div>
                  Last updated: {new Date(item.last_updated).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
