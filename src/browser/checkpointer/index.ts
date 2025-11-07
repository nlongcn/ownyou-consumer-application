/**
 * PGlite Checkpointer Integration
 *
 * Provides short-term thread state persistence for LangGraph.js agents using
 * PGlite (PostgreSQL WASM) with IndexedDB backend.
 *
 * Use Cases:
 * - Agent conversation history
 * - ReAct loop state
 * - Per-thread reasoning state
 * - Workflow execution state
 *
 * Architecture:
 * - **Checkpointer:** Short-term per-thread state (ephemeral)
 * - **Store:** Long-term cross-agent memory (persistent) - see ../store/
 *
 * Both systems work together:
 * - Checkpointer: "What was I doing in THIS conversation?"
 * - Store: "What do I know about this user across ALL conversations?"
 *
 * Validated:
 * - Research spike (January 2025) - 100% test pass rate
 * - Performance: <50ms persist, <10ms retrieval
 * - Persistence: State survives browser refresh
 * - Isolation: Thread-based isolation working correctly
 *
 * @see docs/plans/2025-01-06-javascript-pwa-migration-strategy.md
 * @see research_spike/FINAL_REPORT.md
 */

import { PgLiteSaver } from '@steerprotocol/langgraph-checkpoint-pglite'

/**
 * Create a PGlite checkpointer for browser-based LangGraph agents.
 *
 * @param dbPath Database path (default: "file://.pglite-checkpoints")
 * @returns Configured PgLiteSaver instance
 *
 * @example
 * ```typescript
 * import { createCheckpointer } from '@browser/checkpointer'
 * import { StateGraph } from '@langchain/langgraph'
 *
 * const checkpointer = await createCheckpointer()
 * const graph = new StateGraph(MyState)
 *   .addNode("myNode", myNodeFunction)
 *   .compile({ checkpointer })
 *
 * // Run with thread isolation
 * await graph.invoke(input, {
 *   configurable: { thread_id: "conversation_123" }
 * })
 * ```
 */
export async function createCheckpointer(
  dbPath: string = 'file://.pglite-checkpoints'
): Promise<PgLiteSaver> {
  const checkpointer = new PgLiteSaver(dbPath)

  // CRITICAL: Must call .setup() to create database schema
  await checkpointer.setup()

  return checkpointer
}

/**
 * Re-export PgLiteSaver for direct usage if needed
 */
export { PgLiteSaver } from '@steerprotocol/langgraph-checkpoint-pglite'
