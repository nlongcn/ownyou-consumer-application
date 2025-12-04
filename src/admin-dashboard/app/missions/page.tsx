'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { StoreAdapter, createStoreAdapter } from '@/lib/store-adapter'
import { type FeedbackType } from '@/lib/feedback-handler'
import { MissionFeed, MissionFeedHeader, type MissionFeedFilter } from '@ownyou/ui-components'
import type { MissionCard, MissionStatus, MissionAction, Episode } from '@ownyou/shared-types'
import { NS } from '@ownyou/shared-types'

/**
 * Loading component for Suspense boundary
 */
function MissionsLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading missions...</p>
      </div>
    </div>
  )
}

/**
 * Missions Page - v13 Section 3.4
 *
 * Displays mission cards from the agent framework with feedback integration.
 */
export default function MissionsPage() {
  return (
    <Suspense fallback={<MissionsLoading />}>
      <MissionsContent />
    </Suspense>
  )
}

function MissionsContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('user_id') || 'default_user'

  // State
  const [missions, setMissions] = useState<MissionCard[]>([])
  const [filter, setFilter] = useState<MissionFeedFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [store, setStore] = useState<StoreAdapter | null>(null)
  const [episodeStats, setEpisodeStats] = useState<{
    total: number
    pending: number
    positive: number
    negative: number
  } | null>(null)

  // Initialize store
  useEffect(() => {
    try {
      console.log('[Missions] Initializing StoreAdapter...')
      const newStore = createStoreAdapter('ownyou_store')
      setStore(newStore)
      console.log('[Missions] Store initialized')
    } catch (err) {
      console.error('[Missions] Failed to initialize store:', err)
      setError('Failed to initialize storage')
    }
  }, [])

  // Load missions from store
  useEffect(() => {
    if (!store) return

    const loadMissions = async () => {
      try {
        setLoading(true)
        console.log('[Missions] Loading missions for user:', userId)

        // Load missions using StoreAdapter's simplified interface
        const loadedMissions = await store.list<MissionCard>(NS.missionCards(userId), { limit: 100 })
        console.log('[Missions] Loaded', loadedMissions.length, 'missions')
        setMissions(loadedMissions)

        // Load episode stats
        const episodes = await store.list<Episode>(NS.episodicMemory(userId), { limit: 1000 })
        const stats = {
          total: episodes.length,
          pending: episodes.filter((e) => e.outcome === 'pending').length,
          positive: episodes.filter((e) => e.outcome === 'positive').length,
          negative: episodes.filter((e) => e.outcome === 'negative').length,
        }
        setEpisodeStats(stats)

        setLoading(false)
      } catch (err) {
        console.error('[Missions] Failed to load missions:', err)
        setError('Failed to load missions')
        setLoading(false)
      }
    }

    loadMissions()
  }, [store, userId])

  // Calculate counts for filter tabs
  const counts = useMemo(() => {
    const statusMap: Record<MissionFeedFilter, MissionStatus[]> = {
      all: [],
      active: ['CREATED', 'PRESENTED', 'ACTIVE'],
      snoozed: ['SNOOZED'],
      completed: ['COMPLETED'],
      dismissed: ['DISMISSED'],
    }

    const result: Record<MissionFeedFilter, number> = {
      all: missions.length,
      active: 0,
      snoozed: 0,
      completed: 0,
      dismissed: 0,
    }

    for (const mission of missions) {
      for (const [filterKey, statuses] of Object.entries(statusMap)) {
        if (filterKey !== 'all' && statuses.includes(mission.status)) {
          result[filterKey as MissionFeedFilter]++
        }
      }
    }

    return result
  }, [missions])

  // Handle mission actions (MissionAction contains type like 'navigate', 'confirm', etc.)
  const handleMissionAction = async (mission: MissionCard, action: MissionAction) => {
    if (!store) return

    try {
      console.log('[Missions] Action:', action.type, action.label, 'on mission:', mission.id)

      // Handle action based on type
      switch (action.type) {
        case 'navigate':
          // Navigate to route in payload
          const route = (action.payload as { route?: string })?.route
          if (route) {
            window.location.href = route
          }
          break
        case 'external':
          // Open external URL
          const url = (action.payload as { url?: string })?.url
          if (url) {
            window.open(url, '_blank')
          }
          break
        case 'confirm':
          // Mark mission as completed when confirmed
          const updatedMission: MissionCard = {
            ...mission,
            status: 'COMPLETED',
          }
          await store.put(NS.missionCards(userId), mission.id, updatedMission)
          setMissions(prev =>
            prev.map(m => (m.id === mission.id ? updatedMission : m))
          )
          break
        default:
          console.log('[Missions] Unhandled action type:', action.type)
      }

      console.log('[Missions] Action completed:', mission.id)
    } catch (err) {
      console.error('[Missions] Failed to handle action:', err)
      setError('Failed to handle action')
    }
  }

  // Handle mission feedback (love/like/meh)
  const handleFeedback = async (mission: MissionCard, rating: FeedbackType) => {
    if (!store) return

    try {
      console.log('[Missions] Feedback:', rating, 'on mission:', mission.id)

      // Update mission with feedback rating
      const userRating = rating === 'love' ? 5 : rating === 'like' ? 3 : 1
      const updatedMission: MissionCard = {
        ...mission,
        userRating: userRating as 1 | 2 | 3 | 4 | 5,
        status: 'COMPLETED',
      }

      await store.put(NS.missionCards(userId), mission.id, updatedMission)

      // Update linked episode if exists
      const episodes = await store.list<Episode>(NS.episodicMemory(userId), { limit: 1000 })
      const linkedEpisode = episodes.find((e) => e.missionId === mission.id)

      if (linkedEpisode) {
        const updatedEpisode: Episode = {
          ...linkedEpisode,
          userFeedback: rating,
          outcome: rating === 'meh' ? 'negative' : 'positive',
        }
        await store.put(NS.episodicMemory(userId), linkedEpisode.id, updatedEpisode)
      }

      // Update local state
      setMissions(prev =>
        prev.map(m => (m.id === mission.id ? updatedMission : m))
      )

      // Refresh episode stats
      const allEpisodes = await store.list<Episode>(NS.episodicMemory(userId), { limit: 1000 })
      setEpisodeStats({
        total: allEpisodes.length,
        pending: allEpisodes.filter((e) => e.outcome === 'pending').length,
        positive: allEpisodes.filter((e) => e.outcome === 'positive').length,
        negative: allEpisodes.filter((e) => e.outcome === 'negative').length,
      })

      console.log('[Missions] Feedback recorded:', rating)
    } catch (err) {
      console.error('[Missions] Failed to record feedback:', err)
      setError('Failed to record feedback')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Mission Cards
        </h1>
        <p className="text-gray-600">
          Personalized missions generated by your AI agents based on your interests and activities.
        </p>
      </div>

      {/* Stats */}
      {episodeStats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Agent Learning Stats
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{episodeStats.total}</div>
              <div className="text-sm text-gray-600">Total Episodes</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">{episodeStats.pending}</div>
              <div className="text-sm text-gray-600">Pending Feedback</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{episodeStats.positive}</div>
              <div className="text-sm text-gray-600">Positive Outcomes</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{episodeStats.negative}</div>
              <div className="text-sm text-gray-600">Negative Outcomes</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-red-600 mr-2">Error</span>
            <div>
              <div className="font-semibold text-red-800">Error</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Mission Feed */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <MissionFeedHeader
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
          />
        </div>

        {loading ? (
          <MissionsLoading />
        ) : (
          <MissionFeed
            missions={missions}
            filter={filter}
            onMissionAction={handleMissionAction}
            onMissionFeedback={handleFeedback}
            emptyMessage={
              filter === 'all'
                ? 'No missions yet. Missions will appear here as agents analyze your data.'
                : `No ${filter} missions`
            }
          />
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          How Missions Work
        </h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>Shopping Agent:</strong> Detects purchase intent from your emails and creates deal-finding missions
          </li>
          <li>
            <strong>Feedback Loop:</strong> Rate missions with love/like/meh to help agents learn your preferences
          </li>
          <li>
            <strong>Episodes:</strong> Each agent action creates an episode that records what triggered it and the outcome
          </li>
          <li>
            <strong>Privacy:</strong> All data stays on your device - agents run locally in your browser
          </li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Related Pages
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/emails"
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start">
              <span className="text-2xl mr-3">Email</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Email Classification</h3>
                <p className="text-sm text-gray-600">
                  Download and classify your emails to generate IAB profile data
                </p>
              </div>
            </div>
          </a>

          <a
            href="/profile"
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start">
              <span className="text-2xl mr-3">Profile</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">IAB Profile</h3>
                <p className="text-sm text-gray-600">
                  View your tiered IAB taxonomy profile built from your data
                </p>
              </div>
            </div>
          </a>

          <a
            href="/evidence"
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start">
              <span className="text-2xl mr-3">Evidence</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Evidence & Reasoning</h3>
                <p className="text-sm text-gray-600">
                  See LLM explanations and evidence for classifications
                </p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
