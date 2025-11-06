"""
Agent module for IAB Taxonomy Classification.

Provides ReAct agents and tools for taxonomy-based email analysis.
"""

from .tools import (
    search_demographics_taxonomy,
    search_household_taxonomy,
    search_interests_taxonomy,
    search_purchase_taxonomy,
    validate_classification,
    get_tier_details,
)

from .demographics_agent import (
    extract_demographics_with_agent,
    DEMOGRAPHICS_AGENT_SYSTEM_PROMPT,
    DEMOGRAPHICS_AGENT_USER_PROMPT,
)

from .household_agent import (
    extract_household_with_agent,
    HOUSEHOLD_AGENT_SYSTEM_PROMPT,
    HOUSEHOLD_AGENT_USER_PROMPT,
)

from .interests_agent import (
    extract_interests_with_agent,
    INTERESTS_AGENT_SYSTEM_PROMPT,
    INTERESTS_AGENT_USER_PROMPT,
)

from .purchase_agent import (
    extract_purchase_with_agent,
    PURCHASE_AGENT_SYSTEM_PROMPT,
    PURCHASE_AGENT_USER_PROMPT,
)

__all__ = [
    # Tools
    'search_demographics_taxonomy',
    'search_household_taxonomy',
    'search_interests_taxonomy',
    'search_purchase_taxonomy',
    'validate_classification',
    'get_tier_details',
    # Demographics Agent
    'extract_demographics_with_agent',
    'DEMOGRAPHICS_AGENT_SYSTEM_PROMPT',
    'DEMOGRAPHICS_AGENT_USER_PROMPT',
    # Household Agent
    'extract_household_with_agent',
    'HOUSEHOLD_AGENT_SYSTEM_PROMPT',
    'HOUSEHOLD_AGENT_USER_PROMPT',
    # Interests Agent
    'extract_interests_with_agent',
    'INTERESTS_AGENT_SYSTEM_PROMPT',
    'INTERESTS_AGENT_USER_PROMPT',
    # Purchase Agent
    'extract_purchase_with_agent',
    'PURCHASE_AGENT_SYSTEM_PROMPT',
    'PURCHASE_AGENT_USER_PROMPT',
]
