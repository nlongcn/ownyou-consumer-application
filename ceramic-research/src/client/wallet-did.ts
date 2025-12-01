/**
 * Wallet-based DID Authentication for Ceramic
 *
 * Source: context7 - developers.ceramic.network/docs/protocol/ceramic-one/usage/produce
 * "This snippet demonstrates how to interact with MIDs using the Ceramic SDK in JavaScript.
 *  Dependencies include @ceramic-sdk/http-client, @ceramic-sdk/model-instance-client,
 *  @didtools/key-did, and @ceramic-sdk/identifiers."
 */

import { getAuthenticatedDID } from "@didtools/key-did";
import type { DID } from "dids";

/**
 * Create and authenticate a DID from a seed
 *
 * Based on context7 snippet:
 * ```
 * import { getAuthenticatedDID } from "@didtools/key-did";
 * const authenticatedDID = await getAuthenticatedDID(new Uint8Array(32));
 * ```
 *
 * @param seed - 32-byte seed for DID generation (Uint8Array)
 * @returns Authenticated DID instance
 */
export async function createAuthenticatedDID(seed: Uint8Array): Promise<DID> {
  if (seed.length !== 32) {
    throw new Error("Seed must be a 32-byte Uint8Array");
  }

  // Per context7 docs: getAuthenticatedDID handles provider setup and authentication
  const authenticatedDID = await getAuthenticatedDID(seed);

  return authenticatedDID;
}

/**
 * Generate a random 32-byte seed for testing
 * NOTE: For production, use wallet-derived seeds
 */
export function generateTestSeed(): Uint8Array {
  // For research/testing only - use crypto.randomBytes or wallet derivation in production
  const seed = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(seed);
  } else {
    // Node.js fallback
    const { randomBytes } = require("crypto");
    seed.set(randomBytes(32));
  }
  return seed;
}
