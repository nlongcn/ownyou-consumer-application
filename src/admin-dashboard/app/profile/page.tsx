'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getBrowserProfileReader,
  type TieredProfile,
  type TierEntry,
  type TieredGroup,
  type TieredInterest,
  type TieredPurchaseIntent,
} from '@/lib/profile-reader'

export default function ProfileViewPage() {
  const [profile, setProfile] = useState<TieredProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true)

        // Load tiered profile from IndexedDB (browser storage)
        const reader = getBrowserProfileReader()
        const data = await reader.getTieredProfile('default_user')
        setProfile(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load tiered profile'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading tiered profile...</p>
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

  const demographicsCount = Object.keys(profile?.demographics || {}).length
  const householdCount = Object.keys(profile?.household || {}).length
  const interestsCount = profile?.interests?.length || 0
  const purchaseIntentCount = profile?.purchase_intent?.length || 0

  const GranularityBadge = ({ score }: { score: number }) => {
    const color = score >= 0.7 ? 'bg-green-100 text-green-800' : score >= 0.4 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {(score * 100).toFixed(0)}
      </span>
    )
  }

  const TieredGroupCard = ({ group, fieldName }: { group: TieredGroup; fieldName: string }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-600 uppercase mb-2">{fieldName}</h4>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium text-gray-900">{group.primary.value}</div>
            <div className="text-xs text-gray-600 mt-1">{group.primary.tier_path}</div>
          </div>
          <span className="ml-2 text-sm font-semibold text-blue-600">
            {(group.primary.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${group.primary.confidence * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {group.primary.evidence_count} evidence items • Tier {group.primary.tier_depth}
        </div>
      </div>

      {group.alternatives && group.alternatives.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <div className="text-xs font-semibold text-gray-600 mb-2">Alternatives:</div>
          <div className="space-y-2">
            {group.alternatives.map((alt, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <span className="text-gray-900">{alt.value}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({(alt.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            IAB Consumer Profile
          </h1>
          <p className="text-gray-600 mt-1">
            Schema v{profile?.schema_version || '2.0'} - Tiered Classification View
          </p>
        </div>
        <button
          onClick={() => router.push('/emails')}
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-gray-700"
        >
          Back to Emails
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Demographics</p>
          <p className="text-3xl font-bold text-gray-900">{demographicsCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Household</p>
          <p className="text-3xl font-bold text-gray-900">{householdCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Interests</p>
          <p className="text-3xl font-bold text-gray-900">{interestsCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Purchase Intent</p>
          <p className="text-3xl font-bold text-gray-900">{purchaseIntentCount}</p>
        </div>
      </div>

      {/* Demographics Section */}
      {demographicsCount > 0 && (
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Demographics
            <span className="text-sm text-gray-600 font-normal ml-2">
              (Primary & Alternatives)
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(profile?.demographics || {}).map(([field, group]) => (
              <TieredGroupCard key={field} group={group} fieldName={field} />
            ))}
          </div>
        </section>
      )}

      {/* Household Section */}
      {householdCount > 0 && (
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Household
            <span className="text-sm text-gray-600 font-normal ml-2">
              (Primary & Alternatives)
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(profile?.household || {}).map(([field, group]) => (
              <TieredGroupCard key={field} group={group} fieldName={field} />
            ))}
          </div>
        </section>
      )}

      {/* Interests Section */}
      {interestsCount > 0 && (
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Interests
            <span className="text-sm text-gray-600 font-normal ml-2">
              (Ranked by Granularity)
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profile?.interests?.map((interest, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-semibold text-gray-900">
                    {interest.primary.value}
                  </h4>
                  <GranularityBadge score={interest.granularity_score} />
                </div>
                <p className="text-xs text-gray-600 mb-4">{interest.primary.tier_path}</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confidence</span>
                    <span className="text-sm font-medium text-gray-900">
                      {(interest.primary.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${interest.primary.confidence * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">Evidence</span>
                    <span className="text-sm font-medium text-gray-900">
                      {interest.primary.evidence_count} item{interest.primary.evidence_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Tier {interest.primary.tier_depth}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Purchase Intent Section */}
      {purchaseIntentCount > 0 && (
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Purchase Intent
            <span className="text-sm text-gray-600 font-normal ml-2">
              (Ranked by Granularity)
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profile?.purchase_intent?.map((purchase, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-semibold text-gray-900">
                    {purchase.primary.value}
                  </h4>
                  <GranularityBadge score={purchase.granularity_score} />
                </div>
                <p className="text-xs text-gray-600 mb-4">{purchase.primary.tier_path}</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confidence</span>
                    <span className="text-sm font-medium text-gray-900">
                      {(purchase.primary.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${purchase.primary.confidence * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">Evidence</span>
                    <span className="text-sm font-medium text-gray-900">
                      {purchase.primary.evidence_count} item{purchase.primary.evidence_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {purchase.purchase_intent_flag && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                        {purchase.purchase_intent_flag}
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Tier {purchase.primary.tier_depth}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {demographicsCount === 0 && householdCount === 0 && interestsCount === 0 && purchaseIntentCount === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">
            No tiered classifications found. Download and classify emails to build your profile.
          </p>
        </div>
      )}
    </div>
  )
}
