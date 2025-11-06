#!/usr/bin/env python3
"""
Retrieve Profile Node

Retrieves existing taxonomy profile from memory and applies
temporal decay to confidence scores.
"""

import logging
from datetime import datetime
from typing import Dict, Any

from ..state import WorkflowState, add_error
from ...memory.manager import MemoryManager
from ...memory.confidence import apply_temporal_decay, calculate_days_since_validation

logger = logging.getLogger(__name__)


def retrieve_existing_profile_node(
    state: WorkflowState,
    memory_manager: MemoryManager
) -> WorkflowState:
    """
    Retrieve existing profile from memory with temporal decay applied.

    Workflow Steps:
    1. Query all semantic memories for user
    2. Group memories by taxonomy section
    3. Apply temporal decay to confidence scores
    4. Structure profile by sections
    5. Update state with existing_profile

    Args:
        state: Current workflow state with user_id
        memory_manager: MemoryManager instance

    Returns:
        Updated state with existing_profile populated

    Example:
        >>> state = retrieve_existing_profile_node(state, memory_manager)
        >>> demographics = state['existing_profile']['demographics']
        >>> for mem in demographics:
        ...     print(f"{mem['value']}: {mem['confidence']:.2f}")
    """
    try:
        logger.info(f"Retrieving existing profile for user: {state['user_id']}")

        # Get all semantic memories
        all_memories = memory_manager.get_all_semantic_memories()
        logger.info(f"Retrieved {len(all_memories)} memories from store")

        # Apply temporal decay to each memory
        decayed_memories = []
        for memory in all_memories:
            # Calculate days since validation
            days_since = calculate_days_since_validation(memory["last_validated"])

            # Apply decay
            original_conf = memory["confidence"]
            decayed_conf = apply_temporal_decay(original_conf, days_since)

            # Update memory with decayed confidence
            memory_with_decay = memory.copy()
            memory_with_decay["confidence"] = decayed_conf
            memory_with_decay["days_since_validation"] = days_since

            if decayed_conf < original_conf:
                logger.debug(
                    f"Applied decay to {memory['memory_id']}: "
                    f"{original_conf:.3f} → {decayed_conf:.3f} "
                    f"({days_since} days)"
                )

            decayed_memories.append(memory_with_decay)

        # Group by section
        profile = {
            "demographics": [],
            "household": [],
            "interests": [],
            "purchase_intent": [],
            "actual_purchases": []
        }

        for memory in decayed_memories:
            section = memory.get("section", "unknown")
            if section in profile:
                profile[section].append(memory)
            else:
                logger.warning(f"Unknown section: {section}")

        # Log profile summary
        logger.info(f"Profile structure:")
        for section, memories in profile.items():
            if memories:
                avg_conf = sum(m["confidence"] for m in memories) / len(memories)
                logger.info(f"  {section}: {len(memories)} memories (avg confidence: {avg_conf:.3f})")

        # Update state
        state["existing_profile"] = profile

        logger.info("Profile retrieval complete")
        return state

    except Exception as e:
        logger.error(f"Error retrieving profile: {e}", exc_info=True)
        state = add_error(state, f"Failed to retrieve profile: {str(e)}")
        # Return empty profile on error
        state["existing_profile"] = {
            "demographics": [],
            "household": [],
            "interests": [],
            "purchase_intent": [],
            "actual_purchases": []
        }
        return state


def get_profile_summary(state: WorkflowState) -> Dict[str, Any]:
    """
    Get summary statistics of existing profile.

    Args:
        state: Workflow state with existing_profile

    Returns:
        Dictionary with profile statistics

    Example:
        >>> summary = get_profile_summary(state)
        >>> print(f"Total classifications: {summary['total_count']}")
        >>> print(f"Average confidence: {summary['average_confidence']:.2f}")
    """
    profile = state.get("existing_profile", {})

    total_count = 0
    total_confidence = 0.0
    high_confidence_count = 0
    stale_count = 0

    for section, memories in profile.items():
        for memory in memories:
            total_count += 1
            conf = memory.get("confidence", 0.0)
            total_confidence += conf

            if conf >= 0.8:
                high_confidence_count += 1

            if memory.get("days_since_validation", 0) >= 30:
                stale_count += 1

    avg_confidence = total_confidence / total_count if total_count > 0 else 0.0

    return {
        "total_count": total_count,
        "average_confidence": avg_confidence,
        "high_confidence_count": high_confidence_count,
        "stale_count": stale_count,
        "sections": {
            section: len(memories)
            for section, memories in profile.items()
            if memories
        }
    }