"""
Agent Tools for IAB Taxonomy Classification.

Provides tools for ReAct agents to search and validate taxonomy classifications.
Tools wrap existing IABTaxonomyLoader and validation logic for agent use.

All tools return JSON strings for LangChain compatibility.
"""

import json
import logging
from typing import Optional
from langchain.tools import tool

logger = logging.getLogger(__name__)

# Cache taxonomy loader instance
_taxonomy_loader: Optional[object] = None


def _get_taxonomy_loader():
    """Get cached taxonomy loader instance."""
    global _taxonomy_loader
    if _taxonomy_loader is None:
        from ..utils.iab_taxonomy_loader import IABTaxonomyLoader
        _taxonomy_loader = IABTaxonomyLoader()
        logger.debug("Initialized IABTaxonomyLoader for agent tools")
    return _taxonomy_loader


def _get_taxonomy_value(entry: dict) -> str:
    """Extract taxonomy value using existing logic from analyzers."""
    from ..workflow.nodes.analyzers import get_taxonomy_value
    return get_taxonomy_value(entry)


@tool
def search_demographics_taxonomy(keyword: str) -> str:
    """
    Search demographics taxonomy (age, gender, education, etc.) for keyword.

    Args:
        keyword: Search term like 'age', 'male', 'college', 'married'

    Returns:
        JSON string with top 10 matching entries:
        [
            {
                "taxonomy_id": int,
                "tier_path": str,
                "value": str,
                "grouping_tier": str
            },
            ...
        ]

    Example:
        >>> result = search_demographics_taxonomy("age")
        >>> matches = json.loads(result)
        >>> print(f"Found {len(matches)} age-related entries")
    """
    try:
        loader = _get_taxonomy_loader()
        section = loader.taxonomy_by_section.get("demographics", [])

        matches = []
        keyword_lower = keyword.lower()

        for entry in section:
            # Search across all tier levels
            searchable_text = " ".join([
                entry.get("tier_2", ""),
                entry.get("tier_3", ""),
                entry.get("tier_4", ""),
                entry.get("tier_5", "")
            ]).lower()

            if keyword_lower in searchable_text:
                matches.append({
                    "taxonomy_id": entry["id"],
                    "tier_path": entry.get("category_path", ""),
                    "value": _get_taxonomy_value(entry),
                    "grouping_tier": entry.get("grouping_tier_key", "tier_2")
                })

        # Return top 10 matches
        return json.dumps(matches[:10])

    except Exception as e:
        logger.error(f"Error searching demographics taxonomy: {e}")
        return json.dumps([])


@tool
def search_household_taxonomy(keyword: str) -> str:
    """
    Search household taxonomy (location, income, property, etc.) for keyword.

    Args:
        keyword: Search term like 'income', 'apartment', 'urban', 'rent'

    Returns:
        JSON string with top 10 matching entries

    Example:
        >>> result = search_household_taxonomy("income")
        >>> matches = json.loads(result)
    """
    try:
        loader = _get_taxonomy_loader()
        section = loader.taxonomy_by_section.get("household_data", [])

        matches = []
        keyword_lower = keyword.lower()

        for entry in section:
            searchable_text = " ".join([
                entry.get("tier_2", ""),
                entry.get("tier_3", ""),
                entry.get("tier_4", ""),
                entry.get("tier_5", "")
            ]).lower()

            if keyword_lower in searchable_text:
                matches.append({
                    "taxonomy_id": entry["id"],
                    "tier_path": entry.get("category_path", ""),
                    "value": _get_taxonomy_value(entry),
                    "grouping_tier": entry.get("grouping_tier_key", "tier_2")
                })

        return json.dumps(matches[:10])

    except Exception as e:
        logger.error(f"Error searching household taxonomy: {e}")
        return json.dumps([])


@tool
def search_interests_taxonomy(keyword: str) -> str:
    """
    Search interests taxonomy (hobbies, topics, activities) for keyword.

    Args:
        keyword: Search term like 'crypto', 'technology', 'sports', 'art'

    Returns:
        JSON string with top 10 matching entries

    Example:
        >>> result = search_interests_taxonomy("cryptocurrency")
        >>> matches = json.loads(result)
    """
    try:
        loader = _get_taxonomy_loader()
        section = loader.taxonomy_by_section.get("interests", [])

        matches = []
        keyword_lower = keyword.lower()

        for entry in section:
            searchable_text = " ".join([
                entry.get("tier_2", ""),
                entry.get("tier_3", ""),
                entry.get("tier_4", ""),
                entry.get("tier_5", "")
            ]).lower()

            if keyword_lower in searchable_text:
                matches.append({
                    "taxonomy_id": entry["id"],
                    "tier_path": entry.get("category_path", ""),
                    "value": _get_taxonomy_value(entry),
                    "grouping_tier": entry.get("grouping_tier_key", "tier_2")
                })

        return json.dumps(matches[:10])

    except Exception as e:
        logger.error(f"Error searching interests taxonomy: {e}")
        return json.dumps([])


@tool
def search_purchase_taxonomy(keyword: str) -> str:
    """
    Search purchase intent taxonomy (product categories) for keyword.

    Args:
        keyword: Search term like 'electronics', 'clothing', 'food', 'software'

    Returns:
        JSON string with top 10 matching entries

    Example:
        >>> result = search_purchase_taxonomy("electronics")
        >>> matches = json.loads(result)
    """
    try:
        loader = _get_taxonomy_loader()
        section = loader.taxonomy_by_section.get("purchase_intent", [])

        matches = []
        keyword_lower = keyword.lower()

        for entry in section:
            searchable_text = " ".join([
                entry.get("tier_2", ""),
                entry.get("tier_3", ""),
                entry.get("tier_4", ""),
                entry.get("tier_5", "")
            ]).lower()

            if keyword_lower in searchable_text:
                matches.append({
                    "taxonomy_id": entry["id"],
                    "tier_path": entry.get("category_path", ""),
                    "value": _get_taxonomy_value(entry),
                    "grouping_tier": entry.get("grouping_tier_key", "tier_2")
                })

        return json.dumps(matches[:10])

    except Exception as e:
        logger.error(f"Error searching purchase taxonomy: {e}")
        return json.dumps([])


@tool
def validate_classification(taxonomy_id: int, value: str) -> str:
    """
    Validate that taxonomy_id and value are a correct match.

    Uses existing validation logic to check if the provided value
    matches what the taxonomy defines for this ID.

    Args:
        taxonomy_id: IAB Taxonomy ID (1-1568)
        value: Classification value (e.g., "Male", "25-29", "Cryptocurrency")

    Returns:
        JSON string with validation result:
        {
            "valid": bool,
            "taxonomy_id": int,
            "expected_value": str,
            "provided_value": str,
            "tier_path": str,
            "reason": str  # If invalid
        }

    Example:
        >>> result = validate_classification(50, "Male")
        >>> data = json.loads(result)
        >>> assert data["valid"] == True
    """
    try:
        from ..workflow.nodes.analyzers import (
            lookup_taxonomy_entry,
            get_taxonomy_value,
            validate_taxonomy_classification
        )

        # Look up taxonomy entry
        entry = lookup_taxonomy_entry(taxonomy_id)

        if not entry:
            return json.dumps({
                "valid": False,
                "taxonomy_id": taxonomy_id,
                "provided_value": value,
                "reason": f"Taxonomy ID {taxonomy_id} not found in IAB taxonomy"
            })

        # Get expected value
        expected_value = get_taxonomy_value(entry)

        # Validate using existing logic
        is_valid = validate_taxonomy_classification(taxonomy_id, value, entry)

        return json.dumps({
            "valid": is_valid,
            "taxonomy_id": taxonomy_id,
            "expected_value": expected_value,
            "provided_value": value,
            "tier_path": entry.get("category_path", ""),
            "reason": "" if is_valid else f"Value mismatch: expected '{expected_value}', got '{value}'"
        })

    except Exception as e:
        logger.error(f"Error validating classification: {e}")
        return json.dumps({
            "valid": False,
            "taxonomy_id": taxonomy_id,
            "provided_value": value,
            "reason": f"Validation error: {str(e)}"
        })


@tool
def get_tier_details(taxonomy_id: int) -> str:
    """
    Get full details for a taxonomy entry including all tier levels.

    Args:
        taxonomy_id: IAB Taxonomy ID (1-1568)

    Returns:
        JSON string with complete taxonomy entry:
        {
            "taxonomy_id": int,
            "tier_1": str,
            "tier_2": str,
            "tier_3": str,
            "tier_4": str,
            "tier_5": str,
            "category_path": str,
            "value": str,
            "grouping_tier_key": str,
            "grouping_value": str
        }

    Example:
        >>> result = get_tier_details(50)
        >>> data = json.loads(result)
        >>> print(f"Tier 1: {data['tier_1']}, Tier 2: {data['tier_2']}")
    """
    try:
        from ..workflow.nodes.analyzers import lookup_taxonomy_entry

        entry = lookup_taxonomy_entry(taxonomy_id)

        if not entry:
            return json.dumps({
                "error": f"Taxonomy ID {taxonomy_id} not found",
                "taxonomy_id": taxonomy_id
            })

        return json.dumps({
            "taxonomy_id": taxonomy_id,
            "tier_1": entry.get("tier_1", ""),
            "tier_2": entry.get("tier_2", ""),
            "tier_3": entry.get("tier_3", ""),
            "tier_4": entry.get("tier_4", ""),
            "tier_5": entry.get("tier_5", ""),
            "category_path": entry.get("category_path", ""),
            "value": entry.get("name", ""),
            "grouping_tier_key": entry.get("grouping_tier_key", ""),
            "grouping_value": entry.get("grouping_value", "")
        })

    except Exception as e:
        logger.error(f"Error getting tier details: {e}")
        return json.dumps({
            "error": str(e),
            "taxonomy_id": taxonomy_id
        })


__all__ = [
    'search_demographics_taxonomy',
    'search_household_taxonomy',
    'search_interests_taxonomy',
    'search_purchase_taxonomy',
    'validate_classification',
    'get_tier_details',
]
