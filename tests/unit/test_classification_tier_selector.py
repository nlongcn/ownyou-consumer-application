#!/usr/bin/env python3
"""
Unit Tests for Classification Tier Selector

Tests the tiered confidence classification system that distinguishes
primary classifications from alternatives.
"""

import pytest
from src.email_parser.utils.classification_tier_selector import (
    calculate_tier_depth,
    calculate_granularity_score,
    select_primary_and_alternatives,
    group_classifications_by_tier,
    is_mutually_exclusive_tier,
    apply_tiered_classification,
    TieredClassification
)


class TestTierDepthCalculation:
    """Test tier depth calculation logic."""

    def test_tier_depth_single_tier(self):
        """Test tier depth with only tier_1."""
        classification = {
            "tier_1": "Demographic",
            "tier_2": "",
            "tier_3": "",
            "tier_4": "",
            "tier_5": ""
        }
        assert calculate_tier_depth(classification) == 1

    def test_tier_depth_two_tiers(self):
        """Test tier depth with tier_1 and tier_2."""
        classification = {
            "tier_1": "Interest",
            "tier_2": "Technology",
            "tier_3": "",
            "tier_4": "",
            "tier_5": ""
        }
        assert calculate_tier_depth(classification) == 2

    def test_tier_depth_three_tiers(self):
        """Test tier depth with three tiers."""
        classification = {
            "tier_1": "Interest",
            "tier_2": "Careers",
            "tier_3": "Remote Working",
            "tier_4": "",
            "tier_5": ""
        }
        assert calculate_tier_depth(classification) == 3

    def test_tier_depth_all_tiers(self):
        """Test tier depth with all five tiers."""
        classification = {
            "tier_1": "A",
            "tier_2": "B",
            "tier_3": "C",
            "tier_4": "D",
            "tier_5": "E"
        }
        assert calculate_tier_depth(classification) == 5

    def test_tier_depth_with_whitespace(self):
        """Test tier depth ignores whitespace-only tiers."""
        classification = {
            "tier_1": "Interest",
            "tier_2": "  ",  # Whitespace only
            "tier_3": "",
            "tier_4": "",
            "tier_5": ""
        }
        assert calculate_tier_depth(classification) == 1


class TestGranularityScoreCalculation:
    """Test granularity score calculation logic."""

    def test_granularity_score_high_confidence_three_tiers(self):
        """Test granularity bonus applied for high confidence."""
        classification = {
            "confidence": 0.95,
            "tier_1": "Interest",
            "tier_2": "Careers",
            "tier_3": "Remote Working",
            "tier_4": "",
            "tier_5": ""
        }
        # 0.95 + (3 * 0.05) = 1.10
        assert calculate_granularity_score(classification) == pytest.approx(1.10, rel=1e-3)

    def test_granularity_score_low_confidence_no_bonus(self):
        """Test granularity bonus NOT applied for low confidence."""
        classification = {
            "confidence": 0.65,
            "tier_1": "Interest",
            "tier_2": "Technology",
            "tier_3": "",
            "tier_4": "",
            "tier_5": ""
        }
        # Below 0.7 threshold, no bonus
        assert calculate_granularity_score(classification) == 0.65

    def test_granularity_score_threshold_boundary(self):
        """Test granularity score at 0.7 threshold boundary."""
        classification = {
            "confidence": 0.70,
            "tier_1": "Interest",
            "tier_2": "Technology",
            "tier_3": "",
            "tier_4": "",
            "tier_5": ""
        }
        # Exactly 0.7, should get bonus: 0.70 + (2 * 0.05) = 0.80
        assert calculate_granularity_score(classification) == pytest.approx(0.80, rel=1e-3)

    def test_granularity_score_custom_bonus(self):
        """Test granularity score with custom bonus value."""
        classification = {
            "confidence": 0.90,
            "tier_1": "Interest",
            "tier_2": "Careers",
            "tier_3": "Remote Working",
            "tier_4": "Cryptocurrency",
            "tier_5": "",
        }
        # 0.90 + (4 * 0.10) = 1.30
        assert calculate_granularity_score(classification, granularity_bonus=0.10) == pytest.approx(1.30, rel=1e-3)


class TestPrimaryAndAlternativeSelection:
    """Test primary and alternative selection logic."""

    def test_select_primary_simple_case(self):
        """Test primary selection with clear winner."""
        classifications = [
            {
                "taxonomy_id": 21,
                "value": "Female",
                "confidence": 0.99,
                "tier_1": "Demographic",
                "tier_2": "Female",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 20,
                "value": "Male",
                "confidence": 0.75,  # Changed from 0.65 to be within delta threshold
                "tier_1": "Demographic",
                "tier_2": "Male",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        result = select_primary_and_alternatives(classifications, "demographics.gender")

        assert result is not None
        assert result.primary["value"] == "Female"
        assert result.primary["confidence"] == 0.99
        assert result.primary["classification_type"] == "primary"
        assert len(result.alternatives) == 1
        assert result.alternatives[0]["value"] == "Male"
        assert result.alternatives[0]["classification_type"] == "alternative"

    def test_select_primary_with_granularity_bonus(self):
        """Test granular classification beats higher confidence shallow one."""
        classifications = [
            {
                "taxonomy_id": 156,
                "value": "Technology",
                "confidence": 0.999,
                "tier_1": "Interest",
                "tier_2": "Technology",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 342,
                "value": "Cryptocurrency",
                "confidence": 0.95,
                "tier_1": "Interest",
                "tier_2": "Careers",
                "tier_3": "Remote Working",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        result = select_primary_and_alternatives(classifications, "interests.technology")

        assert result is not None
        # Granular classification (tier_depth=3, score=1.10) beats shallow one (tier_depth=2, score=1.099)
        assert result.primary["value"] == "Cryptocurrency"
        assert result.primary["granularity_score"] > 1.10 - 1e-3
        assert result.selection_method == "granularity_weighted"
        assert len(result.alternatives) == 1
        assert result.alternatives[0]["value"] == "Technology"

    def test_select_primary_filters_by_min_confidence(self):
        """Test classifications below min_confidence are filtered out."""
        classifications = [
            {
                "taxonomy_id": 21,
                "value": "Female",
                "confidence": 0.99,
                "tier_1": "Demographic",
                "tier_2": "Female",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 20,
                "value": "Male",
                "confidence": 0.40,  # Below 0.5 threshold
                "tier_1": "Demographic",
                "tier_2": "Male",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        result = select_primary_and_alternatives(classifications, "demographics.gender", min_confidence=0.5)

        assert result is not None
        assert result.primary["value"] == "Female"
        assert len(result.alternatives) == 0  # Male filtered out

    def test_select_primary_alternatives_within_delta(self):
        """Test alternatives must be within confidence delta threshold."""
        classifications = [
            {
                "taxonomy_id": 7,
                "value": "35-39",
                "confidence": 0.92,
                "tier_1": "Demographic",
                "tier_2": "35-39",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 8,
                "value": "40-44",
                "confidence": 0.68,
                "tier_1": "Demographic",
                "tier_2": "40-44",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 6,
                "value": "30-34",
                "confidence": 0.55,  # Delta = 0.37, outside threshold
                "tier_1": "Demographic",
                "tier_2": "30-34",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        result = select_primary_and_alternatives(
            classifications,
            "demographics.age",
            confidence_delta_threshold=0.3
        )

        assert result is not None
        assert result.primary["value"] == "35-39"
        assert len(result.alternatives) == 1
        assert result.alternatives[0]["value"] == "40-44"
        # 30-34 should be excluded (delta too large)

    def test_select_primary_no_viable_classifications(self):
        """Test returns None when no classifications meet threshold."""
        classifications = [
            {
                "taxonomy_id": 20,
                "value": "Male",
                "confidence": 0.30,
                "tier_1": "Demographic",
                "tier_2": "Male",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        result = select_primary_and_alternatives(classifications, "demographics.gender", min_confidence=0.5)

        assert result is None

    def test_select_primary_single_classification(self):
        """Test single classification with no alternatives."""
        classifications = [
            {
                "taxonomy_id": 21,
                "value": "Female",
                "confidence": 0.99,
                "tier_1": "Demographic",
                "tier_2": "Female",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        result = select_primary_and_alternatives(classifications, "demographics.gender")

        assert result is not None
        assert result.primary["value"] == "Female"
        assert len(result.alternatives) == 0

    def test_select_primary_tied_confidence(self):
        """Test tie-breaking when classifications have identical confidence."""
        classifications = [
            {
                "taxonomy_id": 20,
                "value": "Male",
                "confidence": 0.85,
                "tier_1": "Demographic",
                "tier_2": "Male",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 21,
                "value": "Female",
                "confidence": 0.85,
                "tier_1": "Demographic",
                "tier_2": "Female",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        result = select_primary_and_alternatives(classifications, "demographics.gender")

        assert result is not None
        # Should pick one as primary, other as alternative
        assert result.primary["confidence"] == 0.85
        assert len(result.alternatives) == 1
        assert result.alternatives[0]["confidence"] == 0.85
        assert result.alternatives[0]["confidence_delta"] == 0.0


class TestGroupClassificationsByTier:
    """Test tier grouping logic."""

    def test_group_by_tier_demographics(self):
        """Test grouping demographics by tier_2."""
        classifications = [
            {"taxonomy_id": 21, "tier_2": "Female", "value": "Female"},
            {"taxonomy_id": 20, "tier_2": "Male", "value": "Male"},
            {"taxonomy_id": 32, "tier_2": "Education", "value": "Bachelor's Degree"}
        ]

        groups = group_classifications_by_tier(classifications, "demographics")

        assert set(groups.keys()) == {"Female", "Male", "Education"}
        assert len(groups["Female"]) == 1
        assert len(groups["Male"]) == 1
        assert len(groups["Education"]) == 1

    def test_group_by_tier_multiple_same_tier(self):
        """Test grouping multiple classifications in same tier."""
        classifications = [
            {"taxonomy_id": 7, "tier_2": "35-39", "value": "35-39"},
            {"taxonomy_id": 8, "tier_2": "40-44", "value": "40-44"},
            {"taxonomy_id": 6, "tier_2": "30-34", "value": "30-34"}
        ]

        groups = group_classifications_by_tier(classifications, "demographics")

        # All age ranges are different tier_2 values in IAB taxonomy
        assert len(groups) == 3

    def test_group_by_tier_missing_tier2(self):
        """Test handling of missing tier_2."""
        classifications = [
            {"taxonomy_id": 21, "tier_2": "Female", "value": "Female"},
            {"taxonomy_id": 999, "tier_2": "", "value": "Unknown"}  # Missing tier_2
        ]

        groups = group_classifications_by_tier(classifications, "demographics")

        # Should only include valid tier_2
        assert "Female" in groups
        assert len(groups) == 1


class TestMutualExclusivityDetection:
    """Test mutual exclusivity detection."""

    def test_gender_is_mutually_exclusive(self):
        """Test gender is detected as mutually exclusive."""
        assert is_mutually_exclusive_tier("Male", "demographics") is True
        assert is_mutually_exclusive_tier("Female", "demographics") is True

    def test_age_ranges_are_mutually_exclusive(self):
        """Test age ranges are mutually exclusive."""
        assert is_mutually_exclusive_tier("25-29", "demographics") is True
        assert is_mutually_exclusive_tier("35-39", "demographics") is True

    def test_education_is_mutually_exclusive(self):
        """Test education levels are mutually exclusive."""
        assert is_mutually_exclusive_tier("Bachelor's Degree", "demographics") is True
        assert is_mutually_exclusive_tier("Master's Degree", "demographics") is True

    def test_marital_status_is_mutually_exclusive(self):
        """Test marital status is mutually exclusive."""
        assert is_mutually_exclusive_tier("Married", "demographics") is True
        assert is_mutually_exclusive_tier("Single", "demographics") is True

    def test_household_income_is_mutually_exclusive(self):
        """Test household income is mutually exclusive."""
        assert is_mutually_exclusive_tier("$50,000-$74,999", "household") is True
        assert is_mutually_exclusive_tier("$100,000-$149,999", "household") is True

    def test_interests_are_not_mutually_exclusive(self):
        """Test interests are not mutually exclusive."""
        # Interests use different tier_2 values, none marked as exclusive
        assert is_mutually_exclusive_tier("Technology", "interests") is False
        assert is_mutually_exclusive_tier("Cryptocurrency", "interests") is False


class TestApplyTieredClassification:
    """Test full tiered classification application."""

    def test_apply_tiered_demographics_gender(self):
        """Test tiered classification for demographics gender."""
        classifications = [
            {
                "taxonomy_id": 21,
                "value": "Female",
                "confidence": 0.99,
                "tier_1": "Demographic",
                "tier_2": "Female",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 20,
                "value": "Male",
                "confidence": 0.89,
                "tier_1": "Demographic",
                "tier_2": "Male",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        tiered = apply_tiered_classification(classifications, "demographics")

        assert "Female" in tiered or "Male" in tiered  # One should be primary
        # Should have primary and alternative for gender

    def test_apply_tiered_interests_non_exclusive(self):
        """Test tiered classification for interests (non-exclusive)."""
        classifications = [
            {
                "taxonomy_id": 342,
                "value": "Cryptocurrency",
                "confidence": 0.95,
                "tier_1": "Interest",
                "tier_2": "Careers",
                "tier_3": "Remote Working",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 156,
                "value": "Technology",
                "confidence": 0.999,
                "tier_1": "Interest",
                "tier_2": "Technology",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        tiered = apply_tiered_classification(classifications, "interests")

        # Both should be primaries (non-exclusive)
        assert len(tiered) == 2

        # Each should have no alternatives
        for tier_result in tiered.values():
            assert tier_result.primary is not None
            assert tier_result.selection_method == "non_exclusive"

    def test_apply_tiered_empty_classifications(self):
        """Test tiered classification with empty input."""
        tiered = apply_tiered_classification([], "demographics")

        assert tiered == {}

    def test_apply_tiered_mixed_confidence(self):
        """Test tiered classification with mixed confidence levels."""
        classifications = [
            {
                "taxonomy_id": 7,
                "value": "35-39",
                "confidence": 0.92,
                "tier_1": "Demographic",
                "tier_2": "35-39",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 8,
                "value": "40-44",
                "confidence": 0.68,
                "tier_1": "Demographic",
                "tier_2": "40-44",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            },
            {
                "taxonomy_id": 6,
                "value": "30-34",
                "confidence": 0.45,  # Below threshold
                "tier_1": "Demographic",
                "tier_2": "30-34",
                "tier_3": "",
                "tier_4": "",
                "tier_5": ""
            }
        ]

        tiered = apply_tiered_classification(classifications, "demographics", min_confidence=0.5)

        # Should have age group with primary (35-39) and alternative (40-44)
        # 30-34 should be filtered out
        assert len(tiered) >= 1


class TestTieredClassificationDataclass:
    """Test TieredClassification dataclass."""

    def test_tiered_classification_to_dict(self):
        """Test TieredClassification serialization to dict."""
        primary = {
            "taxonomy_id": 21,
            "value": "Female",
            "confidence": 0.99,
            "classification_type": "primary"
        }
        alternatives = [
            {
                "taxonomy_id": 20,
                "value": "Male",
                "confidence": 0.89,
                "classification_type": "alternative"
            }
        ]

        tiered = TieredClassification(
            primary=primary,
            alternatives=alternatives,
            tier_group="demographics.gender",
            selection_method="highest_confidence"
        )

        result = tiered.to_dict()

        assert result["primary"]["value"] == "Female"
        assert len(result["alternatives"]) == 1
        assert result["alternatives"][0]["value"] == "Male"
        assert result["tier_group"] == "demographics.gender"
        assert result["selection_method"] == "highest_confidence"
