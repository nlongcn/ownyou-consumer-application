/**
 * Conflict Resolver - v13 Section 5.2.2
 *
 * Routes data to appropriate CRDT type based on namespace and handles merging.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.2
 */

import type {
  CRDTType,
  CRDTMergeResult,
  GCounterState,
  PNCounterState,
  ORSetState,
  LWWRegisterState,
  LWWMapState,
} from '../types.js';
import { getCRDTType } from '../config/crdt-mapping.js';
import * as GCounter from './g-counter.js';
import * as PNCounter from './pn-counter.js';
import * as ORSet from './or-set.js';
import * as LWWRegister from './lww-register.js';
import * as LWWMap from './lww-map.js';

/**
 * Union type for all CRDT states
 */
export type CRDTState =
  | GCounterState
  | PNCounterState
  | ORSetState<unknown>
  | LWWRegisterState<unknown>
  | LWWMapState<unknown>;

/**
 * Conflict resolution result with metadata
 */
export interface ConflictResolutionResult {
  /** Merged state */
  mergedState: CRDTState;
  /** Whether a conflict was detected */
  hadConflict: boolean;
  /** CRDT type used for resolution */
  crdtType: CRDTType;
  /** Winning device ID if applicable */
  winningDeviceId?: string;
  /** Timestamp of resolution */
  resolvedAt: number;
}

/**
 * Resolve conflicts between local and remote states for a namespace
 *
 * @param namespace - The namespace to resolve
 * @param localState - Local CRDT state
 * @param remoteState - Remote CRDT state
 * @returns Resolution result
 */
export function resolveConflict(
  namespace: string,
  localState: CRDTState,
  remoteState: CRDTState
): ConflictResolutionResult {
  const crdtType = getCRDTType(namespace);
  const resolvedAt = Date.now();

  switch (crdtType) {
    case 'g-counter': {
      const result = GCounter.merge(
        localState as GCounterState,
        remoteState as GCounterState
      );
      return {
        mergedState: result.value,
        hadConflict: result.hadConflict,
        crdtType,
        resolvedAt,
      };
    }

    case 'pn-counter': {
      const result = PNCounter.merge(
        localState as PNCounterState,
        remoteState as PNCounterState
      );
      return {
        mergedState: result.value,
        hadConflict: result.hadConflict,
        crdtType,
        resolvedAt,
      };
    }

    case 'or-set': {
      const result = ORSet.merge(
        localState as ORSetState<unknown>,
        remoteState as ORSetState<unknown>
      );
      return {
        mergedState: result.value,
        hadConflict: result.hadConflict,
        crdtType,
        resolvedAt,
      };
    }

    case 'lww-register': {
      const result = LWWRegister.merge(
        localState as LWWRegisterState<unknown>,
        remoteState as LWWRegisterState<unknown>
      );
      return {
        mergedState: result.value,
        hadConflict: result.hadConflict,
        crdtType,
        winningDeviceId: result.winningDeviceId,
        resolvedAt,
      };
    }

    case 'lww-map': {
      const result = LWWMap.merge(
        localState as LWWMapState<unknown>,
        remoteState as LWWMapState<unknown>
      );
      return {
        mergedState: result.value,
        hadConflict: result.hadConflict,
        crdtType,
        resolvedAt,
      };
    }

    default:
      throw new Error(`Unknown CRDT type: ${crdtType}`);
  }
}

/**
 * Create an initial state for a namespace
 *
 * @param namespace - The namespace
 * @param initialValue - Optional initial value
 * @param deviceId - Device creating the state
 * @returns Initial CRDT state
 */
export function createInitialState(
  namespace: string,
  initialValue: unknown,
  deviceId: string
): CRDTState {
  const crdtType = getCRDTType(namespace);

  switch (crdtType) {
    case 'g-counter':
      return GCounter.createGCounter();

    case 'pn-counter':
      return PNCounter.createPNCounter();

    case 'or-set':
      return ORSet.createORSet();

    case 'lww-register':
      return LWWRegister.createLWWRegister(initialValue, deviceId);

    case 'lww-map':
      return LWWMap.createLWWMap();

    default:
      throw new Error(`Unknown CRDT type: ${crdtType}`);
  }
}

/**
 * Apply an operation to a CRDT state
 *
 * @param namespace - The namespace
 * @param state - Current state
 * @param operation - Operation to apply
 * @param deviceId - Device performing the operation
 * @returns Updated state
 */
export function applyOperation(
  namespace: string,
  state: CRDTState,
  operation: CRDTOperation,
  deviceId: string
): CRDTState {
  const crdtType = getCRDTType(namespace);

  switch (crdtType) {
    case 'g-counter': {
      if (operation.type !== 'increment') {
        throw new Error('G-Counter only supports increment operations');
      }
      return GCounter.increment(
        state as GCounterState,
        deviceId,
        operation.amount ?? 1
      );
    }

    case 'pn-counter': {
      const pnState = state as PNCounterState;
      if (operation.type === 'increment') {
        return PNCounter.increment(pnState, deviceId, operation.amount ?? 1);
      } else if (operation.type === 'decrement') {
        return PNCounter.decrement(pnState, deviceId, operation.amount ?? 1);
      }
      throw new Error('PN-Counter only supports increment/decrement operations');
    }

    case 'or-set': {
      const setState = state as ORSetState<unknown>;
      if (operation.type === 'add') {
        return ORSet.add(setState, operation.value, deviceId);
      } else if (operation.type === 'remove') {
        return ORSet.remove(setState, operation.value);
      }
      throw new Error('OR-Set only supports add/remove operations');
    }

    case 'lww-register': {
      if (operation.type !== 'set') {
        throw new Error('LWW-Register only supports set operations');
      }
      return LWWRegister.set(
        state as LWWRegisterState<unknown>,
        operation.value,
        deviceId,
        operation.timestamp
      );
    }

    case 'lww-map': {
      const mapState = state as LWWMapState<unknown>;
      if (operation.type === 'set') {
        if (!operation.key) {
          throw new Error('LWW-Map set operation requires a key');
        }
        return LWWMap.set(
          mapState,
          operation.key,
          operation.value,
          deviceId,
          operation.timestamp
        );
      } else if (operation.type === 'remove') {
        if (!operation.key) {
          throw new Error('LWW-Map remove operation requires a key');
        }
        return LWWMap.remove(mapState, operation.key, deviceId);
      }
      throw new Error('LWW-Map only supports set/remove operations');
    }

    default:
      throw new Error(`Unknown CRDT type: ${crdtType}`);
  }
}

/**
 * CRDT operation types
 */
export interface CRDTOperation {
  type: 'increment' | 'decrement' | 'add' | 'remove' | 'set';
  value?: unknown;
  key?: string;
  amount?: number;
  timestamp?: number;
}

/**
 * Serialize a CRDT state for storage/transmission
 */
export function serializeState(namespace: string, state: CRDTState): string {
  const crdtType = getCRDTType(namespace);

  switch (crdtType) {
    case 'g-counter':
      return GCounter.serialize(state as GCounterState);
    case 'pn-counter':
      return PNCounter.serialize(state as PNCounterState);
    case 'or-set':
      return ORSet.serialize(state as ORSetState<unknown>);
    case 'lww-register':
      return LWWRegister.serialize(state as LWWRegisterState<unknown>);
    case 'lww-map':
      return LWWMap.serialize(state as LWWMapState<unknown>);
    default:
      throw new Error(`Unknown CRDT type: ${crdtType}`);
  }
}

/**
 * Deserialize a CRDT state from storage/transmission
 */
export function deserializeState(namespace: string, data: string): CRDTState {
  const crdtType = getCRDTType(namespace);

  switch (crdtType) {
    case 'g-counter':
      return GCounter.deserialize(data);
    case 'pn-counter':
      return PNCounter.deserialize(data);
    case 'or-set':
      return ORSet.deserialize(data);
    case 'lww-register':
      return LWWRegister.deserialize(data);
    case 'lww-map':
      return LWWMap.deserialize(data);
    default:
      throw new Error(`Unknown CRDT type: ${crdtType}`);
  }
}

/**
 * Get the value from a CRDT state
 */
export function getValue(namespace: string, state: CRDTState): unknown {
  const crdtType = getCRDTType(namespace);

  switch (crdtType) {
    case 'g-counter':
      return GCounter.getValue(state as GCounterState);
    case 'pn-counter':
      return PNCounter.getValue(state as PNCounterState);
    case 'or-set':
      return ORSet.getValues(state as ORSetState<unknown>);
    case 'lww-register':
      return LWWRegister.getValue(state as LWWRegisterState<unknown>);
    case 'lww-map':
      return LWWMap.entries(state as LWWMapState<unknown>);
    default:
      throw new Error(`Unknown CRDT type: ${crdtType}`);
  }
}
