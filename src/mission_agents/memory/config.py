#!/usr/bin/env python3
"""
Store Configuration

Configuration for LangGraph Store namespaces and settings.
"""

from typing import Dict, Optional
from pydantic import BaseModel, Field


class StoreConfig(BaseModel):
    """
    Configuration for Mission Agent Store.

    Defines all namespace patterns and Store settings for the OwnYou system.
    """

    # Storage backend configuration
    storage_type: str = Field(
        default="inmemory",
        description="Storage backend: 'inmemory' or 'postgres'"
    )

    postgres_connection_string: Optional[str] = Field(
        default=None,
        description="PostgreSQL connection string (if storage_type='postgres')"
    )

    # Semantic search configuration
    enable_semantic_search: bool = Field(
        default=False,
        description="Enable semantic search with embeddings"
    )

    embed_model: str = Field(
        default="openai:text-embedding-3-small",
        description="Embedding model for semantic search"
    )

    embed_dims: int = Field(
        default=1536,
        description="Embedding dimensions"
    )

    # Query configuration
    max_search_results: int = Field(
        default=100,
        description="Maximum number of search results"
    )

    # Complete namespace definitions
    # Following pattern: ({user_id}, {memory_type}, {optional_keys}...)
    # Compatible with email_parser's 2-tuple pattern: (user_id, collection_name)
    # NOTE: LangGraph Store does NOT allow periods in namespace labels
    namespace_patterns: Dict[str, str] = Field(
        default_factory=lambda: {
            # ==================================================================
            # IAB SYSTEM NAMESPACES
            # ==================================================================
            "iab_classifications": "({user_id}, iab_classifications)",
            "iab_evidence": "({user_id}, iab_evidence, {taxonomy_id})",

            # ==================================================================
            # USER PROFILE NAMESPACES
            # ==================================================================
            "user_profile": "({user_id}, user_profile)",
            "demographics": "({user_id}, demographics)",
            "household": "({user_id}, household)",

            # ==================================================================
            # IKIGAI NAMESPACES
            # ==================================================================
            "ikigai_profile": "({user_id}, ikigai_profile)",
            "ikigai_interests": "({user_id}, ikigai_interests, {interest_type})",

            # ==================================================================
            # SHOPPING & FINANCIAL NAMESPACES
            # ==================================================================
            "shopping_list": "({user_id}, shopping_list)",
            "shopping_preferences": "({user_id}, shopping_preferences)",
            "shopping_history": "({user_id}, shopping_history)",
            "financial_profile": "({user_id}, financial_profile)",
            "utility_bills": "({user_id}, utility_bills)",
            "subscriptions": "({user_id}, subscriptions)",

            # ==================================================================
            # TRAVEL & DINING NAMESPACES
            # ==================================================================
            "travel_preferences": "({user_id}, travel_preferences)",
            "past_trips": "({user_id}, past_trips)",
            "dining_preferences": "({user_id}, dining_preferences)",
            "restaurant_history": "({user_id}, restaurant_history)",

            # ==================================================================
            # EVENTS & CONTENT NAMESPACES
            # ==================================================================
            "event_preferences": "({user_id}, event_preferences)",
            "attended_events": "({user_id}, attended_events)",
            "content_preferences": "({user_id}, content_preferences)",

            # ==================================================================
            # HEALTH NAMESPACES
            # ==================================================================
            "health_profile": "({user_id}, health_profile)",
            "fitness_goals": "({user_id}, fitness_goals)",

            # ==================================================================
            # MISSION STATE NAMESPACES
            # ==================================================================
            "mission_learnings": "({mission_type}, mission_learnings)",
            "completed_missions": "({user_id}, completed_missions)",
            "mission_feedback": "({user_id}, mission_feedback, {mission_id})",

            # ==================================================================
            # EPISODIC MEMORY NAMESPACES
            # ==================================================================
            "email_events": "({user_id}, email_events)",
            "calendar_events": "({user_id}, calendar_events)",
            "financial_transactions": "({user_id}, financial_transactions)",
            "location_history": "({user_id}, location_history)",
            "browsing_history": "({user_id}, browsing_history)",
            "photo_events": "({user_id}, photo_events)",
            "social_events": "({user_id}, social_events)",
            "health_events": "({user_id}, health_events)",
        },
        description="Complete namespace patterns for all OwnYou memory types"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "storage_type": "inmemory",
                "enable_semantic_search": False
            }
        }
    }

    def get_namespace_pattern(self, memory_type: str) -> Optional[str]:
        """
        Get namespace pattern for a memory type.

        Args:
            memory_type: Type of memory (e.g., "iab_classifications")

        Returns:
            Namespace pattern string or None if not found

        Example:
            >>> config = StoreConfig()
            >>> config.get_namespace_pattern("iab_classifications")
            "({user_id}, iab_classifications)"
        """
        return self.namespace_patterns.get(memory_type)

    def format_namespace(self, memory_type: str, **kwargs) -> Optional[tuple]:
        """
        Format namespace pattern with provided keys.

        Args:
            memory_type: Type of memory
            **kwargs: Keys to format into namespace pattern

        Returns:
            Formatted namespace tuple or None if memory_type not found

        Example:
            >>> config = StoreConfig()
            >>> config.format_namespace("iab_classifications", user_id="user_123")
            ("user_123", "iab_classifications")
        """
        pattern = self.get_namespace_pattern(memory_type)
        if not pattern:
            return None

        try:
            # Parse pattern: "(ownyou.type, {key1}, {key2})"
            # Remove parentheses and split by comma
            parts = pattern.strip("()").split(", ")

            # Format each part with kwargs
            formatted_parts = []
            for part in parts:
                if "{" in part and "}" in part:
                    # Extract key name
                    key_name = part.strip("{}").strip()
                    if key_name in kwargs:
                        formatted_parts.append(kwargs[key_name])
                    else:
                        raise ValueError(f"Missing required key: {key_name}")
                else:
                    # Static part (namespace)
                    formatted_parts.append(part)

            return tuple(formatted_parts)

        except Exception as e:
            raise ValueError(f"Failed to format namespace '{memory_type}': {e}")

    def list_all_memory_types(self) -> list[str]:
        """
        List all defined memory types.

        Returns:
            List of memory type names

        Example:
            >>> config = StoreConfig()
            >>> memory_types = config.list_all_memory_types()
            >>> "iab_classifications" in memory_types
            True
        """
        return list(self.namespace_patterns.keys())

    def validate_namespace_keys(self, memory_type: str, **kwargs) -> bool:
        """
        Validate that all required keys are provided for a namespace.

        Args:
            memory_type: Type of memory
            **kwargs: Keys to validate

        Returns:
            True if all required keys present, False otherwise

        Example:
            >>> config = StoreConfig()
            >>> config.validate_namespace_keys("iab_classifications", user_id="user_123")
            True
            >>> config.validate_namespace_keys("iab_classifications")
            False
        """
        pattern = self.get_namespace_pattern(memory_type)
        if not pattern:
            return False

        # Extract required keys from pattern
        required_keys = []
        parts = pattern.strip("()").split(", ")
        for part in parts:
            if "{" in part and "}" in part:
                key_name = part.strip("{}").strip()
                required_keys.append(key_name)

        # Check if all required keys provided
        return all(key in kwargs for key in required_keys)


# ==============================================================================
# NAMESPACE CONSTANTS
# ==============================================================================

# Total number of defined namespaces
TOTAL_NAMESPACES = 33

# Namespace categories for organization
NAMESPACE_CATEGORIES = {
    "iab_system": [
        "iab_classifications",
        "iab_evidence"
    ],
    "user_profile": [
        "user_profile",
        "demographics",
        "household"
    ],
    "ikigai": [
        "ikigai_profile",
        "ikigai_interests"
    ],
    "shopping_financial": [
        "shopping_list",
        "shopping_preferences",
        "shopping_history",
        "financial_profile",
        "utility_bills",
        "subscriptions"
    ],
    "travel_dining": [
        "travel_preferences",
        "past_trips",
        "dining_preferences",
        "restaurant_history"
    ],
    "events_content": [
        "event_preferences",
        "attended_events",
        "content_preferences"
    ],
    "health": [
        "health_profile",
        "fitness_goals"
    ],
    "mission_state": [
        "mission_learnings",
        "completed_missions",
        "mission_feedback"
    ],
    "episodic_memory": [
        "email_events",
        "calendar_events",
        "financial_transactions",
        "location_history",
        "browsing_history",
        "photo_events",
        "social_events",
        "health_events"
    ]
}


def get_category_for_memory_type(memory_type: str) -> Optional[str]:
    """
    Get category for a memory type.

    Args:
        memory_type: Memory type name

    Returns:
        Category name or None if not found

    Example:
        >>> get_category_for_memory_type("iab_classifications")
        'iab_system'
    """
    for category, types in NAMESPACE_CATEGORIES.items():
        if memory_type in types:
            return category
    return None
