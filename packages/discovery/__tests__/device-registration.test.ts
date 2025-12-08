/**
 * Device Registration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerDevice,
  verifyRegistrationSignature,
  getStoredRegistration,
  isRegistrationValidForWallet,
  clearRegistration,
} from '../src/device/device-registration.js';
import type { WalletProvider, DeviceRegistration } from '../src/types.js';

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

// Mock wallet provider
function createMockWallet(address: string): WalletProvider {
  return {
    getWalletAddress: async () => address,
    signMessage: async (message: string) => `sig:${message.slice(0, 20)}`,
  };
}

describe('Device Registration', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('registerDevice', () => {
    it('should register a device with wallet', async () => {
      const wallet = createMockWallet('0x1234567890abcdef1234567890abcdef12345678');

      const registration = await registerDevice(wallet, 'pwa', 'My Device');

      expect(registration).toBeDefined();
      expect(registration.deviceId).toBeDefined();
      expect(registration.walletAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(registration.platform).toBe('pwa');
      expect(registration.deviceName).toBe('My Device');
      expect(registration.signature).toBeDefined();
      expect(registration.timestamp).toBeDefined();
    });

    it('should store registration in localStorage', async () => {
      const wallet = createMockWallet('0xtest');

      await registerDevice(wallet, 'tauri');

      const stored = getStoredRegistration();
      expect(stored).not.toBeNull();
      expect(stored?.walletAddress).toBe('0xtest');
    });
  });

  describe('verifyRegistrationSignature', () => {
    it('should return true for valid signature', () => {
      const registration: DeviceRegistration = {
        deviceId: 'test-device',
        walletAddress: '0xtest',
        platform: 'pwa',
        timestamp: Date.now(),
        signature: 'valid-signature-here',
      };

      expect(verifyRegistrationSignature(registration)).toBe(true);
    });

    it('should return false for empty signature', () => {
      const registration: DeviceRegistration = {
        deviceId: 'test-device',
        walletAddress: '0xtest',
        platform: 'pwa',
        timestamp: Date.now(),
        signature: '',
      };

      expect(verifyRegistrationSignature(registration)).toBe(false);
    });
  });

  describe('isRegistrationValidForWallet', () => {
    it('should return true for matching wallet', () => {
      const registration: DeviceRegistration = {
        deviceId: 'test-device',
        walletAddress: '0xABC123',
        platform: 'pwa',
        timestamp: Date.now(),
        signature: 'valid',
      };

      expect(isRegistrationValidForWallet(registration, '0xabc123')).toBe(true);
    });

    it('should return false for different wallet', () => {
      const registration: DeviceRegistration = {
        deviceId: 'test-device',
        walletAddress: '0xABC123',
        platform: 'pwa',
        timestamp: Date.now(),
        signature: 'valid',
      };

      expect(isRegistrationValidForWallet(registration, '0xDEF456')).toBe(false);
    });

    it('should return false for null registration', () => {
      expect(isRegistrationValidForWallet(null, '0xtest')).toBe(false);
    });

    it('should return false for old registration', () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const registration: DeviceRegistration = {
        deviceId: 'test-device',
        walletAddress: '0xtest',
        platform: 'pwa',
        timestamp: thirtyOneDaysAgo,
        signature: 'valid',
      };

      expect(isRegistrationValidForWallet(registration, '0xtest')).toBe(false);
    });
  });

  describe('clearRegistration', () => {
    it('should clear stored registration', async () => {
      const wallet = createMockWallet('0xtest');
      await registerDevice(wallet, 'pwa');

      expect(getStoredRegistration()).not.toBeNull();

      clearRegistration();

      expect(getStoredRegistration()).toBeNull();
    });
  });
});
