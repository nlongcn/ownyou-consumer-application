/**
 * Index Exports Test
 *
 * Verifies that all types are properly exported from the main index.
 */
import { describe, it, expect } from 'vitest';
import * as SharedTypes from '../index';

describe('shared-types exports', () => {
  it('should export Memory types', () => {
    expect(SharedTypes).toHaveProperty('AGENT_LIMITS');
  });

  it('should export NAMESPACES constant', () => {
    expect(SharedTypes.NAMESPACES).toBeDefined();
    expect(SharedTypes.NAMESPACES.SEMANTIC_MEMORY).toBe('ownyou.semantic');
  });

  it('should export NS factory functions', () => {
    expect(SharedTypes.NS).toBeDefined();
    expect(typeof SharedTypes.NS.semanticMemory).toBe('function');
  });

  it('should export NAMESPACE_PRIVACY', () => {
    expect(SharedTypes.NAMESPACE_PRIVACY).toBeDefined();
  });

  it('should export NAMESPACE_SYNC_SCOPE', () => {
    expect(SharedTypes.NAMESPACE_SYNC_SCOPE).toBeDefined();
  });

  it('should export AGENT_LIMITS', () => {
    expect(SharedTypes.AGENT_LIMITS).toBeDefined();
    expect(SharedTypes.AGENT_LIMITS.L1).toBeDefined();
    expect(SharedTypes.AGENT_LIMITS.L2).toBeDefined();
    expect(SharedTypes.AGENT_LIMITS.L3).toBeDefined();
  });

  it('should export CONFLICT_STRATEGIES', () => {
    expect(SharedTypes.CONFLICT_STRATEGIES).toBeDefined();
  });
});
