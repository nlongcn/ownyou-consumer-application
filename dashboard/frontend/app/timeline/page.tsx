"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

interface TimelineEvent {
  date: string
  time: string
  section: string
  classification: string
  tier_path: string
  confidence: number
  created_at: string
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        // Check authentication
        const authStatus = await api.getAuthStatus()
        if (!authStatus.authenticated) {
          router.push('/login')
          return
        }

        // Get all classifications and treat them as timeline events
        const sections = ["demographics", "household", "interests", "purchase_intent", "actual_purchases"]
        const allEvents: TimelineEvent[] = []

        for (const section of sections) {
          const response = await api.getClassifications(section)
          for (const item of response.classifications) {
            const [date, time] = item.created_at.split(" ")
            allEvents.push({
              date,
              time: time || "",
              section,
              classification: item.value,
              tier_path: item.tier_path,
              confidence: item.confidence,
              created_at: item.created_at
            })
          }
        }

        // Sort by date descending
        allEvents.sort((a, b) => b.created_at.localeCompare(a.created_at))
        setEvents(allEvents)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load timeline'
        if (errorMessage.toLowerCase().includes('login') ||
            errorMessage.toLowerCase().includes('auth')) {
          router.push('/login')
          return
        }
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading timeline...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Group events by date
  const eventsByDate: Record<string, TimelineEvent[]> = {}
  events.forEach(event => {
    if (!eventsByDate[event.date]) {
      eventsByDate[event.date] = []
    }
    eventsByDate[event.date].push(event)
  })

  const sectionColors: Record<string, string> = {
    demographics: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    household: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    interests: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    purchase_intent: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    actual_purchases: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memory Timeline</h1>
          <p className="text-muted-foreground">
            Chronological view of when classifications were added
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No timeline events found. Process some emails to see your profile evolution.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.keys(eventsByDate).sort().reverse().map(date => (
            <Card key={date}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {new Date(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </CardTitle>
                <CardDescription>
                  {eventsByDate[date].length} classification{eventsByDate[date].length !== 1 ? 's' : ''} added
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {eventsByDate[date].map((event, idx) => (
                    <div key={idx} className="flex items-start space-x-4 pb-4 border-b last:border-b-0 last:pb-0">
                      <div className="flex-shrink-0 w-16 text-sm text-muted-foreground font-mono">
                        {event.time}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sectionColors[event.section]}`}>
                            {event.section.replace('_', ' ')}
                          </span>
                          <span className="font-medium">{event.classification}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.tier_path}</p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>Confidence: {(event.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
