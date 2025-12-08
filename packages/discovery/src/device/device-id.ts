/**
 * Device ID Generation - v13 Section 5.2.3
 *
 * Generates unique, persistent device identifiers.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Storage key for device ID
 */
const DEVICE_ID_KEY = 'ownyou.device.id';

/**
 * Generate a random device ID
 */
function generateRandomDeviceId(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return bytesToHex(sha256(randomBytes));
}

/**
 * Get or create a persistent device ID
 *
 * Device ID is stored in localStorage and persists across sessions.
 * On Tauri, this should be stored in a more secure location.
 */
export function getOrCreateDeviceId(): string {
  // Check if we're in a browser environment
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      return stored;
    }

    const newId = generateRandomDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  }

  // For non-browser environments (tests, Node.js), generate a new ID each time
  // In production Tauri, this would use the Tauri storage API
  return generateRandomDeviceId();
}

/**
 * Create a device ID from wallet address and platform
 *
 * This creates a deterministic device ID based on the wallet and a device-specific salt.
 * The salt ensures each device gets a unique ID even with the same wallet.
 */
export function createDeviceIdFromWallet(walletAddress: string, deviceSalt: string): string {
  const combined = `${walletAddress}:${deviceSalt}`;
  const encoder = new TextEncoder();
  return bytesToHex(sha256(encoder.encode(combined)));
}

/**
 * Get the device salt (stored locally)
 */
export function getOrCreateDeviceSalt(): string {
  const SALT_KEY = 'ownyou.device.salt';

  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(SALT_KEY);
    if (stored) {
      return stored;
    }

    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    localStorage.setItem(SALT_KEY, salt);
    return salt;
  }

  // For non-browser environments
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Clear device ID (for testing or device reset)
 */
export function clearDeviceId(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem('ownyou.device.salt');
  }
}
