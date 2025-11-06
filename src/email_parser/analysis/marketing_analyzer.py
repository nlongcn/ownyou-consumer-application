"""
Unbiased marketing analysis module for processed email data.

Uses neutral pattern discovery without predetermined demographic assumptions.
Focuses on data-driven insights while avoiding stereotypical associations.
"""

from typing import Dict, Any, List, Optional, Union, Tuple
from dataclasses import dataclass, asdict, field
import json
import re
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from collections import Counter, defaultdict

from ..llm_clients.base import LLMClientFactory, create_simple_request
from ..utils.logging import get_logger
# Removed complex model selection - using simple .env config
from .authentic_ikigai_analyzer import AuthenticIkigaiAnalyzer, AuthenticIkigaiInsights

logger = get_logger(__name__)


@dataclass
class PatternEvidence:
    """Evidence structure for observed patterns without demographic assumptions."""
    pattern_type: str
    observation: str
    frequency: int
    context: str
    confidence: float


@dataclass
class UnbiasedMarketingInsights:
    """Unbiased consumer profile analysis results."""
    communication_patterns: Dict[str, Any]
    interest_clusters: Dict[str, Any]
    purchase_behavior: Dict[str, Any]
    geographic_indicators: Dict[str, Any]
    temporal_patterns: Dict[str, Any]
    engagement_profile: Dict[str, Any]
    pattern_evidence: List[Dict[str, Any]]
    demographic_possibilities: Dict[str, Any]  # Multiple possibilities, not assumptions
    next_purchase_signals: List[Dict[str, Any]]
    ikigai: Dict[str, Any]  # Authentic ikigai analysis based on Yukari Mitsuhashi's framework
    confidence_metrics: Dict[str, float]
    summary: str
    analysis_model: str
    analysis_timestamp: str
    schema_version: str = field(default="1.0")
    generator: Dict[str, Any] = field(default_factory=dict)
    data_coverage: Dict[str, Any] = field(default_factory=dict)
    section_confidence: Dict[str, float] = field(default_factory=dict)

    # Add compatibility properties for existing code
    @property
    def recent_purchases(self) -> List[Dict[str, Any]]:
        """Extract recent purchases from purchase_behavior."""
        return self.purchase_behavior.get('confirmed_transactions', [])
    
    @property
    def purchase_predictions(self) -> List[Dict[str, Any]]:
        """Extract purchase predictions from next_purchase_signals."""
        return self.next_purchase_signals


class UnbiasedMarketingAnalyzer:
    """Marketing analyzer focused on neutral pattern discovery without demographic bias."""
    
    def __init__(self, llm_config: Dict[str, Any], model_name: str = None):
        """Initialize unbiased marketing analyzer."""
        self.llm_config = llm_config
        self.model_name = model_name
        self.logger = logger
        # Deterministic seed for sampling
        try:
            import os
            self.seed = int(llm_config.get('seed', os.getenv('LLM_SEED', 42)))
        except Exception:
            self.seed = 42
        
        # Initialize LLM client
        if model_name:
            model_mapping = {
                "openai": "openai",
                "gpt4": "openai", 
                "gpt-4": "openai",
                "claude": "claude",
                "sonnet": "claude",
                "deepseek": "ollama",
                "ollama": "ollama"
            }
            
            provider = model_mapping.get(model_name.lower(), "ollama")
            self.llm_client = LLMClientFactory.create_client(provider, llm_config)
            self.analysis_model = f"{provider}:{model_name}"
        else:
            # Use default provider from config
            provider = llm_config.get('provider', 'claude')
            if provider == 'claude':
                model = llm_config.get('anthropic_model', 'claude-sonnet-4-20250514')
            else:
                model = llm_config.get(f'{provider}_model', 'default')
            self.llm_client = LLMClientFactory.create_client(provider, llm_config)
            self.analysis_model = f"{provider}:{model}"
    
    def analyze_emails(self, processed_emails: List[Dict[str, Any]], output_prefix: str = None) -> UnbiasedMarketingInsights:
        """Perform unbiased pattern discovery analysis."""
        if not processed_emails:
            return self._create_empty_insights()
        
        # Convert to DataFrame for analysis
        df = pd.DataFrame(processed_emails)
        
        self.logger.info(
            "Starting unbiased pattern analysis",
            email_count=len(processed_emails),
            model=self.analysis_model,
            seed=getattr(self, 'seed', None)
        )
        
        try:
            # Stage 0: Filter out marketing emails for consumer analysis
            df_original = df.copy()
            df_filtered = self._filter_marketing_emails(df)
            
            self.logger.info(
                "Marketing email filtering completed",
                original_emails=len(df_original),
                filtered_emails=len(df_filtered), 
                marketing_emails_detected=len(df_original) - len(df_filtered)
            )
            
            # Stage 1: Neutral Pattern Discovery (use original for communication patterns)
            pattern_evidence = self._discover_patterns_neutrally(df_original)
            
            # Stage 2: Communication Pattern Analysis (use original for full picture)
            communication_patterns = self._analyze_communication_patterns(df_original)
            
            # Stage 3: Interest Clustering (use filtered for genuine interests)
            interest_clusters = self._analyze_interest_clusters(df_filtered)
            
            # Stage 4: Purchase Behavior Analysis (already does its own filtering)
            purchase_behavior = self._analyze_purchase_behavior_neutral(df_original)
            
            # Stage 5: Geographic Pattern Discovery (use filtered)
            geographic_indicators = self._discover_geographic_patterns(df_filtered)
            
            # Stage 6: Temporal Analysis (use original)
            temporal_patterns = self._analyze_temporal_patterns(df_original)
            
            # Stage 7: Engagement Profile (use original)
            engagement_profile = self._build_engagement_profile(df_original, pattern_evidence)
            
            # Stage 8: Demographic Possibilities (use filtered for genuine signals)
            demographic_possibilities = self._explore_demographic_possibilities(df_filtered, pattern_evidence, geographic_indicators)
            
            # Stage 9: Purchase Signal Detection (use filtered data and existing analysis)
            purchase_signals = self._detect_purchase_signals_with_context(df_filtered, pattern_evidence, {
                'communication_patterns': communication_patterns,
                'interest_clusters': interest_clusters, 
                'purchase_behavior': purchase_behavior,
                'geographic_indicators': geographic_indicators,
                'temporal_patterns': temporal_patterns,
                'engagement_profile': engagement_profile
            })
            
            # Stage 10: Authentic Ikigai Analysis (based on Yukari Mitsuhashi's framework)
            ikigai_analysis = self._analyze_authentic_ikigai(processed_emails, output_prefix)
            
            # Calculate confidence metrics
            confidence_metrics = self._calculate_confidence_metrics(pattern_evidence, df)
            
            # Generate neutral summary
            summary = self._generate_neutral_summary(
                communication_patterns, interest_clusters, purchase_behavior,
                geographic_indicators, confidence_metrics
            )
            
            # Convert evidence to serializable format
            evidence_serializable = [asdict(e) for e in pattern_evidence]
            
            # Data coverage metadata
            coverage = {
                'total_emails': len(df_original),
                'analyzed_emails': len(df_original),
                'filtered_non_marketing': len(df_filtered),
                'samples': {
                    'patterns': min(100, len(df_original)),
                    'products_services': min(50, len(df_original)),
                    'geographic': min(100, len(df_filtered)) if len(df_filtered) > 0 else min(100, len(df_original))
                },
                'time_range': temporal_patterns.get('date_range', {})
            }

            # Section confidence heuristics (0.0 - 1.0)
            section_conf = self._estimate_section_confidence(
                df_original, df_filtered, pattern_evidence, communication_patterns,
                interest_clusters, purchase_behavior, geographic_indicators, temporal_patterns
            )

            return UnbiasedMarketingInsights(
                communication_patterns=communication_patterns,
                interest_clusters=interest_clusters,
                purchase_behavior=purchase_behavior,
                geographic_indicators=geographic_indicators,
                temporal_patterns=temporal_patterns,
                engagement_profile=engagement_profile,
                pattern_evidence=evidence_serializable,
                demographic_possibilities=demographic_possibilities,
                next_purchase_signals=purchase_signals,
                ikigai=ikigai_analysis,
                confidence_metrics=confidence_metrics,
                summary=summary,
                analysis_model=self.analysis_model,
                analysis_timestamp=datetime.utcnow().isoformat(),
                schema_version="1.0",
                generator={
                    'name': 'UnbiasedMarketingAnalyzer',
                    'version': 'v1',
                    'model': self.analysis_model,
                    'seed': getattr(self, 'seed', None)
                },
                data_coverage=coverage,
                section_confidence=section_conf
            )
            
        except Exception as e:
            self.logger.error(f"Unbiased marketing analysis failed: {e}")
            return self._create_empty_insights()
    
    def _discover_patterns_neutrally(self, df: pd.DataFrame) -> List[PatternEvidence]:
        """Discover patterns using LLM semantic analysis instead of word counting."""
        patterns = []
        total_emails = len(df)
        
        # Communication volume patterns
        patterns.append(PatternEvidence(
            pattern_type="communication_volume",
            observation=f"Analyzed {total_emails} email communications",
            frequency=total_emails,
            context="Overall communication activity level",
            confidence=0.9 if total_emails > 100 else 0.7 if total_emails > 50 else 0.5
        ))
        
        # LLM-based pattern discovery
        llm_patterns = self._discover_patterns_with_llm(df)
        patterns.extend(llm_patterns)
        
        return patterns
    
    def _discover_patterns_with_llm(self, df: pd.DataFrame) -> List[PatternEvidence]:
        """Use LLM to discover meaningful patterns from email communications."""
        if df.empty:
            return []
        
        # Sample emails for pattern analysis (to manage token limits)
        sample_size = min(100, len(df))
        sample_df = df.sample(n=sample_size, random_state=self.seed) if len(df) > sample_size else df
        
        # Prepare email data for analysis
        email_data = []
        for _, email in sample_df.iterrows():
            email_data.append({
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'category': email.get('Category', ''),
                'key_topics': email.get('Key_Topics', ''),
                'sentiment': email.get('Sentiment', ''),
                'date': email.get('Date', '')
            })
        
        system_prompt = """You are a behavioral pattern analyst specializing in communication data analysis.

ANALYSIS OBJECTIVES:
- Identify meaningful behavioral patterns from email communications
- Distinguish between genuine engagement and passive marketing exposure
- Analyze communication habits, preferences, and interests
- Detect lifestyle indicators from communication patterns
- Identify service usage and engagement patterns

PATTERN TYPES TO IDENTIFY:
- Communication behavior (frequency, timing, response patterns)
- Interest engagement (genuine interest vs passive exposure)
- Service relationships (active subscriptions, regular communication)
- Shopping/research behavior (consideration phases, comparison patterns)
- Professional/personal communication patterns
- Geographic/cultural indicators (from communication sources)
- Technology usage patterns (platforms, services, apps)

EVIDENCE REQUIREMENTS:
- Base patterns on frequency and consistency of communications
- Look for engagement indicators beyond simple email receipt
- Consider communication context and timing
- Identify patterns that suggest actual behavior vs marketing noise"""

        user_prompt = f"""Analyze these {len(email_data)} email communications to identify significant behavioral patterns.

EMAIL COMMUNICATIONS:
{json.dumps(email_data, indent=2)}

Identify meaningful patterns and return as a JSON object:
{{
  "behavioral_patterns": [
    {{
      "pattern_type": "category of pattern (e.g., 'service_engagement', 'shopping_behavior', 'lifestyle_indicator')",
      "observation": "specific pattern observed",
      "frequency": "approximate frequency or count supporting this pattern",
      "context": "detailed context explaining the pattern and its significance",
      "confidence": "confidence score between 0.0 and 1.0"
    }}
  ]
}}

Focus on patterns that indicate actual behavior, interests, or characteristics rather than just marketing exposure."""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.4,
                json_mode=True
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                analysis = self._parse_json_response(response.content)
                pattern_data = analysis.get('behavioral_patterns', [])
                
                patterns = []
                for p in pattern_data:
                    patterns.append(PatternEvidence(
                        pattern_type=p.get('pattern_type', 'unknown'),
                        observation=p.get('observation', ''),
                        frequency=int(p.get('frequency', 0)) if str(p.get('frequency', '0')).isdigit() else 1,
                        context=p.get('context', ''),
                        confidence=float(p.get('confidence', 0.5))
                    ))
                
                return patterns
            else:
                return []
                
        except Exception as e:
            self.logger.error(f"LLM pattern discovery failed: {e}")
            return []
    
    def _analyze_domain_patterns_neutral(self, df: pd.DataFrame) -> List[PatternEvidence]:
        """Analyze domain patterns without geographic assumptions."""
        patterns = []
        total_emails = len(df)
        
        # Extract domains neutrally
        domains = []
        for from_field in df['From'].dropna():
            match = re.search(r'@([^>\s]+)', str(from_field))
            if match:
                domains.append(match.group(1).lower())
        
        if domains:
            domain_counts = Counter(domains)
            
            # Look for patterns in domain types without making assumptions
            tld_patterns = defaultdict(int)
            for domain in domains:
                if '.' in domain:
                    tld = domain.split('.')[-1]
                    tld_patterns[tld] += 1
            
            # Report patterns neutrally
            for tld, count in tld_patterns.items():
                if count >= 3:  # Only significant patterns
                    confidence = min(0.9, 0.5 + (count / total_emails))
                    patterns.append(PatternEvidence(
                        pattern_type="domain_pattern",
                        observation=f"Communications from .{tld} domains",
                        frequency=count,
                        context=f"{count} emails from .{tld} domains ({count/total_emails:.1%} of total)",
                        confidence=confidence
                    ))
            
            # Service type patterns
            service_types = {
                'news_media': ['news', 'telegraph', 'guardian', 'times', 'bbc', 'cnn'],
                'technology': ['microsoft', 'google', 'apple', 'tech'],
                'finance': ['bank', 'finance', 'invest', 'trading'],
                'retail': ['shop', 'store', 'retail', 'amazon'],
                'social': ['facebook', 'twitter', 'linkedin', 'social']
            }
            
            for service_type, keywords in service_types.items():
                count = sum(1 for domain in domains if any(keyword in domain for keyword in keywords))
                if count > 0:
                    confidence = min(0.8, 0.4 + (count / total_emails * 2))
                    patterns.append(PatternEvidence(
                        pattern_type="service_engagement",
                        observation=f"Engagement with {service_type} services",
                        frequency=count,
                        context=f"{count} communications with {service_type}-related services",
                        confidence=confidence
                    ))
        
        return patterns
    
    def _analyze_interest_patterns_neutral(self, df: pd.DataFrame) -> List[PatternEvidence]:
        """Analyze interest patterns without demographic assumptions."""
        patterns = []
        
        # Extract all topics neutrally (handle both Key_Topics and Products columns)
        all_topics = []
        topics_column = 'Key_Topics' if 'Key_Topics' in df.columns else 'Products'

        if topics_column in df.columns:
            for topics in df[topics_column].dropna():
                if isinstance(topics, str) and topics.strip():
                    topic_list = [t.strip().lower() for t in topics.split(',') if t.strip()]
                    all_topics.extend(topic_list)
        
        if all_topics:
            topic_freq = Counter(all_topics)
            total_topics = len(all_topics)
            
            # Identify significant interest areas without bias
            for topic, count in topic_freq.items():
                if count >= 3:  # Only significant patterns
                    frequency_ratio = count / total_topics
                    confidence = min(0.9, 0.3 + (frequency_ratio * 3))
                    
                    patterns.append(PatternEvidence(
                        pattern_type="interest_area",
                        observation=f"Interest in {topic}",
                        frequency=count,
                        context=f"{count} mentions of {topic} ({frequency_ratio:.1%} of all topics)",
                        confidence=confidence
                    ))
        
        return patterns
    
    def _analyze_purchase_patterns_neutral(self, df: pd.DataFrame) -> List[PatternEvidence]:
        """Analyze purchase patterns without value assumptions."""
        patterns = []
        total_emails = len(df)
        
        # Purchase transaction patterns
        purchase_categories = ['Purchase', 'Invoice', 'Shipment Related', 'Bank Related']
        transaction_count = 0
        
        for category in purchase_categories:
            count = (df['Category'] == category).sum()
            transaction_count += count
            if count > 0:
                confidence = min(0.9, 0.6 + (count / total_emails))
                patterns.append(PatternEvidence(
                    pattern_type="transaction_activity",
                    observation=f"{category} communications",
                    frequency=count,
                    context=f"{count} {category.lower()} related emails ({count/total_emails:.1%} of total)",
                    confidence=confidence
                ))
        
        # Overall transaction engagement
        if transaction_count > 0:
            transaction_ratio = transaction_count / total_emails
            patterns.append(PatternEvidence(
                pattern_type="purchase_engagement",
                observation="Active transaction communication",
                frequency=transaction_count,
                context=f"{transaction_count} total transaction-related communications ({transaction_ratio:.1%})",
                confidence=min(0.9, 0.5 + transaction_ratio)
            ))
        
        return patterns
    
    def _analyze_behavior_patterns_neutral(self, df: pd.DataFrame) -> List[PatternEvidence]:
        """Analyze behavioral patterns without assumptions."""
        patterns = []
        total_emails = len(df)
        
        # Security engagement patterns
        security_keywords = ['security', 'alert', 'login', 'password', 'verification']
        topics_col = 'Key_Topics' if 'Key_Topics' in df.columns else 'Products'
        security_count = self._count_keywords_neutral(df, security_keywords,
                                                     [topics_col, 'Subject', 'Category'])
        
        if security_count > 0:
            confidence = min(0.8, 0.4 + (security_count / total_emails * 2))
            patterns.append(PatternEvidence(
                pattern_type="security_engagement",
                observation="Security-related communications",
                frequency=security_count,
                context=f"{security_count} security-related communications ({security_count/total_emails:.1%})",
                confidence=confidence
            ))
        
        # Information consumption patterns
        info_keywords = ['newsletter', 'update', 'news', 'report', 'analysis']
        topics_col = 'Key_Topics' if 'Key_Topics' in df.columns else 'Products'
        info_count = self._count_keywords_neutral(df, info_keywords,
                                                 ['Subject', topics_col, 'Category'])
        
        if info_count > 0:
            confidence = min(0.8, 0.3 + (info_count / total_emails * 2))
            patterns.append(PatternEvidence(
                pattern_type="information_consumption",
                observation="Information consumption behavior",
                frequency=info_count,
                context=f"{info_count} information-related communications ({info_count/total_emails:.1%})",
                confidence=confidence
            ))
        
        return patterns
    
    def _count_keywords_neutral(self, df: pd.DataFrame, keywords: List[str], columns: List[str]) -> int:
        """Count keywords across columns without bias."""
        total_count = 0
        for col in columns:
            if col in df.columns:
                for keyword in keywords:
                    total_count += df[col].str.contains(keyword, na=False, case=False).sum()
        return total_count
    
    def _analyze_communication_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze communication patterns neutrally."""
        patterns = {}
        
        # Volume and frequency
        patterns['volume_metrics'] = {
            'total_communications': len(df),
            'unique_senders': df['From'].nunique() if 'From' in df.columns else 0,
            'category_diversity': df['Category'].nunique() if 'Category' in df.columns else 0
        }
        
        # Category distribution (neutral)
        if 'Category' in df.columns:
            category_dist = df['Category'].value_counts(normalize=True).to_dict()
            patterns['category_distribution'] = category_dist
            patterns['primary_communication_type'] = max(category_dist, key=category_dist.get)
        
        # Sentiment patterns (if available)
        if 'Sentiment' in df.columns:
            sentiment_dist = df['Sentiment'].value_counts(normalize=True).to_dict()
            patterns['sentiment_profile'] = sentiment_dist
        
        return patterns
    
    def _analyze_interest_clusters(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze interest clusters without demographic assumptions."""
        clusters = {}
        
        if 'Key_Topics' in df.columns:
            # Extract and cluster topics
            all_topics = []
            for topics in df['Key_Topics'].dropna():
                if isinstance(topics, str) and topics.strip():
                    topic_list = [t.strip().lower() for t in topics.split(',') if t.strip()]
                    all_topics.extend(topic_list)
            
            if all_topics:
                topic_freq = Counter(all_topics)
                
                # Group topics into natural clusters
                clusters['topic_frequency'] = dict(topic_freq.most_common(20))
                clusters['total_unique_topics'] = len(topic_freq)
                clusters['total_mentions'] = len(all_topics)
                clusters['topic_diversity'] = len(topic_freq) / len(all_topics) if all_topics else 0
                
                # Identify dominant themes without bias
                top_topics = dict(topic_freq.most_common(5))
                clusters['dominant_themes'] = top_topics
        
        return clusters
    
    def _analyze_purchase_behavior_neutral(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze purchase behavior using LLM semantic analysis."""
        behavior = {}
        
        # Get potential purchase emails (including those categorized as 'Purchase')
        potential_purchase_emails = df[df['Category'].isin(['Purchase', 'Invoice', 'Shipment Related', 'Bank Related'])]
        
        if not potential_purchase_emails.empty:
            # Use LLM to verify actual purchases vs marketing emails
            verified_purchases = self._verify_actual_purchases(potential_purchase_emails)
            behavior['confirmed_transactions'] = verified_purchases
            behavior['transaction_count'] = len(verified_purchases)
            behavior['transaction_frequency'] = len(verified_purchases) / len(df) if len(df) > 0 else 0
        else:
            behavior['confirmed_transactions'] = []
            behavior['transaction_count'] = 0
            behavior['transaction_frequency'] = 0
        
        # LLM-based product and service analysis
        behavior.update(self._analyze_products_and_services_llm(df))
        
        return behavior
    
    def _verify_actual_purchases(self, potential_purchases: pd.DataFrame) -> List[Dict[str, Any]]:
        """Use LLM to verify which emails represent actual purchases vs marketing."""
        if potential_purchases.empty:
            return []
        
        # Prepare email data for LLM analysis
        email_data = []
        for _, email in potential_purchases.iterrows():
            email_data.append({
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'products': email.get('Products', ''),
                'date': email.get('Date', ''),
                'category': email.get('Category', '')
            })
        
        system_prompt = """You are an expert at analyzing email content to distinguish between actual purchase confirmations and marketing/promotional emails.

ACTUAL PURCHASE INDICATORS:
- Order confirmations with specific order numbers
- Payment confirmations from payment processors
- Shipping notifications with tracking numbers
- Invoices with specific amounts and transaction IDs
- Receipts with itemized purchases
- Subscription charges/renewals with specific amounts

MARKETING EMAIL INDICATORS:
- Promotional language ("Sale!", "Up to X% off", "Shop now")
- Generic product mentions without specific purchases
- Calls to action to visit websites or make purchases
- Newsletter-style content about products/services
- Abandoned cart reminders
- General announcements about sales or new products

OUTPUT: Only include emails that represent confirmed, completed transactions."""

        user_prompt = f"""Analyze these {len(email_data)} emails to identify which represent actual completed purchases (not marketing/promotional content).

EMAILS TO ANALYZE:
{json.dumps(email_data, indent=2)}

For each email that represents an ACTUAL PURCHASE (not marketing), return a JSON object:
{{
  "verified_purchases": [
    {{
      "item": "specific product/service purchased",
      "source": "email sender",
      "date": "purchase date",
      "context": "brief description of the actual transaction",
      "confidence": "high/medium/low confidence this is a real purchase"
    }}
  ]
}}

CRITICAL: Only include emails that confirm completed transactions. Exclude all promotional, marketing, or sales emails."""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.2,  # Low temperature for accurate classification
                json_mode=True
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                analysis = self._parse_json_response(response.content)
                return analysis.get('verified_purchases', [])
            else:
                return []
                
        except Exception as e:
            self.logger.error(f"Purchase verification failed: {e}")
            return []
    
    def _analyze_products_and_services_llm(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Use LLM to analyze products and services from email content."""
        if df.empty:
            return {}
        
        # Sample emails for analysis (limit to avoid token limits)
        sample_size = min(50, len(df))
        sample_df = df.sample(n=sample_size, random_state=self.seed) if len(df) > sample_size else df
        
        # Prepare email content
        email_contents = []
        for _, email in sample_df.iterrows():
            email_contents.append({
                'subject': email.get('Subject', ''),
                'summary': email.get('Summary', ''),
                'key_topics': email.get('Key_Topics', ''),
                'category': email.get('Category', '')
            })
        
        system_prompt = """You are analyzing email communications to understand product and service interests, spending patterns, and brand engagement.

ANALYSIS FOCUS:
- Identify genuine product/service interests from communication patterns
- Distinguish between marketing exposure and actual engagement
- Analyze spending categories and brand preferences
- Detect research behavior and consideration phases
- Identify subscription services and recurring engagements

IGNORE:
- Spam and unwanted marketing emails
- Generic promotional content without engagement
- Automated notifications without relevance to interests"""

        user_prompt = f"""Analyze these {len(email_contents)} email communications to understand product and service engagement patterns.

EMAIL COMMUNICATIONS:
{json.dumps(email_contents, indent=2)}

Provide analysis as a JSON object with this structure:
{{
  "product_interests": {{
    "categories": ["list of product categories showing genuine interest"],
    "specific_products": ["specific products mentioned with engagement context"],
    "brands_engaged": ["brands with meaningful communication interaction"]
  }},
  "service_engagement": {{
    "subscriptions": ["active or considered subscription services"],
    "professional_services": ["professional services engaged with"],
    "digital_services": ["digital platforms and services used"]
  }},
  "spending_patterns": {{
    "transaction_categories": ["categories with actual spending evidence"],
    "price_sensitivity": "analysis of price-related communication patterns",
    "purchase_frequency": "patterns in purchase-related communications"
  }},
  "research_behavior": {{
    "consideration_categories": ["product categories in research phase"],
    "information_seeking": ["types of product information actively sought"],
    "comparison_shopping": ["evidence of comparing products/services"]
  }}
}}"""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.3,
                json_mode=True
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                analysis = self._parse_json_response(response.content)
                return {
                    'product_analysis': analysis.get('product_interests', {}),
                    'service_analysis': analysis.get('service_engagement', {}),
                    'spending_analysis': analysis.get('spending_patterns', {}),
                    'research_behavior': analysis.get('research_behavior', {})
                }
            else:
                return {}
                
        except Exception as e:
            self.logger.error(f"Product analysis failed: {e}")
            return {}
    
    def _categorize_products_neutral(self, products: List[str]) -> Dict[str, int]:
        """Categorize products neutrally without value assumptions."""
        categories = {
            'technology': ['app', 'software', 'digital', 'tech', 'device', 'phone', 'computer'],
            'services': ['subscription', 'service', 'membership', 'account'],
            'physical_goods': ['product', 'item', 'equipment', 'tool', 'appliance'],
            'media': ['book', 'video', 'music', 'content', 'streaming'],
            'financial': ['investment', 'crypto', 'currency', 'trading', 'portfolio']
        }
        
        category_counts = defaultdict(int)
        
        for product in products:
            product_lower = product.lower()
            for category, keywords in categories.items():
                if any(keyword in product_lower for keyword in keywords):
                    category_counts[category] += 1
                    break
            else:
                category_counts['other'] += 1
        
        return dict(category_counts)
    
    def _discover_geographic_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Use LLM to discover geographic patterns from email content."""
        return self._analyze_geographic_indicators_llm(df)
    
    def _analyze_temporal_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze temporal patterns in communications."""
        patterns = {}
        
        if 'Date' in df.columns:
            df_copy = df.copy()
            df_copy['Date'] = pd.to_datetime(df_copy['Date'], errors='coerce', utc=True)
            df_copy = df_copy.dropna(subset=['Date'])
            
            if not df_copy.empty and pd.api.types.is_datetime64_any_dtype(df_copy['Date']):
                # Date range
                date_range = {
                    'start': df_copy['Date'].min().isoformat(),
                    'end': df_copy['Date'].max().isoformat(),
                    'span_days': (df_copy['Date'].max() - df_copy['Date'].min()).days
                }
                patterns['date_range'] = date_range
                
                # Day of week patterns
                df_copy['day_of_week'] = df_copy['Date'].dt.day_name()
                day_dist = df_copy['day_of_week'].value_counts().to_dict()
                patterns['day_distribution'] = day_dist
                
                # Time of day patterns (if time available)
                if df_copy['Date'].dt.hour.notna().any():
                    hour_dist = df_copy['Date'].dt.hour.value_counts().head(10).to_dict()
                    patterns['hour_distribution'] = hour_dist
        
        return patterns
    
    def _build_engagement_profile(self, df: pd.DataFrame, evidence: List[PatternEvidence]) -> Dict[str, Any]:
        """Build engagement profile based on observed patterns."""
        profile = {}
        
        # Communication engagement level
        total_emails = len(df)
        if total_emails > 200:
            profile['engagement_level'] = 'high'
        elif total_emails > 50:
            profile['engagement_level'] = 'moderate'
        else:
            profile['engagement_level'] = 'low'
        
        # Diversity of engagement
        category_count = df['Category'].nunique() if 'Category' in df.columns else 0
        profile['engagement_diversity'] = {
            'category_count': category_count,
            'diversity_level': 'high' if category_count > 6 else 'moderate' if category_count > 3 else 'low'
        }
        
        # Activity patterns from evidence
        high_conf_patterns = [e for e in evidence if e.confidence > 0.7]
        profile['significant_patterns'] = len(high_conf_patterns)
        profile['pattern_confidence'] = np.mean([e.confidence for e in evidence]) if evidence else 0
        
        return profile
    
    def _explore_demographic_possibilities(self, df: pd.DataFrame, evidence: List[PatternEvidence], geographic_indicators: Dict[str, Any] = None) -> Dict[str, Any]:
        """Explore demographic possibilities without making assumptions."""
        
        # Prepare neutral evidence summary
        evidence_summary = self._format_evidence_neutral(evidence)
        communication_summary = self._summarize_communications_neutral(df)
        
        # Prepare geographic context from existing analysis
        geographic_context = ""
        if geographic_indicators and geographic_indicators.get('likely_region'):
            geographic_context = f"""
EXISTING GEOGRAPHIC ANALYSIS (DO NOT OVERRIDE):
Location: {geographic_indicators.get('likely_region', 'Unknown')}
Confidence: {geographic_indicators.get('confidence', 'Unknown')}
Evidence: {', '.join(geographic_indicators.get('location_indicators', []))}

IMPORTANT: Use this existing geographic analysis rather than creating a new one."""
        
        system_prompt = """You are an expert data analyst specializing in behavioral pattern analysis from communication data.

ANALYSIS APPROACH:
- Extract meaningful insights from communication patterns, spending behavior, and engagement data
- Base conclusions on evidence strength and frequency patterns
- Provide specific demographic insights where data supports them
- Avoid stereotypical assumptions (e.g., don't assume interests correlate with gender/age without evidence)
- Present confident analysis where data is strong, acknowledge uncertainty where data is weak
- Focus on behavioral patterns that indicate demographic characteristics
- CRITICAL: Use existing geographic analysis when provided - do not create conflicting location assessments

CONFIDENCE LEVELS:
- High: Strong evidence from multiple data points
- Medium: Moderate evidence with some supporting patterns  
- Low: Limited evidence, multiple possibilities remain

OUTPUT: Analytical JSON with specific insights where supported by evidence."""

        user_prompt = f"""COMMUNICATION EVIDENCE:
{evidence_summary}

COMMUNICATION SUMMARY:
{communication_summary}
{geographic_context}

Analyze this communication data to determine demographic characteristics. Provide specific insights where evidence supports them.

Required JSON structure:
{{
  "age_analysis": {{
    "likely_range": "most probable age range based on communication patterns",
    "confidence": "high/medium/low",
    "evidence": "specific patterns supporting this conclusion"
  }},
  "lifestyle_profile": {{
    "characteristics": ["specific lifestyle traits indicated by communication patterns"],
    "confidence": "high/medium/low",
    "evidence": "supporting behavioral patterns"
  }},
  "economic_indicators": {{
    "spending_patterns": ["observed spending behaviors and transaction patterns"],
    "income_signals": "economic bracket indicators from communication data",
    "confidence": "high/medium/low"
  }},
  "geographic_analysis": {{
    "location_indicators": ["REFERENCE existing geographic analysis - do not create new assessment"],
    "likely_region": "USE existing geographic analysis result",
    "confidence": "REFERENCE existing geographic confidence level"
  }},
  "data_quality": "assessment of data completeness and analysis limitations"
}}"""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.3  # Lower temperature for more conservative analysis
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                analysis = self._parse_json_response(response.content)
                return analysis
            else:
                return self._get_default_possibilities()
                
        except Exception as e:
            self.logger.error(f"Demographic possibility analysis failed: {e}")
            return self._get_default_possibilities()
    
    def _detect_purchase_signals_with_context(self, df: pd.DataFrame, evidence: List[PatternEvidence], existing_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Use LLM to analyze email content for sophisticated purchase prediction using product taxonomy and existing analysis."""
        return self._analyze_purchase_intentions_with_existing_analysis(df, evidence, existing_analysis)
    
    def _analyze_purchase_intentions_with_existing_analysis(self, df: pd.DataFrame, evidence: List[PatternEvidence], existing_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze purchase intentions using existing comprehensive marketing analysis."""
        if df.empty:
            return []
        
        # Load the product taxonomy
        taxonomy = self._load_product_taxonomy()
        if not taxonomy:
            return []
        
        # Add email sample to existing analysis
        full_analysis = existing_analysis.copy()
        full_analysis['pattern_evidence'] = [asdict(e) for e in evidence]
        full_analysis['email_sample'] = self._get_recent_email_sample(df)
        
        # Use LLM with taxonomy and existing analysis
        return self._predict_top_purchases_with_full_analysis(full_analysis, taxonomy)
    
    def _detect_purchase_signals(self, df: pd.DataFrame, evidence: List[PatternEvidence]) -> List[Dict[str, Any]]:
        """Use LLM to analyze email content for sophisticated purchase prediction using product taxonomy."""
        return self._analyze_purchase_intentions_with_taxonomy(df, evidence)
    
    def _analyze_authentic_ikigai(self, processed_emails: List[Dict[str, Any]], output_prefix: str = None) -> Dict[str, Any]:
        """Analyze email patterns for authentic ikigai using Yukari Mitsuhashi's framework."""
        try:
            # Initialize authentic ikigai analyzer
            authentic_analyzer = AuthenticIkigaiAnalyzer(self.llm_client, self.logger)
            
            # Perform authentic analysis (excludes marketing/commercial content)
            authentic_insights = authentic_analyzer.analyze_emails(processed_emails, output_prefix)
            
            # Convert to dictionary format
            return {
                'primary_ikigai': authentic_insights.primary_ikigai,
                'secondary_areas': authentic_insights.secondary_areas,
                'confidence_score': authentic_insights.confidence_score,
                'supporting_evidence': authentic_insights.supporting_evidence,
                'framework_dimensions': authentic_insights.framework_dimensions,
                'personal_patterns': authentic_insights.personal_patterns,
                'recommendations': authentic_insights.recommendations,
                'analysis_timestamp': authentic_insights.analysis_timestamp
            }
            
        except Exception as e:
            self.logger.error(f"Authentic ikigai analysis failed: {e}")
            return {
                'primary_ikigai': 'Authentic Analysis Failed',
                'secondary_areas': [],
                'confidence_score': 0.0,
                'supporting_evidence': [],
                'framework_dimensions': {'error': str(e)},
                'personal_patterns': {'error': 'Analysis failed'},
                'recommendations': ['Retry authentic ikigai analysis with personal communication data'],
                'analysis_timestamp': datetime.utcnow().isoformat()
            }
    
    def _analyze_purchase_intentions_with_taxonomy(self, df: pd.DataFrame, evidence: List[PatternEvidence]) -> List[Dict[str, Any]]:
        """Analyze purchase intentions using the Ad Product Taxonomy and full marketing analysis."""
        if df.empty:
            return []
        
        # Load the product taxonomy
        taxonomy = self._load_product_taxonomy()
        if not taxonomy:
            return []
        
        # Get the comprehensive marketing analysis that was already generated
        full_marketing_analysis = self._get_full_marketing_context(df, evidence)
        
        # Use LLM with taxonomy and full analysis to predict top 5 purchases
        return self._predict_top_purchases_with_full_analysis(full_marketing_analysis, taxonomy)
    
    def _get_full_marketing_context(self, df: pd.DataFrame, evidence: List[PatternEvidence]) -> Dict[str, Any]:
        """Gather all available marketing analysis context for purchase prediction."""
        
        # Generate all the analysis components we need
        communication_patterns = self._analyze_communication_patterns(df)
        interest_clusters = self._analyze_interest_clusters(df) 
        purchase_behavior = self._analyze_purchase_behavior_neutral(df)
        geographic_indicators = self._analyze_geographic_indicators_llm(df)
        temporal_patterns = self._analyze_temporal_patterns(df)
        engagement_profile = self._build_engagement_profile(df, evidence)
        
        # Compile comprehensive context
        return {
            'communication_patterns': communication_patterns,
            'interest_clusters': interest_clusters,
            'purchase_behavior': purchase_behavior,
            'geographic_indicators': geographic_indicators,
            'temporal_patterns': temporal_patterns,
            'engagement_profile': engagement_profile,
            'pattern_evidence': [asdict(e) for e in evidence],
            'email_sample': self._get_recent_email_sample(df)
        }
    
    def _get_recent_email_sample(self, df: pd.DataFrame) -> List[Dict[str, str]]:
        """Get sample of recent emails for context."""
        sample_emails = []
        
        # Sort by date if available, otherwise use last entries
        if 'Date' in df.columns:
            df_sorted = df.sort_values('Date', ascending=False)
        else:
            df_sorted = df
        
        # Take last 15 emails for context
        for _, email in df_sorted.head(15).iterrows():
            sample_emails.append({
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'category': email.get('Category', ''),
                'products': email.get('Products', ''),
                'key_topics': email.get('Key_Topics', '')
            })
        
        return sample_emails
    
    def _load_product_taxonomy(self) -> List[Dict[str, str]]:
        """Load and parse the Ad Product Taxonomy with configurable path.

        Resolution order:
        1) llm_config['product_taxonomy_path']
        2) ENV var AD_PRODUCT_TAXONOMY_PATH
        3) Project root file named 'Ad Product Taxonomy 2.0 (1).tsv'
        """
        try:
            import os
            from pathlib import Path

            # 1) From llm_config
            cfg_path = None
            if isinstance(self.llm_config, dict):
                cfg_path = self.llm_config.get('product_taxonomy_path')

            # 2) From environment
            env_path = os.getenv('AD_PRODUCT_TAXONOMY_PATH')

            # 3) Default to repository root
            # Determine repo root as three levels up from this file: src/email_parser/analysis/
            default_path = Path(__file__).resolve().parents[3] / "Ad Product Taxonomy 2.0 (1).tsv"

            # Choose first existing
            candidate_paths = [p for p in [cfg_path, env_path, str(default_path)] if p]
            taxonomy_path = None
            for p in candidate_paths:
                if Path(p).expanduser().exists():
                    taxonomy_path = Path(p).expanduser()
                    break

            if taxonomy_path is None:
                self.logger.warning("Product taxonomy file not found. Skipping taxonomy-based analysis.")
                return []

            taxonomy = []
            with open(taxonomy_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Skip header line
            for line in lines[1:]:
                if line.strip():
                    parts = line.strip().split('\t')
                    if len(parts) >= 6:
                        taxonomy.append({
                            'unique_id': parts[0],
                            'parent_id': parts[1],
                            'name': parts[2],
                            'tier_1': parts[3],
                            'tier_2': parts[4] if parts[4] else '',
                            'tier_3': parts[5] if parts[5] else ''
                        })

            self.logger.info("Loaded product taxonomy", count=len(taxonomy), path=str(taxonomy_path))
            return taxonomy

        except Exception as e:
            self.logger.error(f"Failed to load product taxonomy: {e}")
            return []
    
    def _extract_email_patterns_for_prediction(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Extract key patterns from emails for purchase prediction."""
        patterns = {
            'categories': df['Category'].value_counts().to_dict() if 'Category' in df.columns else {},
            'key_topics': [],
            'product_mentions': [],
            'service_indicators': [],
            'recent_activity': []
        }
        
        # Extract topics and products
        if 'Key_Topics' in df.columns:
            all_topics = []
            for topics in df['Key_Topics'].dropna():
                if isinstance(topics, str):
                    all_topics.extend([t.strip().lower() for t in topics.split(',') if t.strip()])
            patterns['key_topics'] = Counter(all_topics).most_common(20)
        
        if 'Products' in df.columns:
            all_products = []
            for products in df['Products'].dropna():
                if isinstance(products, str):
                    all_products.extend([p.strip() for p in products.split(',') if p.strip()])
            patterns['product_mentions'] = Counter(all_products).most_common(10)
        
        # Recent activity (last 30 days)
        if 'Date' in df.columns:
            recent_emails = []
            for _, email in df.iterrows():
                recent_emails.append({
                    'subject': email.get('Subject', ''),
                    'summary': email.get('Summary', ''),
                    'category': email.get('Category', ''),
                    'date': email.get('Date', '')
                })
            patterns['recent_activity'] = recent_emails[-20:]  # Last 20 emails
        
        return patterns
    
    def _get_confirmed_purchases(self, df: pd.DataFrame) -> List[Dict[str, str]]:
        """Extract confirmed purchases from the dataset."""
        purchases = []
        purchase_categories = ['Purchase', 'Invoice', 'Shipment Related']
        
        if 'Category' in df.columns:
            purchase_emails = df[df['Category'].isin(purchase_categories)]
            
            for _, email in purchase_emails.iterrows():
                purchases.append({
                    'item': email.get('Products', email.get('Subject', '')),
                    'category': email.get('Category', ''),
                    'summary': email.get('Summary', ''),
                    'date': email.get('Date', ''),
                    'from': email.get('From', '')
                })
        
        return purchases
    
    def _extract_interest_signals(self, df: pd.DataFrame) -> List[str]:
        """Extract interest signals from email content."""
        interests = []
        
        # Look for newsletter subscriptions, browsing behavior, etc.
        if 'Summary' in df.columns:
            for summary in df['Summary'].dropna():
                if isinstance(summary, str):
                    # Extract potential interest indicators
                    summary_lower = summary.lower()
                    if any(word in summary_lower for word in ['newsletter', 'update', 'news', 'blog', 'article']):
                        interests.append(summary[:200])  # Keep context
        
        return interests[:10]  # Top 10 interest signals
    
    def _extract_engagement_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Extract engagement patterns relevant to purchase prediction."""
        patterns = {}
        
        if 'From' in df.columns:
            sender_frequency = df['From'].value_counts()
            patterns['frequent_senders'] = sender_frequency.head(10).to_dict()
            patterns['sender_diversity'] = len(sender_frequency)
        
        if 'Category' in df.columns:
            patterns['category_engagement'] = df['Category'].value_counts().to_dict()
        
        patterns['total_emails'] = len(df)
        
        return patterns
    
    def _predict_top_purchases_with_full_analysis(self, full_analysis: Dict[str, Any], taxonomy: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """Use LLM with taxonomy and comprehensive marketing analysis to predict purchases."""
        
        # Sample taxonomy for context (focus on consumer categories)  
        consumer_categories = [cat for cat in taxonomy if any(consumer_term in cat.get('tier_1', '') 
                              for consumer_term in ['Consumer Electronics', 'Consumer Packaged Goods', 
                                                   'Durable Goods', 'Retail', 'Travel and Tourism', 
                                                   'Fitness Activities', 'Sporting Goods'])][:150]
        
        system_prompt = """You are an expert consumer behavior analyst and purchase prediction specialist with deep expertise in lifestyle-based marketing.

CRITICAL ANALYSIS REQUIREMENTS:
- Extract lifestyle indicators (club memberships, geographic location, life stage signals)
- Identify specific brands the consumer engages with regularly  
- Look for complementary products to recent purchases
- Consider family/household composition from communication patterns
- Analyze premium vs budget preferences from confirmed purchases
- Use geographic and temporal patterns to inform predictions

LIFESTYLE ANALYSIS PRIORITIES:
1. Club memberships, sports activities, hobby indicators
2. Premium brand preferences and luxury indicators  
3. Family/children signals in communications
4. Geographic lifestyle patterns (urban/suburban/rural)
5. Professional/career indicators affecting purchase patterns
6. Seasonal and temporal purchase behaviors

PURCHASE PREDICTION LOGIC:
- Prioritize products that complement confirmed recent purchases
- Consider lifestyle-appropriate categories (sports equipment for club members, premium products for luxury brand engagement)
- Factor in geographic availability and local business engagement
- Look for purchase gaps in lifestyle categories (golf equipment for golf club members)
- Consider life stage appropriate products

OUTPUT: Sophisticated lifestyle-informed purchase predictions with detailed behavioral reasoning."""

        user_prompt = f"""COMPREHENSIVE CONSUMER MARKETING ANALYSIS:

COMMUNICATION PATTERNS:
{json.dumps(full_analysis.get('communication_patterns', {}), indent=2)}

INTEREST CLUSTERS & LIFESTYLE INDICATORS:
{json.dumps(full_analysis.get('interest_clusters', {}), indent=2)}

CONFIRMED PURCHASE BEHAVIOR:
{json.dumps(full_analysis.get('purchase_behavior', {}), indent=2)}

GEOGRAPHIC & LOCAL ENGAGEMENT:
{json.dumps(full_analysis.get('geographic_indicators', {}), indent=2)}

TEMPORAL PATTERNS:
{json.dumps(full_analysis.get('temporal_patterns', {}), indent=2)}

ENGAGEMENT PROFILE:
{json.dumps(full_analysis.get('engagement_profile', {}), indent=2)}

BEHAVIORAL EVIDENCE PATTERNS:
{json.dumps(full_analysis.get('pattern_evidence', []), indent=2)}

RECENT EMAIL CONTEXT:
{json.dumps(full_analysis.get('email_sample', []), indent=2)}

PRODUCT TAXONOMY OPTIONS:
{json.dumps(consumer_categories, indent=2)}

ANALYSIS TASK:
Using the comprehensive marketing analysis above, predict the 5 most likely purchases. Focus particularly on:

1. LIFESTYLE INDICATORS: What clubs, activities, or lifestyle signals suggest specific product needs?
2. BRAND ENGAGEMENT: Which specific brands does this consumer interact with regularly?
3. PURCHASE COMPLEMENTS: What products would complement their recent confirmed purchases?
4. LIFE STAGE SIGNALS: Any indicators of children, family, professional needs?
5. GEOGRAPHIC CONTEXT: Local businesses and regional preferences that inform product choices
6. PREMIUM INDICATORS: Evidence of premium vs budget preferences

Return detailed predictions in this format:
{{
  "purchase_predictions": [
    {{
      "rank": 1,
      "category": "exact category name from taxonomy",
      "tier_1": "tier 1 from taxonomy",
      "tier_2": "tier 2 from taxonomy", 
      "tier_3": "tier 3 from taxonomy if applicable",
      "probability": 0.XX,
      "reasoning": "specific lifestyle/behavioral evidence from the analysis above",
      "lifestyle_connection": "how this connects to their lifestyle patterns",
      "brand_connection": "specific brands they engage with in this category",
      "purchase_timeline": "immediate/short-term/medium-term",
      "confidence": "high/medium/low"
    }}
  ]
}}

REQUIREMENTS:
- Base ALL predictions on specific evidence from the comprehensive analysis
- Reference club memberships, brand engagements, geographic patterns
- Consider product complementarity to recent purchases
- Use lifestyle indicators to inform category selection
- Exactly 5 predictions with probabilities between 0.01-0.95"""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.3
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                analysis = self._parse_json_response(response.content)
                predictions = analysis.get('purchase_predictions', [])
                
                # Validate and format predictions
                return self._validate_purchase_predictions(predictions)
            else:
                self.logger.warning("Purchase prediction analysis failed")
                return []
                
        except Exception as e:
            self.logger.error(f"Purchase prediction with taxonomy failed: {e}")
            return []
    
    def _validate_purchase_predictions(self, predictions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate and clean purchase predictions."""
        validated = []
        
        for pred in predictions[:5]:  # Ensure max 5 predictions
            if isinstance(pred, dict) and pred.get('category'):
                # Ensure probability is within valid range
                prob = pred.get('probability', 0.1)
                if isinstance(prob, (int, float)):
                    prob = max(0.01, min(0.95, float(prob)))
                else:
                    prob = 0.1
                
                validated_pred = {
                    'rank': pred.get('rank', len(validated) + 1),
                    'category': pred.get('category', 'Unknown'),
                    'tier_1': pred.get('tier_1', ''),
                    'tier_2': pred.get('tier_2', ''),
                    'tier_3': pred.get('tier_3', ''),
                    'probability': prob,
                    'reasoning': pred.get('reasoning', 'Based on observed patterns'),
                    'lifestyle_connection': pred.get('lifestyle_connection', 'General consumer behavior'),
                    'brand_connection': pred.get('brand_connection', 'No specific brand identified'),
                    'purchase_timeline': pred.get('purchase_timeline', 'medium-term'),
                    'confidence': pred.get('confidence', 'medium')
                }
                validated.append(validated_pred)
        
        return validated
    
    def _analyze_purchase_intentions_llm(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Use LLM to analyze email content for sophisticated purchase intention detection."""
        if df.empty:
            return []
        
        # Sample recent emails for purchase intention analysis
        sample_size = min(75, len(df))
        # Prioritize recent emails for purchase prediction
        df_sorted = df.sort_values('Date', ascending=False) if 'Date' in df.columns else df
        sample_df = df_sorted.head(sample_size)
        
        # Prepare email content for analysis
        email_data = []
        for _, email in sample_df.iterrows():
            email_data.append({
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'key_topics': email.get('Key_Topics', ''),
                'category': email.get('Category', ''),
                'products': email.get('Products', ''),
                'date': email.get('Date', ''),
                'sentiment': email.get('Sentiment', '')
            })
        
        system_prompt = """You are an expert consumer behavior analyst specializing in purchase intention detection from email communication patterns.

PURCHASE INTENTION ANALYSIS:
- Identify genuine research and consideration behavior
- Detect progression through purchase funnel stages
- Analyze engagement with product categories and brands
- Distinguish between passive marketing exposure and active shopping behavior
- Identify subscription renewal patterns and upgrade considerations
- Detect cross-sell and related product interest patterns

STRONG PURCHASE SIGNALS:
- Multiple emails about same product category over time
- Price comparison emails, review research, specification inquiries  
- Account creation, newsletter subscriptions for specific brands
- Abandoned cart or wishlist communications
- Renewal reminders and upgrade offers being engaged with
- Support or technical inquiries about products considering

WEAK PURCHASE SIGNALS:
- Single promotional emails without follow-up engagement
- Generic newsletters without specific product focus
- One-off marketing communications

TIMELINE ANALYSIS:
- Recent activity (last 30 days) = immediate purchase potential
- Consistent engagement over weeks = medium-term consideration
- Seasonal patterns or lifecycle events = long-term prediction

OUTPUT: Specific, evidence-based purchase predictions with clear reasoning."""

        user_prompt = f"""Analyze these {len(email_data)} recent email communications to identify genuine purchase intentions and predict likely future purchases.

EMAIL COMMUNICATIONS:
{json.dumps(email_data, indent=2)}

Identify specific purchase intentions with evidence from the email patterns and return as a JSON object:

{{
  "purchase_predictions": [
    {{
      "category": "specific product/service category based on email evidence",
      "signal_strength": "high/medium/low based on engagement patterns",
      "evidence": "specific email patterns, frequency, and behaviors supporting this prediction",
      "timeline": "immediate (next 30 days) / near-term (2-3 months) / long-term (6+ months)",
      "confidence": "high/medium/low confidence in this prediction"
    }}
  ],
  "shopping_behavior_insights": "overall patterns in purchase research and consideration behavior"
}}

Only include predictions with clear evidence from email engagement patterns. Exclude generic marketing exposure."""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.3,  # Lower temperature for more focused predictions
                json_mode=True
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                analysis = self._parse_json_response(response.content)
                return analysis.get('purchase_predictions', [])
            else:
                return []
                
        except Exception as e:
            self.logger.error(f"Purchase intention analysis failed: {e}")
            return []
    
    def _analyze_geographic_indicators_llm(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Use LLM to analyze email content for geographic location indicators."""
        if df.empty:
            return {}
        
        # Sample emails for geographic analysis
        sample_size = min(100, len(df))
        sample_df = df.sample(n=sample_size, random_state=self.seed) if len(df) > sample_size else df
        
        # Prepare email content
        email_data = []
        for _, email in sample_df.iterrows():
            email_data.append({
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'key_topics': email.get('Key_Topics', ''),
                'category': email.get('Category', ''),
                'products': email.get('Products', '')
            })
        
        system_prompt = """You are analyzing email communications to identify geographic location indicators from content, not just domains.

GEOGRAPHIC INDICATORS TO IDENTIFY:
- Local business communications (restaurants, stores, services with location mentions)
- Government/municipal communications with specific regions
- Regional news sources and local media
- Location-specific events, meetups, or services
- Shipping addresses, delivery areas mentioned in confirmations
- Currency references in purchase confirmations (£, €, $ etc.)
- Local language variations and regional terminology
- Time zone references in automated emails
- Regional-specific services (NHS, local utilities, regional banks)
- Weather/climate references in communications

AVOID:
- Domain TLD analysis (.com, .uk etc.) - meaningless for location
- Generic international service providers
- Global platforms without location context

FOCUS ON:
- Actual content that reveals physical location or regional affiliation
- Service providers with geographic footprints
- Local government, healthcare, education communications
- Regional retail, dining, entertainment venues"""

        user_prompt = f"""Analyze these {len(email_data)} email communications to identify geographic location indicators from the actual email content and context.

EMAIL COMMUNICATIONS:
{json.dumps(email_data, indent=2)}

Identify location indicators from content and return as a JSON object:

{{
  "geographic_analysis": {{
    "location_indicators": [
      "specific location clues found in email content"
    ],
    "regional_services": [
      "region-specific services, businesses, or organizations"
    ],
    "currency_indicators": "currency symbols or regional pricing observed",
    "local_business_engagement": [
      "local businesses or services engaged with"
    ],
    "likely_region": "most probable geographic region based on content evidence",
    "confidence": "high/medium/low confidence in location assessment"
  }},
  "evidence_summary": "summary of key evidence supporting the geographic assessment"
}}

Base analysis on actual email content, not domain names. Only include indicators with clear geographic relevance."""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.3,
                json_mode=True
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                analysis = self._parse_json_response(response.content)
                return analysis.get('geographic_analysis', {})
            else:
                return {}
                
        except Exception as e:
            self.logger.error(f"Geographic analysis failed: {e}")
            return {}
    
    def _calculate_confidence_metrics(self, evidence: List[PatternEvidence], df: pd.DataFrame) -> Dict[str, float]:
        """Calculate confidence metrics based on evidence quality and data volume."""
        metrics = {}
        
        # Data volume confidence - more generous scaling
        email_count = len(df)
        metrics['data_volume'] = min(1.0, (email_count / 100) * 0.8 + 0.2)
        
        # Evidence quality confidence
        if evidence:
            evidence_confidences = [e.confidence for e in evidence]
            metrics['evidence_quality'] = np.mean(evidence_confidences)
            metrics['evidence_count'] = min(1.0, len(evidence) / 5)  # Less conservative
        else:
            metrics['evidence_quality'] = 0.0
            metrics['evidence_count'] = 0.0
        
        # Pattern diversity - more generous
        pattern_types = set(e.pattern_type for e in evidence)
        metrics['pattern_diversity'] = min(1.0, len(pattern_types) / 5)
        
        # Data completeness
        key_columns = ['From', 'Subject', 'Category', 'Key_Topics']
        available_columns = sum(1 for col in key_columns if col in df.columns and not df[col].isna().all())
        metrics['data_completeness'] = available_columns / len(key_columns)
        
        # Overall confidence - balanced weighting
        metrics['overall_confidence'] = np.mean([
            metrics['data_volume'] * 0.25,
            metrics['evidence_quality'] * 0.35,
            metrics['pattern_diversity'] * 0.20,
            metrics['data_completeness'] * 0.20
        ])
        
        return metrics
    
    def _generate_neutral_summary(self, communication_patterns: Dict[str, Any], 
                                interest_clusters: Dict[str, Any], 
                                purchase_behavior: Dict[str, Any],
                                geographic_indicators: Dict[str, Any], 
                                confidence_metrics: Dict[str, float]) -> str:
        """Generate neutral summary without demographic assumptions."""
        
        summary_data = {
            'communication': communication_patterns,
            'interests': interest_clusters,
            'purchases': purchase_behavior,
            'geographic': geographic_indicators,
            'confidence': confidence_metrics
        }
        
        system_prompt = """You are creating a professional consumer profile summary based on communication pattern analysis.

APPROACH:
- Summarize key behavioral insights and communication patterns
- Highlight significant findings with appropriate confidence levels
- Present actionable insights from the analysis
- Maintain analytical objectivity while providing clear conclusions
- Focus on patterns that indicate consumer characteristics and behavior

TONE: Professional, analytical, insightful, confident where evidence supports conclusions."""

        user_prompt = f"""ANALYSIS RESULTS:
{json.dumps(summary_data, indent=2)}

Create a professional consumer profile summary that highlights key insights from the communication pattern analysis.

Format: Insightful summary paragraph (3-4 sentences) that presents actionable consumer insights, no JSON needed."""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.3
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                return response.content.strip()
            else:
                return self._generate_fallback_summary(communication_patterns, confidence_metrics)
                
        except Exception as e:
            self.logger.error(f"Neutral summary generation failed: {e}")
            return self._generate_fallback_summary(communication_patterns, confidence_metrics)
    
    def _generate_fallback_summary(self, communication_patterns: Dict[str, Any], 
                                 confidence_metrics: Dict[str, float]) -> str:
        """Generate fallback summary when LLM fails."""
        total_emails = communication_patterns.get('volume_metrics', {}).get('total_communications', 0)
        overall_confidence = confidence_metrics.get('overall_confidence', 0) * 100
        
        return f"Communication pattern analysis completed on {total_emails} email records " \
               f"with {overall_confidence:.0f}% overall confidence in pattern identification. " \
               f"Analysis focused on observed behavioral patterns without demographic assumptions. " \
               f"See detailed sections for specific communication and engagement patterns."
    
    def export_insights_to_json(self, insights: UnbiasedMarketingInsights, output_file: str):
        """Export insights to JSON file with proper serialization."""
        import os
        import re
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # Convert insights to dictionary and handle serialization
        insights_dict = asdict(insights)
        insights_serializable = self._convert_to_json_serializable(insights_dict)

        # Optionally redact PII
        redact = False
        try:
            redact = bool(self.llm_config.get('redact_reports'))
        except Exception:
            pass
        if not redact:
            import os as _os
            redact = _os.getenv('REDACT_REPORTS', '') in ('1','true','yes','on')

        if redact:
            insights_serializable = self._redact_object(insights_serializable)
        
        with open(output_file, 'w') as f:
            json.dump(insights_serializable, f, indent=2, ensure_ascii=False)
        
        self.logger.info(
            "Unbiased marketing insights exported",
            output_file=output_file,
            model=insights.analysis_model,
            confidence=insights.confidence_metrics.get('overall_confidence', 0)
        )
    
    def _convert_to_json_serializable(self, obj):
        """Convert object to JSON serializable format."""
        if isinstance(obj, dict):
            return {k: self._convert_to_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_to_json_serializable(item) for item in obj]
        elif isinstance(obj, (np.integer, np.int64)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif pd.isna(obj):
            return None
        else:
            return obj

    def _estimate_section_confidence(self,
                                     df: pd.DataFrame,
                                     df_filtered: pd.DataFrame,
                                     evidence: List[PatternEvidence],
                                     comm: Dict[str, Any],
                                     interests: Dict[str, Any],
                                     purchases: Dict[str, Any],
                                     geo: Dict[str, Any],
                                     temporal: Dict[str, Any]) -> Dict[str, float]:
        # Communication: depends on volume and presence of From/Category
        vol = len(df)
        comm_cols = sum(col in df.columns for col in ['From','Category'])
        comm_conf = min(1.0, 0.2 + 0.2*comm_cols + (vol/200))

        # Interests: presence and diversity of Key_Topics on filtered set
        topics_ok = 1 if ('Key_Topics' in df_filtered.columns and not df_filtered['Key_Topics'].isna().all()) else 0
        diversity = interests.get('topic_diversity', 0)
        interests_conf = min(1.0, 0.2 + 0.4*topics_ok + 0.4*diversity)

        # Purchases: confirmed_transactions proportion
        tx = purchases.get('confirmed_transactions', [])
        tx_conf = 0.2 + 0.8*min(1.0, len(tx)/max(1, vol*0.05))

        # Geography: confidence mapping or indicator count
        geo_conf_map = {'high': 0.9, 'medium': 0.6, 'low': 0.3}
        geo_conf = geo_conf_map.get(str(geo.get('confidence','')).lower(), 0.3)
        if not geo_conf and geo.get('location_indicators'):
            geo_conf = min(0.8, 0.2 + 0.1*len(geo.get('location_indicators', [])))

        # Temporal: if date_range exists and span_days > 0
        span = temporal.get('date_range', {}).get('span_days', 0)
        temporal_conf = 0.2 if not span else min(1.0, 0.3 + span/365)

        # Engagement: number and average confidence of evidence
        evid_avg = np.mean([e.confidence for e in evidence]) if evidence else 0
        engagement_conf = min(1.0, 0.3 + evid_avg)

        return {
            'communication': round(comm_conf, 3),
            'interests': round(interests_conf, 3),
            'purchases': round(tx_conf, 3),
            'geographic': round(geo_conf, 3),
            'temporal': round(temporal_conf, 3),
            'engagement': round(engagement_conf, 3)
        }

    def _redact_object(self, obj):
        """Recursively redact emails and obvious IDs from strings in objects."""
        email_re = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+')
        id_re = re.compile(r'\b(?:#)?[A-Z0-9]{8,}\b')

        def _redact_str(s: str) -> str:
            s = email_re.sub('[redacted-email]', s)
            s = id_re.sub('[redacted-id]', s)
            return s

        if isinstance(obj, dict):
            return {k: self._redact_object(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._redact_object(v) for v in obj]
        if isinstance(obj, str):
            return _redact_str(obj)
        return obj
    
    # Helper methods
    def _format_evidence_neutral(self, evidence: List[PatternEvidence]) -> str:
        """Format evidence neutrally for LLM analysis."""
        if not evidence:
            return "No significant patterns identified."
        
        formatted = ["OBSERVED PATTERNS:"]
        for e in evidence:
            formatted.append(f"• {e.observation}: {e.frequency} occurrences")
            formatted.append(f"  Context: {e.context}")
            formatted.append(f"  Confidence: {e.confidence:.0%}")
            formatted.append("")
        
        return "\n".join(formatted)
    
    def _summarize_communications_neutral(self, df: pd.DataFrame) -> str:
        """Summarize communications neutrally."""
        summary = [f"COMMUNICATION OVERVIEW:"]
        summary.append(f"Total communications: {len(df)}")
        
        if 'Category' in df.columns:
            category_dist = df['Category'].value_counts()
            summary.append(f"Communication categories:")
            for category, count in category_dist.head(5).items():
                pct = count / len(df) * 100
                summary.append(f"  • {category}: {count} ({pct:.1f}%)")
        
        if 'From' in df.columns:
            unique_senders = df['From'].nunique()
            summary.append(f"Unique communication sources: {unique_senders}")
        
        return "\n".join(summary)
    
    def _summarize_patterns_for_predictions(self, df: pd.DataFrame, evidence: List[PatternEvidence]) -> str:
        """Summarize patterns for purchase prediction analysis."""
        summary = ["PATTERN SUMMARY FOR PREDICTION ANALYSIS:"]
        
        # High-confidence patterns
        high_conf = [e for e in evidence if e.confidence > 0.7]
        if high_conf:
            summary.append("High-confidence patterns:")
            for e in high_conf:
                summary.append(f"  • {e.observation} ({e.frequency} occurrences)")
        
        # Engagement patterns
        if 'Category' in df.columns:
            purchase_related = df[df['Category'].isin(['Purchase', 'Invoice', 'Shipment Related'])].shape[0]
            if purchase_related > 0:
                summary.append(f"Transaction communications: {purchase_related}")
        
        # Interest concentration
        if 'Key_Topics' in df.columns:
            all_topics = []
            for topics in df['Key_Topics'].dropna():
                if isinstance(topics, str):
                    all_topics.extend([t.strip().lower() for t in topics.split(',') if t.strip()])
            
            if all_topics:
                topic_freq = Counter(all_topics)
                summary.append("Top interest areas:")
                for topic, count in topic_freq.most_common(5):
                    summary.append(f"  • {topic}: {count} mentions")
        
        return "\n".join(summary)
    
    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """Parse JSON response with enhanced error handling."""
        if not content or not content.strip():
            self.logger.error("Empty response content")
            return {}
        
        original_content = content
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
            
            # Final attempt: try parsing entire content
            return json.loads(content)
            
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON parsing failed: {e}")
            self.logger.debug(f"Original content: {original_content[:200]}...")
            self.logger.debug(f"Cleaned content: {content[:200]}...")
            
            # Return empty dict if all parsing fails
            return {}
    
    def _get_default_possibilities(self) -> Dict[str, Any]:
        """Default demographic possibilities when analysis fails."""
        return {
            "age_possibilities": {
                "ranges": ["Insufficient data for age inference"],
                "confidence": "low",
                "reasoning": "Limited communication patterns for age-related insights"
            },
            "lifestyle_indicators": {
                "observed_patterns": ["Limited lifestyle pattern data"],
                "possible_interpretations": ["Multiple interpretations possible"],
                "confidence": "low"
            },
            "socioeconomic_signals": {
                "spending_indicators": ["Limited spending pattern data"],
                "possible_brackets": ["Insufficient data for economic inferences"],
                "confidence": "low"
            },
            "geographic_possibilities": {
                "location_signals": ["Limited geographic indicators"],
                "possible_regions": ["Multiple regions possible"],
                "confidence": "low"
            },
            "limitations": "Analysis limited by insufficient communication data and absence of clear demographic indicators"
        }
    
    def _filter_marketing_emails(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter out promotional/marketing emails using LLM analysis in batches."""
        if df.empty:
            return df.copy()
        
        # Process in batches to balance accuracy and JSON reliability
        batch_size = 25  # Optimal size for reliable JSON parsing

        # Quick rule-based prefilter to remove obvious marketing before LLM
        prefiltered_df = self._fallback_pattern_filter(df)
        
        if len(prefiltered_df) <= batch_size:
            # Small dataset - process remaining emails directly
            return self._classify_marketing_batch(prefiltered_df, prefiltered_df)
        else:
            # Large dataset - process remaining emails in multiple batches
            return self._classify_marketing_in_batches(prefiltered_df, batch_size)
    
    def _classify_marketing_in_batches(self, df: pd.DataFrame, batch_size: int) -> pd.DataFrame:
        """Process large datasets in multiple small batches for full coverage."""
        all_marketing_indices = set()
        total_emails = len(df)
        
        # Process all emails in batches
        for start_idx in range(0, total_emails, batch_size):
            end_idx = min(start_idx + batch_size, total_emails)
            batch_df = df.iloc[start_idx:end_idx].copy()
            
            self.logger.info(f"Processing batch {start_idx//batch_size + 1}: emails {start_idx}-{end_idx-1}")
            
            # Classify this batch
            batch_marketing_indices = self._classify_batch_with_llm(batch_df)
            all_marketing_indices.update(batch_marketing_indices)
        
        # Filter out all marketing emails found across all batches
        filtered_df = df[~df.index.isin(all_marketing_indices)].copy()
        
        marketing_count = len(all_marketing_indices)
        self.logger.info(f"Batch processing removed {marketing_count} marketing emails from {total_emails} total")
        
        return filtered_df
    
    def _classify_marketing_batch(self, df: pd.DataFrame, batch_df: pd.DataFrame) -> pd.DataFrame:
        """Process a single batch of emails."""
        marketing_indices = self._classify_batch_with_llm(batch_df)
        
        # Filter out marketing emails
        filtered_df = df[~df.index.isin(marketing_indices)].copy()
        
        self.logger.info(f"LLM batch filter removed {len(df) - len(filtered_df)} marketing emails from {len(df)} total")
        return filtered_df
    
    def _classify_batch_with_llm(self, batch_df: pd.DataFrame) -> set:
        """Classify a batch of emails using LLM, return marketing indices."""
        # Prepare emails for analysis
        email_data = []
        for idx, email in batch_df.iterrows():
            email_data.append({
                'index': idx,
                'subject': email.get('Subject', ''),
                'from': email.get('From', ''),
                'summary': email.get('Summary', ''),
                'category': email.get('Category', ''),
                'key_topics': email.get('Key_Topics', '')
            })
        
        system_prompt = """You are an expert email classifier. Your task is to classify emails and return ONLY valid JSON.

MARKETING/PROMOTIONAL EMAIL INDICATORS:
- Promotional language ("Sale!", "Up to X% off", "Shop now", "Don't miss out")
- Mass marketing calls-to-action ("Visit our website", "Shop the sale", "Buy now")
- Newsletter/blog content without personal relevance
- Promotional offers and discounts
- Generic marketing announcements
- Advertising content for products/services

NON-MARKETING EMAIL INDICATORS:
- Personal account notifications (sign-in alerts, password changes)
- Purchase confirmations with specific order details
- Service-related communications (billing, account updates)
- Legitimate news/industry content the user subscribed to
- Professional communications
- Security alerts and system notifications

CRITICAL: You must return ONLY valid JSON. No explanations, no markdown formatting, no extra text. Just pure JSON."""

        user_prompt = f"""Classify these {len(email_data)} emails as either marketing/promotional or non-marketing.

EMAIL DATA:
{json.dumps(email_data, indent=2)}

IMPORTANT: Return ONLY valid JSON in this exact format:
{{
  "marketing_classifications": [
    {{
      "index": 0,
      "is_marketing": true,
      "reasoning": "Contains promotional language"
    }},
    {{
      "index": 1,
      "is_marketing": false,
      "reasoning": "Account notification"
    }}
  ]
}}

Rules:
- Return valid JSON only, no extra text
- Include ALL {len(email_data)} emails in classifications
- Use only true/false for is_marketing (not True/False)
- Keep reasoning brief (under 10 words)
- Ensure proper JSON syntax with quotes and commas"""

        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=self.model_name,  # CRITICAL: Pass exact model name
                temperature=0.2
            )
            
            response = self.llm_client.generate(request)
            
            if response.success:
                analysis = self._parse_json_response(response.content)
                classifications = analysis.get('marketing_classifications', [])
                
                # Check if parsing was successful
                if not classifications and len(email_data) > 0:
                    self.logger.warning(f"Empty classifications for batch, using pattern fallback")
                    return self._get_pattern_marketing_indices(batch_df)
                
                # Build set of marketing email indices
                marketing_indices = set()
                for classification in classifications:
                    if classification.get('is_marketing', False):
                        marketing_indices.add(classification.get('index'))
                
                return marketing_indices
            else:
                self.logger.warning(f"LLM classification failed for batch, using pattern fallback")
                return self._get_pattern_marketing_indices(batch_df)
                
        except Exception as e:
            self.logger.error(f"Batch classification failed: {e}, using pattern fallback")
            return self._get_pattern_marketing_indices(batch_df)
    
    def _get_pattern_marketing_indices(self, df: pd.DataFrame) -> set:
        """Get marketing email indices using pattern matching."""
        marketing_indicators = [
            'sale', 'discount', 'offer', '%', 'shop', 'buy now', 'limited time',
            'deal', 'save', 'clearance', 'promotion', 'special offer',
            'click here', 'visit', 'browse', 'shop now', 'order now', 'get',
            'sign up', 'subscribe', 'join', 'register', 'download',
            'exclusive', 'limited', 'hurry', 'act fast', 'don\'t miss',
            'last chance', 'final', 'new arrival', 'trending',
            'investment opportunity', 'guaranteed returns', 'crypto', 'trump',
            'elon musk', 'secret', 'insider', 'make money', 'profit'
        ]
        
        marketing_indices = set()
        
        for idx, email in df.iterrows():
            subject = str(email.get('Subject', '')).lower()
            summary = str(email.get('Summary', '')).lower()
            from_field = str(email.get('From', '')).lower()
            content = f"{subject} {summary} {from_field}"
            
            # Count promotional indicators
            promotional_score = sum(1 for term in marketing_indicators if term in content)
            
            # Check for marketing domains
            marketing_domains = ['marketing', 'promo', 'offer', 'deals', 'newsletter']
            domain_marketing = any(domain in from_field for domain in marketing_domains)
            
            # Classification logic
            is_marketing = False
            
            if promotional_score >= 2:  # Multiple promotional terms
                is_marketing = True
            elif promotional_score >= 1 and domain_marketing:  # Promotional term + marketing domain
                is_marketing = True
            elif 'unsubscribe' in content:  # Standard marketing email indicator
                is_marketing = True
            elif any(spam_term in content for spam_term in ['investment opportunity', 'guaranteed', 'make money', 'secret']):
                is_marketing = True
            
            if is_marketing:
                marketing_indices.add(idx)
        
        return marketing_indices
    
    def _apply_marketing_filter_full(self, df: pd.DataFrame, marketing_indices: set, sample_df: pd.DataFrame) -> pd.DataFrame:
        """Apply marketing filter to full dataset based on sample analysis."""
        # Get marketing patterns from sample
        marketing_patterns = []
        for idx in marketing_indices:
            if idx in sample_df.index:
                email = sample_df.loc[idx]
                # Extract key patterns from marketing emails
                subject = str(email.get('Subject', '')).lower()
                from_field = str(email.get('From', '')).lower()
                summary = str(email.get('Summary', '')).lower()
                
                # Simple pattern matching for common promotional indicators
                promotional_terms = ['sale', 'offer', 'discount', '%', 'shop', 'buy', 'limited time', 'deal']
                if any(term in subject + ' ' + summary for term in promotional_terms):
                    marketing_patterns.append({
                        'subject_contains': [term for term in promotional_terms if term in subject],
                        'summary_contains': [term for term in promotional_terms if term in summary],
                        'from': from_field
                    })
        
        # Apply patterns to full dataset (simple heuristic)
        filtered_indices = []
        for idx, email in df.iterrows():
            subject = str(email.get('Subject', '')).lower()
            summary = str(email.get('Summary', '')).lower()
            
            # Check if email matches marketing patterns
            is_marketing = False
            promotional_count = sum(1 for term in ['sale', 'offer', 'discount', '%', 'shop', 'buy', 'limited time', 'deal'] 
                                  if term in subject + ' ' + summary)
            
            # If multiple promotional terms, likely marketing
            if promotional_count >= 2:
                is_marketing = True
            
            if not is_marketing:
                filtered_indices.append(idx)
        
        return df.loc[filtered_indices].copy()
    
    def _fallback_pattern_filter(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fallback pattern-based marketing filter when LLM classification fails."""
        if df.empty:
            return df.copy()
        
        marketing_indicators = [
            # Promotional terms
            'sale', 'discount', 'offer', '%', 'shop', 'buy now', 'limited time',
            'deal', 'save', 'clearance', 'promotion', 'special offer',
            # Call-to-action terms
            'click here', 'visit', 'browse', 'shop now', 'order now', 'get',
            'sign up', 'subscribe', 'join', 'register', 'download',
            # Marketing language
            'exclusive', 'limited', 'hurry', 'act fast', 'don\'t miss',
            'last chance', 'final', 'new arrival', 'trending',
            # Investment scams (common pattern)
            'investment opportunity', 'guaranteed returns', 'crypto', 'trump',
            'elon musk', 'secret', 'insider', 'make money', 'profit'
        ]
        
        filtered_indices = []
        marketing_count = 0
        
        for idx, email in df.iterrows():
            subject = str(email.get('Subject', '')).lower()
            summary = str(email.get('Summary', '')).lower()
            from_field = str(email.get('From', '')).lower()
            content = f"{subject} {summary} {from_field}"
            
            # Count promotional indicators
            promotional_score = sum(1 for term in marketing_indicators if term in content)
            
            # Check for marketing domains
            marketing_domains = ['marketing', 'promo', 'offer', 'deals', 'newsletter']
            domain_marketing = any(domain in from_field for domain in marketing_domains)
            
            # Classification logic
            is_marketing = False
            
            if promotional_score >= 2:  # Multiple promotional terms
                is_marketing = True
            elif promotional_score >= 1 and domain_marketing:  # Promotional term + marketing domain
                is_marketing = True
            elif 'unsubscribe' in content:  # Standard marketing email indicator
                is_marketing = True
            elif any(spam_term in content for spam_term in ['investment opportunity', 'guaranteed', 'make money', 'secret']):
                is_marketing = True
            
            # Keep non-marketing emails
            if not is_marketing:
                filtered_indices.append(idx)
            else:
                marketing_count += 1
        
        filtered_df = df.loc[filtered_indices].copy() if filtered_indices else df.iloc[:0].copy()
        
        self.logger.info(f"Pattern-based filter removed {marketing_count} marketing emails from {len(df)} total")
        return filtered_df

    def _create_empty_insights(self) -> UnbiasedMarketingInsights:
        """Create empty insights for no data scenario."""
        return UnbiasedMarketingInsights(
            communication_patterns={'message': 'No communication data available'},
            interest_clusters={'message': 'No interest data available'},
            purchase_behavior={'message': 'No purchase data available'},
            geographic_indicators={'message': 'No geographic data available'},
            temporal_patterns={'message': 'No temporal data available'},
            engagement_profile={'message': 'No engagement data available'},
            pattern_evidence=[],
            demographic_possibilities=self._get_default_possibilities(),
            next_purchase_signals=[],
            ikigai={
                'primary_ikigai': 'No Data Available',
                'secondary_areas': [],
                'confidence_score': 0.0,
                'supporting_evidence': [],
                'framework_dimensions': {'message': 'No personal communication data available'},
                'personal_patterns': {'message': 'No personal patterns found'},
                'recommendations': ['Gather personal communication data for authentic ikigai analysis'],
                'analysis_timestamp': datetime.utcnow().isoformat()
            },
            confidence_metrics={'overall_confidence': 0.0},
            summary="No email data available for pattern analysis.",
            analysis_model=self.analysis_model,
            analysis_timestamp=datetime.utcnow().isoformat()
        )


# Backward compatibility aliases
MarketingAnalyzer = UnbiasedMarketingAnalyzer
EnhancedMarketingAnalyzer = UnbiasedMarketingAnalyzer
MarketingInsights = UnbiasedMarketingInsights
EnhancedMarketingInsights = UnbiasedMarketingInsights
