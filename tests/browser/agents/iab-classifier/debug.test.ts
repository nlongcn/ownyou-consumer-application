
import { describe, it, expect } from 'vitest'
import { createCheckpointer } from '@browser/checkpointer'
import { IndexedDBStore } from '@browser/store'

describe('Debug Dependencies', () => {
  it('should initialize IndexedDBStore', () => {
    const store = new IndexedDBStore('debug-store')
    expect(store).toBeDefined()
    store.stop()
  })

  it('should initialize createCheckpointer', async () => {
    try {
      const checkpointer = await createCheckpointer('file://.pglite-debug')
      expect(checkpointer).toBeDefined()
    } catch (error) {
      console.error('createCheckpointer failed:', error)
      throw error
    }
  })
})
