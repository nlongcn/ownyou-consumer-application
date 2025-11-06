#!/usr/bin/env python3
"""
Workflow State Schema

Defines the state structure for LangGraph workflow execution.
The state evolves as it flows through workflow nodes.

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md - LangGraph Workflow section
"""

from typing import TypedDict, List, Dict, Any, Optional
from typing_extensions import NotRequired


class WorkflowState(TypedDict):
    """
    State schema for IAB Taxonomy Profile workflow.

    This state is passed between workflow nodes and evolves as the
    workflow progresses through different stages.

    State Flow:
    1. load_emails → adds emails, processed_email_ids
    2. retrieve_profile → adds existing_profile
    3. analyzers → add analysis results
    4. reconcile → adds reconciliation_data
    5. update_memory → adds updated_profile

    Fields are marked as Required or NotRequired based on when they
    become available in the workflow.
    """

    # =============================================================================
    # User Context (Required from start)
    # =============================================================================

    user_id: str
    """Unique user identifier for memory isolation."""

    # =============================================================================
    # Email Data (Added by load_emails node)
    # =============================================================================

    emails: NotRequired[List[Dict[str, Any]]]
    """
    List of new emails to process.

    Each email dict contains:
    - id: str (email identifier)
    - subject: str
    - body: str
    - from_addr: str
    - to_addr: str
    - date: str (ISO 8601)
    - ... other email fields
    """

    processed_email_ids: NotRequired[List[str]]
    """Email IDs that have already been processed (from memory)."""

    current_email_index: NotRequired[int]
    """Index of current email being processed (for iteration - DEPRECATED, use batch fields)."""

    total_emails: NotRequired[int]
    """Total number of emails to process."""

    # =============================================================================
    # Batch Processing Fields (Added for performance optimization)
    # =============================================================================

    current_batch_start: NotRequired[int]
    """Starting index of current batch in emails list."""

    batch_size: NotRequired[int]
    """Number of emails in current batch."""

    model_context_window: NotRequired[int]
    """Context window size (tokens) of the LLM model being used."""

    force_reprocess: NotRequired[bool]
    """If True, ignore processed email tracking and reprocess all emails."""

    cost_tracker: NotRequired[Any]
    """CostTracker instance for tracking LLM API costs (optional)."""

    tracker: NotRequired[Any]
    """WorkflowTracker instance for dashboard analytics tracking (optional)."""

    llm_model: NotRequired[str]
    """LLM model to use for IAB taxonomy classification (optional)."""

    # =============================================================================
    # Profile Data (Added by retrieve_profile node)
    # =============================================================================

    existing_profile: NotRequired[Dict[str, Any]]
    """
    Current taxonomy profile from memory (before updates).

    Structure:
    {
        "demographics": [SemanticMemory, ...],
        "household": [SemanticMemory, ...],
        "interests": [SemanticMemory, ...],
        "purchase_intent": [SemanticMemory, ...],
        "actual_purchases": [SemanticMemory, ...]
    }
    """

    # =============================================================================
    # Analysis Results (Added by analyzer nodes)
    # =============================================================================

    demographics_results: NotRequired[List[Dict[str, Any]]]
    """
    Taxonomy selections from demographics analyzer.

    Each selection:
    {
        "taxonomy_id": int,
        "section": "demographics",
        "value": str,
        "confidence": float,
        "category_path": str,
        "tier_1": str,
        "tier_2": str,
        "tier_3": str,
        "tier_4": str,
        "tier_5": str,
        "reasoning": str
    }
    """

    household_results: NotRequired[List[Dict[str, Any]]]
    """Taxonomy selections from household analyzer."""

    interests_results: NotRequired[List[Dict[str, Any]]]
    """Taxonomy selections from interests analyzer."""

    purchase_results: NotRequired[List[Dict[str, Any]]]
    """Taxonomy selections from purchase analyzer."""

    # =============================================================================
    # Reconciliation Data (Added by reconcile node)
    # =============================================================================

    reconciliation_data: NotRequired[List[Dict[str, Any]]]
    """
    Results of evidence reconciliation.

    List of updated semantic memories after reconciliation.
    """

    # =============================================================================
    # Output (Added by update_memory node)
    # =============================================================================

    updated_profile: NotRequired[Dict[str, Any]]
    """
    Final updated profile after memory consolidation.

    Structure matches existing_profile but with updated values.
    """

    # =============================================================================
    # Metadata & Error Tracking
    # =============================================================================

    errors: NotRequired[List[str]]
    """List of error messages encountered during workflow execution."""

    warnings: NotRequired[List[str]]
    """List of warning messages (non-fatal issues)."""

    workflow_started_at: NotRequired[str]
    """ISO 8601 timestamp when workflow started."""

    workflow_completed_at: NotRequired[str]
    """ISO 8601 timestamp when workflow completed."""

    # =============================================================================
    # Routing Metadata (Used for conditional edges)
    # =============================================================================

    next_analyzers: NotRequired[List[str]]
    """
    List of analyzer node names to execute for current email.

    Set by routing logic based on email content.
    Examples: ["demographics", "interests"], ["purchase"]
    """

    completed_analyzers: NotRequired[List[str]]
    """Analyzer nodes that have completed for current email."""


# =============================================================================
# Helper Functions for State Initialization
# =============================================================================

def create_initial_state(
    user_id: str,
    emails: List[Dict[str, Any]],
    force_reprocess: bool = False,
    model_context_window: Optional[int] = None
) -> WorkflowState:
    """
    Create initial workflow state.

    Args:
        user_id: User identifier
        emails: List of email dictionaries to process
        force_reprocess: If True, ignore processed email tracking
        model_context_window: Context window size of LLM model (for batch sizing)

    Returns:
        Initial WorkflowState with required fields populated

    Example:
        >>> state = create_initial_state("user_123", emails, model_context_window=128000)
        >>> workflow.invoke(state)
    """
    # Import batch_optimizer here to avoid circular dependency
    from ..workflow.batch_optimizer import calculate_batch_size

    # Calculate initial batch size if context window provided
    initial_batch_size = 1  # Default to single-email processing
    if model_context_window:
        initial_batch_size = calculate_batch_size(
            emails=emails,
            context_window=model_context_window,
            start_index=0
        )

    return WorkflowState(
        user_id=user_id,
        emails=emails,
        processed_email_ids=[],
        current_email_index=0,  # Deprecated, use batch fields
        total_emails=len(emails),
        force_reprocess=force_reprocess,
        # Batch processing fields
        current_batch_start=0,
        batch_size=initial_batch_size,
        model_context_window=model_context_window,
        # Results
        demographics_results=[],
        household_results=[],
        interests_results=[],
        purchase_results=[],
        reconciliation_data=[],
        errors=[],
        warnings=[],
        next_analyzers=[],
        completed_analyzers=[],
    )


def get_current_email(state: WorkflowState) -> Optional[Dict[str, Any]]:
    """
    Get the current email being processed.

    DEPRECATED: Use get_current_batch() for batch processing.

    Args:
        state: Current workflow state

    Returns:
        Current email dictionary or None if no emails

    Example:
        >>> email = get_current_email(state)
        >>> if email:
        ...     print(email['subject'])
    """
    if "emails" not in state or not state["emails"]:
        return None

    index = state.get("current_email_index", 0)
    if index >= len(state["emails"]):
        return None

    return state["emails"][index]


def get_current_batch(state: WorkflowState) -> List[Dict[str, Any]]:
    """
    Get the current batch of emails being processed.

    Args:
        state: Current workflow state

    Returns:
        List of emails in current batch (empty list if no emails)

    Example:
        >>> batch = get_current_batch(state)
        >>> print(f"Processing {len(batch)} emails")
    """
    from ..workflow.batch_optimizer import get_batch_from_state
    return get_batch_from_state(state)


def has_more_emails(state: WorkflowState) -> bool:
    """
    Check if there are more emails to process.

    Supports both single-email (deprecated) and batch processing.

    Args:
        state: Current workflow state

    Returns:
        True if more emails remain, False otherwise

    Example:
        >>> if has_more_emails(state):
        ...     # Continue processing
        ... else:
        ...     # Workflow complete
    """
    if "emails" not in state or not state["emails"]:
        return False

    # Use batch fields if available, fall back to single-email index
    if "current_batch_start" in state:
        from ..workflow.batch_optimizer import has_more_batches
        return has_more_batches(state)
    else:
        # Legacy single-email processing
        current_index = state.get("current_email_index", 0)
        total = state.get("total_emails", 0)
        return current_index < total


def advance_to_next_email(state: WorkflowState) -> WorkflowState:
    """
    Advance state to next email or batch.

    Supports both single-email (deprecated) and batch processing.

    Args:
        state: Current workflow state

    Returns:
        Updated state with incremented index/batch and reset analyzer results

    Example:
        >>> state = advance_to_next_email(state)
        >>> # Now processing next email/batch
    """
    # Use batch advancement if batch fields present
    if "current_batch_start" in state:
        from ..workflow.batch_optimizer import advance_to_next_batch
        state = advance_to_next_batch(state)
    else:
        # Legacy single-email processing
        state["current_email_index"] = state.get("current_email_index", 0) + 1

    # Reset analyzer results for next email/batch
    state["demographics_results"] = []
    state["household_results"] = []
    state["interests_results"] = []
    state["purchase_results"] = []
    state["next_analyzers"] = []
    state["completed_analyzers"] = []

    return state


def add_error(state: WorkflowState, error_message: str) -> WorkflowState:
    """
    Add an error message to state.

    Args:
        state: Current workflow state
        error_message: Error description

    Returns:
        Updated state with error added
    """
    if "errors" not in state:
        state["errors"] = []

    state["errors"].append(error_message)
    return state


def add_warning(state: WorkflowState, warning_message: str) -> WorkflowState:
    """
    Add a warning message to state.

    Args:
        state: Current workflow state
        warning_message: Warning description

    Returns:
        Updated state with warning added
    """
    if "warnings" not in state:
        state["warnings"] = []

    state["warnings"].append(warning_message)
    return state