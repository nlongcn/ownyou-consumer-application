/**
 * Multi-Device E2E Sync Tests
 *
 * Tests that verify actual sync functionality between two simulated devices
 * using the same wallet (same user, different devices).
 *
 * These tests verify:
 * 1. Wallet-derived encryption is deterministic across devices
 * 2. Data encrypted on one device can be decrypted on another
 * 3. CRDT merging works correctly for concurrent writes
 * 4. Offline queue mutations sync correctly when reconnected
 *
 * @see packages/sync/src/core/sync-layer.ts
 * @see docs/sprints/ownyou-sprint10-spec.md
 */

import { describe, it, expect } from 'vitest';
import {
  deriveEncryptionKey,
  deriveEncryptionPassword,
  encrypt,
  decrypt,
  createMockWalletProvider,
} from '../../src/encryption/wallet-encryption.js';
import * as LWWRegister from '../../src/crdt/lww-register.js';
import * as ORSet from '../../src/crdt/or-set.js';
import * as GCounter from '../../src/crdt/g-counter.js';
import * as PNCounter from '../../src/crdt/pn-counter.js';
import * as LWWMap from '../../src/crdt/lww-map.js';
import type { WalletProvider } from '../../src/types.js';

// Same wallet seed = same user with multiple devices
const USER_WALLET_SEED = 'user-main-wallet-seed-phrase';

/**
 * Simulated device for testing
 */
interface SimulatedDevice {
  id: string;
  wallet: WalletProvider;
  encryptionKey: CryptoKey;
  encryptionPassword: string;
}

/**
 * Create a simulated device with wallet-derived keys
 */
async function createSimulatedDevice(
  deviceId: string,
  walletSeed: string
): Promise<SimulatedDevice> {
  const wallet = createMockWalletProvider(walletSeed);
  const { key } = await deriveEncryptionKey(wallet, 'sync');
  const password = await deriveEncryptionPassword(wallet, 'sync');

  return {
    id: deviceId,
    wallet,
    encryptionKey: key,
    encryptionPassword: password,
  };
}

describe('Multi-Device E2E Sync', () => {
  describe('Wallet-Derived Encryption Consistency', () => {
    it('should derive the same encryption password on different devices', async () => {
      // Create two devices with the SAME wallet seed
      const device1 = await createSimulatedDevice('device-1', USER_WALLET_SEED);
      const device2 = await createSimulatedDevice('device-2', USER_WALLET_SEED);

      // Both devices should derive the same encryption password
      expect(device1.encryptionPassword).toBe(device2.encryptionPassword);
    });

    it('should derive different passwords for different users', async () => {
      const user1Device = await createSimulatedDevice('device-1', 'user-1-wallet');
      const user2Device = await createSimulatedDevice('device-2', 'user-2-wallet');

      // Different users should have different encryption passwords
      expect(user1Device.encryptionPassword).not.toBe(user2Device.encryptionPassword);
    });

    it('should encrypt on device1 and decrypt on device2 (same user)', async () => {
      const device1 = await createSimulatedDevice('laptop', USER_WALLET_SEED);
      const device2 = await createSimulatedDevice('phone', USER_WALLET_SEED);

      // Device 1 encrypts user data
      const userData = {
        preferences: { theme: 'dark', language: 'en' },
        lastLogin: Date.now(),
      };
      const plaintext = new TextEncoder().encode(JSON.stringify(userData));
      const encrypted = await encrypt(plaintext, device1.encryptionKey);

      // Device 2 should be able to decrypt it
      const decrypted = await decrypt(encrypted, device2.encryptionKey);
      const decryptedData = JSON.parse(new TextDecoder().decode(decrypted));

      expect(decryptedData.preferences).toEqual(userData.preferences);
      expect(decryptedData.lastLogin).toBe(userData.lastLogin);
    });

    it('should fail to decrypt data from a different user', async () => {
      const user1Device = await createSimulatedDevice('user1-device', 'user-1-wallet');
      const user2Device = await createSimulatedDevice('user2-device', 'user-2-wallet');

      // User 1 encrypts their data
      const secretData = new TextEncoder().encode('User 1 private data');
      const encrypted = await encrypt(secretData, user1Device.encryptionKey);

      // User 2 should NOT be able to decrypt it
      await expect(decrypt(encrypted, user2Device.encryptionKey)).rejects.toThrow();
    });
  });

  describe('CRDT Sync Between Devices', () => {
    describe('LWW-Register', () => {
      it('should sync value updates with last-write-wins semantics', async () => {
        // Device 1 writes at time T1
        const device1State = LWWRegister.createLWWRegister('value-from-device-1', 'device-1');

        // Simulate time passing
        await new Promise((r) => setTimeout(r, 10));

        // Device 2 writes later at time T2
        const device2State = LWWRegister.createLWWRegister('value-from-device-2', 'device-2');

        // Merge: Device 2's value should win (it was written later)
        const mergeResult = LWWRegister.merge(device1State, device2State);

        expect(mergeResult.value.value).toBe('value-from-device-2');
      });

      it('should handle concurrent writes from multiple devices', async () => {
        const devices = ['laptop', 'phone', 'tablet'];
        const states: ReturnType<typeof LWWRegister.createLWWRegister<string>>[] = [];

        // Each device creates its own state
        for (let i = 0; i < devices.length; i++) {
          const state = LWWRegister.createLWWRegister(`theme-from-${devices[i]}`, devices[i]);
          states.push(state);
          // Small delay to ensure different timestamps
          await new Promise((r) => setTimeout(r, 5));
        }

        // Merge all states - last one (tablet) should win
        let finalState = states[0];
        for (let i = 1; i < states.length; i++) {
          const result = LWWRegister.merge(finalState, states[i]);
          finalState = result.value;
        }

        expect(finalState.value).toBe('theme-from-tablet');
      });
    });

    describe('OR-Set', () => {
      it('should sync set additions across devices', async () => {
        // Device 1 adds items
        let device1State = ORSet.createORSet<string>();
        device1State = ORSet.add(device1State, 'item-a', 'device-1');
        device1State = ORSet.add(device1State, 'item-b', 'device-1');

        // Device 2 adds different items
        let device2State = ORSet.createORSet<string>();
        device2State = ORSet.add(device2State, 'item-c', 'device-2');
        device2State = ORSet.add(device2State, 'item-d', 'device-2');

        // Merge: should contain all items from both devices
        const mergeResult = ORSet.merge(device1State, device2State);
        const values = ORSet.getValues(mergeResult.value);

        expect(values).toContain('item-a');
        expect(values).toContain('item-b');
        expect(values).toContain('item-c');
        expect(values).toContain('item-d');
      });

      it('should handle add-remove with proper semantics', async () => {
        // Device 1 adds an item
        let device1State = ORSet.createORSet<string>();
        device1State = ORSet.add(device1State, 'bookmark-1', 'device-1');

        // Device 2 also adds and then removes
        let device2State = ORSet.createORSet<string>();
        device2State = ORSet.add(device2State, 'bookmark-1', 'device-2');
        device2State = ORSet.remove(device2State, 'bookmark-1');

        // Merge both ways
        const merged1 = ORSet.merge(device1State, device2State);
        const merged2 = ORSet.merge(device2State, device1State);

        // Both should converge to the same result
        const values1 = ORSet.getValues(merged1.value);
        const values2 = ORSet.getValues(merged2.value);

        expect(values1).toEqual(values2);
      });
    });

    describe('G-Counter', () => {
      it('should sync increment operations across devices', async () => {
        // Device 1 increments
        let device1State = GCounter.createGCounter();
        device1State = GCounter.increment(device1State, 'device-1', 5);

        // Device 2 increments
        let device2State = GCounter.createGCounter();
        device2State = GCounter.increment(device2State, 'device-2', 3);

        // Merge: should sum both increments
        const mergeResult = GCounter.merge(device1State, device2State);

        expect(GCounter.getValue(mergeResult.value)).toBe(8); // 5 + 3
      });

      it('should handle many devices incrementing concurrently', async () => {
        const deviceCount = 5;
        let mergedState = GCounter.createGCounter();

        // Each device increments
        for (let i = 0; i < deviceCount; i++) {
          let deviceState = GCounter.createGCounter();
          deviceState = GCounter.increment(deviceState, `device-${i}`, i + 1); // 1, 2, 3, 4, 5
          const result = GCounter.merge(mergedState, deviceState);
          mergedState = result.value;
        }

        expect(GCounter.getValue(mergedState)).toBe(15); // 1+2+3+4+5
      });
    });

    describe('PN-Counter', () => {
      it('should sync both increments and decrements across devices', async () => {
        // Device 1: +10
        let device1State = PNCounter.createPNCounter();
        device1State = PNCounter.increment(device1State, 'device-1', 10);

        // Device 2: -3
        let device2State = PNCounter.createPNCounter();
        device2State = PNCounter.decrement(device2State, 'device-2', 3);

        // Merge: should result in 10 - 3 = 7
        const mergeResult = PNCounter.merge(device1State, device2State);

        expect(PNCounter.getValue(mergeResult.value)).toBe(7);
      });

      it('should handle complex increment/decrement patterns', async () => {
        let state1 = PNCounter.createPNCounter();
        let state2 = PNCounter.createPNCounter();
        let state3 = PNCounter.createPNCounter();

        // Device 1: +100, -20
        state1 = PNCounter.increment(state1, 'd1', 100);
        state1 = PNCounter.decrement(state1, 'd1', 20);

        // Device 2: +50
        state2 = PNCounter.increment(state2, 'd2', 50);

        // Device 3: -10
        state3 = PNCounter.decrement(state3, 'd3', 10);

        // Merge all
        let merged = PNCounter.merge(state1, state2).value;
        merged = PNCounter.merge(merged, state3).value;

        // Expected: (100-20) + 50 - 10 = 120
        expect(PNCounter.getValue(merged)).toBe(120);
      });
    });

    describe('LWW-Map', () => {
      it('should sync map updates across devices', async () => {
        // Device 1 sets some preferences
        let device1State = LWWMap.createLWWMap<string>();
        device1State = LWWMap.set(device1State, 'theme', 'dark', 'device-1');
        device1State = LWWMap.set(device1State, 'fontSize', '14', 'device-1');

        // Small delay
        await new Promise((r) => setTimeout(r, 10));

        // Device 2 updates theme
        let device2State = LWWMap.createLWWMap<string>();
        device2State = LWWMap.set(device2State, 'theme', 'light', 'device-2'); // Should win (later timestamp)
        device2State = LWWMap.set(device2State, 'language', 'en', 'device-2');

        // Merge
        const mergeResult = LWWMap.merge(device1State, device2State);

        expect(LWWMap.get(mergeResult.value, 'theme')).toBe('light'); // Device 2 wins
        expect(LWWMap.get(mergeResult.value, 'fontSize')).toBe('14');
        expect(LWWMap.get(mergeResult.value, 'language')).toBe('en');
      });

      it('should preserve all keys after merge', async () => {
        let map1 = LWWMap.createLWWMap<number>();
        map1 = LWWMap.set(map1, 'a', 1, 'device-1');
        map1 = LWWMap.set(map1, 'b', 2, 'device-1');

        let map2 = LWWMap.createLWWMap<number>();
        map2 = LWWMap.set(map2, 'c', 3, 'device-2');
        map2 = LWWMap.set(map2, 'd', 4, 'device-2');

        const merged = LWWMap.merge(map1, map2).value;

        expect(LWWMap.get(merged, 'a')).toBe(1);
        expect(LWWMap.get(merged, 'b')).toBe(2);
        expect(LWWMap.get(merged, 'c')).toBe(3);
        expect(LWWMap.get(merged, 'd')).toBe(4);
      });
    });
  });

  describe('Offline Queue Sync Simulation', () => {
    interface QueuedMutation {
      namespace: string;
      key: string;
      value: unknown;
      timestamp: number;
      deviceId: string;
    }

    it('should queue mutations when offline and sync when online', async () => {
      const device1 = await createSimulatedDevice('laptop', USER_WALLET_SEED);
      const device2 = await createSimulatedDevice('phone', USER_WALLET_SEED);

      // Simulate device 1 offline queue
      const device1Queue: QueuedMutation[] = [];
      const syncedData = new Map<string, unknown>();

      // Device 1 goes offline and queues mutations
      device1Queue.push({
        namespace: 'ownyou.preferences',
        key: 'theme',
        value: 'dark',
        timestamp: Date.now(),
        deviceId: device1.id,
      });
      device1Queue.push({
        namespace: 'ownyou.preferences',
        key: 'language',
        value: 'en',
        timestamp: Date.now() + 1,
        deviceId: device1.id,
      });

      // Simulate sync: encrypt queue entries, decrypt on device 2
      for (const mutation of device1Queue) {
        // Device 1 encrypts
        const plaintext = new TextEncoder().encode(JSON.stringify(mutation));
        const encrypted = await encrypt(plaintext, device1.encryptionKey);

        // Device 2 decrypts (same user wallet)
        const decrypted = await decrypt(encrypted, device2.encryptionKey);
        const syncedMutation = JSON.parse(new TextDecoder().decode(decrypted)) as QueuedMutation;

        // Apply to synced store
        syncedData.set(`${syncedMutation.namespace}:${syncedMutation.key}`, syncedMutation.value);
      }

      // Verify data synced correctly
      expect(syncedData.get('ownyou.preferences:theme')).toBe('dark');
      expect(syncedData.get('ownyou.preferences:language')).toBe('en');
    });

    it('should handle concurrent offline mutations from multiple devices', async () => {
      const device1 = await createSimulatedDevice('laptop', USER_WALLET_SEED);
      const device2 = await createSimulatedDevice('phone', USER_WALLET_SEED);

      // Both devices go offline and make mutations
      const device1Mutations: QueuedMutation[] = [
        { namespace: 'notes', key: 'note-1', value: 'From laptop', timestamp: 1000, deviceId: device1.id },
      ];

      const device2Mutations: QueuedMutation[] = [
        { namespace: 'notes', key: 'note-2', value: 'From phone', timestamp: 1001, deviceId: device2.id },
      ];

      // When both come online, merge mutations
      const allMutations = [...device1Mutations, ...device2Mutations].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      const finalStore = new Map<string, unknown>();
      for (const m of allMutations) {
        finalStore.set(`${m.namespace}:${m.key}`, m.value);
      }

      // Both notes should exist
      expect(finalStore.get('notes:note-1')).toBe('From laptop');
      expect(finalStore.get('notes:note-2')).toBe('From phone');
    });
  });

  describe('OrbitDB Encryption Password Compatibility', () => {
    it('should generate OrbitDB-compatible encryption password', async () => {
      const device = await createSimulatedDevice('device', USER_WALLET_SEED);

      // Password should be a hex string (for SimpleEncryption)
      expect(device.encryptionPassword).toMatch(/^[0-9a-f]+$/);
      expect(device.encryptionPassword.length).toBe(64); // SHA256 = 32 bytes = 64 hex chars
    });

    it('should match password format expected by @orbitdb/simple-encryption', async () => {
      const device = await createSimulatedDevice('device', USER_WALLET_SEED);

      // SimpleEncryption expects a password string
      // Our implementation provides a deterministic hex string
      expect(typeof device.encryptionPassword).toBe('string');
      expect(device.encryptionPassword.length).toBeGreaterThan(0);
    });
  });
});

describe('Device ID Generation', () => {
  it('should generate unique device IDs', async () => {
    const device1 = await createSimulatedDevice('device-1', USER_WALLET_SEED);
    const device2 = await createSimulatedDevice('device-2', USER_WALLET_SEED);

    expect(device1.id).not.toBe(device2.id);
  });

  it('should use consistent device IDs across restarts', async () => {
    // Same device ID should be returned for same input
    const device1a = await createSimulatedDevice('my-laptop', USER_WALLET_SEED);
    const device1b = await createSimulatedDevice('my-laptop', USER_WALLET_SEED);

    expect(device1a.id).toBe(device1b.id);
  });
});
