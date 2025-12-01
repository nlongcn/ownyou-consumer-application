/**
 * Profile Tier Formatter Unit Tests
 *
 * Tests all 5 functions in profileTierFormatter.ts:
 * - formatTieredDemographics()
 * - formatTieredHousehold()
 * - formatTieredInterests()
 * - formatTieredPurchaseIntent()
 * - addTieredStructureToProfile()
 */

import { describe, it, expect } from 'vitest'
import {
  formatTieredDemographics,
  formatTieredHousehold,
  formatTieredInterests,
  formatTieredPurchaseIntent,
  addTieredStructureToProfile,
  type TaxonomySelection,
} from '@browser/agents/iab-classifier/profileTierFormatter'

describe('formatTieredDemographics', () => {
  it('should return empty object for empty memories', () => {
    const result = formatTieredDemographics([])
    expect(result).toEqual({})
  })

  it('should format single gender classification', () => {
    const memories: TaxonomySelection[] = [
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
        reasoning: 'Test reasoning',
        evidence_count: 5,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = formatTieredDemographics(memories)

    expect(result).toHaveProperty('gender')
    expect(result.gender.primary.value).toBe('Male')
    expect(result.gender.primary.confidence).toBe(0.85)
    expect(result.gender.alternatives).toHaveLength(0)
  })

  it('should format gender with alternatives', () => {
    const memories: TaxonomySelection[] = [
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

    const result = formatTieredDemographics(memories)

    expect(result.gender.primary.value).toBe('Female')
    expect(result.gender.alternatives).toHaveLength(1)
    expect(result.gender.alternatives[0].value).toBe('Male')
    expect(result.gender.alternatives[0].confidence_delta).toBe(0.05)
  })

  it('should map grouping keys to field names correctly', () => {
    const memories: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
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
        grouping_value: '25-34',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = formatTieredDemographics(memories)

    expect(result).toHaveProperty('age_range')
    expect(result.age_range.primary.value).toBe('25-34')
  })
})

describe('formatTieredHousehold', () => {
  it('should return empty object for empty memories', () => {
    const result = formatTieredHousehold([])
    expect(result).toEqual({})
  })

  it('should format household income classification', () => {
    const memories: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'household',
        value: '$50K-$75K',
        confidence: 0.65,
        tier_1: 'Demographic',
        tier_2: 'Household Data',
        tier_3: 'Income',
        tier_4: '$50K-$75K',
        tier_5: '',
        tier_path: 'Demographic | Household Data | Income | $50K-$75K',
        category_path: 'Demographic | Household Data | Income | $50K-$75K',
        grouping_tier_key: 'Income',
        grouping_value: '$50K-$75K',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = formatTieredHousehold(memories)

    expect(result).toHaveProperty('income')
    expect(result.income.primary.value).toBe('$50K-$75K')
    expect(result.income.primary.confidence).toBe(0.65)
  })

  it('should handle multiple household attributes', () => {
    const memories: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'household',
        value: '$50K-$75K',
        confidence: 0.65,
        tier_1: 'Demographic',
        tier_2: 'Household Data',
        tier_3: 'Income',
        tier_4: '$50K-$75K',
        tier_5: '',
        tier_path: 'Demographic | Household Data | Income | $50K-$75K',
        category_path: 'Demographic | Household Data | Income | $50K-$75K',
        grouping_tier_key: 'Income',
        grouping_value: '$50K-$75K',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'household',
        value: 'Home Owners',
        confidence: 0.80,
        tier_1: 'Demographic',
        tier_2: 'Household Data',
        tier_3: 'Ownership',
        tier_4: 'Home Owners',
        tier_5: '',
        tier_path: 'Demographic | Household Data | Ownership | Home Owners',
        category_path: 'Demographic | Household Data | Ownership | Home Owners',
        grouping_tier_key: 'Ownership',
        grouping_value: 'Home Owners',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = formatTieredHousehold(memories)

    expect(Object.keys(result)).toHaveLength(2)
    expect(result).toHaveProperty('income')
    expect(result).toHaveProperty('ownership')
  })
})

describe('formatTieredInterests', () => {
  it('should return empty array for empty memories', () => {
    const result = formatTieredInterests([])
    expect(result).toEqual([])
  })

  it('should format single interest', () => {
    const memories: TaxonomySelection[] = [
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
    ]

    const result = formatTieredInterests(memories)

    expect(result).toHaveLength(1)
    expect(result[0].primary.value).toBe('Technology')
    expect(result[0].primary.confidence).toBe(0.85)
    expect(result[0].granularity_score).toBeDefined()
  })

  it('should sort by granularity score', () => {
    const memories: TaxonomySelection[] = [
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

    const result = formatTieredInterests(memories)

    expect(result).toHaveLength(2)
    // Machine Learning should be first (higher granularity score)
    expect(result[0].primary.value).toBe('Machine Learning')
    expect(result[1].primary.value).toBe('Technology')
    expect(result[0].granularity_score).toBeGreaterThan(result[1].granularity_score!)
  })

  it('should include all non-exclusive interests', () => {
    const memories: TaxonomySelection[] = [
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
        value: 'Music',
        confidence: 0.70,
        tier_1: 'Interest',
        tier_2: 'Arts & Entertainment',
        tier_3: 'Music',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Arts & Entertainment | Music',
        category_path: 'Interest | Arts & Entertainment | Music',
        grouping_tier_key: 'Music',
        grouping_value: 'Music',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const result = formatTieredInterests(memories)

    // All interests should be included (non-exclusive)
    expect(result).toHaveLength(3)
  })
})

describe('formatTieredPurchaseIntent', () => {
  it('should return empty array for empty memories', () => {
    const result = formatTieredPurchaseIntent([])
    expect(result).toEqual([])
  })

  it('should format single purchase intent', () => {
    const memories: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'purchase_intent',
        value: 'Laptops',
        confidence: 0.92,
        tier_1: 'Purchase Intent',
        tier_2: 'Consumer Electronics',
        tier_3: 'Computers',
        tier_4: 'Laptops',
        tier_5: '',
        tier_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
        category_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
        grouping_tier_key: 'Laptops',
        grouping_value: 'Laptops',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
        purchase_intent_flag: 'High Intent',
      },
    ]

    const result = formatTieredPurchaseIntent(memories)

    expect(result).toHaveLength(1)
    expect(result[0].primary.value).toBe('Laptops')
    expect(result[0].primary.confidence).toBe(0.92)
    expect(result[0].purchase_intent_flag).toBe('High Intent')
  })

  it('should sort by granularity score', () => {
    const memories: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'purchase_intent',
        value: 'Consumer Electronics',
        confidence: 0.88,
        tier_1: 'Purchase Intent',
        tier_2: 'Consumer Electronics',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Purchase Intent | Consumer Electronics',
        category_path: 'Purchase Intent | Consumer Electronics',
        grouping_tier_key: 'Consumer Electronics',
        grouping_value: 'Consumer Electronics',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
        purchase_intent_flag: 'Medium Intent',
      },
      {
        taxonomy_id: 2,
        section: 'purchase_intent',
        value: 'Laptops',
        confidence: 0.85,
        tier_1: 'Purchase Intent',
        tier_2: 'Consumer Electronics',
        tier_3: 'Computers',
        tier_4: 'Laptops',
        tier_5: '',
        tier_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
        category_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
        grouping_tier_key: 'Laptops',
        grouping_value: 'Laptops',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
        purchase_intent_flag: 'High Intent',
      },
    ]

    const result = formatTieredPurchaseIntent(memories)

    expect(result).toHaveLength(2)
    // Laptops should be first (higher granularity score despite lower confidence)
    expect(result[0].primary.value).toBe('Laptops')
    expect(result[1].primary.value).toBe('Consumer Electronics')
  })

  it('should handle missing purchase_intent_flag', () => {
    const memories: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'purchase_intent',
        value: 'Laptops',
        confidence: 0.92,
        tier_1: 'Purchase Intent',
        tier_2: 'Consumer Electronics',
        tier_3: 'Computers',
        tier_4: 'Laptops',
        tier_5: '',
        tier_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
        category_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
        grouping_tier_key: 'Laptops',
        grouping_value: 'Laptops',
        reasoning: '',
        evidence_count: 0,
        last_validated: '',
        days_since_validation: 0,
        supporting_evidence: [],
        // No purchase_intent_flag
      },
    ]

    const result = formatTieredPurchaseIntent(memories)

    expect(result).toHaveLength(1)
    expect(result[0].purchase_intent_flag).toBeUndefined()
  })
})

describe('addTieredStructureToProfile', () => {
  it('should add schema_version 2.0', () => {
    const profileDict = {}
    const memories = {
      demographics: [],
      household: [],
      interests: [],
      purchase_intent: [],
    }

    const result = addTieredStructureToProfile(profileDict, memories)

    expect(result.schema_version).toBe('2.0')
  })

  it('should add tiered_classifications object', () => {
    const profileDict = {}
    const memories = {
      demographics: [],
      household: [],
      interests: [],
      purchase_intent: [],
    }

    const result = addTieredStructureToProfile(profileDict, memories)

    expect(result).toHaveProperty('tiered_classifications')
    expect(result.tiered_classifications).toHaveProperty('demographics')
    expect(result.tiered_classifications).toHaveProperty('household')
    expect(result.tiered_classifications).toHaveProperty('interests')
    expect(result.tiered_classifications).toHaveProperty('purchase_intent')
  })

  it('should format complete profile', () => {
    const profileDict = {
      user_id: 'test_user',
      timestamp: '2025-01-12',
    }

    const memories = {
      demographics: [
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
      ],
      household: [
        {
          taxonomy_id: 2,
          section: 'household',
          value: '$50K-$75K',
          confidence: 0.65,
          tier_1: 'Demographic',
          tier_2: 'Household Data',
          tier_3: 'Income',
          tier_4: '$50K-$75K',
          tier_5: '',
          tier_path: 'Demographic | Household Data | Income | $50K-$75K',
          category_path: 'Demographic | Household Data | Income | $50K-$75K',
          grouping_tier_key: 'Income',
          grouping_value: '$50K-$75K',
          reasoning: '',
          evidence_count: 0,
          last_validated: '',
          days_since_validation: 0,
          supporting_evidence: [],
        },
      ],
      interests: [
        {
          taxonomy_id: 3,
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
      ],
      purchase_intent: [
        {
          taxonomy_id: 4,
          section: 'purchase_intent',
          value: 'Laptops',
          confidence: 0.92,
          tier_1: 'Purchase Intent',
          tier_2: 'Consumer Electronics',
          tier_3: 'Computers',
          tier_4: 'Laptops',
          tier_5: '',
          tier_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
          category_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
          grouping_tier_key: 'Laptops',
          grouping_value: 'Laptops',
          reasoning: '',
          evidence_count: 0,
          last_validated: '',
          days_since_validation: 0,
          supporting_evidence: [],
          purchase_intent_flag: 'High Intent',
        },
      ],
    }

    const result = addTieredStructureToProfile(profileDict, memories)

    expect(result.schema_version).toBe('2.0')
    expect(result.user_id).toBe('test_user')
    expect(result.timestamp).toBe('2025-01-12')
    expect(result.tiered_classifications.demographics.gender.primary.value).toBe('Male')
    expect(result.tiered_classifications.household.income.primary.value).toBe('$50K-$75K')
    expect(result.tiered_classifications.interests).toHaveLength(1)
    expect(result.tiered_classifications.purchase_intent).toHaveLength(1)
  })

  it('should preserve existing profile fields', () => {
    const profileDict = {
      user_id: 'test_user',
      existing_field: 'existing_value',
    }

    const memories = {
      demographics: [],
      household: [],
      interests: [],
      purchase_intent: [],
    }

    const result = addTieredStructureToProfile(profileDict, memories)

    expect(result.user_id).toBe('test_user')
    expect(result.existing_field).toBe('existing_value')
    expect(result.schema_version).toBe('2.0')
  })
})
