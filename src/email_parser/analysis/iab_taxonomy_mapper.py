"""
IAB Audience Taxonomy Mapper

Maps consumer insights to IAB Audience Taxonomy categories for advertiser value.
Provides standardized audience segments with confidence scoring.
"""

import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import re

from src.email_parser.utils.iab_taxonomy_loader import iab_taxonomy_loader

@dataclass
class IABMapping:
    """Represents a mapping to IAB taxonomy category."""
    iab_tier_1: str  # Demographics, Interest, Purchase Intent
    iab_tier_2: str  # Main category (e.g., "Travel", "Food & Drink")
    iab_tier_3: Optional[str] = None  # Subcategory (e.g., "Adventure Travel")
    iab_tier_4: Optional[str] = None  # Further subcategory
    unique_id: Optional[str] = None  # IAB unique identifier
    confidence: float = 0.0  # Confidence in this mapping (0.0-1.0)
    evidence: List[str] = None  # Supporting evidence for mapping

    def __post_init__(self):
        if self.evidence is None:
            self.evidence = []

@dataclass
class AdvertiserSegment:
    """Advertiser-valuable audience segment with IAB mapping."""
    segment_name: str
    description: str
    iab_mappings: List[IABMapping]
    audience_size_indicator: str  # "high", "medium", "low"
    purchase_intent_score: float  # 0.0-1.0
    targeting_value: str  # "premium", "standard", "basic"
    recommended_campaigns: List[str]


class IABTaxonomyMapper:
    """Maps consumer insights to IAB Audience Taxonomy categories."""

    def __init__(self):
        """Initialize with IAB taxonomy data."""
        self.interest_mappings = {}
        self.purchase_intent_mappings = {}
        self._build_mapping_indices()

    

    def _build_mapping_indices(self):
        """Build fast lookup indices for IAB categories."""
        # Build interest mappings
        interest_entries = iab_taxonomy_loader.get_by_section('interests')
        for entry in interest_entries:
            key = entry['tier_2']
            if key not in self.interest_mappings:
                self.interest_mappings[key] = []
            self.interest_mappings[key].append({
                'unique_id': entry['id'],
                'tier_3': entry['tier_3'],
                'tier_4': entry['tier_4'],
                'condensed_name': entry['name']
            })

        # Build purchase intent mappings
        purchase_intent_entries = iab_taxonomy_loader.get_by_section('purchase_intent')
        for entry in purchase_intent_entries:
            key = entry['tier_2']
            if key not in self.purchase_intent_mappings:
                self.purchase_intent_mappings[key] = []
            self.purchase_intent_mappings[key].append({
                'unique_id': entry['id'],
                'tier_3': entry['tier_3'],
                'tier_4': entry['tier_4'],
                'condensed_name': entry['name']
            })

    def _load_default_mappings(self):
        """Load default category mappings when taxonomy file unavailable."""
        # Key mappings for our consumer categories
        self.category_to_iab = {
            'shopping': {
                'interest': ['Style & Fashion', 'Home & Garden'],
                'purchase_intent': ['Consumer Packaged Goods', 'Clothing and Accessories']
            },
            'travel': {
                'interest': ['Travel'],
                'purchase_intent': ['Travel and Tourism']
            },
            'entertainment': {
                'interest': ['Movies', 'Television', 'Music and Audio', 'Video Gaming'],
                'purchase_intent': ['Arts and Entertainment']
            },
            'health': {
                'interest': ['Health and Medical Services', 'Healthy Living'],
                'purchase_intent': ['Health and Medical Services']
            },
            'restaurants': {
                'interest': ['Food & Drink'],
                'purchase_intent': ['Consumer Packaged Goods']  # Food subcategories
            },
            'recipes': {
                'interest': ['Food & Drink'],
                'purchase_intent': ['Consumer Packaged Goods']  # Cooking/food products
            }
        }

    def map_insight_to_iab(self, insight_description: str, insight_type: str,
                          category: str, evidence: List[str] = None) -> List[IABMapping]:
        """Map a consumer insight to IAB taxonomy categories."""
        mappings = []

        if evidence is None:
            evidence = []

        # Get relevant IAB categories for this consumer category
        iab_categories = self.category_to_iab.get(category.lower(), {})

        # Map to Interest categories
        for interest_category in iab_categories.get('interest', []):
            confidence = self._calculate_interest_confidence(
                insight_description, insight_type, interest_category, evidence
            )

            if confidence > 0.3:  # Only include reasonably confident mappings
                mappings.append(IABMapping(
                    iab_tier_1="Interest",
                    iab_tier_2=interest_category,
                    iab_tier_3=self._get_specific_subcategory(insight_description, interest_category),
                    confidence=confidence,
                    evidence=evidence
                ))

        # Map to Purchase Intent categories (if signals present)
        purchase_intent_score = self._detect_purchase_intent_signals(insight_description, evidence)
        if purchase_intent_score > 0.4:
            for intent_category in iab_categories.get('purchase_intent', []):
                mappings.append(IABMapping(
                    iab_tier_1="Purchase Intent",
                    iab_tier_2=intent_category,
                    confidence=purchase_intent_score,
                    evidence=evidence
                ))

        return mappings

    def _calculate_interest_confidence(self, description: str, insight_type: str,
                                     iab_category: str, evidence: List[str]) -> float:
        """Calculate confidence score for Interest category mapping."""
        confidence = 0.5  # Base confidence

        # Boost confidence based on insight type relevance
        insight_boosts = {
            'product_preference': 0.2,
            'brand_preference': 0.15,
            'behavior_pattern': 0.1,
            'purchase_behavior': 0.25
        }
        confidence += insight_boosts.get(insight_type, 0.0)

        # Category-specific keyword matching
        category_keywords = {
            'Travel': ['travel', 'trip', 'vacation', 'destination', 'flight', 'hotel', 'booking'],
            'Food & Drink': ['food', 'restaurant', 'cooking', 'recipe', 'dining', 'meal'],
            'Health and Medical Services': ['health', 'medical', 'doctor', 'healthcare', 'wellness'],
            'Healthy Living': ['fitness', 'exercise', 'nutrition', 'wellness', 'workout'],
            'Style & Fashion': ['fashion', 'clothing', 'style', 'beauty', 'apparel'],
            'Home & Garden': ['home', 'garden', 'furniture', 'decor', 'improvement'],
            'Video Gaming': ['gaming', 'game', 'xbox', 'playstation', 'nintendo'],
            'Movies': ['movie', 'film', 'cinema', 'entertainment'],
            'Music and Audio': ['music', 'audio', 'concert', 'album', 'artist']
        }

        keywords = category_keywords.get(iab_category, [])
        description_lower = description.lower()
        keyword_matches = sum(1 for keyword in keywords if keyword in description_lower)

        if keyword_matches > 0:
            confidence += min(0.3, keyword_matches * 0.1)

        # Evidence strength boost
        if evidence and len(evidence) >= 2:
            confidence += 0.1

        return min(1.0, confidence)

    def _detect_purchase_intent_signals(self, description: str, evidence: List[str]) -> float:
        """Detect purchase intent signals in insights."""
        intent_signals = [
            'purchase', 'buy', 'order', 'cart', 'checkout', 'payment',
            'receipt', 'invoice', 'shipping', 'delivery', 'transaction',
            'deal', 'discount', 'sale', 'offer', 'promo', 'coupon'
        ]

        text_to_check = f"{description} {' '.join(evidence)}".lower()
        signal_count = sum(1 for signal in intent_signals if signal in text_to_check)

        # Convert signal count to confidence score
        if signal_count >= 3:
            return 0.9
        elif signal_count == 2:
            return 0.7
        elif signal_count == 1:
            return 0.5
        else:
            return 0.2  # Low baseline intent

    def _get_specific_subcategory(self, description: str, tier_2_category: str) -> Optional[str]:
        """Map description to specific Tier 3 subcategory when possible."""
        subcategory_mapping = {
            'Travel': {
                'adventure': 'Adventure Travel',
                'family': 'Family Travel',
                'business': 'Business Travel',
                'beach': 'Beach Travel',
                'europe': 'Europe Travel',
                'asia': 'Asia Travel',
                'camping': 'Camping'
            },
            'Food & Drink': {
                'dining': 'Dining Out',
                'cooking': 'Cooking',
                'restaurant': 'Dining Out',
                'baking': 'Desserts and Baking',
                'healthy': 'Healthy Cooking and Eating',
                'vegan': 'Vegan Diets'
            },
            'Healthy Living': {
                'fitness': 'Fitness and Exercise',
                'nutrition': 'Nutrition',
                'weight': 'Weight Loss',
                'wellness': 'Wellness',
                'exercise': 'Fitness and Exercise'
            }
        }

        description_lower = description.lower()
        if tier_2_category in subcategory_mapping:
            for keyword, subcategory in subcategory_mapping[tier_2_category].items():
                if keyword in description_lower:
                    return subcategory

        return None

    def create_advertiser_segments(self, insights_with_mappings: List[Dict]) -> List[AdvertiserSegment]:
        """Create advertiser-valuable audience segments from IAB-mapped insights."""
        segments = []

        # Group insights by IAB categories
        category_groups = {}
        for insight_data in insights_with_mappings:
            for mapping in insight_data.get('iab_mappings', []):
                key = f"{mapping.iab_tier_1}:{mapping.iab_tier_2}"
                if key not in category_groups:
                    category_groups[key] = []
                category_groups[key].append(insight_data)

        # Create segments for each major category group
        for category_key, insights in category_groups.items():
            tier_1, tier_2 = category_key.split(':')

            # Calculate aggregate scores
            avg_confidence = sum(
                max(m.confidence for m in insight.get('iab_mappings', []))
                for insight in insights
            ) / len(insights)

            purchase_intent_score = self._calculate_segment_purchase_intent(insights)

            # Determine targeting value
            targeting_value = self._determine_targeting_value(avg_confidence, purchase_intent_score, len(insights))

            segment = AdvertiserSegment(
                segment_name=f"{tier_2} Enthusiast",
                description=f"Consumer with strong interest in {tier_2.lower()} with {len(insights)} behavioral indicators",
                iab_mappings=[mapping for insight in insights for mapping in insight.get('iab_mappings', [])],
                audience_size_indicator=self._estimate_audience_size(len(insights)),
                purchase_intent_score=purchase_intent_score,
                targeting_value=targeting_value,
                recommended_campaigns=self._generate_campaign_recommendations(tier_2, purchase_intent_score)
            )

            segments.append(segment)

        return sorted(segments, key=lambda s: s.purchase_intent_score, reverse=True)

    def _calculate_segment_purchase_intent(self, insights: List[Dict]) -> float:
        """Calculate overall purchase intent for a segment."""
        intent_scores = []
        for insight in insights:
            for mapping in insight.get('iab_mappings', []):
                if mapping.iab_tier_1 == "Purchase Intent":
                    intent_scores.append(mapping.confidence)

        return sum(intent_scores) / len(intent_scores) if intent_scores else 0.3

    def _determine_targeting_value(self, confidence: float, intent_score: float, insight_count: int) -> str:
        """Determine advertiser targeting value."""
        combined_score = (confidence * 0.6) + (intent_score * 0.4)

        if combined_score >= 0.8 and insight_count >= 3:
            return "premium"
        elif combined_score >= 0.6 and insight_count >= 2:
            return "standard"
        else:
            return "basic"

    def _estimate_audience_size(self, insight_count: int) -> str:
        """Estimate relative audience size based on insight depth."""
        if insight_count >= 5:
            return "high"
        elif insight_count >= 2:
            return "medium"
        else:
            return "low"

    def _generate_campaign_recommendations(self, category: str, intent_score: float) -> List[str]:
        """Generate campaign type recommendations."""
        base_campaigns = {
            'Travel': ['destination marketing', 'travel booking', 'hotel promotions'],
            'Food & Drink': ['restaurant discovery', 'food delivery', 'cooking products'],
            'Healthy Living': ['fitness equipment', 'health supplements', 'wellness services'],
            'Style & Fashion': ['fashion retail', 'beauty products', 'style subscriptions']
        }

        campaigns = base_campaigns.get(category, ['brand awareness', 'product discovery'])

        if intent_score > 0.7:
            campaigns.extend(['direct response', 'conversion-focused', 'retargeting'])
        elif intent_score > 0.5:
            campaigns.extend(['consideration', 'product comparison'])

        return campaigns[:4]  # Limit to top 4 recommendations