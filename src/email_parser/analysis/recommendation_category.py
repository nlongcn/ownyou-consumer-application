"""
Recommendation Category Base Classes

Abstract base classes and interfaces for category-specific recommendation analyzers.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import pandas as pd
from datetime import datetime

from ..models.consumer_profile import (
    RecommendationCategoryType, ConsumerProfile, CategoryProfile,
    Insight, BehaviorPattern
)
from .llm_analysis_engine import LLMAnalysisEngine, AnalysisResult


@dataclass
class RecommendationResult:
    """Result from category-specific recommendation analysis."""
    category: RecommendationCategoryType
    insights: List[Insight]
    behavior_patterns: List[BehaviorPattern]
    recommendations: List[Dict[str, Any]]
    confidence_score: float
    analysis_timestamp: datetime


@dataclass
class CategoryAnalysisContext:
    """Context information for category analysis."""
    email_data: pd.DataFrame
    existing_profile: Optional[CategoryProfile]
    analysis_parameters: Dict[str, Any]
    cross_category_context: Dict[str, Any]  # Insights from other categories


class RecommendationCategory(ABC):
    """
    Abstract base class for category-specific recommendation analyzers.

    Each category (shopping, travel, entertainment, health, restaurants, recipes)
    implements this interface to provide specialized analysis and recommendations.
    """

    def __init__(self, analysis_engine: LLMAnalysisEngine, category_type: RecommendationCategoryType):
        """
        Initialize category analyzer.

        Args:
            analysis_engine: Shared LLM analysis engine
            category_type: The category this analyzer handles
        """
        self.analysis_engine = analysis_engine
        self.category_type = category_type
        self.logger = analysis_engine.logger

    @abstractmethod
    def analyze(self, context: CategoryAnalysisContext) -> RecommendationResult:
        """
        Perform category-specific analysis.

        Args:
            context: Analysis context with email data and existing profile

        Returns:
            RecommendationResult with insights, patterns, and recommendations
        """
        pass

    @abstractmethod
    def generate_recommendations(self, insights: List[Insight],
                               patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """
        Generate actionable recommendations based on insights and patterns.

        Args:
            insights: Category-specific insights
            patterns: Behavioral patterns for this category

        Returns:
            List of recommendation dictionaries
        """
        pass

    @abstractmethod
    def update_profile(self, profile: CategoryProfile,
                      result: RecommendationResult) -> CategoryProfile:
        """
        Update category profile with new analysis results.

        Args:
            profile: Existing category profile
            result: New analysis results

        Returns:
            Updated category profile
        """
        pass

    def get_category_specific_filters(self) -> Dict[str, Any]:
        """
        Get email filters specific to this category.

        Returns:
            Dictionary of filters to apply to email data
        """
        # Default implementation - can be overridden
        return {}

    def extract_category_signals(self, email_data: pd.DataFrame) -> pd.DataFrame:
        """
        Filter and preprocess emails for category-specific analysis.

        Args:
            email_data: Raw email DataFrame

        Returns:
            Filtered DataFrame with category-relevant emails
        """
        filters = self.get_category_specific_filters()
        filtered_data = email_data.copy()

        # Check if analyzer wants all emails (for lifestyle-based analysis)
        if filters.get('analyze_all_emails', False):
            # Return all emails for lifestyle analysis
            return filtered_data

        # Apply keyword filters if specified
        if 'keywords' in filters:
            keyword_pattern = '|'.join(filters['keywords'])
            mask = (
                filtered_data['Subject'].str.contains(keyword_pattern, case=False, na=False) |
                filtered_data['Summary'].str.contains(keyword_pattern, case=False, na=False) |
                filtered_data['Key_Topics'].str.contains(keyword_pattern, case=False, na=False)
            )
            filtered_data = filtered_data[mask]

        # Apply category filters if specified
        if 'categories' in filters:
            filtered_data = filtered_data[
                filtered_data['Category'].isin(filters['categories'])
            ]

        # Apply sender filters if specified
        if 'sender_patterns' in filters:
            sender_pattern = '|'.join(filters['sender_patterns'])
            filtered_data = filtered_data[
                filtered_data['From'].str.contains(sender_pattern, case=False, na=False)
            ]

        return filtered_data

    def calculate_engagement_score(self, email_data: pd.DataFrame,
                                 insights: List[Insight]) -> float:
        """
        Calculate engagement score for this category based on email patterns and insights.

        Args:
            email_data: Category-filtered email data
            insights: Generated insights for this category

        Returns:
            Engagement score between 0.0 and 1.0
        """
        if email_data.empty:
            return 0.0

        factors = []

        # Factor 1: Email volume (normalized)
        email_count = len(email_data)
        volume_score = min(1.0, email_count / 20.0)  # Cap at 20 emails
        factors.append(volume_score)

        # Factor 2: Insight confidence
        if insights:
            avg_confidence = sum(insight.confidence for insight in insights) / len(insights)
            factors.append(avg_confidence)

        # Factor 3: Recency of engagement
        if 'Date' in email_data.columns:
            try:
                recent_emails = email_data[
                    pd.to_datetime(email_data['Date']) >=
                    pd.Timestamp.now() - pd.Timedelta(days=30)
                ]
                recency_score = len(recent_emails) / len(email_data)
                factors.append(recency_score)
            except Exception:
                # If date parsing fails, skip recency factor
                pass

        # Factor 4: Diversity of sources
        unique_senders = email_data['From'].nunique()
        diversity_score = min(1.0, unique_senders / 5.0)  # Cap at 5 senders
        factors.append(diversity_score)

        return sum(factors) / len(factors) if factors else 0.0

    def merge_with_existing_insights(self, existing_insights: List[Insight],
                                   new_insights: List[Insight]) -> List[Insight]:
        """
        Intelligently merge new insights with existing ones.

        Args:
            existing_insights: Current insights in profile
            new_insights: Newly generated insights

        Returns:
            Merged list of insights
        """
        # Create a dictionary for efficient lookup
        existing_dict = {
            (insight.insight_type, insight.description): insight
            for insight in existing_insights
        }

        merged_insights = []

        # Process new insights
        for new_insight in new_insights:
            key = (new_insight.insight_type, new_insight.description)

            if key in existing_dict:
                # Update existing insight
                existing_insight = existing_dict[key]
                # Combine evidence
                combined_evidence = list(set(existing_insight.evidence + new_insight.evidence))
                existing_insight.evidence = combined_evidence
                # Update confidence (weighted average)
                existing_insight.update_confidence(
                    (existing_insight.confidence + new_insight.confidence) / 2
                )
                merged_insights.append(existing_insight)
                # Remove from existing dict so we don't add it again
                del existing_dict[key]
            else:
                # Add new insight
                merged_insights.append(new_insight)

        # Add remaining existing insights that weren't updated
        merged_insights.extend(existing_dict.values())

        return merged_insights

    def _create_insight(self, insight_type: str, description: str,
                       evidence: List[str], confidence: float) -> Insight:
        """Helper method to create standardized insights."""
        return Insight(
            insight_type=insight_type,
            description=description,
            evidence=evidence,
            confidence=confidence,
            confidence_level=Insight._calculate_confidence_level(confidence)
        )

    def _create_behavior_pattern(self, pattern_type: str, description: str,
                               frequency: int, evidence: List[str],
                               confidence: float, tags: List[str] = None) -> BehaviorPattern:
        """Helper method to create standardized behavior patterns."""
        import uuid
        return BehaviorPattern(
            pattern_id=str(uuid.uuid4()),
            pattern_type=pattern_type,
            description=description,
            frequency=frequency,
            recency=datetime.utcnow(),
            confidence=confidence,
            evidence=evidence,
            tags=tags or []
        )


class CategoryAnalyzerRegistry:
    """
    Registry for managing category-specific analyzers.

    Provides a central place to register and retrieve analyzers for different
    recommendation categories.
    """

    def __init__(self):
        """Initialize empty registry."""
        self._analyzers: Dict[RecommendationCategoryType, RecommendationCategory] = {}

    def register(self, analyzer: RecommendationCategory) -> None:
        """
        Register a category analyzer.

        Args:
            analyzer: Category analyzer to register
        """
        self._analyzers[analyzer.category_type] = analyzer

    def get_analyzer(self, category: RecommendationCategoryType) -> Optional[RecommendationCategory]:
        """
        Get analyzer for specific category.

        Args:
            category: Category to get analyzer for

        Returns:
            Category analyzer or None if not found
        """
        return self._analyzers.get(category)

    def get_all_analyzers(self) -> Dict[RecommendationCategoryType, RecommendationCategory]:
        """Get all registered analyzers."""
        return self._analyzers.copy()

    def analyze_all_categories(self, email_data: pd.DataFrame,
                             consumer_profile: ConsumerProfile) -> Dict[RecommendationCategoryType, RecommendationResult]:
        """
        Run analysis for all registered categories.

        Args:
            email_data: Email data to analyze
            consumer_profile: Existing consumer profile

        Returns:
            Dictionary mapping categories to analysis results
        """
        results = {}

        for category, analyzer in self._analyzers.items():
            try:
                # Create analysis context
                context = CategoryAnalysisContext(
                    email_data=analyzer.extract_category_signals(email_data),
                    existing_profile=consumer_profile.get_category_profile(category),
                    analysis_parameters={},
                    cross_category_context={}  # TODO: Implement cross-category insights
                )

                # Run analysis
                result = analyzer.analyze(context)
                results[category] = result

                # Update consumer profile
                updated_profile = analyzer.update_profile(
                    consumer_profile.get_category_profile(category),
                    result
                )
                consumer_profile.categories[category] = updated_profile

            except Exception as e:
                analyzer.logger.error(f"Analysis failed for category {category.value}: {e}")

        return results


class RecommendationEngine:
    """
    High-level recommendation engine that coordinates category analyzers
    and provides unified recommendation generation.
    """

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        """
        Initialize recommendation engine.

        Args:
            analysis_engine: Shared LLM analysis engine
        """
        self.analysis_engine = analysis_engine
        self.registry = CategoryAnalyzerRegistry()
        self.logger = analysis_engine.logger

    def register_analyzer(self, analyzer: RecommendationCategory) -> None:
        """Register a category analyzer with the engine."""
        self.registry.register(analyzer)

    def analyze_consumer_profile(self, email_data: pd.DataFrame,
                               consumer_profile: ConsumerProfile) -> ConsumerProfile:
        """
        Perform comprehensive consumer profile analysis across all categories.

        Args:
            email_data: Email data to analyze
            consumer_profile: Existing consumer profile to update

        Returns:
            Updated consumer profile with new insights
        """
        # Run category-specific analyses
        category_results = self.registry.analyze_all_categories(email_data, consumer_profile)

        # Update overall profile confidence
        consumer_profile.update_confidence_score()

        # Record analysis session
        consumer_profile.add_analysis_record(
            analysis_type="comprehensive_profile_analysis",
            results={
                'categories': list(category_results.keys()),
                'insights_count': sum(
                    len(result.insights) for result in category_results.values()
                ),
                'confidence_score': consumer_profile.confidence_score
            }
        )

        return consumer_profile

    def generate_unified_recommendations(self, consumer_profile: ConsumerProfile,
                                       max_recommendations: int = 20) -> List[Dict[str, Any]]:
        """
        Generate unified recommendations across all categories.

        Args:
            consumer_profile: Consumer profile to generate recommendations for
            max_recommendations: Maximum number of recommendations to return

        Returns:
            List of unified recommendations with cross-category insights
        """
        all_recommendations = []

        # Collect recommendations from all categories
        for category, category_profile in consumer_profile.categories.items():
            analyzer = self.registry.get_analyzer(category)
            if analyzer and category_profile.insights:
                try:
                    recommendations = analyzer.generate_recommendations(
                        category_profile.insights,
                        category_profile.behavior_patterns
                    )

                    # Add category metadata
                    for rec in recommendations:
                        rec['category'] = category.value
                        rec['engagement_score'] = category_profile.engagement_score

                    all_recommendations.extend(recommendations)

                except Exception as e:
                    self.logger.error(f"Recommendation generation failed for {category.value}: {e}")

        # Sort by confidence/engagement score
        all_recommendations.sort(
            key=lambda x: x.get('confidence', 0) * x.get('engagement_score', 0),
            reverse=True
        )

        return all_recommendations[:max_recommendations]