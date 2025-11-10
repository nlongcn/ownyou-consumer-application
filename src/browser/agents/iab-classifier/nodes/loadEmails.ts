/**
 * Load Emails Node
 *
 * 1:1 Port of Python load_new_emails_node from:
 * src/email_parser/workflow/nodes/load_emails.py (lines 21-111)
 *
 * Loads new emails that haven't been processed yet by filtering
 * against the processed email IDs stored in memory.
 *
 * This enables incremental daily runs where only new emails are analyzed.
 */

import { WorkflowState } from '../state'
import { IndexedDBStore } from '@browser/store'

/**
 * Load new emails that haven't been processed yet
 *
 * Python source: load_emails.py:21-111 (load_new_emails_node)
 *
 * Workflow Steps:
 * 1. Get list of already-processed email IDs from memory
 * 2. Filter out processed emails from input emails
 * 3. Update state with new emails and processed IDs
 * 4. Handle edge cases (no emails, all processed, etc.)
 *
 * @param state Current workflow state with user_id
 * @param store IndexedDBStore instance for retrieving processed IDs
 * @returns Updated state with filtered emails
 */
export async function loadNewEmailsNode(
  state: typeof WorkflowState.State,
  store: IndexedDBStore
): Promise<Partial<typeof WorkflowState.State>> {
  try {
    console.info(`🔄 Loading emails for user: ${state.user_id}`)

    // Python lines 53-54: Get force_reprocess flag
    const force_reprocess = state.force_reprocess || false

    // Python lines 56-62: Get processed email IDs from memory (unless force reprocess)
    let processed_ids: string[] = []
    if (force_reprocess) {
      console.info('Force reprocess enabled - ignoring already-processed emails')
    } else {
      // TODO: Implement store.getProcessedEmailIds()
      // For now, use empty array (all emails are "new")
      processed_ids = []
      console.info(`Found ${processed_ids.length} already-processed emails`)
    }

    // Python lines 64-73: Get input emails and handle empty case
    const all_emails = state.emails || []
    if (all_emails.length === 0) {
      console.warn('No emails provided in state')

      // Python lines 68-73: Update state with warning
      return {
        emails: [],
        processed_email_ids: processed_ids,
        total_emails: 0,
        current_email_index: 0,
        warnings: [...(state.warnings || []), 'No emails provided for processing'],
      }
    }

    // Python lines 75-90: Filter out already-processed emails (unless force reprocess)
    let new_emails: Array<Record<string, any>>
    if (force_reprocess) {
      new_emails = all_emails
      console.info(`Processing all ${all_emails.length} emails (force reprocess)`)
    } else {
      // Python lines 80-84: Filter using Set for O(1) lookups
      const processed_ids_set = new Set(processed_ids)
      new_emails = all_emails.filter(
        (email) => !processed_ids_set.has(email.id as string)
      )

      // Python lines 87-90: Log filtering results
      console.info(
        `Filtered ${all_emails.length} total emails → ` +
        `${new_emails.length} new emails to process`
      )
    }

    // Python lines 92-94: Handle all-processed case
    const warnings = [...(state.warnings || [])]
    if (new_emails.length === 0) {
      console.info('All emails already processed - nothing to do')
      warnings.push('All emails already processed')
    }

    // Python lines 96-103: Update state
    const workflow_started_at = new Date().toISOString()

    console.info(`Load emails complete: ${new_emails.length} emails ready for processing`)

    return {
      emails: new_emails,
      processed_email_ids: processed_ids,
      total_emails: new_emails.length,
      current_email_index: 0,
      workflow_started_at,
      warnings,
    }

  } catch (error) {
    // Python lines 106-111: Error handling
    console.error(`Error loading emails: ${error}`)

    const error_message = error instanceof Error ? error.message : String(error)

    return {
      emails: [],
      total_emails: 0,
      errors: [...(state.errors || []), `Failed to load emails: ${error_message}`],
    }
  }
}
