"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

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
  purchase_intent_flag?: string  // NEW: PIPR_HIGH, PIPR_MEDIUM, PIPR_LOW, ACTUAL_PURCHASE
}

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("confidence_desc")
  const router = useRouter()

  useEffect(() => {
    loadEvidence()
  }, [selectedSection, sortBy])

  async function loadEvidence() {
    try {
      setLoading(true)
      setError(null)

      // Check authentication
      const authStatus = await api.getAuthStatus()
      if (!authStatus.authenticated) {
        router.push('/login')
        return
      }

      // Build query params
      const params = new URLSearchParams()
      if (selectedSection !== "all") {
        params.append('section', selectedSection)
      }
      params.append('sort', sortBy)
      params.append('limit', '100')

      const data = await api.request(`/api/evidence/?${params.toString()}`)
      setEvidence(data.evidence || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load evidence'
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

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return "text-green-600 dark:text-green-400"
    if (confidence >= 0.6) return "text-blue-600 dark:text-blue-400"
    if (confidence >= 0.4) return "text-yellow-600 dark:text-yellow-400"
    return "text-orange-600 dark:text-orange-400"
  }

  function getConfidenceBg(confidence: number): string {
    if (confidence >= 0.8) return "bg-green-100 dark:bg-green-900"
    if (confidence >= 0.6) return "bg-blue-100 dark:bg-blue-900"
    if (confidence >= 0.4) return "bg-yellow-100 dark:bg-yellow-900"
    return "bg-orange-100 dark:bg-orange-900"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading evidence...</p>
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evidence & Reasoning</h1>
          <p className="text-muted-foreground">
            LLM explanations for each IAB taxonomy classification
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Filter by Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-background"
          >
            <option value="all">All Sections</option>
            <option value="interests">Interests</option>
            <option value="demographics">Demographics</option>
            <option value="household">Household</option>
            <option value="purchase_intent">Purchase Intent</option>
            <option value="actual_purchases">Actual Purchases</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-background"
          >
            <option value="confidence_desc">Highest Confidence</option>
            <option value="confidence_asc">Lowest Confidence</option>
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {evidence.length} classification{evidence.length !== 1 ? 's' : ''}
      </div>

      {/* Evidence List */}
      {evidence.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No classifications found. Run an analysis to generate your profile.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {evidence.map((item) => (
            <Card key={item.taxonomy_id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{item.category_path}</CardTitle>
                      {item.purchase_intent_flag && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                          {item.purchase_intent_flag.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      <span className="capitalize">{item.section.replace('_', ' ')}</span> •
                      Taxonomy ID: {item.taxonomy_id}
                    </CardDescription>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceBg(item.confidence)}`}>
                    <span className={getConfidenceColor(item.confidence)}>
                      {(item.confidence * 100).toFixed(0)}% confident
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reasoning */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-foreground">LLM Reasoning:</h4>
                  <div className="text-sm text-muted-foreground leading-relaxed bg-muted p-3 rounded-lg max-h-[300px] overflow-y-auto">
                    {item.reasoning ? (
                      <div className="space-y-2">
                        {item.reasoning.split(/\[[\d-:TZ.]+\]/).filter(text => text.trim()).map((sentence, idx) => (
                          <p key={idx} className="text-sm">
                            {sentence.trim()}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p>No reasoning provided</p>
                    )}
                  </div>
                </div>

                {/* Evidence Counts */}
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Evidence Count: </span>
                    <span className="font-medium">{item.evidence_count}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supporting: </span>
                    <span className="font-medium text-green-600">{item.supporting_evidence.length}</span>
                  </div>
                  {item.contradicting_evidence.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Contradicting: </span>
                      <span className="font-medium text-red-600">{item.contradicting_evidence.length}</span>
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <div className="flex gap-6 text-xs text-muted-foreground">
                  <div>
                    First observed: {new Date(item.first_observed).toLocaleDateString()}
                  </div>
                  <div>
                    Last updated: {new Date(item.last_updated).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
