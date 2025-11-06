#!/usr/bin/env python3
"""
Unit Tests for Workflow Executor

Tests the main workflow execution entry point.
"""

import pytest
from langgraph.store.memory import InMemoryStore

from src.email_parser.workflow import (
    run_workflow,
    get_workflow_summary,
    print_workflow_summary
)
from src.email_parser.memory.manager import MemoryManager


@pytest.fixture
def memory_store():
    """Create InMemoryStore for testing."""
    return InMemoryStore()


@pytest.fixture
def memory_manager(memory_store):
    """Create MemoryManager with in-memory store."""
    return MemoryManager(user_id="executor_test_user", store=memory_store)


class TestRunWorkflow:
    """Test main workflow execution function."""

    def test_run_workflow_with_empty_emails(self, memory_manager):
        """Execute workflow with no emails."""
        result = run_workflow(
            user_id="user_123",
            emails=[],
            memory_manager=memory_manager
        )

        assert result["user_id"] == "user_123"
        assert result["total_emails"] == 0
        # When no emails, workflow ends immediately without completing full cycle
        # This is expected behavior - no emails to process means no completion timestamp

    def test_run_workflow_with_single_email(self, memory_manager):
        """Execute workflow with one email."""
        emails = [{
            "id": "email_1",
            "subject": "Test",
            "body": "Test content",
            "date": "2025-01-15"
        }]

        result = run_workflow(
            user_id="user_123",
            emails=emails,
            memory_manager=memory_manager
        )

        assert result["user_id"] == "user_123"
        assert result["total_emails"] == 1
        assert result["current_email_index"] == 1  # Processed 1 email
        assert result.get("updated_profile") is not None

    def test_run_workflow_with_multiple_emails(self, memory_manager):
        """Execute workflow with multiple emails."""
        emails = [
            {
                "id": f"email_{i}",
                "subject": f"Test {i}",
                "body": "Content",
                "date": "2025-01-15"
            }
            for i in range(5)
        ]

        result = run_workflow(
            user_id="user_123",
            emails=emails,
            memory_manager=memory_manager
        )

        assert result["total_emails"] == 5
        assert result["current_email_index"] == 5  # Processed all

    def test_run_workflow_with_custom_config(self, memory_manager):
        """Execute workflow with custom recursion limit."""
        emails = [{
            "id": "email_1",
            "subject": "Test",
            "body": "Test",
            "date": "2025-01-15"
        }]

        config = {"recursion_limit": 100}

        result = run_workflow(
            user_id="user_123",
            emails=emails,
            memory_manager=memory_manager,
            config=config
        )

        assert result["user_id"] == "user_123"
        assert result["current_email_index"] == 1

    def test_run_workflow_stores_memories(self, memory_manager):
        """Workflow stores episodic memories."""
        emails = [{
            "id": "test_memory_email",
            "subject": "Test",
            "body": "Test",
            "date": "2025-01-15"
        }]

        run_workflow(
            user_id="user_123",
            emails=emails,
            memory_manager=memory_manager
        )

        # Check memory was stored
        memories = memory_manager.get_all_episodic_memories()
        assert len(memories) > 0

        # Check email marked as processed
        processed = memory_manager.get_processed_email_ids()
        assert "test_memory_email" in processed


class TestWorkflowSummary:
    """Test workflow summary functions."""

    def test_get_workflow_summary(self, memory_manager):
        """Generate summary from workflow result."""
        emails = [
            {"id": "e1", "subject": "Test", "body": "Test", "date": "2025-01-15"},
            {"id": "e2", "subject": "Test", "body": "Test", "date": "2025-01-15"}
        ]

        result = run_workflow(
            user_id="user_123",
            emails=emails,
            memory_manager=memory_manager
        )

        summary = get_workflow_summary(result)

        assert summary["user_id"] == "user_123"
        assert summary["emails_processed"] == 2
        assert summary["total_emails"] == 2
        assert summary["errors_count"] == 0
        assert "profile_sections" in summary
        assert "demographics" in summary["profile_sections"]

    def test_print_workflow_summary(self, memory_manager, capsys):
        """Print formatted summary."""
        emails = [{
            "id": "e1",
            "subject": "Test",
            "body": "Test",
            "date": "2025-01-15"
        }]

        result = run_workflow(
            user_id="user_123",
            emails=emails,
            memory_manager=memory_manager
        )

        print_workflow_summary(result)

        captured = capsys.readouterr()
        assert "Workflow Summary" in captured.out
        assert "user_123" in captured.out
        assert "Emails Processed: 1/1" in captured.out


class TestWorkflowErrorHandling:
    """Test workflow error handling."""

    def test_workflow_tracks_errors_in_state(self, memory_manager):
        """Workflow tracks errors that occur during processing."""
        # For this test, we'll just verify the error tracking mechanism
        # Actual error generation would require malformed input
        emails = [{
            "id": "email_1",
            "subject": "Test",
            "body": "Test",
            "date": "2025-01-15"
        }]

        result = run_workflow(
            user_id="user_123",
            emails=emails,
            memory_manager=memory_manager
        )

        # Should have errors field
        assert "errors" in result
        assert isinstance(result["errors"], list)

    def test_workflow_tracks_warnings_in_state(self, memory_manager):
        """Workflow tracks warnings."""
        emails = [{
            "id": "email_1",
            "subject": "Test",
            "body": "Test",
            "date": "2025-01-15"
        }]

        result = run_workflow(
            user_id="user_123",
            emails=emails,
            memory_manager=memory_manager
        )

        # Should have warnings field
        assert "warnings" in result
        assert isinstance(result["warnings"], list)