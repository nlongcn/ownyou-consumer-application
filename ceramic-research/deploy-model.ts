/**
 * Deploy MissionCard Model to Ceramic
 *
 * Source: context7 - developers.ceramic.network/docs/composedb/guides/data-modeling/composites
 * Uses createComposite() and writeEncodedComposite() from @composedb/devtools-node
 */

import { CeramicClient } from "@ceramicnetwork/http-client";
import { DID } from "dids";
import { Ed25519Provider } from "key-did-provider-ed25519";
import { getResolver } from "key-did-resolver";
import { createComposite, writeEncodedComposite } from "@composedb/devtools-node";
import { readFileSync, writeFileSync } from "fs";
import { generateTestSeed } from "./src/client/wallet-did.js";

async function deployModel() {
  console.log("🚀 Deploying MissionCard model to Ceramic...\n");

  try {
    // 1. Generate admin DID
    console.log("1. Generating admin DID...");
    const seed = generateTestSeed();

    // Save seed for later use
    writeFileSync("./admin-seed.txt", Buffer.from(seed).toString("hex"));
    console.log("   ✓ Seed saved to admin-seed.txt");

    const provider = new Ed25519Provider(seed);
    const did = new DID({
      resolver: getResolver(),
      provider,
    });
    await did.authenticate();
    console.log(`   ✓ Admin DID: ${did.id}\n`);

    // 2. Connect to Ceramic
    console.log("2. Connecting to Ceramic...");
    const ceramic = new CeramicClient("http://localhost:5101");
    ceramic.did = did;
    console.log("   ✓ Connected\n");

    // 3. Create composite from schema
    console.log("3. Creating composite from GraphQL schema...");
    const composite = await createComposite(
      ceramic,
      "./src/models/mission-card.graphql"
    );
    console.log("   ✓ Composite created\n");

    // 4. Write encoded composite
    console.log("4. Writing encoded composite...");
    await writeEncodedComposite(composite, "./mission-card-composite.json");
    console.log("   ✓ Saved to mission-card-composite.json\n");

    // 5. Extract model StreamIDs
    console.log("5. Model StreamIDs:");
    const models = composite.toRuntime().models;
    Object.entries(models).forEach(([name, definition]: [string, any]) => {
      console.log(`   ${name}: ${definition.id}`);

      // Save the MissionCard StreamID for experiments
      if (name === "MissionCard") {
        writeFileSync("./mission-card-stream-id.txt", definition.id);
      }
    });

    console.log("\n✅ Deployment complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. Use the StreamID in experiments");
    console.log("   2. Run experiments to measure latency");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

deployModel();
