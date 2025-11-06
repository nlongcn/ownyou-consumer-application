#!/usr/bin/env python3
"""
Tests for Mission Store

Validates Store initialization and all namespace operations.
"""

import pytest
from datetime import datetime
from src.mission_agents.memory import MissionStore, StoreConfig


class TestMissionStoreInitialization:
    """Tests for Store initialization."""

    def test_default_initialization(self):
        """Test Store initializes with defaults."""
        store = MissionStore()

        assert store.config is not None
        assert store.config.storage_type == "inmemory"
        assert store.store is not None

    def test_custom_config_initialization(self):
        """Test Store initializes with custom config."""
        config = StoreConfig(
            storage_type="inmemory",
            enable_semantic_search=False
        )
        store = MissionStore(config=config)

        assert store.config == config
        assert store.store is not None

    def test_postgres_not_implemented(self):
        """Test that PostgreSQL raises NotImplementedError (Phase 1)."""
        config = StoreConfig(
            storage_type="postgres",
            postgres_connection_string="postgresql://localhost:5432/test"
        )

        with pytest.raises(NotImplementedError, match="Phase 7"):
            MissionStore(config=config)


class TestIABSystemOperations:
    """Tests for IAB System namespace operations."""

    def setup_method(self):
        """Setup test Store instance."""
        self.store = MissionStore()
        self.user_id = "test_user_123"
        self.taxonomy_id = 456

    def test_put_get_iab_classification(self):
        """Test storing and retrieving IAB classification."""
        classification = {
            "taxonomy_name": "Travel/Adventure Travel",
            "confidence": 0.87,
            "evidence_count": 2,
            "last_updated": datetime.now().isoformat()
        }

        # Store
        self.store.put_iab_classification(
            user_id=self.user_id,
            taxonomy_id=self.taxonomy_id,
            classification=classification
        )

        # Retrieve
        retrieved = self.store.get_iab_classification(
            user_id=self.user_id,
            taxonomy_id=self.taxonomy_id
        )

        assert retrieved is not None
        assert retrieved["taxonomy_name"] == "Travel/Adventure Travel"
        assert retrieved["confidence"] == 0.87

    def test_get_all_iab_classifications(self):
        """Test retrieving all classifications for a user."""
        # Store multiple classifications
        for i in range(3):
            self.store.put_iab_classification(
                user_id=self.user_id,
                taxonomy_id=100 + i,
                classification={
                    "taxonomy_name": f"Category {i}",
                    "confidence": 0.8 + (i * 0.05)
                }
            )

        # Retrieve all
        all_classifications = self.store.get_all_iab_classifications(
            user_id=self.user_id
        )

        assert len(all_classifications) == 3
        assert all(isinstance(c, dict) for c in all_classifications)

    def test_iab_evidence_operations(self):
        """Test storing and retrieving IAB evidence."""
        evidence = {
            "source": "email",
            "content": "Booking confirmation",
            "timestamp": datetime.now().isoformat(),
            "evidence_type": "purchase_confirmation"
        }

        # Store
        self.store.put_iab_evidence(
            user_id=self.user_id,
            taxonomy_id=self.taxonomy_id,
            evidence_id="evidence_1",
            evidence=evidence
        )

        # Retrieve
        all_evidence = self.store.get_iab_evidence(
            user_id=self.user_id,
            taxonomy_id=self.taxonomy_id
        )

        assert len(all_evidence) == 1
        assert all_evidence[0]["source"] == "email"


class TestUserProfileOperations:
    """Tests for User Profile namespace operations."""

    def setup_method(self):
        """Setup test Store instance."""
        self.store = MissionStore()
        self.user_id = "test_user_123"

    def test_put_get_user_profile(self):
        """Test storing and retrieving user profile."""
        profile = {
            "user_id": self.user_id,
            "display_name": "John Doe",
            "email": "john@example.com",
            "created_at": datetime.now().isoformat()
        }

        self.store.put_user_profile(self.user_id, profile)
        retrieved = self.store.get_user_profile(self.user_id)

        assert retrieved is not None
        assert retrieved["display_name"] == "John Doe"
        assert retrieved["email"] == "john@example.com"

    def test_put_get_demographics(self):
        """Test storing and retrieving demographics."""
        demographics = {
            "age_range": "25-34",
            "gender": "prefer_not_to_say",
            "location": {
                "city": "San Francisco",
                "state": "CA"
            }
        }

        self.store.put_demographics(self.user_id, demographics)
        retrieved = self.store.get_demographics(self.user_id)

        assert retrieved is not None
        assert retrieved["age_range"] == "25-34"
        assert retrieved["location"]["city"] == "San Francisco"

    def test_put_get_household(self):
        """Test storing and retrieving household information."""
        household = {
            "family_size": 4,
            "has_children": True,
            "children_ages": [8, 12],
            "pets": [{"type": "dog"}]
        }

        self.store.put_household(self.user_id, household)
        retrieved = self.store.get_household(self.user_id)

        assert retrieved is not None
        assert retrieved["family_size"] == 4
        assert retrieved["has_children"] is True
        assert len(retrieved["pets"]) == 1


class TestIkigaiOperations:
    """Tests for Ikigai namespace operations."""

    def setup_method(self):
        """Setup test Store instance."""
        self.store = MissionStore()
        self.user_id = "test_user_123"

    def test_put_get_ikigai_profile(self):
        """Test storing and retrieving Ikigai profile."""
        ikigai = {
            "life_purpose": "Help others through technology",
            "core_interests": ["technology", "adventure", "learning"],
            "values": ["authenticity", "growth"]
        }

        self.store.put_ikigai_profile(self.user_id, ikigai)
        retrieved = self.store.get_ikigai_profile(self.user_id)

        assert retrieved is not None
        assert retrieved["life_purpose"] == "Help others through technology"
        assert len(retrieved["core_interests"]) == 3

    def test_put_get_ikigai_interests(self):
        """Test storing and retrieving Ikigai interests by type."""
        travel_interests = {
            "destinations": ["Iceland", "New Zealand"],
            "travel_style": "adventure",
            "budget_level": "mid_range"
        }

        self.store.put_ikigai_interests(
            user_id=self.user_id,
            interest_type="travel",
            interests=travel_interests
        )

        retrieved = self.store.get_ikigai_interests(
            user_id=self.user_id,
            interest_type="travel"
        )

        assert retrieved is not None
        assert "Iceland" in retrieved["destinations"]
        assert retrieved["travel_style"] == "adventure"


class TestShoppingOperations:
    """Tests for Shopping & Financial namespace operations."""

    def setup_method(self):
        """Setup test Store instance."""
        self.store = MissionStore()
        self.user_id = "test_user_123"

    def test_put_get_shopping_list(self):
        """Test storing and retrieving shopping list."""
        shopping_list = {
            "items": [
                {
                    "product_name": "Trail running shoes",
                    "price_range": {"min": 100, "max": 200}
                }
            ]
        }

        self.store.put_shopping_list(self.user_id, shopping_list)
        retrieved = self.store.get_shopping_list(self.user_id)

        assert retrieved is not None
        assert len(retrieved["items"]) == 1
        assert retrieved["items"][0]["product_name"] == "Trail running shoes"

    def test_put_get_shopping_preferences(self):
        """Test storing and retrieving shopping preferences."""
        preferences = {
            "preferred_retailers": ["Amazon", "REI"],
            "price_sensitivity": "mid_range"
        }

        self.store.put_shopping_preferences(self.user_id, preferences)
        retrieved = self.store.get_shopping_preferences(self.user_id)

        assert retrieved is not None
        assert "Amazon" in retrieved["preferred_retailers"]

    def test_put_get_financial_profile(self):
        """Test storing and retrieving financial profile."""
        profile = {
            "income_range": "$100k-$150k",
            "spending_categories": {
                "housing": 2500,
                "food": 1200
            }
        }

        self.store.put_financial_profile(self.user_id, profile)
        retrieved = self.store.get_financial_profile(self.user_id)

        assert retrieved is not None
        assert retrieved["income_range"] == "$100k-$150k"
        assert retrieved["spending_categories"]["housing"] == 2500


class TestMissionStateOperations:
    """Tests for Mission State namespace operations."""

    def setup_method(self):
        """Setup test Store instance."""
        self.store = MissionStore()
        self.user_id = "test_user_123"
        self.mission_id = "mission_abc123"

    def test_put_get_mission_learnings(self):
        """Test storing and retrieving mission learnings."""
        learnings = {
            "total_missions_created": 1547,
            "completion_rate": 0.34,
            "success_patterns": [
                {"pattern": "Deals >20% off have higher completion"}
            ]
        }

        self.store.put_mission_learnings("shopping", learnings)
        retrieved = self.store.get_mission_learnings("shopping")

        assert retrieved is not None
        assert retrieved["total_missions_created"] == 1547
        assert retrieved["completion_rate"] == 0.34

    def test_put_get_completed_missions(self):
        """Test storing and retrieving completed missions."""
        missions = {
            "missions": [
                {
                    "mission_id": self.mission_id,
                    "card_type": "shopping",
                    "outcome": "purchased"
                }
            ]
        }

        self.store.put_completed_missions(self.user_id, missions)
        retrieved = self.store.get_completed_missions(self.user_id)

        assert retrieved is not None
        assert len(retrieved["missions"]) == 1
        assert retrieved["missions"][0]["mission_id"] == self.mission_id

    def test_put_get_mission_feedback(self):
        """Test storing and retrieving mission feedback."""
        feedback = {
            "mission_id": self.mission_id,
            "structured_feedback": {
                "relevance": 5,
                "timing": 4
            },
            "qualitative_feedback": "Great timing!"
        }

        self.store.put_mission_feedback(
            user_id=self.user_id,
            mission_id=self.mission_id,
            feedback=feedback
        )

        retrieved = self.store.get_mission_feedback(
            user_id=self.user_id,
            mission_id=self.mission_id
        )

        assert retrieved is not None
        assert retrieved["structured_feedback"]["relevance"] == 5
        assert "Great timing!" in retrieved["qualitative_feedback"]


class TestEpisodicMemoryOperations:
    """Tests for Episodic Memory namespace operations."""

    def setup_method(self):
        """Setup test Store instance."""
        self.store = MissionStore()
        self.user_id = "test_user_123"

    def test_put_get_email_events(self):
        """Test storing and retrieving email events."""
        events = {
            "events": [
                {
                    "event_id": "email_1",
                    "subject": "Travel booking confirmation",
                    "timestamp": datetime.now().isoformat()
                }
            ]
        }

        self.store.put_email_events(self.user_id, events)
        retrieved = self.store.get_email_events(self.user_id)

        assert retrieved is not None
        assert len(retrieved["events"]) == 1
        assert retrieved["events"][0]["subject"] == "Travel booking confirmation"

    def test_put_get_calendar_events(self):
        """Test storing and retrieving calendar events."""
        events = {
            "events": [
                {
                    "title": "Expedition planning",
                    "start_time": datetime.now().isoformat()
                }
            ]
        }

        self.store.put_calendar_events(self.user_id, events)
        retrieved = self.store.get_calendar_events(self.user_id)

        assert retrieved is not None
        assert retrieved["events"][0]["title"] == "Expedition planning"


class TestUtilityMethods:
    """Tests for utility methods."""

    def setup_method(self):
        """Setup test Store instance."""
        self.store = MissionStore()
        self.user_id = "test_user_123"

    def test_list_all_namespaces_for_user(self):
        """Test listing namespaces with data for a user."""
        # Store data in multiple namespaces
        self.store.put_user_profile(self.user_id, {"name": "John"})
        self.store.put_shopping_list(self.user_id, {"items": []})
        self.store.put_ikigai_profile(self.user_id, {"life_purpose": "test"})

        # List namespaces
        namespaces = self.store.list_all_namespaces_for_user(self.user_id)

        assert len(namespaces) >= 3
        assert "user_profile" in namespaces
        assert "shopping_list" in namespaces
        assert "ikigai_profile" in namespaces

    def test_delete_namespace(self):
        """Test deleting all items in a namespace."""
        # Store data
        self.store.put_iab_classification(
            user_id=self.user_id,
            taxonomy_id=123,
            classification={"test": "data"}
        )

        # Verify stored
        retrieved = self.store.get_iab_classification(
            user_id=self.user_id,
            taxonomy_id=123
        )
        assert retrieved is not None

        # Delete namespace
        namespace = (self.user_id, "iab_classifications")
        self.store.delete_namespace(namespace)

        # Verify deleted
        retrieved = self.store.get_iab_classification(
            user_id=self.user_id,
            taxonomy_id=123
        )
        assert retrieved is None


class TestPhase1Validation:
    """Validation tests for Phase 1 completeness."""

    def test_all_33_namespaces_defined(self):
        """Validate that all 33 namespaces are defined in config."""
        store = MissionStore()
        config = store.config

        # Get all memory types
        memory_types = config.list_all_memory_types()

        # Should have all 33 namespaces
        assert len(memory_types) == 33

        # Check specific key namespaces exist
        assert "iab_classifications" in memory_types
        assert "user_profile" in memory_types
        assert "ikigai_profile" in memory_types
        assert "shopping_list" in memory_types
        assert "mission_learnings" in memory_types
        assert "email_events" in memory_types

    def test_namespace_isolation(self):
        """Test that namespaces are isolated (different users)."""
        store = MissionStore()

        user1 = "user_1"
        user2 = "user_2"

        # Store data for user 1
        store.put_shopping_list(user1, {"items": ["item1"]})

        # Store data for user 2
        store.put_shopping_list(user2, {"items": ["item2"]})

        # Verify isolation
        user1_data = store.get_shopping_list(user1)
        user2_data = store.get_shopping_list(user2)

        assert user1_data["items"][0] == "item1"
        assert user2_data["items"][0] == "item2"
        assert user1_data != user2_data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
