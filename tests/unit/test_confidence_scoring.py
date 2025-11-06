#!/usr/bin/env python3
"""
Unit Tests for Confidence Scoring Engine

Tests all confidence update formulas and edge cases.

Reference: src/email_parser/memory/confidence.py
"""

import pytest
from datetime import datetime, timedelta
from src.email_parser.memory.confidence import (
    update_confidence,
    apply_temporal_decay,
    calculate_days_since_validation,
    should_mark_for_review,
    recalibrate_confidence_with_decay,
    combine_evidence_updates,
    initialize_confidence,
)


class TestUpdateConfidence:
    """Test confidence updates with different evidence types."""

    def test_confirming_evidence_increases_confidence(self):
        """Confirming evidence should increase confidence."""
        result = update_confidence(0.75, 0.8, "confirming")
        # Formula: 0.75 + (1 - 0.75) * 0.8 * 0.3 = 0.75 + 0.06 = 0.81
        assert result == pytest.approx(0.81, abs=0.001)

    def test_confirming_evidence_near_max(self):
        """Confirming evidence near max confidence should still increase slightly."""
        result = update_confidence(0.95, 0.9, "confirming")
        # Formula: 0.95 + (1 - 0.95) * 0.9 * 0.3 = 0.95 + 0.0135 = 0.9635
        assert result == pytest.approx(0.9635, abs=0.001)

    def test_confirming_evidence_at_max(self):
        """Confirming evidence at max confidence stays at 1.0."""
        result = update_confidence(1.0, 0.8, "confirming")
        assert result == 1.0

    def test_contradicting_evidence_decreases_confidence(self):
        """Contradicting evidence should decrease confidence."""
        result = update_confidence(0.75, 0.6, "contradicting")
        # Formula: 0.75 * (1 - 0.6 * 0.5) = 0.75 * 0.7 = 0.525
        assert result == pytest.approx(0.525, abs=0.001)

    def test_contradicting_evidence_near_min(self):
        """Contradicting evidence near min confidence should still decrease."""
        result = update_confidence(0.10, 0.8, "contradicting")
        # Formula: 0.10 * (1 - 0.8 * 0.5) = 0.10 * 0.6 = 0.06
        assert result == pytest.approx(0.06, abs=0.001)

    def test_contradicting_evidence_at_min(self):
        """Contradicting evidence at min confidence stays at 0.0."""
        result = update_confidence(0.0, 0.8, "contradicting")
        assert result == 0.0

    def test_neutral_evidence_no_change(self):
        """Neutral evidence should not change confidence."""
        result = update_confidence(0.75, 0.5, "neutral")
        assert result == 0.75

    def test_confirming_weak_evidence(self):
        """Weak confirming evidence should have minimal impact."""
        result = update_confidence(0.75, 0.1, "confirming")
        # Formula: 0.75 + (1 - 0.75) * 0.1 * 0.3 = 0.75 + 0.0075 = 0.7575
        assert result == pytest.approx(0.7575, abs=0.001)

    def test_contradicting_weak_evidence(self):
        """Weak contradicting evidence should have minimal impact."""
        result = update_confidence(0.75, 0.1, "contradicting")
        # Formula: 0.75 * (1 - 0.1 * 0.5) = 0.75 * 0.95 = 0.7125
        assert result == pytest.approx(0.7125, abs=0.001)

    def test_bounds_enforcement_upper(self):
        """Confidence cannot exceed 1.0."""
        # This shouldn't happen mathematically, but test bounds enforcement
        result = update_confidence(0.99, 1.0, "confirming")
        assert result <= 1.0

    def test_bounds_enforcement_lower(self):
        """Confidence cannot go below 0.0."""
        result = update_confidence(0.01, 1.0, "contradicting")
        assert result >= 0.0

    def test_invalid_confidence_raises(self):
        """Invalid confidence should raise ValueError."""
        with pytest.raises(ValueError, match="current_confidence must be"):
            update_confidence(1.5, 0.8, "confirming")

        with pytest.raises(ValueError, match="current_confidence must be"):
            update_confidence(-0.1, 0.8, "confirming")

    def test_invalid_evidence_strength_raises(self):
        """Invalid evidence strength should raise ValueError."""
        with pytest.raises(ValueError, match="new_evidence_strength must be"):
            update_confidence(0.75, 1.5, "confirming")

        with pytest.raises(ValueError, match="new_evidence_strength must be"):
            update_confidence(0.75, -0.1, "confirming")

    def test_invalid_evidence_type_raises(self):
        """Invalid evidence type should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid evidence_type"):
            update_confidence(0.75, 0.8, "invalid")


class TestTemporalDecay:
    """Test temporal decay calculations."""

    def test_no_decay_same_day(self):
        """No decay on same day (0 days)."""
        result = apply_temporal_decay(0.85, 0)
        assert result == 0.85

    def test_decay_after_one_week(self):
        """1% decay after 1 week (7 days)."""
        result = apply_temporal_decay(0.85, 7)
        # Formula: 0.85 * (1 - 0.01) = 0.8415
        assert result == pytest.approx(0.8415, abs=0.0001)

    def test_decay_after_one_month(self):
        """~4.3% decay after 1 month (30 days)."""
        result = apply_temporal_decay(0.85, 30)
        # 30 days = 4.286 weeks
        # decay_rate = 0.01 * 4.286 = 0.04286
        # 0.85 * (1 - 0.04286) = 0.813571
        assert result == pytest.approx(0.8136, abs=0.001)

    def test_decay_after_three_months(self):
        """~13% decay after 3 months (90 days)."""
        result = apply_temporal_decay(0.85, 90)
        # 90 days = 12.857 weeks
        # decay_rate = 0.01 * 12.857 = 0.12857
        # 0.85 * (1 - 0.12857) = 0.7407
        assert result == pytest.approx(0.7407, abs=0.001)

    def test_decay_low_confidence(self):
        """Decay applies to low confidence values."""
        result = apply_temporal_decay(0.20, 7)
        # 0.20 * (1 - 0.01) = 0.198
        assert result == pytest.approx(0.198, abs=0.001)

    def test_decay_cannot_go_negative(self):
        """Decay cannot produce negative confidence."""
        result = apply_temporal_decay(0.05, 365)
        # 365 days = 52.14 weeks
        # decay_rate = 0.5214, but result should be >= 0.0
        assert result >= 0.0

    def test_decay_max_confidence(self):
        """Decay applies even to max confidence."""
        result = apply_temporal_decay(1.0, 7)
        # 1.0 * (1 - 0.01) = 0.99
        assert result == pytest.approx(0.99, abs=0.001)

    def test_invalid_confidence_raises(self):
        """Invalid confidence should raise ValueError."""
        with pytest.raises(ValueError, match="confidence must be"):
            apply_temporal_decay(1.5, 7)

        with pytest.raises(ValueError, match="confidence must be"):
            apply_temporal_decay(-0.1, 7)

    def test_invalid_days_raises(self):
        """Negative days should raise ValueError."""
        with pytest.raises(ValueError, match="days_since_last_validation must be"):
            apply_temporal_decay(0.85, -1)


class TestCalculateDaysSinceValidation:
    """Test days calculation from ISO timestamp."""

    def test_calculate_days_today(self):
        """Calculate 0 days for today."""
        now = datetime.utcnow()
        timestamp = now.isoformat() + "Z"
        result = calculate_days_since_validation(timestamp)
        assert result == 0

    def test_calculate_days_one_week_ago(self):
        """Calculate 7 days for one week ago."""
        one_week_ago = datetime.utcnow() - timedelta(days=7)
        timestamp = one_week_ago.isoformat() + "Z"
        result = calculate_days_since_validation(timestamp)
        assert result == 7

    def test_calculate_days_one_month_ago(self):
        """Calculate ~30 days for one month ago."""
        one_month_ago = datetime.utcnow() - timedelta(days=30)
        timestamp = one_month_ago.isoformat() + "Z"
        result = calculate_days_since_validation(timestamp)
        assert result == 30

    def test_invalid_timestamp_returns_zero(self):
        """Invalid timestamp should return 0 (graceful fallback)."""
        result = calculate_days_since_validation("invalid_timestamp")
        assert result == 0


class TestReviewMarking:
    """Test review marking logic."""

    def test_mark_for_review_below_threshold(self):
        """Confidence < 0.5 should be marked for review."""
        assert should_mark_for_review(0.45) is True
        assert should_mark_for_review(0.30) is True
        assert should_mark_for_review(0.10) is True

    def test_no_review_above_threshold(self):
        """Confidence >= 0.5 should not be marked for review."""
        assert should_mark_for_review(0.50) is False
        assert should_mark_for_review(0.75) is False
        assert should_mark_for_review(0.95) is False

    def test_review_boundary(self):
        """Test exact boundary at 0.5."""
        assert should_mark_for_review(0.49) is True
        assert should_mark_for_review(0.50) is False


class TestRecalibrationWithDecay:
    """Test combined decay and review logic."""

    def test_recalibrate_no_review_needed(self):
        """High confidence with recent validation needs no review."""
        one_week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z"
        new_conf, needs_review = recalibrate_confidence_with_decay(0.85, one_week_ago)

        # 0.85 * (1 - 0.01) = 0.8415
        assert new_conf == pytest.approx(0.8415, abs=0.0001)
        assert needs_review is False

    def test_recalibrate_review_needed(self):
        """Low confidence with old validation needs review."""
        sixty_days_ago = (datetime.utcnow() - timedelta(days=60)).isoformat() + "Z"
        new_conf, needs_review = recalibrate_confidence_with_decay(0.52, sixty_days_ago)

        # 60 days = 8.57 weeks
        # decay_rate = 0.0857
        # 0.52 * (1 - 0.0857) = 0.475
        assert new_conf < 0.5
        assert needs_review is True


class TestCombineEvidenceUpdates:
    """Test batch evidence processing."""

    def test_combine_only_confirming(self):
        """Apply multiple confirming evidence updates."""
        result = combine_evidence_updates(0.75, [0.8, 0.9], [])

        # First: 0.75 + (1 - 0.75) * 0.8 * 0.3 = 0.81
        # Second: 0.81 + (1 - 0.81) * 0.9 * 0.3 = 0.86129
        assert result == pytest.approx(0.8613, abs=0.001)

    def test_combine_only_contradicting(self):
        """Apply multiple contradicting evidence updates."""
        result = combine_evidence_updates(0.75, [], [0.6, 0.7])

        # First: 0.75 * (1 - 0.6 * 0.5) = 0.525
        # Second: 0.525 * (1 - 0.7 * 0.5) = 0.34125
        assert result == pytest.approx(0.3413, abs=0.001)

    def test_combine_mixed_evidence(self):
        """Apply both confirming and contradicting evidence."""
        result = combine_evidence_updates(0.75, [0.8], [0.5])

        # Confirming first: 0.75 + (1 - 0.75) * 0.8 * 0.3 = 0.81
        # Then contradicting: 0.81 * (1 - 0.5 * 0.5) = 0.6075
        assert result == pytest.approx(0.6075, abs=0.001)

    def test_combine_empty_evidence(self):
        """No evidence updates should return original confidence."""
        result = combine_evidence_updates(0.75, [], [])
        assert result == 0.75


class TestInitializeConfidence:
    """Test initial confidence setting."""

    def test_initialize_high_confidence(self):
        """Initialize with high evidence strength."""
        result = initialize_confidence(0.85)
        assert result == 0.85

    def test_initialize_medium_confidence(self):
        """Initialize with medium evidence strength."""
        result = initialize_confidence(0.60)
        assert result == 0.60

    def test_initialize_low_confidence(self):
        """Initialize with low evidence strength."""
        result = initialize_confidence(0.30)
        assert result == 0.30

    def test_initialize_invalid_raises(self):
        """Invalid evidence strength should raise ValueError."""
        with pytest.raises(ValueError, match="evidence_strength must be"):
            initialize_confidence(1.5)

        with pytest.raises(ValueError, match="evidence_strength must be"):
            initialize_confidence(-0.1)


class TestRealWorldScenarios:
    """Test realistic evidence accumulation scenarios."""

    def test_consistent_confirming_evidence(self):
        """Multiple emails confirm classification."""
        confidence = 0.60

        # Email 1: Strong confirming (0.85)
        confidence = update_confidence(confidence, 0.85, "confirming")
        # 0.60 + (1-0.60)*0.85*0.3 = 0.702

        # Email 2: Strong confirming (0.90)
        confidence = update_confidence(confidence, 0.90, "confirming")
        # 0.702 + (1-0.702)*0.90*0.3 = 0.7824

        # Email 3: Medium confirming (0.70)
        confidence = update_confidence(confidence, 0.70, "confirming")
        # 0.7824 + (1-0.7824)*0.70*0.3 = 0.8281

        assert confidence > 0.80
        assert confidence < 0.85

    def test_conflicting_evidence_pattern(self):
        """Alternating confirming and contradicting evidence."""
        confidence = 0.70

        # Confirming
        confidence = update_confidence(confidence, 0.80, "confirming")
        # 0.70 + (1-0.70)*0.80*0.3 = 0.772

        # Contradicting
        confidence = update_confidence(confidence, 0.60, "contradicting")
        # 0.772 * (1-0.60*0.5) = 0.5404

        # Confirming again
        confidence = update_confidence(confidence, 0.75, "confirming")
        # 0.5404 + (1-0.5404)*0.75*0.3 = 0.6438

        # Should be lower than initial due to contradiction
        assert confidence < 0.70

    def test_decay_to_review_threshold(self):
        """Confidence decays over time to review threshold."""
        confidence = 0.55

        # After 30 days
        confidence = apply_temporal_decay(confidence, 30)
        # 0.55 * (1 - 0.01*30/7) = 0.5264

        # After another 30 days (60 total)
        confidence = apply_temporal_decay(confidence, 30)
        # 0.5264 * (1 - 0.01*30/7) = 0.5039

        # After another 30 days (90 total)
        confidence = apply_temporal_decay(confidence, 30)
        # Should now be below 0.5 and need review

        assert confidence < 0.5
        assert should_mark_for_review(confidence) is True