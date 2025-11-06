"""
Taxonomy Context Builder

Formats IAB Taxonomy categories for LLM prompts.
Provides relevant taxonomy sections for each analyzer type.
Loads taxonomy dynamically from IAB Audience Taxonomy 1.1 file.
"""

from typing import Dict, List, Optional
import logging
from ..utils.iab_taxonomy_loader import IABTaxonomyLoader

logger = logging.getLogger(__name__)

# Singleton taxonomy loader instance
_taxonomy_loader: Optional[IABTaxonomyLoader] = None


def get_taxonomy_loader() -> IABTaxonomyLoader:
    """
    Get singleton IAB taxonomy loader instance.

    Returns:
        IABTaxonomyLoader instance
    """
    global _taxonomy_loader
    if _taxonomy_loader is None:
        logger.info("Initializing IAB Taxonomy Loader")
        _taxonomy_loader = IABTaxonomyLoader()
    return _taxonomy_loader


def format_taxonomy_entry(entry: Dict) -> str:
    """
    Format a single taxonomy entry for LLM prompt.

    Format: ID X: Tier1 | Tier2 | Tier3 | Tier4 | Tier5

    Args:
        entry: Taxonomy entry dict from IABTaxonomyLoader

    Returns:
        Formatted string

    Example:
        >>> entry = {"id": 49, "tier_1": "Demographic", "tier_2": "Gender", "tier_3": "Female", ...}
        >>> format_taxonomy_entry(entry)
        'ID 49: Demographic | Gender | Female'
    """
    parts = []
    for tier_num in range(1, 6):
        tier_val = entry.get(f"tier_{tier_num}", "")
        if tier_val and tier_val.strip():
            parts.append(tier_val)

    path = " | ".join(parts)
    return f"ID {entry['id']}: {path}"


def get_demographics_taxonomy_context() -> str:
    """
    Get demographics taxonomy formatted for LLM prompt.

    Loads actual taxonomy entries from IAB Audience Taxonomy 1.1.
    Groups by tier_2 to show mutually-exclusive categories.

    Returns:
        Formatted string with relevant taxonomy categories
    """
    loader = get_taxonomy_loader()

    # Get demographics section (rows 11-62)
    demographics_entries_raw = loader.taxonomy_by_section.get("demographics", [])

    # FILTER OUT *Extension entries - they are placeholders, not real classifications
    demographics_entries = [
        entry for entry in demographics_entries_raw
        if not any(
            tier_val and "*Extension" in str(tier_val)
            for tier_num in range(1, 6)
            for tier_val in [entry.get(f"tier_{tier_num}", "")]
        )
    ]

    # Group by tier_2 (the mutually-exclusive grouping dimension)
    grouped: Dict[str, List[Dict]] = {}
    for entry in demographics_entries:
        tier_2 = entry.get("tier_2", "")
        if not tier_2:
            continue
        if tier_2 not in grouped:
            grouped[tier_2] = []
        grouped[tier_2].append(entry)

    # Build context
    lines = ["Demographics Categories (IAB Audience Taxonomy 1.1):", ""]
    lines.append("IMPORTANT: Tier 2 represents mutually-exclusive groups (select ONE per group).")
    lines.append("Example: Within 'Gender' group, select either Male OR Female, not both.")
    lines.append("")

    # Format each tier_2 group
    for tier_2, entries in sorted(grouped.items()):
        lines.append(f"{tier_2} (Tier 2 - mutually exclusive):")
        for entry in sorted(entries, key=lambda x: x['id']):
            lines.append(f"- {format_taxonomy_entry(entry)}")
        lines.append("")

    lines.append("Only select categories where you find strong signals in the email content.")
    lines.append("Always return the taxonomy_id (ID number) in your response.")

    return "\n".join(lines)


def get_household_taxonomy_context() -> str:
    """
    Get household taxonomy formatted for LLM prompt.

    Returns:
        Formatted string with relevant taxonomy categories
    """
    loader = get_taxonomy_loader()

    # Get household section (rows 64-168)
    household_entries_raw = loader.taxonomy_by_section.get("household_data", [])

    # FILTER OUT *Extension entries - they are placeholders, not real classifications
    household_entries = [
        entry for entry in household_entries_raw
        if not any(
            tier_val and "*Extension" in str(tier_val)
            for tier_num in range(1, 6)
            for tier_val in [entry.get(f"tier_{tier_num}", "")]
        )
    ]

    # Group by grouping_value (same as demographics approach)
    # This ensures proper grouping by category (Urbanization, Property Type, etc.)
    grouped: Dict[str, List[Dict]] = {}
    for entry in household_entries:
        grouping_value = entry.get("grouping_value", "")
        if not grouping_value:
            continue
        if grouping_value not in grouped:
            grouped[grouping_value] = []
        grouped[grouping_value].append(entry)

    # Build context
    lines = ["Household Categories (IAB Audience Taxonomy 1.1):", ""]
    lines.append("IMPORTANT: Categories are mutually-exclusive within each group.")
    lines.append("")

    # Prioritize commonly needed household categories
    priority_groups = [
        "Home Location",
        "Urbanization",
        "Property Type",
        "Ownership",
        "Household Income (USD)",
        "Life Stage",
        "Number of Adults",
        "Number of Children"
    ]

    # Format priority groups first (up to 10 entries each)
    count = 0
    shown_groups = set()
    for group_name in priority_groups:
        if group_name in grouped and count < 80:  # Increased limit
            entries = grouped[group_name]
            lines.append(f"{group_name}:")
            for entry in sorted(entries, key=lambda x: x['id'])[:10]:
                lines.append(f"- {format_taxonomy_entry(entry)}")
                count += 1
            lines.append("")
            shown_groups.add(group_name)

    # Add remaining groups if space allows
    for group_name, entries in sorted(grouped.items()):
        if group_name not in shown_groups and count < 100:
            lines.append(f"{group_name}:")
            for entry in sorted(entries, key=lambda x: x['id'])[:5]:
                lines.append(f"- {format_taxonomy_entry(entry)}")
                count += 1
                if count >= 100:
                    break
            lines.append("")

    lines.append("Look for signals in utility bills, service providers, home-related communications.")
    lines.append("Always return the taxonomy_id (ID number) in your response.")

    return "\n".join(lines)


def get_interests_taxonomy_context() -> str:
    """
    Get interests taxonomy formatted for LLM prompt.

    Returns:
        Formatted string with relevant taxonomy categories
    """
    loader = get_taxonomy_loader()

    # Get interests section (rows 209-704)
    interest_entries_raw = loader.taxonomy_by_section.get("interests", [])

    # FILTER OUT *Extension entries - they are placeholders, not real classifications
    interest_entries = [
        entry for entry in interest_entries_raw
        if not any(
            tier_val and "*Extension" in str(tier_val)
            for tier_num in range(1, 6)
            for tier_val in [entry.get(f"tier_{tier_num}", "")]
        )
    ]

    # Group by tier_2 for organizational clarity
    grouped: Dict[str, List[Dict]] = {}
    for entry in interest_entries:
        tier_2 = entry.get("tier_2", "")
        if not tier_2:
            continue
        if tier_2 not in grouped:
            grouped[tier_2] = []
        grouped[tier_2].append(entry)

    # Build context
    lines = ["Interests Categories (IAB Audience Taxonomy 1.1):", ""]
    lines.append("NOTE: Interests are NON-EXCLUSIVE - you can select MULTIPLE interests from the same or different groups.")
    lines.append("Prefer more specific (deeper tier) classifications when confidence is high.")
    lines.append("")

    # Format each tier_2 group (limit to avoid token overload)
    count = 0
    for tier_2, entries in sorted(grouped.items())[:20]:  # Limit to 20 top-level categories
        lines.append(f"{tier_2} (Tier 2):")
        for entry in sorted(entries, key=lambda x: x['id'])[:8]:  # Limit per group
            lines.append(f"- {format_taxonomy_entry(entry)}")
            count += 1
            if count >= 100:
                break
        lines.append("")
        if count >= 100:
            lines.append("... (additional interest categories available)")
            break

    lines.append("Multiple interests are common. Select all that have strong signals.")
    lines.append("Always return the taxonomy_id (ID number) in your response.")

    return "\n".join(lines)


def get_purchase_taxonomy_context() -> str:
    """
    Get purchase intent taxonomy formatted for LLM prompt.

    Returns:
        Formatted string with relevant taxonomy categories
    """
    loader = get_taxonomy_loader()

    # Get purchase intent section (rows 707-1568)
    purchase_entries_raw = loader.taxonomy_by_section.get("purchase_intent", [])

    # FILTER OUT *Extension entries - they are placeholders, not real classifications
    purchase_entries = [
        entry for entry in purchase_entries_raw
        if not any(
            tier_val and "*Extension" in str(tier_val)
            for tier_num in range(1, 6)
            for tier_val in [entry.get(f"tier_{tier_num}", "")]
        )
    ]

    # Group by tier_2
    grouped: Dict[str, List[Dict]] = {}
    for entry in purchase_entries:
        tier_2 = entry.get("tier_2", "")
        if not tier_2:
            continue
        if tier_2 not in grouped:
            grouped[tier_2] = []
        grouped[tier_2].append(entry)

    # Build context
    lines = ["Purchase Intent Product Categories (IAB Audience Taxonomy 1.1):", ""]
    lines.append("NOTE: For each product category, you MUST also specify a purchase_intent_flag:")
    lines.append("- PIPR_HIGH: Recent purchase or strong intent (< 7 days)")
    lines.append("- PIPR_MEDIUM: Moderate intent (7-30 days)")
    lines.append("- PIPR_LOW: Weak intent (> 30 days)")
    lines.append("- ACTUAL_PURCHASE: Confirmed transaction (has receipt, order number, or tracking)")
    lines.append("")

    # Format each tier_2 group (limit to avoid token overload)
    count = 0
    for tier_2, entries in sorted(grouped.items())[:25]:  # Limit to 25 top-level categories
        lines.append(f"{tier_2} (Tier 2):")
        for entry in sorted(entries, key=lambda x: x['id'])[:6]:  # Limit per group
            lines.append(f"- {format_taxonomy_entry(entry)}")
            count += 1
            if count >= 100:
                break
        lines.append("")
        if count >= 100:
            lines.append("... (additional purchase categories available)")
            break

    lines.append("Identify the PRODUCT CATEGORY from the list above and assign the appropriate purchase_intent_flag.")
    lines.append("Always return the taxonomy_id (ID number) in your response.")

    return "\n".join(lines)


def get_taxonomy_context_for_analyzer(analyzer_type: str) -> str:
    """
    Get appropriate taxonomy context for an analyzer type.

    Args:
        analyzer_type: "demographics", "household", "interests", or "purchase"

    Returns:
        Formatted taxonomy context string

    Raises:
        ValueError: If analyzer_type is unknown

    Example:
        >>> context = get_taxonomy_context_for_analyzer("demographics")
    """
    context_map = {
        "demographics": get_demographics_taxonomy_context,
        "household": get_household_taxonomy_context,
        "interests": get_interests_taxonomy_context,
        "purchase": get_purchase_taxonomy_context,
    }

    if analyzer_type not in context_map:
        raise ValueError(
            f"Unknown analyzer type: {analyzer_type}. "
            f"Must be one of: {list(context_map.keys())}"
        )

    return context_map[analyzer_type]()


# Cache taxonomy contexts for performance
_CONTEXT_CACHE: Dict[str, str] = {}


def get_cached_taxonomy_context(analyzer_type: str) -> str:
    """
    Get taxonomy context with caching for performance.

    Args:
        analyzer_type: "demographics", "household", "interests", or "purchase"

    Returns:
        Cached or freshly generated taxonomy context

    Example:
        >>> context = get_cached_taxonomy_context("interests")
    """
    if analyzer_type not in _CONTEXT_CACHE:
        _CONTEXT_CACHE[analyzer_type] = get_taxonomy_context_for_analyzer(analyzer_type)
        logger.debug(f"Cached taxonomy context for {analyzer_type}")

    return _CONTEXT_CACHE[analyzer_type]


__all__ = [
    'get_demographics_taxonomy_context',
    'get_household_taxonomy_context',
    'get_interests_taxonomy_context',
    'get_purchase_taxonomy_context',
    'get_taxonomy_context_for_analyzer',
    'get_cached_taxonomy_context',
]
