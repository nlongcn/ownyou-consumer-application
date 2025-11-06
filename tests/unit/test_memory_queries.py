#!/usr/bin/env python3
"""
Unit Tests for Memory Query Utilities

Tests memory listing, filtering, and querying operations.

Reference: src/email_parser/memory/manager.py (query methods)
"""

import pytest
from datetime import datetime, timedelta
from langgraph.store.memory import InMemoryStore

from src.email_parser.memory.store import initialize_memory_store
from src.email_parser.memory.manager import MemoryManager


@pytest.fixture
def memory_store():
    """Create a fresh InMemoryStore for each test."""
    return initialize_memory_store(storage_type="inmemory", enable_embeddings=False)


@pytest.fixture
def memory_manager(memory_store):
    """Create a MemoryManager for test user."""
    return MemoryManager(user_id="test_user_queries", store=memory_store)


@pytest.fixture
def populated_manager(memory_manager):
    """Create a MemoryManager with sample data."""
    # Demographics
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
            "evidence_count": 5,
            "supporting_evidence": ["email_1", "email_2", "email_3"],
            "contradicting_evidence": [],
            "first_observed": "2025-09-01T10:00:00Z",
            "last_validated": "2025-09-30T10:00:00Z",
            "last_updated": "2025-09-30T10:00:00Z",
            "days_since_validation": 0,
            "data_source": "email",
            "source_ids": ["email_1", "email_2", "email_3"],
            "section": "demographics"
        }
    )

    memory_manager.store_semantic_memory(
        "semantic_demographics_10_male",
        {
            "taxonomy_id": 10,
            "category_path": "Demographic | Gender | Male",
            "tier_1": "Demographic",
            "tier_2": "Gender",
            "tier_3": "Male",
            "value": "Male",
            "confidence": 0.75,
            "evidence_count": 3,
            "supporting_evidence": ["email_1", "email_4"],
            "contradicting_evidence": [],
            "first_observed": "2025-09-01T10:00:00Z",
            "last_validated": "2025-09-15T10:00:00Z",
            "last_updated": "2025-09-15T10:00:00Z",
            "days_since_validation": 15,
            "data_source": "email",
            "source_ids": ["email_1", "email_4"],
            "section": "demographics"
        }
    )

    # Interests
    memory_manager.store_semantic_memory(
        "semantic_interests_342_cryptocurrency",
        {
            "taxonomy_id": 342,
            "category_path": "Interest | Technology | Cryptocurrency",
            "tier_1": "Interest",
            "tier_2": "Technology",
            "tier_3": "Cryptocurrency",
            "value": "Cryptocurrency",
            "confidence": 0.92,
            "evidence_count": 8,
            "supporting_evidence": ["email_2", "email_3", "email_5", "email_6"],
            "contradicting_evidence": [],
            "first_observed": "2025-08-15T10:00:00Z",
            "last_validated": "2025-09-30T10:00:00Z",
            "last_updated": "2025-09-30T10:00:00Z",
            "days_since_validation": 0,
            "data_source": "email",
            "source_ids": ["email_2", "email_3", "email_5", "email_6"],
            "section": "interests"
        }
    )

    memory_manager.store_semantic_memory(
        "semantic_interests_156_technology",
        {
            "taxonomy_id": 156,
            "category_path": "Interest | Technology",
            "tier_1": "Interest",
            "tier_2": "Technology",
            "value": "Technology",
            "confidence": 0.45,
            "evidence_count": 4,
            "supporting_evidence": ["email_5"],
            "contradicting_evidence": ["email_7", "email_8"],
            "first_observed": "2025-07-01T10:00:00Z",
            "last_validated": "2025-08-01T10:00:00Z",
            "last_updated": "2025-08-01T10:00:00Z",
            "days_since_validation": 60,
            "data_source": "email",
            "source_ids": ["email_5", "email_7", "email_8"],
            "section": "interests"
        }
    )

    # Episodic memories
    memory_manager.store_episodic_memory(
        "episodic_email_email_1",
        {
            "email_id": "email_1",
            "email_date": "2025-09-01",
            "taxonomy_selections": [5, 10],
            "confidence_contributions": {5: 0.8, 10: 0.7},
            "reasoning": "Age and gender indicators",
            "processed_at": "2025-09-01T10:00:00Z",
            "llm_model": "claude:sonnet-4"
        }
    )

    return memory_manager


class TestMemoryIndex:
    """Test memory ID index tracking."""

    def test_index_tracks_semantic_memories(self, memory_manager):
        """Index should track stored semantic memories."""
        memory_manager.store_semantic_memory(
            "semantic_demographics_5_25_29",
            {
                "taxonomy_id": 5,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "value": "25-29",
                "confidence": 0.75,
                "evidence_count": 1,
                "supporting_evidence": ["email_1"],
                "contradicting_evidence": [],
                "first_observed": "2025-09-30T10:00:00Z",
                "last_validated": "2025-09-30T10:00:00Z",
                "last_updated": "2025-09-30T10:00:00Z",
                "days_since_validation": 0,
                "data_source": "email",
                "source_ids": ["email_1"],
                "section": "demographics"
            }
        )

        index = memory_manager._get_memory_index()
        assert "semantic_demographics_5_25_29" in index["semantic"]

    def test_index_tracks_episodic_memories(self, memory_manager):
        """Index should track stored episodic memories."""
        memory_manager.store_episodic_memory(
            "episodic_email_123",
            {
                "email_id": "123",
                "email_date": "2025-09-30",
                "taxonomy_selections": [5],
                "confidence_contributions": {5: 0.8},
                "reasoning": "Test",
                "processed_at": "2025-09-30T10:00:00Z",
                "llm_model": "claude:sonnet-4"
            }
        )

        index = memory_manager._get_memory_index()
        assert "episodic_email_123" in index["episodic"]

    def test_index_removes_deleted_memories(self, memory_manager):
        """Index should remove deleted memories."""
        memory_manager.store_semantic_memory(
            "semantic_test",
            {
                "taxonomy_id": 5,
                "category_path": "Test",
                "tier_1": "Test",
                "value": "Test",
                "confidence": 0.5,
                "evidence_count": 1,
                "supporting_evidence": [],
                "contradicting_evidence": [],
                "first_observed": "2025-09-30T10:00:00Z",
                "last_validated": "2025-09-30T10:00:00Z",
                "last_updated": "2025-09-30T10:00:00Z",
                "days_since_validation": 0,
                "data_source": "email",
                "source_ids": [],
                "section": "test"
            }
        )

        # Verify it's in index
        index = memory_manager._get_memory_index()
        assert "semantic_test" in index["semantic"]

        # Delete it
        memory_manager.delete_semantic_memory("semantic_test")

        # Verify it's removed from index
        index = memory_manager._get_memory_index()
        assert "semantic_test" not in index["semantic"]


class TestGetAllMemories:
    """Test retrieving all memories."""

    def test_get_all_semantic_memories_empty(self, memory_manager):
        """Empty manager returns empty list."""
        result = memory_manager.get_all_semantic_memories()
        assert result == []

    def test_get_all_semantic_memories(self, populated_manager):
        """Get all semantic memories."""
        memories = populated_manager.get_all_semantic_memories()

        assert len(memories) == 4
        taxonomy_ids = [m["taxonomy_id"] for m in memories]
        assert 5 in taxonomy_ids  # Age
        assert 10 in taxonomy_ids  # Gender
        assert 342 in taxonomy_ids  # Cryptocurrency
        assert 156 in taxonomy_ids  # Technology

    def test_get_all_episodic_memories_empty(self, memory_manager):
        """Empty manager returns empty list."""
        result = memory_manager.get_all_episodic_memories()
        assert result == []

    def test_get_all_episodic_memories(self, populated_manager):
        """Get all episodic memories."""
        memories = populated_manager.get_all_episodic_memories()

        assert len(memories) == 1
        assert memories[0]["email_id"] == "email_1"


class TestGetMemoriesBySection:
    """Test filtering memories by section."""

    def test_get_demographics_memories(self, populated_manager):
        """Get only demographics memories."""
        memories = populated_manager.get_memories_by_section("demographics")

        assert len(memories) == 2
        values = [m["value"] for m in memories]
        assert "25-29" in values
        assert "Male" in values

    def test_get_interests_memories(self, populated_manager):
        """Get only interests memories."""
        memories = populated_manager.get_memories_by_section("interests")

        assert len(memories) == 2
        values = [m["value"] for m in memories]
        assert "Cryptocurrency" in values
        assert "Technology" in values

    def test_get_empty_section(self, populated_manager):
        """Non-existent section returns empty list."""
        memories = populated_manager.get_memories_by_section("purchase_intent")
        assert memories == []


class TestGetHighConfidenceMemories:
    """Test filtering by confidence threshold."""

    def test_default_threshold_0_8(self, populated_manager):
        """Default threshold of 0.8."""
        memories = populated_manager.get_high_confidence_memories()

        assert len(memories) == 2
        values = [m["value"] for m in memories]
        assert "25-29" in values  # 0.85
        assert "Cryptocurrency" in values  # 0.92

    def test_custom_threshold_0_7(self, populated_manager):
        """Custom threshold of 0.7."""
        memories = populated_manager.get_high_confidence_memories(threshold=0.7)

        assert len(memories) == 3
        values = [m["value"] for m in memories]
        assert "25-29" in values  # 0.85
        assert "Male" in values  # 0.75
        assert "Cryptocurrency" in values  # 0.92

    def test_very_high_threshold_0_95(self, populated_manager):
        """Very high threshold filters most out."""
        memories = populated_manager.get_high_confidence_memories(threshold=0.95)

        assert len(memories) == 0  # No memories >= 0.95


class TestGetStaleMemories:
    """Test filtering by days since validation."""

    def test_default_threshold_30_days(self, populated_manager):
        """Default threshold of 30 days."""
        memories = populated_manager.get_stale_memories()

        # Only "Technology" has days_since_validation=60
        assert len(memories) == 1
        assert memories[0]["value"] == "Technology"

    def test_custom_threshold_10_days(self, populated_manager):
        """Custom threshold of 10 days."""
        memories = populated_manager.get_stale_memories(days_threshold=10)

        # "Male" (15 days) and "Technology" (60 days)
        assert len(memories) == 2
        values = [m["value"] for m in memories]
        assert "Male" in values
        assert "Technology" in values

    def test_very_strict_threshold_0_days(self, populated_manager):
        """Threshold of 0 days returns everything."""
        memories = populated_manager.get_stale_memories(days_threshold=0)

        # All 4 memories
        assert len(memories) == 4


class TestGetEvidenceForTaxonomy:
    """Test retrieving evidence for specific taxonomy."""

    def test_get_evidence_existing_taxonomy(self, populated_manager):
        """Get evidence for existing taxonomy."""
        evidence = populated_manager.get_evidence_for_taxonomy(342)  # Cryptocurrency

        assert len(evidence["supporting_evidence"]) == 4
        assert len(evidence["contradicting_evidence"]) == 0
        assert "email_2" in evidence["supporting_evidence"]

    def test_get_evidence_with_contradictions(self, populated_manager):
        """Get evidence including contradictions."""
        evidence = populated_manager.get_evidence_for_taxonomy(156)  # Technology

        assert len(evidence["supporting_evidence"]) == 1
        assert len(evidence["contradicting_evidence"]) == 2
        assert "email_5" in evidence["supporting_evidence"]
        assert "email_7" in evidence["contradicting_evidence"]

    def test_get_evidence_non_existent_taxonomy(self, populated_manager):
        """Non-existent taxonomy returns empty evidence."""
        evidence = populated_manager.get_evidence_for_taxonomy(9999)

        assert evidence["supporting_evidence"] == []
        assert evidence["contradicting_evidence"] == []


class TestMemoryStats:
    """Test memory statistics and counts."""

    def test_total_memory_count(self, populated_manager):
        """Count total memories."""
        semantic = populated_manager.get_all_semantic_memories()
        episodic = populated_manager.get_all_episodic_memories()

        assert len(semantic) == 4
        assert len(episodic) == 1

    def test_section_distribution(self, populated_manager):
        """Test distribution across sections."""
        demographics = populated_manager.get_memories_by_section("demographics")
        interests = populated_manager.get_memories_by_section("interests")

        assert len(demographics) == 2
        assert len(interests) == 2

    def test_confidence_distribution(self, populated_manager):
        """Test confidence score distribution."""
        all_memories = populated_manager.get_all_semantic_memories()
        confidences = [m["confidence"] for m in all_memories]

        assert max(confidences) == 0.92  # Cryptocurrency
        assert min(confidences) == 0.45  # Technology
        assert pytest.approx(sum(confidences) / len(confidences), abs=0.01) == 0.7425  # Average