/**
 * Quality Analytics Page
 *
 * Shows quality metrics and analytics for IAB classifications.
 */

'use client'

import { useState, useEffect } from 'react'
import { useProfile } from '@/lib/use-profile'

export default function QualityPage() {
  const [userId, setUserId] = useState('default_user')
  const { summary, classifications, loading } = useProfile(userId)

  // Calculate quality metrics
  const metrics = {
    totalClassifications: summary?.total_classifications || 0,
    avgConfidence: classifications.length > 0
      ? classifications.reduce((sum, c) => sum + c.confidence, 0) / classifications.length
      : 0,
    highConfidence: classifications.filter((c) => c.confidence >= 0.8).length,
    mediumConfidence: classifications.filter((c) => c.confidence >= 0.5 && c.confidence < 0.8).length,
    lowConfidence: classifications.filter((c) => c.confidence < 0.5).length,
    sectionDistribution: {
      demographics: summary?.demographics || 0,
      household: summary?.household || 0,
      interests: summary?.interests || 0,
      purchase_intent: summary?.purchase_intent || 0,
      actual_purchases: summary?.actual_purchases || 0,
    },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quality Analytics</h1>
        <p className="text-gray-600 mt-1">
          Classification quality metrics and insights
        </p>
      </div>

      {/* User ID Input */}
      <div className="bg-white rounded-lg shadow p-6">
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Classifications"
          value={metrics.totalClassifications}
          icon="📊"
          color="blue"
        />
        <MetricCard
          title="Average Confidence"
          value={`${Math.round(metrics.avgConfidence * 100)}%`}
          icon="✓"
          color="green"
        />
        <MetricCard
          title="High Confidence"
          value={metrics.highConfidence}
          subtitle="≥80%"
          icon="⭐"
          color="green"
        />
        <MetricCard
          title="Low Confidence"
          value={metrics.lowConfidence}
          subtitle="<50%"
          icon="⚠️"
          color="yellow"
        />
      </div>

      {/* Confidence Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Confidence Distribution
        </h2>
        <div className="space-y-4">
          <ConfidenceBar
            label="High Confidence (≥80%)"
            count={metrics.highConfidence}
            total={metrics.totalClassifications}
            color="green"
          />
          <ConfidenceBar
            label="Medium Confidence (50-79%)"
            count={metrics.mediumConfidence}
            total={metrics.totalClassifications}
            color="yellow"
          />
          <ConfidenceBar
            label="Low Confidence (<50%)"
            count={metrics.lowConfidence}
            total={metrics.totalClassifications}
            color="red"
          />
        </div>
      </div>

      {/* Section Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Section Distribution
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SectionCard
            name="Demographics"
            count={metrics.sectionDistribution.demographics}
            color="purple"
          />
          <SectionCard
            name="Household"
            count={metrics.sectionDistribution.household}
            color="green"
          />
          <SectionCard
            name="Interests"
            count={metrics.sectionDistribution.interests}
            color="orange"
          />
          <SectionCard
            name="Purchase Intent"
            count={metrics.sectionDistribution.purchase_intent}
            color="pink"
          />
          <SectionCard
            name="Actual Purchases"
            count={metrics.sectionDistribution.actual_purchases}
            color="indigo"
          />
        </div>
      </div>

      {/* Quality Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Quality Insights
        </h3>
        <ul className="text-blue-700 space-y-2 text-sm">
          {metrics.totalClassifications === 0 && (
            <li>• No classifications yet - run some analyses to see quality metrics</li>
          )}
          {metrics.avgConfidence >= 0.8 && metrics.totalClassifications > 0 && (
            <li>✅ Excellent average confidence ({Math.round(metrics.avgConfidence * 100)}%)</li>
          )}
          {metrics.avgConfidence < 0.8 && metrics.avgConfidence >= 0.6 && metrics.totalClassifications > 0 && (
            <li>⚠️ Good average confidence ({Math.round(metrics.avgConfidence * 100)}%) - consider reviewing low-confidence items</li>
          )}
          {metrics.avgConfidence < 0.6 && metrics.totalClassifications > 0 && (
            <li>❌ Low average confidence ({Math.round(metrics.avgConfidence * 100)}%) - classifications may need review</li>
          )}
          {metrics.lowConfidence > 0 && (
            <li>• {metrics.lowConfidence} classifications have low confidence (&lt;50%) - consider manual review</li>
          )}
          {metrics.sectionDistribution.interests > metrics.totalClassifications * 0.5 && (
            <li>• Interests dominate classification profile ({Math.round((metrics.sectionDistribution.interests / metrics.totalClassifications) * 100)}%)</li>
          )}
        </ul>
      </div>
    </div>
  )
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: string
  color: 'blue' | 'green' | 'yellow'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
  )
}

// Confidence Bar Component
function ConfidenceBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: 'green' | 'yellow' | 'red'
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">
          {count} ({Math.round(percentage)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`${colorClasses[color]} h-3 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  )
}

// Section Card Component
function SectionCard({
  name,
  count,
  color,
}: {
  name: string
  count: number
  color: 'purple' | 'green' | 'orange' | 'pink' | 'indigo'
}) {
  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    pink: 'bg-pink-50 border-pink-200 text-pink-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4 text-center`}>
      <p className="text-sm font-medium mb-2">{name}</p>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  )
}
