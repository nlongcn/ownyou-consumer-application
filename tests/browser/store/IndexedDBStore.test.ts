/**
 * IndexedDBStore Production Tests
 *
 * Validates the production IndexedDBStore implementation.
 * Based on research spike validation (100% pass rate).
 *
 * Test Coverage:
 * 1. Basic CRUD operations
 * 2. Namespace functionality
 * 3. Search & filtering
 * 4. Persistence (survive instance recreation)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IndexedDBStore } from '@browser/store'

describe('IndexedDBStore - Basic CRUD Operations', () => {
  let store: IndexedDBStore

  beforeEach(() => {
    store = new IndexedDBStore('test-crud')
  })

  afterEach(() => {
    store.stop()
  })

  it('should store and retrieve items correctly', async () => {
    // Store items
    await store.put(['user_123', 'preferences'], 'theme', { value: 'dark' })
    await store.put(['user_123', 'preferences'], 'language', { value: 'en' })
    await store.put(['user_123', 'iab_classifications'], 'shopping_1', {
      category: 'Shopping',
      confidence: 0.95,
    })

    // Retrieve items
    const theme = await store.get(['user_123', 'preferences'], 'theme')
    const shopping = await store.get(['user_123', 'iab_classifications'], 'shopping_1')

    expect(theme?.value.value).toBe('dark')
    expect(shopping?.value.category).toBe('Shopping')
    expect(shopping?.value.confidence).toBe(0.95)
  })

  it('should include timestamps on stored items', async () => {
    await store.put(['user_123', 'preferences'], 'theme', { value: 'dark' })

    const theme = await store.get(['user_123', 'preferences'], 'theme')

    expect(theme?.createdAt).toBeInstanceOf(Date)
    expect(theme?.updatedAt).toBeInstanceOf(Date)
  })

  it('should update items and preserve createdAt', async () => {
    // Store initial item
    await store.put(['user_123', 'preferences'], 'theme', { value: 'dark' })
    const initial = await store.get(['user_123', 'preferences'], 'theme')
    const originalCreatedAt = initial?.createdAt

    // Small delay to ensure updatedAt differs
    await new Promise(resolve => setTimeout(resolve, 10))

    // Update item
    await store.put(['user_123', 'preferences'], 'theme', { value: 'light' })
    const updated = await store.get(['user_123', 'preferences'], 'theme')

    expect(updated?.value.value).toBe('light')
    expect(updated?.createdAt?.getTime()).toBe(originalCreatedAt?.getTime())
    expect(updated?.updatedAt?.getTime()).toBeGreaterThan(updated?.createdAt?.getTime() || 0)
  })

  it('should delete items correctly', async () => {
    await store.put(['user_123', 'preferences'], 'language', { value: 'en' })

    await store.delete(['user_123', 'preferences'], 'language')

    const deleted = await store.get(['user_123', 'preferences'], 'language')
    expect(deleted).toBeNull()
  })
})

describe('IndexedDBStore - Namespace Functionality', () => {
  let store: IndexedDBStore

  beforeEach(() => {
    store = new IndexedDBStore('test-namespaces')
  })

  afterEach(() => {
    store.stop()
  })

  it('should support hierarchical namespaces', async () => {
    await store.put(['user_123', 'iab', 'shopping'], 'item_1', { name: 'Shopping Item 1' })
    await store.put(['user_123', 'iab', 'shopping'], 'item_2', { name: 'Shopping Item 2' })
    await store.put(['user_123', 'iab', 'finance'], 'item_3', { name: 'Finance Item 1' })
    await store.put(['user_456', 'iab', 'shopping'], 'item_4', { name: 'User 456 Shopping' })

    // Search by namespace prefix
    const user123IAB = await store.search(['user_123', 'iab'], { limit: 100 })
    const user123Shopping = await store.search(['user_123', 'iab', 'shopping'], { limit: 100 })
    const user456Items = await store.search(['user_456'], { limit: 100 })

    expect(user123IAB.length).toBe(3)
    expect(user123Shopping.length).toBe(2)
    expect(user456Items.length).toBe(1)
  })

  it('should list unique namespaces', async () => {
    await store.put(['user_123', 'iab', 'shopping'], 'item_1', { name: 'Shopping Item 1' })
    await store.put(['user_123', 'iab', 'finance'], 'item_2', { name: 'Finance Item 1' })
    await store.put(['user_456', 'iab', 'shopping'], 'item_3', { name: 'User 456 Shopping' })

    const namespaces = await store.listNamespaces()

    expect(namespaces.length).toBe(3)
  })
})

describe('IndexedDBStore - Search & Filtering', () => {
  let store: IndexedDBStore

  beforeEach(async () => {
    store = new IndexedDBStore('test-search')

    // Store test data
    await store.put(['user_123', 'classifications'], 'c1', {
      category: 'Shopping',
      confidence: 0.95,
      source: 'email',
    })
    await store.put(['user_123', 'classifications'], 'c2', {
      category: 'Finance',
      confidence: 0.85,
      source: 'transaction',
    })
    await store.put(['user_123', 'classifications'], 'c3', {
      category: 'Shopping',
      confidence: 0.75,
      source: 'email',
    })
    await store.put(['user_123', 'classifications'], 'c4', {
      category: 'Travel',
      confidence: 0.9,
      source: 'calendar',
    })
  })

  afterEach(() => {
    store.stop()
  })

  it('should filter by exact match', async () => {
    const shoppingItems = await store.search(['user_123', 'classifications'], {
      filter: { category: 'Shopping' },
      limit: 100,
    })

    expect(shoppingItems.length).toBe(2)
  })

  it('should filter with $gte operator', async () => {
    const highConfidence = await store.search(['user_123', 'classifications'], {
      filter: { confidence: { $gte: 0.85 } },
      limit: 100,
    })

    expect(highConfidence.length).toBe(3)
  })

  it('should support multiple filters', async () => {
    const filteredItems = await store.search(['user_123', 'classifications'], {
      filter: {
        category: 'Shopping',
        confidence: { $gte: 0.8 },
      },
      limit: 100,
    })

    expect(filteredItems.length).toBe(1)
  })

  it('should support pagination', async () => {
    const page1 = await store.search(['user_123', 'classifications'], { limit: 2, offset: 0 })
    const page2 = await store.search(['user_123', 'classifications'], { limit: 2, offset: 2 })

    expect(page1.length).toBe(2)
    expect(page2.length).toBe(2)
  })

  it('should return empty results for non-existent filters', async () => {
    const noResults = await store.search(['user_123', 'classifications'], {
      filter: { category: 'NonExistent' },
      limit: 100,
    })

    expect(noResults.length).toBe(0)
  })
})

describe('IndexedDBStore - Persistence', () => {
  it('should survive instance recreation', async () => {
    // First instance - store items
    const store1 = new IndexedDBStore('test-persistence')

    await store1.put(['user_123', 'data'], 'item_1', { value: 'Persistent Data 1' })
    await store1.put(['user_123', 'data'], 'item_2', { value: 'Persistent Data 2' })
    await store1.put(['user_123', 'data'], 'item_3', { value: 'Persistent Data 3' })

    const beforeRecreation = await store1.search(['user_123', 'data'], { limit: 100 })
    expect(beforeRecreation.length).toBe(3)

    store1.stop()

    // Second instance (simulating browser refresh)
    const store2 = new IndexedDBStore('test-persistence')

    const afterRecreation = await store2.search(['user_123', 'data'], { limit: 100 })
    expect(afterRecreation.length).toBe(3)

    // Verify item contents intact
    const item1 = await store2.get(['user_123', 'data'], 'item_1')
    expect(item1?.value.value).toBe('Persistent Data 1')

    store2.stop()
  })
})
