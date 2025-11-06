"""
Recipes Category Analyzer

Analyzes recipe and cooking-related email communications to identify:
- Cooking skill level and recipe complexity preferences
- Cuisine interests and cooking style preferences
- Dietary patterns and restrictions
- Kitchen equipment and ingredient preferences
- Meal planning and cooking frequency patterns
"""

from typing import List, Dict, Any
import pandas as pd
from datetime import datetime

from .base_category_analyzer import BaseCategoryAnalyzer
from ...models.consumer_profile import RecommendationCategoryType, BehaviorPattern, Insight
from ..llm_analysis_engine import LLMAnalysisEngine


class RecipesAnalyzer(BaseCategoryAnalyzer):
    """Recipe and cooking-specific category analyzer."""

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        super().__init__(analysis_engine, RecommendationCategoryType.RECIPES)

    def get_category_keywords(self) -> List[str]:
        """Recipe-related keywords for filtering."""
        return [
            'recipe', 'cooking', 'baking', 'chef', 'kitchen', 'ingredient',
            'cookbook', 'meal', 'dish', 'preparation', 'instructions',
            'allrecipes', 'food network', 'epicurious', 'bon appetit',
            'tasty', 'yummly', 'delish', 'serious eats', 'food52',
            'instant pot', 'slow cooker', 'air fryer', 'oven', 'stovetop',
            'grilling', 'roasting', 'sauteing', 'steaming', 'frying',
            'vegetarian', 'vegan', 'gluten-free', 'keto', 'paleo',
            'healthy', 'low-carb', 'dairy-free', 'sugar-free', 'organic',
            'appetizer', 'main course', 'dessert', 'side dish', 'snack',
            'breakfast', 'lunch', 'dinner', 'brunch', 'meal prep'
        ]

    def get_category_senders(self) -> List[str]:
        """Recipe-related sender patterns."""
        return [
            'allrecipes', 'food network', 'epicurious', 'bon appetit',
            'tasty', 'yummly', 'delish', 'serious eats', 'food52',
            'cooking', 'recipe', 'chef', 'kitchen', 'food', 'meal',
            'culinary', 'gastronomy', 'nutrition', 'cookbook'
        ]

    def get_llm_analysis_prompt(self) -> str:
        """LLM prompt for recipe analysis."""
        return """
Analyze the following recipe and cooking-related emails to identify consumer cooking preferences and behaviors.

Focus on:
1. Cooking skill level and complexity preferences (beginner, intermediate, advanced)
2. Cuisine types and cooking style preferences (Italian, Asian, American, fusion, etc.)
3. Dietary preferences and restrictions (vegetarian, vegan, keto, gluten-free, etc.)
4. Cooking methods and equipment preferences (baking, grilling, slow cooking, air frying)
5. Meal types and timing (breakfast, lunch, dinner, meal prep, quick meals)
6. Ingredient preferences and specialty items
7. Cooking frequency and meal planning patterns
8. Recipe source preferences (apps, websites, cookbooks, videos)
9. Seasonal cooking patterns and ingredient usage
10. Health-conscious cooking behaviors
11. Family vs individual cooking patterns
12. Time constraints and convenience preferences

Provide insights about their cooking personality and culinary interests based on email evidence.
"""

    def analyze_behavior_patterns(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
        """Analyze recipe-specific behavior patterns."""
        patterns = []

        if email_data.empty:
            return patterns

        # Recipe source engagement
        recipe_source_keywords = ['allrecipes', 'food network', 'epicurious', 'tasty', 'yummly']
        recipe_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in recipe_source_keywords), axis=1)
        ]

        if not recipe_emails.empty:
            recipe_count = len(recipe_emails)
            patterns.append(BehaviorPattern(
                pattern_type="recipe_source_engagement",
                description=f"Active engagement with recipe platforms and sources",
                frequency=recipe_count,
                recency=pd.to_datetime(recipe_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in recipe_emails.columns else datetime.now(),
                confidence=min(0.9, recipe_count * 0.3),
                evidence=[f"Found {recipe_count} recipe source communications"],
                tags=["recipe_sources", "cooking_inspiration", "meal_planning"]
            ))

        # Cooking method preferences
        cooking_method_keywords = ['instant pot', 'slow cooker', 'air fryer', 'baking', 'grilling']
        method_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in cooking_method_keywords), axis=1)
        ]

        if not method_emails.empty:
            method_count = len(method_emails)
            patterns.append(BehaviorPattern(
                pattern_type="cooking_method_interest",
                description=f"Interest in specific cooking methods and equipment",
                frequency=method_count,
                recency=pd.to_datetime(method_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in method_emails.columns else datetime.now(),
                confidence=min(0.8, method_count * 0.25),
                evidence=[f"Found {method_count} cooking method communications"],
                tags=["cooking_methods", "kitchen_equipment", "technique"]
            ))

        # Dietary pattern analysis
        dietary_keywords = ['vegetarian', 'vegan', 'gluten-free', 'keto', 'paleo', 'healthy', 'low-carb']
        dietary_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in dietary_keywords), axis=1)
        ]

        if not dietary_emails.empty:
            dietary_count = len(dietary_emails)
            patterns.append(BehaviorPattern(
                pattern_type="dietary_focus",
                description=f"Focus on specific dietary patterns and healthy cooking",
                frequency=dietary_count,
                recency=pd.to_datetime(dietary_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in dietary_emails.columns else datetime.now(),
                confidence=min(0.9, dietary_count * 0.3),
                evidence=[f"Found {dietary_count} dietary-focused communications"],
                tags=["dietary_preferences", "healthy_cooking", "nutrition"]
            ))

        # Meal planning patterns
        meal_prep_keywords = ['meal prep', 'meal planning', 'weekly', 'batch cooking', 'make ahead']
        meal_prep_emails = email_data[
            email_data.apply(lambda row: any(keyword in str(row).lower()
                           for keyword in meal_prep_keywords), axis=1)
        ]

        if not meal_prep_emails.empty:
            meal_prep_count = len(meal_prep_emails)
            patterns.append(BehaviorPattern(
                pattern_type="meal_planning_behavior",
                description=f"Active meal planning and preparation habits",
                frequency=meal_prep_count,
                recency=pd.to_datetime(meal_prep_emails['Date'].iloc[-1], format='mixed', utc=True) if 'Date' in meal_prep_emails.columns else datetime.now(),
                confidence=min(0.8, meal_prep_count * 0.25),
                evidence=[f"Found {meal_prep_count} meal planning communications"],
                tags=["meal_planning", "organization", "efficiency"]
            ))

        return patterns

    def generate_recommendations(self, insights: List[Insight], patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
        """Generate recipe-specific recommendations."""
        recommendations = []

        # Recipe discovery recommendations
        cuisine_insights = [i for i in insights if any(word in i.description.lower()
                          for word in ['cuisine', 'cooking', 'recipe', 'dish', 'flavor'])]

        if cuisine_insights:
            for insight in cuisine_insights[:2]:
                if insight.confidence >= 0.5:
                    recommendations.append({
                        'type': 'recipe_discovery',
                        'title': 'Personalized Recipe Recommendations',
                        'description': f'Discover new recipes that match your cooking style and interest in {insight.description.lower()}',
                        'confidence': insight.confidence,
                        'category': self.category.value,
                        'priority': 'high' if insight.confidence > 0.7 else 'medium'
                    })

        # Cooking skill development
        method_patterns = [p for p in patterns if 'method' in p.pattern_type]
        if method_patterns:
            recommendations.append({
                'type': 'skill_development',
                'title': 'Cooking Technique Enhancement',
                'description': 'Learn new cooking techniques and methods to expand your culinary skills',
                'confidence': 0.7,
                'category': self.category.value,
                'priority': 'medium'
            })

        # Meal planning optimization
        planning_patterns = [p for p in patterns if 'planning' in p.pattern_type]
        if planning_patterns:
            recommendations.append({
                'type': 'meal_planning',
                'title': 'Optimized Meal Planning',
                'description': 'Streamline your meal planning with personalized weekly menus and shopping lists',
                'confidence': 0.8,
                'category': self.category.value,
                'priority': 'high'
            })

        # Dietary-specific recommendations
        dietary_patterns = [p for p in patterns if 'dietary' in p.pattern_type]
        dietary_insights = [i for i in insights if any(word in i.description.lower()
                          for word in ['vegetarian', 'vegan', 'gluten-free', 'keto', 'healthy'])]

        if dietary_patterns or dietary_insights:
            recommendations.append({
                'type': 'dietary_recipes',
                'title': 'Specialized Dietary Recipes',
                'description': 'Find recipes that align with your dietary preferences and nutritional goals',
                'confidence': 0.8,
                'category': self.category.value,
                'priority': 'high'
            })

        # Kitchen equipment recommendations
        equipment_insights = [i for i in insights if any(word in i.description.lower()
                            for word in ['equipment', 'kitchen', 'tool', 'appliance', 'gadget'])]

        if method_patterns or equipment_insights:
            recommendations.append({
                'type': 'kitchen_equipment',
                'title': 'Kitchen Equipment Suggestions',
                'description': 'Discover kitchen tools and equipment that can enhance your cooking experience',
                'confidence': 0.6,
                'category': self.category.value,
                'priority': 'medium'
            })

        return recommendations[:5]  # Limit to top 5 recommendations