"""
Health Category Analyzer

Analyzes health and wellness-related email communications to identify:
- Fitness preferences and workout habits
- Nutritional interests and dietary patterns
- Healthcare provider relationships
- Wellness service usage (apps, subscriptions)
- Health goal tracking and progress patterns
"""

from typing import List, Dict, Any
import pandas as pd
from datetime import datetime

from .base_category_analyzer import BaseCategoryAnalyzer
from ...models.consumer_profile import RecommendationCategoryType, BehaviorPattern, Insight
from ..llm_analysis_engine import LLMAnalysisEngine


class HealthAnalyzer(BaseCategoryAnalyzer):
    """Health and wellness-specific category analyzer."""

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        super().__init__(analysis_engine, RecommendationCategoryType.HEALTH)

    def get_category_keywords(self) -> List[str]:
        """Health-related keywords for filtering."""
        return [
            'fitness', 'workout', 'exercise', 'gym', 'health', 'wellness',
            'nutrition', 'diet', 'calories', 'protein', 'vitamins', 'supplements',
            'meditation', 'mindfulness', 'yoga', 'pilates', 'running', 'cycling',
            'weight', 'steps', 'heart rate', 'sleep', 'hydration', 'doctor',
            'appointment', 'medical', 'insurance', 'prescription', 'pharmacy',
            'fitbit', 'apple health', 'myfitnesspal', 'strava', 'peloton',
            'headspace', 'calm', 'noom', 'weight watchers', 'therapy',
            'mental health', 'stress', 'anxiety', 'depression', 'counseling'
        ]

    def get_category_senders(self) -> List[str]:
        """Health-related sender patterns."""
        return [
            'fitbit', 'apple', 'myfitnesspal', 'strava', 'peloton', 'nike',
            'headspace', 'calm', 'noom', 'weight watchers', 'beachbody',
            'cvs', 'walgreens', 'pharmacy', 'doctor', 'medical', 'health',
            'wellness', 'fitness', 'yoga', 'meditation', 'nutrition',
            'supplement', 'vitamin', 'hospital', 'clinic', 'insurance'
        ]

    def get_llm_analysis_prompt(self) -> str:
        """LLM prompt for health analysis."""
        return """
Analyze the following health and wellness-related emails to identify consumer health behaviors and preferences.

Focus on:
1. Fitness activities and exercise preferences (cardio, strength, yoga, sports)
2. Nutritional interests and dietary patterns (keto, vegan, low-carb, supplements)
3. Health tracking habits (steps, calories, sleep, heart rate, weight)
4. Wellness services and app usage (meditation, therapy, coaching)
5. Healthcare provider relationships and appointment patterns
6. Health goal setting and progress tracking
7. Mental health and stress management approaches
8. Preventive care and health screening habits
9. Health spending patterns and insurance usage
10. Social vs solo fitness preferences
11. Seasonal health behavior changes
12. Health information seeking patterns

Provide insights about their health and wellness priorities and behaviors based on email evidence.
Note: Be sensitive to health privacy and focus on behavioral patterns rather than specific medical conditions.
"""

    def analyze_behavior_patterns(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze health-specific behavior patterns."""
        patterns = []

        if email_data.empty:
            return patterns

        # Fitness app engagement
        fitness_keywords = ['fitbit', 'strava', 'peloton', 'nike', 'workout', 'exercise', 'fitness']
        fitness_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in fitness_keywords), axis=1)
        ]

        if not fitness_emails.empty:
            fitness_count = len(fitness_emails)
            patterns.append(BehaviorPattern(
                pattern_type="fitness_tracking",
                description=f"Active fitness tracking and app engagement",
                frequency=fitness_count,
                recency=pd.to_datetime(fitness_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in fitness_emails.columns else datetime.now(),
                confidence=min(0.9, fitness_count * 0.3),
                evidence=[f"Found {fitness_count} fitness-related communications"],
                tags=["fitness", "health_tracking", "exercise"]
            ))

        # Wellness service usage
        wellness_keywords = ['meditation', 'mindfulness', 'headspace', 'calm', 'therapy', 'mental health']
        wellness_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in wellness_keywords), axis=1)
        ]

        if not wellness_emails.empty:
            wellness_count = len(wellness_emails)
            patterns.append(BehaviorPattern(
                pattern_type="wellness_engagement",
                description=f"Active wellness and mental health service usage",
                frequency=wellness_count,
                recency=pd.to_datetime(wellness_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in wellness_emails.columns else datetime.now(),
                confidence=min(0.8, wellness_count * 0.25),
                evidence=[f"Found {wellness_count} wellness-related communications"],
                tags=["wellness", "mental_health", "mindfulness"]
            ))

        # Healthcare provider engagement
        healthcare_keywords = ['doctor', 'appointment', 'medical', 'clinic', 'hospital', 'insurance']
        healthcare_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in healthcare_keywords), axis=1)
        ]

        if not healthcare_emails.empty:
            healthcare_count = len(healthcare_emails)
            patterns.append(BehaviorPattern(
                pattern_type="healthcare_engagement",
                description=f"Active healthcare provider communication",
                frequency=healthcare_count,
                recency=pd.to_datetime(healthcare_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in healthcare_emails.columns else datetime.now(),
                confidence=min(0.7, healthcare_count * 0.2),
                evidence=[f"Found {healthcare_count} healthcare-related communications"],
                tags=["healthcare", "medical", "appointments"]
            ))

        # Nutrition and supplement interest
        nutrition_keywords = ['nutrition', 'diet', 'supplement', 'vitamin', 'protein', 'calories']
        nutrition_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in nutrition_keywords), axis=1)
        ]

        if not nutrition_emails.empty:
            nutrition_count = len(nutrition_emails)
            patterns.append(BehaviorPattern(
                pattern_type="nutrition_focus",
                description=f"Active interest in nutrition and supplementation",
                frequency=nutrition_count,
                recency=pd.to_datetime(nutrition_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in nutrition_emails.columns else datetime.now(),
                confidence=min(0.8, nutrition_count * 0.25),
                evidence=[f"Found {nutrition_count} nutrition-related communications"],
                tags=["nutrition", "diet", "supplements"]
            ))

        return patterns

    def generate_recommendations(self, insights: List[Insight], patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """Generate health-specific recommendations."""
        recommendations = []

        # Fitness optimization recommendations
        fitness_patterns = [p for p in patterns if 'fitness' in p.pattern_type]
        fitness_insights = [i for i in insights if any(word in i.description.lower()
                          for word in ['fitness', 'exercise', 'workout', 'training'])]

        if fitness_patterns or fitness_insights:
            recommendations.append({
                'type': 'fitness_optimization',
                'title': 'Personalized Fitness Plan',
                'description': 'Optimize your workout routine based on your exercise preferences and tracking habits',
                'confidence': 0.8,
                'category': self.category.value,
                'priority': 'high'
            })

        # Wellness recommendations
        wellness_patterns = [p for p in patterns if 'wellness' in p.pattern_type]
        mental_health_insights = [i for i in insights if any(word in i.description.lower()
                                for word in ['mental', 'stress', 'mindfulness', 'meditation'])]

        if wellness_patterns or mental_health_insights:
            recommendations.append({
                'type': 'wellness_enhancement',
                'title': 'Mental Wellness Resources',
                'description': 'Discover personalized wellness and stress management resources based on your interests',
                'confidence': 0.7,
                'category': self.category.value,
                'priority': 'high'
            })

        # Nutrition recommendations
        nutrition_patterns = [p for p in patterns if 'nutrition' in p.pattern_type]
        nutrition_insights = [i for i in insights if any(word in i.description.lower()
                            for word in ['nutrition', 'diet', 'food', 'supplement'])]

        if nutrition_patterns or nutrition_insights:
            recommendations.append({
                'type': 'nutrition_optimization',
                'title': 'Nutrition & Supplement Guidance',
                'description': 'Get personalized nutrition recommendations based on your dietary interests and health goals',
                'confidence': 0.7,
                'category': self.category.value,
                'priority': 'medium'
            })

        # Health tracking recommendations
        tracking_insights = [i for i in insights if any(word in i.description.lower()
                           for word in ['tracking', 'monitor', 'data', 'progress', 'goal'])]

        if fitness_patterns and tracking_insights:
            recommendations.append({
                'type': 'health_tracking',
                'title': 'Advanced Health Monitoring',
                'description': 'Enhance your health tracking with additional metrics and insights based on your current habits',
                'confidence': 0.6,
                'category': self.category.value,
                'priority': 'medium'
            })

        # Preventive care recommendations
        healthcare_patterns = [p for p in patterns if 'healthcare' in p.pattern_type]
        if healthcare_patterns:
            recommendations.append({
                'type': 'preventive_care',
                'title': 'Preventive Health Planning',
                'description': 'Stay on top of preventive care and health screenings based on your healthcare engagement patterns',
                'confidence': 0.6,
                'category': self.category.value,
                'priority': 'medium'
            })

        return recommendations[:5]  # Limit to top 5 recommendations