/**
 * IAB Taxonomy Classifier Workflow
 *
 * 1:1 Port of Python workflow from:
 * src/email_parser/workflow/graph.py (lines 1-313)
 *
 * 6-Node LangGraph workflow for IAB classification:
 *   1. load_emails - Load and filter new emails
 *   2. retrieve_profile - Get existing IAB profile with temporal decay
 *   3. analyze_all - Run all 4 analyzer agents (demographics, household, interests, purchase)
 *   4. reconcile - Merge classifications and resolve conflicts
 *   5. update_memory - Persist to IndexedDBStore
 *   6. advance_email - Move to next email (loops back to retrieve_profile)
 *
 * Usage:
 * ```typescript
 * import { buildWorkflowGraph } from '@browser/agents/iab-classifier'
 * import { IndexedDBStore } from '@browser/store'
 * import { createCheckpointer } from '@browser/checkpointer'
 *
 * const store = new IndexedDBStore()
 * const checkpointer = await createCheckpointer() // optional
 * const classifier = buildWorkflowGraph(store, checkpointer)
 *
 * const result = await classifier.invoke({
 *   user_id: 'user_123',
 *   emails: [{ id: 'email_1', subject: '...', body: '...' }],
 *   llm_provider: 'openai',
 *   llm_model: 'gpt-4o'
 * })
 * ```
 */

import { StateGraph, END } from '@langchain/langgraph/web'                     // Browser-compatible import
import { WorkflowState, hasMoreEmails, advanceToNextEmail } from './state'      // Python line 34
import { loadNewEmailsNode } from './nodes/loadEmails'                          // Python line 37
import { retrieveExistingProfileNode } from './nodes/retrieveProfile'           // Python line 38
import { analyzeAllNode } from './analyzers'                                    // Python line 39
import { reconcileEvidenceNode } from './nodes/reconcile'                       // Python line 40
import { updateMemoryNode } from './nodes/updateMemory'                         // Python line 41
import type { BaseStore } from '@langchain/langgraph/web'                      // Browser-compatible import
import { MemoryManager } from './memory/MemoryManager'                          // Python line 16
import type { BaseStore as IndexedDBStore } from '@langchain/langgraph/web'     // Type alias for createIABClassifier

// Re-export WorkflowState for external use
export { WorkflowState } from './state'

// Re-export profile tier formatter functions and types
export {
  formatTieredDemographics,
  formatTieredHousehold,
  formatTieredInterests,
  formatTieredPurchaseIntent,
  addTieredStructureToProfile,
  type TaxonomySelection,
  type TieredClassification,
  type TieredGroup,
  type TieredInterest,
  type TieredPurchaseIntent,
} from './profileTierFormatter'

/**
 * Build compiled StateGraph for IAB Taxonomy Profile workflow.
 *
 * Python source: graph.py:48-147 (build_workflow_graph)
 *
 * @param store BaseStore instance for persistent storage
 * @param checkpointer Optional checkpointer for workflow state persistence (default: null)
 * @param userId Optional user_id for MemoryManager (extracted from state if not provided)
 * @returns Compiled StateGraph ready for execution
 *
 * Example:
 *   // Production (no checkpointing, maximum privacy)
 *   const store = new IndexedDBStore()
 *   const graph = buildWorkflowGraph(store)
 *   const result = await graph.invoke({ user_id: "user_123", emails: [...] })
 *
 *   // Development (PGlite checkpointing for debugging)
 *   const checkpointer = await createCheckpointer()
 *   const graph = buildWorkflowGraph(store, checkpointer)
 *   const result = await graph.invoke({ user_id: "user_123", emails: [...] })
 */
export function buildWorkflowGraph(                                             // Python line 48
  store: BaseStore,                                                             // Python line 49
  checkpointer: any = null,                                                     // Python line 50
  userId: string = 'default_user'                                               // For MemoryManager
) {
  // Initialize StateGraph with WorkflowState schema                            // Python line 86
  const workflow = new StateGraph(WorkflowState) as any                         // Python line 87

  // Python line 76: Create MemoryManager wrapper around store
  // Note: In Python, user_id comes from state. Here we create a closure that extracts it.
  // The MemoryManager is created per-invocation to support different users.

  // Bind MemoryManager to nodes using closures                                 // Python lines 89-93
  const load_emails = async (state: typeof WorkflowState.State) => {           // Python line 90
    const memoryManager = new MemoryManager(state.user_id || userId, store)
    return loadNewEmailsNode(state, memoryManager)
  }
  const retrieve_profile = async (state: typeof WorkflowState.State) => {      // Python line 91
    const memoryManager = new MemoryManager(state.user_id || userId, store)
    return retrieveExistingProfileNode(state, memoryManager)
  }
  const reconcile = async (state: typeof WorkflowState.State) => {             // Python line 92
    const memoryManager = new MemoryManager(state.user_id || userId, store)
    return reconcileEvidenceNode(state, memoryManager)
  }
  const update_memory = async (state: typeof WorkflowState.State) => {         // Python line 93
    const memoryManager = new MemoryManager(state.user_id || userId, store)
    return updateMemoryNode(state, memoryManager)
  }

  // Add nodes to graph                                                         // Python line 95
  workflow.addNode('load_emails', load_emails)                                  // Python line 96
  workflow.addNode('retrieve_profile', retrieve_profile)                        // Python line 97
  workflow.addNode('analyze_all', analyzeAllNode)                               // Python line 98
  workflow.addNode('reconcile', reconcile)                                      // Python line 99
  workflow.addNode('update_memory', update_memory)                              // Python line 100
  // REMOVED: advance_email node (no longer needed - batch processing mode)

  // Define edges                                                               // Python line 103
  workflow.setEntryPoint('load_emails')                                         // Python line 104

  // After loading, check if we have emails to process                          // Python line 106
  workflow.addConditionalEdges(                                                 // Python line 107
    'load_emails',                                                              // Python line 108
    _checkHasEmailsConditional,                                                 // Python line 109
    {                                                                           // Python line 110
      has_emails: 'retrieve_profile',                                           // Python line 111
      no_emails: END,                                                           // Python line 112
    }
  )

  // After retrieving profile, run all analyzers                                // Python line 116
  // (analyzeAllNode internally calls all 4 analyzer functions)                 // Python line 117
  workflow.addEdge('retrieve_profile', 'analyze_all')                           // Python line 118

  // Analyzers flow to reconciliation                                           // Python line 120
  workflow.addEdge('analyze_all', 'reconcile')                                  // Python line 121

  // Reconciliation flows to memory update                                      // Python line 123
  workflow.addEdge('reconcile', 'update_memory')                                // Python line 124

  // After updating memory, END workflow (batch processing complete)            // MODIFIED: No loop back
  // In batch processing mode, the entire batch is processed in ONE pass
  // The frontend workflow loop handles sending multiple batches sequentially
  workflow.addEdge('update_memory', END)                                        // Python line 132

  // Compile graph (with optional checkpointer)                                 // Python line 139
  if (checkpointer) {                                                           // Python line 140
    const compiled_graph = workflow.compile({ checkpointer })                   // Python line 141
    console.info('Workflow graph compiled successfully with checkpointing enabled') // Python line 142
    return compiled_graph                                                       // Python line 143
  } else {                                                                      // Python line 144
    const compiled_graph = workflow.compile()                                   // Python line 145
    console.info('Workflow graph compiled successfully (no checkpointing)')     // Python line 146
    return compiled_graph                                                       // Python line 147
  }
}

/**
 * Check if there are emails to process after loading.
 *
 * Python source: graph.py:150-167 (_check_has_emails_conditional)
 *
 * @param state Current workflow state
 * @returns "has_emails" if emails exist, "no_emails" to end workflow
 */
function _checkHasEmailsConditional(                                            // Python line 150
  state: typeof WorkflowState.State
): 'has_emails' | 'no_emails' {                                                 // Python line 151
  const total_emails = state.total_emails || 0                                  // Python line 160

  if (total_emails > 0) {                                                       // Python line 162
    console.info(`Found ${total_emails} emails to process`)                     // Python line 163
    return 'has_emails'                                                         // Python line 164
  } else {                                                                      // Python line 165
    console.info('No emails to process - ending workflow')                      // Python line 166
    return 'no_emails'                                                          // Python line 167
  }
}

/**
 * Node that advances to the next email.
 *
 * This is a separate node because conditional edges should not mutate state.
 *
 * Python source: graph.py:202-217 (_advance_email_node)
 *
 * @param state Current workflow state
 * @returns Updated state with incremented email index
 */
async function _advanceEmailNode(                                               // Python line 202
  state: typeof WorkflowState.State
): Promise<Partial<typeof WorkflowState.State>> {                               // Python line 203
  console.info(`Advancing from email ${state.current_email_index || 0} to next`) // Python line 216

  // advanceToNextEmail expects WorkflowState type but we have typeof WorkflowState.State
  // Cast to any to bridge the type mismatch between state.ts and LangGraph
  const result = advanceToNextEmail(state as any)                               // Python line 217

  return result as Partial<typeof WorkflowState.State>
}

/**
 * Conditional edge function for workflow continuation.
 *
 * This only checks if more emails exist - it does NOT advance the index.
 * The advance_email node handles incrementing the index.
 *
 * Python source: graph.py:220-240 (_check_continuation_conditional)
 *
 * @param state Current workflow state
 * @returns "continue" to advance to next email, "end" to finish workflow
 */
function _checkContinuationConditional(                                         // Python line 220
  state: typeof WorkflowState.State
): 'continue' | 'end' {                                                         // Python line 221
  // Cast to bridge type mismatch between state.ts helper and LangGraph state type
  if (hasMoreEmails(state as any)) {                                            // Python line 235
    console.info('More emails remain - continuing')                             // Python line 236
    return 'continue'                                                           // Python line 237
  } else {                                                                      // Python line 238
    console.info('All emails processed - workflow complete')                    // Python line 239
    return 'end'                                                                // Python line 240
  }
}

/**
 * Type for compiled IAB Classifier workflow
 */
export type IABClassifierWorkflow = ReturnType<typeof buildWorkflowGraph>

/**
 * LLM configuration for IAB classification.
 * Contains API keys and provider settings.
 */
export interface LLMConfig {
  api_key?: string
  provider?: string
  model?: string
  base_url?: string // For Ollama
}

/**
 * Get LLM configuration from Vite environment variables.
 * Uses VITE_ prefix for browser-side environment variables.
 */
export function getLLMConfigFromEnv(): { provider: string; model: string; llm_config: LLMConfig } {
  // In browser, use import.meta.env; in Node, use process.env
  const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : (globalThis as any).process?.env || {}

  const provider = env.VITE_LLM_PROVIDER || 'openai'
  const model = env.VITE_LLM_MODEL || 'gpt-4o-mini'

  // Get API key for the selected provider
  let api_key = ''
  switch (provider.toLowerCase()) {
    case 'openai':
      api_key = env.VITE_OPENAI_API_KEY || ''
      break
    case 'anthropic':
    case 'claude':
      api_key = env.VITE_ANTHROPIC_API_KEY || ''
      break
    case 'google':
    case 'gemini':
      api_key = env.VITE_GOOGLE_API_KEY || ''
      break
    case 'groq':
      api_key = env.VITE_GROQ_API_KEY || ''
      break
    case 'deepinfra':
      api_key = env.VITE_DEEPINFRA_API_KEY || ''
      break
    case 'mistral':
      api_key = env.VITE_MISTRAL_API_KEY || ''
      break
    case 'ollama':
      // Ollama doesn't need an API key
      break
  }

  return {
    provider,
    model,
    llm_config: { api_key, provider, model }
  }
}

/**
 * Create IAB Classifier with full workflow execution.
 *
 * 1:1 port of Python run_workflow() from executor.py:31-204
 *
 * Runs complete 6-node workflow with all 4 analyzer agents.
 *
 * @param options Configuration options
 * @returns Object with invoke method that executes full workflow
 */
export function createIABClassifier(options: {
  checkpointer?: any
  store: IndexedDBStore
  llm?: any
  /** LLM provider name (openai, anthropic, etc.) */
  llm_provider?: string
  /** LLM model name */
  llm_model?: string
  /** LLM configuration with API keys */
  llm_config?: LLMConfig
}) {
  const { checkpointer, store, llm_provider, llm_model, llm_config } = options
  const graph = buildWorkflowGraph(store, checkpointer)

  // Get config from env if not provided
  const envConfig = getLLMConfigFromEnv()
  const finalProvider = llm_provider || envConfig.provider
  const finalModel = llm_model || envConfig.model
  const finalLLMConfig = llm_config || envConfig.llm_config

  console.log(`📊 IAB Classifier initialized: provider=${finalProvider}, model=${finalModel}, hasApiKey=${!!finalLLMConfig.api_key}`)

  return {
    invoke: async (input: any, config?: any) => {
      const timestamp = new Date().toISOString()
      const textPreview = input.text.substring(0, 200)

      console.log(`📧 Preparing to classify ${input.source} for user ${input.userId}`)
      console.log(`   Text preview: "${textPreview}..."`)

      // Transform test input to workflow state format (Python: executor.py:139-151)
      const workflowInput = {
        user_id: input.userId,
        emails: [{
          id: input.sourceItemId,
          subject: '',
          from: '',
          summary: input.text,
        }],
        llm_provider: finalProvider,
        llm_model: finalModel,
        llm_config: finalLLMConfig,
        llm_client: input.llm_client,
      }

      try {
        console.log('🤖 Classifying with LLM...')
        const result = await graph.invoke(workflowInput, config)

        // Extract first classification from workflow results
        // Results are in demographics_results, household_results, interests_results, purchase_results
        const allClassifications = [
          ...(result.demographics_results || []),
          ...(result.household_results || []),
          ...(result.interests_results || []),
          ...(result.purchase_results || []),
        ]

        if (allClassifications.length === 0) {
          throw new Error('No classifications returned from workflow')
        }

        // Use first classification (highest confidence should be first)
        const firstClassification = allClassifications[0]

        // Map IAB taxonomy to test category enum
        const category = firstClassification.value || 'OTHER'
        const confidence = firstClassification.confidence || 0.5
        const reasoning = firstClassification.reasoning || 'No reasoning provided'

        console.log(`✅ Classified as: ${category} (${Math.round(confidence * 100)}%)`)
        console.log(`💾 Storing classification to IndexedDBStore...`)

        // Store classification in IndexedDBStore
        const classificationKey = `${input.source}_${input.sourceItemId}`
        await store.put(
          [input.userId, 'iab_classifications'],
          classificationKey,
          {
            category,
            confidence,
            reasoning,
            source: input.source,
            sourceItemId: input.sourceItemId,
            userId: input.userId,
            textPreview,
            timestamp,
          }
        )

        console.log(`💾 Stored classification: ${input.userId}/iab_classifications/${classificationKey}`)

        // Return in test-expected format
        return {
          success: true,
          classification: {
            userId: input.userId,
            source: input.source,
            sourceItemId: input.sourceItemId,
            category,
            confidence,
            reasoning,
            textPreview,
            timestamp,
          },
        }
      } catch (error) {
        console.error(`❌ Classification failed: ${error}`)
        return {
          success: false,
          error: String(error),
        }
      }
    }
  }
}
