"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

interface Classification {
  category: string
  confidence: number
  created_at: string
  evidence_count: number
  section: string
  taxonomy_id: number
  tier_path: string
  value: string
}

interface EvidenceDetail {
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
  source_emails: Array<{
    email_id: string
    subject: string
    date: string
    summary: string
  }>
}

export default function ClassificationsPage() {
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>("interests")
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [evidenceDetail, setEvidenceDetail] = useState<EvidenceDetail | null>(null)
  const [loadingEvidence, setLoadingEvidence] = useState(false)
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

        // Load classifications for selected section
        const response = await api.getClassifications(selectedSection)
        setClassifications(response.classifications)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load classifications'
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
  }, [router, selectedSection])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading classifications...</p>
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

  const handleViewEvidence = async (taxonomyId: number) => {
    try {
      setLoadingEvidence(true)
      const data = await api.getEvidenceById(taxonomyId)
      setEvidenceDetail(data)
      setShowEvidenceModal(true)
    } catch (err) {
      console.error('Failed to load evidence:', err)
      setError('Failed to load evidence details')
    } finally {
      setLoadingEvidence(false)
    }
  }

  const sections = ["demographics", "household", "interests", "purchase_intent", "actual_purchases"]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classification Explorer</h1>
          <p className="text-muted-foreground">
            Browse all IAB taxonomy classifications by category
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex space-x-2 border-b">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => setSelectedSection(section)}
            className={`px-4 py-2 capitalize transition-colors ${
              selectedSection === section
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {section.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Classifications Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classifications.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No classifications found for {selectedSection.replace('_', ' ')}
              </p>
            </CardContent>
          </Card>
        ) : (
          classifications.map((item, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-base">{item.value}</CardTitle>
                <CardDescription>{item.tier_path}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confidence</span>
                    <span className="text-sm font-medium">{(item.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${item.confidence * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">Evidence</span>
                    <span className="text-sm font-medium">{item.evidence_count} item{item.evidence_count !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added: {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => handleViewEvidence(item.taxonomy_id)}
                    disabled={loadingEvidence}
                    className="w-full mt-3 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {loadingEvidence ? 'Loading...' : 'View Evidence'}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Evidence Modal */}
      {showEvidenceModal && evidenceDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowEvidenceModal(false)}>
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{evidenceDetail.value}</h2>
                <p className="text-sm text-muted-foreground">{evidenceDetail.category_path}</p>
              </div>
              <button
                onClick={() => setShowEvidenceModal(false)}
                className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Confidence and Evidence Count */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Confidence</p>
                      <p className="text-3xl font-bold">{(evidenceDetail.confidence * 100).toFixed(1)}%</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Evidence Count</p>
                      <p className="text-3xl font-bold">{evidenceDetail.evidence_count}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* LLM Reasoning */}
              <Card>
                <CardHeader>
                  <CardTitle>LLM Reasoning</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{evidenceDetail.reasoning || 'No reasoning available'}</p>
                </CardContent>
              </Card>

              {/* Source Emails */}
              {evidenceDetail.source_emails && evidenceDetail.source_emails.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Source Emails ({evidenceDetail.source_emails.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {evidenceDetail.source_emails.map((email, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-muted">
                          <p className="font-medium text-sm">{email.subject}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(email.date).toLocaleDateString()} • {email.email_id}
                          </p>
                          {email.summary && (
                            <p className="text-sm mt-2">{email.summary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <p className="font-medium">First Observed</p>
                  <p>{new Date(evidenceDetail.first_observed).toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-medium">Last Updated</p>
                  <p>{new Date(evidenceDetail.last_updated).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
