# GUI Enhancement Plan: Tiered Classification Display

## Overview

This document outlines the plan to enhance the dashboard GUI to display the new **tiered confidence classification system** (Schema v2.0), enabling users to see:
- **Primary classifications** (highest confidence/granularity)
- **Alternative classifications** (viable alternatives with confidence deltas)
- **Granularity scores** (confidence + tier depth bonus)
- **Selection methods** (how primary was chosen)

## Current Dashboard Architecture

### Backend (Flask API)
- **Profile API** (`dashboard/backend/api/profile.py`)
  - `/api/profile/summary` - Classification counts
  - `/api/profile/classifications` - Flat list of classifications
  - `/api/profile/sections` - All sections with classifications
  - `/api/profile/timeline` - Timeline of classification additions

### Frontend (Next.js)
- **Classification Explorer** (`dashboard/frontend/app/classifications/page.tsx`)
  - Section tabs (demographics, household, interests, purchase_intent)
  - Card-based grid display
  - Confidence bars and evidence counts
  - Current display: **Flat structure** (no primary/alternative distinction)

### Database Layer
- **Queries** (`dashboard/backend/db/queries.py`)
  - `get_all_classifications()` - Retrieves flat list from semantic memories
  - Data stored in SQLite `memories` table (LangMem format)

## Enhancement Plan

### Phase 1: Backend API Enhancement

#### 1.1 Create Tiered Classification Query Function

**File:** `dashboard/backend/db/queries.py`

**New Function:**
```python
def get_tiered_classifications(user_id: str) -> Dict[str, Any]:
    """
    Get tiered classification structure for user.

    Returns:
        {
            "demographics": {
                "gender": {
                    "primary": {...},
                    "alternatives": [...],
                    "selection_method": "highest_confidence"
                },
                ...
            },
            "household": {...},
            "interests": [
                {
                    "primary": {...},
                    "alternatives": [],
                    "granularity_score": 1.10
                },
                ...
            ],
            "purchase_intent": [...]
        }
    """
```

**Implementation:**
1. Retrieve all semantic memories for user
2. Group by section (demographics, household, interests, purchase_intent)
3. Import `apply_tiered_classification` from `classification_tier_selector`
4. Apply tiering logic to each section
5. Format using `profile_tier_formatter` functions

#### 1.2 Add New API Endpoint

**File:** `dashboard/backend/api/profile.py`

**New Endpoint:**
```python
@profile_bp.route('/tiered', methods=['GET'])
@login_required
def get_tiered_profile():
    """
    Get user profile with tiered classification structure.

    Returns:
        200: Tiered classification structure
        {
            "schema_version": "2.0",
            "demographics": {...},
            "household": {...},
            "interests": [...],
            "purchase_intent": [...]
        }
    """
```

**Optional Parameters:**
- `?section=demographics` - Get tiered structure for specific section
- `?granularity_threshold=0.7` - Custom granularity threshold

### Phase 2: Frontend TypeScript Interfaces

#### 2.1 Define Tiered Classification Types

**File:** `dashboard/frontend/types/profile.ts` (new file)

```typescript
export interface TieredClassification {
  taxonomy_id: number
  tier_path: string
  value: string
  confidence: number
  evidence_count: number
  last_validated: string
  days_since_validation: number
  tier_depth: number
  granularity_score: number
  classification_type: 'primary' | 'alternative'
  confidence_delta?: number  // Only for alternatives
}

export interface TieredGroup {
  primary: TieredClassification
  alternatives: TieredClassification[]
  selection_method: 'highest_confidence' | 'granularity_weighted' | 'non_exclusive'
}

export interface TieredDemographics {
  [field: string]: TieredGroup  // gender, age_range, education, etc.
}

export interface TieredInterest {
  primary: TieredClassification
  alternatives: TieredClassification[]
  selection_method: string
  granularity_score: number
}

export interface TieredProfile {
  schema_version: string
  demographics: TieredDemographics
  household: { [field: string]: TieredGroup }
  interests: TieredInterest[]
  purchase_intent: TieredInterest[]
}
```

#### 2.2 Update API Client

**File:** `dashboard/frontend/lib/api.ts`

```typescript
export const api = {
  // ... existing methods ...

  getTieredProfile: async (): Promise<TieredProfile> => {
    return fetchWithAuth('/api/profile/tiered')
  },

  getTieredSection: async (section: string): Promise<any> => {
    return fetchWithAuth(`/api/profile/tiered?section=${section}`)
  }
}
```

### Phase 3: UI Components for Tiered Display

#### 3.1 Primary/Alternative Card Component

**File:** `dashboard/frontend/components/TieredClassificationCard.tsx` (new)

```typescript
interface Props {
  group: TieredGroup
  fieldName: string
}

export function TieredClassificationCard({ group, fieldName }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{fieldName}</CardTitle>
          <Badge variant="default">Primary</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Primary Classification */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{group.primary.value}</span>
            <span className="text-sm text-muted-foreground">
              {(group.primary.confidence * 100).toFixed(1)}%
            </span>
          </div>

          {/* Granularity Score Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Granularity Score:</span>
            <GranularityScoreBadge score={group.primary.granularity_score} />
          </div>

          {/* Tier Depth Indicator */}
          <div className="text-xs text-muted-foreground">
            Tier {group.primary.tier_depth} | {group.primary.evidence_count} evidence
          </div>
        </div>

        {/* Alternative Classifications */}
        {group.alternatives.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Alternatives
            </p>
            {group.alternatives.map((alt, idx) => (
              <div key={idx} className="flex items-center justify-between py-1">
                <span className="text-sm">{alt.value}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {(alt.confidence * 100).toFixed(1)}%
                  </span>
                  <ConfidenceDeltaBadge delta={alt.confidence_delta} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selection Method */}
        <div className="text-xs text-muted-foreground mt-3">
          Method: {group.selection_method.replace('_', ' ')}
        </div>
      </CardContent>
    </Card>
  )
}
```

#### 3.2 Granularity Score Badge

**File:** `dashboard/frontend/components/GranularityScoreBadge.tsx` (new)

```typescript
interface Props {
  score: number
}

export function GranularityScoreBadge({ score }: Props) {
  // Color gradient based on score
  // 0.5-0.7: yellow, 0.7-0.9: blue, 0.9-1.1: green, 1.1+: purple
  const getColor = (score: number) => {
    if (score >= 1.1) return 'bg-purple-100 text-purple-800 border-purple-200'
    if (score >= 0.9) return 'bg-green-100 text-green-800 border-green-200'
    if (score >= 0.7) return 'bg-blue-100 text-blue-800 border-blue-200'
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${getColor(score)}`}>
      {score.toFixed(2)}
    </span>
  )
}
```

#### 3.3 Confidence Delta Badge

**File:** `dashboard/frontend/components/ConfidenceDeltaBadge.tsx` (new)

```typescript
interface Props {
  delta?: number
}

export function ConfidenceDeltaBadge({ delta }: Props) {
  if (!delta) return null

  // Color based on delta (lower = closer to primary)
  // 0-0.1: green (very close), 0.1-0.2: blue (close), 0.2-0.3: yellow (within threshold)
  const getColor = (delta: number) => {
    if (delta <= 0.1) return 'bg-green-100 text-green-700'
    if (delta <= 0.2) return 'bg-blue-100 text-blue-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${getColor(delta)}`}>
      Δ{delta.toFixed(2)}
    </span>
  )
}
```

### Phase 4: New Profile View Page

#### 4.1 Create Profile View Page

**File:** `dashboard/frontend/app/profile/page.tsx` (new)

```typescript
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { TieredClassificationCard } from "@/components/TieredClassificationCard"
import { TieredProfile } from "@/types/profile"
import { api } from "@/lib/api"

export default function ProfileViewPage() {
  const [profile, setProfile] = useState<TieredProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      try {
        const authStatus = await api.getAuthStatus()
        if (!authStatus.authenticated) {
          router.push('/login')
          return
        }

        const tieredProfile = await api.getTieredProfile()
        setProfile(tieredProfile)
      } catch (err) {
        console.error('Failed to load tiered profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  if (loading) return <div>Loading profile...</div>

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">IAB Consumer Profile</h1>
          <p className="text-muted-foreground">
            Schema v{profile?.schema_version} - Tiered Classification View
          </p>
        </div>
        <button onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </button>
      </div>

      {/* Demographics Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Demographics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(profile?.demographics || {}).map(([field, group]) => (
            <TieredClassificationCard
              key={field}
              group={group}
              fieldName={field.replace('_', ' ')}
            />
          ))}
        </div>
      </section>

      {/* Interests Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Interests
          <span className="text-sm text-muted-foreground ml-2">
            (ranked by granularity)
          </span>
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profile?.interests.map((interest, idx) => (
            <InterestCard key={idx} interest={interest} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

### Phase 5: Enhanced Classification Explorer

#### 5.1 Update Existing Classifications Page

**File:** `dashboard/frontend/app/classifications/page.tsx`

**Enhancements:**
1. Add toggle switch: "Flat View" vs "Tiered View"
2. In Tiered View:
   - Group mutually-exclusive classifications
   - Show primary with green border
   - Show alternatives with yellow border
   - Display confidence deltas
3. Add granularity score sorting for interests
4. Add filter: "Show alternatives" toggle

### Phase 6: Navigation Updates

#### 6.1 Add Profile View Link

**File:** `dashboard/frontend/app/dashboard/page.tsx`

Add card linking to new `/profile` page:

```typescript
<Card onClick={() => router.push('/profile')}>
  <CardHeader>
    <CardTitle>View Tiered Profile</CardTitle>
    <CardDescription>
      See primary and alternative classifications with granularity scores
    </CardDescription>
  </CardHeader>
</Card>
```

## Visual Design Mockup

### Primary Classification Card
```
┌─────────────────────────────────┐
│ Gender              [Primary]   │
├─────────────────────────────────┤
│ Female                    99%   │
│ Granularity Score: [1.04]       │
│ Tier 2 | 5 evidence             │
│                                 │
│ ─────── Alternatives ─────────  │
│ Male                73% Δ0.26   │
│                                 │
│ Method: highest confidence      │
└─────────────────────────────────┘
```

### Interest Card (Non-Exclusive)
```
┌─────────────────────────────────┐
│ Remote Working      [1.10]      │
├─────────────────────────────────┤
│ Interest | Careers | Remote     │
│ Confidence: 95%                 │
│ Tier 3 | 3 evidence             │
│                                 │
│ Granularity weighted selection  │
└─────────────────────────────────┘
```

## Implementation Checklist

### Backend
- [ ] Add `get_tiered_classifications()` to `queries.py`
- [ ] Create `/api/profile/tiered` endpoint in `profile.py`
- [ ] Test endpoint with real user data
- [ ] Add error handling for missing classifications

### Frontend - Types & API
- [ ] Create `types/profile.ts` with TypeScript interfaces
- [ ] Update `lib/api.ts` with `getTieredProfile()` method
- [ ] Test API integration

### Frontend - Components
- [ ] Create `TieredClassificationCard.tsx`
- [ ] Create `GranularityScoreBadge.tsx`
- [ ] Create `ConfidenceDeltaBadge.tsx`
- [ ] Create `InterestCard.tsx` for non-exclusive display

### Frontend - Pages
- [ ] Create new `/profile` page
- [ ] Update `/classifications` page with tiered toggle
- [ ] Update `/dashboard` page with profile link
- [ ] Test navigation flow

### Testing
- [ ] Unit test backend tiered query function
- [ ] Integration test API endpoint
- [ ] Manual UI testing with various classification scenarios:
  - Single primary (no alternatives)
  - Primary with multiple alternatives
  - High granularity interests (tier 4-5)
  - Low confidence classifications (< 0.7)
- [ ] Cross-browser testing

### Documentation
- [ ] Update dashboard README with tiered view instructions
- [ ] Create user guide for interpreting tiered classifications
- [ ] Document API endpoint in backend API docs

## Future Enhancements

1. **Interactive Conflict Resolution**
   - Allow users to manually select primary when alternatives are close (Δ < 0.1)
   - Store user overrides in separate table

2. **Confidence Timeline Charts**
   - Visualize how primary/alternative rankings change over time
   - Show when classifications "flipped" (alternative became primary)

3. **Export Tiered Profile**
   - Download button for JSON/CSV export with tiered structure
   - Share profile link with encrypted tiered data

4. **Advanced Filtering**
   - Filter by selection method
   - Filter by granularity score range
   - Show only classifications with alternatives

5. **Mobile-Responsive Tiered View**
   - Collapsible alternatives section
   - Swipe to see alternatives
   - Compact granularity badge

## Dependencies

### Backend
- Existing: `classification_tier_selector.py`
- Existing: `profile_tier_formatter.py`
- Existing: SQLite memory database

### Frontend
- Existing: Next.js, React, TypeScript
- Existing: Tailwind CSS, shadcn/ui components
- New: Chart.js (optional, for timeline visualization)

## Estimated Effort

- **Backend API (Phase 1)**: 2-3 hours
- **TypeScript Interfaces (Phase 2)**: 1 hour
- **UI Components (Phase 3)**: 3-4 hours
- **Profile View Page (Phase 4)**: 2 hours
- **Classification Explorer Updates (Phase 5)**: 2 hours
- **Testing & Polish**: 2-3 hours

**Total: 12-15 hours**

## Success Metrics

1. Users can clearly distinguish primary vs alternative classifications
2. Granularity scores are visually intuitive (color coding effective)
3. Confidence deltas help users understand uncertainty
4. Navigation between flat and tiered views is seamless
5. Page load time remains under 1 second for typical profiles

## References

- Schema v2.0 Documentation: `docs/IAB_PROFILE_SCHEMA_v2.md`
- Tier Selector Algorithm: `src/email_parser/utils/classification_tier_selector.py`
- Profile Formatter: `src/email_parser/utils/profile_tier_formatter.py`
- Current Dashboard: `dashboard/frontend/app/classifications/page.tsx`
