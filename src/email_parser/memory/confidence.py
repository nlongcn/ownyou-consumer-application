#!/usr/bin/env python3
"""
Confidence Scoring Engine

Implements confidence score evolution based on evidence accumulation,
contradiction, and temporal decay.

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md - Confidence Scoring section

Formulas:
- Confirming Evidence: new_confidence = current + (1 - current) * new_evidence_strength * 0.3
- Contradicting Evidence: new_confidence = current * (1 - contradiction_strength * 0.5)
- Temporal Decay: decay_rate = 0.01 * (days_since_last_validation / 7)
                  new_confidence = current * (1 - decay_rate)
"""

from typing import Literal
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Evidence type definitions
EvidenceType = Literal["confirming", "contradicting", "neutral"]


def update_confidence(
    current_confidence: float,
    new_evidence_strength: float,
    evidence_type: EvidenceType
) -> float:
    """
    Update confidence score based on new evidence.

    Args:
        current_confidence: Current confidence score [0.0, 1.0]
        new_evidence_strength: Strength of new evidence [0.0, 1.0]
        evidence_type: Type of evidence ("confirming", "contradicting", "neutral")

    Returns:
        Updated confidence score [0.0, 1.0]

    Raises:
        ValueError: If confidence or evidence strength out of bounds

    Examples:
        >>> # Confirming evidence increases confidence
        >>> update_confidence(0.75, 0.8, "confirming")
        0.81

        >>> # Contradicting evidence decreases confidence
        >>> update_confidence(0.75, 0.6, "contradicting")
        0.525

        >>> # Neutral evidence has no effect
        >>> update_confidence(0.75, 0.5, "neutral")
        0.75
    """
    # Validate inputs
    if not 0.0 <= current_confidence <= 1.0:
        raise ValueError(
            f"current_confidence must be in [0.0, 1.0], got {current_confidence}"
        )

    if not 0.0 <= new_evidence_strength <= 1.0:
        raise ValueError(
            f"new_evidence_strength must be in [0.0, 1.0], got {new_evidence_strength}"
        )

    if evidence_type == "confirming":
        # Bayesian-style update: increase confidence based on evidence strength
        # Formula: new = current + (1 - current) * strength * 0.3
        # The 0.3 factor prevents overly rapid confidence growth
        new_confidence = current_confidence + (1 - current_confidence) * new_evidence_strength * 0.3

        logger.debug(
            f"Confirming evidence: {current_confidence:.3f} → {new_confidence:.3f} "
            f"(strength={new_evidence_strength:.2f})"
        )

    elif evidence_type == "contradicting":
        # Reduction formula: decrease confidence based on contradiction strength
        # Formula: new = current * (1 - strength * 0.5)
        # The 0.5 factor makes contradictions less impactful than confirmations
        new_confidence = current_confidence * (1 - new_evidence_strength * 0.5)

        logger.debug(
            f"Contradicting evidence: {current_confidence:.3f} → {new_confidence:.3f} "
            f"(strength={new_evidence_strength:.2f})"
        )

    elif evidence_type == "neutral":
        # No change for neutral evidence
        new_confidence = current_confidence

        logger.debug(f"Neutral evidence: confidence unchanged at {current_confidence:.3f}")

    else:
        raise ValueError(f"Invalid evidence_type: {evidence_type}")

    # Ensure bounds [0.0, 1.0]
    new_confidence = max(0.0, min(1.0, new_confidence))

    return new_confidence


def apply_temporal_decay(
    confidence: float,
    days_since_last_validation: int
) -> float:
    """
    Apply temporal decay to confidence score.

    Confidence decays at 1% per week without validation.
    This ensures classifications become less certain over time
    if not reinforced by new evidence.

    Args:
        confidence: Current confidence score [0.0, 1.0]
        days_since_last_validation: Days since last validation

    Returns:
        Confidence after temporal decay [0.0, 1.0]

    Raises:
        ValueError: If confidence out of bounds or days negative

    Examples:
        >>> # No decay for recent validation (same day)
        >>> apply_temporal_decay(0.85, 0)
        0.85

        >>> # 1% decay after 1 week
        >>> apply_temporal_decay(0.85, 7)
        0.8415

        >>> # ~4% decay after 1 month
        >>> apply_temporal_decay(0.85, 30)
        0.814
    """
    # Validate inputs
    if not 0.0 <= confidence <= 1.0:
        raise ValueError(f"confidence must be in [0.0, 1.0], got {confidence}")

    if days_since_last_validation < 0:
        raise ValueError(
            f"days_since_last_validation must be >= 0, got {days_since_last_validation}"
        )

    # Calculate decay rate: 1% per week
    # Formula: decay_rate = 0.01 * (days / 7)
    weeks = days_since_last_validation / 7.0
    decay_rate = 0.01 * weeks

    # Apply decay: new = current * (1 - decay_rate)
    new_confidence = confidence * (1 - decay_rate)

    # Ensure non-negative
    new_confidence = max(0.0, new_confidence)

    logger.debug(
        f"Temporal decay: {confidence:.3f} → {new_confidence:.3f} "
        f"({days_since_last_validation} days, decay_rate={decay_rate:.4f})"
    )

    return new_confidence


def calculate_days_since_validation(last_validated: str) -> int:
    """
    Calculate days since last validation.

    Args:
        last_validated: ISO 8601 timestamp string

    Returns:
        Number of days since validation

    Examples:
        >>> calculate_days_since_validation("2025-09-23T10:00:00Z")
        7  # If today is 2025-09-30
    """
    try:
        last_validated_dt = datetime.fromisoformat(last_validated.replace("Z", "+00:00"))
        now = datetime.now(last_validated_dt.tzinfo)
        delta = now - last_validated_dt
        return max(0, delta.days)

    except Exception as e:
        logger.error(f"Failed to parse last_validated timestamp '{last_validated}': {e}")
        return 0


def should_mark_for_review(confidence: float) -> bool:
    """
    Determine if a classification should be marked for review.

    Classifications with confidence < 0.5 should be reviewed,
    as they indicate high uncertainty.

    Args:
        confidence: Confidence score [0.0, 1.0]

    Returns:
        True if should be marked for review, False otherwise

    Examples:
        >>> should_mark_for_review(0.45)
        True

        >>> should_mark_for_review(0.75)
        False
    """
    return confidence < 0.5


def recalibrate_confidence_with_decay(
    confidence: float,
    last_validated: str,
    threshold_for_review: float = 0.5
) -> tuple[float, bool]:
    """
    Apply temporal decay and determine if review needed.

    Convenience function that combines decay calculation
    and review determination.

    Args:
        confidence: Current confidence score [0.0, 1.0]
        last_validated: ISO 8601 timestamp of last validation
        threshold_for_review: Confidence threshold for review (default: 0.5)

    Returns:
        Tuple of (new_confidence, needs_review)

    Examples:
        >>> recalibrate_confidence_with_decay(0.85, "2025-09-23T10:00:00Z")
        (0.8415, False)  # After 7 days decay

        >>> recalibrate_confidence_with_decay(0.52, "2025-08-01T10:00:00Z")
        (0.47, True)  # After 60 days decay, now needs review
    """
    days_since = calculate_days_since_validation(last_validated)
    new_confidence = apply_temporal_decay(confidence, days_since)
    needs_review = new_confidence < threshold_for_review

    if needs_review:
        logger.info(
            f"Classification marked for review: confidence={new_confidence:.3f} "
            f"(below threshold {threshold_for_review})"
        )

    return new_confidence, needs_review


def combine_evidence_updates(
    current_confidence: float,
    confirming_evidence: list[float],
    contradicting_evidence: list[float]
) -> float:
    """
    Apply multiple evidence updates sequentially.

    Useful when processing batch of new evidence from
    multiple emails at once.

    Args:
        current_confidence: Starting confidence score [0.0, 1.0]
        confirming_evidence: List of confirming evidence strengths [0.0, 1.0]
        contradicting_evidence: List of contradicting evidence strengths [0.0, 1.0]

    Returns:
        Final confidence after all updates [0.0, 1.0]

    Examples:
        >>> combine_evidence_updates(0.75, [0.8, 0.9], [0.3])
        # Applies: confirm(0.8) → confirm(0.9) → contradict(0.3)
    """
    confidence = current_confidence

    # Apply confirming evidence first
    for strength in confirming_evidence:
        confidence = update_confidence(confidence, strength, "confirming")

    # Then apply contradicting evidence
    for strength in contradicting_evidence:
        confidence = update_confidence(confidence, strength, "contradicting")

    logger.debug(
        f"Combined evidence: {current_confidence:.3f} → {confidence:.3f} "
        f"({len(confirming_evidence)} confirming, {len(contradicting_evidence)} contradicting)"
    )

    return confidence


def initialize_confidence(evidence_strength: float) -> float:
    """
    Initialize confidence for first-time classification.

    First classification starts with evidence strength directly,
    no need for Bayesian update formula.

    Args:
        evidence_strength: Initial evidence strength [0.0, 1.0]

    Returns:
        Initial confidence score [0.0, 1.0]

    Examples:
        >>> initialize_confidence(0.75)
        0.75
    """
    if not 0.0 <= evidence_strength <= 1.0:
        raise ValueError(
            f"evidence_strength must be in [0.0, 1.0], got {evidence_strength}"
        )

    logger.debug(f"Initialized confidence: {evidence_strength:.3f}")
    return evidence_strength