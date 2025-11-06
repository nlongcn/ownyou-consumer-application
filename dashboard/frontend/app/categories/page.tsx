"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

interface Category {
  taxonomy_id: number
  parent_id: number | null
  name: string
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4: string
  tier_5: string
  tier_level: number
  category_path: string
  is_active: boolean
  section: string
}

interface Section {
  section: string
  display_name: string
  total_categories: number
  active_categories: number
  row_range: {
    start: number
    end: number
  }
}

export default function CategoriesPage() {
  const [sections, setSections] = useState<Section[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [activeOnly, setActiveOnly] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [view, setView] = useState<"sections" | "categories">("sections")
  const router = useRouter()

  useEffect(() => {
    loadSections()
  }, [])

  useEffect(() => {
    if (view === "categories") {
      loadCategories()
    }
  }, [view, selectedSection, activeOnly, searchTerm])

  async function loadSections() {
    try {
      setLoading(true)
      setError(null)

      // Check authentication
      const authStatus = await api.getAuthStatus()
      if (!authStatus.authenticated) {
        router.push('/login')
        return
      }

      const data = await api.request('/api/categories/sections')
      setSections(data.sections || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sections'
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

  async function loadCategories() {
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
      if (activeOnly) {
        params.append('active_only', 'true')
      }
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      params.append('limit', '100')

      const data = await api.request(`/api/categories/?${params.toString()}`)
      setCategories(data.categories || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load categories'
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

  function getTierColor(level: number): string {
    const colors = [
      "bg-slate-100 dark:bg-slate-800",
      "bg-blue-100 dark:bg-blue-900",
      "bg-green-100 dark:bg-green-900",
      "bg-yellow-100 dark:bg-yellow-900",
      "bg-purple-100 dark:bg-purple-900",
    ]
    return colors[level - 1] || colors[0]
  }

  if (loading && view === "sections") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading taxonomy sections...</p>
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
          <h1 className="text-3xl font-bold tracking-tight">IAB Taxonomy Categories</h1>
          <p className="text-muted-foreground">
            Browse all 1,568 categories from IAB Audience Taxonomy 1.1
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 rounded-lg border hover:bg-accent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("sections")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            view === "sections"
              ? "bg-primary text-primary-foreground"
              : "border hover:bg-accent"
          }`}
        >
          Section Overview
        </button>
        <button
          onClick={() => setView("categories")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            view === "categories"
              ? "bg-primary text-primary-foreground"
              : "border hover:bg-accent"
          }`}
        >
          Browse Categories
        </button>
      </div>

      {/* Section Overview */}
      {view === "sections" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The IAB Audience Taxonomy is organized into 6 major sections covering demographics,
            household data, interests, and purchase intent.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <Card
                key={section.section}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedSection(section.section)
                  setView("categories")
                }}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{section.display_name}</CardTitle>
                  <CardDescription>
                    {section.total_categories} categories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Active in Profile:</span>
                      <span className="font-medium text-green-600">
                        {section.active_categories}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Coverage:</span>
                      <span className="font-medium">
                        {((section.active_categories / section.total_categories) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3">
                      Excel rows {section.row_range.start}-{section.row_range.end}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Categories Browser */}
      {view === "categories" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              >
                <option value="all">All Sections</option>
                {sections.map((section) => (
                  <option key={section.section} value={section.section}>
                    {section.display_name} ({section.total_categories})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search categories..."
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:bg-accent">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-sm font-medium">Active Only</span>
              </label>
            </div>
          </div>

          {/* Results Summary */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading categories...</p>
          ) : (
            <div className="text-sm text-muted-foreground">
              Showing {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
              {activeOnly && " (active in your profile)"}
            </div>
          )}

          {/* Categories List */}
          {categories.length === 0 && !loading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No categories found matching your filters.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <Card
                  key={category.taxonomy_id}
                  className={`hover:shadow-md transition-shadow ${
                    category.is_active ? "border-l-4 border-l-green-500" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTierColor(category.tier_level)}`}>
                            Tier {category.tier_level}
                          </span>
                          {category.is_active && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                              Active
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            ID: {category.taxonomy_id}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-1">{category.category_path}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {category.section.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
