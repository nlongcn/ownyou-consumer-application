/**
 * IAB Taxonomy Analyzer Agents
 *
 * 1:1 Port of Python analyzer agents from:
 * src/email_parser/agents/demographics_agent.py (lines 1-310)
 * src/email_parser/agents/household_agent.py (lines 1-310)
 * src/email_parser/agents/interests_agent.py (lines 1-310)
 * src/email_parser/agents/purchase_agent.py (lines 1-310)
 *
 * All 4 agents now fully implemented with:
 * - LLM client infrastructure (AnalyzerLLMClient)
 * - Evidence judge system (evaluate_evidence_quality_batch)
 * - Taxonomy context system (get_cached_taxonomy_context)
 * - ReAct agent orchestration
 *
 * Phase 2 COMPLETE: All analyzer agents ported from Python.
 */

import type { WorkflowState } from '../state'
import { extract_demographics_with_agent } from '../agents/demographics'
import { extract_household_with_agent } from '../agents/household'
import { extract_interests_with_agent } from '../agents/interests'
import { extract_purchase_with_agent } from '../agents/purchase'
import { AnalyzerLLMClient } from '../llm/client'

/**
 * Taxonomy selection result structure
 *
 * Python source: All 4 agent files use this structure (e.g., demographics_agent.py:299-314)
 */
export interface TaxonomySelection {
  taxonomy_id: number
  section: string
  value: string
  confidence: number
  category_path: string
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4: string
  tier_5: string
  grouping_tier_key: string
  grouping_value: string
  reasoning: string
  email_ids?: string[]
  purchase_intent_flag?: string // Only for purchase analyzer
}

/**
 * Agent result structure
 *
 * Python source: All 4 agent files return this structure (e.g., demographics_agent.py:263-267)
 */
export interface AgentResult {
  classifications: TaxonomySelection[]
  iterations: number
  tool_calls: number
  error?: string
}

/**
 * Helper: Get current email being processed
 *
 * Python source: analyzers.py:891 (get_current_email from state.py:259-283)
 */
function getCurrentEmail(state: typeof WorkflowState.State): Record<string, any> | null {
  if (!state.emails || state.emails.length === 0) {
    return null
  }

  const index = state.current_email_index || 0
  if (index >= state.emails.length) {
    return null
  }

  return state.emails[index]
}

/**
 * Helper: Get current batch of emails
 *
 * Python source: analyzers.py:184 (get_current_batch from state.py)
 */
function getCurrentBatch(state: typeof WorkflowState.State): Array<Record<string, any>> {
  const email = getCurrentEmail(state)
  return email ? [email] : []
}

/**
 * Demographics Analyzer Node
 *
 * Python source: demographics_agent.py:24-277 (extract_demographics_with_agent)
 * Node wrapper: analyzers.py:165-342 (demographics_analyzer_node)
 *
 * @param state Current workflow state
 * @returns Updated state with demographics_results
 */
export async function demographicsAnalyzerNode(
  state: typeof WorkflowState.State
): Promise<typeof WorkflowState.State> {
  try {
    // Python line 184
    const emails = getCurrentBatch(state)

    // Python lines 186-188
    if (!emails || emails.length === 0) {
      console.warn('No emails in batch to analyze for demographics')
      return state
    }

    // Python lines 190-195: Log batch processing info
    const batchSize = emails.length
    const emailIds = emails.map((email) => email.id || 'unknown')
    console.info(
      `📦 BATCH PROCESSING: Demographics agent processing ${batchSize} emails in single LLM call\n` +
        `   Email IDs: ${emailIds.slice(0, 5).join(', ')}${emailIds.length > 5 ? '...' : ''}`
    )

    // Python lines 198-276: Full ReAct agent implementation
    // Initialize LLM client from state configuration
    const llm_client = new AnalyzerLLMClient({
      provider: state.llm_provider || 'openai',
      model: state.llm_model,
    })

    // Python lines 211-215: Call the full ReAct agent
    const result = await extract_demographics_with_agent({
      emails,
      llm_client,
      max_iterations: 3,  // Python line 214 (FIXED: was 1, should be 3)
    })

    // Python line 314: Append to state
    return {
      ...state,
      demographics_results: [...(state.demographics_results || []), ...result.classifications],
    }
  } catch (error) {
    // Python lines 337-340
    console.error(`Demographics agent failed: ${error}`, error)
    return {
      ...state,
      errors: [...(state.errors || []), `Demographics analysis failed: ${String(error)}`],
    }
  }
}

/**
 * Household Analyzer Node
 *
 * Python source: household_agent.py:24-277 (extract_household_with_agent)
 * Node wrapper: analyzers.py:345-521 (household_analyzer_node)
 *
 * @param state Current workflow state
 * @returns Updated state with household_results
 */
export async function householdAnalyzerNode(
  state: typeof WorkflowState.State
): Promise<typeof WorkflowState.State> {
  try {
    // Python line 364
    const emails = getCurrentBatch(state)

    // Python lines 366-368
    if (!emails || emails.length === 0) {
      console.warn('No emails in batch to analyze for household')
      return state
    }

    // Python lines 370-375: Log batch processing info
    const batchSize = emails.length
    const emailIds = emails.map((email) => email.id || 'unknown')
    console.info(
      `📦 BATCH PROCESSING: Household agent processing ${batchSize} emails in single LLM call\n` +
        `   Email IDs: ${emailIds.slice(0, 5).join(', ')}${emailIds.length > 5 ? '...' : ''}`
    )

    // Python lines 378-514: Full ReAct agent implementation
    // Initialize LLM client from state configuration
    const llm_client = new AnalyzerLLMClient({
      provider: state.llm_provider || 'openai',
      model: state.llm_model,
    })

    // Python lines 391-395: Call the full ReAct agent
    const result = await extract_household_with_agent({
      emails,
      llm_client,
      max_iterations: 1,  // Python line 394
    })

    // Python line 493: Append to state
    return {
      ...state,
      household_results: [...(state.household_results || []), ...result.classifications],
    }
  } catch (error) {
    // Python lines 516-519
    console.error(`Household agent failed: ${error}`, error)
    return {
      ...state,
      errors: [...(state.errors || []), `Household analysis failed: ${String(error)}`],
    }
  }
}

/**
 * Interests Analyzer Node
 *
 * Python source: interests_agent.py:24-277 (extract_interests_with_agent)
 * Node wrapper: analyzers.py:524-702 (interests_analyzer_node)
 *
 * @param state Current workflow state
 * @returns Updated state with interests_results
 */
export async function interestsAnalyzerNode(
  state: typeof WorkflowState.State
): Promise<typeof WorkflowState.State> {
  try {
    // Python line 545
    const emails = getCurrentBatch(state)

    // Python lines 547-549
    if (!emails || emails.length === 0) {
      console.warn('No emails in batch to analyze for interests')
      return state
    }

    // Python lines 551-556: Log batch processing info
    const batchSize = emails.length
    const emailIds = emails.map((email) => email.id || 'unknown')
    console.info(
      `📦 BATCH PROCESSING: Interests agent processing ${batchSize} emails in single LLM call\n` +
        `   Email IDs: ${emailIds.slice(0, 5).join(', ')}${emailIds.length > 5 ? '...' : ''}`
    )

    // Python lines 558-695: Full ReAct agent implementation
    // Initialize LLM client from state configuration
    const llm_client = new AnalyzerLLMClient({
      provider: state.llm_provider || 'openai',
      model: state.llm_model,
    })

    // Python lines 571-575: Call the full ReAct agent
    const result = await extract_interests_with_agent({
      emails,
      llm_client,
      max_iterations: 1,  // Python line 574
    })

    // Python line 674: Append to state
    return {
      ...state,
      interests_results: [...(state.interests_results || []), ...result.classifications],
    }
  } catch (error) {
    // Python lines 697-700
    console.error(`Interests agent failed: ${error}`, error)
    return {
      ...state,
      errors: [...(state.errors || []), `Interests analysis failed: ${String(error)}`],
    }
  }
}

/**
 * Purchase Analyzer Node
 *
 * Python source: purchase_agent.py:24-277 (extract_purchase_with_agent)
 * Node wrapper: analyzers.py:705-887 (purchase_analyzer_node)
 *
 * @param state Current workflow state
 * @returns Updated state with purchase_results
 */
export async function purchaseAnalyzerNode(
  state: typeof WorkflowState.State
): Promise<typeof WorkflowState.State> {
  try {
    // Python line 726
    const emails = getCurrentBatch(state)

    // Python lines 728-730
    if (!emails || emails.length === 0) {
      console.warn('No emails in batch to analyze for purchase')
      return state
    }

    // Python lines 732-737: Log batch processing info
    const batchSize = emails.length
    const emailIds = emails.map((email) => email.id || 'unknown')
    console.info(
      `📦 BATCH PROCESSING: Purchase agent processing ${batchSize} emails in single LLM call\n` +
        `   Email IDs: ${emailIds.slice(0, 5).join(', ')}${emailIds.length > 5 ? '...' : ''}`
    )

    // Python lines 739-880: Full ReAct agent with purchase_intent_flag support
    // Initialize LLM client from state configuration
    const llm_client = new AnalyzerLLMClient({
      provider: state.llm_provider || 'openai',
      model: state.llm_model,
    })

    // Python lines 752-756: Call the full ReAct agent
    const result = await extract_purchase_with_agent({
      emails,
      llm_client,
      max_iterations: 1,  // Python line 755
    })

    // Python line 859: Append to state
    return {
      ...state,
      purchase_results: [...(state.purchase_results || []), ...result.classifications],
    }
  } catch (error) {
    // Python lines 882-885
    console.error(`Purchase agent failed: ${error}`, error)
    return {
      ...state,
      errors: [...(state.errors || []), `Purchase analysis failed: ${String(error)}`],
    }
  }
}

/**
 * Combined Analyzer Node
 *
 * Python source: analyzers.py:890-940 (analyze_all_node)
 *
 * Runs all 4 analyzers sequentially. Each analyzer appends to its
 * respective results array in state.
 *
 * @param state Current workflow state
 * @returns Updated state with all analyzer results
 */
export async function analyzeAllNode(state: typeof WorkflowState.State): Promise<typeof WorkflowState.State> {
  // Python line 919
  console.info('Running all 4 analyzers on current email')

  // Python lines 921-926: Run each analyzer in sequence
  let updatedState = state
  updatedState = await demographicsAnalyzerNode(updatedState)
  updatedState = await householdAnalyzerNode(updatedState)
  updatedState = await interestsAnalyzerNode(updatedState)
  updatedState = await purchaseAnalyzerNode(updatedState)

  // Python lines 928-940: Log summary
  const demographicsCount = updatedState.demographics_results?.length || 0
  const householdCount = updatedState.household_results?.length || 0
  const interestsCount = updatedState.interests_results?.length || 0
  const purchaseCount = updatedState.purchase_results?.length || 0

  console.info(
    `All analyzers complete - Results: ` +
      `demographics=${demographicsCount}, household=${householdCount}, ` +
      `interests=${interestsCount}, purchase=${purchaseCount}`
  )

  // Python line 940
  return updatedState
}
