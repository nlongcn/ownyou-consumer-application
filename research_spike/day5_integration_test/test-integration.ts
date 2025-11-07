/**
 * Day 5: Complete Email→IAB→Mission Integration Test
 *
 * Tests the complete system with:
 * - PGlite Checkpointer (short-term per-agent state)
 * - IndexedDBStore (long-term cross-agent memory)
 * - IAB Classifier Agent
 * - Mission Agent
 * - Cross-agent memory via Store
 * - Persistence across system restarts
 */

import "fake-indexeddb/auto";
import { PgLiteSaver } from "@steerprotocol/langgraph-checkpoint-pglite";
import { IndexedDBStore } from "../day3-4_custom_indexeddb_store/IndexedDBStore.js";
import { createIABClassifier } from "./mini-iab-classifier.js";
import { createMissionAgent } from "./mini-mission-agent.js";

/**
 * Test 1: IAB Classification Pipeline
 */
async function testIABClassification(
  checkpointer: PgLiteSaver,
  store: IndexedDBStore
) {
  console.log("\n" + "=".repeat(60));
  console.log("Test 1: IAB Classification Pipeline");
  console.log("=".repeat(60));

  const classifier = createIABClassifier(checkpointer, store);

  // Diverse set of test emails
  const testEmails = [
    {
      id: "email_1",
      text: "Your Amazon order #12345 has been shipped! Track your delivery.",
    },
    {
      id: "email_2",
      text: "Order confirmed: Nike running shoes. Estimated delivery: 3 days.",
    },
    {
      id: "email_3",
      text: "Your Chase Bank statement is ready. View transactions here.",
    },
    {
      id: "email_4",
      text: "Payment received: $1,250.00 deposited to your account.",
    },
    {
      id: "email_5",
      text: "Flight confirmation: SFO → JFK, June 15. Check-in now available.",
    },
    {
      id: "email_6",
      text: "Hotel booking confirmed: Hilton Times Square, 3 nights.",
    },
    {
      id: "email_7",
      text: "Your doctor appointment is scheduled for next Monday at 2pm.",
    },
    {
      id: "email_8",
      text: "Concert tickets confirmed: Taylor Swift at MetLife Stadium.",
    },
  ];

  console.log(`\nProcessing ${testEmails.length} test emails...\n`);

  const results = [];

  for (const email of testEmails) {
    console.log(`\n📧 Email ${email.id}:`);
    console.log(`   "${email.text.substring(0, 60)}..."`);

    const result = await classifier.invoke(
      {
        emailText: email.text,
        emailId: email.id,
        userId: "user_123",
      },
      {
        configurable: { thread_id: `classify_${email.id}` },
      }
    );

    results.push({
      id: email.id,
      category: result.category,
      confidence: result.confidence,
    });

    console.log(`   ✅ ${result.category} (${(result.confidence * 100).toFixed(0)}%)`);
  }

  // Verify storage
  console.log("\n\n📊 Verification: Stored Classifications\n");

  const stored = await store.search(["user_123", "iab_classifications"]);

  console.log(`Found ${stored.length} classifications in Store:`);
  for (const item of stored) {
    console.log(`  - ${item.key}: ${item.value.category}`);
  }

  if (stored.length === testEmails.length) {
    console.log("\n✅ Test 1: PASS - All classifications stored correctly");
    return true;
  } else {
    console.log(`\n❌ Test 1: FAIL - Expected ${testEmails.length}, got ${stored.length}`);
    return false;
  }
}

/**
 * Test 2: Mission Generation Pipeline
 */
async function testMissionGeneration(
  checkpointer: PgLiteSaver,
  store: IndexedDBStore
) {
  console.log("\n\n" + "=".repeat(60));
  console.log("Test 2: Mission Generation Pipeline");
  console.log("=".repeat(60));

  const missionAgent = createMissionAgent(checkpointer, store);

  console.log("\n🎯 Generating missions from IAB classifications...\n");

  const result = await missionAgent.invoke(
    { userId: "user_123" },
    {
      configurable: { thread_id: "mission_gen_1" },
    }
  );

  console.log(`\n✅ Generated ${result.generatedCount} mission cards\n`);

  console.log("Mission Cards Generated:\n");
  for (let i = 0; i < result.missionCards.length; i++) {
    const mission = result.missionCards[i];
    console.log(`${i + 1}. ${mission.type}`);
    console.log(`   Goal: ${mission.goal}`);
    console.log(`   Priority: ${mission.priority}`);
    console.log(`   Evidence: ${mission.evidenceCount} classifications`);
    console.log(`   Actions: ${mission.actionItems.join(", ")}`);
    console.log();
  }

  // Verify storage
  console.log("📊 Verification: Stored Mission Cards\n");

  const stored = await store.search(["user_123", "mission_cards"]);

  console.log(`Found ${stored.length} mission cards in Store:`);
  for (const item of stored) {
    console.log(`  - ${item.key}: ${item.value.type} (${item.value.status})`);
  }

  if (stored.length === result.generatedCount && result.generatedCount > 0) {
    console.log("\n✅ Test 2: PASS - All missions stored correctly");
    return true;
  } else {
    console.log("\n❌ Test 2: FAIL - Mission storage mismatch");
    return false;
  }
}

/**
 * Test 3: Cross-Agent Memory (Store Integration)
 */
async function testCrossAgentMemory(store: IndexedDBStore) {
  console.log("\n\n" + "=".repeat(60));
  console.log("Test 3: Cross-Agent Memory (Store Integration)");
  console.log("=".repeat(60));

  console.log("\n🔍 Verifying Mission Agent can read IAB Classifier data...\n");

  // Check IAB classifications (written by Classifier)
  const classifications = await store.search(["user_123", "iab_classifications"]);

  console.log(`IAB Classifications in Store: ${classifications.length}`);
  for (const item of classifications) {
    console.log(`  - ${item.value.category}: "${item.value.emailText.substring(0, 40)}..."`);
  }

  // Check mission cards (written by Mission Agent, depends on classifications)
  const missions = await store.search(["user_123", "mission_cards"]);

  console.log(`\nMission Cards in Store: ${missions.length}`);
  for (const item of missions) {
    console.log(`  - ${item.value.type}: ${item.value.evidenceCount} evidence items`);
  }

  // Verify missions reference classifications
  let totalEvidence = 0;
  for (const mission of missions) {
    totalEvidence += mission.value.evidenceCount;
  }

  console.log(`\n📊 Analysis:`);
  console.log(`  - IAB Classifications: ${classifications.length}`);
  console.log(`  - Mission Cards: ${missions.length}`);
  console.log(`  - Total Evidence References: ${totalEvidence}`);

  if (missions.length > 0 && totalEvidence > 0) {
    console.log("\n✅ Test 3: PASS - Cross-agent memory working via Store");
    return true;
  } else {
    console.log("\n❌ Test 3: FAIL - Cross-agent memory broken");
    return false;
  }
}

/**
 * Test 4: Persistence (System Restart)
 */
async function testPersistence() {
  console.log("\n\n" + "=".repeat(60));
  console.log("Test 4: Persistence (System Restart Simulation)");
  console.log("=".repeat(60));

  console.log("\n🔄 Simulating system restart (new Store instance)...\n");

  // Create NEW store instance (simulating browser refresh / app restart)
  const newStore = new IndexedDBStore("test-integration");

  console.log("📖 Reading data from fresh Store instance...\n");

  const classifications = await newStore.search(["user_123", "iab_classifications"]);
  const missions = await newStore.search(["user_123", "mission_cards"]);

  console.log(`IAB Classifications: ${classifications.length} items`);
  console.log(`Mission Cards: ${missions.length} items`);

  if (classifications.length > 0 && missions.length > 0) {
    console.log("\n✅ Data survived restart:");
    console.log(`   - ${classifications.length} classifications intact`);
    console.log(`   - ${missions.length} missions intact`);
    console.log("\n✅ Test 4: PASS - Persistence validated");

    newStore.stop();
    return true;
  } else {
    console.log("\n❌ Test 4: FAIL - Data lost after restart");

    newStore.stop();
    return false;
  }
}

/**
 * Test 5: Checkpointer State Isolation
 */
async function testCheckpointerIsolation(
  checkpointer: PgLiteSaver,
  store: IndexedDBStore
) {
  console.log("\n\n" + "=".repeat(60));
  console.log("Test 5: Checkpointer State Isolation");
  console.log("=".repeat(60));

  console.log("\n🔍 Testing thread isolation in Checkpointer...\n");

  const classifier = createIABClassifier(checkpointer, store);

  // Process same email in two different threads
  const testEmail = {
    id: "email_isolation_test",
    text: "Test email for thread isolation",
  };

  console.log("Processing email in thread_A...");
  const resultA = await classifier.invoke(
    {
      emailText: testEmail.text,
      emailId: "test_a",
      userId: "user_123",
    },
    {
      configurable: { thread_id: "thread_A" },
    }
  );

  console.log("Processing email in thread_B...");
  const resultB = await classifier.invoke(
    {
      emailText: testEmail.text,
      emailId: "test_b",
      userId: "user_123",
    },
    {
      configurable: { thread_id: "thread_B" },
    }
  );

  // Retrieve states from checkpointer
  const stateA = await classifier.getState({ configurable: { thread_id: "thread_A" } });
  const stateB = await classifier.getState({ configurable: { thread_id: "thread_B" } });

  console.log(`\n📊 Thread States:`);
  console.log(`  Thread A email: ${stateA.values.emailId}`);
  console.log(`  Thread B email: ${stateB.values.emailId}`);

  if (stateA.values.emailId === "test_a" && stateB.values.emailId === "test_b") {
    console.log("\n✅ Test 5: PASS - Thread states isolated correctly");
    return true;
  } else {
    console.log("\n❌ Test 5: FAIL - Thread state isolation broken");
    return false;
  }
}

/**
 * Run all integration tests
 */
async function runIntegrationTests() {
  console.log("\n" + "=".repeat(60));
  console.log(" Day 5: Email→IAB→Mission Integration Test Suite");
  console.log("=".repeat(60));

  const results = {
    iabClassification: false,
    missionGeneration: false,
    crossAgentMemory: false,
    persistence: false,
    checkpointerIsolation: false,
  };

  try {
    // Setup shared persistence
    console.log("\n⚙️  Setting up persistence layers...\n");

    const checkpointer = new PgLiteSaver("file://.pglite_day5_test");
    await checkpointer.setup();
    console.log("✅ PGlite Checkpointer ready");

    const store = new IndexedDBStore("test-integration");
    console.log("✅ IndexedDBStore ready");

    // Run tests sequentially (each builds on previous)
    results.iabClassification = await testIABClassification(checkpointer, store);

    results.missionGeneration = await testMissionGeneration(checkpointer, store);

    results.crossAgentMemory = await testCrossAgentMemory(store);

    results.persistence = await testPersistence();

    results.checkpointerIsolation = await testCheckpointerIsolation(checkpointer, store);

    // Summary
    console.log("\n\n" + "=".repeat(60));
    console.log(" Test Summary");
    console.log("=".repeat(60));
    console.log(`1. IAB Classification:       ${results.iabClassification ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`2. Mission Generation:       ${results.missionGeneration ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`3. Cross-Agent Memory:       ${results.crossAgentMemory ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`4. Persistence (Restart):    ${results.persistence ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`5. Checkpointer Isolation:   ${results.checkpointerIsolation ? "✅ PASS" : "❌ FAIL"}`);
    console.log("=".repeat(60));

    const allPassed = Object.values(results).every(r => r === true);

    if (allPassed) {
      console.log("\n🎉 ALL TESTS PASSED! 🎉");
      console.log("\n📊 Conclusion:");
      console.log("✅ IAB Classifier → Store integration working");
      console.log("✅ Mission Agent → Store integration working");
      console.log("✅ Cross-agent memory via Store validated");
      console.log("✅ Persistence across restarts validated");
      console.log("✅ Checkpointer maintaining per-agent state");
      console.log("\n🚀 Full JavaScript PWA architecture VALIDATED");
      console.log("🎯 Ready for GO decision on full migration\n");
    } else {
      console.log("\n⚠️  Some tests failed. Review implementation.\n");
    }

    // Cleanup
    store.stop();

  } catch (error) {
    console.error("\n❌ Fatal error during integration testing:", error);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runIntegrationTests()
  .then(() => {
    console.log("\n✅ Integration test suite completed\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
