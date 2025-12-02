/**
 * Token Storage Tests - Sprint 1b
 *
 * Tests for token storage implementations
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { InMemoryTokenStorage } from '../storage/in-memory';
import { BrowserTokenStorage } from '../storage/browser';
import type { StoredTokens, OAuthProvider, TokenStorage } from '../types';

const testTokens: StoredTokens = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: Date.now() + 3600000,
  scope: 'openid profile email',
  tokenType: 'Bearer',
};

// Create localStorage mock
const createLocalStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

// Setup localStorage mock before all tests
beforeAll(() => {
  const localStorageMock = createLocalStorageMock();
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
});

describe('InMemoryTokenStorage', () => {
  let storage: InMemoryTokenStorage;
  const userId = 'user-123';
  const provider: OAuthProvider = 'microsoft';

  beforeEach(() => {
    storage = new InMemoryTokenStorage();
  });

  it('should store and retrieve tokens', async () => {
    await storage.store(userId, provider, testTokens);
    const retrieved = await storage.get(userId, provider);
    expect(retrieved).toEqual(testTokens);
  });

  it('should return null for non-existent tokens', async () => {
    const retrieved = await storage.get(userId, provider);
    expect(retrieved).toBeNull();
  });

  it('should check if tokens exist', async () => {
    expect(await storage.exists(userId, provider)).toBe(false);

    await storage.store(userId, provider, testTokens);
    expect(await storage.exists(userId, provider)).toBe(true);
  });

  it('should delete tokens', async () => {
    await storage.store(userId, provider, testTokens);
    await storage.delete(userId, provider);
    expect(await storage.get(userId, provider)).toBeNull();
  });

  it('should isolate tokens by user and provider', async () => {
    const user1 = 'user-1';
    const user2 = 'user-2';
    const tokens1: StoredTokens = { ...testTokens, accessToken: 'token-1' };
    const tokens2: StoredTokens = { ...testTokens, accessToken: 'token-2' };
    const googleTokens: StoredTokens = { ...testTokens, accessToken: 'google-token' };

    await storage.store(user1, 'microsoft', tokens1);
    await storage.store(user2, 'microsoft', tokens2);
    await storage.store(user1, 'google', googleTokens);

    expect((await storage.get(user1, 'microsoft'))?.accessToken).toBe('token-1');
    expect((await storage.get(user2, 'microsoft'))?.accessToken).toBe('token-2');
    expect((await storage.get(user1, 'google'))?.accessToken).toBe('google-token');
    expect(await storage.get(user2, 'google')).toBeNull();
  });
});

describe('BrowserTokenStorage', () => {
  let storage: BrowserTokenStorage;
  const userId = 'user-123';
  const provider: OAuthProvider = 'google';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    storage = new BrowserTokenStorage();
  });

  it('should store and retrieve tokens', async () => {
    await storage.store(userId, provider, testTokens);
    const retrieved = await storage.get(userId, provider);
    expect(retrieved).toEqual(testTokens);
  });

  it('should return null for non-existent tokens', async () => {
    const retrieved = await storage.get(userId, provider);
    expect(retrieved).toBeNull();
  });

  it('should check if tokens exist', async () => {
    expect(await storage.exists(userId, provider)).toBe(false);

    await storage.store(userId, provider, testTokens);
    expect(await storage.exists(userId, provider)).toBe(true);
  });

  it('should delete tokens', async () => {
    await storage.store(userId, provider, testTokens);
    await storage.delete(userId, provider);
    expect(await storage.get(userId, provider)).toBeNull();
  });

  it('should use correct localStorage key format', async () => {
    await storage.store(userId, provider, testTokens);

    const expectedKey = `ownyou_oauth_${userId}_${provider}`;
    expect(localStorage.getItem(expectedKey)).not.toBeNull();
  });
});

// Abstract test suite that can be applied to any TokenStorage implementation
function testTokenStorage(name: string, createStorage: () => TokenStorage) {
  describe(`${name} (TokenStorage interface)`, () => {
    let storage: TokenStorage;
    const userId = 'interface-test-user';
    const provider: OAuthProvider = 'microsoft';

    beforeEach(() => {
      storage = createStorage();
    });

    it('should implement store()', async () => {
      await expect(storage.store(userId, provider, testTokens)).resolves.not.toThrow();
    });

    it('should implement get()', async () => {
      const result = await storage.get(userId, provider);
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should implement exists()', async () => {
      const result = await storage.exists(userId, provider);
      expect(typeof result).toBe('boolean');
    });

    it('should implement delete()', async () => {
      await expect(storage.delete(userId, provider)).resolves.not.toThrow();
    });
  });
}

// Run interface tests for all implementations
testTokenStorage('InMemoryTokenStorage', () => new InMemoryTokenStorage());
testTokenStorage('BrowserTokenStorage', () => new BrowserTokenStorage());
