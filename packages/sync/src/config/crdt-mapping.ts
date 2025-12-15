/**
 * CRDT Type Mapping - v13 Section 5.2.2
 *
 * Maps namespaces to appropriate CRDT types for conflict-free synchronization.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.2
 */

import type { CRDTType } from '../types.js';
import { NAMESPACES } from '@ownyou/shared-types';

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
  [NAMESPACES.EARNINGS]: 'g-counter',
  'ownyou.ikigai.points': 'g-counter',
  'ownyou.missions.completionCount': 'g-counter',
  [NAMESPACES.LLM_USAGE]: 'g-counter',

  // PN-Counter: Values that can increment/decrement
  'ownyou.token.balance': 'pn-counter',

  // OR-Set: Collections with add/remove
  [NAMESPACES.IAB_CLASSIFICATIONS]: 'or-set',
  'ownyou.missions.tags': 'or-set',
  'ownyou.sync.trustedPeers': 'or-set',
  'ownyou.missions.dismissed': 'or-set',
  [NAMESPACES.ENTITIES]: 'or-set',
  [NAMESPACES.RELATIONSHIPS]: 'or-set',
  [NAMESPACES.INTERESTS]: 'or-set',
  [NAMESPACES.RESTAURANT_FAVORITES]: 'or-set',
  [NAMESPACES.EVENT_FAVORITES]: 'or-set',

  // LWW-Register: Atomic fields where latest wins
  [NAMESPACES.SEMANTIC_MEMORY]: 'lww-register',
  'ownyou.preferences': 'lww-register',
  'ownyou.user.name': 'lww-register',
  'ownyou.notifications.settings': 'lww-register',
  'ownyou.sync.lastTimestamp': 'lww-register',
  [NAMESPACES.IKIGAI_PROFILE]: 'lww-register',
  [NAMESPACES.PROCEDURAL_MEMORY]: 'lww-register',
  [NAMESPACES.TRAVEL_PREFERENCES]: 'lww-register',
  [NAMESPACES.CALENDAR_PROFILE]: 'lww-register',
  [NAMESPACES.FINANCIAL_PROFILE]: 'lww-register',

  // LWW-Map: Maps where each key is independent LWW
  [NAMESPACES.MISSION_CARDS]: 'lww-map',
  [NAMESPACES.MISSION_FEEDBACK]: 'lww-map',
  'ownyou.dataSources.configs': 'lww-map',
  [NAMESPACES.EPISODIC_MEMORY]: 'lww-map',
  [NAMESPACES.DINING_RESERVATIONS]: 'lww-map',
  [NAMESPACES.EVENT_TICKETS]: 'lww-map',
  [NAMESPACES.TRAVEL_ITINERARIES]: 'lww-map',
  [NAMESPACES.CALENDAR]: 'lww-map',
  [NAMESPACES.CALENDAR_EVENTS]: 'lww-map',
  [NAMESPACES.FINANCIAL_TRANSACTIONS]: 'lww-map',
  [NAMESPACES.DIAGNOSTIC_REPORTS]: 'lww-map',
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
