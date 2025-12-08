/**
 * Wallet Encryption Tests
 */

import { describe, it, expect } from 'vitest';
import {
  deriveEncryptionKey,
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  deriveTurnCredentials,
  verifyKeyMatch,
  createMockWalletProvider,
} from '../../src/encryption/wallet-encryption.js';

describe('Wallet Encryption', () => {
  describe('createMockWalletProvider', () => {
    it('should create a wallet with deterministic address', async () => {
      const wallet1 = createMockWalletProvider('seed-1');
      const wallet2 = createMockWalletProvider('seed-1');

      const addr1 = await wallet1.getWalletAddress();
      const addr2 = await wallet2.getWalletAddress();

      expect(addr1).toBe(addr2);
    });

    it('should create different addresses for different seeds', async () => {
      const wallet1 = createMockWalletProvider('seed-1');
      const wallet2 = createMockWalletProvider('seed-2');

      const addr1 = await wallet1.getWalletAddress();
      const addr2 = await wallet2.getWalletAddress();

      expect(addr1).not.toBe(addr2);
    });

    it('should produce deterministic signatures', async () => {
      const wallet1 = createMockWalletProvider('seed-1');
      const wallet2 = createMockWalletProvider('seed-1');

      const sig1 = await wallet1.signMessage('test');
      const sig2 = await wallet2.signMessage('test');

      expect(sig1).toBe(sig2);
    });
  });

  describe('deriveEncryptionKey', () => {
    it('should derive a CryptoKey for sync purpose', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const result = await deriveEncryptionKey(wallet, 'sync');

      expect(result.key).toBeInstanceOf(CryptoKey);
      expect(result.purpose).toBe('sync');
      expect(typeof result.salt).toBe('string');
    });

    it('should derive a CryptoKey for backup purpose', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const result = await deriveEncryptionKey(wallet, 'backup');

      expect(result.key).toBeInstanceOf(CryptoKey);
      expect(result.purpose).toBe('backup');
    });

    it('should derive different keys for different purposes', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const syncKey = await deriveEncryptionKey(wallet, 'sync');
      const backupKey = await deriveEncryptionKey(wallet, 'backup');

      // Test by encrypting with one and failing to decrypt with other
      const data = new TextEncoder().encode('test data');
      const encrypted = await encrypt(data, syncKey.key);

      await expect(decrypt(encrypted, backupKey.key)).rejects.toThrow();
    });

    it('should derive same key from same wallet', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const key1 = await deriveEncryptionKey(wallet, 'sync');
      const key2 = await deriveEncryptionKey(wallet, 'sync');

      // Test by encrypting with one and decrypting with other
      const data = new TextEncoder().encode('test data');
      const encrypted = await encrypt(data, key1.key);
      const decrypted = await decrypt(encrypted, key2.key);

      expect(new TextDecoder().decode(decrypted)).toBe('test data');
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const { key } = await deriveEncryptionKey(wallet, 'sync');

      const original = new TextEncoder().encode('Hello, World!');
      const encrypted = await encrypt(original, key);
      const decrypted = await decrypt(encrypted, key);

      expect(new TextDecoder().decode(decrypted)).toBe('Hello, World!');
    });

    it('should produce different ciphertext each time (random IV)', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const { key } = await deriveEncryptionKey(wallet, 'sync');

      const data = new TextEncoder().encode('test');
      const encrypted1 = await encrypt(data, key);
      const encrypted2 = await encrypt(data, key);

      // Ciphertexts should be different due to random IV
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should fail to decrypt with wrong key', async () => {
      const wallet1 = createMockWalletProvider('seed-1');
      const wallet2 = createMockWalletProvider('seed-2');

      const key1 = await deriveEncryptionKey(wallet1, 'sync');
      const key2 = await deriveEncryptionKey(wallet2, 'sync');

      const data = new TextEncoder().encode('secret');
      const encrypted = await encrypt(data, key1.key);

      await expect(decrypt(encrypted, key2.key)).rejects.toThrow();
    });

    it('should handle empty data', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const { key } = await deriveEncryptionKey(wallet, 'sync');

      const original = new Uint8Array(0);
      const encrypted = await encrypt(original, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toHaveLength(0);
    });

    it('should handle large data', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const { key } = await deriveEncryptionKey(wallet, 'sync');

      // 100KB of data (browser crypto.getRandomValues has 65536 byte limit per call)
      const original = new Uint8Array(100 * 1024);
      // Fill in chunks to avoid browser limit
      const chunkSize = 65536;
      for (let i = 0; i < original.length; i += chunkSize) {
        const chunk = original.subarray(i, Math.min(i + chunkSize, original.length));
        crypto.getRandomValues(chunk);
      }

      const encrypted = await encrypt(original, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toEqual(original);
    });
  });

  describe('encryptObject/decryptObject', () => {
    it('should encrypt and decrypt JSON objects', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const { key } = await deriveEncryptionKey(wallet, 'sync');

      const original = { name: 'Alice', score: 42, tags: ['a', 'b'] };
      const encrypted = await encryptObject(original, key);
      const decrypted = await decryptObject<typeof original>(encrypted, key);

      expect(decrypted).toEqual(original);
    });

    it('should handle nested objects', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const { key } = await deriveEncryptionKey(wallet, 'sync');

      const original = {
        user: { id: 1, profile: { name: 'Bob', settings: { theme: 'dark' } } },
        items: [{ id: 1 }, { id: 2 }],
      };

      const encrypted = await encryptObject(original, key);
      const decrypted = await decryptObject<typeof original>(encrypted, key);

      expect(decrypted).toEqual(original);
    });
  });

  describe('deriveTurnCredentials', () => {
    it('should derive deterministic credentials', async () => {
      const wallet = createMockWalletProvider('test-seed');

      const creds1 = await deriveTurnCredentials(wallet, 'device-1');
      const creds2 = await deriveTurnCredentials(wallet, 'device-1');

      expect(creds1.username).toBe(creds2.username);
      expect(creds1.credential).toBe(creds2.credential);
    });

    it('should derive different credentials for different devices', async () => {
      const wallet = createMockWalletProvider('test-seed');

      const creds1 = await deriveTurnCredentials(wallet, 'device-1');
      const creds2 = await deriveTurnCredentials(wallet, 'device-2');

      expect(creds1.credential).not.toBe(creds2.credential);
    });

    it('should use device ID as username', async () => {
      const wallet = createMockWalletProvider('test-seed');
      const creds = await deriveTurnCredentials(wallet, 'my-device-id');

      expect(creds.username).toBe('my-device-id');
    });
  });

  describe('verifyKeyMatch', () => {
    it('should return true for same wallet seeds', async () => {
      const wallet1 = createMockWalletProvider('same-seed');
      const wallet2 = createMockWalletProvider('same-seed');

      const result = await verifyKeyMatch(wallet1, wallet2, 'sync');

      expect(result).toBe(true);
    });

    it('should return false for different wallet seeds', async () => {
      const wallet1 = createMockWalletProvider('seed-1');
      const wallet2 = createMockWalletProvider('seed-2');

      const result = await verifyKeyMatch(wallet1, wallet2, 'sync');

      expect(result).toBe(false);
    });
  });
});
