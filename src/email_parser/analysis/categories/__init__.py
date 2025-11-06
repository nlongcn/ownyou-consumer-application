"""
Consumer Profile Category Analyzers

This package contains category-specific analyzers for consumer profile analysis.
Each analyzer inherits from BaseCategoryAnalyzer and provides specialized
analysis for different consumer categories.

Available Categories:
- Shopping: Purchase behavior and product preferences
- Travel: Travel preferences and booking patterns
- Entertainment: Streaming, events, and entertainment consumption
- Health: Fitness, wellness, and healthcare patterns
- Restaurants: Dining preferences and food delivery habits
- Recipes: Cooking interests and culinary preferences

Adding New Categories:
To add a new category analyzer:

1. Create a new file in this directory (e.g., new_category_analyzer.py)
2. Inherit from BaseCategoryAnalyzer
3. Implement the required abstract methods:
   - get_category_keywords()
   - get_category_senders()
   - get_llm_analysis_prompt()
4. Optionally override:
   - analyze_behavior_patterns()
   - generate_recommendations()
5. Add the import to CategoryAnalyzerRegistry.auto_discover_analyzers()

The system will automatically discover and register your new analyzer.
"""

from .base_category_analyzer import BaseCategoryAnalyzer, CategoryAnalyzerRegistry

__all__ = [
    'BaseCategoryAnalyzer',
    'CategoryAnalyzerRegistry'
]