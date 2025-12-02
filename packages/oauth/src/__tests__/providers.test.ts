/**
 * OAuth Provider Tests - Sprint 1b
 *
 * Tests for Microsoft and Google OAuth providers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MicrosoftOAuthProvider } from '../providers/microsoft';
import { GoogleOAuthProvider } from '../providers/google';
import type { MicrosoftOAuthConfig, GoogleOAuthConfig } from '../types';
import { MICROSOFT_DEFAULT_SCOPES, GOOGLE_DEFAULT_SCOPES } from '../types';

describe('MicrosoftOAuthProvider', () => {
  let provider: MicrosoftOAuthProvider;
  const config: MicrosoftOAuthConfig = {
    provider: 'microsoft',
    platform: 'browser',
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:3000/oauth/callback/microsoft',
    scopes: MICROSOFT_DEFAULT_SCOPES,
    tenantId: 'common',
  };

  beforeEach(() => {
    provider = new MicrosoftOAuthProvider(config);
  });

  describe('getAuthorizationUrl', () => {
    it('should generate valid Microsoft authorization URL', () => {
      const state = 'random-state-123';
      const url = provider.getAuthorizationUrl(state);

      expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(url).toContain(`client_id=${config.clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(config.redirectUri)}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain('offline_access'); // Required for refresh tokens
    });

    it('should include all configured scopes', () => {
      const state = 'test-state';
      const url = provider.getAuthorizationUrl(state);

      for (const scope of config.scopes) {
        expect(url).toContain(encodeURIComponent(scope));
      }
    });

    it('should use custom tenant ID when provided', () => {
      const customConfig: MicrosoftOAuthConfig = {
        ...config,
        tenantId: 'my-tenant-id',
      };
      const customProvider = new MicrosoftOAuthProvider(customConfig);

      const url = customProvider.getAuthorizationUrl('state');
      expect(url).toContain('https://login.microsoftonline.com/my-tenant-id/oauth2/v2.0/authorize');
    });
  });

  describe('provider property', () => {
    it('should return microsoft', () => {
      expect(provider.provider).toBe('microsoft');
    });
  });

  describe('exchangeCode', () => {
    it('should throw error for invalid code', async () => {
      // This would normally make an HTTP request
      // For unit tests, we test the error handling
      await expect(provider.exchangeCode('invalid-code')).rejects.toThrow();
    });
  });

  describe('refreshTokens', () => {
    it('should throw error for invalid refresh token', async () => {
      await expect(provider.refreshTokens('invalid-refresh-token')).rejects.toThrow();
    });
  });
});

describe('GoogleOAuthProvider', () => {
  let provider: GoogleOAuthProvider;
  const config: GoogleOAuthConfig = {
    provider: 'google',
    platform: 'browser',
    clientId: 'test-google-client-id',
    redirectUri: 'http://localhost:3000/oauth/callback/google',
    scopes: GOOGLE_DEFAULT_SCOPES,
  };

  beforeEach(() => {
    provider = new GoogleOAuthProvider(config);
  });

  describe('getAuthorizationUrl', () => {
    it('should generate valid Google authorization URL', () => {
      const state = 'random-state-456';
      const url = provider.getAuthorizationUrl(state);

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain(`client_id=${config.clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(config.redirectUri)}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain('access_type=offline'); // Required for refresh tokens
    });

    it('should include all configured scopes', () => {
      const state = 'test-state';
      const url = provider.getAuthorizationUrl(state);

      for (const scope of config.scopes) {
        expect(url).toContain(encodeURIComponent(scope));
      }
    });

    it('should request consent prompt for refresh token', () => {
      const url = provider.getAuthorizationUrl('state');
      expect(url).toContain('prompt=consent');
    });
  });

  describe('provider property', () => {
    it('should return google', () => {
      expect(provider.provider).toBe('google');
    });
  });

  describe('exchangeCode', () => {
    it('should throw error for invalid code', async () => {
      await expect(provider.exchangeCode('invalid-code')).rejects.toThrow();
    });
  });

  describe('refreshTokens', () => {
    it('should throw error for invalid refresh token', async () => {
      await expect(provider.refreshTokens('invalid-refresh-token')).rejects.toThrow();
    });
  });
});

describe('Desktop OAuth flows', () => {
  it('should use ownyou:// redirect URI for desktop Microsoft', () => {
    const desktopConfig: MicrosoftOAuthConfig = {
      provider: 'microsoft',
      platform: 'desktop',
      clientId: 'desktop-client-id',
      redirectUri: 'ownyou://oauth/callback/microsoft',
      scopes: MICROSOFT_DEFAULT_SCOPES,
    };

    const provider = new MicrosoftOAuthProvider(desktopConfig);
    const url = provider.getAuthorizationUrl('state');

    expect(url).toContain(encodeURIComponent('ownyou://oauth/callback/microsoft'));
  });

  it('should use ownyou:// redirect URI for desktop Google', () => {
    const desktopConfig: GoogleOAuthConfig = {
      provider: 'google',
      platform: 'desktop',
      clientId: 'desktop-client-id',
      redirectUri: 'ownyou://oauth/callback/google',
      scopes: GOOGLE_DEFAULT_SCOPES,
    };

    const provider = new GoogleOAuthProvider(desktopConfig);
    const url = provider.getAuthorizationUrl('state');

    expect(url).toContain(encodeURIComponent('ownyou://oauth/callback/google'));
  });
});
