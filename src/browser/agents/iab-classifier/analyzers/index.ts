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

// Evidence Judge (LLM-as-Judge validation logic)
import {
  evaluate_evidence_quality_batch,
  adjust_confidence_with_evidence_quality,
  should_block_classification
} from '../llm/evidenceJudge'

// Evidence Guidelines (section-specific prompts for evidence evaluation)
import {
  DEMOGRAPHICS_EVIDENCE_GUIDELINES,
  HOUSEHOLD_EVIDENCE_GUIDELINES,
  INTERESTS_EVIDENCE_GUIDELINES,
  PURCHASE_EVIDENCE_GUIDELINES
} from '../llm/prompts'

// Taxonomy Helpers (validation and lookup functions)
import {
  lookupTaxonomyEntry,
  validateTaxonomyClassification
} from './tools'

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
 * Python source: batch_optimizer.py:183-208 (get_batch_from_state)
 *
 * Extracts the current batch of emails using batch_size and current_batch_start.
 * This enables processing multiple emails in a single LLM call per analyzer.
 *
 * Example: If batch_size=15 and current_batch_start=0, returns emails[0:15]
 */
function getCurrentBatch(state: typeof WorkflowState.State): Array<Record<string, any>> {
  // Python: emails = state.get("emails", [])
  const emails = state.emails || []

  // Python: start = state.get("current_batch_start", 0)
  const start = state.current_batch_start || 0

  // Python: size = state.get("batch_size", 1)
  const size = state.batch_size || 1

  // DIAGNOSTIC: Log batch processing parameters
  console.log('[ANALYZER DIAGNOSTIC] getCurrentBatch called:')
  console.log(`  - total emails: ${emails.length}`)
  console.log(`  - state.batch_size: ${state.batch_size}`)
  console.log(`  - state.current_batch_start: ${state.current_batch_start}`)
  console.log(`  - computed size (after default): ${size}`)
  console.log(`  - computed start (after default): ${start}`)
  console.log(`  - slice(${start}, ${start + size}) will return ${size} emails`)

  // Python: return emails[start:start + size]
  const batch = emails.slice(start, start + size)

  console.info(`[getCurrentBatch] Returning batch of ${batch.length} emails (start=${start}, size=${size}, total=${emails.length})`)

  // DIAGNOSTIC: Verify batch content
  console.log('[ANALYZER DIAGNOSTIC] Batch email IDs:', batch.map(e => e.id || 'unknown'))

  return batch
}

/**
 * Get taxonomy value from entry (helper for validation)
 * Python source: tools.py:get_taxonomy_value (lines 70-100)
 */
function getTaxonomyValue(entry: any): string {
  // Check from deepest to shallowest
  const tiers = ['tier_5', 'tier_4', 'tier_3'] as const
  for (const tierKey of tiers) {
    const value = entry[tierKey]?.trim() || ''
    if (value) {
      return value
    }
  }
  // Fallback to tier_2
  return entry.tier_2?.trim() || ''
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
    const llm_client = state.llm_client || new AnalyzerLLMClient({
      provider: state.llm_provider || 'openai',
      model: state.llm_model,
      llm_config: state.llm_config, // Phase 1.5: Pass API keys from server
    })

    // Python lines 211-215: Call the full ReAct agent
    const result = await extract_demographics_with_agent({
      emails,
      llm_client,
      max_iterations: 3,  // Python line 214 (FIXED: was 1, should be 3)
    })

    const classifications = result.classifications || []

    // ===== EVIDENCE QUALITY VALIDATION (Python lines 226-272) =====
    // Build email context from entire batch for validation
    const email_context = emails.map((email: any) => {
      const subject = email.subject || ''
      const body = (email.body || email.text || '').substring(0, 500)
      return `Subject: ${subject}\n${body}`
    }).join('\n\n')

    // Filter to taxonomy-valid classifications only
    const taxonomy_valid_classifications = classifications.filter((c: any) => c.taxonomy_id)

    console.info(`📊 Evidence Judge: Evaluating ${taxonomy_valid_classifications.length} classifications`)

    // Batch evaluate evidence quality (parallel processing for performance)
    const evidence_evals = await evaluate_evidence_quality_batch({
      classifications: taxonomy_valid_classifications,
      email_context,
      section_guidelines: DEMOGRAPHICS_EVIDENCE_GUIDELINES,
      llm_client,
      max_workers: 5,  // Python line 245: Parallel processing
      actual_batch_size: batchSize
    })

    // Adjust confidence and block inappropriate inferences
    const validated_classifications: any[] = []
    for (let i = 0; i < taxonomy_valid_classifications.length; i++) {
      let classification = taxonomy_valid_classifications[i]
      const evidence_eval = evidence_evals[i]

      // Adjust confidence based on evidence quality (Python lines 255-261)
      classification = adjust_confidence_with_evidence_quality(classification, evidence_eval)

      // Block completely inappropriate inferences (Python lines 264-268)
      if (should_block_classification(evidence_eval.quality_score)) {
        console.warn(
          `⚠️  Blocking classification ${classification.taxonomy_id} ` +
          `(quality_score=${evidence_eval.quality_score.toFixed(2)}): ${evidence_eval.issue}`
        )
        continue  // Skip this classification
      }

      validated_classifications.push(classification)
    }

    // ===== TAXONOMY VALIDATION (Python lines 274-314) =====
    const final_selections: any[] = []

    for (const classification of validated_classifications) {
      const taxonomy_id = classification.taxonomy_id
      const llm_value = (classification.value || '').trim()

      // Look up taxonomy entry (Python lines 281-285)
      const taxonomy_entry = lookupTaxonomyEntry(taxonomy_id)
      if (!taxonomy_entry) {
        console.warn(`⚠️  Skipping invalid taxonomy_id: ${taxonomy_id}`)
        continue
      }

      // Validate value against taxonomy (Python lines 287-291)
      if (!validateTaxonomyClassification(taxonomy_id, llm_value, taxonomy_entry)) {
        console.warn(
          `⚠️  Taxonomy validation failed for ${taxonomy_id}: ` +
          `LLM value "${llm_value}" doesn't match taxonomy`
        )
        continue
      }

      // Determine final value (Python lines 293-297)
      // For asterisk placeholders (e.g., "*Country Extension"), use LLM's value
      // For non-asterisk entries, use taxonomy value as source of truth
      const taxonomy_value = getTaxonomyValue(taxonomy_entry)
      const final_value = taxonomy_value.startsWith('*') ? llm_value : taxonomy_value

      // Build complete selection with all tier data (Python lines 299-314)
      const selection = {
        taxonomy_id,
        section: 'demographics',
        value: final_value,
        confidence: classification.confidence || 0.7,
        category_path: taxonomy_entry.category_path,
        tier_1: taxonomy_entry.tier_1,
        tier_2: taxonomy_entry.tier_2,
        tier_3: taxonomy_entry.tier_3,
        tier_4: taxonomy_entry.tier_4,
        tier_5: taxonomy_entry.tier_5,
        grouping_tier_key: taxonomy_entry.grouping_tier_key,
        grouping_value: taxonomy_entry.grouping_value || final_value,
        reasoning: classification.reasoning || '',
        email_ids: classification.email_ids || []
      }

      final_selections.push(selection)
    }

    // ===== ENHANCED LOGGING (Python lines 316-335) =====
    console.info(`📊 Demographics Validation Pipeline:`)
    console.info(`  - LLM returned: ${classifications.length} raw classifications`)
    console.info(`  - After evidence judge: ${validated_classifications.length} passed quality check`)
    console.info(`  - After taxonomy validation: ${final_selections.length} final`)

    if (classifications.length > validated_classifications.length) {
      const rejected = classifications.length - validated_classifications.length
      console.warn(`⚠️  Evidence judge rejected ${rejected} classifications (weak evidence)`)
    }

    if (validated_classifications.length > final_selections.length) {
      const rejected = validated_classifications.length - final_selections.length
      console.warn(`⚠️  Final validation rejected ${rejected} classifications (taxonomy mismatch)`)
    }

    const with_provenance = final_selections.filter(c => c.email_ids && c.email_ids.length > 0).length
    console.info(
      `✅ Demographics agent complete: ${final_selections.length} classifications added\n` +
      `   Provenance tracked: ${with_provenance}/${final_selections.length} have email_ids`
    )

    // Return updated state with validated selections
    return {
      ...state,
      demographics_results: [...(state.demographics_results || []), ...final_selections],
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
    const llm_client = state.llm_client || new AnalyzerLLMClient({
      provider: state.llm_provider || 'openai',
      model: state.llm_model,
      llm_config: state.llm_config, // Phase 1.5: Pass API keys from server
    })

    // Python lines 391-395: Call the full ReAct agent
    const result = await extract_household_with_agent({
      emails,
      llm_client,
      max_iterations: 3,  // Python line 394 (FIXED: was 1, should be 3)
    })

    const classifications = result.classifications || []

    // ===== EVIDENCE QUALITY VALIDATION (Python lines 405-451) =====
    const email_context = emails.map((email: any) => {
      const subject = email.subject || ''
      const body = (email.body || email.text || '').substring(0, 500)
      return `Subject: ${subject}\n${body}`
    }).join('\n\n')

    const taxonomy_valid_classifications = classifications.filter((c: any) => c.taxonomy_id)

    console.info(`📊 Evidence Judge: Evaluating ${taxonomy_valid_classifications.length} classifications`)

    const evidence_evals = await evaluate_evidence_quality_batch({
      classifications: taxonomy_valid_classifications,
      email_context,
      section_guidelines: HOUSEHOLD_EVIDENCE_GUIDELINES,
      llm_client,
      max_workers: 5,
      actual_batch_size: batchSize
    })

    const validated_classifications: any[] = []
    for (let i = 0; i < taxonomy_valid_classifications.length; i++) {
      let classification = taxonomy_valid_classifications[i]
      const evidence_eval = evidence_evals[i]

      classification = adjust_confidence_with_evidence_quality(classification, evidence_eval)

      if (should_block_classification(evidence_eval.quality_score)) {
        console.warn(
          `⚠️  Blocking classification ${classification.taxonomy_id} ` +
          `(quality_score=${evidence_eval.quality_score.toFixed(2)}): ${evidence_eval.issue}`
        )
        continue
      }

      validated_classifications.push(classification)
    }

    // ===== TAXONOMY VALIDATION (Python lines 453-493) =====
    const final_selections: any[] = []

    for (const classification of validated_classifications) {
      const taxonomy_id = classification.taxonomy_id
      const llm_value = (classification.value || '').trim()

      const taxonomy_entry = lookupTaxonomyEntry(taxonomy_id)
      if (!taxonomy_entry) {
        console.warn(`⚠️  Skipping invalid taxonomy_id: ${taxonomy_id}`)
        continue
      }

      if (!validateTaxonomyClassification(taxonomy_id, llm_value, taxonomy_entry)) {
        console.warn(
          `⚠️  Taxonomy validation failed for ${taxonomy_id}: ` +
          `LLM value "${llm_value}" doesn't match taxonomy`
        )
        continue
      }

      const taxonomy_value = getTaxonomyValue(taxonomy_entry)
      const final_value = taxonomy_value.startsWith('*') ? llm_value : taxonomy_value

      const selection = {
        taxonomy_id,
        section: 'household',
        value: final_value,
        confidence: classification.confidence || 0.7,
        category_path: taxonomy_entry.category_path,
        tier_1: taxonomy_entry.tier_1,
        tier_2: taxonomy_entry.tier_2,
        tier_3: taxonomy_entry.tier_3,
        tier_4: taxonomy_entry.tier_4,
        tier_5: taxonomy_entry.tier_5,
        grouping_tier_key: taxonomy_entry.grouping_tier_key,
        grouping_value: taxonomy_entry.grouping_value || final_value,
        reasoning: classification.reasoning || '',
        email_ids: classification.email_ids || []
      }

      final_selections.push(selection)
    }

    // ===== ENHANCED LOGGING (Python lines 495-514) =====
    console.info(`📊 Household Validation Pipeline:`)
    console.info(`  - LLM returned: ${classifications.length} raw classifications`)
    console.info(`  - After evidence judge: ${validated_classifications.length} passed quality check`)
    console.info(`  - After taxonomy validation: ${final_selections.length} final`)

    if (classifications.length > validated_classifications.length) {
      const rejected = classifications.length - validated_classifications.length
      console.warn(`⚠️  Evidence judge rejected ${rejected} classifications (weak evidence)`)
    }

    if (validated_classifications.length > final_selections.length) {
      const rejected = validated_classifications.length - final_selections.length
      console.warn(`⚠️  Final validation rejected ${rejected} classifications (taxonomy mismatch)`)
    }

    const with_provenance = final_selections.filter(c => c.email_ids && c.email_ids.length > 0).length
    console.info(
      `✅ Household agent complete: ${final_selections.length} classifications added\n` +
      `   Provenance tracked: ${with_provenance}/${final_selections.length} have email_ids`
    )

    return {
      ...state,
      household_results: [...(state.household_results || []), ...final_selections],
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
    const llm_client = state.llm_client || new AnalyzerLLMClient({
      provider: state.llm_provider || 'openai',
      model: state.llm_model,
      llm_config: state.llm_config, // Phase 1.5: Pass API keys from server
    })

    // Python lines 571-575: Call the full ReAct agent
    const result = await extract_interests_with_agent({
      emails,
      llm_client,
      max_iterations: 3,  // Python line 574 (FIXED: was 1, should be 3)
    })

    const classifications = result.classifications || []

    // ===== EVIDENCE QUALITY VALIDATION (Python lines 586-632) =====
    const email_context = emails.map((email: any) => {
      const subject = email.subject || ''
      const body = (email.body || email.text || '').substring(0, 500)
      return `Subject: ${subject}\n${body}`
    }).join('\n\n')

    const taxonomy_valid_classifications = classifications.filter((c: any) => c.taxonomy_id)

    console.info(`📊 Evidence Judge: Evaluating ${taxonomy_valid_classifications.length} classifications`)

    const evidence_evals = await evaluate_evidence_quality_batch({
      classifications: taxonomy_valid_classifications,
      email_context,
      section_guidelines: INTERESTS_EVIDENCE_GUIDELINES,
      llm_client,
      max_workers: 5,
      actual_batch_size: batchSize
    })

    const validated_classifications: any[] = []
    for (let i = 0; i < taxonomy_valid_classifications.length; i++) {
      let classification = taxonomy_valid_classifications[i]
      const evidence_eval = evidence_evals[i]

      classification = adjust_confidence_with_evidence_quality(classification, evidence_eval)

      if (should_block_classification(evidence_eval.quality_score)) {
        console.warn(
          `⚠️  Blocking classification ${classification.taxonomy_id} ` +
          `(quality_score=${evidence_eval.quality_score.toFixed(2)}): ${evidence_eval.issue}`
        )
        continue
      }

      validated_classifications.push(classification)
    }

    // ===== TAXONOMY VALIDATION (Python lines 634-674) =====
    const final_selections: any[] = []

    for (const classification of validated_classifications) {
      const taxonomy_id = classification.taxonomy_id
      const llm_value = (classification.value || '').trim()

      const taxonomy_entry = lookupTaxonomyEntry(taxonomy_id)
      if (!taxonomy_entry) {
        console.warn(`⚠️  Skipping invalid taxonomy_id: ${taxonomy_id}`)
        continue
      }

      if (!validateTaxonomyClassification(taxonomy_id, llm_value, taxonomy_entry)) {
        console.warn(
          `⚠️  Taxonomy validation failed for ${taxonomy_id}: ` +
          `LLM value "${llm_value}" doesn't match taxonomy`
        )
        continue
      }

      const taxonomy_value = getTaxonomyValue(taxonomy_entry)
      const final_value = taxonomy_value.startsWith('*') ? llm_value : taxonomy_value

      const selection = {
        taxonomy_id,
        section: 'interests',
        value: final_value,
        confidence: classification.confidence || 0.7,
        category_path: taxonomy_entry.category_path,
        tier_1: taxonomy_entry.tier_1,
        tier_2: taxonomy_entry.tier_2,
        tier_3: taxonomy_entry.tier_3,
        tier_4: taxonomy_entry.tier_4,
        tier_5: taxonomy_entry.tier_5,
        grouping_tier_key: taxonomy_entry.grouping_tier_key,
        grouping_value: taxonomy_entry.grouping_value || final_value,
        reasoning: classification.reasoning || '',
        email_ids: classification.email_ids || []
      }

      final_selections.push(selection)
    }

    // ===== ENHANCED LOGGING (Python lines 676-695) =====
    console.info(`📊 Interests Validation Pipeline:`)
    console.info(`  - LLM returned: ${classifications.length} raw classifications`)
    console.info(`  - After evidence judge: ${validated_classifications.length} passed quality check`)
    console.info(`  - After taxonomy validation: ${final_selections.length} final`)

    if (classifications.length > validated_classifications.length) {
      const rejected = classifications.length - validated_classifications.length
      console.warn(`⚠️  Evidence judge rejected ${rejected} classifications (weak evidence)`)
    }

    if (validated_classifications.length > final_selections.length) {
      const rejected = validated_classifications.length - final_selections.length
      console.warn(`⚠️  Final validation rejected ${rejected} classifications (taxonomy mismatch)`)
    }

    const with_provenance = final_selections.filter(c => c.email_ids && c.email_ids.length > 0).length
    console.info(
      `✅ Interests agent complete: ${final_selections.length} classifications added\n` +
      `   Provenance tracked: ${with_provenance}/${final_selections.length} have email_ids`
    )

    return {
      ...state,
      interests_results: [...(state.interests_results || []), ...final_selections],
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
    const llm_client = state.llm_client || new AnalyzerLLMClient({
      provider: state.llm_provider || 'openai',
      model: state.llm_model,
      llm_config: state.llm_config, // Phase 1.5: Pass API keys from server
    })

    // Python lines 752-756: Call the full ReAct agent
    const result = await extract_purchase_with_agent({
      emails,
      llm_client,
      max_iterations: 3,  // Python line 755 (FIXED: was 1, should be 3)
    })

    const classifications = result.classifications || []

    // ===== EVIDENCE QUALITY VALIDATION (Python lines 767-813) =====
    const email_context = emails.map((email: any) => {
      const subject = email.subject || ''
      const body = (email.body || email.text || '').substring(0, 500)
      return `Subject: ${subject}\n${body}`
    }).join('\n\n')

    const taxonomy_valid_classifications = classifications.filter((c: any) => c.taxonomy_id)

    console.info(`📊 Evidence Judge: Evaluating ${taxonomy_valid_classifications.length} classifications`)

    const evidence_evals = await evaluate_evidence_quality_batch({
      classifications: taxonomy_valid_classifications,
      email_context,
      section_guidelines: PURCHASE_EVIDENCE_GUIDELINES,
      llm_client,
      max_workers: 5,
      actual_batch_size: batchSize
    })

    const validated_classifications: any[] = []
    for (let i = 0; i < taxonomy_valid_classifications.length; i++) {
      let classification = taxonomy_valid_classifications[i]
      const evidence_eval = evidence_evals[i]

      classification = adjust_confidence_with_evidence_quality(classification, evidence_eval)

      if (should_block_classification(evidence_eval.quality_score)) {
        console.warn(
          `⚠️  Blocking classification ${classification.taxonomy_id} ` +
          `(quality_score=${evidence_eval.quality_score.toFixed(2)}): ${evidence_eval.issue}`
        )
        continue
      }

      validated_classifications.push(classification)
    }

    // ===== TAXONOMY VALIDATION (Python lines 815-859) =====
    const final_selections: any[] = []

    for (const classification of validated_classifications) {
      const taxonomy_id = classification.taxonomy_id
      const llm_value = (classification.value || '').trim()

      const taxonomy_entry = lookupTaxonomyEntry(taxonomy_id)
      if (!taxonomy_entry) {
        console.warn(`⚠️  Skipping invalid taxonomy_id: ${taxonomy_id}`)
        continue
      }

      if (!validateTaxonomyClassification(taxonomy_id, llm_value, taxonomy_entry)) {
        console.warn(
          `⚠️  Taxonomy validation failed for ${taxonomy_id}: ` +
          `LLM value "${llm_value}" doesn't match taxonomy`
        )
        continue
      }

      const taxonomy_value = getTaxonomyValue(taxonomy_entry)
      const final_value = taxonomy_value.startsWith('*') ? llm_value : taxonomy_value

      const selection = {
        taxonomy_id,
        section: 'purchase_intent',
        value: final_value,
        confidence: classification.confidence || 0.7,
        purchase_intent_flag: classification.purchase_intent_flag || false,  // Preserve purchase intent flag
        category_path: taxonomy_entry.category_path,
        tier_1: taxonomy_entry.tier_1,
        tier_2: taxonomy_entry.tier_2,
        tier_3: taxonomy_entry.tier_3,
        tier_4: taxonomy_entry.tier_4,
        tier_5: taxonomy_entry.tier_5,
        grouping_tier_key: taxonomy_entry.grouping_tier_key,
        grouping_value: taxonomy_entry.grouping_value || final_value,
        reasoning: classification.reasoning || '',
        email_ids: classification.email_ids || []
      }

      final_selections.push(selection)
    }

    // ===== ENHANCED LOGGING (Python lines 861-880) =====
    console.info(`📊 Purchase Validation Pipeline:`)
    console.info(`  - LLM returned: ${classifications.length} raw classifications`)
    console.info(`  - After evidence judge: ${validated_classifications.length} passed quality check`)
    console.info(`  - After taxonomy validation: ${final_selections.length} final`)

    if (classifications.length > validated_classifications.length) {
      const rejected = classifications.length - validated_classifications.length
      console.warn(`⚠️  Evidence judge rejected ${rejected} classifications (weak evidence)`)
    }

    if (validated_classifications.length > final_selections.length) {
      const rejected = validated_classifications.length - final_selections.length
      console.warn(`⚠️  Final validation rejected ${rejected} classifications (taxonomy mismatch)`)
    }

    const with_provenance = final_selections.filter(c => c.email_ids && c.email_ids.length > 0).length
    const with_purchase_intent = final_selections.filter(c => c.purchase_intent_flag).length
    console.info(
      `✅ Purchase agent complete: ${final_selections.length} classifications added\n` +
      `   Purchase intent flags: ${with_purchase_intent}/${final_selections.length}\n` +
      `   Provenance tracked: ${with_provenance}/${final_selections.length} have email_ids`
    )

    return {
      ...state,
      purchase_results: [...(state.purchase_results || []), ...final_selections],
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
  const batchSize = state.batch_size || 1
  console.info(`Running all 4 analyzers on current batch (${batchSize} emails)`)

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
