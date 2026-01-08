/**
 * Tier Selector Unit Tests
 *
 * Tests all 6 functions in tierSelector.ts:
 * - calculateTierDepth()
 * - calculateGranularityScore()
 * - selectPrimaryAndAlternatives()
 * - groupClassificationsByTier()
 * - isMutuallyExclusiveTier()
 * - applyTieredClassification()
 */

import { describe, it, expect } from 'vitest'
import {
  calculateTierDepth,
  calculateGranularityScore,
  selectPrimaryAndAlternatives,
  groupClassificationsByTier,
  isMutuallyExclusiveTier,
  applyTieredClassification,
  type TaxonomySelection,
} from '../tierSelector'

describe('calculateTierDepth', () => {
  it('should return 0 for empty tiers', () => {
    const classification: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Technology',
      confidence: 0.8,
      tier_1: '',
      tier_2: '',
      tier_3: '',
      tier_4: '',
      tier_5: '',
      tier_path: '',
      category_path: '',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    expect(calculateTierDepth(classification)).toBe(0)
  })

  it('should return 1 for single tier', () => {
    const classification: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Technology',
      confidence: 0.8,
      tier_1: 'Interest',
      tier_2: '',
      tier_3: '',
      tier_4: '',
      tier_5: '',
      tier_path: 'Interest',
      category_path: 'Interest',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    expect(calculateTierDepth(classification)).toBe(1)
  })

  it('should return 2 for two tiers', () => {
    const classification: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Technology',
      confidence: 0.8,
      tier_1: 'Interest',
      tier_2: 'Technology',
      tier_3: '',
      tier_4: '',
      tier_5: '',
      tier_path: 'Interest | Technology',
      category_path: 'Interest | Technology',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    expect(calculateTierDepth(classification)).toBe(2)
  })

  it('should return 5 for all five tiers', () => {
    const classification: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Deep Learning',
      confidence: 0.8,
      tier_1: 'Interest',
      tier_2: 'Technology',
      tier_3: 'AI',
      tier_4: 'ML',
      tier_5: 'Deep Learning',
      tier_path: 'Interest | Technology | AI | ML | Deep Learning',
      category_path: 'Interest | Technology | AI | ML | Deep Learning',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    expect(calculateTierDepth(classification)).toBe(5)
  })

  it('should ignore whitespace-only tiers', () => {
    const classification: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Technology',
      confidence: 0.8,
      tier_1: 'Interest',
      tier_2: '   ',
      tier_3: '',
      tier_4: '',
      tier_5: '',
      tier_path: 'Interest',
      category_path: 'Interest',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    expect(calculateTierDepth(classification)).toBe(1)
  })
})

describe('calculateGranularityScore', () => {
  it('should return confidence when confidence < 0.7', () => {
    const classification: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Technology',
      confidence: 0.65,
      tier_1: 'Interest',
      tier_2: 'Technology',
      tier_3: '',
      tier_4: '',
      tier_5: '',
      tier_path: 'Interest | Technology',
      category_path: 'Interest | Technology',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    expect(calculateGranularityScore(classification)).toBe(0.65)
  })

  it('should add granularity bonus when confidence >= 0.7', () => {
    const classification: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Technology',
      confidence: 0.80,
      tier_1: 'Interest',
      tier_2: 'Technology',
      tier_3: '',
      tier_4: '',
      tier_5: '',
      tier_path: 'Interest | Technology',
      category_path: 'Interest | Technology',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    // confidence (0.80) + (tier_depth (2) × 0.05) = 0.80 + 0.10 = 0.90
    expect(calculateGranularityScore(classification)).toBe(0.90)
  })

  it('should prioritize specific over generic when both high confidence', () => {
    const generic: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Technology',
      confidence: 0.85,
      tier_1: 'Interest',
      tier_2: 'Technology',
      tier_3: '',
      tier_4: '',
      tier_5: '',
      tier_path: 'Interest | Technology',
      category_path: 'Interest | Technology',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    const specific: TaxonomySelection = {
      taxonomy_id: 2,
      section: 'interests',
      value: 'Machine Learning',
      confidence: 0.80,
      tier_1: 'Interest',
      tier_2: 'Technology',
      tier_3: 'AI',
      tier_4: 'ML',
      tier_5: 'Machine Learning',
      tier_path: 'Interest | Technology | AI | ML | Machine Learning',
      category_path: 'Interest | Technology | AI | ML | Machine Learning',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    const genericScore = calculateGranularityScore(generic)
    const specificScore = calculateGranularityScore(specific)

    // Generic: 0.85 + (2 × 0.05) = 0.95
    expect(genericScore).toBe(0.95)

    // Specific: 0.80 + (5 × 0.05) = 1.05
    expect(specificScore).toBe(1.05)

    // Specific should win
    expect(specificScore).toBeGreaterThan(genericScore)
  })

  it('should use custom granularity bonus', () => {
    const classification: TaxonomySelection = {
      taxonomy_id: 1,
      section: 'interests',
      value: 'Technology',
      confidence: 0.80,
      tier_1: 'Interest',
      tier_2: 'Technology',
      tier_3: '',
      tier_4: '',
      tier_5: '',
      tier_path: 'Interest | Technology',
      category_path: 'Interest | Technology',
      grouping_tier_key: '',
      grouping_value: '',
      reasoning: '',
      evidence_count: 0,
      last_validated: '',
      days_since_validation: 0,
      supporting_evidence: [],
    }

    // confidence (0.80) + (tier_depth (2) × 0.10) = 0.80 + 0.20 = 1.00
    expect(calculateGranularityScore(classification, 0.10)).toBe(1.00)
  })
})

describe('selectPrimaryAndAlternatives', () => {
  it('should return null for empty classifications', () => {
    const result = selectPrimaryAndAlternatives([], 'Gender')
    expect(result).toBeNull()
  })

  it('should filter by minimum confidence', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.45, // Below default 0.5
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Male',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'Gender')
    expect(result).toBeNull()
  })

  it('should select highest granularity score as primary', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.85,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Male',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: 'Female',
        confidence: 0.90,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Female',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Female',
        category_path: 'Demographic | Gender | Female',
        grouping_tier_key: 'Gender',
        grouping_value: 'Female',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'Gender')

    expect(result).not.toBeNull()
    expect(result!.primary.value).toBe('Female')
    expect(result!.primary.confidence).toBe(0.90)
  })

  it('should include alternatives within confidence delta', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Female',
        confidence: 0.90,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Female',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Female',
        category_path: 'Demographic | Gender | Female',
        grouping_tier_key: 'Gender',
        grouping_value: 'Female',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: 'Male',
        confidence: 0.85, // Within 0.3 delta
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Male',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'Gender')

    expect(result).not.toBeNull()
    expect(result!.primary.value).toBe('Female')
    expect(result!.alternatives).toHaveLength(1)
    expect(result!.alternatives[0].value).toBe('Male')
    expect(result!.alternatives[0].confidence_delta).toBe(0.05)
  })

  it('should exclude alternatives outside confidence delta', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Female',
        confidence: 0.90,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Female',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Female',
        category_path: 'Demographic | Gender | Female',
        grouping_tier_key: 'Gender',
        grouping_value: 'Female',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: 'Male',
        confidence: 0.50, // 0.40 delta > 0.3 threshold
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Male',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'Gender')

    expect(result).not.toBeNull()
    expect(result!.primary.value).toBe('Female')
    expect(result!.alternatives).toHaveLength(0)
  })

  it('should set selection method to granularity_weighted', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.85,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Male',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'Gender')

    expect(result).not.toBeNull()
    expect(result!.selection_method).toBe('granularity_weighted')
  })
})

describe('groupClassificationsByTier', () => {
  it('should group classifications by grouping_value', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.85,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Gender',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: '25-34',
        confidence: 0.75,
        tier_1: 'Demographic',
        tier_2: 'Age',
        tier_3: '25-34',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Age | 25-34',
        category_path: 'Demographic | Age | 25-34',
        grouping_tier_key: 'Age',
        grouping_value: 'Age',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = groupClassificationsByTier(classifications, 'demographics')

    expect(Object.keys(result)).toHaveLength(2)
    expect(result['Gender']).toHaveLength(1)
    expect(result['Age']).toHaveLength(1)
    expect(result['Gender'][0].value).toBe('Male')
    expect(result['Age'][0].value).toBe('25-34')
  })

  it('should handle multiple items in same tier group', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.85,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Gender',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: 'Female',
        confidence: 0.90,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Female',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Female',
        category_path: 'Demographic | Gender | Female',
        grouping_tier_key: 'Gender',
        grouping_value: 'Gender',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = groupClassificationsByTier(classifications, 'demographics')

    expect(Object.keys(result)).toHaveLength(1)
    expect(result['Gender']).toHaveLength(2)
  })

  it('should return empty object for empty classifications', () => {
    const result = groupClassificationsByTier([], 'demographics')
    expect(result).toEqual({})
  })
})

describe('isMutuallyExclusiveTier', () => {
  it('should return true for Gender', () => {
    expect(isMutuallyExclusiveTier('Gender')).toBe(true)
  })

  it('should return true for Age', () => {
    expect(isMutuallyExclusiveTier('Age')).toBe(true)
  })

  it('should return true for Education (Highest Level)', () => {
    expect(isMutuallyExclusiveTier('Education (Highest Level)')).toBe(true)
  })

  it('should return true for Marital Status', () => {
    expect(isMutuallyExclusiveTier('Marital Status')).toBe(true)
  })

  it('should return false for Employment Status', () => {
    expect(isMutuallyExclusiveTier('Employment Status')).toBe(false)
  })

  it('should return true for unknown tier groups (default exclusive)', () => {
    expect(isMutuallyExclusiveTier('Unknown Group')).toBe(true)
  })
})

describe('applyTieredClassification', () => {
  it('should apply tiered classification to all groups', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.85,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Gender',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: '25-34',
        confidence: 0.75,
        tier_1: 'Demographic',
        tier_2: 'Age',
        tier_3: '25-34',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Age | 25-34',
        category_path: 'Demographic | Age | 25-34',
        grouping_tier_key: 'Age',
        grouping_value: 'Age',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = applyTieredClassification(classifications, 'demographics')

    expect(Object.keys(result)).toHaveLength(2)
    expect(result['Gender']).toBeDefined()
    expect(result['Age']).toBeDefined()
    expect(result['Gender'].primary.value).toBe('Male')
    expect(result['Age'].primary.value).toBe('25-34')
  })

  it('should handle gender conflict correctly', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.85,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Gender',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: 'Female',
        confidence: 0.90,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Female',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Female',
        category_path: 'Demographic | Gender | Female',
        grouping_tier_key: 'Gender',
        grouping_value: 'Gender',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = applyTieredClassification(classifications, 'demographics')

    // Should select Female as primary (higher confidence)
    expect(result['Gender'].primary.value).toBe('Female')
    expect(result['Gender'].primary.confidence).toBe(0.90)

    // Male should be alternative (within 0.3 delta)
    expect(result['Gender'].alternatives).toHaveLength(1)
    expect(result['Gender'].alternatives[0].value).toBe('Male')
  })

  it('should return empty object for empty classifications', () => {
    const result = applyTieredClassification([], 'demographics')
    expect(result).toEqual({})
  })

  it('should handle non-exclusive interests correctly', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'interests',
        value: 'Technology',
        confidence: 0.85,
        tier_1: 'Interest',
        tier_2: 'Technology',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Technology',
        category_path: 'Interest | Technology',
        grouping_tier_key: 'Technology',
        grouping_value: 'Technology',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'interests',
        value: 'Sports',
        confidence: 0.75,
        tier_1: 'Interest',
        tier_2: 'Sports',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Sports',
        category_path: 'Interest | Sports',
        grouping_tier_key: 'Sports',
        grouping_value: 'Sports',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = applyTieredClassification(classifications, 'interests')

    // Both should be primaries (non-exclusive)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['Technology'].primary.value).toBe('Technology')
    expect(result['Sports'].primary.value).toBe('Sports')
  })
})

/**
 * REQ-1.4: Unknown Classification Filtering Tests
 *
 * Tests for filtering "Unknown [Field]" classifications in mutually-exclusive tier groups.
 * Requirements: UNKNOWN_CLASSIFICATION_FILTERING_SPEC.md
 */
describe('selectPrimaryAndAlternatives - Unknown Filtering', () => {
  const createClassification = (
    tier_1: string,
    tier_2: string,
    confidence: number,
    evidence_count: number
  ): TaxonomySelection => ({
    taxonomy_id: 1,
    section: 'demographics',
    value: tier_2,
    confidence,
    tier_1,
    tier_2,
    tier_3: '',
    tier_4: '',
    tier_5: '',
    tier_path: `${tier_1} | ${tier_2}`,
    category_path: tier_2,
    grouping_tier_key: tier_1.toLowerCase().replace(' ', '_'),
    grouping_value: tier_2.toLowerCase().replace(' ', '_'),
    reasoning: 'Test data',
    evidence_count,
    last_validated: new Date().toISOString(),
    days_since_validation: 0,
    supporting_evidence: [],
  })

  it('should filter tier group when Unknown Gender has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Gender', 'Unknown Gender', 0.91, 25),
      createClassification('Gender', 'Male', 0.34, 2),
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'demographics.gender', 0.5, 0.3, 0.05)

    // EXPECTED: Entire tier group filtered (null)
    expect(result).toBeNull()
  })

  it('should filter tier group when Unknown Age has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Age Range', 'Unknown Age', 0.88, 30),
      createClassification('Age Range', '25-34', 0.45, 5),
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'demographics.age_range', 0.5, 0.3, 0.05)

    // EXPECTED: Entire tier group filtered (null)
    expect(result).toBeNull()
  })

  it('should filter tier group when Unknown Education has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Education Level', 'Unknown Education', 0.85, 20),
      createClassification('Education Level', "Bachelor's Degree", 0.50, 8),
    ]

    const result = selectPrimaryAndAlternatives(
      classifications,
      'demographics.education_level',
      0.5,
      0.3,
      0.05
    )

    // EXPECTED: Entire tier group filtered (null)
    expect(result).toBeNull()
  })

  it('should filter tier group when Unknown Marital Status has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Marital Status', 'Unknown Marital Status', 0.80, 15),
      createClassification('Marital Status', 'Married', 0.60, 10),
    ]

    const result = selectPrimaryAndAlternatives(
      classifications,
      'demographics.marital_status',
      0.5,
      0.3,
      0.05
    )

    // EXPECTED: Entire tier group filtered (null)
    expect(result).toBeNull()
  })

  it('should filter tier group when Unknown Income has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Income Range', 'Unknown Income', 0.78, 18),
      createClassification('Income Range', '$50k-$75k', 0.55, 7),
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'household.income_range', 0.5, 0.3, 0.05)

    // EXPECTED: Entire tier group filtered (null)
    expect(result).toBeNull()
  })

  it('should filter tier group when Unknown Property has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Property Type', 'Unknown Property', 0.75, 12),
      createClassification('Property Type', 'Single Family', 0.52, 6),
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'household.property_type', 0.5, 0.3, 0.05)

    // EXPECTED: Entire tier group filtered (null)
    expect(result).toBeNull()
  })

  it('should filter tier group when Unknown Ownership has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Home Ownership', 'Unknown Ownership', 0.82, 22),
      createClassification('Home Ownership', 'Owner', 0.48, 4),
    ]

    const result = selectPrimaryAndAlternatives(
      classifications,
      'household.home_ownership',
      0.5,
      0.3,
      0.05
    )

    // EXPECTED: Entire tier group filtered (null)
    expect(result).toBeNull()
  })

  it('should NOT filter tier group when valid classification has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Gender', 'Male', 0.89, 15),
      createClassification('Gender', 'Female', 0.72, 8),
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'demographics.gender', 0.5, 0.3, 0.05)

    // EXPECTED: Male is primary, Female is alternative
    expect(result).not.toBeNull()
    expect(result?.primary.tier_2).toBe('Male')
    expect(result?.alternatives).toHaveLength(1)
    expect(result?.alternatives[0].tier_2).toBe('Female')
  })

  it('should NOT filter when Unknown is alternative, not primary', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Gender', 'Male', 0.89, 15),
      createClassification('Gender', 'Unknown Gender', 0.65, 8),
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'demographics.gender', 0.5, 0.3, 0.05)

    // EXPECTED: Male is primary, Unknown Gender is in alternatives
    expect(result).not.toBeNull()
    expect(result?.primary.tier_2).toBe('Male')
    // Unknown Gender should be in alternatives (only filter if primary)
    expect(result?.alternatives.some((a) => a.tier_2 === 'Unknown Gender')).toBe(true)
  })

  it('should filter even when Unknown has very high confidence', () => {
    const classifications: TaxonomySelection[] = [
      createClassification('Gender', 'Unknown Gender', 0.99, 40),
      createClassification('Gender', 'Male', 0.20, 1),
    ]

    const result = selectPrimaryAndAlternatives(classifications, 'demographics.gender', 0.5, 0.3, 0.05)

    // EXPECTED: Entire tier group filtered despite 99% confidence
    expect(result).toBeNull()
  })
})
