/**
 * Profile Page
 *
 * Displays user's IAB taxonomy profile with classification summary.
 *
 * This is a migration from Flask dashboard to TypeScript Next.js.
 * Key difference: Direct IndexedDB access (client-side) vs SQLite API calls (server-side).
 */

'use client'

import { useProfileSummary } from '@/lib/use-profile'

export default function ProfilePage() {
  // TODO: Get userId from authentication context
  // For now, using default_user for POC
  const userId = 'default_user'
  const { summary, loading, error, refetch } = useProfileSummary(userId)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Profile</h2>
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

  if (!summary) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">No Profile Data</h2>
          <p className="text-yellow-700">No classifications found for this user.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">IAB Taxonomy Profile</h1>
          <p className="text-gray-600 mt-1">User: {summary.user_id}</p>
        </div>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SummaryCard
          title="Total Classifications"
          count={summary.total_classifications}
          color="blue"
          description="All IAB taxonomy categories assigned"
        />
        <SummaryCard
          title="Demographics"
          count={summary.demographics}
          color="purple"
          description="Gender, age, education, etc."
        />
        <SummaryCard
          title="Household"
          count={summary.household}
          color="green"
          description="Family structure, income level"
        />
        <SummaryCard
          title="Interests"
          count={summary.interests}
          color="orange"
          description="Hobbies, topics, passions"
        />
        <SummaryCard
          title="Purchase Intent"
          count={summary.purchase_intent}
          color="pink"
          description="Products/services considering"
        />
        <SummaryCard
          title="Actual Purchases"
          count={summary.actual_purchases}
          color="indigo"
          description="Confirmed transactions"
        />
      </div>

      {/* Status Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Migration Status
        </h3>
        <p className="text-blue-700">
          ✅ Profile Summary API migrated from Flask → TypeScript Next.js
        </p>
        <p className="text-blue-700 mt-1">
          ✅ Data Source: IndexedDB (self-sovereign, browser-based)
        </p>
        <p className="text-blue-700 mt-1">
          ⏳ Next: Migrate Classifications List, Evidence Viewer, Analysis Runner
        </p>
      </div>
    </div>
  )
}

// Summary Card Component
function SummaryCard({
  title,
  count,
  color,
  description,
}: {
  title: string
  count: number
  color: 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'indigo'
  description: string
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    pink: 'bg-pink-50 border-pink-200 text-pink-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6`}>
      <h3 className="text-sm font-medium mb-1">{title}</h3>
      <p className="text-4xl font-bold mb-2">{count}</p>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  )
}
