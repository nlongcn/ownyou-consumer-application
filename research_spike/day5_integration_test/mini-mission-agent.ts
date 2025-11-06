/**
 * Day 5: Mini Mission Agent
 *
 * Simplified Mission Agent that:
 * - Reads IAB classifications from IndexedDBStore
 * - Generates mission cards based on patterns
 * - Stores mission cards in IndexedDBStore
 * - Uses PGlite checkpointer for reasoning state
 *
 * This demonstrates cross-agent memory via Store.
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { PgLiteSaver } from "@steerprotocol/langgraph-checkpoint-pglite";
import { IndexedDBStore } from "../day3-4_custom_indexeddb_store/IndexedDBStore.js";
import "fake-indexeddb/auto";

/**
 * Mission types (simplified for testing)
 */
const MISSION_TYPES = {
  BUDGET_ANALYSIS: "Budget Analysis",
  TRAVEL_PLANNING: "Travel Planning",
  SHOPPING_OPTIMIZATION: "Shopping Optimization",
  HEALTH_TRACKING: "Health Tracking",
  ENTERTAINMENT_DISCOVERY: "Entertainment Discovery",
};

/**
 * State for Mission Generation workflow
 */
const MissionAgentState = Annotation.Root({
  userId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  classifications: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  missionCards: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  generatedCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
});

/**
 * Node: Retrieve IAB classifications from Store
 */
async function retrieveClassificationsNode(
  state: typeof MissionAgentState.State,
  config: any
) {
  const store = config.store as IndexedDBStore;

  console.log(`  📖 Reading IAB classifications for ${state.userId}...`);

  // Retrieve all classifications for user
  const classifications = await store.search([state.userId, "iab_classifications"]);

  console.log(`  ✅ Found ${classifications.length} classifications`);

  return { classifications: classifications.map(item => ({ key: item.key, ...item.value })) };
}

/**
 * Node: Analyze patterns in classifications
 */
function analyzePatternsNode(state: typeof MissionAgentState.State) {
  const classifications = state.classifications;

  console.log(`  🔍 Analyzing patterns in ${classifications.length} classifications...`);

  // Count by category
  const categoryCounts: Record<string, number> = {};
  for (const classification of classifications) {
    const category = classification.category;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }

  console.log(`  📊 Category distribution:`, categoryCounts);

  return { classifications };
}

/**
 * Node: Generate mission cards based on patterns
 */
function generateMissionsNode(state: typeof MissionAgentState.State) {
  const classifications = state.classifications;
  const missionCards = [];

  console.log(`  🎯 Generating mission cards...`);

  // Group by category
  const byCategory: Record<string, any[]> = {};
  for (const classification of classifications) {
    const category = classification.category;
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(classification);
  }

  // Generate missions based on category patterns
  for (const [category, items] of Object.entries(byCategory)) {
    if (items.length >= 1) {
      // Generate mission for this category
      let missionType = "";
      let missionGoal = "";
      let actionItems: string[] = [];

      if (category === "Shopping") {
        missionType = MISSION_TYPES.SHOPPING_OPTIMIZATION;
        missionGoal = "Optimize your shopping habits and track spending";
        actionItems = [
          "Review recent purchases",
          "Identify recurring expenses",
          "Find better deals on common items",
        ];
      } else if (category === "Finance & Banking") {
        missionType = MISSION_TYPES.BUDGET_ANALYSIS;
        missionGoal = "Analyze spending patterns and improve budgeting";
        actionItems = [
          "Categorize transactions",
          "Set spending limits",
          "Track progress toward savings goals",
        ];
      } else if (category === "Travel") {
        missionType = MISSION_TYPES.TRAVEL_PLANNING;
        missionGoal = "Plan and optimize upcoming travel";
        actionItems = [
          "Compile travel confirmations",
          "Create itinerary",
          "Find local recommendations",
        ];
      } else if (category === "Health & Fitness") {
        missionType = MISSION_TYPES.HEALTH_TRACKING;
        missionGoal = "Track health activities and maintain wellness";
        actionItems = [
          "Log health metrics",
          "Schedule checkups",
          "Review fitness progress",
        ];
      } else if (category === "Entertainment") {
        missionType = MISSION_TYPES.ENTERTAINMENT_DISCOVERY;
        missionGoal = "Discover new entertainment based on interests";
        actionItems = [
          "Track watched/attended events",
          "Get personalized recommendations",
          "Plan upcoming entertainment",
        ];
      } else {
        continue; // Skip categories without mission templates
      }

      const missionCard = {
        type: missionType,
        category,
        goal: missionGoal,
        actionItems,
        priority: items.length > 2 ? "high" : "medium",
        status: "active",
        evidenceCount: items.length,
        createdAt: new Date().toISOString(),
      };

      missionCards.push(missionCard);

      console.log(`  ✅ Generated mission: ${missionType} (${items.length} evidence items)`);
    }
  }

  return { missionCards, generatedCount: missionCards.length };
}

/**
 * Node: Store mission cards in Store
 */
async function storeMissionsNode(
  state: typeof MissionAgentState.State,
  config: any
) {
  const store = config.store as IndexedDBStore;

  console.log(`  💾 Storing ${state.missionCards.length} mission cards...`);

  for (let i = 0; i < state.missionCards.length; i++) {
    const mission = state.missionCards[i];
    const missionId = `mission_${Date.now()}_${i}`;

    await store.put(
      [state.userId, "mission_cards"],
      missionId,
      mission
    );

    console.log(`  💾 Stored: ${mission.type}`);
  }

  console.log(`  ✅ All missions stored`);

  return { missionCards: state.missionCards };
}

/**
 * Create Mission Agent StateGraph
 */
export function createMissionAgent(checkpointer: any, store: IndexedDBStore) {
  const graph = new StateGraph(MissionAgentState)
    .addNode("retrieve_classifications", retrieveClassificationsNode)
    .addNode("analyze_patterns", analyzePatternsNode)
    .addNode("generate_missions", generateMissionsNode)
    .addNode("store_missions", storeMissionsNode)
    .addEdge(START, "retrieve_classifications")
    .addEdge("retrieve_classifications", "analyze_patterns")
    .addEdge("analyze_patterns", "generate_missions")
    .addEdge("generate_missions", "store_missions")
    .addEdge("store_missions", END);

  return graph.compile({ checkpointer, store });
}

/**
 * Test Mission Agent
 */
export async function testMissionAgent(existingStore?: IndexedDBStore) {
  console.log("\n=== Mini Mission Agent Test ===\n");

  // Setup persistence
  const checkpointer = new PgLiteSaver("file://.pglite_day5_test");
  await checkpointer.setup();

  const store = existingStore || new IndexedDBStore("test-mission-agent");

  // Create mission agent
  const missionAgent = createMissionAgent(checkpointer, store);

  console.log("Generating missions for user_123...\n");

  const result = await missionAgent.invoke(
    { userId: "user_123" },
    {
      configurable: { thread_id: "mission_generation_1" },
    }
  );

  console.log(`\n✅ Generated ${result.generatedCount} mission cards`);
  console.log(`\nMission Cards:`);
  for (const mission of result.missionCards) {
    console.log(`\n  📋 ${mission.type}`);
    console.log(`     Goal: ${mission.goal}`);
    console.log(`     Priority: ${mission.priority}`);
    console.log(`     Evidence: ${mission.evidenceCount} items`);
    console.log(`     Actions: ${mission.actionItems.length} items`);
  }

  // Verify stored missions
  console.log("\n\nVerifying stored missions...\n");

  const storedMissions = await store.search(["user_123", "mission_cards"]);

  console.log(`Found ${storedMissions.length} stored missions:`);
  for (const item of storedMissions) {
    console.log(`  - ${item.key}: ${item.value.type} (${item.value.status})`);
  }

  if (!existingStore) {
    store.stop();
  }

  return storedMissions;
}
