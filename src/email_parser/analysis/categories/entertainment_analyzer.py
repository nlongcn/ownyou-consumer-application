"""
Entertainment Category Analyzer

Analyzes entertainment-related email communications to identify:
- Streaming service preferences and viewing habits
- Music taste and concert preferences
- Gaming interests and platform preferences
- Event attendance patterns (concerts, shows, sports)
- Content consumption preferences
"""

from typing import List, Dict, Any
import pandas as pd
from datetime import datetime

from .base_category_analyzer import BaseCategoryAnalyzer
from ...models.consumer_profile import RecommendationCategoryType, BehaviorPattern, Insight
from ..llm_analysis_engine import LLMAnalysisEngine


class EntertainmentAnalyzer(BaseCategoryAnalyzer):
    """Entertainment-specific category analyzer."""

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        super().__init__(analysis_engine, RecommendationCategoryType.ENTERTAINMENT)

    def get_category_keywords(self) -> List[str]:
        """Entertainment-related keywords for filtering."""
        return [
            'netflix', 'hulu', 'disney+', 'amazon prime', 'hbo', 'spotify',
            'apple music', 'youtube', 'twitch', 'concert', 'movie', 'show',
            'streaming', 'playlist', 'podcast', 'episode', 'season', 'series',
            'album', 'artist', 'band', 'tour', 'ticket', 'venue', 'theater',
            'cinema', 'gaming', 'xbox', 'playstation', 'nintendo', 'steam',
            'esports', 'tournament', 'livestream', 'premiere', 'release',
            'soundtrack', 'trailer', 'review', 'rating', 'award', 'festival'
        ]

    def get_category_senders(self) -> List[str]:
        """Entertainment-related sender patterns."""
        return [
            'netflix', 'hulu', 'disney', 'amazon', 'hbo', 'spotify',
            'apple', 'youtube', 'twitch', 'ticketmaster', 'stubhub',
            'eventbrite', 'bandcamp', 'soundcloud', 'steam', 'xbox',
            'playstation', 'nintendo', 'epic games', 'entertainment',
            'music', 'gaming', 'streaming', 'concert', 'theater'
        ]

    def get_llm_analysis_prompt(self) -> str:
        """LLM prompt for entertainment analysis."""
        return """
Analyze the following entertainment-related emails to identify consumer entertainment preferences and consumption patterns.

Focus on:
1. Streaming service preferences and usage patterns
2. Music taste and genre preferences
3. Gaming interests and platform preferences
4. Live event attendance (concerts, shows, sports, festivals)
5. Content consumption habits (binge-watching, podcast listening, etc.)
6. Entertainment spending patterns and price sensitivity
7. Social vs solo entertainment preferences
8. New vs classic content preferences
9. Platform loyalty and subscription management
10. Entertainment discovery methods (recommendations, reviews, social media)
11. Seasonal entertainment patterns
12. Genre preferences across different media types

Provide insights about their entertainment personality and consumption behaviors based on email evidence.
"""

    def analyze_behavior_patterns(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze entertainment-specific behavior patterns."""
        patterns = []

        if email_data.empty:
            return patterns

        # Streaming service engagement
        streaming_keywords = ['netflix', 'hulu', 'disney+', 'amazon prime', 'hbo', 'spotify', 'apple music']
        streaming_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in streaming_keywords), axis=1)
        ]

        if not streaming_emails.empty:
            service_count = len(streaming_emails)
            patterns.append(BehaviorPattern(
                pattern_type="streaming_engagement",
                description=f"Active engagement with {service_count} streaming services",
                frequency=service_count,
                recency=pd.to_datetime(streaming_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in streaming_emails.columns else datetime.now(),
                confidence=min(0.8, service_count * 0.2),
                evidence=[f"Found {service_count} streaming service communications"],
                tags=["streaming", "digital_entertainment", "subscriptions"]
            ))

        # Event ticket patterns
        event_keywords = ['ticket', 'concert', 'show', 'venue', 'tour', 'festival']
        event_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in event_keywords), axis=1)
        ]

        if not event_emails.empty:
            event_count = len(event_emails)
            patterns.append(BehaviorPattern(
                pattern_type="live_events_attendance",
                description=f"Active attendance at live entertainment events",
                frequency=event_count,
                recency=pd.to_datetime(event_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in event_emails.columns else datetime.now(),
                confidence=min(0.9, event_count * 0.3),
                evidence=[f"Found {event_count} event-related communications"],
                tags=["live_events", "concerts", "social_entertainment"]
            ))

        # Gaming platform engagement
        gaming_keywords = ['steam', 'xbox', 'playstation', 'nintendo', 'gaming', 'game']
        gaming_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in gaming_keywords), axis=1)
        ]

        if not gaming_emails.empty:
            gaming_count = len(gaming_emails)
            patterns.append(BehaviorPattern(
                pattern_type="gaming_engagement",
                description=f"Active gaming platform engagement",
                frequency=gaming_count,
                recency=pd.to_datetime(gaming_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in gaming_emails.columns else datetime.now(),
                confidence=min(0.8, gaming_count * 0.25),
                evidence=[f"Found {gaming_count} gaming-related communications"],
                tags=["gaming", "digital_entertainment", "interactive_media"]
            ))

        return patterns

    def generate_recommendations(self, insights: List[Insight], patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """Generate entertainment-specific recommendations."""
        recommendations = []

        # Content discovery recommendations
        content_insights = [i for i in insights if any(word in i.description.lower()
                          for word in ['show', 'movie', 'series', 'music', 'artist', 'genre'])]

        if content_insights:
            for insight in content_insights[:2]:
                if insight.confidence >= 0.5:
                    recommendations.append({
                        'type': 'content_discovery',
                        'title': 'Personalized Content Recommendations',
                        'description': f'Discover new {insight.insight_type.replace("_", " ")} based on your preferences for {insight.description.lower()}',
                        'confidence': insight.confidence,
                        'category': self.category.value,
                        'priority': 'high' if insight.confidence > 0.7 else 'medium'
                    })

        # Subscription optimization
        streaming_patterns = [p for p in patterns if 'streaming' in p.pattern_type]
        if streaming_patterns:
            recommendations.append({
                'type': 'subscription_optimization',
                'title': 'Streaming Service Optimization',
                'description': 'Optimize your streaming subscriptions based on your viewing patterns and content preferences',
                'confidence': 0.7,
                'category': self.category.value,
                'priority': 'medium'
            })

        # Event recommendations
        live_event_patterns = [p for p in patterns if 'live_events' in p.pattern_type]
        if live_event_patterns:
            recommendations.append({
                'type': 'event_discovery',
                'title': 'Upcoming Events & Concerts',
                'description': 'Get notified about upcoming concerts, shows, and events matching your entertainment preferences',
                'confidence': 0.8,
                'category': self.category.value,
                'priority': 'high'
            })

        # Gaming recommendations
        gaming_patterns = [p for p in patterns if 'gaming' in p.pattern_type]
        gaming_insights = [i for i in insights if 'gaming' in i.description.lower() or 'game' in i.description.lower()]

        if gaming_patterns or gaming_insights:
            recommendations.append({
                'type': 'gaming_discovery',
                'title': 'Game Recommendations',
                'description': 'Discover new games and gaming content based on your platform preferences and gaming history',
                'confidence': 0.7,
                'category': self.category.value,
                'priority': 'medium'
            })

        # Social entertainment recommendations
        social_insights = [i for i in insights if any(word in i.description.lower()
                         for word in ['social', 'friend', 'group', 'community', 'multiplayer'])]

        if social_insights or live_event_patterns:
            recommendations.append({
                'type': 'social_entertainment',
                'title': 'Social Entertainment Options',
                'description': 'Find entertainment activities and events to enjoy with friends based on your social preferences',
                'confidence': 0.6,
                'category': self.category.value,
                'priority': 'medium'
            })

        return recommendations[:5]  # Limit to top 5 recommendations