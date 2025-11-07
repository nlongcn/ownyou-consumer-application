/**
 * IAB Classifier Agent Tests
 *
 * Validates IAB classification workflow with mock LLM responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createIABClassifier } from '@browser/agents/iab-classifier'
import { createCheckpointer } from '@browser/checkpointer'
import { IndexedDBStore } from '@browser/store'
import { DataSource, IABCategory } from '@shared/types'

// Mock LLM that returns deterministic responses
class MockLLM {
  async invoke(prompt: string) {
    // Parse the input text from the prompt
    const textMatch = prompt.match(/Text to classify:\s*"""\s*([\s\S]*?)\s*"""/)
    const text = textMatch ? textMatch[1].toLowerCase() : ''

    // Simple keyword-based classification for testing
    let category = IABCategory.OTHER
    let confidence = 0.5

    if (text.includes('order') || text.includes('shipped') || text.includes('purchase')) {
      category = IABCategory.SHOPPING
      confidence = 0.95
    } else if (text.includes('bank') || text.includes('payment') || text.includes('transaction')) {
      category = IABCategory.FINANCE
      confidence = 0.92
    } else if (text.includes('flight') || text.includes('hotel') || text.includes('booking')) {
      category = IABCategory.TRAVEL
      confidence = 0.90
    }

    const response = {
      category,
      confidence,
      reasoning: `Classified based on keywords in: "${text.substring(0, 50)}..."`
    }

    return {
      content: JSON.stringify(response, null, 2)
    }
  }
}

describe('IAB Classifier Agent', () => {
  let checkpointer: any
  let store: IndexedDBStore
  let classifier: any

  beforeEach(async () => {
    checkpointer = await createCheckpointer('file://.pglite-test-iab')
    store = new IndexedDBStore('test-iab-classifier')
    classifier = createIABClassifier({
      checkpointer,
      store,
      llm: new MockLLM() as any,
    })
  })

  afterEach(() => {
    store.stop()
  })

  it('should classify shopping-related text correctly', async () => {
    const result = await classifier.invoke({
      userId: 'user_123',
      source: DataSource.EMAIL,
      sourceItemId: 'email_1',
      text: 'Your Amazon order #12345 has been shipped! Track your delivery here.',
    }, {
      configurable: { thread_id: 'test_shopping' }
    })

    expect(result.success).toBe(true)
    expect(result.classification).toBeDefined()
    expect(result.classification?.category).toBe(IABCategory.SHOPPING)
    expect(result.classification?.confidence).toBeGreaterThan(0.9)
    expect(result.classification?.userId).toBe('user_123')
    expect(result.classification?.source).toBe(DataSource.EMAIL)
  })

  it('should classify finance-related text correctly', async () => {
    const result = await classifier.invoke({
      userId: 'user_123',
      source: DataSource.EMAIL,
      sourceItemId: 'email_2',
      text: 'Your Chase Bank statement is ready. View your transactions here.',
    }, {
      configurable: { thread_id: 'test_finance' }
    })

    expect(result.success).toBe(true)
    expect(result.classification?.category).toBe(IABCategory.FINANCE)
    expect(result.classification?.confidence).toBeGreaterThan(0.9)
  })

  it('should classify travel-related text correctly', async () => {
    const result = await classifier.invoke({
      userId: 'user_123',
      source: DataSource.EMAIL,
      sourceItemId: 'email_3',
      text: 'Flight confirmation: SFO → JFK, June 15. Check-in now available.',
    }, {
      configurable: { thread_id: 'test_travel' }
    })

    expect(result.success).toBe(true)
    expect(result.classification?.category).toBe(IABCategory.TRAVEL)
    expect(result.classification?.confidence).toBeGreaterThan(0.85)
  })

  it('should store classification in IndexedDBStore', async () => {
    await classifier.invoke({
      userId: 'user_456',
      source: DataSource.EMAIL,
      sourceItemId: 'email_storage_test',
      text: 'Your order has been confirmed and will ship soon.',
    }, {
      configurable: { thread_id: 'test_storage' }
    })

    // Verify stored in Store
    const stored = await store.search(['user_456', 'iab_classifications'], { limit: 100 })

    expect(stored.length).toBe(1)
    expect(stored[0].value.category).toBe(IABCategory.SHOPPING)
    expect(stored[0].key).toBe('email_email_storage_test')
  })

  it('should handle multiple classifications for same user', async () => {
    const testEmails = [
      { id: 'email_1', text: 'Your order has shipped', expected: IABCategory.SHOPPING },
      { id: 'email_2', text: 'Your bank statement is ready', expected: IABCategory.FINANCE },
      { id: 'email_3', text: 'Flight booking confirmed', expected: IABCategory.TRAVEL },
    ]

    for (const email of testEmails) {
      await classifier.invoke({
        userId: 'user_multi',
        source: DataSource.EMAIL,
        sourceItemId: email.id,
        text: email.text,
      }, {
        configurable: { thread_id: `test_multi_${email.id}` }
      })
    }

    // Verify all stored
    const allClassifications = await store.search(['user_multi', 'iab_classifications'], {
      limit: 100
    })

    expect(allClassifications.length).toBe(3)

    // Verify categories
    const categories = allClassifications.map(c => c.value.category)
    expect(categories).toContain(IABCategory.SHOPPING)
    expect(categories).toContain(IABCategory.FINANCE)
    expect(categories).toContain(IABCategory.TRAVEL)
  })

  it('should include text preview in classification', async () => {
    const longText = 'A'.repeat(300) + ' Your order has shipped'

    const result = await classifier.invoke({
      userId: 'user_preview',
      source: DataSource.EMAIL,
      sourceItemId: 'email_preview',
      text: longText,
    }, {
      configurable: { thread_id: 'test_preview' }
    })

    expect(result.classification?.textPreview).toBeDefined()
    expect(result.classification?.textPreview?.length).toBeLessThanOrEqual(200)
  })

  it('should include timestamp in classification', async () => {
    const before = new Date().toISOString()

    const result = await classifier.invoke({
      userId: 'user_time',
      source: DataSource.EMAIL,
      sourceItemId: 'email_time',
      text: 'Your order has shipped',
    }, {
      configurable: { thread_id: 'test_time' }
    })

    const after = new Date().toISOString()

    expect(result.classification?.timestamp).toBeDefined()
    expect(result.classification?.timestamp! >= before).toBe(true)
    expect(result.classification?.timestamp! <= after).toBe(true)
  })

  it('should include reasoning in classification', async () => {
    const result = await classifier.invoke({
      userId: 'user_reasoning',
      source: DataSource.EMAIL,
      sourceItemId: 'email_reasoning',
      text: 'Your order has shipped',
    }, {
      configurable: { thread_id: 'test_reasoning' }
    })

    expect(result.classification?.reasoning).toBeDefined()
    expect(typeof result.classification?.reasoning).toBe('string')
  })
})

describe('IAB Classifier - Different Data Sources', () => {
  let checkpointer: any
  let store: IndexedDBStore
  let classifier: any

  beforeEach(async () => {
    checkpointer = await createCheckpointer('file://.pglite-test-iab-sources')
    store = new IndexedDBStore('test-iab-sources')
    classifier = createIABClassifier({
      checkpointer,
      store,
      llm: new MockLLM() as any,
    })
  })

  afterEach(() => {
    store.stop()
  })

  it('should handle transaction data source', async () => {
    const result = await classifier.invoke({
      userId: 'user_txn',
      source: DataSource.TRANSACTION,
      sourceItemId: 'txn_123',
      text: 'Payment to Amazon for $45.99',
    }, {
      configurable: { thread_id: 'test_txn' }
    })

    expect(result.success).toBe(true)
    expect(result.classification?.source).toBe(DataSource.TRANSACTION)
    expect(result.classification?.sourceItemId).toBe('txn_123')
  })

  it('should handle calendar data source', async () => {
    const result = await classifier.invoke({
      userId: 'user_cal',
      source: DataSource.CALENDAR,
      sourceItemId: 'cal_456',
      text: 'Flight to New York - United Airlines',
    }, {
      configurable: { thread_id: 'test_cal' }
    })

    expect(result.success).toBe(true)
    expect(result.classification?.source).toBe(DataSource.CALENDAR)
    expect(result.classification?.category).toBe(IABCategory.TRAVEL)
  })
})
