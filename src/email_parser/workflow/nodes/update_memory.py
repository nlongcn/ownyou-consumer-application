#!/usr/bin/env python3
"""
Update Memory Node

Final node that:
1. Stores episodic memory for current email
2. Marks email as processed
3. Updates final profile in state
4. Tracks classification changes for dashboard
"""

import logging
from datetime import datetime

from ..state import WorkflowState, get_current_email, add_error
from ...memory.manager import MemoryManager
from ...memory.schemas import build_episodic_memory_id
from ..tracking import WorkflowTracker

logger = logging.getLogger(__name__)


def update_memory_node(
    state: WorkflowState,
    memory_manager: MemoryManager
) -> WorkflowState:
    """
    Update memory store with final results.

    Workflow Steps:
    1. Store episodic memory for this email (evidence trail)
    2. Mark email as processed (for incremental runs)
    3. Update state.updated_profile with latest profile

    Args:
        state: Current workflow state with reconciliation_data
        memory_manager: MemoryManager instance

    Returns:
        Updated state with updated_profile and workflow_completed_at

    Example:
        >>> state = update_memory_node(state, memory_manager)
        >>> # Email marked as processed, memories updated
    """
    try:
        email = get_current_email(state)

        if email is None:
            logger.warning("No email to update in memory")
            return state

        email_id = email.get("id", "unknown")
        email_date = email.get("date", "")
        email_subject = email.get("subject", "")

        logger.info(f"Updating memory for email: {email_id}")

        # Build episodic memory (evidence trail)
        episode_id = build_episodic_memory_id(email_id)

        # Collect taxonomy selections from reconciliation
        taxonomy_selections = []
        confidence_contributions = {}

        for memory in state.get("reconciliation_data", []):
            tax_id = memory.get("taxonomy_id")
            conf = memory.get("confidence", 0.0)

            if tax_id:
                taxonomy_selections.append(tax_id)
                confidence_contributions[tax_id] = conf

        # Create reasoning summary
        reasoning_parts = []
        for memory in state.get("reconciliation_data", []):
            if memory.get("reasoning"):
                reasoning_parts.append(
                    f"{memory.get('value')}: {memory.get('reasoning')}"
                )

        reasoning = "\n".join(reasoning_parts) if reasoning_parts else "Evidence reconciled with existing profile"

        # Store episodic memory
        episodic_data = {
            "email_id": email_id,
            "email_date": email_date,
            "email_subject": email_subject[:200],  # Limit length
            "taxonomy_selections": taxonomy_selections,
            "confidence_contributions": confidence_contributions,
            "reasoning": reasoning,
            "processed_at": datetime.utcnow().isoformat() + "Z",
            "llm_model": "placeholder:phase3-stub"  # Phase 4 will use actual model
        }

        memory_manager.store_episodic_memory(episode_id, episodic_data)
        logger.info(f"Stored episodic memory: {episode_id}")

        # Mark email as processed
        memory_manager.mark_email_as_processed(email_id)
        logger.info(f"Marked email as processed: {email_id}")

        # Update state with latest profile (retrieve all memories)
        all_memories = memory_manager.get_all_semantic_memories()

        # Group by section
        updated_profile = {
            "demographics": [],
            "household": [],
            "interests": [],
            "purchase_intent": [],
            "actual_purchases": []
        }

        for memory in all_memories:
            section = memory.get("section", "unknown")
            if section in updated_profile:
                updated_profile[section].append(memory)

        state["updated_profile"] = updated_profile
        state["workflow_completed_at"] = datetime.utcnow().isoformat() + "Z"

        # Track classification snapshots for dashboard
        # Get or create tracker from state
        tracker = state.get("tracker")
        if tracker is None:
            user_id = state.get("user_id", "unknown")
            logger.warning(f"No tracker found in state, creating new one for user {user_id}")
            tracker = WorkflowTracker(user_id)
            state["tracker"] = tracker

        # Record email processed
        tracker.record_email_processed()

        # Record classification snapshots
        reconciliation_data = state.get("reconciliation_data", [])
        for memory in reconciliation_data:
            taxonomy_id = memory.get("taxonomy_id")
            confidence = memory.get("confidence", 0.0)
            evidence_count = memory.get("evidence_count", 0)

            if taxonomy_id:
                # Check if this is a new classification
                is_new = evidence_count == 1
                tracker.record_classification_change(
                    taxonomy_id=taxonomy_id,
                    confidence=confidence,
                    evidence_count=evidence_count,
                    is_new=is_new
                )

        logger.info(f"Memory update complete")

        return state

    except Exception as e:
        logger.error(f"Error updating memory: {e}", exc_info=True)
        state = add_error(state, f"Memory update failed: {str(e)}")
        return state


def generate_profile_report(state: WorkflowState) -> dict:
    """
    Generate final profile report from updated_profile.

    Args:
        state: Workflow state with updated_profile

    Returns:
        Dictionary with formatted profile report

    Example:
        >>> report = generate_profile_report(state)
        >>> print(f"Demographics: {len(report['demographics'])} classifications")
        >>> print(f"Interests: {len(report['interests'])} classifications")
    """
    updated_profile = state.get("updated_profile", {})

    report = {
        "user_id": state.get("user_id"),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "demographics": updated_profile.get("demographics", []),
        "household": updated_profile.get("household", []),
        "interests": updated_profile.get("interests", []),
        "purchase_intent": updated_profile.get("purchase_intent", []),
        "actual_purchases": updated_profile.get("actual_purchases", []),
        "metadata": {
            "total_emails_processed": state.get("current_email_index", 0) + 1,
            "workflow_started_at": state.get("workflow_started_at"),
            "workflow_completed_at": state.get("workflow_completed_at"),
            "errors": state.get("errors", []),
            "warnings": state.get("warnings", [])
        }
    }

    return report