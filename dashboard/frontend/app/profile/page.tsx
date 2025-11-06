"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TieredClassificationCard } from "@/components/TieredClassificationCard"
import { GranularityScoreBadge } from "@/components/GranularityScoreBadge"
import { api } from "@/lib/api"
import type { TieredProfile, TieredInterest, TieredPurchaseIntent } from "@/types/profile"

export default function ProfileViewPage() {
  const [profile, setProfile] = useState<TieredProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true)

        // Check authentication
        const authStatus = await api.getAuthStatus()
        if (!authStatus.authenticated) {
          router.push('/login')
          return
        }

        // Load tiered profile
        const tieredProfile = await api.getTieredProfile()
        setProfile(tieredProfile)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load tiered profile'
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

    loadProfile()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading tiered profile...</p>
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

  const demographicsCount = Object.keys(profile?.demographics || {}).length
  const householdCount = Object.keys(profile?.household || {}).length
  const interestsCount = profile?.interests?.length || 0
  const purchaseIntentCount = profile?.purchase_intent?.length || 0

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IAB Consumer Profile</h1>
          <p className="text-muted-foreground mt-1">
            Schema v{profile?.schema_version || '2.0'} - Tiered Classification View
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Demographics</CardDescription>
            <CardTitle className="text-3xl">{demographicsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Household</CardDescription>
            <CardTitle className="text-3xl">{householdCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Interests</CardDescription>
            <CardTitle className="text-3xl">{interestsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Purchase Intent</CardDescription>
            <CardTitle className="text-3xl">{purchaseIntentCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Demographics Section */}
      {demographicsCount > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            Demographics
            <span className="text-sm text-muted-foreground font-normal">
              (Primary & Alternatives)
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(profile?.demographics || {}).map(([field, group]) => (
              <TieredClassificationCard
                key={field}
                group={group}
                fieldName={field}
              />
            ))}
          </div>
        </section>
      )}

      {/* Household Section */}
      {householdCount > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            Household
            <span className="text-sm text-muted-foreground font-normal">
              (Primary & Alternatives)
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(profile?.household || {}).map(([field, group]) => (
              <TieredClassificationCard
                key={field}
                group={group}
                fieldName={field}
              />
            ))}
          </div>
        </section>
      )}

      {/* Interests Section */}
      {interestsCount > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            Interests
            <span className="text-sm text-muted-foreground font-normal">
              (Ranked by Granularity)
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profile?.interests?.map((interest: TieredInterest, idx: number) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{interest.primary.value}</CardTitle>
                    <GranularityScoreBadge score={interest.granularity_score} />
                  </div>
                  <CardDescription className="text-xs">
                    {interest.primary.tier_path}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Confidence</span>
                      <span className="text-sm font-medium">
                        {(interest.primary.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${interest.primary.confidence * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-muted-foreground">Evidence</span>
                      <span className="text-sm font-medium">
                        {interest.primary.evidence_count} item{interest.primary.evidence_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tier {interest.primary.tier_depth}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Purchase Intent Section */}
      {purchaseIntentCount > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            Purchase Intent
            <span className="text-sm text-muted-foreground font-normal">
              (Ranked by Granularity)
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profile?.purchase_intent?.map((purchase: TieredPurchaseIntent, idx: number) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{purchase.primary.value}</CardTitle>
                    <GranularityScoreBadge score={purchase.granularity_score} />
                  </div>
                  <CardDescription className="text-xs">
                    {purchase.primary.tier_path}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Confidence</span>
                      <span className="text-sm font-medium">
                        {(purchase.primary.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${purchase.primary.confidence * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-muted-foreground">Evidence</span>
                      <span className="text-sm font-medium">
                        {purchase.primary.evidence_count} item{purchase.primary.evidence_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {purchase.purchase_intent_flag && (
                      <div className="mt-2 pt-2 border-t">
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                          {purchase.purchase_intent_flag}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Tier {purchase.primary.tier_depth}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {demographicsCount === 0 && householdCount === 0 && interestsCount === 0 && purchaseIntentCount === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No tiered classifications found. Process some emails to build your profile.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
