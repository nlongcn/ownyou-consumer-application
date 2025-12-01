/**
 * Cryptography Module for OwnYou Browser Extension
 *
 * Implements AES-GCM encryption for OAuth tokens
 * Uses Web Crypto API (browser-native)
 *
 * Based on: docs/architecture/BROWSER_EXTENSION_UNIFIED_REQUIREMENTS.md
 */

/**
 * Derive encryption key from extension ID (deterministic)
 *
 * Uses the extension ID as a seed for key derivation
 * This ensures the same key is used across sessions
 */
async function deriveEncryptionKey() {
  const extensionId = chrome.runtime.id;

  // Use extension ID as seed
  const encoder = new TextEncoder();
  const seedData = encoder.encode(extensionId + '-ownyou-encryption-key-v1');

  // Import as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    seedData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('ownyou-salt-v1'),  // Static salt (OK for extension ID seed)
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Encrypt tokens using AES-GCM
 *
 * @param {Object} tokens - Token object with accessToken, refreshToken, expiresAt
 * @returns {Promise<Object>} Encrypted data with IV
 */
export async function encryptTokens(tokens) {
  try {
    const key = await deriveEncryptionKey();

    // Convert tokens to JSON string
    const plaintext = JSON.stringify(tokens);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate random IV (initialization vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));  // 96 bits for AES-GCM

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );

    // Return as arrays (for JSON serialization)
    return {
      data: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    };

  } catch (error) {
    console.error('Token encryption failed:', error);
    throw new Error('Failed to encrypt tokens');
  }
}

/**
 * Decrypt tokens using AES-GCM
 *
 * @param {Object} encryptedData - Object with data and iv arrays
 * @returns {Promise<Object>} Decrypted token object
 */
export async function decryptTokens(encryptedData) {
  try {
    const key = await deriveEncryptionKey();

    // Convert arrays back to Uint8Array
    const data = new Uint8Array(encryptedData.data);
    const iv = new Uint8Array(encryptedData.iv);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );

    // Convert to string and parse JSON
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decrypted);
    const tokens = JSON.parse(plaintext);

    return tokens;

  } catch (error) {
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt tokens');
  }
}

/**
 * Store encrypted tokens
 *
 * @param {string} provider - Provider name ('microsoft' or 'google')
 * @param {Object} tokens - Token response from OAuth
 */
export async function storeEncryptedTokens(provider, tokens) {
  try {
    // Encrypt tokens
    const encrypted = await encryptTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt
    });

    // Store in chrome.storage.local
    const storageKey = `tokens_${provider}`;
    await chrome.storage.local.set({
      [storageKey]: {
        data: encrypted.data,
        iv: encrypted.iv,
        expiresAt: tokens.expiresAt,
        accountEmail: tokens.accountEmail
      }
    });

    console.log(`Encrypted tokens stored for ${provider}`);

  } catch (error) {
    console.error('Failed to store encrypted tokens:', error);
    throw error;
  }
}

/**
 * Get decrypted tokens from storage
 *
 * @param {string} provider - Provider name ('microsoft' or 'google')
 * @returns {Promise<Object|null>} Decrypted tokens or null if not found
 */
export async function getDecryptedTokens(provider) {
  try {
    const storageKey = `tokens_${provider}`;
    const result = await chrome.storage.local.get(storageKey);

    if (!result[storageKey]) {
      return null;
    }

    const encryptedData = result[storageKey];

    // Decrypt
    const tokens = await decryptTokens({
      data: encryptedData.data,
      iv: encryptedData.iv
    });

    return {
      ...tokens,
      accountEmail: encryptedData.accountEmail
    };

  } catch (error) {
    console.error('Failed to get decrypted tokens:', error);
    return null;
  }
}

/**
 * Check if tokens are expired
 *
 * @param {string} provider - Provider name
 * @returns {Promise<boolean>} True if tokens exist and are NOT expired
 */
export async function areTokensValid(provider) {
  const storageKey = `tokens_${provider}`;
  const result = await chrome.storage.local.get(storageKey);

  if (!result[storageKey]) {
    return false;
  }

  const now = Date.now();
  const expiresAt = result[storageKey].expiresAt;

  // Add 5-minute buffer
  return expiresAt > (now + (5 * 60 * 1000));
}

/**
 * Clear stored tokens for provider
 *
 * @param {string} provider - Provider name
 */
export async function clearTokens(provider) {
  const storageKey = `tokens_${provider}`;
  await chrome.storage.local.remove(storageKey);
  console.log(`Cleared tokens for ${provider}`);
}
