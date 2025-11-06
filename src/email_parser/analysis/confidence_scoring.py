"""
Advanced Confidence Scoring System

Provides sophisticated confidence calculation for consumer insights and IAB mappings.
Uses multiple factors to determine reliability and advertiser value.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import pandas as pd
from datetime import datetime, timedelta
import re
import math


@dataclass
class ConfidenceFactors:
    """Factors contributing to confidence calculation."""
    data_volume: float = 0.0  # Volume of supporting data
    data_recency: float = 0.0  # How recent the data is
    evidence_strength: float = 0.0  # Quality of evidence
    pattern_consistency: float = 0.0  # Consistency across data points
    source_diversity: float = 0.0  # Diversity of data sources
    behavioral_intensity: float = 0.0  # Intensity of behavioral signals
    cross_validation: float = 0.0  # Validation across multiple signals


class ConfidenceScorer:
    """Advanced confidence scoring for consumer insights."""

    def __init__(self):
        """Initialize confidence scoring system."""
        self.weights = {
            'data_volume': 0.20,
            'data_recency': 0.15,
            'evidence_strength': 0.25,
            'pattern_consistency': 0.15,
            'source_diversity': 0.10,
            'behavioral_intensity': 0.10,
            'cross_validation': 0.05
        }

    def calculate_insight_confidence(self, insight_data: Dict[str, Any],
                                   supporting_emails: pd.DataFrame) -> float:
        """Calculate comprehensive confidence score for an insight."""
        factors = self._analyze_confidence_factors(insight_data, supporting_emails)

        # Calculate weighted confidence score
        confidence = sum(
            getattr(factors, factor) * weight
            for factor, weight in self.weights.items()
        )

        # Apply confidence curve (sigmoid-like function for realistic distribution)
        confidence = self._apply_confidence_curve(confidence)

        return min(1.0, max(0.0, confidence))

    def _analyze_confidence_factors(self, insight_data: Dict[str, Any],
                                  emails: pd.DataFrame) -> ConfidenceFactors:
        """Analyze all factors contributing to confidence."""
        return ConfidenceFactors(
            data_volume=self._calculate_data_volume_score(emails),
            data_recency=self._calculate_recency_score(emails),
            evidence_strength=self._calculate_evidence_strength(insight_data, emails),
            pattern_consistency=self._calculate_pattern_consistency(emails),
            source_diversity=self._calculate_source_diversity(emails),
            behavioral_intensity=self._calculate_behavioral_intensity(insight_data, emails),
            cross_validation=self._calculate_cross_validation_score(insight_data, emails)
        )

    def _calculate_data_volume_score(self, emails: pd.DataFrame) -> float:
        """Score based on volume of supporting data."""
        email_count = len(emails)

        # Logarithmic scaling for diminishing returns
        if email_count == 0:
            return 0.0
        elif email_count == 1:
            return 0.3
        elif email_count <= 3:
            return 0.5
        elif email_count <= 7:
            return 0.7
        elif email_count <= 15:
            return 0.85
        else:
            return 0.95

    def _calculate_recency_score(self, emails: pd.DataFrame) -> float:
        """Score based on recency of data."""
        if emails.empty or 'Date' not in emails.columns:
            return 0.5  # Neutral score when no date info

        try:
            # Convert dates and calculate recency
            dates = pd.to_datetime(emails['Date'], format='mixed', utc=True, errors='coerce')
            dates = dates.dropna()

            if dates.empty:
                return 0.5

            now = datetime.now(dates.iloc[0].tz)
            days_ago = [(now - date).days for date in dates]
            avg_days_ago = sum(days_ago) / len(days_ago)

            # Recency scoring curve
            if avg_days_ago <= 7:
                return 1.0  # Very recent
            elif avg_days_ago <= 30:
                return 0.9  # Recent
            elif avg_days_ago <= 90:
                return 0.7  # Somewhat recent
            elif avg_days_ago <= 180:
                return 0.5  # Moderate
            else:
                return 0.3  # Older data

        except Exception:
            return 0.5  # Fallback if date parsing fails

    def _calculate_evidence_strength(self, insight_data: Dict[str, Any],
                                   emails: pd.DataFrame) -> float:
        """Score based on strength of evidence."""
        evidence = insight_data.get('evidence', [])

        if not evidence:
            return 0.2

        # Quality indicators in evidence
        quality_indicators = [
            'purchase', 'order', 'transaction', 'receipt', 'invoice',
            'subscription', 'membership', 'loyalty', 'frequent',
            'multiple', 'repeat', 'regular', 'consistent'
        ]

        evidence_text = ' '.join(evidence).lower()
        quality_score = sum(1 for indicator in quality_indicators if indicator in evidence_text)

        # Normalize quality score
        base_score = min(1.0, quality_score / 3.0)

        # Boost for specific email types
        strong_email_types = ['Purchase', 'Transactional', 'Shipment Related']
        if 'Category' in emails.columns:
            strong_emails = emails[emails['Category'].isin(strong_email_types)]
            if len(strong_emails) > 0:
                base_score += min(0.3, len(strong_emails) / len(emails))

        return min(1.0, base_score)

    def _calculate_pattern_consistency(self, emails: pd.DataFrame) -> float:
        """Score based on consistency of patterns across emails."""
        if len(emails) <= 1:
            return 0.5  # Can't measure consistency with one data point

        # Analyze sender consistency
        sender_consistency = self._calculate_sender_consistency(emails)

        # Analyze temporal consistency
        temporal_consistency = self._calculate_temporal_consistency(emails)

        # Analyze content consistency
        content_consistency = self._calculate_content_consistency(emails)

        # Weighted average
        return (sender_consistency * 0.4 + temporal_consistency * 0.3 + content_consistency * 0.3)

    def _calculate_sender_consistency(self, emails: pd.DataFrame) -> float:
        """Measure consistency in email senders."""
        if 'From' not in emails.columns:
            return 0.5

        senders = emails['From'].value_counts()
        total_emails = len(emails)

        # If dominated by few senders, higher consistency
        top_sender_ratio = senders.iloc[0] / total_emails if len(senders) > 0 else 0

        if top_sender_ratio >= 0.7:
            return 0.9  # High consistency
        elif top_sender_ratio >= 0.5:
            return 0.7  # Good consistency
        elif top_sender_ratio >= 0.3:
            return 0.5  # Moderate consistency
        else:
            return 0.3  # Low consistency

    def _calculate_temporal_consistency(self, emails: pd.DataFrame) -> float:
        """Measure temporal pattern consistency."""
        if 'Date' not in emails.columns or len(emails) <= 2:
            return 0.5

        try:
            dates = pd.to_datetime(emails['Date'], format='mixed', utc=True, errors='coerce')
            dates = dates.dropna().sort_values()

            if len(dates) <= 2:
                return 0.5

            # Calculate intervals between emails
            intervals = [(dates.iloc[i+1] - dates.iloc[i]).days for i in range(len(dates)-1)]

            if not intervals:
                return 0.5

            # Measure consistency of intervals
            avg_interval = sum(intervals) / len(intervals)
            interval_variance = sum((x - avg_interval) ** 2 for x in intervals) / len(intervals)

            # Lower variance = higher consistency
            if interval_variance <= 10:
                return 0.9
            elif interval_variance <= 50:
                return 0.7
            elif interval_variance <= 200:
                return 0.5
            else:
                return 0.3

        except Exception:
            return 0.5

    def _calculate_content_consistency(self, emails: pd.DataFrame) -> float:
        """Measure consistency in email content themes."""
        content_columns = ['Subject', 'Summary', 'Key_Topics']
        available_columns = [col for col in content_columns if col in emails.columns]

        if not available_columns:
            return 0.5

        # Combine available content
        content_texts = []
        for _, email in emails.iterrows():
            text_parts = [str(email.get(col, '')) for col in available_columns]
            content_texts.append(' '.join(text_parts).lower())

        if len(content_texts) <= 1:
            return 0.5

        # Simple keyword overlap analysis
        all_words = set()
        for text in content_texts:
            words = re.findall(r'\b\w{3,}\b', text)  # Words 3+ characters
            all_words.update(words)

        if not all_words:
            return 0.5

        # Calculate average word overlap between texts
        overlaps = []
        for i in range(len(content_texts)):
            for j in range(i+1, len(content_texts)):
                words_i = set(re.findall(r'\b\w{3,}\b', content_texts[i]))
                words_j = set(re.findall(r'\b\w{3,}\b', content_texts[j]))

                if words_i and words_j:
                    overlap = len(words_i & words_j) / len(words_i | words_j)
                    overlaps.append(overlap)

        if not overlaps:
            return 0.5

        avg_overlap = sum(overlaps) / len(overlaps)
        return min(1.0, avg_overlap * 2)  # Scale up overlap score

    def _calculate_source_diversity(self, emails: pd.DataFrame) -> float:
        """Score based on diversity of email sources."""
        if 'From' not in emails.columns:
            return 0.5

        unique_senders = emails['From'].nunique()
        total_emails = len(emails)

        if total_emails <= 1:
            return 0.5

        diversity_ratio = unique_senders / total_emails

        # Higher diversity can indicate broader interest
        if diversity_ratio >= 0.8:
            return 0.9  # Very diverse
        elif diversity_ratio >= 0.6:
            return 0.7  # Good diversity
        elif diversity_ratio >= 0.4:
            return 0.6  # Moderate diversity
        elif diversity_ratio >= 0.2:
            return 0.4  # Low diversity
        else:
            return 0.2  # Very concentrated

    def _calculate_behavioral_intensity(self, insight_data: Dict[str, Any],
                                      emails: pd.DataFrame) -> float:
        """Score based on intensity of behavioral signals."""
        # Intensity indicators
        high_intensity_words = [
            'frequent', 'regular', 'multiple', 'often', 'always',
            'premium', 'loyal', 'dedicated', 'active', 'engaged'
        ]

        medium_intensity_words = [
            'sometimes', 'occasional', 'interested', 'prefer',
            'like', 'enjoy', 'subscribe', 'follow'
        ]

        description = insight_data.get('description', '').lower()
        evidence_text = ' '.join(insight_data.get('evidence', [])).lower()
        all_text = f"{description} {evidence_text}"

        high_count = sum(1 for word in high_intensity_words if word in all_text)
        medium_count = sum(1 for word in medium_intensity_words if word in all_text)

        # Calculate intensity score
        intensity_score = (high_count * 1.0 + medium_count * 0.5) / 3.0

        # Email frequency boost
        email_count = len(emails)
        if email_count >= 10:
            intensity_score += 0.3
        elif email_count >= 5:
            intensity_score += 0.2
        elif email_count >= 3:
            intensity_score += 0.1

        return min(1.0, intensity_score)

    def _calculate_cross_validation_score(self, insight_data: Dict[str, Any],
                                        emails: pd.DataFrame) -> float:
        """Score based on cross-validation across different data types."""
        validation_signals = 0

        # Check for multiple email categories
        if 'Category' in emails.columns:
            unique_categories = emails['Category'].nunique()
            if unique_categories >= 2:
                validation_signals += 1

        # Check for multiple time periods
        if 'Date' in emails.columns:
            try:
                dates = pd.to_datetime(emails['Date'], format='mixed', utc=True, errors='coerce')
                date_range = (dates.max() - dates.min()).days
                if date_range > 30:  # Spans more than a month
                    validation_signals += 1
            except Exception:
                pass

        # Check for different sender types
        if 'From' in emails.columns:
            sender_domains = emails['From'].str.extract(r'@(.+)')[0].nunique()
            if sender_domains >= 2:
                validation_signals += 1

        # Convert to score
        return min(1.0, validation_signals / 3.0)

    def _apply_confidence_curve(self, raw_confidence: float) -> float:
        """Apply realistic confidence curve to avoid overconfidence."""
        # Sigmoid-like curve that:
        # - Prevents very low scores from being too penalized
        # - Prevents very high scores from being overconfident
        # - Concentrates scores in the 0.3-0.8 range for most cases

        if raw_confidence <= 0:
            return 0.1
        elif raw_confidence >= 1:
            return 0.95
        else:
            # Modified sigmoid: more realistic confidence distribution
            adjusted = 0.1 + 0.8 * (1 / (1 + math.exp(-6 * (raw_confidence - 0.5))))
            return adjusted

    def calculate_iab_mapping_confidence(self, insight_confidence: float,
                                       keyword_match_score: float,
                                       evidence_relevance: float) -> float:
        """Calculate confidence for IAB category mapping."""
        # IAB mapping confidence considers:
        # 1. Underlying insight confidence
        # 2. Keyword matching accuracy
        # 3. Evidence relevance to IAB category

        base_confidence = insight_confidence * 0.6
        keyword_contribution = keyword_match_score * 0.25
        evidence_contribution = evidence_relevance * 0.15

        iab_confidence = base_confidence + keyword_contribution + evidence_contribution

        # Apply conservative adjustment for IAB mappings
        return min(0.95, iab_confidence * 0.9)  # Slightly more conservative