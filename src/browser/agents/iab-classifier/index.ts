/**
 * IAB Classifier Agent
 *
 * LangGraph agent for classifying content into IAB Taxonomy categories.
 * Uses LLM (Anthropic Claude or OpenAI GPT) for intelligent classification.
 *
 * Architecture:
 * - StateGraph workflow with 3 nodes:
 *   1. Prepare: Format input for LLM
 *   2. Classify: LLM classification
 *   3. Store: Save to IndexedDBStore
 *
 * - Checkpointer: PGlite for thread state
 * - Store: IndexedDBStore for classifications
 *
 * Usage:
 * ```typescript
 * import { createIABClassifier } from '@browser/agents/iab-classifier'
 * import { createCheckpointer } from '@browser/checkpointer'
 * import { IndexedDBStore } from '@browser/store'
 *
 * const checkpointer = await createCheckpointer()
 * const store = new IndexedDBStore()
 * const classifier = createIABClassifier({ checkpointer, store })
 *
 * const result = await classifier.invoke({
 *   userId: 'user_123',
 *   source: DataSource.EMAIL,
 *   sourceItemId: 'email_456',
 *   text: 'Your Amazon order has shipped...'
 * }, {
 *   configurable: { thread_id: 'classify_email_456' }
 * })
 * ```
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import { IndexedDBStore } from '@browser/store'
import {
  IABClassifierInput,
  IABClassifierOutput,
  IABClassification,
  IABCategory,
  DataSource,
  getIABNamespace,
  getIABKey,
} from '@shared/types'

/**
 * IAB Classifier State
 *
 * Internal state for the classification workflow.
 */
const IABClassifierState = Annotation.Root({
  // Input fields
  userId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  source: Annotation<DataSource>({
    reducer: (x, y) => y ?? x,
    default: () => DataSource.EMAIL,
  }),
  sourceItemId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  text: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  metadata: Annotation<Record<string, any> | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),

  // Output fields
  category: Annotation<IABCategory | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  confidence: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  reasoning: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  classification: Annotation<IABClassification | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  success: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  error: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
})

/**
 * Node: Prepare input for LLM classification
 */
function prepareNode(state: typeof IABClassifierState.State) {
  console.info(`📧 Preparing to classify ${state.source} for user ${state.userId}`)
  console.info(`   Text preview: "${state.text.substring(0, 60)}..."`)

  // Text is already in state, just pass through
  return { text: state.text }
}

/**
 * Node: Classify using LLM
 */
async function classifyNode(
  state: typeof IABClassifierState.State,
  config: any
) {
  const llm = config.llm as ChatAnthropic | ChatOpenAI

  try {
    console.info('🤖 Classifying with LLM...')

    // Construct classification prompt
    const prompt = `You are an IAB Taxonomy classifier. Classify the following text into ONE of these IAB categories:

${Object.values(IABCategory).join(', ')}

Text to classify:
"""
${state.text}
"""

Respond in JSON format:
{
  "category": "<IAB_CATEGORY>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}

Category must be exactly one of the listed IAB categories above.
Confidence should be between 0.0 and 1.0.`

    const response = await llm.invoke(prompt)
    const content = typeof response.content === 'string' ? response.content : String(response.content)

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('LLM response did not contain valid JSON')
    }

    const parsed = JSON.parse(jsonMatch[0])

    console.info(`✅ Classified as: ${parsed.category} (${(parsed.confidence * 100).toFixed(0)}%)`)

    return {
      category: parsed.category as IABCategory,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    }
  } catch (error) {
    console.error('❌ Classification failed:', error)
    return {
      error: error instanceof Error ? error.message : 'Classification failed',
      success: false,
    }
  }
}

/**
 * Node: Store classification in IndexedDBStore
 */
async function storeNode(
  state: typeof IABClassifierState.State,
  config: any
) {
  const store = config.store as IndexedDBStore

  if (state.error || !state.category) {
    console.error('⚠️  Skipping storage due to classification error')
    return { success: false }
  }

  try {
    const classification: IABClassification = {
      id: `${state.source}_${state.sourceItemId}`,
      userId: state.userId,
      category: state.category,
      confidence: state.confidence,
      source: state.source,
      sourceItemId: state.sourceItemId,
      textPreview: state.text.substring(0, 200),
      timestamp: new Date().toISOString(),
      reasoning: state.reasoning,
    }

    const namespace = getIABNamespace(state.userId)
    const key = getIABKey(state.source, state.sourceItemId)

    await store.put(namespace, key, classification)

    console.info(`💾 Stored classification: ${namespace.join('/')}/${key}`)

    return {
      classification,
      success: true,
    }
  } catch (error) {
    console.error('❌ Storage failed:', error)
    return {
      error: error instanceof Error ? error.message : 'Storage failed',
      success: false,
    }
  }
}

/**
 * IAB Classifier Configuration
 */
export interface IABClassifierConfig {
  /** Checkpointer for thread state */
  checkpointer: any

  /** Store for long-term classifications */
  store: IndexedDBStore

  /** LLM to use (Anthropic or OpenAI) */
  llm?: ChatAnthropic | ChatOpenAI

  /** LLM provider ('anthropic' or 'openai', default: 'anthropic') */
  llmProvider?: 'anthropic' | 'openai'

  /** API key for LLM (optional, uses env var if not provided) */
  apiKey?: string
}

/**
 * Create IAB Classifier Agent
 *
 * @param config Configuration for classifier
 * @returns Compiled StateGraph ready for invocation
 */
export function createIABClassifier(config: IABClassifierConfig) {
  const { checkpointer, store, llm, llmProvider = 'anthropic', apiKey } = config

  // Initialize LLM if not provided
  let llmInstance = llm
  if (!llmInstance) {
    if (llmProvider === 'anthropic') {
      llmInstance = new ChatAnthropic({
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0,
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      })
    } else {
      llmInstance = new ChatOpenAI({
        model: 'gpt-4o',
        temperature: 0,
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      })
    }
  }

  // Create nodes with LLM and Store in closure
  const classifyNodeWithLLM = async (state: typeof IABClassifierState.State) => {
    try {
      console.info('🤖 Classifying with LLM...')

      const prompt = `You are an IAB Taxonomy classifier. Classify the following text into ONE of these IAB categories:

${Object.values(IABCategory).join(', ')}

Text to classify:
"""
${state.text}
"""

Respond in JSON format:
{
  "category": "<IAB_CATEGORY>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}

Category must be exactly one of the listed IAB categories above.
Confidence should be between 0.0 and 1.0.`

      const response = await llmInstance.invoke(prompt)
      const content = typeof response.content === 'string' ? response.content : String(response.content)

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('LLM response did not contain valid JSON')
      }

      const parsed = JSON.parse(jsonMatch[0])
      console.info(`✅ Classified as: ${parsed.category} (${(parsed.confidence * 100).toFixed(0)}%)`)

      return {
        category: parsed.category as IABCategory,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
      }
    } catch (error) {
      console.error('❌ Classification failed:', error)
      return {
        error: error instanceof Error ? error.message : 'Classification failed',
        success: false,
      }
    }
  }

  const storeNodeWithStore = async (state: typeof IABClassifierState.State) => {
    if (!state.category) {
      console.warn('⚠️  Skipping storage due to classification error')
      return {
        success: false,
        error: state.error || 'No classification to store',
      }
    }

    try {
      console.info('💾 Storing classification to IndexedDBStore...')

      const namespace = getIABNamespace(state.userId)
      const key = getIABKey(state.source, state.sourceItemId)

      const classification: IABClassification = {
        id: key,
        userId: state.userId,
        source: state.source,
        sourceItemId: state.sourceItemId,
        category: state.category,
        confidence: state.confidence,
        reasoning: state.reasoning,
        textPreview: state.text.substring(0, 200),
        timestamp: new Date().toISOString(),
      }

      await store.put(namespace, key, classification)

      console.info(`💾 Stored classification: ${namespace.join('/')}/${key}`)

      return {
        classification,
        success: true,
      }
    } catch (error) {
      console.error('❌ Storage failed:', error)
      return {
        error: error instanceof Error ? error.message : 'Storage failed',
        success: false,
      }
    }
  }

  // Build StateGraph
  const graph = new StateGraph(IABClassifierState)
    .addNode('prepare', prepareNode)
    .addNode('classify', classifyNodeWithLLM)
    .addNode('store', storeNodeWithStore)
    .addEdge(START, 'prepare')
    .addEdge('prepare', 'classify')
    .addEdge('classify', 'store')
    .addEdge('store', END)

  // Compile with checkpointer
  return graph.compile({ checkpointer })
}

/**
 * Type for compiled IAB Classifier
 */
export type IABClassifier = ReturnType<typeof createIABClassifier>
