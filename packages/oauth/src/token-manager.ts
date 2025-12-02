/**
 * Token Manager - Sprint 1b
 *
 * Manages OAuth token lifecycle: storage, retrieval, validation, and refresh.
 * Emits events for token state changes.
 *
 * @see docs/sprints/ownyou-sprint1b-spec.md
 */

import type {
  TokenStorage,
  StoredTokens,
  OAuthProvider,
  TokenManagerEvents,
} from './types';
import { TOKEN_REFRESH_MARGIN_MS } from './types';

/**
 * Event handler type
 */
type EventHandler<T extends keyof TokenManagerEvents> = TokenManagerEvents[T];

/**
 * Token Manager
 *
 * Provides token lifecycle management including:
 * - Storage abstraction (browser localStorage, OS keychain, or in-memory)
 * - Token validity checking
 * - Automatic refresh detection
 * - Event emission for token state changes
 */
export class TokenManager {
  private storage: TokenStorage;
  private eventHandlers: Map<keyof TokenManagerEvents, Set<EventHandler<keyof TokenManagerEvents>>> = new Map();

  constructor(storage: TokenStorage) {
    this.storage = storage;
  }

  /**
   * Store tokens for a user and provider
   */
  async storeTokens(
    userId: string,
    provider: OAuthProvider,
    tokens: StoredTokens
  ): Promise<void> {
    await this.storage.store(userId, provider, tokens);
  }

  /**
   * Get stored tokens for a user and provider
   */
  async getTokens(
    userId: string,
    provider: OAuthProvider
  ): Promise<StoredTokens | null> {
    return await this.storage.get(userId, provider);
  }

  /**
   * Delete stored tokens for a user and provider
   */
  async deleteTokens(userId: string, provider: OAuthProvider): Promise<void> {
    await this.storage.delete(userId, provider);
  }

  /**
   * Check if tokens exist and are not expired
   */
  async isTokenValid(userId: string, provider: OAuthProvider): Promise<boolean> {
    const tokens = await this.storage.get(userId, provider);

    if (!tokens) {
      return false;
    }

    return tokens.expiresAt > Date.now();
  }

  /**
   * Check if tokens need to be refreshed
   * Returns true if tokens are expired or expiring soon (within refresh margin)
   */
  async needsRefresh(userId: string, provider: OAuthProvider): Promise<boolean> {
    const tokens = await this.storage.get(userId, provider);

    if (!tokens) {
      return false;
    }

    const expiresIn = tokens.expiresAt - Date.now();
    return expiresIn < TOKEN_REFRESH_MARGIN_MS;
  }

  /**
   * Check token expiry and emit events if needed
   */
  async checkTokenExpiry(userId: string, provider: OAuthProvider): Promise<void> {
    const tokens = await this.storage.get(userId, provider);

    if (!tokens) {
      return;
    }

    const expiresIn = tokens.expiresAt - Date.now();

    if (expiresIn <= 0) {
      // Token has expired
      return;
    }

    if (expiresIn < TOKEN_REFRESH_MARGIN_MS) {
      // Token is expiring soon, emit event
      this.emit('onTokenExpiring', provider, expiresIn);
    }
  }

  /**
   * Subscribe to token manager events
   *
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<K extends keyof TokenManagerEvents>(
    event: K,
    handler: TokenManagerEvents[K]
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event)!;
    handlers.add(handler as EventHandler<keyof TokenManagerEvents>);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as EventHandler<keyof TokenManagerEvents>);
    };
  }

  /**
   * Emit an event
   */
  private emit<K extends keyof TokenManagerEvents>(
    event: K,
    ...args: Parameters<TokenManagerEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        (handler as (...args: Parameters<TokenManagerEvents[K]>) => void)(...args);
      });
    }
  }

  /**
   * Notify that tokens were refreshed
   */
  notifyTokenRefreshed(provider: OAuthProvider, tokens: StoredTokens): void {
    this.emit('onTokenRefreshed', provider, tokens);
  }

  /**
   * Notify that token refresh failed
   */
  notifyTokenRefreshFailed(provider: OAuthProvider, error: Error): void {
    this.emit('onTokenRefreshFailed', provider, error);
  }
}
