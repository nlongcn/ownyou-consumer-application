"""
Shopping Recommendation Analyzer

Specialized analyzer for shopping behavior, product preferences,
and purchase intent analysis.
"""

import uuid
from typing import Dict, List, Any, Optional
import pandas as pd
from datetime import datetime

from ..recommendation_category import RecommendationCategory, CategoryAnalysisContext, RecommendationResult
from ..llm_analysis_engine import LLMAnalysisEngine, AnalysisRequest
from ...models.consumer_profile import (
    RecommendationCategoryType, CategoryProfile, Insight, BehaviorPattern
)
from ...models.recommendation_schemas import (
    ShoppingProfile, ProductPreference, PriceRange, PurchaseIntent
)


class ShoppingAnalyzer(RecommendationCategory):
    """
    Specialized analyzer for shopping and purchase behavior.

    Analyzes email communications to identify:
    - Product category preferences
    - Brand loyalty patterns
    - Price sensitivity
    - Purchase timing and seasonality
    - Research vs. purchase behavior
    """

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        """Initialize shopping analyzer."""
        super().__init__(analysis_engine, RecommendationCategoryType.SHOPPING)

    def get_category_specific_filters(self) -> Dict[str, Any]:
        """Get email filters for shopping-related content."""
        return {
            'keywords': [
                'order', 'purchase', 'buy', 'cart', 'checkout', 'payment',
                'receipt', 'invoice', 'shipping', 'delivery', 'product',
                'sale', 'discount', 'coupon', 'deal', 'offer', 'promotion',
                'wishlist', 'compare', 'review', 'recommendation', 'brand',
                'store', 'shop', 'retail', 'marketplace', 'subscription',
                'membership', 'loyalty', 'reward', 'cashback'
            ],
            'categories': [
                'Purchase', 'Marketing', 'Promotional', 'Transactional',
                'Shipment Related', 'Newsletter'
            ],
            'sender_patterns': [
                r'.*@amazon\.',
                r'.*@ebay\.',
                r'.*@walmart\.',
                r'.*@target\.',
                r'.*@bestbuy\.',
                r'.*@costco\.',
                r'.*@homedepot\.',
                r'.*@lowes\.',
                r'.*@macys\.',
                r'.*@nordstrom\.',
                r'.*shop.*',
                r'.*store.*',
                r'.*retail.*',
                r'.*market.*',
                r'.*commerce.*'
            ]
        }

    def analyze(self, context: CategoryAnalysisContext) -> RecommendationResult:
        """Perform shopping-specific analysis."""
        email_data = context.email_data
        existing_profile = context.existing_profile

        insights = []
        behavior_patterns = []
        recommendations = []

        if not email_data.empty:
            # Analyze product preferences
            product_insights = self._analyze_product_preferences(email_data)
            insights.extend(product_insights)

            # Analyze brand engagement
            brand_patterns = self._analyze_brand_engagement(email_data)
            behavior_patterns.extend(brand_patterns)

            # Analyze purchase behavior
            purchase_insights = self._analyze_purchase_behavior(email_data)
            insights.extend(purchase_insights)

            # Analyze price sensitivity
            price_patterns = self._analyze_price_sensitivity(email_data)
            behavior_patterns.extend(price_patterns)

            # Analyze shopping timing
            timing_patterns = self._analyze_shopping_timing(email_data)
            behavior_patterns.extend(timing_patterns)

            # Generate recommendations
            recommendations = self.generate_recommendations(insights, behavior_patterns)

        # Calculate engagement score
        engagement_score = self.calculate_engagement_score(email_data, insights)

        return RecommendationResult(
            category=self.category_type,
            insights=insights,
            behavior_patterns=behavior_patterns,
            recommendations=recommendations,
            confidence_score=self._calculate_analysis_confidence(insights, behavior_patterns, len(email_data)),
            analysis_timestamp=datetime.utcnow()
        )

    def _analyze_product_preferences(self, email_data: pd.DataFrame) -> List[Insight]:
        """Analyze product category preferences from email communications."""
        insights = []

        # Use LLM to analyze product interests
        request = AnalysisRequest(
            system_prompt="""You are a product preference analyzer. Analyze email communications to identify product category interests and preferences.

Focus on:
- Product categories mentioned or engaged with
- Frequency of interest in different product types
- Seasonal or contextual product interests
- Brand preferences within categories
- Quality vs. price considerations

Return analysis as JSON object.""",

            user_prompt=f"""Analyze product preferences from these shopping-related emails:

{self._prepare_shopping_email_data(email_data)}

Return JSON:
{{
  "product_preferences": [
    {{
      "category": "product category",
      "subcategories": ["specific subcategories"],
      "preference_strength": 0.0-1.0,
      "evidence": ["supporting email subjects/content"],
      "frequency": "often/occasionally/rarely",
      "seasonal_patterns": ["timing patterns if any"]
    }}
  ],
  "brand_preferences": [
    {{
      "brand": "brand name",
      "category": "product category",
      "engagement_level": "high/medium/low",
      "loyalty_indicators": ["evidence of brand loyalty"]
    }}
  ]
}}""",

            data_payload={
                "analysis_type": "product_preferences",
                "email_count": len(email_data)
            }
        )

        result = self.analysis_engine.analyze(request)

        if result.success and result.data:
            # Process product preferences
            for pref_data in result.data.get('product_preferences', []):
                insights.append(self._create_insight(
                    insight_type="product_preference",
                    description=f"Interest in {pref_data['category']}: {', '.join(pref_data.get('subcategories', []))}",
                    evidence=pref_data.get('evidence', []),
                    confidence=pref_data.get('preference_strength', 0.5)
                ))

            # Process brand preferences
            for brand_data in result.data.get('brand_preferences', []):
                insights.append(self._create_insight(
                    insight_type="brand_preference",
                    description=f"Brand preference for {brand_data['brand']} in {brand_data['category']}",
                    evidence=brand_data.get('loyalty_indicators', []),
                    confidence=0.8 if brand_data.get('engagement_level') == 'high' else 0.5
                ))

        return insights

    def _analyze_brand_engagement(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze brand engagement patterns."""
        patterns = []

        # Extract brand mentions from email senders and content
        brand_mentions = {}

        for _, email in email_data.iterrows():
            sender = email.get('From', '').lower()
            subject = email.get('Subject', '').lower()
            summary = email.get('Summary', '').lower()

            # Extract potential brand names from sender domain
            if '@' in sender:
                domain = sender.split('@')[-1].split('.')[0]
                if len(domain) > 3:  # Filter out generic domains
                    brand_mentions[domain] = brand_mentions.get(domain, 0) + 1

            # Common brand patterns in subject/summary
            brand_keywords = ['apple', 'samsung', 'nike', 'adidas', 'amazon', 'google',
                            'microsoft', 'sony', 'lg', 'hp', 'dell', 'target', 'walmart']
            for brand in brand_keywords:
                if brand in subject or brand in summary:
                    brand_mentions[brand] = brand_mentions.get(brand, 0) + 1

        # Create patterns for frequently mentioned brands
        for brand, count in brand_mentions.items():
            if count >= 2:  # At least 2 mentions
                patterns.append(self._create_behavior_pattern(
                    pattern_type="brand_engagement",
                    description=f"Regular engagement with {brand.title()}",
                    frequency=count,
                    evidence=[f"Received {count} communications from {brand}"],
                    confidence=min(1.0, count / 10.0),
                    tags=["brand", "loyalty", brand]
                ))

        return patterns

    def _analyze_purchase_behavior(self, email_data: pd.DataFrame) -> List[Insight]:
        """Analyze actual purchase behavior from transactional emails."""
        insights = []

        # Filter for transactional emails
        purchase_emails = email_data[
            email_data['Category'].isin(['Purchase', 'Transactional', 'Shipment Related'])
        ]

        if not purchase_emails.empty:
            # Use LLM to analyze purchase patterns
            request = AnalysisRequest(
                system_prompt="""You are a purchase behavior analyst. Analyze transactional and purchase-related emails to identify buying patterns.

Focus on:
- Purchase frequency and timing
- Product categories purchased
- Purchase amount patterns (if detectable)
- Seasonal purchase behavior
- Impulse vs. planned purchases

Return analysis as JSON object.""",

                user_prompt=f"""Analyze purchase behavior from these transactional emails:

{self._prepare_transaction_email_data(purchase_emails)}

Return JSON:
{{
  "purchase_patterns": [
    {{
      "pattern_type": "frequency/timing/category/seasonal",
      "description": "specific purchase pattern",
      "evidence": ["supporting evidence from emails"],
      "confidence": 0.0-1.0,
      "frequency": "daily/weekly/monthly/occasional"
    }}
  ],
  "purchase_categories": [
    {{
      "category": "product category",
      "purchase_frequency": "regular/occasional/rare",
      "evidence": ["purchase examples"]
    }}
  ]
}}""",

                data_payload={
                    "analysis_type": "purchase_behavior",
                    "email_count": len(purchase_emails)
                }
            )

            result = self.analysis_engine.analyze(request)

            if result.success and result.data:
                # Process purchase patterns
                for pattern_data in result.data.get('purchase_patterns', []):
                    insights.append(self._create_insight(
                        insight_type="purchase_behavior",
                        description=pattern_data['description'],
                        evidence=pattern_data.get('evidence', []),
                        confidence=pattern_data.get('confidence', 0.5)
                    ))

                # Process purchase categories
                for cat_data in result.data.get('purchase_categories', []):
                    insights.append(self._create_insight(
                        insight_type="purchase_category",
                        description=f"Regular purchases in {cat_data['category']}",
                        evidence=cat_data.get('evidence', []),
                        confidence=0.8 if cat_data.get('purchase_frequency') == 'regular' else 0.5
                    ))

        return insights

    def _analyze_price_sensitivity(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze price sensitivity from promotional email engagement."""
        patterns = []

        # Filter promotional emails
        promo_emails = email_data[
            email_data['Subject'].str.contains(
                r'sale|discount|deal|offer|coupon|promo|% off|\$|save',
                case=False, na=False
            )
        ]

        if not promo_emails.empty:
            promo_ratio = len(promo_emails) / len(email_data)

            if promo_ratio > 0.3:
                patterns.append(self._create_behavior_pattern(
                    pattern_type="price_sensitivity",
                    description="High engagement with promotional offers",
                    frequency=len(promo_emails),
                    evidence=[f"Received {len(promo_emails)} promotional emails out of {len(email_data)} total"],
                    confidence=min(1.0, promo_ratio * 2),
                    tags=["price_sensitive", "deal_seeker", "promotional"]
                ))

            # Analyze specific discount patterns
            discount_keywords = ['50% off', '70% off', 'clearance', 'final sale', 'flash sale']
            high_discount_count = 0

            for _, email in promo_emails.iterrows():
                subject = email.get('Subject', '').lower()
                for keyword in discount_keywords:
                    if keyword in subject:
                        high_discount_count += 1
                        break

            if high_discount_count > 0:
                patterns.append(self._create_behavior_pattern(
                    pattern_type="discount_preference",
                    description="Preference for high-discount offers",
                    frequency=high_discount_count,
                    evidence=[f"Engaged with {high_discount_count} high-discount promotions"],
                    confidence=min(1.0, high_discount_count / 5.0),
                    tags=["bargain_hunter", "high_discount", "clearance"]
                ))

        return patterns

    def _analyze_shopping_timing(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze shopping timing patterns."""
        patterns = []

        if 'Date' in email_data.columns:
            try:
                # Convert dates and extract temporal patterns
                email_data = email_data.copy()
                # Handle mixed timezone formats gracefully
                email_data['Date'] = pd.to_datetime(email_data['Date'], format='mixed', utc=True)
                # Only use .dt accessor if we have datetime-like values
                if pd.api.types.is_datetime64_any_dtype(email_data['Date']):
                    email_data['month'] = email_data['Date'].dt.month
                    email_data['day_of_week'] = email_data['Date'].dt.day_name()
                else:
                    # Fallback if datetime conversion fails
                    return patterns

                # Seasonal patterns
                seasonal_counts = email_data.groupby('month').size()
                peak_months = seasonal_counts[seasonal_counts > seasonal_counts.mean()].index.tolist()

                if peak_months:
                    season_names = {
                        12: 'Holiday season', 1: 'Post-holiday', 2: 'Winter',
                        3: 'Spring', 4: 'Spring', 5: 'Spring',
                        6: 'Summer', 7: 'Summer', 8: 'Summer',
                        9: 'Fall', 10: 'Fall', 11: 'Holiday prep'
                    }

                    seasonal_pattern = ', '.join([season_names.get(m, f'Month {m}') for m in peak_months])

                    patterns.append(self._create_behavior_pattern(
                        pattern_type="seasonal_shopping",
                        description=f"Increased shopping activity during: {seasonal_pattern}",
                        frequency=len(peak_months),
                        evidence=[f"Peak activity in months: {peak_months}"],
                        confidence=0.7 if len(peak_months) <= 3 else 0.5,
                        tags=["seasonal", "timing"] + [season_names.get(m, f'month_{m}') for m in peak_months]
                    ))

                # Day of week patterns
                dow_counts = email_data.groupby('day_of_week').size()
                peak_days = dow_counts[dow_counts > dow_counts.mean()].index.tolist()

                if peak_days:
                    patterns.append(self._create_behavior_pattern(
                        pattern_type="weekly_shopping_pattern",
                        description=f"Higher shopping activity on: {', '.join(peak_days)}",
                        frequency=len(peak_days),
                        evidence=[f"Peak activity on: {peak_days}"],
                        confidence=0.6,
                        tags=["weekly_pattern", "timing"] + [day.lower() for day in peak_days]
                    ))

            except Exception as e:
                self.logger.warning(f"Could not analyze shopping timing: {e}")

        return patterns

    def generate_recommendations(self, insights: List[Insight],
                               patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """Generate shopping recommendations based on insights and patterns."""
        recommendations = []

        # Product recommendations based on preferences
        product_insights = [i for i in insights if i.insight_type == "product_preference"]
        for insight in product_insights:
            if insight.confidence >= 0.6:
                recommendations.append({
                    'type': 'product_recommendation',
                    'title': f'Explore {insight.description.split(":")[0]} Products',
                    'description': f'Based on your interest in {insight.description}, discover new products in this category',
                    'confidence': insight.confidence,
                    'category': 'shopping',
                    'action': 'explore_category',
                    'metadata': {
                        'product_category': insight.description.split(":")[0],
                        'evidence': insight.evidence
                    }
                })

        # Brand recommendations
        brand_insights = [i for i in insights if i.insight_type == "brand_preference"]
        for insight in brand_insights:
            if insight.confidence >= 0.7:
                recommendations.append({
                    'type': 'brand_recommendation',
                    'title': f'New Products from {insight.description.split(" for ")[1]}',
                    'description': f'Check out latest offerings from your preferred brand',
                    'confidence': insight.confidence,
                    'category': 'shopping',
                    'action': 'follow_brand',
                    'metadata': {
                        'brand': insight.description.split(" for ")[1],
                        'evidence': insight.evidence
                    }
                })

        # Deal recommendations for price-sensitive users
        price_patterns = [p for p in patterns if p.pattern_type == "price_sensitivity"]
        if price_patterns and price_patterns[0].confidence >= 0.6:
            recommendations.append({
                'type': 'deal_alert',
                'title': 'Set Up Deal Alerts',
                'description': 'Get notifications for sales and discounts on your favorite products',
                'confidence': price_patterns[0].confidence,
                'category': 'shopping',
                'action': 'setup_deal_alerts',
                'metadata': {
                    'deal_preference': 'high',
                    'evidence': price_patterns[0].evidence
                }
            })

        # Seasonal shopping recommendations
        seasonal_patterns = [p for p in patterns if p.pattern_type == "seasonal_shopping"]
        if seasonal_patterns:
            pattern = seasonal_patterns[0]
            recommendations.append({
                'type': 'seasonal_planning',
                'title': 'Plan Ahead for Peak Shopping Season',
                'description': f'Based on your shopping patterns, prepare for upcoming {pattern.description.split(": ")[1]} shopping',
                'confidence': pattern.confidence,
                'category': 'shopping',
                'action': 'seasonal_planning',
                'metadata': {
                    'seasonal_pattern': pattern.description,
                    'evidence': pattern.evidence
                }
            })

        return recommendations

    def update_profile(self, profile: CategoryProfile,
                      result: RecommendationResult) -> CategoryProfile:
        """Update shopping category profile with new analysis results."""
        # Merge insights
        profile.insights = self.merge_with_existing_insights(profile.insights, result.insights)

        # Merge behavior patterns
        existing_patterns = {p.pattern_id: p for p in profile.behavior_patterns}
        for new_pattern in result.behavior_patterns:
            # Check if similar pattern exists
            similar_pattern = None
            for existing_pattern in profile.behavior_patterns:
                if (existing_pattern.pattern_type == new_pattern.pattern_type and
                    existing_pattern.description == new_pattern.description):
                    similar_pattern = existing_pattern
                    break

            if similar_pattern:
                # Update existing pattern
                similar_pattern.frequency = max(similar_pattern.frequency, new_pattern.frequency)
                similar_pattern.recency = max(similar_pattern.recency, new_pattern.recency)
                similar_pattern.confidence = (similar_pattern.confidence + new_pattern.confidence) / 2
                similar_pattern.evidence.extend(new_pattern.evidence)
                similar_pattern.evidence = list(set(similar_pattern.evidence))  # Remove duplicates
            else:
                # Add new pattern
                profile.behavior_patterns.append(new_pattern)

        # Update engagement score
        profile.update_engagement_score(result.confidence_score)

        return profile

    def _calculate_analysis_confidence(self, insights: List[Insight],
                                     patterns: List[BehaviorPattern],
                                     email_count: int) -> float:
        """Calculate overall confidence score for shopping analysis."""
        factors = []

        # Email volume factor
        volume_factor = min(1.0, email_count / 20.0)
        factors.append(volume_factor)

        # Insights confidence
        if insights:
            avg_insight_confidence = sum(i.confidence for i in insights) / len(insights)
            factors.append(avg_insight_confidence)

        # Pattern confidence
        if patterns:
            avg_pattern_confidence = sum(p.confidence for p in patterns) / len(patterns)
            factors.append(avg_pattern_confidence)

        # Diversity factor (different types of insights/patterns)
        insight_types = len(set(i.insight_type for i in insights))
        pattern_types = len(set(p.pattern_type for p in patterns))
        diversity_factor = min(1.0, (insight_types + pattern_types) / 8.0)
        factors.append(diversity_factor)

        return sum(factors) / len(factors) if factors else 0.0

    def _prepare_shopping_email_data(self, email_data: pd.DataFrame) -> str:
        """Prepare email data for shopping analysis."""
        sample_data = []
        for _, email in email_data.head(20).iterrows():  # Limit to avoid token limits
            sample_data.append({
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'category': email.get('Category', ''),
                'summary': email.get('Summary', '')[:200] if email.get('Summary') else ''
            })
        return str(sample_data)

    def _prepare_transaction_email_data(self, email_data: pd.DataFrame) -> str:
        """Prepare transaction email data for purchase analysis."""
        sample_data = []
        for _, email in email_data.head(15).iterrows():
            sample_data.append({
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'date': str(email.get('Date', '')),
                'category': email.get('Category', ''),
                'summary': email.get('Summary', '')[:150] if email.get('Summary') else ''
            })
        return str(sample_data)