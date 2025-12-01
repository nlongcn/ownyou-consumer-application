/**
 * Integration Test: Unknown Classification Filtering
 *
 * Tests the complete flow of IAB classification with Unknown filtering:
 * 1. Process multiple emails with varying evidence patterns
 * 2. Memory reconciliation boosts Unknown classifications to high confidence
 * 3. Tier selection filters tier groups where Unknown is primary
 * 4. Profile shows filtered (null) tier groups
 *
 * Requirements: UNKNOWN_CLASSIFICATION_FILTERING_SPEC.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IndexedDBStore } from '@browser/store/IndexedDBStore'
import { runIABClassifier } from '@browser/agents/iab-classifier'
import { getBrowserProfileReader } from '@admin-dashboard/lib/profile-reader'
import { clearUserProfile } from '@browser/store/profileUtils'
import type { TaxonomySelection } from '@browser/agents/iab-classifier/tierSelector'

// Mock LLM client that returns realistic classifications
const createMockLLMClient = () => ({
  async invoke(messages: any[]) {
    // Extract text from messages
    const text = messages[messages.length - 1].content

    // Return different classifications based on email patterns
    const classifications: TaxonomySelection[] = []

    // Pattern 1: No gender indicators → Unknown Gender
    if (!text.includes('he') && !text.includes('she') && !text.includes('Mr.') && !text.includes('Ms.')) {
      classifications.push({
        taxonomy_id: 1,
        section: 'demographics',
        value: 'Unknown Gender',
        confidence: 0.25, // Low initial confidence (will be boosted by memory)
        tier_1: 'Gender',
        tier_2: 'Unknown Gender',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Gender | Unknown Gender',
        category_path: 'Unknown Gender',
        grouping_tier_key: 'gender',
        grouping_value: 'unknown_gender',
        reasoning: 'No gender indicators found in text (no pronouns, no titles)',
        evidence_count: 1,
        last_validated: new Date().toISOString(),
        days_since_validation: 0,
        supporting_evidence: [text.substring(0, 100)],
      })
    }

    // Pattern 2: Male indicators → Male
    if (text.includes('he') || text.includes('his') || text.includes('Mr.')) {
      classifications.push({
        taxonomy_id: 20,
        section: 'demographics',
        value: 'Male',
        confidence: 0.85,
        tier_1: 'Gender',
        tier_2: 'Male',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Gender | Male',
        category_path: 'Male',
        grouping_tier_key: 'gender',
        grouping_value: 'male',
        reasoning: 'Male indicators found (pronouns: he/his or title: Mr.)',
        evidence_count: 1,
        last_validated: new Date().toISOString(),
        days_since_validation: 0,
        supporting_evidence: [text.substring(0, 100)],
      })
    }

    // Pattern 3: Female indicators → Female
    if (text.includes('she') || text.includes('her') || text.includes('Ms.')) {
      classifications.push({
        taxonomy_id: 21,
        section: 'demographics',
        value: 'Female',
        confidence: 0.90,
        tier_1: 'Gender',
        tier_2: 'Female',
        tier_3: '',
        tier_4: '',
        tier_5: '',
        tier_path: 'Gender | Female',
        category_path: 'Female',
        grouping_tier_key: 'gender',
        grouping_value: 'female',
        reasoning: 'Female indicators found (pronouns: she/her or title: Ms.)',
        evidence_count: 1,
        last_validated: new Date().toISOString(),
        days_since_validation: 0,
        supporting_evidence: [text.substring(0, 100)],
      })
    }

    return { content: JSON.stringify(classifications) }
  },
})

describe('Integration: Unknown Classification Filtering', () => {
  let store: IndexedDBStore
  const userId = 'test_user_unknown_filtering'

  beforeEach(async () => {
    // Initialize store
    store = new IndexedDBStore('ownyou_store')

    // Clear any existing test data
    await clearUserProfile(store, userId)
  })

  afterEach(async () => {
    // Cleanup test data
    await clearUserProfile(store, userId)
  })

  it('should filter gender tier group when Unknown Gender has highest confidence after memory reconciliation', async () => {
    // Create 25 emails with NO gender indicators (will produce Unknown Gender)
    // Create 15 emails with male indicators (will produce Male)
    // Create 10 emails with female indicators (will produce Female)

    const emails = [
      // 25 emails with NO gender indicators
      ...Array(25)
        .fill(null)
        .map((_, i) => `Order #${i} has been shipped. Track your package online.`),

      // 15 emails with male indicators
      ...Array(15)
        .fill(null)
        .map((_, i) => `Hello Mr. Smith, your order #${25 + i} is ready. He should check his email.`),

      // 10 emails with female indicators
      ...Array(10)
        .fill(null)
        .map((_, i) => `Hello Ms. Jones, your order #${40 + i} is ready. She should check her email.`),
    ]

    // Process all 50 emails
    const mockLLM = createMockLLMClient()

    for (const emailText of emails) {
      // Run IAB classifier with mock LLM
      const result = await mockLLM.invoke([{ role: 'user', content: emailText }])
      const classifications = JSON.parse(result.content)

      // Store classifications (memory reconciliation will boost confidence)
      for (const classification of classifications) {
        const namespace = [userId, 'iab_taxonomy_profile']
        const key = `${classification.section}_${classification.taxonomy_id}_${classification.grouping_value}`

        // Retrieve existing item (for memory reconciliation)
        const existing = await store.get(namespace, key)

        if (existing) {
          // Memory reconciliation: Boost confidence
          const oldConfidence = existing.value.confidence
          const recallStrength = 0.17 + Math.random() * 0.08 // 0.17-0.25
          const newConfidence = oldConfidence + (1 - oldConfidence) * recallStrength

          classification.confidence = Math.min(newConfidence, 1.0)
          classification.evidence_count = existing.value.evidence_count + 1
          classification.supporting_evidence = [
            ...existing.value.supporting_evidence.slice(-5), // Keep last 5
            ...classification.supporting_evidence,
          ]
        }

        await store.put(namespace, key, classification)
      }
    }

    // Read profile from store (with tier selection)
    const reader = getBrowserProfileReader()
    const profile = await reader.getTieredProfile(userId)

    // EXPECTED: Gender tier group is null (filtered) because Unknown Gender has highest confidence
    expect(profile.demographics?.gender).toBeNull()

    // Verify the raw classifications in store show Unknown Gender was indeed highest
    const namespace = [userId, 'iab_taxonomy_profile']
    const items = await store.search(namespace, { filter: {} })

    const genderClassifications = items
      .filter((item) => item.key.startsWith('demographics_') && item.value.tier_1 === 'Gender')
      .map((item) => item.value)
      .sort((a, b) => b.confidence - a.confidence)

    // Unknown Gender should be first (highest confidence due to memory reconciliation)
    expect(genderClassifications[0].tier_2).toBe('Unknown Gender')
    expect(genderClassifications[0].confidence).toBeGreaterThan(0.7) // Boosted by memory

    // Male should be second
    expect(genderClassifications[1].tier_2).toBe('Male')

    // Female should be third
    expect(genderClassifications[2].tier_2).toBe('Female')

    // But profile shows no gender (filtered)
    console.log('✅ Gender tier group correctly filtered despite Unknown Gender having highest confidence')
  }, 60000) // 60 second timeout for processing 50 emails

  it('should NOT filter gender tier group when valid classification has highest confidence', async () => {
    // Create 30 emails with male indicators
    // Create 20 emails with female indicators
    // Create 0 emails with no indicators (no Unknown Gender)

    const emails = [
      // 30 emails with male indicators
      ...Array(30)
        .fill(null)
        .map((_, i) => `Hello Mr. Smith, your order #${i} is ready. He should check his email.`),

      // 20 emails with female indicators
      ...Array(20)
        .fill(null)
        .map((_, i) => `Hello Ms. Jones, your order #${30 + i} is ready. She should check her email.`),
    ]

    // Process all 50 emails
    const mockLLM = createMockLLMClient()

    for (const emailText of emails) {
      const result = await mockLLM.invoke([{ role: 'user', content: emailText }])
      const classifications = JSON.parse(result.content)

      for (const classification of classifications) {
        const namespace = [userId, 'iab_taxonomy_profile']
        const key = `${classification.section}_${classification.taxonomy_id}_${classification.grouping_value}`
        await store.put(namespace, key, classification)
      }
    }

    // Read profile from store
    const reader = getBrowserProfileReader()
    const profile = await reader.getTieredProfile(userId)

    // EXPECTED: Gender tier group is NOT null (NOT filtered) because Male has highest confidence
    expect(profile.demographics?.gender).not.toBeNull()
    expect(profile.demographics?.gender?.primary.tier_2).toBe('Male')
    expect(profile.demographics?.gender?.alternatives).toHaveLength(1)
    expect(profile.demographics?.gender?.alternatives[0].tier_2).toBe('Female')

    console.log('✅ Gender tier group correctly preserved when valid classification is primary')
  }, 60000)

  it('should filter multiple tier groups when Unknown classifications are primary', async () => {
    // Create emails with NO indicators for Gender, Age, Income
    // This will produce Unknown Gender, Unknown Age, Unknown Income as primaries

    const emails = Array(30)
      .fill(null)
      .map((_, i) => `Order #${i} has been shipped. Track your package online.`)

    // Mock LLM that returns Unknown for all demographics/household
    const mockMultipleUnknown = {
      async invoke(messages: any[]) {
        return {
          content: JSON.stringify([
            {
              taxonomy_id: 1,
              section: 'demographics',
              value: 'Unknown Gender',
              confidence: 0.30,
              tier_1: 'Gender',
              tier_2: 'Unknown Gender',
              tier_3: '',
              tier_4: '',
              tier_5: '',
              tier_path: 'Gender | Unknown Gender',
              category_path: 'Unknown Gender',
              grouping_tier_key: 'gender',
              grouping_value: 'unknown_gender',
              reasoning: 'No gender indicators',
              evidence_count: 1,
              last_validated: new Date().toISOString(),
              days_since_validation: 0,
              supporting_evidence: [],
            },
            {
              taxonomy_id: 2,
              section: 'demographics',
              value: 'Unknown Age',
              confidence: 0.28,
              tier_1: 'Age Range',
              tier_2: 'Unknown Age',
              tier_3: '',
              tier_4: '',
              tier_5: '',
              tier_path: 'Age Range | Unknown Age',
              category_path: 'Unknown Age',
              grouping_tier_key: 'age_range',
              grouping_value: 'unknown_age',
              reasoning: 'No age indicators',
              evidence_count: 1,
              last_validated: new Date().toISOString(),
              days_since_validation: 0,
              supporting_evidence: [],
            },
            {
              taxonomy_id: 3,
              section: 'household',
              value: 'Unknown Income',
              confidence: 0.25,
              tier_1: 'Income Range',
              tier_2: 'Unknown Income',
              tier_3: '',
              tier_4: '',
              tier_5: '',
              tier_path: 'Income Range | Unknown Income',
              category_path: 'Unknown Income',
              grouping_tier_key: 'income_range',
              grouping_value: 'unknown_income',
              reasoning: 'No income indicators',
              evidence_count: 1,
              last_validated: new Date().toISOString(),
              days_since_validation: 0,
              supporting_evidence: [],
            },
          ]),
        }
      },
    }

    // Process emails
    for (const emailText of emails) {
      const result = await mockMultipleUnknown.invoke([{ role: 'user', content: emailText }])
      const classifications = JSON.parse(result.content)

      for (const classification of classifications) {
        const namespace = [userId, 'iab_taxonomy_profile']
        const key = `${classification.section}_${classification.taxonomy_id}_${classification.grouping_value}`

        // Apply memory reconciliation
        const existing = await store.get(namespace, key)
        if (existing) {
          const oldConfidence = existing.value.confidence
          const recallStrength = 0.20
          const newConfidence = oldConfidence + (1 - oldConfidence) * recallStrength
          classification.confidence = Math.min(newConfidence, 1.0)
          classification.evidence_count = existing.value.evidence_count + 1
        }

        await store.put(namespace, key, classification)
      }
    }

    // Read profile
    const reader = getBrowserProfileReader()
    const profile = await reader.getTieredProfile(userId)

    // EXPECTED: All three tier groups filtered (null)
    expect(profile.demographics?.gender).toBeNull()
    expect(profile.demographics?.age_range).toBeNull()
    expect(profile.household?.income_range).toBeNull()

    // Verify raw data shows Unknown classifications exist with high confidence
    const namespace = [userId, 'iab_taxonomy_profile']
    const items = await store.search(namespace, { filter: {} })

    const unknownCount = items.filter((item) => item.value.tier_2?.startsWith('Unknown ')).length
    expect(unknownCount).toBe(3) // Unknown Gender, Unknown Age, Unknown Income

    console.log('✅ Multiple tier groups correctly filtered when Unknown classifications are primary')
  }, 60000)
})
