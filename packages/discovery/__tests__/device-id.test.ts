/**
 * Device ID Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOrCreateDeviceId,
  createDeviceIdFromWallet,
  getOrCreateDeviceSalt,
  clearDeviceId,
} from '../src/device/device-id.js';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('Device ID', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getOrCreateDeviceId', () => {
    it('should generate a new device ID', () => {
      const deviceId = getOrCreateDeviceId();

      expect(deviceId).toBeDefined();
      expect(typeof deviceId).toBe('string');
      expect(deviceId.length).toBe(64); // SHA-256 hex
    });

    it('should return the same ID on subsequent calls', () => {
      const id1 = getOrCreateDeviceId();
      const id2 = getOrCreateDeviceId();

      expect(id1).toBe(id2);
    });

    it('should generate different IDs after clearing', () => {
      const id1 = getOrCreateDeviceId();
      clearDeviceId();
      const id2 = getOrCreateDeviceId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('createDeviceIdFromWallet', () => {
    it('should create deterministic ID from wallet and salt', () => {
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
      const deviceSalt = 'test-salt-12345';

      const id1 = createDeviceIdFromWallet(walletAddress, deviceSalt);
      const id2 = createDeviceIdFromWallet(walletAddress, deviceSalt);

      expect(id1).toBe(id2);
      expect(id1.length).toBe(64);
    });

    it('should create different IDs for different wallets', () => {
      const salt = 'same-salt';
      const id1 = createDeviceIdFromWallet('0xwallet1', salt);
      const id2 = createDeviceIdFromWallet('0xwallet2', salt);

      expect(id1).not.toBe(id2);
    });

    it('should create different IDs for different salts', () => {
      const wallet = '0xsamewallet';
      const id1 = createDeviceIdFromWallet(wallet, 'salt1');
      const id2 = createDeviceIdFromWallet(wallet, 'salt2');

      expect(id1).not.toBe(id2);
    });
  });

  describe('getOrCreateDeviceSalt', () => {
    it('should generate a salt', () => {
      const salt = getOrCreateDeviceSalt();

      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBe(32); // 16 bytes as hex
    });

    it('should return the same salt on subsequent calls', () => {
      const salt1 = getOrCreateDeviceSalt();
      const salt2 = getOrCreateDeviceSalt();

      expect(salt1).toBe(salt2);
    });
  });
});
