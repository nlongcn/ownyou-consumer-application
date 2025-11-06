"""
LLM Analysis Engine

Reusable patterns for LLM-based analysis extracted from marketing_analyzer.py
to reduce redundancy and provide consistent analysis capabilities.
"""

import json
import re
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict
from datetime import datetime
import pandas as pd
import logging

from ..llm_clients.base import BaseLLMClient
from ..models.consumer_profile import RecommendationCategoryType


@dataclass
class AnalysisRequest:
    """Standardized request for LLM analysis."""
    system_prompt: str
    user_prompt: str
    data_payload: Dict[str, Any]
    response_format: str = "json"  # json, text
    max_tokens: Optional[int] = None
    temperature: float = 0.1


@dataclass
class AnalysisResult:
    """Standardized result from LLM analysis."""
    success: bool
    data: Dict[str, Any]
    raw_response: str
    confidence: float
    analysis_type: str
    timestamp: datetime
    error_message: Optional[str] = None


class LLMAnalysisEngine:
    """
    Reusable engine for LLM-based analysis operations.

    Extracted common patterns from marketing_analyzer.py to provide:
    - Consistent JSON parsing
    - Standardized prompt construction
    - Error handling and fallbacks
    - Confidence estimation
    - Result validation
    """

    def __init__(self, llm_client: BaseLLMClient, logger: Optional[logging.Logger] = None):
        """Initialize with LLM client and optional logger."""
        self.llm_client = llm_client
        self.logger = logger or logging.getLogger(__name__)
        self.model_name = getattr(llm_client, 'default_model', None)

    def analyze(self, request: AnalysisRequest) -> AnalysisResult:
        """
        Execute standardized LLM analysis with error handling.

        Args:
            request: AnalysisRequest with prompts and data

        Returns:
            AnalysisResult with parsed response and metadata
        """
        try:
            # Create LLM request using the standalone function
            from ..llm_clients.base import create_simple_request
            llm_request = create_simple_request(
                system_prompt=request.system_prompt,
                user_message=request.user_prompt,
                model=self.model_name
            )

            # Execute analysis
            response = self.llm_client.generate(llm_request)

            # Parse response based on format
            if request.response_format == "json":
                parsed_data = self._parse_json_response(response.content)
                confidence = self._estimate_confidence(parsed_data, request.data_payload)
            else:
                parsed_data = {"response": response.content}
                confidence = 0.7  # Default for text responses

            return AnalysisResult(
                success=True,
                data=parsed_data,
                raw_response=response.content,
                confidence=confidence,
                analysis_type=request.data_payload.get("analysis_type", "unknown"),
                timestamp=datetime.utcnow()
            )

        except Exception as e:
            self.logger.error(f"LLM analysis failed: {e}")
            return AnalysisResult(
                success=False,
                data={},
                raw_response="",
                confidence=0.0,
                analysis_type=request.data_payload.get("analysis_type", "unknown"),
                timestamp=datetime.utcnow(),
                error_message=str(e)
            )

    def batch_analyze(self, requests: List[AnalysisRequest]) -> List[AnalysisResult]:
        """Execute multiple analysis requests."""
        results = []
        for request in requests:
            result = self.analyze(request)
            results.append(result)
        return results

    def analyze_email_patterns(self, df: pd.DataFrame, analysis_type: str,
                             sample_size: int = 100, seed: int = 42) -> AnalysisResult:
        """
        Standardized email pattern analysis.

        Args:
            df: DataFrame with email data
            analysis_type: Type of analysis to perform
            sample_size: Maximum emails to analyze
            seed: Random seed for reproducible sampling
        """
        if df.empty:
            return AnalysisResult(
                success=False,
                data={},
                raw_response="",
                confidence=0.0,
                analysis_type=analysis_type,
                timestamp=datetime.utcnow(),
                error_message="Empty dataset"
            )

        # Sample emails for analysis
        sample_df = self._sample_emails(df, sample_size, seed)
        email_data = self._prepare_email_data(sample_df)

        # Create analysis request
        system_prompt = self._get_system_prompt(analysis_type)
        user_prompt = self._get_user_prompt(analysis_type, email_data)

        request = AnalysisRequest(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            data_payload={
                "analysis_type": analysis_type,
                "email_count": len(sample_df),
                "total_emails": len(df)
            }
        )

        return self.analyze(request)

    def analyze_category_insights(self, df: pd.DataFrame,
                                category: RecommendationCategoryType) -> AnalysisResult:
        """Analyze insights for specific recommendation category."""
        category_prompts = {
            RecommendationCategoryType.SHOPPING: self._get_shopping_analysis_prompts(),
            RecommendationCategoryType.TRAVEL: self._get_travel_analysis_prompts(),
            RecommendationCategoryType.ENTERTAINMENT: self._get_entertainment_analysis_prompts(),
            RecommendationCategoryType.HEALTH: self._get_health_analysis_prompts(),
            RecommendationCategoryType.RESTAURANTS: self._get_restaurant_analysis_prompts(),
            RecommendationCategoryType.RECIPES: self._get_recipe_analysis_prompts()
        }

        prompts = category_prompts.get(category)
        if not prompts:
            return AnalysisResult(
                success=False,
                data={},
                raw_response="",
                confidence=0.0,
                analysis_type=f"category_{category.value}",
                timestamp=datetime.utcnow(),
                error_message=f"No prompts defined for category: {category.value}"
            )

        # Prepare email data
        sample_df = self._sample_emails(df, 50, 42)
        email_data = self._prepare_email_data(sample_df)

        request = AnalysisRequest(
            system_prompt=prompts["system"],
            user_prompt=prompts["user"].format(emails=json.dumps(email_data, indent=2)),
            data_payload={
                "analysis_type": f"category_{category.value}",
                "category": category.value,
                "email_count": len(sample_df)
            }
        )

        return self.analyze(request)

    def _sample_emails(self, df: pd.DataFrame, sample_size: int, seed: int) -> pd.DataFrame:
        """Sample emails with consistent methodology."""
        if len(df) <= sample_size:
            return df
        return df.sample(n=sample_size, random_state=seed)

    def _prepare_email_data(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Convert DataFrame to standardized email data format."""
        email_data = []
        for _, email in df.iterrows():
            # Use Products column if Key_Topics is not available (fallback compatibility)
            key_topics = email.get('Key_Topics', '') or email.get('Products', '')

            email_data.append({
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'category': email.get('Category', ''),
                'key_topics': key_topics,
                'sentiment': email.get('Sentiment', ''),
                'date': email.get('Date', ''),
                'products': email.get('Products', '')  # Include Products as separate field too
            })
        return email_data

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """Enhanced JSON parsing with error handling (extracted from marketing_analyzer)."""
        if not content or not content.strip():
            self.logger.error("Empty response content")
            return {}

        content = content.strip()

        # Remove code block markers and common prefixes
        content = re.sub(r'```json\s*', '', content, flags=re.IGNORECASE)
        content = re.sub(r'```\s*', '', content)
        content = re.sub(r'^Here is the.*?:\s*', '', content, flags=re.IGNORECASE)
        content = re.sub(r'^The response is:\s*', '', content, flags=re.IGNORECASE)

        # Find JSON boundaries more carefully
        json_patterns = [
            r'\{.*\}',  # Find any complete JSON object
            r'\[.*\]'   # Or JSON array
        ]

        for pattern in json_patterns:
            matches = re.findall(pattern, content, re.DOTALL)
            for match in matches:
                try:
                    parsed = json.loads(match)
                    return parsed
                except json.JSONDecodeError:
                    continue

        try:
            # Find complete JSON object with proper brace matching
            start_idx = content.find('{')
            if start_idx >= 0:
                brace_count = 0
                end_idx = -1
                in_string = False
                escape_next = False

                for i, char in enumerate(content[start_idx:], start_idx):
                    if escape_next:
                        escape_next = False
                        continue

                    if char == '\\':
                        escape_next = True
                        continue

                    if char == '"' and not escape_next:
                        in_string = not in_string
                        continue

                    if not in_string:
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                end_idx = i
                                break

                if end_idx > start_idx:
                    json_content = content[start_idx:end_idx+1]
                    return json.loads(json_content)

        except json.JSONDecodeError as e:
            self.logger.error(f"JSON parsing failed: {e}")

        # Final fallback - return empty dict
        self.logger.warning("Could not parse JSON response, returning empty dict")
        return {}

    def _estimate_confidence(self, parsed_data: Dict[str, Any],
                           context: Dict[str, Any]) -> float:
        """Estimate confidence based on response completeness and context."""
        if not parsed_data:
            return 0.0

        confidence_factors = []

        # Factor 1: Response completeness
        expected_keys = ["insights", "patterns", "recommendations", "analysis"]
        present_keys = sum(1 for key in expected_keys if key in parsed_data)
        if expected_keys:
            completeness = present_keys / len(expected_keys)
            confidence_factors.append(completeness)

        # Factor 2: Data volume
        email_count = context.get("email_count", 0)
        if email_count > 100:
            volume_factor = 0.9
        elif email_count > 50:
            volume_factor = 0.7
        elif email_count > 20:
            volume_factor = 0.5
        else:
            volume_factor = 0.3
        confidence_factors.append(volume_factor)

        # Factor 3: Response detail
        response_length = len(str(parsed_data))
        if response_length > 1000:
            detail_factor = 0.8
        elif response_length > 500:
            detail_factor = 0.6
        else:
            detail_factor = 0.4
        confidence_factors.append(detail_factor)

        return sum(confidence_factors) / len(confidence_factors) if confidence_factors else 0.5

    def _get_system_prompt(self, analysis_type: str) -> str:
        """Get system prompt for analysis type."""
        base_prompt = """You are a behavioral pattern analyst specializing in communication data analysis.

ANALYSIS OBJECTIVES:
- Identify meaningful behavioral patterns from email communications
- Distinguish between genuine engagement and passive marketing exposure
- Analyze communication habits, preferences, and interests
- Detect lifestyle indicators from communication patterns
- Provide evidence-based insights with confidence scores

RESPONSE FORMAT:
Always return a valid JSON object with your analysis."""

        specific_prompts = {
            "behavioral_patterns": base_prompt + """

PATTERN TYPES TO IDENTIFY:
- Communication behavior (frequency, timing, response patterns)
- Interest engagement (genuine interest vs passive exposure)
- Service relationships (active subscriptions, regular communication)
- Shopping/research behavior (consideration phases, comparison patterns)
- Professional/personal communication patterns""",

            "purchase_behavior": base_prompt + """

PURCHASE ANALYSIS FOCUS:
- Transaction patterns and frequency
- Brand preferences and loyalty
- Price sensitivity indicators
- Purchase timing and seasonality
- Research and comparison behavior""",

            "interest_clustering": base_prompt + """

INTEREST ANALYSIS FOCUS:
- Genuine personal interests vs marketing exposure
- Hobby and leisure activity patterns
- Learning and development interests
- Social and community engagement
- Content consumption preferences"""
        }

        return specific_prompts.get(analysis_type, base_prompt)

    def _get_user_prompt(self, analysis_type: str, email_data: List[Dict[str, Any]]) -> str:
        """Get user prompt for analysis type."""
        base_prompt = f"""Analyze these {len(email_data)} email communications and return insights as a JSON object.

EMAIL COMMUNICATIONS:
{json.dumps(email_data, indent=2)}"""

        specific_prompts = {
            "behavioral_patterns": base_prompt + """

Return JSON object:
{
  "behavioral_patterns": [
    {
      "pattern_type": "category of pattern",
      "description": "specific pattern observed",
      "frequency": "approximate frequency",
      "confidence": "confidence score 0.0-1.0",
      "evidence": ["supporting evidence"]
    }
  ]
}""",

            "purchase_behavior": base_prompt + """

Return JSON object:
{
  "purchase_patterns": [
    {
      "pattern_type": "purchase behavior category",
      "description": "purchase pattern description",
      "indicators": ["evidence of purchase behavior"],
      "confidence": "confidence score 0.0-1.0"
    }
  ],
  "brand_engagement": {
    "preferred_brands": ["brand names"],
    "engagement_level": "high/medium/low"
  }
}""",

            "interest_clustering": base_prompt + """

Return JSON object:
{
  "interest_clusters": [
    {
      "interest_area": "area of interest",
      "engagement_level": "high/medium/low",
      "evidence": ["supporting communications"],
      "confidence": "confidence score 0.0-1.0"
    }
  ],
  "content_preferences": ["preferred content types"]
}"""
        }

        return specific_prompts.get(analysis_type, base_prompt)

    # Category-specific prompt methods
    def _get_shopping_analysis_prompts(self) -> Dict[str, str]:
        """Shopping category analysis prompts."""
        return {
            "system": """You are a consumer shopping behavior analyst. Analyze email communications to identify shopping patterns, brand preferences, and purchase intent signals.

Focus on:
- Product category preferences
- Brand loyalty patterns
- Price sensitivity indicators
- Purchase timing patterns
- Research vs purchase behavior

Return analysis as JSON object.""",

            "user": """Analyze shopping patterns in these emails:

{emails}

Return JSON:
{{
  "shopping_insights": [
    {{
      "category": "product category",
      "preference_strength": "high/medium/low",
      "evidence": ["supporting emails"],
      "confidence": 0.0-1.0
    }}
  ],
  "brand_preferences": [
    {{
      "brand": "brand name",
      "engagement_type": "purchase/research/casual",
      "frequency": "frequency of engagement"
    }}
  ],
  "purchase_indicators": {{
    "purchase_intent": "high/medium/low",
    "price_sensitivity": "high/medium/low",
    "purchase_timing": "seasonal/impulse/planned"
  }}
}}"""
        }

    def _get_travel_analysis_prompts(self) -> Dict[str, str]:
        """Travel category analysis prompts."""
        return {
            "system": """You are a travel behavior analyst. Analyze email communications to identify travel preferences, booking patterns, and destination interests.

Focus on:
- Destination preferences (domestic/international)
- Travel style (luxury/budget/adventure)
- Booking behavior patterns
- Seasonal travel preferences
- Travel purpose (business/leisure/family)

Return analysis as JSON object.""",

            "user": """Analyze travel patterns in these emails:

{emails}

Return JSON:
{{
  "travel_insights": [
    {{
      "travel_type": "destination type or travel style",
      "preference_strength": "high/medium/low",
      "evidence": ["supporting emails"],
      "confidence": 0.0-1.0
    }}
  ],
  "destination_preferences": [
    {{
      "region": "geographic region",
      "interest_level": "high/medium/low",
      "travel_purpose": "leisure/business/family"
    }}
  ],
  "booking_patterns": {{
    "advance_planning": "early/medium/last-minute",
    "price_sensitivity": "high/medium/low",
    "preferred_platforms": ["booking platforms used"]
  }}
}}"""
        }

    def _get_entertainment_analysis_prompts(self) -> Dict[str, str]:
        """Entertainment category analysis prompts."""
        return {
            "system": """You are an entertainment preferences analyst. Analyze email communications to identify entertainment interests, event attendance patterns, and cultural engagement.

Focus on:
- Entertainment genres (film, music, theater, comedy)
- Event attendance patterns
- Cultural interests
- Social vs solo entertainment preferences
- Subscription services and content platforms

Return analysis as JSON object.""",

            "user": """Analyze entertainment patterns in these emails:

{emails}

Return JSON:
{{
  "entertainment_insights": [
    {{
      "entertainment_type": "type of entertainment",
      "engagement_level": "high/medium/low",
      "evidence": ["supporting emails"],
      "confidence": 0.0-1.0
    }}
  ],
  "event_preferences": [
    {{
      "event_type": "concerts/theater/comedy/etc",
      "attendance_frequency": "regular/occasional/rare",
      "social_preference": "social/solo/mixed"
    }}
  ],
  "content_consumption": {{
    "platforms": ["streaming/subscription services"],
    "genres": ["preferred genres"],
    "consumption_style": "binge/regular/casual"
  }}
}}"""
        }

    def _get_health_analysis_prompts(self) -> Dict[str, str]:
        """Health category analysis prompts."""
        return {
            "system": """You are a health and wellness behavior analyst. Analyze email communications to identify health interests, wellness activities, and lifestyle choices.

Focus on:
- Fitness and exercise patterns
- Nutrition and dietary interests
- Mental health and wellness activities
- Healthcare engagement
- Wellness product usage

Return analysis as JSON object.""",

            "user": """Analyze health and wellness patterns in these emails:

{emails}

Return JSON:
{{
  "health_insights": [
    {{
      "health_area": "fitness/nutrition/mental-health/etc",
      "engagement_level": "high/medium/low",
      "evidence": ["supporting emails"],
      "confidence": 0.0-1.0
    }}
  ],
  "wellness_activities": [
    {{
      "activity_type": "type of wellness activity",
      "frequency": "daily/weekly/monthly",
      "commitment_level": "high/medium/low"
    }}
  ],
  "health_priorities": {{
    "primary_focus": "main health focus area",
    "secondary_interests": ["other health interests"],
    "approach": "holistic/targeted/casual"
  }}
}}"""
        }

    def _get_restaurant_analysis_prompts(self) -> Dict[str, str]:
        """Restaurant category analysis prompts."""
        return {
            "system": """You are a dining behavior analyst. Analyze email communications to identify restaurant preferences, dining patterns, and food service usage.

Focus on:
- Cuisine preferences
- Dining occasion preferences (casual/fine dining)
- Delivery and takeout patterns
- Restaurant discovery methods
- Social dining preferences

Return analysis as JSON object.""",

            "user": """Analyze restaurant and dining patterns in these emails:

{emails}

Return JSON:
{{
  "dining_insights": [
    {{
      "dining_aspect": "cuisine/occasion/service-type",
      "preference_strength": "high/medium/low",
      "evidence": ["supporting emails"],
      "confidence": 0.0-1.0
    }}
  ],
  "cuisine_preferences": [
    {{
      "cuisine_type": "type of cuisine",
      "frequency": "regular/occasional/rare",
      "dining_context": "casual/special-occasion/work"
    }}
  ],
  "dining_behavior": {{
    "preferred_occasions": ["dining occasions"],
    "service_preferences": ["dine-in/delivery/takeout"],
    "social_preference": "social/solo/mixed",
    "discovery_methods": ["how they find restaurants"]
  }}
}}"""
        }

    def _get_recipe_analysis_prompts(self) -> Dict[str, str]:
        """Recipe category analysis prompts."""
        return {
            "system": """You are a cooking and recipe behavior analyst. Analyze email communications to identify cooking interests, recipe preferences, and culinary skill development.

Focus on:
- Cooking skill level and development
- Recipe complexity preferences
- Ingredient and dietary preferences
- Cooking frequency patterns
- Culinary learning interests

Return analysis as JSON object.""",

            "user": """Analyze cooking and recipe patterns in these emails:

{emails}

Return JSON:
{{
  "cooking_insights": [
    {{
      "cooking_aspect": "skill/complexity/cuisine/technique",
      "interest_level": "high/medium/low",
      "evidence": ["supporting emails"],
      "confidence": 0.0-1.0
    }}
  ],
  "recipe_preferences": [
    {{
      "recipe_type": "type or style of recipe",
      "complexity_preference": "simple/moderate/complex",
      "frequency": "daily/weekly/occasional"
    }}
  ],
  "culinary_profile": {{
    "skill_level": "beginner/intermediate/advanced",
    "learning_interest": "high/medium/low",
    "dietary_considerations": ["dietary preferences/restrictions"],
    "cooking_motivation": ["reasons for cooking"]
  }}
}}"""
        }