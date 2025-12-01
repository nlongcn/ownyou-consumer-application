# Tiered Classification System - Testing Plan

**Date:** 2025-01-12
**Author:** Claude (Sonnet 4.5)
**Status:** Testing Plan
**Related Document:** `/tmp/TIER_SELECTION_IMPLEMENTATION_SPEC.md`

---

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [End-to-End Tests](#end-to-end-tests)
5. [Test Data](#test-data)
6. [Expected Results](#expected-results)
7. [Test Execution](#test-execution)

---

## 1. Testing Strategy

### 1.1 Test Pyramid

```
         /\
        /  \    E2E Tests (1)
       /____\   Full profile generation
      /      \
     /        \ Integration Tests (4)
    /__________\ Gender, Granularity, Delta, Non-exclusive
   /            \
  /              \ Unit Tests (20+)
 /________________\ All functions with edge cases
```

### 1.2 Test Coverage Goals

- **Unit Tests**: 100% function coverage (all 11 functions)
- **Integration Tests**: 100% user scenario coverage
- **End-to-End Tests**: 1 happy path (full profile with all sections)

### 1.3 Testing Tools

- **Vitest** - Test runner (already configured in project)
- **TypeScript** - Type checking (`npx tsc --noEmit`)
- **Manual Testing** - Browser console + admin dashboard

---

## 2. Unit Tests

### 2.1 tierSelector.ts Unit Tests

#### Test File: `tests/browser/agents/iab-classifier/tierSelector.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  calculateTierDepth,
  calculateGranularityScore,
  selectPrimaryAndAlternatives,
  groupClassificationsByTier,
  isMutuallyExclusiveTier,
  applyTieredClassification,
  type TaxonomySelection
} from '@browser/agents/iab-classifier/tierSelector'

describe('tierSelector', () => {

  // =========================================================================
  // calculateTierDepth() Tests
  // =========================================================================

  describe('calculateTierDepth', () => {
    it('should return 2 for 2 non-empty tiers', () => {
      const classification: Partial<TaxonomySelection> = {
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      }
      expect(calculateTierDepth(classification as TaxonomySelection)).toBe(2)
    })

    it('should return 3 for 3 non-empty tiers', () => {
      const classification: Partial<TaxonomySelection> = {
        tier_1: "Interest",
        tier_2: "Careers",
        tier_3: "Remote Working",
        tier_4: "",
        tier_5: ""
      }
      expect(calculateTierDepth(classification as TaxonomySelection)).toBe(3)
    })

    it('should return 5 for all tiers filled', () => {
      const classification: Partial<TaxonomySelection> = {
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "Artificial Intelligence",
        tier_4: "Machine Learning",
        tier_5: "Deep Learning"
      }
      expect(calculateTierDepth(classification as TaxonomySelection)).toBe(5)
    })

    it('should return 0 for all empty tiers', () => {
      const classification: Partial<TaxonomySelection> = {
        tier_1: "",
        tier_2: "",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      }
      expect(calculateTierDepth(classification as TaxonomySelection)).toBe(0)
    })

    it('should ignore whitespace-only tiers', () => {
      const classification: Partial<TaxonomySelection> = {
        tier_1: "Interest",
        tier_2: "  ",
        tier_3: "\t",
        tier_4: "",
        tier_5: ""
      }
      expect(calculateTierDepth(classification as TaxonomySelection)).toBe(1)
    })

    it('should handle missing tier fields (undefined)', () => {
      const classification: Partial<TaxonomySelection> = {
        tier_1: "Interest",
        tier_2: "Technology"
        // tier_3, tier_4, tier_5 undefined
      }
      expect(calculateTierDepth(classification as TaxonomySelection)).toBe(2)
    })
  })

  // =========================================================================
  // calculateGranularityScore() Tests
  // =========================================================================

  describe('calculateGranularityScore', () => {
    it('should add bonus for high confidence (>= 0.7) with depth 3', () => {
      const classification: Partial<TaxonomySelection> = {
        confidence: 0.95,
        tier_1: "Interest",
        tier_2: "Careers",
        tier_3: "Remote Working",
        tier_4: "",
        tier_5: ""
      }
      const score = calculateGranularityScore(classification as TaxonomySelection)
      expect(score).toBe(1.10) // 0.95 + (3 * 0.05)
    })

    it('should NOT add bonus for low confidence (< 0.7)', () => {
      const classification: Partial<TaxonomySelection> = {
        confidence: 0.65,
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      }
      const score = calculateGranularityScore(classification as TaxonomySelection)
      expect(score).toBe(0.65) // No bonus
    })

    it('should add bonus at boundary (confidence = 0.7)', () => {
      const classification: Partial<TaxonomySelection> = {
        confidence: 0.7,
        tier_1: "Demographic",
        tier_2: "Female",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      }
      const score = calculateGranularityScore(classification as TaxonomySelection)
      expect(score).toBe(0.80) // 0.7 + (2 * 0.05)
    })

    it('should support custom granularity bonus', () => {
      const classification: Partial<TaxonomySelection> = {
        confidence: 0.8,
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      }
      const score = calculateGranularityScore(classification as TaxonomySelection, 0.1)
      expect(score).toBe(1.0) // 0.8 + (2 * 0.1)
    })

    it('should handle confidence = 0', () => {
      const classification: Partial<TaxonomySelection> = {
        confidence: 0,
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      }
      const score = calculateGranularityScore(classification as TaxonomySelection)
      expect(score).toBe(0) // No bonus (below 0.7)
    })

    it('should handle confidence = 1.0 with max depth', () => {
      const classification: Partial<TaxonomySelection> = {
        confidence: 1.0,
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "AI",
        tier_4: "ML",
        tier_5: "Deep Learning"
      }
      const score = calculateGranularityScore(classification as TaxonomySelection)
      expect(score).toBe(1.25) // 1.0 + (5 * 0.05)
    })
  })

  // =========================================================================
  // selectPrimaryAndAlternatives() Tests
  // =========================================================================

  describe('selectPrimaryAndAlternatives', () => {
    it('should select Female as primary (higher confidence)', () => {
      const classifications: Partial<TaxonomySelection>[] = [
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
        classifications as TaxonomySelection[],
        "demographics.gender"
      )

      expect(result).not.toBeNull()
      expect(result!.primary.value).toBe("Female")
      expect(result!.primary.confidence).toBe(0.99)
      expect(result!.alternatives).toHaveLength(1)
      expect(result!.alternatives[0].value).toBe("Male")
      expect(result!.alternatives[0].confidence_delta).toBeCloseTo(0.10)
    })

    it('should prioritize Machine Learning over Technology (granularity)', () => {
      const classifications: Partial<TaxonomySelection>[] = [
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

      const result = selectPrimaryAndAlternatives(
        classifications as TaxonomySelection[],
        "interests.technology"
      )

      expect(result).not.toBeNull()
      // ML score: 0.80 + (5 * 0.05) = 1.05
      // Tech score: 0.85 + (2 * 0.05) = 0.95
      expect(result!.primary.value).toBe("Machine Learning")
      expect(result!.primary.granularity_score).toBeCloseTo(1.05)
    })

    it('should filter alternatives by confidence delta threshold (0.3)', () => {
      const classifications: Partial<TaxonomySelection>[] = [
        {
          value: "25-34",
          confidence: 0.75,
          tier_1: "Demographic",
          tier_2: "Age",
          tier_3: "25-34",
          tier_4: "",
          tier_5: ""
        },
        {
          value: "18-24",
          confidence: 0.65,
          tier_1: "Demographic",
          tier_2: "Age",
          tier_3: "18-24",
          tier_4: "",
          tier_5: ""
        },
        {
          value: "35-44",
          confidence: 0.55,
          tier_1: "Demographic",
          tier_2: "Age",
          tier_3: "35-44",
          tier_4: "",
          tier_5: ""
        },
        {
          value: "45-54",
          confidence: 0.40,
          tier_1: "Demographic",
          tier_2: "Age",
          tier_3: "45-54",
          tier_4: "",
          tier_5: ""
        }
      ]

      const result = selectPrimaryAndAlternatives(
        classifications as TaxonomySelection[],
        "demographics.age"
      )

      expect(result).not.toBeNull()
      expect(result!.primary.value).toBe("25-34")
      expect(result!.alternatives).toHaveLength(2) // Only 18-24 and 35-44
      // 45-54 excluded: delta = 0.75 - 0.40 = 0.35 > 0.3
    })

    it('should filter by min_confidence threshold (default 0.5)', () => {
      const classifications: Partial<TaxonomySelection>[] = [
        {
          value: "College",
          confidence: 0.85,
          tier_1: "Demographic",
          tier_2: "Education",
          tier_3: "College",
          tier_4: "",
          tier_5: ""
        },
        {
          value: "High School",
          confidence: 0.45, // Below 0.5
          tier_1: "Demographic",
          tier_2: "Education",
          tier_3: "High School",
          tier_4: "",
          tier_5: ""
        }
      ]

      const result = selectPrimaryAndAlternatives(
        classifications as TaxonomySelection[],
        "demographics.education"
      )

      expect(result).not.toBeNull()
      expect(result!.primary.value).toBe("College")
      expect(result!.alternatives).toHaveLength(0) // High School filtered out
    })

    it('should return null if no viable classifications (all below min_confidence)', () => {
      const classifications: Partial<TaxonomySelection>[] = [
        {
          value: "Test",
          confidence: 0.4,
          tier_1: "Test",
          tier_2: "Test",
          tier_3: "",
          tier_4: "",
          tier_5: ""
        }
      ]

      const result = selectPrimaryAndAlternatives(
        classifications as TaxonomySelection[],
        "test.test"
      )

      expect(result).toBeNull()
    })

    it('should return null if empty array', () => {
      const result = selectPrimaryAndAlternatives(
        [],
        "test.test"
      )

      expect(result).toBeNull()
    })

    it('should set selection_method to "highest_confidence" for low confidence', () => {
      const classifications: Partial<TaxonomySelection>[] = [
        {
          value: "Test",
          confidence: 0.65, // Below 0.7
          tier_1: "Test",
          tier_2: "Test",
          tier_3: "",
          tier_4: "",
          tier_5: ""
        }
      ]

      const result = selectPrimaryAndAlternatives(
        classifications as TaxonomySelection[],
        "test.test"
      )

      expect(result).not.toBeNull()
      expect(result!.selection_method).toBe("highest_confidence")
    })

    it('should set selection_method to "granularity_weighted" for high confidence', () => {
      const classifications: Partial<TaxonomySelection>[] = [
        {
          value: "Test",
          confidence: 0.85, // >= 0.7
          tier_1: "Test",
          tier_2: "Test",
          tier_3: "",
          tier_4: "",
          tier_5: ""
        }
      ]

      const result = selectPrimaryAndAlternatives(
        classifications as TaxonomySelection[],
        "test.test"
      )

      expect(result).not.toBeNull()
      expect(result!.selection_method).toBe("granularity_weighted")
    })
  })

  // =========================================================================
  // groupClassificationsByTier() Tests
  // =========================================================================

  describe('groupClassificationsByTier', () => {
    it('should group by grouping_value', () => {
      const classifications: Partial<TaxonomySelection>[] = [
        {
          taxonomy_id: 21,
          value: "Female",
          confidence: 0.99,
          grouping_value: "Gender"
        },
        {
          taxonomy_id: 20,
          value: "Male",
          confidence: 0.89,
          grouping_value: "Gender"
        },
        {
          taxonomy_id: 30,
          value: "College",
          confidence: 0.85,
          grouping_value: "Education (Highest Level)"
        }
      ]

      const groups = groupClassificationsByTier(
        classifications as TaxonomySelection[],
        "demographics"
      )

      expect(Object.keys(groups)).toHaveLength(2)
      expect(groups["Gender"]).toHaveLength(2)
      expect(groups["Education (Highest Level)"]).toHaveLength(1)
    })

    it('should skip classifications without grouping_value', () => {
      const classifications: Partial<TaxonomySelection>[] = [
        {
          taxonomy_id: 21,
          value: "Female",
          confidence: 0.99,
          grouping_value: "Gender"
        },
        {
          taxonomy_id: 999,
          value: "Unknown",
          confidence: 0.50,
          grouping_value: "" // Empty
        }
      ]

      const groups = groupClassificationsByTier(
        classifications as TaxonomySelection[],
        "demographics"
      )

      expect(Object.keys(groups)).toHaveLength(1)
      expect(groups["Gender"]).toHaveLength(1)
    })

    it('should handle empty array', () => {
      const groups = groupClassificationsByTier([], "demographics")
      expect(Object.keys(groups)).toHaveLength(0)
    })
  })

  // =========================================================================
  // isMutuallyExclusiveTier() Tests
  // =========================================================================

  describe('isMutuallyExclusiveTier', () => {
    it('should return true for Gender (mutually exclusive)', () => {
      expect(isMutuallyExclusiveTier("Gender")).toBe(true)
    })

    it('should return true for Age (mutually exclusive)', () => {
      expect(isMutuallyExclusiveTier("Age")).toBe(true)
    })

    it('should return true for Education (Highest Level)', () => {
      expect(isMutuallyExclusiveTier("Education (Highest Level)")).toBe(true)
    })

    it('should return false for Employment Status (non-exclusive)', () => {
      expect(isMutuallyExclusiveTier("Employment Status")).toBe(false)
    })

    it('should return true for unknown grouping values (default)', () => {
      expect(isMutuallyExclusiveTier("Unknown Category")).toBe(true)
    })
  })

  // =========================================================================
  // applyTieredClassification() Tests
  // =========================================================================

  describe('applyTieredClassification', () => {
    it('should apply primary/alternative selection for exclusive groups', () => {
      const classifications: Partial<TaxonomySelection>[] = [
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

      const tiered = applyTieredClassification(
        classifications as TaxonomySelection[],
        "demographics"
      )

      expect(Object.keys(tiered)).toHaveLength(1)
      expect(tiered["Gender"]).toBeDefined()
      expect(tiered["Gender"].primary.value).toBe("Female")
      expect(tiered["Gender"].alternatives).toHaveLength(1)
    })

    it('should treat non-exclusive groups as all primaries', () => {
      const classifications: Partial<TaxonomySelection>[] = [
        {
          taxonomy_id: 100,
          value: "Technology",
          confidence: 0.85,
          tier_1: "Interest",
          tier_2: "Technology",
          tier_3: "",
          tier_4: "",
          tier_5: "",
          grouping_value: "Technology"
        },
        {
          taxonomy_id: 101,
          value: "Sports",
          confidence: 0.80,
          tier_1: "Interest",
          tier_2: "Sports",
          tier_3: "",
          tier_4: "",
          tier_5: "",
          grouping_value: "Sports"
        }
      ]

      const tiered = applyTieredClassification(
        classifications as TaxonomySelection[],
        "interests"
      )

      // Each interest should be its own "primary" with no alternatives
      expect(Object.keys(tiered).length).toBeGreaterThan(0)
      Object.values(tiered).forEach(tier => {
        expect(tier.alternatives).toHaveLength(0)
        expect(tier.selection_method).toBe("non_exclusive")
      })
    })

    it('should handle empty array', () => {
      const tiered = applyTieredClassification([], "demographics")
      expect(Object.keys(tiered)).toHaveLength(0)
    })
  })
})
```

### 2.2 profileTierFormatter.ts Unit Tests

#### Test File: `tests/browser/agents/iab-classifier/profileTierFormatter.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  formatTieredDemographics,
  formatTieredHousehold,
  formatTieredInterests,
  formatTieredPurchaseIntent,
  addTieredStructureToProfile,
  type TaxonomySelection
} from '@browser/agents/iab-classifier/profileTierFormatter'

describe('profileTierFormatter', () => {

  // =========================================================================
  // formatTieredDemographics() Tests
  // =========================================================================

  describe('formatTieredDemographics', () => {
    it('should format gender group', () => {
      const memories: Partial<TaxonomySelection>[] = [
        {
          taxonomy_id: 21,
          value: "Female",
          confidence: 0.99,
          tier_1: "Demographic",
          tier_2: "Female",
          tier_3: "",
          tier_4: "",
          tier_5: "",
          tier_path: "Demographic | Female",
          grouping_value: "Gender",
          evidence_count: 10
        }
      ]

      const result = formatTieredDemographics(memories as TaxonomySelection[])

      expect(result).toHaveProperty("gender")
      expect(result.gender.primary.value).toBe("Female")
      expect(result.gender.primary.confidence).toBe(0.99)
    })

    it('should map "Age" to "age_range" field', () => {
      const memories: Partial<TaxonomySelection>[] = [
        {
          taxonomy_id: 30,
          value: "25-34",
          confidence: 0.85,
          tier_1: "Demographic",
          tier_2: "Age",
          tier_3: "25-34",
          tier_4: "",
          tier_5: "",
          grouping_value: "Age"
        }
      ]

      const result = formatTieredDemographics(memories as TaxonomySelection[])

      expect(result).toHaveProperty("age_range")
      expect(result.age_range.primary.value).toBe("25-34")
    })

    it('should handle empty array', () => {
      const result = formatTieredDemographics([])
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  // =========================================================================
  // formatTieredHousehold() Tests
  // =========================================================================

  describe('formatTieredHousehold', () => {
    it('should format household income group', () => {
      const memories: Partial<TaxonomySelection>[] = [
        {
          taxonomy_id: 200,
          value: "$50k-$75k",
          confidence: 0.80,
          tier_1: "Household",
          tier_2: "Income",
          tier_3: "$50k-$75k",
          tier_4: "",
          tier_5: "",
          grouping_value: "Household Income (USD)"
        }
      ]

      const result = formatTieredHousehold(memories as TaxonomySelection[])

      expect(result).toHaveProperty("income")
      expect(result.income.primary.value).toBe("$50k-$75k")
    })

    it('should handle empty array', () => {
      const result = formatTieredHousehold([])
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  // =========================================================================
  // formatTieredInterests() Tests
  // =========================================================================

  describe('formatTieredInterests', () => {
    it('should return sorted array by granularity_score', () => {
      const memories: Partial<TaxonomySelection>[] = [
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
          tier_3: "AI",
          tier_4: "Machine Learning",
          tier_5: "Deep Learning"
        }
      ]

      const result = formatTieredInterests(memories as TaxonomySelection[])

      expect(result).toHaveLength(2)
      // Should be sorted by granularity_score (descending)
      expect(result[0].granularity_score).toBeGreaterThan(result[1].granularity_score)
    })

    it('should have empty alternatives for all interests', () => {
      const memories: Partial<TaxonomySelection>[] = [
        {
          taxonomy_id: 100,
          value: "Technology",
          confidence: 0.85,
          tier_1: "Interest",
          tier_2: "Technology",
          tier_3: "",
          tier_4: "",
          tier_5: ""
        }
      ]

      const result = formatTieredInterests(memories as TaxonomySelection[])

      expect(result[0].alternatives).toHaveLength(0)
      expect(result[0].selection_method).toBe("non_exclusive")
    })

    it('should handle empty array', () => {
      const result = formatTieredInterests([])
      expect(result).toHaveLength(0)
    })
  })

  // =========================================================================
  // formatTieredPurchaseIntent() Tests
  // =========================================================================

  describe('formatTieredPurchaseIntent', () => {
    it('should include purchase_intent_flag', () => {
      const memories: Partial<TaxonomySelection>[] = [
        {
          taxonomy_id: 300,
          value: "Automotive",
          confidence: 0.90,
          tier_1: "Purchase Intent",
          tier_2: "Automotive",
          tier_3: "",
          tier_4: "",
          tier_5: "",
          purchase_intent_flag: "High Intent"
        }
      ]

      const result = formatTieredPurchaseIntent(memories as TaxonomySelection[])

      expect(result).toHaveLength(1)
      expect(result[0].purchase_intent_flag).toBe("High Intent")
    })

    it('should handle empty array', () => {
      const result = formatTieredPurchaseIntent([])
      expect(result).toHaveLength(0)
    })
  })

  // =========================================================================
  // addTieredStructureToProfile() Tests
  // =========================================================================

  describe('addTieredStructureToProfile', () => {
    it('should add schema_version 2.0', () => {
      const profileDict = {}
      const memories = {
        demographics: [],
        household: [],
        interests: [],
        purchase_intent: []
      }

      const result = addTieredStructureToProfile(profileDict, memories)

      expect(result.schema_version).toBe("2.0")
    })

    it('should add tiered_classifications section', () => {
      const profileDict = {}
      const memories = {
        demographics: [],
        household: [],
        interests: [],
        purchase_intent: []
      }

      const result = addTieredStructureToProfile(profileDict, memories)

      expect(result).toHaveProperty("tiered_classifications")
      expect(result.tiered_classifications).toHaveProperty("demographics")
      expect(result.tiered_classifications).toHaveProperty("household")
      expect(result.tiered_classifications).toHaveProperty("interests")
      expect(result.tiered_classifications).toHaveProperty("purchase_intent")
    })

    it('should preserve existing profile fields', () => {
      const profileDict = {
        user_id: "test_user",
        existing_field: "value"
      }
      const memories = {
        demographics: [],
        household: [],
        interests: [],
        purchase_intent: []
      }

      const result = addTieredStructureToProfile(profileDict, memories)

      expect(result.user_id).toBe("test_user")
      expect(result.existing_field).toBe("value")
    })
  })
})
```

---

## 3. Integration Tests

### 3.1 Gender Conflict Resolution Test

**File**: `tests/browser/agents/iab-classifier/integration/genderConflict.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { selectPrimaryAndAlternatives } from '@browser/agents/iab-classifier/tierSelector'

describe('Gender Conflict Resolution', () => {
  it('should resolve Male vs Female conflict (Female wins)', () => {
    const classifications = [
      {
        taxonomy_id: 21,
        value: "Female",
        confidence: 0.99,
        tier_1: "Demographic",
        tier_2: "Female",
        tier_3: "",
        tier_4: "",
        tier_5: "",
        grouping_value: "Gender",
        section: "demographics",
        tier_path: "Demographic | Female",
        category_path: "Demographic | Female",
        grouping_tier_key: "tier_2",
        reasoning: "Strong evidence from emails"
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
        grouping_value: "Gender",
        section: "demographics",
        tier_path: "Demographic | Male",
        category_path: "Demographic | Male",
        grouping_tier_key: "tier_2",
        reasoning: "Some evidence"
      }
    ]

    const result = selectPrimaryAndAlternatives(classifications, "demographics.gender")

    // Assertions
    expect(result).not.toBeNull()
    expect(result!.primary.value).toBe("Female")
    expect(result!.primary.confidence).toBe(0.99)
    expect(result!.primary.classification_type).toBe("primary")

    expect(result!.alternatives).toHaveLength(1)
    expect(result!.alternatives[0].value).toBe("Male")
    expect(result!.alternatives[0].confidence).toBe(0.89)
    expect(result!.alternatives[0].classification_type).toBe("alternative")
    expect(result!.alternatives[0].confidence_delta).toBeCloseTo(0.10)

    expect(result!.tier_group).toBe("demographics.gender")
    expect(result!.selection_method).toBe("granularity_weighted")
  })

  it('should NOT include BOTH Male and Female as primaries', () => {
    const classifications = [
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

    const result = selectPrimaryAndAlternatives(classifications, "demographics.gender")

    // CRITICAL: Only 1 primary allowed
    expect(result!.primary).toBeDefined()
    expect(result!.alternatives.every(alt => alt.classification_type === "alternative")).toBe(true)
  })
})
```

### 3.2 Granularity Prioritization Test

**File**: `tests/browser/agents/iab-classifier/integration/granularityPrioritization.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { selectPrimaryAndAlternatives } from '@browser/agents/iab-classifier/tierSelector'

describe('Granularity Prioritization', () => {
  it('should prioritize "Machine Learning" over "Technology"', () => {
    const classifications = [
      {
        taxonomy_id: 100,
        value: "Technology",
        confidence: 0.85,
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "",
        tier_4: "",
        tier_5: "",
        grouping_value: "Technology",
        section: "interests",
        tier_path: "Interest | Technology",
        category_path: "Interest | Technology",
        grouping_tier_key: "tier_2",
        reasoning: "Generic technology interest"
      },
      {
        taxonomy_id: 101,
        value: "Machine Learning",
        confidence: 0.80,
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "Artificial Intelligence",
        tier_4: "Machine Learning",
        tier_5: "Deep Learning",
        grouping_value: "Technology",
        section: "interests",
        tier_path: "Interest | Technology | AI | Machine Learning | Deep Learning",
        category_path: "Interest | Technology | AI | Machine Learning | Deep Learning",
        grouping_tier_key: "tier_2",
        reasoning: "Specific ML interest"
      }
    ]

    const result = selectPrimaryAndAlternatives(classifications, "interests.technology")

    // Machine Learning should win due to granularity bonus
    // ML score: 0.80 + (5 * 0.05) = 1.05
    // Tech score: 0.85 + (2 * 0.05) = 0.95
    expect(result).not.toBeNull()
    expect(result!.primary.value).toBe("Machine Learning")
    expect(result!.primary.granularity_score).toBeCloseTo(1.05)
    expect(result!.primary.tier_depth).toBe(5)

    expect(result!.alternatives).toHaveLength(1)
    expect(result!.alternatives[0].value).toBe("Technology")
    expect(result!.alternatives[0].granularity_score).toBeCloseTo(0.95)
  })

  it('should verify granularity bonus ONLY applies when confidence >= 0.7', () => {
    const classifications = [
      {
        value: "Generic",
        confidence: 0.65, // Below 0.7 threshold
        tier_1: "Test",
        tier_2: "Generic",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      },
      {
        value: "Specific",
        confidence: 0.60,
        tier_1: "Test",
        tier_2: "Test",
        tier_3: "Test",
        tier_4: "Test",
        tier_5: "Specific"
      }
    ]

    const result = selectPrimaryAndAlternatives(classifications, "test.test")

    // Generic should win (no granularity bonus for either)
    // Generic score: 0.65 (no bonus)
    // Specific score: 0.60 (no bonus)
    expect(result!.primary.value).toBe("Generic")
  })
})
```

### 3.3 Confidence Delta Threshold Test

**File**: `tests/browser/agents/iab-classifier/integration/confidenceDelta.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { selectPrimaryAndAlternatives } from '@browser/agents/iab-classifier/tierSelector'

describe('Confidence Delta Threshold', () => {
  it('should filter alternatives beyond 0.3 confidence delta', () => {
    const classifications = [
      {
        value: "25-34",
        confidence: 0.75,
        tier_1: "Demographic",
        tier_2: "Age",
        tier_3: "25-34",
        tier_4: "",
        tier_5: "",
        grouping_value: "Age"
      },
      {
        value: "18-24",
        confidence: 0.65,
        tier_1: "Demographic",
        tier_2: "Age",
        tier_3: "18-24",
        tier_4: "",
        tier_5: "",
        grouping_value: "Age"
      },
      {
        value: "35-44",
        confidence: 0.55,
        tier_1: "Demographic",
        tier_2: "Age",
        tier_3: "35-44",
        tier_4: "",
        tier_5: "",
        grouping_value: "Age"
      },
      {
        value: "45-54",
        confidence: 0.40,
        tier_1: "Demographic",
        tier_2: "Age",
        tier_3: "45-54",
        tier_4: "",
        tier_5: "",
        grouping_value: "Age"
      },
      {
        value: "55-64",
        confidence: 0.30,
        tier_1: "Demographic",
        tier_2: "Age",
        tier_3: "55-64",
        tier_4: "",
        tier_5: "",
        grouping_value: "Age"
      }
    ]

    const result = selectPrimaryAndAlternatives(classifications, "demographics.age")

    expect(result).not.toBeNull()
    expect(result!.primary.value).toBe("25-34")

    // Should include only 18-24 (delta=0.10) and 35-44 (delta=0.20)
    expect(result!.alternatives).toHaveLength(2)
    expect(result!.alternatives[0].value).toBe("18-24")
    expect(result!.alternatives[0].confidence_delta).toBeCloseTo(0.10)
    expect(result!.alternatives[1].value).toBe("35-44")
    expect(result!.alternatives[1].confidence_delta).toBeCloseTo(0.20)

    // 45-54 (delta=0.35) and 55-64 (delta=0.45) should be excluded
  })

  it('should include alternative exactly at 0.3 delta', () => {
    const classifications = [
      {
        value: "Primary",
        confidence: 0.80,
        tier_1: "Test",
        tier_2: "Test",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      },
      {
        value: "Boundary",
        confidence: 0.50, // Delta = 0.30 exactly
        tier_1: "Test",
        tier_2: "Test",
        tier_3: "",
        tier_4: "",
        tier_5: ""
      }
    ]

    const result = selectPrimaryAndAlternatives(classifications, "test.test")

    expect(result!.alternatives).toHaveLength(1)
    expect(result!.alternatives[0].value).toBe("Boundary")
  })
})
```

### 3.4 Non-Exclusive Handling Test

**File**: `tests/browser/agents/iab-classifier/integration/nonExclusive.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { applyTieredClassification } from '@browser/agents/iab-classifier/tierSelector'

describe('Non-Exclusive Category Handling', () => {
  it('should treat all interests as primaries (no alternatives)', () => {
    const classifications = [
      {
        taxonomy_id: 100,
        value: "Technology",
        confidence: 0.85,
        tier_1: "Interest",
        tier_2: "Technology",
        tier_3: "",
        tier_4: "",
        tier_5: "",
        grouping_value: "Technology",
        section: "interests"
      },
      {
        taxonomy_id: 200,
        value: "Sports",
        confidence: 0.80,
        tier_1: "Interest",
        tier_2: "Sports",
        tier_3: "",
        tier_4: "",
        tier_5: "",
        grouping_value: "Sports",
        section: "interests"
      },
      {
        taxonomy_id: 300,
        value: "Finance",
        confidence: 0.75,
        tier_1: "Interest",
        tier_2: "Finance",
        tier_3: "",
        tier_4: "",
        tier_5: "",
        grouping_value: "Finance",
        section: "interests"
      }
    ]

    const result = applyTieredClassification(classifications, "interests")

    // Should have 3 separate entries (one per interest)
    expect(Object.keys(result).length).toBeGreaterThanOrEqual(3)

    // Each should be a "primary" with no alternatives
    Object.values(result).forEach(tiered => {
      expect(tiered.alternatives).toHaveLength(0)
      expect(tiered.selection_method).toBe("non_exclusive")
      expect(tiered.primary.classification_type).toBe("primary")
    })
  })

  it('should treat Employment Status as non-exclusive', () => {
    const classifications = [
      {
        taxonomy_id: 400,
        value: "Employed",
        confidence: 0.90,
        tier_1: "Demographic",
        tier_2: "Employment",
        tier_3: "Employed",
        tier_4: "",
        tier_5: "",
        grouping_value: "Employment Status",
        section: "demographics"
      },
      {
        taxonomy_id: 401,
        value: "Part Time",
        confidence: 0.70,
        tier_1: "Demographic",
        tier_2: "Employment",
        tier_3: "Part Time",
        tier_4: "",
        tier_5: "",
        grouping_value: "Employment Status",
        section: "demographics"
      }
    ]

    const result = applyTieredClassification(classifications, "demographics")

    // Should have 2 separate entries (Employment Status is non-exclusive)
    const employmentEntries = Object.values(result).filter(
      t => t.tier_group.includes("employment_status")
    )

    expect(employmentEntries.length).toBeGreaterThanOrEqual(2)
    employmentEntries.forEach(entry => {
      expect(entry.alternatives).toHaveLength(0)
      expect(entry.selection_method).toBe("non_exclusive")
    })
  })
})
```

---

## 4. End-to-End Tests

### 4.1 Full Profile Generation Test

**File**: `tests/browser/agents/iab-classifier/e2e/fullProfile.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { addTieredStructureToProfile } from '@browser/agents/iab-classifier/profileTierFormatter'

describe('Full Profile Generation (E2E)', () => {
  it('should generate complete tiered profile with all sections', () => {
    const profileDict = {
      user_id: "test_user"
    }

    const memories = {
      demographics: [
        // Gender
        {
          taxonomy_id: 21,
          value: "Female",
          confidence: 0.99,
          tier_1: "Demographic",
          tier_2: "Female",
          tier_3: "",
          tier_4: "",
          tier_5: "",
          grouping_value: "Gender",
          section: "demographics",
          tier_path: "Demographic | Female",
          category_path: "Demographic | Female",
          grouping_tier_key: "tier_2",
          reasoning: "Strong evidence",
          evidence_count: 15,
          last_validated: "2025-01-12",
          days_since_validation: 0
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
          grouping_value: "Gender",
          section: "demographics",
          tier_path: "Demographic | Male",
          category_path: "Demographic | Male",
          grouping_tier_key: "tier_2",
          reasoning: "Some evidence",
          evidence_count: 10
        },
        // Age
        {
          taxonomy_id: 30,
          value: "25-34",
          confidence: 0.85,
          tier_1: "Demographic",
          tier_2: "Age",
          tier_3: "25-34",
          tier_4: "",
          tier_5: "",
          grouping_value: "Age",
          section: "demographics",
          tier_path: "Demographic | Age | 25-34",
          category_path: "Demographic | Age | 25-34",
          grouping_tier_key: "tier_2",
          reasoning: "Age indicators",
          evidence_count: 8
        }
      ],
      household: [
        // Income
        {
          taxonomy_id: 200,
          value: "$50k-$75k",
          confidence: 0.80,
          tier_1: "Household",
          tier_2: "Income",
          tier_3: "$50k-$75k",
          tier_4: "",
          tier_5: "",
          grouping_value: "Household Income (USD)",
          section: "household",
          tier_path: "Household | Income | $50k-$75k",
          category_path: "Household | Income | $50k-$75k",
          grouping_tier_key: "tier_2",
          reasoning: "Purchase patterns",
          evidence_count: 12
        }
      ],
      interests: [
        // Technology (generic)
        {
          taxonomy_id: 100,
          value: "Technology",
          confidence: 0.85,
          tier_1: "Interest",
          tier_2: "Technology",
          tier_3: "",
          tier_4: "",
          tier_5: "",
          grouping_value: "Technology",
          section: "interests",
          tier_path: "Interest | Technology",
          category_path: "Interest | Technology",
          grouping_tier_key: "tier_2",
          reasoning: "Tech emails",
          evidence_count: 20
        },
        // Machine Learning (specific)
        {
          taxonomy_id: 101,
          value: "Machine Learning",
          confidence: 0.80,
          tier_1: "Interest",
          tier_2: "Technology",
          tier_3: "Artificial Intelligence",
          tier_4: "Machine Learning",
          tier_5: "Deep Learning",
          grouping_value: "Technology",
          section: "interests",
          tier_path: "Interest | Technology | AI | Machine Learning | Deep Learning",
          category_path: "Interest | Technology | AI | Machine Learning | Deep Learning",
          grouping_tier_key: "tier_2",
          reasoning: "ML course emails",
          evidence_count: 15
        }
      ],
      purchase_intent: [
        // Automotive
        {
          taxonomy_id: 300,
          value: "Automotive",
          confidence: 0.90,
          tier_1: "Purchase Intent",
          tier_2: "Automotive",
          tier_3: "",
          tier_4: "",
          tier_5: "",
          grouping_value: "Automotive",
          section: "purchase_intent",
          tier_path: "Purchase Intent | Automotive",
          category_path: "Purchase Intent | Automotive",
          grouping_tier_key: "tier_2",
          reasoning: "Car shopping emails",
          evidence_count: 25,
          purchase_intent_flag: "High Intent"
        }
      ]
    }

    const result = addTieredStructureToProfile(profileDict, memories)

    // Verify schema_version
    expect(result.schema_version).toBe("2.0")

    // Verify tiered_classifications exists
    expect(result.tiered_classifications).toBeDefined()

    // Verify demographics
    expect(result.tiered_classifications.demographics).toBeDefined()
    expect(result.tiered_classifications.demographics.gender).toBeDefined()
    expect(result.tiered_classifications.demographics.gender.primary.value).toBe("Female")
    expect(result.tiered_classifications.demographics.gender.alternatives).toHaveLength(1)
    expect(result.tiered_classifications.demographics.age_range).toBeDefined()
    expect(result.tiered_classifications.demographics.age_range.primary.value).toBe("25-34")

    // Verify household
    expect(result.tiered_classifications.household).toBeDefined()
    expect(result.tiered_classifications.household.income).toBeDefined()
    expect(result.tiered_classifications.household.income.primary.value).toBe("$50k-$75k")

    // Verify interests (sorted by granularity)
    expect(result.tiered_classifications.interests).toBeDefined()
    expect(Array.isArray(result.tiered_classifications.interests)).toBe(true)
    expect(result.tiered_classifications.interests.length).toBeGreaterThan(0)
    // Should be sorted by granularity_score (ML should be first)
    expect(result.tiered_classifications.interests[0].primary.value).toBe("Machine Learning")

    // Verify purchase_intent
    expect(result.tiered_classifications.purchase_intent).toBeDefined()
    expect(Array.isArray(result.tiered_classifications.purchase_intent)).toBe(true)
    expect(result.tiered_classifications.purchase_intent[0].primary.value).toBe("Automotive")
    expect(result.tiered_classifications.purchase_intent[0].purchase_intent_flag).toBe("High Intent")
  })
})
```

---

## 5. Test Data

### 5.1 Mock Classification Data

Create: `tests/browser/agents/iab-classifier/fixtures/mockClassifications.ts`

```typescript
import type { TaxonomySelection } from '@browser/agents/iab-classifier/tierSelector'

export const mockGenderClassifications: TaxonomySelection[] = [
  {
    taxonomy_id: 21,
    value: "Female",
    confidence: 0.99,
    tier_1: "Demographic",
    tier_2: "Female",
    tier_3: "",
    tier_4: "",
    tier_5: "",
    tier_path: "Demographic | Female",
    category_path: "Demographic | Female",
    grouping_tier_key: "tier_2",
    grouping_value: "Gender",
    section: "demographics",
    reasoning: "Strong evidence from multiple emails",
    evidence_count: 15,
    last_validated: "2025-01-12",
    days_since_validation: 0,
    supporting_evidence: [
      { content: "Email 1", source: "email", confidence: 0.95 },
      { content: "Email 2", source: "email", confidence: 0.98 }
    ]
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
    tier_path: "Demographic | Male",
    category_path: "Demographic | Male",
    grouping_tier_key: "tier_2",
    grouping_value: "Gender",
    section: "demographics",
    reasoning: "Some conflicting evidence",
    evidence_count: 10,
    last_validated: "2025-01-10",
    days_since_validation: 2
  }
]

export const mockTechnologyInterests: TaxonomySelection[] = [
  {
    taxonomy_id: 100,
    value: "Technology",
    confidence: 0.85,
    tier_1: "Interest",
    tier_2: "Technology",
    tier_3: "",
    tier_4: "",
    tier_5: "",
    tier_path: "Interest | Technology",
    category_path: "Interest | Technology",
    grouping_tier_key: "tier_2",
    grouping_value: "Technology",
    section: "interests",
    reasoning: "General tech interest",
    evidence_count: 20
  },
  {
    taxonomy_id: 101,
    value: "Machine Learning",
    confidence: 0.80,
    tier_1: "Interest",
    tier_2: "Technology",
    tier_3: "Artificial Intelligence",
    tier_4: "Machine Learning",
    tier_5: "Deep Learning",
    tier_path: "Interest | Technology | AI | Machine Learning | Deep Learning",
    category_path: "Interest | Technology | AI | Machine Learning | Deep Learning",
    grouping_tier_key: "tier_2",
    grouping_value: "Technology",
    section: "interests",
    reasoning: "Specific ML interest from course emails",
    evidence_count: 15
  }
]

// Add more mock data as needed...
```

---

## 6. Expected Results

### 6.1 Gender Conflict Resolution Expected Output

```json
{
  "primary": {
    "taxonomy_id": 21,
    "value": "Female",
    "confidence": 0.99,
    "tier_depth": 2,
    "granularity_score": 1.09,
    "classification_type": "primary"
  },
  "alternatives": [
    {
      "taxonomy_id": 20,
      "value": "Male",
      "confidence": 0.89,
      "tier_depth": 2,
      "granularity_score": 0.99,
      "classification_type": "alternative",
      "confidence_delta": 0.10
    }
  ],
  "tier_group": "demographics.gender",
  "selection_method": "granularity_weighted"
}
```

### 6.2 Granularity Prioritization Expected Output

```json
{
  "primary": {
    "taxonomy_id": 101,
    "value": "Machine Learning",
    "confidence": 0.80,
    "tier_depth": 5,
    "granularity_score": 1.05,
    "classification_type": "primary"
  },
  "alternatives": [
    {
      "taxonomy_id": 100,
      "value": "Technology",
      "confidence": 0.85,
      "tier_depth": 2,
      "granularity_score": 0.95,
      "classification_type": "alternative",
      "confidence_delta": -0.05
    }
  ],
  "tier_group": "interests.technology",
  "selection_method": "granularity_weighted"
}
```

### 6.3 Full Profile Schema v2.0 Expected Output

```json
{
  "schema_version": "2.0",
  "user_id": "test_user",
  "tiered_classifications": {
    "demographics": {
      "gender": {
        "primary": {...},
        "alternatives": [...],
        "selection_method": "granularity_weighted"
      },
      "age_range": {
        "primary": {...},
        "alternatives": [],
        "selection_method": "highest_confidence"
      }
    },
    "household": {
      "income": {
        "primary": {...},
        "alternatives": [],
        "selection_method": "highest_confidence"
      }
    },
    "interests": [
      {
        "primary": {...},
        "alternatives": [],
        "selection_method": "non_exclusive",
        "granularity_score": 1.05
      }
    ],
    "purchase_intent": [
      {
        "primary": {...},
        "alternatives": [],
        "selection_method": "non_exclusive",
        "granularity_score": 1.00,
        "purchase_intent_flag": "High Intent"
      }
    ]
  }
}
```

---

## 7. Test Execution

### 7.1 Run All Tests

```bash
# Unit tests only
npm test tests/browser/agents/iab-classifier/tierSelector.test.ts
npm test tests/browser/agents/iab-classifier/profileTierFormatter.test.ts

# Integration tests
npm test tests/browser/agents/iab-classifier/integration/

# E2E tests
npm test tests/browser/agents/iab-classifier/e2e/

# All tier selection tests
npm test tests/browser/agents/iab-classifier/
```

### 7.2 Test Coverage Report

```bash
# Generate coverage report
npm test -- --coverage

# Expected coverage:
# - tierSelector.ts: 100%
# - profileTierFormatter.ts: 100%
```

### 7.3 Manual Testing via Admin Dashboard

```bash
# Start dev server
cd src/admin-dashboard
npm run dev

# Navigate to: http://localhost:3000/profile?user_id=default_user
# Verify:
# 1. Gender shows "Female" as primary, "Male" as alternative
# 2. Interests sorted by granularity (ML before Technology)
# 3. No low-confidence alternatives (delta > 0.3 filtered out)
# 4. schema_version = "2.0"
```

---

## Success Criteria

✅ **All Unit Tests Pass** (20+ tests)
✅ **All Integration Tests Pass** (4 tests)
✅ **E2E Test Passes** (1 test)
✅ **Coverage ≥ 100%** (tierSelector.ts and profileTierFormatter.ts)
✅ **TypeScript Compiles** (zero errors)
✅ **Manual Testing Confirms** (admin dashboard displays correct tiered structure)

---

## Test Execution Timeline

| Phase | Duration |
|-------|----------|
| Write unit tests | 1 hour |
| Write integration tests | 30 min |
| Write E2E test | 30 min |
| Run all tests + fix failures | 1 hour |
| Manual testing | 30 min |
| **Total** | **3.5 hours** |

---

**END OF TESTING PLAN**
