/**
 * Keychain Token Storage - Sprint 1b
 *
 * OS Keychain-based token storage for Tauri desktop app.
 * Uses Tauri's invoke API to call Rust keychain commands.
 *
 * @see docs/sprints/ownyou-sprint1b-spec.md Section 2
 */

import type { TokenStorage, StoredTokens, OAuthProvider } from '../types';

// Type for Tauri invoke function (dynamically imported)
type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * OS Keychain token storage implementation for Tauri desktop
 *
 * Tokens are securely stored in the operating system's keychain:
 * - macOS: Keychain Access
 * - Windows: Credential Manager
 * - Linux: Secret Service (via libsecret)
 */
export class KeychainTokenStorage implements TokenStorage {
  private invoke: TauriInvoke | null = null;
  private readonly service = 'com.ownyou.oauth';

  /**
   * Get Tauri invoke function (lazy load)
   */
  private async getInvoke(): Promise<TauriInvoke> {
    if (this.invoke) {
      return this.invoke;
    }

    // Dynamic import for Tauri API
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      this.invoke = invoke as TauriInvoke;
      return this.invoke;
    } catch (error) {
      throw new Error(
        'KeychainTokenStorage can only be used in Tauri desktop environment. ' +
          'Use BrowserTokenStorage for browser environments.'
      );
    }
  }

  /**
   * Create keychain account name from userId and provider
   */
  private makeAccount(userId: string, provider: OAuthProvider): string {
    return `${userId}::${provider}`;
  }

  async store(userId: string, provider: OAuthProvider, tokens: StoredTokens): Promise<void> {
    const invoke = await this.getInvoke();
    const account = this.makeAccount(userId, provider);
    const value = JSON.stringify(tokens);

    await invoke('store_oauth_tokens', {
      service: this.service,
      account,
      tokens: value,
    });
  }

  async get(userId: string, provider: OAuthProvider): Promise<StoredTokens | null> {
    const invoke = await this.getInvoke();
    const account = this.makeAccount(userId, provider);

    try {
      const value = await invoke<string | null>('get_oauth_tokens', {
        service: this.service,
        account,
      });

      if (!value) {
        return null;
      }

      return JSON.parse(value) as StoredTokens;
    } catch {
      return null;
    }
  }

  async delete(userId: string, provider: OAuthProvider): Promise<void> {
    const invoke = await this.getInvoke();
    const account = this.makeAccount(userId, provider);

    try {
      await invoke('delete_oauth_tokens', {
        service: this.service,
        account,
      });
    } catch {
      // Ignore errors if token doesn't exist
    }
  }

  async exists(userId: string, provider: OAuthProvider): Promise<boolean> {
    const tokens = await this.get(userId, provider);
    return tokens !== null;
  }
}
