/**
 * Circuit Breaker Configuration - v13 Section 6.11.1
 *
 * API configurations for circuit breaker protection.
 */

import type { ApiConfig } from '../types';

/**
 * API configurations per v13 Section 6.11.1
 *
 * All APIs from v13 included for future activation.
 */
export const API_CONFIGS: Record<string, ApiConfig> = {
  // Currently active APIs (Sprint 5)
  serpapi: {
    name: 'serpapi',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenRequests: 2,
    critical: false,
    retries: 2,
    timeoutMs: 5000,
  },
  rss: {
    name: 'rss',
    failureThreshold: 10,
    resetTimeoutMs: 30000,
    halfOpenRequests: 3,
    critical: false,
    retries: 3,
    timeoutMs: 10000,
  },

  // Sprint 7+ APIs (placeholders per v13 6.11.1)
  plaid: {
    name: 'plaid',
    failureThreshold: 3,
    resetTimeoutMs: 120000,
    halfOpenRequests: 1,
    critical: true,
    retries: 3,
    timeoutMs: 10000,
  },
  tripadvisor: {
    name: 'tripadvisor',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenRequests: 2,
    critical: false,
    retries: 2,
    timeoutMs: 5000,
  },
  ticketmaster: {
    name: 'ticketmaster',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenRequests: 2,
    critical: false,
    retries: 2,
    timeoutMs: 5000,
  },
  google_flights: {
    name: 'google_flights',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenRequests: 2,
    critical: false,
    retries: 2,
    timeoutMs: 8000,
  },
  yelp: {
    name: 'yelp',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenRequests: 2,
    critical: false,
    retries: 2,
    timeoutMs: 5000,
  },
  opentable: {
    name: 'opentable',
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenRequests: 2,
    critical: false,
    retries: 2,
    timeoutMs: 5000,
  },
};
