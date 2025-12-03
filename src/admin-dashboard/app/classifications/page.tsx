/**
 * Classifications List Page
 *
 * Displays all IAB taxonomy classifications with filtering and search.
 */

'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useClassifications } from '@/lib/use-profile'

const SECTIONS = [
  { value: '', label: 'All Sections' },
  { value: 'demographics', label: 'Demographics' },
  { value: 'household', label: 'Household' },
  { value: 'interests', label: 'Interests' },
  { value: 'purchase_intent', label: 'Purchase Intent' },
  { value: 'actual_purchases', label: 'Actual Purchases' },
]

// Loading component for Suspense fallback
function ClassificationsPageLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading classifications...</p>
      </div>
    </div>
  )
}

// Main page wrapper with Suspense
export default function ClassificationsPage() {
  return (
    <Suspense fallback={<ClassificationsPageLoading />}>
      <ClassificationsPageContent />
    </Suspense>
  )
}

function ClassificationsPageContent() {
  const searchParams = useSearchParams()

  // Initialize from URL parameter
  const [userId, setUserId] = useState(searchParams.get('user_id') || 'default_user')
  const [selectedSection, setSelectedSection] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const { classifications, loading, error, refetch } = useClassifications(
    userId,
    selectedSection || undefined
  )

  // Filter classifications by search query
  const filteredClassifications = classifications.filter(
    (c) =>
      c.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.section.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Sort by confidence (highest first)
  const sortedClassifications = [...filteredClassifications].sort(
    (a, b) => b.confidence - a.confidence
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading classifications...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Classifications</h2>
          <p className="text-red-700">{error.message}</p>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Classifications</h1>
          <p className="text-gray-600 mt-1">
            Browse all IAB Taxonomy classifications
          </p>
        </div>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="default_user"
            />
          </div>

          {/* Section Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Section Filter
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SECTIONS.map((section) => (
                <option key={section.value} value={section.value}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Search by category, value, or section..."
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {sortedClassifications.length} of {classifications.length} classifications
      </div>

      {/* Classifications List */}
      {sortedClassifications.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            No Classifications Found
          </h3>
          <p className="text-yellow-700">
            No classifications match your current filters. Try adjusting your search or run some
            analyses first.
          </p>
          <a
            href="/analyze"
            className="inline-block mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Run Analysis
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedClassifications.map((classification, index) => (
            <ClassificationCard key={`${classification.section}_${classification.taxonomy_id}_${index}`} classification={classification} />
          ))}
        </div>
      )}
    </div>
  )
}

// Classification Card Component
function ClassificationCard({ classification }: { classification: any }) {
  const sectionColors: Record<string, string> = {
    demographics: 'bg-purple-100 text-purple-800 border-purple-200',
    household: 'bg-green-100 text-green-800 border-green-200',
    interests: 'bg-orange-100 text-orange-800 border-orange-200',
    purchase_intent: 'bg-pink-100 text-pink-800 border-pink-200',
    actual_purchases: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  }

  const sectionColor = sectionColors[classification.section] || 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded-full border ${sectionColor} capitalize`}>
              {classification.section.replace('_', ' ')}
            </span>
            {classification.taxonomy_id && (
              <span className="text-xs text-gray-500">
                ID: {classification.taxonomy_id}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {classification.value}
          </h3>
          {classification.category !== classification.value && (
            <p className="text-sm text-gray-600 mt-1">
              Category: {classification.category}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">
            {Math.round(classification.confidence * 100)}%
          </p>
          <p className="text-xs text-gray-500">Confidence</p>
        </div>
      </div>

      {classification.tier_path && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">Tier Path</p>
          <p className="text-sm text-gray-700">{classification.tier_path}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
        <div>
          <p>Created</p>
          <p className="text-gray-700">
            {new Date(classification.created_at).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p>Updated</p>
          <p className="text-gray-700">
            {new Date(classification.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {classification.evidence_count && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            {classification.evidence_count} pieces of evidence
          </p>
        </div>
      )}
    </div>
  )
}
