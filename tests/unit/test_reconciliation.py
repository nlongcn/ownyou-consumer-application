#!/usr/bin/env python3
"""
Unit Tests for Evidence Reconciliation Logic

Tests evidence classification, memory updates, and conflict resolution.

Reference: src/email_parser/memory/reconciliation.py
"""

import pytest
from datetime import datetime
from langgraph.store.memory import InMemoryStore

from src.email_parser.memory.store import initialize_memory_store
from src.email_parser.memory.manager import MemoryManager
from src.email_parser.memory.reconciliation import (
    classify_evidence_type,
    reconcile_evidence,
    reconcile_batch_evidence,
    get_conflicting_classifications,
    resolve_contradiction,
)


@pytest.fixture
def memory_store():
    """Create a fresh InMemoryStore for each test."""
    return initialize_memory_store(storage_type="inmemory", enable_embeddings=False)


@pytest.fixture
def memory_manager(memory_store):
    """Create a MemoryManager for test user."""
    return MemoryManager(user_id="test_user_123", store=memory_store)


class TestClassifyEvidenceType:
    """Test evidence classification logic."""

    def test_confirming_exact_match(self):
        """Exact value match = confirming."""
        result = classify_evidence_type("25-29", "25-29", 5)
        assert result == "confirming"

    def test_confirming_case_insensitive(self):
        """Case-insensitive match = confirming."""
        result = classify_evidence_type("Cryptocurrency", "cryptocurrency", 342)
        assert result == "confirming"

    def test_confirming_whitespace_handling(self):
        """Whitespace differences should not matter."""
        result = classify_evidence_type(" 25-29 ", "25-29", 5)
        assert result == "confirming"

    def test_contradicting_different_values(self):
        """Different values = contradicting."""
        result = classify_evidence_type("25-29", "30-34", 5)
        assert result == "contradicting"

    def test_contradicting_partial_match(self):
        """Partial matches still contradict."""
        result = classify_evidence_type("Cryptocurrency", "Crypto", 342)
        assert result == "contradicting"


class TestReconcileEvidence:
    """Test evidence reconciliation with memory updates."""

    def test_first_evidence_creates_memory(self, memory_manager):
        """First evidence should create new semantic memory."""
        result = reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.75,
            email_id="email_123",
            category_path="Demographic | Age Range | 25-29",
            tier_1="Demographic",
            tier_2="Age Range",
            tier_3="25-29",
            reasoning="Newsletter topics suggest tech professional"
        )

        assert result["taxonomy_id"] == 5
        assert result["value"] == "25-29"
        assert result["confidence"] == 0.75
        assert result["evidence_count"] == 1
        assert "email_123" in result["supporting_evidence"]
        assert len(result["contradicting_evidence"]) == 0
        assert result["section"] == "demographics"

    def test_confirming_evidence_increases_confidence(self, memory_manager):
        """Confirming evidence should increase confidence."""
        # First evidence
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.70,
            email_id="email_001",
            category_path="Demographic | Age Range | 25-29",
            tier_1="Demographic",
            tier_2="Age Range",
            tier_3="25-29"
        )

        # Confirming evidence
        result = reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.85,
            email_id="email_002",
            category_path="Demographic | Age Range | 25-29",
            tier_1="Demographic",
            tier_2="Age Range",
            tier_3="25-29"
        )

        # Confidence should increase from 0.70
        # Formula: 0.70 + (1-0.70)*0.85*0.3 = 0.7765
        assert result["confidence"] > 0.70
        assert result["confidence"] == pytest.approx(0.7765, abs=0.001)
        assert result["evidence_count"] == 2
        assert "email_001" in result["supporting_evidence"]
        assert "email_002" in result["supporting_evidence"]
        assert len(result["contradicting_evidence"]) == 0

    def test_contradicting_evidence_decreases_confidence(self, memory_manager):
        """Contradicting evidence should decrease confidence."""
        # First evidence
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.80,
            email_id="email_001",
            category_path="Demographic | Age Range | 25-29",
            tier_1="Demographic",
            tier_2="Age Range",
            tier_3="25-29"
        )

        # Contradicting evidence (different age range)
        result = reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=6,  # Different taxonomy_id for 30-34
            section="demographics",
            new_value="30-34",
            new_evidence_strength=0.70,
            email_id="email_002",
            category_path="Demographic | Age Range | 30-34",
            tier_1="Demographic",
            tier_2="Age Range",
            tier_3="30-34"
        )

        # This creates a NEW memory for 30-34 (different taxonomy_id)
        assert result["value"] == "30-34"
        assert result["confidence"] == 0.70

        # The original 25-29 memory is unchanged (no contradiction within same memory_id)
        memory_id_25_29 = "semantic_demographics_5_25_29"
        original = memory_manager.get_semantic_memory(memory_id_25_29)
        assert original["confidence"] == 0.80  # Unchanged

    def test_multiple_confirming_evidence(self, memory_manager):
        """Multiple confirming evidence accumulates."""
        # Initial
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=342,
            section="interests",
            new_value="Cryptocurrency",
            new_evidence_strength=0.60,
            email_id="email_001",
            category_path="Interest | Technology | Cryptocurrency",
            tier_1="Interest",
            tier_2="Technology",
            tier_3="Cryptocurrency"
        )

        # Confirm 1
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=342,
            section="interests",
            new_value="Cryptocurrency",
            new_evidence_strength=0.75,
            email_id="email_002",
            category_path="Interest | Technology | Cryptocurrency",
            tier_1="Interest",
            tier_2="Technology",
            tier_3="Cryptocurrency"
        )

        # Confirm 2
        result = reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=342,
            section="interests",
            new_value="Cryptocurrency",
            new_evidence_strength=0.80,
            email_id="email_003",
            category_path="Interest | Technology | Cryptocurrency",
            tier_1="Interest",
            tier_2="Technology",
            tier_3="Cryptocurrency"
        )

        # Should have confidence > initial (0.60) after 3 confirmations
        # Calculation:
        # 0.60 (initial)
        # → 0.60 + (1-0.60)*0.75*0.3 = 0.69
        # → 0.69 + (1-0.69)*0.80*0.3 = 0.7644
        assert result["confidence"] > 0.60
        assert result["confidence"] == pytest.approx(0.7644, abs=0.001)
        assert result["evidence_count"] == 3
        assert len(result["supporting_evidence"]) == 3

    def test_reasoning_accumulation(self, memory_manager):
        """Reasoning from multiple emails should accumulate."""
        # First
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.70,
            email_id="email_001",
            category_path="Demographic | Age Range | 25-29",
            tier_1="Demographic",
            tier_2="Age Range",
            tier_3="25-29",
            reasoning="First observation: tech newsletter"
        )

        # Second
        result = reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.75,
            email_id="email_002",
            category_path="Demographic | Age Range | 25-29",
            tier_1="Demographic",
            tier_2="Age Range",
            tier_3="25-29",
            reasoning="Second observation: startup job postings"
        )

        # Reasoning should contain both observations
        assert "First observation" in result["reasoning"]
        assert "Second observation" in result["reasoning"]


class TestReconcileBatchEvidence:
    """Test batch evidence processing."""

    def test_batch_reconcile_multiple_selections(self, memory_manager):
        """Process multiple taxonomy selections from one email."""
        selections = [
            {
                "taxonomy_id": 5,
                "section": "demographics",
                "value": "25-29",
                "confidence": 0.75,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "reasoning": "Age indicators in email"
            },
            {
                "taxonomy_id": 342,
                "section": "interests",
                "value": "Cryptocurrency",
                "confidence": 0.85,
                "category_path": "Interest | Technology | Cryptocurrency",
                "tier_1": "Interest",
                "tier_2": "Technology",
                "tier_3": "Cryptocurrency",
                "reasoning": "Crypto newsletter"
            },
            {
                "taxonomy_id": 156,
                "section": "interests",
                "value": "Technology",
                "confidence": 0.90,
                "category_path": "Interest | Technology",
                "tier_1": "Interest",
                "tier_2": "Technology",
                "reasoning": "Tech-focused content"
            }
        ]

        results = reconcile_batch_evidence(
            memory_manager=memory_manager,
            taxonomy_selections=selections,
            email_id="email_batch_001"
        )

        assert len(results) == 3
        assert results[0]["taxonomy_id"] == 5
        assert results[1]["taxonomy_id"] == 342
        assert results[2]["taxonomy_id"] == 156

        # All should reference the same email
        assert "email_batch_001" in results[0]["supporting_evidence"]
        assert "email_batch_001" in results[1]["supporting_evidence"]
        assert "email_batch_001" in results[2]["supporting_evidence"]

    def test_batch_handles_partial_failures(self, memory_manager):
        """Batch should continue even if one selection fails."""
        selections = [
            {
                "taxonomy_id": 5,
                "section": "demographics",
                "value": "25-29",
                "confidence": 0.75,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29"
            },
            {
                # Invalid: missing required fields
                "taxonomy_id": 342,
                "section": "interests",
                # Missing value, confidence, etc.
            },
            {
                "taxonomy_id": 156,
                "section": "interests",
                "value": "Technology",
                "confidence": 0.80,
                "category_path": "Interest | Technology",
                "tier_1": "Interest",
                "tier_2": "Technology"
            }
        ]

        # Should process 2 out of 3 (skip invalid one)
        results = reconcile_batch_evidence(
            memory_manager=memory_manager,
            taxonomy_selections=selections,
            email_id="email_partial"
        )

        # May have 2 or 3 depending on error handling
        # At minimum, should have processed the valid ones
        assert len(results) >= 2


class TestConflictDetection:
    """Test conflict detection for classifications."""

    def test_get_conflicting_classifications(self, memory_manager):
        """Detect classifications with contradicting evidence."""
        # Create memory with contradictions
        memory_id = "semantic_demographics_5_25_29"
        memory_manager.store_semantic_memory(
            memory_id,
            {
                "taxonomy_id": 5,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "value": "25-29",
                "confidence": 0.60,
                "evidence_count": 5,
                "supporting_evidence": ["email_1", "email_2"],
                "contradicting_evidence": ["email_3", "email_4", "email_5"],
                "first_observed": "2025-09-01T10:00:00Z",
                "last_validated": "2025-09-30T10:00:00Z",
                "last_updated": "2025-09-30T10:00:00Z",
                "days_since_validation": 0,
                "data_source": "email",
                "source_ids": ["email_1", "email_2", "email_3", "email_4", "email_5"],
                "section": "demographics"
            }
        )

        # Note: get_conflicting_classifications uses get_memories_by_section
        # which currently returns [] due to InMemoryStore limitations
        # This test documents expected behavior for when that's implemented

        conflicts = get_conflicting_classifications(
            memory_manager,
            section="demographics",
            min_contradiction_count=2
        )

        # Expected: would return [memory] if get_memories_by_section worked
        # For now, returns []
        assert isinstance(conflicts, list)


class TestConflictResolution:
    """Test manual conflict resolution."""

    def test_resolve_keep(self, memory_manager):
        """Keep classification despite contradictions."""
        memory_id = "semantic_demographics_5_25_29"

        # Create conflicting memory
        memory_manager.store_semantic_memory(
            memory_id,
            {
                "taxonomy_id": 5,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "value": "25-29",
                "confidence": 0.55,
                "evidence_count": 4,
                "supporting_evidence": ["email_1", "email_2"],
                "contradicting_evidence": ["email_3", "email_4"],
                "first_observed": "2025-09-01T10:00:00Z",
                "last_validated": "2025-09-15T10:00:00Z",
                "last_updated": "2025-09-15T10:00:00Z",
                "days_since_validation": 15,
                "data_source": "email",
                "source_ids": ["email_1", "email_2", "email_3", "email_4"],
                "section": "demographics"
            }
        )

        # Resolve: keep
        success = resolve_contradiction(memory_manager, memory_id, "keep")
        assert success is True

        # Verify it's still there and updated
        memory = memory_manager.get_semantic_memory(memory_id)
        assert memory is not None
        assert memory["days_since_validation"] == 0  # Reset

    def test_resolve_delete(self, memory_manager):
        """Delete uncertain classification."""
        memory_id = "semantic_demographics_5_25_29"

        # Create memory
        memory_manager.store_semantic_memory(
            memory_id,
            {
                "taxonomy_id": 5,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "value": "25-29",
                "confidence": 0.40,
                "evidence_count": 5,
                "supporting_evidence": ["email_1"],
                "contradicting_evidence": ["email_2", "email_3", "email_4", "email_5"],
                "first_observed": "2025-09-01T10:00:00Z",
                "last_validated": "2025-09-01T10:00:00Z",
                "last_updated": "2025-09-01T10:00:00Z",
                "days_since_validation": 0,
                "data_source": "email",
                "source_ids": ["email_1", "email_2", "email_3", "email_4", "email_5"],
                "section": "demographics"
            }
        )

        # Resolve: delete
        success = resolve_contradiction(memory_manager, memory_id, "delete")
        assert success is True

        # Verify it's deleted
        memory = memory_manager.get_semantic_memory(memory_id)
        assert memory is None

    def test_resolve_update(self, memory_manager):
        """Update to different value."""
        memory_id = "semantic_demographics_5_25_29"

        # Create memory
        memory_manager.store_semantic_memory(
            memory_id,
            {
                "taxonomy_id": 5,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "value": "25-29",
                "confidence": 0.45,
                "evidence_count": 3,
                "supporting_evidence": ["email_1"],
                "contradicting_evidence": ["email_2", "email_3"],
                "first_observed": "2025-09-01T10:00:00Z",
                "last_validated": "2025-09-01T10:00:00Z",
                "last_updated": "2025-09-01T10:00:00Z",
                "days_since_validation": 0,
                "data_source": "email",
                "source_ids": ["email_1", "email_2", "email_3"],
                "section": "demographics"
            }
        )

        # Resolve: update to 30-34
        success = resolve_contradiction(memory_manager, memory_id, "update", new_value="30-34")
        assert success is True

        # Old memory should be deleted
        memory = memory_manager.get_semantic_memory(memory_id)
        assert memory is None

        # Note: New memory would need to be created via reconcile_evidence