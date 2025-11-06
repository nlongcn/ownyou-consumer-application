#!/usr/bin/env python3
"""
Evidence Reconciliation Logic

Handles the reconciliation of new evidence with existing semantic memories.
Determines evidence type (confirming/contradicting/neutral) and updates
confidence scores accordingly.

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md - Evidence Reconciliation section

Reconciliation Workflow:
1. Load existing semantic memory for taxonomy_id
2. Compare new evidence value with existing value
3. Classify evidence type: confirming / contradicting / neutral
4. Update confidence score using appropriate formula
5. Update evidence lists (supporting/contradicting)
6. Update timestamps and evidence_count
7. Store updated semantic memory
"""

from typing import Optional, Dict, Any, List, Literal
from datetime import datetime
import logging

from .confidence import (
    update_confidence,
    initialize_confidence,
    EvidenceType,
)
from .manager import MemoryManager
from .schemas import build_semantic_memory_id

logger = logging.getLogger(__name__)


def classify_evidence_type(
    existing_value: str,
    new_value: str,
    taxonomy_id: int
) -> EvidenceType:
    """
    Classify whether new evidence confirms, contradicts, or is neutral.

    Args:
        existing_value: Current classification value
        new_value: New evidence value
        taxonomy_id: IAB Taxonomy ID

    Returns:
        Evidence type: "confirming", "contradicting", or "neutral"

    Examples:
        >>> classify_evidence_type("25-29", "25-29", 5)
        "confirming"

        >>> classify_evidence_type("25-29", "30-34", 5)
        "contradicting"

        >>> # For multi-value fields (interests), same value = confirming
        >>> classify_evidence_type("Cryptocurrency", "Cryptocurrency", 342)
        "confirming"
    """
    # Normalize values for comparison (case-insensitive, strip whitespace)
    existing_normalized = existing_value.strip().lower()
    new_normalized = new_value.strip().lower()

    if existing_normalized == new_normalized:
        logger.debug(
            f"Evidence CONFIRMING: taxonomy_id={taxonomy_id}, "
            f"value='{new_value}' matches existing"
        )
        return "confirming"
    else:
        logger.debug(
            f"Evidence CONTRADICTING: taxonomy_id={taxonomy_id}, "
            f"new='{new_value}' ≠ existing='{existing_value}'"
        )
        return "contradicting"


def reconcile_evidence(
    memory_manager: MemoryManager,
    taxonomy_id: int,
    section: str,
    new_value: str,
    new_evidence_strength: float,
    email_id: str,
    category_path: str,
    tier_1: str,
    tier_2: str = "",
    tier_3: str = "",
    tier_4: str = "",
    tier_5: str = "",
    grouping_tier_key: str = "",
    grouping_value: str = "",
    reasoning: str = "",
    purchase_intent_flag: str = None
) -> Dict[str, Any]:
    """
    Reconcile new evidence with existing semantic memory.

    This is the main reconciliation function that:
    1. Loads existing memory (if exists)
    2. Classifies evidence type
    3. Updates confidence score
    4. Updates evidence lists
    5. Stores updated memory

    Args:
        memory_manager: MemoryManager instance for this user
        taxonomy_id: IAB Taxonomy ID
        section: Taxonomy section (demographics, interests, etc.)
        new_value: New classification value from LLM
        new_evidence_strength: Confidence from LLM [0.0, 1.0]
        email_id: Source email ID
        category_path: Full taxonomy path
        tier_1: Tier 1 category
        tier_2: Tier 2 subcategory
        tier_3: Tier 3 value
        tier_4: Tier 4 (optional)
        tier_5: Tier 5 (optional)
        reasoning: LLM reasoning for this classification

    Returns:
        Updated semantic memory dictionary

    Examples:
        >>> # First evidence for this taxonomy
        >>> reconcile_evidence(
        ...     manager, 5, "demographics", "25-29", 0.75,
        ...     "email_123", "Demographic | Age Range | 25-29",
        ...     "Demographic", "Age Range", "25-29"
        ... )
        # Creates new memory with confidence=0.75

        >>> # Confirming evidence
        >>> reconcile_evidence(
        ...     manager, 5, "demographics", "25-29", 0.85,
        ...     "email_456", ...
        ... )
        # Updates existing memory, increases confidence

        >>> # Contradicting evidence
        >>> reconcile_evidence(
        ...     manager, 5, "demographics", "30-34", 0.70,
        ...     "email_789", ...
        ... )
        # Updates existing memory, decreases confidence
    """
    memory_id = build_semantic_memory_id(section, taxonomy_id, new_value)
    now = datetime.utcnow().isoformat() + "Z"

    # Load existing memory (if any)
    existing_memory = memory_manager.get_semantic_memory(memory_id)

    if existing_memory is None:
        # First evidence for this taxonomy classification
        logger.info(
            f"Creating NEW semantic memory: taxonomy_id={taxonomy_id}, "
            f"value='{new_value}', confidence={new_evidence_strength:.3f}"
        )

        new_memory = {
            "taxonomy_id": taxonomy_id,
            "category_path": category_path,
            "tier_1": tier_1,
            "tier_2": tier_2,
            "tier_3": tier_3,
            "tier_4": tier_4,
            "tier_5": tier_5,
            "grouping_tier_key": grouping_tier_key,
            "grouping_value": grouping_value,
            "value": new_value,
            "confidence": initialize_confidence(new_evidence_strength),
            "evidence_count": 1,
            "supporting_evidence": [str(email_id)],  # Convert to string for schema compliance
            "contradicting_evidence": [],
            "first_observed": now,
            "last_validated": now,
            "last_updated": now,
            "days_since_validation": 0,
            "data_source": "email",
            "source_ids": [str(email_id)],  # Convert to string for schema compliance
            "section": section,
            "reasoning": reasoning,
        }

        # Preserve additional fields (e.g., purchase_intent_flag)
        if purchase_intent_flag is not None:
            new_memory["purchase_intent_flag"] = purchase_intent_flag

        memory_manager.store_semantic_memory(memory_id, new_memory)
        return new_memory

    else:
        # Existing memory found - reconcile with new evidence
        existing_value = existing_memory["value"]
        current_confidence = existing_memory["confidence"]

        # Classify evidence type
        evidence_type = classify_evidence_type(existing_value, new_value, taxonomy_id)

        # Update confidence based on evidence type
        if evidence_type == "confirming":
            new_confidence = update_confidence(
                current_confidence,
                new_evidence_strength,
                "confirming"
            )

            # Add to supporting evidence
            supporting = existing_memory["supporting_evidence"]
            if email_id not in supporting:
                supporting.append(email_id)

        elif evidence_type == "contradicting":
            new_confidence = update_confidence(
                current_confidence,
                new_evidence_strength,
                "contradicting"
            )

            # Add to contradicting evidence
            contradicting = existing_memory["contradicting_evidence"]
            if email_id not in contradicting:
                contradicting.append(email_id)

        else:  # neutral
            new_confidence = current_confidence

        # Update evidence count (total supporting + contradicting)
        total_evidence = (
            len(existing_memory["supporting_evidence"]) +
            len(existing_memory["contradicting_evidence"])
        )

        # Update source_ids
        source_ids = existing_memory["source_ids"]
        email_id_str = str(email_id)  # Convert to string for schema compliance
        if email_id_str not in source_ids:
            source_ids.append(email_id_str)

        # Prepare updates
        updates = {
            "confidence": new_confidence,
            "evidence_count": total_evidence,
            "supporting_evidence": existing_memory["supporting_evidence"],
            "contradicting_evidence": existing_memory["contradicting_evidence"],
            "last_validated": now,
            "last_updated": now,
            "days_since_validation": 0,
            "source_ids": source_ids,
        }

        # Add grouping metadata if provided (for backfilling old memories)
        if grouping_tier_key:
            updates["grouping_tier_key"] = grouping_tier_key
        if grouping_value:
            updates["grouping_value"] = grouping_value

        # Append new reasoning if provided
        if reasoning:
            existing_reasoning = existing_memory.get("reasoning", "")
            if existing_reasoning:
                updates["reasoning"] = f"{existing_reasoning}\n\n[{now}] {reasoning}"
            else:
                updates["reasoning"] = reasoning

        # Preserve additional fields (e.g., purchase_intent_flag)
        if purchase_intent_flag is not None:
            updates["purchase_intent_flag"] = purchase_intent_flag

        # Update memory
        success = memory_manager.update_semantic_memory(memory_id, updates)

        if not success:
            logger.error(f"Failed to update semantic memory: {memory_id}")
            raise RuntimeError(f"Memory update failed for {memory_id}")

        logger.info(
            f"Updated semantic memory: taxonomy_id={taxonomy_id}, "
            f"confidence {current_confidence:.3f} → {new_confidence:.3f} "
            f"({evidence_type} evidence)"
        )

        # Return updated memory
        updated_memory = memory_manager.get_semantic_memory(memory_id)
        return updated_memory


def reconcile_batch_evidence(
    memory_manager: MemoryManager,
    taxonomy_selections: List[Dict[str, Any]],
    email_id: str
) -> List[Dict[str, Any]]:
    """
    Reconcile multiple taxonomy selections from a single email.

    Convenience function for processing all LLM selections from an email.

    Args:
        memory_manager: MemoryManager instance
        taxonomy_selections: List of taxonomy selection dictionaries
        email_id: Source email ID

    Returns:
        List of updated semantic memories

    Example taxonomy_selection dict:
        {
            "taxonomy_id": 5,
            "section": "demographics",
            "value": "25-29",
            "confidence": 0.75,
            "category_path": "Demographic | Age Range | 25-29",
            "tier_1": "Demographic",
            "tier_2": "Age Range",
            "tier_3": "25-29",
            "reasoning": "Newsletter topics suggest age 25-35"
        }
    """
    updated_memories = []

    for selection in taxonomy_selections:
        try:
            updated_memory = reconcile_evidence(
                memory_manager=memory_manager,
                taxonomy_id=selection["taxonomy_id"],
                section=selection["section"],
                new_value=selection["value"],
                new_evidence_strength=selection["confidence"],
                email_id=email_id,
                category_path=selection["category_path"],
                tier_1=selection["tier_1"],
                tier_2=selection.get("tier_2", ""),
                tier_3=selection.get("tier_3", ""),
                tier_4=selection.get("tier_4", ""),
                tier_5=selection.get("tier_5", ""),
                grouping_tier_key=selection.get("grouping_tier_key", ""),
                grouping_value=selection.get("grouping_value", ""),
                reasoning=selection.get("reasoning", ""),
                purchase_intent_flag=selection.get("purchase_intent_flag"),
            )

            updated_memories.append(updated_memory)

        except Exception as e:
            logger.error(
                f"Failed to reconcile evidence for taxonomy_id={selection['taxonomy_id']}: {e}"
            )
            # Continue with other selections even if one fails

    logger.info(
        f"Batch reconciliation: processed {len(updated_memories)}/{len(taxonomy_selections)} "
        f"selections from email {email_id}"
    )

    return updated_memories


def get_conflicting_classifications(
    memory_manager: MemoryManager,
    section: str,
    min_contradiction_count: int = 2
) -> List[Dict[str, Any]]:
    """
    Get classifications with significant contradicting evidence.

    Useful for identifying uncertain classifications that need review.

    Args:
        memory_manager: MemoryManager instance
        section: Taxonomy section to check
        min_contradiction_count: Minimum contradicting evidence count

    Returns:
        List of semantic memories with significant contradictions

    Example:
        >>> conflicts = get_conflicting_classifications(manager, "demographics", min_contradiction_count=3)
        >>> for memory in conflicts:
        ...     print(f"{memory['value']}: {len(memory['contradicting_evidence'])} contradictions")
    """
    # Get all memories for section
    section_memories = memory_manager.get_memories_by_section(section)

    # Filter for significant contradictions
    conflicts = [
        mem for mem in section_memories
        if len(mem.get("contradicting_evidence", [])) >= min_contradiction_count
    ]

    logger.info(
        f"Found {len(conflicts)} conflicting classifications in section '{section}' "
        f"(min_contradictions={min_contradiction_count})"
    )

    return conflicts


def resolve_contradiction(
    memory_manager: MemoryManager,
    memory_id: str,
    resolution: Literal["keep", "delete", "update"],
    new_value: Optional[str] = None
) -> bool:
    """
    Manually resolve a contradicting classification.

    Args:
        memory_manager: MemoryManager instance
        memory_id: Memory to resolve
        resolution: Action to take ("keep", "delete", or "update")
        new_value: New value if resolution="update"

    Returns:
        True if successful, False otherwise

    Examples:
        >>> # Keep existing classification despite contradictions
        >>> resolve_contradiction(manager, "semantic_demographics_5_25-29", "keep")

        >>> # Delete uncertain classification
        >>> resolve_contradiction(manager, "semantic_demographics_5_25-29", "delete")

        >>> # Update to different value
        >>> resolve_contradiction(manager, "semantic_demographics_5_25-29", "update", "30-34")
    """
    if resolution == "keep":
        # Mark as manually reviewed by updating last_validated
        now = datetime.utcnow().isoformat() + "Z"
        success = memory_manager.update_semantic_memory(
            memory_id,
            {
                "last_validated": now,
                "days_since_validation": 0,
                "reasoning": f"[{now}] Manually reviewed and confirmed"
            }
        )
        logger.info(f"Kept classification: {memory_id}")
        return success

    elif resolution == "delete":
        success = memory_manager.delete_semantic_memory(memory_id)
        logger.info(f"Deleted classification: {memory_id}")
        return success

    elif resolution == "update":
        if not new_value:
            logger.error("resolution='update' requires new_value parameter")
            return False

        # For now, we'll just delete the old and let reconciliation create new
        # A more sophisticated approach would migrate evidence lists
        success = memory_manager.delete_semantic_memory(memory_id)
        logger.info(f"Updated classification: {memory_id} → new value '{new_value}'")
        return success

    else:
        logger.error(f"Invalid resolution: {resolution}")
        return False