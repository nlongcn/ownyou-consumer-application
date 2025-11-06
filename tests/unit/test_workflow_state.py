#!/usr/bin/env python3
"""
Unit Tests for Workflow State

Tests state schema and helper functions.
"""

import pytest
from src.email_parser.workflow.state import (
    WorkflowState,
    create_initial_state,
    get_current_email,
    has_more_emails,
    advance_to_next_email,
    add_error,
    add_warning,
)


class TestStateCreation:
    """Test state initialization."""

    def test_create_initial_state_basic(self):
        """Create initial state with user_id and emails."""
        emails = [
            {"id": "email_1", "subject": "Test 1"},
            {"id": "email_2", "subject": "Test 2"}
        ]

        state = create_initial_state("user_123", emails)

        assert state["user_id"] == "user_123"
        assert state["emails"] == emails
        assert state["total_emails"] == 2
        assert state["current_email_index"] == 0
        assert state["processed_email_ids"] == []
        assert state["demographics_results"] == []
        assert state["errors"] == []

    def test_create_initial_state_empty_emails(self):
        """Create initial state with no emails."""
        state = create_initial_state("user_123", [])

        assert state["user_id"] == "user_123"
        assert state["total_emails"] == 0
        assert state["emails"] == []


class TestCurrentEmail:
    """Test current email retrieval."""

    def test_get_current_email_first(self):
        """Get first email."""
        emails = [
            {"id": "email_1", "subject": "First"},
            {"id": "email_2", "subject": "Second"}
        ]
        state = create_initial_state("user_123", emails)

        current = get_current_email(state)

        assert current is not None
        assert current["id"] == "email_1"
        assert current["subject"] == "First"

    def test_get_current_email_at_index(self):
        """Get email at specific index."""
        emails = [
            {"id": "email_1", "subject": "First"},
            {"id": "email_2", "subject": "Second"}
        ]
        state = create_initial_state("user_123", emails)
        state["current_email_index"] = 1

        current = get_current_email(state)

        assert current is not None
        assert current["id"] == "email_2"

    def test_get_current_email_no_emails(self):
        """Get current email when no emails."""
        state = create_initial_state("user_123", [])

        current = get_current_email(state)

        assert current is None

    def test_get_current_email_past_end(self):
        """Get current email past end of list."""
        emails = [{"id": "email_1"}]
        state = create_initial_state("user_123", emails)
        state["current_email_index"] = 5

        current = get_current_email(state)

        assert current is None


class TestHasMoreEmails:
    """Test email iteration logic."""

    def test_has_more_emails_at_start(self):
        """Has more emails at start."""
        emails = [{"id": "1"}, {"id": "2"}]
        state = create_initial_state("user_123", emails)

        assert has_more_emails(state) is True

    def test_has_more_emails_at_middle(self):
        """Has more emails in middle."""
        emails = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        state = create_initial_state("user_123", emails)
        state["current_email_index"] = 1

        assert has_more_emails(state) is True

    def test_has_more_emails_at_last(self):
        """Has more emails at last."""
        emails = [{"id": "1"}, {"id": "2"}]
        state = create_initial_state("user_123", emails)
        state["current_email_index"] = 1  # At last (index 1 of 2)

        assert has_more_emails(state) is True

    def test_has_more_emails_past_end(self):
        """No more emails past end."""
        emails = [{"id": "1"}, {"id": "2"}]
        state = create_initial_state("user_123", emails)
        state["current_email_index"] = 2  # Past end

        assert has_more_emails(state) is False

    def test_has_more_emails_empty_list(self):
        """No emails in empty list."""
        state = create_initial_state("user_123", [])

        assert has_more_emails(state) is False


class TestAdvanceEmail:
    """Test advancing to next email."""

    def test_advance_to_next_email(self):
        """Advance from first to second email."""
        emails = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        state = create_initial_state("user_123", emails)

        state = advance_to_next_email(state)

        assert state["current_email_index"] == 1

    def test_advance_resets_analyzer_results(self):
        """Advancing resets analyzer results."""
        emails = [{"id": "1"}, {"id": "2"}]
        state = create_initial_state("user_123", emails)

        # Add some results
        state["demographics_results"] = [{"taxonomy_id": 5}]
        state["interests_results"] = [{"taxonomy_id": 342}]
        state["next_analyzers"] = ["demographics"]
        state["completed_analyzers"] = ["demographics"]

        # Advance
        state = advance_to_next_email(state)

        # Results should be reset
        assert state["demographics_results"] == []
        assert state["interests_results"] == []
        assert state["next_analyzers"] == []
        assert state["completed_analyzers"] == []
        assert state["current_email_index"] == 1


class TestErrorWarningTracking:
    """Test error and warning tracking."""

    def test_add_error(self):
        """Add error to state."""
        state = create_initial_state("user_123", [])

        state = add_error(state, "Something went wrong")

        assert len(state["errors"]) == 1
        assert state["errors"][0] == "Something went wrong"

    def test_add_multiple_errors(self):
        """Add multiple errors."""
        state = create_initial_state("user_123", [])

        state = add_error(state, "Error 1")
        state = add_error(state, "Error 2")

        assert len(state["errors"]) == 2
        assert state["errors"][0] == "Error 1"
        assert state["errors"][1] == "Error 2"

    def test_add_warning(self):
        """Add warning to state."""
        state = create_initial_state("user_123", [])

        state = add_warning(state, "Be careful")

        assert len(state["warnings"]) == 1
        assert state["warnings"][0] == "Be careful"

    def test_add_multiple_warnings(self):
        """Add multiple warnings."""
        state = create_initial_state("user_123", [])

        state = add_warning(state, "Warning 1")
        state = add_warning(state, "Warning 2")

        assert len(state["warnings"]) == 2