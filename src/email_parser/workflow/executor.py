#!/usr/bin/env python3
"""
Workflow Executor

Main entry point for running the IAB Taxonomy Profile workflow.

Usage:
    from src.email_parser.workflow import run_workflow
    from src.email_parser.memory.manager import MemoryManager

    memory_manager = MemoryManager(user_id="user_123", store=store)
    result = run_workflow(
        user_id="user_123",
        emails=emails,
        memory_manager=memory_manager
    )
"""

import logging
from typing import Dict, Any, List, Optional

from .graph import build_workflow_graph
from .state import create_initial_state, WorkflowState
from ..memory.manager import MemoryManager
from .cost_tracker import CostTracker
from .tracking import WorkflowTracker

logger = logging.getLogger(__name__)


def run_workflow(
    user_id: str,
    emails: List[Dict[str, Any]],
    memory_manager: MemoryManager,
    config: Optional[Dict[str, Any]] = None,
    force_reprocess: bool = False,
    taxonomy_model: Optional[str] = None
) -> WorkflowState:
    """
    Execute the IAB Taxonomy Profile workflow for a user.

    This is the main entry point for workflow execution.
    Builds the graph, creates initial state, and runs the workflow.

    Args:
        user_id: Unique identifier for the user
        emails: List of email dictionaries with keys: id, subject, body, date
        memory_manager: MemoryManager instance for persistent storage
        config: Optional configuration for LangGraph (recursion_limit, etc.)
        force_reprocess: If True, ignore processed email tracking and reprocess all

    Returns:
        Final WorkflowState after processing all emails

    Raises:
        Exception: If workflow execution fails

    Example:
        >>> from langgraph.store.memory import InMemoryStore
        >>> from src.email_parser.memory.manager import MemoryManager
        >>>
        >>> store = InMemoryStore()
        >>> memory_manager = MemoryManager(user_id="user_123", store=store)
        >>>
        >>> emails = [
        ...     {
        ...         "id": "email_1",
        ...         "subject": "Newsletter",
        ...         "body": "Crypto news...",
        ...         "date": "2025-01-15"
        ...     }
        ... ]
        >>>
        >>> result = run_workflow(
        ...     user_id="user_123",
        ...     emails=emails,
        ...     memory_manager=memory_manager
        ... )
        >>>
        >>> print(f"Processed {result['total_emails']} emails")
        >>> print(f"Profile updated: {len(result['updated_profile']['interests'])} interests")
    """
    try:
        logger.info(f"Starting workflow for user: {user_id}")
        logger.info(f"Input: {len(emails)} emails")

        # Check if Studio debugging is enabled
        import os
        enable_studio = os.getenv("LANGGRAPH_STUDIO_DEBUG", "").lower() in ("1", "true", "yes")

        checkpointer = None
        thread_id = None

        if enable_studio:
            # Enable Studio visualization for this run
            from langgraph.checkpoint.sqlite import SqliteSaver
            import uuid

            checkpointer = SqliteSaver.from_conn_string("data/studio_checkpoints.db")
            thread_id = f"{user_id}_{uuid.uuid4().hex[:8]}"
            logger.info(f"🎨 Studio debug mode enabled - Thread ID: {thread_id}")
            logger.info("   View at: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024")

        # Build compiled graph (with optional checkpointer for Studio)
        graph = build_workflow_graph(memory_manager, checkpointer)
        logger.debug("Workflow graph compiled")

        # Create cost tracker
        cost_tracker = CostTracker()

        # Create workflow tracker for dashboard integration
        workflow_tracker = WorkflowTracker(user_id)
        workflow_tracker.start_run()

        # Determine which model to use (for context window calculation)
        model_to_use = taxonomy_model
        if not model_to_use:
            import os
            model_to_use = os.getenv("TAXONOMY_MODEL")

        # Get model context window for batch optimization (Phase 1.5 fix)
        model_context_window = None
        if model_to_use:
            try:
                from ..llm_clients.model_registry import get_model_context_window
                from ..utils.config import ConfigManager

                # Parse model spec (format: "provider:model")
                config_manager = ConfigManager()
                provider, model_name = config_manager.parse_model_config(model_to_use)

                # Get context window from model registry
                model_context_window = get_model_context_window(provider, model_name)
                logger.info(f"Model {model_to_use} context window: {model_context_window:,} tokens")
            except Exception as e:
                logger.warning(f"Could not get model context window: {e}. Defaulting to batch_size=1")

        # Create initial state with model context window for optimal batch sizing
        initial_state = create_initial_state(
            user_id,
            emails,
            force_reprocess,
            model_context_window=model_context_window  # Phase 1.5: Pass context window
        )
        initial_state["cost_tracker"] = cost_tracker  # Add cost tracker to state
        initial_state["tracker"] = workflow_tracker  # Add workflow tracker to state

        # Add taxonomy model to state
        if model_to_use:
            initial_state["llm_model"] = model_to_use
            logger.info(f"Using taxonomy model: {model_to_use}")

        logger.debug(f"Initial state created: {len(emails)} total emails")
        if force_reprocess:
            logger.info("Force reprocess enabled - will bypass processed email tracking")

        # Prepare config
        if config is None:
            config = {}

        # Set default recursion limit if not provided
        if "recursion_limit" not in config:
            # Each email goes through ~6 nodes, so for N emails we need ~6N iterations
            # Add buffer for safety
            estimated_iterations = len(emails) * 10 + 100
            config["recursion_limit"] = estimated_iterations  # No cap for large datasets
            logger.debug(f"Set recursion_limit: {config['recursion_limit']}")

        # Add thread_id for Studio tracking if debug mode enabled
        if enable_studio and thread_id:
            config["configurable"] = {"thread_id": thread_id}
            logger.debug(f"Studio thread_id: {thread_id}")

        # Execute workflow
        logger.info("Executing workflow...")
        final_state = graph.invoke(initial_state, config=config)

        # Finalize workflow tracking
        status = "failed" if final_state.get("errors") else "completed"
        workflow_tracker.end_run(status=status)

        # Log results
        logger.info("Workflow execution complete")
        logger.info(f"Emails processed: {final_state.get('current_email_index', 0)}")
        logger.info(f"Errors: {len(final_state.get('errors', []))}")
        logger.info(f"Warnings: {len(final_state.get('warnings', []))}")

        # Log cost summary
        if len(cost_tracker.calls) > 0:
            emails_count = final_state.get('current_email_index', 0)
            cost_summary = cost_tracker.get_summary(emails_processed=emails_count)
            logger.info("LLM Cost Summary:")
            for line in cost_summary.split('\n'):
                logger.info(f"  {line}")

        if final_state.get("errors"):
            for error in final_state["errors"]:
                logger.error(f"  Workflow error: {error}")

        if final_state.get("warnings"):
            for warning in final_state["warnings"]:
                logger.warning(f"  Workflow warning: {warning}")

        return final_state

    except Exception as e:
        logger.error(f"Workflow execution failed: {e}", exc_info=True)
        raise


def run_workflow_from_csv(
    user_id: str,
    csv_path: str,
    memory_manager: MemoryManager,
    config: Optional[Dict[str, Any]] = None
) -> WorkflowState:
    """
    Execute workflow using emails from CSV file.

    Convenience function that loads emails from CSV and runs workflow.

    Args:
        user_id: Unique identifier for the user
        csv_path: Path to CSV file with email data
        memory_manager: MemoryManager instance
        config: Optional configuration for LangGraph

    Returns:
        Final WorkflowState after processing

    Example:
        >>> result = run_workflow_from_csv(
        ...     user_id="user_123",
        ...     csv_path="emails.csv",
        ...     memory_manager=memory_manager
        ... )
    """
    from .nodes.load_emails import load_emails_from_csv

    logger.info(f"Loading emails from CSV: {csv_path}")
    emails = load_emails_from_csv(csv_path)
    logger.info(f"Loaded {len(emails)} emails from CSV")

    return run_workflow(
        user_id=user_id,
        emails=emails,
        memory_manager=memory_manager,
        config=config
    )


def get_workflow_summary(state: WorkflowState) -> Dict[str, Any]:
    """
    Generate summary statistics from workflow state.

    Args:
        state: Final workflow state

    Returns:
        Dictionary with summary statistics

    Example:
        >>> result = run_workflow(...)
        >>> summary = get_workflow_summary(result)
        >>> print(f"Processed: {summary['emails_processed']}")
        >>> print(f"Profile sections: {summary['profile_sections']}")
    """
    profile = state.get("updated_profile", {})

    summary = {
        "user_id": state.get("user_id"),
        "emails_processed": state.get("current_email_index", 0),
        "total_emails": state.get("total_emails", 0),
        "errors_count": len(state.get("errors", [])),
        "warnings_count": len(state.get("warnings", [])),
        "workflow_started_at": state.get("workflow_started_at"),
        "workflow_completed_at": state.get("workflow_completed_at"),
        "profile_sections": {
            "demographics": len(profile.get("demographics", [])),
            "household": len(profile.get("household", [])),
            "interests": len(profile.get("interests", [])),
            "purchase_intent": len(profile.get("purchase_intent", [])),
            "actual_purchases": len(profile.get("actual_purchases", []))
        }
    }

    return summary


def print_workflow_summary(state: WorkflowState) -> None:
    """
    Print formatted workflow summary to console.

    Args:
        state: Final workflow state

    Example:
        >>> result = run_workflow(...)
        >>> print_workflow_summary(result)

        Workflow Summary
        ================
        User: user_123
        Emails Processed: 10/10
        ...
    """
    summary = get_workflow_summary(state)

    print("\nWorkflow Summary")
    print("=" * 50)
    print(f"User: {summary['user_id']}")
    print(f"Emails Processed: {summary['emails_processed']}/{summary['total_emails']}")
    print(f"Errors: {summary['errors_count']}")
    print(f"Warnings: {summary['warnings_count']}")
    print(f"\nProfile Sections:")
    for section, count in summary["profile_sections"].items():
        print(f"  {section}: {count} classifications")
    print(f"\nWorkflow Duration:")
    print(f"  Started: {summary['workflow_started_at']}")
    print(f"  Completed: {summary['workflow_completed_at']}")
    print("=" * 50)