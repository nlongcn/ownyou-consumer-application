"""
Base Category Analyzer Framework

Provides a standardized, extensible framework for creating new category analyzers.
New categories can be added by simply inheriting from this base class.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Set
import pandas as pd
from datetime import datetime

from ..recommendation_category import RecommendationCategory, CategoryAnalysisContext, RecommendationResult
from ..llm_analysis_engine import LLMAnalysisEngine, AnalysisRequest
from ...models.consumer_profile import (
    RecommendationCategoryType, CategoryProfile, Insight, BehaviorPattern
)


class BaseCategoryAnalyzer(RecommendationCategory, ABC):
    """
    Abstract base class for all category analyzers.

    Provides standard framework for:
    - Email filtering and relevance detection
    - LLM-based insight generation
    - Behavior pattern analysis
    - Recommendation generation
    """

    def __init__(self, analysis_engine: LLMAnalysisEngine, category: RecommendationCategoryType):
        """Initialize base analyzer."""
        super().__init__(analysis_engine, category)

    @abstractmethod
    def get_category_keywords(self) -> List[str]:
        """Return keywords that indicate relevance to this category."""
        pass

    @abstractmethod
    def get_category_senders(self) -> List[str]:
        """Return email sender patterns relevant to this category."""
        pass

    @abstractmethod
    def get_llm_analysis_prompt(self) -> str:
        """Return LLM prompt template for analyzing emails in this category."""
        pass

    def get_category_specific_filters(self) -> Dict[str, Any]:
        """Get email filters for category-related content."""
        return {
            'keywords': self.get_category_keywords(),
            'sender_patterns': self.get_category_senders(),
            'categories': [self.category.value]
        }

    def filter_relevant_emails(self, email_data: pd.DataFrame) -> pd.DataFrame:
        """Filter emails relevant to this category."""
        if email_data.empty:
            return email_data

        filters = self.get_category_specific_filters()
        keywords = filters.get('keywords', [])
        sender_patterns = filters.get('sender_patterns', [])

        # Filter by keywords in subject, summary, or key_topics
        keyword_mask = pd.Series([False] * len(email_data))

        for keyword in keywords:
            if 'Subject' in email_data.columns:
                keyword_mask |= email_data['Subject'].str.contains(keyword, case=False, na=False)
            if 'Summary' in email_data.columns:
                keyword_mask |= email_data['Summary'].str.contains(keyword, case=False, na=False)
            if 'Key_Topics' in email_data.columns:
                keyword_mask |= email_data['Key_Topics'].str.contains(keyword, case=False, na=False)

        # Filter by sender patterns
        sender_mask = pd.Series([False] * len(email_data))
        if 'From' in email_data.columns:
            for pattern in sender_patterns:
                sender_mask |= email_data['From'].str.contains(pattern, case=False, na=False)

        # Combine filters (OR logic)
        combined_mask = keyword_mask | sender_mask

        return email_data[combined_mask]

    def generate_insights_with_llm(self, relevant_emails: pd.DataFrame) -> List[Insight]:
        """Generate insights using LLM analysis."""
        if relevant_emails.empty:
            return []

        # Prepare email data for LLM
        email_summaries = []
        for _, email in relevant_emails.iterrows():
            summary = {
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'key_topics': email.get('Key_Topics', ''),
                'date': email.get('Date', '')
            }
            email_summaries.append(summary)

        # Create LLM analysis request
        prompt = self.get_llm_analysis_prompt()
        user_prompt = f"""
{prompt}

Email Data:
{email_summaries}

Return insights in this JSON format:
{{
  "insights": [
    {{
      "insight_type": "preference|behavior|pattern",
      "description": "Clear description of the insight",
      "confidence": 0.0-1.0,
      "evidence": ["supporting evidence from emails"]
    }}
  ]
}}
"""

        request = AnalysisRequest(
            system_prompt="You are a consumer behavior analyst specializing in email communication patterns.",
            user_prompt=user_prompt,
            response_format="json",
            data_payload={"category": self.category.value}
        )

        # Execute LLM analysis
        result = self.analysis_engine.analyze(request)

        if not result.success:
            return []

        # Parse insights from LLM response
        insights = []
        try:
            llm_insights = result.data.get('insights', [])
            for insight_data in llm_insights:
                insight = Insight(
                    insight_type=insight_data.get('insight_type', 'unknown'),
                    description=insight_data.get('description', ''),
                    evidence=insight_data.get('evidence', []),
                    confidence=insight_data.get('confidence', 0.5),
                    created_at=datetime.now(),
                    last_updated=datetime.now()
                )
                insights.append(insight)
        except Exception as e:
            self.logger.warning(f"Failed to parse insights for {self.category.value}: {e}")

        return insights

    def analyze(self, context: CategoryAnalysisContext) -> RecommendationResult:
        """Main analysis method - can be overridden for custom logic."""
        # Filter relevant emails
        relevant_emails = self.filter_relevant_emails(context.email_data)

        # Generate insights
        insights = self.generate_insights_with_llm(relevant_emails)

        # Analyze behavior patterns (override in subclass for custom patterns)
        patterns = self.analyze_behavior_patterns(relevant_emails)

        # Generate recommendations (override in subclass for custom recommendations)
        recommendations = self.generate_recommendations(insights, patterns)

        # Calculate engagement score
        engagement_score = self.calculate_engagement_score(relevant_emails, insights)

        return RecommendationResult(
            category=self.category,
            insights=insights,
            behavior_patterns=patterns,
            recommendations=recommendations,
            engagement_score=engagement_score,
            confidence=self.calculate_overall_confidence(insights)
        )

    def analyze_behavior_patterns(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze behavioral patterns - override in subclass for category-specific patterns."""
        return []

    def generate_recommendations(self, insights: List[Insight], patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """Generate recommendations - override in subclass for category-specific logic."""
        recommendations = []

        # Generic recommendations based on insights
        for insight in insights[:5]:  # Top 5 insights
            if insight.confidence >= 0.5:
                rec = {
                    'type': f'{self.category.value}_recommendation',
                    'title': f'Explore {insight.insight_type.replace("_", " ").title()}',
                    'description': f'Based on your {insight.description.lower()}, discover new options in this area',
                    'confidence': insight.confidence,
                    'category': self.category.value,
                    'priority': 'medium'
                }
                recommendations.append(rec)

        return recommendations

    def calculate_engagement_score(self, email_data: pd.DataFrame, insights: List[Insight]) -> float:
        """Calculate engagement score for this category."""
        if email_data.empty:
            return 0.0

        # Base score on email volume and insight confidence
        email_count = len(email_data)
        avg_confidence = sum(insight.confidence for insight in insights) / len(insights) if insights else 0.0

        # Simple scoring formula (can be overridden)
        engagement_score = min(1.0, (email_count * 0.1) + avg_confidence) / 2

        return engagement_score

    def calculate_overall_confidence(self, insights: List[Insight]) -> float:
        """Calculate overall confidence for the category analysis."""
        if not insights:
            return 0.0

        return sum(insight.confidence for insight in insights) / len(insights)


class CategoryAnalyzerRegistry:
    """
    Auto-discovery registry for category analyzers.

    Automatically finds and registers all category analyzer classes.
    """

    def __init__(self):
        self._analyzers: Dict[RecommendationCategoryType, BaseCategoryAnalyzer] = {}

    def register_analyzer(self, analyzer):
        """Register a category analyzer."""
        # Handle both BaseCategoryAnalyzer and RecommendationCategory
        category = getattr(analyzer, 'category', getattr(analyzer, 'category_type', None))
        if category:
            self._analyzers[category] = analyzer

    def get_analyzer(self, category: RecommendationCategoryType) -> Optional[BaseCategoryAnalyzer]:
        """Get analyzer for a specific category."""
        return self._analyzers.get(category)

    def get_all_analyzers(self) -> Dict[RecommendationCategoryType, BaseCategoryAnalyzer]:
        """Get all registered analyzers."""
        return self._analyzers.copy()

    def auto_discover_analyzers(self, analysis_engine: LLMAnalysisEngine):
        """
        Auto-discover and register all available category analyzers.

        This method automatically imports and registers all analyzer classes
        that inherit from BaseCategoryAnalyzer.
        """
        # Import all available analyzers
        try:
            from .shopping_analyzer import ShoppingAnalyzer
        except ImportError:
            ShoppingAnalyzer = None

        try:
            from .travel_analyzer import TravelAnalyzer
        except ImportError:
            TravelAnalyzer = None

        try:
            from .entertainment_analyzer import EntertainmentAnalyzer
        except ImportError:
            EntertainmentAnalyzer = None

        try:
            from .health_analyzer import HealthAnalyzer
        except ImportError:
            HealthAnalyzer = None

        try:
            from .restaurants_analyzer import RestaurantsAnalyzer
        except ImportError:
            RestaurantsAnalyzer = None

        try:
            from .recipes_analyzer import RecipesAnalyzer
        except ImportError:
            RecipesAnalyzer = None

        # Register each analyzer
        analyzer_classes = [
            ShoppingAnalyzer,
            TravelAnalyzer,
            EntertainmentAnalyzer,
            HealthAnalyzer,
            RestaurantsAnalyzer,
            RecipesAnalyzer
        ]

        for analyzer_class in analyzer_classes:
            if analyzer_class is not None:
                try:
                    analyzer = analyzer_class(analysis_engine)
                    self.register_analyzer(analyzer)
                except Exception as e:
                    # Skip analyzers that fail to initialize
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Failed to initialize {analyzer_class.__name__}: {e}")