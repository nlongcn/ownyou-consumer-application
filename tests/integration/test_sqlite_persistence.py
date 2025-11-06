#!/usr/bin/env python3
"""
Integration tests for SQLite backend persistence.

Tests verify that:
1. Data persists across sessions
2. Incremental processing skips already-processed emails
3. Confidence scores are correctly retrieved
4. Memory stats accurately reflect stored data
5. Multiple runs produce consistent results
"""

import pytest
import os
import tempfile
import shutil
from pathlib import Path
import json

from email_parser.memory.backends import SQLiteStore
from email_parser.memory.manager import MemoryManager
from email_parser.main import EmailParser


class TestSQLitePersistence:
    """Test SQLite backend persistence across sessions."""

    @pytest.fixture
    def temp_db_path(self):
        """Create temporary database path."""
        temp_dir = tempfile.mkdtemp()
        db_path = os.path.join(temp_dir, "test_memory.db")
        yield db_path
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)

    def create_test_memory_data(self, value, confidence=0.85, taxonomy_id=342):
        """Helper to create valid memory data structure.

        Note: Does NOT include memory_id - that should be passed separately
        to store_semantic_memory(memory_id=..., data=...).
        """
        from datetime import datetime
        return {
            "taxonomy_id": taxonomy_id,
            "category_path": "Interest | Test",
            "tier_1": "Interest",
            "tier_2": "Test",
            "tier_3": "",
            "tier_4": "",
            "tier_5": "",
            "value": value,
            "confidence": confidence,
            "evidence_count": 1,
            "supporting_evidence": ["test_email"],
            "contradicting_evidence": [],
            "first_observed": datetime.now().isoformat() + "Z",
            "last_validated": datetime.now().isoformat() + "Z",
            "last_updated": datetime.now().isoformat() + "Z",
            "days_since_validation": 0,
            "data_source": "email",
            "source_ids": ["test_email"],
            "section": "interests",
            "reasoning": "Test reasoning"
        }

    @pytest.fixture
    def sample_csv_file(self, tmp_path):
        """Create a sample CSV file with test emails."""
        csv_content = """ID,Date,From,Subject,Summary,Category
email_1,2025-01-01,test@example.com,Crypto News,Bitcoin price analysis discussing blockchain technology,Newsletter
email_2,2025-01-02,news@tech.com,AI Developments,Latest AI breakthroughs in machine learning,Newsletter
email_3,2025-01-03,info@finance.com,Stock Market,Market analysis and investment opportunities,Newsletter"""

        csv_file = tmp_path / "test_emails.csv"
        csv_file.write_text(csv_content)
        return str(csv_file)

    def test_basic_persistence(self, temp_db_path):
        """Test that data persists across MemoryManager instances."""
        user_id = "test_user_persistence"

        # Session 1: Store some data
        store1 = SQLiteStore(temp_db_path)
        mm1 = MemoryManager(user_id=user_id, store=store1)

        memory_data = self.create_test_memory_data("Test Value", 0.85)

        mm1.store_semantic_memory(
            memory_id="test_memory_1",
            data=memory_data
        )

        # Session 2: Retrieve data with new instance
        store2 = SQLiteStore(temp_db_path)
        mm2 = MemoryManager(user_id=user_id, store=store2)

        retrieved = mm2.get_semantic_memory("test_memory_1")

        assert retrieved is not None
        assert retrieved["memory_id"] == "test_memory_1"
        assert retrieved["value"] == "Test Value"
        assert retrieved["confidence"] == 0.85

    def test_incremental_processing(self, temp_db_path):
        """Test that processed emails are tracked and not reprocessed."""
        user_id = "test_user_incremental"

        # Session 1: Mark some emails as processed
        store1 = SQLiteStore(temp_db_path)
        mm1 = MemoryManager(user_id=user_id, store=store1)

        mm1.mark_email_as_processed("email_1")
        mm1.mark_email_as_processed("email_2")

        # Session 2: Check processed emails with new instance
        store2 = SQLiteStore(temp_db_path)
        mm2 = MemoryManager(user_id=user_id, store=store2)

        processed_ids = mm2.get_processed_email_ids()
        assert "email_1" in processed_ids
        assert "email_2" in processed_ids
        assert "email_3" not in processed_ids
        assert len(processed_ids) == 2

    def test_memory_stats_persistence(self, temp_db_path):
        """Test that memory statistics reflect persisted data correctly."""
        user_id = "test_user_stats"

        # Session 1: Store multiple memories
        store1 = SQLiteStore(temp_db_path)
        mm1 = MemoryManager(user_id=user_id, store=store1)

        for i in range(5):
            memory_data = self.create_test_memory_data(
                f"Value {i}",
                confidence=0.7 + (i * 0.05)
            )
            mm1.store_semantic_memory(
                memory_id=f"memory_{i}",
                data=memory_data
            )

        # Session 2: Verify stats with new instance
        store2 = SQLiteStore(temp_db_path)
        mm2 = MemoryManager(user_id=user_id, store=store2)

        all_memories = mm2.get_all_semantic_memories()
        assert len(all_memories) == 5

        # Check confidence scores persisted correctly
        confidences = [m["confidence"] for m in all_memories]
        assert any(abs(c - 0.7) < 0.01 for c in confidences)
        assert any(abs(c - 0.9) < 0.01 for c in confidences)

    def test_namespace_isolation(self, temp_db_path):
        """Test that different users' data is isolated."""
        user1_id = "user_1"
        user2_id = "user_2"

        store = SQLiteStore(temp_db_path)

        # User 1 stores data
        mm1 = MemoryManager(user_id=user1_id, store=store)
        mm1.store_semantic_memory(
            memory_id="user1_memory",
            data=self.create_test_memory_data("User 1 Data")
        )

        # User 2 stores data
        mm2 = MemoryManager(user_id=user2_id, store=store)
        mm2.store_semantic_memory(
            memory_id="user2_memory",
            data=self.create_test_memory_data("User 2 Data")
        )

        # Verify isolation
        user1_memories = mm1.get_all_semantic_memories()
        user2_memories = mm2.get_all_semantic_memories()

        assert len(user1_memories) == 1
        assert len(user2_memories) == 1
        assert user1_memories[0]["value"] == "User 1 Data"
        assert user2_memories[0]["value"] == "User 2 Data"

    def test_database_file_creation(self, temp_db_path):
        """Test that database file is created and has correct schema."""
        # Database shouldn't exist yet
        assert not Path(temp_db_path).exists()

        # Create store
        store = SQLiteStore(temp_db_path)

        # Database should now exist
        assert Path(temp_db_path).exists()

        # Verify tables exist
        import sqlite3
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()

        # Check memories table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'")
        assert cursor.fetchone() is not None

        # Check indexes exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indexes = [row[0] for row in cursor.fetchall()]
        assert 'idx_namespace' in indexes
        assert 'idx_key' in indexes
        assert 'idx_namespace_key' in indexes

        conn.close()

    def test_concurrent_access(self, temp_db_path):
        """Test that multiple MemoryManager instances can access same database."""
        user_id = "test_concurrent"

        # Create multiple instances
        store1 = SQLiteStore(temp_db_path)
        store2 = SQLiteStore(temp_db_path)

        mm1 = MemoryManager(user_id=user_id, store=store1)
        mm2 = MemoryManager(user_id=user_id, store=store2)

        # Instance 1 writes
        mm1.store_semantic_memory(
            memory_id="concurrent_test",
            data=self.create_test_memory_data("Concurrent Data")
        )

        # Instance 2 reads
        retrieved = mm2.get_semantic_memory("concurrent_test")
        assert retrieved is not None
        assert retrieved["value"] == "Concurrent Data"

    def test_memory_update_persistence(self, temp_db_path):
        """Test that memory updates persist correctly."""
        user_id = "test_update"

        # Session 1: Create initial memory
        store1 = SQLiteStore(temp_db_path)
        mm1 = MemoryManager(user_id=user_id, store=store1)

        mm1.store_semantic_memory(
            memory_id="update_test",
            data=self.create_test_memory_data("Initial Value", confidence=0.7)
        )

        # Session 2: Update memory
        store2 = SQLiteStore(temp_db_path)
        mm2 = MemoryManager(user_id=user_id, store=store2)

        mm2.store_semantic_memory(
            memory_id="update_test",
            data=self.create_test_memory_data("Updated Value", confidence=0.9)
        )

        # Session 3: Verify update persisted
        store3 = SQLiteStore(temp_db_path)
        mm3 = MemoryManager(user_id=user_id, store=store3)

        retrieved = mm3.get_semantic_memory("update_test")
        assert retrieved["value"] == "Updated Value"
        assert retrieved["confidence"] == 0.9

    def test_database_stats(self, temp_db_path):
        """Test database statistics reporting."""
        user_id = "test_stats"

        store = SQLiteStore(temp_db_path)
        mm = MemoryManager(user_id=user_id, store=store)

        # Add some data
        for i in range(10):
            mm.store_semantic_memory(
                memory_id=f"stat_test_{i}",
                data=self.create_test_memory_data(f"Value {i}")
            )

        # Get database stats
        stats = store.get_stats()

        assert stats["total_memories"] >= 10  # At least our 10 memories
        assert stats["db_path"] == temp_db_path
        assert "db_size_mb" in stats
        assert stats["db_size_mb"] > 0


class TestIABProfilePersistence:
    """Test IAB profile generation persistence end-to-end."""

    @pytest.fixture
    def sample_csv_file(self, tmp_path):
        """Create sample CSV for testing."""
        csv_content = """ID,Date,From,Subject,Summary
email_1,2025-01-01,test@crypto.com,Bitcoin News,Cryptocurrency market analysis and blockchain developments
email_2,2025-01-02,news@tech.com,AI Breakthroughs,Latest artificial intelligence and machine learning innovations
email_3,2025-01-03,info@finance.com,Investment Tips,Stock market trends and portfolio management strategies"""

        csv_file = tmp_path / "iab_test.csv"
        csv_file.write_text(csv_content)
        return str(csv_file)

    def test_profile_persistence_across_runs(self, sample_csv_file, tmp_path, monkeypatch):
        """Test that IAB profile data persists across multiple runs."""
        # Setup temporary database
        temp_db = tmp_path / "profile_test.db"
        output_file1 = tmp_path / "profile_run1.json"
        output_file2 = tmp_path / "profile_run2.json"

        # Configure to use temporary database
        monkeypatch.setenv("MEMORY_BACKEND", "sqlite")
        monkeypatch.setenv("MEMORY_DATABASE_PATH", str(temp_db))

        user_id = "profile_test_user"

        # Run 1: Generate initial profile
        parser = EmailParser()
        parser.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file=str(output_file1),
            user_id=user_id
        )

        # Verify Run 1 created profile
        assert output_file1.exists()
        with open(output_file1) as f:
            profile1 = json.load(f)

        assert profile1["user_id"] == user_id
        run1_interest_count = len(profile1["interests"])

        # Run 2: Same user_id, should retrieve persisted data
        parser2 = EmailParser()
        parser2.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file=str(output_file2),
            user_id=user_id
        )

        # Verify Run 2 has same classifications (emails already processed)
        assert output_file2.exists()
        with open(output_file2) as f:
            profile2 = json.load(f)

        assert profile2["user_id"] == user_id
        run2_interest_count = len(profile2["interests"])

        # Should have same number of classifications
        assert run2_interest_count == run1_interest_count

        # Confidence scores should match (since same data)
        if run1_interest_count > 0:
            profile1_interests = {i["taxonomy_id"]: i["confidence"] for i in profile1["interests"]}
            profile2_interests = {i["taxonomy_id"]: i["confidence"] for i in profile2["interests"]}

            for tax_id in profile1_interests:
                if tax_id in profile2_interests:
                    assert profile1_interests[tax_id] == profile2_interests[tax_id]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
