"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

interface Classification {
  value: string
  tier_path: string
  confidence: number
  section: string
  evidence_count: number
}

export default function ConfidencePage() {
  const [classifications, setClassifications] = useState<Classification[]>([])
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

        // Get all classifications
        const sections = ["demographics", "household", "interests", "purchase_intent", "actual_purchases"]
        const allClassifications: Classification[] = []

        for (const section of sections) {
          const response = await api.getClassifications(section)
          for (const item of response.classifications) {
            allClassifications.push({
              value: item.value,
              tier_path: item.tier_path,
              confidence: item.confidence,
              section,
              evidence_count: item.evidence_count
            })
          }
        }

        // Sort by confidence descending
        allClassifications.sort((a, b) => b.confidence - a.confidence)
        setClassifications(allClassifications)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load confidence data'
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
        <p className="text-muted-foreground">Loading confidence data...</p>
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

  // Group by confidence level
  const highConfidence = classifications.filter(c => c.confidence >= 0.8)
  const mediumConfidence = classifications.filter(c => c.confidence >= 0.5 && c.confidence < 0.8)
  const lowConfidence = classifications.filter(c => c.confidence < 0.5)

  const ConfidenceCard = ({ title, items, color }: { title: string; items: Classification[]; color: string }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-2xl font-bold">{items.length}</span>
        </CardTitle>
        <CardDescription>
          {items.length === 0 ? 'No classifications' : `${items.length} classification${items.length !== 1 ? 's' : ''}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classifications in this confidence range</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.tier_path}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.evidence_count} evidence item{item.evidence_count !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <span className={`text-sm font-semibold ${color}`}>
                    {(item.confidence * 100).toFixed(1)}%
                  </span>
                  <div className="w-24 bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${color.includes('green') ? 'bg-green-500' : color.includes('yellow') ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${item.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Confidence Analysis</h1>
          <p className="text-muted-foreground">
            Classification confidence scores grouped by reliability
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {classifications.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No classifications found. Process some emails to see confidence analysis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Classifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{classifications.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all categories</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(classifications.reduce((sum, c) => sum + c.confidence, 0) / classifications.length * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Mean confidence score</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">High Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{highConfidence.length}</div>
                <p className="text-xs text-muted-foreground mt-1">≥80% confidence</p>
              </CardContent>
            </Card>
          </div>

          {/* Confidence Groups */}
          <div className="space-y-6">
            <ConfidenceCard
              title="High Confidence (≥80%)"
              items={highConfidence}
              color="text-green-600 dark:text-green-400"
            />
            <ConfidenceCard
              title="Medium Confidence (50-79%)"
              items={mediumConfidence}
              color="text-yellow-600 dark:text-yellow-400"
            />
            <ConfidenceCard
              title="Low Confidence (<50%)"
              items={lowConfidence}
              color="text-red-600 dark:text-red-400"
            />
          </div>
        </>
      )}
    </div>
  )
}
