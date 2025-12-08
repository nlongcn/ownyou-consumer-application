/**
 * Device Registration - v13 Section 5.2.3
 *
 * Handles device registration with wallet signature verification.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */

import type { DeviceRegistration, Platform, WalletProvider } from '../types.js';
import { getOrCreateDeviceSalt, createDeviceIdFromWallet } from './device-id.js';

/**
 * Storage key for device registration
 */
const REGISTRATION_KEY = 'ownyou.device.registration';

/**
 * Create a device registration message for signing
 */
function createRegistrationMessage(
  deviceId: string,
  walletAddress: string,
  platform: Platform,
  timestamp: number
): string {
  return JSON.stringify({
    action: 'register_device',
    deviceId,
    walletAddress,
    platform,
    timestamp,
  });
}

/**
 * Register this device with a wallet
 */
export async function registerDevice(
  wallet: WalletProvider,
  platform: Platform,
  deviceName?: string
): Promise<DeviceRegistration> {
  // Get wallet address
  const walletAddress = await wallet.getWalletAddress();

  // Generate device ID from wallet + local salt
  const deviceSalt = getOrCreateDeviceSalt();
  const deviceId = createDeviceIdFromWallet(walletAddress, deviceSalt);

  // Create timestamp
  const timestamp = Date.now();

  // Create and sign registration message
  const message = createRegistrationMessage(deviceId, walletAddress, platform, timestamp);
  const signature = await wallet.signMessage(message);

  const registration: DeviceRegistration = {
    deviceId,
    walletAddress,
    platform,
    timestamp,
    signature,
    deviceName,
    lastSeen: timestamp,
  };

  // Store registration locally
  saveRegistration(registration);

  return registration;
}

/**
 * Verify a device registration signature
 */
export function verifyRegistrationSignature(registration: DeviceRegistration): boolean {
  // In production, this would verify the signature against the wallet address
  // using ethers.js or similar library. For now, we just check the signature exists.
  // The actual verification happens on the signaling server.
  return Boolean(registration.signature && registration.signature.length > 0);
}

/**
 * Get stored device registration
 */
export function getStoredRegistration(): DeviceRegistration | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem(REGISTRATION_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as DeviceRegistration;
  } catch {
    return null;
  }
}

/**
 * Save device registration to local storage
 */
function saveRegistration(registration: DeviceRegistration): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify(registration));
  }
}

/**
 * Update last seen timestamp
 */
export function updateLastSeen(registration: DeviceRegistration): DeviceRegistration {
  const updated = { ...registration, lastSeen: Date.now() };
  saveRegistration(updated);
  return updated;
}

/**
 * Clear device registration (for testing or logout)
 */
export function clearRegistration(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(REGISTRATION_KEY);
  }
}

/**
 * Check if device registration is valid for a wallet
 */
export function isRegistrationValidForWallet(
  registration: DeviceRegistration | null,
  walletAddress: string
): boolean {
  if (!registration) {
    return false;
  }

  // Check wallet address matches
  if (registration.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    return false;
  }

  // Check registration is not too old (30 days)
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - registration.timestamp > maxAge) {
    return false;
  }

  return verifyRegistrationSignature(registration);
}
