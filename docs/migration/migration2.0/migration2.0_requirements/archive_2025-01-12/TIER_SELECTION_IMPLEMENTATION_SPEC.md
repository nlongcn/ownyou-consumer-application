# Tiered Classification System - Implementation Specification

**Date:** 2025-01-12
**Author:** Claude (Sonnet 4.5)
**Status:** Implementation Plan
**Migration Type:** Python → TypeScript (Browser PWA)

---

## Executive Summary

This document specifies the implementation of the **Tiered Confidence Classification System** for the browser-based IAB classifier. This system is currently implemented in Python (`src/email_parser/utils/classification_tier_selector.py`) but **completely missing** from the TypeScript browser implementation.

### What's Being Built

Two new TypeScript modules that port ~400 lines of critical classification logic:

1. **`tierSelector.ts`** - Core tier selection algorithms (~280 lines)
2. **`profileTierFormatter.ts`** - Profile formatting functions (~120 lines)

### Why It's Critical

Without this system:
- Users see **conflicting classifications** (Male AND Female)
- **Generic classifications beat specific ones** ("Technology" beats "Machine Learning")
- **Noisy profiles** cluttered with low-confidence alternatives
- **Loss of utility** compared to Python version

### Success Criteria

✅ All 8 tier selection functions ported line-by-line
✅ TypeScript compiles with zero errors (`npx tsc --noEmit`)
✅ Mutually-exclusive conflicts resolved (Male XOR Female)
✅ Granularity prioritization working (tier_5 > tier_2 when confidence high)
✅ Confidence delta threshold filters alternatives correctly
✅ Profile quality matches Python implementation

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Python Source Analysis](#python-source-analysis)
3. [TypeScript Type System](#typescript-type-system)
4. [Module 1: tierSelector.ts](#module-1-tierselectorts)
5. [Module 2: profileTierFormatter.ts](#module-2-profiletierformatters)
6. [Integration Points](#integration-points)
7. [Testing Strategy](#testing-strategy)
8. [Migration Verification](#migration-verification)
9. [Dependencies](#dependencies)
10. [Implementation Checklist](#implementation-checklist)

---

## 1. System Architecture

### 1.1 Current Python Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ email_parser/workflow/graph.py (Classification Workflow)   │
│                                                             │
│  1. Analyzer Nodes → Raw classifications                   │
│  2. Reconcile Node → Semantic memory (flat structure)      │
│  3. main.py → Build profile from memory                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ email_parser/utils/classification_tier_selector.py         │
│                                                             │
│  • calculate_tier_depth()                                  │
│  • calculate_granularity_score()                           │
│  • select_primary_and_alternatives()                       │
│  • group_classifications_by_tier()                         │
│  • is_mutually_exclusive_tier()                            │
│  • apply_tiered_classification()                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ email_parser/utils/profile_tier_formatter.py               │
│                                                             │
│  • format_tiered_demographics()                            │
│  • format_tiered_household()                               │
│  • format_tiered_interests()                               │
│  • format_tiered_purchase_intent()                         │
│  • add_tiered_structure_to_profile()                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │ Tiered Profile JSON  │
                │ (schema_version: 2.0)│
                └─────────────────────┘
```

### 1.2 Target TypeScript Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ browser/agents/iab-classifier/index.ts (Workflow)          │
│                                                             │
│  1. Analyzer Nodes → Raw classifications                   │
│  2. Reconcile Node → IndexedDB semantic memory (flat)      │
│  3. Profile API → Read from memory                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ browser/agents/iab-classifier/tierSelector.ts (NEW)        │
│                                                             │
│  • calculateTierDepth()                                    │
│  • calculateGranularityScore()                             │
│  • selectPrimaryAndAlternatives()                          │
│  • groupClassificationsByTier()                            │
│  • isMutuallyExclusiveTier()                               │
│  • applyTieredClassification()                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ browser/agents/iab-classifier/profileTierFormatter.ts (NEW)│
│                                                             │
│  • formatTieredDemographics()                              │
│  • formatTieredHousehold()                                 │
│  • formatTieredInterests()                                 │
│  • formatTieredPurchaseIntent()                            │
│  • addTieredStructureToProfile()                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │ Tiered Profile JSON  │
                │ (schema_version: 2.0)│
                └─────────────────────┘
```

### 1.3 Data Flow

```
┌──────────────┐
│ Raw          │
│ Classification│  confidence: 0.99
│ (Female)     │  tier_1: "Demographic"
└──────┬───────┘  tier_2: "Female"
       │          grouping_value: "Gender"
       │
       ▼
┌──────────────────────────────────────────────┐
│ 1. Group by grouping_value                   │
│    Gender: [Female (0.99), Male (0.89)]      │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 2. Calculate scores                          │
│    Female: score=1.04 (0.99 + 2*0.05)        │
│    Male:   score=0.99 (0.89 + 2*0.05)        │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 3. Select primary (highest score)            │
│    Primary: Female (score=1.04)              │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ 4. Select alternatives (within delta=0.3)    │
│    Male: confidence_delta = 0.99-0.89 = 0.10 │
│    ✓ Include (0.10 <= 0.3)                   │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Tiered Classification                        │
│ {                                            │
│   "primary": {                               │
│     "value": "Female",                       │
│     "confidence": 0.99,                      │
│     "granularity_score": 1.04,               │
│     "tier_depth": 2                          │
│   },                                         │
│   "alternatives": [{                         │
│     "value": "Male",                         │
│     "confidence": 0.89,                      │
│     "granularity_score": 0.99,               │
│     "confidence_delta": 0.10                 │
│   }],                                        │
│   "selection_method": "granularity_weighted" │
│ }                                            │
└──────────────────────────────────────────────┘
```

---

## 2. Python Source Analysis

### 2.1 classification_tier_selector.py (399 lines)

**Purpose**: Core tier selection algorithms

**Key Functions**:

| Function | Lines | Purpose | Returns |
|----------|-------|---------|---------|
| `calculate_tier_depth()` | 51-74 | Count non-empty tiers (1-5) | int (1-5) |
| `calculate_granularity_score()` | 77-112 | confidence + (depth × 0.05) if conf ≥ 0.7 | float |
| `select_primary_and_alternatives()` | 115-221 | Main selection algorithm | TieredClassification |
| `group_classifications_by_tier()` | 224-284 | Group by `grouping_value` | Dict[str, List] |
| `is_mutually_exclusive_tier()` | 287-319 | Check if exclusive (Gender) vs non-exclusive (Interests) | bool |
| `apply_tiered_classification()` | 322-398 | Entry point - calls all others | Dict[str, TieredClassification] |

**Key Algorithms**:

1. **Tier Depth Calculation** (Lines 51-74):
   ```python
   tiers = [tier_1, tier_2, tier_3, tier_4, tier_5]
   return len([t for t in tiers if t and t.strip()])
   ```

2. **Granularity Score** (Lines 77-112):
   ```python
   if confidence >= 0.7:
       score = confidence + (tier_depth * 0.05)
   else:
       score = confidence
   ```

3. **Primary Selection** (Lines 115-221):
   ```python
   # Step 1: Filter by min_confidence (default: 0.5)
   viable = [c for c in classifications if c["confidence"] >= 0.5]

   # Step 2: Calculate granularity scores
   scored = [(c, calculate_granularity_score(c)) for c in viable]

   # Step 3: Sort by granularity score
   scored.sort(reverse=True, key=lambda x: x[1])

   # Step 4: Select primary
   primary = scored[0]

   # Step 5: Select alternatives (confidence_delta <= 0.3)
   alternatives = [c for c in scored[1:]
                   if (primary_conf - c.confidence) <= 0.3]
   ```

### 2.2 profile_tier_formatter.py (254 lines)

**Purpose**: Format flat classifications into tiered JSON structure

**Key Functions**:

| Function | Lines | Purpose | Returns |
|----------|-------|---------|---------|
| `format_tiered_demographics()` | 18-66 | Format demographics section | Dict[str, TieredGroup] |
| `format_tiered_household()` | 69-124 | Format household section | Dict[str, TieredGroup] |
| `format_tiered_interests()` | 127-160 | Format interests (non-exclusive) | List[TieredInterest] |
| `format_tiered_purchase_intent()` | 163-196 | Format purchase intent | List[TieredPurchaseIntent] |
| `add_tiered_structure_to_profile()` | 224-253 | Entry point - adds to profile dict | Dict |

**Key Mappings**:

```python
# Demographics grouping_value → field name
grouping_to_field = {
    "Gender": "gender",
    "Age": "age_range",
    "Education (Highest Level)": "education",
    "Employment Status": "occupation",
    "Marital Status": "marital_status",
    "Language": "language",
}

# Household grouping_value → field name
grouping_to_field = {
    "Home Location": "location",
    "Household Income (USD)": "income",
    "Length of Residence": "length_of_residence",
    "Life Stage": "life_stage",
    "Median Home Value (USD)": "median_home_value",
    "Monthly Housing Payment (USD)": "monthly_housing_payment",
    "Number of Adults": "number_of_adults",
    "Number of Children": "number_of_children",
    "Number of Individuals": "number_of_individuals",
    "Ownership": "ownership",
    "Property Type": "property_type",
    "Urbanization": "urbanization",
    "Language": "language"
}
```

---

## 3. TypeScript Type System

### 3.1 Core Types

```typescript
/**
 * TaxonomySelection - Raw classification from analyzer
 *
 * This is the INPUT to tier selection (from semantic memory)
 */
export interface TaxonomySelection {
  taxonomy_id: number
  section: string
  value: string
  confidence: number
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4: string
  tier_5: string
  tier_path: string
  category_path: string
  grouping_tier_key: string
  grouping_value: string
  reasoning: string
  evidence_count?: number
  last_validated?: string
  days_since_validation?: number
  supporting_evidence?: Array<{
    content: string
    source: string
    confidence: number
  }>
  purchase_intent_flag?: string
}

/**
 * TieredClassification - Result of tier selection
 *
 * This is the OUTPUT from tier selection
 */
export interface TieredClassification {
  primary: TaxonomySelection & {
    granularity_score: number
    tier_depth: number
    classification_type: 'primary'
  }
  alternatives: Array<TaxonomySelection & {
    granularity_score: number
    tier_depth: number
    classification_type: 'alternative'
    confidence_delta: number
  }>
  tier_group: string
  selection_method: 'highest_confidence' | 'granularity_weighted' | 'non_exclusive'
}

/**
 * TieredGroup - Demographics/Household format
 */
export interface TieredGroup {
  primary: {
    taxonomy_id: number
    tier_path: string
    value: string
    confidence: number
    evidence_count: number
    last_validated?: string
    days_since_validation?: number
    tier_depth: number
    granularity_score: number
    classification_type: 'primary'
  }
  alternatives: Array<{
    taxonomy_id: number
    tier_path: string
    value: string
    confidence: number
    evidence_count: number
    last_validated?: string
    days_since_validation?: number
    tier_depth: number
    granularity_score: number
    classification_type: 'alternative'
    confidence_delta: number
  }>
  selection_method: string
}

/**
 * TieredInterest - Interests format (non-exclusive)
 */
export interface TieredInterest {
  primary: {
    taxonomy_id: number
    tier_path: string
    value: string
    confidence: number
    evidence_count: number
    tier_depth: number
    granularity_score: number
    classification_type: 'primary'
  }
  alternatives: []  // Always empty for non-exclusive
  selection_method: 'non_exclusive'
  granularity_score: number
}

/**
 * TieredPurchaseIntent - Purchase Intent format
 */
export interface TieredPurchaseIntent extends TieredInterest {
  purchase_intent_flag?: string
}
```

### 3.2 Function Signatures

```typescript
// tierSelector.ts

export function calculateTierDepth(
  classification: TaxonomySelection
): number

export function calculateGranularityScore(
  classification: TaxonomySelection,
  granularityBonus?: number
): number

export function selectPrimaryAndAlternatives(
  classifications: TaxonomySelection[],
  tierGroup: string,
  minConfidence?: number,
  confidenceDeltaThreshold?: number,
  granularityBonus?: number
): TieredClassification | null

export function groupClassificationsByTier(
  classifications: TaxonomySelection[],
  section: string
): Record<string, TaxonomySelection[]>

export function isMutuallyExclusiveTier(
  groupingValue: string
): boolean

export function applyTieredClassification(
  classifications: TaxonomySelection[],
  section: string,
  minConfidence?: number,
  confidenceDeltaThreshold?: number
): Record<string, TieredClassification>
```

```typescript
// profileTierFormatter.ts

export function formatTieredDemographics(
  memories: TaxonomySelection[]
): Record<string, TieredGroup>

export function formatTieredHousehold(
  memories: TaxonomySelection[]
): Record<string, TieredGroup>

export function formatTieredInterests(
  memories: TaxonomySelection[]
): TieredInterest[]

export function formatTieredPurchaseIntent(
  memories: TaxonomySelection[]
): TieredPurchaseIntent[]

export function addTieredStructureToProfile(
  profileDict: Record<string, any>,
  memories: {
    demographics: TaxonomySelection[]
    household: TaxonomySelection[]
    interests: TaxonomySelection[]
    purchase_intent: TaxonomySelection[]
  }
): Record<string, any>
```

---

## 4. Module 1: tierSelector.ts

### 4.1 File Header

```typescript
/**
 * Tiered Classification Selector
 *
 * TypeScript port of Python classification_tier_selector.py
 * Source: src/email_parser/utils/classification_tier_selector.py (lines 1-399)
 *
 * Implements tiered confidence classification system that distinguishes between:
 * - Primary Classification: Highest confidence within mutually-exclusive tier groups
 * - Alternative Classifications: Lower confidence viable alternatives
 *
 * This enables:
 * - Conflict resolution in mutually-exclusive categories (Male vs Female, age ranges)
 * - Granularity prioritization (tier_4/tier_5 over tier_2/tier_3 when high confidence)
 * - Uncertainty preservation (keeping alternative classifications)
 * - Profile evolution tracking (smooth transitions when evidence shifts)
 *
 * Reference: docs/TIERED_CONFIDENCE_CLASSIFICATION_PROPOSAL.md
 */
```

### 4.2 Function Specifications

#### 4.2.1 calculateTierDepth()

**Python Source**: Lines 51-74

**Purpose**: Calculate number of non-empty tiers (1-5)

**Implementation**:
```typescript
/**
 * Calculate tier depth (number of non-empty tiers).
 *
 * Python source: classification_tier_selector.py:51-74
 *
 * @param classification - Classification dict with tier_1, tier_2, etc.
 * @returns Number of non-empty tiers (1-5)
 *
 * @example
 * calculateTierDepth({
 *   tier_1: "Interest",
 *   tier_2: "Technology",
 *   tier_3: "",
 *   tier_4: "",
 *   tier_5: ""
 * }) // Returns 2
 *
 * @example
 * calculateTierDepth({
 *   tier_1: "Interest",
 *   tier_2: "Careers",
 *   tier_3: "Remote Working",
 *   tier_4: "",
 *   tier_5: ""
 * }) // Returns 3
 */
export function calculateTierDepth(
  classification: TaxonomySelection
): number {
  // Python lines 67-73
  const tiers = [
    classification.tier_1 || '',
    classification.tier_2 || '',
    classification.tier_3 || '',
    classification.tier_4 || '',
    classification.tier_5 || ''
  ]

  // Python line 74
  return tiers.filter(t => t && t.trim()).length
}
```

**Test Cases**:
```typescript
// Test 1: 2 tiers
expect(calculateTierDepth({
  tier_1: "Interest",
  tier_2: "Technology",
  tier_3: "",
  tier_4: "",
  tier_5: ""
})).toBe(2)

// Test 2: 3 tiers
expect(calculateTierDepth({
  tier_1: "Interest",
  tier_2: "Careers",
  tier_3: "Remote Working",
  tier_4: "",
  tier_5: ""
})).toBe(3)

// Test 3: All 5 tiers
expect(calculateTierDepth({
  tier_1: "Interest",
  tier_2: "Careers",
  tier_3: "Remote Working",
  tier_4: "Software Engineer",
  tier_5: "Machine Learning"
})).toBe(5)

// Test 4: Empty tiers
expect(calculateTierDepth({
  tier_1: "",
  tier_2: "",
  tier_3: "",
  tier_4: "",
  tier_5: ""
})).toBe(0)
```

#### 4.2.2 calculateGranularityScore()

**Python Source**: Lines 77-112

**Purpose**: Calculate granularity-weighted score (confidence + depth bonus if confidence ≥ 0.7)

**Implementation**:
```typescript
/**
 * Calculate granularity-weighted score.
 *
 * Python source: classification_tier_selector.py:77-112
 *
 * Formula:
 *   score = confidence + (tier_depth * granularity_bonus) if confidence >= 0.7 else confidence
 *
 * This prioritizes more specific (deeper) classifications when confidence is high.
 *
 * @param classification - Classification dict with confidence and tier info
 * @param granularityBonus - Bonus per tier level (default: 0.05)
 * @returns Granularity-weighted score
 *
 * @example
 * calculateGranularityScore({
 *   confidence: 0.95,
 *   tier_1: "Interest",
 *   tier_2: "Careers",
 *   tier_3: "Remote Working"
 * }) // Returns 1.10 (0.95 + 3 * 0.05)
 *
 * @example
 * calculateGranularityScore({
 *   confidence: 0.65,
 *   tier_1: "Interest",
 *   tier_2: "Technology"
 * }) // Returns 0.65 (below 0.7 threshold, no bonus)
 */
export function calculateGranularityScore(
  classification: TaxonomySelection,
  granularityBonus: number = 0.05
): number {
  // Python line 103
  const confidence = classification.confidence || 0.0

  // Python lines 105-110
  if (confidence >= 0.7) {
    // Python line 107
    const depth = calculateTierDepth(classification)
    // Python line 108
    const score = confidence + (depth * granularityBonus)
    return score
  } else {
    // Python line 110
    return confidence
  }
}
```

**Test Cases**:
```typescript
// Test 1: High confidence (0.95) with depth 3 → gets bonus
expect(calculateGranularityScore({
  confidence: 0.95,
  tier_1: "Interest",
  tier_2: "Careers",
  tier_3: "Remote Working",
  tier_4: "",
  tier_5: ""
})).toBe(1.10)  // 0.95 + (3 * 0.05)

// Test 2: Low confidence (0.65) with depth 2 → no bonus
expect(calculateGranularityScore({
  confidence: 0.65,
  tier_1: "Interest",
  tier_2: "Technology",
  tier_3: "",
  tier_4: "",
  tier_5: ""
})).toBe(0.65)  // No bonus (below 0.7 threshold)

// Test 3: Boundary case (0.7 exactly) → gets bonus
expect(calculateGranularityScore({
  confidence: 0.7,
  tier_1: "Demographic",
  tier_2: "Female",
  tier_3: "",
  tier_4: "",
  tier_5: ""
})).toBe(0.80)  // 0.7 + (2 * 0.05)

// Test 4: Custom granularity bonus
expect(calculateGranularityScore({
  confidence: 0.8,
  tier_1: "Interest",
  tier_2: "Technology",
  tier_3: "",
  tier_4: "",
  tier_5: ""
}, 0.1)).toBe(1.0)  // 0.8 + (2 * 0.1)
```

#### 4.2.3 selectPrimaryAndAlternatives()

**Python Source**: Lines 115-221

**Purpose**: Main selection algorithm - selects primary and alternatives from a tier group

**Implementation**: See full implementation in separate section below (too long for inline)

**Test Cases**:
```typescript
// Test 1: Gender selection (mutually exclusive)
const genderClassifications = [
  {
    taxonomy_id: 21,
    value: "Female",
    confidence: 0.99,
    tier_1: "Demographic",
    tier_2: "Female",
    tier_3: "",
    tier_4: "",
    tier_5: "",
    grouping_value: "Gender"
  },
  {
    taxonomy_id: 20,
    value: "Male",
    confidence: 0.89,
    tier_1: "Demographic",
    tier_2: "Male",
    tier_3: "",
    tier_4: "",
    tier_5: "",
    grouping_value: "Gender"
  }
]

const result = selectPrimaryAndAlternatives(
  genderClassifications,
  "demographics.gender"
)

expect(result.primary.value).toBe("Female")
expect(result.primary.confidence).toBe(0.99)
expect(result.alternatives).toHaveLength(1)
expect(result.alternatives[0].value).toBe("Male")
expect(result.alternatives[0].confidence_delta).toBe(0.10)

// Test 2: Granularity prioritization
const techClassifications = [
  {
    taxonomy_id: 100,
    value: "Technology",
    confidence: 0.85,
    tier_1: "Interest",
    tier_2: "Technology",
    tier_3: "",
    tier_4: "",
    tier_5: ""
  },
  {
    taxonomy_id: 101,
    value: "Machine Learning",
    confidence: 0.80,
    tier_1: "Interest",
    tier_2: "Technology",
    tier_3: "Artificial Intelligence",
    tier_4: "Machine Learning",
    tier_5: "Deep Learning"
  }
]

const techResult = selectPrimaryAndAlternatives(
  techClassifications,
  "interests.technology"
)

// Machine Learning should win due to granularity bonus
// ML score: 0.80 + (5 * 0.05) = 1.05
// Tech score: 0.85 + (2 * 0.05) = 0.95
expect(techResult.primary.value).toBe("Machine Learning")
expect(techResult.primary.granularity_score).toBeCloseTo(1.05)

// Test 3: Confidence delta threshold filtering
const ageClassifications = [
  { value: "25-34", confidence: 0.75, tier_1: "Demographic", tier_2: "Age", tier_3: "25-34", tier_4: "", tier_5: "" },
  { value: "18-24", confidence: 0.65, tier_1: "Demographic", tier_2: "Age", tier_3: "18-24", tier_4: "", tier_5: "" },
  { value: "35-44", confidence: 0.55, tier_1: "Demographic", tier_2: "Age", tier_3: "35-44", tier_4: "", tier_5: "" },
  { value: "45-54", confidence: 0.40, tier_1: "Demographic", tier_2: "Age", tier_3: "45-54", tier_4: "", tier_5: "" }
]

const ageResult = selectPrimaryAndAlternatives(
  ageClassifications,
  "demographics.age"
)

expect(ageResult.primary.value).toBe("25-34")
expect(ageResult.alternatives).toHaveLength(2)  // Only 18-24 and 35-44 (delta <= 0.3)
// 45-54 excluded (0.75 - 0.40 = 0.35 > 0.3)
```

#### 4.2.4 groupClassificationsByTier()

**Python Source**: Lines 224-284

**Purpose**: Group classifications by pre-computed `grouping_value`

**Implementation**:
```typescript
/**
 * Group classifications by pre-computed grouping_value from taxonomy.
 *
 * Python source: classification_tier_selector.py:224-284
 *
 * @param classifications - List of classification dicts with grouping_value field
 * @param section - Section name (demographics, household, interests, purchase_intent)
 * @returns Dict mapping grouping_value to list of classifications
 */
export function groupClassificationsByTier(
  classifications: TaxonomySelection[],
  section: string
): Record<string, TaxonomySelection[]> {
  // Python line 257
  const groups: Record<string, TaxonomySelection[]> = {}

  // Python lines 259-282
  for (const c of classifications) {
    // Python line 260
    const groupingValue = c.grouping_value || ''

    if (!groupingValue) {
      console.warn(
        `Classification missing grouping_value: ` +
        `taxonomy_id=${c.taxonomy_id}, value=${c.value}`
      )
      continue
    }

    // Python lines 268-270
    if (!(groupingValue in groups)) {
      groups[groupingValue] = []
      console.debug(`[${section}] Created new group: '${groupingValue}'`)
    }

    // Python lines 272-276
    groups[groupingValue].push(c)
    console.debug(
      `[${section}] Added to group '${groupingValue}': ${c.value} ` +
      `(ID ${c.taxonomy_id}, confidence ${c.confidence.toFixed(2)})`
    )
  }

  // Python lines 278-282 (log summary)
  console.log(
    `[${section}] Grouped ${classifications.length} classifications ` +
    `into ${Object.keys(groups).length} groups:`
  )
  for (const [groupingValue, items] of Object.entries(groups)) {
    const values = items
      .slice(0, 5)
      .map(item => `${item.value}(${item.confidence.toFixed(2)})`)
      .join(', ')
    console.log(`  '${groupingValue}': ${items.length} items - ${values}`)
  }

  // Python line 284
  return groups
}
```

#### 4.2.5 isMutuallyExclusiveTier()

**Python Source**: Lines 287-319

**Purpose**: Determine if grouping value represents mutually exclusive categories

**Implementation**:
```typescript
/**
 * Determine if a grouping value represents mutually exclusive categories.
 *
 * Python source: classification_tier_selector.py:287-319
 *
 * Most grouping values are mutually exclusive (you can only be in one category).
 * Notable exceptions are listed below.
 *
 * Mutually Exclusive Examples:
 * - "Gender": Male XOR Female
 * - "Age": Age ranges are mutually exclusive
 * - "Education (Highest Level)": Education levels are mutually exclusive
 * - "Marital Status": Single XOR Married XOR Divorced
 * - "Income": Income ranges are mutually exclusive
 *
 * Non-Exclusive Examples:
 * - "Employment Status": Can be employed AND educated (separate groups)
 * - Interests: All interest categories are non-exclusive
 * - Purchase Intent: Can have multiple purchase intents
 *
 * @param groupingValue - The grouping value to check
 * @returns True if mutually exclusive, False otherwise
 */
export function isMutuallyExclusiveTier(groupingValue: string): boolean {
  // Python lines 314-316
  const nonExclusiveGroups = [
    "Employment Status",  // Can be employed AND have education level
    // Interests and Purchase Intent are handled by section logic in apply_tiered_classification
  ]

  // Python line 319
  return !nonExclusiveGroups.includes(groupingValue)
}
```

#### 4.2.6 applyTieredClassification()

**Python Source**: Lines 322-398

**Purpose**: Main entry point - applies tiered classification to a section

**Implementation**: See full implementation in separate section below

---

## 5. Module 2: profileTierFormatter.ts

### 5.1 File Header

```typescript
/**
 * Profile Tier Formatter
 *
 * TypeScript port of Python profile_tier_formatter.py
 * Source: src/email_parser/utils/profile_tier_formatter.py (lines 1-254)
 *
 * Transforms flat classification lists into tiered structure (primary/alternatives)
 * for JSON output while maintaining backward compatibility with existing Pydantic models.
 *
 * This is a presentation-layer transformation that doesn't affect storage or memory models.
 */
```

### 5.2 Function Specifications

#### 5.2.1 formatTieredDemographics()

**Python Source**: Lines 18-66

**Purpose**: Format demographics memories into tiered structure

**Key Mapping**:
```typescript
const groupingToField: Record<string, string> = {
  "Gender": "gender",
  "Age": "age_range",
  "Education (Highest Level)": "education",
  "Employment Status": "occupation",
  "Marital Status": "marital_status",
  "Language": "language",
}
```

#### 5.2.2 formatTieredHousehold()

**Python Source**: Lines 69-124

**Purpose**: Format household memories into tiered structure

**Key Mapping**:
```typescript
const groupingToField: Record<string, string> = {
  "Home Location": "location",
  "Household Income (USD)": "income",
  "Length of Residence": "length_of_residence",
  "Life Stage": "life_stage",
  "Median Home Value (USD)": "median_home_value",
  "Monthly Housing Payment (USD)": "monthly_housing_payment",
  "Number of Adults": "number_of_adults",
  "Number of Children": "number_of_children",
  "Number of Individuals": "number_of_individuals",
  "Ownership": "ownership",
  "Property Type": "property_type",
  "Urbanization": "urbanization",
  "Language": "language"
}
```

#### 5.2.3 formatTieredInterests()

**Python Source**: Lines 127-160

**Purpose**: Format interests (non-exclusive) - each is its own "primary", sorted by granularity

#### 5.2.4 formatTieredPurchaseIntent()

**Python Source**: Lines 163-196

**Purpose**: Format purchase intent (non-exclusive) - similar to interests

#### 5.2.5 addTieredStructureToProfile()

**Python Source**: Lines 224-253

**Purpose**: Add tiered_classifications section to profile dict

**Output Schema**:
```typescript
{
  "schema_version": "2.0",
  "tiered_classifications": {
    "demographics": {
      "gender": {
        "primary": {...},
        "alternatives": [...],
        "selection_method": "highest_confidence"
      },
      "age_range": {...}
    },
    "household": {...},
    "interests": [...],  // Sorted by granularity_score
    "purchase_intent": [...]
  }
}
```

---

## 6. Integration Points

### 6.1 Option A: Integrate in API Route (Recommended for Phase 1.5)

**File**: `src/admin-dashboard/app/api/profile/tiered/route.ts`

**Changes**:
```typescript
// OLD (lines 38-167): Simple grouping logic
// REPLACE WITH:

import { applyTieredClassification } from '@browser/agents/iab-classifier/tierSelector'
import {
  formatTieredDemographics,
  formatTieredHousehold,
  formatTieredInterests,
  formatTieredPurchaseIntent
} from '@browser/agents/iab-classifier/profileTierFormatter'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id') || 'default_user'

    // Get store
    const store = getStore(user_id)

    // Read semantic memories
    const semanticPrefix = [user_id, 'iab_taxonomy_profile']
    const semanticItems = await store.search(semanticPrefix)

    // Parse into sections
    const demographicsMemories: TaxonomySelection[] = []
    const householdMemories: TaxonomySelection[] = []
    const interestsMemories: TaxonomySelection[] = []
    const purchaseMemories: TaxonomySelection[] = []

    for (const item of semanticItems) {
      const value = item.value
      const key = item.key
      const section = key.split('_')[1]

      if (section === 'demographics') {
        demographicsMemories.push(value)
      } else if (section === 'household') {
        householdMemories.push(value)
      } else if (section === 'interests') {
        interestsMemories.push(value)
      } else if (section === 'purchase' || section === 'purchase_intent') {
        purchaseMemories.push(value)
      }
    }

    // Apply tier selection
    const tieredDemographics = formatTieredDemographics(demographicsMemories)
    const tieredHousehold = formatTieredHousehold(householdMemories)
    const tieredInterests = formatTieredInterests(interestsMemories)
    const tieredPurchase = formatTieredPurchaseIntent(purchaseMemories)

    return NextResponse.json({
      schema_version: '2.0',
      tiered_classifications: {
        demographics: tieredDemographics,
        household: tieredHousehold,
        interests: tieredInterests,
        purchase_intent: tieredPurchase
      }
    })

  } catch (error: any) {
    console.error('Tiered profile error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### 6.2 Option B: Integrate in Reconcile Node (Future - Phase 5)

**File**: `src/browser/agents/iab-classifier/nodes/reconcile.ts`

**Changes**: After reconciliation completes, apply tier selection and store in workflow state

---

## 7. Testing Strategy

See separate document: `/tmp/TIER_SELECTION_TESTING_PLAN.md`

---

## 8. Migration Verification

### 8.1 Source Verification Checklist

Create `/tmp/tier_selection_migration_review.md` with:

#### tierSelector.ts Verification

| Function | Python Lines | TypeScript Lines | Status | Notes |
|----------|--------------|------------------|--------|-------|
| `calculateTierDepth()` | 51-74 | TBD | ⏳ Pending | |
| `calculateGranularityScore()` | 77-112 | TBD | ⏳ Pending | |
| `selectPrimaryAndAlternatives()` | 115-221 | TBD | ⏳ Pending | |
| `groupClassificationsByTier()` | 224-284 | TBD | ⏳ Pending | |
| `isMutuallyExclusiveTier()` | 287-319 | TBD | ⏳ Pending | |
| `applyTieredClassification()` | 322-398 | TBD | ⏳ Pending | |

#### profileTierFormatter.ts Verification

| Function | Python Lines | TypeScript Lines | Status | Notes |
|----------|--------------|------------------|--------|-------|
| `formatTieredDemographics()` | 18-66 | TBD | ⏳ Pending | |
| `formatTieredHousehold()` | 69-124 | TBD | ⏳ Pending | |
| `formatTieredInterests()` | 127-160 | TBD | ⏳ Pending | |
| `formatTieredPurchaseIntent()` | 163-196 | TBD | ⏳ Pending | |
| `addTieredStructureToProfile()` | 224-253 | TBD | ⏳ Pending | |

### 8.2 Build Verification

```bash
# TypeScript compilation (MANDATORY - must be zero errors)
cd src/admin-dashboard
npx tsc --noEmit

# Expected output: No errors (silent success)
# If ANY errors appear, migration is INCOMPLETE
```

---

## 9. Dependencies

### 9.1 No New Packages Required

All required functionality is available in standard TypeScript/JavaScript:

- ✅ `Array.filter()` - For filtering classifications
- ✅ `Array.sort()` - For sorting by granularity score
- ✅ `Array.map()` - For transforming data
- ✅ `Object.entries()` - For iterating over groups
- ✅ `console.log/warn/debug` - For logging

### 9.2 Existing Imports

```typescript
// tierSelector.ts imports
// (None required - pure TypeScript)

// profileTierFormatter.ts imports
import { applyTieredClassification } from './tierSelector'
import type { TaxonomySelection, TieredClassification } from './tierSelector'

// API route imports
import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/shared-store'
import {
  formatTieredDemographics,
  formatTieredHousehold,
  formatTieredInterests,
  formatTieredPurchaseIntent
} from '@browser/agents/iab-classifier/profileTierFormatter'
```

---

## 10. Implementation Checklist

### Phase 1: Create tierSelector.ts (3-4 hours)

- [ ] Create file: `src/browser/agents/iab-classifier/tierSelector.ts`
- [ ] Add file header with Python source reference
- [ ] Define TypeScript types:
  - [ ] `TaxonomySelection` interface
  - [ ] `TieredClassification` interface
- [ ] Implement `calculateTierDepth()` (Python lines 51-74)
  - [ ] Add `// Python line N` comments
  - [ ] Add JSDoc with examples
- [ ] Implement `calculateGranularityScore()` (Python lines 77-112)
  - [ ] Add Python line comments
  - [ ] Add JSDoc
- [ ] Implement `selectPrimaryAndAlternatives()` (Python lines 115-221)
  - [ ] Add Python line comments for all 5 steps
  - [ ] Add JSDoc
- [ ] Implement `groupClassificationsByTier()` (Python lines 224-284)
  - [ ] Add Python line comments
  - [ ] Add JSDoc
- [ ] Implement `isMutuallyExclusiveTier()` (Python lines 287-319)
  - [ ] Add Python line comments
  - [ ] Add JSDoc
- [ ] Implement `applyTieredClassification()` (Python lines 322-398)
  - [ ] Add Python line comments
  - [ ] Add JSDoc
- [ ] Export all functions and types

### Phase 2: Create profileTierFormatter.ts (1-2 hours)

- [ ] Create file: `src/browser/agents/iab-classifier/profileTierFormatter.ts`
- [ ] Add file header with Python source reference
- [ ] Define additional types:
  - [ ] `TieredGroup` interface
  - [ ] `TieredInterest` interface
  - [ ] `TieredPurchaseIntent` interface
- [ ] Implement `formatTieredDemographics()` (Python lines 18-66)
  - [ ] Add grouping_to_field mapping
  - [ ] Add Python line comments
- [ ] Implement `formatTieredHousehold()` (Python lines 69-124)
  - [ ] Add grouping_to_field mapping
  - [ ] Add Python line comments
- [ ] Implement `formatTieredInterests()` (Python lines 127-160)
  - [ ] Add Python line comments
- [ ] Implement `formatTieredPurchaseIntent()` (Python lines 163-196)
  - [ ] Add Python line comments
- [ ] Implement `addTieredStructureToProfile()` (Python lines 224-253)
  - [ ] Add Python line comments
- [ ] Export all functions

### Phase 3: Verification (2 hours)

- [ ] Create `/tmp/tier_selection_migration_review.md`
- [ ] **Phase 1: Source Verification**
  - [ ] Line-by-line comparison of `calculateTierDepth()`
  - [ ] Line-by-line comparison of `calculateGranularityScore()`
  - [ ] Line-by-line comparison of `selectPrimaryAndAlternatives()`
  - [ ] Line-by-line comparison of `groupClassificationsByTier()`
  - [ ] Line-by-line comparison of `isMutuallyExclusiveTier()`
  - [ ] Line-by-line comparison of `applyTieredClassification()`
  - [ ] Line-by-line comparison of all formatter functions
  - [ ] Document ALL findings in review document
- [ ] **Phase 2: Build Verification (MANDATORY)**
  - [ ] Run `npx tsc --noEmit`
  - [ ] **MUST output zero errors**
  - [ ] If any errors, fix before proceeding
  - [ ] Document compilation results
- [ ] Show review document to user

### Phase 4: Integration (1 hour)

- [ ] Update `src/admin-dashboard/app/api/profile/tiered/route.ts`
- [ ] Replace lines 38-167 with new tier selection logic
- [ ] Test API endpoint returns tiered structure
- [ ] Verify schema_version = "2.0"

### Phase 5: Testing (2 hours)

- [ ] Unit tests for `calculateTierDepth()`
- [ ] Unit tests for `calculateGranularityScore()`
- [ ] Unit tests for `selectPrimaryAndAlternatives()`
- [ ] Integration test: Gender conflict resolution
- [ ] Integration test: Granularity prioritization
- [ ] Integration test: Confidence delta threshold
- [ ] Integration test: Non-exclusive handling (interests)
- [ ] End-to-end test: Full profile with all sections

---

## Success Metrics

✅ **Code Quality**:
- All functions ported line-by-line from Python
- TypeScript compiles with zero errors
- All functions have Python line comments
- All functions have JSDoc documentation

✅ **Functional Correctness**:
- Mutually-exclusive conflicts resolved (Male XOR Female)
- Granularity prioritization working (tier_5 beats tier_2 when high confidence)
- Confidence delta threshold filters alternatives correctly
- Non-exclusive categories handled properly (interests)

✅ **Output Quality**:
- Profile structure matches Python schema_version 2.0
- Primary/alternative selections match Python behavior
- Granularity scores calculated correctly
- Selection methods tracked properly

✅ **Testing**:
- All unit tests pass
- All integration tests pass
- End-to-end test produces correct tiered profile

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: tierSelector.ts | 3-4 hours | 4 hours |
| Phase 2: profileTierFormatter.ts | 1-2 hours | 6 hours |
| Phase 3: Verification | 2 hours | 8 hours |
| Phase 4: Integration | 1 hour | 9 hours |
| Phase 5: Testing | 2 hours | 11 hours |
| **Total** | **9-11 hours** | |

---

## References

- **Python Source**: `src/email_parser/utils/classification_tier_selector.py`
- **Python Source**: `src/email_parser/utils/profile_tier_formatter.py`
- **Migration Skill**: `.claude/skills/python-typescript-migration/SKILL.md`
- **Verification Skill**: `.claude/skills/typescript-verification/SKILL.md`
- **Testing Skill**: `.claude/skills/testing-discipline/SKILL.md`
- **IAB Taxonomy**: `src/browser/taxonomy/iab_audience_taxonomy_v1.1.json`

---

**END OF SPECIFICATION**
