/**
 * Batch Optimizer for Email Processing
 *
 * TypeScript port of Python batch_optimizer.py (lines 1-227)
 *
 * Dynamically calculates optimal batch sizes based on:
 * - Model context window (retrieved from LLM vendor API)
 * - Email token estimation
 * - Target context utilization (60-80%)
 *
 * MIGRATION NOTE: This is an EXACT 1:1 translation of the Python implementation.
 * Every function has been verified against the Python source.
 */

import type { WorkflowStateInterface } from './state'

/**
 * Logger placeholder
 * TODO: Implement proper logging system
 */
const logger = {
  debug: (message: string) => console.debug('[Batch Optimizer]', message),
  info: (message: string) => console.info('[Batch Optimizer]', message),
  warning: (message: string) => console.warn('[Batch Optimizer]', message),
  error: (message: string) => console.error('[Batch Optimizer]', message),
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count for a single email
 *
 * Uses rough heuristic: 1 token ≈ 4 characters for English text.
 *
 * Python source: batch_optimizer.py:17-48
 *
 * @param email - Email dict with subject, sender, body
 * @returns Estimated token count
 *
 * @example
 * const email = { subject: "Test", body: "...".repeat(500) }
 * estimateEmailTokens(email) // ~500
 */
export function estimateEmailTokens(email: Record<string, any>): number {
  // Python lines 34-36: Extract fields
  // subject = email.get("subject", "")
  const subject = email.subject || ''
  // sender = email.get("sender", "")
  const sender = email.sender || ''
  // body = email.get("body", "")
  const body = email.body || ''

  // Python line 39: Count total characters
  // total_chars = len(subject) + len(sender) + len(body)
  const totalChars = subject.length + sender.length + body.length

  // Python line 42: Add overhead for formatting
  // format_overhead = 100
  const formatOverhead = 100

  // Python line 45: Rough conversion: 4 chars per token
  // estimated_tokens = (total_chars + format_overhead) // 4
  const estimatedTokens = Math.floor((totalChars + formatOverhead) / 4)

  // Python line 47: return estimated_tokens
  return estimatedTokens
}

// ============================================================================
// BATCH SIZE CALCULATION
// ============================================================================

/**
 * Calculate optimal batch size to fit in context window
 *
 * Strategy:
 * - Reserve 30% for system prompt, taxonomy context, response
 * - Fill remaining 70% with emails
 * - Stop when adding next email would exceed limit
 *
 * Python source: batch_optimizer.py:50-136
 *
 * @param emails - Full list of emails
 * @param contextWindow - Model's context window size (tokens)
 * @param startIndex - Starting position in emails list (default: 0)
 * @param targetUtilization - Target % of context to use for emails (default: 0.70)
 * @param minBatchSize - Minimum emails per batch (default: 5)
 * @param maxBatchSize - Maximum emails per batch (default: 50)
 * @returns Number of emails to include in batch
 *
 * @example
 * const emails = Array(100).fill({ body: "...".repeat(1000) })
 * calculateBatchSize(emails, 128000) // ~15 emails fit in 128K context
 */
export function calculateBatchSize(
  emails: Array<Record<string, any>>,
  contextWindow: number,
  startIndex: number = 0,
  targetUtilization: number = 0.70,
  minBatchSize: number = 5,
  maxBatchSize: number = 50
): number {
  // Python lines 82-83: if start_index >= len(emails): return 0
  if (startIndex >= emails.length) {
    return 0
  }

  // Python lines 86-88: Handle None context_window
  // if context_window is None:
  if (contextWindow === null || contextWindow === undefined) {
    logger.warning('contextWindow is null/undefined, using fallback batch size')
    return Math.min(maxBatchSize, emails.length - startIndex)
  }

  // Python lines 92-93: Calculate available tokens for emails
  // reserved_tokens = int(context_window * (1 - target_utilization))
  const reservedTokens = Math.floor(contextWindow * (1 - targetUtilization))
  // available_tokens = context_window - reserved_tokens
  const availableTokens = contextWindow - reservedTokens

  // Python lines 95-98: Debug logging
  logger.debug(
    `Batch calculation: contextWindow=${contextWindow}, ` +
      `reserved=${reservedTokens}, available=${availableTokens}`
  )

  // Python lines 101-102: Accumulate emails until we exceed available tokens
  // cumulative_tokens = 0
  let cumulativeTokens = 0
  // batch_size = 0
  let batchSize = 0

  // Python lines 104-112: for i in range(start_index, min(start_index + max_batch_size, len(emails))):
  for (let i = startIndex; i < Math.min(startIndex + maxBatchSize, emails.length); i++) {
    // Python line 105: email_tokens = estimate_email_tokens(emails[i])
    const emailTokens = estimateEmailTokens(emails[i])

    // Python lines 107-109: if cumulative_tokens + email_tokens > available_tokens: break
    if (cumulativeTokens + emailTokens > availableTokens) {
      // Adding this email would exceed limit
      break
    }

    // Python line 111: cumulative_tokens += email_tokens
    cumulativeTokens += emailTokens
    // Python line 112: batch_size += 1
    batchSize += 1
  }

  // Python lines 115-121: Ensure minimum batch size
  // remaining_emails = len(emails) - start_index
  const remainingEmails = emails.length - startIndex
  // if batch_size < min_batch_size and remaining_emails >= min_batch_size:
  if (batchSize < minBatchSize && remainingEmails >= minBatchSize) {
    logger.warning(
      `Calculated batchSize=${batchSize} is below minimum=${minBatchSize}. ` +
        `Using minimum (may exceed context window slightly).`
    )
    // batch_size = min(min_batch_size, remaining_emails)
    batchSize = Math.min(minBatchSize, remainingEmails)
  }

  // Python lines 124-129: Handle edge case: no emails fit
  // if batch_size == 0 and remaining_emails > 0:
  if (batchSize === 0 && remainingEmails > 0) {
    logger.warning(
      `Single email at index ${startIndex} estimated at ${estimateEmailTokens(emails[startIndex])} tokens ` +
        `exceeds available space of ${availableTokens} tokens. Processing anyway (may truncate).`
    )
    // batch_size = 1
    batchSize = 1
  }

  // Python lines 131-134: Log summary
  logger.info(
    `Batch size: ${batchSize} emails (${cumulativeTokens.toLocaleString()} tokens / ${availableTokens.toLocaleString()} available, ` +
      `${((cumulativeTokens / availableTokens) * 100).toFixed(1)}% utilization)`
  )

  // Python line 136: return batch_size
  return batchSize
}

// ============================================================================
// STATE-BASED BATCH OPERATIONS
// ============================================================================

/**
 * Extract current batch of emails from workflow state
 *
 * Python source: batch_optimizer.py:139-163
 *
 * @param state - Workflow state with emails, current_batch_start, batch_size
 * @returns List of emails in current batch
 *
 * @example
 * const state = {
 *   emails: [...100 emails...],
 *   current_batch_start: 0,
 *   batch_size: 15
 * }
 * const batch = getBatchFromState(state)
 * batch.length // 15
 */
export function getBatchFromState(state: WorkflowStateInterface): Array<Record<string, any>> {
  // Python line 159: emails = state.get("emails", [])
  const emails = state.emails || []
  // Python line 160: start = state.get("current_batch_start", 0)
  const start = state.current_batch_start ?? 0
  // Python line 161: size = state.get("batch_size", 1)
  const size = state.batch_size ?? 1

  // Python line 163: return emails[start:start + size]
  return emails.slice(start, start + size)
}

/**
 * Check if there are more batches to process
 *
 * Python source: batch_optimizer.py:166-179
 *
 * @param state - Workflow state
 * @returns True if more batches remain, False if done
 */
export function hasMoreBatches(state: WorkflowStateInterface): boolean {
  // Python line 176: emails = state.get("emails", [])
  const emails = state.emails || []
  // Python line 177: start = state.get("current_batch_start", 0)
  const start = state.current_batch_start ?? 0

  // Python line 179: return start < len(emails)
  return start < emails.length
}

/**
 * Advance workflow state to next batch
 *
 * Updates current_batch_start and recalculates batch_size for next batch.
 *
 * Python source: batch_optimizer.py:182-217
 *
 * IMPORTANT: This function MUTATES the state object (Python pattern)
 *
 * @param state - Current workflow state (will be mutated)
 * @returns Updated state with next batch configured
 */
export function advanceToNextBatch(state: WorkflowStateInterface): WorkflowStateInterface {
  // Python line 194: current_start = state.get("current_batch_start", 0)
  const currentStart = state.current_batch_start ?? 0
  // Python line 195: current_size = state.get("batch_size", 1)
  const currentSize = state.batch_size ?? 1

  // Python lines 198-199: Move to next batch
  // next_start = current_start + current_size
  const nextStart = currentStart + currentSize
  // state["current_batch_start"] = next_start
  state.current_batch_start = nextStart

  // Python lines 202-203: Recalculate batch size for next batch
  // emails = state.get("emails", [])
  const emails = state.emails || []
  // context_window = state.get("model_context_window", 128000)
  const contextWindow = state.model_context_window ?? 128000

  // Python lines 205-210: next_batch_size = calculate_batch_size(...)
  const nextBatchSize = calculateBatchSize(
    emails,
    contextWindow,
    nextStart
  )
  // state["batch_size"] = next_batch_size
  state.batch_size = nextBatchSize

  // Python lines 212-215: Log summary
  logger.info(
    `Advanced to batch starting at email ${nextStart} ` +
      `(batch_size=${nextBatchSize}, ${emails.length - nextStart} emails remaining)`
  )

  // Python line 217: return state
  return state
}

// ============================================================================
// EXPORTS
// ============================================================================

// Python lines 220-226: __all__ = [...]
// Export all functions for use by analyzer nodes
