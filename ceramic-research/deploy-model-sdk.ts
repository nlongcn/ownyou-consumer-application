/**
 * Deploy MissionCard Model using @ceramic-sdk (ceramic-one compatible)
 *
 * Source: context7 - developers.ceramic.network/docs/protocol/ceramic-one/usage/produce
 * Uses ModelClient.createDefinition() from @ceramic-sdk/model-client
 */

import { CeramicClient } from "@ceramic-sdk/http-client";
import { ModelClient } from "@ceramic-sdk/model-client";
import type { ModelDefinition } from "@ceramic-sdk/model-protocol";
import { getAuthenticatedDID } from "@didtools/key-did";
import { writeFileSync } from "fs";
import { generateTestSeed } from "./src/client/wallet-did.js";

async function deployModel() {
  console.log("🚀 Deploying MissionCard model to Ceramic (ceramic-one)...\n");

  try {
    // 1. Generate admin DID
    console.log("1. Generating admin DID...");
    const seed = generateTestSeed();

    // Save seed for later use
    writeFileSync("./admin-seed.txt", Buffer.from(seed).toString("hex"));
    console.log("   ✓ Seed saved to admin-seed.txt");

    const authenticatedDID = await getAuthenticatedDID(seed);
    console.log(`   ✓ Admin DID: ${authenticatedDID.id}\n`);

    // 2. Connect to Ceramic
    console.log("2. Connecting to Ceramic...");
    const ceramic = new CeramicClient({ url: "http://localhost:5101" });
    console.log("   ✓ Connected\n");

    // 3. Create ModelClient
    console.log("3. Creating ModelClient...");
    const modelClient = new ModelClient({
      ceramic,
      did: authenticatedDID,
    });
    console.log("   ✓ ModelClient created\n");

    // 4. Define MissionCard model schema
    // Source: context7 - Model definition with JSON schema
    console.log("4. Defining MissionCard model schema...");
    const model: ModelDefinition = {
      version: "2.0",
      name: "MissionCard",
      description: "OwnYou mission card for user goals",
      accountRelation: { type: "list" }, // Multiple mission cards per user
      interface: false,
      implements: [],
      schema: {
        type: "object",
        properties: {
          missionId: { type: "string", maxLength: 200 },
          title: { type: "string", maxLength: 200 },
          status: {
            type: "string",
            enum: ["ACTIVE", "COMPLETED", "DISMISSED"]
          },
          createdAt: { type: "number" }, // Unix timestamp
          completedAt: { type: "number" }, // Unix timestamp (optional)
          steps: {
            type: "array",
            maxItems: 50,
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                title: { type: "string", maxLength: 200 },
                completed: { type: "boolean" }
              },
              required: ["id", "title", "completed"]
            }
          }
        },
        required: ["missionId", "title", "status", "createdAt", "steps"],
        additionalProperties: false,
      },
    };
    console.log("   ✓ Schema defined\n");

    // 5. Create the Model Stream
    console.log("5. Creating model stream...");
    const modelStream = await modelClient.createDefinition(model);
    console.log(`   ✓ Model Stream created: ${modelStream.toString()}\n`);

    // 6. Save StreamID for experiments
    writeFileSync("./mission-card-stream-id.txt", modelStream.toString());
    console.log("   ✓ StreamID saved to mission-card-stream-id.txt\n");

    console.log("✅ Deployment complete!");
    console.log("\n📝 Model StreamID:");
    console.log(`   ${modelStream.toString()}`);
    console.log("\n📝 Next steps:");
    console.log("   1. Use this StreamID in experiments");
    console.log("   2. Run Experiment 1 to measure latency");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

deployModel();
