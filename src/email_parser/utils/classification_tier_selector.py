#!/usr/bin/env python3
"""
Classification Tier Selector

Implements tiered confidence classification system that distinguishes between:
- Primary Classification: Highest confidence within mutually-exclusive tier groups
- Alternative Classifications: Lower confidence viable alternatives

This enables:
- Conflict resolution in mutually-exclusive categories (Male vs Female, age ranges)
- Granularity prioritization (tier_4/tier_5 over tier_2/tier_3 when high confidence)
- Uncertainty preservation (keeping alternative classifications)
- Profile evolution tracking (smooth transitions when evidence shifts)

Reference: docs/TIERED_CONFIDENCE_CLASSIFICATION_PROPOSAL.md
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TieredClassification:
    """
    Represents a primary classification with its alternatives.

    Attributes:
        primary: The highest-ranked classification
        alternatives: List of viable alternative classifications
        tier_group: The tier group identifier (e.g., "demographics.gender")
        selection_method: How the primary was selected ("highest_confidence", "granularity_weighted")
    """
    primary: Dict[str, Any]
    alternatives: List[Dict[str, Any]]
    tier_group: str
    selection_method: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "primary": self.primary,
            "alternatives": self.alternatives,
            "tier_group": self.tier_group,
            "selection_method": self.selection_method
        }


def calculate_tier_depth(classification: Dict[str, Any]) -> int:
    """
    Calculate tier depth (number of non-empty tiers).

    Args:
        classification: Classification dict with tier_1, tier_2, etc.

    Returns:
        Number of non-empty tiers (1-5)

    Examples:
        >>> calculate_tier_depth({"tier_1": "Interest", "tier_2": "Technology", "tier_3": "", ...})
        2
        >>> calculate_tier_depth({"tier_1": "Interest", "tier_2": "Careers", "tier_3": "Remote Working", ...})
        3
    """
    tiers = [
        classification.get("tier_1", ""),
        classification.get("tier_2", ""),
        classification.get("tier_3", ""),
        classification.get("tier_4", ""),
        classification.get("tier_5", "")
    ]
    return len([t for t in tiers if t and t.strip()])


def calculate_granularity_score(
    classification: Dict[str, Any],
    granularity_bonus: float = 0.05
) -> float:
    """
    Calculate granularity-weighted score.

    Formula:
        score = confidence + (tier_depth * granularity_bonus) if confidence >= 0.7 else confidence

    This prioritizes more specific (deeper) classifications when confidence is high.

    Args:
        classification: Classification dict with confidence and tier info
        granularity_bonus: Bonus per tier level (default: 0.05)

    Returns:
        Granularity-weighted score

    Examples:
        >>> calculate_granularity_score({"confidence": 0.95, "tier_1": "Interest", "tier_2": "Careers", "tier_3": "Remote Working"})
        1.10  # 0.95 + (3 * 0.05)

        >>> calculate_granularity_score({"confidence": 0.65, "tier_1": "Interest", "tier_2": "Technology"})
        0.65  # Below 0.7 threshold, no bonus
    """
    confidence = classification.get("confidence", 0.0)

    # Only apply granularity bonus if confidence is reasonably high (>= 0.7)
    if confidence >= 0.7:
        depth = calculate_tier_depth(classification)
        score = confidence + (depth * granularity_bonus)
    else:
        score = confidence

    return score


def select_primary_and_alternatives(
    classifications: List[Dict[str, Any]],
    tier_group: str,
    min_confidence: float = 0.5,
    confidence_delta_threshold: float = 0.3,
    granularity_bonus: float = 0.05
) -> Optional[TieredClassification]:
    """
    Select primary classification and alternatives from a tier group.

    Selection Algorithm:
    1. Filter by minimum confidence threshold (default: 0.5)
    2. Calculate granularity scores (confidence + depth bonus if confidence >= 0.7)
    3. Select highest scoring classification as primary
    4. Select alternatives within confidence delta threshold (default: 0.3)

    Args:
        classifications: List of classification dicts from semantic memory
        tier_group: Tier group identifier (e.g., "demographics.gender")
        min_confidence: Minimum confidence threshold (default: 0.5)
        confidence_delta_threshold: Max delta for alternatives (default: 0.3)
        granularity_bonus: Bonus per tier level (default: 0.05)

    Returns:
        TieredClassification or None if no viable classifications

    Examples:
        >>> classifications = [
        ...     {"taxonomy_id": 21, "value": "Female", "confidence": 0.99, "tier_1": "Demographic", "tier_2": "Female"},
        ...     {"taxonomy_id": 20, "value": "Male", "confidence": 0.89, "tier_1": "Demographic", "tier_2": "Male"}
        ... ]
        >>> result = select_primary_and_alternatives(classifications, "demographics.gender")
        >>> result.primary["value"]
        'Female'
        >>> len(result.alternatives)
        1
        >>> result.alternatives[0]["value"]
        'Male'
    """
    if not classifications:
        return None

    # Step 1: Filter by minimum confidence
    viable = [c for c in classifications if c.get("confidence", 0.0) >= min_confidence]

    if not viable:
        logger.debug(f"No viable classifications for {tier_group} (min_confidence={min_confidence})")
        return None

    # Step 2: Calculate granularity scores
    scored = []
    for c in viable:
        score = calculate_granularity_score(c, granularity_bonus)
        tier_depth = calculate_tier_depth(c)

        scored.append({
            "classification": c,
            "granularity_score": score,
            "tier_depth": tier_depth
        })

    # Step 3: Sort by granularity score (highest first)
    scored.sort(reverse=True, key=lambda x: x["granularity_score"])

    # REQ-1.4: Filter out "Unknown" classifications in mutually-exclusive tiers
    # For mutually-exclusive tier groups (Gender, Age, Education, etc.), if the highest
    # confidence classification value starts with "Unknown ", discard the entire tier group.
    # Rationale: "Unknown [Field]" indicates inability to classify, not a valid classification.
    if scored and scored[0]["classification"].get("tier_2", "").startswith("Unknown "):
        logger.warning(
            f"Filtered tier group '{scored[0]['classification'].get('tier_1', 'Unknown')}' - "
            f"highest confidence classification is '{scored[0]['classification'].get('tier_2', 'Unknown')}' "
            f"(confidence: {scored[0]['classification'].get('confidence', 0.0):.1%})"
        )
        return {
            "primary": None,
            "alternatives": []
        }

    # Step 4: Select primary
    primary_entry = scored[0]
    primary = primary_entry["classification"].copy()
    primary["granularity_score"] = primary_entry["granularity_score"]
    primary["tier_depth"] = primary_entry["tier_depth"]
    primary["classification_type"] = "primary"

    # Step 5: Select alternatives (within confidence delta threshold)
    primary_score = primary_entry["granularity_score"]
    primary_confidence = primary.get("confidence", 0.0)
    alternatives = []

    for entry in scored[1:]:
        score = entry["granularity_score"]
        confidence = entry["classification"].get("confidence", 0.0)

        # Calculate confidence delta (use raw confidence, not granularity score)
        confidence_delta = primary_confidence - confidence

        # Include if confidence delta within threshold and above min confidence
        if confidence_delta <= confidence_delta_threshold and confidence >= min_confidence:
            alt = entry["classification"].copy()
            alt["granularity_score"] = score
            alt["tier_depth"] = entry["tier_depth"]
            alt["classification_type"] = "alternative"
            alt["confidence_delta"] = round(confidence_delta, 3)
            alternatives.append(alt)

    # Determine selection method
    selection_method = "granularity_weighted" if primary.get("confidence", 0.0) >= 0.7 else "highest_confidence"

    logger.debug(
        f"Selected primary for {tier_group}: {primary.get('value')} "
        f"(score={primary['granularity_score']:.3f}, method={selection_method}), "
        f"{len(alternatives)} alternatives"
    )

    return TieredClassification(
        primary=primary,
        alternatives=alternatives,
        tier_group=tier_group,
        selection_method=selection_method
    )


def group_classifications_by_tier(
    classifications: List[Dict[str, Any]],
    section: str
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group classifications by pre-computed grouping_value from taxonomy.

    The grouping_value is determined by the IAB taxonomy structure and parent relationships:
    - For entries where parent has no tier_3: grouped by tier_2 (e.g., "Gender")
    - For entries where parent has tier_3: grouped by tier_3 (e.g., "Education (Highest Level)")

    This handles complex cases like "Education & Occupation" which contains both:
    - "Education (Highest Level)" group (tier_3) for education levels
    - "Employment Status" group (tier_3) for employment status

    Args:
        classifications: List of classification dicts with grouping_value field
        section: Section name (demographics, household, interests, purchase_intent)

    Returns:
        Dict mapping grouping_value to list of classifications

    Examples:
        >>> classifications = [
        ...     {"grouping_value": "Gender", "value": "Female", "confidence": 0.99},
        ...     {"grouping_value": "Gender", "value": "Male", "confidence": 0.89},
        ...     {"grouping_value": "Education (Highest Level)", "value": "College", "confidence": 0.85},
        ...     {"grouping_value": "Employment Status", "value": "Employed", "confidence": 0.60}
        ... ]
        >>> groups = group_classifications_by_tier(classifications, "demographics")
        >>> list(groups.keys())
        ['Gender', 'Education (Highest Level)', 'Employment Status']
    """
    groups: Dict[str, List[Dict[str, Any]]] = {}

    for c in classifications:
        grouping_value = c.get("grouping_value", "")
        if not grouping_value:
            logger.warning(
                f"Classification missing grouping_value: "
                f"taxonomy_id={c.get('taxonomy_id')}, value={c.get('value')}"
            )
            continue

        if grouping_value not in groups:
            groups[grouping_value] = []
            logger.debug(f"[{section}] Created new group: '{grouping_value}'")

        groups[grouping_value].append(c)
        logger.debug(
            f"[{section}] Added to group '{grouping_value}': {c.get('value')} "
            f"(ID {c.get('taxonomy_id')}, confidence {c.get('confidence', 0):.2f})"
        )

    # Log final grouping summary
    logger.info(f"[{section}] Grouped {len(classifications)} classifications into {len(groups)} groups:")
    for grouping_value, group_items in groups.items():
        values = [f"{item.get('value')}({item.get('confidence', 0):.2f})" for item in group_items]
        logger.info(f"  '{grouping_value}': {len(group_items)} items - {', '.join(values[:5])}")

    return groups


def is_mutually_exclusive_tier(grouping_value: str) -> bool:
    """
    Determine if a grouping value represents mutually exclusive categories.

    Most grouping values are mutually exclusive (you can only be in one category).
    Notable exceptions are listed below.

    Mutually Exclusive Examples:
    - "Gender": Male XOR Female
    - "Age": Age ranges are mutually exclusive
    - "Education (Highest Level)": Education levels are mutually exclusive
    - "Marital Status": Single XOR Married XOR Divorced
    - "Income": Income ranges are mutually exclusive

    Non-Exclusive Examples:
    - "Employment Status": Can be employed AND educated (separate groups)
    - Interests: All interest categories are non-exclusive
    - Purchase Intent: Can have multiple purchase intents

    Args:
        grouping_value: The grouping value to check

    Returns:
        True if mutually exclusive, False otherwise
    """
    # Most grouping values are mutually exclusive
    # Only explicitly list the NON-exclusive ones
    non_exclusive_groups = [
        "Employment Status",  # Can be employed AND have education level
        # Interests and Purchase Intent are handled by section logic below
    ]

    return grouping_value not in non_exclusive_groups


def apply_tiered_classification(
    classifications: List[Dict[str, Any]],
    section: str,
    min_confidence: float = 0.5,
    confidence_delta_threshold: float = 0.3
) -> Dict[str, TieredClassification]:
    """
    Apply tiered classification logic to a section's classifications.

    This is the main entry point for applying primary/alternative selection.

    Args:
        classifications: List of classification dicts from semantic memory
        section: Section name (demographics, household, interests, purchase_intent)
        min_confidence: Minimum confidence threshold
        confidence_delta_threshold: Max delta for alternatives

    Returns:
        Dict mapping tier_2 groups to TieredClassification objects

    Examples:
        >>> classifications = [
        ...     {"tier_2": "Female", "value": "Female", "confidence": 0.99},
        ...     {"tier_2": "Male", "value": "Male", "confidence": 0.89}
        ... ]
        >>> tiered = apply_tiered_classification(classifications, "demographics")
        >>> tiered.keys()
        dict_keys(['gender'])
    """
    # Group by tier (tier_3 for demographics/household, tier_2 for interests/purchase_intent)
    groups = group_classifications_by_tier(classifications, section)

    tiered_results: Dict[str, TieredClassification] = {}

    for tier_value, group_classifications in groups.items():
        # Check if mutually exclusive (tier_value is the grouping_value)
        is_exclusive = is_mutually_exclusive_tier(tier_value)

        if is_exclusive:
            # Select primary and alternatives
            tier_group = f"{section}.{tier_value.lower().replace(' ', '_').replace('(', '').replace(')', '')}"
            tiered = select_primary_and_alternatives(
                group_classifications,
                tier_group,
                min_confidence,
                confidence_delta_threshold
            )

            if tiered:
                tiered_results[tier_value] = tiered
        else:
            # Non-exclusive: treat all as primaries (interests, purchase intent, employment status)
            # Still apply granularity scoring for ranking
            for c in group_classifications:
                tier_group = f"{section}.{tier_value.lower().replace(' ', '_').replace('(', '').replace(')', '')}"

                # Each classification is its own "primary" with no alternatives
                score = calculate_granularity_score(c)
                depth = calculate_tier_depth(c)

                primary = c.copy()
                primary["granularity_score"] = score
                primary["tier_depth"] = depth
                primary["classification_type"] = "primary"

                tiered = TieredClassification(
                    primary=primary,
                    alternatives=[],
                    tier_group=tier_group,
                    selection_method="non_exclusive"
                )

                # Use taxonomy_id as key for non-exclusive groups
                key = f"{tier_value}_{c.get('taxonomy_id')}"
                tiered_results[key] = tiered

    return tiered_results
