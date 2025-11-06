"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

interface AnalysisRun {
  run_id: string
  emails_processed: number
  total_cost: number
  provider: string
  model: string
  started_at: string
  completed_at: string
  status: string
}

interface CostSummary {
  total_cost: number
  total_emails: number
  total_runs: number
  avg_cost_per_run: number
  by_provider: Array<{
    provider: string
    provider_cost: number
    provider_emails: number
  }>
}

export default function AnalyticsPage() {
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
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

        // Load analytics data
        const [runsData, costsData] = await Promise.all([
          api.getAnalysisRuns(20),
          api.getTotalCost()
        ])

        setRuns(runsData.runs)
        setCostSummary(costsData)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics'
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
        <p className="text-muted-foreground">Loading analytics...</p>
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
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Cost Tracking</h1>
          <p className="text-muted-foreground">
            Monitor processing costs and analysis history
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Cost Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(costSummary?.total_cost || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all providers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Emails</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costSummary?.total_emails || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique emails in profile</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Analysis Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costSummary?.total_runs || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed runs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Cost/Run</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(costSummary?.avg_cost_per_run || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per analysis run</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Provider */}
      {costSummary && costSummary.by_provider.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cost by Provider</CardTitle>
            <CardDescription>LLM provider usage breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costSummary.by_provider.map((provider, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{provider.provider}</span>
                      <span className="text-sm text-muted-foreground">
                        {provider.provider_emails} emails
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${(provider.provider_cost / (costSummary.total_cost || 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium ml-4">
                    ${provider.provider_cost.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Runs History */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis History</CardTitle>
          <CardDescription>
            Recent analysis runs with processing details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No analysis runs found. Run your first analysis to see data here.
            </p>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => (
                <div
                  key={run.run_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium font-mono">{run.run_id?.slice(0, 8) || 'N/A'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        run.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {run.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {run.emails_processed} emails • {run.provider}/{run.model || 'default'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {run.total_cost != null ? `$${run.total_cost.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {run.total_cost != null && run.emails_processed > 0
                        ? `$${(run.total_cost / run.emails_processed).toFixed(4)}/email`
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
