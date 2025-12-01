/**
 * Vitest Test Setup
 *
 * Configures test environment for OwnYou browser-based testing:
 * - fake-indexeddb for IndexedDB API mocking
 * - Global test utilities
 */

import 'fake-indexeddb/auto'

process.env.LANGCHAIN_TRACING_V2 = 'false'
process.env.LANGCHAIN_API_KEY = 'test'

// Global test setup
console.log('✅ Test environment configured with fake-indexeddb')
