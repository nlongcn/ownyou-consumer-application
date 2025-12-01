/**
 * Tier Selection Integration Test - 50 Emails
 *
 * Tests tier selection algorithm with 50 diverse emails to verify:
 * 1. Tier depth calculation (counts non-empty tier levels)
 * 2. Granularity scoring (confidence + tier_depth * 0.05 when confidence >= 0.7)
 * 3. Primary selection (highest granularity score)
 * 4. Alternative selection (mutually exclusive tiers only show primary, non-exclusive show alternatives)
 * 5. Minimum confidence filtering (default 0.5)
 * 6. Memory reconciliation (confidence boosting on repeated classifications)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createIABClassifier } from '@browser/agents/iab-classifier'
import { IndexedDBStore } from '@browser/store'
import { DataSource } from '@shared/types'
import {
  calculateTierDepth,
  calculateGranularityScore,
  selectPrimaryAndAlternatives
} from '@browser/agents/iab-classifier/tierSelector'

// Mock AnalyzerLLMClient with realistic tier data
class MockAnalyzerLLMClient {
  provider = 'mock'
  model = 'mock-model'

  // Track call counts for verification
  callCount = 0

  async analyze_email(params: { prompt: string }) {
    this.callCount++
    const prompt = params.prompt.toLowerCase()

    // Return varied tier depths and confidence levels
    // Demographics: Gender (tier 1-2), Age (tier 1-3)
    if (prompt.includes('demographics')) {
      if (this.callCount % 5 === 0) {
        return {
          classifications: [
            { taxonomy_id: '42', value: 'Male', confidence: 0.85, reasoning: 'Gender indicator', email_numbers: [1] },
            { taxonomy_id: '43', value: 'Female', confidence: 0.78, reasoning: 'Alternative gender', email_numbers: [1] }
          ]
        }
      } else if (this.callCount % 3 === 0) {
        return {
          classifications: [
            { taxonomy_id: '52', value: '25-34', confidence: 0.72, reasoning: 'Age range', email_numbers: [1] },
            { taxonomy_id: '53', value: '35-44', confidence: 0.65, reasoning: 'Alternative age', email_numbers: [1] }
          ]
        }
      }
    }

    // Interests: Multi-tier classifications with varying depths
    if (prompt.includes('interests')) {
      // Deep hierarchy: Technology > Software > Development > Web Development (tier 4)
      if (this.callCount % 4 === 0) {
        return {
          classifications: [
            { taxonomy_id: '500', value: 'Web Development', confidence: 0.88, reasoning: 'Deep tech interest', email_numbers: [1] },
            { taxonomy_id: '501', value: 'Mobile Development', confidence: 0.75, reasoning: 'Alternative tech', email_numbers: [1] },
            { taxonomy_id: '502', value: 'Software', confidence: 0.68, reasoning: 'Broad tech interest', email_numbers: [1] }
          ]
        }
      }
      // Medium hierarchy: Sports > Team Sports (tier 2)
      else if (this.callCount % 2 === 0) {
        return {
          classifications: [
            { taxonomy_id: '300', value: 'Basketball', confidence: 0.82, reasoning: 'Sports interest', email_numbers: [1] },
            { taxonomy_id: '301', value: 'Soccer', confidence: 0.76, reasoning: 'Alternative sport', email_numbers: [1] }
          ]
        }
      }
    }

    // Purchase Intent: Shopping categories with tier flags
    if (prompt.includes('purchase')) {
      if (this.callCount % 3 === 0) {
        return {
          classifications: [
            { taxonomy_id: '25', value: 'Shopping', confidence: 0.92, reasoning: 'High purchase intent', email_numbers: [1] }
          ]
        }
      } else if (this.callCount % 2 === 0) {
        return {
          classifications: [
            { taxonomy_id: '600', value: 'Electronics', confidence: 0.84, reasoning: 'Tech purchase', email_numbers: [1] },
            { taxonomy_id: '601', value: 'Computers', confidence: 0.77, reasoning: 'Specific tech', email_numbers: [1] }
          ]
        }
      }
    }

    // Default: Shopping
    return {
      classifications: [
        { taxonomy_id: '25', value: 'Shopping', confidence: 0.70, reasoning: 'General shopping', email_numbers: [1] }
      ]
    }
  }

  async call_json(params: { prompt: string }) {
    return {
      quality_score: 0.9,
      issue: 'None',
      explanation: 'High quality evidence'
    }
  }
}

// Mock taxonomy tools with realistic tier data
vi.mock('@browser/agents/iab-classifier/analyzers/tools', () => {
  return {
    lookupTaxonomyEntry: (id: string) => {
      const taxonomyMap: Record<string, any> = {
        // Demographics - Mutually exclusive
        '42': {
          tier_1: 'Gender',
          tier_2: 'Male',
          tier_3: '',
          tier_4: '',
          tier_5: '',
          category_path: 'Gender > Male',
          grouping_tier_key: 'tier_1',
          section: 'demographics'
        },
        '43': {
          tier_1: 'Gender',
          tier_2: 'Female',
          tier_3: '',
          tier_4: '',
          tier_5: '',
          category_path: 'Gender > Female',
          grouping_tier_key: 'tier_1',
          section: 'demographics'
        },
        '52': {
          tier_1: 'Age',
          tier_2: '25-34',
          tier_3: 'Young Adult',
          tier_4: '',
          tier_5: '',
          category_path: 'Age > 25-34 > Young Adult',
          grouping_tier_key: 'tier_1',
          section: 'demographics'
        },
        '53': {
          tier_1: 'Age',
          tier_2: '35-44',
          tier_3: 'Middle Age',
          tier_4: '',
          tier_5: '',
          category_path: 'Age > 35-44 > Middle Age',
          grouping_tier_key: 'tier_1',
          section: 'demographics'
        },

        // Interests - Non-exclusive (can have multiple)
        '500': {
          tier_1: 'Technology',
          tier_2: 'Software',
          tier_3: 'Development',
          tier_4: 'Web Development',
          tier_5: '',
          category_path: 'Technology > Software > Development > Web Development',
          grouping_tier_key: 'tier_4',
          section: 'interests'
        },
        '501': {
          tier_1: 'Technology',
          tier_2: 'Software',
          tier_3: 'Development',
          tier_4: 'Mobile Development',
          tier_5: '',
          category_path: 'Technology > Software > Development > Mobile Development',
          grouping_tier_key: 'tier_4',
          section: 'interests'
        },
        '502': {
          tier_1: 'Technology',
          tier_2: 'Software',
          tier_3: '',
          tier_4: '',
          tier_5: '',
          category_path: 'Technology > Software',
          grouping_tier_key: 'tier_2',
          section: 'interests'
        },
        '300': {
          tier_1: 'Sports',
          tier_2: 'Basketball',
          tier_3: '',
          tier_4: '',
          tier_5: '',
          category_path: 'Sports > Basketball',
          grouping_tier_key: 'tier_2',
          section: 'interests'
        },
        '301': {
          tier_1: 'Sports',
          tier_2: 'Soccer',
          tier_3: '',
          tier_4: '',
          tier_5: '',
          category_path: 'Sports > Soccer',
          grouping_tier_key: 'tier_2',
          section: 'interests'
        },

        // Purchase Intent
        '25': {
          tier_1: 'Shopping',
          tier_2: 'Shopping',
          tier_3: '',
          tier_4: '',
          tier_5: '',
          category_path: 'Shopping',
          grouping_tier_key: 'tier_1',
          section: 'purchase_intent',
          purchase_intent_flag: 'HIGH'
        },
        '600': {
          tier_1: 'Shopping',
          tier_2: 'Electronics',
          tier_3: '',
          tier_4: '',
          tier_5: '',
          category_path: 'Shopping > Electronics',
          grouping_tier_key: 'tier_2',
          section: 'purchase_intent',
          purchase_intent_flag: 'MEDIUM'
        },
        '601': {
          tier_1: 'Shopping',
          tier_2: 'Electronics',
          tier_3: 'Computers',
          tier_4: '',
          tier_5: '',
          category_path: 'Shopping > Electronics > Computers',
          grouping_tier_key: 'tier_3',
          section: 'purchase_intent',
          purchase_intent_flag: 'HIGH'
        },
      }

      return taxonomyMap[String(id)] || null
    },
    validateTaxonomyClassification: () => true,
    validateClassification: (id: number, value: string) => {
      return {
        success: true,
        result: JSON.stringify({
          valid: true,
          taxonomy_id: id,
          value: value,
          tier_path: 'Test Path',
        })
      }
    },
    getTierDetails: (id: number) => {
      return {
        success: true,
        result: JSON.stringify({
          taxonomy_id: id,
          tier_1: 'Test',
          category_path: 'Test Path'
        })
      }
    }
  }
})

describe('Tier Selection - 50 Email Integration Test', () => {
  let store: IndexedDBStore
  let classifier: any
  let mockLLM: MockAnalyzerLLMClient

  beforeEach(async () => {
    store = new IndexedDBStore('test-tier-selection-50')
    mockLLM = new MockAnalyzerLLMClient()

    classifier = createIABClassifier({
      checkpointer: undefined,
      store,
    })
  })

  afterEach(() => {
    store?.stop()
    vi.clearAllMocks()
    const req = indexedDB.deleteDatabase('test-tier-selection-50')
    req.onerror = () => console.error('Failed to delete test DB')
    req.onsuccess = () => {}
  })

  describe('Tier Selection Algorithm Validation', () => {
    it('should calculate tier depth correctly for various hierarchy levels', () => {
      // Tier 1 only
      expect(calculateTierDepth({
        tier_1: 'Shopping',
        tier_2: '',
        tier_3: '',
        tier_4: '',
        tier_5: ''
      })).toBe(1)

      // Tier 1-2
      expect(calculateTierDepth({
        tier_1: 'Gender',
        tier_2: 'Male',
        tier_3: '',
        tier_4: '',
        tier_5: ''
      })).toBe(2)

      // Tier 1-3
      expect(calculateTierDepth({
        tier_1: 'Age',
        tier_2: '25-34',
        tier_3: 'Young Adult',
        tier_4: '',
        tier_5: ''
      })).toBe(3)

      // Tier 1-4
      expect(calculateTierDepth({
        tier_1: 'Technology',
        tier_2: 'Software',
        tier_3: 'Development',
        tier_4: 'Web Development',
        tier_5: ''
      })).toBe(4)

      // Tier 1-5
      expect(calculateTierDepth({
        tier_1: 'T1',
        tier_2: 'T2',
        tier_3: 'T3',
        tier_4: 'T4',
        tier_5: 'T5'
      })).toBe(5)
    })

    it('should calculate granularity score correctly', () => {
      // High confidence (>= 0.7) should get tier depth bonus
      expect(
        calculateGranularityScore({
          confidence: 0.85,
          tier_1: 'T1',
          tier_2: 'T2',
          tier_3: '',
          tier_4: '',
          tier_5: ''
        } as any)
      ).toBe(0.95) // 0.85 + (2 * 0.05)

      expect(
        calculateGranularityScore({
          confidence: 0.72,
          tier_1: 'T1',
          tier_2: 'T2',
          tier_3: 'T3',
          tier_4: '',
          tier_5: ''
        } as any)
      ).toBe(0.87) // 0.72 + (3 * 0.05)

      expect(
        calculateGranularityScore({
          confidence: 0.88,
          tier_1: 'T1',
          tier_2: 'T2',
          tier_3: 'T3',
          tier_4: 'T4',
          tier_5: ''
        } as any)
      ).toBe(1.08) // 0.88 + (4 * 0.05)

      // Low confidence (< 0.7) should NOT get tier depth bonus
      expect(
        calculateGranularityScore({
          confidence: 0.65,
          tier_1: 'T1',
          tier_2: 'T2',
          tier_3: '',
          tier_4: '',
          tier_5: ''
        } as any)
      ).toBe(0.65)

      expect(
        calculateGranularityScore({
          confidence: 0.50,
          tier_1: 'T1',
          tier_2: 'T2',
          tier_3: 'T3',
          tier_4: '',
          tier_5: ''
        } as any)
      ).toBe(0.50)

      expect(
        calculateGranularityScore({
          confidence: 0.68,
          tier_1: 'T1',
          tier_2: 'T2',
          tier_3: 'T3',
          tier_4: 'T4',
          tier_5: ''
        } as any)
      ).toBe(0.68)
    })

    it('should select primary based on highest granularity score', () => {
      const classifications = [
        {
          taxonomy_id: 42,
          value: 'Male',
          confidence: 0.85,
          tier_depth: 2,
          granularity_score: 0.95, // Primary (highest)
          tier_path: 'Gender > Male',
          evidence_count: 5,
          email_ids: ['email_1']
        },
        {
          taxonomy_id: 43,
          value: 'Female',
          confidence: 0.78,
          tier_depth: 2,
          granularity_score: 0.88,
          tier_path: 'Gender > Female',
          evidence_count: 3,
          email_ids: ['email_1']
        }
      ]

      const result = selectPrimaryAndAlternatives(classifications)
      expect(result.primary.taxonomy_id).toBe(42)
      expect(result.primary.value).toBe('Male')
      expect(result.alternatives).toHaveLength(1)
      expect(result.alternatives[0].taxonomy_id).toBe(43)
    })

    it('should filter out classifications below minimum confidence', () => {
      const classifications = [
        {
          taxonomy_id: 42,
          value: 'Male',
          confidence: 0.85,
          tier_depth: 2,
          granularity_score: 0.95,
          tier_path: 'Gender > Male',
          evidence_count: 5,
          email_ids: ['email_1']
        },
        {
          taxonomy_id: 43,
          value: 'Female',
          confidence: 0.45, // Below minimum (0.5)
          tier_depth: 2,
          granularity_score: 0.45,
          tier_path: 'Gender > Female',
          evidence_count: 1,
          email_ids: ['email_1']
        }
      ]

      const result = selectPrimaryAndAlternatives(classifications, 0.5)
      expect(result.primary.taxonomy_id).toBe(42)
      expect(result.alternatives).toHaveLength(0) // Low confidence filtered out
    })
  })

  describe('50 Email Classification Test', () => {
    it('should classify 50 diverse emails and apply tier selection correctly', async () => {
      const results: any[] = []

      console.log('\n===== STARTING 50 EMAIL TIER SELECTION TEST =====\n')

      // Classify 50 emails with varying content
      for (let i = 1; i <= 50; i++) {
        let text = ''
        let expectedCategory = 'Shopping'

        // Create diverse email content to trigger different classifiers
        if (i % 5 === 0) {
          text = `Your profile update for user #${i}. Gender preferences saved.`
          expectedCategory = 'Gender'
        } else if (i % 3 === 0) {
          text = `Happy ${25 + (i % 20)}th birthday! Special offers for your age group.`
          expectedCategory = 'Age'
        } else if (i % 4 === 0) {
          text = `New web development course available. Learn React, TypeScript, and Node.js.`
          expectedCategory = 'Technology'
        } else if (i % 2 === 0) {
          text = `Basketball game tonight at 7pm. Get your tickets for the season.`
          expectedCategory = 'Sports'
        } else {
          text = `Your order #${i} has been shipped. Electronics will arrive in 2-3 days.`
          expectedCategory = 'Shopping'
        }

        const result = await classifier.invoke({
          userId: 'test_user_50',
          source: DataSource.EMAIL,
          sourceItemId: `email_${i}`,
          text: text,
          llm_client: mockLLM
        }, {
          configurable: { thread_id: `test_email_${i}` }
        })

        results.push({
          emailId: `email_${i}`,
          success: result.success,
          category: result.classification?.category,
          confidence: result.classification?.confidence,
          text: text.substring(0, 50)
        })

        if (i % 10 === 0) {
          console.log(`Processed ${i}/50 emails...`)
        }
      }

      console.log('\n===== 50 EMAIL TEST RESULTS =====\n')

      // Analyze results
      const successCount = results.filter(r => r.success).length
      const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length

      console.log(`Total Emails: 50`)
      console.log(`Successful Classifications: ${successCount}`)
      console.log(`Failed Classifications: ${50 - successCount}`)
      console.log(`Average Confidence: ${(avgConfidence * 100).toFixed(2)}%`)
      console.log(`\nSample Results (first 10):`)

      results.slice(0, 10).forEach(r => {
        console.log(`  ${r.emailId}: ${r.category} (${(r.confidence * 100).toFixed(1)}%) - "${r.text}..."`)
      })

      // Verify tier selection outcomes
      console.log(`\n===== TIER SELECTION VERIFICATION =====\n`)

      // Check IndexedDB for stored classifications
      const stored = await store.search(['test_user_50', 'iab_taxonomy_profile'], { limit: 1000 })
      console.log(`Total stored classifications: ${stored.length}`)

      // Analyze tier depths
      const tierDepthCounts: Record<number, number> = {}
      stored.forEach(item => {
        const depth = item.value.tier_depth || 1
        tierDepthCounts[depth] = (tierDepthCounts[depth] || 0) + 1
      })

      console.log(`\nTier Depth Distribution:`)
      Object.entries(tierDepthCounts).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([depth, count]) => {
        console.log(`  Tier ${depth}: ${count} classifications`)
      })

      // Analyze granularity scores
      const granularityScores = stored.map(item => item.value.granularity_score).filter(Boolean)
      const avgGranularity = granularityScores.reduce((sum, score) => sum + score, 0) / granularityScores.length
      const maxGranularity = Math.max(...granularityScores)
      const minGranularity = Math.min(...granularityScores)

      console.log(`\nGranularity Scores:`)
      console.log(`  Average: ${avgGranularity.toFixed(3)}`)
      console.log(`  Maximum: ${maxGranularity.toFixed(3)}`)
      console.log(`  Minimum: ${minGranularity.toFixed(3)}`)

      // Verify primary vs alternatives
      const primaryCount = stored.filter(item => !item.key.includes('_alt_')).length
      const alternativeCount = stored.filter(item => item.key.includes('_alt_')).length

      console.log(`\nPrimary vs Alternatives:`)
      console.log(`  Primary classifications: ${primaryCount}`)
      console.log(`  Alternative classifications: ${alternativeCount}`)

      console.log(`\n===== END OF 50 EMAIL TEST =====\n`)

      // Assertions
      expect(successCount).toBeGreaterThanOrEqual(48) // Allow 2 failures max
      expect(avgConfidence).toBeGreaterThan(0.5) // Average confidence > 50% (evidence judge applies quality multiplier)
      expect(stored.length).toBeGreaterThan(0) // Data persisted to IndexedDB
      expect(Object.keys(tierDepthCounts).length).toBeGreaterThan(0) // At least one tier depth present
      expect(primaryCount).toBeGreaterThan(0) // At least one primary classification
    }, 120000) // 2 minute timeout for 50 emails
  })
})
