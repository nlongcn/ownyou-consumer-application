# Adding New Category Analyzers

The consumer intelligence system is designed to be easily extensible. You can add new category analyzers by following these simple steps:

## Quick Start

1. **Create a new analyzer file** in the `categories/` directory
2. **Inherit from `BaseCategoryAnalyzer`**
3. **Implement required methods**
4. **The system will auto-discover your analyzer**

## Step-by-Step Guide

### 1. Create the Analyzer File

Create a new file: `src/email_parser/analysis/categories/your_category_analyzer.py`

```python
from typing import List, Dict, Any
import pandas as pd

from .base_category_analyzer import BaseCategoryAnalyzer
from ...models.consumer_profile import RecommendationCategoryType, BehaviorPattern, Insight
from ..llm_analysis_engine import LLMAnalysisEngine


class YourCategoryAnalyzer(BaseCategoryAnalyzer):
    """Your category-specific analyzer."""

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        # Replace YOUR_CATEGORY with the appropriate enum value
        super().__init__(analysis_engine, RecommendationCategoryType.YOUR_CATEGORY)
```

### 2. Implement Required Methods

You must implement these three abstract methods:

```python
def get_category_keywords(self) -> List[str]:
    """Keywords that indicate relevance to this category."""
    return [
        'keyword1', 'keyword2', 'specific_terms',
        'brand_names', 'product_types', 'services'
    ]

def get_category_senders(self) -> List[str]:
    """Email sender patterns relevant to this category."""
    return [
        'company.com', 'service_provider', 'brand_name',
        'platform', 'marketplace', 'vendor'
    ]

def get_llm_analysis_prompt(self) -> str:
    """LLM prompt template for analyzing emails in this category."""
    return """
    Analyze the following category-related emails to identify consumer preferences.

    Focus on:
    1. Specific behavior pattern 1
    2. Preference type 2
    3. Usage pattern 3
    4. Price sensitivity
    5. Brand loyalty

    Provide insights about their personality and behaviors based on email evidence.
    """
```

### 3. Optional: Customize Behavior Analysis

Override these methods for category-specific logic:

```python
def analyze_behavior_patterns(self, email_data: pd.DataFrame) -> List[BehaviorPattern]:
    """Analyze category-specific behavior patterns."""
    patterns = []

    # Your custom pattern analysis logic
    # Example: frequency analysis, timing patterns, etc.

    return patterns

def generate_recommendations(self, insights: List[Insight], patterns: List[BehaviorPattern]) -> List[Dict[str, Any]]:
    """Generate category-specific recommendations."""
    recommendations = []

    # Your custom recommendation logic

    return recommendations[:5]  # Limit to top 5
```

### 4. Add to Category Registry

Update the auto-discovery method in `base_category_analyzer.py`:

```python
# In CategoryAnalyzerRegistry.auto_discover_analyzers()
try:
    from .your_category_analyzer import YourCategoryAnalyzer
except ImportError:
    YourCategoryAnalyzer = None

# Add to analyzer_classes list
analyzer_classes = [
    ShoppingAnalyzer,
    TravelAnalyzer,
    # ... existing analyzers ...
    YourCategoryAnalyzer,  # Add your analyzer here
]
```

### 5. Add Category Enum (if needed)

If you're adding a completely new category, add it to the enum in:
`src/email_parser/models/consumer_profile.py`

```python
class RecommendationCategoryType(Enum):
    SHOPPING = "shopping"
    TRAVEL = "travel"
    # ... existing categories ...
    YOUR_CATEGORY = "your_category"  # Add new category
```

## Example: Books Category Analyzer

Here's a complete example for a books category:

```python
from typing import List, Dict, Any
import pandas as pd

from .base_category_analyzer import BaseCategoryAnalyzer
from ...models.consumer_profile import RecommendationCategoryType, BehaviorPattern, Insight
from ..llm_analysis_engine import LLMAnalysisEngine


class BooksAnalyzer(BaseCategoryAnalyzer):
    """Books and reading-specific category analyzer."""

    def __init__(self, analysis_engine: LLMAnalysisEngine):
        super().__init__(analysis_engine, RecommendationCategoryType.BOOKS)

    def get_category_keywords(self) -> List[str]:
        return [
            'book', 'reading', 'author', 'novel', 'fiction', 'non-fiction',
            'kindle', 'ebook', 'audiobook', 'library', 'bookstore',
            'bestseller', 'review', 'recommendation', 'genre', 'series'
        ]

    def get_category_senders(self) -> List[str]:
        return [
            'amazon', 'kindle', 'audible', 'goodreads', 'bookbub',
            'scribd', 'overdrive', 'barnes', 'waterstones',
            'book', 'library', 'publisher', 'author'
        ]

    def get_llm_analysis_prompt(self) -> str:
        return """
        Analyze book and reading-related emails to identify reading preferences.

        Focus on:
        1. Genre preferences (fiction, non-fiction, mystery, romance, etc.)
        2. Reading frequency and volume
        3. Format preferences (physical, ebook, audiobook)
        4. Author preferences and discovery patterns
        5. Price sensitivity for book purchases
        6. Reading platform and service usage

        Provide insights about their reading personality based on email evidence.
        """
```

## Auto-Discovery

The system automatically discovers and registers your analyzer. No manual registration needed!

When the system starts, it will:
1. Import your analyzer class
2. Create an instance with the LLM analysis engine
3. Register it with the recommendation engine
4. Make it available for consumer profile analysis

## Testing Your Analyzer

Test your new analyzer with existing email data:

```python
# Test with the consumer intelligence system
python -m src.email_parser.main consumer-intelligence --profile-id test --max-emails 50
```

The system will automatically include your new category in the analysis.

## Best Practices

1. **Specific Keywords**: Use specific, relevant keywords to avoid false positives
2. **Balanced Filtering**: Not too broad (noise) or too narrow (miss relevant emails)
3. **Clear Prompts**: Write clear, focused LLM prompts for consistent results
4. **Confidence Scoring**: Use appropriate confidence levels in patterns and insights
5. **Error Handling**: Handle edge cases gracefully (empty data, parsing errors)
6. **Documentation**: Document any special behavior or requirements

## Need Help?

- Look at existing analyzers for examples and patterns
- The `BaseCategoryAnalyzer` provides default implementations for common operations
- The framework handles email filtering, LLM interaction, and data persistence automatically