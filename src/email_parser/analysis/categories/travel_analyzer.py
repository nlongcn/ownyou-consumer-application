"""
Travel Category Analyzer

Focused analyzer for travel behavior: destinations of interest, holiday planning patterns,
and travel preferences. Helps understand what the user will be looking for when planning travel.
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


class TravelAnalyzer(RecommendationCategory):
    """
    Analyzer for travel destinations and holiday planning behavior.

    Focuses on understanding:
    - Destinations of interest (specific places, regions, travel styles)
    - Holiday planning patterns (timing, frequency, advance planning)
    - Travel preferences (accommodation, transportation, activities)
    - Budget and luxury indicators
    - Group vs solo travel patterns
    """

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        """Initialize travel analyzer."""
        super().__init__(analysis_engine, RecommendationCategoryType.TRAVEL)

    def get_category_specific_filters(self) -> Dict[str, Any]:
        """Get email filters for travel-related content.

        For lifestyle-based travel analysis, we want to analyze ALL emails
        to find indirect travel signals, not just explicit travel content.
        """
        return {
            # No keyword filtering - analyze all emails for lifestyle signals
            # Include direct travel keywords but don't limit to them
            'inclusive_keywords': [
                # Direct travel signals
                'flight', 'hotel', 'booking', 'travel', 'vacation', 'holiday',
                'destination', 'trip', 'journey', 'tour', 'cruise',
                'reservation', 'itinerary', 'boarding', 'check-in',
                'airport', 'airline', 'accommodation',

                # Lifestyle indicators that suggest travel preferences
                'tennis', 'sports', 'club', 'fitness', 'outdoor', 'adventure',
                'culture', 'festival', 'event', 'food', 'restaurant', 'cuisine',
                'tech', 'innovation', 'conference', 'business', 'startup',
                'crypto', 'blockchain', 'fintech', 'art', 'music', 'theater',
                'seasonal', 'summer', 'winter', 'autumn', 'spring'
            ],
            # Don't filter by sender patterns - we want all lifestyle data
            'analyze_all_emails': True,  # Special flag for lifestyle analysis
            'categories': ['Travel', 'Newsletter', 'Promotional', 'Personal', 'Business']
        }

    def analyze(self, context: CategoryAnalysisContext) -> RecommendationResult:
        """Perform travel-specific analysis focused on destinations and planning."""
        email_data = context.email_data
        insights = []
        behavior_patterns = []

        if not email_data.empty:
            # Analyze destination interests
            destination_insights = self._analyze_destination_interests(email_data)
            insights.extend(destination_insights)

            # Analyze travel planning behavior
            planning_insights = self._analyze_planning_behavior(email_data)
            insights.extend(planning_insights)

            # Analyze travel frequency and timing
            timing_patterns = self._analyze_travel_timing(email_data)
            behavior_patterns.extend(timing_patterns)

            # Analyze accommodation and transportation preferences
            preference_patterns = self._analyze_travel_preferences(email_data)
            behavior_patterns.extend(preference_patterns)

        # Generate recommendations
        recommendations = self.generate_recommendations(insights, behavior_patterns)

        return RecommendationResult(
            category=self.category_type,
            insights=insights,
            behavior_patterns=behavior_patterns,
            recommendations=recommendations,
            confidence_score=self._calculate_analysis_confidence(insights, behavior_patterns, len(email_data)),
            analysis_timestamp=datetime.utcnow()
        )

    def _analyze_destination_interests(self, email_data: pd.DataFrame) -> List[Insight]:
        """Analyze what destinations and travel experiences interest the user."""
        insights = []

        # Use LLM to identify destination interests AND lifestyle-based travel preferences
        request = AnalysisRequest(
            system_prompt="""You are a sophisticated travel preference analyst. Analyze ALL emails to identify travel preferences based on lifestyle, interests, and cultural patterns - not just explicit travel bookings.

Look for INDIRECT TRAVEL SIGNALS:
- Cultural interests (holidays, festivals, events) → destination preferences
- Sports/activities (tennis, cycling, hiking) → active travel preferences
- Tech/business interests → innovation-focused city destinations
- Seasonal patterns → timing preferences
- Cultural background/holidays → geographic and cultural destination preferences
- Lifestyle patterns → luxury vs budget, family vs solo travel

ALSO look for direct travel signals:
- Explicit destinations, bookings, travel planning
- Travel service providers, airlines, hotels

Provide travel insights based on the COMPLETE lifestyle picture.""",

            user_prompt=f"""Analyze these emails to identify travel preferences based on lifestyle, cultural interests, and activities:

{self._prepare_travel_email_data(email_data)}

Look for BOTH direct travel signals AND lifestyle indicators that suggest travel preferences:

LIFESTYLE-BASED ANALYSIS:
- Cultural/religious holidays mentioned → cultural destination preferences
- Sports/activities → active travel preferences
- Tech/business focus → innovation city destinations
- Seasonal patterns → timing preferences
- Professional interests → business travel or related destinations

Return JSON with comprehensive travel insights:
{{
  "lifestyle_travel_preferences": [
    {{
      "preference_type": "cultural/active/tech/seasonal/professional",
      "description": "detailed travel preference based on lifestyle",
      "suggested_destinations": ["specific places that match this lifestyle"],
      "travel_style": "family/cultural/active/luxury/business",
      "evidence": ["supporting lifestyle indicators from emails"],
      "confidence": 0.0-1.0
    }}
  ],
  "direct_travel_signals": [
    {{
      "destination": "specific place if mentioned",
      "travel_type": "booking/planning/interest",
      "evidence": ["direct travel references"],
      "confidence": 0.0-1.0
    }}
  ],
  "seasonal_patterns": {{
    "preferred_season": "spring/summer/autumn/winter",
    "timing_indicators": ["evidence of seasonal preferences"],
    "suggested_timing": "specific months or periods"
  }},
  "travel_personality": {{
    "group_preference": "solo/couple/family/friends/business",
    "luxury_level": "budget/mid-range/luxury",
    "activity_level": "relaxation/moderate/active/adventure",
    "cultural_interest": "high/medium/low",
    "tech_forward": "high/medium/low"
  }}
}}""",

            data_payload={
                "analysis_type": "destination_interests",
                "email_count": len(email_data)
            }
        )

        result = self.analysis_engine.analyze(request)

        if result.success and result.data:
            # Process lifestyle-based travel preferences
            for lifestyle_data in result.data.get('lifestyle_travel_preferences', []):
                if lifestyle_data.get('confidence', 0) > 0.3:
                    destinations = ', '.join(lifestyle_data.get('suggested_destinations', []))
                    confidence = lifestyle_data.get('confidence', 0.5)
                    insight = Insight(
                        insight_type="lifestyle_travel_preference",
                        description=f"{lifestyle_data.get('preference_type', 'lifestyle').title()} travel interest: {lifestyle_data.get('description', '')} → Suggested destinations: {destinations}",
                        evidence=lifestyle_data.get('evidence', []),
                        confidence=confidence,
                        confidence_level=Insight._calculate_confidence_level(confidence),
                        created_at=datetime.utcnow(),
                        last_updated=datetime.utcnow()
                    )
                    insights.append(insight)

            # Process direct travel signals (if any)
            for direct_data in result.data.get('direct_travel_signals', []):
                if direct_data.get('confidence', 0) > 0.3:
                    confidence = direct_data.get('confidence', 0.5)
                    insight = Insight(
                        insight_type="direct_travel_interest",
                        description=f"Direct travel interest in {direct_data.get('destination', 'destination')} ({direct_data.get('travel_type', 'general')})",
                        evidence=direct_data.get('evidence', []),
                        confidence=confidence,
                        confidence_level=Insight._calculate_confidence_level(confidence),
                        created_at=datetime.utcnow(),
                        last_updated=datetime.utcnow()
                    )
                    insights.append(insight)

            # Process seasonal patterns
            seasonal_data = result.data.get('seasonal_patterns', {})
            if seasonal_data and seasonal_data.get('timing_indicators'):
                confidence = 0.6
                insight = Insight(
                    insight_type="travel_timing_preference",
                    description=f"Seasonal travel preference: {seasonal_data.get('preferred_season', 'unknown')} season → Best timing: {seasonal_data.get('suggested_timing', 'flexible')}",
                    evidence=seasonal_data.get('timing_indicators', []),
                    confidence=confidence,
                    confidence_level=Insight._calculate_confidence_level(confidence),
                    created_at=datetime.utcnow(),
                    last_updated=datetime.utcnow()
                )
                insights.append(insight)

            # Process travel personality
            personality_data = result.data.get('travel_personality', {})
            if personality_data:
                personality_desc = f"Travel personality: {personality_data.get('group_preference', 'unknown')} traveler, {personality_data.get('luxury_level', 'unknown')} budget, {personality_data.get('activity_level', 'unknown')} activity level"
                if personality_data.get('cultural_interest') == 'high':
                    personality_desc += ", high cultural interest"
                if personality_data.get('tech_forward') == 'high':
                    personality_desc += ", tech-forward preferences"

                confidence = 0.7
                insight = Insight(
                    insight_type="travel_personality",
                    description=personality_desc,
                    evidence=["Analysis based on lifestyle patterns across email communications"],
                    confidence=confidence,
                    confidence_level=Insight._calculate_confidence_level(confidence),
                    created_at=datetime.utcnow(),
                    last_updated=datetime.utcnow()
                )
                insights.append(insight)

        return insights

    def _analyze_planning_behavior(self, email_data: pd.DataFrame) -> List[Insight]:
        """Analyze travel planning patterns and booking behavior."""
        insights = []

        # Look for booking confirmations vs promotional emails
        booking_emails = email_data[
            email_data['Subject'].str.contains(
                r'confirmation|confirmed|booking|reservation|itinerary|ticket',
                case=False, na=False
            )
        ]

        promo_emails = email_data[
            email_data['Subject'].str.contains(
                r'deal|offer|sale|discount|special|limited',
                case=False, na=False
            )
        ]

        total_emails = len(email_data)
        if total_emails > 0:
            booking_ratio = len(booking_emails) / total_emails
            promo_ratio = len(promo_emails) / total_emails

            # Analyze planning behavior
            if booking_ratio > 0.3:
                insight = Insight(
                    insight_type="planning_behavior",
                    description="Active travel booker - frequently makes actual reservations and bookings",
                    evidence=[f"Found {len(booking_emails)} booking confirmations out of {total_emails} travel emails"],
                    confidence=min(0.9, booking_ratio * 2),
                    created_at=datetime.utcnow(),
                    last_updated=datetime.utcnow()
                )
                insights.append(insight)

            if promo_ratio > 0.5:
                insight = Insight(
                    insight_type="deal_seeking_behavior",
                    description="Actively seeks travel deals and promotional offers",
                    evidence=[f"Found {len(promo_emails)} promotional travel emails out of {total_emails} total"],
                    confidence=min(0.8, promo_ratio * 1.5),
                    created_at=datetime.utcnow(),
                    last_updated=datetime.utcnow()
                )
                insights.append(insight)

            # Platform preferences
            platform_usage = {}
            for _, email in email_data.iterrows():
                sender = str(email.get('From', '')).lower()
                if 'booking.com' in sender:
                    platform_usage['Booking.com'] = platform_usage.get('Booking.com', 0) + 1
                elif 'expedia' in sender:
                    platform_usage['Expedia'] = platform_usage.get('Expedia', 0) + 1
                elif 'hotels.com' in sender:
                    platform_usage['Hotels.com'] = platform_usage.get('Hotels.com', 0) + 1
                elif 'airbnb' in sender:
                    platform_usage['Airbnb'] = platform_usage.get('Airbnb', 0) + 1

            # Report platform preferences
            for platform, count in platform_usage.items():
                if count >= 2:  # At least 2 emails from this platform
                    platform_ratio = count / total_emails
                    insight = Insight(
                        insight_type="platform_preference",
                        description=f"Prefers {platform} for travel bookings and research",
                        evidence=[f"Received {count} emails from {platform}"],
                        confidence=min(0.8, platform_ratio * 3),
                        created_at=datetime.utcnow(),
                        last_updated=datetime.utcnow()
                    )
                    insights.append(insight)

        return insights

    def _analyze_travel_timing(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze when the person plans and books travel."""
        patterns = []

        if 'Date' not in email_data.columns or len(email_data) < 2:
            return patterns

        try:
            dates = pd.to_datetime(email_data['Date'], format='mixed', utc=True, errors='coerce')
            dates = dates.dropna()

            if len(dates) >= 2:
                # Travel frequency
                date_range_days = (dates.max() - dates.min()).days
                email_count = len(dates)

                if date_range_days > 0:
                    emails_per_month = email_count / (date_range_days / 30)

                    if emails_per_month >= 2:
                        frequency_type = "frequent_travel_planner"
                        description = "Very active in travel planning and research"
                        confidence = 0.8
                    elif emails_per_month >= 0.5:
                        frequency_type = "regular_travel_planner"
                        description = "Regularly plans and researches travel"
                        confidence = 0.6
                    else:
                        frequency_type = "occasional_travel_planner"
                        description = "Occasionally plans travel"
                        confidence = 0.4

                    patterns.append(BehaviorPattern(
                        pattern_id=str(uuid.uuid4()),
                        pattern_type=frequency_type,
                        description=description,
                        frequency=email_count,
                        recency=dates.max(),
                        confidence=confidence,
                        evidence=[f"Found {email_count} travel emails over {date_range_days} days"],
                        tags=["frequency", "planning"]
                    ))

            # Seasonal patterns
            if len(dates) >= 3:
                months = dates.dt.month
                season_counts = {}

                for month in months:
                    if month in [12, 1, 2]:
                        season_counts['winter'] = season_counts.get('winter', 0) + 1
                    elif month in [3, 4, 5]:
                        season_counts['spring'] = season_counts.get('spring', 0) + 1
                    elif month in [6, 7, 8]:
                        season_counts['summer'] = season_counts.get('summer', 0) + 1
                    else:
                        season_counts['fall'] = season_counts.get('fall', 0) + 1

                if season_counts:
                    peak_season = max(season_counts.items(), key=lambda x: x[1])
                    if peak_season[1] >= 2:  # At least 2 emails in peak season
                        patterns.append(BehaviorPattern(
                            pattern_id=str(uuid.uuid4()),
                            pattern_type="seasonal_travel_preference",
                            description=f"Prefers to plan/book travel during {peak_season[0]} months",
                            frequency=peak_season[1],
                            recency=dates.max(),
                            confidence=0.6,
                            evidence=[f"Most travel activity ({peak_season[1]} emails) during {peak_season[0]}"],
                            tags=["seasonal", peak_season[0]]
                        ))

        except Exception as e:
            # Don't fail analysis if date parsing has issues
            pass

        return patterns

    def _analyze_travel_preferences(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze accommodation and transportation preferences."""
        patterns = []

        # Accommodation preferences
        hotel_count = email_data['Subject'].str.contains(r'hotel|marriott|hilton|hyatt', case=False, na=False).sum()
        airbnb_count = email_data['Subject'].str.contains(r'airbnb|vacation rental|vrbo', case=False, na=False).sum()
        resort_count = email_data['Subject'].str.contains(r'resort|all-inclusive', case=False, na=False).sum()

        total_accommodation = hotel_count + airbnb_count + resort_count

        if total_accommodation >= 2:
            if hotel_count > airbnb_count and hotel_count > resort_count:
                patterns.append(BehaviorPattern(
                    pattern_id=str(uuid.uuid4()),
                    pattern_type="accommodation_preference",
                    description="Prefers hotels and traditional accommodations",
                    frequency=hotel_count,
                    recency=datetime.utcnow(),
                    confidence=0.7,
                    evidence=[f"Found {hotel_count} hotel-related emails"],
                    tags=["accommodation", "hotels", "traditional"]
                ))
            elif airbnb_count > hotel_count:
                patterns.append(BehaviorPattern(
                    pattern_id=str(uuid.uuid4()),
                    pattern_type="accommodation_preference",
                    description="Prefers vacation rentals and alternative accommodations",
                    frequency=airbnb_count,
                    recency=datetime.utcnow(),
                    confidence=0.7,
                    evidence=[f"Found {airbnb_count} vacation rental emails"],
                    tags=["accommodation", "vacation_rentals", "alternative"]
                ))

        # Budget vs luxury indicators
        luxury_keywords = ['first class', 'business class', 'premium', 'luxury', 'five star']
        budget_keywords = ['budget', 'economy', 'deal', 'cheap', 'discount']

        content = ' '.join((email_data['Subject'].fillna('') + ' ' + email_data['Summary'].fillna('')).astype(str)).lower()

        luxury_signals = sum(1 for keyword in luxury_keywords if keyword in content)
        budget_signals = sum(1 for keyword in budget_keywords if keyword in content)

        if luxury_signals >= 2:
            patterns.append(BehaviorPattern(
                pattern_id=str(uuid.uuid4()),
                pattern_type="luxury_travel_interest",
                description="Shows interest in premium and luxury travel options",
                frequency=luxury_signals,
                recency=datetime.utcnow(),
                confidence=min(0.8, luxury_signals / 3.0),
                evidence=[f"Found {luxury_signals} luxury travel indicators"],
                tags=["luxury", "premium", "high-end"]
            ))

        if budget_signals >= 2:
            patterns.append(BehaviorPattern(
                pattern_id=str(uuid.uuid4()),
                pattern_type="budget_travel_focus",
                description="Actively seeks budget-friendly travel options and deals",
                frequency=budget_signals,
                recency=datetime.utcnow(),
                confidence=min(0.8, budget_signals / 3.0),
                evidence=[f"Found {budget_signals} budget travel indicators"],
                tags=["budget", "deals", "value"]
            ))

        return patterns

    def _prepare_travel_email_data(self, email_data: pd.DataFrame) -> str:
        """Prepare email data for LLM analysis."""
        summaries = []
        for _, email in email_data.head(20).iterrows():  # Limit for performance
            summary = f"Subject: {email.get('Subject', '')}\nFrom: {email.get('From', '')}\nSummary: {email.get('Summary', '')}\nDate: {email.get('Date', '')}\n---"
            summaries.append(summary)
        return '\n'.join(summaries)

    def generate_recommendations(self, insights: List[Insight], patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """Generate practical travel recommendations."""
        recommendations = []

        # Destination-based recommendations
        destination_insights = [i for i in insights if 'destination' in i.insight_type]
        if destination_insights:
            recommendations.append({
                'type': 'destination_recommendations',
                'title': 'Personalized Destination Suggestions',
                'description': 'Discover new destinations and experiences based on your travel interests and preferences',
                'confidence': 0.8,
                'category': self.category_type.value,
                'priority': 'high'
            })

        # Deal optimization for deal seekers
        deal_seeking = [i for i in insights if 'deal_seeking' in i.insight_type]
        if deal_seeking:
            recommendations.append({
                'type': 'deal_alerts',
                'title': 'Smart Travel Deal Alerts',
                'description': 'Get notified about travel deals and promotions for your preferred destinations',
                'confidence': 0.7,
                'category': self.category_type.value,
                'priority': 'medium'
            })

        # Planning tools for active planners
        booking_behavior = [i for i in insights if 'planning_behavior' in i.insight_type]
        if booking_behavior:
            recommendations.append({
                'type': 'planning_tools',
                'title': 'Travel Planning Optimization',
                'description': 'Tools and timing advice to get the best prices and experiences for your trips',
                'confidence': 0.6,
                'category': self.category_type.value,
                'priority': 'medium'
            })

        # Platform-specific recommendations
        platform_preferences = [i for i in insights if 'platform_preference' in i.insight_type]
        if platform_preferences:
            recommendations.append({
                'type': 'platform_optimization',
                'title': 'Booking Platform Benefits',
                'description': 'Maximize benefits and rewards on your preferred travel booking platforms',
                'confidence': 0.6,
                'category': self.category_type.value,
                'priority': 'low'
            })

        return recommendations[:4]  # Top 4 recommendations

    def _calculate_analysis_confidence(self, insights: List[Insight], patterns: List[BehaviorPattern], email_count: int) -> float:
        """Calculate overall confidence in travel analysis."""
        if not insights and not patterns:
            return 0.1

        insight_confidence = sum(i.confidence for i in insights) / len(insights) if insights else 0.0
        pattern_confidence = sum(p.confidence for p in patterns) / len(patterns) if patterns else 0.0
        volume_factor = min(0.3, email_count / 10.0)

        return min(0.95, (insight_confidence * 0.6) + (pattern_confidence * 0.3) + volume_factor)

    def update_profile(self, profile: CategoryProfile, result: RecommendationResult) -> CategoryProfile:
        """Update travel category profile with new analysis results."""
        profile.insights.extend(result.insights)
        profile.behavior_patterns.extend(result.behavior_patterns)
        profile.engagement_score = result.confidence_score
        profile.last_analyzed = result.analysis_timestamp
        profile.analysis_count += 1
        return profile