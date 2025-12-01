/**
 * XMTP Client Setup for Mission Card Sync Evaluation
 *
 * Source: context7 - /websites/xmtp
 * - Node SDK initialization
 * - Wallet-based authentication
 * - Message sending/receiving
 */

import { Client, type Signer, IdentifierKind } from '@xmtp/node-sdk';
import { Wallet } from 'ethers';
import { getRandomValues } from 'node:crypto';

export interface XMTPConfig {
  env?: 'local' | 'dev' | 'production';
  appVersion?: string;
  dbPath?: string | null;
}

/**
 * Create Ethereum wallet signer for XMTP
 *
 * Source: context7 - XMTP Node SDK Quickstart
 */
export function createWalletSigner(privateKey?: string): Signer {
  // Generate random wallet if no private key provided
  const wallet = privateKey
    ? new Wallet(privateKey)
    : Wallet.createRandom();

  // Create XMTP-compatible signer
  // Source: context7 - identifierKind: IdentifierKind.Ethereum
  const signer: Signer = {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: wallet.address,
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const signature = await wallet.signMessage(message);
      // Convert hex string to Uint8Array
      return new Uint8Array(Buffer.from(signature.slice(2), 'hex'));
    },
  };

  return signer;
}

/**
 * Create XMTP client for mission card sync
 *
 * Source: context7 - Client.create() from '@xmtp/node-sdk'
 */
export async function createXMTPClient(
  signer: Signer,
  config: XMTPConfig = {}
): Promise<Client> {
  const {
    env = 'dev',
    appVersion = 'ownyou-evaluation/1.0',
    dbPath = null, // No persistence for testing
  } = config;

  // Generate encryption key for local DB
  // Source: context7 - getRandomValues(new Uint8Array(32))
  const dbEncryptionKey = getRandomValues(new Uint8Array(32));

  // Create XMTP client
  // Source: context7 - Client.create(signer, { dbEncryptionKey })
  const client = await Client.create(signer, {
    env,
    appVersion,
    dbPath,
    dbEncryptionKey,
  });

  return client;
}

/**
 * Get or create conversation with another wallet
 *
 * Source: context7 - client.conversations.newDm()
 */
export async function getOrCreateConversation(
  client: Client,
  recipientInboxId: string
) {
  // For evaluation, we'll use DMs (direct messages)
  // Source: context7 - await client.conversations.newDm(inboxId)
  const dm = await client.conversations.newDm(recipientInboxId);
  return dm;
}
