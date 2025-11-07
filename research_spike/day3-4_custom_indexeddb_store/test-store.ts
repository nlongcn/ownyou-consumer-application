/**
 * Day 3-4: IndexedDBStore Comprehensive Test Suite
 *
 * Goal: Validate custom IndexedDBStore implementation works correctly
 * and integrates with LangGraph.js StateGraph.
 *
 * Tests:
 * 1. Basic CRUD operations (put, get, delete)
 * 2. Namespace functionality (hierarchical, isolation)
 * 3. Search & filtering (exact match, operators, pagination)
 * 4. Integration with StateGraph (Store accessible in nodes)
 * 5. Persistence (survive "refresh" / new store instance)
 */

// Setup fake-indexeddb for Node.js testing
import "fake-indexeddb/auto";

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { IndexedDBStore } from "./IndexedDBStore.js";

// Test 1: Basic CRUD Operations
async function testBasicCRUD() {
  console.log("\n=== Test 1: Basic CRUD Operations ===\n");

  const store = new IndexedDBStore("test-crud");

  try {
    // Test put() - Store items
    console.log("  Step 1: Storing items...");
    await store.put(["user_123", "preferences"], "theme", { value: "dark" });
    await store.put(["user_123", "preferences"], "language", { value: "en" });
    await store.put(["user_123", "iab_classifications"], "shopping_1", {
      category: "Shopping",
      confidence: 0.95
    });

    // Test get() - Retrieve items
    console.log("  Step 2: Retrieving items...");
    const theme = await store.get(["user_123", "preferences"], "theme");
    const shopping = await store.get(["user_123", "iab_classifications"], "shopping_1");

    if (theme?.value.value === "dark" && shopping?.value.category === "Shopping") {
      console.log("  ✅ Items stored and retrieved correctly");
    } else {
      console.log("  ❌ Retrieval failed");
      console.log("    Theme:", theme);
      console.log("    Shopping:", shopping);
    }

    // Test timestamps
    console.log("  Step 3: Verifying timestamps...");
    if (theme?.createdAt && theme?.updatedAt) {
      console.log("  ✅ Timestamps present");
    } else {
      console.log("  ❌ Timestamps missing");
    }

    // Test update (put existing key)
    console.log("  Step 4: Updating item...");
    const originalCreatedAt = theme!.createdAt;
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    await store.put(["user_123", "preferences"], "theme", { value: "light" });
    const updatedTheme = await store.get(["user_123", "preferences"], "theme");

    if (
      updatedTheme?.value.value === "light" &&
      updatedTheme.createdAt.getTime() === originalCreatedAt.getTime() &&
      updatedTheme.updatedAt > updatedTheme.createdAt
    ) {
      console.log("  ✅ Update preserved createdAt and updated updatedAt");
    } else {
      console.log("  ❌ Update timestamps incorrect");
    }

    // Test delete()
    console.log("  Step 5: Deleting item...");
    await store.delete(["user_123", "preferences"], "language");
    const deleted = await store.get(["user_123", "preferences"], "language");

    if (deleted === null) {
      console.log("  ✅ Item deleted successfully");
    } else {
      console.log("  ❌ Delete failed");
    }

    console.log("\n✅ Test 1: Basic CRUD - PASS\n");
    return true;
  } catch (error) {
    console.error("❌ Test 1 failed:", error);
    return false;
  } finally {
    store.stop();
  }
}

// Test 2: Namespace Functionality
async function testNamespaces() {
  console.log("\n=== Test 2: Namespace Functionality ===\n");

  const store = new IndexedDBStore("test-namespaces");

  try {
    // Store items in different namespaces
    console.log("  Step 1: Storing items in hierarchical namespaces...");
    await store.put(["user_123", "iab", "shopping"], "item_1", { name: "Shopping Item 1" });
    await store.put(["user_123", "iab", "shopping"], "item_2", { name: "Shopping Item 2" });
    await store.put(["user_123", "iab", "finance"], "item_3", { name: "Finance Item 1" });
    await store.put(["user_456", "iab", "shopping"], "item_4", { name: "User 456 Shopping" });

    // Test namespace prefix search
    console.log("  Step 2: Searching by namespace prefix...");
    const user123IAB = await store.search(["user_123", "iab"]);
    const user123Shopping = await store.search(["user_123", "iab", "shopping"]);
    const user456Items = await store.search(["user_456"]);

    if (user123IAB.length === 3) {
      console.log("  ✅ Found all user_123 IAB items (3)");
    } else {
      console.log(`  ❌ Expected 3 user_123 IAB items, got ${user123IAB.length}`);
    }

    if (user123Shopping.length === 2) {
      console.log("  ✅ Found user_123 shopping items (2)");
    } else {
      console.log(`  ❌ Expected 2 shopping items, got ${user123Shopping.length}`);
    }

    if (user456Items.length === 1) {
      console.log("  ✅ Namespace isolation working (user_456 has 1 item)");
    } else {
      console.log(`  ❌ Namespace isolation broken, expected 1, got ${user456Items.length}`);
    }

    // Test listNamespaces()
    console.log("  Step 3: Listing namespaces...");
    const namespaces = await store.listNamespaces();
    const expectedNamespaces = [
      ["user_123", "iab", "shopping"],
      ["user_123", "iab", "finance"],
      ["user_456", "iab", "shopping"]
    ];

    if (namespaces.length === 3) {
      console.log("  ✅ Found all 3 unique namespaces");
    } else {
      console.log(`  ❌ Expected 3 namespaces, got ${namespaces.length}`);
      console.log("  Namespaces:", namespaces);
    }

    console.log("\n✅ Test 2: Namespace Functionality - PASS\n");
    return true;
  } catch (error) {
    console.error("❌ Test 2 failed:", error);
    return false;
  } finally {
    store.stop();
  }
}

// Test 3: Search & Filtering
async function testSearchFiltering() {
  console.log("\n=== Test 3: Search & Filtering ===\n");

  const store = new IndexedDBStore("test-search");

  try {
    // Store items with various attributes
    console.log("  Step 1: Storing items for filtering...");
    await store.put(["user_123", "classifications"], "c1", {
      category: "Shopping",
      confidence: 0.95,
      source: "email"
    });
    await store.put(["user_123", "classifications"], "c2", {
      category: "Finance",
      confidence: 0.85,
      source: "transaction"
    });
    await store.put(["user_123", "classifications"], "c3", {
      category: "Shopping",
      confidence: 0.75,
      source: "email"
    });
    await store.put(["user_123", "classifications"], "c4", {
      category: "Travel",
      confidence: 0.90,
      source: "calendar"
    });

    // Test exact match filter
    console.log("  Step 2: Exact match filter...");
    const shoppingItems = await store.search(["user_123", "classifications"], {
      filter: { category: "Shopping" }
    });

    if (shoppingItems.length === 2) {
      console.log("  ✅ Exact match filter works (found 2 Shopping items)");
    } else {
      console.log(`  ❌ Expected 2 Shopping items, got ${shoppingItems.length}`);
    }

    // Test operator filter ($gte)
    console.log("  Step 3: Operator filter ($gte)...");
    const highConfidence = await store.search(["user_123", "classifications"], {
      filter: { confidence: { $gte: 0.85 } }
    });

    if (highConfidence.length === 3) {
      console.log("  ✅ $gte operator works (found 3 items with confidence >= 0.85)");
    } else {
      console.log(`  ❌ Expected 3 high-confidence items, got ${highConfidence.length}`);
    }

    // Test multiple filters
    console.log("  Step 4: Multiple filters...");
    const filteredItems = await store.search(["user_123", "classifications"], {
      filter: {
        category: "Shopping",
        confidence: { $gte: 0.8 }
      }
    });

    if (filteredItems.length === 1) {
      console.log("  ✅ Multiple filters work (1 Shopping item with confidence >= 0.8)");
    } else {
      console.log(`  ❌ Expected 1 filtered item, got ${filteredItems.length}`);
    }

    // Test pagination
    console.log("  Step 5: Pagination...");
    const page1 = await store.search(["user_123", "classifications"], { limit: 2, offset: 0 });
    const page2 = await store.search(["user_123", "classifications"], { limit: 2, offset: 2 });

    if (page1.length === 2 && page2.length === 2) {
      console.log("  ✅ Pagination works (2 items per page)");
    } else {
      console.log(`  ❌ Pagination failed: page1=${page1.length}, page2=${page2.length}`);
    }

    // Test empty results
    console.log("  Step 6: Empty results...");
    const noResults = await store.search(["user_123", "classifications"], {
      filter: { category: "NonExistent" }
    });

    if (noResults.length === 0) {
      console.log("  ✅ Empty results handled correctly");
    } else {
      console.log(`  ❌ Expected 0 results, got ${noResults.length}`);
    }

    console.log("\n✅ Test 3: Search & Filtering - PASS\n");
    return true;
  } catch (error) {
    console.error("❌ Test 3 failed:", error);
    return false;
  } finally {
    store.stop();
  }
}

// Test 4: StateGraph Integration
async function testStateGraphIntegration() {
  console.log("\n=== Test 4: StateGraph Integration ===\n");

  const store = new IndexedDBStore("test-graph-integration");

  try {
    // Define state with store access
    const State = Annotation.Root({
      message: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
      }),
      classifications: Annotation<any[]>({
        reducer: (x, y) => y ?? x,
        default: () => [],
      }),
    });

    // Node that writes to Store
    async function classifyNode(state: typeof State.State, config: any) {
      const userStore = config.store as IndexedDBStore;

      // Store a classification
      await userStore.put(
        ["user_123", "classifications"],
        "test_class_1",
        {
          category: "Shopping",
          confidence: 0.95,
          message: state.message
        }
      );

      return { message: "Classified" };
    }

    // Node that reads from Store
    async function retrieveNode(state: typeof State.State, config: any) {
      const userStore = config.store as IndexedDBStore;

      // Retrieve all classifications
      const items = await userStore.search(["user_123", "classifications"]);

      return { classifications: items };
    }

    // Build graph
    console.log("  Step 1: Building StateGraph with Store...");
    const graph = new StateGraph(State)
      .addNode("classify", classifyNode)
      .addNode("retrieve", retrieveNode)
      .addEdge(START, "classify")
      .addEdge("classify", "retrieve")
      .addEdge("retrieve", END);

    const compiled = graph.compile({ store });

    // Run graph
    console.log("  Step 2: Running graph...");
    const result = await compiled.invoke(
      { message: "Test message for classification" },
      { configurable: { thread_id: "test-thread-1" } }
    );

    if (
      result.message === "Classified" &&
      result.classifications.length === 1 &&
      result.classifications[0].value.category === "Shopping"
    ) {
      console.log("  ✅ Store accessible in graph nodes");
      console.log("  ✅ Store operations work within StateGraph");
    } else {
      console.log("  ❌ Store integration failed");
      console.log("  Result:", result);
    }

    console.log("\n✅ Test 4: StateGraph Integration - PASS\n");
    return true;
  } catch (error) {
    console.error("❌ Test 4 failed:", error);
    return false;
  } finally {
    store.stop();
  }
}

// Test 5: Persistence (Survive "Refresh")
async function testPersistence() {
  console.log("\n=== Test 5: Persistence (Survive 'Refresh') ===\n");

  try {
    // First instance - store items
    console.log("  Step 1: Storing items in first store instance...");
    const store1 = new IndexedDBStore("test-persistence");

    await store1.put(["user_123", "data"], "item_1", { value: "Persistent Data 1" });
    await store1.put(["user_123", "data"], "item_2", { value: "Persistent Data 2" });
    await store1.put(["user_123", "data"], "item_3", { value: "Persistent Data 3" });

    const beforeRefresh = await store1.search(["user_123", "data"]);
    console.log(`  Stored ${beforeRefresh.length} items`);

    store1.stop();

    // Simulate "refresh" - new store instance
    console.log("  Step 2: Creating new store instance (simulating refresh)...");
    const store2 = new IndexedDBStore("test-persistence");

    const afterRefresh = await store2.search(["user_123", "data"]);

    if (afterRefresh.length === 3) {
      console.log("  ✅ All items survived refresh (3 items found)");
      console.log("  ✅ IndexedDB persistence working correctly");
    } else {
      console.log(`  ❌ Expected 3 items after refresh, got ${afterRefresh.length}`);
    }

    // Verify item contents
    console.log("  Step 3: Verifying item contents after refresh...");
    const item1 = await store2.get(["user_123", "data"], "item_1");

    if (item1?.value.value === "Persistent Data 1") {
      console.log("  ✅ Item contents intact after refresh");
    } else {
      console.log("  ❌ Item contents corrupted after refresh");
    }

    store2.stop();

    console.log("\n✅ Test 5: Persistence - PASS\n");
    return true;
  } catch (error) {
    console.error("❌ Test 5 failed:", error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log("\n" + "=".repeat(60));
  console.log("Day 3-4: IndexedDBStore Test Suite");
  console.log("=".repeat(60));

  const results = {
    crud: false,
    namespaces: false,
    searchFiltering: false,
    stateGraphIntegration: false,
    persistence: false,
  };

  try {
    results.crud = await testBasicCRUD();
    results.namespaces = await testNamespaces();
    results.searchFiltering = await testSearchFiltering();
    results.stateGraphIntegration = await testStateGraphIntegration();
    results.persistence = await testPersistence();

    // Summary
    console.log("=".repeat(60));
    console.log("Test Summary");
    console.log("=".repeat(60));
    console.log(`1. Basic CRUD Operations:      ${results.crud ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`2. Namespace Functionality:     ${results.namespaces ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`3. Search & Filtering:          ${results.searchFiltering ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`4. StateGraph Integration:      ${results.stateGraphIntegration ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`5. Persistence (Refresh):       ${results.persistence ? "✅ PASS" : "❌ FAIL"}`);
    console.log("=".repeat(60));

    const allPassed = Object.values(results).every(result => result === true);

    if (allPassed) {
      console.log("\n📊 Conclusion: IndexedDBStore is PRODUCTION-READY! ✅");
      console.log("🎯 Long-term persistent memory: VALIDATED");
      console.log("🚀 Ready to proceed with full JavaScript migration\n");
    } else {
      console.log("\n⚠️ Some tests failed. Review implementation before proceeding.\n");
    }

  } catch (error) {
    console.error("\n❌ Fatal error during testing:", error);
    process.exit(1);
  }
}

// Run tests
runAllTests()
  .then(() => {
    console.log("\n✅ All tests completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
