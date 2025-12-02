/**
 * @ownyou/oauth - Unified OAuth Management
 *
 * Sprint 1b - OAuth + Email + IAB Migration
 *
 * This package provides unified OAuth authentication for both browser (PWA)
 * and desktop (Tauri) platforms, with support for Microsoft and Google providers.
 *
 * Features:
 * - Microsoft OAuth with 90-day offline_access tokens
 * - Google OAuth with refresh token support
 * - Platform-specific token storage (localStorage vs OS Keychain)
 * - Automatic token refresh before expiry
 * - Event-based notifications for token state changes
 *
 * @see docs/sprints/ownyou-sprint1b-spec.md
 * @packageDocumentation
 */

// Types
export type {
  OAuthProvider,
  Platform,
  StoredTokens,
  TokenStorage,
  OAuthConfig,
  MicrosoftOAuthConfig,
  GoogleOAuthConfig,
  OAuthProviderClient,
  TokenManagerEvents,
  OAuthClient,
} from './types';

export {
  TOKEN_REFRESH_MARGIN_MS,
  MICROSOFT_DEFAULT_SCOPES,
  GOOGLE_DEFAULT_SCOPES,
} from './types';

// Storage implementations
export {
  InMemoryTokenStorage,
  BrowserTokenStorage,
  KeychainTokenStorage,
} from './storage';

// OAuth providers
export {
  MicrosoftOAuthProvider,
  GoogleOAuthProvider,
} from './providers';

// Token manager
export { TokenManager } from './token-manager';

// Factory function for creating OAuth client
import type { Platform, TokenStorage } from './types';
import { BrowserTokenStorage } from './storage/browser';
import { KeychainTokenStorage } from './storage/keychain';
import { InMemoryTokenStorage } from './storage/in-memory';

/**
 * Create storage implementation based on platform
 *
 * @param platform - Target platform (browser or desktop)
 * @returns TokenStorage implementation appropriate for the platform
 */
export function createTokenStorage(platform: Platform): TokenStorage {
  switch (platform) {
    case 'browser':
      return new BrowserTokenStorage();
    case 'desktop':
      return new KeychainTokenStorage();
    default:
      // Fallback to in-memory for unknown platforms (testing)
      return new InMemoryTokenStorage();
  }
}

/**
 * Detect current platform
 *
 * @returns 'browser' or 'desktop' based on environment
 */
export function detectPlatform(): Platform {
  // Check for Tauri environment
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return 'desktop';
  }

  // Default to browser
  return 'browser';
}
