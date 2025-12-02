/**
 * Update Memory Node
 *
 * 1:1 Port of Python update_memory.py from:
 * src/email_parser/workflow/nodes/update_memory.py (lines 23-159)
 *
 * Final node that:
 * 1. Stores episodic memory for current email
 * 2. Marks email as processed
 * 3. Updates final profile in state
 * 4. Tracks classification changes for dashboard
 */

import { WorkflowState } from '../state'
import { MemoryManager } from '../memory/MemoryManager'

/**
 * Helper Functions
 */

/**
 * Build episodic memory ID
 *
 * Python source: schemas.py:110-125 (build_episodic_memory_id)
 *
 * Format: episodic_email_{email_id}
 */
function buildEpisodicMemoryId(email_id: string): string {
  // Python line 124
  return `episodic_email_${email_id}`
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
 * Update memory node
 *
 * Python source: update_memory.py:23-159 (update_memory_node)
 *
 * @param state Current workflow state with reconciliation_data
 * @param memoryManager MemoryManager instance
 * @returns Updated state with updated_profile and workflow_completed_at
 */
export async function updateMemoryNode(
  state: typeof WorkflowState.State,
  memoryManager: MemoryManager
): Promise<Partial<typeof WorkflowState.State>> {
  try {
    // Python lines 47-51: Get current email
    const email = getCurrentEmail(state)

    if (email === null) {
      console.warn('No email to update in memory')
      return {}
    }

    // Python lines 53-56
    const email_id = email.id || 'unknown'
    const email_date = email.date || ''
    const email_subject = email.subject || ''

    console.info(`Updating memory for email: ${email_id}`)

    // Python lines 59-72: Build episodic memory (evidence trail)
    const episode_id = buildEpisodicMemoryId(email_id)

    // Collect taxonomy selections from reconciliation
    const taxonomy_selections: number[] = []
    const confidence_contributions: Record<number, number> = {}

    for (const memory of (state.reconciliation_data || [])) {
      const tax_id = memory.taxonomy_id
      const conf = memory.confidence || 0.0

      if (tax_id) {
        taxonomy_selections.push(tax_id)
        confidence_contributions[tax_id] = conf
      }
    }

    // Python lines 74-82: Create reasoning summary
    const reasoning_parts: string[] = []
    for (const memory of (state.reconciliation_data || [])) {
      if (memory.reasoning) {
        reasoning_parts.push(
          `${memory.value}: ${memory.reasoning}`
        )
      }
    }

    const reasoning = reasoning_parts.length > 0
      ? reasoning_parts.join('\n')
      : 'Evidence reconciled with existing profile'

    // Python lines 84-96: Store episodic memory
    const episodic_data = {
      email_id,
      email_date,
      email_subject: email_subject.substring(0, 200), // Limit length
      taxonomy_selections,
      confidence_contributions,
      reasoning,
      processed_at: new Date().toISOString(),
      llm_model: 'placeholder:phase3-stub' // Phase 4 will use actual model
    }

    // Python line 96: memory_manager.store_episodic_memory(episode_id, episodic_data)
    await memoryManager.storeEpisodicMemory(episode_id, episodic_data)
    console.info(`Stored episodic memory: ${episode_id}`)

    // Python lines 99-101: Mark email as processed
    // Python line 100: memory_manager.mark_email_as_processed(email_id)
    await memoryManager.markEmailAsProcessed(email_id)
    console.info(`Marked email as processed: ${email_id}`)

    // Python lines 103-119: Update state with latest profile
    // Python line 104: all_memories = memory_manager.get_all_semantic_memories()
    const all_memories = await memoryManager.getAllSemanticMemories()

    // Group by section
    const updated_profile: Record<string, Array<Record<string, any>>> = {
      demographics: [],
      household: [],
      interests: [],
      purchase_intent: [],
      actual_purchases: []
    }

    for (const memory of all_memories) {
      const section = memory.section || 'unknown'
      if (section in updated_profile) {
        updated_profile[section].push(memory)
      }
    }

    // Python lines 120-121
    const workflow_completed_at = new Date().toISOString()

    // Python lines 123-150: Track classification snapshots for dashboard
    // Note: Browser PWA may not need WorkflowTracker (Python-specific)
    // For now, skip tracking implementation

    // TODO: If dashboard tracking is needed, implement:
    // - tracker.recordEmailProcessed()
    // - tracker.recordClassificationChange()

    console.info('Memory update complete')

    // Python line 154: Return updated state
    return {
      updated_profile,
      workflow_completed_at,
    }

  } catch (error) {
    // Python lines 156-159: Error handling
    console.error(`Error updating memory: ${error}`, error)

    const error_message = error instanceof Error ? error.message : String(error)

    return {
      updated_profile: state.existing_profile,
      errors: [...(state.errors || []), `Memory update failed: ${error_message}`],
    }
  }
}

/**
 * Generate profile report
 *
 * Python source: update_memory.py:162-196 (generate_profile_report)
 *
 * @param state Workflow state with updated_profile
 * @returns Dictionary with formatted profile report
 */
export function generateProfileReport(state: typeof WorkflowState.State): Record<string, any> {
  // Python line 177
  const updated_profile = state.updated_profile || {}

  // Python lines 179-194
  const report = {
    user_id: state.user_id,
    generated_at: new Date().toISOString(),
    demographics: updated_profile.demographics || [],
    household: updated_profile.household || [],
    interests: updated_profile.interests || [],
    purchase_intent: updated_profile.purchase_intent || [],
    actual_purchases: updated_profile.actual_purchases || [],
    metadata: {
      total_emails_processed: (state.current_email_index || 0) + 1,
      workflow_started_at: state.workflow_started_at,
      workflow_completed_at: state.workflow_completed_at,
      errors: state.errors || [],
      warnings: state.warnings || [],
    }
  }

  return report
}
