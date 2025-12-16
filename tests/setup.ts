/**
 * Vitest Test Setup
 *
 * Configures test environment for OwnYou browser-based testing:
 * - fake-indexeddb for IndexedDB API mocking
 * - jest-dom matchers for DOM testing
 * - Browser API mocks (ResizeObserver, IntersectionObserver, localStorage, matchMedia)
 * - Global test utilities
 */

import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

process.env.LANGCHAIN_TRACING_V2 = 'false'
process.env.LANGCHAIN_API_KEY = 'test'

// Mock matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Global test setup
console.log('✅ Test environment configured with fake-indexeddb')
