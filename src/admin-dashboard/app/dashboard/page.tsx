/**
 * Dashboard Home Page
 *
 * Main landing page matching Python Flask dashboard functionality.
 * Shows profile summary and quick action navigation.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProfileSummary {
  success: boolean
  user_id: string
  summary: {
    total: number
    demographics: number
    household: number
    interests: number
    purchase_intent: number
    actual_purchases: number
  }
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<ProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  // TODO: Get from authentication context when implemented
  const userId = 'default_user'

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        const response = await fetch(`/api/profile?user_id=${userId}`)
        if (!response.ok) {
          throw new Error(`Failed to load profile: ${response.statusText}`)
        }

        const data = await response.json()
        setSummary(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load profile'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [userId])

  const handleDeleteProfile = async () => {
    try {
      setDeleting(true)
      // TODO: Implement delete endpoint
      alert('Delete profile endpoint not yet implemented')
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Delete profile failed:', err)
      alert('Failed to delete profile: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  const summaryData = summary?.summary || {
    total: 0,
    demographics: 0,
    household: 0,
    interests: 0,
    purchase_intent: 0,
    actual_purchases: 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">IAB Taxonomy Profile Dashboard</h1>
          <p className="text-gray-600 mt-1">
            User: <span className="font-mono">{userId}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Delete Profile
          </button>
          {/* TODO: Add logout when authentication is implemented */}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Total Classifications"
          value={summaryData.total}
          description="Across all categories"
          icon={<UsersIcon />}
        />
        <SummaryCard
          title="Demographics"
          value={summaryData.demographics}
          description="Age, gender, education"
          icon={<UsersIcon />}
        />
        <SummaryCard
          title="Household"
          value={summaryData.household}
          description="Location, income, property"
          icon={<HomeIcon />}
        />
        <SummaryCard
          title="Interests"
          value={summaryData.interests}
          description="Hobbies, passions, activities"
          icon={<ChatIcon />}
        />
        <SummaryCard
          title="Purchase Intent"
          value={summaryData.purchase_intent}
          description="Shopping signals"
          icon={<ShoppingIcon />}
        />
        <SummaryCard
          title="Actual Purchases"
          value={summaryData.actual_purchases}
          description="Confirmed transactions"
          icon={<CreditCardIcon />}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Quick Actions</h2>
        <p className="text-gray-600 mb-4">Navigate to detailed views or run new analysis</p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            title="Explore Classifications"
            description="View all taxonomy classifications"
            icon={<GridIcon />}
            onClick={() => router.push('/classifications')}
          />
          <QuickAction
            title="Profile View"
            description="Detailed profile breakdown"
            icon={<BookIcon />}
            onClick={() => router.push('/profile')}
          />
          <QuickAction
            title="Quality Analytics"
            description="Classification quality metrics"
            icon={<ChartIcon />}
            onClick={() => router.push('/quality')}
          />
          <QuickAction
            title="Run Analysis"
            description="Process new text"
            icon={<DocumentIcon />}
            onClick={() => router.push('/analyze')}
          />
          <QuickAction
            title="Browse Categories"
            description="Explore all 1,558 categories"
            icon={<FolderIcon />}
            onClick={() => router.push('/categories')}
          />
          {/* TODO: Add these when pages are implemented */}
          {/*
          <QuickAction
            title="Confidence Analysis"
            description="View confidence evolution"
            icon={<ChartIcon />}
            onClick={() => router.push('/confidence')}
          />
          <QuickAction
            title="Memory Timeline"
            description="See profile evolution over time"
            icon={<TimelineIcon />}
            onClick={() => router.push('/timeline')}
          />
          <QuickAction
            title="Evidence & Reasoning"
            description="View LLM explanations"
            icon={<DocumentIcon />}
            onClick={() => router.push('/evidence')}
          />
          */}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Delete Profile</h2>
            <p className="text-gray-600 mb-4">
              This action cannot be undone. This will permanently delete all your data.
            </p>
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium mb-2">Data to be deleted:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• {summaryData.total} classification records</li>
                <li>• All episodic memories</li>
                <li>• All cost tracking data</li>
                <li>• All analysis run history</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  description,
  icon
}: {
  title: string
  value: number
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className="text-gray-400">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}

// Quick Action Component
function QuickAction({
  title,
  description,
  icon,
  onClick
}: {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors text-left"
    >
      <div className="mb-2 text-gray-600">{icon}</div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </button>
  )
}

// Simple SVG Icons
function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function ShoppingIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}
