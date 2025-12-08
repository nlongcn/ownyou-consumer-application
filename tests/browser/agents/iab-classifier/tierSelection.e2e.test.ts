/**
 * Tier Selection End-to-End Test
 *
 * Tests complete profile generation with all 4 sections:
 * - Demographics (primary/alternatives)
 * - Household (primary/alternatives)
 * - Interests (ranked by granularity)
 * - Purchase Intent (ranked by granularity + flags)
 *
 * Validates schema version 2.0 output structure.
 */

import { describe, it, expect } from 'vitest'
import {
  addTieredStructureToProfile,
  type TaxonomySelection,
} from '@browser/agents/iab-classifier/profileTierFormatter'

describe('E2E Test: Full Profile Generation', () => {
  it('should generate complete tiered profile with all sections', () => {
    // Complete profile data with all 4 sections
    const demographics: TaxonomySelection[] = [
      {
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Female',
        confidence: 0.92,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Female',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Female',
        category_path: 'Demographic | Gender | Female',
        grouping_tier_key: 'Gender',
        grouping_value: 'Female',
        reasoning: 'Strong female indicators',
        evidence_count: 18,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 2,
        section: 'demographics',
        value: 'Male',
        confidence: 0.78,
        tier_1: 'Demographic',
        tier_2: 'Gender',
        tier_3: 'Male',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Gender | Male',
        category_path: 'Demographic | Gender | Male',
        grouping_tier_key: 'Gender',
        grouping_value: 'Male',
        reasoning: 'Some male indicators',
        evidence_count: 8,
        last_validated: '2025-01-10',
        days_since_validation: 2,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 3,
        section: 'demographics',
        value: '35-44',
        confidence: 0.85,
        tier_1: 'Demographic',
        tier_2: 'Age',
        tier_3: '35-44',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Age | 35-44',
        category_path: 'Demographic | Age | 35-44',
        grouping_tier_key: 'Age',
        grouping_value: '35-44',
        reasoning: 'Age range from life stage indicators',
        evidence_count: 12,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 4,
        section: 'demographics',
        value: 'College Graduate',
        confidence: 0.88,
        tier_1: 'Demographic',
        tier_2: 'Education',
        tier_3: 'College Graduate',
        tier_4: '',
        tier_5: '',
        tier_path: 'Demographic | Education | College Graduate',
        category_path: 'Demographic | Education | College Graduate',
        grouping_tier_key: 'Education (Highest Level)',
        grouping_value: 'College Graduate',
        reasoning: 'Education indicators from vocabulary',
        evidence_count: 10,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const household: TaxonomySelection[] = [
      {
        taxonomy_id: 5,
        section: 'household',
        value: '$75K-$100K',
        confidence: 0.72,
        tier_1: 'Demographic',
        tier_2: 'Household Data',
        tier_3: 'Income',
        tier_4: '$75K-$100K',
        tier_5: '',
        tier_path: 'Demographic | Household Data | Income | $75K-$100K',
        category_path: 'Demographic | Household Data | Income | $75K-$100K',
        grouping_tier_key: 'Income',
        grouping_value: '$75K-$100K',
        reasoning: 'Income indicators from purchase patterns',
        evidence_count: 15,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 6,
        section: 'household',
        value: 'Home Owners',
        confidence: 0.82,
        tier_1: 'Demographic',
        tier_2: 'Household Data',
        tier_3: 'Ownership',
        tier_4: 'Home Owners',
        tier_5: '',
        tier_path: 'Demographic | Household Data | Ownership | Home Owners',
        category_path: 'Demographic | Household Data | Ownership | Home Owners',
        grouping_tier_key: 'Ownership',
        grouping_value: 'Home Owners',
        reasoning: 'Home ownership from correspondence',
        evidence_count: 8,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 7,
        section: 'household',
        value: '2 Children',
        confidence: 0.91,
        tier_1: 'Demographic',
        tier_2: 'Household Data',
        tier_3: 'Number of Children',
        tier_4: '2 Children',
        tier_5: '',
        tier_path: 'Demographic | Household Data | Number of Children | 2 Children',
        category_path: 'Demographic | Household Data | Number of Children | 2 Children',
        grouping_tier_key: 'Number of Children',
        grouping_value: '2 Children',
        reasoning: 'Child-related purchases and communications',
        evidence_count: 20,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const interests: TaxonomySelection[] = [
      {
        taxonomy_id: 8,
        section: 'interests',
        value: 'Technology',
        confidence: 0.88,
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
        evidence_count: 22,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 9,
        section: 'interests',
        value: 'Machine Learning',
        confidence: 0.82,
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
        evidence_count: 12,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 10,
        section: 'interests',
        value: 'Fitness',
        confidence: 0.75,
        tier_1: 'Interest',
        tier_2: 'Sports & Fitness',
        tier_3: 'Fitness',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Sports & Fitness | Fitness',
        category_path: 'Interest | Sports & Fitness | Fitness',
        grouping_tier_key: 'Fitness',
        grouping_value: 'Fitness',
        reasoning: 'Fitness app usage and gym subscriptions',
        evidence_count: 10,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
      {
        taxonomy_id: 11,
        section: 'interests',
        value: 'Cooking',
        confidence: 0.70,
        tier_1: 'Interest',
        tier_2: 'Food & Drink',
        tier_3: 'Cooking',
        tier_4: '',
        tier_5: '',
        tier_path: 'Interest | Food & Drink | Cooking',
        category_path: 'Interest | Food & Drink | Cooking',
        grouping_tier_key: 'Cooking',
        grouping_value: 'Cooking',
        reasoning: 'Recipe searches and kitchen equipment',
        evidence_count: 8,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
      },
    ]

    const purchase_intent: TaxonomySelection[] = [
      {
        taxonomy_id: 12,
        section: 'purchase_intent',
        value: 'Laptops',
        confidence: 0.94,
        tier_1: 'Purchase Intent',
        tier_2: 'Consumer Electronics',
        tier_3: 'Computers',
        tier_4: 'Laptops',
        tier_5: '',
        tier_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
        category_path: 'Purchase Intent | Consumer Electronics | Computers | Laptops',
        grouping_tier_key: 'Laptops',
        grouping_value: 'Laptops',
        reasoning: 'Recent laptop price comparisons',
        evidence_count: 5,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
        purchase_intent_flag: 'High Intent',
      },
      {
        taxonomy_id: 13,
        section: 'purchase_intent',
        value: 'Fitness Equipment',
        confidence: 0.88,
        tier_1: 'Purchase Intent',
        tier_2: 'Sports & Fitness',
        tier_3: 'Fitness Equipment',
        tier_4: '',
        tier_5: '',
        tier_path: 'Purchase Intent | Sports & Fitness | Fitness Equipment',
        category_path: 'Purchase Intent | Sports & Fitness | Fitness Equipment',
        grouping_tier_key: 'Fitness Equipment',
        grouping_value: 'Fitness Equipment',
        reasoning: 'Shopping for home gym equipment',
        evidence_count: 4,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
        purchase_intent_flag: 'Medium Intent',
      },
      {
        taxonomy_id: 14,
        section: 'purchase_intent',
        value: 'Online Courses',
        confidence: 0.76,
        tier_1: 'Purchase Intent',
        tier_2: 'Education',
        tier_3: 'Online Courses',
        tier_4: '',
        tier_5: '',
        tier_path: 'Purchase Intent | Education | Online Courses',
        category_path: 'Purchase Intent | Education | Online Courses',
        grouping_tier_key: 'Online Courses',
        grouping_value: 'Online Courses',
        reasoning: 'Browsing ML course catalogs',
        evidence_count: 3,
        last_validated: '2025-01-12',
        days_since_validation: 0,
        supporting_evidence: [],
        purchase_intent_flag: 'Low Intent',
      },
    ]

    // Generate complete profile
    const profileDict = {
      user_id: 'test_user_e2e',
      timestamp: '2025-01-12T10:30:00Z',
      source: 'email_parser',
    }

    const profile = addTieredStructureToProfile(profileDict, {
      demographics,
      household,
      interests,
      purchase_intent,
    })

    // Validate schema version 2.0
    expect(profile.schema_version).toBe('2.0')

    // Validate tiered_classifications structure
    expect(profile).toHaveProperty('tiered_classifications')
    expect(profile.tiered_classifications).toHaveProperty('demographics')
    expect(profile.tiered_classifications).toHaveProperty('household')
    expect(profile.tiered_classifications).toHaveProperty('interests')
    expect(profile.tiered_classifications).toHaveProperty('purchase_intent')

    // Validate demographics
    const demo = profile.tiered_classifications.demographics
    expect(demo.gender).toBeDefined()
    expect(demo.gender.primary.value).toBe('Female')
    expect(demo.gender.primary.confidence).toBe(0.92)
    expect(demo.gender.alternatives).toHaveLength(1)
    expect(demo.gender.alternatives[0].value).toBe('Male')

    expect(demo.age_range).toBeDefined()
    expect(demo.age_range.primary.value).toBe('35-44')

    expect(demo.education).toBeDefined()
    expect(demo.education.primary.value).toBe('College Graduate')

    // Validate household
    const house = profile.tiered_classifications.household
    expect(house.income).toBeDefined()
    expect(house.income.primary.value).toBe('$75K-$100K')

    expect(house.ownership).toBeDefined()
    expect(house.ownership.primary.value).toBe('Home Owners')

    expect(house.number_of_children).toBeDefined()
    expect(house.number_of_children.primary.value).toBe('2 Children')

    // Validate interests (sorted by granularity)
    const ints = profile.tiered_classifications.interests
    expect(ints).toHaveLength(4)

    // Machine Learning should be first (highest granularity score)
    expect(ints[0].primary.value).toBe('Machine Learning')
    expect(ints[0].granularity_score).toBeCloseTo(1.07, 2) // 0.82 + (5 × 0.05)

    // Technology should be second
    expect(ints[1].primary.value).toBe('Technology')
    expect(ints[1].granularity_score).toBeCloseTo(0.98, 2) // 0.88 + (2 × 0.05)

    // Fitness should be third
    expect(ints[2].primary.value).toBe('Fitness')
    expect(ints[2].granularity_score).toBeCloseTo(0.90, 2) // 0.75 + (3 × 0.05)

    // Cooking should be fourth (at 0.7 threshold, gets bonus)
    expect(ints[3].primary.value).toBe('Cooking')
    expect(ints[3].granularity_score).toBeCloseTo(0.85, 2) // 0.70 + (3 × 0.05)

    // Validate purchase intent (sorted by granularity)
    const purchase = profile.tiered_classifications.purchase_intent
    expect(purchase).toHaveLength(3)

    // Laptops should be first
    expect(purchase[0].primary.value).toBe('Laptops')
    expect(purchase[0].granularity_score).toBe(1.14) // 0.94 + (4 × 0.05)
    expect(purchase[0].purchase_intent_flag).toBe('High Intent')

    // Fitness Equipment should be second
    expect(purchase[1].primary.value).toBe('Fitness Equipment')
    expect(purchase[1].granularity_score).toBe(1.03) // 0.88 + (3 × 0.05)
    expect(purchase[1].purchase_intent_flag).toBe('Medium Intent')

    // Online Courses should be third
    expect(purchase[2].primary.value).toBe('Online Courses')
    expect(purchase[2].granularity_score).toBe(0.91) // 0.76 + (3 × 0.05)
    expect(purchase[2].purchase_intent_flag).toBe('Low Intent')

    // Validate original profile fields preserved
    expect(profile.user_id).toBe('test_user_e2e')
    expect(profile.timestamp).toBe('2025-01-12T10:30:00Z')
    expect(profile.source).toBe('email_parser')

    // Validate overall structure matches schema version 2.0
    expect(Object.keys(profile)).toContain('schema_version')
    expect(Object.keys(profile)).toContain('tiered_classifications')
    expect(Object.keys(profile)).toContain('user_id')
    expect(Object.keys(profile)).toContain('timestamp')
  })

  it('should handle empty sections gracefully', () => {
    const profileDict = {
      user_id: 'test_user_empty',
    }

    const profile = addTieredStructureToProfile(profileDict, {
      demographics: [],
      household: [],
      interests: [],
      purchase_intent: [],
    })

    expect(profile.schema_version).toBe('2.0')
    expect(profile.tiered_classifications.demographics).toEqual({})
    expect(profile.tiered_classifications.household).toEqual({})
    expect(profile.tiered_classifications.interests).toEqual([])
    expect(profile.tiered_classifications.purchase_intent).toEqual([])
  })

  it('should handle partial profile data', () => {
    const demographics: TaxonomySelection[] = [
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

    const profileDict = {
      user_id: 'test_user_partial',
    }

    const profile = addTieredStructureToProfile(profileDict, {
      demographics,
      household: [],
      interests: [],
      purchase_intent: [],
    })

    expect(profile.schema_version).toBe('2.0')
    expect(profile.tiered_classifications.demographics.gender).toBeDefined()
    expect(profile.tiered_classifications.household).toEqual({})
    expect(profile.tiered_classifications.interests).toEqual([])
    expect(profile.tiered_classifications.purchase_intent).toEqual([])
  })
})
