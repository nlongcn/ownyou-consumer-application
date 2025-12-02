/**
 * Browser Token Storage - Sprint 1b
 *
 * LocalStorage-based token storage for browser environments.
 * Uses encrypted storage for production security.
 *
 * @see docs/sprints/ownyou-sprint1b-spec.md Section 2
 */

import type { TokenStorage, StoredTokens, OAuthProvider } from '../types';

/**
 * Browser localStorage token storage implementation
 *
 * Note: In production, tokens should be encrypted before storage.
 * This implementation stores tokens as JSON for simplicity.
 * For enhanced security, integrate with wallet-derived encryption keys.
 */
export class BrowserTokenStorage implements TokenStorage {
  private readonly prefix = 'ownyou_oauth_';

  /**
   * Create storage key from userId and provider
   */
  private makeKey(userId: string, provider: OAuthProvider): string {
    return `${this.prefix}${userId}_${provider}`;
  }

  async store(userId: string, provider: OAuthProvider, tokens: StoredTokens): Promise<void> {
    const key = this.makeKey(userId, provider);
    const value = JSON.stringify(tokens);

    // In production, encrypt 'value' with wallet-derived key before storing
    localStorage.setItem(key, value);
  }

  async get(userId: string, provider: OAuthProvider): Promise<StoredTokens | null> {
    const key = this.makeKey(userId, provider);
    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    try {
      // In production, decrypt 'value' with wallet-derived key before parsing
      return JSON.parse(value) as StoredTokens;
    } catch {
      // Invalid JSON, remove corrupted entry
      localStorage.removeItem(key);
      return null;
    }
  }

  async delete(userId: string, provider: OAuthProvider): Promise<void> {
    const key = this.makeKey(userId, provider);
    localStorage.removeItem(key);
  }

  async exists(userId: string, provider: OAuthProvider): Promise<boolean> {
    const key = this.makeKey(userId, provider);
    return localStorage.getItem(key) !== null;
  }

  /**
   * Clear all OAuth tokens (useful for logout/testing)
   */
  clearAll(): void {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.prefix));
    keys.forEach((key) => localStorage.removeItem(key));
  }
}
