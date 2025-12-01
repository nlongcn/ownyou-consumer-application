/**
 * IAB Classifier Agent Tests
 *
 * Validates IAB classification workflow with mock LLM responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createIABClassifier } from '@browser/agents/iab-classifier'
import { IndexedDBStore } from '@browser/store'
import { DataSource } from '@shared/types'

// Mock AnalyzerLLMClient to inject into workflow
class MockAnalyzerLLMClient {
  provider = 'mock'
  model = 'mock-model'

  async analyze_email(params: { prompt: string }) {
    console.log('MOCK analyze_email called with prompt:', params.prompt.substring(0, 50))
    const prompt = params.prompt.toLowerCase()
    
    let taxonomy_id = '25' // Shopping
    let value = 'Shopping'
    let confidence = 0.5

    if (prompt.includes('order') || prompt.includes('shipped') || prompt.includes('purchase') || prompt.includes('amazon')) {
      taxonomy_id = '25'
      value = 'Shopping'
      confidence = 0.95
    } else if (prompt.includes('bank') || prompt.includes('payment') || prompt.includes('transaction') || prompt.includes('chase')) {
      taxonomy_id = '13' // Personal Finance
      value = 'Personal Finance'
      confidence = 0.92
    } else if (prompt.includes('flight') || prompt.includes('hotel') || prompt.includes('booking') || prompt.includes('united')) {
      taxonomy_id = '29' // Travel
      value = 'Travel'
      confidence = 0.90
    }
    
    return {
      classifications: [{
        taxonomy_id,
        value,
        confidence,
        reasoning: `Classified based on keywords`,
        email_numbers: [1]
      }]
    }
  }

  async call_json(params: { prompt: string }) {
    console.log('MOCK call_json called (Evidence Judge)')
    return {
      quality_score: 0.9,
      issue: 'None',
      explanation: 'High quality evidence'
    }
  }
}

// Mock taxonomy tools
vi.mock('@browser/agents/iab-classifier/analyzers/tools', () => {
  return {
    lookupTaxonomyEntry: (id: string) => {
      console.log(`MOCK lookupTaxonomyEntry called with id: ${id}`)
      if (String(id) === '25') return { 
        tier_1: 'Shopping', 
        tier_2: 'Shopping',
        category_path: 'Shopping',
        grouping_tier_key: 'tier_1'
      }
      if (String(id) === '13') return { 
        tier_1: 'Personal Finance', 
        tier_2: 'Personal Finance',
        category_path: 'Personal Finance',
        grouping_tier_key: 'tier_1'
      }
      if (String(id) === '29') return { 
        tier_1: 'Travel', 
        tier_2: 'Travel',
        category_path: 'Travel',
        grouping_tier_key: 'tier_1'
      }
      return null
    },
    validateTaxonomyClassification: () => true,
    validateClassification: (id: number, value: string) => {
      console.log(`MOCK validateClassification called with id: ${id}, value: ${value}`)
      return {
        success: true,
        result: JSON.stringify({
          valid: true,
          taxonomy_id: id,
          value: value,
          tier_path: 'Shopping', // simplified
        })
      }
    },
    getTierDetails: (id: number) => {
       return {
        success: true,
        result: JSON.stringify({
          taxonomy_id: id,
          tier_1: 'Shopping',
          category_path: 'Shopping'
        })
      }
    }
  }
})

describe('IAB Classifier Agent', () => {
  let store: IndexedDBStore
  let classifier: any
  let mockLLM: MockAnalyzerLLMClient

  beforeEach(async () => {
    // Disable checkpointer to avoid PGlite crashes in test env
    store = new IndexedDBStore('test-iab-classifier')
    mockLLM = new MockAnalyzerLLMClient()
    
    classifier = createIABClassifier({
      checkpointer: undefined, // Disable checkpointer
      store,
    })
  })

  afterEach(() => {
    store?.stop()
    vi.clearAllMocks()
    const req = indexedDB.deleteDatabase('test-iab-classifier')
    req.onerror = () => console.error('Failed to delete test DB')
    req.onsuccess = () => {} 
  })

  it('should classify shopping-related text correctly', async () => {
    const result = await classifier.invoke({
      userId: 'user_123',
      source: DataSource.EMAIL,
      sourceItemId: 'email_1',
      text: 'Your Amazon order #12345 has been shipped! Track your delivery here.',
      llm_client: mockLLM // Inject mock client
    }, {
      configurable: { thread_id: 'test_shopping' }
    })
    
    if (!result.success) {
      console.error('Classification failed. Full result:', JSON.stringify(result, null, 2))
    }
    expect(result.success).toBe(true)
    expect(result.classification).toBeDefined()
    expect(result.classification?.category).toBe('Shopping') 
    expect(result.classification?.confidence).toBeGreaterThan(0.7)
    expect(result.classification?.userId).toBe('user_123')
  })

  it('should classify finance-related text correctly', async () => {
    const result = await classifier.invoke({
      userId: 'user_123',
      source: DataSource.EMAIL,
      sourceItemId: 'email_2',
      text: 'Your Chase Bank statement is ready. View your transactions here.',
      llm_client: mockLLM // Inject mock client
    }, {
      configurable: { thread_id: 'test_finance' }
    })

    expect(result.success).toBe(true)
    expect(result.classification?.category).toBe('Personal Finance')
    expect(result.classification?.confidence).toBeGreaterThan(0.7)
  })

  it('should classify travel-related text correctly', async () => {
    const result = await classifier.invoke({
      userId: 'user_123',
      source: DataSource.EMAIL,
      sourceItemId: 'email_3',
      text: 'Flight confirmation: SFO → JFK, June 15. Check-in now available.',
      llm_client: mockLLM // Inject mock client
    }, {
      configurable: { thread_id: 'test_travel' }
    })

    expect(result.success).toBe(true)
    expect(result.classification?.category).toBe('Travel')
    expect(result.classification?.confidence).toBeGreaterThan(0.7)
  })

  it('should store classification in IndexedDBStore', async () => {
    await classifier.invoke({
      userId: 'user_456',
      source: DataSource.EMAIL,
      sourceItemId: 'email_storage_test',
      text: 'Your order has been confirmed and will ship soon.',
      llm_client: mockLLM // Inject mock client
    }, {
      configurable: { thread_id: 'test_storage' }
    })

    // Verify stored in Store
    const stored = await store.search(['user_456', 'iab_classifications'], { limit: 100 })

    expect(stored.length).toBe(1)
    expect(stored[0].value.category).toBe('Shopping')
    expect(stored[0].key).toBe('email_email_storage_test')
  })
})

