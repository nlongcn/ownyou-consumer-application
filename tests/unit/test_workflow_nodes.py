#!/usr/bin/env python3
"""
Unit Tests for Workflow Nodes

Tests individual workflow nodes in isolation.
"""

import pytest
from datetime import datetime, timedelta
from langgraph.store.memory import InMemoryStore

from src.email_parser.memory.store import initialize_memory_store
from src.email_parser.memory.manager import MemoryManager
from src.email_parser.workflow.state import create_initial_state
from src.email_parser.workflow.nodes.load_emails import load_new_emails_node
from src.email_parser.workflow.nodes.retrieve_profile import (
    retrieve_existing_profile_node,
    get_profile_summary,
)


@pytest.fixture
def memory_store():
    """Create InMemoryStore for testing."""
    return initialize_memory_store(storage_type="inmemory", enable_embeddings=False)


@pytest.fixture
def memory_manager(memory_store):
    """Create MemoryManager for test user."""
    return MemoryManager(user_id="workflow_test_user", store=memory_store)


class TestLoadEmailsNode:
    """Test load_new_emails_node."""

    def test_load_emails_all_new(self, memory_manager):
        """Load emails when none are processed."""
        emails = [
            {"id": "email_1", "subject": "Test 1"},
            {"id": "email_2", "subject": "Test 2"},
            {"id": "email_3", "subject": "Test 3"}
        ]

        state = create_initial_state("workflow_test_user", emails)
        state = load_new_emails_node(state, memory_manager)

        assert len(state["emails"]) == 3
        assert state["total_emails"] == 3
        assert state["current_email_index"] == 0
        assert "workflow_started_at" in state

    def test_load_emails_some_processed(self, memory_manager):
        """Load emails when some are already processed."""
        # Mark some emails as processed
        memory_manager.mark_emails_as_processed(["email_1", "email_2"])

        emails = [
            {"id": "email_1", "subject": "Processed 1"},
            {"id": "email_2", "subject": "Processed 2"},
            {"id": "email_3", "subject": "New 1"},
            {"id": "email_4", "subject": "New 2"}
        ]

        state = create_initial_state("workflow_test_user", emails)
        state = load_new_emails_node(state, memory_manager)

        # Should only have 2 new emails
        assert len(state["emails"]) == 2
        assert state["total_emails"] == 2
        assert state["emails"][0]["id"] == "email_3"
        assert state["emails"][1]["id"] == "email_4"
        assert len(state["processed_email_ids"]) == 2

    def test_load_emails_all_processed(self, memory_manager):
        """Load emails when all are already processed."""
        memory_manager.mark_emails_as_processed(["email_1", "email_2"])

        emails = [
            {"id": "email_1", "subject": "Processed 1"},
            {"id": "email_2", "subject": "Processed 2"}
        ]

        state = create_initial_state("workflow_test_user", emails)
        state = load_new_emails_node(state, memory_manager)

        # No new emails
        assert len(state["emails"]) == 0
        assert state["total_emails"] == 0
        assert len(state["warnings"]) > 0
        assert "already processed" in state["warnings"][0].lower()

    def test_load_emails_empty_input(self, memory_manager):
        """Load emails with empty input."""
        state = create_initial_state("workflow_test_user", [])
        state = load_new_emails_node(state, memory_manager)

        assert len(state["emails"]) == 0
        assert state["total_emails"] == 0
        assert len(state["warnings"]) > 0


class TestRetrieveProfileNode:
    """Test retrieve_existing_profile_node."""

    def test_retrieve_empty_profile(self, memory_manager):
        """Retrieve profile when no memories exist."""
        state = create_initial_state("workflow_test_user", [])
        state = retrieve_existing_profile_node(state, memory_manager)

        assert "existing_profile" in state
        assert state["existing_profile"]["demographics"] == []
        assert state["existing_profile"]["interests"] == []
        assert state["existing_profile"]["household"] == []

    def test_retrieve_profile_with_memories(self, memory_manager):
        """Retrieve profile with existing memories."""
        # Store some memories
        memory_manager.store_semantic_memory(
            "semantic_demographics_5_25_29",
            {
                "taxonomy_id": 5,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "value": "25-29",
                "confidence": 0.85,
                "evidence_count": 3,
                "supporting_evidence": ["email_1", "email_2"],
                "contradicting_evidence": [],
                "first_observed": "2025-09-01T10:00:00Z",
                "last_validated": "2025-09-30T10:00:00Z",
                "last_updated": "2025-09-30T10:00:00Z",
                "days_since_validation": 0,
                "data_source": "email",
                "source_ids": ["email_1", "email_2"],
                "section": "demographics"
            }
        )

        memory_manager.store_semantic_memory(
            "semantic_interests_342_cryptocurrency",
            {
                "taxonomy_id": 342,
                "category_path": "Interest | Technology | Cryptocurrency",
                "tier_1": "Interest",
                "tier_2": "Technology",
                "tier_3": "Cryptocurrency",
                "value": "Cryptocurrency",
                "confidence": 0.90,
                "evidence_count": 5,
                "supporting_evidence": ["email_3", "email_4"],
                "contradicting_evidence": [],
                "first_observed": "2025-09-01T10:00:00Z",
                "last_validated": "2025-09-30T10:00:00Z",
                "last_updated": "2025-09-30T10:00:00Z",
                "days_since_validation": 0,
                "data_source": "email",
                "source_ids": ["email_3", "email_4"],
                "section": "interests"
            }
        )

        state = create_initial_state("workflow_test_user", [])
        state = retrieve_existing_profile_node(state, memory_manager)

        # Check profile structure
        assert len(state["existing_profile"]["demographics"]) == 1
        assert len(state["existing_profile"]["interests"]) == 1

        # Check demographics
        demo = state["existing_profile"]["demographics"][0]
        assert demo["taxonomy_id"] == 5
        assert demo["value"] == "25-29"

        # Check interests
        interest = state["existing_profile"]["interests"][0]
        assert interest["taxonomy_id"] == 342
        assert interest["value"] == "Cryptocurrency"

    def test_retrieve_profile_applies_temporal_decay(self, memory_manager):
        """Retrieve profile applies temporal decay to old memories."""
        # Store memory with old validation date
        one_month_ago = (datetime.utcnow() - timedelta(days=30)).isoformat() + "Z"

        memory_manager.store_semantic_memory(
            "semantic_demographics_5_25_29",
            {
                "taxonomy_id": 5,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "value": "25-29",
                "confidence": 0.80,
                "evidence_count": 2,
                "supporting_evidence": ["email_1"],
                "contradicting_evidence": [],
                "first_observed": one_month_ago,
                "last_validated": one_month_ago,
                "last_updated": one_month_ago,
                "days_since_validation": 0,  # Will be recalculated
                "data_source": "email",
                "source_ids": ["email_1"],
                "section": "demographics"
            }
        )

        state = create_initial_state("workflow_test_user", [])
        state = retrieve_existing_profile_node(state, memory_manager)

        # Confidence should be decayed
        demo = state["existing_profile"]["demographics"][0]
        assert demo["confidence"] < 0.80  # Decayed from original
        assert demo["days_since_validation"] >= 30

    def test_get_profile_summary_empty(self):
        """Get summary of empty profile."""
        state = create_initial_state("workflow_test_user", [])
        state["existing_profile"] = {
            "demographics": [],
            "household": [],
            "interests": [],
            "purchase_intent": [],
            "actual_purchases": []
        }

        summary = get_profile_summary(state)

        assert summary["total_count"] == 0
        assert summary["average_confidence"] == 0.0
        assert summary["high_confidence_count"] == 0

    def test_get_profile_summary_with_data(self):
        """Get summary of populated profile."""
        state = create_initial_state("workflow_test_user", [])
        state["existing_profile"] = {
            "demographics": [
                {
                    "confidence": 0.85,
                    "days_since_validation": 5
                },
                {
                    "confidence": 0.92,
                    "days_since_validation": 2
                }
            ],
            "interests": [
                {
                    "confidence": 0.70,
                    "days_since_validation": 40
                }
            ],
            "household": [],
            "purchase_intent": [],
            "actual_purchases": []
        }

        summary = get_profile_summary(state)

        assert summary["total_count"] == 3
        assert summary["average_confidence"] == pytest.approx(0.823, abs=0.01)
        assert summary["high_confidence_count"] == 2  # 0.85 and 0.92
        assert summary["stale_count"] == 1  # 40 days
        assert summary["sections"]["demographics"] == 2
        assert summary["sections"]["interests"] == 1


class TestNodeErrorHandling:
    """Test error handling in nodes."""

    def test_load_emails_handles_missing_email_ids(self, memory_manager):
        """Load emails handles emails without IDs gracefully."""
        emails = [
            {"subject": "No ID"},
            {"id": "email_2", "subject": "Has ID"}
        ]

        state = create_initial_state("workflow_test_user", emails)
        state = load_new_emails_node(state, memory_manager)

        # Should still process (first email won't match any processed IDs)
        assert len(state["emails"]) == 2