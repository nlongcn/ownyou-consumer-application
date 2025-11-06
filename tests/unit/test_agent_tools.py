"""
Unit tests for agent tools.

Tests each tool independently to ensure correct behavior.
"""

import pytest
import json
from src.email_parser.agents.tools import (
    search_demographics_taxonomy,
    search_household_taxonomy,
    search_interests_taxonomy,
    search_purchase_taxonomy,
    validate_classification,
    get_tier_details
)


class TestDemographicsSearch:
    """Test demographics taxonomy search tool."""

    def test_search_age_keyword(self):
        """Should find age range entries."""
        result = search_demographics_taxonomy.invoke({"keyword": "age"})
        data = json.loads(result)

        assert len(data) > 0, "Should find age-related entries"
        # Age entries exist in demographics section (actual IDs vary by taxonomy)

    def test_search_gender_keyword(self):
        """Should find gender entries including Male (ID 50)."""
        result = search_demographics_taxonomy.invoke({"keyword": "male"})
        data = json.loads(result)

        assert len(data) > 0, "Should find gender entries"
        assert any(item["value"] == "Male" for item in data), \
            "Should include Male entry"
        assert any(item["taxonomy_id"] == 50 for item in data), \
            "Should include taxonomy ID 50 for Male"

    def test_search_returns_max_10(self):
        """Should limit results to 10 entries."""
        result = search_demographics_taxonomy.invoke({"keyword": "e"})
        data = json.loads(result)

        assert len(data) <= 10, "Should return max 10 results"

    def test_search_case_insensitive(self):
        """Should match regardless of case."""
        result1 = search_demographics_taxonomy.invoke({"keyword": "MALE"})
        result2 = search_demographics_taxonomy.invoke({"keyword": "male"})

        assert result1 == result2, "Search should be case-insensitive"


class TestValidationTool:
    """Test classification validation tool."""

    def test_validate_correct_pair(self):
        """Should pass for correct taxonomy_id/value pair."""
        result = validate_classification.invoke({
            "taxonomy_id": 50,
            "value": "Male"
        })
        data = json.loads(result)

        assert data["valid"] == True, "Validation should pass for correct pair"
        assert data["taxonomy_id"] == 50
        assert data["expected_value"] == "Male"

    def test_validate_wrong_value(self):
        """Should fail and return correct value."""
        result = validate_classification.invoke({
            "taxonomy_id": 50,
            "value": "Female"
        })
        data = json.loads(result)

        assert data["valid"] == False, "Validation should fail for wrong value"
        assert data["expected_value"] == "Male"
        assert data["provided_value"] == "Female"
        assert "mismatch" in data["reason"].lower()

    def test_validate_nonexistent_id(self):
        """Should fail for non-existent taxonomy ID."""
        result = validate_classification.invoke({
            "taxonomy_id": 99999,
            "value": "NonExistent"
        })
        data = json.loads(result)

        assert data["valid"] == False
        assert "not found" in data["reason"].lower()


class TestOtherSearchTools:
    """Test household, interests, purchase search tools."""

    def test_search_household_income(self):
        """Should find household income entries."""
        result = search_household_taxonomy.invoke({"keyword": "income"})
        data = json.loads(result)

        assert len(data) > 0, "Should find income-related entries"
        # Household income entries exist in household section

    def test_search_interests_technology(self):
        """Should find technology-related interests."""
        result = search_interests_taxonomy.invoke({"keyword": "technology"})
        data = json.loads(result)

        assert len(data) > 0, "Should find technology-related entries"
        # Interests section has many technology-related entries

    def test_search_purchase_electronics(self):
        """Should find electronics product categories."""
        result = search_purchase_taxonomy.invoke({"keyword": "electronics"})
        data = json.loads(result)

        assert len(data) > 0, "Should find electronics categories"


class TestTierDetails:
    """Test get_tier_details tool."""

    def test_get_demographics_details(self):
        """Should return full entry for demographics ID."""
        result = get_tier_details.invoke({"taxonomy_id": 50})
        data = json.loads(result)

        assert "error" not in data, "Should not return error for valid ID"
        assert data["taxonomy_id"] == 50
        assert data["tier_1"] == "Demographic"
        assert data["tier_2"] == "Gender"
        assert data["tier_3"] == "Male"

    def test_get_nonexistent_id(self):
        """Should return error for invalid ID."""
        result = get_tier_details.invoke({"taxonomy_id": 99999})
        data = json.loads(result)

        assert "error" in data, "Should return error for invalid ID"


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_search_no_matches(self):
        """Should return empty array for no matches."""
        result = search_demographics_taxonomy.invoke({"keyword": "xyzabc123"})
        data = json.loads(result)

        assert isinstance(data, list), "Should return a list"
        assert len(data) == 0, "Should return empty list for no matches"

    def test_all_tools_return_json_strings(self):
        """All tools should return JSON strings (not dicts)."""
        # This is critical for LangChain compatibility

        result1 = search_demographics_taxonomy.invoke({"keyword": "age"})
        assert isinstance(result1, str), "search_demographics should return string"

        result2 = search_household_taxonomy.invoke({"keyword": "income"})
        assert isinstance(result2, str), "search_household should return string"

        result3 = search_interests_taxonomy.invoke({"keyword": "tech"})
        assert isinstance(result3, str), "search_interests should return string"

        result4 = search_purchase_taxonomy.invoke({"keyword": "food"})
        assert isinstance(result4, str), "search_purchase should return string"

        result5 = validate_classification.invoke({"taxonomy_id": 50, "value": "Male"})
        assert isinstance(result5, str), "validate_classification should return string"

        result6 = get_tier_details.invoke({"taxonomy_id": 50})
        assert isinstance(result6, str), "get_tier_details should return string"
