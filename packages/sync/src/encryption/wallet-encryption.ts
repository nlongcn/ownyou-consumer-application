/**
 * Wallet-based Encryption - v13 Section 5.2.4
 *
 * Derives encryption keys from wallet signatures for E2EE.
 * All devices with the same wallet can decrypt synced data.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.4
 */

import { sha256 } from '@noble/hashes/sha256';
import type { WalletProvider, DerivedEncryptionKey } from '../types.js';

/**
 * Key derivation purpose
 */
export type KeyPurpose = 'sync' | 'backup';

/**
 * Derive an encryption key from a wallet signature
 *
 * This is deterministic - the same wallet will always derive the same key.
 * The key is suitable for AES-256-GCM encryption.
 *
 * @param wallet - Wallet provider
 * @param purpose - Key purpose ('sync' or 'backup')
 * @returns Derived encryption key with metadata
 */
export async function deriveEncryptionKey(
  wallet: WalletProvider,
  purpose: KeyPurpose
): Promise<DerivedEncryptionKey> {
  // Sign a deterministic message for key derivation
  const message = `ownyou-${purpose}-key-v1`;
  const signature = await wallet.signMessage(message);

  // Hash signature to get seed material
  const seed = sha256(new TextEncoder().encode(signature));

  // Generate salt from wallet address (deterministic)
  const walletAddress = await wallet.getWalletAddress();
  const salt = sha256(new TextEncoder().encode(`${walletAddress}-${purpose}`));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Import as AES-GCM key
  const key = await crypto.subtle.importKey(
    'raw',
    seed,
    { name: 'AES-GCM' },
    false, // not extractable for security
    ['encrypt', 'decrypt']
  );

  return {
    key,
    salt: saltHex,
    purpose,
  };
}

/**
 * Encrypt data with a derived key
 *
 * Uses AES-256-GCM for authenticated encryption.
 *
 * @param data - Data to encrypt (as Uint8Array)
 * @param key - CryptoKey for encryption
 * @returns Encrypted data with IV prepended
 */
export async function encrypt(
  data: Uint8Array,
  key: CryptoKey
): Promise<Uint8Array> {
  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);

  return result;
}

/**
 * Decrypt data with a derived key
 *
 * @param encryptedData - Encrypted data with IV prepended
 * @param key - CryptoKey for decryption
 * @returns Decrypted data
 */
export async function decrypt(
  encryptedData: Uint8Array,
  key: CryptoKey
): Promise<Uint8Array> {
  // Extract IV (first 12 bytes)
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new Uint8Array(decrypted);
}

/**
 * Encrypt a JSON-serializable object
 */
export async function encryptObject<T>(
  obj: T,
  key: CryptoKey
): Promise<Uint8Array> {
  const json = JSON.stringify(obj);
  const data = new TextEncoder().encode(json);
  return encrypt(data, key);
}

/**
 * Decrypt to a JSON object
 */
export async function decryptObject<T>(
  encryptedData: Uint8Array,
  key: CryptoKey
): Promise<T> {
  const decrypted = await decrypt(encryptedData, key);
  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json) as T;
}

/**
 * Derive TURN server credentials from wallet
 *
 * Used for NAT traversal authentication.
 *
 * @param wallet - Wallet provider
 * @param deviceId - Device identifier
 * @returns TURN credentials
 */
export async function deriveTurnCredentials(
  wallet: WalletProvider,
  deviceId: string
): Promise<{ username: string; credential: string }> {
  const signature = await wallet.signMessage(`ownyou-turn-${deviceId}`);
  const hash = sha256(new TextEncoder().encode(signature));

  // Convert to base64 for credential
  const credential = btoa(String.fromCharCode(...hash));

  return {
    username: deviceId,
    credential,
  };
}

/**
 * Verify that two wallets can derive the same key
 *
 * Useful for testing device pairing.
 *
 * @param wallet1 - First wallet
 * @param wallet2 - Second wallet
 * @param purpose - Key purpose
 * @returns True if wallets derive the same key
 */
export async function verifyKeyMatch(
  wallet1: WalletProvider,
  wallet2: WalletProvider,
  purpose: KeyPurpose
): Promise<boolean> {
  // Derive keys from both wallets
  const key1 = await deriveEncryptionKey(wallet1, purpose);
  const key2 = await deriveEncryptionKey(wallet2, purpose);

  // Test by encrypting/decrypting
  const testData = new TextEncoder().encode('ownyou-key-verification');

  try {
    const encrypted = await encrypt(testData, key1.key);
    const decrypted = await decrypt(encrypted, key2.key);

    // Compare decrypted data
    return (
      testData.length === decrypted.length &&
      testData.every((byte, i) => byte === decrypted[i])
    );
  } catch {
    return false;
  }
}

/**
 * Generate a one-time encryption key for sensitive operations
 *
 * This key is NOT derived from wallet and should be used
 * for one-time operations only (e.g., export).
 */
export async function generateOneTimeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey for backup purposes
 *
 * Only works with extractable keys (not wallet-derived keys).
 */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

/**
 * Import a key from raw bytes
 */
export async function importKey(
  keyData: Uint8Array,
  extractable: boolean = false
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    extractable,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive an encryption password from a wallet signature
 *
 * This returns a deterministic password string suitable for
 * OrbitDB's SimpleEncryption module.
 *
 * @param wallet - Wallet provider
 * @param purpose - Key purpose ('sync' or 'backup')
 * @returns Password string for encryption
 */
export async function deriveEncryptionPassword(
  wallet: WalletProvider,
  purpose: KeyPurpose
): Promise<string> {
  // Sign a deterministic message for password derivation
  const message = `ownyou-${purpose}-password-v1`;
  const signature = await wallet.signMessage(message);

  // Hash signature to get deterministic password
  const hash = sha256(new TextEncoder().encode(signature));

  // Convert to hex string for use as password
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a mock wallet provider for testing
 *
 * DO NOT USE IN PRODUCTION
 */
export function createMockWalletProvider(seed: string): WalletProvider {
  const address = `0x${sha256(new TextEncoder().encode(seed))
    .slice(0, 20)
    .reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '')}`;

  return {
    getWalletAddress: async () => address,
    signMessage: async (message: string) => {
      const data = new TextEncoder().encode(`${seed}:${message}`);
      return Array.from(sha256(data))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    },
  };
}
