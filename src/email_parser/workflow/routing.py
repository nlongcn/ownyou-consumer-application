#!/usr/bin/env python3
"""
Routing Logic

Routes emails to all analyzer nodes.
Analyzers use LLM prompts to determine if signals exist for their category.

Previously used regex pattern matching, but this was:
- Brittle (required manual updates like adding "council tax")
- Culturally biased (only UK/US terms)
- Impossible to enumerate globally
- Redundant (analyzers already have sophisticated LLM detection)

Current approach: Route all emails to all analyzers, let LLMs decide.
"""

import logging
from typing import List

from .state import WorkflowState, get_current_email

logger = logging.getLogger(__name__)


def route_email_to_analyzers(state: WorkflowState) -> List[str]:
    """
    Route email to all analyzer nodes.

    DESIGN DECISION (2025-10-07):
    Previous implementation used regex pattern matching to selectively route emails.
    This was fundamentally flawed because:
    1. Cannot enumerate all global variations (UK "council tax" vs US "property tax")
    2. Brittle - required manual pattern updates
    3. Cultural bias - only matched Western/English terms
    4. Redundant - analyzers already use sophisticated LLM prompts to detect signals

    NEW APPROACH:
    - Route ALL emails to ALL 4 analyzers (demographics, household, interests, purchase)
    - Let each analyzer's LLM determine if signals exist
    - Analyzers return empty classifications if no signals found
    - Cost increase: ~33% more LLM calls (acceptable for robustness)
    - Benefit: Never miss data, globally scalable, zero maintenance

    Args:
        state: Current workflow state with email to analyze

    Returns:
        List of all 4 analyzer node names

    Example:
        >>> analyzers = route_email_to_analyzers(state)
        >>> # Always returns: ["demographics", "household", "interests", "purchase"]
    """
    email = get_current_email(state)

    if email is None:
        logger.warning("No email to route")
        return []

    email_id = email.get("id", "unknown")
    email_subject = email.get("subject", "")[:50]

    # Route to all analyzers - let LLMs decide what's relevant
    analyzers = ["demographics", "household", "interests", "purchase"]

    logger.info(f"Email {email_id} ('{email_subject}...') → routing to all analyzers")

    return analyzers


# =============================================================================
# Routing Helper (Workflow Control)
# =============================================================================
# Note: Email classification helpers (_is_purchase_email, etc.) were removed
# in favor of letting LLM analyzers make all classification decisions.
# See route_email_to_analyzers() docstring for rationale.


def should_continue_processing(state: WorkflowState) -> str:
    """
    Determine if workflow should continue processing more emails or end.

    Used as conditional edge after update_memory node.

    NOTE: This function only checks state, it does NOT mutate state.
    State advancement happens in a separate node.

    Args:
        state: Current workflow state

    Returns:
        "continue" if more emails remain, "end" otherwise

    Example:
        >>> # In graph definition:
        >>> workflow.add_conditional_edges(
        ...     "update_memory",
        ...     should_continue_processing,
        ...     {"continue": "advance_email", "end": END}
        ... )
    """
    from .state import has_more_emails

    if has_more_emails(state):
        logger.info(
            f"More emails remain ({state.get('current_email_index') + 1}/{state.get('total_emails')})"
        )
        return "continue"
    else:
        logger.info("All emails processed - workflow complete")
        return "end"