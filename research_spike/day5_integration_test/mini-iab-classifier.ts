/**
 * Day 5: Mini IAB Classifier Agent
 *
 * Simplified IAB classification agent that:
 * - Takes email text as input
 * - Classifies into IAB category (rule-based for testing)
 * - Stores classification in IndexedDBStore
 * - Uses PGlite checkpointer for state
 *
 * This demonstrates Store (long-term) + Checkpointer (short-term) integration.
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { PgLiteSaver } from "@steerprotocol/langgraph-checkpoint-pglite";
import { IndexedDBStore } from "../day3-4_custom_indexeddb_store/IndexedDBStore.js";
import "fake-indexeddb/auto";

/**
 * IAB Taxonomy categories (simplified for testing)
 */
const IAB_CATEGORIES = {
  SHOPPING: "Shopping",
  FINANCE: "Finance & Banking",
  TRAVEL: "Travel",
  FOOD: "Food & Dining",
  HEALTH: "Health & Fitness",
  ENTERTAINMENT: "Entertainment",
  TECHNOLOGY: "Technology & Computing",
  BUSINESS: "Business & Industrial",
  OTHER: "Uncategorized",
};

/**
 * State for IAB Classification workflow
 */
const IABClassifierState = Annotation.Root({
  emailText: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  emailId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  userId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  category: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  confidence: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  classification: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
});

/**
 * Node: Extract features from email text
 */
function extractFeaturesNode(state: typeof IABClassifierState.State) {
  // Simple keyword extraction for testing
  const text = state.emailText.toLowerCase();

  console.log(`  📧 Processing email: "${state.emailText.substring(0, 50)}..."`);

  return { emailText: state.emailText };
}

/**
 * Node: Classify email into IAB category
 * (Rule-based for testing - in production would use LLM)
 */
function classifyNode(state: typeof IABClassifierState.State) {
  const text = state.emailText.toLowerCase();

  let category = IAB_CATEGORIES.OTHER;
  let confidence = 0.5;

  // Rule-based classification (testing only)
  if (text.includes("order") || text.includes("shipped") || text.includes("delivery") || text.includes("purchase")) {
    category = IAB_CATEGORIES.SHOPPING;
    confidence = 0.95;
  } else if (text.includes("bank") || text.includes("account") || text.includes("payment") || text.includes("transaction")) {
    category = IAB_CATEGORIES.FINANCE;
    confidence = 0.92;
  } else if (text.includes("flight") || text.includes("hotel") || text.includes("booking") || text.includes("reservation")) {
    category = IAB_CATEGORIES.TRAVEL;
    confidence = 0.90;
  } else if (text.includes("restaurant") || text.includes("recipe") || text.includes("menu") || text.includes("dining")) {
    category = IAB_CATEGORIES.FOOD;
    confidence = 0.88;
  } else if (text.includes("doctor") || text.includes("health") || text.includes("fitness") || text.includes("medical")) {
    category = IAB_CATEGORIES.HEALTH;
    confidence = 0.87;
  } else if (text.includes("movie") || text.includes("concert") || text.includes("show") || text.includes("event")) {
    category = IAB_CATEGORIES.ENTERTAINMENT;
    confidence = 0.85;
  } else if (text.includes("software") || text.includes("app") || text.includes("tech") || text.includes("computer")) {
    category = IAB_CATEGORIES.TECHNOLOGY;
    confidence = 0.86;
  } else if (text.includes("meeting") || text.includes("contract") || text.includes("business") || text.includes("invoice")) {
    category = IAB_CATEGORIES.BUSINESS;
    confidence = 0.84;
  }

  console.log(`  🏷️  Classified as: ${category} (confidence: ${confidence})`);

  return {
    category,
    confidence,
  };
}

/**
 * Node: Store classification in IndexedDBStore
 */
async function storeClassificationNode(
  state: typeof IABClassifierState.State,
  config: any
) {
  const store = config.store as IndexedDBStore;

  const classification = {
    category: state.category,
    confidence: state.confidence,
    emailText: state.emailText.substring(0, 100), // Store preview
    timestamp: new Date().toISOString(),
    source: "email",
  };

  // Store in hierarchical namespace
  await store.put(
    [state.userId, "iab_classifications"],
    state.emailId,
    classification
  );

  console.log(`  💾 Stored classification: ${state.userId}/iab_classifications/${state.emailId}`);

  return { classification };
}

/**
 * Create IAB Classifier StateGraph
 */
export function createIABClassifier(checkpointer: any, store: IndexedDBStore) {
  const graph = new StateGraph(IABClassifierState)
    .addNode("extract_features", extractFeaturesNode)
    .addNode("classify", classifyNode)
    .addNode("store_classification", storeClassificationNode)
    .addEdge(START, "extract_features")
    .addEdge("extract_features", "classify")
    .addEdge("classify", "store_classification")
    .addEdge("store_classification", END);

  return graph.compile({ checkpointer, store });
}

/**
 * Test IAB Classifier
 */
export async function testIABClassifier() {
  console.log("\n=== Mini IAB Classifier Test ===\n");

  // Setup persistence
  const checkpointer = new PgLiteSaver("file://.pglite_day5_test");
  await checkpointer.setup();

  const store = new IndexedDBStore("test-iab-classifier");

  // Create classifier
  const classifier = createIABClassifier(checkpointer, store);

  // Test emails
  const testEmails = [
    {
      id: "email_1",
      text: "Your Amazon order has been shipped! Track your delivery here.",
    },
    {
      id: "email_2",
      text: "Your bank account statement is ready. View your recent transactions.",
    },
    {
      id: "email_3",
      text: "Your flight booking is confirmed. Check-in opens 24 hours before departure.",
    },
  ];

  console.log("Processing 3 test emails...\n");

  for (const email of testEmails) {
    console.log(`Email ${email.id}:`);

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

    console.log(`  ✅ Result: ${result.category} (${result.confidence})`);
    console.log();
  }

  // Verify stored classifications
  console.log("Verifying stored classifications...\n");

  const storedClassifications = await store.search(
    ["user_123", "iab_classifications"]
  );

  console.log(`Found ${storedClassifications.length} stored classifications:`);
  for (const item of storedClassifications) {
    console.log(`  - ${item.key}: ${item.value.category} (${item.value.confidence})`);
  }

  // Cleanup
  store.stop();

  return storedClassifications;
}
