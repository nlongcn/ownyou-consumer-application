"""
Integration tests for agent tool chains.

Tests tool usage patterns as agents would use them in practice.
"""

import pytest
import json
from src.email_parser.agents.tools import (
    search_demographics_taxonomy,
    validate_classification,
    get_tier_details
)


class TestToolChains:
    """Test tool usage patterns as agents would use them."""

    def test_search_then_validate_success(self):
        """Tool chain: search → pick match → validate → success."""
        # Step 1: Search for gender entries (guaranteed to exist)
        search_result = search_demographics_taxonomy.invoke({"keyword": "gender"})
        matches = json.loads(search_result)
        assert len(matches) > 0, "Search should find gender entries"

        # Step 2: Pick first match
        first_match = matches[0]

        # Step 3: Validate with correct value
        validation = validate_classification.invoke({
            "taxonomy_id": first_match["taxonomy_id"],
            "value": first_match["value"]
        })
        validation_data = json.loads(validation)

        assert validation_data["valid"] == True, \
            "Validation should pass when using taxonomy value"

    def test_search_then_validate_failure(self):
        """Tool chain: search → pick wrong value → validate → fail."""
        # Search for gender entries
        search_result = search_demographics_taxonomy.invoke({"keyword": "gender"})
        matches = json.loads(search_result)

        male_entry = next((m for m in matches if m["value"] == "Male"), None)
        assert male_entry is not None, "Should find Male entry"

        # Try to validate with WRONG value
        validation = validate_classification.invoke({
            "taxonomy_id": male_entry["taxonomy_id"],
            "value": "Female"  # Wrong value!
        })
        validation_data = json.loads(validation)

        assert validation_data["valid"] == False, \
            "Validation should fail for wrong value"
        assert validation_data["expected_value"] == "Male", \
            "Should return correct expected value"

    def test_search_get_details_validate(self):
        """Full tool chain: search → get details → validate."""
        # Search for bachelor's degree
        search_result = search_demographics_taxonomy.invoke({"keyword": "bachelor"})
        matches = json.loads(search_result)

        if len(matches) > 0:
            # Get details for first match
            details = get_tier_details.invoke({
                "taxonomy_id": matches[0]["taxonomy_id"]
            })
            details_data = json.loads(details)

            assert "error" not in details_data, "Should get valid details"

            # Validate using the value from details
            # Note: get_tier_details returns "name" field, search returns "value"
            # They should match for validation
            validation = validate_classification.invoke({
                "taxonomy_id": details_data["taxonomy_id"],
                "value": matches[0]["value"]  # Use value from search
            })
            validation_data = json.loads(validation)

            assert validation_data["valid"] == True, \
                "Validation should pass with correct value from search"

    def test_reflection_scenario(self):
        """Simulate agent reflection: search → validate fail → search again."""
        # First attempt: search with generic keyword
        result1 = search_demographics_taxonomy.invoke({"keyword": "education"})
        matches1 = json.loads(result1)

        if len(matches1) > 0:
            # Pick first entry
            first_entry = matches1[0]

            # Try to validate with a DIFFERENT education value
            # (simulating agent picking wrong one)
            validation1 = validate_classification.invoke({
                "taxonomy_id": first_entry["taxonomy_id"],
                "value": "High School Diploma"  # Might be wrong
            })
            validation_data1 = json.loads(validation1)

            if not validation_data1["valid"]:
                # Reflection: Agent sees validation failed
                # Agent searches again with more specific keyword
                result2 = search_demographics_taxonomy.invoke({
                    "keyword": validation_data1["expected_value"]
                })
                matches2 = json.loads(result2)

                # Find entry matching expected value
                correct_entry = next(
                    (m for m in matches2
                     if m["value"] == validation_data1["expected_value"]),
                    None
                )

                if correct_entry:
                    # Validate with correct value
                    validation2 = validate_classification.invoke({
                        "taxonomy_id": correct_entry["taxonomy_id"],
                        "value": correct_entry["value"]
                    })
                    validation_data2 = json.loads(validation2)

                    assert validation_data2["valid"] == True, \
                        "Second attempt should succeed after reflection"

    def test_multiple_sequential_searches(self):
        """Agent might search multiple times to narrow down results."""
        # Broad search
        result1 = search_demographics_taxonomy.invoke({"keyword": "age"})
        matches1 = json.loads(result1)

        # More specific search
        result2 = search_demographics_taxonomy.invoke({"keyword": "age 30"})
        matches2 = json.loads(result2)

        # Specific search should return fewer or equal results
        assert len(matches2) <= len(matches1), \
            "More specific search should not return MORE results"
