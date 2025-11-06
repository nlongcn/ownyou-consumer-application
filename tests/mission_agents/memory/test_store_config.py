#!/usr/bin/env python3
"""
Tests for Store Configuration

Validates namespace patterns, formatting, and configuration logic.
"""

import pytest
from src.mission_agents.memory.config import (
    StoreConfig,
    TOTAL_NAMESPACES,
    NAMESPACE_CATEGORIES,
    get_category_for_memory_type
)


class TestStoreConfig:
    """Tests for StoreConfig class."""

    def test_default_config(self):
        """Test default configuration values."""
        config = StoreConfig()

        assert config.storage_type == "inmemory"
        assert config.enable_semantic_search is False
        assert config.embed_model == "openai:text-embedding-3-small"
        assert config.embed_dims == 1536
        assert config.max_search_results == 100

    def test_all_namespaces_defined(self):
        """Test that all 33 namespaces are defined."""
        config = StoreConfig()
        memory_types = config.list_all_memory_types()

        assert len(memory_types) == TOTAL_NAMESPACES
        assert len(memory_types) == 33

    def test_namespace_categories(self):
        """Test namespace categorization."""
        # Count all namespaces in categories
        total_in_categories = sum(
            len(types) for types in NAMESPACE_CATEGORIES.values()
        )

        assert total_in_categories == TOTAL_NAMESPACES

        # Check specific categories
        assert "iab_classifications" in NAMESPACE_CATEGORIES["iab_system"]
        assert "ikigai_profile" in NAMESPACE_CATEGORIES["ikigai"]
        assert "shopping_list" in NAMESPACE_CATEGORIES["shopping_financial"]

    def test_get_namespace_pattern(self):
        """Test retrieving namespace patterns."""
        config = StoreConfig()

        # Valid namespace
        pattern = config.get_namespace_pattern("iab_classifications")
        assert pattern == "({user_id}, iab_classifications)"

        # Invalid namespace
        pattern = config.get_namespace_pattern("nonexistent")
        assert pattern is None

    def test_format_namespace_simple(self):
        """Test formatting simple namespaces (single partition key)."""
        config = StoreConfig()

        namespace = config.format_namespace("iab_classifications", user_id="user_123")
        assert namespace == ("user_123", "iab_classifications")

        namespace = config.format_namespace("shopping_list", user_id="user_456")
        assert namespace == ("user_456", "shopping_list")

    def test_format_namespace_complex(self):
        """Test formatting complex namespaces (multiple partition keys)."""
        config = StoreConfig()

        # Two keys
        namespace = config.format_namespace(
            "iab_evidence",
            user_id="user_123",
            taxonomy_id="456"
        )
        assert namespace == ("user_123", "iab_evidence", "456")

        # Three keys
        namespace = config.format_namespace(
            "mission_feedback",
            user_id="user_123",
            mission_id="mission_789"
        )
        assert namespace == ("user_123", "mission_feedback", "mission_789")

    def test_format_namespace_missing_key(self):
        """Test error when required key missing."""
        config = StoreConfig()

        with pytest.raises(ValueError, match="Missing required key"):
            config.format_namespace("iab_classifications")  # Missing user_id

        with pytest.raises(ValueError, match="Missing required key"):
            config.format_namespace(
                "iab_evidence",
                user_id="user_123"
                # Missing taxonomy_id
            )

    def test_format_namespace_invalid_type(self):
        """Test error when memory type doesn't exist."""
        config = StoreConfig()

        namespace = config.format_namespace("nonexistent_type", user_id="user_123")
        assert namespace is None

    def test_validate_namespace_keys(self):
        """Test namespace key validation."""
        config = StoreConfig()

        # Valid - all keys present
        assert config.validate_namespace_keys(
            "iab_classifications",
            user_id="user_123"
        ) is True

        # Invalid - missing required key
        assert config.validate_namespace_keys("iab_classifications") is False

        # Valid - complex namespace with all keys
        assert config.validate_namespace_keys(
            "iab_evidence",
            user_id="user_123",
            taxonomy_id="456"
        ) is True

        # Invalid - complex namespace missing key
        assert config.validate_namespace_keys(
            "iab_evidence",
            user_id="user_123"
        ) is False

    def test_list_all_memory_types(self):
        """Test listing all memory types."""
        config = StoreConfig()
        memory_types = config.list_all_memory_types()

        # Check count
        assert len(memory_types) == 33

        # Check specific types exist
        expected_types = [
            "iab_classifications",
            "iab_evidence",
            "user_profile",
            "demographics",
            "household",
            "ikigai_profile",
            "ikigai_interests",
            "shopping_list",
            "shopping_preferences",
            "shopping_history",
            "financial_profile",
            "utility_bills",
            "subscriptions",
            "travel_preferences",
            "past_trips",
            "dining_preferences",
            "restaurant_history",
            "event_preferences",
            "attended_events",
            "content_preferences",
            "health_profile",
            "fitness_goals",
            "mission_learnings",
            "completed_missions",
            "mission_feedback",
            "email_events",
            "calendar_events",
            "financial_transactions",
            "location_history",
            "browsing_history",
            "photo_events",
            "social_events",
            "health_events",
        ]

        for memory_type in expected_types:
            assert memory_type in memory_types

    def test_get_category_for_memory_type(self):
        """Test getting category for memory types."""
        assert get_category_for_memory_type("iab_classifications") == "iab_system"
        assert get_category_for_memory_type("ikigai_profile") == "ikigai"
        assert get_category_for_memory_type("shopping_list") == "shopping_financial"
        assert get_category_for_memory_type("email_events") == "episodic_memory"
        assert get_category_for_memory_type("nonexistent") is None

    def test_custom_config(self):
        """Test custom configuration."""
        config = StoreConfig(
            storage_type="postgres",
            postgres_connection_string="postgresql://localhost:5432/db",
            enable_semantic_search=True,
            embed_model="custom:model",
            embed_dims=768,
            max_search_results=50
        )

        assert config.storage_type == "postgres"
        assert config.postgres_connection_string == "postgresql://localhost:5432/db"
        assert config.enable_semantic_search is True
        assert config.embed_model == "custom:model"
        assert config.embed_dims == 768
        assert config.max_search_results == 50


class TestNamespaceCoverage:
    """Tests to ensure complete namespace coverage."""

    def test_all_categories_covered(self):
        """Test that all major system areas have namespaces."""
        config = StoreConfig()
        categories = list(NAMESPACE_CATEGORIES.keys())

        # Check all expected categories exist
        expected_categories = [
            "iab_system",
            "user_profile",
            "ikigai",
            "shopping_financial",
            "travel_dining",
            "events_content",
            "health",
            "mission_state",
            "episodic_memory"
        ]

        for category in expected_categories:
            assert category in categories, f"Missing category: {category}"

    def test_episodic_memory_complete(self):
        """Test that all 8 data sources have episodic namespaces."""
        episodic_types = NAMESPACE_CATEGORIES["episodic_memory"]

        expected_sources = [
            "email_events",
            "calendar_events",
            "financial_transactions",
            "location_history",
            "browsing_history",
            "photo_events",
            "social_events",
            "health_events"
        ]

        assert len(episodic_types) == 8

        for source in expected_sources:
            assert source in episodic_types, f"Missing episodic namespace: {source}"

    def test_mission_types_covered(self):
        """Test that major mission types have preference namespaces."""
        config = StoreConfig()
        memory_types = config.list_all_memory_types()

        # Shopping missions
        assert "shopping_list" in memory_types
        assert "shopping_preferences" in memory_types
        assert "shopping_history" in memory_types

        # Travel missions
        assert "travel_preferences" in memory_types
        assert "past_trips" in memory_types

        # Dining missions
        assert "dining_preferences" in memory_types
        assert "restaurant_history" in memory_types

        # Event missions
        assert "event_preferences" in memory_types
        assert "attended_events" in memory_types

        # Health missions
        assert "health_profile" in memory_types
        assert "fitness_goals" in memory_types


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
