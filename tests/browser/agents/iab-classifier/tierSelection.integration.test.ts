/**
 * Tier Selection Integration Tests
 *
 * Tests 4 key integration scenarios:
 * 1. Gender Conflict Resolution
 * 2. Granularity Prioritization
 * 3. Confidence Delta Filtering
 * 4. Non-Exclusive Category Handling
 */

import { describe, it, expect } from 'vitest'
import {
  applyTieredClassification,
  type TaxonomySelection,
} from '@browser/agents/iab-classifier/tierSelector'
import {
  formatTieredDemographics,
  formatTieredInterests,
} from '@browser/agents/iab-classifier/profileTierFormatter'

describe('Integration Test 1: Gender Conflict Resolution', () => {
  it('should resolve Male vs Female conflict by selecting highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.89,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Male',
        reasoning: 'Male indicators in communication style',
        evidence_count: 12,
        last_validated: '2025-01-10',
        days_since_validation: 2,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: 'Female',
        confidence: 0.99,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Female',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Female',
        category_path: 'Demographic | Gender | Female',
        grouping_tier_key: 'Gender',
        grouping_value: 'Female',
        reasoning: 'Strong female indicators in purchase patterns',
        evidence_count: 25,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    // Apply tiered classification
    const tiered = applyTieredClassification(classifications, 'demographics')

    // Format as demographics
    const formatted = formatTieredDemographics(classifications)

    // Assertions
    expect(formatted.gender).toBeDefined()
    expect(formatted.gender.primary.value).toBe('Female')
    expect(formatted.gender.primary.confidence).toBe(0.99)
    expect(formatted.gender.alternatives).toHaveLength(1)
    expect(formatted.gender.alternatives[0].value).toBe('Male')
    expect(formatted.gender.alternatives[0].confidence).toBe(0.89)
    expect(formatted.gender.alternatives[0].confidence_delta).toBe(0.10)
    expect(formatted.gender.selection_method).toBe('granularity_weighted')
  })

  it('should NOT show both as primaries (mutually exclusive)', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Male',
        confidence: 0.89,
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
        confidence: 0.99,
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

    const formatted = formatTieredDemographics(classifications)

    // Only ONE primary (Female)
    expect(Object.keys(formatted)).toHaveLength(1)
    expect(formatted.gender.primary.value).toBe('Female')

    // Male is alternative, NOT a separate primary
    expect(formatted.gender.alternatives[0].value).toBe('Male')
  })
})

describe('Integration Test 2: Granularity Prioritization', () => {
  it('should prioritize specific ML (0.80) over generic Technology (0.85)', () => {
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
        reasoning: 'General tech interest',
        evidence_count: 15,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
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
        grouping_tier_key: 'Machine Learning',
        grouping_value: 'Machine Learning',
        reasoning: 'Specific ML interest from research papers',
        evidence_count: 8,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const formatted = formatTieredInterests(classifications)

    // Machine Learning should be first (higher granularity score)
    expect(formatted).toHaveLength(2)
    expect(formatted[0].primary.value).toBe('Machine Learning')
    expect(formatted[1].primary.value).toBe('Technology')

    // Verify granularity scores
    // ML: 0.80 + (5 × 0.05) = 1.05
    expect(formatted[0].granularity_score).toBe(1.05)

    // Tech: 0.85 + (2 × 0.05) = 0.95
    expect(formatted[1].granularity_score).toBe(0.95)

    // ML wins despite lower confidence
    expect(formatted[0].granularity_score).toBeGreaterThan(formatted[1].granularity_score!)
  })

  it('should show both interests (non-exclusive)', () => {
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
        value: 'Machine Learning',
        confidence: 0.80,
        tier_1: 'Interest',
        tier_2: 'Technology',
        tier_3: 'AI',
        tier_4: 'ML',
        tier_5: 'Machine Learning',
        tier_path: 'Interest | Technology | AI | ML | Machine Learning',
        category_path: 'Interest | Technology | AI | ML | Machine Learning',
        grouping_tier_key: 'Machine Learning',
        grouping_value: 'Machine Learning',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const formatted = formatTieredInterests(classifications)

    // Both should be included (non-exclusive)
    expect(formatted).toHaveLength(2)
    expect(formatted[0].primary.value).toBe('Machine Learning')
    expect(formatted[1].primary.value).toBe('Technology')
  })
})

describe('Integration Test 3: Confidence Delta Filtering', () => {
  it('should include alternatives within 0.3 confidence delta', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: '35-44',
        confidence: 0.78,
        tier_1: 'Demographic',
        tier_2: 'Age',
        tier_3: '35-44',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Age | 35-44',
        category_path: 'Demographic | Age | 35-44',
        grouping_tier_key: 'Age',
        grouping_value: '35-44',
        reasoning: 'Primary age indicator',
        evidence_count: 10,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: '25-34',
        confidence: 0.72,
        tier_1: 'Demographic',
        tier_2: 'Age',
        tier_3: '25-34',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Age | 25-34',
        category_path: 'Demographic | Age | 25-34',
        grouping_tier_key: 'Age',
        grouping_value: '25-34',
        reasoning: 'Alternative age indicator',
        evidence_count: 8,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 3,
        section: 'demographics',
        value: '45-54',
        confidence: 0.65,
        tier_1: 'Demographic',
        tier_2: 'Age',
        tier_3: '45-54',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Age | 45-54',
        category_path: 'Demographic | Age | 45-54',
        grouping_tier_key: 'Age',
        grouping_value: '45-54',
        reasoning: 'Another age possibility',
        evidence_count: 5,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const formatted = formatTieredDemographics(classifications)

    expect(formatted.age_range).toBeDefined()
    expect(formatted.age_range.primary.value).toBe('35-44')
    expect(formatted.age_range.primary.confidence).toBe(0.78)

    // 25-34 should be included (delta = 0.06)
    expect(formatted.age_range.alternatives).toHaveLength(2)

    const alt1 = formatted.age_range.alternatives.find((a) => a.value === '25-34')
    expect(alt1).toBeDefined()
    expect(alt1!.confidence_delta).toBe(0.06)

    // 45-54 should be included (delta = 0.13)
    const alt2 = formatted.age_range.alternatives.find((a) => a.value === '45-54')
    expect(alt2).toBeDefined()
    expect(alt2!.confidence_delta).toBe(0.13)
  })

  it('should exclude alternatives outside 0.3 confidence delta', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: '35-44',
        confidence: 0.90,
        tier_1: 'Demographic',
        tier_2: 'Age',
        tier_3: '35-44',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Age | 35-44',
        category_path: 'Demographic | Age | 35-44',
        grouping_tier_key: 'Age',
        grouping_value: '35-44',
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
        confidence: 0.55,
        tier_1: 'Demographic',
        tier_2: 'Age',
        tier_3: '25-34',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Age | 25-34',
        category_path: 'Demographic | Age | 25-34',
        grouping_tier_key: 'Age',
        grouping_value: '25-34',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const formatted = formatTieredDemographics(classifications)

    expect(formatted.age_range.primary.value).toBe('35-44')

    // 25-34 should be EXCLUDED (delta = 0.35 > 0.3)
    expect(formatted.age_range.alternatives).toHaveLength(0)
  })
})

describe('Integration Test 4: Non-Exclusive Category Handling', () => {
  it('should allow multiple interests as primaries', () => {
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
      {
        taxonomy_id: 3,
        section: 'interests',
        value: 'Cooking',
        confidence: 0.68,
        tier_1: 'Interest',
        tier_2: 'Food & Drink',
        tier_3: 'Cooking',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Food & Drink | Cooking',
        category_path: 'Interest | Food & Drink | Cooking',
        grouping_tier_key: 'Cooking',
        grouping_value: 'Cooking',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const formatted = formatTieredInterests(classifications)

    // All 3 should be included as separate primaries
    expect(formatted).toHaveLength(3)

    // No alternatives (each is its own primary)
    expect(formatted[0].alternatives).toBeUndefined()
    expect(formatted[1].alternatives).toBeUndefined()
    expect(formatted[2].alternatives).toBeUndefined()

    // Verify all have primary values
    const values = formatted.map((item) => item.primary.value)
    expect(values).toContain('Technology')
    expect(values).toContain('Sports')
    expect(values).toContain('Cooking')
  })

  it('should NOT limit interests to one primary (unlike demographics)', () => {
    const classifications: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'interests',
        value: 'Interest 1',
        confidence: 0.90,
        tier_1: 'Interest',
        tier_2: 'Interest 1',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Interest 1',
        category_path: 'Interest | Interest 1',
        grouping_tier_key: 'Interest 1',
        grouping_value: 'Interest 1',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'interests',
        value: 'Interest 2',
        confidence: 0.85,
        tier_1: 'Interest',
        tier_2: 'Interest 2',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Interest 2',
        category_path: 'Interest | Interest 2',
        grouping_tier_key: 'Interest 2',
        grouping_value: 'Interest 2',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 3,
        section: 'interests',
        value: 'Interest 3',
        confidence: 0.80,
        tier_1: 'Interest',
        tier_2: 'Interest 3',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Interest 3',
        category_path: 'Interest | Interest 3',
        grouping_tier_key: 'Interest 3',
        grouping_value: 'Interest 3',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const formatted = formatTieredInterests(classifications)

    // All 3 interests should be present
    expect(formatted).toHaveLength(3)

    // Compare to demographics (would only have 1 gender)
    const genderClassifications: TaxonomySelection[] = [
      {
        taxonomy_id: 4,
        section: 'demographics',
        value: 'Male',
        confidence: 0.90,
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
        taxonomy_id: 5,
        section: 'demographics',
        value: 'Female',
        confidence: 0.85,
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

    const formattedDemographics = formatTieredDemographics(genderClassifications)

    // Demographics has only 1 gender field (Male primary, Female alternative)
    expect(Object.keys(formattedDemographics)).toHaveLength(1)
    expect(formattedDemographics.gender.primary.value).toBe('Male')
    expect(formattedDemographics.gender.alternatives).toHaveLength(1)
  })
})
