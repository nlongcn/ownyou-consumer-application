"""
Restaurants Category Analyzer

Analyzes restaurant and dining-related email communications to identify:
- Cuisine preferences and dining habits
- Restaurant discovery patterns and loyalty
- Delivery service usage and preferences
- Dining occasion patterns (date night, family, business)
- Price sensitivity and spending patterns
"""

from typing import List, Dict, Any
import pandas as pd
from datetime import datetime

from .base_category_analyzer import BaseCategoryAnalyzer
from ...models.consumer_profile import RecommendationCategoryType, BehaviorPattern, Insight
from ..llm_analysis_engine import LLMAnalysisEngine


class RestaurantsAnalyzer(BaseCategoryAnalyzer):
    """Restaurant and dining-specific category analyzer."""

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        super().__init__(analysis_engine, RecommendationCategoryType.RESTAURANTS)

    def get_category_keywords(self) -> List[str]:
        """Restaurant-related keywords for filtering."""
        return [
            'restaurant', 'dining', 'delivery', 'takeout', 'reservation',
            'menu', 'chef', 'cuisine', 'food', 'meal', 'dinner', 'lunch',
            'breakfast', 'brunch', 'bar', 'cafe', 'bistro', 'grill',
            'ubereats', 'doordash', 'grubhub', 'postmates', 'seamless',
            'opentable', 'yelp', 'zomato', 'resy', 'michelin', 'review',
            'italian', 'chinese', 'mexican', 'thai', 'indian', 'japanese',
            'american', 'french', 'mediterranean', 'steakhouse', 'seafood',
            'vegetarian', 'vegan', 'gluten-free', 'organic', 'farm-to-table'
        ]

    def get_category_senders(self) -> List[str]:
        """Restaurant-related sender patterns."""
        return [
            'ubereats', 'doordash', 'grubhub', 'postmates', 'seamless',
            'opentable', 'yelp', 'zomato', 'resy', 'tripadvisor',
            'restaurant', 'dining', 'delivery', 'cafe', 'bistro',
            'grill', 'steakhouse', 'pizzeria', 'kitchen', 'food'
        ]

    def get_llm_analysis_prompt(self) -> str:
        """LLM prompt for restaurant analysis."""
        return """
Analyze the following restaurant and dining-related emails to identify consumer dining preferences and behaviors.

Focus on:
1. Cuisine preferences and favorite food types
2. Dining frequency and occasion patterns (date night, family, business, casual)
3. Restaurant discovery methods (apps, reviews, recommendations)
4. Delivery vs dine-in preferences
5. Price sensitivity and dining budget patterns
6. Restaurant loyalty and repeat visit behavior
7. Dietary restrictions or preferences (vegetarian, vegan, gluten-free, etc.)
8. Geographic dining patterns (neighborhood preferences, willingness to travel)
9. Service preferences (fine dining, casual, fast-casual, food trucks)
10. Seasonal dining patterns and menu preferences
11. Group dining vs solo dining preferences
12. Special occasion dining patterns (anniversaries, celebrations)

Provide insights about their dining personality and restaurant preferences based on email evidence.
"""

    def analyze_behavior_patterns(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze restaurant-specific behavior patterns."""
        patterns = []

        if email_data.empty:
            return patterns

        # Delivery service usage
        delivery_keywords = ['ubereats', 'doordash', 'grubhub', 'postmates', 'delivery', 'takeout']
        delivery_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in delivery_keywords), axis=1)
        ]

        if not delivery_emails.empty:
            delivery_count = len(delivery_emails)
            patterns.append(BehaviorPattern(
                pattern_type="delivery_service_usage",
                description=f"Regular food delivery service usage",
                frequency=delivery_count,
                recency=pd.to_datetime(delivery_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in delivery_emails.columns else datetime.now(),
                confidence=min(0.9, delivery_count * 0.3),
                evidence=[f"Found {delivery_count} delivery service communications"],
                tags=["delivery", "convenience", "food_ordering"]
            ))

        # Restaurant reservation patterns
        reservation_keywords = ['reservation', 'opentable', 'resy', 'booking', 'table']
        reservation_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in reservation_keywords), axis=1)
        ]

        if not reservation_emails.empty:
            reservation_count = len(reservation_emails)
            patterns.append(BehaviorPattern(
                pattern_type="restaurant_reservations",
                description=f"Active restaurant reservation making",
                frequency=reservation_count,
                recency=pd.to_datetime(reservation_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in reservation_emails.columns else datetime.now(),
                confidence=min(0.8, reservation_count * 0.25),
                evidence=[f"Found {reservation_count} reservation-related communications"],
                tags=["reservations", "dining_out", "planning"]
            ))

        # Restaurant review engagement
        review_keywords = ['yelp', 'review', 'rating', 'recommendation', 'michelin']
        review_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in review_keywords), axis=1)
        ]

        if not review_emails.empty:
            review_count = len(review_emails)
            patterns.append(BehaviorPattern(
                pattern_type="restaurant_research",
                description=f"Active restaurant research and review reading",
                frequency=review_count,
                recency=pd.to_datetime(review_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in review_emails.columns else datetime.now(),
                confidence=min(0.7, review_count * 0.2),
                evidence=[f"Found {review_count} restaurant review communications"],
                tags=["research", "reviews", "discovery"]
            ))

        # Dining frequency analysis
        restaurant_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in ['restaurant', 'dining', 'food', 'meal']), axis=1)
        ]

        if not restaurant_emails.empty and 'Date' in restaurant_emails.columns:
            try:
                email_dates = pd.to_datetime(restaurant_emails['Date'], format='mixed', utc=True)
                if len(email_dates) >= 3:
                    # Calculate dining frequency
                    date_diffs = email_dates.sort_values().diff().dropna()
                    if not date_diffs.empty:
                        avg_days_between = date_diffs.mean().days

                        frequency_type = "frequent_diner" if avg_days_between < 7 else "occasional_diner"
                        patterns.append(BehaviorPattern(
                            pattern_type=frequency_type,
                            description=f"Dining frequency: every {avg_days_between:.0f} days on average",
                            frequency=len(email_dates),
                            recency=email_dates.max(),
                            confidence=min(0.8, len(email_dates) * 0.15),
                            evidence=[f"Found {len(email_dates)} dining-related communications"],
                            tags=["dining_frequency", "eating_habits"]
                        ))

            except Exception:
                pass

        return patterns

    def generate_recommendations(self, insights: List[Insight], patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """Generate restaurant-specific recommendations."""
        recommendations = []

        # Cuisine exploration recommendations
        cuisine_insights = [i for i in insights if any(word in i.description.lower()
                          for word in ['cuisine', 'italian', 'chinese', 'mexican', 'thai', 'indian',
                                     'japanese', 'french', 'mediterranean', 'food', 'dish'])]

        if cuisine_insights:
            for insight in cuisine_insights[:2]:
                if insight.confidence >= 0.5:
                    recommendations.append({
                        'type': 'cuisine_discovery',
                        'title': 'New Cuisine Exploration',
                        'description': f'Discover restaurants serving cuisines similar to your preferences for {insight.description.lower()}',
                        'confidence': insight.confidence,
                        'category': self.category.value,
                        'priority': 'high' if insight.confidence > 0.7 else 'medium'
                    })

        # Delivery optimization
        delivery_patterns = [p for p in patterns if 'delivery' in p.pattern_type]
        if delivery_patterns:
            recommendations.append({
                'type': 'delivery_optimization',
                'title': 'Smart Delivery Recommendations',
                'description': 'Get personalized delivery recommendations based on your ordering history and preferences',
                'confidence': 0.8,
                'category': self.category.value,
                'priority': 'medium'
            })

        # Restaurant discovery
        research_patterns = [p for p in patterns if 'research' in p.pattern_type]
        if research_patterns or any('discovery' in i.description.lower() for i in insights):
            recommendations.append({
                'type': 'restaurant_discovery',
                'title': 'Personalized Restaurant Recommendations',
                'description': 'Discover new restaurants that match your taste preferences and dining style',
                'confidence': 0.7,
                'category': self.category.value,
                'priority': 'high'
            })

        # Dining experience optimization
        reservation_patterns = [p for p in patterns if 'reservation' in p.pattern_type]
        if reservation_patterns:
            recommendations.append({
                'type': 'dining_experience',
                'title': 'Enhanced Dining Experiences',
                'description': 'Get recommendations for special dining experiences and hard-to-book restaurants',
                'confidence': 0.6,
                'category': self.category.value,
                'priority': 'medium'
            })

        # Dietary preferences support
        dietary_insights = [i for i in insights if any(word in i.description.lower()
                          for word in ['vegetarian', 'vegan', 'gluten-free', 'organic', 'dietary'])]

        if dietary_insights:
            recommendations.append({
                'type': 'dietary_preferences',
                'title': 'Dietary-Friendly Restaurant Options',
                'description': 'Find restaurants that cater to your specific dietary preferences and restrictions',
                'confidence': 0.8,
                'category': self.category.value,
                'priority': 'high'
            })

        return recommendations[:5]  # Limit to top 5 recommendations