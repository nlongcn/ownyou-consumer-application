#!/usr/bin/env python3
"""
Authentic Ikigai Analysis Module - Based on Yukari Mitsuhashi's Research

Implements the genuine Japanese ikigai framework focusing on personal meaning
and everyday joy, separate from marketing/commercial analysis.

Ikigai = "iki" (life) + "gai" (value/worth) = value that makes life worth living
Focus: Everyday life joy (seikatsu) rather than grand life purpose (jinsei)
"""

import pandas as pd
from collections import Counter
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging
import re
from datetime import datetime

from ..llm_clients.base import LLMRequest, LLMMessage


@dataclass
class AuthenticIkigaiInsights:
    """Data structure for authentic ikigai analysis results"""
    primary_ikigai: str
    secondary_areas: List[str] 
    confidence_score: float
    supporting_evidence: List[Dict[str, Any]]
    framework_dimensions: Dict[str, Any]
    personal_patterns: Dict[str, Any]
    recommendations: List[str]
    analysis_timestamp: str


class AuthenticIkigaiAnalyzer:
    """
    Analyzes email patterns to identify authentic ikigai using Yukari Mitsuhashi's framework.
    
    Key Principles:
    - External > Internal: Connection to external world through personal choice
    - Active > Passive: Evidence of active participation vs passive consumption  
    - Emotional > Logical: Personal meaning vs commercial transactions
    - Voluntary > Required: Chosen activities vs imposed communications
    - Specific > Abstract: Concrete daily activities that bring joy
    - Fluid > Fixed: Evolving interests and growth
    """
    
    def __init__(self, llm_client, logger: Optional[logging.Logger] = None, model_name: str = None):
        """
        Initialize the authentic ikigai analyzer.
        
        Args:
            llm_client: LLM client instance for analysis
            logger: Logger instance
            model_name: Specific model name to use for analysis
        """
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
        
    def analyze_emails(self, processed_emails: List[Dict[str, Any]], output_prefix: str = None) -> AuthenticIkigaiInsights:
        """
        Analyze email patterns to identify authentic ikigai.
        
        Args:
            processed_emails: List of processed email dictionaries
            output_prefix: Optional prefix for output files (e.g., "emails_processed_combined")
            
        Returns:
            AuthenticIkigaiInsights object containing analysis results
        """
        if not processed_emails:
            return self._create_empty_insights()
        
        # Convert to DataFrame for analysis
        df = pd.DataFrame(processed_emails)
        
        # Filter for authentic ikigai indicators and create per-email assessments
        personal_df, email_assessments = self._filter_for_authentic_ikigai_with_details(df)
        
        # Export per-email ikigai assessments to CSV
        if output_prefix:
            self._export_email_ikigai_csv(email_assessments, output_prefix)
        
        if personal_df.empty:
            self.logger.info("No authentic ikigai indicators found in email data")
            insights = self._create_insufficient_data_insights()
        else:
            # Extract authentic patterns
            patterns = self._extract_authentic_patterns(personal_df, df)
            
            # Perform LLM analysis with authentic framework
            ikigai_analysis = self._analyze_with_authentic_framework(patterns, personal_df)
            
            # Create insights object
            insights = self._create_authentic_insights(ikigai_analysis, patterns)
        
        # Export final ikigai report
        if output_prefix:
            self._export_final_ikigai_report(insights, output_prefix)
        
        return insights
    
    def _filter_for_authentic_ikigai_with_details(self, df: pd.DataFrame) -> tuple:
        """
        Filter emails for authentic ikigai indicators and create per-email assessments.
        
        Returns:
            tuple: (filtered_df, email_assessments_list)
        """
        if df.empty:
            return df, []
        
        # Define commercial/marketing categories to exclude
        commercial_categories = {
            'Purchase', 'News/Blog/Spam', 'Shipment Related', 
            'Invoice', 'Bank Related', 'Marketing', 'Promotional',
            'Spam'
        }
        
        # Define authentic ikigai categories
        authentic_categories = {
            'Personal Communication', 'Educational', 'Learning',
            'Creative', 'Hobby', 'Community', 'Health/Wellness',
            'Personal Development', 'Artistic', 'Volunteer',
            'Newsletter'
        }
        
        # Create per-email ikigai assessments
        email_assessments = []
        
        for _, row in df.iterrows():
            assessment = {
                'ID': row.get('ID', ''),
                'Subject': row.get('Subject', ''),
                'From': row.get('From', ''),
                'Date': row.get('Date', ''),
                'Category': row.get('Category', ''),
                'Key_Topics': row.get('Key_Topics', ''),
                'Sentiment': row.get('Sentiment', ''),
                'Action_Required': row.get('Action_Required', ''),
            }
            
            # Assess ikigai relevance
            category = row.get('Category', '')
            subject = str(row.get('Subject', '')).lower()
            topics = str(row.get('Key_Topics', '')).lower()
            
            # Determine ikigai classification
            if category in commercial_categories:
                assessment['Ikigai_Classification'] = 'Commercial/Marketing'
                assessment['Ikigai_Relevance'] = 'Low'
                assessment['Ikigai_Reason'] = f'Category "{category}" indicates commercial communication'
                assessment['Personal_Interest_Score'] = 0
            elif category in authentic_categories:
                assessment['Ikigai_Classification'] = 'Personal/Authentic'
                assessment['Ikigai_Relevance'] = 'High'
                assessment['Ikigai_Reason'] = f'Category "{category}" indicates personal communication'
                assessment['Personal_Interest_Score'] = self._calculate_personal_interest_score(subject, topics)
            else:
                # Apply content-based analysis
                personal_score = self._calculate_personal_interest_score(subject, topics)
                if personal_score >= 2:
                    assessment['Ikigai_Classification'] = 'Potentially Personal'
                    assessment['Ikigai_Relevance'] = 'Medium'
                    assessment['Ikigai_Reason'] = 'Content suggests personal interest'
                    assessment['Personal_Interest_Score'] = personal_score
                else:
                    assessment['Ikigai_Classification'] = 'Non-Personal'
                    assessment['Ikigai_Relevance'] = 'Low'
                    assessment['Ikigai_Reason'] = 'No clear personal interest indicators'
                    assessment['Personal_Interest_Score'] = personal_score
            
            email_assessments.append(assessment)
        
        # Filter for authentic ikigai emails
        authentic_rows = []
        for i, assessment in enumerate(email_assessments):
            if assessment['Ikigai_Relevance'] in ['High', 'Medium']:
                authentic_rows.append(df.iloc[i])
        
        authentic_df = pd.DataFrame(authentic_rows) if authentic_rows else pd.DataFrame()
        
        self.logger.info(f"Filtered {len(df)} emails to {len(authentic_df)} authentic ikigai indicators")
        return authentic_df, email_assessments
    
    def _apply_content_filters(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply content-based filters to identify authentic personal communications."""
        if df.empty:
            return df
        
        # Marketing indicators to exclude (in subject/content)
        marketing_indicators = [
            'sale', 'discount', 'offer', 'deal', 'promotion', 'buy now',
            'limited time', 'expires', 'urgent', 'last chance', 'price',
            'free shipping', 'order now', 'shop', 'purchase', 'payment',
            'invoice', 'receipt', 'delivery', 'shipped', 'tracking'
        ]
        
        # Personal/learning indicators to include
        personal_indicators = [
            'learn', 'course', 'education', 'tutorial', 'workshop',
            'community', 'newsletter', 'blog', 'research', 'study',
            'practice', 'skill', 'development', 'growth', 'improvement',
            'create', 'art', 'music', 'write', 'design', 'craft'
        ]
        
        # Apply filters based on subject line content
        if 'Subject' in df.columns:
            # Exclude obvious marketing subjects
            subjects = df['Subject'].fillna('').str.lower()
            marketing_mask = subjects.str.contains('|'.join(marketing_indicators), na=False, regex=True)
            df = df[~marketing_mask]
            
            # Prioritize personal/learning content
            if not df.empty:
                personal_mask = subjects.str.contains('|'.join(personal_indicators), na=False, regex=True)
                df = df.copy()
                df['personal_score'] = personal_mask.astype(int)
        
        return df
    
    def _identify_personal_engagement(self, df: pd.DataFrame) -> pd.DataFrame:
        """Identify emails showing authentic personal engagement."""
        if df.empty:
            return df
        
        engagement_score = 0
        
        # Score based on voluntary subscription indicators
        if 'From' in df.columns:
            # Look for educational/personal development domains
            education_domains = ['coursera', 'edx', 'udemy', 'skillshare', 'masterclass',
                               'medium', 'substack', 'newsletter', 'blog']
            
            from_addresses = df['From'].fillna('').str.lower()
            edu_mask = from_addresses.str.contains('|'.join(education_domains), na=False, regex=True)
            df['education_score'] = edu_mask.astype(int)
        
        # Score based on personal communication patterns
        if 'Sentiment' in df.columns:
            # Neutral or positive sentiment for authentic content
            df['sentiment_score'] = ((df['Sentiment'] == 'neutral') | 
                                   (df['Sentiment'] == 'positive')).astype(int)
        
        # Score based on action requirements (learning vs buying)
        if 'Action_Required' in df.columns and 'Key_Topics' in df.columns:
            # Look for learning/growth actions vs commercial actions
            topics = df['Key_Topics'].fillna('').str.lower()
            learning_actions = topics.str.contains(
                'read|learn|practice|study|explore|discover|understand|develop',
                na=False, regex=True
            )
            df['learning_action_score'] = learning_actions.astype(int)
        
        # Calculate composite engagement score
        score_columns = [col for col in df.columns if col.endswith('_score')]
        if score_columns:
            df['authentic_engagement_score'] = df[score_columns].sum(axis=1)
            # Keep emails with positive engagement scores
            df = df[df['authentic_engagement_score'] > 0]
        
        return df
    
    def _extract_authentic_patterns(self, personal_df: pd.DataFrame, full_df: pd.DataFrame) -> Dict[str, Any]:
        """Extract patterns relevant to authentic ikigai analysis."""
        
        total_emails = len(full_df)
        personal_emails = len(personal_df)
        
        # Extract personal topics and themes
        personal_topics = []
        if not personal_df.empty and 'Key_Topics' in personal_df.columns:
            topics_text = ' '.join(personal_df['Key_Topics'].fillna('').astype(str))
            topic_words = [
                word.strip() for word in topics_text.split(',')
                if word.strip() and len(word.strip()) > 2 
                and not self._is_commercial_term(word.strip())
            ]
            personal_topics = Counter(topic_words).most_common(15)
        
        # Analyze communication patterns for personal growth
        growth_patterns = self._identify_growth_patterns(personal_df)
        
        # Identify consistent personal interests
        consistent_interests = self._find_consistent_interests(personal_df)
        
        # Extract sample emails showing authentic engagement
        personal_samples = []
        if not personal_df.empty:
            sample_columns = ['Subject', 'Key_Topics', 'Category', 'Summary', 'From']
            available_columns = [col for col in sample_columns if col in personal_df.columns]
            personal_samples = personal_df[available_columns].head(6).to_dict('records')
        
        return {
            'total_emails': total_emails,
            'personal_email_count': personal_emails,
            'personal_percentage': round((personal_emails / total_emails * 100) if total_emails > 0 else 0, 1),
            'personal_topics': personal_topics,
            'growth_patterns': growth_patterns,
            'consistent_interests': consistent_interests,
            'personal_samples': personal_samples,
            'engagement_indicators': self._calculate_engagement_indicators(personal_df)
        }
    
    def _is_commercial_term(self, term: str) -> bool:
        """Check if a term is commercial/marketing related."""
        commercial_terms = {
            'sale', 'discount', 'price', 'buy', 'purchase', 'order', 'payment',
            'shipping', 'delivery', 'offer', 'deal', 'promotion', 'marketing',
            'advertising', 'campaign', 'brand', 'product', 'service', 'customer'
        }
        return term.lower() in commercial_terms
    
    def _identify_growth_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Identify patterns indicating personal growth and development."""
        if df.empty:
            return {'growth_indicators': [], 'learning_frequency': 0}
        
        growth_indicators = []
        
        # Look for learning-related keywords
        if 'Key_Topics' in df.columns:
            topics = ' '.join(df['Key_Topics'].fillna('').astype(str)).lower()
            
            learning_keywords = [
                'learn', 'skill', 'course', 'tutorial', 'practice', 'improve',
                'develop', 'growth', 'education', 'study', 'training', 'workshop'
            ]
            
            for keyword in learning_keywords:
                count = topics.count(keyword)
                if count > 0:
                    growth_indicators.append({'keyword': keyword, 'frequency': count})
        
        return {
            'growth_indicators': growth_indicators,
            'learning_frequency': len(growth_indicators)
        }
    
    def _find_consistent_interests(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Find interests that appear consistently over time."""
        if df.empty or 'Key_Topics' not in df.columns:
            return []
        
        # Track topic frequency and spread
        topic_dates = {}
        for _, row in df.iterrows():
            if pd.notna(row['Key_Topics']) and pd.notna(row.get('Date')):
                topics = [t.strip() for t in str(row['Key_Topics']).split(',')]
                date = row['Date']
                
                for topic in topics:
                    if len(topic) > 2 and not self._is_commercial_term(topic):
                        if topic not in topic_dates:
                            topic_dates[topic] = []
                        topic_dates[topic].append(date)
        
        # Find topics with consistent appearance
        consistent_interests = []
        for topic, dates in topic_dates.items():
            if len(dates) >= 2:  # Appears multiple times
                consistent_interests.append({
                    'topic': topic,
                    'frequency': len(dates),
                    'first_seen': min(dates) if dates else None,
                    'last_seen': max(dates) if dates else None
                })
        
        # Sort by frequency
        consistent_interests.sort(key=lambda x: x['frequency'], reverse=True)
        return consistent_interests[:10]
    
    def _calculate_engagement_indicators(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate indicators of authentic personal engagement."""
        if df.empty:
            return {}
        
        indicators = {}
        
        # Calculate sentiment distribution for personal emails
        if 'Sentiment' in df.columns:
            sentiment_counts = df['Sentiment'].value_counts()
            indicators['sentiment_distribution'] = sentiment_counts.to_dict()
            indicators['positive_engagement'] = sentiment_counts.get('positive', 0)
        
        # Calculate category distribution  
        if 'Category' in df.columns:
            category_counts = df['Category'].value_counts()
            indicators['category_distribution'] = category_counts.to_dict()
        
        # Calculate temporal patterns
        if 'Date' in df.columns:
            df_copy = df.copy()
            # Use utc=True to avoid mixed time zone warnings
            df_copy['Date'] = pd.to_datetime(df_copy['Date'], errors='coerce', utc=True)
            valid_dates = df_copy['Date'].dropna()
            if len(valid_dates) > 1:
                date_range = valid_dates.max() - valid_dates.min()
                indicators['engagement_timespan_days'] = date_range.days if hasattr(date_range, 'days') else 0
            else:
                indicators['engagement_timespan_days'] = 0
        
        return indicators
    
    def _analyze_with_authentic_framework(self, patterns: Dict[str, Any], personal_df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze patterns using authentic ikigai framework with LLM."""
        
        system_prompt = """You are an expert in authentic ikigai analysis using Yukari Mitsuhashi's research.

AUTHENTIC IKIGAI FRAMEWORK (Mitsuhashi):
- Ikigai = "iki" (life) + "gai" (value/worth) = value that makes life worth living
- Focus on EVERYDAY LIFE JOY (seikatsu) not grand life purpose (jinsei)  
- "Whatever gets you up in the morning is your ikigai - and no one can tell you otherwise"

CORE CHARACTERISTICS:
- External > Internal: Connection to external world through personal choice
- Active > Passive: Active participation vs passive consumption
- Emotional > Logical: Personal meaning vs commercial transactions
- Voluntary > Required: Chosen activities vs imposed communications
- Specific > Abstract: Concrete daily activities that bring joy
- Fluid > Fixed: Evolving interests and growth

ANALYSIS PRINCIPLES:
1. Look for voluntary personal pursuits that bring joy
2. Identify consistent interests chosen by the person
3. Focus on active engagement in learning/growth
4. Exclude all commercial/marketing content
5. Emphasize small daily activities that add meaning
6. Look for external connection through personal interests

Provide direct, confident assessment based on authentic personal engagement patterns."""

        user_prompt = f"""Analyze this email data for AUTHENTIC ikigai patterns using Mitsuhashi's framework.

PERSONAL ENGAGEMENT DATA:
- Total emails analyzed: {patterns['total_emails']}
- Personal engagement emails: {patterns['personal_email_count']}
- Personal engagement rate: {patterns['personal_percentage']}%

AUTHENTIC PERSONAL TOPICS (chosen interests):"""
        
        for topic, count in patterns['personal_topics'][:10]:
            user_prompt += f"\n- {topic}: {count} instances"
            
        user_prompt += f"""

GROWTH & LEARNING PATTERNS:
- Learning frequency indicators: {patterns['growth_patterns']['learning_frequency']}"""

        for indicator in patterns['growth_patterns']['growth_indicators'][:5]:
            user_prompt += f"\n- {indicator['keyword']}: {indicator['frequency']} times"

        user_prompt += f"""

CONSISTENT PERSONAL INTERESTS (over time):"""
        
        for interest in patterns['consistent_interests'][:5]:
            user_prompt += f"\n- {interest['topic']}: {interest['frequency']} times"

        user_prompt += f"""

SAMPLE AUTHENTIC PERSONAL COMMUNICATIONS:"""
        
        for i, email in enumerate(patterns['personal_samples'][:4], 1):
            subject = email.get('Subject', 'No subject')
            topics = email.get('Key_Topics', 'No topics')
            from_addr = email.get('From', 'Unknown sender')
            
            user_prompt += f"""
{i}. Subject: "{subject}"
   Topics: {topics}
   From: {from_addr}"""

        user_prompt += """

Based on this PERSONAL engagement analysis (NOT marketing emails), provide ikigai assessment in JSON format:

{
  "primary_ikigai": "Main ikigai area based on strongest personal patterns",
  "secondary_areas": ["Area 2", "Area 3"],  
  "confidence_score": 0.85,
  "supporting_evidence": [
    {
      "pattern": "Description of authentic personal pattern",
      "strength": "high/medium/low",
      "examples": ["Example 1", "Example 2"]
    }
  ],
  "framework_dimensions": {
    "external_connection": "How person connects to external world through chosen interests",
    "active_engagement": "Evidence of active participation vs passive consumption",
    "emotional_meaning": "Signs of personal meaning and joy in activities", 
    "voluntary_pursuit": "Evidence these are chosen, not imposed interests",
    "everyday_joy": "Small daily activities that bring meaning",
    "growth_orientation": "Evidence of learning and personal development"
  },
  "recommendations": [
    "Ways to nurture and expand identified ikigai areas",
    "Suggestions for deeper personal engagement"
  ]
}

Focus on authentic personal pursuits that bring everyday joy, not commercial interests."""

        try:
            request = LLMRequest(
                messages=[
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt)
                ],
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.1,
                max_tokens=8000
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                import json
                import re
                
                # Clean and parse JSON response
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
                        self.logger.warning("Could not parse authentic ikigai JSON response")
                        return self._create_fallback_analysis(patterns)
            else:
                self.logger.warning("Authentic ikigai analysis request failed")
                return self._create_fallback_analysis(patterns)
                
        except Exception as e:
            self.logger.error(f"Authentic ikigai analysis failed: {e}")
            return self._create_fallback_analysis(patterns)
    
    def _create_fallback_analysis(self, patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Create fallback analysis when LLM analysis fails."""
        
        primary_ikigai = "Personal Growth & Learning"
        if patterns['personal_topics']:
            top_topic = patterns['personal_topics'][0][0].lower()
            if any(tech in top_topic for tech in ['tech', 'code', 'programming', 'software']):
                primary_ikigai = "Technology Learning & Skill Development"
            elif any(creative in top_topic for creative in ['art', 'design', 'creative', 'music']):
                primary_ikigai = "Creative Expression & Artistry"
            elif any(health in top_topic for health in ['health', 'fitness', 'wellness', 'mindfulness']):
                primary_ikigai = "Health & Personal Wellness"
        
        return {
            "primary_ikigai": primary_ikigai,
            "secondary_areas": ["Continuous Learning", "Personal Development"],
            "confidence_score": 0.6,
            "supporting_evidence": [
                {
                    "pattern": f"{patterns['personal_email_count']} authentic personal communications identified",
                    "strength": "medium",
                    "examples": [f"Top personal topics: {patterns['personal_topics'][:3]}"]
                }
            ],
            "framework_dimensions": {
                "external_connection": f"{patterns['personal_percentage']}% of communications show personal external engagement",
                "active_engagement": "Evidence of chosen subscriptions and voluntary learning",
                "emotional_meaning": "Personal interest patterns indicate emotional connection",
                "voluntary_pursuit": "Communications appear to be voluntarily chosen, not imposed",
                "everyday_joy": "Regular engagement with personal interest topics",
                "growth_orientation": f"Learning indicators: {patterns['growth_patterns']['learning_frequency']}"
            },
            "recommendations": [
                "Continue nurturing identified personal interests and learning opportunities",
                "Seek deeper engagement in areas showing consistent patterns over time"
            ]
        }
    
    def _create_authentic_insights(self, analysis: Dict[str, Any], patterns: Dict[str, Any]) -> AuthenticIkigaiInsights:
        """Create structured authentic ikigai insights from analysis."""
        
        return AuthenticIkigaiInsights(
            primary_ikigai=analysis.get('primary_ikigai', 'Unknown'),
            secondary_areas=analysis.get('secondary_areas', []),
            confidence_score=analysis.get('confidence_score', 0.5),
            supporting_evidence=analysis.get('supporting_evidence', []),
            framework_dimensions=analysis.get('framework_dimensions', {}),
            personal_patterns=patterns,
            recommendations=analysis.get('recommendations', []),
            analysis_timestamp=datetime.utcnow().isoformat()
        )
    
    def _create_empty_insights(self) -> AuthenticIkigaiInsights:
        """Create empty insights when no data is available."""
        
        return AuthenticIkigaiInsights(
            primary_ikigai="No Data Available",
            secondary_areas=[],
            confidence_score=0.0,
            supporting_evidence=[],
            framework_dimensions={},
            personal_patterns={},
            recommendations=["Gather personal communication data for authentic ikigai analysis"],
            analysis_timestamp=datetime.utcnow().isoformat()
        )
    
    def _create_insufficient_data_insights(self) -> AuthenticIkigaiInsights:
        """Create insights when no authentic personal engagement is found."""
        
        return AuthenticIkigaiInsights(
            primary_ikigai="Insufficient Personal Data",
            secondary_areas=[],
            confidence_score=0.0,
            supporting_evidence=[
                {
                    "pattern": "No authentic personal communications identified in email data",
                    "strength": "low",
                    "examples": ["Only commercial/marketing emails found"]
                }
            ],
            framework_dimensions={
                "external_connection": "No personal external engagement patterns detected",
                "active_engagement": "No evidence of chosen personal activities",
                "emotional_meaning": "Limited personal meaning indicators in communications",
                "voluntary_pursuit": "Mainly imposed/commercial communications detected",
                "everyday_joy": "No clear patterns of everyday personal interests",
                "growth_orientation": "Limited learning/growth indicators"
            },
            personal_patterns={'message': 'No personal patterns found - only commercial communications'},
            recommendations=[
                "Subscribe to educational or personal interest newsletters",
                "Engage in online learning platforms or creative communities",
                "Join personal development or hobby-related communications"
            ],
            analysis_timestamp=datetime.utcnow().isoformat()
        )
    
    def _calculate_personal_interest_score(self, subject: str, topics: str) -> int:
        """Calculate personal interest score based on content."""
        score = 0
        
        # Personal interest keywords
        personal_keywords = [
            'learn', 'course', 'education', 'tutorial', 'workshop', 'study',
            'creative', 'art', 'music', 'writing', 'design', 'craft',
            'health', 'fitness', 'wellness', 'mindfulness', 'meditation',
            'community', 'volunteer', 'hobby', 'passion', 'interest',
            'skill', 'development', 'growth', 'improvement', 'practice'
        ]
        
        # Marketing keywords (negative score)
        marketing_keywords = [
            'sale', 'discount', 'offer', 'deal', 'buy', 'purchase', 'order',
            'price', 'free', 'limited', 'urgent', 'expires', 'now', 'today'
        ]
        
        content = f"{subject} {topics}".lower()
        
        # Add points for personal keywords
        for keyword in personal_keywords:
            if keyword in content:
                score += 1
        
        # Subtract points for marketing keywords
        for keyword in marketing_keywords:
            if keyword in content:
                score -= 2
        
        return max(0, score)  # Don't allow negative scores
    
    def _export_email_ikigai_csv(self, email_assessments: List[Dict], output_prefix: str):
        """Export per-email ikigai assessments to CSV."""
        if not email_assessments:
            return
        
        # Create DataFrame from assessments
        df = pd.DataFrame(email_assessments)
        
        # Ensure ikigai_insights directory exists
        import os
        os.makedirs("ikigai_insights", exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"ikigai_insights/{output_prefix}_ikigai_per_email_{timestamp}.csv"
        
        # Export to CSV
        df.to_csv(filename, index=False)
        self.logger.info(f"Exported {len(email_assessments)} email ikigai assessments to {filename}")
        print(f"📄 Per-email ikigai assessments saved to: {filename}")
    
    def _export_final_ikigai_report(self, insights: AuthenticIkigaiInsights, output_prefix: str):
        """Export final ikigai analysis report."""
        
        # Ensure ikigai_insights directory exists
        import os
        os.makedirs("ikigai_insights", exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"ikigai_insights/{output_prefix}_ikigai_final_report_{timestamp}.json"
        
        # Create comprehensive report
        # Build data coverage from patterns if available
        coverage = {
            "total_emails": insights.personal_patterns.get('total_emails', None),
            "personal_email_count": insights.personal_patterns.get('personal_email_count', None),
            "personal_percentage": insights.personal_patterns.get('personal_percentage', None)
        }

        # Generator metadata
        model_name = getattr(self.llm_client, 'default_model', 'unknown')
        generator = {"name": "AuthenticIkigaiAnalyzer", "version": "v1", "model": model_name}

        report = {
            "ikigai_analysis_report": {
                "schema_version": "1.0",
                "analysis_type": "Authentic Ikigai Analysis",
                "framework": "Yukari Mitsuhashi's Japanese Ikigai Research",
                "analysis_timestamp": insights.analysis_timestamp,
                "primary_ikigai": insights.primary_ikigai,
                "secondary_areas": insights.secondary_areas,
                "confidence_score": insights.confidence_score,
                "supporting_evidence": insights.supporting_evidence,
                "framework_dimensions": insights.framework_dimensions,
                "personal_patterns": insights.personal_patterns,
                "recommendations": insights.recommendations,
                "data_coverage": coverage,
                "generator": generator
            },
            "methodology": {
                "approach": "Content-based filtering to identify authentic personal communications",
                "excluded": [
                    "Marketing and promotional emails",
                    "Transactional communications",
                    "Commercial solicitations",
                    "Automated system messages"
                ],
                "included": [
                    "Personal communications",
                    "Educational content subscriptions",
                    "Creative and hobby-related content",
                    "Personal development materials",
                    "Voluntary community engagement"
                ],
                "framework_principles": {
                    "external_over_internal": "Connection to external world through personal choice",
                    "active_over_passive": "Active participation vs passive consumption", 
                    "emotional_over_logical": "Personal meaning vs commercial transactions",
                    "voluntary_over_required": "Chosen activities vs imposed communications",
                    "everyday_joy": "Small daily activities that bring meaning (seikatsu ikigai)"
                }
            }
        }
        
        # Write report to JSON file
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

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, cls=NumpyEncoder)
        
        self.logger.info(f"Exported final ikigai report to {filename}")
        print(f"📊 Final ikigai analysis report saved to: {filename}")
