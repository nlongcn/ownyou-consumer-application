#!/usr/bin/env python3
"""
Profile Tier Formatter

Transforms flat classification lists into tiered structure (primary/alternatives)
for JSON output while maintaining backward compatibility with existing Pydantic models.

This is a presentation-layer transformation that doesn't affect storage or memory models.
"""

import logging
from typing import Dict, Any, List, Optional
from .classification_tier_selector import apply_tiered_classification

logger = logging.getLogger(__name__)


def format_tiered_demographics(demographics_memories: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Format demographics memories into tiered structure.

    Args:
        demographics_memories: List of demographic classification dicts from memory

    Returns:
        Dict with tiered demographics (age_range, gender, etc. with primary/alternatives)
    """
    if not demographics_memories:
        return {}

    # Apply tiered classification
    tiered = apply_tiered_classification(demographics_memories, "demographics")

    result = {}

    # Map grouping_value to demographic fields
    # Based on IAB Audience Taxonomy 1.1 (dynamic tier-based grouping)
    grouping_to_field = {
        "Gender": "gender",
        "Age": "age_range",
        "Education (Highest Level)": "education",
        "Employment Status": "occupation",
        "Marital Status": "marital_status",
        "Language": "language",
    }

    for tier_group_key, tier_result in tiered.items():
        # Determine field name from grouping_value (pre-computed by taxonomy loader)
        grouping_value = tier_result.primary.get("grouping_value", "")

        # Look up field name from grouping_value
        field_name = grouping_to_field.get(grouping_value)

        if not field_name:
            # If no mapping, use grouping_value as field name (sanitized)
            field_name = grouping_value.lower().replace(" ", "_").replace("(", "").replace(")", "").replace("-", "_")
            logger.debug(f"Using sanitized grouping_value as field name: {grouping_value} -> {field_name}")

        # Format primary and alternatives
        result[field_name] = {
            "primary": _format_selection(tier_result.primary),
            "alternatives": [_format_selection(alt) for alt in tier_result.alternatives],
            "selection_method": tier_result.selection_method
        }

    return result


def format_tiered_household(household_memories: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Format household memories into tiered structure.

    Args:
        household_memories: List of household classification dicts from memory

    Returns:
        Dict with tiered household data (income, property_type, etc. with primary/alternatives)
    """
    if not household_memories:
        return {}

    # Apply tiered classification
    tiered = apply_tiered_classification(household_memories, "household")

    result = {}

    # Map grouping_value to household fields (based on IAB Audience Taxonomy 1.1)
    # grouping_value is pre-computed by IABTaxonomyLoader based on parent relationships
    grouping_to_field = {
        "Home Location": "location",
        "Household Income (USD)": "income",
        "Length of Residence": "length_of_residence",
        "Life Stage": "life_stage",
        "Median Home Value (USD)": "median_home_value",
        "Monthly Housing Payment (USD)": "monthly_housing_payment",
        "Number of Adults": "number_of_adults",
        "Number of Children": "number_of_children",
        "Number of Individuals": "number_of_individuals",
        "Ownership": "ownership",
        "Property Type": "property_type",
        "Urbanization": "urbanization",
        "Language": "language"
    }

    # Map tier groups to household fields
    for tier_group_key, tier_result in tiered.items():
        # Use pre-computed grouping_value (same approach as demographics)
        grouping_value = tier_result.primary.get("grouping_value", "")

        # Look up field name from grouping_value
        field_name = grouping_to_field.get(grouping_value)

        if not field_name:
            # Fallback: sanitize grouping_value as field name
            field_name = grouping_value.lower().replace(" ", "_").replace("(", "").replace(")", "").replace("-", "_")
            logger.debug(f"Using sanitized grouping_value as field name: {grouping_value} -> {field_name}")

        result[field_name] = {
            "primary": _format_selection(tier_result.primary),
            "alternatives": [_format_selection(alt) for alt in tier_result.alternatives],
            "selection_method": tier_result.selection_method
        }

    return result


def format_tiered_interests(interest_memories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Format interest memories into tiered structure.

    For interests (non-exclusive), each classification is its own "primary"
    but we still rank by granularity score.

    Args:
        interest_memories: List of interest classification dicts from memory

    Returns:
        List of tiered interests, sorted by granularity score
    """
    if not interest_memories:
        return []

    # Apply tiered classification
    tiered = apply_tiered_classification(interest_memories, "interests")

    # Convert to list and sort by granularity score
    result = []
    for tier_result in tiered.values():
        primary = tier_result.primary
        result.append({
            "primary": _format_selection(primary),
            "alternatives": [],  # Interests are non-exclusive, no alternatives
            "selection_method": tier_result.selection_method,
            "granularity_score": primary.get("granularity_score", 0.0)
        })

    # Sort by granularity score (descending)
    result.sort(key=lambda x: x["granularity_score"], reverse=True)

    return result


def format_tiered_purchase_intent(purchase_memories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Format purchase intent memories into tiered structure.

    Similar to interests, purchase intent is non-exclusive.

    Args:
        purchase_memories: List of purchase intent classification dicts from memory

    Returns:
        List of tiered purchase intent, sorted by granularity score
    """
    if not purchase_memories:
        return []

    # Apply tiered classification
    tiered = apply_tiered_classification(purchase_memories, "purchase_intent")

    # Convert to list and sort by granularity score
    result = []
    for tier_result in tiered.values():
        primary = tier_result.primary
        result.append({
            "primary": _format_selection(primary),
            "alternatives": [],  # Purchase intent is non-exclusive
            "selection_method": tier_result.selection_method,
            "granularity_score": primary.get("granularity_score", 0.0),
            "purchase_intent_flag": primary.get("purchase_intent_flag")
        })

    # Sort by granularity score (descending)
    result.sort(key=lambda x: x["granularity_score"], reverse=True)

    return result


def _format_selection(selection: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format a single selection dict for JSON output.

    Args:
        selection: Classification dict

    Returns:
        Formatted dict with standard fields
    """
    return {
        "taxonomy_id": selection.get("taxonomy_id"),
        "tier_path": selection.get("tier_path", selection.get("category_path", "")),
        "value": selection.get("value"),
        "confidence": selection.get("confidence"),
        "evidence_count": selection.get("evidence_count", 1),
        "last_validated": selection.get("last_validated", ""),
        "days_since_validation": selection.get("days_since_validation", 0),
        "tier_depth": selection.get("tier_depth", 0),
        "granularity_score": selection.get("granularity_score", 0.0),
        "classification_type": selection.get("classification_type", "primary"),
        "confidence_delta": selection.get("confidence_delta", 0.0) if selection.get("classification_type") == "alternative" else None
    }


def add_tiered_structure_to_profile(profile_dict: Dict[str, Any], memories: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Add tiered classification structure to profile dict.

    This modifies the profile dict to include tiered_classifications section
    while preserving the original flat structure for backward compatibility.

    Args:
        profile_dict: Original profile dict
        memories: Dict of memories by section (demographics, household, interests, purchase_intent)

    Returns:
        Enhanced profile dict with tiered_classifications section
    """
    # Add schema version
    profile_dict["schema_version"] = "2.0"

    # Add tiered_classifications section
    profile_dict["tiered_classifications"] = {
        "demographics": format_tiered_demographics(memories.get("demographics", [])),
        "household": format_tiered_household(memories.get("household", [])),
        "interests": format_tiered_interests(memories.get("interests", [])),
        "purchase_intent": format_tiered_purchase_intent(memories.get("purchase_intent", []))
    }

    logger.info(f"Added tiered classifications: "
                f"{len(profile_dict['tiered_classifications']['demographics'])} demographics groups, "
                f"{len(profile_dict['tiered_classifications']['interests'])} interests")

    return profile_dict
