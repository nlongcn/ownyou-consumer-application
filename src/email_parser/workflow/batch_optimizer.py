#!/usr/bin/env python3
"""
Batch Optimizer for Email Processing

Dynamically calculates optimal batch sizes based on:
- Model context window (retrieved from LLM vendor API)
- Email token estimation
- Target context utilization (60-80%)
"""

import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def estimate_email_tokens(email: Dict[str, Any]) -> int:
    """
    Estimate token count for a single email.

    Uses rough heuristic: 1 token ≈ 4 characters for English text.

    Args:
        email: Email dict with subject, sender, body

    Returns:
        Estimated token count

    Example:
        >>> email = {"subject": "Test", "body": "..." * 500}
        >>> estimate_email_tokens(email)
        ~500
    """
    subject = email.get("subject", "")
    sender = email.get("sender", "")
    body = email.get("body", "")

    # Count total characters
    total_chars = len(subject) + len(sender) + len(body)

    # Add overhead for formatting (Email N:\nSubject:...\nFrom:...\nBody:...)
    format_overhead = 100

    # Rough conversion: 4 chars per token
    estimated_tokens = (total_chars + format_overhead) // 4

    return estimated_tokens


def calculate_batch_size(
    emails: List[Dict[str, Any]],
    context_window: int,
    start_index: int = 0,
    target_utilization: float = 0.70,
    min_batch_size: int = 5,
    max_batch_size: int = 50
) -> int:
    """
    Calculate optimal batch size to fit in context window.

    Strategy:
    - Reserve 30% for system prompt, taxonomy context, response
    - Fill remaining 70% with emails
    - Stop when adding next email would exceed limit

    Args:
        emails: Full list of emails
        context_window: Model's context window size (tokens)
        start_index: Starting position in emails list
        target_utilization: Target % of context to use for emails (default: 0.70)
        min_batch_size: Minimum emails per batch (default: 5)
        max_batch_size: Maximum emails per batch (default: 50)

    Returns:
        Number of emails to include in batch

    Example:
        >>> emails = [{"body": "..." * 1000}] * 100
        >>> calculate_batch_size(emails, context_window=128000)
        15  # Approximately 15 emails fit in 128K context
    """
    if start_index >= len(emails):
        return 0

    # Handle None context_window (fallback to conservative batch size)
    if context_window is None:
        logger.warning("context_window is None, using fallback batch size")
        return min(max_batch_size, len(emails) - start_index)

    # Calculate available tokens for emails
    # Reserve space for: system prompt (~2K), taxonomy context (~3K), response (~2K)
    reserved_tokens = int(context_window * (1 - target_utilization))
    available_tokens = context_window - reserved_tokens

    logger.debug(
        f"Batch calculation: context_window={context_window}, "
        f"reserved={reserved_tokens}, available={available_tokens}"
    )

    # Accumulate emails until we exceed available tokens
    cumulative_tokens = 0
    batch_size = 0

    for i in range(start_index, min(start_index + max_batch_size, len(emails))):
        email_tokens = estimate_email_tokens(emails[i])

        if cumulative_tokens + email_tokens > available_tokens:
            # Adding this email would exceed limit
            break

        cumulative_tokens += email_tokens
        batch_size += 1

    # Ensure minimum batch size (unless we're at the end)
    remaining_emails = len(emails) - start_index
    if batch_size < min_batch_size and remaining_emails >= min_batch_size:
        logger.warning(
            f"Calculated batch_size={batch_size} is below minimum={min_batch_size}. "
            f"Using minimum (may exceed context window slightly)."
        )
        batch_size = min(min_batch_size, remaining_emails)

    # Handle edge case: no emails fit (single email too large)
    if batch_size == 0 and remaining_emails > 0:
        logger.warning(
            f"Single email at index {start_index} estimated at {estimate_email_tokens(emails[start_index])} tokens "
            f"exceeds available space of {available_tokens} tokens. Processing anyway (may truncate)."
        )
        batch_size = 1

    logger.info(
        f"Batch size: {batch_size} emails ({cumulative_tokens:,} tokens / {available_tokens:,} available, "
        f"{cumulative_tokens/available_tokens*100:.1f}% utilization)"
    )

    return batch_size


def get_batch_from_state(state: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract current batch of emails from workflow state.

    Args:
        state: Workflow state with emails, current_batch_start, batch_size

    Returns:
        List of emails in current batch

    Example:
        >>> state = {
        ...     "emails": [...100 emails...],
        ...     "current_batch_start": 0,
        ...     "batch_size": 15
        ... }
        >>> batch = get_batch_from_state(state)
        >>> len(batch)
        15
    """
    emails = state.get("emails", [])
    start = state.get("current_batch_start", 0)
    size = state.get("batch_size", 1)

    return emails[start:start + size]


def has_more_batches(state: Dict[str, Any]) -> bool:
    """
    Check if there are more batches to process.

    Args:
        state: Workflow state

    Returns:
        True if more batches remain, False if done
    """
    emails = state.get("emails", [])
    start = state.get("current_batch_start", 0)

    return start < len(emails)


def advance_to_next_batch(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Advance workflow state to next batch.

    Updates current_batch_start and recalculates batch_size for next batch.

    Args:
        state: Current workflow state

    Returns:
        Updated state with next batch configured
    """
    current_start = state.get("current_batch_start", 0)
    current_size = state.get("batch_size", 1)

    # Move to next batch
    next_start = current_start + current_size
    state["current_batch_start"] = next_start

    # Recalculate batch size for next batch (may be smaller for final batch)
    emails = state.get("emails", [])
    context_window = state.get("model_context_window", 128000)

    next_batch_size = calculate_batch_size(
        emails=emails,
        context_window=context_window,
        start_index=next_start
    )
    state["batch_size"] = next_batch_size

    logger.info(
        f"Advanced to batch starting at email {next_start} "
        f"(batch_size={next_batch_size}, {len(emails) - next_start} emails remaining)"
    )

    return state


__all__ = [
    'estimate_email_tokens',
    'calculate_batch_size',
    'get_batch_from_state',
    'has_more_batches',
    'advance_to_next_batch',
]
