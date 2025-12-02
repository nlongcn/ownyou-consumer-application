/**
 * In-Memory Token Storage - Sprint 1b
 *
 * Simple in-memory storage for testing and development.
 * Not persistent across restarts.
 */

import type { TokenStorage, StoredTokens, OAuthProvider } from '../types';

/**
 * In-memory token storage implementation
 * Useful for testing and development environments
 */
export class InMemoryTokenStorage implements TokenStorage {
  private tokens: Map<string, StoredTokens> = new Map();

  /**
   * Create storage key from userId and provider
   */
  private makeKey(userId: string, provider: OAuthProvider): string {
    return `${userId}::${provider}`;
  }

  async store(userId: string, provider: OAuthProvider, tokens: StoredTokens): Promise<void> {
    const key = this.makeKey(userId, provider);
    this.tokens.set(key, { ...tokens });
  }

  async get(userId: string, provider: OAuthProvider): Promise<StoredTokens | null> {
    const key = this.makeKey(userId, provider);
    const tokens = this.tokens.get(key);
    return tokens ? { ...tokens } : null;
  }

  async delete(userId: string, provider: OAuthProvider): Promise<void> {
    const key = this.makeKey(userId, provider);
    this.tokens.delete(key);
  }

  async exists(userId: string, provider: OAuthProvider): Promise<boolean> {
    const key = this.makeKey(userId, provider);
    return this.tokens.has(key);
  }

  /**
   * Clear all stored tokens (useful for testing)
   */
  clear(): void {
    this.tokens.clear();
  }
}
