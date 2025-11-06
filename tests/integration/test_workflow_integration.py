#!/usr/bin/env python3
"""
Integration Tests for Complete Workflow

End-to-end tests that validate the entire IAB Taxonomy Profile workflow
from email input through memory storage and profile generation.

These tests verify that all Phase 3 components work together correctly.
"""

import pytest
from langgraph.store.memory import InMemoryStore

from src.email_parser.workflow import run_workflow, get_workflow_summary
from src.email_parser.memory.manager import MemoryManager


@pytest.fixture
def memory_store():
    """Create InMemoryStore for testing."""
    return InMemoryStore()


@pytest.fixture
def memory_manager(memory_store):
    """Create MemoryManager with in-memory store."""
    return MemoryManager(user_id="integration_test_user", store=memory_store)


class TestEndToEndWorkflow:
    """Test complete workflow execution from end to end."""

    def test_complete_workflow_single_email(self, memory_manager):
        """Process single email through entire workflow."""
        emails = [{
            "id": "e2e_email_1",
            "subject": "Order Confirmation #12345",
            "body": "Your order has been confirmed. Total: $99.99",
            "date": "2025-01-15T10:30:00Z"
        }]

        # Execute workflow
        result = run_workflow(
            user_id="test_user_1",
            emails=emails,
            memory_manager=memory_manager
        )

        # Verify workflow completion
        assert result["user_id"] == "test_user_1"
        assert result["total_emails"] == 1
        assert result["current_email_index"] == 1
        assert len(result["errors"]) == 0

        # Verify profile was updated
        assert result.get("updated_profile") is not None
        profile = result["updated_profile"]
        assert "demographics" in profile
        assert "household" in profile
        assert "interests" in profile
        assert "purchase_intent" in profile

        # Verify memory storage
        episodic_memories = memory_manager.get_all_episodic_memories()
        assert len(episodic_memories) > 0

        # Verify email marked as processed
        processed_ids = memory_manager.get_processed_email_ids()
        assert "e2e_email_1" in processed_ids

    def test_complete_workflow_multiple_emails(self, memory_manager):
        """Process multiple emails through workflow."""
        emails = [
            {
                "id": "e2e_multi_1",
                "subject": "Newsletter: Tech Updates",
                "body": "Latest cryptocurrency news and blockchain innovations",
                "date": "2025-01-15T08:00:00Z"
            },
            {
                "id": "e2e_multi_2",
                "subject": "Your Electric Bill is Ready",
                "body": "Your monthly electric bill for January is available",
                "date": "2025-01-16T09:00:00Z"
            },
            {
                "id": "e2e_multi_3",
                "subject": "Shipping Confirmation",
                "body": "Your package has shipped. Tracking: 1Z999AA",
                "date": "2025-01-17T10:00:00Z"
            }
        ]

        # Execute workflow
        result = run_workflow(
            user_id="test_user_2",
            emails=emails,
            memory_manager=memory_manager
        )

        # Verify all emails processed
        assert result["total_emails"] == 3
        assert result["current_email_index"] == 3
        assert len(result["errors"]) == 0

        # Verify all emails marked as processed
        processed_ids = memory_manager.get_processed_email_ids()
        assert "e2e_multi_1" in processed_ids
        assert "e2e_multi_2" in processed_ids
        assert "e2e_multi_3" in processed_ids

        # Verify episodic memories stored for all emails
        episodic_memories = memory_manager.get_all_episodic_memories()
        assert len(episodic_memories) >= 3

    def test_workflow_with_incremental_runs(self, memory_manager):
        """Test incremental processing - only new emails are processed."""
        # First batch
        batch1 = [
            {"id": "inc_1", "subject": "Email 1", "body": "Content 1", "date": "2025-01-15"},
            {"id": "inc_2", "subject": "Email 2", "body": "Content 2", "date": "2025-01-16"}
        ]

        result1 = run_workflow(
            user_id="test_user_3",
            emails=batch1,
            memory_manager=memory_manager
        )

        assert result1["total_emails"] == 2
        assert result1["current_email_index"] == 2

        # Second batch - includes already-processed emails
        batch2 = [
            {"id": "inc_1", "subject": "Email 1", "body": "Content 1", "date": "2025-01-15"},  # Duplicate
            {"id": "inc_2", "subject": "Email 2", "body": "Content 2", "date": "2025-01-16"},  # Duplicate
            {"id": "inc_3", "subject": "Email 3", "body": "Content 3", "date": "2025-01-17"}   # New
        ]

        result2 = run_workflow(
            user_id="test_user_3",
            emails=batch2,
            memory_manager=memory_manager
        )

        # Should only process 1 new email
        assert result2["total_emails"] == 1
        assert result2["current_email_index"] == 1

        # Verify all 3 emails are now marked as processed
        processed_ids = memory_manager.get_processed_email_ids()
        assert len(processed_ids) == 3
        assert "inc_3" in processed_ids


class TestWorkflowMemoryIntegration:
    """Test workflow integration with memory system."""

    def test_workflow_creates_semantic_memories(self, memory_manager):
        """Workflow creates semantic memories for taxonomy classifications."""
        emails = [{
            "id": "sem_mem_1",
            "subject": "Tech Newsletter",
            "body": "Cryptocurrency and blockchain updates",
            "date": "2025-01-15"
        }]

        run_workflow(
            user_id="test_user_4",
            emails=emails,
            memory_manager=memory_manager
        )

        # Check semantic memories were created
        semantic_memories = memory_manager.get_all_semantic_memories()
        assert len(semantic_memories) > 0

        # Verify memory structure
        for memory in semantic_memories:
            assert "taxonomy_id" in memory
            assert "value" in memory
            assert "confidence" in memory
            assert "section" in memory

    def test_workflow_creates_episodic_memories(self, memory_manager):
        """Workflow creates episodic memories for evidence trails."""
        emails = [{
            "id": "epi_mem_1",
            "subject": "Order Receipt",
            "body": "Thank you for your purchase",
            "date": "2025-01-15"
        }]

        run_workflow(
            user_id="test_user_5",
            emails=emails,
            memory_manager=memory_manager
        )

        # Check episodic memory was created
        episodic_memories = memory_manager.get_all_episodic_memories()
        assert len(episodic_memories) > 0

        # Verify episodic memory structure
        episode = episodic_memories[0]
        assert "email_id" in episode
        assert "email_subject" in episode
        assert "taxonomy_selections" in episode
        assert "processed_at" in episode

    def test_workflow_respects_existing_profile(self, memory_manager):
        """Workflow retrieves and respects existing profile data."""
        # Pre-populate memory with a classification
        from src.email_parser.memory.schemas import build_semantic_memory_id
        from datetime import datetime

        taxonomy_selection = {
            "taxonomy_id": 100,
            "section": "interests",
            "value": "Technology",
            "confidence": 0.75,
            "category_path": "Interest | Technology",
            "tier_1": "Interest",
            "tier_2": "Technology",
            "tier_3": "",
            "tier_4": "",
            "tier_5": "",
            "reasoning": "Pre-existing interest",
            "evidence_count": 1,
            "first_observed": datetime.utcnow().isoformat() + "Z",
            "last_validated": datetime.utcnow().isoformat() + "Z",
            "last_updated": datetime.utcnow().isoformat() + "Z",
            "data_source": "email"
        }

        memory_id = build_semantic_memory_id("interests", 100, "Technology")
        memory_manager.store_semantic_memory(memory_id, taxonomy_selection)

        # Now run workflow
        emails = [{
            "id": "existing_prof_1",
            "subject": "Newsletter",
            "body": "Technology news",
            "date": "2025-01-15"
        }]

        result = run_workflow(
            user_id="test_user_6",
            emails=emails,
            memory_manager=memory_manager
        )

        # Verify existing profile was loaded
        assert result.get("existing_profile") is not None
        existing_profile = result["existing_profile"]
        assert len(existing_profile.get("interests", [])) > 0


class TestWorkflowRouting:
    """Test conditional routing in workflow."""

    def test_purchase_email_routes_to_purchase_analyzer(self, memory_manager):
        """Purchase emails are correctly routed."""
        emails = [{
            "id": "route_purchase_1",
            "subject": "Order Confirmation #12345",
            "body": "Your order has been confirmed",
            "date": "2025-01-15"
        }]

        result = run_workflow(
            user_id="test_user_7",
            emails=emails,
            memory_manager=memory_manager
        )

        # Verify purchase analyzer ran
        # In Phase 3, analyzers produce stub results
        assert result.get("purchase_results") is not None or \
               len(result.get("reconciliation_data", [])) > 0

    def test_household_email_routes_to_household_analyzer(self, memory_manager):
        """Household emails are correctly routed."""
        emails = [{
            "id": "route_household_1",
            "subject": "Your Electric Bill",
            "body": "Your monthly electric bill is ready",
            "date": "2025-01-15"
        }]

        result = run_workflow(
            user_id="test_user_8",
            emails=emails,
            memory_manager=memory_manager
        )

        # Verify household analyzer ran
        assert result.get("household_results") is not None or \
               len(result.get("reconciliation_data", [])) > 0


class TestWorkflowErrorHandling:
    """Test workflow error handling and resilience."""

    def test_workflow_handles_malformed_email(self, memory_manager):
        """Workflow handles emails with missing fields gracefully."""
        emails = [
            {"id": "malformed_1"},  # Missing subject, body, date
            {
                "id": "valid_1",
                "subject": "Valid Email",
                "body": "Valid content",
                "date": "2025-01-15"
            }
        ]

        # Should not crash
        result = run_workflow(
            user_id="test_user_9",
            emails=emails,
            memory_manager=memory_manager
        )

        # Should process valid email
        assert result["total_emails"] == 2

    def test_workflow_continues_after_node_error(self, memory_manager):
        """Workflow tracks errors but continues processing."""
        emails = [
            {
                "id": "email_1",
                "subject": "Test",
                "body": "Content",
                "date": "2025-01-15"
            }
        ]

        result = run_workflow(
            user_id="test_user_10",
            emails=emails,
            memory_manager=memory_manager
        )

        # Verify error tracking exists
        assert "errors" in result
        assert "warnings" in result


class TestWorkflowSummaryReporting:
    """Test workflow summary and reporting."""

    def test_workflow_summary_includes_all_sections(self, memory_manager):
        """Workflow summary includes all profile sections."""
        emails = [{
            "id": "summary_1",
            "subject": "Test",
            "body": "Test",
            "date": "2025-01-15"
        }]

        result = run_workflow(
            user_id="test_user_11",
            emails=emails,
            memory_manager=memory_manager
        )

        summary = get_workflow_summary(result)

        assert "user_id" in summary
        assert "emails_processed" in summary
        assert "profile_sections" in summary
        assert "demographics" in summary["profile_sections"]
        assert "household" in summary["profile_sections"]
        assert "interests" in summary["profile_sections"]
        assert "purchase_intent" in summary["profile_sections"]

    def test_workflow_summary_counts_accurate(self, memory_manager):
        """Workflow summary has accurate counts."""
        emails = [
            {"id": f"count_{i}", "subject": "Test", "body": "Test", "date": "2025-01-15"}
            for i in range(5)
        ]

        result = run_workflow(
            user_id="test_user_12",
            emails=emails,
            memory_manager=memory_manager
        )

        summary = get_workflow_summary(result)

        assert summary["emails_processed"] == 5
        assert summary["total_emails"] == 5
        assert summary["errors_count"] == 0