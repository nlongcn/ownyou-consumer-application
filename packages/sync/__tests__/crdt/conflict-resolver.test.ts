/**
 * Conflict Resolver Tests
 */

import { describe, it, expect } from 'vitest';
import {
  resolveConflict,
  createInitialState,
  applyOperation,
  serializeState,
  deserializeState,
  getValue,
} from '../../src/crdt/conflict-resolver.js';
import * as GCounter from '../../src/crdt/g-counter.js';
import * as LWWRegister from '../../src/crdt/lww-register.js';
import * as ORSet from '../../src/crdt/or-set.js';
import * as LWWMap from '../../src/crdt/lww-map.js';

describe('Conflict Resolver', () => {
  describe('resolveConflict', () => {
    it('should resolve G-Counter conflicts (ownyou.earnings)', () => {
      let local = GCounter.createGCounter();
      local = GCounter.increment(local, 'device-1', 10);

      let remote = GCounter.createGCounter();
      remote = GCounter.increment(remote, 'device-2', 5);

      const result = resolveConflict('ownyou.earnings', local, remote);

      expect(result.crdtType).toBe('g-counter');
      expect(GCounter.getValue(result.mergedState as GCounter.GCounterState)).toBe(15);
    });

    it('should resolve LWW-Register conflicts (ownyou.semantic)', () => {
      const local = LWWRegister.createLWWRegister({ theme: 'dark' }, 'device-1');
      const remote = LWWRegister.createLWWRegister({ theme: 'light' }, 'device-2');

      const result = resolveConflict('ownyou.semantic', local, remote);

      expect(result.crdtType).toBe('lww-register');
      // Winner depends on timestamp
    });

    it('should resolve OR-Set conflicts (ownyou.iab)', () => {
      let local = ORSet.createORSet<string>();
      local = ORSet.add(local, 'IAB1-1', 'device-1');

      let remote = ORSet.createORSet<string>();
      remote = ORSet.add(remote, 'IAB2-3', 'device-2');

      const result = resolveConflict('ownyou.iab', local, remote);

      expect(result.crdtType).toBe('or-set');
      const values = ORSet.getValues(result.mergedState as ORSet.ORSetState<string>);
      expect(values).toContain('IAB1-1');
      expect(values).toContain('IAB2-3');
    });

    it('should resolve LWW-Map conflicts (ownyou.missions)', () => {
      let local = LWWMap.createLWWMap<{ status: string }>();
      local = LWWMap.set(local, 'mission-1', { status: 'completed' }, 'device-1');

      let remote = LWWMap.createLWWMap<{ status: string }>();
      remote = LWWMap.set(remote, 'mission-2', { status: 'active' }, 'device-2');

      const result = resolveConflict('ownyou.missions', local, remote);

      expect(result.crdtType).toBe('lww-map');
      const mergedMap = result.mergedState as LWWMap.LWWMapState<{ status: string }>;
      expect(LWWMap.has(mergedMap, 'mission-1')).toBe(true);
      expect(LWWMap.has(mergedMap, 'mission-2')).toBe(true);
    });

    it('should default unknown namespaces to LWW-Register', () => {
      const local = LWWRegister.createLWWRegister('value-1', 'device-1');
      const remote = LWWRegister.createLWWRegister('value-2', 'device-2');

      const result = resolveConflict('ownyou.unknown.namespace', local, remote);

      expect(result.crdtType).toBe('lww-register');
    });
  });

  describe('createInitialState', () => {
    it('should create G-Counter for earnings namespace', () => {
      const state = createInitialState('ownyou.earnings', undefined, 'device-1');
      expect(GCounter.getValue(state as GCounter.GCounterState)).toBe(0);
    });

    it('should create LWW-Register for semantic namespace', () => {
      const initialValue = { preference: 'test' };
      const state = createInitialState('ownyou.semantic', initialValue, 'device-1');
      expect(LWWRegister.getValue(state as LWWRegister.LWWRegisterState<unknown>)).toEqual(initialValue);
    });

    it('should create OR-Set for iab namespace', () => {
      const state = createInitialState('ownyou.iab', undefined, 'device-1');
      expect(ORSet.size(state as ORSet.ORSetState<unknown>)).toBe(0);
    });

    it('should create LWW-Map for missions namespace', () => {
      const state = createInitialState('ownyou.missions', undefined, 'device-1');
      expect(LWWMap.size(state as LWWMap.LWWMapState<unknown>)).toBe(0);
    });
  });

  describe('applyOperation', () => {
    it('should apply increment to G-Counter', () => {
      const state = createInitialState('ownyou.earnings', undefined, 'device-1');
      const newState = applyOperation(
        'ownyou.earnings',
        state,
        { type: 'increment', amount: 5 },
        'device-1'
      );

      expect(GCounter.getValue(newState as GCounter.GCounterState)).toBe(5);
    });

    it('should apply set to LWW-Register', () => {
      const state = createInitialState('ownyou.semantic', 'initial', 'device-1');
      // Use a timestamp that's definitely newer than the initial state
      const futureTimestamp = Date.now() + 1000;
      const newState = applyOperation(
        'ownyou.semantic',
        state,
        { type: 'set', value: 'updated', timestamp: futureTimestamp },
        'device-1'
      );

      expect(LWWRegister.getValue(newState as LWWRegister.LWWRegisterState<string>)).toBe('updated');
    });

    it('should apply add to OR-Set', () => {
      const state = createInitialState('ownyou.iab', undefined, 'device-1');
      const newState = applyOperation(
        'ownyou.iab',
        state,
        { type: 'add', value: 'IAB1-1' },
        'device-1'
      );

      expect(ORSet.has(newState as ORSet.ORSetState<string>, 'IAB1-1')).toBe(true);
    });

    it('should apply set to LWW-Map', () => {
      const state = createInitialState('ownyou.missions', undefined, 'device-1');
      const newState = applyOperation(
        'ownyou.missions',
        state,
        { type: 'set', key: 'mission-1', value: { status: 'active' } },
        'device-1'
      );

      expect(LWWMap.get(newState as LWWMap.LWWMapState<unknown>, 'mission-1')).toEqual({
        status: 'active',
      });
    });

    it('should throw for invalid operations', () => {
      const state = createInitialState('ownyou.earnings', undefined, 'device-1');

      expect(() =>
        applyOperation('ownyou.earnings', state, { type: 'set', value: 'invalid' }, 'device-1')
      ).toThrow();
    });
  });

  describe('serialize/deserialize', () => {
    it('should round-trip G-Counter state', () => {
      let state = GCounter.createGCounter();
      state = GCounter.increment(state, 'device-1', 5);

      const serialized = serializeState('ownyou.earnings', state);
      const deserialized = deserializeState('ownyou.earnings', serialized);

      expect(GCounter.getValue(deserialized as GCounter.GCounterState)).toBe(5);
    });

    it('should round-trip LWW-Register state', () => {
      const state = LWWRegister.createLWWRegister({ test: 'value' }, 'device-1');

      const serialized = serializeState('ownyou.semantic', state);
      const deserialized = deserializeState('ownyou.semantic', serialized);

      expect(LWWRegister.getValue(deserialized as LWWRegister.LWWRegisterState<unknown>)).toEqual({
        test: 'value',
      });
    });

    it('should round-trip OR-Set state', () => {
      let state = ORSet.createORSet<string>();
      state = ORSet.add(state, 'IAB1-1', 'device-1');

      const serialized = serializeState('ownyou.iab', state);
      const deserialized = deserializeState('ownyou.iab', serialized);

      expect(ORSet.has(deserialized as ORSet.ORSetState<string>, 'IAB1-1')).toBe(true);
    });

    it('should round-trip LWW-Map state', () => {
      let state = LWWMap.createLWWMap<{ status: string }>();
      state = LWWMap.set(state, 'mission-1', { status: 'active' }, 'device-1');

      const serialized = serializeState('ownyou.missions', state);
      const deserialized = deserializeState('ownyou.missions', serialized);

      expect(LWWMap.get(deserialized as LWWMap.LWWMapState<{ status: string }>, 'mission-1')).toEqual({
        status: 'active',
      });
    });
  });

  describe('getValue', () => {
    it('should get value from G-Counter', () => {
      let state = GCounter.createGCounter();
      state = GCounter.increment(state, 'device-1', 10);

      expect(getValue('ownyou.earnings', state)).toBe(10);
    });

    it('should get value from LWW-Register', () => {
      const state = LWWRegister.createLWWRegister({ theme: 'dark' }, 'device-1');

      expect(getValue('ownyou.semantic', state)).toEqual({ theme: 'dark' });
    });

    it('should get values from OR-Set', () => {
      let state = ORSet.createORSet<string>();
      state = ORSet.add(state, 'IAB1-1', 'device-1');
      state = ORSet.add(state, 'IAB2-3', 'device-1');

      const values = getValue('ownyou.iab', state) as string[];
      expect(values).toContain('IAB1-1');
      expect(values).toContain('IAB2-3');
    });

    it('should get entries from LWW-Map', () => {
      let state = LWWMap.createLWWMap<{ status: string }>();
      state = LWWMap.set(state, 'mission-1', { status: 'active' }, 'device-1');

      const entries = getValue('ownyou.missions', state) as Array<[string, { status: string }]>;
      expect(entries).toContainEqual(['mission-1', { status: 'active' }]);
    });
  });
});
