/**
 * CRDT Type Mapping - v13 Section 5.2.2
 *
 * Maps namespaces to appropriate CRDT types for conflict-free synchronization.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.2
 */

import type { CRDTType } from '../types.js';

/**
 * Namespace to CRDT type mapping
 *
 * G-Counter: Values that only increment (earnings, points)
 * PN-Counter: Values that can increment/decrement (token balance)
 * OR-Set: Collections with add/remove (classifications, tags)
 * LWW-Register: Atomic fields where latest wins (preferences)
 * LWW-Map: Maps where each key is independent LWW (mission states)
 */
export const CRDT_TYPE_BY_NAMESPACE: Record<string, CRDTType> = {
  // G-Counter: Values that only increment
  'ownyou.earnings': 'g-counter',
  'ownyou.ikigai.points': 'g-counter',
  'ownyou.missions.completionCount': 'g-counter',
  'ownyou.llm_usage': 'g-counter',

  // PN-Counter: Values that can increment/decrement
  'ownyou.token.balance': 'pn-counter',

  // OR-Set: Collections with add/remove
  'ownyou.iab': 'or-set',
  'ownyou.missions.tags': 'or-set',
  'ownyou.sync.trustedPeers': 'or-set',
  'ownyou.missions.dismissed': 'or-set',
  'ownyou.entities': 'or-set',
  'ownyou.relationships': 'or-set',
  'ownyou.interests': 'or-set',
  'ownyou.restaurant_favorites': 'or-set',
  'ownyou.event_favorites': 'or-set',

  // LWW-Register: Atomic fields where latest wins
  'ownyou.semantic': 'lww-register',
  'ownyou.preferences': 'lww-register',
  'ownyou.user.name': 'lww-register',
  'ownyou.notifications.settings': 'lww-register',
  'ownyou.sync.lastTimestamp': 'lww-register',
  'ownyou.ikigai': 'lww-register',
  'ownyou.procedural': 'lww-register',
  'ownyou.travel_preferences': 'lww-register',
  'ownyou.calendar_profile': 'lww-register',
  'ownyou.financial_profile': 'lww-register',

  // LWW-Map: Maps where each key is independent LWW
  'ownyou.missions': 'lww-map',
  'ownyou.mission_feedback': 'lww-map',
  'ownyou.dataSources.configs': 'lww-map',
  'ownyou.episodic': 'lww-map',
  'ownyou.dining_reservations': 'lww-map',
  'ownyou.event_tickets': 'lww-map',
  'ownyou.travel_itineraries': 'lww-map',
  'ownyou.calendar': 'lww-map',
  'ownyou.calendar_events': 'lww-map',
  'ownyou.financial_transactions': 'lww-map',
  'ownyou.diagnostic_reports': 'lww-map',
};

/**
 * Get the CRDT type for a namespace
 *
 * @param namespace - The namespace to look up
 * @returns The CRDT type (defaults to 'lww-register' if not specified)
 */
export function getCRDTType(namespace: string): CRDTType {
  // Check for exact match first
  if (CRDT_TYPE_BY_NAMESPACE[namespace]) {
    return CRDT_TYPE_BY_NAMESPACE[namespace];
  }

  // Check for prefix match (e.g., 'ownyou.missions.xyz' matches 'ownyou.missions')
  const parts = namespace.split('.');
  while (parts.length > 1) {
    parts.pop();
    const prefix = parts.join('.');
    if (CRDT_TYPE_BY_NAMESPACE[prefix]) {
      return CRDT_TYPE_BY_NAMESPACE[prefix];
    }
  }

  // Default to LWW-Register for unknown namespaces
  return 'lww-register';
}

/**
 * Check if a CRDT type supports increment operations
 */
export function supportsIncrement(crdtType: CRDTType): boolean {
  return crdtType === 'g-counter' || crdtType === 'pn-counter';
}

/**
 * Check if a CRDT type supports decrement operations
 */
export function supportsDecrement(crdtType: CRDTType): boolean {
  return crdtType === 'pn-counter';
}

/**
 * Check if a CRDT type supports add/remove set operations
 */
export function supportsSetOperations(crdtType: CRDTType): boolean {
  return crdtType === 'or-set';
}

/**
 * Check if a CRDT type supports key-value operations
 */
export function supportsMapOperations(crdtType: CRDTType): boolean {
  return crdtType === 'lww-map';
}
