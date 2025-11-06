"""
Tests for Phase 1 base MissionCard model and all card data types.

Tests follow TDD (RED-GREEN-REFACTOR) discipline:
1. Write failing test (RED)
2. Write minimal code to pass (GREEN)
3. Refactor if needed

Test coverage requirements:
- Model instantiation with valid data
- Model validation with invalid data
- Field type validation
- Required vs optional fields
- Field constraints (min/max, enums, etc.)
"""

import pytest
from datetime import datetime
from pydantic import ValidationError


class TestBaseMissionCard:
    """Tests for the base MissionCard model."""

    def test_mission_card_valid_instantiation(self):
        """Test creating a valid MissionCard instance."""
        from src.models.complete_schema import MissionCard

        card = MissionCard(
            mission_id="mission_abc123",
            user_id="user_123",
            thread_id="thread_456",
            card_type="shopping",
            category="savings",
            state="active",
            priority=5
        )

        assert card.mission_id == "mission_abc123"
        assert card.user_id == "user_123"
        assert card.thread_id == "thread_456"
        assert card.card_type == "shopping"
        assert card.category == "savings"
        assert card.state == "active"
        assert card.priority == 5
        assert isinstance(card.created_at, datetime)
        assert isinstance(card.updated_at, datetime)

    def test_mission_card_missing_required_fields(self):
        """Test that MissionCard requires all mandatory fields."""
        from src.models.complete_schema import MissionCard

        with pytest.raises(ValidationError) as exc_info:
            MissionCard(
                mission_id="mission_123"
                # Missing other required fields
            )

        errors = exc_info.value.errors()
        error_fields = {error['loc'][0] for error in errors}
        assert 'user_id' in error_fields
        assert 'card_type' in error_fields
        assert 'category' in error_fields

    def test_mission_card_invalid_card_type(self):
        """Test that card_type must be from valid enum."""
        from src.models.complete_schema import MissionCard

        with pytest.raises(ValidationError) as exc_info:
            MissionCard(
                mission_id="mission_123",
                user_id="user_123",
                thread_id="thread_456",
                card_type="invalid_type",  # Not in allowed enum
                category="savings",
                state="active"
            )

        errors = exc_info.value.errors()
        assert any('card_type' in str(error['loc']) for error in errors)

    def test_mission_card_invalid_category(self):
        """Test that category must be from valid enum."""
        from src.models.complete_schema import MissionCard

        with pytest.raises(ValidationError) as exc_info:
            MissionCard(
                mission_id="mission_123",
                user_id="user_123",
                thread_id="thread_456",
                card_type="shopping",
                category="invalid_category",  # Not in allowed enum
                state="active"
            )

        errors = exc_info.value.errors()
        assert any('category' in str(error['loc']) for error in errors)

    def test_mission_card_invalid_state(self):
        """Test that state must be from valid enum."""
        from src.models.complete_schema import MissionCard

        with pytest.raises(ValidationError) as exc_info:
            MissionCard(
                mission_id="mission_123",
                user_id="user_123",
                thread_id="thread_456",
                card_type="shopping",
                category="savings",
                state="invalid_state"  # Not in allowed enum
            )

        errors = exc_info.value.errors()
        assert any('state' in str(error['loc']) for error in errors)

    def test_mission_card_priority_constraints(self):
        """Test that priority must be between 1 and 10."""
        from src.models.complete_schema import MissionCard

        # Test priority too low
        with pytest.raises(ValidationError):
            MissionCard(
                mission_id="mission_123",
                user_id="user_123",
                thread_id="thread_456",
                card_type="shopping",
                category="savings",
                state="active",
                priority=0  # Too low
            )

        # Test priority too high
        with pytest.raises(ValidationError):
            MissionCard(
                mission_id="mission_123",
                user_id="user_123",
                thread_id="thread_456",
                card_type="shopping",
                category="savings",
                state="active",
                priority=11  # Too high
            )

        # Test valid priority
        card = MissionCard(
            mission_id="mission_123",
            user_id="user_123",
            thread_id="thread_456",
            card_type="shopping",
            category="savings",
            state="active",
            priority=5  # Valid
        )
        assert card.priority == 5

    def test_mission_card_optional_fields(self):
        """Test that optional fields can be omitted."""
        from src.models.complete_schema import MissionCard

        # Should work without optional fields
        card = MissionCard(
            mission_id="mission_123",
            user_id="user_123",
            card_type="shopping",
            category="savings"
            # thread_id, state, priority are optional
        )

        assert card.mission_id == "mission_123"
        assert card.thread_id is None or card.thread_id == ""
        # State should have a default value
        assert card.state in ["pending", "active", "snoozed", "completed", "dismissed"]

    def test_mission_card_serialization(self):
        """Test that MissionCard can be serialized to dict and JSON."""
        from src.models.complete_schema import MissionCard

        card = MissionCard(
            mission_id="mission_123",
            user_id="user_123",
            thread_id="thread_456",
            card_type="shopping",
            category="savings",
            state="active",
            priority=7
        )

        # Test dict serialization
        card_dict = card.model_dump()
        assert isinstance(card_dict, dict)
        assert card_dict['mission_id'] == "mission_123"

        # Test JSON serialization
        card_json = card.model_dump_json()
        assert isinstance(card_json, str)
        assert "mission_123" in card_json
