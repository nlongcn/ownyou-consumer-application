#!/usr/bin/env python3
"""
Unit tests for profile_tier_formatter module.

Tests the presentation layer transformation from flat classification lists
to tiered structure (primary/alternatives).
"""

import unittest
from datetime import datetime
from src.email_parser.utils.profile_tier_formatter import (
    format_tiered_demographics,
    format_tiered_household,
    format_tiered_interests,
    format_tiered_purchase_intent,
    add_tiered_structure_to_profile,
    _format_selection
)


class TestFormatSelection(unittest.TestCase):
    """Test _format_selection helper."""

    def test_format_selection_complete(self):
        """Test formatting a complete selection dict."""
        selection = {
            "taxonomy_id": 21,
            "tier_path": "Demographic | Female",
            "category_path": "Demographic | Female",
            "value": "Female",
            "confidence": 0.99,
            "evidence_count": 5,
            "last_validated": "2025-01-01T00:00:00",
            "days_since_validation": 10,
            "tier_depth": 2,
            "granularity_score": 0.99,
            "classification_type": "primary"
        }

        result = _format_selection(selection)

        self.assertEqual(result["taxonomy_id"], 21)
        self.assertEqual(result["tier_path"], "Demographic | Female")
        self.assertEqual(result["value"], "Female")
        self.assertEqual(result["confidence"], 0.99)
        self.assertEqual(result["evidence_count"], 5)
        self.assertEqual(result["classification_type"], "primary")
        self.assertIsNone(result["confidence_delta"])

    def test_format_selection_alternative(self):
        """Test formatting an alternative classification."""
        selection = {
            "taxonomy_id": 20,
            "value": "Male",
            "confidence": 0.75,
            "tier_depth": 2,
            "granularity_score": 0.75,
            "classification_type": "alternative",
            "confidence_delta": 0.24
        }

        result = _format_selection(selection)

        self.assertEqual(result["classification_type"], "alternative")
        self.assertEqual(result["confidence_delta"], 0.24)


class TestFormatTieredDemographics(unittest.TestCase):
    """Test format_tiered_demographics function."""

    def test_format_empty_demographics(self):
        """Test with no demographics memories."""
        result = format_tiered_demographics([])
        self.assertEqual(result, {})

    def test_format_gender_demographics(self):
        """Test formatting gender demographics.

        NOTE: Male and Female are separate tier_2 groups in the taxonomy,
        so they create separate gender entries, not primary/alternative.
        This test uses only Female to show proper formatting.
        """
        memories = [
            {
                "taxonomy_id": 21,
                "tier_1": "Demographic",
                "tier_2": "Female",
                "tier_3": "",
                "tier_4": "",
                "tier_5": "",
                "value": "Female",
                "confidence": 0.99,
                "evidence_count": 5,
                "last_validated": "2025-01-01T00:00:00",
                "days_since_validation": 10
            }
        ]

        result = format_tiered_demographics(memories)

        # Should have gender field
        self.assertIn("gender", result)
        self.assertIn("primary", result["gender"])
        self.assertIn("alternatives", result["gender"])
        self.assertIn("selection_method", result["gender"])

        # Primary should be Female
        self.assertEqual(result["gender"]["primary"]["value"], "Female")
        self.assertEqual(result["gender"]["primary"]["confidence"], 0.99)

        # No alternatives since only one gender classification
        self.assertEqual(len(result["gender"]["alternatives"]), 0)


class TestFormatTieredHousehold(unittest.TestCase):
    """Test format_tiered_household function."""

    def test_format_empty_household(self):
        """Test with no household memories."""
        result = format_tiered_household([])
        self.assertEqual(result, {})

    def test_format_income_household(self):
        """Test formatting income household data."""
        memories = [
            {
                "taxonomy_id": 111,
                "tier_1": "Household",
                "tier_2": "$100,000-$149,999",
                "tier_3": "",
                "tier_4": "",
                "tier_5": "",
                "value": "$100,000-$149,999",
                "confidence": 0.85,
                "evidence_count": 3,
                "last_validated": "2025-01-01T00:00:00",
                "days_since_validation": 5
            }
        ]

        result = format_tiered_household(memories)

        # Should have income field
        self.assertIn("income", result)
        self.assertEqual(result["income"]["primary"]["value"], "$100,000-$149,999")


class TestFormatTieredInterests(unittest.TestCase):
    """Test format_tiered_interests function."""

    def test_format_empty_interests(self):
        """Test with no interest memories."""
        result = format_tiered_interests([])
        self.assertEqual(result, [])

    def test_format_interests_sorted_by_granularity(self):
        """Test interests are sorted by granularity score."""
        memories = [
            {
                "taxonomy_id": 450,
                "tier_1": "Interest",
                "tier_2": "Technology",
                "tier_3": "",
                "tier_4": "",
                "tier_5": "",
                "value": "Technology",
                "confidence": 0.75,  # Lower depth
                "evidence_count": 5,
                "last_validated": "2025-01-01T00:00:00",
                "days_since_validation": 10
            },
            {
                "taxonomy_id": 451,
                "tier_1": "Interest",
                "tier_2": "Careers",
                "tier_3": "Remote Working",
                "tier_4": "",
                "tier_5": "",
                "value": "Remote Working",
                "confidence": 0.95,  # Higher depth (tier_3)
                "evidence_count": 3,
                "last_validated": "2025-01-01T00:00:00",
                "days_since_validation": 5
            }
        ]

        result = format_tiered_interests(memories)

        # Should return list sorted by granularity score
        self.assertEqual(len(result), 2)

        # First item should have highest granularity score
        # Remote Working: 0.95 + (3 * 0.05) = 1.10
        # Technology: 0.75 + (2 * 0.05) = 0.85
        self.assertEqual(result[0]["primary"]["value"], "Remote Working")
        self.assertGreater(
            result[0]["granularity_score"],
            result[1]["granularity_score"]
        )


class TestFormatTieredPurchaseIntent(unittest.TestCase):
    """Test format_tiered_purchase_intent function."""

    def test_format_empty_purchase_intent(self):
        """Test with no purchase intent memories."""
        result = format_tiered_purchase_intent([])
        self.assertEqual(result, [])

    def test_format_purchase_intent_with_flag(self):
        """Test purchase intent includes purchase_intent_flag."""
        memories = [
            {
                "taxonomy_id": 900,
                "tier_1": "Purchase Intent",
                "tier_2": "Electronics",
                "tier_3": "Laptops",
                "tier_4": "",
                "tier_5": "",
                "value": "Laptops",
                "confidence": 0.90,
                "evidence_count": 2,
                "last_validated": "2025-01-01T00:00:00",
                "days_since_validation": 3,
                "purchase_intent_flag": "High"
            }
        ]

        result = format_tiered_purchase_intent(memories)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["primary"]["value"], "Laptops")
        self.assertEqual(result[0]["purchase_intent_flag"], "High")


class TestAddTieredStructureToProfile(unittest.TestCase):
    """Test add_tiered_structure_to_profile function."""

    def test_add_tiered_structure_empty(self):
        """Test adding tiered structure with no memories."""
        profile_dict = {"user_id": "test_user"}
        memories = {
            "demographics": [],
            "household": [],
            "interests": [],
            "purchase_intent": []
        }

        result = add_tiered_structure_to_profile(profile_dict, memories)

        # Should add schema_version and tiered_classifications
        self.assertEqual(result["schema_version"], "2.0")
        self.assertIn("tiered_classifications", result)
        self.assertEqual(result["tiered_classifications"]["demographics"], {})
        self.assertEqual(result["tiered_classifications"]["interests"], [])

    def test_add_tiered_structure_with_data(self):
        """Test adding tiered structure with real memories."""
        profile_dict = {"user_id": "test_user"}
        memories = {
            "demographics": [
                {
                    "taxonomy_id": 21,
                    "tier_1": "Demographic",
                    "tier_2": "Female",
                    "tier_3": "",
                    "tier_4": "",
                    "tier_5": "",
                    "value": "Female",
                    "confidence": 0.99,
                    "evidence_count": 5,
                    "last_validated": "2025-01-01T00:00:00",
                    "days_since_validation": 10
                }
            ],
            "household": [],
            "interests": [
                {
                    "taxonomy_id": 450,
                    "tier_1": "Interest",
                    "tier_2": "Technology",
                    "tier_3": "",
                    "tier_4": "",
                    "tier_5": "",
                    "value": "Technology",
                    "confidence": 0.85,
                    "evidence_count": 5,
                    "last_validated": "2025-01-01T00:00:00",
                    "days_since_validation": 10
                }
            ],
            "purchase_intent": []
        }

        result = add_tiered_structure_to_profile(profile_dict, memories)

        # Should have schema version
        self.assertEqual(result["schema_version"], "2.0")

        # Should have tiered demographics
        self.assertIn("gender", result["tiered_classifications"]["demographics"])

        # Should have tiered interests
        self.assertEqual(len(result["tiered_classifications"]["interests"]), 1)
        self.assertEqual(
            result["tiered_classifications"]["interests"][0]["primary"]["value"],
            "Technology"
        )


if __name__ == '__main__':
    unittest.main()
