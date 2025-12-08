/**
 * CRDT Module Exports
 *
 * Conflict-free Replicated Data Types for synchronization.
 */

// Individual CRDT implementations
export * as GCounter from './g-counter.js';
export * as PNCounter from './pn-counter.js';
export * as ORSet from './or-set.js';
export * as LWWRegister from './lww-register.js';
export * as LWWMap from './lww-map.js';

// Conflict resolver
export {
  resolveConflict,
  createInitialState,
  applyOperation,
  serializeState,
  deserializeState,
  getValue,
  type CRDTOperation,
  type CRDTState,
  type ConflictResolutionResult,
} from './conflict-resolver.js';
