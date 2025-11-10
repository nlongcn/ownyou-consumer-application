/**
 * Retrieve Profile Node
 *
 * 1:1 Port of Python retrieve_existing_profile_node from:
 * src/email_parser/workflow/nodes/retrieve_profile.py (lines 20-118)
 *
 * Retrieves existing taxonomy profile from memory and applies
 * temporal decay to confidence scores.
 */

import { WorkflowState } from '../state'
import { IndexedDBStore } from '@browser/store'
import { applyTemporalDecay, calculateDaysSinceValidation } from '../confidence'

/**
 * Retrieve existing profile from memory with temporal decay applied
 *
 * Python source: retrieve_profile.py:20-118 (retrieve_existing_profile_node)
 *
 * Workflow Steps:
 * 1. Query all semantic memories for user
 * 2. Group memories by taxonomy section
 * 3. Apply temporal decay to confidence scores
 * 4. Structure profile by sections
 * 5. Update state with existing_profile
 *
 * @param state Current workflow state with user_id
 * @param store IndexedDBStore instance
 * @returns Updated state with existing_profile populated
 */
export async function retrieveExistingProfileNode(
  state: typeof WorkflowState.State,
  store: IndexedDBStore
): Promise<Partial<typeof WorkflowState.State>> {
  try {
    console.info(`📂 Retrieving existing profile for user: ${state.user_id}`)

    // Python lines 50-52: Get all semantic memories
    // TODO: Implement store.getAllSemanticMemories()
    // For now, return empty profile
    const all_memories: Array<Record<string, any>> = []
    console.info(`Retrieved ${all_memories.length} memories from store`)

    // Python lines 54-76: Apply temporal decay to each memory
    const decayed_memories: Array<Record<string, any>> = []
    for (const memory of all_memories) {
      // Python line 58: Calculate days since validation
      const days_since = calculateDaysSinceValidation(memory.last_validated)

      // Python lines 61-62: Apply decay
      const original_conf = memory.confidence
      const decayed_conf = applyTemporalDecay(original_conf, days_since)

      // Python lines 64-67: Update memory with decayed confidence
      const memory_with_decay = {
        ...memory,
        confidence: decayed_conf,
        days_since_validation: days_since,
      }

      // Python lines 69-74: Log decay if applied
      if (decayed_conf < original_conf) {
        console.debug(
          `Applied decay to ${memory.memory_id}: ` +
          `${original_conf.toFixed(3)} → ${decayed_conf.toFixed(3)} ` +
          `(${days_since} days)`
        )
      }

      decayed_memories.push(memory_with_decay)
    }

    // Python lines 78-92: Group by section
    const profile: Record<string, Array<Record<string, any>>> = {
      demographics: [],
      household: [],
      interests: [],
      purchase_intent: [],
      actual_purchases: [],
    }

    for (const memory of decayed_memories) {
      const section = memory.section || 'unknown'
      if (section in profile) {
        profile[section].push(memory)
      } else {
        console.warn(`Unknown section: ${section}`)
      }
    }

    // Python lines 94-99: Log profile summary
    console.info('Profile structure:')
    for (const [section, memories] of Object.entries(profile)) {
      if (memories.length > 0) {
        const avg_conf = memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length
        console.info(`  ${section}: ${memories.length} memories (avg confidence: ${avg_conf.toFixed(3)})`)
      }
    }

    // Python lines 101-105: Update state
    console.info('Profile retrieval complete')

    return {
      existing_profile: profile,
    }

  } catch (error) {
    // Python lines 107-118: Error handling
    console.error(`Error retrieving profile: ${error}`)

    const error_message = error instanceof Error ? error.message : String(error)

    // Python lines 110-117: Return empty profile on error
    return {
      existing_profile: {
        demographics: [],
        household: [],
        interests: [],
        purchase_intent: [],
        actual_purchases: [],
      },
      errors: [...(state.errors || []), `Failed to retrieve profile: ${error_message}`],
    }
  }
}
