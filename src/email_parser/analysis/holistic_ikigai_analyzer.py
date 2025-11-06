#!/usr/bin/env python3
"""
Holistic Multi-Phase Ikigai Analysis Module

Implements a comprehensive 3-phase approach to ikigai analysis that leverages
large context windows to understand the complete digital communication landscape.

Phases:
1. Holistic Overview - Extract broad themes and patterns across ALL emails
2. Contextual Scoring - Score each email using holistic context
3. Synthesis & Validation - Generate final comprehensive ikigai profile
"""

import pandas as pd
import json
import numpy as np
from collections import Counter
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import logging
import re
from datetime import datetime

from ..llm_clients.base import LLMRequest, LLMMessage
# Removed complex context window logic - using simple batching instead
from .authentic_ikigai_analyzer import AuthenticIkigaiInsights


@dataclass 
class HolisticIkigaiContext:
    """Context information from holistic analysis to guide detailed scoring."""
    primary_themes: List[str]
    interest_areas: List[Dict[str, Any]]
    behavioral_patterns: Dict[str, Any]
    value_indicators: List[str]
    temporal_patterns: Dict[str, Any]
    engagement_styles: Dict[str, Any]
    commercial_insights: Dict[str, Any]  # What commercial choices reveal
    confidence_factors: List[str]


@dataclass
class EmailIkigaiScore:
    """Detailed ikigai scoring for a single email."""
    email_id: str
    subject: str
    ikigai_score: float  # 0.0 to 1.0
    relevance_category: str  # High/Medium/Low/Commercial-Personal/Pure-Commercial
    contributing_factors: List[str]
    alignment_themes: List[str]  # Which holistic themes this email aligns with
    value_expression: Optional[str]  # How this email expresses personal values
    choice_autonomy: float  # 0.0 to 1.0 - degree of personal choice involved
    meaning_indicators: List[str]
    reasoning: str


class HolisticIkigaiAnalyzer:
    """
    Multi-phase holistic ikigai analyzer that leverages full context windows
    to understand patterns across ALL communications.
    """
    
    def __init__(self, llm_client, logger: Optional[logging.Logger] = None, model_name: str = None):
        """Initialize the holistic ikigai analyzer."""
        self.llm_client = llm_client
        self.logger = logger or logging.getLogger(__name__)
        
        # Store the specific model name to use
        if model_name:
            self.model_name = model_name
        else:
            # Fallback to client default only if no model specified
            self.model_name = getattr(llm_client, 'default_model', None)
            if not self.model_name:
                raise ValueError("Model name must be specified either as parameter or in LLM client")
        
        self.logger.info(f"Initialized with model: {self.model_name}")
    
    def analyze_emails(self, processed_emails: List[Dict[str, Any]], output_prefix: str = None) -> AuthenticIkigaiInsights:
        """
        Perform comprehensive 3-phase holistic ikigai analysis.
        
        Args:
            processed_emails: List of processed email dictionaries
            output_prefix: Optional prefix for output files
            
        Returns:
            AuthenticIkigaiInsights object with comprehensive analysis
        """
        if not processed_emails:
            return self._create_empty_insights()
        
        self.logger.info(f"Starting holistic ikigai analysis on {len(processed_emails)} emails")
        
        # Simple batch size - no complex calculation needed
        batch_size = 50  # Simple fixed batch size
        
        # Phase 1: Holistic Overview Analysis
        holistic_context = self._phase_1_holistic_overview(processed_emails, batch_size)
        
        # Phase 2: Contextual Per-Email Scoring
        email_scores = self._phase_2_contextual_scoring(processed_emails, holistic_context, batch_size)
        
        # Phase 3: Synthesis and Validation
        final_insights = self._phase_3_synthesis_validation(
            processed_emails, holistic_context, email_scores
        )
        
        # Export results if output prefix provided
        if output_prefix:
            self._export_holistic_results(email_scores, final_insights, output_prefix)
        
        return final_insights
    
    def _phase_1_holistic_overview(self, emails: List[Dict[str, Any]], 
                                 batch_size: int = 50) -> HolisticIkigaiContext:
        """
        Phase 1: Extract holistic themes and patterns across ALL emails.
        Uses maximum context window to understand the complete landscape.
        """
        self.logger.info("Phase 1: Holistic Overview Analysis")
        
        # Simple batching - split emails into batches of batch_size
        batches = []
        for i in range(0, len(emails), batch_size):
            batch = emails[i:i + batch_size]
            batches.append(batch)
        
        batch_insights = []
        
        for i, batch in enumerate(batches):
            self.logger.info(f"Processing overview batch {i+1}/{len(batches)} ({len(batch)} emails)")
            
            insight = self._analyze_batch_holistically(batch, i+1, len(batches))
            if insight:
                batch_insights.append(insight)
        
        # Synthesize insights across all batches
        return self._synthesize_holistic_insights(batch_insights, len(emails))
    
    def _analyze_batch_holistically(self, batch: List[Dict[str, Any]], 
                                  batch_num: int, total_batches: int) -> Optional[Dict[str, Any]]:
        """Analyze a batch of emails to extract holistic patterns."""
        
        system_prompt = """You are an expert in holistic digital behavior analysis and ikigai assessment.

Your task is to analyze this batch of emails to identify overarching themes, interests, and behavioral patterns that reveal what gives this person's life meaning and value.

CRITICAL PRINCIPLES:
- Analyze ALL email types (commercial, personal, newsletters, etc.) 
- Look for CHOICES and PATTERNS, not just content
- Commercial emails reveal interests, values, and lifestyle choices
- Consistency over time indicates authentic interests
- Active engagement vs passive receipt matters
- Find meaning across the complete digital landscape

LOOK FOR:
1. Interest Areas: What topics/domains appear consistently?
2. Value Expression: What do their choices reveal about their values?
3. Behavioral Patterns: How do they engage with different content?
4. Temporal Trends: How have interests evolved over time?
5. Choice Autonomy: What feels chosen vs imposed?
6. Meaning Indicators: What brings them joy or fulfillment?

Return comprehensive analysis in JSON format focusing on PATTERNS not individual emails."""
        
        # Prepare batch content for analysis
        batch_content = self._format_batch_for_analysis(batch)
        
        user_prompt = f"""Analyze this batch ({batch_num} of {total_batches}) containing {len(batch)} emails for holistic ikigai patterns.

EMAIL DATA:
{batch_content}

Provide holistic analysis in this JSON format:
{{
  "primary_themes": ["Theme 1", "Theme 2", "Theme 3"],
  "interest_areas": [
    {{
      "area": "Interest Area Name",
      "strength": "high/medium/low",
      "indicators": ["Evidence 1", "Evidence 2"],
      "frequency": number_of_related_emails,
      "consistency": "consistent/emerging/declining"
    }}
  ],
  "behavioral_patterns": {{
    "engagement_style": "active/passive/mixed",
    "information_preferences": "educational/entertainment/practical/mixed", 
    "decision_making": "research-driven/impulse/habitual",
    "temporal_consistency": "highly_consistent/moderately_consistent/varied"
  }},
  "value_indicators": ["Value 1", "Value 2", "Value 3"],
  "temporal_patterns": {{
    "evolution_trend": "growing_interests/stable_interests/shifting_interests",
    "seasonal_patterns": "detected/not_detected",
    "engagement_frequency": "high/medium/low"
  }},
  "commercial_insights": {{
    "purchase_alignment": "aligned_with_interests/mixed/unclear",
    "subscription_choices": "intentional/passive/unclear",
    "brand_preferences": "consistent/varied/unclear"
  }},
  "confidence_factors": ["Factor 1", "Factor 2"]
}}

Focus on PATTERNS and CONSISTENCY across emails, not individual messages."""
        
        try:
            # Use model-appropriate max_tokens for holistic overview
            model_name = str(getattr(self.llm_client, 'default_model', '')).lower()
            max_tokens = 3000 if 'haiku' in model_name else 4000
            
            request = LLMRequest(
                messages=[
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt)
                ],
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.1,
                max_tokens=max_tokens
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                # Parse JSON response
                content = response.content.strip()
                content = re.sub(r'```json\s*', '', content)
                content = re.sub(r'```\s*$', '', content)
                
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # Try to extract JSON from response
                    json_start = content.find('{')
                    json_end = content.rfind('}') + 1
                    if json_start >= 0 and json_end > json_start:
                        json_content = content[json_start:json_end]
                        return json.loads(json_content)
                    else:
                        self.logger.warning(f"Could not parse holistic analysis JSON for batch {batch_num}")
                        return None
            else:
                self.logger.warning(f"Holistic analysis request failed for batch {batch_num}")
                return None
                
        except Exception as e:
            self.logger.error(f"Holistic analysis error for batch {batch_num}: {e}")
            return None
    
    def _format_batch_for_analysis(self, batch: List[Dict[str, Any]]) -> str:
        """Format email batch for holistic analysis."""
        formatted_emails = []
        
        for i, email in enumerate(batch, 1):
            email_text = f"{i}. "
            
            if 'Date' in email:
                email_text += f"Date: {email['Date']} | "
            if 'Subject' in email:
                email_text += f"Subject: {email['Subject']} | "
            if 'From' in email:
                email_text += f"From: {email['From']} | "
            if 'Category' in email:
                email_text += f"Category: {email['Category']} | "
            if 'Key_Topics' in email:
                email_text += f"Topics: {email['Key_Topics']} | "
            if 'Products' in email:
                products = email['Products']
                if products:
                    email_text += f"Products: {products} | "
            if 'Sentiment' in email:
                email_text += f"Sentiment: {email['Sentiment']} | "
            if 'Summary' in email:
                summary = str(email['Summary'])[:200] + "..." if len(str(email['Summary'])) > 200 else str(email['Summary'])
                email_text += f"Summary: {summary}"
            
            formatted_emails.append(email_text)
        
        return "\n\n".join(formatted_emails)
    
    def _synthesize_holistic_insights(self, batch_insights: List[Dict[str, Any]], 
                                    total_emails: int) -> HolisticIkigaiContext:
        """Synthesize insights from multiple batches into unified context."""
        
        if not batch_insights:
            return self._create_empty_holistic_context()
        
        # Aggregate themes across batches
        all_themes = []
        all_interest_areas = []
        all_value_indicators = []
        all_confidence_factors = []
        
        # Behavioral and temporal patterns from latest batch (most comprehensive)
        latest_behavioral = batch_insights[-1].get('behavioral_patterns', {})
        latest_temporal = batch_insights[-1].get('temporal_patterns', {})
        latest_commercial = batch_insights[-1].get('commercial_insights', {})
        
        for insight in batch_insights:
            all_themes.extend(insight.get('primary_themes', []))
            all_interest_areas.extend(insight.get('interest_areas', []))
            all_value_indicators.extend(insight.get('value_indicators', []))
            all_confidence_factors.extend(insight.get('confidence_factors', []))
        
        # Consolidate themes by frequency
        theme_counts = Counter(all_themes)
        primary_themes = [theme for theme, count in theme_counts.most_common(10)]
        
        # Consolidate interest areas
        consolidated_interests = self._consolidate_interest_areas(all_interest_areas)
        
        # Remove duplicates from value indicators
        unique_values = list(set(all_value_indicators))[:10]
        
        return HolisticIkigaiContext(
            primary_themes=primary_themes,
            interest_areas=consolidated_interests,
            behavioral_patterns=latest_behavioral,
            value_indicators=unique_values,
            temporal_patterns=latest_temporal,
            engagement_styles=latest_behavioral,
            commercial_insights=latest_commercial,
            confidence_factors=list(set(all_confidence_factors))
        )
    
    def _consolidate_interest_areas(self, interest_areas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Consolidate interest areas from multiple batches."""
        area_map = {}
        
        for area in interest_areas:
            area_name = area.get('area', '')
            if area_name in area_map:
                # Merge with existing
                existing = area_map[area_name]
                existing['frequency'] = existing.get('frequency', 0) + area.get('frequency', 0)
                existing['indicators'].extend(area.get('indicators', []))
                # Keep highest strength
                if area.get('strength') == 'high':
                    existing['strength'] = 'high'
                elif area.get('strength') == 'medium' and existing.get('strength') != 'high':
                    existing['strength'] = 'medium'
            else:
                area_map[area_name] = area.copy()
                area_map[area_name]['indicators'] = area.get('indicators', []).copy()
        
        # Sort by frequency and return top 10
        consolidated = list(area_map.values())
        consolidated.sort(key=lambda x: x.get('frequency', 0), reverse=True)
        return consolidated[:10]
    
    def _phase_2_contextual_scoring(self, emails: List[Dict[str, Any]], 
                                  holistic_context: HolisticIkigaiContext,
                                  batch_size: int = 50) -> List[EmailIkigaiScore]:
        """
        Phase 2: Score each email using holistic context as guidance.
        """
        self.logger.info("Phase 2: Contextual Per-Email Scoring")
        
        # Simple batching - split emails into batches of batch_size  
        batches = []
        for i in range(0, len(emails), batch_size):
            batch = emails[i:i + batch_size]
            batches.append(batch)
        
        all_scores = []
        
        for i, batch in enumerate(batches):
            self.logger.info(f"Processing scoring batch {i+1}/{len(batches)} ({len(batch)} emails)")
            
            batch_scores = self._score_email_batch(batch, holistic_context, i+1, len(batches))
            all_scores.extend(batch_scores)
        
        return all_scores
    
    def _score_email_batch(self, batch: List[Dict[str, Any]], 
                          holistic_context: HolisticIkigaiContext,
                          batch_num: int, total_batches: int) -> List[EmailIkigaiScore]:
        """Score a batch of emails using holistic context."""
        
        system_prompt = f"""You are an expert ikigai analyst using holistic context to score individual emails.

HOLISTIC CONTEXT (discovered patterns across ALL emails):
Primary Themes: {', '.join(holistic_context.primary_themes[:5])}
Top Interest Areas: {', '.join([area['area'] for area in holistic_context.interest_areas[:3]])}
Key Values: {', '.join(holistic_context.value_indicators[:3])}
Behavioral Style: {holistic_context.behavioral_patterns.get('engagement_style', 'unknown')}

SCORING CRITERIA (0.0 to 1.0):
1.0 = Perfect alignment with core ikigai themes, strong personal meaning
0.8-0.9 = Strong alignment, clear personal value/interest
0.6-0.7 = Moderate alignment, some personal relevance
0.4-0.5 = Weak alignment, minimal personal meaning
0.2-0.3 = Very weak alignment, mostly imposed/commercial
0.0-0.1 = No alignment, pure marketing/spam

REMEMBER: Commercial emails can score highly if they align with authentic interests!
A fitness product purchase by someone interested in health = high score
A random promotional email = low score"""

        # Prepare detailed batch content
        batch_content = self._format_batch_for_scoring(batch)
        
        user_prompt = f"""Score each email (batch {batch_num} of {total_batches}) for ikigai relevance using the holistic context.

{batch_content}

Return JSON array with this format for each email:
{{
  "email_id": "ID_from_email",
  "subject": "Email subject",
  "ikigai_score": 0.75,
  "relevance_category": "High|Medium|Low|Commercial-Personal|Pure-Commercial",
  "contributing_factors": ["Factor 1", "Factor 2"],
  "alignment_themes": ["Theme from holistic context"],
  "value_expression": "How this expresses personal values or null",
  "choice_autonomy": 0.8,
  "meaning_indicators": ["Indicator 1", "Indicator 2"],
  "reasoning": "Brief explanation of score"
}}

Use holistic context to identify authentic personal interests even in commercial emails."""
        
        try:
            # Use model-appropriate max_tokens for email scoring (needs more detail)
            model_name = str(getattr(self.llm_client, 'default_model', '')).lower()
            max_tokens = 3500 if 'haiku' in model_name else 6000
            
            request = LLMRequest(
                messages=[
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt)
                ],
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.1,
                max_tokens=max_tokens
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                return self._parse_email_scores(response.content, batch)
            else:
                self.logger.warning(f"Email scoring request failed for batch {batch_num}")
                return self._create_fallback_scores(batch)
                
        except Exception as e:
            self.logger.error(f"Email scoring error for batch {batch_num}: {e}")
            return self._create_fallback_scores(batch)
    
    def _format_batch_for_scoring(self, batch: List[Dict[str, Any]]) -> str:
        """Format email batch for detailed scoring."""
        formatted_emails = []
        
        for i, email in enumerate(batch, 1):
            email_text = f"{i}. ID: {email.get('ID', 'unknown')}\n"
            email_text += f"   Subject: {email.get('Subject', 'No subject')}\n"
            email_text += f"   From: {email.get('From', 'Unknown')}\n"
            email_text += f"   Date: {email.get('Date', 'Unknown')}\n"
            email_text += f"   Category: {email.get('Category', 'Unknown')}\n"
            email_text += f"   Topics: {email.get('Key_Topics', 'None')}\n"
            
            if email.get('Products'):
                email_text += f"   Products: {email['Products']}\n"
            if email.get('Summary'):
                summary = str(email['Summary'])[:300] + "..." if len(str(email['Summary'])) > 300 else str(email['Summary'])
                email_text += f"   Summary: {summary}\n"
            
            formatted_emails.append(email_text)
        
        return "\n".join(formatted_emails)
    
    def _parse_email_scores(self, response_content: str, batch: List[Dict[str, Any]]) -> List[EmailIkigaiScore]:
        """Parse email scores from LLM response."""
        try:
            content = response_content.strip()
            content = re.sub(r'```json\s*', '', content)
            content = re.sub(r'```\s*$', '', content)
            
            # Try to parse as JSON array
            try:
                scores_data = json.loads(content)
            except json.JSONDecodeError:
                # Try to extract JSON array from response
                array_start = content.find('[')
                array_end = content.rfind(']') + 1
                if array_start >= 0 and array_end > array_start:
                    json_content = content[array_start:array_end]
                    scores_data = json.loads(json_content)
                else:
                    self.logger.warning("Could not parse email scores JSON")
                    return self._create_fallback_scores(batch)
            
            # Convert to EmailIkigaiScore objects
            email_scores = []
            for i, score_data in enumerate(scores_data):
                try:
                    email_scores.append(EmailIkigaiScore(
                        email_id=score_data.get('email_id', batch[i].get('ID', f'unknown_{i}')),
                        subject=score_data.get('subject', batch[i].get('Subject', 'No subject')),
                        ikigai_score=float(score_data.get('ikigai_score', 0.3)),
                        relevance_category=score_data.get('relevance_category', 'Low'),
                        contributing_factors=score_data.get('contributing_factors', []),
                        alignment_themes=score_data.get('alignment_themes', []),
                        value_expression=score_data.get('value_expression'),
                        choice_autonomy=float(score_data.get('choice_autonomy', 0.3)),
                        meaning_indicators=score_data.get('meaning_indicators', []),
                        reasoning=score_data.get('reasoning', 'No reasoning provided')
                    ))
                except (ValueError, KeyError, IndexError) as e:
                    self.logger.warning(f"Error parsing score {i}: {e}")
                    # Create fallback score for this email
                    email_scores.append(self._create_fallback_score(batch[i] if i < len(batch) else {}))
            
            return email_scores
            
        except Exception as e:
            self.logger.error(f"Error parsing email scores: {e}")
            return self._create_fallback_scores(batch)
    
    def _create_fallback_scores(self, batch: List[Dict[str, Any]]) -> List[EmailIkigaiScore]:
        """Create fallback scores when LLM analysis fails."""
        return [self._create_fallback_score(email) for email in batch]
    
    def _create_fallback_score(self, email: Dict[str, Any]) -> EmailIkigaiScore:
        """Create a fallback score for a single email."""
        # Basic scoring based on category
        category = email.get('Category', 'Other')
        
        if category in ['Personal Communication', 'Educational']:
            score = 0.7
            relevance = 'Medium'
        elif category in ['News/Blog/Spam', 'Purchase']:
            score = 0.4
            relevance = 'Low'
        else:
            score = 0.3
            relevance = 'Low'
        
        return EmailIkigaiScore(
            email_id=email.get('ID', 'unknown'),
            subject=email.get('Subject', 'No subject'),
            ikigai_score=score,
            relevance_category=relevance,
            contributing_factors=['Fallback analysis'],
            alignment_themes=[],
            value_expression=None,
            choice_autonomy=0.3,
            meaning_indicators=[],
            reasoning='Fallback scoring due to analysis failure'
        )
    
    def _phase_3_synthesis_validation(self, emails: List[Dict[str, Any]], 
                                    holistic_context: HolisticIkigaiContext,
                                    email_scores: List[EmailIkigaiScore]) -> AuthenticIkigaiInsights:
        """
        Phase 3: Synthesize all analysis into comprehensive ikigai insights.
        """
        self.logger.info("Phase 3: Synthesis and Validation")
        
        # Calculate aggregate statistics
        score_stats = self._calculate_score_statistics(email_scores)
        
        # Generate final ikigai assessment using all context
        final_analysis = self._generate_final_assessment(
            holistic_context, email_scores, score_stats, len(emails)
        )
        
        # Create comprehensive insights object
        return self._create_comprehensive_insights(final_analysis, holistic_context, score_stats)
    
    def _calculate_score_statistics(self, email_scores: List[EmailIkigaiScore]) -> Dict[str, Any]:
        """Calculate statistics from email scores."""
        if not email_scores:
            return {}
        
        scores = [score.ikigai_score for score in email_scores]
        autonomy_scores = [score.choice_autonomy for score in email_scores]
        
        # Category distribution
        category_counts = Counter([score.relevance_category for score in email_scores])
        
        # Theme alignment analysis
        all_themes = []
        for score in email_scores:
            all_themes.extend(score.alignment_themes)
        theme_counts = Counter(all_themes)
        
        return {
            'average_ikigai_score': np.mean(scores),
            'median_ikigai_score': np.median(scores),
            'score_std': np.std(scores),
            'high_score_count': len([s for s in scores if s >= 0.7]),
            'medium_score_count': len([s for s in scores if 0.4 <= s < 0.7]),
            'low_score_count': len([s for s in scores if s < 0.4]),
            'average_autonomy': np.mean(autonomy_scores),
            'category_distribution': dict(category_counts),
            'top_themes': theme_counts.most_common(10),
            'total_emails': len(email_scores)
        }
    
    def _generate_final_assessment(self, holistic_context: HolisticIkigaiContext,
                                 email_scores: List[EmailIkigaiScore],
                                 score_stats: Dict[str, Any],
                                 total_emails: int) -> Dict[str, Any]:
        """Generate final ikigai assessment using LLM synthesis."""
        
        system_prompt = """You are an expert ikigai analyst providing final comprehensive assessment.

Based on the complete holistic analysis and individual email scoring, provide a definitive ikigai profile that captures what gives this person's life meaning and value.

AUTHENTIC IKIGAI PRINCIPLES:
- Ikigai = what gets you up in the morning, small daily joys
- Look for consistent choices and patterns over time
- Commercial decisions can express authentic values
- Active engagement indicates genuine interest
- Voluntary pursuits vs imposed communications
- Evolution and growth over time"""
        
        # Prepare comprehensive summary
        top_scoring_emails = sorted(email_scores, key=lambda x: x.ikigai_score, reverse=True)[:10]
        
        user_prompt = f"""Provide final ikigai assessment based on comprehensive analysis:

HOLISTIC CONTEXT:
- Primary Themes: {holistic_context.primary_themes[:5]}
- Interest Areas: {[area['area'] for area in holistic_context.interest_areas[:5]]}
- Values: {holistic_context.value_indicators[:5]}
- Behavioral Style: {holistic_context.behavioral_patterns}
- Commercial Insights: {holistic_context.commercial_insights}

SCORING STATISTICS:
- Total Emails: {score_stats['total_emails']}
- Average Ikigai Score: {score_stats['average_ikigai_score']:.2f}
- High Relevance: {score_stats['high_score_count']} emails
- Medium Relevance: {score_stats['medium_score_count']} emails
- Low Relevance: {score_stats['low_score_count']} emails
- Average Choice Autonomy: {score_stats['average_autonomy']:.2f}

TOP IKIGAI-ALIGNED EMAILS:"""
        
        for i, email in enumerate(top_scoring_emails[:5], 1):
            user_prompt += f"""
{i}. Score: {email.ikigai_score:.2f} | {email.subject} | Themes: {email.alignment_themes}"""
        
        user_prompt += """

Provide comprehensive ikigai assessment in JSON format:
{
  "primary_ikigai": "Main ikigai area based on strongest patterns",
  "secondary_areas": ["Area 2", "Area 3"],
  "confidence_score": 0.85,
  "supporting_evidence": [
    {
      "pattern": "Description of consistent pattern",
      "strength": "high/medium/low", 
      "examples": ["Example 1", "Example 2"],
      "email_count": number_of_supporting_emails
    }
  ],
  "framework_dimensions": {
    "external_connection": "How person connects to external world",
    "active_engagement": "Evidence of active vs passive engagement",
    "emotional_meaning": "Signs of personal meaning and joy",
    "voluntary_pursuit": "Evidence of chosen vs imposed interests", 
    "everyday_joy": "Small daily activities that bring meaning",
    "growth_orientation": "Evidence of learning and development"
  },
  "recommendations": [
    "Specific ways to nurture identified ikigai areas",
    "Suggestions for deeper engagement"
  ]
}"""
        
        try:
            # Use model-appropriate max_tokens for final synthesis
            model_name = str(getattr(self.llm_client, 'default_model', '')).lower()
            max_tokens = 3000 if 'haiku' in model_name else 4000
            
            request = LLMRequest(
                messages=[
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt)
                ],
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.1,
                max_tokens=max_tokens
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                content = response.content.strip()
                content = re.sub(r'```json\s*', '', content)
                content = re.sub(r'```\s*$', '', content)
                
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    json_start = content.find('{')
                    json_end = content.rfind('}') + 1
                    if json_start >= 0 and json_end > json_start:
                        json_content = content[json_start:json_end]
                        return json.loads(json_content)
                    else:
                        return self._create_fallback_final_analysis(holistic_context, score_stats)
            else:
                return self._create_fallback_final_analysis(holistic_context, score_stats)
                
        except Exception as e:
            self.logger.error(f"Final assessment generation failed: {e}")
            return self._create_fallback_final_analysis(holistic_context, score_stats)
    
    def _create_fallback_final_analysis(self, holistic_context: HolisticIkigaiContext,
                                      score_stats: Dict[str, Any]) -> Dict[str, Any]:
        """Create fallback final analysis."""
        
        primary_ikigai = "Personal Growth & Learning"
        if holistic_context.primary_themes:
            top_theme = holistic_context.primary_themes[0]
            if any(word in top_theme.lower() for word in ['health', 'fitness', 'wellness']):
                primary_ikigai = "Health & Personal Wellness"
            elif any(word in top_theme.lower() for word in ['tech', 'technology', 'software']):
                primary_ikigai = "Technology & Innovation"
            elif any(word in top_theme.lower() for word in ['creative', 'art', 'design']):
                primary_ikigai = "Creative Expression"
        
        confidence = min(0.8, score_stats.get('average_ikigai_score', 0.3) + 0.2)
        
        return {
            "primary_ikigai": primary_ikigai,
            "secondary_areas": holistic_context.primary_themes[1:3] if len(holistic_context.primary_themes) > 1 else [],
            "confidence_score": confidence,
            "supporting_evidence": [
                {
                    "pattern": f"Analyzed {score_stats.get('total_emails', 0)} communications with holistic approach",
                    "strength": "medium",
                    "examples": holistic_context.primary_themes[:3],
                    "email_count": score_stats.get('high_score_count', 0) + score_stats.get('medium_score_count', 0)
                }
            ],
            "framework_dimensions": {
                "external_connection": f"Active engagement across {len(holistic_context.interest_areas)} interest areas",
                "active_engagement": holistic_context.behavioral_patterns.get('engagement_style', 'mixed'),
                "emotional_meaning": f"Average ikigai score: {score_stats.get('average_ikigai_score', 0.3):.2f}",
                "voluntary_pursuit": f"Choice autonomy average: {score_stats.get('average_autonomy', 0.3):.2f}",
                "everyday_joy": "Patterns identified in daily communication choices",
                "growth_orientation": holistic_context.temporal_patterns.get('evolution_trend', 'stable_interests')
            },
            "recommendations": [
                "Continue nurturing identified interest areas with deeper engagement",
                "Explore connections between different interests for synergistic growth"
            ]
        }
    
    def _create_comprehensive_insights(self, final_analysis: Dict[str, Any],
                                     holistic_context: HolisticIkigaiContext,
                                     score_stats: Dict[str, Any]) -> AuthenticIkigaiInsights:
        """Create comprehensive insights object."""
        
        return AuthenticIkigaiInsights(
            primary_ikigai=final_analysis.get('primary_ikigai', 'Unknown'),
            secondary_areas=final_analysis.get('secondary_areas', []),
            confidence_score=final_analysis.get('confidence_score', 0.5),
            supporting_evidence=final_analysis.get('supporting_evidence', []),
            framework_dimensions=final_analysis.get('framework_dimensions', {}),
            personal_patterns={
                'holistic_context': asdict(holistic_context),
                'score_statistics': score_stats,
                'analysis_type': 'Comprehensive Multi-Phase Holistic Analysis'
            },
            recommendations=final_analysis.get('recommendations', []),
            analysis_timestamp=datetime.utcnow().isoformat()
        )
    
    def _export_holistic_results(self, email_scores: List[EmailIkigaiScore],
                               final_insights: AuthenticIkigaiInsights,
                               output_prefix: str):
        """Export comprehensive results to files."""
        
        # Ensure ikigai_insights directory exists
        import os
        os.makedirs("ikigai_insights", exist_ok=True)
        
        # Generate timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export per-email scores to CSV
        email_scores_data = []
        for score in email_scores:
            email_scores_data.append({
                'Email_ID': score.email_id,
                'Subject': score.subject,
                'Ikigai_Score': score.ikigai_score,
                'Relevance_Category': score.relevance_category,
                'Contributing_Factors': '; '.join(score.contributing_factors),
                'Alignment_Themes': '; '.join(score.alignment_themes),
                'Value_Expression': score.value_expression or '',
                'Choice_Autonomy': score.choice_autonomy,
                'Meaning_Indicators': '; '.join(score.meaning_indicators),
                'Reasoning': score.reasoning
            })
        
        df = pd.DataFrame(email_scores_data)
        csv_filename = f"ikigai_insights/{output_prefix}_holistic_ikigai_scores_{timestamp}.csv"
        df.to_csv(csv_filename, index=False)
        
        # Export final comprehensive report to JSON
        # Build minimal data coverage
        coverage = {
            "total_emails": len(email_scores),
        }

        # Generator metadata
        model_name = getattr(self.llm_client, 'default_model', 'unknown')
        generator = {"name": "HolisticIkigaiAnalyzer", "version": "v1", "model": model_name}

        report = {
            "holistic_ikigai_analysis": {
                "schema_version": "1.0",
                "analysis_type": "Multi-Phase Holistic Ikigai Analysis",
                "methodology": "3-phase comprehensive analysis using full context windows",
                "analysis_timestamp": final_insights.analysis_timestamp,
                "primary_ikigai": final_insights.primary_ikigai,
                "secondary_areas": final_insights.secondary_areas,
                "confidence_score": final_insights.confidence_score,
                "supporting_evidence": final_insights.supporting_evidence,
                "framework_dimensions": final_insights.framework_dimensions,
                "comprehensive_patterns": final_insights.personal_patterns,
                "recommendations": final_insights.recommendations,
                "data_coverage": coverage,
                "generator": generator
            },
            "methodology_details": {
                "phase_1": "Holistic overview analysis across all emails to extract themes and patterns",
                "phase_2": "Contextual per-email scoring using holistic insights",
                "phase_3": "Synthesis and validation for comprehensive ikigai profile",
                "context_window_optimization": "Adaptive batching based on model capabilities",
                "inclusive_approach": "Analyzes ALL email types including commercial for complete picture"
            },
            "scoring_summary": final_insights.personal_patterns.get('score_statistics', {}),
            "email_count": len(email_scores)
        }
        
        # Write report with numpy encoder for JSON serialization
        import json
        import numpy as np
        
        class NumpyEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                elif isinstance(obj, np.floating):
                    return float(obj)
                elif isinstance(obj, np.ndarray):
                    return obj.tolist()
                return super(NumpyEncoder, self).default(obj)
        
        json_filename = f"ikigai_insights/{output_prefix}_holistic_ikigai_report_{timestamp}.json"
        # Optional redaction
        import os as _os, re as _re
        if _os.getenv('REDACT_REPORTS', '') in ('1','true','yes','on'):
            email_re = _re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+')
            id_re = _re.compile(r'\b(?:#)?[A-Z0-9]{8,}\b')
            def red(s):
                if isinstance(s, str):
                    return id_re.sub('[redacted-id]', email_re.sub('[redacted-email]', s))
                return s
            def recurse(x):
                if isinstance(x, dict):
                    return {k: recurse(v) for k, v in x.items()}
                if isinstance(x, list):
                    return [recurse(v) for v in x]
                return red(x)
            report = recurse(report)

        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, cls=NumpyEncoder)
        
        self.logger.info(f"Exported holistic ikigai scores to {csv_filename}")
        self.logger.info(f"Exported holistic ikigai report to {json_filename}")
        print(f"📊 Holistic ikigai email scores saved to: {csv_filename}")
        print(f"📋 Holistic ikigai analysis report saved to: {json_filename}")
    
    def _create_empty_insights(self) -> AuthenticIkigaiInsights:
        """Create empty insights when no data available."""
        return AuthenticIkigaiInsights(
            primary_ikigai="No Data Available",
            secondary_areas=[],
            confidence_score=0.0,
            supporting_evidence=[],
            framework_dimensions={},
            personal_patterns={'analysis_type': 'Holistic Multi-Phase Analysis - No Data'},
            recommendations=["Gather email communication data for holistic ikigai analysis"],
            analysis_timestamp=datetime.utcnow().isoformat()
        )
    
    def _create_empty_holistic_context(self) -> HolisticIkigaiContext:
        """Create empty holistic context."""
        return HolisticIkigaiContext(
            primary_themes=[],
            interest_areas=[],
            behavioral_patterns={},
            value_indicators=[],
            temporal_patterns={},
            engagement_styles={},
            commercial_insights={},
            confidence_factors=[]
        )
