#!/usr/bin/env python3
"""
LangGraph Workflow Graph

Assembles all workflow nodes into a compiled StateGraph for execution.

Graph Structure:
    START
      ↓
    load_emails
      ↓
    retrieve_profile
      ↓
    route_to_analyzers (conditional)
      ↓
    [demographics_analyzer]
    [household_analyzer]
    [interests_analyzer]
    [purchase_analyzer]
      ↓
    reconcile_evidence
      ↓
    update_memory
      ↓
    check_continuation (conditional: continue → route_to_analyzers | end → END)
"""

import logging
from typing import Literal
from functools import partial

from langgraph.graph import StateGraph, END

from .state import WorkflowState
from .routing import route_email_to_analyzers, should_continue_processing
from .nodes import (
    load_new_emails_node,
    retrieve_existing_profile_node,
    analyze_all_node,  # Combined analyzer (calls all 4 internally)
    reconcile_evidence_node,
    update_memory_node,
)
from ..memory.manager import MemoryManager

logger = logging.getLogger(__name__)


def build_workflow_graph(
    memory_manager: MemoryManager,
    checkpointer=None
) -> StateGraph:
    """
    Build compiled StateGraph for IAB Taxonomy Profile workflow.

    Args:
        memory_manager: MemoryManager instance for persistent storage
        checkpointer: Optional checkpointer for workflow state persistence.
                     Default: None (no checkpointing, maximum privacy)

                     Checkpointer Options:
                     - None (default): No state persistence, fastest performance
                     - SqliteSaver: Local SQLite database for resume capability
                     - MemorySaver: In-memory checkpointing (testing/dev)
                     - PostgresSaver: User-provided PostgreSQL (advanced)

                     Self-Sovereign Architecture:
                     The system defaults to no checkpointing for maximum privacy.
                     All checkpointer options are local-first by default.
                     See docs/reference/CHECKPOINTER_OPTIONS.md for deployment patterns.

    Returns:
        Compiled StateGraph ready for execution

    Example:
        >>> # Production (no checkpointing, maximum privacy)
        >>> memory_manager = MemoryManager(store)
        >>> graph = build_workflow_graph(memory_manager)
        >>> result = graph.invoke({"user_id": "user_123", "emails": [...]})

        >>> # Development (local SQLite checkpointing for debugging)
        >>> from langgraph.checkpoint.sqlite import SqliteSaver
        >>> checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
        >>> graph = build_workflow_graph(memory_manager, checkpointer)
        >>> result = graph.invoke({"user_id": "user_123", "emails": [...]})
    """
    # Initialize StateGraph with WorkflowState schema
    workflow = StateGraph(WorkflowState)

    # Bind memory_manager to nodes using partial
    load_emails = partial(load_new_emails_node, memory_manager=memory_manager)
    retrieve_profile = partial(retrieve_existing_profile_node, memory_manager=memory_manager)
    reconcile = partial(reconcile_evidence_node, memory_manager=memory_manager)
    update_memory = partial(update_memory_node, memory_manager=memory_manager)

    # Add nodes to graph
    workflow.add_node("load_emails", load_emails)
    workflow.add_node("retrieve_profile", retrieve_profile)
    workflow.add_node("analyze_all", analyze_all_node)  # Combined analyzer (runs all 4)
    workflow.add_node("reconcile", reconcile)
    workflow.add_node("update_memory", update_memory)
    workflow.add_node("advance_email", _advance_email_node)

    # Define edges
    workflow.set_entry_point("load_emails")

    # After loading, check if we have emails to process
    workflow.add_conditional_edges(
        "load_emails",
        _check_has_emails_conditional,
        {
            "has_emails": "retrieve_profile",
            "no_emails": END
        }
    )

    # After retrieving profile, run all analyzers
    # (analyze_all_node internally calls all 4 analyzer functions)
    workflow.add_edge("retrieve_profile", "analyze_all")

    # Analyzers flow to reconciliation
    workflow.add_edge("analyze_all", "reconcile")

    # Reconciliation flows to memory update
    workflow.add_edge("reconcile", "update_memory")

    # After updating memory, check if we should continue
    workflow.add_conditional_edges(
        "update_memory",
        _check_continuation_conditional,
        {
            "continue": "advance_email",  # Advance to next email
            "end": END
        }
    )

    # After advancing, loop back to retrieve_profile
    workflow.add_edge("advance_email", "retrieve_profile")

    # Compile graph (with optional checkpointer)
    if checkpointer:
        compiled_graph = workflow.compile(checkpointer=checkpointer)
        logger.info("Workflow graph compiled successfully with checkpointing enabled")
    else:
        compiled_graph = workflow.compile()
        logger.info("Workflow graph compiled successfully (no checkpointing)")

    return compiled_graph


def _check_has_emails_conditional(state: WorkflowState) -> Literal["has_emails", "no_emails"]:
    """
    Check if there are emails to process after loading.

    Args:
        state: Current workflow state

    Returns:
        "has_emails" if emails exist, "no_emails" to end workflow
    """
    total_emails = state.get("total_emails", 0)

    if total_emails > 0:
        logger.info(f"Found {total_emails} emails to process")
        return "has_emails"
    else:
        logger.info("No emails to process - ending workflow")
        return "no_emails"


def _route_to_analyzers_conditional(state: WorkflowState) -> Literal["demographics", "household", "interests", "purchase"]:
    """
    Conditional edge function for routing to analyzers.

    LangGraph conditional edges return the next node name based on state.

    Args:
        state: Current workflow state

    Returns:
        Name of next analyzer node to execute

    Note:
        This returns the FIRST analyzer. For multi-analyzer routing,
        we'll need to use LangGraph's multi-path routing in the future.
        For Phase 3, we route to the first detected analyzer.
    """
    analyzers = route_email_to_analyzers(state)

    if not analyzers:
        # Default routing
        logger.warning("No analyzers matched, defaulting to demographics")
        return "demographics"

    # Return first analyzer
    # Phase 4 enhancement: Support parallel analyzer execution
    first_analyzer = analyzers[0]
    logger.debug(f"Routing to analyzer: {first_analyzer}")

    return first_analyzer


def _advance_email_node(state: WorkflowState) -> WorkflowState:
    """
    Node that advances to the next email.

    This is a separate node because conditional edges should not mutate state.

    Args:
        state: Current workflow state

    Returns:
        Updated state with incremented email index
    """
    from .state import advance_to_next_email

    logger.info(f"Advancing from email {state.get('current_email_index')} to next")
    return advance_to_next_email(state)


def _check_continuation_conditional(state: WorkflowState) -> Literal["continue", "end"]:
    """
    Conditional edge function for workflow continuation.

    This only checks if more emails exist - it does NOT advance the index.
    The advance_email node handles incrementing the index.

    Args:
        state: Current workflow state

    Returns:
        "continue" to advance to next email, "end" to finish workflow
    """
    from .state import has_more_emails

    if has_more_emails(state):
        logger.info(f"More emails remain - continuing")
        return "continue"
    else:
        logger.info("All emails processed - workflow complete")
        return "end"


# =============================================================================
# Helper Functions for Graph Inspection
# =============================================================================

def visualize_workflow_graph(compiled_graph: StateGraph) -> str:
    """
    Generate ASCII visualization of workflow graph.

    Args:
        compiled_graph: Compiled StateGraph

    Returns:
        ASCII art representation of graph structure

    Example:
        >>> graph = build_workflow_graph(memory_manager)
        >>> print(visualize_workflow_graph(graph))
    """
    # LangGraph doesn't provide built-in ASCII visualization
    # This is a placeholder for Phase 4 enhancement
    return """
    Workflow Graph Structure:

    START
      ↓
    load_emails (filter new emails)
      ↓
    retrieve_profile (apply temporal decay)
      ↓
    [conditional routing based on email content]
      ↓
    demographics_analyzer | household_analyzer | interests_analyzer | purchase_analyzer
      ↓
    reconcile (update confidence scores)
      ↓
    update_memory (store episodic memory)
      ↓
    [check continuation]
      ↓ continue (loop back to retrieve_profile)
      ↓ end (finish workflow)
    END
    """


def get_graph_node_names(compiled_graph: StateGraph) -> list:
    """
    Get list of all node names in graph.

    Args:
        compiled_graph: Compiled StateGraph

    Returns:
        List of node names

    Example:
        >>> graph = build_workflow_graph(memory_manager)
        >>> nodes = get_graph_node_names(graph)
        >>> print(f"Graph has {len(nodes)} nodes: {nodes}")
    """
    # Access graph.nodes if available
    # This is a placeholder for Phase 4 enhancement
    return [
        "load_emails",
        "retrieve_profile",
        "demographics_analyzer",
        "household_analyzer",
        "interests_analyzer",
        "purchase_analyzer",
        "reconcile",
        "update_memory"
    ]