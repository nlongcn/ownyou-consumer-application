/**
 * Ceramic Client Initialization
 *
 * Source: context7 - developers.ceramic.network/docs/protocol/ceramic-one/usage/installation
 * "Sets up a Ceramic client instance to communicate with a running ceramic-one daemon.
 *  The client connects to localhost:5101 by default and can be used to make API calls
 *  to the Ceramic network."
 */

import { CeramicClient } from "@ceramic-sdk/http-client";

export interface CeramicConfig {
  url?: string;
}

/**
 * Initialize Ceramic client connection
 *
 * Based on context7 snippet:
 * ```
 * import { CeramicClient } from "@ceramic-sdk/http-client";
 * const client = new CeramicClient({ url: "http://localhost:5101" });
 * ```
 */
export function createCeramicClient(config: CeramicConfig = {}): CeramicClient {
  const url = config.url || "http://localhost:5101"; // Default from docs

  const client = new CeramicClient({ url });

  return client;
}

/**
 * Verify Ceramic client connection by checking version
 *
 * Based on context7 snippet:
 * ```
 * const response = await client.getVersion();
 * console.log(response.version);
 * ```
 */
export async function verifyCeramicConnection(client: CeramicClient): Promise<string> {
  const response = await client.getVersion();
  return response.version;
}
