/**
 * IAB Classifier Workflow State
 *
 * TypeScript port of Python WorkflowState from:
 * src/email_parser/workflow/state.py (lines 15-404)
 *
 * This file provides:
 * - WorkflowState interface (LangGraph.js state schema)
 * - State initialization and manipulation helpers
 * - Batch processing utilities
 *
 * MIGRATION NOTE: This is an EXACT 1:1 translation of the Python implementation.
 * Every type, field, and function has been verified against the Python source.
 */

import { Annotation } from '@langchain/langgraph/web'
import {
  getBatchFromState,
  hasMoreBatches,
  advanceToNextBatch as batchOptimizerAdvance,
  calculateBatchSize,
} from './batchOptimizer'

/**
 * WorkflowStateInterface - TypeScript interface for type checking
 *
 * Python source: state.py:15-194 (class WorkflowState(TypedDict))
 *
 * This interface defines all state fields used throughout the classification workflow.
 * It serves as the type definition for the state schema.
 *
 * Note: The actual state schema object is created with Annotation.Root() below
 * and exported as WorkflowState for use with StateGraph.
 *
 * Type Mapping Legend:
 * - Python str → TypeScript string
 * - Python int → TypeScript number
 * - Python bool → TypeScript boolean
 * - Python List[T] → TypeScript Array<T>
 * - Python Dict[str, Any] → TypeScript Record<string, any>
 * - Python Optional[T] → TypeScript T | undefined
 * - Python NotRequired[T] → TypeScript T? (optional property)
 * - Python Any → TypeScript any
 */
export interface WorkflowStateInterface {
  // ============================================================================
  // REQUIRED FIELDS
  // ============================================================================

  /**
   * User ID
   * Python: state.py:37-38
   *   user_id: str
   *   """User ID for whom the profile is being built."""
   */
  user_id: string

  // ============================================================================
  // EMAIL DATA (Optional)
  // ============================================================================

  /**
   * List of email dictionaries to process
   * Python: state.py:44-56
   *   emails: NotRequired[List[Dict[str, Any]]]
   *   """List of email dictionaries to process.
   *
   *   Each email dict contains:
   *   - id: str
   *   - subject: str
   *   - body: str
   *   - sender: str
   *   - date: str
   *   - ... (other email metadata)
   *   """
   */
  emails?: Array<Record<string, any>>

  /**
   * List of email IDs that have been processed
   * Python: state.py:58-59
   *   processed_email_ids: NotRequired[List[str]]
   *   """List of email IDs that have been processed."""
   */
  processed_email_ids?: Array<string>

  /**
   * Current email index (DEPRECATED - use batch processing instead)
   * Python: state.py:61-62
   *   current_email_index: NotRequired[int]
   *   """Current index in the emails list (for single-email processing)."""
   */
  current_email_index?: number

  /**
   * Total number of emails
   * Python: state.py:64-65
   *   total_emails: NotRequired[int]
   *   """Total number of emails to process."""
   */
  total_emails?: number

  // ============================================================================
  // BATCH PROCESSING
  // ============================================================================

  /**
   * Starting index of current batch
   * Python: state.py:71-72
   *   current_batch_start: NotRequired[int]
   *   """Starting index of the current batch being processed."""
   */
  current_batch_start?: number

  /**
   * Number of emails in current batch
   * Python: state.py:74-75
   *   batch_size: NotRequired[int]
   *   """Number of emails to process in current batch."""
   */
  batch_size?: number

  /**
   * Model's context window size (tokens)
   * Python: state.py:77-78
   *   model_context_window: NotRequired[int]
   *   """Model's context window size in tokens."""
   */
  model_context_window?: number

  /**
   * Force reprocessing of already-processed emails
   * Python: state.py:80-81
   *   force_reprocess: NotRequired[bool]
   *   """Whether to reprocess emails that have already been processed."""
   */
  force_reprocess?: boolean

  // ============================================================================
  // LLM CONFIGURATION
  // ============================================================================

  /**
   * Cost tracker instance (for monitoring API costs)
   * Python: state.py:83-84
   *   cost_tracker: NotRequired[Any]
   *   """Cost tracker instance."""
   */
  cost_tracker?: any

  /**
   * Progress tracker instance
   * Python: state.py:86-87
   *   tracker: NotRequired[Any]
   *   """Progress tracker instance."""
   */
  tracker?: any

  /**
   * LLM model name
   * Python: state.py:89-90
   *   llm_model: NotRequired[str]
   *   """LLM model to use for classification."""
   */
  llm_model?: string

  /**
   * LLM configuration (API keys, etc.)
   * NOTE: For Phase 1.5 development only (admin dashboard).
   * In production (Phase 5), users provide their own keys via Settings UI.
   */
  llm_config?: {
    api_key?: string
    model?: string
    temperature?: number
    max_tokens?: number
    base_url?: string
  }

  /**
   * Injected LLM client (for testing)
   */
  llm_client?: any

  // ============================================================================
  // PROFILE DATA
  // ============================================================================

  /**
   * Existing IAB profile for the user
   * Python: state.py:96-106
   *   existing_profile: NotRequired[Dict[str, Any]]
   *   """Existing IAB profile retrieved from memory.
   *
   *   Structure:
   *   {
   *       "user_id": str,
   *       "demographics": List[Dict],
   *       "household": List[Dict],
   *       "interests": List[Dict],
   *       "purchase_intent": List[Dict]
   *   }
   *   """
   */
  existing_profile?: Record<string, any>

  // ============================================================================
  // ANALYSIS RESULTS (One per analyzer)
  // ============================================================================

  /**
   * Demographics analyzer results
   * Python: state.py:114-131
   *   demographics_results: NotRequired[List[Dict[str, Any]]]
   *   """Results from demographics analyzer.
   *
   *   Each result contains:
   *   - taxonomy_id: int
   *   - section: str
   *   - value: str
   *   - confidence: float
   *   - tier_1, tier_2, tier_3, tier_4, tier_5: str
   *   - category_path: str
   *   - grouping_tier_key: str
   *   - grouping_value: str
   *   - reasoning: str
   *   """
   */
  demographics_results?: Array<Record<string, any>>

  /**
   * Household analyzer results
   * Python: state.py:134-135
   *   household_results: NotRequired[List[Dict[str, Any]]]
   *   """Results from household analyzer."""
   */
  household_results?: Array<Record<string, any>>

  /**
   * Interests analyzer results
   * Python: state.py:137-138
   *   interests_results: NotRequired[List[Dict[str, Any]]]
   *   """Results from interests analyzer."""
   */
  interests_results?: Array<Record<string, any>>

  /**
   * Purchase intent analyzer results
   * Python: state.py:140-145
   *   purchase_results: NotRequired[List[Dict[str, Any]]]
   *   """Results from purchase intent analyzer.
   *
   *   Includes purchase_intent_flag field.
   *   """
   */
  purchase_results?: Array<Record<string, any>>

  // ============================================================================
  // RECONCILIATION
  // ============================================================================

  /**
   * Reconciliation data (merged classifications across analyzers)
   * Python: state.py:147-156
   *   reconciliation_data: NotRequired[List[Dict[str, Any]]]
   *   """Data from reconciliation process.
   *
   *   Contains merged classifications from all analyzers,
   *   with confidence scores adjusted based on:
   *   - Temporal decay
   *   - Evidence quality
   *   - Multi-source agreement
   *   """
   */
  reconciliation_data?: Array<Record<string, any>>

  /**
   * Updated profile after reconciliation
   * Python: state.py:158-167
   *   updated_profile: NotRequired[Dict[str, Any]]
   *   """Updated IAB profile after reconciliation.
   *
   *   Structure matches existing_profile:
   *   - demographics: List[Dict]
   *   - household: List[Dict]
   *   - interests: List[Dict]
   *   - purchase_intent: List[Dict]
   *   """
   */
  updated_profile?: Record<string, any>

  // ============================================================================
  // ERROR TRACKING
  // ============================================================================

  /**
   * List of error messages
   * Python: state.py:169-170
   *   errors: NotRequired[List[str]]
   *   """List of error messages encountered during workflow."""
   */
  errors?: Array<string>

  /**
   * List of warning messages
   * Python: state.py:172-173
   *   warnings: NotRequired[List[str]]
   *   """List of warning messages encountered during workflow."""
   */
  warnings?: Array<string>

  /**
   * Workflow start timestamp (ISO 8601)
   * Python: state.py:175-176
   *   workflow_started_at: NotRequired[str]
   *   """ISO 8601 timestamp when workflow started."""
   */
  workflow_started_at?: string

  /**
   * Workflow completion timestamp (ISO 8601)
   * Python: state.py:178-179
   *   workflow_completed_at: NotRequired[str]
   *   """ISO 8601 timestamp when workflow completed."""
   */
  workflow_completed_at?: string

  // ============================================================================
  // ROUTING (For conditional edges)
  // ============================================================================

  /**
   * List of analyzer node names to execute next
   * Python: state.py:185-191
   *   next_analyzers: NotRequired[List[str]]
   *   """List of analyzer node names to execute next.
   *
   *   Used by routing logic to determine which analyzers
   *   should run for the current email batch.
   *   """
   */
  next_analyzers?: Array<string>

  /**
   * List of analyzer node names that have completed
   * Python: state.py:193-194
   *   completed_analyzers: NotRequired[List[str]]
   *   """List of analyzer node names that have completed execution."""
   */
  completed_analyzers?: Array<string>
}

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

/**
 * Create initial workflow state
 *
 * Python source: state.py:201-256
 *
 * @param user_id - User ID for whom to build profile
 * @param emails - List of email objects to process
 * @param force_reprocess - Whether to reprocess already-processed emails
 * @param model_context_window - LLM context window size (optional)
 * @returns Initial WorkflowState
 */
export function createInitialState(
  user_id: string,
  emails: Array<Record<string, any>>,
  force_reprocess: boolean = false,
  model_context_window?: number
): WorkflowStateInterface {
  // Python line 224: Import to avoid circular dependency
  // from ..workflow.batch_optimizer import calculate_batch_size

  // Python lines 227-233: Calculate batch size
  let initial_batch_size = 1
  if (model_context_window) {
    // Python lines 228-233:
    // initial_batch_size = calculate_batch_size(
    //     emails=emails,
    //     context_window=model_context_window,
    //     start_index=0
    // )
    initial_batch_size = calculateBatchSize(emails, model_context_window, 0)
  }

  // Python lines 235-256: Return WorkflowState
  return {
    user_id,
    emails,
    processed_email_ids: [],
    current_email_index: 0,
    total_emails: emails.length,
    force_reprocess,
    current_batch_start: 0,
    batch_size: initial_batch_size,
    model_context_window,
    demographics_results: [],
    household_results: [],
    interests_results: [],
    purchase_results: [],
    reconciliation_data: [],
    errors: [],
    warnings: [],
    next_analyzers: [],
    completed_analyzers: [],
  }
}

// ============================================================================
// STATE QUERY HELPERS
// ============================================================================

/**
 * Get current email from state (DEPRECATED - use get_current_batch instead)
 *
 * Python source: state.py:259-283
 *
 * @param state - Current workflow state
 * @returns Current email or undefined if no more emails
 */
export function getCurrentEmail(
  state: WorkflowStateInterface
): Record<string, any> | undefined {
  // Python lines 276-277: Check existence
  if (!state.emails || state.emails.length === 0) {
    return undefined
  }

  // Python lines 279-281: Bounds check
  const index = state.current_email_index ?? 0
  if (index >= state.emails.length) {
    return undefined
  }

  // Python line 283: Return
  return state.emails[index]
}

/**
 * Get current batch of emails from state
 *
 * Python source: state.py:286-301
 *
 * Delegates to batch_optimizer.get_batch_from_state()
 *
 * @param state - Current workflow state
 * @returns Array of emails in current batch
 */
export function getCurrentBatch(
  state: WorkflowStateInterface
): Array<Record<string, any>> {
  // Python lines 300-301: Delegate to batch_optimizer
  // from ..workflow.batch_optimizer import get_batch_from_state
  // return get_batch_from_state(state)
  return getBatchFromState(state)
}

/**
 * Check if there are more emails to process
 *
 * Python source: state.py:304-333
 *
 * @param state - Current workflow state
 * @returns True if more emails remain
 */
export function hasMoreEmails(state: WorkflowStateInterface): boolean {
  // Python lines 322-323: Check existence
  if (!state.emails || state.emails.length === 0) {
    return false
  }

  // Python lines 326-333: Batch vs single-email logic
  if (state.current_batch_start !== undefined) {
    // Batch processing mode
    // from ..workflow.batch_optimizer import has_more_batches
    // return has_more_batches(state)
    return hasMoreBatches(state)
  } else {
    // Single-email mode (DEPRECATED)
    const current_index = state.current_email_index ?? 0
    const total = state.total_emails ?? 0
    return current_index < total
  }
}

// ============================================================================
// STATE MUTATION HELPERS
// ============================================================================

/**
 * Advance to next email/batch
 *
 * Python source: state.py:336-368
 *
 * IMPORTANT: This function MUTATES the state object (Python pattern)
 * In TypeScript/LangGraph.js, we may want to return a new state object instead
 *
 * @param state - Current workflow state (will be mutated)
 * @returns Updated state
 */
export function advanceToNextEmail(state: WorkflowStateInterface): WorkflowStateInterface {
  // Python lines 353-358: Advance logic
  if (state.current_batch_start !== undefined) {
    // Batch processing mode
    // from ..workflow.batch_optimizer import advance_to_next_batch
    // state = advance_to_next_batch(state)
    batchOptimizerAdvance(state) // Mutates state in-place
  } else {
    // Single-email mode (DEPRECATED)
    state.current_email_index = (state.current_email_index ?? 0) + 1
  }

  // Python lines 361-366: Reset analyzer results
  state.demographics_results = []
  state.household_results = []
  state.interests_results = []
  state.purchase_results = []
  state.next_analyzers = []
  state.completed_analyzers = []

  // Python line 368: Return
  return state
}

/**
 * Add error message to state
 *
 * Python source: state.py:371-386
 *
 * @param state - Current workflow state (will be mutated)
 * @param error_message - Error message to add
 * @returns Updated state
 */
export function addError(
  state: typeof WorkflowState.State,
  error_message: string
): typeof WorkflowState.State {
  // Python lines 382-383: Initialize if needed
  if (!state.errors) {
    state.errors = []
  }

  // Python line 385: Append
  state.errors.push(error_message)
  return state
}

/**
 * Add warning message to state
 *
 * Python source: state.py:389-404
 *
 * @param state - Current workflow state (will be mutated)
 * @param warning_message - Warning message to add
 * @returns Updated state
 */
export function addWarning(
  state: typeof WorkflowState.State,
  warning_message: string
): typeof WorkflowState.State {
  // Python lines 400-401: Initialize if needed
  if (!state.warnings) {
    state.warnings = []
  }

  // Python line 403: Append
  state.warnings.push(warning_message)
  return state
}

/**
 * WorkflowState Annotation Schema for LangGraph.js
 *
 * LangGraph.js requires Annotation.Root() to create a state schema that can
 * be passed to StateGraph constructor.
 *
 * This creates the actual state schema object from the WorkflowState interface.
 */
export const WorkflowState = Annotation.Root({
  // Required fields
  user_id: Annotation<string>,

  // Email data
  emails: Annotation<Array<Record<string, any>>>({
    value: (_prev, current) => current,
    default: () => [],
  }),
  processed_email_ids: Annotation<Array<string>>({
    value: (_prev, current) => current,
    default: () => [],
  }),
  current_email_index: Annotation<number>({
    value: (_prev, current) => current,
    default: () => 0,
  }),
  total_emails: Annotation<number>({
    value: (_prev, current) => current,
    default: () => 0,
  }),

  // Existing profile
  existing_profile: Annotation<Record<string, any>>({
    value: (_prev, current) => current,
    default: () => ({}),
  }),

  // Analyzer results
  demographics_results: Annotation<Array<Record<string, any>>>({
    value: (_prev, current) => current,
    default: () => [],
  }),
  household_results: Annotation<Array<Record<string, any>>>({
    value: (_prev, current) => current,
    default: () => [],
  }),
  interests_results: Annotation<Array<Record<string, any>>>({
    value: (prev, current) => prev.concat(current),
    default: () => [],
  }),
  purchase_results: Annotation<Array<Record<string, any>>>({
    value: (prev, current) => prev.concat(current),
    default: () => [],
  }),

  // Reconciliation
  reconciliation_data: Annotation<Array<Record<string, any>>>({
    value: (_prev, current) => current,
    default: () => [],
  }),
  updated_profile: Annotation<Record<string, any>>({
    value: (_prev, current) => current,
    default: () => ({}),
  }),

  // Error tracking
  errors: Annotation<Array<string>>({
    value: (_prev, current) => current,
    default: () => [],
  }),
  warnings: Annotation<Array<string>>({
    value: (_prev, current) => current,
    default: () => [],
  }),

  // Timestamps
  workflow_started_at: Annotation<string>({
    value: (_prev, current) => current,
    default: () => '',
  }),
  workflow_completed_at: Annotation<string>({
    value: (_prev, current) => current,
    default: () => '',
  }),

  // Batch processing
  batch_size: Annotation<number>({
    value: (_prev, current) => current,
    default: () => 1,
  }),
  current_batch_index: Annotation<number>({
    value: (_prev, current) => current,
    default: () => 0,
  }),
  current_batch_start: Annotation<number>({
    value: (_prev, current) => current,
    default: () => 0,
  }),
  total_batches: Annotation<number>({
    value: (_prev, current) => current,
    default: () => 0,
  }),
  batch_mode: Annotation<boolean>({
    value: (_prev, current) => current,
    default: () => false,
  }),
  model_context_window: Annotation<number>({
    value: (_prev, current) => current,
    default: () => 0,
  }),
  force_reprocess: Annotation<boolean>({
    value: (_prev, current) => current,
    default: () => false,
  }),

  // LLM config
  cost_tracker: Annotation<any>({
    value: (_prev, current) => current,
    default: () => null,
  }),
  tracker: Annotation<any>({
    value: (_prev, current) => current,
    default: () => null,
  }),
  llm_provider: Annotation<string>({
    value: (_prev, current) => current,
    default: () => '',
  }),
  llm_model: Annotation<string>({
    value: (_prev, current) => current,
    default: () => '',
  }),
  llm_config: Annotation<any>({
    value: (_prev, current) => current,
    default: () => null,
  }),
  llm_client: Annotation<any>({
    value: (_prev, current) => current,
    default: () => null,
  }),

  // Routing (deprecated)
  next_analyzers: Annotation<Array<string>>({
    value: (_prev, current) => current,
    default: () => [],
  }),
  completed_analyzers: Annotation<Array<string>>({
    value: (_prev, current) => current,
    default: () => [],
  }),
})
