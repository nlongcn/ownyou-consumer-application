/**
 * Browser-Based IAB Classifier
 *
 * Runs IAB classification workflow entirely in the browser using:
 * - @langchain/langgraph/web (browser-compatible LangGraph)
 * - IndexedDBStore (persistent browser storage)
 * - TypeScript IAB agents (migrated from Python)
 *
 * This replaces the server-side /api/classify route, enabling true
 * self-sovereign architecture where all processing happens in the browser.
 *
 * Architecture:
 * - NO server-side processing
 * - NO InMemoryStore (uses IndexedDB for persistence)
 * - ALL data stays in browser
 * - Data survives browser restart
 */

'use client'

import { IndexedDBStore } from '@browser/store/IndexedDBStore'
import { buildWorkflowGraph, WorkflowState } from '@browser/agents/iab-classifier'

export interface ClassificationInput {
  user_id: string
  text: string
  source?: string
  source_item_id?: string
  llm_provider?: 'openai' | 'claude' | 'gemini' | 'ollama' | 'groq' | 'deepinfra' | 'anthropic'
  llm_model?: string
  llm_config?: {
    api_key?: string
    model?: string
    temperature?: number
    max_tokens?: number
    base_url?: string
  }
}

export interface ClassificationResult {
  success: boolean
  classification?: {
    category: string
    confidence: number
    reasoning: string
    section: string
    taxonomy_id?: number
  }
  all_classifications?: any[]
  error?: string
  message?: string
}

/**
 * Browser-based IAB Classifier
 * All operations run in browser, data persists in IndexedDB
 */
export class BrowserClassifier {
  private store: IndexedDBStore
  private userId: string

  constructor(userId: string = 'default_user', dbName: string = 'ownyou_store') {
    this.userId = userId
    this.store = new IndexedDBStore(dbName)
  }

  /**
   * Run IAB classification on a single piece of text
   * Executes entirely in browser using LangGraph.js
   */
  async classifyText(input: ClassificationInput): Promise<ClassificationResult> {
    try {
      console.log('🚀 Starting browser IAB classification...')
      console.log(`   User: ${input.user_id}`)
      console.log(`   Text length: ${input.text.length} chars`)
      console.log(`   LLM: ${input.llm_provider || 'openai'}/${input.llm_model || 'gpt-4o-mini'}`)

      // Build the workflow graph with IndexedDB Store
      const graph = buildWorkflowGraph(this.store, null)

      // Prepare input for the workflow
      const workflowInput: Partial<typeof WorkflowState.State> = {
        user_id: input.user_id,
        emails: [{
          id: input.source_item_id || `${input.source || 'manual'}_${Date.now()}`,
          subject: '',
          from: '',
          body: input.text,
          summary: input.text.substring(0, 500),
        }],
        llm_provider: input.llm_provider || 'openai',
        llm_model: input.llm_model || 'gpt-4o-mini',
        llm_config: input.llm_config, // Pass LLM config to workflow
        total_emails: 1,
        current_email_index: 0,
      }

      console.log('⚙️ Running workflow in browser...')
      const startTime = Date.now()

      // Run the classification workflow in browser
      const result = await graph.invoke(workflowInput)

      const duration = Date.now() - startTime
      console.log(`⏱️ Workflow completed in ${duration}ms`)

      // Extract classifications from all 4 analyzers
      const allClassifications = [
        ...(result.demographics_results || []).map((c: any) => ({ ...c, section: 'demographics' })),
        ...(result.household_results || []).map((c: any) => ({ ...c, section: 'household' })),
        ...(result.interests_results || []).map((c: any) => ({ ...c, section: 'interests' })),
        ...(result.purchase_results || []).map((c: any) => ({ ...c, section: 'purchase_intent' })),
      ]

      if (allClassifications.length === 0) {
        console.log('ℹ️ No classifications generated')
        return {
          success: true,
          message: 'No classifications generated',
          all_classifications: [],
        }
      }

      // Get the highest confidence classification
      const topClassification = allClassifications.reduce((prev, current) =>
        (current.confidence > prev.confidence) ? current : prev
      )

      console.log('✅ Classification complete')
      console.log(`   Category: ${topClassification.value}`)
      console.log(`   Confidence: ${Math.round(topClassification.confidence * 100)}%`)
      console.log(`   Section: ${topClassification.section}`)
      console.log(`   Total classifications: ${allClassifications.length}`)

      // Data is automatically persisted to IndexedDB by the workflow
      console.log('💾 Data persisted to IndexedDB')

      return {
        success: true,
        classification: {
          category: topClassification.value,
          confidence: topClassification.confidence,
          reasoning: topClassification.reasoning,
          section: topClassification.section,
          taxonomy_id: topClassification.taxonomy_id,
        },
        all_classifications: allClassifications,
      }

    } catch (error: any) {
      console.error('❌ Browser classification error:', error)
      return {
        success: false,
        error: error.message || 'Classification failed',
      }
    }
  }

  /**
   * Run IAB classification on multiple text items (batch)
   * All processing in browser, results in IndexedDB
   */
  async classifyBatch(
    items: Array<{ text: string; source?: string; source_item_id?: string }>,
    llmProvider?: 'openai' | 'claude' | 'gemini' | 'ollama' | 'groq' | 'deepinfra' | 'anthropic',
    llmModel?: string,
    onProgress?: (processed: number, total: number, classificationsAdded: number) => void
  ): Promise<{ total: number; processed: number; classificationsAdded: number; errors: number }> {
    const stats = {
      total: items.length,
      processed: 0,
      classificationsAdded: 0,
      errors: 0,
    }

    console.log(`🚀 Starting batch classification of ${items.length} items in browser...`)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      try {
        const result = await this.classifyText({
          user_id: this.userId,
          text: item.text,
          source: item.source,
          source_item_id: item.source_item_id,
          llm_provider: llmProvider,
          llm_model: llmModel,
        })

        stats.processed++

        if (result.success && result.classification) {
          stats.classificationsAdded++
        }

        if (result.success && result.all_classifications && result.all_classifications.length > 1) {
          // Count all classifications, not just the top one
          stats.classificationsAdded += (result.all_classifications.length - 1)
        }

      } catch (error) {
        console.error(`❌ Error classifying item ${i + 1}:`, error)
        stats.errors++
        stats.processed++
      }

      // Call progress callback
      if (onProgress) {
        onProgress(stats.processed, stats.total, stats.classificationsAdded)
      }

      // Small delay between items to avoid overwhelming the browser
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`✅ Batch classification complete:`)
    console.log(`   Processed: ${stats.processed}/${stats.total}`)
    console.log(`   Classifications: ${stats.classificationsAdded}`)
    console.log(`   Errors: ${stats.errors}`)

    return stats
  }

  /**
   * Get the IndexedDB store instance
   * Useful for advanced queries
   */
  getStore(): IndexedDBStore {
    return this.store
  }
}

/**
 * Get a BrowserClassifier instance for the given user
 */
export function getBrowserClassifier(userId: string = 'default_user'): BrowserClassifier {
  return new BrowserClassifier(userId)
}
