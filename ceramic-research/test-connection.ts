/**
 * Quick test: Verify ceramic-one daemon connection
 */

import { CeramicClient } from "@ceramic-sdk/http-client";

async function testConnection() {
  try {
    console.log("Connecting to Ceramic daemon at localhost:5101...");

    const client = new CeramicClient({ url: "http://localhost:5101" });

    const response = await client.getVersion();

    console.log("✅ Connection successful!");
    console.log(`Version: ${response.version}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Connection failed:", error);
    process.exit(1);
  }
}

testConnection();
