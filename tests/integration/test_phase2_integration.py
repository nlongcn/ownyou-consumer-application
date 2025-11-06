#!/usr/bin/env python3
"""
Integration Tests for Phase 2: Memory System with Phase 1 Taxonomy

Tests integration between IAB Taxonomy Loader (Phase 1) and Memory System (Phase 2).

Validates:
- Storing taxonomy classifications in memory
- Updating classifications with new evidence
- Confidence evolution over multiple updates
- No regressions in Phase 1 functionality
"""

import pytest
from datetime import datetime

from src.email_parser.utils.iab_taxonomy_loader import IABTaxonomyLoader
from src.email_parser.memory.store import initialize_memory_store
from src.email_parser.memory.manager import MemoryManager
from src.email_parser.memory.reconciliation import reconcile_evidence, reconcile_batch_evidence
from src.email_parser.memory.confidence import apply_temporal_decay


@pytest.fixture
def taxonomy_loader():
    """Load IAB Taxonomy from Phase 1."""
    return IABTaxonomyLoader()


@pytest.fixture
def memory_store():
    """Create InMemoryStore for testing."""
    return initialize_memory_store(storage_type="inmemory", enable_embeddings=False)


@pytest.fixture
def memory_manager(memory_store):
    """Create MemoryManager for test user."""
    return MemoryManager(user_id="integration_test_user", store=memory_store)


class TestPhase1Phase2Integration:
    """Test integration between taxonomy loader and memory system."""

    def test_taxonomy_loader_still_works(self, taxonomy_loader):
        """Phase 1 taxonomy loader still functional (no regressions)."""
        # Verify taxonomy loaded
        assert len(taxonomy_loader.taxonomy_entries) > 0
        assert len(taxonomy_loader.taxonomy_by_id) > 0

        # Verify purchase classifications loaded
        assert len(taxonomy_loader.purchase_classifications) > 0

        # Verify lookups work
        age_range_entry = taxonomy_loader.get_by_id(5)
        assert age_range_entry is not None
        assert "25-29" in age_range_entry["name"]

    def test_store_taxonomy_selection_in_memory(
        self,
        taxonomy_loader,
        memory_manager
    ):
        """Store a taxonomy selection from Phase 1 in Phase 2 memory."""
        # Get taxonomy entry from Phase 1
        age_entry = taxonomy_loader.get_by_id(5)
        assert age_entry is not None

        # Store in Phase 2 memory
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=age_entry["id"],
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.75,
            email_id="email_integration_001",
            category_path=f"{age_entry['tier_1']} | {age_entry['tier_2']} | {age_entry['tier_3']}",
            tier_1=age_entry["tier_1"],
            tier_2=age_entry["tier_2"],
            tier_3=age_entry["tier_3"],
            reasoning="Integration test: storing taxonomy classification"
        )

        # Verify memory stored
        memory_id = "semantic_demographics_5_25_29"
        stored_memory = memory_manager.get_semantic_memory(memory_id)

        assert stored_memory is not None
        assert stored_memory["taxonomy_id"] == 5
        assert stored_memory["value"] == "25-29"
        assert stored_memory["confidence"] == 0.75

    def test_multiple_taxonomy_selections_batch(
        self,
        taxonomy_loader,
        memory_manager
    ):
        """Process multiple taxonomy selections from one email."""
        # Get multiple taxonomy entries
        age_entry = taxonomy_loader.get_by_id(5)  # Age 25-29
        gender_entry = taxonomy_loader.get_by_id(10)  # Gender Male
        crypto_entry = taxonomy_loader.get_by_id(342)  # Cryptocurrency

        selections = [
            {
                "taxonomy_id": age_entry["id"],
                "section": "demographics",
                "value": "25-29",
                "confidence": 0.75,
                "category_path": f"{age_entry['tier_1']} | {age_entry['tier_2']} | {age_entry['tier_3']}",
                "tier_1": age_entry["tier_1"],
                "tier_2": age_entry["tier_2"],
                "tier_3": age_entry["tier_3"],
                "reasoning": "Age indicators in email"
            },
            {
                "taxonomy_id": gender_entry["id"],
                "section": "demographics",
                "value": "Male",
                "confidence": 0.70,
                "category_path": f"{gender_entry['tier_1']} | {gender_entry['tier_2']} | {gender_entry['tier_3']}",
                "tier_1": gender_entry["tier_1"],
                "tier_2": gender_entry["tier_2"],
                "tier_3": gender_entry["tier_3"],
                "reasoning": "Gender indicators"
            },
            {
                "taxonomy_id": crypto_entry["id"],
                "section": "interests",
                "value": "Cryptocurrency",
                "confidence": 0.85,
                "category_path": f"{crypto_entry['tier_1']} | {crypto_entry['tier_2']} | {crypto_entry['tier_3']}",
                "tier_1": crypto_entry["tier_1"],
                "tier_2": crypto_entry["tier_2"],
                "tier_3": crypto_entry["tier_3"],
                "reasoning": "Crypto newsletter subscription"
            }
        ]

        # Batch reconcile
        results = reconcile_batch_evidence(
            memory_manager=memory_manager,
            taxonomy_selections=selections,
            email_id="email_batch_integration"
        )

        assert len(results) == 3
        assert results[0]["taxonomy_id"] == 5
        assert results[1]["taxonomy_id"] == 10
        assert results[2]["taxonomy_id"] == 342

    def test_confidence_evolution_with_multiple_emails(
        self,
        taxonomy_loader,
        memory_manager
    ):
        """Confidence evolves correctly over multiple emails."""
        age_entry = taxonomy_loader.get_by_id(5)

        # Email 1: Initial classification
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.70,
            email_id="email_001",
            category_path=f"{age_entry['tier_1']} | {age_entry['tier_2']} | {age_entry['tier_3']}",
            tier_1=age_entry["tier_1"],
            tier_2=age_entry["tier_2"],
            tier_3=age_entry["tier_3"]
        )

        memory_id = "semantic_demographics_5_25_29"
        memory1 = memory_manager.get_semantic_memory(memory_id)
        conf1 = memory1["confidence"]
        assert conf1 == 0.70

        # Email 2: Confirming evidence
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.80,
            email_id="email_002",
            category_path=f"{age_entry['tier_1']} | {age_entry['tier_2']} | {age_entry['tier_3']}",
            tier_1=age_entry["tier_1"],
            tier_2=age_entry["tier_2"],
            tier_3=age_entry["tier_3"]
        )

        memory2 = memory_manager.get_semantic_memory(memory_id)
        conf2 = memory2["confidence"]
        # 0.70 + (1-0.70)*0.80*0.3 = 0.772
        assert conf2 > conf1
        assert conf2 == pytest.approx(0.772, abs=0.001)

        # Email 3: More confirming evidence
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.85,
            email_id="email_003",
            category_path=f"{age_entry['tier_1']} | {age_entry['tier_2']} | {age_entry['tier_3']}",
            tier_1=age_entry["tier_1"],
            tier_2=age_entry["tier_2"],
            tier_3=age_entry["tier_3"]
        )

        memory3 = memory_manager.get_semantic_memory(memory_id)
        conf3 = memory3["confidence"]
        # 0.772 + (1-0.772)*0.85*0.3 = 0.8302
        assert conf3 > conf2
        assert conf3 == pytest.approx(0.8302, abs=0.001)

        # Verify evidence tracking
        assert len(memory3["supporting_evidence"]) == 3
        assert "email_001" in memory3["supporting_evidence"]
        assert "email_002" in memory3["supporting_evidence"]
        assert "email_003" in memory3["supporting_evidence"]

    def test_query_by_taxonomy_section(
        self,
        taxonomy_loader,
        memory_manager
    ):
        """Query memories by taxonomy section."""
        # Store demographics
        age_entry = taxonomy_loader.get_by_id(5)
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.75,
            email_id="email_demo1",
            category_path=f"{age_entry['tier_1']} | {age_entry['tier_2']} | {age_entry['tier_3']}",
            tier_1=age_entry["tier_1"],
            tier_2=age_entry["tier_2"],
            tier_3=age_entry["tier_3"]
        )

        # Store interests
        crypto_entry = taxonomy_loader.get_by_id(342)
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=342,
            section="interests",
            new_value="Cryptocurrency",
            new_evidence_strength=0.85,
            email_id="email_interest1",
            category_path=f"{crypto_entry['tier_1']} | {crypto_entry['tier_2']} | {crypto_entry['tier_3']}",
            tier_1=crypto_entry["tier_1"],
            tier_2=crypto_entry["tier_2"],
            tier_3=crypto_entry["tier_3"]
        )

        # Query by section
        demographics = memory_manager.get_memories_by_section("demographics")
        interests = memory_manager.get_memories_by_section("interests")

        assert len(demographics) == 1
        assert demographics[0]["value"] == "25-29"

        assert len(interests) == 1
        assert interests[0]["value"] == "Cryptocurrency"

    def test_temporal_decay_applies(
        self,
        taxonomy_loader,
        memory_manager
    ):
        """Temporal decay applies correctly to stored classifications."""
        age_entry = taxonomy_loader.get_by_id(5)

        # Store classification
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.80,
            email_id="email_decay",
            category_path=f"{age_entry['tier_1']} | {age_entry['tier_2']} | {age_entry['tier_3']}",
            tier_1=age_entry["tier_1"],
            tier_2=age_entry["tier_2"],
            tier_3=age_entry["tier_3"]
        )

        memory_id = "semantic_demographics_5_25_29"
        original_memory = memory_manager.get_semantic_memory(memory_id)
        original_conf = original_memory["confidence"]

        # Simulate 7 days passing (1 week)
        decayed_conf = apply_temporal_decay(original_conf, days_since_last_validation=7)

        # 0.80 * (1 - 0.01) = 0.792
        assert decayed_conf < original_conf
        assert decayed_conf == pytest.approx(0.792, abs=0.001)

        # Simulate 30 days passing (1 month)
        decayed_conf_30 = apply_temporal_decay(original_conf, days_since_last_validation=30)

        # 0.80 * (1 - 0.01 * 30/7) = 0.7657
        assert decayed_conf_30 < decayed_conf
        assert decayed_conf_30 == pytest.approx(0.7657, abs=0.001)

    def test_purchase_intent_classification(
        self,
        taxonomy_loader,
        memory_manager
    ):
        """Store purchase intent classifications."""
        # Get purchase intent taxonomy
        purchase_entries = taxonomy_loader.get_by_section("purchase_intent")
        assert len(purchase_entries) > 0

        # Find a PIPR entry (purchase intent - recency)
        pipr_entry = next((e for e in purchase_entries if "PIPR" in e.get("tier_1", "")), None)
        if pipr_entry:
            reconcile_evidence(
                memory_manager=memory_manager,
                taxonomy_id=pipr_entry["id"],
                section="purchase_intent",
                new_value=pipr_entry["tier_3"],
                new_evidence_strength=0.70,
                email_id="email_purchase",
                category_path=f"{pipr_entry['tier_1']} | {pipr_entry['tier_2']} | {pipr_entry['tier_3']}",
                tier_1=pipr_entry["tier_1"],
                tier_2=pipr_entry["tier_2"],
                tier_3=pipr_entry["tier_3"],
                reasoning="Purchase confirmation email received"
            )

            # Verify stored
            purchase_memories = memory_manager.get_memories_by_section("purchase_intent")
            assert len(purchase_memories) >= 1

    def test_high_confidence_taxonomy_filtering(
        self,
        taxonomy_loader,
        memory_manager
    ):
        """Filter high-confidence taxonomy classifications."""
        # Store high confidence
        age_entry = taxonomy_loader.get_by_id(5)
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=5,
            section="demographics",
            new_value="25-29",
            new_evidence_strength=0.90,
            email_id="email_high",
            category_path=f"{age_entry['tier_1']} | {age_entry['tier_2']} | {age_entry['tier_3']}",
            tier_1=age_entry["tier_1"],
            tier_2=age_entry["tier_2"],
            tier_3=age_entry["tier_3"]
        )

        # Store low confidence
        gender_entry = taxonomy_loader.get_by_id(10)
        reconcile_evidence(
            memory_manager=memory_manager,
            taxonomy_id=10,
            section="demographics",
            new_value="Male",
            new_evidence_strength=0.50,
            email_id="email_low",
            category_path=f"{gender_entry['tier_1']} | {gender_entry['tier_2']} | {gender_entry['tier_3']}",
            tier_1=gender_entry["tier_1"],
            tier_2=gender_entry["tier_2"],
            tier_3=gender_entry["tier_3"]
        )

        # Get high confidence only
        high_conf = memory_manager.get_high_confidence_memories(threshold=0.8)

        assert len(high_conf) == 1
        assert high_conf[0]["value"] == "25-29"
        assert high_conf[0]["confidence"] >= 0.8

    def test_full_workflow_simulation(
        self,
        taxonomy_loader,
        memory_manager
    ):
        """Simulate full workflow: emails → taxonomy → memory → query."""
        # Simulate 3 emails with taxonomy selections

        # Email 1
        email1_selections = [
            {
                "taxonomy_id": 5,  # Age 25-29
                "section": "demographics",
                "value": "25-29",
                "confidence": 0.70,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29"
            },
            {
                "taxonomy_id": 342,  # Cryptocurrency
                "section": "interests",
                "value": "Cryptocurrency",
                "confidence": 0.80,
                "category_path": "Interest | Technology | Cryptocurrency",
                "tier_1": "Interest",
                "tier_2": "Technology",
                "tier_3": "Cryptocurrency"
            }
        ]
        reconcile_batch_evidence(memory_manager, email1_selections, "email_workflow_1")

        # Email 2
        email2_selections = [
            {
                "taxonomy_id": 5,  # Age 25-29 (confirming)
                "section": "demographics",
                "value": "25-29",
                "confidence": 0.75,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29"
            },
            {
                "taxonomy_id": 10,  # Gender Male (new)
                "section": "demographics",
                "value": "Male",
                "confidence": 0.65,
                "category_path": "Demographic | Gender | Male",
                "tier_1": "Demographic",
                "tier_2": "Gender",
                "tier_3": "Male"
            }
        ]
        reconcile_batch_evidence(memory_manager, email2_selections, "email_workflow_2")

        # Email 3
        email3_selections = [
            {
                "taxonomy_id": 342,  # Cryptocurrency (confirming)
                "section": "interests",
                "value": "Cryptocurrency",
                "confidence": 0.85,
                "category_path": "Interest | Technology | Cryptocurrency",
                "tier_1": "Interest",
                "tier_2": "Technology",
                "tier_3": "Cryptocurrency"
            }
        ]
        reconcile_batch_evidence(memory_manager, email3_selections, "email_workflow_3")

        # Query results
        all_memories = memory_manager.get_all_semantic_memories()
        demographics = memory_manager.get_memories_by_section("demographics")
        interests = memory_manager.get_memories_by_section("interests")
        high_conf = memory_manager.get_high_confidence_memories(threshold=0.75)

        # Assertions
        assert len(all_memories) == 3  # Age, Gender, Crypto
        assert len(demographics) == 2  # Age, Gender
        assert len(interests) == 1  # Crypto
        assert len(high_conf) >= 1  # At least Crypto should be high

        # Check confidence evolution for Age (confirmed twice)
        age_memory = memory_manager.get_semantic_memory("semantic_demographics_5_25_29")
        assert age_memory["confidence"] > 0.70  # Increased from initial
        assert len(age_memory["supporting_evidence"]) == 2  # Two emails