/**
 * TokenManager Tests - Sprint 1b
 *
 * Tests for token management: storage, refresh, expiry detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenManager } from '../token-manager';
import { InMemoryTokenStorage } from '../storage/in-memory';
import type { StoredTokens, OAuthProvider } from '../types';
import { TOKEN_REFRESH_MARGIN_MS } from '../types';

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let storage: InMemoryTokenStorage;
  const userId = 'test-user-123';
  const provider: OAuthProvider = 'microsoft';

  const validTokens: StoredTokens = {
    accessToken: 'valid-access-token',
    refreshToken: 'valid-refresh-token',
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
    scope: 'openid profile email',
    tokenType: 'Bearer',
  };

  const expiredTokens: StoredTokens = {
    accessToken: 'expired-access-token',
    refreshToken: 'valid-refresh-token',
    expiresAt: Date.now() - 1000, // Already expired
    scope: 'openid profile email',
    tokenType: 'Bearer',
  };

  const expiringTokens: StoredTokens = {
    accessToken: 'expiring-access-token',
    refreshToken: 'valid-refresh-token',
    expiresAt: Date.now() + TOKEN_REFRESH_MARGIN_MS - 1000, // Within refresh margin
    scope: 'openid profile email',
    tokenType: 'Bearer',
  };

  beforeEach(() => {
    storage = new InMemoryTokenStorage();
    tokenManager = new TokenManager(storage);
  });

  describe('storeTokens', () => {
    it('should store tokens for user and provider', async () => {
      await tokenManager.storeTokens(userId, provider, validTokens);

      const stored = await storage.get(userId, provider);
      expect(stored).toEqual(validTokens);
    });

    it('should overwrite existing tokens', async () => {
      await tokenManager.storeTokens(userId, provider, validTokens);

      const newTokens: StoredTokens = {
        ...validTokens,
        accessToken: 'new-access-token',
      };
      await tokenManager.storeTokens(userId, provider, newTokens);

      const stored = await storage.get(userId, provider);
      expect(stored?.accessToken).toBe('new-access-token');
    });
  });

  describe('getTokens', () => {
    it('should return null for non-existent user', async () => {
      const tokens = await tokenManager.getTokens(userId, provider);
      expect(tokens).toBeNull();
    });

    it('should return stored tokens', async () => {
      await storage.store(userId, provider, validTokens);

      const tokens = await tokenManager.getTokens(userId, provider);
      expect(tokens).toEqual(validTokens);
    });
  });

  describe('isTokenValid', () => {
    it('should return false for non-existent tokens', async () => {
      const isValid = await tokenManager.isTokenValid(userId, provider);
      expect(isValid).toBe(false);
    });

    it('should return true for valid non-expired tokens', async () => {
      await storage.store(userId, provider, validTokens);

      const isValid = await tokenManager.isTokenValid(userId, provider);
      expect(isValid).toBe(true);
    });

    it('should return false for expired tokens', async () => {
      await storage.store(userId, provider, expiredTokens);

      const isValid = await tokenManager.isTokenValid(userId, provider);
      expect(isValid).toBe(false);
    });
  });

  describe('needsRefresh', () => {
    it('should return true for expired tokens', async () => {
      await storage.store(userId, provider, expiredTokens);

      const needsRefresh = await tokenManager.needsRefresh(userId, provider);
      expect(needsRefresh).toBe(true);
    });

    it('should return true for tokens expiring within margin', async () => {
      await storage.store(userId, provider, expiringTokens);

      const needsRefresh = await tokenManager.needsRefresh(userId, provider);
      expect(needsRefresh).toBe(true);
    });

    it('should return false for tokens with plenty of time left', async () => {
      await storage.store(userId, provider, validTokens);

      const needsRefresh = await tokenManager.needsRefresh(userId, provider);
      expect(needsRefresh).toBe(false);
    });

    it('should return false for non-existent tokens', async () => {
      const needsRefresh = await tokenManager.needsRefresh(userId, provider);
      expect(needsRefresh).toBe(false);
    });
  });

  describe('deleteTokens', () => {
    it('should delete stored tokens', async () => {
      await storage.store(userId, provider, validTokens);

      await tokenManager.deleteTokens(userId, provider);

      const tokens = await storage.get(userId, provider);
      expect(tokens).toBeNull();
    });

    it('should not throw for non-existent tokens', async () => {
      await expect(tokenManager.deleteTokens(userId, provider)).resolves.not.toThrow();
    });
  });

  describe('events', () => {
    it('should emit onTokenExpiring when checking tokens near expiry', async () => {
      await storage.store(userId, provider, expiringTokens);

      const expiringHandler = vi.fn();
      tokenManager.on('onTokenExpiring', expiringHandler);

      await tokenManager.checkTokenExpiry(userId, provider);

      expect(expiringHandler).toHaveBeenCalledWith(
        provider,
        expect.any(Number)
      );
    });
  });
});
