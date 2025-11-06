#!/usr/bin/env python3
"""
Reconciliation Node

Reconciles new evidence from analyzer results with existing memories.
Uses Phase 2 reconciliation logic to update confidence scores.
"""

import logging
from typing import List, Dict, Any

from ..state import WorkflowState, get_current_email, add_error
from ...memory.manager import MemoryManager
from ...memory.reconciliation import reconcile_batch_evidence

logger = logging.getLogger(__name__)


def reconcile_evidence_node(
    state: WorkflowState,
    memory_manager: MemoryManager
) -> WorkflowState:
    """
    Reconcile new evidence with existing memories.

    Workflow Steps:
    1. Collect all analyzer results from state
    2. Get current email ID
    3. Use Phase 2 reconcile_batch_evidence() function
    4. Update state with reconciliation results

    Args:
        state: Current workflow state with analyzer results
        memory_manager: MemoryManager instance

    Returns:
        Updated state with reconciliation_data

    Example:
        >>> # After analyzers run:
        >>> state = reconcile_evidence_node(state, memory_manager)
        >>> # Confidence scores updated in memory
    """
    try:
        email = get_current_email(state)

        if email is None:
            logger.warning("No email for reconciliation")
            return state

        email_id = email.get("id", "unknown")
        logger.info(f"Reconciling evidence for email: {email_id}")

        # Collect all taxonomy selections from analyzers
        all_selections = []

        demographics = state.get("demographics_results", [])
        household = state.get("household_results", [])
        interests = state.get("interests_results", [])
        purchase = state.get("purchase_results", [])

        all_selections.extend(demographics)
        all_selections.extend(household)
        all_selections.extend(interests)
        all_selections.extend(purchase)

        logger.info(f"Reconciling {len(all_selections)} taxonomy selections")

        if not all_selections:
            logger.warning("No taxonomy selections to reconcile")
            state["reconciliation_data"] = []
            return state

        # Use Phase 2 reconciliation logic
        reconciled_memories = reconcile_batch_evidence(
            memory_manager=memory_manager,
            taxonomy_selections=all_selections,
            email_id=email_id
        )

        logger.info(f"Reconciliation complete: {len(reconciled_memories)} memories updated")

        # Log confidence changes
        for memory in reconciled_memories:
            logger.debug(
                f"  {memory.get('value')}: "
                f"confidence={memory.get('confidence', 0):.3f}, "
                f"evidence_count={memory.get('evidence_count', 0)}"
            )

        # Update state
        state["reconciliation_data"] = reconciled_memories

        return state

    except Exception as e:
        logger.error(f"Error reconciling evidence: {e}", exc_info=True)
        state = add_error(state, f"Reconciliation failed: {str(e)}")
        state["reconciliation_data"] = []
        return state


def get_reconciliation_summary(state: WorkflowState) -> Dict[str, Any]:
    """
    Get summary of reconciliation results.

    Args:
        state: Workflow state with reconciliation_data

    Returns:
        Dictionary with reconciliation statistics

    Example:
        >>> summary = get_reconciliation_summary(state)
        >>> print(f"Updated {summary['memories_updated']} memories")
        >>> print(f"Average confidence: {summary['avg_confidence']:.2f}")
    """
    reconciliation_data = state.get("reconciliation_data", [])

    if not reconciliation_data:
        return {
            "memories_updated": 0,
            "avg_confidence": 0.0,
            "high_confidence_count": 0,
            "sections": {}
        }

    total_conf = 0.0
    high_conf_count = 0
    sections = {}

    for memory in reconciliation_data:
        conf = memory.get("confidence", 0.0)
        total_conf += conf

        if conf >= 0.8:
            high_conf_count += 1

        section = memory.get("section", "unknown")
        sections[section] = sections.get(section, 0) + 1

    avg_conf = total_conf / len(reconciliation_data)

    return {
        "memories_updated": len(reconciliation_data),
        "avg_confidence": avg_conf,
        "high_confidence_count": high_conf_count,
        "sections": sections
    }