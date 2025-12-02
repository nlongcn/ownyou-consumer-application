/**
 * Reconcile Evidence Node
 *
 * 1:1 Port of Python reconcile.py from:
 * src/email_parser/workflow/nodes/reconcile.py (lines 19-101)
 * src/email_parser/memory/reconciliation.py (lines 81-358)
 *
 * Reconciles new evidence from analyzer results with existing memories.
 * Uses Phase 2 reconciliation logic to update confidence scores.
 */

import { WorkflowState } from '../state'
import { MemoryManager } from '../memory/MemoryManager'
import {
  updateConfidence,
  initializeConfidence,
  EvidenceType
} from '../confidence'

/**
 * Classification evidence type (analyzer result)
 */
interface TaxonomySelection {
  taxonomy_id: number
  section: string
  value: string
  confidence: number
  category_path: string
  tier_1: string
  tier_2?: string
  tier_3?: string
  tier_4?: string
  tier_5?: string
  grouping_tier_key?: string
  grouping_value?: string
  reasoning?: string
  purchase_intent_flag?: string
}

/**
 * Semantic memory structure
 */
interface SemanticMemory {
  taxonomy_id: number
  category_path: string
  tier_1: string
  tier_2: string
  tier_3: string
  tier_4: string
  tier_5: string
  grouping_tier_key: string
  grouping_value: string
  value: string
  confidence: number
  evidence_count: number
  supporting_evidence: string[]
  contradicting_evidence: string[]
  first_observed: string
  last_validated: string
  last_updated: string
  days_since_validation: number
  data_source: string
  source_ids: string[]
  section: string
  reasoning: string
  purchase_intent_flag?: string
}

/**
 * Helper Functions
 */

/**
 * Build semantic memory ID
 *
 * Python source: schemas.py:76-107 (build_semantic_memory_id)
 *
 * Format: semantic_{section}_{taxonomy_id}_{value_slug}
 */
function buildSemanticMemoryId(section: string, taxonomy_id: number, value: string): string {
  // Python lines 102-105: Slugify value
  let value_slug = value.toLowerCase()
    .replace(/\s/g, '_')
    .replace(/\|/g, '')
    .replace(/-/g, '_')

  // Remove multiple underscores
  value_slug = value_slug.split('_').filter(Boolean).join('_')

  // Python line 107
  return `semantic_${section}_${taxonomy_id}_${value_slug}`
}

/**
 * Get current email being processed
 *
 * Python source: state.py:259-283 (get_current_email)
 */
function getCurrentEmail(state: typeof WorkflowState.State): Record<string, any> | null {
  // Python lines 276-277
  if (!state.emails || state.emails.length === 0) {
    return null
  }

  // Python lines 279-281
  const index = state.current_email_index || 0
  if (index >= state.emails.length) {
    return null
  }

  // Python line 283
  return state.emails[index]
}

/**
 * Classify evidence type
 *
 * Python source: reconciliation.py:36-78 (classify_evidence_type)
 */
function classifyEvidenceType(
  existing_value: string,
  new_value: string,
  taxonomy_id: number
): EvidenceType {
  // Python lines 64-65: Normalize values
  const existing_normalized = existing_value.trim().toLowerCase()
  const new_normalized = new_value.trim().toLowerCase()

  // Python lines 67-78: Compare
  if (existing_normalized === new_normalized) {
    console.debug(
      `Evidence CONFIRMING: taxonomy_id=${taxonomy_id}, ` +
      `value='${new_value}' matches existing`
    )
    return 'confirming'
  } else {
    console.debug(
      `Evidence CONTRADICTING: taxonomy_id=${taxonomy_id}, ` +
      `new='${new_value}' ≠ existing='${existing_value}'`
    )
    return 'contradicting'
  }
}

/**
 * Reconcile single piece of evidence
 *
 * Python source: reconciliation.py:81-288 (reconcile_evidence)
 */
async function reconcileEvidence(
  memoryManager: MemoryManager,
  taxonomy_id: number,
  section: string,
  new_value: string,
  new_evidence_strength: number,
  email_id: string,
  category_path: string,
  tier_1: string,
  tier_2: string = '',
  tier_3: string = '',
  tier_4: string = '',
  tier_5: string = '',
  grouping_tier_key: string = '',
  grouping_value: string = '',
  reasoning: string = '',
  purchase_intent_flag?: string
): Promise<SemanticMemory> {
  // Python lines 150-151
  const memory_id = buildSemanticMemoryId(section, taxonomy_id, new_value)
  const now = new Date().toISOString()

  // Python lines 153-154: Load existing memory (if any)
  // Python line 154: existing_memory = memory_manager.get_semantic_memory(memory_id)
  const existing_memory = await memoryManager.getSemanticMemory(memory_id)

  // Python lines 156-193: First evidence for this taxonomy classification
  if (existing_memory === null) {
    console.info(
      `Creating NEW semantic memory: taxonomy_id=${taxonomy_id}, ` +
      `value='${new_value}', confidence=${new_evidence_strength.toFixed(3)}`
    )

    // Python lines 163-186
    const new_memory: SemanticMemory = {
      taxonomy_id,
      category_path,
      tier_1,
      tier_2,
      tier_3,
      tier_4,
      tier_5,
      grouping_tier_key,
      grouping_value,
      value: new_value,
      confidence: initializeConfidence(new_evidence_strength), // Python line 174
      evidence_count: 1,
      supporting_evidence: [String(email_id)],
      contradicting_evidence: [],
      first_observed: now,
      last_validated: now,
      last_updated: now,
      days_since_validation: 0,
      data_source: 'email',
      source_ids: [String(email_id)],
      section,
      reasoning,
    }

    // Python lines 188-190: Preserve additional fields
    if (purchase_intent_flag !== undefined) {
      new_memory.purchase_intent_flag = purchase_intent_flag
    }

    // Python line 192: Store new memory
    // Python line 192: memory_manager.store_semantic_memory(memory_id, new_memory)
    await memoryManager.storeSemanticMemory(memory_id, new_memory)

    return new_memory
  }

  // Python lines 195-288: Existing memory found - reconcile
  const memory = existing_memory
  const existing_value = memory.value
  const current_confidence = memory.confidence

  // Python line 201: Classify evidence type
  const evidence_type = classifyEvidenceType(existing_value, new_value, taxonomy_id)

  let new_confidence: number

  // Python lines 203-230: Update confidence based on evidence type
  if (evidence_type === 'confirming') {
    // Python lines 205-209
    new_confidence = updateConfidence(
      current_confidence,
      new_evidence_strength,
      'confirming'
    )

    // Python lines 212-214: Add to supporting evidence
    const supporting = memory.supporting_evidence
    if (!supporting.includes(email_id)) {
      supporting.push(email_id)
    }

  } else if (evidence_type === 'contradicting') {
    // Python lines 216-221
    new_confidence = updateConfidence(
      current_confidence,
      new_evidence_strength,
      'contradicting'
    )

    // Python lines 224-226: Add to contradicting evidence
    const contradicting = memory.contradicting_evidence
    if (!contradicting.includes(email_id)) {
      contradicting.push(email_id)
    }

  } else { // neutral
    // Python lines 228-229
    new_confidence = current_confidence
  }

  // Python lines 232-235: Update evidence count
  const total_evidence = (
    memory.supporting_evidence.length +
    memory.contradicting_evidence.length
  )

  // Python lines 237-241: Update source_ids
  const source_ids = memory.source_ids
  const email_id_str = String(email_id)
  if (!source_ids.includes(email_id_str)) {
    source_ids.push(email_id_str)
  }

  // Python lines 243-253: Prepare updates
  const updates: Partial<SemanticMemory> = {
    confidence: new_confidence,
    evidence_count: total_evidence,
    supporting_evidence: memory.supporting_evidence,
    contradicting_evidence: memory.contradicting_evidence,
    last_validated: now,
    last_updated: now,
    days_since_validation: 0,
    source_ids,
  }

  // Python lines 255-259: Add grouping metadata if provided
  if (grouping_tier_key) {
    updates.grouping_tier_key = grouping_tier_key
  }
  if (grouping_value) {
    updates.grouping_value = grouping_value
  }

  // Python lines 261-267: Append new reasoning
  if (reasoning) {
    const existing_reasoning = memory.reasoning || ''
    if (existing_reasoning) {
      updates.reasoning = `${existing_reasoning}\n\n[${now}] ${reasoning}`
    } else {
      updates.reasoning = reasoning
    }
  }

  // Python lines 269-271: Preserve additional fields
  if (purchase_intent_flag !== undefined) {
    updates.purchase_intent_flag = purchase_intent_flag
  }

  // Python lines 274-278: Update memory
  // Python line 275: memory_manager.update_semantic_memory(memory_id, updates)
  await memoryManager.updateSemanticMemory(memory_id, updates)

  console.info(
    `Updated semantic memory: taxonomy_id=${taxonomy_id}, ` +
    `confidence ${current_confidence.toFixed(3)} → ${new_confidence.toFixed(3)} ` +
    `(${evidence_type} evidence)`
  )

  // Python lines 286-288: Return updated memory
  return { ...memory, ...updates } as SemanticMemory
}

/**
 * Reconcile batch evidence
 *
 * Python source: reconciliation.py:291-358 (reconcile_batch_evidence)
 */
async function reconcileBatchEvidence(
  memoryManager: MemoryManager,
  taxonomy_selections: TaxonomySelection[],
  email_id: string
): Promise<SemanticMemory[]> {
  // Python line 322
  const updated_memories: SemanticMemory[] = []

  // Python lines 324-351: Process each selection
  for (const selection of taxonomy_selections) {
    try {
      // Python lines 326-343: Call reconcile_evidence with all fields
      const updated_memory = await reconcileEvidence(
        memoryManager,
        selection.taxonomy_id,
        selection.section,
        selection.value,
        selection.confidence,
        email_id,
        selection.category_path,
        selection.tier_1,
        selection.tier_2 || '',
        selection.tier_3 || '',
        selection.tier_4 || '',
        selection.tier_5 || '',
        selection.grouping_tier_key || '',
        selection.grouping_value || '',
        selection.reasoning || '',
        selection.purchase_intent_flag,
      )

      updated_memories.push(updated_memory)

    } catch (error) {
      // Python lines 347-350: Log error but continue
      console.error(
        `Failed to reconcile evidence for taxonomy_id=${selection.taxonomy_id}: ${error}`
      )
    }
  }

  // Python lines 353-356: Log summary
  console.info(
    `Batch reconciliation: processed ${updated_memories.length}/${taxonomy_selections.length} ` +
    `selections from email ${email_id}`
  )

  return updated_memories
}

/**
 * Reconcile evidence node
 *
 * Python source: reconcile.py:19-101 (reconcile_evidence_node)
 *
 * @param state Current workflow state with analyzer results
 * @param memoryManager MemoryManager instance
 * @returns Updated state with reconciliation_data
 */
export async function reconcileEvidenceNode(
  state: typeof WorkflowState.State,
  memoryManager: MemoryManager
): Promise<Partial<typeof WorkflowState.State>> {
  try {
    // BATCH PROCESSING FIX: Process ALL emails in the batch, not just current_email_index
    // The TypeScript workflow uses batch processing (all emails in one LLM call),
    // but Python workflow processes one email at a time in a loop.
    //
    // Since analyzers already processed ALL emails and added email_id to each classification,
    // we need to reconcile classifications FOR EACH EMAIL separately.

    const emails = state.emails || []

    console.log('[RECONCILE] Starting batch reconciliation')
    console.log(`[RECONCILE] Processing ${emails.length} emails`)

    if (emails.length === 0) {
      console.warn('No emails for reconciliation')
      return {}
    }

    // Collect all taxonomy selections from analyzers (already contains classifications for ALL emails)
    const all_selections: TaxonomySelection[] = []

    const demographics = (state.demographics_results || []) as TaxonomySelection[]
    const household = (state.household_results || []) as TaxonomySelection[]
    const interests = (state.interests_results || []) as TaxonomySelection[]
    const purchase = (state.purchase_results || []) as TaxonomySelection[]

    all_selections.push(...demographics)
    all_selections.push(...household)
    all_selections.push(...interests)
    all_selections.push(...purchase)

    console.info(`[RECONCILE] Total ${all_selections.length} taxonomy selections to reconcile`)

    if (all_selections.length === 0) {
      console.warn('No taxonomy selections to reconcile')
      return {
        reconciliation_data: [],
      }
    }

    // GROUP classifications by email_id and reconcile each email's classifications separately
    // This is critical because each email should update memories independently
    const classificationsByEmail = new Map<string, TaxonomySelection[]>()

    for (const selection of all_selections) {
      // Each classification has email_ids array from the analyzer
      // For batch processing, each classification should have exactly ONE email_id
      const email_ids = (selection as any).email_ids || []

      if (!email_ids || email_ids.length === 0) {
        console.warn(`Classification missing email_ids: ${JSON.stringify(selection).substring(0, 200)}`)
        continue
      }

      // Process each email_id (usually just one per classification in batch mode)
      for (const email_id of email_ids) {
        if (!classificationsByEmail.has(email_id)) {
          classificationsByEmail.set(email_id, [])
        }
        classificationsByEmail.get(email_id)!.push(selection)
      }
    }

    console.info(`[RECONCILE] Grouped classifications for ${classificationsByEmail.size} emails`)

    // Reconcile each email's classifications separately
    const all_reconciled_memories: SemanticMemory[] = []

    for (const [email_id, email_selections] of classificationsByEmail) {
      console.info(`[RECONCILE] Reconciling ${email_selections.length} selections for email ${email_id}`)

      const reconciled_memories = await reconcileBatchEvidence(
        memoryManager,
        email_selections,
        email_id
      )

      all_reconciled_memories.push(...reconciled_memories)
    }

    console.info(`[RECONCILE] Batch reconciliation complete: ${all_reconciled_memories.length} total memories updated`)

    // Log summary by email
    for (const [email_id, email_selections] of classificationsByEmail) {
      console.debug(
        `  Email ${email_id}: ${email_selections.length} classifications reconciled`
      )
    }

    return {
      reconciliation_data: all_reconciled_memories,
    }

  } catch (error) {
    // Python lines 96-100: Error handling
    console.error(`Error reconciling evidence: ${error}`, error)

    const error_message = error instanceof Error ? error.message : String(error)

    return {
      reconciliation_data: [],
      errors: [...(state.errors || []), `Reconciliation failed: ${error_message}`],
    }
  }
}
