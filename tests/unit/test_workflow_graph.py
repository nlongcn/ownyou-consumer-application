#!/usr/bin/env python3
"""
Unit Tests for Workflow Graph Construction

Tests graph building, node registration, and edge configuration.
"""

import pytest
from langgraph.store.memory import InMemoryStore

from src.email_parser.workflow.graph import build_workflow_graph, get_graph_node_names
from src.email_parser.workflow.state import create_initial_state
from src.email_parser.memory.manager import MemoryManager


@pytest.fixture
def memory_store():
    """Create InMemoryStore for testing."""
    return InMemoryStore()


@pytest.fixture
def memory_manager(memory_store):
    """Create MemoryManager with in-memory store."""
    return MemoryManager(user_id="graph_test_user", store=memory_store)


class TestGraphConstruction:
    """Test StateGraph construction and compilation."""

    def test_build_graph_succeeds(self, memory_manager):
        """Graph builds without errors."""
        graph = build_workflow_graph(memory_manager)
        assert graph is not None

    def test_graph_has_expected_nodes(self, memory_manager):
        """Graph contains all expected nodes."""
        graph = build_workflow_graph(memory_manager)
        node_names = get_graph_node_names(graph)

        expected_nodes = {
            "load_emails",
            "retrieve_profile",
            "demographics_analyzer",
            "household_analyzer",
            "interests_analyzer",
            "purchase_analyzer",
            "reconcile",
            "update_memory"
        }

        assert set(node_names) == expected_nodes


class TestGraphExecution:
    """Test graph execution with simple inputs."""

    def test_graph_invoke_with_no_emails(self, memory_manager):
        """Graph handles empty email list gracefully."""
        graph = build_workflow_graph(memory_manager)

        initial_state = create_initial_state("user_123", [])

        result = graph.invoke(initial_state)

        # Should complete without errors
        assert result["user_id"] == "user_123"
        assert result["total_emails"] == 0
        assert len(result.get("errors", [])) == 0

    def test_graph_invoke_with_single_email(self, memory_manager):
        """Graph processes single email through workflow."""
        graph = build_workflow_graph(memory_manager)

        emails = [{
            "id": "email_1",
            "subject": "Order Confirmation",
            "body": "Your order has been confirmed",
            "date": "2025-01-15"
        }]

        initial_state = create_initial_state("user_123", emails)

        result = graph.invoke(initial_state)

        # Should process email
        assert result["user_id"] == "user_123"
        assert result["total_emails"] == 1
        assert result.get("updated_profile") is not None
        assert result.get("workflow_completed_at") is not None

    def test_graph_invoke_with_multiple_emails(self, memory_manager):
        """Graph processes multiple emails sequentially."""
        graph = build_workflow_graph(memory_manager)

        emails = [
            {
                "id": "email_1",
                "subject": "Newsletter",
                "body": "Crypto news",
                "date": "2025-01-15"
            },
            {
                "id": "email_2",
                "subject": "Order Confirmation",
                "body": "Your order has shipped",
                "date": "2025-01-16"
            }
        ]

        initial_state = create_initial_state("user_123", emails)

        result = graph.invoke(initial_state)

        # Should process all emails
        assert result["user_id"] == "user_123"
        assert result["total_emails"] == 2
        # After processing, should have advanced past all emails
        assert result["current_email_index"] == 2


class TestGraphIntegration:
    """Test graph integration with memory system."""

    def test_graph_stores_episodic_memory(self, memory_manager):
        """Graph stores episodic memory for processed email."""
        graph = build_workflow_graph(memory_manager)

        emails = [{
            "id": "test_email_123",
            "subject": "Test Email",
            "body": "Test content",
            "date": "2025-01-15"
        }]

        initial_state = create_initial_state("user_123", emails)

        graph.invoke(initial_state)

        # Check episodic memory was stored
        episode_id = f"user_123:episodic:test_email_123"
        memories = memory_manager.get_all_episodic_memories()

        assert len(memories) > 0
        # Should have stored memory for the email
        email_memories = [m for m in memories if m.get("email_id") == "test_email_123"]
        assert len(email_memories) > 0

    def test_graph_marks_email_as_processed(self, memory_manager):
        """Graph marks email as processed in memory."""
        graph = build_workflow_graph(memory_manager)

        emails = [{
            "id": "processed_email_456",
            "subject": "Test",
            "body": "Test",
            "date": "2025-01-15"
        }]

        initial_state = create_initial_state("user_123", emails)

        graph.invoke(initial_state)

        # Check email marked as processed
        processed_ids = memory_manager.get_processed_email_ids()
        assert "processed_email_456" in processed_ids

    def test_graph_filters_already_processed_emails(self, memory_manager):
        """Graph skips emails that were already processed."""
        # Pre-mark an email as processed
        memory_manager.mark_email_as_processed("already_processed")

        graph = build_workflow_graph(memory_manager)

        emails = [
            {
                "id": "already_processed",
                "subject": "Old Email",
                "body": "Already seen",
                "date": "2025-01-14"
            },
            {
                "id": "new_email",
                "subject": "New Email",
                "body": "Fresh content",
                "date": "2025-01-15"
            }
        ]

        initial_state = create_initial_state("user_123", emails)

        result = graph.invoke(initial_state)

        # Should only process 1 new email
        assert result["total_emails"] == 1
        assert result["current_email_index"] == 1