"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, type ProfileSummary } from "@/lib/api"

export default function DashboardPage() {
  const [summary, setSummary] = useState<ProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        // Check if user is authenticated
        const authStatus = await api.getAuthStatus()
        if (!authStatus.authenticated) {
          // Not authenticated, redirect to login
          router.push('/login')
          return
        }

        // Load profile data
        const data = await api.getProfileSummary()
        setSummary(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load profile'

        // If error contains "login" or "auth", redirect to login
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
        <p className="text-muted-foreground">Loading...</p>
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
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Make sure the backend API is running on port 5000 and you are logged in.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleLogout = async () => {
    try {
      await api.logout()
      router.push('/login')
    } catch (err) {
      console.error('Logout failed:', err)
      // Force redirect even if API call fails
      router.push('/login')
    }
  }

  const handleDeleteProfile = async () => {
    try {
      setDeleting(true)
      await api.deleteProfile()
      setShowDeleteConfirm(false)
      // Reload the page to show empty profile
      window.location.reload()
    } catch (err) {
      console.error('Delete profile failed:', err)
      alert('Failed to delete profile: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">IAB Taxonomy Profile Dashboard</h1>
          <p className="text-muted-foreground">
            User: <span className="font-mono">{summary?.user_id}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Delete Profile
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Classifications
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_classifications || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Demographics
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.demographics || 0}</div>
            <p className="text-xs text-muted-foreground">
              Age, gender, education
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Household
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.household || 0}</div>
            <p className="text-xs text-muted-foreground">
              Location, income, property
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Interests
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.interests || 0}</div>
            <p className="text-xs text-muted-foreground">
              Hobbies, passions, activities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Purchase Intent
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.purchase_intent || 0}</div>
            <p className="text-xs text-muted-foreground">
              Shopping signals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Actual Purchases
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.actual_purchases || 0}</div>
            <p className="text-xs text-muted-foreground">
              Confirmed transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Navigate to detailed views or run new analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => router.push('/classifications')}
            className="flex flex-col items-start space-y-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Explore Classifications
              </p>
              <p className="text-sm text-muted-foreground">
                View all taxonomy classifications
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/profile')}
            className="flex flex-col items-start space-y-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Tiered Profile View
              </p>
              <p className="text-sm text-muted-foreground">
                Primary & alternative classifications
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/confidence')}
            className="flex flex-col items-start space-y-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Confidence Analysis
              </p>
              <p className="text-sm text-muted-foreground">
                View confidence evolution
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/timeline')}
            className="flex flex-col items-start space-y-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Memory Timeline
              </p>
              <p className="text-sm text-muted-foreground">
                See profile evolution over time
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/analyze')}
            className="flex flex-col items-start space-y-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" x2="8" y1="13" y2="13" />
              <line x1="16" x2="8" y1="17" y2="17" />
              <line x1="10" x2="8" y1="9" y2="9" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Run Analysis
              </p>
              <p className="text-sm text-muted-foreground">
                Process new emails
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/analytics')}
            className="flex flex-col items-start space-y-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Analytics
              </p>
              <p className="text-sm text-muted-foreground">
                View costs & history
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/evidence')}
            className="flex flex-col items-start space-y-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="M9 15h6" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Evidence & Reasoning
              </p>
              <p className="text-sm text-muted-foreground">
                View LLM explanations
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/categories')}
            className="flex flex-col items-start space-y-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
              <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
              <path d="M12 3v6" />
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Browse Categories
              </p>
              <p className="text-sm text-muted-foreground">
                Explore all 1,568 categories
              </p>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Delete Profile</CardTitle>
              <CardDescription>
                This action cannot be undone. This will permanently delete all your data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Data to be deleted:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {summary?.total_classifications || 0} classification records</li>
                  <li>• All episodic memories</li>
                  <li>• All cost tracking data</li>
                  <li>• All analysis run history</li>
                </ul>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProfile}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Everything'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
