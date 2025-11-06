#!/usr/bin/env python3
"""
Unit tests for IAB Taxonomy Loader.

Tests the taxonomy loading, parsing, and lookup functionality.
"""

import pytest
from pathlib import Path
from src.email_parser.utils.iab_taxonomy_loader import IABTaxonomyLoader, iab_taxonomy_loader
from src.email_parser.utils.singleton import Singleton


@pytest.fixture
def taxonomy_loader():
    """Fixture to create a taxonomy loader instance."""
    # Use the default path to the taxonomy file in project root
    return iab_taxonomy_loader


class TestIABTaxonomyLoader:
    """Test suite for IABTaxonomyLoader class."""

    def test_loader_initialization(self, taxonomy_loader):
        """Test that loader initializes successfully."""
        assert taxonomy_loader is not None
        assert taxonomy_loader.taxonomy_file_path.exists()
        assert len(taxonomy_loader.taxonomy_entries) > 0
        assert len(taxonomy_loader.purchase_classifications) > 0

    def test_taxonomy_entries_structure(self, taxonomy_loader):
        """Test that taxonomy entries have correct structure."""
        assert len(taxonomy_loader.taxonomy_entries) > 100

        # Check first entry structure
        entry = taxonomy_loader.taxonomy_entries[0]
        assert 'id' in entry
        assert 'parent_id' in entry
        assert 'name' in entry
        assert 'tier_1' in entry
        assert 'tier_2' in entry
        assert 'excel_row' in entry

    def test_taxonomy_by_id_lookup(self, taxonomy_loader):
        """Test lookup of taxonomy entries by ID."""
        # Test that we can look up entries
        assert len(taxonomy_loader.taxonomy_by_id) > 0

        # Get first entry and test lookup
        first_entry = taxonomy_loader.taxonomy_entries[0]
        if first_entry['id'] is not None:
            looked_up = taxonomy_loader.get_by_id(first_entry['id'])
            assert looked_up is not None
            assert looked_up['id'] == first_entry['id']

    def test_taxonomy_sections(self, taxonomy_loader):
        """Test that taxonomy is properly divided into sections."""
        sections = [
            'demographics',
            'household_data',
            'personal_attributes',
            'personal_finance',
            'interests',
            'purchase_intent'
        ]

        for section in sections:
            entries = taxonomy_loader.get_by_section(section)
            assert isinstance(entries, list)
            # At least some sections should have entries

        # Interests and purchase_intent should be the largest sections
        interests = taxonomy_loader.get_by_section('interests')
        purchase_intent = taxonomy_loader.get_by_section('purchase_intent')
        assert len(interests) > 100
        assert len(purchase_intent) > 100

    def test_demographics_section_range(self, taxonomy_loader):
        """Test that demographics section contains expected row range (11-62)."""
        demographics = taxonomy_loader.get_by_section('demographics')
        assert len(demographics) > 0

        # Check all demographics entries are in expected range
        for entry in demographics:
            assert 11 <= entry['excel_row'] <= 62

    def test_interests_section_range(self, taxonomy_loader):
        """Test that interests section contains expected row range (209-704)."""
        interests = taxonomy_loader.get_by_section('interests')
        assert len(interests) > 0

        # Check all interests entries are in expected range
        for entry in interests:
            assert 209 <= entry['excel_row'] <= 704

    def test_purchase_intent_section_range(self, taxonomy_loader):
        """Test that purchase_intent section contains expected row range (707-1568)."""
        purchase_intent = taxonomy_loader.get_by_section('purchase_intent')
        assert len(purchase_intent) > 0

        # Check all purchase_intent entries are in expected range
        for entry in purchase_intent:
            assert 707 <= entry['excel_row'] <= 1568

    def test_purchase_classifications(self, taxonomy_loader):
        """Test purchase intent classification codes."""
        classifications = taxonomy_loader.get_all_purchase_classifications()

        # Should have multiple classification codes
        assert len(classifications) > 0

        # Check that codes follow expected format
        for code, description in classifications.items():
            assert code.startswith(('PIPR', 'PIPF', 'PIPV', 'PIFI'))
            assert len(description) > 0

    def test_get_purchase_classification(self, taxonomy_loader):
        """Test retrieval of specific purchase classification."""
        all_classifications = taxonomy_loader.get_all_purchase_classifications()

        # Test retrieval of first classification code
        if all_classifications:
            first_code = list(all_classifications.keys())[0]
            description = taxonomy_loader.get_purchase_classification(first_code)
            assert description is not None
            assert description == all_classifications[first_code]

    def test_parent_child_relationships(self, taxonomy_loader):
        """Test parent-child relationship mapping."""
        # Find an entry with children
        for parent_id, child_ids in taxonomy_loader.parent_child_map.items():
            if len(child_ids) > 0:
                # Get children
                children = taxonomy_loader.get_children(parent_id)
                assert len(children) == len(child_ids)

                # Verify each child has correct parent_id
                for child in children:
                    assert child['parent_id'] == parent_id
                break

    def test_search_by_name(self, taxonomy_loader):
        """Test searching taxonomy entries by name."""
        # Search for common terms
        results = taxonomy_loader.search_by_name('education')
        assert len(results) > 0

        # Verify all results contain the search term
        for entry in results:
            assert 'education' in entry['name'].lower()

    def test_search_by_name_case_insensitive(self, taxonomy_loader):
        """Test that name search is case-insensitive."""
        results_lower = taxonomy_loader.search_by_name('education')
        results_upper = taxonomy_loader.search_by_name('EDUCATION')
        results_mixed = taxonomy_loader.search_by_name('Education')

        # All should return same results
        assert len(results_lower) == len(results_upper)
        assert len(results_lower) == len(results_mixed)

    def test_tier_structure(self, taxonomy_loader):
        """Test that entries have proper tier hierarchy."""
        # Find entries with multiple tiers
        multi_tier_entries = [
            e for e in taxonomy_loader.taxonomy_entries
            if e['tier_2'] != ''
        ]

        assert len(multi_tier_entries) > 0

        # Verify tier hierarchy is consistent
        for entry in multi_tier_entries[:10]:  # Check first 10
            # If tier_2 exists, tier_1 should also exist
            if entry['tier_2']:
                assert entry['tier_1']
            # If tier_3 exists, tier_2 should also exist
            if entry['tier_3']:
                assert entry['tier_2']

    def test_invalid_id_lookup(self, taxonomy_loader):
        """Test that invalid ID lookup returns None."""
        result = taxonomy_loader.get_by_id(999999)
        assert result is None

    def test_invalid_section_lookup(self, taxonomy_loader):
        """Test that invalid section lookup returns empty list."""
        result = taxonomy_loader.get_by_section('invalid_section')
        assert result == []

    def test_invalid_purchase_classification_lookup(self, taxonomy_loader):
        """Test that invalid classification code returns None."""
        result = taxonomy_loader.get_purchase_classification('INVALID')
        assert result is None


class TestErrorHandling:
    """Test error handling in taxonomy loader."""

    def test_missing_file_raises_error(self):
        """Test that missing taxonomy file raises FileNotFoundError."""
        # Clear the singleton instance to force re-initialization
        Singleton._instances = {}
        with pytest.raises(FileNotFoundError):
            IABTaxonomyLoader('/path/to/nonexistent/file.xlsx')

    def test_default_path_resolution(self):
        """Test that default path resolves correctly."""
        Singleton._instances = {}
        loader = IABTaxonomyLoader()
        assert loader.taxonomy_file_path.name == 'IABTL-Audience-Taxonomy-1.1-Final.xlsx'
        assert loader.taxonomy_file_path.exists()


class TestDataIntegrity:
    """Test data integrity and consistency."""

    def test_no_duplicate_ids(self, taxonomy_loader):
        """Test that there are no duplicate taxonomy IDs."""
        ids = [e['id'] for e in taxonomy_loader.taxonomy_entries if e['id'] is not None]
        assert len(ids) == len(set(ids)), "Found duplicate taxonomy IDs"

    def test_all_parent_ids_exist(self, taxonomy_loader):
        """Test that all parent_ids reference valid taxonomy entries."""
        valid_ids = set(e['id'] for e in taxonomy_loader.taxonomy_entries if e['id'] is not None)

        for entry in taxonomy_loader.taxonomy_entries:
            if entry['parent_id'] is not None:
                assert entry['parent_id'] in valid_ids, f"Entry {entry['id']} has invalid parent_id {entry['parent_id']}"

    def test_row_numbers_sequential(self, taxonomy_loader):
        """Test that excel_row numbers are in valid range."""
        for entry in taxonomy_loader.taxonomy_entries:
            # Excel rows should be reasonable (within 1-2000 range for this file)
            assert 1 <= entry['excel_row'] <= 2000

    def test_all_entries_have_name(self, taxonomy_loader):
        """Test that all entries have a name."""
        for entry in taxonomy_loader.taxonomy_entries:
            assert entry['name'], f"Entry {entry['id']} has empty name"
