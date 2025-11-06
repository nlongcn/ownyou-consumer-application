"""
Sophisticated Travel Category Analyzer

Advanced analyzer for travel behavior, destination preferences, and booking patterns.
Maps insights to IAB Audience Taxonomy for advertiser value.
"""

import uuid
from typing import Dict, List, Any, Optional
import pandas as pd
from datetime import datetime

from ..recommendation_category import RecommendationCategory, CategoryAnalysisContext, RecommendationResult
from ..llm_analysis_engine import LLMAnalysisEngine, AnalysisRequest
from ..iab_taxonomy_mapper import IABTaxonomyMapper, IABMapping
from ..confidence_scoring import ConfidenceScorer
from ...models.consumer_profile import (
    RecommendationCategoryType, CategoryProfile, Insight, BehaviorPattern
)


class TravelAnalyzer(RecommendationCategory):
    """
    Sophisticated analyzer for travel and tourism behavior.

    Analyzes email communications to identify:
    - Destination preferences and travel style
    - Booking behavior and planning patterns
    - Transportation and accommodation preferences
    - Travel frequency and seasonality
    - Budget and luxury indicators
    - Solo vs. group travel patterns

    Maps insights to IAB Travel categories for advertiser targeting.
    """

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        """Initialize travel analyzer with IAB mapping capabilities."""
        super().__init__(analysis_engine, RecommendationCategoryType.TRAVEL)

        # Initialize IAB mapping and confidence scoring
        self.iab_mapper = IABTaxonomyMapper("/Volumes/T7_new/developer_old/email_parser/IABTL-Audience-Taxonomy-1.1-Final.xlsx")
        self.confidence_scorer = ConfidenceScorer()

    def get_category_specific_filters(self) -> Dict[str, Any]:
        """Get email filters for travel-related content."""
        return {
            'keywords': [
                # Booking and reservations
                'flight', 'hotel', 'booking', 'reservation', 'confirm', 'itinerary',
                'check-in', 'check-out', 'departure', 'arrival', 'boarding',

                # Travel types and destinations
                'travel', 'trip', 'vacation', 'holiday', 'destination', 'journey',
                'international', 'domestic', 'cruise', 'tour', 'adventure',
                'business travel', 'leisure travel', 'family travel',

                # Transportation
                'airline', 'airport', 'aircraft', 'terminal', 'gate', 'seat',
                'rental car', 'train', 'bus', 'ferry', 'transfer',
                'uber', 'lyft', 'taxi', 'shuttle',

                # Accommodation
                'accommodation', 'lodging', 'suite', 'room', 'bed', 'breakfast',
                'resort', 'inn', 'hostel', 'villa', 'apartment',
                'airbnb', 'vrbo', 'homestay',

                # Travel services
                'visa', 'passport', 'insurance', 'currency', 'exchange',
                'guide', 'excursion', 'activity', 'attraction', 'sightseeing',

                # Luxury and budget indicators
                'first class', 'business class', 'premium', 'luxury', 'suite',
                'budget', 'deal', 'discount', 'cheap', 'affordable'
            ],
            'categories': [
                'Travel', 'Transportation', 'Accommodation', 'Tourism',
                'Booking', 'Reservation', 'Newsletter'
            ],
            'sender_patterns': [
                # Major travel platforms
                r'.*@booking\.com',
                r'.*@expedia\.',
                r'.*@hotels\.com',
                r'.*@kayak\.',
                r'.*@priceline\.',
                r'.*@tripadvisor\.',
                r'.*@skyscanner\.',
                r'.*@airbnb\.',
                r'.*@vrbo\.',

                # Airlines
                r'.*@delta\.',
                r'.*@united\.',
                r'.*@american\.',
                r'.*@southwest\.',
                r'.*@lufthansa\.',
                r'.*@ba\.com',
                r'.*@emirates\.',
                r'.*@qatar\.',

                # Hotel chains
                r'.*@marriott\.',
                r'.*@hilton\.',
                r'.*@hyatt\.',
                r'.*@ihg\.',
                r'.*@accor\.',

                # Travel services
                r'.*travel.*',
                r'.*tour.*',
                r'.*airline.*',
                r'.*hotel.*',
                r'.*resort.*',
                r'.*cruise.*'
            ]
        }

    def analyze(self, context: CategoryAnalysisContext) -> RecommendationResult:
        """Perform sophisticated travel-specific analysis."""
        email_data = context.email_data
        existing_profile = context.existing_profile

        insights = []
        behavior_patterns = []

        if not email_data.empty:
            # Analyze destination preferences
            destination_insights = self._analyze_destination_preferences(email_data)
            insights.extend(destination_insights)

            # Analyze travel booking behavior
            booking_insights = self._analyze_booking_behavior(email_data)
            insights.extend(booking_insights)

            # Analyze travel style and preferences
            style_insights = self._analyze_travel_style(email_data)
            insights.extend(style_insights)

            # Analyze accommodation preferences
            accommodation_patterns = self._analyze_accommodation_preferences(email_data)
            behavior_patterns.extend(accommodation_patterns)

            # Analyze travel frequency and timing
            timing_patterns = self._analyze_travel_timing(email_data)
            behavior_patterns.extend(timing_patterns)

            # Analyze budget and luxury indicators
            budget_patterns = self._analyze_budget_indicators(email_data)
            behavior_patterns.extend(budget_patterns)

            # Map insights to IAB categories
            self._add_iab_mappings_to_insights(insights, email_data)

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

    def _analyze_destination_preferences(self, email_data: pd.DataFrame) -> List[Insight]:
        """Analyze destination preferences and travel style using LLM."""
        insights = []

        # Use LLM for sophisticated destination analysis
        request = AnalysisRequest(
            system_prompt="""You are a travel behavior analyst specializing in destination preferences and travel patterns.

Analyze travel-related emails to identify:
- Preferred destinations (domestic vs international, specific regions/countries)
- Travel style preferences (adventure, luxury, cultural, business, leisure)
- Seasonal travel patterns
- Group vs solo travel indicators
- Special interests (food, history, nature, nightlife, etc.)
- Travel experience level (frequent traveler vs occasional)

Return detailed analysis as JSON object.""",

            user_prompt=f"""Analyze destination and travel preferences from these travel-related emails:

{self._prepare_travel_email_data(email_data)}

Return JSON with detailed analysis:
{{
  "destination_preferences": [
    {{
      "destination_type": "international/domestic/specific_region",
      "destinations": ["specific places mentioned"],
      "preference_strength": 0.0-1.0,
      "evidence": ["supporting email content"],
      "travel_style": "adventure/luxury/cultural/business/leisure/family",
      "frequency": "frequent/occasional/rare"
    }}
  ],
  "travel_interests": [
    {{
      "interest_type": "food/culture/adventure/nature/nightlife/history/business",
      "description": "specific interest details",
      "evidence": ["supporting evidence"],
      "confidence": 0.0-1.0
    }}
  ],
  "travel_behavior": {{
    "experience_level": "beginner/intermediate/expert",
    "planning_style": "spontaneous/planned/detailed",
    "group_preference": "solo/couple/family/group",
    "season_preferences": ["spring/summer/fall/winter"],
    "trip_duration": "short/medium/long"
  }}
}}""",

            data_payload={
                "analysis_type": "destination_preferences",
                "email_count": len(email_data)
            }
        )

        result = self.analysis_engine.analyze(request)

        if result.success and result.data:
            # Process destination preferences
            for dest_data in result.data.get('destination_preferences', []):
                insight = self._create_insight(
                    insight_type="destination_preference",
                    description=f"Interest in {dest_data.get('destination_type', 'travel')}: {', '.join(dest_data.get('destinations', []))} ({dest_data.get('travel_style', 'general')} style)",
                    evidence=dest_data.get('evidence', []),
                    confidence=dest_data.get('preference_strength', 0.5)
                )
                insights.append(insight)

            # Process travel interests
            for interest_data in result.data.get('travel_interests', []):
                insight = self._create_insight(
                    insight_type="travel_interest",
                    description=f"Travel interest in {interest_data.get('interest_type', 'activities')}: {interest_data.get('description', '')}",
                    evidence=interest_data.get('evidence', []),
                    confidence=interest_data.get('confidence', 0.5)
                )
                insights.append(insight)

            # Process travel behavior
            behavior = result.data.get('travel_behavior', {})
            if behavior:
                insight = self._create_insight(
                    insight_type="travel_behavior",
                    description=f"Travel style: {behavior.get('experience_level', 'unknown')} traveler, {behavior.get('planning_style', 'unknown')} planning, prefers {behavior.get('group_preference', 'unknown')} travel",
                    evidence=[f"Analysis based on {len(email_data)} travel communications"],
                    confidence=0.7
                )
                insights.append(insight)

        return insights

    def _analyze_booking_behavior(self, email_data: pd.DataFrame) -> List[Insight]:
        """Analyze booking patterns and travel planning behavior."""
        insights = []

        # Filter for booking-related emails
        booking_emails = email_data[
            email_data['Subject'].str.contains(
                r'booking|reservation|confirm|itinerary|ticket|receipt',
                case=False, na=False
            )
        ]

        if not booking_emails.empty:
            # Use LLM for booking behavior analysis
            request = AnalysisRequest(
                system_prompt="""You are a travel booking behavior analyst. Analyze booking and reservation emails to identify purchasing patterns.

Focus on:
- Booking timing (advance vs last-minute)
- Price sensitivity and deal-seeking behavior
- Platform preferences and loyalty
- Booking complexity (simple vs multi-destination)
- Cancellation and modification patterns
- Payment and loyalty program usage

Return detailed analysis as JSON.""",

                user_prompt=f"""Analyze booking behavior from these travel booking emails:

{self._prepare_booking_email_data(booking_emails)}

Return JSON:
{{
  "booking_patterns": [
    {{
      "pattern_type": "timing/price_sensitivity/platform_loyalty/complexity",
      "description": "detailed pattern description",
      "evidence": ["supporting evidence from emails"],
      "confidence": 0.0-1.0,
      "frequency": "always/often/sometimes/rarely"
    }}
  ],
  "platform_preferences": [
    {{
      "platform": "platform name",
      "usage_frequency": "high/medium/low",
      "booking_types": ["flights/hotels/packages/activities"],
      "loyalty_indicators": ["evidence of repeat usage"]
    }}
  ],
  "price_behavior": {{
    "price_sensitivity": "high/medium/low",
    "deal_seeking": "active/passive/none",
    "budget_level": "luxury/mid-range/budget",
    "evidence": ["supporting evidence"]
  }}
}}""",

                data_payload={
                    "analysis_type": "booking_behavior",
                    "email_count": len(booking_emails)
                }
            )

            result = self.analysis_engine.analyze(request)

            if result.success and result.data:
                # Process booking patterns
                for pattern_data in result.data.get('booking_patterns', []):
                    insight = self._create_insight(
                        insight_type="booking_behavior",
                        description=pattern_data.get('description', ''),
                        evidence=pattern_data.get('evidence', []),
                        confidence=pattern_data.get('confidence', 0.5)
                    )
                    insights.append(insight)

                # Process platform preferences
                for platform_data in result.data.get('platform_preferences', []):
                    insight = self._create_insight(
                        insight_type="platform_preference",
                        description=f"Prefers {platform_data.get('platform', 'platform')} for {', '.join(platform_data.get('booking_types', []))}",
                        evidence=platform_data.get('loyalty_indicators', []),
                        confidence=0.8 if platform_data.get('usage_frequency') == 'high' else 0.6
                    )
                    insights.append(insight)

                # Process price behavior
                price_behavior = result.data.get('price_behavior', {})
                if price_behavior:
                    insight = self._create_insight(
                        insight_type="price_sensitivity",
                        description=f"Price behavior: {price_behavior.get('price_sensitivity', 'unknown')} sensitivity, {price_behavior.get('budget_level', 'unknown')} level, {price_behavior.get('deal_seeking', 'unknown')} deal seeking",
                        evidence=price_behavior.get('evidence', []),
                        confidence=0.7
                    )
                    insights.append(insight)

        return insights

    def _analyze_travel_style(self, email_data: pd.DataFrame) -> List[Insight]:
        """Analyze travel style and luxury vs budget preferences."""
        insights = []

        # Look for luxury vs budget indicators
        luxury_keywords = ['first class', 'business class', 'premium', 'luxury', 'suite', 'five star', 'spa', 'concierge']
        budget_keywords = ['budget', 'economy', 'cheap', 'deal', 'discount', 'hostel', 'backpack']

        all_content = ' '.join([
            ' '.join(email_data['Subject'].fillna('')),
            ' '.join(email_data['Summary'].fillna(''))
        ]).lower()

        luxury_count = sum(1 for keyword in luxury_keywords if keyword in all_content)
        budget_count = sum(1 for keyword in budget_keywords if keyword in all_content)

        if luxury_count > budget_count and luxury_count >= 2:
            insight = self._create_insight(
                insight_type="travel_style",
                description="Preference for luxury travel experiences and premium accommodations",
                evidence=[f"Found {luxury_count} luxury indicators in travel communications"],
                confidence=min(0.9, luxury_count / 5.0)
            )
            insights.append(insight)

        elif budget_count > luxury_count and budget_count >= 2:
            insight = self._create_insight(
                insight_type="travel_style",
                description="Preference for budget-conscious travel and value deals",
                evidence=[f"Found {budget_count} budget indicators in travel communications"],
                confidence=min(0.9, budget_count / 5.0)
            )
            insights.append(insight)

        return insights

    def _analyze_accommodation_preferences(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze accommodation booking patterns."""
        patterns = []

        # Analyze accommodation types
        hotel_mentions = email_data['Subject'].str.contains(r'hotel|marriott|hilton|hyatt', case=False, na=False).sum()
        airbnb_mentions = email_data['Subject'].str.contains(r'airbnb|vrbo|rental', case=False, na=False).sum()
        resort_mentions = email_data['Subject'].str.contains(r'resort|spa|luxury', case=False, na=False).sum()

        if hotel_mentions >= 2:
            patterns.append(self._create_behavior_pattern(
                pattern_type="accommodation_preference",
                description="Preference for hotel chains and traditional accommodations",
                frequency=hotel_mentions,
                evidence=[f"Found {hotel_mentions} hotel-related communications"],
                confidence=min(0.8, hotel_mentions / 5.0),
                tags=["hotels", "traditional", "accommodation"]
            ))

        if airbnb_mentions >= 2:
            patterns.append(self._create_behavior_pattern(
                pattern_type="accommodation_preference",
                description="Preference for alternative accommodations and vacation rentals",
                frequency=airbnb_mentions,
                evidence=[f"Found {airbnb_mentions} vacation rental communications"],
                confidence=min(0.8, airbnb_mentions / 3.0),
                tags=["vacation_rental", "alternative", "local_experience"]
            ))

        return patterns

    def _analyze_travel_timing(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze travel timing and frequency patterns."""
        patterns = []

        if 'Date' not in email_data.columns or len(email_data) < 2:
            return patterns

        try:
            dates = pd.to_datetime(email_data['Date'], format='mixed', utc=True, errors='coerce')
            dates = dates.dropna().sort_values()

            if len(dates) >= 2:
                # Calculate travel frequency
                date_range = (dates.max() - dates.min()).days
                travel_communications = len(dates)

                if date_range > 0:
                    frequency_score = travel_communications / (date_range / 30)  # Communications per month

                    if frequency_score >= 2:
                        pattern_type = "frequent_traveler"
                        description = "High frequency travel planning and booking activity"
                        confidence = 0.8
                    elif frequency_score >= 0.5:
                        pattern_type = "regular_traveler"
                        description = "Regular travel planning and booking activity"
                        confidence = 0.6
                    else:
                        pattern_type = "occasional_traveler"
                        description = "Occasional travel planning and booking activity"
                        confidence = 0.5

                    patterns.append(self._create_behavior_pattern(
                        pattern_type=pattern_type,
                        description=description,
                        frequency=travel_communications,
                        evidence=[f"Found {travel_communications} travel communications over {date_range} days"],
                        confidence=confidence,
                        tags=["frequency", "planning", "booking"]
                    ))

            # Analyze seasonal patterns
            if len(dates) >= 3:
                months = dates.dt.month
                month_counts = months.value_counts()

                if not month_counts.empty:
                    peak_month = month_counts.index[0]
                    month_names = {
                        1: "January", 2: "February", 3: "March", 4: "April",
                        5: "May", 6: "June", 7: "July", 8: "August",
                        9: "September", 10: "October", 11: "November", 12: "December"
                    }

                    seasonal_preference = "unknown"
                    if peak_month in [12, 1, 2]:
                        seasonal_preference = "winter"
                    elif peak_month in [3, 4, 5]:
                        seasonal_preference = "spring"
                    elif peak_month in [6, 7, 8]:
                        seasonal_preference = "summer"
                    elif peak_month in [9, 10, 11]:
                        seasonal_preference = "fall"

                    patterns.append(self._create_behavior_pattern(
                        pattern_type="seasonal_travel_preference",
                        description=f"Peak travel activity in {seasonal_preference} ({month_names.get(peak_month, peak_month)})",
                        frequency=month_counts.iloc[0],
                        evidence=[f"Most travel activity in {month_names.get(peak_month, peak_month)}"],
                        confidence=0.6,
                        tags=["seasonal", "timing", seasonal_preference]
                    ))

        except Exception as e:
            # Log error but don't fail the analysis
            pass

        return patterns

    def _analyze_budget_indicators(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze budget and spending behavior patterns."""
        patterns = []

        # Analyze deal-seeking behavior
        deal_emails = email_data[
            email_data['Subject'].str.contains(
                r'deal|discount|sale|offer|promo|save|\$|%|cheap|budget',
                case=False, na=False
            )
        ]

        if not deal_emails.empty:
            deal_ratio = len(deal_emails) / len(email_data)

            if deal_ratio > 0.4:
                patterns.append(self._create_behavior_pattern(
                    pattern_type="deal_seeking_behavior",
                    description="High engagement with travel deals and promotional offers",
                    frequency=len(deal_emails),
                    evidence=[f"Received {len(deal_emails)} deal-related emails out of {len(email_data)} total"],
                    confidence=min(0.9, deal_ratio * 2),
                    tags=["price_sensitive", "deal_seeker", "budget_conscious"]
                ))

        # Analyze luxury indicators
        luxury_emails = email_data[
            email_data['Subject'].str.contains(
                r'luxury|premium|first class|business class|suite|spa|five star',
                case=False, na=False
            )
        ]

        if not luxury_emails.empty:
            luxury_ratio = len(luxury_emails) / len(email_data)

            if luxury_ratio > 0.3:
                patterns.append(self._create_behavior_pattern(
                    pattern_type="luxury_travel_preference",
                    description="Interest in luxury travel experiences and premium services",
                    frequency=len(luxury_emails),
                    evidence=[f"Received {len(luxury_emails)} luxury travel communications"],
                    confidence=min(0.9, luxury_ratio * 2),
                    tags=["luxury", "premium", "high_value"]
                ))

        return patterns

    def _add_iab_mappings_to_insights(self, insights: List[Insight], email_data: pd.DataFrame):
        """Add IAB taxonomy mappings to insights for advertiser value."""
        for insight in insights:
            # Map insight to IAB categories
            iab_mappings = self.iab_mapper.map_insight_to_iab(
                insight_description=insight.description,
                insight_type=insight.insight_type,
                category="travel",
                evidence=insight.evidence
            )

            # Calculate enhanced confidence scores
            enhanced_confidence = self.confidence_scorer.calculate_insight_confidence(
                insight_data={
                    'description': insight.description,
                    'insight_type': insight.insight_type,
                    'evidence': insight.evidence
                },
                supporting_emails=email_data
            )

            # Update insight confidence with enhanced scoring
            insight.confidence = enhanced_confidence

            # Attach IAB mappings to insight (extend the insight object)
            if not hasattr(insight, 'iab_mappings'):
                insight.iab_mappings = iab_mappings

    def _prepare_travel_email_data(self, email_data: pd.DataFrame) -> str:
        """Prepare travel email data for LLM analysis."""
        email_summaries = []
        for _, email in email_data.head(15).iterrows():  # Limit to recent emails
            summary = {
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'key_topics': email.get('Key_Topics', ''),
                'date': email.get('Date', ''),
                'category': email.get('Category', '')
            }
            email_summaries.append(summary)

        return str(email_summaries)

    def _prepare_booking_email_data(self, email_data: pd.DataFrame) -> str:
        """Prepare booking-specific email data for LLM analysis."""
        booking_summaries = []
        for _, email in email_data.iterrows():
            summary = {
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'date': email.get('Date', ''),
                'category': email.get('Category', '')
            }
            booking_summaries.append(summary)

        return str(booking_summaries)

    def _create_insight(self, insight_type: str, description: str,
                       evidence: List[str], confidence: float) -> Insight:
        """Create an insight with proper formatting."""
        return Insight(
            insight_type=insight_type,
            description=description,
            evidence=evidence,
            confidence=confidence,
            created_at=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )

    def _create_behavior_pattern(self, pattern_type: str, description: str,
                               frequency: int, evidence: List[str],
                               confidence: float, tags: List[str]) -> BehaviorPattern:
        """Create a behavior pattern with proper formatting."""
        return BehaviorPattern(
            pattern_id=str(uuid.uuid4()),
            pattern_type=pattern_type,
            description=description,
            frequency=frequency,
            recency=datetime.utcnow(),
            confidence=confidence,
            evidence=evidence,
            tags=tags
        )

    def generate_recommendations(self, insights: List[Insight],
                               patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """Generate sophisticated travel recommendations based on insights and IAB mappings."""
        recommendations = []

        # Analyze insights for recommendation opportunities
        destination_insights = [i for i in insights if 'destination' in i.insight_type]
        luxury_patterns = [p for p in patterns if 'luxury' in p.pattern_type]
        budget_patterns = [p for p in patterns if 'deal' in p.pattern_type or 'budget' in p.description.lower()]
        frequent_patterns = [p for p in patterns if 'frequent' in p.pattern_type]

        # Destination-based recommendations
        if destination_insights:
            for insight in destination_insights[:2]:  # Top 2 destination insights
                if insight.confidence >= 0.6:
                    recommendations.append({
                        'type': 'destination_discovery',
                        'title': 'Personalized Destination Recommendations',
                        'description': f'Discover new destinations similar to your interests in {insight.description.lower()}',
                        'confidence': insight.confidence,
                        'category': self.category_type.value,
                        'priority': 'high' if insight.confidence > 0.8 else 'medium',
                        'iab_categories': [m.iab_tier_2 for m in getattr(insight, 'iab_mappings', [])]
                    })

        # Luxury travel recommendations
        if luxury_patterns:
            recommendations.append({
                'type': 'luxury_travel_experiences',
                'title': 'Exclusive Luxury Travel Experiences',
                'description': 'Premium travel experiences and luxury accommodations curated for discerning travelers',
                'confidence': 0.8,
                'category': self.category_type.value,
                'priority': 'premium',
                'iab_categories': ['Travel', 'Luxury']
            })

        # Budget travel recommendations
        if budget_patterns:
            recommendations.append({
                'type': 'travel_deals_optimization',
                'title': 'Smart Travel Deal Alerts',
                'description': 'Personalized alerts for travel deals and budget-friendly options based on your preferences',
                'confidence': 0.7,
                'category': self.category_type.value,
                'priority': 'high',
                'iab_categories': ['Travel and Tourism']
            })

        # Frequent traveler recommendations
        if frequent_patterns:
            recommendations.append({
                'type': 'travel_optimization_tools',
                'title': 'Travel Management Tools',
                'description': 'Advanced tools for frequent travelers: loyalty optimization, trip planning, and expense management',
                'confidence': 0.8,
                'category': self.category_type.value,
                'priority': 'high',
                'iab_categories': ['Travel', 'Business and Finance']
            })

        # Booking optimization recommendations
        booking_insights = [i for i in insights if 'booking' in i.insight_type]
        if booking_insights:
            recommendations.append({
                'type': 'booking_optimization',
                'title': 'Optimal Booking Strategies',
                'description': 'Personalized booking timing and platform recommendations to maximize value',
                'confidence': 0.6,
                'category': self.category_type.value,
                'priority': 'medium',
                'iab_categories': ['Travel and Tourism']
            })

        return recommendations[:5]  # Limit to top 5 recommendations

    def calculate_engagement_score(self, email_data: pd.DataFrame, insights: List[Insight]) -> float:
        """Calculate travel category engagement score."""
        if email_data.empty:
            return 0.0

        # Base score on email volume
        email_count = len(email_data)
        volume_score = min(0.6, email_count * 0.05)

        # Insight quality score
        insight_score = 0.0
        if insights:
            avg_confidence = sum(insight.confidence for insight in insights) / len(insights)
            insight_score = avg_confidence * 0.3

        # Booking activity boost
        booking_emails = email_data[
            email_data['Subject'].str.contains(r'booking|reservation|confirm', case=False, na=False)
        ]
        booking_boost = min(0.2, len(booking_emails) * 0.05)

        return min(1.0, volume_score + insight_score + booking_boost)

    def _calculate_analysis_confidence(self, insights: List[Insight],
                                     patterns: List[BehaviorPattern],
                                     email_count: int) -> float:
        """Calculate overall analysis confidence."""
        if not insights and not patterns:
            return 0.1

        # Insight confidence
        insight_confidence = sum(insight.confidence for insight in insights) / len(insights) if insights else 0.0

        # Pattern confidence
        pattern_confidence = sum(pattern.confidence for pattern in patterns) / len(patterns) if patterns else 0.0

        # Email volume factor
        volume_factor = min(1.0, email_count / 10.0)

        # Combined confidence
        combined = (insight_confidence * 0.6 + pattern_confidence * 0.3 + volume_factor * 0.1)

        return min(0.95, combined)

    def update_profile(self, profile: CategoryProfile,
                      result: RecommendationResult) -> CategoryProfile:
        """Update travel category profile with new analysis results."""
        # Update insights
        profile.insights.extend(result.insights)

        # Update behavior patterns
        profile.behavior_patterns.extend(result.behavior_patterns)

        # Update engagement score
        profile.engagement_score = result.confidence_score

        # Update last analyzed timestamp
        profile.last_analyzed = result.analysis_timestamp

        # Increment analysis count
        profile.analysis_count += 1

        return profile