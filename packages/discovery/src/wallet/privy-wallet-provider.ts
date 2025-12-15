/**
 * Privy Wallet Provider - v13 Section 5.2.5 (ADR-001)
 *
 * Integrates Privy wallet for device registration and key derivation.
 * Trust model: Same wallet = same user across devices.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.5
 * @see https://docs.privy.io/wallets/using-wallets/ethereum/sign-a-message
 */

import type { WalletProvider } from '../types.js';

/**
 * Privy hooks interface (injected from React context)
 *
 * This interface represents the wallet functionality from Privy.
 * In a React app, this would come from usePrivy() and useSignMessage() hooks.
 */
export interface PrivyWalletHooks {
  /** Get the currently authenticated user */
  user: {
    wallet?: {
      address: string;
    };
  } | null;
  /** Sign a message with the embedded wallet */
  signMessage: (
    args: { message: string },
    options?: { address?: string }
  ) => Promise<{ signature: string }>;
}

/**
 * Create a Privy wallet provider from React hooks
 *
 * Usage in React component:
 * ```tsx
 * import { usePrivy, useSignMessage } from '@privy-io/react-auth';
 *
 * function MyComponent() {
 *   const { user } = usePrivy();
 *   const { signMessage } = useSignMessage();
 *
 *   const walletProvider = createPrivyWalletProvider({ user, signMessage });
 *   // Use walletProvider for device registration...
 * }
 * ```
 */
export function createPrivyWalletProvider(hooks: PrivyWalletHooks): WalletProvider {
  return {
    async getWalletAddress(): Promise<string> {
      if (!hooks.user?.wallet?.address) {
        throw new Error('No wallet connected. Please connect your Privy wallet first.');
      }
      return hooks.user.wallet.address;
    },

    async signMessage(message: string): Promise<string> {
      if (!hooks.user?.wallet?.address) {
        throw new Error('No wallet connected. Please connect your Privy wallet first.');
      }

      const result = await hooks.signMessage(
        { message },
        { address: hooks.user.wallet.address }
      );

      return result.signature;
    },
  };
}

/**
 * Create a mock wallet provider for testing
 *
 * Generates deterministic addresses and signatures based on a seed.
 */
export function createMockWalletProvider(seed: string): WalletProvider {
  // Generate a deterministic "address" from seed
  const address = `0x${hashString(seed).slice(0, 40)}`;

  return {
    async getWalletAddress(): Promise<string> {
      return address;
    },

    async signMessage(message: string): Promise<string> {
      // Generate a deterministic "signature" from seed + message
      const signatureData = `${seed}:${message}`;
      return `0x${hashString(signatureData)}`;
    },
  };
}

/**
 * Simple hash function for test determinism
 * (Not cryptographically secure - for testing only)
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  // Convert to hex and pad to 64 chars (like a signature)
  const hexHash = Math.abs(hash).toString(16);
  return hexHash.padStart(64, '0').repeat(2).slice(0, 128);
}

/**
 * Validate that a wallet provider is properly configured
 */
export async function validateWalletProvider(
  provider: WalletProvider
): Promise<{ valid: boolean; address?: string; error?: string }> {
  try {
    const address = await provider.getWalletAddress();

    if (!address.startsWith('0x') || address.length !== 42) {
      return { valid: false, error: 'Invalid wallet address format' };
    }

    // Test signing capability
    const testMessage = `OwnYou Wallet Validation: ${Date.now()}`;
    const signature = await provider.signMessage(testMessage);

    if (!signature.startsWith('0x')) {
      return { valid: false, error: 'Invalid signature format' };
    }

    return { valid: true, address };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown validation error',
    };
  }
}
