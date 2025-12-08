/**
 * Configuration Module Exports
 */

export {
  getCRDTType,
  supportsIncrement,
  supportsDecrement,
  supportsSetOperations,
  supportsMapOperations,
  CRDT_TYPE_BY_NAMESPACE,
} from './crdt-mapping.js';

export {
  shouldSyncNamespace,
  getSyncScopeConfig,
  shouldSyncItem,
  getSyncableNamespaces,
  getDeviceLocalNamespaces,
  SYNC_SCOPE_BY_NAMESPACE,
  EPISODIC_SYNC_RULES,
} from './sync-scope.js';
